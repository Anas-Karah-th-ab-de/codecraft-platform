//! Portal-App: Installation anmelden, Agent-Gerät des Benutzers, Neuanmeldung, Sperren.

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
async fn app_enroll_and_support_code(db: PgPool) {
    std::env::set_var("PUSH_DISABLED", "1");
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let admin = login(&db, "ak@code-craft.tech", "admin-passwort-1").await;
    let org = Uuid::now_v7();
    sqlx::query("INSERT INTO organizations (id, name) VALUES ($1, 'Kunde GmbH')").bind(org).execute(&db).await.unwrap();
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/users",
        &admin,
        Some(json!({ "email": "kim@kunde.de", "display_name": "Kim", "role": "customer", "password": "start-passwort-1", "organization_id": org })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED);
    let kim = login(&db, "kim@kunde.de", "start-passwort-1").await;

    // ungültige Angaben
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/app/enroll",
        &kim,
        Some(json!({ "install_id": "kurz", "name": "x", "platform": "android" })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/app/enroll",
        &kim,
        Some(json!({ "install_id": "abcdef12-3456", "name": "x", "platform": "symbian" })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    let body =
        json!({ "install_id": "0b6d3c2e-aaaa-4bbb-8ccc-123456789abc", "name": "Android-App", "platform": "android" });
    let (s, v) = call(&db, "POST", "/api/v1/app/enroll", &kim, Some(body.clone())).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let key = v["key"].as_str().unwrap().to_owned();
    let dtoken = v["device_token"].as_str().unwrap().to_owned();
    let device: Uuid = v["device_id"].as_str().unwrap().parse().unwrap();
    assert!(key.starts_with("cc_u_") && dtoken.starts_with("cc_d_"));

    // Gerät gehört zur Firma des Kunden → Kunde kann dafür einen Einmal-Code erzeugen
    let (s, c) =
        call(&db, "POST", "/api/v1/access-codes", &kim, Some(json!({ "device_ids": [device], "minutes": 30 }))).await;
    assert_eq!(s, StatusCode::CREATED, "{c}");
    // Gerätetoken meldet Zustand
    let rep = json!({ "protocol": codecraft_protocol::PROTOCOL_VERSION, "kind": "agent", "version": "0.1.0", "uptime_s": 5, "metrics": [], "events": [] });
    let (s, _) = call(&db, "POST", "/api/v1/devices/report", &dtoken, Some(rep.clone())).await;
    assert_eq!(s, StatusCode::OK);
    // App-Schlüssel öffnet den Ereignis-Stream
    let res = app(AppState { db: db.clone() })
        .oneshot(
            Request::get("/api/v1/events")
                .header("authorization", format!("Bearer {key}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    drop(res);

    // Neuanmeldung derselben Installation: alte Zugänge ungültig, neues Gerät
    let (s, v2) = call(&db, "POST", "/api/v1/app/enroll", &kim, Some(body)).await;
    assert_eq!(s, StatusCode::CREATED);
    assert_ne!(v2["device_id"], v["device_id"]);
    assert_eq!(
        call(&db, "POST", "/api/v1/devices/report", &dtoken, Some(rep.clone())).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(call(&db, "GET", "/api/v1/notifications", &key, None).await.0, StatusCode::UNAUTHORIZED);
    let live: i64 =
        sqlx::query_scalar("SELECT count(*) FROM devices WHERE install_id IS NOT NULL AND revoked_at IS NULL")
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(live, 1);

    // Sperren widerruft das App-Gerät
    let kim_id: Uuid =
        sqlx::query_scalar("SELECT id FROM users WHERE email = 'kim@kunde.de'").fetch_one(&db).await.unwrap();
    let (s, _) = call(&db, "POST", &format!("/api/v1/users/{kim_id}/deactivate"), &admin, Some(json!({}))).await;
    assert_eq!(s, StatusCode::OK);
    let t2 = v2["device_token"].as_str().unwrap();
    assert_eq!(call(&db, "POST", "/api/v1/devices/report", t2, Some(rep)).await.0, StatusCode::UNAUTHORIZED);
}

async fn employee(db: &PgPool, email: &str, role: &str, dept: &str) -> String {
    let id = Uuid::now_v7();
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, $2, $2, $3, $4)")
        .bind(id)
        .bind(email)
        .bind(role)
        .bind(auth::hash_password("mitarbeiter-pw-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO user_departments (user_id, department_id) SELECT $1, id FROM departments WHERE code = $2")
        .bind(id)
        .bind(dept)
        .execute(db)
        .await
        .unwrap();
    login(db, email, "mitarbeiter-pw-1").await
}

/// Anruf unter Kollegen: eigenes App-Gerät für bestimmte Mitarbeiter freigeben – nur Bildschirm, zeitlich begrenzt
#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn share_own_device_in_call(db: PgPool) {
    std::env::set_var("PUSH_DISABLED", "1");
    let owner = employee(&db, "lu@code-craft.tech", "staff", "ACC").await;
    let colleague = employee(&db, "ah@code-craft.tech", "staff", "ACC").await;
    let other = employee(&db, "x@code-craft.tech", "staff", "ACC").await;
    let body =
        json!({ "install_id": "11111111-aaaa-4bbb-8ccc-123456789abc", "name": "Android-App", "platform": "android" });
    let (s, v) = call(&db, "POST", "/api/v1/app/enroll", &owner, Some(body)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let device = v["device_id"].as_str().unwrap().to_owned();
    let colleague_id: Uuid =
        sqlx::query_scalar("SELECT id FROM users WHERE email = 'ah@code-craft.tech'").fetch_one(&db).await.unwrap();
    let remote = format!("/api/v1/devices/{device}/remote");
    let share = format!("/api/v1/devices/{device}/share");

    // ohne Freigabe kein Zugriff (Buchhaltung hat keine Geräterechte)
    assert_eq!(call(&db, "GET", &remote, &colleague, None).await.0, StatusCode::FORBIDDEN);
    // nur der Besitzer darf freigeben
    let (s, _) = call(&db, "POST", &share, &colleague, Some(json!({ "users": [colleague_id] }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, v) = call(&db, "POST", &share, &owner, Some(json!({ "users": [colleague_id], "minutes": 30 }))).await;
    assert_eq!(s, StatusCode::OK, "{v}");

    // Kollege: Bildschirm-Status ja, Befehle nein; andere weiterhin nicht
    assert_eq!(call(&db, "GET", &remote, &colleague, None).await.0, StatusCode::OK);
    let exec = format!("/api/v1/devices/{device}/exec");
    let (s, _) = call(&db, "POST", &exec, &colleague, Some(json!({ "program": "id", "args": [] }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert_eq!(call(&db, "GET", &remote, &other, None).await.0, StatusCode::FORBIDDEN);

    // Freigabe beenden → kein Zugriff mehr
    assert_eq!(call(&db, "DELETE", &share, &owner, None).await.0, StatusCode::NO_CONTENT);
    assert_eq!(call(&db, "GET", &remote, &colleague, None).await.0, StatusCode::FORBIDDEN);
}
