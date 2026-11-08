//! Shop: Kunden bestellen Produkte aus dem Katalog (Preise aus dem Katalog, nie vom Client).
//! Bezahlt wird per Rechnung – Mitarbeiter bestätigen und erzeugen daraus einen Rechnungsentwurf.
//! „Preis auf Anfrage“ ist nicht bestellbar (dafür gibt es Entwicklungs-/Projektanfragen).

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use codecraft_domain::access::Permission;
use codecraft_domain::catalog::I18n;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::types::Json as SqlJson;
use uuid::Uuid;

const STATUSES: [&str; 5] = ["requested", "confirmed", "invoiced", "delivered", "cancelled"];

pub(crate) fn notify(users: &[Uuid], kind: &str, event: &str, id: Uuid, number: &str, title: &str) {
    let msg = json!({ "type": kind, "event": event, "id": id, "number": number, "title": title }).to_string();
    for u in users {
        super::chat::send_user(*u, &msg);
    }
}

/// Vertrieb + Leitung (für neue Bestellungen/Anfragen)
pub(crate) async fn team(s: &AppState, dept: &str) -> Vec<Uuid> {
    sqlx::query_scalar(
        "SELECT DISTINCT u.id FROM users u
           LEFT JOIN user_departments ud ON ud.user_id = u.id
           LEFT JOIN departments d ON d.id = ud.department_id
          WHERE u.is_active AND (u.role IN ('admin', 'lead') OR d.code = $1)",
    )
    .bind(dept)
    .fetch_all(&s.db)
    .await
    .unwrap_or_default()
}

pub(crate) async fn org_users(s: &AppState, org: Uuid) -> Vec<Uuid> {
    sqlx::query_scalar("SELECT id FROM users WHERE organization_id = $1 AND is_active")
        .bind(org)
        .fetch_all(&s.db)
        .await
        .unwrap_or_default()
}

#[derive(Deserialize)]
pub struct Line {
    pub price_id: Uuid,
    pub quantity: i32,
}

#[derive(Deserialize)]
pub struct NewOrder {
    pub items: Vec<Line>,
    #[serde(default)]
    pub note: String,
    /// nur Mitarbeiter: für einen Kunden bestellen
    pub organization_id: Option<Uuid>,
}

type PriceRow = (Uuid, SqlJson<I18n>, SqlJson<I18n>, String, Option<i64>, String, String);

pub async fn create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewOrder>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let org = if user.role.is_employee() {
        user.require(Permission::InvoiceWrite, None)?;
        b.organization_id.ok_or_else(|| ApiError::BadRequest("Kunde fehlt".into()))?
    } else {
        user.organization_id.ok_or(ApiError::Forbidden)?
    };
    if b.items.is_empty() || b.items.len() > 50 {
        return Err(ApiError::BadRequest("1 bis 50 Positionen".into()));
    }
    if b.note.len() > 4000 {
        return Err(ApiError::BadRequest("Notiz zu lang".into()));
    }
    let locale: String = sqlx::query_scalar("SELECT locale FROM organizations WHERE id = $1")
        .bind(org)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    let mut lines = vec![];
    let mut currency: Option<String> = None;
    let mut total: i64 = 0;
    for l in &b.items {
        if !(1..=10000).contains(&l.quantity) {
            return Err(ApiError::BadRequest("Menge 1–10000".into()));
        }
        let row: Option<PriceRow> = sqlx::query_as(
            "SELECT p.id, p.name, pp.name, pp.billing, pp.amount_cents, pp.currency::text, p.kind
               FROM product_prices pp JOIN products p ON p.id = pp.product_id
               JOIN departments d ON d.id = p.department_id
              WHERE pp.id = $1 AND pp.is_active AND p.is_active AND p.is_public AND d.is_active",
        )
        .bind(l.price_id)
        .fetch_optional(&s.db)
        .await?;
        let (product_id, pname, prname, billing, amount, cur, _kind) =
            row.ok_or_else(|| ApiError::BadRequest("Produkt nicht (mehr) erhältlich".into()))?;
        let Some(amount) = amount else {
            return Err(ApiError::BadRequest(format!("{} gibt es nur auf Anfrage", pname.get(&locale))));
        };
        match &currency {
            Some(c) if *c != cur => {
                return Err(ApiError::BadRequest("Bitte nur Produkte einer Währung zusammen bestellen".into()))
            }
            _ => currency = Some(cur.clone()),
        }
        let line_total =
            amount.checked_mul(l.quantity as i64).ok_or_else(|| ApiError::BadRequest("Betrag zu groß".into()))?;
        total += line_total;
        lines.push((
            product_id,
            l.price_id,
            format!("{} – {}", pname.get(&locale), prname.get(&locale)),
            billing,
            l.quantity,
            amount,
            line_total,
        ));
    }
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    let n: i64 = sqlx::query_scalar("SELECT nextval('order_number_seq')").fetch_one(&mut *tx).await?;
    let number = format!("B-{}-{n:05}", Utc::now().format("%Y"));
    sqlx::query("INSERT INTO orders (id, number, organization_id, created_by, currency, net_cents, note) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(id)
        .bind(&number)
        .bind(org)
        .bind(user.id)
        .bind(currency.unwrap_or_else(|| "EUR".into()))
        .bind(total)
        .bind(b.note.trim())
        .execute(&mut *tx)
        .await?;
    for (product_id, price_id, name, billing, qty, unit, line_total) in lines {
        sqlx::query(
            "INSERT INTO order_items (id, order_id, product_id, price_id, name, billing, quantity, unit_price_cents, total_cents)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        )
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(product_id)
        .bind(price_id)
        .bind(name)
        .bind(billing)
        .bind(qty)
        .bind(unit)
        .bind(line_total)
        .execute(&mut *tx)
        .await?;
    }
    super::audit(&mut tx, &user.actor(), "create", "order", id, json!({ "number": number, "net_cents": total }))
        .await?;
    tx.commit().await?;
    notify(&team(&s, "SAL").await, "order", "new", id, &number, &number);
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "number": number, "net_cents": total }))))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct OrderRow {
    pub id: Uuid,
    pub number: String,
    pub organization_id: Uuid,
    pub customer: String,
    pub status: String,
    pub currency: String,
    pub net_cents: i64,
    pub note: String,
    pub invoice_id: Option<Uuid>,
    pub invoice_number: Option<String>,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub items: Value,
}

const SELECT: &str = "
    SELECT o.id, o.number, o.organization_id, g.name AS customer, o.status, o.currency::text, o.net_cents, o.note,
           o.invoice_id, i.number AS invoice_number, u.display_name AS created_by_name, o.created_at,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', x.name, 'billing', x.billing, 'quantity', x.quantity,
                    'unit_price_cents', x.unit_price_cents, 'total_cents', x.total_cents)), '[]')
              FROM order_items x WHERE x.order_id = o.id) AS items
      FROM orders o JOIN organizations g ON g.id = o.organization_id
      LEFT JOIN invoices i ON i.id = o.invoice_id
      LEFT JOIN users u ON u.id = o.created_by";

pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<OrderRow>>> {
    let org = if user.role.is_employee() {
        user.require(Permission::InvoiceRead, None)?;
        None
    } else {
        Some(user.organization_id.ok_or(ApiError::Forbidden)?)
    };
    let rows = sqlx::query_as(&format!(
        "{SELECT} WHERE ($1::uuid IS NULL OR o.organization_id = $1)
          ORDER BY (o.status IN ('delivered','cancelled')), o.created_at DESC LIMIT 500"
    ))
    .bind(org)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct Patch {
    pub status: String,
}

pub async fn patch(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Patch>,
) -> ApiResult<StatusCode> {
    if !STATUSES.contains(&b.status.as_str()) || b.status == "invoiced" {
        return Err(ApiError::BadRequest("Status ungültig".into()));
    }
    let (org, status, number): (Uuid, String, String) =
        sqlx::query_as("SELECT organization_id, status, number FROM orders WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?
            .ok_or(ApiError::NotFound)?;
    if user.role.is_employee() {
        user.require(Permission::InvoiceWrite, None)?;
    } else if user.organization_id != Some(org) {
        return Err(ApiError::NotFound);
    } else if !(b.status == "cancelled" && status == "requested") {
        // Kunden können nur noch nicht bestätigte Bestellungen stornieren
        return Err(ApiError::Forbidden);
    }
    if matches!(status.as_str(), "cancelled" | "delivered") {
        return Err(ApiError::Conflict("Bestellung ist abgeschlossen".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE orders SET status = $2, updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(&b.status)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "status", "order", id, json!({ "from": status, "to": b.status })).await?;
    tx.commit().await?;
    let mut to = org_users(&s, org).await;
    to.retain(|u| *u != user.id);
    notify(&to, "order", "update", id, &number, &number);
    Ok(StatusCode::NO_CONTENT)
}

/// Rechnungsentwurf aus der Bestellung erzeugen (Buchhaltung prüft und stellt aus)
pub async fn invoice(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    let (org, status, currency, number, existing): (Uuid, String, String, String, Option<Uuid>) = sqlx::query_as(
        "SELECT organization_id, status, currency::text, number, invoice_id FROM orders WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    if existing.is_some() || status == "cancelled" {
        return Err(ApiError::Conflict(
            "Für diese Bestellung gibt es schon eine Rechnung oder sie ist storniert".into(),
        ));
    }
    let lines: Vec<(Uuid, i32)> = sqlx::query_as("SELECT price_id, quantity FROM order_items WHERE order_id = $1")
        .bind(id)
        .fetch_all(&mut *tx)
        .await?;
    let lines: Vec<(Uuid, i64)> = lines.into_iter().map(|(p, q)| (p, q as i64)).collect();
    let inv = super::invoices::draft_from_catalog(
        &mut tx,
        &user.actor(),
        org,
        &currency,
        &lines,
        &format!("Bestellung {number}"),
    )
    .await?;
    sqlx::query("UPDATE orders SET invoice_id = $2, status = 'invoiced', updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(inv)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "invoice", "order", id, json!({ "invoice": inv })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "invoice_id": inv }))))
}
