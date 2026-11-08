//! Shop-Bestellung → Rechnungsentwurf; Entwicklungsanfrage → Projekt → Fortschritt für den Kunden.

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

async fn org(db: &PgPool, admin: &str, name: &str) -> Uuid {
    let (_, o) =
        call(db, "POST", "/api/v1/organizations", admin, Some(json!({ "name": name, "address": "Hauptstr. 1" }))).await;
    o["id"].as_str().unwrap().parse().unwrap()
}

async fn user(db: &PgPool, admin: &str, email: &str, role: &str, org: Option<Uuid>, depts: Value) -> String {
    let (s, v) = call(db, "POST", "/api/v1/users", admin, Some(json!({
        "email": email, "display_name": email, "role": role, "password": "start-passwort-1", "organization_id": org, "departments": depts
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    login(db, email, "start-passwort-1").await
}

/// (Kunde, fremder Kunde, Team)
async fn setup(db: &PgPool) -> (String, String, String) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    let admin = login(db, "ak@code-craft.tech", "admin-passwort-1").await;
    let sonne = org(db, &admin, "Bäckerei Sonne").await;
    let andere = org(db, &admin, "Andere GmbH").await;
    (
        user(db, &admin, "kunde@sonne.de", "customer", Some(sonne), json!([])).await,
        user(db, &admin, "andere@x.de", "customer", Some(andere), json!([])).await,
        user(db, &admin, "dev@code-craft.tech", "manager", None, json!(["DEV", "SAL"])).await,
    )
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn shop_order_becomes_invoice(db: PgPool) {
    let (kunde, andere, team) = setup(&db).await;
    let (_, cat) = call(&db, "GET", "/api/v1/public/catalog?locale=de", "", None).await;
    let prices: Vec<&Value> =
        cat["products"].as_array().unwrap().iter().flat_map(|p| p["prices"].as_array().unwrap()).collect();
    let fixed =
        prices.iter().find(|p| !p["amount_cents"].is_null() && p["currency"] == "EUR").expect("Festpreis im Katalog");
    let on_request = prices.iter().find(|p| p["amount_cents"].is_null());
    let amount = fixed["amount_cents"].as_i64().unwrap();

    // Preis auf Anfrage ist nicht bestellbar; Preis kommt immer aus dem Katalog
    if let Some(r) = on_request {
        let (s, _) = call(
            &db,
            "POST",
            "/api/v1/orders",
            &kunde,
            Some(json!({ "items": [{ "price_id": r["id"], "quantity": 1 }] })),
        )
        .await;
        assert_eq!(s, StatusCode::BAD_REQUEST);
    }
    let (s, o) = call(
        &db,
        "POST",
        "/api/v1/orders",
        &kunde,
        Some(json!({
            "items": [{ "price_id": fixed["id"], "quantity": 3, "unit_price_cents": 1 }], "note": "Bitte bis Freitag"
        })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{o}");
    assert_eq!(o["net_cents"], amount * 3);
    assert!(o["number"].as_str().unwrap().starts_with("B-"));
    let oid = o["id"].as_str().unwrap();

    let (_, mine) = call(&db, "GET", "/api/v1/orders", &kunde, None).await;
    assert_eq!(mine.as_array().unwrap().len(), 1);
    assert_eq!(mine[0]["items"][0]["quantity"], 3);
    let (_, other) = call(&db, "GET", "/api/v1/orders", &andere, None).await;
    assert!(other.as_array().unwrap().is_empty());
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/orders/{oid}"), &andere, Some(json!({ "status": "cancelled" }))).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/orders/{oid}"), &kunde, Some(json!({ "status": "confirmed" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);

    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/orders/{oid}"), &team, Some(json!({ "status": "confirmed" }))).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, inv) = call(&db, "POST", &format!("/api/v1/orders/{oid}/invoice"), &team, None).await;
    assert_eq!(s, StatusCode::CREATED, "{inv}");
    let (s, _) = call(&db, "POST", &format!("/api/v1/orders/{oid}/invoice"), &team, None).await;
    assert_eq!(s, StatusCode::CONFLICT, "nur einmal");
    let (_, d) =
        call(&db, "GET", &format!("/api/v1/invoices/{}", inv["invoice_id"].as_str().unwrap()), &team, None).await;
    assert_eq!(d["status"], "draft", "{d}");
    assert_eq!(d["totals"]["net"], amount * 3, "{d}");
    let (_, mine) = call(&db, "GET", "/api/v1/orders", &kunde, None).await;
    assert_eq!(mine[0]["status"], "invoiced");
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/orders/{oid}"), &kunde, Some(json!({ "status": "cancelled" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn request_to_project_with_progress(db: PgPool) {
    let (kunde, andere, team) = setup(&db).await;
    let (s, r) = call(&db, "POST", "/api/v1/dev-requests", &kunde, Some(json!({
        "kind": "new_project", "title": "Kassen-App für Filialen", "description": "Drei Filialen, Offline-Betrieb", "budget": "10–20 T€", "desired_date": "2027-03-01"
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{r}");
    let rid = r["id"].as_str().unwrap();
    let (s, _) = call(&db, "GET", &format!("/api/v1/dev-requests/{rid}"), &andere, None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    call(
        &db,
        "POST",
        &format!("/api/v1/dev-requests/{rid}/messages"),
        &team,
        Some(json!({ "body": "Welche Kassenhardware?" })),
    )
    .await;
    call(
        &db,
        "POST",
        &format!("/api/v1/dev-requests/{rid}/messages"),
        &kunde,
        Some(json!({ "body": "Unsere POS-Geräte" })),
    )
    .await;
    let (_, d) = call(&db, "GET", &format!("/api/v1/dev-requests/{rid}"), &kunde, None).await;
    assert_eq!(d["thread"].as_array().unwrap().len(), 2);
    assert_eq!(d["thread"][0]["team"], true);
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/dev-requests/{rid}"), &kunde, Some(json!({ "status": "in_progress" })))
            .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    call(&db, "PATCH", &format!("/api/v1/dev-requests/{rid}"), &team, Some(json!({ "status": "quoted" }))).await;
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/dev-requests/{rid}"), &kunde, Some(json!({ "status": "accepted" }))).await;
    assert_eq!(s, StatusCode::NO_CONTENT);

    let (s, p) = call(&db, "POST", &format!("/api/v1/dev-requests/{rid}/project"), &team, None).await;
    assert_eq!(s, StatusCode::CREATED, "{p}");
    let pid = p["project_id"].as_str().unwrap();
    let (s, _) = call(&db, "POST", &format!("/api/v1/dev-requests/{rid}/project"), &team, None).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let mut ms = vec![];
    for t in ["Konzept", "Prototyp", "Rollout", "Schulung"] {
        let (s, m) =
            call(&db, "POST", &format!("/api/v1/projects/{pid}/milestones"), &team, Some(json!({ "title": t }))).await;
        assert_eq!(s, StatusCode::CREATED, "{m}");
        ms.push(m["id"].as_str().unwrap().to_owned());
    }
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/projects/{pid}/milestones"), &kunde, Some(json!({ "title": "x" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    call(&db, "PATCH", &format!("/api/v1/milestones/{}", ms[0]), &team, Some(json!({ "status": "done" }))).await;
    call(&db, "PATCH", &format!("/api/v1/milestones/{}", ms[1]), &team, Some(json!({ "status": "in_progress" }))).await;
    call(&db, "POST", &format!("/api/v1/projects/{pid}/updates"), &team, Some(json!({ "body": "Konzept abgenommen" })))
        .await;
    call(
        &db,
        "POST",
        &format!("/api/v1/projects/{pid}/updates"),
        &team,
        Some(json!({ "body": "intern: Aufwand höher", "for_customer": false })),
    )
    .await;

    let (s, pr) = call(&db, "GET", &format!("/api/v1/projects/{pid}"), &kunde, None).await;
    assert_eq!(s, StatusCode::OK, "{pr}");
    assert_eq!(pr["progress"], 25);
    assert_eq!(pr["milestones"].as_array().unwrap().len(), 4);
    assert_eq!(pr["updates"].as_array().unwrap().len(), 1, "interne Notiz verborgen");
    let (_, pr) = call(&db, "GET", &format!("/api/v1/projects/{pid}"), &team, None).await;
    assert_eq!(pr["updates"].as_array().unwrap().len(), 2);
    let (_, list) = call(&db, "GET", "/api/v1/dev-requests", &kunde, None).await;
    assert_eq!(list[0]["status"], "in_progress");
    assert_eq!(list[0]["project_progress"], 25);
    let (s, _) = call(&db, "GET", &format!("/api/v1/projects/{pid}"), &andere, None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
}
