//! Stellenanzeigen, Bewerbungen und Kontaktanfragen (öffentlich + Portal).

use super::account::client_ip;
use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use codecraft_domain::access::Permission;
use codecraft_domain::catalog::{validate_code, I18n};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::types::Json as SqlJson;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Spam-Schutz für öffentliche Formulare: 5 Einsendungen pro IP und Stunde
static SUBMITS: Mutex<Option<HashMap<String, (u32, Instant)>>> = Mutex::new(None);

fn allow_submit(ip: &str) -> bool {
    let mut g = SUBMITS.lock().unwrap_or_else(|e| e.into_inner());
    let m = g.get_or_insert_with(HashMap::new);
    // Speicher begrenzen: abgelaufene Einträge entfernen, sobald es viele werden
    if m.len() >= 20_000 {
        m.retain(|_, v| v.1.elapsed() < Duration::from_secs(3600));
    }
    let e = m.entry(ip.to_owned()).or_insert((0, Instant::now()));
    if e.1.elapsed() >= Duration::from_secs(3600) {
        *e = (0, Instant::now());
    }
    e.0 += 1;
    e.0 <= 5
}

fn locale_of(l: Option<&str>) -> &'static str {
    match l {
        Some("en") => "en",
        Some("ar") => "ar",
        _ => "de",
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct JobRow {
    pub id: Uuid,
    pub slug: String,
    pub department_code: String,
    pub department_name: SqlJson<I18n>,
    pub title: SqlJson<I18n>,
    pub summary: SqlJson<I18n>,
    pub description: SqlJson<I18n>,
    pub location: String,
    pub employment_type: String,
    pub remote: bool,
    pub status: String,
    pub published_at: Option<chrono::DateTime<chrono::Utc>>,
    pub applications: i64,
}

const JOB_SELECT: &str =
    "SELECT j.id, j.slug, d.code AS department_code, d.name AS department_name, j.title, j.summary,
        j.description, j.location, j.employment_type, j.remote, j.status, j.published_at,
        (SELECT count(*) FROM job_applications a WHERE a.job_id = j.id) AS applications
   FROM job_positions j JOIN departments d ON d.id = j.department_id";

fn public_job(j: &JobRow, l: &str) -> Value {
    json!({
        "slug": j.slug, "department": j.department_code, "department_name": j.department_name.get(l),
        "title": j.title.get(l), "summary": j.summary.get(l), "description": j.description.get(l),
        "location": j.location, "employment_type": j.employment_type, "remote": j.remote,
        "published_at": j.published_at,
    })
}

#[derive(Debug, Deserialize)]
pub struct LocaleQuery {
    pub locale: Option<String>,
}

pub async fn public_jobs(State(s): State<AppState>, Query(q): Query<LocaleQuery>) -> ApiResult<Json<Vec<Value>>> {
    let l = locale_of(q.locale.as_deref());
    let rows: Vec<JobRow> =
        sqlx::query_as(&format!("{JOB_SELECT} WHERE j.status = 'published' ORDER BY j.published_at DESC"))
            .fetch_all(&s.db)
            .await?;
    Ok(Json(rows.iter().map(|j| public_job(j, l)).collect()))
}

pub async fn public_job_detail(
    State(s): State<AppState>,
    Path(slug): Path<String>,
    Query(q): Query<LocaleQuery>,
) -> ApiResult<Json<Value>> {
    let l = locale_of(q.locale.as_deref());
    let j: JobRow = sqlx::query_as(&format!("{JOB_SELECT} WHERE j.slug = $1 AND j.status = 'published'"))
        .bind(slug)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(public_job(&j, l)))
}

#[derive(Debug, Deserialize)]
pub struct ApplyBody {
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    #[serde(default)]
    pub message: String,
    pub locale: Option<String>,
    /// Honeypot – muss leer bleiben
    #[serde(default)]
    pub website: String,
}

pub async fn apply(
    State(s): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
    Json(b): Json<ApplyBody>,
) -> ApiResult<StatusCode> {
    if !b.website.is_empty() {
        return Ok(StatusCode::CREATED); // Bot – still verwerfen
    }
    if !allow_submit(&client_ip(&headers)) {
        return Err(ApiError::TooManyRequests);
    }
    if b.message.len() > 5000 || b.name.len() > 200 {
        return Err(ApiError::BadRequest("Eingabe zu lang".into()));
    }
    let (job_id,): (Uuid,) = sqlx::query_as("SELECT id FROM job_positions WHERE slug = $1 AND status = 'published'")
        .bind(&slug)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    sqlx::query(
        "INSERT INTO job_applications (id, job_id, name, email, phone, message, locale) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(Uuid::now_v7())
    .bind(job_id)
    .bind(b.name.trim())
    .bind(b.email.trim())
    .bind(b.phone.as_deref().map(str::trim).filter(|p| !p.is_empty()))
    .bind(b.message.trim())
    .bind(locale_of(b.locale.as_deref()))
    .execute(&s.db)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(d) if d.code().as_deref() == Some("23514") => {
            ApiError::BadRequest("Bitte Name und gültige E-Mail angeben".into())
        }
        _ => e.into(),
    })?;
    Ok(StatusCode::CREATED)
}

// ── Portal ──────────────────────────────────────────────────────────────────

pub async fn list_jobs(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<JobRow>>> {
    user.require(Permission::JobsManage, None)?;
    let rows = sqlx::query_as(&format!("{JOB_SELECT} ORDER BY j.created_at DESC")).fetch_all(&s.db).await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct NewJob {
    pub department_code: String,
    pub slug: String,
    pub title: I18n,
    pub summary: I18n,
    pub description: I18n,
    #[serde(default)]
    pub location: String,
    pub employment_type: String,
    #[serde(default)]
    pub remote: bool,
    #[serde(default)]
    pub publish: bool,
}

pub async fn create_job(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewJob>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    user.require(Permission::JobsManage, None)?;
    let bad = |e: codecraft_domain::catalog::CatalogError| ApiError::BadRequest(e.to_string());
    validate_code(&b.slug).map_err(bad)?;
    b.title.validate("title").map_err(bad)?;
    b.summary.validate("summary").map_err(bad)?;
    b.description.validate("description").map_err(bad)?;
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    let r = sqlx::query(
        "INSERT INTO job_positions (id, department_id, slug, title, summary, description, location, employment_type,
                                    remote, status, published_at)
         SELECT $1, d.id, $3, $4, $5, $6, $7, $8, $9,
                CASE WHEN $10 THEN 'published' ELSE 'draft' END, CASE WHEN $10 THEN now() END
           FROM departments d WHERE d.code = $2",
    )
    .bind(id)
    .bind(&b.department_code)
    .bind(&b.slug)
    .bind(SqlJson(&b.title))
    .bind(SqlJson(&b.summary))
    .bind(SqlJson(&b.description))
    .bind(b.location.trim())
    .bind(&b.employment_type)
    .bind(b.remote)
    .bind(b.publish)
    .execute(&mut *tx)
    .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::BadRequest(format!("Abteilung {} existiert nicht", b.department_code)));
    }
    super::audit(&mut tx, &user.actor(), "create", "job", id, json!({ "slug": b.slug })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

#[derive(Debug, Deserialize)]
pub struct JobStatus {
    pub status: String,
}

pub async fn set_job_status(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<JobStatus>,
) -> ApiResult<StatusCode> {
    user.require(Permission::JobsManage, None)?;
    if !matches!(b.status.as_str(), "draft" | "published" | "closed") {
        return Err(ApiError::BadRequest("Status ungültig".into()));
    }
    let r = sqlx::query(
        "UPDATE job_positions SET status = $2,
                published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
          WHERE id = $1",
    )
    .bind(id)
    .bind(&b.status)
    .execute(&s.db)
    .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ApplicationRow {
    pub id: Uuid,
    pub job_slug: String,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub message: String,
    pub locale: String,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn applications(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<ApplicationRow>>> {
    user.require(Permission::JobsManage, None)?;
    let rows = sqlx::query_as(
        "SELECT a.id, j.slug AS job_slug, a.name, a.email, a.phone, a.message, a.locale, a.status, a.created_at
           FROM job_applications a JOIN job_positions j ON j.id = a.job_id ORDER BY a.created_at DESC LIMIT 500",
    )
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

// ── Kontakt ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ContactBody {
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub subject: String,
    pub message: String,
    pub product_id: Option<Uuid>,
    pub locale: Option<String>,
    #[serde(default)]
    pub website: String,
}

pub async fn contact(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(b): Json<ContactBody>,
) -> ApiResult<StatusCode> {
    if !b.website.is_empty() {
        return Ok(StatusCode::CREATED);
    }
    if !allow_submit(&client_ip(&headers)) {
        return Err(ApiError::TooManyRequests);
    }
    if b.message.len() > 5000 || b.subject.len() > 300 {
        return Err(ApiError::BadRequest("Eingabe zu lang".into()));
    }
    sqlx::query(
        "INSERT INTO contact_requests (id, name, email, phone, subject, message, product_id, locale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(Uuid::now_v7())
    .bind(b.name.trim())
    .bind(b.email.trim())
    .bind(b.phone.as_deref().map(str::trim).filter(|p| !p.is_empty()))
    .bind(b.subject.trim())
    .bind(b.message.trim())
    .bind(b.product_id)
    .bind(locale_of(b.locale.as_deref()))
    .execute(&s.db)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(d) if matches!(d.code().as_deref(), Some("23514") | Some("23503")) => {
            ApiError::BadRequest("Bitte alle Pflichtfelder korrekt ausfüllen".into())
        }
        _ => e.into(),
    })?;
    Ok(StatusCode::CREATED)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContactRow {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub subject: String,
    pub message: String,
    pub product_sku: Option<String>,
    pub locale: String,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn contact_requests(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<ContactRow>>> {
    user.require(Permission::JobsManage, None)?;
    let rows = sqlx::query_as(
        "SELECT c.id, c.name, c.email, c.phone, c.subject, c.message, p.sku AS product_sku, c.locale, c.status, c.created_at
           FROM contact_requests c LEFT JOIN products p ON p.id = c.product_id
          ORDER BY c.created_at DESC LIMIT 500",
    )
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}
