//! Support-Tickets: Priorität nach SLA, Sichtbarkeit, interne Notizen, Statuswechsel.

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

async fn user(db: &PgPool, admin: &str, email: &str, role: &str, org: Option<Uuid>, depts: &[&str]) -> (String, Uuid) {
    let (s, v) = call(db, "POST", "/api/v1/users", admin, Some(json!({
        "email": email, "display_name": email, "role": role, "password": "start-passwort-1", "organization_id": org, "departments": depts
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    (login(db, email, "start-passwort-1").await, v["id"].as_str().unwrap().parse().unwrap())
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn tickets_by_priority(db: PgPool) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let admin = login(&db, "ak@code-craft.tech", "admin-passwort-1").await;
    let mut orgs = vec![];
    for name in ["Basis GmbH", "Premium AG"] {
        let (_, v) = call(&db, "POST", "/api/v1/organizations", &admin, Some(json!({ "name": name }))).await;
        orgs.push(v["id"].as_str().unwrap().parse::<Uuid>().unwrap());
    }
    let (s, _) =
        call(&db, "PUT", &format!("/api/v1/organizations/{}/sla", orgs[1]), &admin, Some(json!({ "sla": "premium" })))
            .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (basis, _) = user(&db, &admin, "kunde@basis.de", "customer", Some(orgs[0]), &[]).await;
    let (premium, _) = user(&db, &admin, "kunde@premium.de", "customer", Some(orgs[1]), &[]).await;
    let (sup, sup_id) = user(&db, &admin, "sup@code-craft.tech", "staff", None, &["SUP"]).await;
    // SLA darf nur Leitung/Admin setzen
    let (s, _) =
        call(&db, "PUT", &format!("/api/v1/organizations/{}/sla", orgs[0]), &sup, Some(json!({ "sla": "premium" })))
            .await;
    assert_eq!(s, StatusCode::FORBIDDEN);

    // gleiche Dringlichkeit, Premium-Kunde bekommt höhere Priorität
    let (s, b) = call(
        &db,
        "POST",
        "/api/v1/tickets",
        &basis,
        Some(json!({ "subject": "Drucker geht nicht", "body": "Seit heute früh", "urgency": "high" })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{b}");
    let (_, p) = call(
        &db,
        "POST",
        "/api/v1/tickets",
        &premium,
        Some(json!({ "subject": "Kasse startet nicht", "body": "Bitte dringend", "urgency": "high" })),
    )
    .await;
    assert_eq!(b["priority"], 3);
    assert_eq!(p["priority"], 1);
    assert!(b["number"].as_str().unwrap().starts_with("T-"));

    // Team sieht beide, Premium zuerst; Kunden nur ihre eigenen
    let (_, q) = call(&db, "GET", "/api/v1/tickets", &sup, None).await;
    assert_eq!(q.as_array().unwrap().len(), 2);
    assert_eq!(q[0]["subject"], "Kasse startet nicht");
    let (_, own) = call(&db, "GET", "/api/v1/tickets", &basis, None).await;
    assert_eq!(own.as_array().unwrap().len(), 1);
    let pid = p["id"].as_str().unwrap();
    let (s, _) = call(&db, "GET", &format!("/api/v1/tickets/{pid}"), &basis, None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);

    // interne Notiz: Kunde sieht sie nicht; Antwort des Teams → wartet auf Kunde, Bearbeiter gesetzt
    call(
        &db,
        "POST",
        &format!("/api/v1/tickets/{pid}/messages"),
        &sup,
        Some(json!({ "body": "Netzteil prüfen", "internal": true })),
    )
    .await;
    let (s, _) = call(
        &db,
        "POST",
        &format!("/api/v1/tickets/{pid}/messages"),
        &sup,
        Some(json!({ "body": "Bitte Netzteil tauschen" })),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, t) = call(&db, "GET", &format!("/api/v1/tickets/{pid}"), &premium, None).await;
    assert_eq!(t["thread"].as_array().unwrap().len(), 2);
    assert_eq!(t["status"], "waiting_customer");
    assert_eq!(t["assignee_id"], json!(sup_id));
    assert!(!t["first_response_at"].is_null());
    let (_, t) = call(&db, "GET", &format!("/api/v1/tickets/{pid}"), &sup, None).await;
    assert_eq!(t["thread"].as_array().unwrap().len(), 3);
    // Kunde darf intern nicht schreiben (wird öffentlich) und keinen Status außer schließen/öffnen setzen
    call(
        &db,
        "POST",
        &format!("/api/v1/tickets/{pid}/messages"),
        &premium,
        Some(json!({ "body": "Geht wieder", "internal": true })),
    )
    .await;
    let (_, t) = call(&db, "GET", &format!("/api/v1/tickets/{pid}"), &premium, None).await;
    assert_eq!(t["thread"].as_array().unwrap().len(), 3);
    assert_eq!(t["status"], "open", "Kundenantwort öffnet wieder");
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/tickets/{pid}"), &premium, Some(json!({ "status": "resolved" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/tickets/{pid}"), &premium, Some(json!({ "status": "closed" }))).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, q) = call(&db, "GET", "/api/v1/tickets", &sup, None).await;
    assert_eq!(q.as_array().unwrap().len(), 1, "Erledigte nicht in der offenen Liste");
    let (_, q) = call(&db, "GET", "/api/v1/tickets?view=done", &sup, None).await;
    assert_eq!(q.as_array().unwrap().len(), 1);

    // Dringlichkeit ändern → Priorität neu; Zuweisung nur an Mitarbeiter
    let bid = b["id"].as_str().unwrap();
    let (s, _) = call(
        &db,
        "PATCH",
        &format!("/api/v1/tickets/{bid}"),
        &sup,
        Some(json!({ "urgency": "critical", "assignee_id": sup_id })),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, t) = call(&db, "GET", &format!("/api/v1/tickets/{bid}"), &sup, None).await;
    assert_eq!(t["priority"], 2);
    let (_, kunde_id): (StatusCode, Value) = call(&db, "GET", "/api/v1/me", &basis, None).await;
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/tickets/{bid}"), &sup, Some(json!({ "assignee_id": kunde_id["id"] })))
            .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (_, st) = call(&db, "GET", "/api/v1/tickets/stats", &sup, None).await;
    assert_eq!(st["open"], 1);
    assert_eq!(st["mine"], 1);
    let (s, _) = call(&db, "GET", "/api/v1/tickets/stats", &basis, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}
