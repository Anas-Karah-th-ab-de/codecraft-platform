//! Integrationstests gegen echte PostgreSQL-DB.
//! Benötigt DATABASE_URL (Superuser-Rechte, sqlx legt je Test eine eigene DB an).

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codecraft_server::{app, auth, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

async fn user(db: &PgPool, role: &str, org: Option<Uuid>) -> String {
    let id = Uuid::now_v7();
    let token = auth::new_token("cc_u_");
    sqlx::query("INSERT INTO users (id, email, display_name, role, organization_id) VALUES ($1, $2, 'T', $3, $4)")
        .bind(id)
        .bind(format!("{id}@test"))
        .bind(role)
        .bind(org)
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

async fn call(db: &PgPool, method: &str, uri: &str, token: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri).header("authorization", format!("Bearer {token}"));
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

async fn org(db: &PgPool, admin: &str, vat: Option<&str>) -> Uuid {
    let body = json!({ "name": "Firma GmbH", "address": "Hauptstr. 1, 10115 Berlin", "vat_id": vat });
    let (s, v) = call(db, "POST", "/api/v1/organizations", admin, Some(body)).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    v["id"].as_str().unwrap().parse().unwrap()
}

fn items() -> Value {
    json!([
        { "description": "Entwicklung", "quantity_milli": 10000, "unit": "hour", "unit_price": 8500, "vat_rate_bp": 1900 },
        { "description": "Hosting", "quantity_milli": 1000, "unit": "month", "unit_price": 2000, "vat_rate_bp": 1900 }
    ])
}

fn draft(org: Uuid) -> Value {
    json!({ "organization_id": org, "items": items() })
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn invoice_lifecycle(db: PgPool) {
    let admin = user(&db, "admin", None).await;
    let org_id = org(&db, &admin, None).await;

    let (s, v) = call(&db, "POST", "/api/v1/invoices", &admin, Some(draft(org_id))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let id = v["id"].as_str().unwrap().to_owned();
    assert_eq!(v["status"], "draft");
    assert_eq!(v["totals"]["net"], 87000);
    assert_eq!(v["totals"]["tax"], 16530);
    assert_eq!(v["totals"]["gross"], 103530);

    let (s, v) = call(&db, "POST", &format!("/api/v1/invoices/{id}/issue"), &admin, None).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert!(v["number"].as_str().unwrap().starts_with("RE-"));
    assert!(v["number"].as_str().unwrap().ends_with("-00001"));
    assert_eq!(v["gross_cents"], 103530);
    assert_eq!(v["recipient_name"], "Firma GmbH");

    // festgeschrieben: Positionen nicht mehr änderbar, nicht löschbar
    let (s, _) =
        call(&db, "PUT", &format!("/api/v1/invoices/{id}/items"), &admin, Some(json!({ "items": items() }))).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let (s, _) = call(&db, "DELETE", &format!("/api/v1/invoices/{id}"), &admin, None).await;
    assert_eq!(s, StatusCode::CONFLICT);

    // Storno → Gutschrift mit negativen Beträgen, Original storniert
    let (s, cn) = call(&db, "POST", &format!("/api/v1/invoices/{id}/cancel"), &admin, None).await;
    assert_eq!(s, StatusCode::CREATED, "{cn}");
    assert_eq!(cn["kind"], "credit_note");
    assert!(cn["number"].as_str().unwrap().starts_with("GS-"));
    assert_eq!(cn["gross_cents"], -103530);
    let (_, orig) = call(&db, "GET", &format!("/api/v1/invoices/{id}"), &admin, None).await;
    assert_eq!(orig["status"], "cancelled");

    // zweites Storno nicht möglich
    let (s, _) = call(&db, "POST", &format!("/api/v1/invoices/{id}/cancel"), &admin, None).await;
    assert_eq!(s, StatusCode::CONFLICT);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn draft_can_be_edited_and_deleted(db: PgPool) {
    let admin = user(&db, "admin", None).await;
    let org_id = org(&db, &admin, None).await;
    let (_, v) = call(&db, "POST", "/api/v1/invoices", &admin, Some(draft(org_id))).await;
    let id = v["id"].as_str().unwrap().to_owned();
    let one = json!({ "items": [{ "description": "Pauschale", "quantity_milli": 1000, "unit": "flat", "unit_price": 10000, "vat_rate_bp": 700 }] });
    let (s, v) = call(&db, "PUT", &format!("/api/v1/invoices/{id}/items"), &admin, Some(one)).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert_eq!(v["totals"]["gross"], 10700);
    let (s, _) = call(&db, "DELETE", &format!("/api/v1/invoices/{id}"), &admin, None).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    assert_eq!(call(&db, "GET", &format!("/api/v1/invoices/{id}"), &admin, None).await.0, StatusCode::NOT_FOUND);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn db_trigger_blocks_tampering(db: PgPool) {
    let admin = user(&db, "admin", None).await;
    let org_id = org(&db, &admin, None).await;
    let (_, v) = call(&db, "POST", "/api/v1/invoices", &admin, Some(draft(org_id))).await;
    let id: Uuid = v["id"].as_str().unwrap().parse().unwrap();
    call(&db, "POST", &format!("/api/v1/invoices/{id}/issue"), &admin, None).await;

    // Direkter SQL-Zugriff am API vorbei wird von der DB abgelehnt
    let q = |sql: &'static str| sqlx::query(sql).bind(id);
    assert!(q("UPDATE invoices SET gross_cents = 1 WHERE id = $1").execute(&db).await.is_err());
    assert!(q("UPDATE invoice_items SET unit_price_cents = 1 WHERE invoice_id = $1").execute(&db).await.is_err());
    assert!(q("DELETE FROM invoice_items WHERE invoice_id = $1").execute(&db).await.is_err());
    assert!(q("DELETE FROM invoices WHERE id = $1").execute(&db).await.is_err());
    assert!(sqlx::query("DELETE FROM audit_log").execute(&db).await.is_err());
    // Status-/Zahlungsfelder bleiben änderbar
    assert!(q("UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1").execute(&db).await.is_ok());
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn numbers_are_gapless_under_concurrency(db: PgPool) {
    let admin = user(&db, "admin", None).await;
    let org_id = org(&db, &admin, None).await;
    let mut ids = vec![];
    for _ in 0..10 {
        let (_, v) = call(&db, "POST", "/api/v1/invoices", &admin, Some(draft(org_id))).await;
        ids.push(v["id"].as_str().unwrap().to_owned());
    }
    let tasks: Vec<_> = ids
        .iter()
        .map(|id| {
            let (db, admin, id) = (db.clone(), admin.clone(), id.clone());
            tokio::spawn(async move { call(&db, "POST", &format!("/api/v1/invoices/{id}/issue"), &admin, None).await })
        })
        .collect();
    let mut seqs: Vec<i64> = vec![];
    for t in tasks {
        let (s, v) = t.await.unwrap();
        assert_eq!(s, StatusCode::OK, "{v}");
        seqs.push(v["number"].as_str().unwrap().rsplit('-').next().unwrap().parse().unwrap());
    }
    seqs.sort();
    assert_eq!(seqs, (1..=10).collect::<Vec<_>>());
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn reverse_charge_requires_vat_id(db: PgPool) {
    let admin = user(&db, "admin", None).await;
    let org_id = org(&db, &admin, None).await;
    let body = json!({ "organization_id": org_id, "tax_mode": "reverse_charge", "items": items() });
    let (_, v) = call(&db, "POST", "/api/v1/invoices", &admin, Some(body)).await;
    let id = v["id"].as_str().unwrap();
    assert_eq!(v["totals"]["tax"], 0);
    let (s, v) = call(&db, "POST", &format!("/api/v1/invoices/{id}/issue"), &admin, None).await;
    assert_eq!(s, StatusCode::UNPROCESSABLE_ENTITY, "{v}");

    let org_rc = org(&db, &admin, Some("ATU12345678")).await;
    let body = json!({ "organization_id": org_rc, "tax_mode": "reverse_charge", "locale": "ar", "items": items() });
    let (_, v) = call(&db, "POST", "/api/v1/invoices", &admin, Some(body)).await;
    let id = v["id"].as_str().unwrap();
    let (s, v) = call(&db, "POST", &format!("/api/v1/invoices/{id}/issue"), &admin, None).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert!(v["tax_notice"].as_str().unwrap().contains("الاحتساب العكسي"));
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn permissions(db: PgPool) {
    let admin = user(&db, "admin", None).await;
    let staff = user(&db, "staff", None).await;
    let org_a = org(&db, &admin, None).await;
    let org_b = org(&db, &admin, None).await;
    let cust_a = user(&db, "customer", Some(org_a)).await;

    let (_, a_draft) = call(&db, "POST", "/api/v1/invoices", &admin, Some(draft(org_a))).await;
    let (_, a_issued) = call(&db, "POST", "/api/v1/invoices", &admin, Some(draft(org_a))).await;
    let (_, b_issued) = call(&db, "POST", "/api/v1/invoices", &admin, Some(draft(org_b))).await;
    for v in [&a_issued, &b_issued] {
        call(&db, "POST", &format!("/api/v1/invoices/{}/issue", v["id"].as_str().unwrap()), &admin, None).await;
    }

    // Kunde sieht nur eigene, ausgestellte Rechnungen
    let (s, list) = call(&db, "GET", "/api/v1/invoices", &cust_a, None).await;
    assert_eq!(s, StatusCode::OK);
    let ids: Vec<&str> = list.as_array().unwrap().iter().map(|i| i["id"].as_str().unwrap()).collect();
    assert_eq!(ids, vec![a_issued["id"].as_str().unwrap()]);
    let path = |v: &Value| format!("/api/v1/invoices/{}", v["id"].as_str().unwrap());
    assert_eq!(call(&db, "GET", &path(&b_issued), &cust_a, None).await.0, StatusCode::FORBIDDEN);
    assert_eq!(call(&db, "GET", &path(&a_draft), &cust_a, None).await.0, StatusCode::NOT_FOUND);
    assert_eq!(call(&db, "POST", "/api/v1/invoices", &cust_a, Some(draft(org_a))).await.0, StatusCode::FORBIDDEN);
    let (_, orgs) = call(&db, "GET", "/api/v1/organizations", &cust_a, None).await;
    assert_eq!(orgs.as_array().unwrap().len(), 1);

    // Mitarbeiter darf Entwürfe anlegen, aber nicht ausstellen
    let (s, v) = call(&db, "POST", "/api/v1/invoices", &staff, Some(draft(org_a))).await;
    assert_eq!(s, StatusCode::CREATED);
    let issue = format!("/api/v1/invoices/{}/issue", v["id"].as_str().unwrap());
    assert_eq!(call(&db, "POST", &issue, &staff, None).await.0, StatusCode::FORBIDDEN);

    // ohne gültiges Token
    assert_eq!(call(&db, "GET", "/api/v1/invoices", "falsch", None).await.0, StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn device_report(db: PgPool) {
    let admin = user(&db, "admin", None).await;
    let (s, v) =
        call(&db, "POST", "/api/v1/devices", &admin, Some(json!({ "kind": "esp32", "name": "Sensor 1" }))).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let token = v["token"].as_str().unwrap().to_owned();

    let report = json!({ "protocol": 1, "kind": "esp32", "version": "0.1.0", "uptime_s": 12,
        "metrics": [{ "name": "temp_c", "value": 40.5 }],
        "events": [{ "level": "warn", "code": "wifi_weak", "message": "RSSI -85" }] });
    let (s, ack) = call(&db, "POST", "/api/v1/devices/report", &token, Some(report.clone())).await;
    assert_eq!(s, StatusCode::OK, "{ack}");
    assert_eq!(ack["license"]["state"], "valid");
    assert_eq!(ack["next_report_s"], 60);
    let (n,): (i64,) = sqlx::query_as("SELECT count(*) FROM device_events").fetch_one(&db).await.unwrap();
    assert_eq!(n, 1);

    // falscher Gerätetyp / Benutzertoken statt Gerätetoken / alte Protokollversion
    let mut wrong = report.clone();
    wrong["kind"] = json!("pos");
    assert_eq!(call(&db, "POST", "/api/v1/devices/report", &token, Some(wrong)).await.0, StatusCode::BAD_REQUEST);
    let mut old = report.clone();
    old["protocol"] = json!(0);
    assert_eq!(call(&db, "POST", "/api/v1/devices/report", &token, Some(old)).await.0, StatusCode::BAD_REQUEST);
    assert_eq!(call(&db, "POST", "/api/v1/devices/report", &admin, Some(report)).await.0, StatusCode::UNAUTHORIZED);

    let (_, list) = call(&db, "GET", "/api/v1/devices", &admin, None).await;
    assert_eq!(list[0]["online"], true);
    assert_eq!(list[0]["version"], "0.1.0");
}
