//! Benachrichtigungen, Ankündigungen, Sperren/Entfernen mit Übergabe, E-Mail-Mehrfachaktionen.

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

async fn uid(db: &PgPool, email: &str) -> Uuid {
    sqlx::query_scalar("SELECT id FROM users WHERE email = $1").bind(email).fetch_one(db).await.unwrap()
}

/// Admin, Jana (DEV), Tom (SUP), Kundin Kim
async fn setup(db: &PgPool) -> (String, String, String, String) {
    std::env::set_var("PUSH_DISABLED", "1");
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    let admin = login(db, "ak@code-craft.tech", "admin-passwort-1").await;
    for (email, name, dept) in [("jana@code-craft.tech", "Jana", "DEV"), ("tom@code-craft.tech", "Tom", "SUP")] {
        let (s, v) = call(
            db,
            "POST",
            "/api/v1/users",
            &admin,
            Some(json!({ "email": email, "display_name": name, "role": "staff", "password": "start-passwort-1", "departments": [dept] })),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{v}");
    }
    let org = Uuid::now_v7();
    sqlx::query("INSERT INTO organizations (id, name) VALUES ($1, 'Kunde GmbH')").bind(org).execute(db).await.unwrap();
    let (s, v) = call(
        db,
        "POST",
        "/api/v1/users",
        &admin,
        Some(json!({ "email": "kim@kunde.de", "display_name": "Kim", "role": "customer", "password": "start-passwort-1", "organization_id": org })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    (
        admin,
        login(db, "jana@code-craft.tech", "start-passwort-1").await,
        login(db, "tom@code-craft.tech", "start-passwort-1").await,
        login(db, "kim@kunde.de", "start-passwort-1").await,
    )
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn announcements_reach_the_right_people(db: PgPool) {
    let (admin, jana, tom, kim) = setup(&db).await;

    // Mitarbeiter ohne Leitung/MGT und Kunden dürfen nicht ankündigen
    let a = json!({ "title": "Serverwartung Samstag", "body": "Portal ist 22–23 Uhr nicht erreichbar.", "level": "important", "require_ack": true });
    assert_eq!(call(&db, "POST", "/api/v1/announcements", &jana, Some(a.clone())).await.0, StatusCode::FORBIDDEN);
    assert_eq!(call(&db, "POST", "/api/v1/announcements", &kim, Some(a.clone())).await.0, StatusCode::FORBIDDEN);
    let (s, _) = call(&db, "POST", "/api/v1/announcements", &admin, Some(json!({ "title": "x", "body": "y" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    let (s, v) = call(&db, "POST", "/api/v1/announcements", &admin, Some(a)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let all_id = v["id"].as_str().unwrap().to_owned();
    // nur Abteilung DEV
    let (s, v) = call(
        &db,
        "POST",
        "/api/v1/announcements",
        &admin,
        Some(json!({ "title": "Code-Freeze Release 2.0", "body": "Ab Montag nur Fehlerbehebungen.", "audience": "departments", "departments": ["DEV"] })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let dev_id = v["id"].as_str().unwrap().to_owned();

    // Jana (DEV) sieht beide, Tom (SUP) nur die allgemeine, Kim (Kunde) die allgemeine
    let (_, l) = call(&db, "GET", "/api/v1/announcements", &jana, None).await;
    assert_eq!(l.as_array().unwrap().len(), 2);
    let (_, l) = call(&db, "GET", "/api/v1/announcements", &tom, None).await;
    assert_eq!(l.as_array().unwrap().len(), 1);
    assert!(l[0]["reads"].is_null(), "Statistik nur für Verfasser");
    let (_, l) = call(&db, "GET", "/api/v1/announcements", &kim, None).await;
    assert_eq!(l.as_array().unwrap().len(), 1);
    assert_eq!(
        call(&db, "POST", &format!("/api/v1/announcements/{dev_id}/read"), &tom, None).await.0,
        StatusCode::NOT_FOUND
    );

    // Benachrichtigungen sind angekommen (wichtig → Banner)
    let (_, n) = call(&db, "GET", "/api/v1/notifications", &tom, None).await;
    assert_eq!(n["unread"], 1);
    assert_eq!(n["items"][0]["kind"], "announcement");
    assert_eq!(n["items"][0]["link"], format!("/portal/ankuendigungen#{all_id}"));
    let (_, p) = call(&db, "GET", "/api/v1/announcements/pending", &tom, None).await;
    assert_eq!(p["unread"], 1);
    assert_eq!(p["banner"].as_array().unwrap().len(), 1);
    let (_, n) = call(&db, "GET", "/api/v1/notifications", &admin, None).await;
    assert_eq!(n["unread"], 0, "Verfasser bekommt keine eigene Meldung");

    // Lesen ohne Bestätigung: Banner bleibt, weil Bestätigung verlangt ist
    call(&db, "POST", &format!("/api/v1/announcements/{all_id}/read"), &tom, None).await;
    let (_, p) = call(&db, "GET", "/api/v1/announcements/pending", &tom, None).await;
    assert_eq!(p["unread"], 0);
    assert_eq!(p["banner"].as_array().unwrap().len(), 1);
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/announcements/{all_id}/read"), &tom, Some(json!({ "ack": true }))).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, p) = call(&db, "GET", "/api/v1/announcements/pending", &tom, None).await;
    assert_eq!(p["banner"].as_array().unwrap().len(), 0);
    let (_, n) = call(&db, "GET", "/api/v1/notifications", &tom, None).await;
    assert_eq!(n["unread"], 0, "Benachrichtigung mit gelesen");

    // Statistik für Verfasser: 5 Empfänger (inkl. Verfasser), 2 bestätigt (Verfasser + Tom)
    let (_, l) = call(&db, "GET", "/api/v1/announcements", &admin, None).await;
    let x = l.as_array().unwrap().iter().find(|a| a["id"] == all_id.as_str()).unwrap().clone();
    assert_eq!(x["acks"], 2);
    assert_eq!(x["audience_size"], 4);
    let (_, r) = call(&db, "GET", &format!("/api/v1/announcements/{all_id}/readers"), &admin, None).await;
    assert_eq!(r.as_array().unwrap().len(), 4);
    assert_eq!(
        call(&db, "GET", &format!("/api/v1/announcements/{all_id}/readers"), &tom, None).await.0,
        StatusCode::FORBIDDEN
    );

    // geplante Ankündigung: erst sichtbar, wenn fällig
    let later = chrono::Utc::now() + chrono::Duration::hours(2);
    let (s, v) = call(
        &db,
        "POST",
        "/api/v1/announcements",
        &admin,
        Some(json!({ "title": "Betriebsfeier", "body": "Freitag 16 Uhr.", "starts_at": later })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED);
    let (_, l) = call(&db, "GET", "/api/v1/announcements", &kim, None).await;
    assert_eq!(l.as_array().unwrap().len(), 1);
    sqlx::query("UPDATE announcements SET starts_at = now() - interval '1 minute' WHERE id = $1")
        .bind(v["id"].as_str().unwrap().parse::<Uuid>().unwrap())
        .execute(&db)
        .await
        .unwrap();
    assert_eq!(codecraft_server::routes::announce::publish_due(&db).await.unwrap(), 1);
    assert_eq!(codecraft_server::routes::announce::publish_due(&db).await.unwrap(), 0, "nur einmal melden");
    let (_, n) = call(&db, "GET", "/api/v1/notifications?unread=true", &kim, None).await;
    assert_eq!(n["unread"], 2);

    // Mitteilungen: alle gelesen, gelesene löschen
    let (_, r) = call(&db, "POST", "/api/v1/notifications/read", &kim, Some(json!({ "all": true }))).await;
    assert_eq!(r["changed"], 2);
    let (_, r) = call(&db, "DELETE", "/api/v1/notifications", &kim, None).await;
    assert_eq!(r["deleted"], 2);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn prefs_tokens_and_events(db: PgPool) {
    let (_admin, jana, _tom, _kim) = setup(&db).await;
    let (s, _) = call(
        &db,
        "PUT",
        "/api/v1/notifications/prefs",
        &jana,
        Some(json!({ "muted": ["quatsch"], "sound": true, "dnd_until": null })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = call(
        &db,
        "PUT",
        "/api/v1/notifications/prefs",
        &jana,
        Some(json!({ "muted": ["mail", "order"], "sound": false, "dnd_until": null })),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, p) = call(&db, "GET", "/api/v1/notifications/prefs", &jana, None).await;
    assert_eq!(p["muted"], json!(["mail", "order"]));
    assert_eq!(p["sound"], false);

    // Test-Benachrichtigung landet in der Liste
    let (s, _) = call(&db, "POST", "/api/v1/notifications/test", &jana, None).await;
    assert_eq!(s, StatusCode::OK);
    let (_, n) = call(&db, "GET", "/api/v1/notifications", &jana, None).await;
    assert_eq!(n["items"][0]["kind"], "system");

    // Push-Schlüssel und Abo
    let (_, k) = call(&db, "GET", "/api/v1/push/key", &jana, None).await;
    assert_eq!(k["key"].as_str().unwrap().len(), 87, "65 Byte unkomprimiert, base64url");
    let (_, k2) = call(&db, "GET", "/api/v1/push/key", &jana, None).await;
    assert_eq!(k, k2, "Schlüssel bleibt gleich");
    let sub =
        json!({ "endpoint": "https://push.example/abc", "keys": { "p256dh": "x", "auth": "y" }, "label": "Handy" });
    assert_eq!(call(&db, "POST", "/api/v1/push/subscribe", &jana, Some(sub)).await.0, StatusCode::NO_CONTENT);
    let bad = json!({ "endpoint": "http://unsicher/abc", "keys": { "p256dh": "x", "auth": "y" } });
    assert_eq!(call(&db, "POST", "/api/v1/push/subscribe", &jana, Some(bad)).await.0, StatusCode::BAD_REQUEST);
    let (_, d) = call(&db, "GET", "/api/v1/push/devices", &jana, None).await;
    assert_eq!(d[0]["host"], "push.example");
    assert_eq!(d[0]["label"], "Handy");

    // persönlicher Schlüssel für VS Code: Ereignis-Stream, nach Widerruf gesperrt
    let (s, t) = call(&db, "POST", "/api/v1/account/tokens", &jana, Some(json!({ "name": "VS Code" }))).await;
    assert_eq!(s, StatusCode::CREATED, "{t}");
    let key = t["token"].as_str().unwrap().to_owned();
    assert!(key.starts_with("cc_u_"));
    let (_, list) = call(&db, "GET", "/api/v1/account/tokens", &jana, None).await;
    assert!(list.as_array().unwrap().iter().any(|x| x["name"] == "key:VS Code"));
    assert!(list.as_array().unwrap().iter().any(|x| x["current"] == true));
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
    assert!(res.headers()["content-type"].to_str().unwrap().starts_with("text/event-stream"));
    let mut body = res.into_body();
    let first = body.frame().await.unwrap().unwrap().into_data().unwrap();
    let first = String::from_utf8_lossy(&first);
    assert!(first.contains("\"type\":\"hello\"") && first.contains("\"name\":\"Jana\""), "{first}");
    drop(body);
    let (s, _) =
        call(&db, "DELETE", &format!("/api/v1/account/tokens/{}", t["id"].as_str().unwrap()), &jana, None).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let res = app(AppState { db: db.clone() })
        .oneshot(Request::get(format!("/api/v1/events?token={key}")).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn deactivate_hands_over_and_locks_out(db: PgPool) {
    let (admin, jana, tom, _kim) = setup(&db).await;
    let (jana_id, tom_id, admin_id) = (
        uid(&db, "jana@code-craft.tech").await,
        uid(&db, "tom@code-craft.tech").await,
        uid(&db, "ak@code-craft.tech").await,
    );
    // Ticket für Tom, Kalendertermin von Tom, Tom vertritt Jana
    let (s, t) = call(
        &db,
        "POST",
        "/api/v1/tickets",
        &jana,
        Some(json!({ "subject": "Kasse startet nicht", "body": "Seit heute früh." })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{t}");
    let ticket: Uuid = t["id"].as_str().unwrap().parse().unwrap();
    sqlx::query("UPDATE tickets SET assignee_id = $2 WHERE id = $1")
        .bind(ticket)
        .bind(tom_id)
        .execute(&db)
        .await
        .unwrap();
    let start = chrono::Utc::now() + chrono::Duration::days(3);
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/calendar",
        &tom,
        Some(json!({ "title": "Kundentermin", "starts_at": start, "ends_at": start + chrono::Duration::hours(1) })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED);

    // Übersicht vor dem Sperren
    let (_, h) = call(&db, "GET", &format!("/api/v1/users/{tom_id}/handover"), &admin, None).await;
    assert_eq!(h["tickets"], 1);
    assert_eq!(h["events"], 1);
    assert_eq!(h["mailbox"], "tom@code-craft.tech");
    assert_eq!(
        call(&db, "GET", &format!("/api/v1/users/{tom_id}/handover"), &jana, None).await.0,
        StatusCode::FORBIDDEN
    );

    // Schutz: nicht sich selbst, nicht der letzte Admin, nur an aktive Mitarbeiter
    assert_eq!(
        call(&db, "POST", &format!("/api/v1/users/{admin_id}/deactivate"), &admin, Some(json!({}))).await.0,
        StatusCode::CONFLICT
    );
    let kim_id = uid(&db, "kim@kunde.de").await;
    let (s, _) = call(
        &db,
        "POST",
        &format!("/api/v1/users/{tom_id}/deactivate"),
        &admin,
        Some(json!({ "handover_to": kim_id })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    let (s, r) = call(
        &db,
        "POST",
        &format!("/api/v1/users/{tom_id}/deactivate"),
        &admin,
        Some(json!({ "reason": "Austritt 31.10.", "handover_to": jana_id, "forward_mail": true })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{r}");
    assert_eq!(r["tickets"], 1);
    assert_eq!(r["events"], 1);
    assert_eq!(r["forward_mail"], "jana@code-craft.tech");
    assert!(r["sessions"].as_u64().unwrap() >= 1);

    // sofort ausgesperrt, Anmeldung scheitert
    assert_eq!(call(&db, "GET", "/api/v1/me", &tom, None).await.0, StatusCode::UNAUTHORIZED);
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/auth/login",
        "",
        Some(json!({ "email": "tom@code-craft.tech", "password": "start-passwort-1" })),
    )
    .await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    // Übergabe angekommen
    let assignee: Option<Uuid> =
        sqlx::query_scalar("SELECT assignee_id FROM tickets WHERE id = $1").bind(ticket).fetch_one(&db).await.unwrap();
    assert_eq!(assignee, Some(jana_id));
    let rule: (String, bool) = sqlx::query_as(
        "SELECT r.forward_to, r.is_active FROM mail_rules r JOIN mailboxes m ON m.id = r.mailbox_id WHERE m.address = 'tom@code-craft.tech'",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(rule, ("jana@code-craft.tech".into(), true));
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    let (_, n) = call(&db, "GET", "/api/v1/notifications?kind=user", &jana, None).await;
    assert_eq!(n["items"][0]["event"], "deactivated");
    assert_eq!(n["items"][0]["title"], "Tom");
    // nicht mehr in Kontaktlisten
    let (_, c) = call(&db, "GET", "/api/v1/chat/contacts", &jana, None).await;
    assert!(!c.as_array().unwrap().iter().any(|x| x["display_name"] == "Tom"));
    // Liste zeigt Status und Grund
    let (_, us) = call(&db, "GET", "/api/v1/users", &admin, None).await;
    let t = us.as_array().unwrap().iter().find(|u| u["id"] == tom_id.to_string()).unwrap().clone();
    assert_eq!(t["is_active"], false);
    assert_eq!(t["deactivated_reason"], "Austritt 31.10.");

    // wieder freischalten → Einmal-Passwort, Weiterleitung aus
    let (s, r) = call(&db, "POST", &format!("/api/v1/users/{tom_id}/reactivate"), &admin, None).await;
    assert_eq!(s, StatusCode::OK);
    let pw = r["password"].as_str().unwrap().to_owned();
    let (s, _) =
        call(&db, "POST", "/api/v1/auth/login", "", Some(json!({ "email": "tom@code-craft.tech", "password": pw })))
            .await;
    assert_eq!(s, StatusCode::OK);
    let active: bool = sqlx::query_scalar("SELECT bool_or(r.is_active) FROM mail_rules r JOIN mailboxes m ON m.id = r.mailbox_id WHERE m.address = 'tom@code-craft.tech'")
        .fetch_one(&db)
        .await
        .unwrap();
    assert!(!active);

    // entfernen: Adresse wird frei, Konto kann nicht reaktiviert werden
    let (s, r) =
        call(&db, "POST", &format!("/api/v1/users/{tom_id}/deactivate"), &admin, Some(json!({ "remove": true }))).await;
    assert_eq!(s, StatusCode::OK, "{r}");
    assert_eq!(
        call(&db, "POST", &format!("/api/v1/users/{tom_id}/reactivate"), &admin, None).await.0,
        StatusCode::CONFLICT
    );
    let (s, v) = call(
        &db,
        "POST",
        "/api/v1/users",
        &admin,
        Some(json!({ "email": "tom@code-craft.tech", "display_name": "Tom Neu", "role": "staff", "password": "start-passwort-1", "departments": ["SUP"] })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn mail_bulk_and_empty_trash(db: PgPool) {
    let (_admin, jana, tom, _kim) = setup(&db).await;
    for i in 0..3 {
        let (s, v) = call(
            &db,
            "POST",
            "/api/v1/mail/send",
            &jana,
            Some(json!({ "to": ["tom@code-craft.tech"], "subject": format!("Nachricht {i}"), "text": "Hallo" })),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{v}");
    }
    let (_, l) = call(&db, "GET", "/api/v1/mail/messages?folder=inbox", &tom, None).await;
    let ids: Vec<Value> = l.as_array().unwrap().iter().map(|m| m["id"].clone()).collect();
    assert_eq!(ids.len(), 3);

    let (_, r) = call(&db, "POST", "/api/v1/mail/bulk", &tom, Some(json!({ "ids": ids, "action": "read" }))).await;
    assert_eq!(r["changed"], 3);
    let (_, o) = call(&db, "GET", "/api/v1/mail", &tom, None).await;
    assert_eq!(o["folders"][0]["unread"], 0);
    let (_, r) = call(
        &db,
        "POST",
        "/api/v1/mail/bulk",
        &tom,
        Some(json!({ "ids": [ids[0]], "action": "move", "folder": "archive" })),
    )
    .await;
    assert_eq!(r["changed"], 1);
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/mail/bulk",
        &tom,
        Some(json!({ "ids": [ids[0]], "action": "move", "folder": "nirgendwo" })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    // fremde Nachrichten sind tabu
    let (_, r) = call(&db, "POST", "/api/v1/mail/bulk", &jana, Some(json!({ "ids": ids, "action": "delete" }))).await;
    assert_eq!(r["changed"], 0);
    let (_, r) = call(&db, "POST", "/api/v1/mail/bulk", &tom, Some(json!({ "ids": ids, "action": "delete" }))).await;
    assert_eq!(r["changed"], 3);
    let (_, l) = call(&db, "GET", "/api/v1/mail/messages?folder=trash", &tom, None).await;
    assert_eq!(l.as_array().unwrap().len(), 3);
    let (s, _) = call(&db, "POST", "/api/v1/mail/folders/inbox/empty", &tom, None).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (_, r) = call(&db, "POST", "/api/v1/mail/folders/trash/empty", &tom, None).await;
    assert_eq!(r["deleted"], 3);
    let (_, l) = call(&db, "GET", "/api/v1/mail/messages?folder=trash", &tom, None).await;
    assert!(l.as_array().unwrap().is_empty());
}
