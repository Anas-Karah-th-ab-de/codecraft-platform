//! Kalender: Erinnerungen, Gäste, Online-Meeting mit Gastlink und Vorraum.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::{Duration, Utc};
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

async fn setup(db: &PgPool) -> (String, String, String, Uuid) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    let admin = login(db, "ak@code-craft.tech", "admin-passwort-1").await;
    for (email, name) in [("jana@code-craft.tech", "Jana"), ("tom@code-craft.tech", "Tom")] {
        let (s, v) = call(
            db,
            "POST",
            "/api/v1/users",
            &admin,
            Some(json!({ "email": email, "display_name": name, "role": "staff", "password": "start-passwort-1", "departments": ["DEV"] })),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{v}");
    }
    let jana = login(db, "jana@code-craft.tech", "start-passwort-1").await;
    let tom = login(db, "tom@code-craft.tech", "start-passwort-1").await;
    let tom_id: Uuid =
        sqlx::query_scalar("SELECT id FROM users WHERE email = 'tom@code-craft.tech'").fetch_one(db).await.unwrap();
    (admin, jana, tom, tom_id)
}

fn event(start: chrono::DateTime<Utc>, attendees: Vec<Uuid>, extra: Value) -> Value {
    let mut v = json!({
        "title": "Abnahme Kassensystem", "starts_at": start, "ends_at": start + Duration::hours(1),
        "attendees": attendees, "reminders": [15], "online": true,
        "guests": [{ "email": "Kunde@Extern.de", "name": "Herr Kunde" }]
    });
    if let (Some(o), Some(e)) = (v.as_object_mut(), extra.as_object()) {
        for (k, x) in e {
            o.insert(k.clone(), x.clone());
        }
    }
    v
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn reminders_and_guests(db: PgPool) {
    let (_admin, jana, tom, tom_id) = setup(&db).await;
    let start = Utc::now() + Duration::minutes(10);

    // Prüfungen: ungültige Erinnerung, Gäste ohne Ort/Online, kaputte E-Mail
    let (s, _) =
        call(&db, "POST", "/api/v1/calendar", &jana, Some(event(start, vec![tom_id], json!({ "reminders": [7] }))))
            .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) =
        call(&db, "POST", "/api/v1/calendar", &jana, Some(event(start, vec![], json!({ "online": false })))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/calendar",
        &jana,
        Some(event(start, vec![], json!({ "guests": [{ "email": "kaputt" }] }))),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    let (s, v) = call(&db, "POST", "/api/v1/calendar", &jana, Some(event(start, vec![tom_id], json!({})))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let id = v["id"].as_str().unwrap().to_owned();
    assert!(v["meeting_id"].is_string());

    // Kalender: Organisatorin sieht Gäste, Teilnehmer nicht; beide sehen das Meeting
    let range = format!(
        "/api/v1/calendar?from={}&to={}",
        (start - Duration::days(1)).to_rfc3339().replace('+', "%2B"),
        (start + Duration::days(1)).to_rfc3339().replace('+', "%2B")
    );
    let (_, cal) = call(&db, "GET", &range, &jana, None).await;
    let ev = &cal["events"][0];
    assert_eq!(ev["guests"][0]["email"], "kunde@extern.de");
    assert_eq!(ev["online"], true);
    assert_eq!(ev["reminders"], json!([15]));
    let (_, cal) = call(&db, "GET", &range, &tom, None).await;
    assert_eq!(cal["events"][0]["guests"], json!([]));
    assert!(cal["events"][0]["meeting_id"].is_string());

    // 15 min vorher fällig: Jana, Tom und der Gast – genau einmal
    let n = codecraft_server::routes::meet::send_due_reminders(&db, Utc::now()).await.unwrap();
    assert_eq!(n, 3);
    let n = codecraft_server::routes::meet::send_due_reminders(&db, Utc::now()).await.unwrap();
    assert_eq!(n, 0);
    // abgesagt → keine Erinnerung; Zeit verschoben → neu fällig
    call(&db, "POST", &format!("/api/v1/calendar/{id}/respond"), &tom, Some(json!({ "response": "declined" }))).await;
    let moved = event(start + Duration::minutes(2), vec![tom_id], json!({}));
    let (s, _) = call(&db, "PUT", &format!("/api/v1/calendar/{id}"), &jana, Some(moved)).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let n = codecraft_server::routes::meet::send_due_reminders(&db, Utc::now()).await.unwrap();
    assert_eq!(n, 2, "verschoben: Jana und Gast erneut, Tom hat abgesagt");

    // offline geschaltet → Meeting und Gastlink weg
    let (s, _) = call(
        &db,
        "PUT",
        &format!("/api/v1/calendar/{id}"),
        &jana,
        Some(event(start, vec![tom_id], json!({ "online": false, "guests": [], "location": "Büro" }))),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM meetings").fetch_one(&db).await.unwrap();
    assert_eq!(left, 0);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn guest_joins_through_lobby(db: PgPool) {
    let (_admin, jana, tom, tom_id) = setup(&db).await;
    let start = Utc::now() + Duration::minutes(5);
    let (_, v) = call(&db, "POST", "/api/v1/calendar", &jana, Some(event(start, vec![tom_id], json!({})))).await;
    let meeting = v["meeting_id"].as_str().unwrap().to_owned();

    // Organisatorin bekommt den Gastlink, Teilnehmer nicht; Fremde gar nichts
    let (s, info) = call(&db, "GET", &format!("/api/v1/meetings/{meeting}"), &jana, None).await;
    assert_eq!(s, StatusCode::OK, "{info}");
    assert_eq!(info["state"], "open");
    let link = info["link"].as_str().unwrap().to_owned();
    let key = link.rsplit('/').next().unwrap().to_owned();
    assert!(key.len() > 40);
    let (_, info_tom) = call(&db, "GET", &format!("/api/v1/meetings/{meeting}"), &tom, None).await;
    assert!(info_tom["link"].is_null());
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'x@code-craft.tech', 'X', 'staff', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("start-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let fremd = login(&db, "x@code-craft.tech", "start-passwort-1").await;
    assert_eq!(call(&db, "GET", &format!("/api/v1/meetings/{meeting}"), &fremd, None).await.0, StatusCode::NOT_FOUND);

    // öffentliche Angaben nur mit richtigem Schlüssel
    let (s, pub_info) = call(&db, "GET", &format!("/api/v1/meet/info?link={key}"), "", None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(pub_info["title"], "Abnahme Kassensystem");
    assert!(pub_info["link"].is_null());
    assert_eq!(call(&db, "GET", "/api/v1/meet/info?link=m_falsch", "", None).await.0, StatusCode::NOT_FOUND);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let state = AppState { db: db.clone() };
    tokio::spawn(async move { axum::serve(listener, app(state)).await.unwrap() });

    // Gast ohne Namen abgewiesen
    assert!(tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/meet/ws?link={key}&name=")).await.is_err());
    // Organisatorin tritt bei
    let (mut host, _) =
        tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/meet/ws?meeting={meeting}&token={jana}"))
            .await
            .unwrap();
    let w = next_of(&mut host, "welcome").await;
    assert_eq!(w["admitted"], true);
    let host_id = w["you"]["id"].as_str().unwrap().to_owned();
    // Gast landet im Vorraum, Organisatorin wird benachrichtigt
    let (mut guest, _) =
        tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/meet/ws?link={key}&name=Herr%20Kunde"))
            .await
            .unwrap();
    let g = next_of(&mut guest, "welcome").await;
    assert_eq!(g["admitted"], false);
    assert_eq!(g["peers"], json!([]));
    let guest_id = g["you"]["id"].as_str().unwrap().to_owned();
    let k = next_of(&mut host, "knock").await;
    assert_eq!(k["peer"]["name"], "Herr Kunde");
    assert_eq!(k["peer"]["guest"], true);
    // Gast im Vorraum kann keine Signale schicken
    guest
        .send(Message::Text(json!({ "type": "signal", "to": host_id, "data": { "x": 1 } }).to_string().into()))
        .await
        .unwrap();
    // eigene Verbindung → Reihenfolge zum „admit“ der Organisatorin ist sonst nicht garantiert
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    // einlassen → Gast bekommt Teilnehmerliste, Organisatorin „joined“
    host.send(Message::Text(json!({ "type": "admit", "id": guest_id }).to_string().into())).await.unwrap();
    let a = next_of(&mut guest, "admitted").await;
    assert_eq!(a["peers"][0]["id"], host_id.as_str());
    let j = next_of(&mut host, "joined").await;
    assert_eq!(j["peer"]["id"], guest_id.as_str());
    // jetzt laufen Signale, die alte (Vorraum-)Nachricht kam nie an
    guest
        .send(Message::Text(json!({ "type": "signal", "to": host_id, "data": { "kind": "offer" } }).to_string().into()))
        .await
        .unwrap();
    let sg = next_of(&mut host, "signal").await;
    assert_eq!(sg["data"]["kind"], "offer");
    assert_eq!(sg["from"], guest_id.as_str());
    // Chat im Meeting
    host.send(Message::Text(json!({ "type": "chat", "text": "Willkommen" }).to_string().into())).await.unwrap();
    let c = next_of(&mut guest, "chat").await;
    assert_eq!(c["text"], "Willkommen");
    assert_eq!(c["name"], "Jana");

    // zweiter Gast wird abgewiesen
    let (mut g2, _) = tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/meet/ws?link={key}&name=Unbekannt"))
        .await
        .unwrap();
    let g2w = next_of(&mut g2, "welcome").await;
    let g2_id = g2w["you"]["id"].as_str().unwrap().to_owned();
    next_of(&mut host, "knock").await;
    // Gäste dürfen nicht einlassen
    guest.send(Message::Text(json!({ "type": "admit", "id": g2_id }).to_string().into())).await.unwrap();
    host.send(Message::Text(json!({ "type": "deny", "id": g2_id }).to_string().into())).await.unwrap();
    next_of(&mut g2, "denied").await;
    // Gast geht → Organisatorin erfährt es
    guest.close(None).await.unwrap();
    let l = next_of(&mut host, "left").await;
    assert_eq!(l["id"], guest_id.as_str());

    // vor Beginn (Gast > 30 min vorher) und nach Ende geschlossen
    sqlx::query(
        "UPDATE calendar_events SET starts_at = now() + interval '2 hours', ends_at = now() + interval '3 hours'",
    )
    .execute(&db)
    .await
    .unwrap();
    let (_, early) = call(&db, "GET", &format!("/api/v1/meet/info?link={key}"), "", None).await;
    assert_eq!(early["state"], "early");
    assert!(tokio_tungstenite::connect_async(format!("ws://{addr}/api/v1/meet/ws?link={key}&name=Herr%20Kunde"))
        .await
        .is_err());
    sqlx::query(
        "UPDATE calendar_events SET starts_at = now() - interval '6 hours', ends_at = now() - interval '5 hours'",
    )
    .execute(&db)
    .await
    .unwrap();
    let (_, ended) = call(&db, "GET", &format!("/api/v1/meet/info?link={key}"), "", None).await;
    assert_eq!(ended["state"], "ended");
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
            assert_ne!(v["type"], "signal", "unerwartetes Signal: {v}");
        }
    }
}
