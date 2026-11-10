//! Paket-Schlüssel (Admin erzeugt, Kasse löst ein) und Fehlerbericht → Ticket.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codecraft_server::{app, auth, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn admin(db: &PgPool) -> String {
    let id = Uuid::now_v7();
    let token = auth::new_token("cc_u_");
    sqlx::query("INSERT INTO users (id, email, display_name, role) VALUES ($1, $2, 'A', 'admin')")
        .bind(id)
        .bind(format!("{id}@test"))
        .execute(db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO api_tokens (id, token_hash, user_id, name) VALUES ($1, $2, $3, 't')")
        .bind(Uuid::now_v7())
        .bind(auth::hash_token(&token))
        .bind(id)
        .execute(db)
        .await
        .unwrap();
    token
}

async fn call(db: &PgPool, method: &str, uri: &str, token: Option<&str>, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri).header("x-forwarded-for", "10.9.8.7");
    if let Some(t) = token {
        req = req.header("authorization", format!("Bearer {t}"));
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

#[sqlx::test(migrations = "./migrations")]
async fn keys_and_reports(db: PgPool) {
    std::env::set_var("KMPOS_LICENSE_PRIVKEY", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, [7u8; 32]));
    let a = admin(&db).await;
    let (s, keys) = call(&db, "POST", "/api/v1/pos/admin/keys", Some(&a), Some(json!({"kind": "license", "plan": "pro", "days": 365, "count": 3}))).await;
    assert_eq!(s, StatusCode::CREATED, "{keys}");
    assert_eq!(keys.as_array().unwrap().len(), 3);
    let code = keys[0]["code"].as_str().unwrap().to_string();
    assert!(code.starts_with("KMK-"));
    // Kunde darf keine Schlüssel erzeugen / sehen
    assert_eq!(call(&db, "GET", "/api/v1/pos/admin/keys", None, None).await.0, StatusCode::UNAUTHORIZED);

    // Kasse ohne Portal löst ein (Eingabe klein und ohne Bindestriche)
    let input = code.to_lowercase().replace('-', " ");
    let (s, r) = call(&db, "POST", "/api/v1/pos/redeem", None, Some(json!({"code": input, "tenant_id": "tenant-abc-123", "business_name": "مقهى الشام"}))).await;
    assert_eq!(s, StatusCode::OK, "{r}");
    assert!(r["key"].as_str().unwrap().starts_with("KMPOS1."));
    assert_eq!(r["plan"], "pro");
    assert!(r["public_url"].as_str().unwrap().ends_with(".poskm.code-craft.tech"));
    // zweimal geht nicht
    let (s, _) = call(&db, "POST", "/api/v1/pos/redeem", None, Some(json!({"code": code, "tenant_id": "tenant-abc-123", "business_name": "Laden X"}))).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let (_, list) = call(&db, "GET", "/api/v1/pos/admin/keys?status=redeemed", Some(&a), None).await;
    assert_eq!(list[0]["business_name"], "مقهى الشام");

    // zweiter Schlüssel: gleiche Firma, Laufzeit wird angerechnet
    let code2 = keys[1]["code"].as_str().unwrap();
    let (s, r2) = call(&db, "POST", "/api/v1/pos/redeem", None, Some(json!({"code": code2, "tenant_id": "tenant-abc-123", "business_name": "مقهى الشام"}))).await;
    assert_eq!(s, StatusCode::OK, "{r2}");
    let orgs: i64 = sqlx::query_scalar("SELECT COUNT(DISTINCT organization_id) FROM pos_keys WHERE status = 'redeemed'").fetch_one(&db).await.unwrap();
    assert_eq!(orgs, 1);
    let active: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pos_licenses WHERE tenant_id = 'tenant-abc-123' AND status = 'active'").fetch_one(&db).await.unwrap();
    assert_eq!(active, 1);
    assert!(r2["expires_at"].as_str().unwrap() > r["expires_at"].as_str().unwrap());

    // gesperrter Schlüssel
    let id3 = keys[2]["id"].as_str().unwrap();
    assert_eq!(call(&db, "POST", &format!("/api/v1/pos/admin/keys/{id3}/revoke"), Some(&a), None).await.0, StatusCode::NO_CONTENT);
    let (s, _) = call(&db, "POST", "/api/v1/pos/redeem", None, Some(json!({"code": keys[2]["code"], "tenant_id": "tenant-abc-123", "business_name": "Laden X"}))).await;
    assert_eq!(s, StatusCode::CONFLICT);

    // KI-Einheiten
    let (_, ai) = call(&db, "POST", "/api/v1/pos/admin/keys", Some(&a), Some(json!({"kind": "ai", "units": 500}))).await;
    let (s, r) = call(&db, "POST", "/api/v1/pos/redeem", None, Some(json!({"code": ai[0]["code"], "tenant_id": "tenant-abc-123", "business_name": "مقهى الشام"}))).await;
    assert_eq!(s, StatusCode::OK, "{r}");
    assert!(r["ai_code"].as_str().unwrap().starts_with("KMAI1."));

    // Fehlerbericht ohne Portal-Verbindung → Ticket der erkannten Firma
    let (s, t) = call(&db, "POST", "/api/v1/pos/report", None, Some(json!({
        "tenant_id": "tenant-abc-123", "business_name": "مقهى الشام", "message": "Drucker druckt nicht\nseit heute", "urgency": "high",
        "app_version": "1.4.0", "platform": "android", "diagnostics": {"logs": ["WARN printer timeout"], "sync": {"online": true}}
    }))).await;
    assert_eq!(s, StatusCode::CREATED, "{t}");
    let (subject, source, org, urgency): (String, String, Option<Uuid>, String) =
        sqlx::query_as("SELECT subject, source, organization_id, urgency FROM tickets WHERE number = $1").bind(t["number"].as_str().unwrap()).fetch_one(&db).await.unwrap();
    assert!(subject.contains("مقهى الشام") && subject.contains("Drucker druckt nicht"), "{subject}");
    assert_eq!(source, "pos");
    assert!(org.is_some());
    assert_eq!(urgency, "high");
    let msgs: Vec<(String, bool)> = sqlx::query_as("SELECT m.body, m.internal FROM ticket_messages m JOIN tickets t ON t.id = m.ticket_id WHERE t.number = $1 ORDER BY m.created_at")
        .bind(t["number"].as_str().unwrap()).fetch_all(&db).await.unwrap();
    assert_eq!(msgs.len(), 2);
    assert!(msgs[0].0.contains("Version: 1.4.0") && !msgs[0].1);
    assert!(msgs[1].0.contains("printer timeout") && msgs[1].1, "Protokoll nur intern");
    // Admin sieht das Ticket in der Liste
    let (_, list) = call(&db, "GET", "/api/v1/tickets", Some(&a), None).await;
    assert!(list.to_string().contains(t["number"].as_str().unwrap()), "{list}");
}
