//! Zeiterfassung, Urlaub mit Genehmigung/Vertretung, Kalender mit verbindlichen Terminen.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::{Datelike, Duration, NaiveDate, Utc, Weekday};
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

async fn user(db: &PgPool, admin: &str, email: &str, role: &str, depts: &[&str]) -> (String, String) {
    let (s, v) = call(
        db,
        "POST",
        "/api/v1/users",
        admin,
        Some(json!({
            "email": email, "display_name": email, "role": role, "password": "start-passwort-1", "departments": depts
        })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    (login(db, email, "start-passwort-1").await, v["id"].as_str().unwrap().to_owned())
}

/// nächster Montag in mindestens 7 Tagen
fn next_monday() -> NaiveDate {
    let mut d = Utc::now().date_naive() + Duration::days(7);
    while d.weekday() != Weekday::Mon {
        d += Duration::days(1);
    }
    d
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn time_leave_calendar(db: PgPool) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let admin = login(&db, "ak@code-craft.tech", "admin-passwort-1").await;
    let (lead, _lead_id) = user(&db, &admin, "leiter@code-craft.tech", "lead", &["DEV"]).await;
    let (jana, jana_id) = user(&db, &admin, "jana@code-craft.tech", "staff", &["DEV"]).await;
    let (tom, tom_id) = user(&db, &admin, "tom@code-craft.tech", "staff", &["DEV"]).await;
    let (sales, sales_id) = user(&db, &admin, "vertrieb@code-craft.tech", "staff", &["SAL"]).await;

    // ── Zeiterfassung ──
    let (s, _) = call(&db, "POST", "/api/v1/time/clock", &jana, Some(json!({ "action": "in" }))).await;
    assert_eq!(s, StatusCode::OK);
    let (s, _) = call(&db, "POST", "/api/v1/time/clock", &jana, Some(json!({ "action": "in" }))).await;
    assert_eq!(s, StatusCode::CONFLICT, "doppelt einstempeln");
    let (_, st) = call(&db, "GET", "/api/v1/time/status", &jana, None).await;
    assert!(!st["running"].is_null());
    let (s, _) =
        call(&db, "POST", "/api/v1/time/clock", &jana, Some(json!({ "action": "out", "break_minutes": 0 }))).await;
    assert_eq!(s, StatusCode::OK);
    // manueller Eintrag gestern 8–17 Uhr, 60 min Pause = 480 min
    let y = Utc::now() - Duration::days(1);
    let start = y.date_naive().and_hms_opt(8, 0, 0).unwrap().and_utc();
    let end = start + Duration::hours(9);
    let (s, e) = call(
        &db,
        "POST",
        "/api/v1/time",
        &jana,
        Some(json!({ "started_at": start, "ended_at": end, "break_minutes": 60, "note": "Kunde vor Ort" })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{e}");
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/time",
        &jana,
        Some(json!({ "started_at": start + Duration::hours(1), "ended_at": end, "break_minutes": 0 })),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT, "Überschneidung");
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/time",
        &jana,
        Some(json!({ "started_at": Utc::now() + Duration::hours(1), "ended_at": Utc::now() + Duration::hours(2) })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "Zukunft");
    let (_, list) = call(&db, "GET", "/api/v1/time", &jana, None).await;
    assert!(list["total_minutes"].as_i64().unwrap() >= 480);
    // Leiter sieht/korrigiert Zeiten seiner Abteilung, nicht anderer Abteilungen; Kollegen gar nicht
    let (s, l) = call(&db, "GET", &format!("/api/v1/time?user={jana_id}"), &lead, None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(l["entries"].as_array().unwrap().len(), 2);
    let (s, _) = call(&db, "GET", &format!("/api/v1/time?user={sales_id}"), &lead, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = call(&db, "GET", &format!("/api/v1/time?user={jana_id}"), &tom, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let eid = e["id"].as_str().unwrap();
    let (s, _) = call(
        &db,
        "PUT",
        &format!("/api/v1/time/{eid}"),
        &lead,
        Some(json!({ "started_at": start, "ended_at": end, "break_minutes": 30, "note": "korrigiert" })),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, l) = call(&db, "GET", &format!("/api/v1/time?user={jana_id}"), &jana, None).await;
    assert!(l["entries"].as_array().unwrap().iter().any(|x| x["edited"] == true && x["minutes"] == 510));

    // ── Urlaub ──
    let mon = next_monday();
    let fri = mon + Duration::days(4);
    let (s, r) = call(
        &db,
        "POST",
        "/api/v1/leave",
        &jana,
        Some(json!({ "start_date": mon, "end_date": fri + Duration::days(2), "substitute_id": tom_id })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{r}");
    assert_eq!(r["days"], 5.0, "Wochenende zählt nicht");
    let (s, _) = call(&db, "POST", "/api/v1/leave", &jana, Some(json!({ "start_date": fri, "end_date": fri }))).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/leave",
        &jana,
        Some(json!({ "start_date": mon + Duration::days(14), "end_date": mon + Duration::days(60) })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "mehr als Resturlaub");
    let (_, mine) = call(&db, "GET", "/api/v1/leave", &jana, None).await;
    assert_eq!(mine["balance"]["pending"], 5.0);
    let lid = r["id"].as_str().unwrap();
    // nur die eigene Leitung genehmigt
    let (s, _) = call(&db, "PATCH", &format!("/api/v1/leave/{lid}"), &tom, Some(json!({ "status": "approved" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/leave/{lid}"), &sales, Some(json!({ "status": "approved" }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (_, team) = call(&db, "GET", "/api/v1/leave?scope=team", &lead, None).await;
    assert!(team["items"].as_array().unwrap().iter().any(|x| x["id"] == lid));
    let (s, _) =
        call(&db, "PATCH", &format!("/api/v1/leave/{lid}"), &lead, Some(json!({ "status": "approved" }))).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, mine) = call(&db, "GET", "/api/v1/leave", &jana, None).await;
    assert_eq!(mine["balance"]["taken"], 5.0);
    assert_eq!(mine["items"][0]["substitute"], "tom@code-craft.tech");
    // Leiter trägt Krankmeldung direkt ein (genehmigt)
    let (s, k) = call(&db, "POST", "/api/v1/leave", &lead, Some(json!({ "user_id": tom_id, "kind": "sick", "start_date": Utc::now().date_naive(), "end_date": Utc::now().date_naive() }))).await;
    if Utc::now().weekday().number_from_monday() <= 5 {
        assert_eq!(s, StatusCode::CREATED, "{k}");
    }

    // ── Kalender ──
    let t0 = (mon - Duration::days(3)).and_hms_opt(9, 0, 0).unwrap().and_utc();
    // Mitarbeiter darf keinen verbindlichen Termin vorgeben
    let (s, _) = call(&db, "POST", "/api/v1/calendar", &jana, Some(json!({ "title": "Team", "starts_at": t0, "ends_at": t0 + Duration::hours(1), "attendees": [tom_id], "mandatory": true }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    // Leiter gibt verbindlichen Termin vor – nur für eigene Abteilung
    let (s, _) = call(&db, "POST", "/api/v1/calendar", &lead, Some(json!({ "title": "Sprint", "starts_at": t0, "ends_at": t0 + Duration::hours(1), "attendees": [sales_id], "mandatory": true }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, ev) = call(&db, "POST", "/api/v1/calendar", &lead, Some(json!({ "title": "Sprint-Planung", "starts_at": t0, "ends_at": t0 + Duration::hours(1), "attendees": [jana_id, tom_id], "mandatory": true }))).await;
    assert_eq!(s, StatusCode::CREATED, "{ev}");
    let evid = ev["id"].as_str().unwrap();
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/calendar/{evid}/respond"), &jana, Some(json!({ "response": "declined" })))
            .await;
    assert_eq!(s, StatusCode::CONFLICT, "verbindlich");
    // freiwillige Einladung: zusagen/absagen
    let (_, ev2) = call(&db, "POST", "/api/v1/calendar", &jana, Some(json!({ "title": "Kaffee", "starts_at": t0, "ends_at": t0 + Duration::minutes(30), "attendees": [sales_id] }))).await;
    let (s, _) = call(
        &db,
        "POST",
        &format!("/api/v1/calendar/{}/respond", ev2["id"].as_str().unwrap()),
        &sales,
        Some(json!({ "response": "declined" })),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let range = format!(
        "from={}&to={}",
        (t0 - Duration::days(1)).to_rfc3339().replace('+', "%2B"),
        (fri + Duration::days(3)).and_hms_opt(0, 0, 0).unwrap().and_utc().to_rfc3339().replace('+', "%2B")
    );
    let (s, cal) = call(&db, "GET", &format!("/api/v1/calendar?{range}"), &jana, None).await;
    assert_eq!(s, StatusCode::OK, "{cal}");
    assert_eq!(cal["events"].as_array().unwrap().len(), 2);
    assert_eq!(cal["leaves"].as_array().unwrap().len(), 1, "eigener Urlaub im Kalender");
    let (_, cal) = call(&db, "GET", &format!("/api/v1/calendar?{range}&team=true"), &lead, None).await;
    assert!(cal["leaves"].as_array().unwrap().iter().any(|l| l["user_name"] == "jana@code-craft.tech"));
    let (s, _) = call(&db, "GET", &format!("/api/v1/calendar?{range}&user={jana_id}"), &tom, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    // nur Ersteller/Admin ändern oder löschen
    let (s, _) = call(&db, "DELETE", &format!("/api/v1/calendar/{evid}"), &jana, None).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = call(&db, "DELETE", &format!("/api/v1/calendar/{evid}"), &lead, None).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    // Kunden haben keinen Zugriff
    let (s, _) = call(&db, "GET", "/api/v1/people", "", None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}
