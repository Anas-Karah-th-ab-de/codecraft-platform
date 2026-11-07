//! Projekte und Kostenvoranschläge (KV) – lesen.
//!
//! Mitarbeiter sehen alles (Projekte: CustomerRead, KV: InvoiceRead),
//! Kunden nur Daten der eigenen Organisation; KV-Entwürfe bleiben für Kunden verborgen.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::Json;
use chrono::{DateTime, NaiveDate, Utc};
use codecraft_domain::access::Permission;
use serde::Serialize;
use uuid::Uuid;

use super::invoices::InvoiceRow;

/// Welche Organisation darf der Benutzer sehen? `None` = alle (Mitarbeiter).
fn scope(user: &User, perm: Permission) -> ApiResult<Option<Uuid>> {
    if user.role.is_employee() {
        user.require(perm, None)?;
        Ok(None)
    } else {
        let org = user.organization_id.ok_or(ApiError::Forbidden)?;
        user.require(perm, Some(org))?;
        Ok(Some(org))
    }
}

// ── Projekte ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProjectRow {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub organization_name: Option<String>,
    pub name: String,
    pub slug: String,
    pub code: Option<String>,
    pub description: String,
    pub status: String,
    pub repo_url: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub target_date: Option<NaiveDate>,
    pub invoice_count: i64,
    pub quote_count: i64,
    /// Summe ausgestellter, nicht stornierter Rechnungen (EUR-Cent; nur EUR)
    pub invoiced_cents: i64,
    pub open_cents: i64,
}

const PROJECT_SELECT: &str = "
    SELECT p.id, p.organization_id, o.name AS organization_name, p.name, p.slug, p.code, p.description, p.status,
           p.repo_url, p.start_date, p.target_date,
           (SELECT count(*) FROM invoices i WHERE i.project_id = p.id AND i.status <> 'draft') AS invoice_count,
           (SELECT count(*) FROM quotes q WHERE q.project_id = p.id) AS quote_count,
           COALESCE((SELECT sum(i.gross_cents) FROM invoices i WHERE i.project_id = p.id
                      AND i.kind = 'invoice' AND i.status IN ('issued','paid') AND i.currency = 'EUR'), 0)::bigint
               AS invoiced_cents,
           COALESCE((SELECT sum(i.gross_cents) FROM invoices i WHERE i.project_id = p.id
                      AND i.kind = 'invoice' AND i.status = 'issued' AND i.currency = 'EUR'), 0)::bigint
               AS open_cents
      FROM projects p LEFT JOIN organizations o ON o.id = p.organization_id";

pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<ProjectRow>>> {
    let org = scope(&user, Permission::CustomerRead)?;
    let sql = format!(
        "{PROJECT_SELECT} WHERE ($1::uuid IS NULL OR p.organization_id = $1)
          ORDER BY (p.status IN ('completed','archived')), p.created_at DESC"
    );
    Ok(Json(sqlx::query_as(&sql).bind(org).fetch_all(&s.db).await?))
}

#[derive(Serialize)]
pub struct ProjectDetail {
    #[serde(flatten)]
    pub project: ProjectRow,
    pub invoices: Vec<InvoiceRow>,
    pub quotes: Vec<QuoteRow>,
}

pub async fn get(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<ProjectDetail>> {
    let org = scope(&user, Permission::CustomerRead)?;
    let project: ProjectRow = sqlx::query_as(&format!("{PROJECT_SELECT} WHERE p.id = $1"))
        .bind(id)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    if org.is_some() && project.organization_id != org {
        return Err(ApiError::NotFound);
    }
    // Rechnungen/KV nur mit Leserecht auf Rechnungen
    let can_money = scope(&user, Permission::InvoiceRead).is_ok();
    let (invoices, quotes) = if can_money {
        let inv = sqlx::query_as(&format!(
            "SELECT {} FROM invoices WHERE project_id = $1 AND (status <> 'draft' OR $2) ORDER BY created_at DESC",
            super::invoices::COLS
        ))
        .bind(id)
        .bind(user.role.is_employee())
        .fetch_all(&s.db)
        .await?;
        let q = sqlx::query_as(&format!(
            "{QUOTE_SELECT} WHERE q.project_id = $1 AND (q.status <> 'draft' OR $2) ORDER BY q.created_at DESC"
        ))
        .bind(id)
        .bind(user.role.is_employee())
        .fetch_all(&s.db)
        .await?;
        (inv, q)
    } else {
        (vec![], vec![])
    };
    Ok(Json(ProjectDetail { project, invoices, quotes }))
}

// ── Kostenvoranschläge ──────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QuoteRow {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub organization_name: String,
    pub project_id: Option<Uuid>,
    pub project_name: Option<String>,
    pub number: String,
    pub title: String,
    pub revision: Option<String>,
    pub status: String,
    pub currency: String,
    pub tax_mode: String,
    pub locale: String,
    pub valid_until: Option<NaiveDate>,
    pub net_cents: i64,
    pub tax_cents: i64,
    pub gross_cents: i64,
    pub sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

const QUOTE_SELECT: &str = "
    SELECT q.id, q.organization_id, o.name AS organization_name, q.project_id, p.name AS project_name,
           q.number, q.title, q.revision, q.status, q.currency::text AS currency, q.tax_mode, q.locale,
           q.valid_until, q.net_cents, q.tax_cents, q.gross_cents, q.sent_at, q.created_at
      FROM quotes q JOIN organizations o ON o.id = q.organization_id
      LEFT JOIN projects p ON p.id = q.project_id";

pub async fn list_quotes(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<QuoteRow>>> {
    let org = scope(&user, Permission::InvoiceRead)?;
    let sql = format!(
        "{QUOTE_SELECT} WHERE ($1::uuid IS NULL OR q.organization_id = $1) AND ($1::uuid IS NULL OR q.status <> 'draft')
          ORDER BY q.created_at DESC"
    );
    Ok(Json(sqlx::query_as(&sql).bind(org).fetch_all(&s.db).await?))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QuoteItem {
    pub block_nr: Option<i32>,
    pub block_title: Option<String>,
    pub position_nr: Option<String>,
    pub description: String,
    pub quantity_milli: i64,
    pub unit: String,
    pub unit_price_cents: i64,
    pub total_cents: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Milestone {
    pub label: String,
    pub title: String,
    pub blocks: Option<String>,
    pub goal: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Payment {
    pub label: String,
    pub due_date: Option<NaiveDate>,
    pub amount_cents: i64,
    pub currency: String,
    pub description: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct QuoteExtra {
    pub description: String,
    pub notes: String,
    pub tax_note: Option<String>,
    pub tax_rate_bp: i32,
    pub project_start: Option<NaiveDate>,
    pub project_end: Option<NaiveDate>,
    pub hourly_rate_cents: Option<i64>,
    pub discounted_rate_cents: Option<i64>,
    pub total_hours_milli: Option<i64>,
    pub advance_percent: Option<i32>,
}

#[derive(Serialize)]
pub struct QuoteDetail {
    #[serde(flatten)]
    pub quote: QuoteRow,
    #[serde(flatten)]
    pub extra: QuoteExtra,
    pub items: Vec<QuoteItem>,
    pub milestones: Vec<Milestone>,
    pub payments: Vec<Payment>,
}

pub async fn get_quote(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<QuoteDetail>> {
    let org = scope(&user, Permission::InvoiceRead)?;
    let quote: QuoteRow = sqlx::query_as(&format!("{QUOTE_SELECT} WHERE q.id = $1"))
        .bind(id)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    if org.is_some() && (Some(quote.organization_id) != org || quote.status == "draft") {
        return Err(ApiError::NotFound);
    }
    let extra = sqlx::query_as(
        "SELECT description, notes, tax_note, tax_rate_bp, project_start, project_end, hourly_rate_cents,
                discounted_rate_cents, total_hours_milli, advance_percent FROM quotes WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&s.db)
    .await?;
    let items = sqlx::query_as(
        "SELECT block_nr, block_title, position_nr, description, quantity_milli, unit, unit_price_cents, total_cents
           FROM quote_items WHERE quote_id = $1 ORDER BY position",
    )
    .bind(id)
    .fetch_all(&s.db)
    .await?;
    let milestones =
        sqlx::query_as("SELECT label, title, blocks, goal FROM quote_milestones WHERE quote_id = $1 ORDER BY position")
            .bind(id)
            .fetch_all(&s.db)
            .await?;
    let payments = sqlx::query_as(
        "SELECT label, due_date, amount_cents, currency::text AS currency, description, paid_at
           FROM quote_payments WHERE quote_id = $1 ORDER BY position",
    )
    .bind(id)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(QuoteDetail { quote, extra, items, milestones, payments }))
}

#[derive(Debug, serde::Deserialize)]
pub struct PdfQuery {
    pub locale: Option<String>,
}

/// Kostenvoranschlag als PDF im Layout des Altsystems
pub async fn quote_pdf(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    axum::extract::Query(q): axum::extract::Query<PdfQuery>,
) -> ApiResult<axum::response::Response> {
    use axum::response::IntoResponse;
    let org = scope(&user, Permission::InvoiceRead)?;
    let row: Option<(Uuid, String, String, String, Option<serde_json::Value>)> =
        sqlx::query_as("SELECT organization_id, number, status, locale, pdf_snapshot FROM quotes WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?;
    let (qorg, number, status, locale, snapshot) = row.ok_or(ApiError::NotFound)?;
    if org.is_some() && (Some(qorg) != org || status == "draft") {
        return Err(ApiError::NotFound);
    }
    let data = snapshot
        .ok_or_else(|| ApiError::BadRequest("Für diesen Kostenvoranschlag liegen keine Druckdaten vor".into()))?;
    let mut conn = s.db.acquire().await?;
    let template = crate::legacy_pdf::template(&mut conn).await;
    let locale = q.locale.unwrap_or(locale);
    let bytes = crate::legacy_pdf::render("proposal", &locale, template, data)
        .await
        .ok_or_else(|| ApiError::BadRequest("PDF-Erzeugung nicht verfügbar (pdf-legacy)".into()))?;
    Ok((
        [
            (axum::http::header::CONTENT_TYPE, "application/pdf".to_string()),
            (axum::http::header::CONTENT_DISPOSITION, format!("inline; filename=\"{number}-{locale}.pdf\"")),
        ],
        bytes,
    )
        .into_response())
}
