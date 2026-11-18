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

async fn multipart(db: &PgPool, uri: &str, token: &str, parts: &[(&str, Option<&str>, &[u8])]) -> (StatusCode, Value) {
    let b = "XyZgrenze42";
    let mut body = Vec::new();
    for (name, file, data) in parts {
        body.extend_from_slice(format!("--{b}\r\nContent-Disposition: form-data; name=\"{name}\"").as_bytes());
        if let Some(f) = file {
            body.extend_from_slice(format!("; filename=\"{f}\"\r\nContent-Type: application/pdf").as_bytes());
        }
        body.extend_from_slice(b"\r\n\r\n");
        body.extend_from_slice(data);
        body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(format!("--{b}--\r\n").as_bytes());
    let req = Request::builder()
        .method("POST")
        .uri(uri)
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", format!("multipart/form-data; boundary={b}"))
        .body(Body::from(body))
        .unwrap();
    let res = app(AppState { db: db.clone() }).oneshot(req).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn get_raw(db: &PgPool, uri: &str, token: &str) -> (StatusCode, Vec<u8>) {
    let req =
        Request::builder().uri(uri).header("authorization", format!("Bearer {token}")).body(Body::empty()).unwrap();
    let res = app(AppState { db: db.clone() }).oneshot(req).await.unwrap();
    let status = res.status();
    (status, res.into_body().collect().await.unwrap().to_bytes().to_vec())
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn project_documents_upload(db: PgPool) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let admin = login(&db, "ak@code-craft.tech", "admin-passwort-1").await;
    let (_, o) = call(&db, "POST", "/api/v1/organizations", &admin, Some(json!({ "name": "Kunde GmbH" }))).await;
    let org = o["id"].as_str().unwrap().to_owned();
    let (_, o2) = call(&db, "POST", "/api/v1/organizations", &admin, Some(json!({ "name": "Andere AG" }))).await;
    for (mail, o) in [("k@kunde.de", &org), ("x@andere.de", &o2["id"].as_str().unwrap().to_owned())] {
        call(&db, "POST", "/api/v1/users", &admin, Some(json!({
            "email": mail, "display_name": "K", "role": "customer", "password": "start-passwort-1", "organization_id": o
        }))).await;
    }
    let kunde = login(&db, "k@kunde.de", "start-passwort-1").await;
    let fremd = login(&db, "x@andere.de", "start-passwort-1").await;
    let (_, p) = call(
        &db,
        "POST",
        "/api/v1/projects",
        &admin,
        Some(json!({ "name": "GNSS", "kind": "customer", "organization_id": org })),
    )
    .await;
    let pid = p["id"].as_str().unwrap().to_owned();
    let pdf: &[u8] = b"%PDF-1.4 Bericht";

    // Kunde darf nicht hochladen
    let (s, _) =
        multipart(&db, &format!("/api/v1/projects/{pid}/documents"), &kunde, &[("file", Some("x.pdf"), pdf)]).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    // Bericht für den Kunden, ein internes Dokument
    let (s, d) = multipart(
        &db,
        &format!("/api/v1/projects/{pid}/documents"),
        &admin,
        &[
            ("title", None, "تقرير تقدّم العمل رقم 1".as_bytes()),
            ("kind", None, b"report"),
            ("file", Some("bericht.pdf"), pdf),
        ],
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{d}");
    assert_eq!(d["mime"], "application/pdf");
    let doc = d["id"].as_str().unwrap().to_owned();
    let (s, i) = multipart(
        &db,
        &format!("/api/v1/projects/{pid}/documents"),
        &admin,
        &[("for_customer", None, b"false"), ("kind", None, b"other"), ("file", Some("intern.pdf"), pdf)],
    )
    .await;
    assert_eq!(s, StatusCode::CREATED);
    assert_eq!(i["title"], "intern");
    let internal = i["id"].as_str().unwrap().to_owned();
    // gefährliche Dateien und unbekannte Arten werden abgelehnt
    let (s, _) =
        multipart(&db, &format!("/api/v1/projects/{pid}/documents"), &admin, &[("file", Some("a.exe"), b"MZ\x90\x00")])
            .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = multipart(
        &db,
        &format!("/api/v1/projects/{pid}/documents"),
        &admin,
        &[("kind", None, b"x"), ("file", Some("a.pdf"), pdf)],
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    // Kunde sieht nur den freigegebenen Bericht – und eine Neuigkeit dazu
    let (_, v) = call(&db, "GET", &format!("/api/v1/projects/{pid}"), &kunde, None).await;
    assert_eq!(v["documents"].as_array().unwrap().len(), 1, "{v}");
    assert_eq!(v["documents"][0]["title"], "تقرير تقدّم العمل رقم 1");
    assert!(v["updates"][0]["body"].as_str().unwrap().contains("تقرير"));
    let (_, v) = call(&db, "GET", &format!("/api/v1/projects/{pid}"), &admin, None).await;
    assert_eq!(v["documents"].as_array().unwrap().len(), 2);

    let (s, body) = get_raw(&db, &format!("/api/v1/project-documents/{doc}"), &kunde).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(body, pdf);
    assert_eq!(get_raw(&db, &format!("/api/v1/project-documents/{internal}"), &kunde).await.0, StatusCode::NOT_FOUND);
    assert_eq!(get_raw(&db, &format!("/api/v1/project-documents/{doc}"), &fremd).await.0, StatusCode::NOT_FOUND);

    // Löschen nur durch das Team
    assert_eq!(
        call(&db, "DELETE", &format!("/api/v1/project-documents/{doc}"), &kunde, None).await.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(&db, "DELETE", &format!("/api/v1/project-documents/{doc}"), &admin, None).await.0,
        StatusCode::NO_CONTENT
    );
    assert_eq!(get_raw(&db, &format!("/api/v1/project-documents/{doc}"), &admin).await.0, StatusCode::NOT_FOUND);
}
