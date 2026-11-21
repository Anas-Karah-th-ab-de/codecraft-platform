//! Vorschau-Daten je Seite (Titel, Beschreibung, Bild) direkt im HTML.
//!
//! WhatsApp, Telegram, Facebook, LinkedIn und Suchmaschinen führen kein JavaScript aus. Sie sehen nur die
//! `index.html` der Single-Page-App – ohne diese Schicht trüge jede Seite die Daten der Startseite.
//! Sprache: `?lang=de|en|ar`, sonst `Accept-Language`, sonst Deutsch.

use axum::body::Body;
use axum::extract::Request;
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::Response;

const SITE: &str = "https://code-craft.tech";

#[derive(Clone, Copy, PartialEq)]
enum Lang {
    De,
    En,
    Ar,
}

struct Meta {
    title: &'static str,
    desc: &'static str,
    /// Bild relativ zur Seite; `{l}` wird durch die Sprache ersetzt
    image: &'static str,
    noindex: bool,
}

const fn m(title: &'static str, desc: &'static str, image: &'static str) -> Meta {
    Meta { title, desc, image, noindex: false }
}

const HOME_IMG: &str = "/brand/hero-{l}.jpg";

fn lookup(path: &str, l: Lang) -> Meta {
    let p = path.trim_end_matches('/');
    let key = if p.is_empty() { "/" } else { p };
    let pick = |de: Meta, en: Meta, ar: Meta| match l {
        Lang::De => de,
        Lang::En => en,
        Lang::Ar => ar,
    };
    match key {
        "/km-one" => pick(
            m("KM One – das robuste Handy mit Ultar OS · KM Code Craft",
              "Unser eigenes Handy: IP68, tauschbarer Akku, LoRa- und Satelliten-SOS, lokale KI auf Arabisch und unser Betriebssystem Ultar OS. Für Firmen, Behörden und NGOs – Pilotkunden willkommen.",
              "/products/km-one/km-one-hero.jpg"),
            m("KM One – the rugged phone with Ultar OS · KM Code Craft",
              "Our own phone: IP68, replaceable battery, LoRa and satellite SOS, on-device AI in Arabic and our Ultar OS operating system. Built for companies, authorities and NGOs – pilot customers welcome.",
              "/products/km-one/km-one-hero.jpg"),
            m("KM One – الهاتف المتين بنظام Ultar OS · KM Code Craft",
              "هاتفنا الخاص: مقاوم IP68، بطارية قابلة للاستبدال، طوارئ عبر LoRa والأقمار الصناعية، ذكاء اصطناعي محلي بالعربية ونظام التشغيل Ultar OS. للشركات والجهات الرسمية والمنظمات.",
              "/products/km-one/km-one-hero.jpg"),
        ),
        "/ultar-os" => pick(
            m("Ultar OS – eigenes Betriebssystem in Rust · KM Code Craft",
              "Schlankes Betriebssystem für Handy und Tablet, Arabisch zuerst: signierte Apps, Verschlüsselung, eigener Store und Update-Server. Desktop-Version folgt bald. Jetzt im Browser ausprobieren.",
              "/products/ultar-os/uebersicht.png"),
            m("Ultar OS – our own operating system in Rust · KM Code Craft",
              "A lean operating system for phones and tablets, Arabic first: signed apps, encryption, its own store and update server. Desktop version coming soon. Try it in your browser.",
              "/products/ultar-os/uebersicht.png"),
            m("Ultar OS – نظام تشغيل خاص بلغة Rust · KM Code Craft",
              "نظام تشغيل خفيف للهاتف واللوحي، العربية أولاً: تطبيقات موقّعة، تشفير، متجر وخادم تحديثات خاصان. نسخة الحاسوب قريباً. جرّبه الآن في المتصفح.",
              "/products/ultar-os/uebersicht.png"),
        ),
        "/kasse" => pick(
            m("POS Code Craft v3 – Kasse, die auch offline läuft · KM Code Craft",
              "Kasse, Lager und Warenwirtschaft für Handel, Gastronomie und Werkstatt. Kassiert ohne Internet weiter und gleicht später ab. Mehrere Währungen, Arabisch, Englisch, Deutsch.",
              HOME_IMG),
            m("POS Code Craft v3 – a till that keeps working offline · KM Code Craft",
              "Till, stock and inventory for retail, restaurants and workshops. Keeps selling without internet and syncs later. Multiple currencies, Arabic, English, German.",
              HOME_IMG),
            m("POS Code Craft v3 – نقطة بيع تعمل دون إنترنت · KM Code Craft",
              "نقطة بيع ومخزون وإدارة بضائع للمتاجر والمطاعم والورش. تستمر بالبيع دون إنترنت وتزامن لاحقاً. عملات متعددة، عربي وإنجليزي وألماني.",
              HOME_IMG),
        ),
        "/ki-server" => pick(
            m("KI-Server zur Miete – eigene KI ohne Cloud · KM Code Craft",
              "Ihr eigener KI-Server im Haus: Ihre Daten bleiben bei Ihnen. Monatliche Miete inklusive Hardware, Einrichtung, Wartung und Updates.",
              HOME_IMG),
            m("AI server for rent – your own AI, no cloud · KM Code Craft",
              "Your own AI server on your premises: your data stays with you. Monthly rent including hardware, setup, maintenance and updates.",
              HOME_IMG),
            m("خادم ذكاء اصطناعي بالإيجار – دون سحابة · KM Code Craft",
              "خادم ذكاء اصطناعي داخل منشأتك: بياناتك تبقى عندك. إيجار شهري يشمل الجهاز والتجهيز والصيانة والتحديثات.",
              HOME_IMG),
        ),
        "/e-health" | "/radiologie" => pick(
            m("KM Code Craft Radiology – RIS und PACS im eigenen Haus",
              "Radiologie-Informationssystem, Bildarchiv (PACS), Viewer und Befundung – auf Arabisch, auf Ihren eigenen Servern. Demo online.",
              "/products/radiologie/{l}-viewer.png"),
            m("KM Code Craft Radiology – RIS and PACS on your premises",
              "Radiology information system, image archive (PACS), viewer and reporting – in Arabic, on your own servers. Demo online.",
              "/products/radiologie/{l}-viewer.png"),
            m("KM Code Craft Radiology – نظام الأشعة والأرشيف داخل منشأتك",
              "نظام معلومات الأشعة وأرشيف الصور (PACS) والعارض والتقارير – بالعربية وعلى خوادمك الخاصة. عرض تجريبي متاح.",
              "/products/radiologie/{l}-viewer.png"),
        ),
        "/karten" => pick(
            m("Maps Syria – Karten, Routen und Orte für Syrien · KM Code Craft",
              "Unsere eigene Karte für Syrien: Orte finden, Routen planen, Adressen teilen.", HOME_IMG),
            m("Maps Syria – maps, routes and places for Syria · KM Code Craft",
              "Our own map for Syria: find places, plan routes, share addresses.", HOME_IMG),
            m("Maps Syria – خرائط وطرق وأماكن في سوريا · KM Code Craft",
              "خريطتنا الخاصة لسوريا: ابحث عن الأماكن، خطّط الطرق، وشارك العناوين.", HOME_IMG),
        ),
        "/produkte" => pick(
            m("Produkte & Preise · KM Code Craft",
              "KM One, Ultar OS, POS Code Craft v3, KI-Server, Radiology sowie Softwareentwicklung und Beratung – alle Preise netto, direkt aus dem Katalog.",
              HOME_IMG),
            m("Products & prices · KM Code Craft",
              "KM One, Ultar OS, POS Code Craft v3, AI server, Radiology plus software development and consulting – all prices net, straight from the catalogue.",
              HOME_IMG),
            m("المنتجات والأسعار · KM Code Craft",
              "KM One وUltar OS وPOS Code Craft v3 وخادم الذكاء الاصطناعي ونظام الأشعة، إضافة إلى تطوير البرمجيات والاستشارات – كل الأسعار من الكتالوج مباشرة.",
              HOME_IMG),
        ),
        "/karriere" => pick(
            m("Karriere · KM Code Craft",
              "Arbeiten bei KM Code Craft in Idlib oder remote: Software, Elektronik, Server und KI.", HOME_IMG),
            m("Careers · KM Code Craft",
              "Work at KM Code Craft in Idlib or remotely: software, electronics, servers and AI.", HOME_IMG),
            m("الوظائف · KM Code Craft",
              "اعمل مع KM Code Craft في إدلب أو عن بُعد: برمجيات، إلكترونيات، خوادم وذكاء اصطناعي.", HOME_IMG),
        ),
        "/kontakt" => pick(
            m("Kontakt · KM Code Craft",
              "WhatsApp +49 176 4119 4140, E-Mail info@code-craft.tech. Büro: Al-Thalathin-Straße, nahe dem Gouverneurspalast, Idlib. Mo–Fr 09:00–18:00 (Zeit in Damaskus).",
              "/brand/storefront.webp"),
            m("Contact · KM Code Craft",
              "WhatsApp +49 176 4119 4140, email info@code-craft.tech. Office: Al-Thalathin Street, near the Governor's Palace, Idlib. Mon–Fri 09:00–18:00 (Damascus time).",
              "/brand/storefront.webp"),
            m("تواصل معنا · KM Code Craft",
              "واتساب ‎+49 176 4119 4140، البريد info@code-craft.tech. المكتب: شارع الثلاثين، قرب قصر المحافظ، إدلب. الإثنين إلى الجمعة 09:00–18:00 بتوقيت دمشق.",
              "/brand/storefront.webp"),
        ),
        k if k.starts_with("/produkte/") => lookup("/produkte", l),
        k if k.starts_with("/portal") || k.starts_with("/meet") => Meta {
            title: "Portal · KM Code Craft",
            desc: "Kunden- und Mitarbeiterportal von KM Code Craft.",
            image: HOME_IMG,
            noindex: true,
        },
        _ => pick(
            m("KM Code Craft – Technology. Crafted.",
              "Software und Hardware nach Maß aus Idlib: unser Handy KM One, das Betriebssystem Ultar OS, die Kasse POS v3, KI-Server ohne Cloud und ein Radiologie-System. Seit 2014, mit deutscher Qualität.",
              HOME_IMG),
            m("KM Code Craft – Technology. Crafted.",
              "Custom software and hardware from Idlib: our KM One phone, the Ultar OS operating system, the POS v3 till, AI servers without cloud and a radiology system. Since 2014, with German quality.",
              HOME_IMG),
            m("KM Code Craft – Technology. Crafted.",
              "برمجيات وأجهزة حسب الطلب من إدلب: هاتفنا KM One، نظام التشغيل Ultar OS، نقطة البيع POS v3، خوادم ذكاء اصطناعي دون سحابة ونظام للأشعة. منذ 2014 بجودة ألمانية.",
              HOME_IMG),
        ),
    }
}

fn lang_of(req: &Request) -> Lang {
    let from = |s: &str| match s.get(..2).map(|x| x.to_ascii_lowercase()).as_deref() {
        Some("ar") => Some(Lang::Ar),
        Some("en") => Some(Lang::En),
        Some("de") => Some(Lang::De),
        _ => None,
    };
    if let Some(q) = req.uri().query() {
        for kv in q.split('&') {
            if let Some(v) = kv.strip_prefix("lang=") {
                if let Some(l) = from(v) {
                    return l;
                }
            }
        }
    }
    req.headers()
        .get(header::ACCEPT_LANGUAGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| from(v.trim()))
        .unwrap_or(Lang::De)
}

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// Entfernt alle Tags, die mit `start` beginnen (bis zum nächsten `>`, bei `<title>` bis `</title>`).
fn strip(html: &mut String, start: &str, end: &str) {
    while let Some(i) = html.find(start) {
        let Some(j) = html[i..].find(end) else { break };
        html.replace_range(i..i + j + end.len(), "");
    }
}

fn render(mut html: String, path: &str, l: Lang) -> String {
    let meta = lookup(path, l);
    let code = match l {
        Lang::De => "de",
        Lang::En => "en",
        Lang::Ar => "ar",
    };
    strip(&mut html, "<title>", "</title>");
    strip(&mut html, "<meta name=\"description\"", ">");
    strip(&mut html, "<meta property=\"og:", ">");
    // Das Startbild gibt es nur auf Deutsch und Arabisch
    let img_code = if l == Lang::En && meta.image.starts_with("/brand/hero-") { "de" } else { code };
    let image = format!("{SITE}{}", meta.image.replace("{l}", img_code));
    let url = format!("{SITE}{}", if path.is_empty() { "/" } else { path });
    let og_locale = match l {
        Lang::De => "de_DE",
        Lang::En => "en_GB",
        Lang::Ar => "ar_SY",
    };
    let (t, d) = (esc(meta.title), esc(meta.desc));
    let mut head = format!(
        "\n    <title>{t}</title>\n    <meta name=\"description\" content=\"{d}\" />\n    \
         <link rel=\"canonical\" href=\"{url}\" />\n    \
         <meta property=\"og:type\" content=\"website\" />\n    \
         <meta property=\"og:site_name\" content=\"KM Code Craft\" />\n    \
         <meta property=\"og:locale\" content=\"{og_locale}\" />\n    \
         <meta property=\"og:url\" content=\"{url}\" />\n    \
         <meta property=\"og:title\" content=\"{t}\" />\n    \
         <meta property=\"og:description\" content=\"{d}\" />\n    \
         <meta property=\"og:image\" content=\"{image}\" />\n    \
         <meta name=\"twitter:card\" content=\"summary_large_image\" />\n    \
         <meta name=\"twitter:title\" content=\"{t}\" />\n    \
         <meta name=\"twitter:description\" content=\"{d}\" />\n    \
         <meta name=\"twitter:image\" content=\"{image}\" />"
    );
    if meta.noindex {
        head.push_str("\n    <meta name=\"robots\" content=\"noindex\" />");
    }
    if let Some(i) = html.find("<head>") {
        html.insert_str(i + "<head>".len(), &head);
    }
    if l == Lang::Ar {
        html = html.replacen("<html lang=\"de\" dir=\"ltr\">", "<html lang=\"ar\" dir=\"rtl\">", 1);
    } else if l == Lang::En {
        html = html.replacen("<html lang=\"de\"", "<html lang=\"en\"", 1);
    }
    html
}

/// Middleware für die Auslieferung der Single-Page-App
pub async fn inject(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_owned();
    let l = lang_of(&req);
    let res = next.run(req).await;
    let is_html = res
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("text/html"));
    // Nur die App-Seite selbst, keine eigenständigen HTML-Dateien (Demos)
    if res.status() != StatusCode::OK || !is_html || path.rsplit('/').next().is_some_and(|s| s.contains('.')) {
        return res;
    }
    let (mut parts, body) = res.into_parts();
    let Ok(bytes) = axum::body::to_bytes(body, 1024 * 1024).await else {
        return Response::from_parts(parts, Body::empty());
    };
    let html = String::from_utf8_lossy(&bytes);
    if !html.contains("<div id=\"root\">") {
        return Response::from_parts(parts, Body::from(bytes));
    }
    let out = render(html.into_owned(), &path, l);
    parts.headers.remove(header::CONTENT_LENGTH);
    parts.headers.remove(header::ETAG);
    parts.headers.remove(header::LAST_MODIFIED);
    parts.headers.insert(header::VARY, header::HeaderValue::from_static("Accept-Language"));
    Response::from_parts(parts, Body::from(out))
}

#[cfg(test)]
mod tests {
    use super::*;

    const INDEX: &str =
        "<!doctype html>\n<html lang=\"de\" dir=\"ltr\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    \
        <meta name=\"description\" content=\"alt\" />\n    <meta property=\"og:title\" content=\"alt\" />\n    \
        <meta property=\"og:image\" content=\"/brand/hero-de.jpg\" />\n    <title>KM Code Craft</title>\n  </head>\n  \
        <body><div id=\"root\"></div></body></html>";

    #[test]
    fn km_one_hat_eigene_vorschau() {
        let h = render(INDEX.into(), "/km-one", Lang::De);
        assert!(h.contains("<title>KM One – das robuste Handy"));
        assert!(h.contains("og:image\" content=\"https://code-craft.tech/products/km-one/km-one-hero.jpg\""));
        assert!(h.contains("og:url\" content=\"https://code-craft.tech/km-one\""));
        assert!(!h.contains("content=\"alt\""));
        assert_eq!(h.matches("<title>").count(), 1);
    }

    #[test]
    fn arabisch_und_unbekannte_seite() {
        let h = render(INDEX.into(), "/irgendwas", Lang::Ar);
        assert!(h.contains("<html lang=\"ar\" dir=\"rtl\">"));
        assert!(h.contains("hero-ar.jpg"));
        let p = render(INDEX.into(), "/portal/rechnungen", Lang::De);
        assert!(p.contains("noindex"));
        let r = render(INDEX.into(), "/e-health", Lang::En);
        assert!(r.contains("/products/radiologie/en-viewer.png"));
    }
}
