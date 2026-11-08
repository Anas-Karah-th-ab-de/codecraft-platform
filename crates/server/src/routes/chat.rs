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
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

// ── Verbindungen (im Speicher) ───────────────────────────────────────────────

/// Verbindung: (laufende Nr., Token, Sender). Token, damit gesperrte Sitzungen sofort getrennt werden.
type Conns = HashMap<Uuid, Vec<(u64, Uuid, UnboundedSender<String>)>>;
static HUB: LazyLock<Mutex<Conns>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

/// Interne Nachricht: Verbindung schließen (Sperre, Abmeldung, widerrufener Schlüssel)
pub const KICK: &str = "\u{0}kick";

pub fn send_user(user: Uuid, msg: &str) {
    if let Some(list) = HUB.lock().unwrap().get(&user) {
        for (_, _, tx) in list {
            let _ = tx.send(msg.to_owned());
        }
    }
}

/// Alle Verbindungen eines Benutzers trennen
pub fn kick_user(user: Uuid) {
    send_user(user, KICK);
}

/// Verbindungen einer Sitzung/eines Schlüssels trennen
pub fn kick_token(token: Uuid) {
    for list in HUB.lock().unwrap().values() {
        for (_, t, tx) in list {
            if *t == token {
                let _ = tx.send(KICK.to_owned());
            }
        }
    }
}

/// Live-Verbindung (WebSocket oder Ereignis-Stream); meldet sich beim Fallenlassen ab
pub struct Registration {
    pub user: Uuid,
    pub cid: u64,
    pub rx: UnboundedReceiver<String>,
}

impl Registration {
    pub fn new(user: Uuid, token: Uuid) -> Self {
        let (tx, rx) = unbounded_channel::<String>();
        let cid = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let first = {
            let mut hub = HUB.lock().unwrap();
            let e = hub.entry(user).or_default();
            e.push((cid, token, tx));
            e.len() == 1
        };
        if first {
            broadcast_all(&json!({ "type": "presence", "user": user, "online": true }).to_string());
        }
        Registration { user, cid, rx }
    }
}

impl Drop for Registration {
    fn drop(&mut self) {
        let last = {
            let mut hub = HUB.lock().unwrap();
            match hub.get_mut(&self.user) {
                Some(list) => {
                    list.retain(|(id, ..)| *id != self.cid);
                    let empty = list.is_empty();
                    if empty {
                        hub.remove(&self.user);
                    }
                    empty
                }
                None => false,
            }
        };
        if last {
            broadcast_all(&json!({ "type": "presence", "user": self.user, "online": false }).to_string());
        }
    }
}

/// Offene Anrufe (Raum, Angerufene/r) → Anrufer/in; für „Verpasster Anruf“
static RINGS: LazyLock<Mutex<HashMap<(Uuid, Uuid), Uuid>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn online_users() -> Vec<Uuid> {
    HUB.lock().unwrap().keys().copied().collect()
}

fn broadcast_all(msg: &str) {
    for list in HUB.lock().unwrap().values() {
        for (_, _, tx) in list {
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
    /// bei kind = file: { id, name, mime, size }
    pub file: Option<Value>,
}

const FILE_JSON: &str = "CASE WHEN f.id IS NULL THEN NULL
         ELSE jsonb_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size) END AS file";

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
    let mut rows: Vec<MessageOut> = sqlx::query_as(&format!(
        "SELECT m.id, m.room_id, m.sender_id, u.display_name AS sender_name, m.kind, m.body, m.created_at, {FILE_JSON}
           FROM chat_messages m LEFT JOIN users u ON u.id = m.sender_id LEFT JOIN chat_files f ON f.id = m.file_id
          WHERE m.room_id = $1 AND ($2::timestamptz IS NULL OR m.created_at < $2)
          ORDER BY m.created_at DESC LIMIT 60"
    ))
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
         SELECT ins.id, ins.room_id, ins.sender_id, u.display_name AS sender_name, ins.kind, ins.body, ins.created_at,
                NULL::jsonb AS file
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
    let ms = members(&s.db, room).await?;
    for m in &ms {
        send_user(*m, &ev);
    }
    push_offline(&s.db, &ms, user.id, room, msg.sender_name.as_deref().unwrap_or(""), &msg.body);
    Ok((StatusCode::CREATED, Json(msg)))
}

// ── Dateien ──────────────────────────────────────────────────────────────────

/// Größte Datei im Chat
pub const MAX_FILE: usize = 50 * 1024 * 1024;

fn clean_name(n: &str) -> String {
    let n: String = n
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_control() && !matches!(c, '"' | '<' | '>' | ':' | '|' | '?' | '*'))
        .collect();
    let n = n.trim().trim_start_matches('.').to_string();
    if n.is_empty() {
        "datei".into()
    } else {
        n.chars().take(200).collect()
    }
}

/// Datei hochladen (multipart: `file`, optional `text` als Begleittext) → Nachricht vom Typ `file`
pub async fn upload(
    State(s): State<AppState>,
    user: User,
    Path(room): Path<Uuid>,
    mut mp: axum::extract::Multipart,
) -> ApiResult<(StatusCode, Json<MessageOut>)> {
    require_member(&s.db, room, user.id).await?;
    let (mut name, mut mime, mut data, mut text) = (String::new(), String::new(), None, String::new());
    while let Some(field) = mp.next_field().await.map_err(|e| ApiError::BadRequest(e.to_string()))? {
        match field.name() {
            Some("file") => {
                name = clean_name(field.file_name().unwrap_or("datei"));
                mime = field.content_type().unwrap_or("application/octet-stream").to_string();
                data =
                    Some(field.bytes().await.map_err(|_| ApiError::BadRequest("Datei zu groß (max. 50 MB)".into()))?);
            }
            Some("text") => text = field.text().await.unwrap_or_default().trim().chars().take(2000).collect(),
            _ => {}
        }
    }
    let data = data.filter(|d| !d.is_empty()).ok_or_else(|| ApiError::BadRequest("Datei fehlt".into()))?;
    if data.len() > MAX_FILE {
        return Err(ApiError::BadRequest("Datei zu groß (max. 50 MB)".into()));
    }
    if crate::mail::guard::dangerous_file(&name, &mime, &data) {
        return Err(ApiError::BadRequest(format!("{name}: Programme und Makro-Dateien sind aus Sicherheitsgründen gesperrt (bitte als ZIP mit Passwort oder über die Fernwartung)")));
    }
    let hash = {
        use sha2::{Digest, Sha256};
        hex::encode(Sha256::digest(&data))
    };
    let fid = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    sqlx::query("INSERT INTO chat_files (id, room_id, uploader_id, name, mime, size, sha256, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
        .bind(fid)
        .bind(room)
        .bind(user.id)
        .bind(&name)
        .bind(&mime)
        .bind(data.len() as i64)
        .bind(&hash)
        .bind(crate::mail::guard::seal(&data))
        .execute(&mut *tx)
        .await?;
    let msg: MessageOut = sqlx::query_as(&format!(
        "WITH ins AS (INSERT INTO chat_messages (id, room_id, sender_id, kind, body, file_id) VALUES ($1, $2, $3, 'file', $4, $5) RETURNING *)
         SELECT ins.id, ins.room_id, ins.sender_id, u.display_name AS sender_name, ins.kind, ins.body, ins.created_at, {FILE_JSON}
           FROM ins LEFT JOIN users u ON u.id = ins.sender_id LEFT JOIN chat_files f ON f.id = ins.file_id"
    ))
    .bind(Uuid::now_v7())
    .bind(room)
    .bind(user.id)
    .bind(if text.is_empty() { name.clone() } else { text })
    .bind(fid)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE chat_members SET last_read_at = now() WHERE room_id = $1 AND user_id = $2")
        .bind(room)
        .bind(user.id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    let ev = json!({ "type": "message", "message": msg }).to_string();
    let ms = members(&s.db, room).await?;
    for m in &ms {
        send_user(*m, &ev);
    }
    push_offline(&s.db, &ms, user.id, room, msg.sender_name.as_deref().unwrap_or(""), &msg.body);
    Ok((StatusCode::CREATED, Json(msg)))
}

#[derive(Deserialize)]
pub struct FileQuery {
    /// Bilder im Chat anzeigen statt herunterladen
    #[serde(default)]
    pub inline: bool,
}

/// Datei laden – nur für Mitglieder des Raums
pub async fn download(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Query(q): Query<FileQuery>,
) -> ApiResult<axum::response::Response> {
    use axum::http::header;
    use axum::response::IntoResponse;
    let row: Option<(Uuid, String, String, Vec<u8>)> =
        sqlx::query_as("SELECT room_id, name, mime, data FROM chat_files WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?;
    let (room, name, mime, data) = row.ok_or(ApiError::NotFound)?;
    require_member(&s.db, room, user.id).await.map_err(|_| ApiError::NotFound)?;
    let data = crate::mail::guard::open(data);
    // Nur echte Rasterbilder inline; alles andere (HTML, SVG, PDF …) immer als Download
    let image = matches!(mime.as_str(), "image/png" | "image/jpeg" | "image/gif" | "image/webp");
    let ct = if q.inline && image { mime } else { "application/octet-stream".into() };
    let ascii: String =
        name.chars().map(|c| if c.is_ascii_alphanumeric() || ".-_ ".contains(c) { c } else { '_' }).collect();
    let utf8: String = name
        .bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b".-_".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect();
    let disp = format!(
        "{}; filename=\"{ascii}\"; filename*=UTF-8''{utf8}",
        if q.inline && image { "inline" } else { "attachment" }
    );
    Ok((
        [
            (header::CONTENT_TYPE, ct),
            (header::CONTENT_DISPOSITION, disp),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".into()),
            (header::CONTENT_SECURITY_POLICY, "default-src 'none'; sandbox".into()),
            (header::CACHE_CONTROL, "private, max-age=3600".into()),
        ],
        data,
    )
        .into_response())
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
pub async fn ice(headers: HeaderMap, user: User) -> Json<Value> {
    let mut v = ice_servers(&headers, user.id);
    v["online"] = json!(online_users());
    Json(v)
}

/// STUN/TURN-Zugang (TURN-Zugangsdaten zeitlich begrenzt, an eine ID gebunden)
pub(crate) fn ice_servers(headers: &HeaderMap, id: Uuid) -> Value {
    let host = std::env::var("PUBLIC_HOST").ok().unwrap_or_else(|| {
        headers
            .get("host")
            .and_then(|h| h.to_str().ok())
            .map(|h| h.split(':').next().unwrap_or(h).to_string())
            .unwrap_or_else(|| "localhost".into())
    });
    let port = std::env::var("STUN_PORT").unwrap_or_else(|_| "3478".into());
    let mut servers = vec![json!({ "urls": format!("stun:{host}:{port}") })];
    if crate::turn::enabled() {
        let (username, credential) = crate::turn::credentials(id);
        servers.push(json!({ "urls": format!("turn:{host}:{port}?transport=udp"), "username": username, "credential": credential }));
    }
    json!({ "iceServers": servers })
}

/// Mitglieder, die gerade nirgends verbunden sind, per Push benachrichtigen
fn push_offline(db: &sqlx::PgPool, members: &[Uuid], sender: Uuid, room: Uuid, name: &str, body: &str) {
    let online = online_users();
    let targets: Vec<Uuid> = members.iter().copied().filter(|m| *m != sender && !online.contains(m)).collect();
    if targets.is_empty() {
        return;
    }
    let (db, text) = (db.clone(), format!("{name}: {}", body.chars().take(140).collect::<String>()));
    tokio::spawn(async move {
        for t in targets {
            super::notify::push_only(
                &db,
                t,
                "message",
                "new",
                &text,
                &format!("/portal/nachrichten?room={room}"),
                json!({}),
            )
            .await;
        }
    });
}

// ── WebSocket ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: String,
}

pub async fn ws(State(s): State<AppState>, Query(q): Query<WsQuery>, up: WebSocketUpgrade) -> ApiResult<Response> {
    // Browser können beim WebSocket keine Header setzen → Token als Parameter
    let row: Option<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT u.id, t.id, u.display_name FROM api_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.is_active AND NOT u.must_change_password
            AND (t.expires_at IS NULL OR t.expires_at > now())",
    )
    .bind(hash_token(&q.token))
    .fetch_optional(&s.db)
    .await?;
    let (user, token, name) = row.ok_or(ApiError::Unauthorized)?;
    Ok(up.max_message_size(256 * 1024).on_upgrade(move |socket| session(s, user, token, name, socket)))
}

async fn session(s: AppState, user: Uuid, token: Uuid, name: String, socket: WebSocket) {
    let (mut sink, mut stream) = socket.split();
    let mut reg = Registration::new(user, token);
    loop {
        tokio::select! {
            out = reg.rx.recv() => match out {
                Some(m) if m == KICK => {
                    let _ = sink.send(Message::Close(None)).await;
                    break;
                }
                Some(m) => {
                    if sink.send(Message::Text(m.into())).await.is_err() {
                        break;
                    }
                }
                None => break,
            },
            inc = stream.next() => {
                let Some(Ok(msg)) = inc else { break };
                if let Message::Text(text) = msg {
                    handle(&s, user, &name, &text).await;
                }
            }
        }
    }
}

async fn handle(s: &AppState, user: Uuid, name: &str, text: &str) {
    let Ok(v) = serde_json::from_str::<Value>(text) else { return };
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
                let data = v.get("data").cloned().unwrap_or(Value::Null);
                let _ = relay(s, room, user, name, to, data).await;
            }
        }
        _ => {}
    }
}

/// Anruf-Signal weiterleiten; Klingeln zusätzlich per Push (Handy/PC), verpasste Anrufe merken
pub async fn relay(
    s: &AppState,
    room: Uuid,
    user: Uuid,
    name: &str,
    to: Uuid,
    data: Value,
) -> Result<bool, sqlx::Error> {
    let ms = members(&s.db, room).await?;
    if !ms.contains(&user) || !ms.contains(&to) {
        return Ok(false);
    }
    let kind = data.get("kind").and_then(|k| k.as_str()).unwrap_or_default().to_owned();
    let ev = json!({ "type": "call", "room": room, "from": user, "name": name, "data": data });
    send_user(to, &ev.to_string());
    match kind.as_str() {
        "ring" => {
            RINGS.lock().unwrap().insert((room, to), user);
            let media = if data.get("media").and_then(|m| m.as_str()) == Some("video") { "video" } else { "audio" };
            let url = format!(
                "/portal/nachrichten?ring={room}&from={user}&media={media}&t={}&name={}",
                chrono::Utc::now().timestamp_millis(),
                urlencode(name)
            );
            let title = data.get("title").and_then(|t| t.as_str()).filter(|_| data.get("group") == Some(&json!(true)));
            let text = match title {
                Some(g) => format!("{name} · {g}"),
                None => name.to_owned(),
            };
            let db = s.db.clone();
            tokio::spawn(async move {
                super::notify::push_only(
                    &db,
                    to,
                    "call",
                    "ring",
                    &text,
                    &url,
                    json!({ "call": true, "room": room, "from": user, "media": media, "requireInteraction": true }),
                )
                .await;
            });
        }
        // Angerufene/r hat reagiert → andere eigene Geräte hören auf zu klingeln
        "accept" | "decline" | "busy" => {
            RINGS.lock().unwrap().remove(&(room, user));
            send_user(user, &json!({ "type": "call-handled", "room": room }).to_string());
        }
        "hangup" => {
            let missed = {
                let mut r = RINGS.lock().unwrap();
                match r.get(&(room, to)) {
                    Some(from) if *from == user => r.remove(&(room, to)).is_some(),
                    _ => false,
                }
            };
            if missed {
                super::notify::emit(
                    &s.db,
                    &[to],
                    super::notify::Note::new("call", "missed", Some(room), name).actor(name).priority(2),
                );
                send_user(to, &json!({ "type": "call-handled", "room": room }).to_string());
            }
        }
        _ => {}
    }
    Ok(true)
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"-_.".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}

#[derive(Deserialize)]
pub struct SignalIn {
    pub to: Uuid,
    pub data: Value,
}

/// Anruf-Signal per REST (z. B. „Ablehnen“ aus VS Code oder der Push-Benachrichtigung)
pub async fn signal(
    State(s): State<AppState>,
    user: User,
    Path(room): Path<Uuid>,
    Json(b): Json<SignalIn>,
) -> ApiResult<StatusCode> {
    let kind = b.data.get("kind").and_then(|k| k.as_str()).unwrap_or_default();
    if !["decline", "busy"].contains(&kind) {
        return Err(ApiError::BadRequest("Nur Ablehnen per REST".into()));
    }
    let name: String =
        sqlx::query_scalar("SELECT display_name FROM users WHERE id = $1").bind(user.id).fetch_one(&s.db).await?;
    if !relay(&s, room, user.id, &name, b.to, b.data).await? {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
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
