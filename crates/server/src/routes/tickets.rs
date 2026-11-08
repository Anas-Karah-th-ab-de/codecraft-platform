//! Support-Tickets: Kunden melden Anliegen (optional zu einem Gerät oder Projekt), das Team
//! bearbeitet sie nach Priorität. Die Priorität ergibt sich aus der Dringlichkeit und dem
//! Servicevertrag (SLA) der Firma – Premium-Kunden kommen zuerst dran.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use codecraft_domain::access::Permission;
use codecraft_domain::access::Role;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

pub const URGENCIES: [&str; 4] = ["low", "normal", "high", "critical"];
pub const SLAS: [&str; 3] = ["basic", "business", "premium"];
const CATEGORIES: [&str; 6] = ["support", "device", "software", "billing", "feature", "other"];
const STATUSES: [&str; 5] = ["open", "in_progress", "waiting_customer", "resolved", "closed"];

/// 1 (sofort) … 5 (wenn Zeit ist)
pub fn priority(urgency: &str, sla: &str) -> i16 {
    let base: i16 = match urgency {
        "critical" => 1,
        "high" => 2,
        "low" => 4,
        _ => 3,
    };
    let shift: i16 = match sla {
        "premium" => -1,
        "business" => 0,
        _ => 1,
    };
    (base + shift).clamp(1, 5)
}

/// Reaktionszeit je Priorität
pub fn response_time(priority: i16) -> Duration {
    Duration::hours(match priority {
        1 => 1,
        2 => 4,
        3 => 8,
        4 => 24,
        _ => 72,
    })
}

fn is_staff(user: &User) -> bool {
    user.role.is_employee() && user.can(Permission::TicketWork)
}

/// Sichtbarkeit: Support-Team alles, Kunden die eigene Firma, jede/r die selbst angelegten Tickets
async fn ticket_org(s: &AppState, user: &User, id: Uuid) -> ApiResult<Option<Uuid>> {
    let row: Option<(Option<Uuid>, Option<Uuid>)> =
        sqlx::query_as("SELECT organization_id, created_by FROM tickets WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?;
    let (org, creator) = row.ok_or(ApiError::NotFound)?;
    if is_staff(user) || (org.is_some() && org == user.organization_id) || creator == Some(user.id) {
        Ok(org)
    } else {
        Err(ApiError::NotFound)
    }
}

/// Echtzeit-Hinweis an Benutzer (Portal/App)
fn notify(db: &sqlx::PgPool, actor: Uuid, users: &[Uuid], event: &str, ticket: Uuid, number: &str, subject: &str) {
    let msg =
        json!({ "type": "ticket", "event": event, "id": ticket, "number": number, "subject": subject }).to_string();
    for u in users {
        super::chat::send_user(*u, &msg);
    }
    let to: Vec<Uuid> = users.iter().copied().filter(|u| *u != actor).collect();
    let prio = if event == "new" { 2 } else { 1 };
    super::notify::emit(
        db,
        &to,
        super::notify::Note::new("ticket", event, Some(ticket), &format!("{number} · {subject}")).priority(prio),
    );
}

/// Support-Team: Abteilung SUP, Leitung und Admins
async fn support_team(s: &AppState) -> Vec<Uuid> {
    sqlx::query_scalar(
        "SELECT DISTINCT u.id FROM users u
           LEFT JOIN user_departments ud ON ud.user_id = u.id
           LEFT JOIN departments d ON d.id = ud.department_id
          WHERE u.is_active AND (u.role IN ('admin', 'lead') OR d.code = 'SUP')",
    )
    .fetch_all(&s.db)
    .await
    .unwrap_or_default()
}

/// Anfragende Seite: aktive Benutzer der Firma und wer das Ticket angelegt hat (z. B. interne Anfrage)
async fn customer_users(s: &AppState, org: Option<Uuid>, ticket: Uuid) -> Vec<Uuid> {
    sqlx::query_scalar(
        "SELECT id FROM users WHERE is_active AND ($1::uuid IS NOT NULL AND organization_id = $1)
         UNION SELECT u.id FROM tickets t JOIN users u ON u.id = t.created_by WHERE t.id = $2 AND u.is_active",
    )
    .bind(org)
    .bind(ticket)
    .fetch_all(&s.db)
    .await
    .unwrap_or_default()
}

#[derive(Serialize, sqlx::FromRow)]
pub struct TicketRow {
    pub id: Uuid,
    pub number: String,
    pub subject: String,
    pub category: String,
    pub urgency: String,
    pub sla: String,
    pub priority: i16,
    pub status: String,
    pub organization_id: Option<Uuid>,
    pub customer: Option<String>,
    pub assignee_id: Option<Uuid>,
    pub assignee: Option<String>,
    pub device: Option<String>,
    pub project: Option<String>,
    pub response_due_at: DateTime<Utc>,
    pub first_response_at: Option<DateTime<Utc>>,
    pub overdue: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: i64,
}

const SELECT: &str = "
    SELECT t.id, t.number, t.subject, t.category, t.urgency, t.sla, t.priority, t.status, t.organization_id,
           o.name AS customer, t.assignee_id, a.display_name AS assignee, d.name AS device, p.name AS project,
           t.response_due_at, t.first_response_at,
           (t.first_response_at IS NULL AND t.status = 'open' AND t.response_due_at < now()) AS overdue,
           t.created_at, t.updated_at,
           (SELECT count(*) FROM ticket_messages m WHERE m.ticket_id = t.id AND (NOT m.internal OR $1)) AS messages
      FROM tickets t
      LEFT JOIN organizations o ON o.id = t.organization_id
      LEFT JOIN users a ON a.id = t.assignee_id
      LEFT JOIN devices d ON d.id = t.device_id
      LEFT JOIN projects p ON p.id = t.project_id";

#[derive(Deserialize)]
pub struct ListQuery {
    /// open (alles Unerledigte, Standard) | done | all
    pub view: Option<String>,
    /// nur mir zugewiesene
    pub mine: Option<bool>,
}

/// Warteschlange: unerledigt zuerst, dann Priorität, dann Fälligkeit
pub async fn list(
    State(s): State<AppState>,
    user: User,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Vec<TicketRow>>> {
    let staff = is_staff(&user);
    // Mitarbeiter ohne Support-Rechte (bzw. Kunden ohne Firma) sehen ihre eigenen Anfragen
    let own = !staff && (user.role.is_employee() || user.organization_id.is_none());
    let view = q.view.unwrap_or_else(|| "open".into());
    let sql = format!(
        "{SELECT} WHERE ($2::uuid IS NULL OR t.organization_id = $2)
            AND (NOT $6 OR t.created_by = $5)
            AND ($3 = 'all' OR ($3 = 'open') = (t.status NOT IN ('resolved', 'closed')))
            AND (NOT $4 OR t.assignee_id = $5)
          ORDER BY (t.status IN ('resolved', 'closed')), t.priority, t.response_due_at
          LIMIT 500"
    );
    let rows = sqlx::query_as(&sql)
        .bind(staff)
        .bind(if staff || own { None } else { user.organization_id })
        .bind(&view)
        .bind(q.mine.unwrap_or(false))
        .bind(user.id)
        .bind(own)
        .fetch_all(&s.db)
        .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct NewTicket {
    pub subject: String,
    pub body: String,
    pub category: Option<String>,
    pub urgency: Option<String>,
    pub device_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    /// nur Mitarbeiter: für einen Kunden anlegen
    pub organization_id: Option<Uuid>,
}

pub async fn create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewTicket>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let org = if is_staff(&user) {
        b.organization_id
    } else if user.role.is_employee() {
        None // interne Anfrage an das Support-Team
    } else {
        Some(user.organization_id.ok_or(ApiError::Forbidden)?)
    };
    let category = b.category.unwrap_or_else(|| "support".into());
    let urgency = b.urgency.unwrap_or_else(|| "normal".into());
    if !CATEGORIES.contains(&category.as_str()) || !URGENCIES.contains(&urgency.as_str()) {
        return Err(ApiError::BadRequest("Kategorie oder Dringlichkeit ungültig".into()));
    }
    let subject = b.subject.trim();
    let body = b.body.trim();
    if subject.chars().count() < 3 || subject.chars().count() > 200 || body.is_empty() {
        return Err(ApiError::BadRequest("Betreff (3–200 Zeichen) und Beschreibung angeben".into()));
    }
    // Gerät/Projekt müssen zur Firma gehören
    for (table, id) in [("devices", b.device_id), ("projects", b.project_id)] {
        if let Some(id) = id {
            let ok: bool = sqlx::query_scalar(&format!(
                "SELECT EXISTS (SELECT 1 FROM {table} WHERE id = $1 AND organization_id IS NOT DISTINCT FROM $2)"
            ))
            .bind(id)
            .bind(org)
            .fetch_one(&s.db)
            .await?;
            if !ok {
                return Err(ApiError::BadRequest("Gerät oder Projekt gehört nicht zu dieser Firma".into()));
            }
        }
    }
    let sla: String = match org {
        Some(o) => sqlx::query_scalar("SELECT sla FROM organizations WHERE id = $1")
            .bind(o)
            .fetch_optional(&s.db)
            .await?
            .ok_or_else(|| ApiError::BadRequest("Firma unbekannt".into()))?,
        None => "business".into(),
    };
    let prio = priority(&urgency, &sla);
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    let n: i64 = sqlx::query_scalar("SELECT nextval('ticket_number_seq')").fetch_one(&mut *tx).await?;
    let number = format!("T-{}-{n:05}", Utc::now().format("%Y"));
    sqlx::query(
        "INSERT INTO tickets (id, number, organization_id, created_by, subject, category, device_id, project_id,
                              urgency, sla, priority, response_due_at, department_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now() + make_interval(secs => $12),
                 (SELECT id FROM departments WHERE code = CASE WHEN $6 IN ('software','feature') THEN 'DEV'
                                                               WHEN $6 = 'billing' THEN 'ACC' ELSE 'SUP' END))",
    )
    .bind(id)
    .bind(&number)
    .bind(org)
    .bind(user.id)
    .bind(subject)
    .bind(&category)
    .bind(b.device_id)
    .bind(b.project_id)
    .bind(&urgency)
    .bind(&sla)
    .bind(prio)
    .bind(response_time(prio).num_seconds() as f64)
    .execute(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO ticket_messages (id, ticket_id, author_id, body) VALUES ($1,$2,$3,$4)")
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(user.id)
        .bind(body)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "create", "ticket", id, json!({ "number": number, "priority": prio })).await?;
    tx.commit().await?;
    notify(&s.db, user.id, &support_team(&s).await, "new", id, &number, subject);
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "number": number, "priority": prio }))))
}

pub async fn get(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    ticket_org(&s, &user, id).await?;
    let staff = is_staff(&user);
    let t: TicketRow =
        sqlx::query_as(&format!("{SELECT} WHERE t.id = $2")).bind(staff).bind(id).fetch_one(&s.db).await?;
    type Msg = (Uuid, Option<String>, Option<String>, String, bool, DateTime<Utc>);
    let msgs: Vec<Msg> = sqlx::query_as(
        "SELECT m.id, u.display_name, u.role, m.body, m.internal, m.created_at
           FROM ticket_messages m LEFT JOIN users u ON u.id = m.author_id
          WHERE m.ticket_id = $1 AND (NOT m.internal OR $2) ORDER BY m.created_at",
    )
    .bind(id)
    .bind(staff)
    .fetch_all(&s.db)
    .await?;
    let mut v = serde_json::to_value(t).unwrap_or_default();
    v["thread"] = json!(msgs
        .iter()
        .map(|m| json!({
            "id": m.0, "author": m.1, "team": m.2.as_deref().is_some_and(|r| r != "customer"),
            "body": m.3, "internal": m.4, "at": m.5,
        }))
        .collect::<Vec<_>>());
    Ok(Json(v))
}

#[derive(Deserialize)]
pub struct NewMessage {
    pub body: String,
    #[serde(default)]
    pub internal: bool,
}

pub async fn reply(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<NewMessage>,
) -> ApiResult<StatusCode> {
    let org = ticket_org(&s, &user, id).await?;
    let staff = is_staff(&user);
    let body = b.body.trim();
    if body.is_empty() || body.len() > 20000 {
        return Err(ApiError::BadRequest("Nachricht fehlt oder ist zu lang".into()));
    }
    let internal = b.internal && staff;
    let mut tx = s.db.begin().await?;
    sqlx::query("INSERT INTO ticket_messages (id, ticket_id, author_id, body, internal) VALUES ($1,$2,$3,$4,$5)")
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(user.id)
        .bind(body)
        .bind(internal)
        .execute(&mut *tx)
        .await?;
    // Team antwortet → erste Reaktion, wartet auf Kunde; Kunde antwortet → wieder offen
    let (number, subject, assignee): (String, String, Option<Uuid>) = if staff && !internal {
        sqlx::query_as(
            "UPDATE tickets SET first_response_at = COALESCE(first_response_at, now()),
                    status = CASE WHEN status IN ('open', 'in_progress') THEN 'waiting_customer' ELSE status END,
                    assignee_id = COALESCE(assignee_id, $2), updated_at = now()
              WHERE id = $1 RETURNING number, subject, assignee_id",
        )
        .bind(id)
        .bind(user.id)
        .fetch_one(&mut *tx)
        .await?
    } else if !staff {
        sqlx::query_as(
            "UPDATE tickets SET status = CASE WHEN status IN ('waiting_customer', 'resolved') THEN 'open' ELSE status END,
                    updated_at = now() WHERE id = $1 RETURNING number, subject, assignee_id",
        )
        .bind(id)
        .fetch_one(&mut *tx)
        .await?
    } else {
        sqlx::query_as("UPDATE tickets SET updated_at = now() WHERE id = $1 RETURNING number, subject, assignee_id")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?
    };
    tx.commit().await?;
    let to = if staff {
        if internal {
            assignee.into_iter().filter(|a| *a != user.id).collect()
        } else {
            customer_users(&s, org, id).await
        }
    } else {
        match assignee {
            Some(a) => vec![a],
            None => support_team(&s).await,
        }
    };
    notify(&s.db, user.id, &to, "message", id, &number, &subject);
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct Patch {
    pub status: Option<String>,
    /// leere UUID-Zeichenkette nicht erlaubt; `null` über `unassign`
    pub assignee_id: Option<Uuid>,
    #[serde(default)]
    pub unassign: bool,
    pub urgency: Option<String>,
}

pub async fn patch(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Patch>,
) -> ApiResult<StatusCode> {
    let org = ticket_org(&s, &user, id).await?;
    let staff = is_staff(&user);
    if let Some(st) = &b.status {
        if !STATUSES.contains(&st.as_str()) {
            return Err(ApiError::BadRequest("Status ungültig".into()));
        }
        // Kunden dürfen nur schließen oder wieder öffnen
        if !staff && !matches!(st.as_str(), "closed" | "open") {
            return Err(ApiError::Forbidden);
        }
    }
    if !staff && (b.assignee_id.is_some() || b.unassign || b.urgency.is_some()) {
        return Err(ApiError::Forbidden);
    }
    // Bearbeiter heute im Urlaub mit Vertretung → Vertretung übernimmt
    let mut b = b;
    if let Some(a) = b.assignee_id {
        if let Some(sub) = super::hr::substitute_today(&s.db, a).await {
            b.assignee_id = Some(sub);
        }
    }
    if let Some(a) = b.assignee_id {
        let ok: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND is_active AND role NOT IN ('customer', 'device'))",
        )
        .bind(a)
        .fetch_one(&s.db)
        .await?;
        if !ok {
            return Err(ApiError::BadRequest("Bearbeiter muss ein aktiver Mitarbeiter sein".into()));
        }
    }
    if let Some(u) = &b.urgency {
        if !URGENCIES.contains(&u.as_str()) {
            return Err(ApiError::BadRequest("Dringlichkeit ungültig".into()));
        }
    }
    let mut tx = s.db.begin().await?;
    let (number, subject, sla, urgency): (String, String, String, String) = sqlx::query_as(
        "UPDATE tickets SET
            status = COALESCE($2, status),
            resolved_at = CASE WHEN $2 IN ('resolved', 'closed') THEN COALESCE(resolved_at, now())
                               WHEN $2 IS NOT NULL THEN NULL ELSE resolved_at END,
            assignee_id = CASE WHEN $4 THEN NULL ELSE COALESCE($3, assignee_id) END,
            urgency = COALESCE($5, urgency),
            updated_at = now()
          WHERE id = $1 RETURNING number, subject, sla, urgency",
    )
    .bind(id)
    .bind(&b.status)
    .bind(b.assignee_id)
    .bind(b.unassign)
    .bind(&b.urgency)
    .fetch_one(&mut *tx)
    .await?;
    if b.urgency.is_some() {
        let p = priority(&urgency, &sla);
        sqlx::query(
            "UPDATE tickets SET priority = $2,
                    response_due_at = LEAST(response_due_at, created_at + make_interval(secs => $3))
              WHERE id = $1",
        )
        .bind(id)
        .bind(p)
        .bind(response_time(p).num_seconds() as f64)
        .execute(&mut *tx)
        .await?;
    }
    super::audit(
        &mut tx,
        &user.actor(),
        "update",
        "ticket",
        id,
        json!({ "status": b.status, "assignee": b.assignee_id, "unassign": b.unassign, "urgency": b.urgency }),
    )
    .await?;
    tx.commit().await?;
    let mut to = customer_users(&s, org, id).await;
    if let Some(a) = b.assignee_id {
        to.push(a);
    }
    to.retain(|u| *u != user.id);
    notify(&s.db, user.id, &to, "update", id, &number, &subject);
    Ok(StatusCode::NO_CONTENT)
}

/// Kennzahlen für das Team-Dashboard
pub async fn stats(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    if !is_staff(&user) {
        return Err(ApiError::Forbidden);
    }
    let (open, overdue, unassigned, mine): (i64, i64, i64, i64) = sqlx::query_as(
        "SELECT count(*) FILTER (WHERE status NOT IN ('resolved','closed')),
                count(*) FILTER (WHERE status = 'open' AND first_response_at IS NULL AND response_due_at < now()),
                count(*) FILTER (WHERE status NOT IN ('resolved','closed') AND assignee_id IS NULL),
                count(*) FILTER (WHERE status NOT IN ('resolved','closed') AND assignee_id = $1)
           FROM tickets",
    )
    .bind(user.id)
    .fetch_one(&s.db)
    .await?;
    Ok(Json(json!({ "open": open, "overdue": overdue, "unassigned": unassigned, "mine": mine })))
}

#[derive(Deserialize)]
pub struct SlaBody {
    pub sla: String,
}

/// Servicevertrag einer Firma setzen (Leitung/Admin)
pub async fn set_sla(
    State(s): State<AppState>,
    user: User,
    Path(org): Path<Uuid>,
    Json(b): Json<SlaBody>,
) -> ApiResult<StatusCode> {
    if !matches!(user.role, Role::Admin | Role::Lead) {
        return Err(ApiError::Forbidden);
    }
    if !SLAS.contains(&b.sla.as_str()) {
        return Err(ApiError::BadRequest("SLA ungültig".into()));
    }
    let r =
        sqlx::query("UPDATE organizations SET sla = $2 WHERE id = $1").bind(org).bind(&b.sla).execute(&s.db).await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    let mut c = s.db.acquire().await?;
    super::audit(&mut c, &user.actor(), "sla", "organization", org, json!({ "sla": b.sla })).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn priority_follows_sla() {
        assert_eq!(priority("critical", "premium"), 1);
        assert_eq!(priority("critical", "basic"), 2);
        assert_eq!(priority("normal", "premium"), 2);
        assert_eq!(priority("normal", "basic"), 4);
        assert_eq!(priority("low", "basic"), 5);
        assert_eq!(priority("high", "business"), 2);
        assert_eq!(response_time(1), Duration::hours(1));
        assert_eq!(response_time(5), Duration::hours(72));
    }
}
