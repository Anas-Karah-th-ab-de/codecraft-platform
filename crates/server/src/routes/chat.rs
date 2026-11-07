//! Eigener Chat mit Echtzeit-Zustellung und Anruf-Signalisierung (WebRTC).
//!
//! REST für Räume/Nachrichten (gespeichert in PostgreSQL), WebSocket `/api/v1/ws?token=` für
//! Live-Ereignisse: neue Nachrichten, Tippen, Anwesenheit und Anruf-Signale (Angebot, Antwort,
//! ICE-Kandidaten), die der Server zwischen den Teilnehmern eines Raums weiterreicht.

use crate::auth::{hash_token, User};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use axum::Json;
use chrono::{DateTime, Utc};
use codecraft_domain::access::Role;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgConnection;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use uuid::Uuid;

// ── Verbindungen (im Speicher) ───────────────────────────────────────────────

type Conns = HashMap<Uuid, Vec<(u64, UnboundedSender<String>)>>;
static HUB: LazyLock<Mutex<Conns>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

fn send_user(user: Uuid, msg: &str) {
    if let Some(list) = HUB.lock().unwrap().get(&user) {
        for (_, tx) in list {
            let _ = tx.send(msg.to_owned());
        }
    }
}

pub fn online_users() -> Vec<Uuid> {
    HUB.lock().unwrap().keys().copied().collect()
}

fn broadcast_all(msg: &str) {
    for list in HUB.lock().unwrap().values() {
        for (_, tx) in list {
            let _ = tx.send(msg.to_owned());
        }
    }
}

async fn members(db: &sqlx::PgPool, room: Uuid) -> Result<Vec<Uuid>, sqlx::Error> {
    let rows: Vec<(Uuid,)> =
        sqlx::query_as("SELECT user_id FROM chat_members WHERE room_id = $1").bind(room).fetch_all(db).await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

// ── Bereitstellung beim Anlegen eines Nutzers ───────────────────────────────

fn slug(s: &str) -> String {
    let map = |c: char| match c {
        'ä' => "ae".to_string(),
        'ö' => "oe".to_string(),
        'ü' => "ue".to_string(),
        'ß' => "ss".to_string(),
        c if c.is_ascii_alphanumeric() => c.to_ascii_lowercase().to_string(),
        _ => ".".to_string(),
    };
    let raw: String = s.trim().to_lowercase().chars().map(map).collect();
    raw.split('.').filter(|p| !p.is_empty()).collect::<Vec<_>>().join(".")
}

/// Postfach (nur Mitarbeiter) und Chat-Zugang anlegen. Gibt die neue Adresse zurück.
pub async fn provision(
    conn: &mut PgConnection,
    user_id: Uuid,
    email: &str,
    display_name: &str,
    role: Role,
    organization_id: Option<Uuid>,
) -> Result<Option<String>, ApiError> {
    let mut address = None;
    if role.is_employee() {
        let (domain,): (String,) =
            sqlx::query_as("SELECT domain FROM mail_domains WHERE is_default ORDER BY domain LIMIT 1")
                .fetch_one(&mut *conn)
                .await?;
        let email = email.trim().to_lowercase();
        let base = if email.ends_with(&format!("@{domain}")) {
            email.split('@').next().unwrap_or_default().to_string()
        } else {
            let s = slug(display_name);
            if s.is_empty() {
                slug(email.split('@').next().unwrap_or("user"))
            } else {
                s
            }
        };
        let base = if base.is_empty() { "user".to_string() } else { base };
        // freie Adresse suchen: name@, name2@, …
        for n in 1..100 {
            let local = if n == 1 { base.clone() } else { format!("{base}{n}") };
            let candidate = format!("{local}@{domain}");
            let taken: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM mailboxes WHERE address = $1")
                .bind(&candidate)
                .fetch_optional(&mut *conn)
                .await?;
            if taken.is_none() {
                sqlx::query("INSERT INTO mailboxes (id, user_id, address, domain) VALUES ($1, $2, $3, $4)")
                    .bind(Uuid::now_v7())
                    .bind(user_id)
                    .bind(&candidate)
                    .bind(&domain)
                    .execute(&mut *conn)
                    .await?;
                address = Some(candidate);
                break;
            }
        }
    }
    // Kunden: Support-Raum ihrer Firma mit dem Team (Admin, Leitung, Management)
    if role == Role::Customer {
        if let Some(org) = organization_id {
            let room = support_room(conn, org).await?;
            add_member(conn, room, user_id).await?;
        }
    }
    // Neue Teamleitung/Admins in bestehende Support-Räume aufnehmen
    if matches!(role, Role::Admin | Role::Lead | Role::Manager) {
        sqlx::query(
            "INSERT INTO chat_members (room_id, user_id) SELECT id, $1 FROM chat_rooms WHERE kind = 'support'
             ON CONFLICT DO NOTHING",
        )
        .bind(user_id)
        .execute(&mut *conn)
        .await?;
    }
    Ok(address)
}

async fn support_room(conn: &mut PgConnection, org: Uuid) -> Result<Uuid, ApiError> {
    if let Some((id,)) =
        sqlx::query_as::<_, (Uuid,)>("SELECT id FROM chat_rooms WHERE kind = 'support' AND organization_id = $1")
            .bind(org)
            .fetch_optional(&mut *conn)
            .await?
    {
        return Ok(id);
    }
    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO chat_rooms (id, kind, name, organization_id)
         SELECT $1, 'support', 'Support · ' || name, id FROM organizations WHERE id = $2",
    )
    .bind(id)
    .bind(org)
    .execute(&mut *conn)
    .await?;
    sqlx::query(
        "INSERT INTO chat_members (room_id, user_id)
         SELECT $1, id FROM users WHERE is_active AND role IN ('admin','lead','manager') ON CONFLICT DO NOTHING",
    )
    .bind(id)
    .execute(&mut *conn)
    .await?;
    Ok(id)
}

async fn add_member(conn: &mut PgConnection, room: Uuid, user: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO chat_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(room)
        .bind(user)
        .execute(conn)
        .await?;
    Ok(())
}

// ── REST ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct Contact {
    pub id: Uuid,
    pub display_name: String,
    pub role: String,
    pub organization_name: Option<String>,
    pub mailbox: Option<String>,
}

/// Wen darf ich anschreiben? Mitarbeiter: alle. Kunden: Team + eigene Firma.
pub async fn contacts(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<Contact>>> {
    let rows: Vec<Contact> = sqlx::query_as(
        "SELECT u.id, u.display_name, u.role, o.name AS organization_name, m.address AS mailbox
           FROM users u LEFT JOIN organizations o ON o.id = u.organization_id
           LEFT JOIN mailboxes m ON m.user_id = u.id
          WHERE u.is_active AND u.id <> $1 AND u.role <> 'device'
            AND ($2 OR u.role IN ('trainee','staff','manager','lead','admin') OR u.organization_id = $3)
          ORDER BY (u.role = 'customer'), u.display_name",
    )
    .bind(user.id)
    .bind(user.role.is_employee())
    .bind(user.organization_id)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RoomOut {
    pub id: Uuid,
    pub kind: String,
    pub name: Option<String>,
    pub peer_id: Option<Uuid>,
    pub peer_name: Option<String>,
    pub last_body: Option<String>,
    pub last_kind: Option<String>,
    pub last_at: Option<DateTime<Utc>>,
    pub unread: i64,
    pub member_count: i64,
}

pub async fn rooms(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<RoomOut>>> {
    let rows: Vec<RoomOut> = sqlx::query_as(
        "SELECT r.id, r.kind, r.name,
                p.id AS peer_id, p.display_name AS peer_name,
                lm.body AS last_body, lm.kind AS last_kind, lm.created_at AS last_at,
                (SELECT count(*) FROM chat_messages x WHERE x.room_id = r.id AND x.created_at > me.last_read_at
                   AND x.sender_id IS DISTINCT FROM $1) AS unread,
                (SELECT count(*) FROM chat_members y WHERE y.room_id = r.id) AS member_count
           FROM chat_members me
           JOIN chat_rooms r ON r.id = me.room_id
           LEFT JOIN LATERAL (SELECT u.id, u.display_name FROM chat_members cm JOIN users u ON u.id = cm.user_id
                               WHERE r.kind = 'direct' AND cm.room_id = r.id AND cm.user_id <> $1 LIMIT 1) p ON true
           LEFT JOIN LATERAL (SELECT body, kind, created_at FROM chat_messages m WHERE m.room_id = r.id
                               ORDER BY created_at DESC LIMIT 1) lm ON true
          WHERE me.user_id = $1
          ORDER BY COALESCE(lm.created_at, r.created_at) DESC",
    )
    .bind(user.id)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct NewRoom {
    /// Direktchat mit dieser Person
    pub user_id: Option<Uuid>,
    /// Gruppe (nur Mitarbeiter)
    pub name: Option<String>,
    #[serde(default)]
    pub members: Vec<Uuid>,
}

async fn may_contact(db: &sqlx::PgPool, user: &User, other: Uuid) -> ApiResult<bool> {
    let row: Option<(String, Option<Uuid>, bool)> =
        sqlx::query_as("SELECT role, organization_id, is_active FROM users WHERE id = $1")
            .bind(other)
            .fetch_optional(db)
            .await?;
    let Some((role, org, active)) = row else { return Ok(false) };
    if !active || role == "device" {
        return Ok(false);
    }
    let other_employee = Role::parse(&role).map(|r| r.is_employee()).unwrap_or(false);
    Ok(user.role.is_employee() || other_employee || (org.is_some() && org == user.organization_id))
}

pub async fn create_room(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewRoom>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let mut tx = s.db.begin().await?;
    if let Some(other) = b.user_id {
        if other == user.id || !may_contact(&s.db, &user, other).await? {
            return Err(ApiError::Forbidden);
        }
        let (a, c) = if user.id < other { (user.id, other) } else { (other, user.id) };
        let key = format!("{a}:{c}");
        let existing: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM chat_rooms WHERE direct_key = $1")
            .bind(&key)
            .fetch_optional(&mut *tx)
            .await?;
        let id = match existing {
            Some((id,)) => id,
            None => {
                let id = Uuid::now_v7();
                sqlx::query("INSERT INTO chat_rooms (id, kind, direct_key, created_by) VALUES ($1, 'direct', $2, $3)")
                    .bind(id)
                    .bind(&key)
                    .bind(user.id)
                    .execute(&mut *tx)
                    .await?;
                add_member(&mut tx, id, user.id).await?;
                add_member(&mut tx, id, other).await?;
                id
            }
        };
        tx.commit().await?;
        return Ok((StatusCode::OK, Json(json!({ "id": id }))));
    }
    if !user.role.is_employee() {
        return Err(ApiError::Forbidden);
    }
    let name = b
        .name
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .ok_or_else(|| ApiError::BadRequest("Name fehlt".into()))?;
    let id = Uuid::now_v7();
    sqlx::query("INSERT INTO chat_rooms (id, kind, name, created_by) VALUES ($1, 'group', $2, $3)")
        .bind(id)
        .bind(name)
        .bind(user.id)
        .execute(&mut *tx)
        .await?;
    add_member(&mut tx, id, user.id).await?;
    for m in b.members {
        if may_contact(&s.db, &user, m).await? {
            add_member(&mut tx, id, m).await?;
        }
    }
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

async fn require_member(db: &sqlx::PgPool, room: Uuid, user: Uuid) -> ApiResult<()> {
    let ok: Option<(Uuid,)> = sqlx::query_as("SELECT room_id FROM chat_members WHERE room_id = $1 AND user_id = $2")
        .bind(room)
        .bind(user)
        .fetch_optional(db)
        .await?;
    ok.map(|_| ()).ok_or(ApiError::NotFound)
}

#[derive(Serialize, sqlx::FromRow)]
pub struct MessageOut {
    pub id: Uuid,
    pub room_id: Uuid,
    pub sender_id: Option<Uuid>,
    pub sender_name: Option<String>,
    pub kind: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct Page {
    pub before: Option<DateTime<Utc>>,
}

pub async fn messages(
    State(s): State<AppState>,
    user: User,
    Path(room): Path<Uuid>,
    Query(p): Query<Page>,
) -> ApiResult<Json<Value>> {
    require_member(&s.db, room, user.id).await?;
    let mut rows: Vec<MessageOut> = sqlx::query_as(
        "SELECT m.id, m.room_id, m.sender_id, u.display_name AS sender_name, m.kind, m.body, m.created_at
           FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id
          WHERE m.room_id = $1 AND ($2::timestamptz IS NULL OR m.created_at < $2)
          ORDER BY m.created_at DESC LIMIT 60",
    )
    .bind(room)
    .bind(p.before)
    .fetch_all(&s.db)
    .await?;
    rows.reverse();
    let people: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT u.id, u.display_name FROM chat_members cm JOIN users u ON u.id = cm.user_id WHERE cm.room_id = $1 ORDER BY u.display_name",
    )
    .bind(room)
    .fetch_all(&s.db)
    .await?;
    let members: Vec<Value> = people.into_iter().map(|(id, n)| json!({ "id": id, "display_name": n })).collect();
    Ok(Json(json!({ "messages": rows, "members": members })))
}

#[derive(Deserialize)]
pub struct NewMessage {
    pub body: String,
    #[serde(default)]
    pub kind: Option<String>,
}

pub async fn post_message(
    State(s): State<AppState>,
    user: User,
    Path(room): Path<Uuid>,
    Json(b): Json<NewMessage>,
) -> ApiResult<(StatusCode, Json<MessageOut>)> {
    require_member(&s.db, room, user.id).await?;
    let body = b.body.trim();
    if body.is_empty() || body.len() > 8000 {
        return Err(ApiError::BadRequest("Nachricht leer oder zu lang".into()));
    }
    let kind = match b.kind.as_deref() {
        Some("call") => "call",
        _ => "text",
    };
    let msg: MessageOut = sqlx::query_as(
        "WITH ins AS (INSERT INTO chat_messages (id, room_id, sender_id, kind, body) VALUES ($1, $2, $3, $4, $5) RETURNING *)
         SELECT ins.id, ins.room_id, ins.sender_id, u.display_name AS sender_name, ins.kind, ins.body, ins.created_at
           FROM ins LEFT JOIN users u ON u.id = ins.sender_id",
    )
    .bind(Uuid::now_v7())
    .bind(room)
    .bind(user.id)
    .bind(kind)
    .bind(body)
    .fetch_one(&s.db)
    .await?;
    sqlx::query("UPDATE chat_members SET last_read_at = now() WHERE room_id = $1 AND user_id = $2")
        .bind(room)
        .bind(user.id)
        .execute(&s.db)
        .await?;
    let ev = json!({ "type": "message", "message": msg }).to_string();
    for m in members(&s.db, room).await? {
        send_user(m, &ev);
    }
    Ok((StatusCode::CREATED, Json(msg)))
}

pub async fn mark_read(State(s): State<AppState>, user: User, Path(room): Path<Uuid>) -> ApiResult<StatusCode> {
    sqlx::query("UPDATE chat_members SET last_read_at = now() WHERE room_id = $1 AND user_id = $2")
        .bind(room)
        .bind(user.id)
        .execute(&s.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// ICE-Server für WebRTC: eigener STUN-Server (gleicher Host, UDP 3478)
pub async fn ice(headers: HeaderMap, _user: User) -> Json<Value> {
    let host = std::env::var("PUBLIC_HOST").ok().unwrap_or_else(|| {
        headers
            .get("host")
            .and_then(|h| h.to_str().ok())
            .map(|h| h.split(':').next().unwrap_or(h).to_string())
            .unwrap_or_else(|| "localhost".into())
    });
    let port = std::env::var("STUN_PORT").unwrap_or_else(|_| "3478".into());
    Json(json!({ "iceServers": [{ "urls": format!("stun:{host}:{port}") }], "online": online_users() }))
}

// ── WebSocket ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: String,
}

pub async fn ws(State(s): State<AppState>, Query(q): Query<WsQuery>, up: WebSocketUpgrade) -> ApiResult<Response> {
    // Browser können beim WebSocket keine Header setzen → Token als Parameter
    let row: Option<(Uuid, String)> = sqlx::query_as(
        "SELECT u.id, u.display_name FROM api_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.is_active
            AND (t.expires_at IS NULL OR t.expires_at > now())",
    )
    .bind(hash_token(&q.token))
    .fetch_optional(&s.db)
    .await?;
    let (user, name) = row.ok_or(ApiError::Unauthorized)?;
    Ok(up.max_message_size(256 * 1024).on_upgrade(move |socket| session(s, user, name, socket)))
}

async fn session(s: AppState, user: Uuid, name: String, socket: WebSocket) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = unbounded_channel::<String>();
    let cid = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let first = {
        let mut hub = HUB.lock().unwrap();
        let e = hub.entry(user).or_default();
        e.push((cid, tx));
        e.len() == 1
    };
    if first {
        broadcast_all(&json!({ "type": "presence", "user": user, "online": true }).to_string());
    }
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if sink.send(Message::Text(m.into())).await.is_err() {
                break;
            }
        }
    });
    while let Some(Ok(msg)) = stream.next().await {
        let Message::Text(text) = msg else { continue };
        let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
        let room = v.get("room").and_then(|r| r.as_str()).and_then(|r| r.parse::<Uuid>().ok());
        match v.get("type").and_then(|t| t.as_str()) {
            Some("typing") => {
                if let Some(room) = room {
                    if let Ok(ms) = members(&s.db, room).await {
                        if ms.contains(&user) {
                            let ev = json!({ "type": "typing", "room": room, "user": user, "name": name }).to_string();
                            ms.iter().filter(|m| **m != user).for_each(|m| send_user(*m, &ev));
                        }
                    }
                }
            }
            // Anruf-Signale nur an Mitglieder desselben Raums weiterreichen
            Some("call") => {
                let to = v.get("to").and_then(|t| t.as_str()).and_then(|t| t.parse::<Uuid>().ok());
                if let (Some(room), Some(to)) = (room, to) {
                    if let Ok(ms) = members(&s.db, room).await {
                        if ms.contains(&user) && ms.contains(&to) {
                            let ev = json!({ "type": "call", "room": room, "from": user, "name": name,
                                             "data": v.get("data").cloned().unwrap_or(Value::Null) });
                            send_user(to, &ev.to_string());
                        }
                    }
                }
            }
            _ => {}
        }
    }
    writer.abort();
    let last = {
        let mut hub = HUB.lock().unwrap();
        if let Some(list) = hub.get_mut(&user) {
            list.retain(|(id, _)| *id != cid);
            if list.is_empty() {
                hub.remove(&user);
                true
            } else {
                false
            }
        } else {
            false
        }
    };
    if last {
        broadcast_all(&json!({ "type": "presence", "user": user, "online": false }).to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::slug;

    #[test]
    fn mail_local_parts() {
        assert_eq!(slug("Anas Karah"), "anas.karah");
        assert_eq!(slug("  Jürgen  Groß "), "juergen.gross");
        assert_eq!(slug("أنس"), "");
    }
}
