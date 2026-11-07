//! Kommunikation: automatische Konten, Chat-Rechte, Echtzeit über WebSocket, Anruf-Signale.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codecraft_server::{app, auth, AppState};
use futures_util::{SinkExt, StreamExt};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tokio_tungstenite::tungstenite::Message;
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

async fn setup(db: &PgPool) -> (String, Uuid) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas Karah', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    let token = login(db, "ak@code-craft.tech", "admin-passwort-1").await;
    let (_, org) = call(db, "POST", "/api/v1/organizations", &token, Some(json!({ "name": "Muster GmbH" }))).await;
    (token, org["id"].as_str().unwrap().parse().unwrap())
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn accounts_are_provisioned(db: PgPool) {
    let (admin, org) = setup(&db).await;
    // Mitarbeiter mit externer Adresse → Postfach aus dem Namen
    let (s, v) = call(&db, "POST", "/api/v1/users", &admin, Some(json!({
        "email": "jana@gmail.com", "display_name": "Jana Müller", "role": "staff", "password": "sehr-geheim-123", "departments": ["DEV"]
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    assert_eq!(v["mailbox"], "jana.mueller@code-craft.tech");
    // gleicher Name → Nummer angehängt
    let (_, v) = call(
        &db,
        "POST",
        "/api/v1/users",
        &admin,
        Some(json!({
            "email": "jana2@gmail.com", "display_name": "Jana Müller", "role": "staff", "password": "sehr-geheim-123"
        })),
    )
    .await;
    assert_eq!(v["mailbox"], "jana.mueller2@code-craft.tech");
    // Hausadresse wird direkt übernommen
    let (_, v) = call(
        &db,
        "POST",
        "/api/v1/users",
        &admin,
        Some(json!({
            "email": "Info@Code-Craft.tech", "display_name": "Info", "role": "manager", "password": "sehr-geheim-123"
        })),
    )
    .await;
    assert_eq!(v["mailbox"], "info@code-craft.tech");
    // Kunde: kein Postfach, aber Support-Raum mit dem Team
    let (s, v) = call(&db, "POST", "/api/v1/users", &admin, Some(json!({
        "email": "kunde@muster.de", "display_name": "Kunde", "role": "customer", "password": "sehr-geheim-123", "organization_id": org
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    assert!(v["mailbox"].is_null());
    let kunde = login(&db, "kunde@muster.de", "sehr-geheim-123").await;
    let (_, rooms) = call(&db, "GET", "/api/v1/chat/rooms", &kunde, None).await;
    assert_eq!(rooms.as_array().unwrap().len(), 1);
    assert_eq!(rooms[0]["kind"], "support");
    // Admin und Manager sind im Support-Raum
    let (_, admin_rooms) = call(&db, "GET", "/api/v1/chat/rooms", &admin, None).await;
    assert_eq!(admin_rooms.as_array().unwrap().len(), 1);
    let (_, users) = call(&db, "GET", "/api/v1/users", &admin, None).await;
    assert!(users.as_array().unwrap().iter().any(|u| u["mailbox"] == "info@code-craft.tech"));
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn customers_only_reach_team_and_own_company(db: PgPool) {
    let (admin, org) = setup(&db).await;
    let (_, other) = call(&db, "POST", "/api/v1/organizations", &admin, Some(json!({ "name": "Andere AG" }))).await;
    for (mail, o) in [("a@muster.de", org.to_string()), ("b@andere.de", other["id"].as_str().unwrap().to_string())] {
        let (s, _) = call(&db, "POST", "/api/v1/users", &admin, Some(json!({
            "email": mail, "display_name": mail, "role": "customer", "password": "sehr-geheim-123", "organization_id": o
        }))).await;
        assert_eq!(s, StatusCode::CREATED);
    }
    let a = login(&db, "a@muster.de", "sehr-geheim-123").await;
    let (_, contacts) = call(&db, "GET", "/api/v1/chat/contacts", &a, None).await;
    let names: Vec<&str> = contacts.as_array().unwrap().iter().map(|c| c["display_name"].as_str().unwrap()).collect();
    assert!(names.contains(&"Anas Karah"));
    assert!(!names.contains(&"b@andere.de"));
    // Direktchat mit fremdem Kunden verboten, Gruppen nur für Mitarbeiter
    let b_id: Uuid =
        sqlx::query_scalar("SELECT id FROM users WHERE email = 'b@andere.de'").fetch_one(&db).await.unwrap();
    assert_eq!(
        call(&db, "POST", "/api/v1/chat/rooms", &a, Some(json!({ "user_id": b_id }))).await.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(&db, "POST", "/api/v1/chat/rooms", &a, Some(json!({ "name": "x" }))).await.0,
        StatusCode::FORBIDDEN
    );
    // fremder Raum nicht lesbar
    let (_, r) =
        call(&db, "POST", "/api/v1/chat/rooms", &admin, Some(json!({ "name": "Intern", "members": [] }))).await;
    let room = r["id"].as_str().unwrap();
    assert_eq!(
        call(&db, "GET", &format!("/api/v1/chat/rooms/{room}/messages"), &a, None).await.0,
        StatusCode::NOT_FOUND
    );
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn realtime_messages_and_call_signals(db: PgPool) {
    let (admin, _) = setup(&db).await;
    let (_, _) = call(
        &db,
        "POST",
        "/api/v1/users",
        &admin,
        Some(json!({
            "email": "jana@gmail.com", "display_name": "Jana", "role": "staff", "password": "sehr-geheim-123"
        })),
    )
    .await;
    let jana = login(&db, "jana@gmail.com", "sehr-geheim-123").await;
    let jana_id: Uuid =
        sqlx::query_scalar("SELECT id FROM users WHERE email = 'jana@gmail.com'").fetch_one(&db).await.unwrap();
    let admin_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE role = 'admin'").fetch_one(&db).await.unwrap();

    // echten Server starten (WebSocket braucht TCP)
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let state = AppState { db: db.clone() };
    tokio::spawn(async move { axum::serve(listener, app(state)).await.unwrap() });

    let (mut ws_jana, _) =
        tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/ws?token={jana}")).await.unwrap();
    let (mut ws_admin, _) =
        tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/ws?token={admin}")).await.unwrap();
    // ungültiges Token wird abgewiesen
    assert!(tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/ws?token=falsch")).await.is_err());

    let (s, r) = call(&db, "POST", "/api/v1/chat/rooms", &admin, Some(json!({ "user_id": jana_id }))).await;
    assert_eq!(s, StatusCode::OK);
    let room = r["id"].as_str().unwrap().to_owned();
    // gleicher Direktchat wird wiederverwendet
    let (_, r2) = call(&db, "POST", "/api/v1/chat/rooms", &jana, Some(json!({ "user_id": admin_id }))).await;
    assert_eq!(r2["id"], room.as_str());

    let (s, _) = call(
        &db,
        "POST",
        &format!("/api/v1/chat/rooms/{room}/messages"),
        &admin,
        Some(json!({ "body": "Hallo Jana" })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED);

    // Jana bekommt die Nachricht live (Anwesenheitsmeldungen überspringen)
    let got = next_of(&mut ws_jana, "message").await;
    assert_eq!(got["message"]["body"], "Hallo Jana");
    let (_, rooms) = call(&db, "GET", "/api/v1/chat/rooms", &jana, None).await;
    assert_eq!(rooms[0]["unread"], 1);
    call(&db, "POST", &format!("/api/v1/chat/rooms/{room}/read"), &jana, None).await;
    let (_, rooms) = call(&db, "GET", "/api/v1/chat/rooms", &jana, None).await;
    assert_eq!(rooms[0]["unread"], 0);

    // Anruf-Signal wird nur innerhalb des Raums weitergereicht
    let sig = json!({ "type": "call", "room": room, "to": jana_id, "data": { "kind": "ring", "media": "video" } });
    ws_admin.send(Message::Text(sig.to_string().into())).await.unwrap();
    let got = next_of(&mut ws_jana, "call").await;
    assert_eq!(got["data"]["kind"], "ring");
    assert_eq!(got["from"], admin_id.to_string());

    let (_, msgs) = call(&db, "GET", &format!("/api/v1/chat/rooms/{room}/messages"), &jana, None).await;
    assert_eq!(msgs["messages"].as_array().unwrap().len(), 1);
    assert_eq!(msgs["members"].as_array().unwrap().len(), 2);
}

async fn next_of<S>(ws: &mut S, kind: &str) -> Value
where
    S: StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
    loop {
        let msg = tokio::time::timeout_at(deadline, ws.next()).await.expect("Zeitüberschreitung").unwrap().unwrap();
        if let Message::Text(t) = msg {
            let v: Value = serde_json::from_str(&t).unwrap();
            if v["type"] == kind {
                return v;
            }
        }
    }
}
