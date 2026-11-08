//! Entwicklungsanfragen: Kunden beschreiben ein neues Projekt oder eine Erweiterung, das Team
//! prüft, schickt einen Kostenvoranschlag und macht daraus ein Projekt (mit Fortschritt).

use super::shop::{notify, org_users, team};
use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, NaiveDate, Utc};
use codecraft_domain::access::Permission;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

const KINDS: [&str; 5] = ["new_project", "feature", "change", "integration", "other"];
const STATUSES: [&str; 7] = ["submitted", "in_review", "quoted", "accepted", "rejected", "in_progress", "done"];

fn scope(user: &User) -> ApiResult<Option<Uuid>> {
    if user.role.is_employee() {
        user.require(Permission::ProjectRead, None)?;
        Ok(None)
    } else {
        Ok(Some(user.organization_id.ok_or(ApiError::Forbidden)?))
    }
}

async fn visible(s: &AppState, user: &User, id: Uuid) -> ApiResult<(Uuid, String, String)> {
    let org = scope(user)?;
    let row: (Uuid, String, String) =
        sqlx::query_as("SELECT organization_id, number, title FROM dev_requests WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?
            .ok_or(ApiError::NotFound)?;
    if org.is_some_and(|o| o != row.0) {
        return Err(ApiError::NotFound);
    }
    Ok(row)
}

#[derive(Deserialize)]
pub struct NewRequest {
    pub kind: Option<String>,
    pub title: String,
    pub description: String,
    pub budget: Option<String>,
    pub desired_date: Option<NaiveDate>,
    pub project_id: Option<Uuid>,
    pub organization_id: Option<Uuid>,
}

pub async fn create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewRequest>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let org = match scope(&user)? {
        Some(o) => o,
        None => b.organization_id.ok_or_else(|| ApiError::BadRequest("Kunde fehlt".into()))?,
    };
    let kind = b.kind.unwrap_or_else(|| "new_project".into());
    if !KINDS.contains(&kind.as_str()) {
        return Err(ApiError::BadRequest("Art ungültig".into()));
    }
    let title = b.title.trim();
    let desc = b.description.trim();
    if title.chars().count() < 3 || title.chars().count() > 200 || desc.is_empty() || desc.len() > 20000 {
        return Err(ApiError::BadRequest("Titel (3–200 Zeichen) und Beschreibung angeben".into()));
    }
    let budget = b.budget.map(|x| x.trim().chars().take(100).collect::<String>()).filter(|x| !x.is_empty());
    if let Some(p) = b.project_id {
        let ok: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM projects WHERE id = $1 AND organization_id = $2)")
                .bind(p)
                .bind(org)
                .fetch_one(&s.db)
                .await?;
        if !ok {
            return Err(ApiError::BadRequest("Projekt gehört nicht zu dieser Firma".into()));
        }
    }
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    let n: i64 = sqlx::query_scalar("SELECT nextval('request_number_seq')").fetch_one(&mut *tx).await?;
    let number = format!("A-{}-{n:05}", Utc::now().format("%Y"));
    sqlx::query(
        "INSERT INTO dev_requests (id, number, organization_id, created_by, kind, title, description, budget, desired_date, project_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    )
    .bind(id)
    .bind(&number)
    .bind(org)
    .bind(user.id)
    .bind(&kind)
    .bind(title)
    .bind(desc)
    .bind(&budget)
    .bind(b.desired_date)
    .bind(b.project_id)
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "create", "dev_request", id, json!({ "number": number })).await?;
    tx.commit().await?;
    notify(&s.db, user.id, &team(&s, "DEV").await, "request", "new", id, &number, title);
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "number": number }))))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RequestRow {
    pub id: Uuid,
    pub number: String,
    pub organization_id: Uuid,
    pub customer: String,
    pub kind: String,
    pub title: String,
    pub description: String,
    pub budget: Option<String>,
    pub desired_date: Option<NaiveDate>,
    pub status: String,
    pub project_id: Option<Uuid>,
    pub project: Option<String>,
    pub project_progress: Option<i32>,
    pub quote_id: Option<Uuid>,
    pub quote_number: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

const SELECT: &str = "
    SELECT r.id, r.number, r.organization_id, o.name AS customer, r.kind, r.title, r.description, r.budget, r.desired_date,
           r.status, r.project_id, p.name AS project,
           CASE WHEN p.id IS NULL THEN NULL ELSE (SELECT CASE WHEN count(*) = 0 THEN p.progress::int
                 ELSE (100 * count(*) FILTER (WHERE m.status = 'done') / count(*))::int END
                 FROM project_milestones m WHERE m.project_id = p.id) END AS project_progress,
           r.quote_id, q.number AS quote_number, r.created_at, r.updated_at
      FROM dev_requests r JOIN organizations o ON o.id = r.organization_id
      LEFT JOIN projects p ON p.id = r.project_id
      LEFT JOIN quotes q ON q.id = r.quote_id AND (q.status <> 'draft' OR $2)";

pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<RequestRow>>> {
    let org = scope(&user)?;
    let rows = sqlx::query_as(&format!(
        "{SELECT} WHERE ($1::uuid IS NULL OR r.organization_id = $1)
          ORDER BY (r.status IN ('done','rejected')), r.created_at DESC LIMIT 500"
    ))
    .bind(org)
    .bind(user.role.is_employee())
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

pub async fn get(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    visible(&s, &user, id).await?;
    let r: RequestRow = sqlx::query_as(&format!("{SELECT} WHERE r.id = $1"))
        .bind(id)
        .bind(user.role.is_employee())
        .fetch_one(&s.db)
        .await?;
    type Msg = (Uuid, Option<String>, Option<String>, String, DateTime<Utc>);
    let msgs: Vec<Msg> = sqlx::query_as(
        "SELECT m.id, u.display_name, u.role, m.body, m.created_at FROM dev_request_messages m
           LEFT JOIN users u ON u.id = m.author_id WHERE m.request_id = $1 ORDER BY m.created_at",
    )
    .bind(id)
    .fetch_all(&s.db)
    .await?;
    let mut v = serde_json::to_value(r).unwrap_or_default();
    v["thread"] = json!(msgs
        .iter()
        .map(|m| json!({ "id": m.0, "author": m.1, "team": m.2.as_deref().is_some_and(|r| r != "customer"), "body": m.3, "at": m.4 }))
        .collect::<Vec<_>>());
    Ok(Json(v))
}

#[derive(Deserialize)]
pub struct Reply {
    pub body: String,
}

pub async fn reply(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Reply>,
) -> ApiResult<StatusCode> {
    let (org, number, title) = visible(&s, &user, id).await?;
    let body = b.body.trim();
    if body.is_empty() || body.len() > 20000 {
        return Err(ApiError::BadRequest("Nachricht fehlt oder ist zu lang".into()));
    }
    sqlx::query("INSERT INTO dev_request_messages (id, request_id, author_id, body) VALUES ($1,$2,$3,$4)")
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(user.id)
        .bind(body)
        .execute(&s.db)
        .await?;
    sqlx::query("UPDATE dev_requests SET updated_at = now() WHERE id = $1").bind(id).execute(&s.db).await?;
    let to = if user.role.is_employee() { org_users(&s, org).await } else { team(&s, "DEV").await };
    notify(&s.db, user.id, &to, "request", "message", id, &number, &title);
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct Patch {
    pub status: Option<String>,
    pub quote_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
}

/// Team: Status, Kostenvoranschlag, Projekt; Kunde: Angebot annehmen/ablehnen
pub async fn patch(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Patch>,
) -> ApiResult<StatusCode> {
    let (org, number, title) = visible(&s, &user, id).await?;
    let staff = user.role.is_employee();
    if let Some(st) = &b.status {
        if !STATUSES.contains(&st.as_str()) {
            return Err(ApiError::BadRequest("Status ungültig".into()));
        }
        if !staff {
            let cur: String =
                sqlx::query_scalar("SELECT status FROM dev_requests WHERE id = $1").bind(id).fetch_one(&s.db).await?;
            if !(cur == "quoted" && matches!(st.as_str(), "accepted" | "rejected")) {
                return Err(ApiError::Forbidden);
            }
        }
    }
    if !staff && (b.quote_id.is_some() || b.project_id.is_some()) {
        return Err(ApiError::Forbidden);
    }
    if staff {
        user.require(Permission::ProjectWrite, None)?;
    }
    for (table, v) in [("quotes", b.quote_id), ("projects", b.project_id)] {
        if let Some(v) = v {
            let ok: bool = sqlx::query_scalar(&format!(
                "SELECT EXISTS (SELECT 1 FROM {table} WHERE id = $1 AND organization_id = $2)"
            ))
            .bind(v)
            .bind(org)
            .fetch_one(&s.db)
            .await?;
            if !ok {
                return Err(ApiError::BadRequest("Angebot/Projekt gehört nicht zu dieser Firma".into()));
            }
        }
    }
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "UPDATE dev_requests SET status = COALESCE($2, status), quote_id = COALESCE($3, quote_id),
                project_id = COALESCE($4, project_id), updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .bind(&b.status)
    .bind(b.quote_id)
    .bind(b.project_id)
    .execute(&mut *tx)
    .await?;
    super::audit(
        &mut tx,
        &user.actor(),
        "update",
        "dev_request",
        id,
        json!({ "status": b.status, "quote": b.quote_id, "project": b.project_id }),
    )
    .await?;
    tx.commit().await?;
    let to = if staff { org_users(&s, org).await } else { team(&s, "DEV").await };
    notify(&s.db, user.id, &to, "request", "update", id, &number, &title);
    Ok(StatusCode::NO_CONTENT)
}

pub(crate) fn slug(title: &str) -> String {
    let mut out = String::new();
    for c in title.to_lowercase().chars() {
        let c = match c {
            'ä' => 'a',
            'ö' => 'o',
            'ü' => 'u',
            'ß' => 's',
            c => c,
        };
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    out.trim_matches('-').chars().take(40).collect::<String>().trim_matches('-').to_string()
}

/// Team: aus der Anfrage ein Projekt anlegen (Status „in Arbeit“, Kunde sieht den Fortschritt)
pub async fn to_project(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    user.require(Permission::ProjectWrite, None)?;
    let (org, number, title) = visible(&s, &user, id).await?;
    let (existing, desc, kind, date): (Option<Uuid>, String, String, Option<NaiveDate>) =
        sqlx::query_as("SELECT project_id, description, kind, desired_date FROM dev_requests WHERE id = $1")
            .bind(id)
            .fetch_one(&s.db)
            .await?;
    if let Some(p) = existing {
        return Err(ApiError::Conflict(format!("Projekt existiert bereits ({p})")));
    }
    let pid = Uuid::now_v7();
    let base = slug(&title);
    let slug = format!("{}-{}", if base.is_empty() { "projekt" } else { &base }, &pid.simple().to_string()[24..]);
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "INSERT INTO projects (id, organization_id, department_id, name, slug, code, description, status, start_date, target_date, kind)
         VALUES ($1, $2, (SELECT id FROM departments WHERE code = 'DEV'), $3, $4, $5, $6, 'active', CURRENT_DATE, $7, 'customer')",
    )
    .bind(pid)
    .bind(org)
    .bind(&title)
    .bind(&slug)
    .bind(&number)
    .bind(format!("{desc}\n\n({kind})"))
    .bind(date)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE dev_requests SET project_id = $2, status = 'in_progress', updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(pid)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "to_project", "dev_request", id, json!({ "project": pid })).await?;
    tx.commit().await?;
    notify(&s.db, user.id, &org_users(&s, org).await, "request", "update", id, &number, &title);
    Ok((StatusCode::CREATED, Json(json!({ "project_id": pid }))))
}

#[cfg(test)]
mod tests {
    #[test]
    fn slugs() {
        assert_eq!(super::slug("Neue Kassen-App für Bäckerei!"), "neue-kassen-app-fur-backerei");
        assert_eq!(super::slug("نظام"), "");
    }
}
