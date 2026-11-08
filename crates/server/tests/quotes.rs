//! Angebote: erstellen, ändern, senden, Annahme durch den Kunden → Projekt, Rechnungen daraus.

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

fn quote(org: &str, payments: Value) -> Value {
    json!({
        "organization_id": org, "title": "Kassensystem für 3 Filialen", "description": "Umsetzung laut Workshop",
        "currency": "EUR", "tax_mode": "standard", "advance_percent": 30, "valid_until": "2099-12-31",
        "project_start": "2027-01-04", "project_end": "2027-03-31", "hourly_rate_cents": 9000,
        "items": [
            { "block_nr": 1, "block_title": "Konzept", "position_nr": "1.1", "description": "Workshop & Anforderungen", "quantity_milli": 8000, "unit": "Std.", "unit_price_cents": 9000 },
            { "block_nr": 2, "block_title": "Umsetzung", "position_nr": "2.1", "description": "Kassen-App", "quantity_milli": 40000, "unit": "Std.", "unit_price_cents": 9000 },
            { "block_nr": 2, "block_title": "Umsetzung", "position_nr": "2.2", "description": "Hardware-Paket", "quantity_milli": 3000, "unit": "Stk.", "unit_price_cents": 120000 }
        ],
        "milestones": [
            { "label": "M1", "title": "Konzept abgenommen", "goal": "Pflichtenheft" },
            { "label": "M2", "title": "Pilotfiliale live" },
            { "label": "M3", "title": "Alle Filialen live" }
        ],
        "payments": payments
    })
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn quote_lifecycle(db: PgPool) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(&db)
        .await
        .unwrap();
    let admin = login(&db, "ak@code-craft.tech", "admin-passwort-1").await;
    let (_, o) = call(
        &db,
        "POST",
        "/api/v1/organizations",
        &admin,
        Some(json!({ "name": "Bäckerei Sonne", "address": "Hauptstr. 1\n63755 Alzenau" })),
    )
    .await;
    let org = o["id"].as_str().unwrap().to_owned();
    call(&db, "POST", "/api/v1/users", &admin, Some(json!({ "email": "k@sonne.de", "display_name": "K", "role": "customer", "password": "start-passwort-1", "organization_id": org }))).await;
    let kunde = login(&db, "k@sonne.de", "start-passwort-1").await;
    // Anfrage des Kunden, zu der das Angebot gehört
    let (_, req) = call(
        &db,
        "POST",
        "/api/v1/dev-requests",
        &kunde,
        Some(json!({ "title": "Neues Kassensystem", "description": "3 Filialen" })),
    )
    .await;

    // netto: 8×90 + 40×90 + 3×1200 = 720 + 3600 + 3600 = 7920 € → brutto 9424,80 €
    let (s, v) = call(
        &db,
        "POST",
        "/api/v1/quotes",
        &admin,
        Some(quote(&org, json!([{ "label": "Anzahlung", "amount_cents": 100 }]))),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "Zahlungsplan ≠ Summe: {v}");
    let mut body = quote(
        &org,
        json!([
            { "label": "Anzahlung 30 %", "amount_cents": 282744 },
            { "label": "Nach Pilot", "amount_cents": 376992 },
            { "label": "Abnahme", "amount_cents": 282744 }
        ]),
    );
    body["request_id"] = req["id"].clone();
    let (s, q) = call(&db, "POST", "/api/v1/quotes", &admin, Some(body.clone())).await;
    assert_eq!(s, StatusCode::CREATED, "{q}");
    assert_eq!(q["gross_cents"], 942480);
    assert!(q["number"].as_str().unwrap().starts_with("KV-"));
    let qid = q["id"].as_str().unwrap().to_owned();
    // Kunde: Entwurf unsichtbar, keine eigenen Angebote
    let (s, _) = call(&db, "GET", &format!("/api/v1/quotes/{qid}"), &kunde, None).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) = call(&db, "POST", "/api/v1/quotes", &kunde, Some(body.clone())).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    // Entwurf ändern
    body["title"] = json!("Kassensystem für 3 Filialen (Rev. 2)");
    let (s, _) = call(&db, "PUT", &format!("/api/v1/quotes/{qid}"), &admin, Some(body.clone())).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, d) = call(&db, "GET", &format!("/api/v1/quotes/{qid}"), &admin, None).await;
    assert_eq!(d["items"].as_array().unwrap().len(), 3);
    assert_eq!(d["total_hours_milli"], 48000);
    assert_eq!(d["tax_cents"], 150480);

    // senden → Kunde sieht es, Anfrage „Angebot liegt vor“, Druckdaten eingefroren, nicht mehr änderbar
    let (s, _) = call(&db, "POST", &format!("/api/v1/quotes/{qid}/send"), &admin, None).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = call(&db, "PUT", &format!("/api/v1/quotes/{qid}"), &admin, Some(body.clone())).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let (s, _) = call(&db, "DELETE", &format!("/api/v1/quotes/{qid}"), &admin, None).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let snap: Value = sqlx::query_scalar("SELECT pdf_snapshot FROM quotes WHERE id = $1")
        .bind(Uuid::parse_str(&qid).unwrap())
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(snap["total"], 9424.8);
    assert_eq!(snap["milestones"].as_array().unwrap().len(), 3);
    let (s, d) = call(&db, "GET", &format!("/api/v1/quotes/{qid}"), &kunde, None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(d["status"], "sent");
    let (_, r) = call(&db, "GET", &format!("/api/v1/dev-requests/{}", req["id"].as_str().unwrap()), &kunde, None).await;
    assert_eq!(r["status"], "quoted");
    assert_eq!(r["quote_id"], json!(qid));

    // Rechnung erst nach Annahme; Mitarbeiter können nicht „annehmen“
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/quotes/{qid}/invoice"), &admin, Some(json!({ "mode": "advance" }))).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/quotes/{qid}/respond"), &admin, Some(json!({ "accept": true }))).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    // Kunde nimmt an → Projekt mit Meilensteinen, Anfrage in Umsetzung
    let (s, a) = call(
        &db,
        "POST",
        &format!("/api/v1/quotes/{qid}/respond"),
        &kunde,
        Some(json!({ "accept": true, "comment": "Passt so" })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{a}");
    let pid = a["project_id"].as_str().unwrap().to_owned();
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/quotes/{qid}/respond"), &kunde, Some(json!({ "accept": false }))).await;
    assert_eq!(s, StatusCode::CONFLICT, "nur einmal");
    let (_, p) = call(&db, "GET", &format!("/api/v1/projects/{pid}"), &kunde, None).await;
    assert_eq!(p["milestones"].as_array().unwrap().len(), 3);
    assert_eq!(p["status"], "active");
    let (_, r) = call(&db, "GET", &format!("/api/v1/dev-requests/{}", req["id"].as_str().unwrap()), &kunde, None).await;
    assert_eq!(r["status"], "in_progress");
    assert_eq!(r["project_id"], json!(pid));

    // Rechnungen: Anzahlung 30 % (netto 2376 €), Rate 2 (brutto 3769,92 → netto 3168), komplett (netto 7920)
    for (mode, extra, net) in
        [("advance", json!(null), 237600), ("payment", json!(2), 316800), ("full", json!(null), 792000)]
    {
        let (s, inv) = call(
            &db,
            "POST",
            &format!("/api/v1/quotes/{qid}/invoice"),
            &admin,
            Some(json!({ "mode": mode, "payment": extra })),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{mode}: {inv}");
        let (_, d) =
            call(&db, "GET", &format!("/api/v1/invoices/{}", inv["invoice_id"].as_str().unwrap()), &admin, None).await;
        assert_eq!(d["totals"]["net"], net, "{mode}: {d}");
        assert_eq!(d["project_id"], json!(pid), "Rechnung hängt am Projekt");
    }

    // Kopie als neue Revision (Entwurf), dann löschen
    let (s, c) = call(&db, "POST", &format!("/api/v1/quotes/{qid}/duplicate"), &admin, None).await;
    assert_eq!(s, StatusCode::CREATED, "{c}");
    assert_ne!(c["number"], q["number"]);
    let (_, d) = call(&db, "GET", &format!("/api/v1/quotes/{}", c["id"].as_str().unwrap()), &admin, None).await;
    assert_eq!(d["status"], "draft");
    assert_eq!(d["payments"].as_array().unwrap().len(), 3);
    let (s, _) = call(&db, "DELETE", &format!("/api/v1/quotes/{}", c["id"].as_str().unwrap()), &admin, None).await;
    assert_eq!(s, StatusCode::NO_CONTENT);

    // Ablehnen und Ablauf
    let (_, q2) = call(&db, "POST", &format!("/api/v1/quotes/{qid}/duplicate"), &admin, None).await;
    let q2 = q2["id"].as_str().unwrap().to_owned();
    sqlx::query("UPDATE quotes SET valid_until = CURRENT_DATE - 1 WHERE id = $1")
        .bind(Uuid::parse_str(&q2).unwrap())
        .execute(&db)
        .await
        .unwrap();
    call(&db, "POST", &format!("/api/v1/quotes/{q2}/send"), &admin, None).await;
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/quotes/{q2}/respond"), &kunde, Some(json!({ "accept": true }))).await;
    assert_eq!(s, StatusCode::CONFLICT, "abgelaufen");
    let (_, d) = call(&db, "GET", &format!("/api/v1/quotes/{q2}"), &admin, None).await;
    assert_eq!(d["status"], "expired");
}
