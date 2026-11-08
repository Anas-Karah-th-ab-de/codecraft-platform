//! Projekte anlegen: Kunde, intern, Open Source (öffentlich auf der Webseite).

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
async fn create_projects_of_all_kinds(db: PgPool) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let admin = login(&db, "ak@code-craft.tech", "admin-passwort-1").await;
    let (_, o) = call(&db, "POST", "/api/v1/organizations", &admin, Some(json!({ "name": "Kunde GmbH" }))).await;
    let org = o["id"].as_str().unwrap();
    let (_, k) = call(&db, "POST", "/api/v1/users", &admin, Some(json!({
        "email": "k@kunde.de", "display_name": "K", "role": "customer", "password": "start-passwort-1", "organization_id": org
    }))).await;
    assert!(k["id"].is_string());
    let kunde = login(&db, "k@kunde.de", "start-passwort-1").await;

    // Kundenprojekt braucht Kunden
    let (s, _) =
        call(&db, "POST", "/api/v1/projects", &admin, Some(json!({ "name": "Webshop", "kind": "customer" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, c) = call(
        &db,
        "POST",
        "/api/v1/projects",
        &admin,
        Some(json!({ "name": "Webshop", "kind": "customer", "organization_id": org, "budget_hours": 120 })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{c}");
    // intern, ohne Kunde
    let (s, i) = call(
        &db,
        "POST",
        "/api/v1/projects",
        &admin,
        Some(json!({ "name": "Interne Buchhaltung", "kind": "internal", "department": "ACC" })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{i}");
    // Open Source, öffentlich
    let (s, oss) = call(&db, "POST", "/api/v1/projects", &admin, Some(json!({
        "name": "KM Code Craft Agent", "kind": "opensource", "repo_url": "https://github.com/km-code-craft/agent", "license": "Apache-2.0",
        "is_public": true, "description": "Rust-Agent für Fernwartung"
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{oss}");
    // öffentlich nur für Open Source; Repository nur https
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/projects",
        &admin,
        Some(json!({ "name": "X", "kind": "internal", "is_public": true })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/projects",
        &admin,
        Some(json!({ "name": "X", "kind": "opensource", "repo_url": "javascript:alert(1)" })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    // Kunden legen keine Projekte an und sehen nur ihre
    let (s, _) = call(&db, "POST", "/api/v1/projects", &kunde, Some(json!({ "name": "X", "kind": "internal" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (_, mine) = call(&db, "GET", "/api/v1/projects", &kunde, None).await;
    assert_eq!(mine.as_array().unwrap().len(), 1);
    assert_eq!(mine[0]["kind"], "customer");
    let (_, all) = call(&db, "GET", "/api/v1/projects", &admin, None).await;
    assert_eq!(all.as_array().unwrap().len(), 3);
    let (_, d) = call(&db, "GET", &format!("/api/v1/projects/{}", i["id"].as_str().unwrap()), &admin, None).await;
    assert_eq!(d["kind"], "internal");
    assert_eq!(d["department_code"], "ACC");

    // Webseite: nur öffentliche Open-Source-Projekte, ohne Anmeldung
    let (s, pubs) = call(&db, "GET", "/api/v1/public/projects", "", None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(pubs.as_array().unwrap().len(), 1);
    assert_eq!(pubs[0]["license"], "Apache-2.0");
    // bearbeiten: Repository/Lizenz/öffentlich
    let (s, _) = call(
        &db,
        "PATCH",
        &format!("/api/v1/projects/{}", oss["id"].as_str().unwrap()),
        &admin,
        Some(json!({ "is_public": false })),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, pubs) = call(&db, "GET", "/api/v1/public/projects", "", None).await;
    assert!(pubs.as_array().unwrap().is_empty());
    let (s, _) = call(
        &db,
        "PATCH",
        &format!("/api/v1/projects/{}", c["id"].as_str().unwrap()),
        &admin,
        Some(json!({ "is_public": true })),
    )
    .await;
    assert!(s.is_client_error(), "Kundenprojekt nie öffentlich");
}
