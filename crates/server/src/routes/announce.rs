//! Ankündigungen: Leitung/Management informiert alle, nur Mitarbeiter, nur Kunden oder
//! bestimmte Abteilungen – mit Wichtigkeit, Anheften, Zeitfenster und Lesebestätigung.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use codecraft_domain::access::Role;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

const DEPTS: [&str; 5] = ["ACC", "SAL", "SUP", "DEV", "MGT"];

/// Wer darf ankündigen: Admin, Teamleitung, Management (Rolle) oder Abteilung MGT
pub fn may_publish(u: &User) -> bool {
    matches!(u.role, Role::Admin | Role::Lead | Role::Manager)
        || (u.role.is_employee() && u.departments.iter().any(|d| d == "MGT"))
}

/// SQL-Bedingung: Ankündigung `a` ist für Benutzer $1 (Rolle $2, Abteilungen $3) sichtbar
const VISIBLE: &str = "(a.audience = 'all'
      OR (a.audience = 'employees' AND $2 <> 'customer')
      OR (a.audience = 'customers' AND $2 = 'customer')
      OR (a.audience = 'departments' AND (a.departments && $3::text[] OR $2 = 'admin')))";

#[derive(Serialize, sqlx::FromRow)]
pub struct Row {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub level: String,
    pub audience: String,
    pub departments: Vec<String>,
    pub pinned: bool,
    pub require_ack: bool,
    pub starts_at: DateTime<Utc>,
    pub ends_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub author: Option<String>,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
    pub acked_at: Option<DateTime<Utc>>,
    /// nur für Verfasser/Admin: gelesen / bestätigt / Zielgruppe
    pub reads: Option<i64>,
    pub acks: Option<i64>,
    pub audience_size: Option<i64>,
}

fn role_str(u: &User) -> String {
    serde_json::to_value(u.role).ok().and_then(|v| v.as_str().map(String::from)).unwrap_or_default()
}

/// Liste: aktuelle (sichtbare) Ankündigungen; Verfasser sehen zusätzlich geplante/abgelaufene eigene
pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<Row>>> {
    let admin = user.role == Role::Admin;
    let rows = sqlx::query_as::<_, Row>(&format!(
        "SELECT a.id, a.title, a.body, a.level, a.audience, a.departments, a.pinned, a.require_ack, a.starts_at, a.ends_at,
                a.created_by, u.display_name AS author, a.created_at, r.read_at, r.acked_at,
                CASE WHEN a.created_by = $1 OR $4 THEN (SELECT count(*) FROM announcement_reads x WHERE x.announcement_id = a.id) END AS reads,
                CASE WHEN a.created_by = $1 OR $4 THEN (SELECT count(*) FROM announcement_reads x WHERE x.announcement_id = a.id AND x.acked_at IS NOT NULL) END AS acks,
                CASE WHEN a.created_by = $1 OR $4 THEN (SELECT count(*) FROM users z WHERE z.is_active AND z.role <> 'device' AND (
                      a.audience = 'all' OR (a.audience = 'employees' AND z.role <> 'customer') OR (a.audience = 'customers' AND z.role = 'customer')
                      OR (a.audience = 'departments' AND EXISTS (SELECT 1 FROM user_departments ud JOIN departments d ON d.id = ud.department_id
                                                                   WHERE ud.user_id = z.id AND d.code = ANY(a.departments))))) END AS audience_size
           FROM announcements a
           LEFT JOIN users u ON u.id = a.created_by
           LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = $1
          WHERE ({VISIBLE} AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now()))
             OR a.created_by = $1 OR $4
          ORDER BY (a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())) DESC, a.pinned DESC,
                   a.level = 'urgent' DESC, a.starts_at DESC
          LIMIT 200"
    ))
    .bind(user.id)
    .bind(role_str(&user))
    .bind(&user.departments)
    .bind(admin)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

/// Ungelesen/unbestätigt (für Banner und Abzeichen)
pub async fn pending(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    let rows: Vec<(Uuid, String, String, bool, bool)> = sqlx::query_as(&format!(
        "SELECT a.id, a.title, a.level, a.require_ack, r.read_at IS NOT NULL
           FROM announcements a LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = $1
          WHERE {VISIBLE} AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
            AND (r.read_at IS NULL OR (a.require_ack AND r.acked_at IS NULL))
          ORDER BY a.level = 'urgent' DESC, a.starts_at DESC"
    ))
    .bind(user.id)
    .bind(role_str(&user))
    .bind(&user.departments)
    .fetch_all(&s.db)
    .await?;
    let banner: Vec<Value> = rows
        .iter()
        .filter(|r| r.2 != "info" || r.3)
        .map(|r| json!({ "id": r.0, "title": r.1, "level": r.2, "require_ack": r.3 }))
        .collect();
    let unread = rows.iter().filter(|r| !r.4).count();
    Ok(Json(json!({ "unread": unread, "banner": banner })))
}

#[derive(Deserialize)]
pub struct In {
    pub title: String,
    pub body: String,
    #[serde(default = "info")]
    pub level: String,
    #[serde(default = "all")]
    pub audience: String,
    #[serde(default)]
    pub departments: Vec<String>,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub require_ack: bool,
    pub starts_at: Option<DateTime<Utc>>,
    pub ends_at: Option<DateTime<Utc>>,
}

fn info() -> String {
    "info".into()
}
fn all() -> String {
    "all".into()
}

fn check(b: &In) -> ApiResult<()> {
    let t = b.title.trim().chars().count();
    if !(3..=200).contains(&t) {
        return Err(ApiError::BadRequest("Titel 3–200 Zeichen".into()));
    }
    if b.body.trim().is_empty() || b.body.len() > 20000 {
        return Err(ApiError::BadRequest("Text fehlt oder zu lang".into()));
    }
    if !["info", "important", "urgent"].contains(&b.level.as_str()) {
        return Err(ApiError::BadRequest("Wichtigkeit".into()));
    }
    if !["all", "employees", "customers", "departments"].contains(&b.audience.as_str()) {
        return Err(ApiError::BadRequest("Zielgruppe".into()));
    }
    if b.audience == "departments"
        && (b.departments.is_empty() || b.departments.iter().any(|d| !DEPTS.contains(&d.as_str())))
    {
        return Err(ApiError::BadRequest("Abteilungen wählen".into()));
    }
    if let (Some(a), Some(e)) = (b.starts_at, b.ends_at) {
        if e <= a {
            return Err(ApiError::BadRequest("Ende muss nach dem Beginn liegen".into()));
        }
    }
    Ok(())
}

pub async fn create(State(s): State<AppState>, user: User, Json(b): Json<In>) -> ApiResult<(StatusCode, Json<Value>)> {
    if !may_publish(&user) {
        return Err(ApiError::Forbidden);
    }
    check(&b)?;
    let id = Uuid::now_v7();
    let depts = if b.audience == "departments" { b.departments.clone() } else { vec![] };
    sqlx::query(
        "INSERT INTO announcements (id, title, body, level, audience, departments, pinned, require_ack, starts_at, ends_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, now()), $10, $11)",
    )
    .bind(id)
    .bind(b.title.trim())
    .bind(b.body.trim())
    .bind(&b.level)
    .bind(&b.audience)
    .bind(&depts)
    .bind(b.pinned)
    .bind(b.require_ack)
    .bind(b.starts_at)
    .bind(b.ends_at)
    .bind(user.id)
    .execute(&s.db)
    .await?;
    // Verfasser hat es gelesen
    sqlx::query("INSERT INTO announcement_reads (announcement_id, user_id, acked_at) VALUES ($1, $2, now())")
        .bind(id)
        .bind(user.id)
        .execute(&s.db)
        .await?;
    let mut c = s.db.acquire().await?;
    super::audit(
        &mut c,
        &user.actor(),
        "create",
        "announcement",
        id,
        json!({ "title": b.title, "audience": b.audience }),
    )
    .await?;
    publish_due(&s.db).await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

async fn owned(s: &AppState, user: &User, id: Uuid) -> ApiResult<()> {
    let by: Option<Option<Uuid>> =
        sqlx::query_scalar("SELECT created_by FROM announcements WHERE id = $1").bind(id).fetch_optional(&s.db).await?;
    match by {
        None => Err(ApiError::NotFound),
        Some(b) if b == Some(user.id) || user.role == Role::Admin => Ok(()),
        Some(_) => Err(ApiError::Forbidden),
    }
}

pub async fn update(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<In>,
) -> ApiResult<StatusCode> {
    owned(&s, &user, id).await?;
    check(&b)?;
    let depts = if b.audience == "departments" { b.departments.clone() } else { vec![] };
    sqlx::query(
        "UPDATE announcements SET title = $2, body = $3, level = $4, audience = $5, departments = $6, pinned = $7,
                require_ack = $8, starts_at = COALESCE($9, starts_at), ends_at = $10, updated_at = now()
          WHERE id = $1",
    )
    .bind(id)
    .bind(b.title.trim())
    .bind(b.body.trim())
    .bind(&b.level)
    .bind(&b.audience)
    .bind(&depts)
    .bind(b.pinned)
    .bind(b.require_ack)
    .bind(b.starts_at)
    .bind(b.ends_at)
    .execute(&s.db)
    .await?;
    publish_due(&s.db).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn remove(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    owned(&s, &user, id).await?;
    sqlx::query("DELETE FROM announcements WHERE id = $1").bind(id).execute(&s.db).await?;
    let mut c = s.db.acquire().await?;
    super::audit(&mut c, &user.actor(), "delete", "announcement", id, json!({})).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize, Default)]
pub struct ReadIn {
    #[serde(default)]
    pub ack: bool,
}

/// Gelesen (und optional bestätigt)
pub async fn read(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    body: Option<Json<ReadIn>>,
) -> ApiResult<StatusCode> {
    let ack = body.map(|b| b.ack).unwrap_or(false);
    let ok: bool =
        sqlx::query_scalar(&format!("SELECT EXISTS (SELECT 1 FROM announcements a WHERE a.id = $4 AND {VISIBLE})"))
            .bind(user.id)
            .bind(role_str(&user))
            .bind(&user.departments)
            .bind(id)
            .fetch_one(&s.db)
            .await?;
    if !ok {
        return Err(ApiError::NotFound);
    }
    sqlx::query(
        "INSERT INTO announcement_reads (announcement_id, user_id, acked_at) VALUES ($1, $2, CASE WHEN $3 THEN now() END)
         ON CONFLICT (announcement_id, user_id) DO UPDATE SET acked_at = COALESCE(announcement_reads.acked_at, EXCLUDED.acked_at)",
    )
    .bind(id)
    .bind(user.id)
    .bind(ack)
    .execute(&s.db)
    .await?;
    // zugehörige Benachrichtigung als gelesen markieren
    sqlx::query("UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE user_id = $1 AND kind = 'announcement' AND ref_id = $2")
        .bind(user.id)
        .bind(id)
        .execute(&s.db)
        .await?;
    super::chat::send_user(user.id, &json!({ "type": "announcement", "event": "read", "id": id }).to_string());
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Reader {
    pub id: Uuid,
    pub display_name: String,
    pub read_at: Option<DateTime<Utc>>,
    pub acked_at: Option<DateTime<Utc>>,
}

/// Wer hat gelesen/bestätigt (Verfasser/Admin)
pub async fn readers(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Vec<Reader>>> {
    owned(&s, &user, id).await?;
    let rows = sqlx::query_as(
        "SELECT z.id, z.display_name, r.read_at, r.acked_at
           FROM announcements a
           JOIN users z ON z.is_active AND z.role <> 'device' AND (
                a.audience = 'all' OR (a.audience = 'employees' AND z.role <> 'customer') OR (a.audience = 'customers' AND z.role = 'customer')
                OR (a.audience = 'departments' AND EXISTS (SELECT 1 FROM user_departments ud JOIN departments d ON d.id = ud.department_id
                                                             WHERE ud.user_id = z.id AND d.code = ANY(a.departments))))
           LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = z.id
          WHERE a.id = $1
          ORDER BY r.acked_at NULLS FIRST, r.read_at NULLS FIRST, z.display_name",
    )
    .bind(id)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

type DueRow = (Uuid, String, String, String, Vec<String>, String, Option<Uuid>, Option<String>);

/// Fällige Ankündigungen an die Zielgruppe melden (einmalig, auch für geplante)
pub async fn publish_due(db: &PgPool) -> Result<usize, sqlx::Error> {
    let due: Vec<DueRow> = sqlx::query_as(
        "UPDATE announcements a SET notified_at = now()
          WHERE notified_at IS NULL AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
         RETURNING id, title, level, audience, departments, body, created_by,
                   (SELECT display_name FROM users WHERE id = a.created_by)",
    )
    .fetch_all(db)
    .await?;
    for (id, title, level, audience, depts, body, by, author) in &due {
        let users: Vec<Uuid> = sqlx::query_scalar(
            "SELECT z.id FROM users z WHERE z.is_active AND z.role <> 'device' AND z.id IS DISTINCT FROM $3 AND (
                $1 = 'all' OR ($1 = 'employees' AND z.role <> 'customer') OR ($1 = 'customers' AND z.role = 'customer')
                OR ($1 = 'departments' AND (z.role = 'admin' OR EXISTS (SELECT 1 FROM user_departments ud JOIN departments d ON d.id = ud.department_id
                                                       WHERE ud.user_id = z.id AND d.code = ANY($2)))))",
        )
        .bind(audience)
        .bind(depts)
        .bind(by)
        .fetch_all(db)
        .await?;
        let preview: String = body.chars().take(160).collect();
        let mut n = super::notify::Note::new("announcement", "new", Some(*id), title).body(&preview).priority(
            match level.as_str() {
                "urgent" => 2,
                _ => 1,
            },
        );
        if let Some(a) = author {
            n = n.actor(a);
        }
        super::notify::deliver(db, &users, &n).await?;
    }
    Ok(due.len())
}

/// Geplante Ankündigungen zur Startzeit veröffentlichen
pub async fn worker(db: PgPool) {
    let mut tick = tokio::time::interval(std::time::Duration::from_secs(60));
    loop {
        tick.tick().await;
        if let Err(e) = publish_due(&db).await {
            tracing::warn!("Ankündigungen: {e}");
        }
    }
}
