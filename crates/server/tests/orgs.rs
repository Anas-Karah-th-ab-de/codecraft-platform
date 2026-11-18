//! Firmendaten nachträglich ändern (Adresse nachtragen): Team und Kunde.

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
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn login(db: &PgPool, email: &str, pw: &str) -> String {
    let (s, v) = call(db, "POST", "/api/v1/auth/login", "", Some(json!({ "email": email, "password": pw }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    v["token"].as_str().unwrap().to_owned()
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn organization_address_can_be_added_later(db: PgPool) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let admin = login(&db, "ak@code-craft.tech", "admin-passwort-1").await;
    // Kunde ohne Adresse (wie aus der Selbstregistrierung oder dem Altsystem)
    let (_, o) = call(&db, "POST", "/api/v1/organizations", &admin, Some(json!({ "name": "Kunde GmbH" }))).await;
    let org = o["id"].as_str().unwrap().to_owned();
    assert_eq!(o["address"], "");
    let (_, o2) = call(&db, "POST", "/api/v1/organizations", &admin, Some(json!({ "name": "Andere AG" }))).await;
    let other = o2["id"].as_str().unwrap().to_owned();
    call(&db, "POST", "/api/v1/users", &admin, Some(json!({
        "email": "k@kunde.de", "display_name": "K", "role": "customer", "password": "start-passwort-1", "organization_id": org
    }))).await;
    let kunde = login(&db, "k@kunde.de", "start-passwort-1").await;

    // Team trägt Adresse und Kontakt nach
    let (s, v) = call(&db, "PATCH", &format!("/api/v1/organizations/{org}"), &admin, Some(json!({
        "address": "Hauptstraße 1\n10115 Berlin", "contact_name": "Frau Kunde", "phone": "+49 30 123", "vat_id": "DE123456789"
    }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!(v["address"], "Hauptstraße 1\n10115 Berlin");
    assert_eq!(v["name"], "Kunde GmbH");
    // leerer Text löscht optionale Felder, fehlende Felder bleiben
    let (_, v) =
        call(&db, "PATCH", &format!("/api/v1/organizations/{org}"), &admin, Some(json!({ "vat_id": "" }))).await;
    assert!(v["vat_id"].is_null());
    assert_eq!(v["phone"], "+49 30 123");

    // Kunde ändert die eigene Adresse, aber nicht den Namen und keine fremde Firma
    let (s, v) = call(
        &db,
        "PATCH",
        &format!("/api/v1/organizations/{org}"),
        &kunde,
        Some(json!({ "address": "شارع الجامعة\nإدلب – سوريا" })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!(v["address"], "شارع الجامعة\nإدلب – سوريا");
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/organizations/{org}"), &kunde, Some(json!({ "name": "Neu" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/organizations/{other}"), &kunde, Some(json!({ "address": "x" }))).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    // ungültige Eingaben
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/organizations/{org}"), &admin, Some(json!({ "email": "keine-mail" })))
            .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/organizations/{org}"), &admin, Some(json!({ "locale": "fr" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/organizations/{org}"), &admin, Some(json!({ "name": "  " }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}
