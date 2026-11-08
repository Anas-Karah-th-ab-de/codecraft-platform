//! Einmal-Passwörter (Pflichtwechsel) und Einmal-Zugriffscodes für Kundengeräte.

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

async fn login(db: &PgPool, email: &str, pw: &str) -> (String, Value) {
    let (s, v) = call(db, "POST", "/api/v1/auth/login", "", Some(json!({ "email": email, "password": pw }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    (v["token"].as_str().unwrap().to_owned(), v)
}

async fn admin(db: &PgPool) -> String {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    login(db, "ak@code-craft.tech", "admin-passwort-1").await.0
}

async fn new_user(db: &PgPool, admin: &str, email: &str, role: &str, org: Option<Uuid>) -> String {
    let (s, v) = call(
        db,
        "POST",
        "/api/v1/users",
        admin,
        Some(json!({
            "email": email, "display_name": email, "role": role, "password": "start-passwort-1", "organization_id": org,
            "departments": if role == "customer" { json!([]) } else { json!(["SUP", "ACC"]) }
        })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    login(db, email, "start-passwort-1").await.0
}

async fn org(db: &PgPool, admin: &str, name: &str) -> Uuid {
    let (_, v) = call(db, "POST", "/api/v1/organizations", admin, Some(json!({ "name": name }))).await;
    v["id"].as_str().unwrap().parse().unwrap()
}

async fn device(db: &PgPool, admin: &str, name: &str, org: Option<Uuid>) -> String {
    let (s, v) = call(
        db,
        "POST",
        "/api/v1/devices",
        admin,
        Some(json!({ "kind": "agent", "name": name, "organization_id": org })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    v["id"].as_str().unwrap().to_owned()
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn onetime_password_must_be_changed(db: PgPool) {
    let admin = admin(&db).await;
    new_user(&db, &admin, "jana@code-craft.tech", "staff", None).await;
    let (_, users) = call(&db, "GET", "/api/v1/users", &admin, None).await;
    let id = users.as_array().unwrap().iter().find(|u| u["email"] == "jana@code-craft.tech").unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();

    let (s, v) = call(&db, "POST", &format!("/api/v1/users/{id}/reset-password"), &admin, None).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let pw = v["password"].as_str().unwrap().to_owned();
    assert_eq!(pw.len(), 19);
    // altes Passwort gilt nicht mehr
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/auth/login",
        "",
        Some(json!({ "email": "jana@code-craft.tech", "password": "start-passwort-1" })),
    )
    .await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);

    let (token, v) = login(&db, "jana@code-craft.tech", &pw).await;
    assert_eq!(v["must_change_password"], true);
    // bis zum Wechsel: nur Konto-Seite
    let (s, v) = call(&db, "GET", "/api/v1/invoices", &token, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert_eq!(v["error"], "password_change_required");
    let (s, me) = call(&db, "GET", "/api/v1/me", &token, None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(me["must_change_password"], true);
    // Mail-Login mit Einmal-Passwort geht nicht
    assert!(codecraft_server::mail::authenticate(&db, "jana@code-craft.tech", &pw).await.is_none());
    // gleiches Passwort zählt nicht als Wechsel
    let (s, _) = call(&db, "POST", "/api/v1/auth/password", &token, Some(json!({ "current": pw, "new": pw }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) =
        call(&db, "POST", "/api/v1/auth/password", &token, Some(json!({ "current": pw, "new": "mein-eigenes-pw-9" })))
            .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = call(&db, "GET", "/api/v1/invoices", &token, None).await;
    assert_eq!(s, StatusCode::OK);
    assert!(codecraft_server::mail::authenticate(&db, "jana@code-craft.tech", "mein-eigenes-pw-9").await.is_some());
    // nur Admins dürfen zurücksetzen
    let (s, _) = call(&db, "POST", &format!("/api/v1/users/{id}/reset-password"), &token, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn customer_devices_need_access_code(db: PgPool) {
    let admin = admin(&db).await;
    let muster = org(&db, &admin, "Muster GmbH").await;
    let andere = org(&db, &admin, "Andere AG").await;
    let kunde = new_user(&db, &admin, "kunde@muster.de", "customer", Some(muster)).await;
    let fremd = new_user(&db, &admin, "kunde@andere.de", "customer", Some(andere)).await;
    let tech = new_user(&db, &admin, "tech@code-craft.tech", "manager", None).await;
    let staff = new_user(&db, &admin, "azubi@code-craft.tech", "trainee", None).await;

    let handy = device(&db, &admin, "Handy", Some(muster)).await;
    let router = device(&db, &admin, "Router", Some(muster)).await;
    let intern = device(&db, &admin, "Büro-PC", None).await;
    let fremd_dev = device(&db, &admin, "Kasse", Some(andere)).await;

    // interne Geräte: Techniker direkt; Kundengeräte: Code nötig (auch für Admin)
    let (s, _) = call(&db, "GET", &format!("/api/v1/devices/{intern}/remote"), &tech, None).await;
    assert_eq!(s, StatusCode::OK);
    for t in [&tech, &admin] {
        let (s, v) = call(&db, "GET", &format!("/api/v1/devices/{handy}/remote"), t, None).await;
        assert_eq!(s, StatusCode::FORBIDDEN);
        assert_eq!(v["error"], "access_code_required");
    }
    // ohne Geräterechte nie
    let (s, v) = call(&db, "GET", &format!("/api/v1/devices/{intern}/remote"), &staff, None).await;
    assert_eq!((s, v["error"].as_str()), (StatusCode::FORBIDDEN, Some("forbidden")));

    // Kunde darf nur eigene Geräte freigeben; Mitarbeiter erzeugen keine Codes
    let (s, _) =
        call(&db, "POST", "/api/v1/access-codes", &kunde, Some(json!({ "device_ids": [handy, fremd_dev] }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = call(&db, "POST", "/api/v1/access-codes", &tech, Some(json!({ "device_ids": [handy] }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, v) = call(
        &db,
        "POST",
        "/api/v1/access-codes",
        &kunde,
        Some(json!({ "device_ids": [handy, router], "minutes": 30 })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let code = v["code"].as_str().unwrap().to_owned();
    let grant = v["id"].as_str().unwrap().to_owned();
    assert_eq!(code.len(), 11); // "123 456 789"

    // falscher Code, richtiger Code (Leerzeichen egal), zweites Einlösen
    let (s, _) = call(&db, "POST", "/api/v1/access-codes/redeem", &tech, Some(json!({ "code": "000000000" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, v) =
        call(&db, "POST", "/api/v1/access-codes/redeem", &tech, Some(json!({ "code": code.replace(' ', "-") }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!(v["state"], "active");
    assert_eq!(v["devices"].as_array().unwrap().len(), 2);
    let (s, _) = call(&db, "POST", "/api/v1/access-codes/redeem", &admin, Some(json!({ "code": code }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    // jetzt Zugriff – nur für den einlösenden Techniker, nur auf die freigegebenen Geräte
    let (s, _) = call(&db, "GET", &format!("/api/v1/devices/{router}/remote"), &tech, None).await;
    assert_eq!(s, StatusCode::OK);
    let (s, _) = call(&db, "GET", &format!("/api/v1/devices/{router}/remote"), &admin, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = call(&db, "GET", &format!("/api/v1/devices/{fremd_dev}/remote"), &tech, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);

    // Kunde sieht Status und Techniker; fremde Firma sieht nichts und kann nicht beenden
    let (_, list) = call(&db, "GET", "/api/v1/access-codes", &kunde, None).await;
    assert_eq!(list[0]["state"], "active");
    assert_eq!(list[0]["technician"], "tech@code-craft.tech");
    let (_, list) = call(&db, "GET", "/api/v1/access-codes", &fremd, None).await;
    assert!(list.as_array().unwrap().is_empty());
    let (s, _) = call(&db, "POST", &format!("/api/v1/access-codes/{grant}/revoke"), &fremd, None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (_, list) = call(&db, "GET", "/api/v1/access-codes", &tech, None).await;
    assert_eq!(list.as_array().unwrap().len(), 1);

    // Kunde beendet → sofort kein Zugriff
    let (s, _) = call(&db, "POST", &format!("/api/v1/access-codes/{grant}/revoke"), &kunde, None).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = call(&db, "GET", &format!("/api/v1/devices/{handy}/remote"), &tech, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);

    // Dauerzugriff (Wartungsvertrag) setzt nur der Kunde für eigene Geräte
    let (s, _) = call(
        &db,
        "PUT",
        &format!("/api/v1/devices/{fremd_dev}/access-policy"),
        &kunde,
        Some(json!({ "policy": "staff" })),
    )
    .await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) =
        call(&db, "PUT", &format!("/api/v1/devices/{handy}/access-policy"), &tech, Some(json!({ "policy": "staff" })))
            .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) =
        call(&db, "PUT", &format!("/api/v1/devices/{handy}/access-policy"), &kunde, Some(json!({ "policy": "staff" })))
            .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = call(&db, "GET", &format!("/api/v1/devices/{handy}/remote"), &tech, None).await;
    assert_eq!(s, StatusCode::OK);

    // Raten wird gebremst
    for _ in 0..5 {
        call(&db, "POST", "/api/v1/access-codes/redeem", &admin, Some(json!({ "code": "111111111" }))).await;
    }
    let (s, _) = call(&db, "POST", "/api/v1/access-codes/redeem", &admin, Some(json!({ "code": "111111111" }))).await;
    assert_eq!(s, StatusCode::TOO_MANY_REQUESTS);
    // Audit
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action LIKE 'access_code_%'")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(n, 3);
}
