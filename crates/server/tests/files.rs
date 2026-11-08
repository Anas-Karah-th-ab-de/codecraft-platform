//! Dateiversand im Chat (Mitgliedschaft, Sperre für Programme, sichere Auslieferung)
//! und Mail-Anhänge beim Weiterleiten.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use base64::Engine;
use codecraft_server::{app, auth, mail, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn raw(db: &PgPool, req: Request<Body>) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
    let res = app(AppState { db: db.clone() }).oneshot(req).await.unwrap();
    let (parts, body) = res.into_parts();
    (parts.status, parts.headers, body.collect().await.unwrap().to_bytes().to_vec())
}

async fn call(db: &PgPool, method: &str, uri: &str, token: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri).header("authorization", format!("Bearer {token}"));
    let body = match body {
        Some(b) => {
            req = req.header("content-type", "application/json");
            Body::from(b.to_string())
        }
        None => Body::empty(),
    };
    let (s, _, b) = raw(db, req.body(body).unwrap()).await;
    (s, serde_json::from_slice(&b).unwrap_or(Value::Null))
}

async fn upload(db: &PgPool, token: &str, room: &str, name: &str, mime: &str, data: &[u8]) -> (StatusCode, Value) {
    let b = "XxGrenzeXx";
    let mut body = format!(
        "--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: {mime}\r\n\r\n"
    )
    .into_bytes();
    body.extend_from_slice(data);
    body.extend_from_slice(format!("\r\n--{b}--\r\n").as_bytes());
    let req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/chat/rooms/{room}/files"))
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", format!("multipart/form-data; boundary={b}"))
        .body(Body::from(body))
        .unwrap();
    let (s, _, b) = raw(db, req).await;
    (s, serde_json::from_slice(&b).unwrap_or(Value::Null))
}

async fn login(db: &PgPool, email: &str, pw: &str) -> String {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(json!({ "email": email, "password": pw }).to_string()))
        .unwrap();
    let (_, _, b) = raw(db, req).await;
    serde_json::from_slice::<Value>(&b).unwrap()["token"].as_str().unwrap().to_owned()
}

/// Admin + Jana + Tom + Lea (Mitarbeiter mit Postfach)
async fn setup(db: &PgPool) -> (String, String, String, String, String) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'admin@example.org', 'Admin', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    let admin = login(db, "admin@example.org", "admin-passwort-1").await;
    let mut ids = vec![];
    for (email, name) in
        [("jana@gmail.com", "Jana Müller"), ("tom@gmail.com", "Tom Weber"), ("lea@gmail.com", "Lea Kurz")]
    {
        let (s, v) = call(
            db,
            "POST",
            "/api/v1/users",
            &admin,
            Some(json!({ "email": email, "display_name": name, "role": "staff", "password": "sehr-geheim-123" })),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{v}");
        ids.push(v["id"].as_str().unwrap().to_owned());
    }
    mail::ensure_dkim(db).await.unwrap();
    mail::guard::set_key_for_tests([7; 32]);
    (
        login(db, "jana@gmail.com", "sehr-geheim-123").await,
        login(db, "tom@gmail.com", "sehr-geheim-123").await,
        login(db, "lea@gmail.com", "sehr-geheim-123").await,
        ids[1].clone(),
        admin,
    )
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn chat_files(db: PgPool) {
    let (jana, tom, lea, tom_id, _admin) = setup(&db).await;
    let (_, room) = call(&db, "POST", "/api/v1/chat/rooms", &jana, Some(json!({ "user_id": tom_id }))).await;
    let room = room["id"].as_str().unwrap().to_owned();

    // PDF senden → Nachricht vom Typ „file“
    let pdf = b"%PDF-1.4 Angebot ...";
    let (s, m) = upload(&db, &jana, &room, "Angebot März.pdf", "application/pdf", pdf).await;
    assert_eq!(s, StatusCode::CREATED, "{m}");
    assert_eq!(m["kind"], "file");
    assert_eq!(m["file"]["name"], "Angebot März.pdf");
    let fid = m["file"]["id"].as_str().unwrap().to_owned();
    // gespeichert verschlüsselt
    let stored: Vec<u8> = sqlx::query_scalar("SELECT data FROM chat_files WHERE id = $1")
        .bind(Uuid::parse_str(&fid).unwrap())
        .fetch_one(&db)
        .await
        .unwrap();
    assert!(stored.starts_with(b"CCE1"));

    // Tom (Mitglied) lädt herunter: Original, immer als Download
    let req = Request::builder()
        .uri(format!("/api/v1/chat/files/{fid}?inline=true"))
        .header("authorization", format!("Bearer {tom}"))
        .body(Body::empty())
        .unwrap();
    let (s, h, body) = raw(&db, req).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(body, pdf);
    assert_eq!(h["content-type"], "application/octet-stream", "PDF nie inline");
    assert!(h["content-disposition"].to_str().unwrap().starts_with("attachment;"));
    assert!(h["content-disposition"].to_str().unwrap().contains("filename*=UTF-8''Angebot%20M%C3%A4rz.pdf"));
    assert_eq!(h["x-content-type-options"], "nosniff");
    // Lea ist nicht im Raum
    let req = Request::builder()
        .uri(format!("/api/v1/chat/files/{fid}"))
        .header("authorization", format!("Bearer {lea}"))
        .body(Body::empty())
        .unwrap();
    assert_eq!(raw(&db, req).await.0, StatusCode::NOT_FOUND);
    let (s, _) = upload(&db, &lea, &room, "x.txt", "text/plain", b"x").await;
    assert!(matches!(s, StatusCode::FORBIDDEN | StatusCode::NOT_FOUND), "{s}");

    // Bild inline; HTML/SVG nie inline
    let png = [&b"\x89PNG\r\n\x1a\n"[..], &[0u8; 32]].concat();
    let (_, m) = upload(&db, &tom, &room, "foto.png", "image/png", &png).await;
    let req = Request::builder()
        .uri(format!("/api/v1/chat/files/{}?inline=true", m["file"]["id"].as_str().unwrap()))
        .header("authorization", format!("Bearer {jana}"))
        .body(Body::empty())
        .unwrap();
    let (_, h, _) = raw(&db, req).await;
    assert_eq!(h["content-type"], "image/png");
    let (_, m) = upload(&db, &tom, &room, "seite.svg", "image/svg+xml", b"<svg onload=alert(1)>").await;
    let req = Request::builder()
        .uri(format!("/api/v1/chat/files/{}?inline=true", m["file"]["id"].as_str().unwrap()))
        .header("authorization", format!("Bearer {jana}"))
        .body(Body::empty())
        .unwrap();
    let (_, h, _) = raw(&db, req).await;
    assert_eq!(h["content-type"], "application/octet-stream");

    // Programme gesperrt – auch getarnt
    for (name, mime, data) in [
        ("tool.exe", "application/octet-stream", &b"xx"[..]),
        ("rechnung.pdf", "application/pdf", &b"MZ\x90\x00"[..]),
        ("makro.docm", "application/octet-stream", &b"PK"[..]),
    ] {
        let (s, v) = upload(&db, &jana, &room, name, mime, data).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{name}: {v}");
    }

    // Verlauf zeigt Dateien
    let (_, h) = call(&db, "GET", &format!("/api/v1/chat/rooms/{room}/messages"), &tom, None).await;
    let files: Vec<&Value> = h["messages"].as_array().unwrap().iter().filter(|m| m["kind"] == "file").collect();
    assert_eq!(files.len(), 3);
    assert_eq!(files[0]["file"]["size"], pdf.len());
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn mail_attachments_forwarded(db: PgPool) {
    let (jana, tom, _lea, _tom_id, _admin) = setup(&db).await;
    let b64 = |d: &[u8]| base64::engine::general_purpose::STANDARD.encode(d);
    // Jana schickt Tom zwei Anhänge
    let (s, v) = call(&db, "POST", "/api/v1/mail/send", &jana, Some(json!({
        "to": ["tom.weber@code-craft.tech"], "subject": "Unterlagen", "text": "Anbei",
        "attachments": [
            { "name": "Vertrag.pdf", "mime": "application/pdf", "data_b64": b64(b"%PDF-1.4 Vertrag") },
            { "name": "Plan.xlsx", "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "data_b64": b64(b"PK\x03\x04plan") }
        ]
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    // Programme werden nicht versendet
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/mail/send",
        &jana,
        Some(json!({
            "to": ["tom.weber@code-craft.tech"], "subject": "x", "text": "x",
            "attachments": [{ "name": "setup.exe", "mime": "application/octet-stream", "data_b64": b64(b"MZ") }]
        })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    let (_, inbox) = call(&db, "GET", "/api/v1/mail/messages?folder=inbox", &tom, None).await;
    let id = inbox[0]["id"].as_str().unwrap().to_owned();
    assert_eq!(inbox[0]["has_attachments"], true);
    let (_, m) = call(&db, "GET", &format!("/api/v1/mail/messages/{id}"), &tom, None).await;
    assert_eq!(m["attachments"].as_array().unwrap().len(), 2);
    // Tom leitet an Jana weiter – Anhänge kommen mit, plus ein neuer
    let (s, v) = call(&db, "POST", "/api/v1/mail/send", &tom, Some(json!({
        "to": ["jana.mueller@code-craft.tech"], "subject": "Fwd: Unterlagen", "text": "siehe unten", "forward_id": id,
        "attachments": [{ "name": "Notiz.txt", "mime": "text/plain", "data_b64": b64("Grüße".as_bytes()) }]
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let (_, inbox) = call(&db, "GET", "/api/v1/mail/messages?folder=inbox", &jana, None).await;
    let fwd = inbox.as_array().unwrap().iter().find(|x| x["subject"] == "Fwd: Unterlagen").unwrap();
    let (_, m) = call(&db, "GET", &format!("/api/v1/mail/messages/{}", fwd["id"].as_str().unwrap()), &jana, None).await;
    let names: Vec<&str> = m["attachments"].as_array().unwrap().iter().map(|a| a["name"].as_str().unwrap()).collect();
    assert_eq!(names.len(), 3, "{names:?}");
    assert!(names.contains(&"Vertrag.pdf") && names.contains(&"Plan.xlsx") && names.contains(&"Notiz.txt"));
    // Anhang unverändert herunterladbar
    let req = Request::builder()
        .uri(format!("/api/v1/mail/messages/{}/attachments/0", fwd["id"].as_str().unwrap()))
        .header("authorization", format!("Bearer {jana}"))
        .body(Body::empty())
        .unwrap();
    let (s, _, body) = raw(&db, req).await;
    assert_eq!(s, StatusCode::OK);
    assert!(!body.is_empty());
    // fremde Nachricht kann nicht als Weiterleitungsquelle dienen
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/mail/send",
        &jana,
        Some(json!({
            "to": ["tom.weber@code-craft.tech"], "subject": "x", "text": "x", "forward_id": id
        })),
    )
    .await;
    assert_eq!(s, StatusCode::NOT_FOUND);
}
