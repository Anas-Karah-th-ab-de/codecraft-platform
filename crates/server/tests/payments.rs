//! Zahlungsarten (Admin), Standard je Kunde, Auswahl je Beleg; Verträge; mündliche Vereinbarung.

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

async fn setup(db: &PgPool) -> (String, String, String, String) {
    sqlx::query("INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, 'ak@code-craft.tech', 'Anas', 'admin', $2)")
        .bind(Uuid::now_v7())
        .bind(auth::hash_password("admin-passwort-1").unwrap())
        .execute(db)
        .await
        .unwrap();
    let admin = login(db, "ak@code-craft.tech", "admin-passwort-1").await;
    let (_, o) = call(
        db,
        "POST",
        "/api/v1/organizations",
        &admin,
        Some(json!({ "name": "Praxis Nord", "address": "Weg 2\n10115 Berlin" })),
    )
    .await;
    let org = o["id"].as_str().unwrap().to_owned();
    for (email, role, depts, org_id) in [
        ("k@nord.de", "customer", json!([]), Some(org.clone())),
        ("vertrieb@code-craft.tech", "staff", json!(["SAL"]), None),
    ] {
        let (s, v) = call(
            db,
            "POST",
            "/api/v1/users",
            &admin,
            Some(json!({ "email": email, "display_name": email, "role": role, "password": "start-passwort-1", "organization_id": org_id, "departments": depts })),
        )
        .await;
        assert_eq!(s, StatusCode::CREATED, "{v}");
    }
    let kunde = login(db, "k@nord.de", "start-passwort-1").await;
    let sales = login(db, "vertrieb@code-craft.tech", "start-passwort-1").await;
    (admin, org, kunde, sales)
}

fn method_id(list: &Value, kind: &str) -> String {
    list.as_array().unwrap().iter().find(|m| m["kind"] == kind).unwrap()["id"].as_str().unwrap().to_owned()
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn payment_methods_per_customer_and_document(db: PgPool) {
    let (admin, org, kunde, sales) = setup(&db).await;

    // Standard: ShamCash; Bank vorhanden
    let (_, list) = call(&db, "GET", "/api/v1/payment-methods", &sales, None).await;
    let def: Vec<&Value> = list.as_array().unwrap().iter().filter(|m| m["is_default"] == true).collect();
    assert_eq!(def.len(), 1);
    assert_eq!(def[0]["kind"], "shamcash");
    let sham = method_id(&list, "shamcash");
    let bank = method_id(&list, "bank");

    // nur Admin pflegt Zahlungsarten
    let body = json!({ "kind": "shamcash", "name": "ShamCash", "is_default": true,
                       "details": { "payee": "KM Code Craft", "account": "SC-4711" } });
    let (s, _) = call(&db, "PUT", &format!("/api/v1/payment-methods/{sham}"), &sales, Some(body.clone())).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, v) = call(&db, "PUT", &format!("/api/v1/payment-methods/{sham}"), &admin, Some(body)).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let (s, _) = call(
        &db,
        "POST",
        "/api/v1/payment-methods",
        &admin,
        Some(json!({ "kind": "other", "name": "X", "details": { "pin": "1" } })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "unbekanntes Feld");
    let (s, cash) =
        call(&db, "POST", "/api/v1/payment-methods", &admin, Some(json!({ "kind": "cash", "name": "Bar im Büro" })))
            .await;
    assert_eq!(s, StatusCode::CREATED);
    // Standard kann nicht einfach abgewählt werden
    let (s, _) = call(
        &db,
        "PUT",
        &format!("/api/v1/payment-methods/{sham}"),
        &admin,
        Some(json!({ "kind": "shamcash", "name": "ShamCash" })),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT);

    // Rechnung ohne Auswahl → globaler Standard (ShamCash)
    let draft = |m: Option<&str>| {
        json!({ "organization_id": org, "payment_method_id": m,
        "items": [{ "description": "Wartung", "quantity_milli": 1000, "unit": "flat", "unit_price": 10000, "vat_rate_bp": 1900 }] })
    };
    let (s, inv) = call(&db, "POST", "/api/v1/invoices", &sales, Some(draft(None))).await;
    assert_eq!(s, StatusCode::CREATED, "{inv}");
    assert_eq!(inv["payment"]["kind"], "shamcash");
    assert_eq!(inv["payment"]["details"]["account"], "SC-4711");

    // Kunde bekommt Bank als Standard → neue Belege nehmen Bank
    // Kundenstammdaten ändern: nicht für einfache Mitarbeiter
    let set = json!({ "payment_method_id": bank });
    let (s, _) =
        call(&db, "PUT", &format!("/api/v1/organizations/{org}/payment-method"), &sales, Some(set.clone())).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = call(&db, "PUT", &format!("/api/v1/organizations/{org}/payment-method"), &admin, Some(set)).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (_, inv2) = call(&db, "POST", "/api/v1/invoices", &sales, Some(draft(None))).await;
    assert_eq!(inv2["payment"]["kind"], "bank");
    // ausdrückliche Auswahl schlägt Kundenstandard
    let (_, inv3) = call(&db, "POST", "/api/v1/invoices", &sales, Some(draft(cash["id"].as_str()))).await;
    assert_eq!(inv3["payment"]["name"], "Bar im Büro");

    // Entwurf umstellen; nach dem Ausstellen eingefroren
    let id = inv["id"].as_str().unwrap();
    let (s, v) = call(
        &db,
        "PUT",
        &format!("/api/v1/invoices/{id}/payment-method"),
        &sales,
        Some(json!({ "payment_method_id": sham })),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let (s, v) = call(&db, "POST", &format!("/api/v1/invoices/{id}/issue"), &admin, None).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    call(
        &db,
        "PUT",
        &format!("/api/v1/payment-methods/{sham}"),
        &admin,
        Some(json!({ "kind": "shamcash", "name": "ShamCash", "is_default": true, "details": { "account": "SC-NEU" } })),
    )
    .await;
    let (_, v) = call(&db, "GET", &format!("/api/v1/invoices/{id}"), &kunde, None).await;
    assert_eq!(v["payment"]["details"]["account"], "SC-4711", "ausgestellte Rechnung behält die Daten");
    let (s, _) = call(
        &db,
        "PUT",
        &format!("/api/v1/invoices/{id}/payment-method"),
        &admin,
        Some(json!({ "payment_method_id": bank })),
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT);

    // deaktivierte Zahlungsart nicht wählbar
    let cid = cash["id"].as_str().unwrap();
    call(
        &db,
        "PUT",
        &format!("/api/v1/payment-methods/{cid}"),
        &admin,
        Some(json!({ "kind": "cash", "name": "Bar im Büro", "is_active": false })),
    )
    .await;
    let (s, _) = call(&db, "POST", "/api/v1/invoices", &sales, Some(draft(Some(cid)))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (_, list) = call(&db, "GET", "/api/v1/payment-methods", &kunde, None).await;
    assert!(list.as_array().unwrap().iter().all(|m| m["is_active"] == true));
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn contract_agreed_verbally(db: PgPool) {
    let (admin, org, kunde, sales) = setup(&db).await;
    let (_, list) = call(&db, "GET", "/api/v1/payment-methods", &sales, None).await;
    let bank = method_id(&list, "bank");

    // Wartungsvertrag: monatlich 250 € netto, 30 Tage Kündigungsfrist, per Überweisung
    let contract = json!({
        "organization_id": org, "title": "Wartungsvertrag Praxis-IT", "doc_kind": "contract",
        "contract_start": "2027-01-01", "billing_interval": "monthly", "recurring_cents": 25000, "notice_days": 30,
        "payment_method_id": bank, "items": [], "valid_until": "2099-12-31"
    });
    let mut bad = contract.clone();
    bad["billing_interval"] = json!(null);
    let (s, _) = call(&db, "POST", "/api/v1/quotes", &sales, Some(bad)).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, q) = call(&db, "POST", "/api/v1/quotes", &sales, Some(contract)).await;
    assert_eq!(s, StatusCode::CREATED, "{q}");
    let qid = q["id"].as_str().unwrap().to_owned();

    // Zeitraum-Rechnung erst nach Annahme; Kunde kann nicht „mündlich“ annehmen
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/quotes/{qid}/invoice"), &sales, Some(json!({ "mode": "period" }))).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let verbal = json!({ "note": "Telefonat 05.11. mit Dr. Nord: Vertrag ab Januar zugesagt" });
    let (s, _) = call(&db, "POST", &format!("/api/v1/quotes/{qid}/accept-verbal"), &kunde, Some(verbal.clone())).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) =
        call(&db, "POST", &format!("/api/v1/quotes/{qid}/accept-verbal"), &sales, Some(json!({ "note": "ok" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "Vermerk zu kurz");

    // Team hält die mündliche Zusage fest (direkt aus dem Entwurf) → Projekt entsteht
    let (s, v) = call(&db, "POST", &format!("/api/v1/quotes/{qid}/accept-verbal"), &sales, Some(verbal.clone())).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    assert!(v["project_id"].is_string());
    let (s, _) = call(&db, "POST", &format!("/api/v1/quotes/{qid}/accept-verbal"), &sales, Some(verbal)).await;
    assert_eq!(s, StatusCode::CONFLICT);
    let (_, d) = call(&db, "GET", &format!("/api/v1/quotes/{qid}"), &kunde, None).await;
    assert_eq!(d["status"], "accepted");
    assert_eq!(d["doc_kind"], "contract");
    assert_eq!(d["accepted_via"], "verbal");
    assert_eq!(d["accepted_by_name"], "vertrieb@code-craft.tech");
    assert_eq!(d["payment_method"], "Banküberweisung");
    assert_eq!(d["recurring_cents"], 25000);

    // Monatsrechnung Februar, Zahlungsart aus dem Vertrag
    let (s, v) = call(
        &db,
        "POST",
        &format!("/api/v1/quotes/{qid}/invoice"),
        &sales,
        Some(json!({ "mode": "period", "period_start": "2027-02-01" })),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let (_, inv) =
        call(&db, "GET", &format!("/api/v1/invoices/{}", v["invoice_id"].as_str().unwrap()), &sales, None).await;
    assert_eq!(inv["payment"]["kind"], "bank");
    assert_eq!(inv["totals"]["net"], 25000);
    assert!(
        inv["items"][0]["description"].as_str().unwrap().contains("01.02.2027 – 28.02.2027"),
        "{}",
        inv["items"][0]
    );
    // vor Vertragsbeginn nicht
    let (s, _) = call(
        &db,
        "POST",
        &format!("/api/v1/quotes/{qid}/invoice"),
        &sales,
        Some(json!({ "mode": "period", "period_start": "2026-12-01" })),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    // Admin verschiebt den Vertriebler in den Support → keine Angebote mehr
    let (_, users) = call(&db, "GET", "/api/v1/users", &admin, None).await;
    let uid = users.as_array().unwrap().iter().find(|u| u["email"] == "vertrieb@code-craft.tech").unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let (s, _) = call(
        &db,
        "PUT",
        &format!("/api/v1/users/{uid}/access"),
        &sales,
        Some(json!({ "role": "staff", "departments": ["SUP"] })),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    let (s, _) = call(
        &db,
        "PUT",
        &format!("/api/v1/users/{uid}/access"),
        &admin,
        Some(json!({ "role": "staff", "departments": ["SUP"] })),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    assert_eq!(call(&db, "GET", "/api/v1/quotes", &sales, None).await.0, StatusCode::FORBIDDEN);
    assert_eq!(call(&db, "GET", "/api/v1/tickets", &sales, None).await.0, StatusCode::OK);
    let (s, _) =
        call(&db, "PUT", &format!("/api/v1/users/{uid}/access"), &admin, Some(json!({ "role": "customer" }))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    // Protokoll enthält den Vermerk
    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = 'accept_verbal' AND data->>'note' LIKE 'Telefonat%'",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(n, 1);
}
