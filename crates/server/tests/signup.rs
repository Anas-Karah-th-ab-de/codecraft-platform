//! Selbstregistrierung: Antrag → Bestätigungslink → Firma + Kundenkonto, danach Anmeldung.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codecraft_server::{app, auth, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;

async fn post(db: &PgPool, uri: &str, ip: &str, body: Value) -> (StatusCode, Value) {
    let req = Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/json")
        .header("x-forwarded-for", ip)
        .body(Body::from(body.to_string()))
        .unwrap();
    let res = app(AppState { db: db.clone() }).oneshot(req).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

fn form(email: &str) -> Value {
    json!({
        "name": "Rana Haddad", "email": email, "phone": "+963 900 000 000", "password": "sehr-sicheres-pw-1",
        "company": "Café Sham", "address": "Idlib, Hauptstraße 1", "vat_id": "", "locale": "ar", "website": ""
    })
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn customer_registers_confirms_and_signs_in(db: PgPool) {
    // Antrag: noch kein Konto, nur ein offener Antrag
    let (s, _) = post(&db, "/api/v1/public/register", "10.0.0.1", form("Rana@Example.org")).await;
    assert_eq!(s, StatusCode::ACCEPTED);
    let users: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE lower(email) = 'rana@example.org'")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(users, 0);
    let (email, hash): (String, String) =
        sqlx::query_as("SELECT email, password_hash FROM signup_requests").fetch_one(&db).await.unwrap();
    assert_eq!(email, "rana@example.org");
    assert!(hash.starts_with("$argon2id$"));

    // Falscher Link → abgelehnt
    let (s, _) = post(&db, "/api/v1/public/register/confirm", "10.0.0.1", json!({ "token": "cc_r_falsch" })).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    // Echten Link simulieren (Token steht nur in der E-Mail)
    let token = auth::new_token("cc_r_");
    sqlx::query("UPDATE signup_requests SET token_hash = $1")
        .bind(auth::hash_token(&token))
        .execute(&db)
        .await
        .unwrap();
    let (s, v) = post(&db, "/api/v1/public/register/confirm", "10.0.0.1", json!({ "token": token })).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let (role, org_name, phone, locale): (String, String, Option<String>, String) = sqlx::query_as(
        "SELECT u.role, o.name, o.phone, u.locale FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.email = 'rana@example.org'",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(
        (role.as_str(), org_name.as_str(), phone.as_deref(), locale.as_str()),
        ("customer", "Café Sham", Some("+963 900 000 000"), "ar")
    );

    // Link ist nur einmal gültig, Passwort-Hash wird nicht aufbewahrt
    let (s, _) = post(&db, "/api/v1/public/register/confirm", "10.0.0.1", json!({ "token": token })).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let left: String = sqlx::query_scalar("SELECT password_hash FROM signup_requests").fetch_one(&db).await.unwrap();
    assert_eq!(left, "");

    // Anmelden mit dem eigenen Passwort
    let (s, v) = post(
        &db,
        "/api/v1/auth/login",
        "10.0.0.1",
        json!({ "email": "rana@example.org", "password": "sehr-sicheres-pw-1" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!(v["must_change_password"], false);
    assert_eq!(v["user"]["role"], "customer");

    // Gleiche Adresse noch einmal: gleiche Antwort, aber kein neuer Antrag
    let (s, _) = post(&db, "/api/v1/public/register", "10.0.0.2", form("rana@example.org")).await;
    assert_eq!(s, StatusCode::ACCEPTED);
    let open: i64 = sqlx::query_scalar("SELECT count(*) FROM signup_requests WHERE confirmed_at IS NULL")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(open, 0);

    // Bots (Falle ausgefüllt) und schwache Passwörter
    let mut bot = form("bot@example.org");
    bot["website"] = json!("http://spam");
    let (s, _) = post(&db, "/api/v1/public/register", "10.0.0.3", bot).await;
    assert_eq!(s, StatusCode::ACCEPTED);
    let mut weak = form("weak@example.org");
    weak["password"] = json!("kurz");
    let (s, _) = post(&db, "/api/v1/public/register", "10.0.0.3", weak).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let mut bad = form("keine-adresse");
    bad["password"] = json!("sehr-sicheres-pw-1");
    let (s, _) = post(&db, "/api/v1/public/register", "10.0.0.3", bad).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let open: i64 = sqlx::query_scalar("SELECT count(*) FROM signup_requests WHERE confirmed_at IS NULL")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(open, 0);

    // Viele Anträge von einer Adresse werden gebremst
    let mut last = StatusCode::ACCEPTED;
    for i in 0..6 {
        last = post(&db, "/api/v1/public/register", "10.0.0.9", form(&format!("n{i}@example.org"))).await.0;
    }
    assert_eq!(last, StatusCode::TOO_MANY_REQUESTS);
}
