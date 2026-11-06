//! Meilenstein 2: Login + 2FA, Benutzer, Stellen/Bewerbungen, Kontakt, Produktpflege, PDF.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codecraft_server::{app, auth, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn call(db: &PgPool, method: &str, uri: &str, token: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    if !token.is_empty() {
        req = req.header("authorization", format!("Bearer {token}"));
    }
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
    (status, serde_json::from_slice(&bytes).unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into())))
}

async fn admin_with_password(db: &PgPool, email: &str, pw: &str) {
    sqlx::query(
        "INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, $2, 'Admin', 'admin', $3)",
    )
    .bind(Uuid::now_v7())
    .bind(email)
    .bind(auth::hash_password(pw).unwrap())
    .execute(db)
    .await
    .unwrap();
}

async fn login(db: &PgPool, email: &str, pw: &str) -> String {
    let (s, v) = call(db, "POST", "/api/v1/auth/login", "", Some(json!({ "email": email, "password": pw }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    v["token"].as_str().unwrap().to_owned()
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn login_logout_and_2fa(db: PgPool) {
    admin_with_password(&db, "chef@test.de", "richtig-geheim-1").await;

    let (s, _) =
        call(&db, "POST", "/api/v1/auth/login", "", Some(json!({ "email": "chef@test.de", "password": "falsch" })))
            .await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    let (s, _) =
        call(&db, "POST", "/api/v1/auth/login", "", Some(json!({ "email": "nein@test.de", "password": "x" }))).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);

    // E-Mail ohne Beachtung der Groß-/Kleinschreibung
    let token = login(&db, "CHEF@test.de", "richtig-geheim-1").await;
    assert!(token.starts_with("cc_s_"));
    let (s, me) = call(&db, "GET", "/api/v1/me", &token, None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(me["two_factor"], false);

    // 2FA einrichten
    let (s, setup) = call(&db, "POST", "/api/v1/auth/2fa/setup", &token, None).await;
    assert_eq!(s, StatusCode::OK, "{setup}");
    assert!(setup["qr_png_base64"].as_str().unwrap().len() > 100);
    let secret = setup["secret"].as_str().unwrap();
    let totp = auth::totp_for(secret, "chef@test.de").unwrap();
    let (s, _) = call(&db, "POST", "/api/v1/auth/2fa/enable", &token, Some(json!({ "code": "000000" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let code = totp.generate_current().unwrap();
    let (s, v) = call(&db, "POST", "/api/v1/auth/2fa/enable", &token, Some(json!({ "code": code }))).await;
    assert_eq!(s, StatusCode::NO_CONTENT, "{v}");

    // Login verlangt jetzt den Code
    let body = json!({ "email": "chef@test.de", "password": "richtig-geheim-1" });
    let (s, v) = call(&db, "POST", "/api/v1/auth/login", "", Some(body.clone())).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(v["two_factor_required"], true);
    assert!(v.get("token").is_none());
    let mut with_code = body.clone();
    with_code["code"] = json!("123");
    assert_eq!(call(&db, "POST", "/api/v1/auth/login", "", Some(with_code.clone())).await.0, StatusCode::BAD_REQUEST);
    with_code["code"] = json!(totp.generate_current().unwrap());
    let (s, v) = call(&db, "POST", "/api/v1/auth/login", "", Some(with_code)).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let token2 = v["token"].as_str().unwrap().to_owned();

    // Logout beendet nur diese Sitzung
    assert_eq!(call(&db, "POST", "/api/v1/auth/logout", &token2, None).await.0, StatusCode::NO_CONTENT);
    assert_eq!(call(&db, "GET", "/api/v1/me", &token2, None).await.0, StatusCode::UNAUTHORIZED);
    assert_eq!(call(&db, "GET", "/api/v1/me", &token, None).await.0, StatusCode::OK);

    // abgelaufene Sitzung
    sqlx::query("UPDATE api_tokens SET expires_at = now() - interval '1 minute' WHERE name = 'session'")
        .execute(&db)
        .await
        .unwrap();
    assert_eq!(call(&db, "GET", "/api/v1/me", &token, None).await.0, StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn brute_force_is_limited(db: PgPool) {
    admin_with_password(&db, "limit@test.de", "richtig-geheim-1").await;
    for _ in 0..5 {
        let b = json!({ "email": "limit@test.de", "password": "falsch" });
        assert_eq!(call(&db, "POST", "/api/v1/auth/login", "", Some(b)).await.0, StatusCode::UNAUTHORIZED);
    }
    // auch das richtige Passwort wird jetzt gesperrt
    let b = json!({ "email": "limit@test.de", "password": "richtig-geheim-1" });
    assert_eq!(call(&db, "POST", "/api/v1/auth/login", "", Some(b)).await.0, StatusCode::TOO_MANY_REQUESTS);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn users_jobs_contact_products(db: PgPool) {
    admin_with_password(&db, "admin@test.de", "richtig-geheim-1").await;
    let admin = login(&db, "admin@test.de", "richtig-geheim-1").await;

    // Benutzer mit Abteilungen anlegen; Mitarbeiter darf keine Benutzer anlegen
    let u = json!({ "email": "dev@test.de", "display_name": "Dev", "role": "staff", "password": "noch-ein-passwort",
                    "departments": ["DEV", "SUP"] });
    let (s, v) = call(&db, "POST", "/api/v1/users", &admin, Some(u)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let staff = login(&db, "dev@test.de", "noch-ein-passwort").await;
    let (_, me) = call(&db, "GET", "/api/v1/me", &staff, None).await;
    assert_eq!(me["departments"], json!(["DEV", "SUP"]));
    let u2 = json!({ "email": "x@test.de", "display_name": "X", "role": "admin", "password": "noch-ein-passwort" });
    assert_eq!(call(&db, "POST", "/api/v1/users", &staff, Some(u2)).await.0, StatusCode::FORBIDDEN);
    let bad_dept = json!({ "email": "y@test.de", "display_name": "Y", "role": "staff", "password": "noch-ein-passwort", "departments": ["XYZ"] });
    assert_eq!(call(&db, "POST", "/api/v1/users", &admin, Some(bad_dept)).await.0, StatusCode::BAD_REQUEST);

    // Öffentliche Stellen (Beispielstelle aus Migration) + Bewerbung
    let (s, jobs) = call(&db, "GET", "/api/v1/public/jobs?locale=ar", "", None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(jobs[0]["title"], "مطوّر Rust");
    let apply = json!({ "name": "Sara", "email": "sara@example.com", "message": "Hallo", "locale": "ar" });
    assert_eq!(
        call(&db, "POST", "/api/v1/public/jobs/rust-entwickler/apply", "", Some(apply)).await.0,
        StatusCode::CREATED
    );
    let bad = json!({ "name": "S", "email": "keine-mail", "message": "" });
    assert_eq!(
        call(&db, "POST", "/api/v1/public/jobs/rust-entwickler/apply", "", Some(bad)).await.0,
        StatusCode::BAD_REQUEST
    );
    let (_, apps) = call(&db, "GET", "/api/v1/applications", &admin, None).await;
    assert_eq!(apps.as_array().unwrap().len(), 1);
    assert_eq!(call(&db, "GET", "/api/v1/applications", &staff, None).await.0, StatusCode::FORBIDDEN);

    // Neue Stelle als Entwurf → nicht öffentlich, nach Veröffentlichen sichtbar
    let job = json!({ "department_code": "SUP", "slug": "support-mitarbeiter",
        "title": { "de": "Support", "en": "Support", "ar": "دعم" }, "summary": { "de": "s", "en": "s", "ar": "س" },
        "description": { "de": "d", "en": "d", "ar": "د" }, "employment_type": "part_time" });
    let (s, v) = call(&db, "POST", "/api/v1/jobs", &admin, Some(job)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let id = v["id"].as_str().unwrap();
    assert_eq!(call(&db, "GET", "/api/v1/public/jobs/support-mitarbeiter", "", None).await.0, StatusCode::NOT_FOUND);
    call(&db, "PUT", &format!("/api/v1/jobs/{id}/status"), &admin, Some(json!({ "status": "published" }))).await;
    assert_eq!(call(&db, "GET", "/api/v1/public/jobs/support-mitarbeiter", "", None).await.0, StatusCode::OK);

    // Kontakt mit Produktbezug, Honeypot wird still verworfen
    let c = json!({ "name": "Ali", "email": "ali@example.com", "subject": "POS", "message": "Bitte Angebot",
                    "product_id": "00000000-0000-7000-8000-000000000106" });
    assert_eq!(call(&db, "POST", "/api/v1/public/contact", "", Some(c)).await.0, StatusCode::CREATED);
    let bot =
        json!({ "name": "Bot", "email": "b@b.bb", "subject": "x", "message": "spam spam", "website": "http://x" });
    assert_eq!(call(&db, "POST", "/api/v1/public/contact", "", Some(bot)).await.0, StatusCode::CREATED);
    let (_, reqs) = call(&db, "GET", "/api/v1/contact-requests", &admin, None).await;
    assert_eq!(reqs.as_array().unwrap().len(), 1);
    assert_eq!(reqs[0]["product_sku"], "CC-POS-V3");

    // Produktpflege: Preis ändern → Webseite zeigt neuen Preis; deaktivieren → verschwindet
    let senior = "00000000-0000-7000-8000-000000000202";
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/prices/{senior}"), &admin, Some(json!({ "amount_cents": 13000 }))).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, cat) = call(&db, "GET", "/api/v1/public/catalog", "", None).await;
    let dev = cat["products"].as_array().unwrap().iter().find(|p| p["sku"] == "DEV-HOURLY").unwrap().clone();
    assert_eq!(
        dev["prices"].as_array().unwrap().iter().find(|p| p["code"] == "senior").unwrap()["amount_cents"],
        13000
    );
    let pos = "00000000-0000-7000-8000-000000000106";
    let (s, v) =
        call(&db, "PATCH", &format!("/api/v1/products/{pos}"), &admin, Some(json!({ "is_active": false }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let (_, cat) = call(&db, "GET", "/api/v1/public/catalog", "", None).await;
    assert!(!cat["products"].as_array().unwrap().iter().any(|p| p["sku"] == "CC-POS-V3"));
    // Mitarbeiter darf keine Preise ändern
    assert_eq!(
        call(&db, "PATCH", &format!("/api/v1/prices/{senior}"), &staff, Some(json!({ "amount_cents": 1 }))).await.0,
        StatusCode::FORBIDDEN
    );
    // Preis hinzufügen
    let np = json!({ "code": "lead", "name": { "de": "Lead", "en": "Lead", "ar": "قائد" }, "billing": "hourly", "amount_cents": 16000 });
    let dev_id = dev["id"].as_str().unwrap();
    assert_eq!(
        call(&db, "POST", &format!("/api/v1/products/{dev_id}/prices"), &admin, Some(np)).await.0,
        StatusCode::CREATED
    );
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn invoice_pdf_html(db: PgPool) {
    admin_with_password(&db, "pdf@test.de", "richtig-geheim-1").await;
    let admin = login(&db, "pdf@test.de", "richtig-geheim-1").await;
    let (_, org) = call(
        &db,
        "POST",
        "/api/v1/organizations",
        &admin,
        Some(json!({ "name": "شركة الاختبار", "address": "إدلب، سوريا", "locale": "ar" })),
    )
    .await;
    let body = json!({ "organization_id": org["id"], "items": [
        { "price_id": "00000000-0000-7000-8000-000000000221", "quantity_milli": 2000, "vat_rate_bp": 0 }] });
    let (_, inv) = call(&db, "POST", "/api/v1/invoices", &admin, Some(body)).await;
    let id = inv["id"].as_str().unwrap();
    let (s, html) = call(&db, "GET", &format!("/api/v1/invoices/{id}/pdf?format=html"), &admin, None).await;
    assert_eq!(s, StatusCode::OK);
    let html = html.as_str().unwrap();
    assert!(html.contains("dir=\"rtl\""));
    assert!(html.contains("فاتورة"));
    assert!(html.contains("مسودة")); // Entwurfs-Wasserzeichen
    assert!(html.contains("شركة الاختبار"));
    assert!(html.contains("998.00 EUR"));
}
