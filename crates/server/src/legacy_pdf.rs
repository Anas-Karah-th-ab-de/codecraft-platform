//! Beleg-PDFs im Layout des Altsystems (jsPDF, Ordner `pdf-legacy/`).
//!
//! Der Node-Renderer bekommt Vorlage + Daten als JSON auf stdin und liefert das PDF auf stdout.
//! Übernommene Belege tragen ihre Original-Druckdaten (`pdf_snapshot`) und sehen damit exakt
//! aus wie im Altsystem; neue Belege werden in dieselbe Struktur übersetzt.
//! Fehlt Node oder der Renderer, gibt `render` `None` zurück (Aufrufer fällt auf HTML/Chromium zurück).

use codecraft_domain::invoice::{LineItem, Totals, Unit};
use serde_json::{json, Value};
use sqlx::PgConnection;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

fn dir() -> PathBuf {
    std::env::var("PDF_LEGACY_DIR").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("pdf-legacy"))
}

/// Firmenvorlage (Zeile der alten Tabelle InvoiceTemplate). Ohne Eintrag: Daten aus der Umgebung.
pub async fn template(conn: &mut PgConnection) -> Value {
    let row: Option<(Value,)> = sqlx::query_as("SELECT data FROM document_templates WHERE id = 'default'")
        .fetch_optional(conn)
        .await
        .ok()
        .flatten();
    row.map(|r| r.0).unwrap_or_else(|| {
        let c = crate::pdf::Company::from_env();
        json!({
            "companyName": c.name, "contactName": c.owner, "addressLine1": c.address, "addressLine2": "",
            "city": "", "postalCode": "", "country": "", "email": c.email, "website": c.web, "phone": "",
            "taxId": c.tax_id, "bankName": c.bank, "bankIban": "", "bankBic": "", "bankAddress": "",
            "senderBic": "", "payeeName": c.owner, "logoUrl": null, "primaryColor": "#0f172a",
            "accentColor": "#2563eb", "headerTitle": {"de": "RECHNUNG", "en": "INVOICE", "ar": "فاتورة"},
            "introText": {}, "footerText": {}, "closingText": {}, "taxNote": {}, "labels": {}
        })
    })
}

pub async fn render(kind: &str, locale: &str, template: Value, data: Value) -> Option<Vec<u8>> {
    // absolut, weil der Prozess im Renderer-Ordner startet
    let d = std::fs::canonicalize(dir()).ok()?;
    let script = d.join("dist").join("render.js");
    if !script.exists() {
        return None;
    }
    let node = std::env::var("NODE_BIN").unwrap_or_else(|_| "node".into());
    let mut child = tokio::process::Command::new(node)
        .arg(&script)
        .current_dir(&d)
        // Datumsformat wie im Altsystem (Server lief in UTC)
        .env("TZ", std::env::var("PDF_TZ").unwrap_or_else(|_| "UTC".into()))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .ok()?;
    let input = json!({ "kind": kind, "locale": locale, "template": template, "data": data }).to_string();
    let mut stdin = child.stdin.take()?;
    stdin.write_all(input.as_bytes()).await.ok()?;
    drop(stdin);
    let out = tokio::time::timeout(Duration::from_secs(30), child.wait_with_output()).await.ok()?.ok()?;
    if !out.status.success() || !out.stdout.starts_with(b"%PDF") {
        tracing::warn!("pdf-legacy fehlgeschlagen: {}", String::from_utf8_lossy(&out.stderr));
        return None;
    }
    Some(out.stdout)
}

fn ymd(d: Option<chrono::NaiveDate>) -> Value {
    d.map(|d| Value::String(format!("{d}T00:00:00.000Z"))).unwrap_or(Value::Null)
}

/// Adresse „Straße\nPLZ Ort\n…“ in die Felder des Altsystems zerlegen
fn address(company: &str, text: &str) -> Value {
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    let (mut name, mut street, mut zip, mut city) = (None, None, None, None);
    let mut rest = lines.as_slice();
    // Erste Zeile ohne Ziffern vor einer Straße = Ansprechpartner
    if rest.len() >= 3 && !rest[0].chars().any(|c| c.is_ascii_digit()) {
        name = Some(rest[0]);
        rest = &rest[1..];
    }
    if let Some(s) = rest.first() {
        street = Some(*s);
    }
    if let Some(l) = rest.get(1) {
        match l.split_once(' ') {
            Some((z, c)) if z.chars().all(|c| c.is_ascii_digit()) => {
                zip = Some(z);
                city = Some(c);
            }
            _ => city = Some(*l),
        }
    }
    json!({ "company": company, "name": name, "street": street, "zip": zip, "city": city })
}

#[allow(clippy::too_many_arguments)]
pub fn invoice_data(
    number: Option<&str>,
    issue: Option<chrono::NaiveDate>,
    due: Option<chrono::NaiveDate>,
    service: (Option<chrono::NaiveDate>, Option<chrono::NaiveDate>),
    recipient: &str,
    recipient_address: &str,
    items: &[LineItem],
    totals: &Totals,
    currency: &str,
    notes: &str,
) -> Value {
    let today = chrono::Utc::now().date_naive();
    let issue = issue.unwrap_or(today);
    let hours = !items.is_empty() && items.iter().all(|i| i.unit == Unit::Hour);
    let rate = totals.groups.iter().map(|g| g.rate_bp).max().unwrap_or(0) as f64 / 100.0;
    json!({
        "invoiceNumber": number.unwrap_or("ENTWURF"),
        "issuedAt": ymd(Some(issue)),
        "dueDate": ymd(Some(due.unwrap_or(issue + chrono::Days::new(14)))),
        "serviceFrom": ymd(service.0),
        "serviceTo": ymd(service.1.or(service.0)),
        "customerName": recipient,
        "customerAddress": address(recipient, recipient_address),
        "items": items.iter().map(|i| json!({
            "description": i.description,
            "quantity": i.quantity_milli as f64 / 1000.0,
            "unitPrice": i.unit_price.0 as f64 / 100.0,
            "totalPrice": i.net().0 as f64 / 100.0,
            "discount": null, "discountType": null,
        })).collect::<Vec<_>>(),
        "subtotal": totals.net.0 as f64 / 100.0,
        "tax": totals.tax.0 as f64 / 100.0,
        "taxRate": rate,
        "total": totals.gross.0 as f64 / 100.0,
        "currency": currency,
        "notes": if notes.trim().is_empty() { Value::Null } else { Value::String(notes.into()) },
        "discount": null, "discountType": null, "discountAmount": null, "discountDescription": null,
        "unitType": if hours { "HOURS" } else { "QUANTITY" },
    })
}
