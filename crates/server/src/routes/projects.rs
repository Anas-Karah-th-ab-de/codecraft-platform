//! Projekte und Kostenvoranschläge (KV) – lesen.
//!
//! Mitarbeiter sehen alles (Projekte: CustomerRead, KV: InvoiceRead),
//! Kunden nur Daten der eigenen Organisation; KV-Entwürfe bleiben für Kunden verborgen.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, NaiveDate, Utc};
use codecraft_domain::access::Permission;
use serde::{Deserialize, Serialize};
use serde_json::json;
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
    /// 0–100: Anteil erledigter Meilensteine (ohne Meilensteine: manueller Wert)
    pub progress: i32,
    pub milestones_total: i64,
    pub milestones_done: i64,
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
               AS open_cents,
           (SELECT CASE WHEN count(*) = 0 THEN p.progress::int
                        ELSE (100 * count(*) FILTER (WHERE m.status = 'done') / count(*))::int END
              FROM project_milestones m WHERE m.project_id = p.id) AS progress,
           (SELECT count(*) FROM project_milestones m WHERE m.project_id = p.id) AS milestones_total,
           (SELECT count(*) FROM project_milestones m WHERE m.project_id = p.id AND m.status = 'done') AS milestones_done
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
    pub milestones: Vec<MilestoneRow>,
    pub updates: Vec<UpdateRow>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MilestoneRow {
    pub id: Uuid,
    pub position: i32,
    pub title: String,
    pub description: String,
    pub due_date: Option<NaiveDate>,
    pub status: String,
    pub done_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UpdateRow {
    pub id: Uuid,
    pub author: Option<String>,
    pub body: String,
    pub for_customer: bool,
    pub created_at: DateTime<Utc>,
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
    let milestones = sqlx::query_as(
        "SELECT id, position, title, description, due_date, status, done_at FROM project_milestones
          WHERE project_id = $1 ORDER BY position, created_at",
    )
    .bind(id)
    .fetch_all(&s.db)
    .await?;
    let updates = sqlx::query_as(
        "SELECT x.id, u.display_name AS author, x.body, x.for_customer, x.created_at
           FROM project_updates x LEFT JOIN users u ON u.id = x.author_id
          WHERE x.project_id = $1 AND (x.for_customer OR $2) ORDER BY x.created_at DESC LIMIT 200",
    )
    .bind(id)
    .bind(user.role.is_employee())
    .fetch_all(&s.db)
    .await?;
    Ok(Json(ProjectDetail { project, invoices, quotes, milestones, updates }))
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

// ── Fortschritt pflegen (Team) ──────────────────────────────────────────────

const PROJECT_STATUSES: [&str; 5] = ["planning", "active", "on_hold", "completed", "archived"];

async fn project_org(s: &AppState, user: &User, id: Uuid) -> ApiResult<(Option<Uuid>, String)> {
    user.require(Permission::CustomerWrite, None)?;
    sqlx::query_as("SELECT organization_id, name FROM projects WHERE id = $1")
        .bind(id)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)
}

async fn tell_customer(s: &AppState, org: Option<Uuid>, project: Uuid, name: &str) {
    if let Some(o) = org {
        super::shop::notify(&super::shop::org_users(s, o).await, "project", "update", project, "", name);
    }
}

#[derive(Deserialize)]
pub struct ProjectPatch {
    pub status: Option<String>,
    pub progress: Option<i16>,
    pub target_date: Option<NaiveDate>,
}

pub async fn patch(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<ProjectPatch>,
) -> ApiResult<StatusCode> {
    let (org, name) = project_org(&s, &user, id).await?;
    if b.status.as_deref().is_some_and(|x| !PROJECT_STATUSES.contains(&x))
        || b.progress.is_some_and(|p| !(0..=100).contains(&p))
    {
        return Err(ApiError::BadRequest("Status oder Fortschritt ungültig".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "UPDATE projects SET status = COALESCE($2, status), progress = COALESCE($3, progress),
                target_date = COALESCE($4, target_date),
                completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END
          WHERE id = $1",
    )
    .bind(id)
    .bind(&b.status)
    .bind(b.progress)
    .bind(b.target_date)
    .execute(&mut *tx)
    .await?;
    super::audit(
        &mut tx,
        &user.actor(),
        "update",
        "project",
        id,
        json!({ "status": b.status, "progress": b.progress }),
    )
    .await?;
    tx.commit().await?;
    tell_customer(&s, org, id, &name).await;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct NewMilestone {
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub due_date: Option<NaiveDate>,
}

pub async fn add_milestone(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<NewMilestone>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    project_org(&s, &user, id).await?;
    let title = b.title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(ApiError::BadRequest("Titel 1–200 Zeichen".into()));
    }
    let mid = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO project_milestones (id, project_id, position, title, description, due_date)
         VALUES ($1, $2, (SELECT COALESCE(max(position), 0) + 1 FROM project_milestones WHERE project_id = $2), $3, $4, $5)",
    )
    .bind(mid)
    .bind(id)
    .bind(title)
    .bind(b.description.trim())
    .bind(b.due_date)
    .execute(&s.db)
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": mid }))))
}

#[derive(Deserialize)]
pub struct MilestonePatch {
    pub status: Option<String>,
    pub title: Option<String>,
    pub due_date: Option<NaiveDate>,
}

pub async fn patch_milestone(
    State(s): State<AppState>,
    user: User,
    Path(mid): Path<Uuid>,
    Json(b): Json<MilestonePatch>,
) -> ApiResult<StatusCode> {
    let pid: Uuid = sqlx::query_scalar("SELECT project_id FROM project_milestones WHERE id = $1")
        .bind(mid)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    let (org, name) = project_org(&s, &user, pid).await?;
    if b.status.as_deref().is_some_and(|x| !matches!(x, "planned" | "in_progress" | "done")) {
        return Err(ApiError::BadRequest("Status ungültig".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "UPDATE project_milestones SET status = COALESCE($2, status), title = COALESCE($3, title),
                due_date = COALESCE($4, due_date),
                done_at = CASE WHEN COALESCE($2, status) = 'done' THEN COALESCE(done_at, now()) ELSE NULL END
          WHERE id = $1",
    )
    .bind(mid)
    .bind(&b.status)
    .bind(b.title.as_deref().map(str::trim).filter(|t| !t.is_empty()))
    .bind(b.due_date)
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "milestone", "project", pid, json!({ "milestone": mid, "status": b.status }))
        .await?;
    tx.commit().await?;
    tell_customer(&s, org, pid, &name).await;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_milestone(State(s): State<AppState>, user: User, Path(mid): Path<Uuid>) -> ApiResult<StatusCode> {
    let pid: Uuid = sqlx::query_scalar("SELECT project_id FROM project_milestones WHERE id = $1")
        .bind(mid)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    project_org(&s, &user, pid).await?;
    sqlx::query("DELETE FROM project_milestones WHERE id = $1").bind(mid).execute(&s.db).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct NewUpdate {
    pub body: String,
    #[serde(default = "yes")]
    pub for_customer: bool,
}

fn yes() -> bool {
    true
}

pub async fn add_update(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<NewUpdate>,
) -> ApiResult<StatusCode> {
    let (org, name) = project_org(&s, &user, id).await?;
    let body = b.body.trim();
    if body.is_empty() || body.len() > 20000 {
        return Err(ApiError::BadRequest("Text fehlt oder ist zu lang".into()));
    }
    sqlx::query("INSERT INTO project_updates (id, project_id, author_id, body, for_customer) VALUES ($1,$2,$3,$4,$5)")
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(user.id)
        .bind(body)
        .bind(b.for_customer)
        .execute(&s.db)
        .await?;
    if b.for_customer {
        tell_customer(&s, org, id, &name).await;
    }
    Ok(StatusCode::NO_CONTENT)
}
