//! Rechnungs-PDF: HTML-Vorlage (DE/EN/AR, RTL) → PDF über Headless-Chromium.
//! Chromium übernimmt Textsatz und arabische Schrift korrekt. Ohne Chromium wird HTML geliefert.

use codecraft_domain::invoice::{LineItem, TaxGroup, Unit};
use std::path::PathBuf;
use std::time::Duration;

pub struct Company {
    pub name: String,
    pub owner: String,
    pub address: String,
    pub email: String,
    pub web: String,
    pub bank: String,
    pub tax_id: String,
}

impl Company {
    pub fn from_env() -> Self {
        let v = |k: &str, d: &str| std::env::var(k).unwrap_or_else(|_| d.to_owned());
        Company {
            name: v("COMPANY_NAME", "KM Code Craft"),
            owner: v("COMPANY_OWNER", "Mohamad Anas Kara Mohamad"),
            address: v("COMPANY_ADDRESS", "Al-Debet, Idlib, Syrien"),
            email: v("COMPANY_EMAIL", "ak@code-craft.tech"),
            web: v("COMPANY_WEB", "code-craft.tech"),
            bank: v("COMPANY_BANK", ""),
            tax_id: v("COMPANY_TAX_ID", ""),
        }
    }
}

pub struct PdfInvoice<'a> {
    pub kind: &'a str,
    pub number: Option<&'a str>,
    pub status: &'a str,
    pub locale: &'a str,
    pub currency: &'a str,
    pub issue_date: Option<chrono::NaiveDate>,
    pub due_date: Option<chrono::NaiveDate>,
    /// Leistungszeitraum (von, bis)
    pub service: Option<(chrono::NaiveDate, chrono::NaiveDate)>,
    pub recipient_name: &'a str,
    pub recipient_address: &'a str,
    pub recipient_vat_id: Option<&'a str>,
    pub notes: &'a str,
    pub items: &'a [LineItem],
    pub groups: &'a [TaxGroup],
    pub net: i64,
    pub tax: i64,
    pub gross: i64,
    pub tax_notice: Option<&'a str>,
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

struct L {
    invoice: &'static str,
    credit: &'static str,
    draft: &'static str,
    number: &'static str,
    date: &'static str,
    due: &'static str,
    period: &'static str,
    to: &'static str,
    vat_id: &'static str,
    pos: &'static str,
    desc: &'static str,
    qty: &'static str,
    price: &'static str,
    total: &'static str,
    net: &'static str,
    vat: &'static str,
    gross: &'static str,
    units: [&'static str; 5],
    thanks: &'static str,
}

fn labels(locale: &str) -> L {
    match locale {
        "en" => L {
            invoice: "Invoice",
            credit: "Credit note",
            draft: "DRAFT",
            number: "No.",
            date: "Date",
            due: "Due",

            period: "Service period",
            to: "Bill to",
            vat_id: "VAT ID",
            pos: "#",
            desc: "Description",
            qty: "Qty",
            price: "Unit price",
            total: "Amount",
            net: "Net",
            vat: "VAT",
            gross: "Total",
            units: ["h", "pcs", "days", "months", "flat"],
            thanks: "Thank you for your business.",
        },
        "ar" => L {
            invoice: "فاتورة",
            credit: "إشعار دائن",
            draft: "مسودة",
            number: "رقم",
            date: "التاريخ",
            due: "تاريخ الاستحقاق",

            period: "فترة الخدمة",
            to: "إلى",
            vat_id: "الرقم الضريبي",
            pos: "#",
            desc: "الوصف",
            qty: "الكمية",
            price: "سعر الوحدة",
            total: "المبلغ",
            net: "الصافي",
            vat: "الضريبة",
            gross: "الإجمالي",
            units: ["ساعة", "قطعة", "يوم", "شهر", "مقطوع"],
            thanks: "شكراً لثقتكم.",
        },
        _ => L {
            invoice: "Rechnung",
            credit: "Gutschrift",
            draft: "ENTWURF",
            number: "Nr.",
            date: "Datum",
            due: "Fällig",

            period: "Leistungszeitraum",
            to: "Rechnungsempfänger",
            vat_id: "USt-IdNr.",
            pos: "Pos.",
            desc: "Beschreibung",
            qty: "Menge",
            price: "Einzelpreis",
            total: "Betrag",
            net: "Netto",
            vat: "USt.",
            gross: "Gesamt",
            units: ["Std.", "Stk.", "Tage", "Monate", "pausch."],
            thanks: "Vielen Dank für Ihren Auftrag.",
        },
    }
}

fn money(cents: i64, currency: &str, locale: &str) -> String {
    let neg = cents < 0;
    let a = cents.unsigned_abs();
    let (int, frac) = (a / 100, a % 100);
    let mut s = int.to_string();
    let sep = if locale == "de" { '.' } else { ',' };
    let mut i = s.len() as isize - 3;
    while i > 0 {
        s.insert(i as usize, sep);
        i -= 3;
    }
    let dec = if locale == "de" { ',' } else { '.' };
    format!("{}{s}{dec}{frac:02} {currency}", if neg { "-" } else { "" })
}

fn qty(milli: i64, locale: &str) -> String {
    let s = if milli % 1000 == 0 {
        (milli / 1000).to_string()
    } else {
        format!("{:.3}", milli as f64 / 1000.0).trim_end_matches('0').to_string()
    };
    if locale == "de" {
        s.replace('.', ",")
    } else {
        s
    }
}

/// Zahlen, Beträge und Daten immer links-nach-rechts (auch in arabischen Belegen)
fn ltr(s: String) -> String {
    format!("<bdi dir=\"ltr\">{s}</bdi>")
}

fn date(d: Option<chrono::NaiveDate>, locale: &str) -> String {
    d.map(|d| if locale == "de" { d.format("%d.%m.%Y").to_string() } else { d.format("%Y-%m-%d").to_string() })
        .unwrap_or_else(|| "–".into())
}

pub fn render_html(inv: &PdfInvoice, c: &Company) -> String {
    let l = labels(inv.locale);
    let dir = if inv.locale == "ar" { "rtl" } else { "ltr" };
    let title = if inv.kind == "credit_note" { l.credit } else { l.invoice };
    let unit = |u: Unit| match u {
        Unit::Hour => l.units[0],
        Unit::Piece => l.units[1],
        Unit::Day => l.units[2],
        Unit::Month => l.units[3],
        Unit::Flat => l.units[4],
    };
    let rows: String = inv
        .items
        .iter()
        .enumerate()
        .map(|(i, it)| {
            format!(
                "<tr><td>{}</td><td>{}</td><td class=n>{} {}</td><td class=n>{}</td><td class=n>{}</td></tr>",
                i + 1,
                esc(&it.description).replace('\n', "<br>"),
                ltr(qty(it.quantity_milli, inv.locale)),
                unit(it.unit),
                ltr(money(it.unit_price.0, inv.currency, inv.locale)),
                ltr(money(it.net().0, inv.currency, inv.locale))
            )
        })
        .collect();
    let tax_rows: String = inv
        .groups
        .iter()
        .map(|g| {
            format!(
                "<tr><td>{} {}%</td><td class=n>{}</td></tr>",
                l.vat,
                ltr(qty(g.rate_bp as i64 * 10, inv.locale)),
                ltr(money(g.tax.0, inv.currency, inv.locale))
            )
        })
        .collect();
    let draft = if inv.status == "draft" { format!("<div class=wm>{}</div>", l.draft) } else { String::new() };
    let vat_line = inv.recipient_vat_id.map(|v| format!("<br>{}: {}", l.vat_id, esc(v))).unwrap_or_default();
    let notice = inv.tax_notice.map(|t| format!("<p class=notice>{}</p>", esc(t))).unwrap_or_default();
    let notes = if inv.notes.trim().is_empty() { String::new() } else { format!("<p>{}</p>", esc(inv.notes)) };
    let footer: Vec<String> = [&c.owner, &c.address, &c.email, &c.web, &c.tax_id, &c.bank]
        .iter()
        .filter(|s| !s.is_empty())
        .map(|s| esc(s))
        .collect();
    format!(
        r#"<!doctype html><html lang="{lang}" dir="{dir}"><head><meta charset="utf-8"><title>{title} {number}</title>
<style>
@page {{ size: A4; margin: 16mm 16mm 20mm; }}
* {{ box-sizing: border-box; }}
body {{ padding-bottom: 14mm; font-family: "Noto Sans", "Noto Sans Arabic", "DejaVu Sans", Arial, sans-serif; font-size: 10pt; color: #1f2937; margin: 0; }}
.head {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }}
.brand {{ font-size: 20pt; font-weight: 700; color: #1e3a8a; }}
.brand small {{ display: block; font-size: 9pt; font-weight: 400; color: #6b7280; }}
h1 {{ font-size: 18pt; margin: 0; text-align: end; }}
.meta {{ text-align: end; color: #374151; }}
.addr {{ margin: 22px 0; min-height: 70px; }}
.addr b {{ font-size: 8pt; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; display: block; }}
table {{ width: 100%; border-collapse: collapse; }}
.items th {{ background: #eff6ff; text-align: start; padding: 7px 6px; font-size: 9pt; }}
.items td {{ padding: 7px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }}
.n {{ text-align: end; white-space: nowrap; }}
.sum {{ width: 45%; margin-inline-start: auto; margin-top: 12px; }}
.sum td {{ padding: 4px 6px; }}
.sum .g td {{ font-weight: 700; font-size: 12pt; border-top: 2px solid #1f2937; }}
.notice {{ margin-top: 16px; padding: 8px; background: #fef3c7; border-radius: 4px; }}
.foot {{ position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 4px; }}
.wm {{ position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 80pt; color: rgba(220,38,38,.12); transform: rotate(-20deg); font-weight: 800; }}
</style></head><body>
{draft}
<div class="head"><div class="brand">{cname}<small>{caddr}</small></div>
<div><h1>{title}</h1><div class="meta">{ln}: <b>{number}</b><br>{ld}: {idate}<br>{ldue}: {ddate}{period}</div></div></div>
<div class="addr"><b>{lto}</b>{rname}<br>{raddr}{vat_line}</div>
<table class="items"><thead><tr><th>{lpos}</th><th>{ldesc}</th><th class=n>{lqty}</th><th class=n>{lprice}</th><th class=n>{ltotal}</th></tr></thead>
<tbody>{rows}</tbody></table>
<table class="sum"><tr><td>{lnet}</td><td class=n>{net}</td></tr>{tax_rows}<tr class="g"><td>{lgross}</td><td class=n>{gross}</td></tr></table>
{notice}{notes}<p>{thanks}</p>
<div class="foot">{cname} · {footer}</div>
</body></html>"#,
        lang = inv.locale,
        number = ltr(esc(inv.number.unwrap_or("—"))),
        cname = esc(&c.name),
        caddr = esc(&c.address),
        ln = l.number,
        ld = l.date,
        ldue = l.due,
        idate = ltr(date(inv.issue_date, inv.locale)),
        ddate = ltr(date(inv.due_date, inv.locale)),
        period = inv
            .service
            .map(|(f, t)| format!(
                "<br>{}: {} – {}",
                l.period,
                ltr(date(Some(f), inv.locale)),
                ltr(date(Some(t), inv.locale))
            ))
            .unwrap_or_default(),
        lto = l.to,
        rname = esc(inv.recipient_name),
        raddr = esc(inv.recipient_address).replace('\n', "<br>"),
        lpos = l.pos,
        ldesc = l.desc,
        lqty = l.qty,
        lprice = l.price,
        ltotal = l.total,
        lnet = l.net,
        net = ltr(money(inv.net, inv.currency, inv.locale)),
        lgross = l.gross,
        gross = ltr(money(inv.gross, inv.currency, inv.locale)),
        thanks = l.thanks,
        footer = footer.join(" · "),
    )
}

/// Chromium suchen: `CHROMIUM_BIN`, sonst übliche Pfade (auch ohne /snap/bin im PATH)
fn chromium_bin() -> Option<PathBuf> {
    if let Ok(b) = std::env::var("CHROMIUM_BIN") {
        let p = PathBuf::from(&b);
        if p.is_absolute() {
            return p.exists().then_some(p);
        }
    }
    let names = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
    let mut dirs: Vec<PathBuf> =
        std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    dirs.extend(["/snap/bin", "/usr/bin", "/usr/local/bin"].map(PathBuf::from));
    std::env::var("CHROMIUM_BIN")
        .ok()
        .into_iter()
        .chain(names.iter().map(|s| s.to_string()))
        .flat_map(|n| dirs.iter().map(move |d| d.join(&n)))
        .find(|p| p.is_file())
}

/// HTML → PDF mit Headless-Chromium (`CHROMIUM_BIN`, Standard `chromium`). `None`, wenn nicht verfügbar.
pub async fn html_to_pdf(html: &str) -> Option<Vec<u8>> {
    let bin = chromium_bin()?;
    // Snap-Chromium darf nur in nicht-versteckte Ordner unter $HOME schreiben → Arbeitsordner im Projekt
    let dir = std::env::var("PDF_TMP_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default().join("target").join("pdf-tmp"));
    tokio::fs::create_dir_all(&dir).await.ok()?;
    let id = uuid::Uuid::now_v7();
    let src = dir.join(format!("{id}.html"));
    let out = dir.join(format!("{id}.pdf"));
    tokio::fs::write(&src, html).await.ok()?;
    let run = tokio::process::Command::new(&bin)
        // Ohne Anzeige starten: eine gesetzte, aber nicht erreichbare Anzeige (z. B. WSLg)
        // lässt Chromium sonst auch im Headless-Modus hängen
        .env_remove("DISPLAY")
        .env_remove("WAYLAND_DISPLAY")
        .arg("--headless")
        .arg("--disable-gpu")
        .arg("--no-pdf-header-footer")
        .arg(format!("--print-to-pdf={}", out.display()))
        .arg(format!("file://{}", src.display()))
        .kill_on_drop(true)
        .output();
    let ok = matches!(tokio::time::timeout(Duration::from_secs(40), run).await, Ok(Ok(o)) if o.status.success());
    let pdf = if ok { tokio::fs::read(&out).await.ok() } else { None };
    let _ = tokio::fs::remove_file(&src).await;
    let _ = tokio::fs::remove_file(&out).await;
    pdf.filter(|b| b.starts_with(b"%PDF"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats() {
        assert_eq!(money(123456789, "EUR", "de"), "1.234.567,89 EUR");
        assert_eq!(money(-5, "EUR", "en"), "-0.05 EUR");
        assert_eq!(qty(12500, "de"), "12,5");
        assert_eq!(qty(1000, "en"), "1");
        assert_eq!(qty(1900, "de"), "1,9");
        assert_eq!(qty(10000, "de"), "10");
        assert_eq!(qty(19000, "de"), "19");
    }
}
