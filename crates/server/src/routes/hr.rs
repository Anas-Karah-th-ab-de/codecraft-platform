//! Mitarbeiter-Bereich: Zeiterfassung (Stempeluhr + manuell), Urlaub/Abwesenheit mit Genehmigung
//! und Vertretung, Kalender mit Einladungen. Abteilungsleiter verwalten ihre Abteilungen, Admins alle:
//! Zeiten einsehen/korrigieren, Urlaub genehmigen, Vertretung festlegen, verbindliche Termine vorgeben.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Datelike, NaiveDate, Utc, Weekday};
use codecraft_domain::access::Role;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

fn employee(user: &User) -> ApiResult<()> {
    if user.role.is_employee() {
        Ok(())
    } else {
        Err(ApiError::Forbidden)
    }
}

/// Darf `actor` die Daten von `target` verwalten? Admin: alle; Abteilungsleiter: gleiche Abteilung.
pub async fn manages(db: &PgPool, actor: &User, target: Uuid) -> ApiResult<bool> {
    if actor.role == Role::Admin {
        return Ok(true);
    }
    if actor.role != Role::Lead || actor.id == target {
        return Ok(false);
    }
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM user_departments a JOIN user_departments b ON a.department_id = b.department_id
                         WHERE a.user_id = $1 AND b.user_id = $2)",
    )
    .bind(actor.id)
    .bind(target)
    .fetch_one(db)
    .await?)
}

/// Eigene Daten oder verwaltete Mitarbeiter
async fn may_see(db: &PgPool, actor: &User, target: Uuid) -> ApiResult<()> {
    if actor.id == target || manages(db, actor, target).await? {
        Ok(())
    } else {
        Err(ApiError::Forbidden)
    }
}

/// Mitarbeiter, die `actor` verwaltet (für Team-Ansichten)
async fn team_of(db: &PgPool, actor: &User) -> ApiResult<Vec<Uuid>> {
    Ok(match actor.role {
        Role::Admin => {
            sqlx::query_scalar("SELECT id FROM users WHERE is_active AND role NOT IN ('customer','device')").fetch_all(db).await?
        }
        Role::Lead => sqlx::query_scalar(
            "SELECT DISTINCT b.user_id FROM user_departments a JOIN user_departments b ON a.department_id = b.department_id
               JOIN users u ON u.id = b.user_id WHERE a.user_id = $1 AND u.is_active",
        )
        .bind(actor.id)
        .fetch_all(db)
        .await?,
        _ => vec![actor.id],
    })
}

fn notify(users: &[Uuid], kind: &str, event: &str, id: Uuid, title: &str) {
    let msg = json!({ "type": kind, "event": event, "id": id, "title": title }).to_string();
    for u in users {
        super::chat::send_user(*u, &msg);
    }
}

// ── Zeiterfassung ──────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct TimeRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub break_minutes: i32,
    pub minutes: i64,
    pub project_id: Option<Uuid>,
    pub project: Option<String>,
    pub ticket_id: Option<Uuid>,
    pub note: String,
    pub source: String,
    pub edited: bool,
}

const TIME_SELECT: &str = "
    SELECT t.id, t.user_id, u.display_name AS user_name, t.started_at, t.ended_at, t.break_minutes,
           GREATEST(0, (EXTRACT(EPOCH FROM (COALESCE(t.ended_at, now()) - t.started_at)) / 60)::bigint - t.break_minutes) AS minutes,
           t.project_id, p.name AS project, t.ticket_id, t.note, t.source, t.edited_by IS NOT NULL AS edited
      FROM time_entries t JOIN users u ON u.id = t.user_id LEFT JOIN projects p ON p.id = t.project_id";

#[derive(Deserialize)]
pub struct TimeQuery {
    pub user: Option<Uuid>,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

pub async fn time_list(State(s): State<AppState>, user: User, Query(q): Query<TimeQuery>) -> ApiResult<Json<Value>> {
    employee(&user)?;
    let target = q.user.unwrap_or(user.id);
    may_see(&s.db, &user, target).await?;
    let today = Utc::now().date_naive();
    let from = q.from.unwrap_or(today - chrono::Duration::days(30));
    let to = q.to.unwrap_or(today);
    let rows: Vec<TimeRow> = sqlx::query_as(&format!(
        "{TIME_SELECT} WHERE t.user_id = $1 AND t.started_at >= $2::date AND t.started_at < $3::date + 1
          ORDER BY t.started_at DESC LIMIT 2000"
    ))
    .bind(target)
    .bind(from)
    .bind(to)
    .fetch_all(&s.db)
    .await?;
    let total: i64 = rows.iter().map(|r| r.minutes).sum();
    Ok(Json(json!({ "entries": rows, "total_minutes": total, "from": from, "to": to })))
}

/// Laufender Eintrag + Summen heute/Woche
pub async fn time_status(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    employee(&user)?;
    let running: Option<TimeRow> =
        sqlx::query_as(&format!("{TIME_SELECT} WHERE t.user_id = $1 AND t.ended_at IS NULL"))
            .bind(user.id)
            .fetch_optional(&s.db)
            .await?;
    let (today, week): (i64, i64) = sqlx::query_as(
        "SELECT
            COALESCE(sum(m) FILTER (WHERE started_at >= date_trunc('day', now())), 0)::bigint,
            COALESCE(sum(m) FILTER (WHERE started_at >= date_trunc('week', now())), 0)::bigint
           FROM (SELECT started_at, GREATEST(0, (EXTRACT(EPOCH FROM (COALESCE(ended_at, now()) - started_at)) / 60)::bigint - break_minutes) AS m
                   FROM time_entries WHERE user_id = $1 AND started_at >= date_trunc('week', now()) - interval '1 day') x",
    )
    .bind(user.id)
    .fetch_one(&s.db)
    .await?;
    Ok(Json(json!({ "running": running, "today_minutes": today, "week_minutes": week })))
}

#[derive(Deserialize)]
pub struct Clock {
    /// in | out
    pub action: String,
    #[serde(default)]
    pub note: String,
    pub project_id: Option<Uuid>,
    #[serde(default)]
    pub break_minutes: i32,
}

pub async fn clock(State(s): State<AppState>, user: User, Json(b): Json<Clock>) -> ApiResult<Json<Value>> {
    employee(&user)?;
    match b.action.as_str() {
        "in" => {
            let id = Uuid::now_v7();
            let r = sqlx::query(
                "INSERT INTO time_entries (id, user_id, started_at, project_id, note) VALUES ($1,$2,now(),$3,$4) ON CONFLICT DO NOTHING",
            )
            .bind(id)
            .bind(user.id)
            .bind(b.project_id)
            .bind(b.note.trim())
            .execute(&s.db)
            .await?;
            if r.rows_affected() == 0 {
                return Err(ApiError::Conflict("Sie sind bereits eingestempelt".into()));
            }
            Ok(Json(json!({ "id": id })))
        }
        "out" => {
            if !(0..=600).contains(&b.break_minutes) {
                return Err(ApiError::BadRequest("Pause 0–600 Minuten".into()));
            }
            // Mehr als 16 h am Stück ist sicher ein vergessenes Ausstempeln → auf 16 h begrenzen
            let id: Option<Uuid> = sqlx::query_scalar(
                "UPDATE time_entries SET ended_at = LEAST(now(), started_at + interval '16 hours'),
                        break_minutes = $2, note = CASE WHEN $3 = '' THEN note ELSE $3 END
                  WHERE user_id = $1 AND ended_at IS NULL RETURNING id",
            )
            .bind(user.id)
            .bind(b.break_minutes)
            .bind(b.note.trim())
            .fetch_optional(&s.db)
            .await?;
            let id = id.ok_or_else(|| ApiError::Conflict("Sie sind nicht eingestempelt".into()))?;
            Ok(Json(json!({ "id": id })))
        }
        _ => Err(ApiError::BadRequest("action: in oder out".into())),
    }
}

#[derive(Deserialize)]
pub struct TimeInput {
    /// nur Leiter/Admin: für einen Mitarbeiter erfassen
    pub user_id: Option<Uuid>,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    #[serde(default)]
    pub break_minutes: i32,
    pub project_id: Option<Uuid>,
    pub ticket_id: Option<Uuid>,
    #[serde(default)]
    pub note: String,
}

fn check_span(b: &TimeInput) -> ApiResult<()> {
    if b.ended_at <= b.started_at || b.ended_at - b.started_at > chrono::Duration::hours(16) {
        return Err(ApiError::BadRequest("Ende muss nach Beginn liegen (höchstens 16 Stunden)".into()));
    }
    if b.ended_at > Utc::now() + chrono::Duration::minutes(5) {
        return Err(ApiError::BadRequest("Zeiten in der Zukunft sind nicht möglich".into()));
    }
    if !(0..=600).contains(&b.break_minutes) {
        return Err(ApiError::BadRequest("Pause 0–600 Minuten".into()));
    }
    Ok(())
}

async fn overlaps(
    db: &PgPool,
    user: Uuid,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
    except: Option<Uuid>,
) -> ApiResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM time_entries WHERE user_id = $1 AND id IS DISTINCT FROM $4
                          AND tstzrange(started_at, COALESCE(ended_at, now())) && tstzrange($2, $3))",
    )
    .bind(user)
    .bind(from)
    .bind(to)
    .bind(except)
    .fetch_one(db)
    .await?)
}

pub async fn time_add(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<TimeInput>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    employee(&user)?;
    let target = b.user_id.unwrap_or(user.id);
    if target != user.id && !manages(&s.db, &user, target).await? {
        return Err(ApiError::Forbidden);
    }
    check_span(&b)?;
    if overlaps(&s.db, target, b.started_at, b.ended_at, None).await? {
        return Err(ApiError::Conflict("Überschneidet sich mit einem vorhandenen Eintrag".into()));
    }
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "INSERT INTO time_entries (id, user_id, started_at, ended_at, break_minutes, project_id, ticket_id, note, source, edited_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'manual',$9)",
    )
    .bind(id)
    .bind(target)
    .bind(b.started_at)
    .bind(b.ended_at)
    .bind(b.break_minutes)
    .bind(b.project_id)
    .bind(b.ticket_id)
    .bind(b.note.trim())
    .bind((target != user.id).then_some(user.id))
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "time_add", "user", target, json!({ "entry": id })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

pub async fn time_update(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<TimeInput>,
) -> ApiResult<StatusCode> {
    employee(&user)?;
    let owner: Uuid = sqlx::query_scalar("SELECT user_id FROM time_entries WHERE id = $1")
        .bind(id)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    let manager = manages(&s.db, &user, owner).await?;
    if owner != user.id && !manager {
        return Err(ApiError::Forbidden);
    }
    // Eigene Einträge nur 14 Tage rückwirkend ändern, danach nur Leitung
    if owner == user.id && !manager && b.started_at < Utc::now() - chrono::Duration::days(14) {
        return Err(ApiError::Forbidden);
    }
    check_span(&b)?;
    if overlaps(&s.db, owner, b.started_at, b.ended_at, Some(id)).await? {
        return Err(ApiError::Conflict("Überschneidet sich mit einem vorhandenen Eintrag".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "UPDATE time_entries SET started_at = $2, ended_at = $3, break_minutes = $4, project_id = $5, ticket_id = $6, note = $7,
                edited_by = CASE WHEN $8 THEN $9 ELSE edited_by END WHERE id = $1",
    )
    .bind(id)
    .bind(b.started_at)
    .bind(b.ended_at)
    .bind(b.break_minutes)
    .bind(b.project_id)
    .bind(b.ticket_id)
    .bind(b.note.trim())
    .bind(owner != user.id)
    .bind(user.id)
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "time_update", "user", owner, json!({ "entry": id })).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn time_delete(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    employee(&user)?;
    let (owner, started): (Uuid, DateTime<Utc>) =
        sqlx::query_as("SELECT user_id, started_at FROM time_entries WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?
            .ok_or(ApiError::NotFound)?;
    let manager = manages(&s.db, &user, owner).await?;
    if !(manager || (owner == user.id && started > Utc::now() - chrono::Duration::days(14))) {
        return Err(ApiError::Forbidden);
    }
    let mut tx = s.db.begin().await?;
    sqlx::query("DELETE FROM time_entries WHERE id = $1").bind(id).execute(&mut *tx).await?;
    super::audit(&mut tx, &user.actor(), "time_delete", "user", owner, json!({ "entry": id, "started_at": started }))
        .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Urlaub & Abwesenheit ───────────────────────────────────────────────

const KINDS: [&str; 6] = ["vacation", "sick", "special", "unpaid", "training", "remote"];

/// Arbeitstage (Mo–Fr) im Zeitraum
pub fn workdays(from: NaiveDate, to: NaiveDate) -> f64 {
    from.iter_days().take_while(|d| *d <= to).filter(|d| !matches!(d.weekday(), Weekday::Sat | Weekday::Sun)).count()
        as f64
}

#[derive(Serialize, sqlx::FromRow)]
pub struct LeaveRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub kind: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub half_day: bool,
    pub days: f64,
    pub status: String,
    pub substitute_id: Option<Uuid>,
    pub substitute: Option<String>,
    pub note: String,
    pub decided_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

const LEAVE_SELECT: &str = "
    SELECT l.id, l.user_id, u.display_name AS user_name, l.kind, l.start_date, l.end_date, l.half_day, l.days::float8 AS days,
           l.status, l.substitute_id, s.display_name AS substitute, l.note, d.display_name AS decided_by_name, l.created_at
      FROM leave_requests l JOIN users u ON u.id = l.user_id
      LEFT JOIN users s ON s.id = l.substitute_id LEFT JOIN users d ON d.id = l.decided_by";

async fn balance(db: &PgPool, user: Uuid, year: i32) -> ApiResult<Value> {
    let (entitled, taken, pending): (f64, f64, f64) = sqlx::query_as(
        "SELECT u.vacation_days_per_year::float8,
                COALESCE(sum(l.days) FILTER (WHERE l.status = 'approved'), 0)::float8,
                COALESCE(sum(l.days) FILTER (WHERE l.status = 'requested'), 0)::float8
           FROM users u LEFT JOIN leave_requests l ON l.user_id = u.id AND l.kind = 'vacation'
                AND extract(year FROM l.start_date) = $2
          WHERE u.id = $1 GROUP BY u.id",
    )
    .bind(user)
    .bind(year as f64)
    .fetch_one(db)
    .await?;
    Ok(
        json!({ "year": year, "entitled": entitled, "taken": taken, "pending": pending, "left": entitled - taken - pending }),
    )
}

#[derive(Deserialize)]
pub struct LeaveQuery {
    /// mine (Standard) | team
    pub scope: Option<String>,
}

pub async fn leave_list(State(s): State<AppState>, user: User, Query(q): Query<LeaveQuery>) -> ApiResult<Json<Value>> {
    employee(&user)?;
    let team = q.scope.as_deref() == Some("team");
    let ids = if team { team_of(&s.db, &user).await? } else { vec![user.id] };
    let rows: Vec<LeaveRow> = sqlx::query_as(&format!(
        "{LEAVE_SELECT} WHERE l.user_id = ANY($1) AND l.end_date >= CURRENT_DATE - 400
          ORDER BY (l.status = 'requested') DESC, l.start_date DESC LIMIT 1000"
    ))
    .bind(&ids)
    .fetch_all(&s.db)
    .await?;
    let year = Utc::now().year();
    Ok(Json(
        json!({ "items": rows, "balance": balance(&s.db, user.id, year).await?, "can_decide": matches!(user.role, Role::Admin | Role::Lead) }),
    ))
}

#[derive(Deserialize)]
pub struct NewLeave {
    /// nur Leiter/Admin: für einen Mitarbeiter eintragen (z. B. Krankmeldung) – direkt genehmigt
    pub user_id: Option<Uuid>,
    pub kind: Option<String>,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    #[serde(default)]
    pub half_day: bool,
    pub substitute_id: Option<Uuid>,
    #[serde(default)]
    pub note: String,
}

async fn check_substitute(db: &PgPool, sub: Option<Uuid>, user: Uuid) -> ApiResult<()> {
    if let Some(sid) = sub {
        let ok: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND id <> $2 AND is_active AND role NOT IN ('customer','device'))",
        )
        .bind(sid)
        .bind(user)
        .fetch_one(db)
        .await?;
        if !ok {
            return Err(ApiError::BadRequest("Vertretung muss ein anderer aktiver Mitarbeiter sein".into()));
        }
    }
    Ok(())
}

pub async fn leave_create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewLeave>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    employee(&user)?;
    let target = b.user_id.unwrap_or(user.id);
    let by_manager = target != user.id;
    if by_manager && !manages(&s.db, &user, target).await? {
        return Err(ApiError::Forbidden);
    }
    let kind = b.kind.unwrap_or_else(|| "vacation".into());
    if !KINDS.contains(&kind.as_str()) {
        return Err(ApiError::BadRequest("Art ungültig".into()));
    }
    if b.end_date < b.start_date || (b.end_date - b.start_date).num_days() > 366 {
        return Err(ApiError::BadRequest("Zeitraum ungültig".into()));
    }
    if b.half_day && b.start_date != b.end_date {
        return Err(ApiError::BadRequest("Halbe Tage nur für einen einzelnen Tag".into()));
    }
    check_substitute(&s.db, b.substitute_id, target).await?;
    let days = if b.half_day { 0.5 } else { workdays(b.start_date, b.end_date) };
    if days == 0.0 {
        return Err(ApiError::BadRequest("Im Zeitraum liegt kein Arbeitstag".into()));
    }
    let clash: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM leave_requests WHERE user_id = $1 AND status IN ('requested','approved')
                          AND daterange(start_date, end_date, '[]') && daterange($2, $3, '[]'))",
    )
    .bind(target)
    .bind(b.start_date)
    .bind(b.end_date)
    .fetch_one(&s.db)
    .await?;
    if clash {
        return Err(ApiError::Conflict("Für diesen Zeitraum gibt es schon einen Antrag".into()));
    }
    if kind == "vacation" && !by_manager {
        let bal = balance(&s.db, target, b.start_date.year()).await?;
        if bal["left"].as_f64().unwrap_or(0.0) < days {
            return Err(ApiError::BadRequest(format!("Nicht genug Resturlaub ({} Tage übrig)", bal["left"])));
        }
    }
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "INSERT INTO leave_requests (id, user_id, kind, start_date, end_date, half_day, days, status, substitute_id, note,
                                     decided_by, decided_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::float8::numeric,$8,$9,$10,$11, CASE WHEN $8 = 'approved' THEN now() END, $12)",
    )
    .bind(id)
    .bind(target)
    .bind(&kind)
    .bind(b.start_date)
    .bind(b.end_date)
    .bind(b.half_day)
    .bind(days)
    .bind(if by_manager { "approved" } else { "requested" })
    .bind(b.substitute_id)
    .bind(b.note.trim())
    .bind(by_manager.then_some(user.id))
    .bind(user.id)
    .execute(&mut *tx)
    .await?;
    super::audit(
        &mut tx,
        &user.actor(),
        "leave_create",
        "user",
        target,
        json!({ "leave": id, "kind": kind, "days": days }),
    )
    .await?;
    tx.commit().await?;
    // Antrag → Leitung der Abteilung(en) informieren
    if !by_manager {
        let leads: Vec<Uuid> = sqlx::query_scalar(
            "SELECT DISTINCT u.id FROM users u JOIN user_departments a ON a.user_id = u.id
               JOIN user_departments b ON b.department_id = a.department_id
              WHERE b.user_id = $1 AND u.role = 'lead' AND u.is_active AND u.id <> $1
             UNION SELECT id FROM users WHERE role = 'admin' AND is_active AND id <> $1",
        )
        .bind(target)
        .fetch_all(&s.db)
        .await?;
        notify(&leads, "leave", "new", id, &kind);
    } else {
        notify(&[target], "leave", "update", id, &kind);
    }
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "days": days }))))
}

#[derive(Deserialize)]
pub struct LeavePatch {
    /// approved | rejected (Leitung) · cancelled (Antragsteller)
    pub status: Option<String>,
    pub substitute_id: Option<Uuid>,
}

pub async fn leave_patch(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<LeavePatch>,
) -> ApiResult<StatusCode> {
    employee(&user)?;
    let (owner, status, start): (Uuid, String, NaiveDate) =
        sqlx::query_as("SELECT user_id, status, start_date FROM leave_requests WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?
            .ok_or(ApiError::NotFound)?;
    let manager = manages(&s.db, &user, owner).await?;
    match b.status.as_deref() {
        Some("approved" | "rejected") if manager => {}
        Some("cancelled") if owner == user.id && (status == "requested" || start > Utc::now().date_naive()) => {}
        Some("cancelled") if manager => {}
        None => {}
        _ => return Err(ApiError::Forbidden),
    }
    if b.substitute_id.is_some() && !(manager || owner == user.id) {
        return Err(ApiError::Forbidden);
    }
    check_substitute(&s.db, b.substitute_id, owner).await?;
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "UPDATE leave_requests SET status = COALESCE($2, status), substitute_id = COALESCE($3, substitute_id),
                decided_by = CASE WHEN $2 IN ('approved','rejected') THEN $4 ELSE decided_by END,
                decided_at = CASE WHEN $2 IN ('approved','rejected') THEN now() ELSE decided_at END
          WHERE id = $1",
    )
    .bind(id)
    .bind(&b.status)
    .bind(b.substitute_id)
    .bind(user.id)
    .execute(&mut *tx)
    .await?;
    super::audit(
        &mut tx,
        &user.actor(),
        "leave_update",
        "user",
        owner,
        json!({ "leave": id, "status": b.status, "substitute": b.substitute_id }),
    )
    .await?;
    tx.commit().await?;
    let mut to = vec![owner];
    to.extend(b.substitute_id);
    to.retain(|u| *u != user.id);
    notify(&to, "leave", "update", id, b.status.as_deref().unwrap_or("update"));
    Ok(StatusCode::NO_CONTENT)
}

/// Heute abwesend und vertreten? → Vertretung (für Ticket-Zuweisung u. Ä.)
pub async fn substitute_today(db: &PgPool, user: Uuid) -> Option<Uuid> {
    sqlx::query_scalar(
        "SELECT substitute_id FROM leave_requests WHERE user_id = $1 AND status = 'approved' AND substitute_id IS NOT NULL
            AND kind <> 'remote' AND CURRENT_DATE BETWEEN start_date AND end_date LIMIT 1",
    )
    .bind(user)
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
}

// ── Kalender ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CalQuery {
    pub from: DateTime<Utc>,
    pub to: DateTime<Utc>,
    /// fremder Kalender (nur Leitung für eigene Mitarbeiter)
    pub user: Option<Uuid>,
    /// ganzes Team (Leitung/Admin)
    #[serde(default)]
    pub team: bool,
}

pub async fn calendar(State(s): State<AppState>, user: User, Query(q): Query<CalQuery>) -> ApiResult<Json<Value>> {
    employee(&user)?;
    if q.to <= q.from || q.to - q.from > chrono::Duration::days(100) {
        return Err(ApiError::BadRequest("Zeitraum höchstens 100 Tage".into()));
    }
    let ids = if q.team {
        team_of(&s.db, &user).await?
    } else {
        let t = q.user.unwrap_or(user.id);
        may_see(&s.db, &user, t).await?;
        vec![t]
    };
    type Ev = (Uuid, String, String, String, DateTime<Utc>, DateTime<Utc>, bool, bool, Uuid, String, Value);
    let events: Vec<Ev> = sqlx::query_as(
        "SELECT e.id, e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day, e.mandatory, e.created_by,
                c.display_name,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.user_id, 'name', u.display_name, 'response', a.response) ORDER BY u.display_name)
                            FROM calendar_attendees a JOIN users u ON u.id = a.user_id WHERE a.event_id = e.id), '[]')
           FROM calendar_events e JOIN users c ON c.id = e.created_by
          WHERE e.starts_at < $3 AND e.ends_at >= $2
            AND (e.created_by = ANY($1) OR EXISTS (SELECT 1 FROM calendar_attendees a WHERE a.event_id = e.id AND a.user_id = ANY($1)))
          ORDER BY e.starts_at",
    )
    .bind(&ids)
    .bind(q.from)
    .bind(q.to)
    .fetch_all(&s.db)
    .await?;
    let leaves: Vec<LeaveRow> = sqlx::query_as(&format!(
        "{LEAVE_SELECT} WHERE l.user_id = ANY($1) AND l.status IN ('approved','requested')
            AND l.start_date <= $3::date AND l.end_date >= $2::date ORDER BY l.start_date"
    ))
    .bind(&ids)
    .bind(q.from)
    .bind(q.to)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(json!({
        "events": events.iter().map(|e| json!({
            "id": e.0, "title": e.1, "description": e.2, "location": e.3, "starts_at": e.4, "ends_at": e.5,
            "all_day": e.6, "mandatory": e.7, "created_by": e.8, "created_by_name": e.9, "attendees": e.10,
            "can_edit": e.8 == user.id || user.role == Role::Admin,
        })).collect::<Vec<_>>(),
        "leaves": leaves,
    })))
}

#[derive(Deserialize)]
pub struct EventInput {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub location: String,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    #[serde(default)]
    pub all_day: bool,
    #[serde(default)]
    pub attendees: Vec<Uuid>,
    /// verbindlich vorgeben (nur Leitung/Admin für eigene Mitarbeiter)
    #[serde(default)]
    pub mandatory: bool,
}

async fn check_event(s: &AppState, user: &User, b: &EventInput) -> ApiResult<Vec<Uuid>> {
    let title = b.title.trim();
    if title.is_empty()
        || title.chars().count() > 200
        || b.ends_at < b.starts_at
        || b.ends_at - b.starts_at > chrono::Duration::days(31)
    {
        return Err(ApiError::BadRequest("Titel und Zeitraum prüfen (höchstens 31 Tage)".into()));
    }
    let mut att: Vec<Uuid> = b.attendees.iter().copied().filter(|a| *a != user.id).collect();
    att.sort();
    att.dedup();
    if att.len() > 100 {
        return Err(ApiError::BadRequest("Höchstens 100 Teilnehmer".into()));
    }
    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM users WHERE id = ANY($1) AND is_active AND role NOT IN ('customer','device')",
    )
    .bind(&att)
    .fetch_one(&s.db)
    .await?;
    if n != att.len() as i64 {
        return Err(ApiError::BadRequest("Teilnehmer müssen aktive Mitarbeiter sein".into()));
    }
    if b.mandatory {
        for a in &att {
            if !manages(&s.db, user, *a).await? {
                return Err(ApiError::Forbidden);
            }
        }
    }
    Ok(att)
}

pub async fn event_create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<EventInput>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    employee(&user)?;
    let att = check_event(&s, &user, &b).await?;
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "INSERT INTO calendar_events (id, title, description, location, starts_at, ends_at, all_day, mandatory, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    )
    .bind(id)
    .bind(b.title.trim())
    .bind(b.description.trim())
    .bind(b.location.trim())
    .bind(b.starts_at)
    .bind(b.ends_at)
    .bind(b.all_day)
    .bind(b.mandatory)
    .bind(user.id)
    .execute(&mut *tx)
    .await?;
    for a in &att {
        sqlx::query("INSERT INTO calendar_attendees (event_id, user_id, response) VALUES ($1,$2,$3)")
            .bind(id)
            .bind(a)
            .bind(if b.mandatory { "accepted" } else { "pending" })
            .execute(&mut *tx)
            .await?;
    }
    if b.mandatory {
        super::audit(&mut tx, &user.actor(), "event_mandatory", "calendar_event", id, json!({ "attendees": att }))
            .await?;
    }
    tx.commit().await?;
    notify(&att, "calendar", "new", id, b.title.trim());
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

async fn event_owner(s: &AppState, user: &User, id: Uuid) -> ApiResult<()> {
    let creator: Uuid = sqlx::query_scalar("SELECT created_by FROM calendar_events WHERE id = $1")
        .bind(id)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    if creator == user.id || user.role == Role::Admin {
        Ok(())
    } else {
        Err(ApiError::Forbidden)
    }
}

pub async fn event_update(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<EventInput>,
) -> ApiResult<StatusCode> {
    employee(&user)?;
    event_owner(&s, &user, id).await?;
    let att = check_event(&s, &user, &b).await?;
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "UPDATE calendar_events SET title=$2, description=$3, location=$4, starts_at=$5, ends_at=$6, all_day=$7, mandatory=$8 WHERE id=$1",
    )
    .bind(id)
    .bind(b.title.trim())
    .bind(b.description.trim())
    .bind(b.location.trim())
    .bind(b.starts_at)
    .bind(b.ends_at)
    .bind(b.all_day)
    .bind(b.mandatory)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM calendar_attendees WHERE event_id = $1 AND NOT (user_id = ANY($2))")
        .bind(id)
        .bind(&att)
        .execute(&mut *tx)
        .await?;
    for a in &att {
        sqlx::query(
            "INSERT INTO calendar_attendees (event_id, user_id, response) VALUES ($1,$2,$3)
             ON CONFLICT (event_id, user_id) DO UPDATE SET response = CASE WHEN $4 THEN 'accepted' ELSE calendar_attendees.response END",
        )
        .bind(id)
        .bind(a)
        .bind(if b.mandatory { "accepted" } else { "pending" })
        .bind(b.mandatory)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    notify(&att, "calendar", "update", id, b.title.trim());
    Ok(StatusCode::NO_CONTENT)
}

pub async fn event_delete(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    employee(&user)?;
    event_owner(&s, &user, id).await?;
    let att: Vec<Uuid> = sqlx::query_scalar("SELECT user_id FROM calendar_attendees WHERE event_id = $1")
        .bind(id)
        .fetch_all(&s.db)
        .await?;
    sqlx::query("DELETE FROM calendar_events WHERE id = $1").bind(id).execute(&s.db).await?;
    notify(&att, "calendar", "delete", id, "");
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct Respond {
    pub response: String,
}

pub async fn event_respond(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Respond>,
) -> ApiResult<StatusCode> {
    employee(&user)?;
    if !matches!(b.response.as_str(), "accepted" | "declined") {
        return Err(ApiError::BadRequest("Antwort: accepted oder declined".into()));
    }
    let row: Option<(bool, Uuid, String)> = sqlx::query_as(
        "SELECT e.mandatory, e.created_by, e.title FROM calendar_events e JOIN calendar_attendees a ON a.event_id = e.id
          WHERE e.id = $1 AND a.user_id = $2",
    )
    .bind(id)
    .bind(user.id)
    .fetch_optional(&s.db)
    .await?;
    let (mandatory, creator, title) = row.ok_or(ApiError::NotFound)?;
    if mandatory && b.response == "declined" {
        return Err(ApiError::Conflict("Verbindlicher Termin – bitte mit der Leitung klären".into()));
    }
    sqlx::query("UPDATE calendar_attendees SET response = $3 WHERE event_id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .bind(&b.response)
        .execute(&s.db)
        .await?;
    notify(&[creator], "calendar", "response", id, &title);
    Ok(StatusCode::NO_CONTENT)
}

/// Mitarbeiterliste für Auswahlfelder (Teilnehmer, Vertretung) + wen ich verwalte
pub async fn people(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    employee(&user)?;
    let team = team_of(&s.db, &user).await?;
    let rows: Vec<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, display_name, role FROM users WHERE is_active AND role NOT IN ('customer','device') ORDER BY display_name",
    )
    .fetch_all(&s.db)
    .await?;
    Ok(Json(json!(rows
        .iter()
        .map(|r| json!({ "id": r.0, "name": r.1, "role": r.2, "managed": user.role == Role::Admin || (user.role == Role::Lead && team.contains(&r.0) && r.0 != user.id) }))
        .collect::<Vec<_>>())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_workdays() {
        let d = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
        assert_eq!(workdays(d("2026-11-09"), d("2026-11-13")), 5.0); // Mo–Fr
        assert_eq!(workdays(d("2026-11-07"), d("2026-11-08")), 0.0); // Wochenende
        assert_eq!(workdays(d("2026-11-06"), d("2026-11-16")), 7.0);
    }
}
