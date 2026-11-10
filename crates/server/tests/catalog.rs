//! Konsistenz Abteilungen ↔ Produkte ↔ Rechnungen ↔ Geräte.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codecraft_server::{app, auth, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

const SENIOR_PRICE: &str = "00000000-0000-7000-8000-000000000202";
const KI_ENTERPRISE_PRICE: &str = "00000000-0000-7000-8000-000000000224";
const KI_SERVER: &str = "00000000-0000-7000-8000-000000000104";
const POS: &str = "00000000-0000-7000-8000-000000000106";

async fn admin(db: &PgPool) -> String {
    let id = Uuid::now_v7();
    let token = auth::new_token("cc_u_");
    sqlx::query("INSERT INTO users (id, email, display_name, role) VALUES ($1, $2, 'A', 'admin')")
        .bind(id)
        .bind(format!("{id}@test"))
        .execute(db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO api_tokens (id, token_hash, user_id, name) VALUES ($1, $2, $3, 't')")
        .bind(Uuid::now_v7())
        .bind(auth::hash_token(&token))
        .bind(id)
        .execute(db)
        .await
        .unwrap();
    token
}

async fn call(db: &PgPool, method: &str, uri: &str, token: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri).header("authorization", format!("Bearer {token}"));
    let body = match body {
        Some(b) => {
            req = req.header("content-type", "application/json");
            Body::from(b.to_string())
        }
        None => Body::empty(),
    };
    let res = app(AppState { db: db.clone() }).oneshot(req.body(body).unwrap()).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn org(db: &PgPool, token: &str, locale: &str) -> String {
    let body = json!({ "name": "Kunde", "address": "Str. 1, Berlin", "locale": locale });
    let (_, v) = call(db, "POST", "/api/v1/organizations", token, Some(body)).await;
    v["id"].as_str().unwrap().to_owned()
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn seeded_catalog_is_consistent(db: PgPool) {
    // Alle 5 Abteilungen aus dem Altsystem, jede mit DE/EN/AR
    let (s, ar) = call(&db, "GET", "/api/v1/public/catalog?locale=ar", "", None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(ar["dir"], "rtl");
    let codes: Vec<&str> = ar["departments"].as_array().unwrap().iter().map(|d| d["code"].as_str().unwrap()).collect();
    assert_eq!(codes, ["ACC", "DEV", "MGT", "SAL", "SUP"]);
    assert!(ar["departments"].as_array().unwrap().iter().any(|d| d["name"] == "التطوير"));

    // Öffentlich: 6 Produkte (KM Code Craft AI ist nicht öffentlich), jedes mit Abteilung und Preisen
    let products = ar["products"].as_array().unwrap();
    assert_eq!(products.len(), 6);
    for p in products {
        assert!(codes.contains(&p["department"].as_str().unwrap()), "{p}");
        assert!(!p["prices"].as_array().unwrap().is_empty(), "{p}");
    }

    // Preise stimmen mit der bisherigen Webseite überein (KI-Server, Pakete, Stundensätze)
    let price = |sku: &str, code: &str| -> Value {
        let p = products.iter().find(|p| p["sku"] == sku).unwrap();
        p["prices"].as_array().unwrap().iter().find(|x| x["code"] == code).unwrap().clone()
    };
    assert_eq!(price("AI-SERVER-RENT", "pilot")["amount_cents"], 49_900);
    assert_eq!(price("AI-SERVER-RENT", "pilot")["billing"], "monthly");
    assert_eq!(price("AI-SERVER-RENT", "pilot")["features"][0], "نموذج ذكاء اصطناعي واحد");
    assert_eq!(price("AI-SERVER-RENT", "professional")["amount_cents"], 199_900);
    assert_eq!(price("AI-SERVER-RENT", "enterprise")["amount_cents"], Value::Null);
    assert_eq!(price("PROJECT-PACKAGE", "core")["amount_cents"], 750_000);
    assert_eq!(price("DEV-HOURLY", "senior")["amount_cents"], 12_000);
    assert_eq!(price("CONSULTING", "consulting")["amount_cents"], 18_000);
    // Kasse: Abo-Pakete, Free kostenlos, alle anderen auf Anfrage (Migration 0028)
    assert_eq!(price("CC-POS-V3", "free")["amount_cents"], 0);
    assert_eq!(price("CC-POS-V3", "business")["amount_cents"], Value::Null);
    assert_eq!(price("CC-POS-V3", "business")["billing"], "on_request");

    // Produktverantwortung: Beratung → Management, Agent → Support, Rest → Entwicklung
    let dept = |sku: &str| products.iter().find(|p| p["sku"] == sku).unwrap()["department"].clone();
    assert_eq!(dept("CONSULTING"), "MGT");
    assert_eq!(dept("SUPPORT-AGENT"), "SUP");
    assert_eq!(dept("CC-POS-V3"), "DEV");
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn db_enforces_translations_and_prices(db: PgPool) {
    let dept = "00000000-0000-7000-8000-000000000001";
    // Arabisch fehlt → abgelehnt
    let r = sqlx::query(
        "INSERT INTO products (id, sku, slug, kind, department_id, name, description)
         VALUES ($1, 'X-1', 'x-1', 'service', $2, '{\"de\":\"X\",\"en\":\"X\",\"ar\":\"\"}', '{\"de\":\"x\",\"en\":\"x\",\"ar\":\"س\"}')",
    )
    .bind(Uuid::now_v7())
    .bind(Uuid::parse_str(dept).unwrap())
    .execute(&db)
    .await;
    assert!(r.is_err());
    // Gerät-Produkt ohne Gerätetyp → abgelehnt
    let r = sqlx::query(
        "INSERT INTO products (id, sku, slug, kind, department_id, name, description)
         VALUES ($1, 'X-2', 'x-2', 'appliance', $2, '{\"de\":\"X\",\"en\":\"X\",\"ar\":\"س\"}', '{\"de\":\"x\",\"en\":\"x\",\"ar\":\"س\"}')",
    )
    .bind(Uuid::now_v7())
    .bind(Uuid::parse_str(dept).unwrap())
    .execute(&db)
    .await;
    assert!(r.is_err());
    // Preis ohne Betrag, obwohl nicht 'auf Anfrage' → abgelehnt
    let r = sqlx::query(
        "INSERT INTO product_prices (id, product_id, code, name, billing, amount_cents)
         VALUES ($1, $2, 'x', '{\"de\":\"X\",\"en\":\"X\",\"ar\":\"س\"}', 'monthly', NULL)",
    )
    .bind(Uuid::now_v7())
    .bind(Uuid::parse_str(KI_SERVER).unwrap())
    .execute(&db)
    .await;
    assert!(r.is_err());
    // Unbekanntes Modul für eine Abteilung → abgelehnt
    let r = sqlx::query("UPDATE departments SET modules = '{vertrieb}' WHERE code = 'SAL'").execute(&db).await;
    assert!(r.is_err());

    // Über die API: fehlende Übersetzung → 400
    let token = admin(&db).await;
    let body = json!({
        "sku": "ESP-SENSOR", "slug": "esp-sensor", "kind": "appliance", "department_code": "DEV",
        "device_kind": "esp32",
        "name": { "de": "Sensor", "en": "Sensor", "ar": "" },
        "description": { "de": "d", "en": "d", "ar": "د" },
        "prices": [{ "code": "unit", "name": { "de": "Stück", "en": "Unit", "ar": "قطعة" }, "billing": "one_time", "amount_cents": 4900 }]
    });
    let (s, v) = call(&db, "POST", "/api/v1/products", &token, Some(body.clone())).await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "{v}");
    let mut ok = body;
    ok["name"]["ar"] = json!("مستشعر");
    let (s, v) = call(&db, "POST", "/api/v1/products", &token, Some(ok)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    assert_eq!(v["department_code"], "DEV");
    assert_eq!(v["prices"][0]["amount_cents"], 4900);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn invoice_items_follow_catalog(db: PgPool) {
    let token = admin(&db).await;
    let org_ar = org(&db, &token, "ar").await;

    // Katalogposition: Bezeichnung (AR), Einheit und Preis kommen aus dem Katalog
    let body = json!({ "organization_id": org_ar, "items": [
        { "price_id": SENIOR_PRICE, "quantity_milli": 10000, "vat_rate_bp": 0 }
    ]});
    let (s, v) = call(&db, "POST", "/api/v1/invoices", &token, Some(body)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    assert_eq!(v["items"][0]["description"], "تطوير البرمجيات – مطور أول");
    assert_eq!(v["items"][0]["unit"], "hour");
    assert_eq!(v["items"][0]["unit_price"], 12_000);
    assert_eq!(v["items"][0]["product_id"], "00000000-0000-7000-8000-000000000101");
    assert_eq!(v["totals"]["net"], 120_000);
    let id = v["id"].as_str().unwrap().to_owned();

    // Abweichender Preis → abgelehnt
    let bad = json!({ "organization_id": org_ar, "items": [
        { "price_id": SENIOR_PRICE, "quantity_milli": 1000, "unit_price": 9000, "vat_rate_bp": 0 }
    ]});
    assert_eq!(call(&db, "POST", "/api/v1/invoices", &token, Some(bad)).await.0, StatusCode::BAD_REQUEST);

    // Preis auf Anfrage: Betrag muss gesetzt werden
    let no_amount = json!({ "organization_id": org_ar, "items": [
        { "price_id": KI_ENTERPRISE_PRICE, "quantity_milli": 1000, "vat_rate_bp": 0 }
    ]});
    assert_eq!(call(&db, "POST", "/api/v1/invoices", &token, Some(no_amount)).await.0, StatusCode::BAD_REQUEST);
    let with_amount = json!({ "organization_id": org_ar, "items": [
        { "price_id": KI_ENTERPRISE_PRICE, "quantity_milli": 1000, "unit": "month", "unit_price": 450000, "vat_rate_bp": 0 }
    ]});
    let (s, v) = call(&db, "POST", "/api/v1/invoices", &token, Some(with_amount)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    assert_eq!(v["items"][0]["unit"], "month");

    // Preis muss zum Produkt passen (DB-Ebene)
    let r = sqlx::query(
        "INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit, unit_price_cents,
                                    vat_rate_bp, product_id, price_id)
         VALUES ($1, $2, 99, 'x', 1000, 'hour', 1, 0, $3, $4)",
    )
    .bind(Uuid::now_v7())
    .bind(Uuid::parse_str(&id).unwrap())
    .bind(Uuid::parse_str(POS).unwrap())
    .bind(Uuid::parse_str(SENIOR_PRICE).unwrap())
    .execute(&db)
    .await;
    assert!(r.is_err());

    // Umsatz je Abteilung: ausstellen → DEV 1.200 €, Storno → 0 €
    call(&db, "POST", &format!("/api/v1/invoices/{id}/issue"), &token, None).await;
    let rev = |v: &Value| -> i64 {
        v.as_array()
            .unwrap()
            .iter()
            .find(|r| r["department_code"] == "DEV")
            .map_or(0, |r| r["net_cents"].as_i64().unwrap())
    };
    let (_, v) = call(&db, "GET", "/api/v1/reports/revenue-by-department", &token, None).await;
    assert_eq!(rev(&v), 120_000, "{v}");
    let (s, cn) = call(&db, "POST", &format!("/api/v1/invoices/{id}/cancel"), &token, None).await;
    assert_eq!(s, StatusCode::CREATED, "{cn}");
    assert_eq!(cn["items"][0]["price_id"], SENIOR_PRICE);
    let (_, v) = call(&db, "GET", "/api/v1/reports/revenue-by-department", &token, None).await;
    assert_eq!(rev(&v), 0, "{v}");
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn devices_must_match_product(db: PgPool) {
    let token = admin(&db).await;
    let (s, v) = call(
        &db,
        "POST",
        "/api/v1/devices",
        &token,
        Some(json!({ "kind": "pos", "name": "Kasse 1", "product_id": KI_SERVER })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "{v}");
    let (s, v) = call(
        &db,
        "POST",
        "/api/v1/devices",
        &token,
        Some(json!({ "kind": "pos", "name": "Kasse 1", "product_id": POS })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");

    // DB-Ebene: nachträglich falsches Produkt zuweisen → abgelehnt
    let r =
        sqlx::query("UPDATE devices SET product_id = $1").bind(Uuid::parse_str(KI_SERVER).unwrap()).execute(&db).await;
    assert!(r.is_err());
    // Gerätetyp eines verwendeten Produkts ändern → abgelehnt
    let r = sqlx::query("UPDATE products SET device_kind = 'esp32' WHERE id = $1")
        .bind(Uuid::parse_str(POS).unwrap())
        .execute(&db)
        .await;
    assert!(r.is_err());
}
