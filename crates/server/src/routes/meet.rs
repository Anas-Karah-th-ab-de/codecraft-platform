//! Online-Meetings und Termin-Erinnerungen.
//!
//! - Ein Kalendertermin kann ein Online-Meeting sein. Teilnehmer mit Konto treten über das Portal bei,
//!   externe Gäste über einen geheimen Link (`/meet/<schlüssel>`) ohne Konto – nur mit Namen.
//! - Gäste warten im Vorraum, bis jemand mit Konto sie einlässt (abschaltbar je Termin).
//! - Bild/Ton laufen direkt zwischen den Browsern (WebRTC-Mesh, bis 12 Personen); der Server reicht
//!   nur Signale zwischen eingelassenen Teilnehmern desselben Meetings weiter.
//! - Erinnerungen (z. B. 15 min, 1 h, 1 Tag vorher) gehen als Portal-Hinweis und E-Mail an alle
//!   Beteiligten, an Gäste per E-Mail mit Link. Jede Erinnerung genau einmal je Empfänger.

use crate::auth::{hash_token, new_token, User};
use crate::error::{ApiError, ApiResult};
use crate::mail::guard;
use crate::AppState;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc, Weekday};
use codecraft_domain::access::Role;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{PgConnection, PgPool};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use uuid::Uuid;

const MAX_PEOPLE: usize = 12;
pub const REMINDER_CHOICES: [i32; 9] = [0, 5, 10, 15, 30, 60, 120, 1440, 2880];

pub fn public_url() -> String {
    std::env::var("PUBLIC_URL").unwrap_or_else(|_| "https://code-craft.tech".into()).trim_end_matches('/').to_string()
}

// ── Termin ↔ Meeting / Gäste ────────────────────────────────────────────────

#[derive(Deserialize, Clone)]
pub struct GuestIn {
    pub email: String,
    #[serde(default)]
    pub name: String,
}

/// Meeting zum Termin anlegen, Vorraum-Einstellung setzen oder (offline) entfernen
pub(crate) async fn sync_meeting(conn: &mut PgConnection, event: Uuid, online: bool, lobby: bool) -> ApiResult<()> {
    if !online {
        sqlx::query("DELETE FROM meetings WHERE event_id = $1").bind(event).execute(conn).await?;
        return Ok(());
    }
    let r = sqlx::query("UPDATE meetings SET lobby = $2 WHERE event_id = $1")
        .bind(event)
        .bind(lobby)
        .execute(&mut *conn)
        .await?;
    if r.rows_affected() == 0 {
        let token = new_token("m_");
        sqlx::query("INSERT INTO meetings (id, event_id, token_hash, token_sealed, lobby) VALUES ($1,$2,$3,$4,$5)")
            .bind(Uuid::now_v7())
            .bind(event)
            .bind(hash_token(&token))
            .bind(guard::seal(token.as_bytes()))
            .bind(lobby)
            .execute(conn)
            .await?;
    }
    Ok(())
}

/// Gastlink eines Termins (für Organisator und Einladungen)
pub(crate) async fn guest_link(conn: &mut PgConnection, event: Uuid) -> ApiResult<Option<String>> {
    let sealed: Option<Vec<u8>> = sqlx::query_scalar("SELECT token_sealed FROM meetings WHERE event_id = $1")
        .bind(event)
        .fetch_optional(conn)
        .await?;
    Ok(sealed.and_then(|s| String::from_utf8(guard::open(s)).ok()).map(|t| format!("{}/meet/{t}", public_url())))
}

fn valid_email(e: &str) -> bool {
    let e = e.trim();
    e.len() <= 200
        && !e.contains(char::is_whitespace)
        && e.split_once('@')
            .is_some_and(|(l, d)| !l.is_empty() && d.contains('.') && !d.starts_with('.') && !d.ends_with('.'))
}

/// Gästeliste setzen; liefert die neu hinzugekommenen (für Einladungen)
pub(crate) async fn sync_guests(
    conn: &mut PgConnection,
    event: Uuid,
    guests: &[GuestIn],
) -> ApiResult<Vec<(String, String)>> {
    if guests.len() > 50 {
        return Err(ApiError::BadRequest("Höchstens 50 Gäste".into()));
    }
    let mut emails = vec![];
    for g in guests {
        let e = g.email.trim().to_lowercase();
        if !valid_email(&e) || g.name.chars().count() > 100 {
            return Err(ApiError::BadRequest(format!("Gast-E-Mail ungültig: {}", g.email)));
        }
        emails.push(e);
    }
    sqlx::query("DELETE FROM calendar_guests WHERE event_id = $1 AND NOT (lower(email) = ANY($2))")
        .bind(event)
        .bind(&emails)
        .execute(&mut *conn)
        .await?;
    let mut added = vec![];
    for (g, e) in guests.iter().zip(&emails) {
        let r = sqlx::query(
            "INSERT INTO calendar_guests (id, event_id, email, name) VALUES ($1,$2,$3,$4)
             ON CONFLICT (event_id, lower(email)) DO UPDATE SET name = EXCLUDED.name",
        )
        .bind(Uuid::now_v7())
        .bind(event)
        .bind(e)
        .bind(g.name.trim())
        .execute(&mut *conn)
        .await?;
        let fresh: bool = sqlx::query_scalar(
            "SELECT invited_at IS NULL FROM calendar_guests WHERE event_id = $1 AND lower(email) = $2",
        )
        .bind(event)
        .bind(e)
        .fetch_one(&mut *conn)
        .await?;
        if r.rows_affected() > 0 && fresh {
            added.push((e.clone(), g.name.trim().to_string()));
        }
    }
    Ok(added)
}

// ── Zeit & Kalenderdatei für E-Mails ────────────────────────────────────────

fn last_sunday(year: i32, month: u32) -> NaiveDate {
    let mut d = NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap_or_default() - Duration::days(1);
    while d.weekday() != Weekday::Sun {
        d -= Duration::days(1);
    }
    d
}

/// Uhrzeit für Menschen: Berlin (MEZ/MESZ) und Damaskus (UTC+3)
pub(crate) fn human_time(t: DateTime<Utc>) -> String {
    let y = t.year();
    let summer_from = last_sunday(y, 3).and_hms_opt(1, 0, 0).unwrap_or_default().and_utc();
    let summer_to = last_sunday(y, 10).and_hms_opt(1, 0, 0).unwrap_or_default().and_utc();
    let berlin = if t >= summer_from && t < summer_to { 2 } else { 1 };
    let b = t + Duration::hours(berlin);
    let d = t + Duration::hours(3);
    format!("{} Uhr Berlin / {} Damaskus", b.format("%d.%m.%Y %H:%M"), d.format("%H:%M"))
}

fn ics_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace(';', "\\;").replace(',', "\\,").replace('\n', "\\n").replace('\r', "")
}

pub(crate) fn ics(
    id: Uuid,
    title: &str,
    desc: &str,
    location: &str,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    link: Option<&str>,
) -> String {
    let f = |t: DateTime<Utc>| t.format("%Y%m%dT%H%M%SZ").to_string();
    let desc = match link {
        Some(l) => format!("{desc}\n\nOnline-Meeting: {l}"),
        None => desc.to_string(),
    };
    let loc = if location.is_empty() { link.unwrap_or("") } else { location };
    format!(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//KM Code Craft//Portal//DE\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:{id}@code-craft.tech\r\nDTSTAMP:{}\r\nDTSTART:{}\r\nDTEND:{}\r\nSUMMARY:{}\r\nDESCRIPTION:{}\r\nLOCATION:{}\r\n{}END:VEVENT\r\nEND:VCALENDAR\r\n",
        f(Utc::now()),
        f(start),
        f(end),
        ics_escape(title),
        ics_escape(desc.trim()),
        ics_escape(loc),
        link.map(|l| format!("URL:{l}\r\n")).unwrap_or_default()
    )
}

type EventInfo = (String, String, String, DateTime<Utc>, DateTime<Utc>, String);

async fn event_info(db: &PgPool, event: Uuid) -> Option<(EventInfo, Option<String>)> {
    let e: EventInfo = sqlx::query_as(
        "SELECT e.title, e.description, e.location, e.starts_at, e.ends_at, u.display_name FROM calendar_events e JOIN users u ON u.id = e.created_by WHERE e.id = $1",
    )
    .bind(event)
    .fetch_optional(db)
    .await
    .ok()??;
    let mut conn = db.acquire().await.ok()?;
    let link = guest_link(&mut conn, event).await.ok().flatten();
    Some((e, link))
}

/// Einladungen an neue Gäste (im Hintergrund)
pub(crate) fn invite_guests(db: PgPool, event: Uuid, guests: Vec<(String, String)>) {
    if guests.is_empty() {
        return;
    }
    tokio::spawn(async move {
        let Some(((title, desc, location, start, end, organizer), link)) = event_info(&db, event).await else { return };
        let file = ics(event, &title, &desc, &location, start, end, link.as_deref());
        for (email, name) in guests {
            let hello = if name.is_empty() { "Guten Tag,".to_string() } else { format!("Guten Tag {name},") };
            let mut text = format!(
                "{hello}\r\n\r\n{organizer} lädt Sie zu folgendem Termin ein:\r\n\r\n{title}\r\n{}\r\n",
                human_time(start)
            );
            if !location.is_empty() {
                text.push_str(&format!("Ort: {location}\r\n"));
            }
            if let Some(l) = &link {
                text.push_str(&format!(
                    "\r\nOnline teilnehmen (ohne Konto, im Browser): {l}\r\nKurz vor Beginn öffnen, Namen eingeben, beitreten. Sie werden eingelassen, sobald das Meeting beginnt.\r\n"
                ));
            }
            if !desc.is_empty() {
                text.push_str(&format!("\r\n{desc}\r\n"));
            }
            text.push_str("\r\nKM Code Craft\r\n");
            if crate::mail::system_send(&db, &email, &format!("Einladung: {title}"), &text, Some(file.clone())).await {
                let _ = sqlx::query(
                    "UPDATE calendar_guests SET invited_at = now() WHERE event_id = $1 AND lower(email) = $2",
                )
                .bind(event)
                .bind(&email)
                .execute(&db)
                .await;
            }
        }
    });
}

// ── Erinnerungen ────────────────────────────────────────────────────────────

pub async fn reminder_worker(db: PgPool) {
    let mut tick = tokio::time::interval(std::time::Duration::from_secs(60));
    loop {
        tick.tick().await;
        if let Err(e) = send_due_reminders(&db, Utc::now()).await {
            tracing::warn!("Erinnerungen: {e}");
        }
    }
}

fn before(minutes: i32) -> String {
    match minutes {
        0 => "jetzt".into(),
        m if m < 60 => format!("in {m} Minuten"),
        60 => "in 1 Stunde".into(),
        m if m < 1440 => format!("in {} Stunden", m / 60),
        1440 => "morgen".into(),
        m => format!("in {} Tagen", m / 1440),
    }
}

/// Fällige Erinnerungen verschicken; liefert die Anzahl der Empfänger
pub async fn send_due_reminders(db: &PgPool, now: DateTime<Utc>) -> Result<usize, sqlx::Error> {
    type Due = (Uuid, String, String, DateTime<Utc>, DateTime<Utc>, i32, bool);
    let due: Vec<Due> = sqlx::query_as(
        "SELECT e.id, e.title, e.location, e.starts_at, e.ends_at, m, e.online
           FROM calendar_events e, unnest(e.reminders) AS m
          WHERE e.starts_at - make_interval(mins => m) <= $1
            AND e.starts_at - make_interval(mins => m) > $1 - interval '1 hour'
            AND e.ends_at > $1",
    )
    .bind(now)
    .fetch_all(db)
    .await?;
    let mut sent = 0;
    for (event, title, location, start, _end, minutes, online) in due {
        let users: Vec<(Uuid, String)> = sqlx::query_as(
            "SELECT u.id, u.email FROM users u WHERE u.is_active AND (
                u.id = (SELECT created_by FROM calendar_events WHERE id = $1)
                OR u.id IN (SELECT user_id FROM calendar_attendees WHERE event_id = $1 AND response <> 'declined'))",
        )
        .bind(event)
        .fetch_all(db)
        .await?;
        let guests: Vec<String> = sqlx::query_scalar("SELECT email FROM calendar_guests WHERE event_id = $1")
            .bind(event)
            .fetch_all(db)
            .await?;
        let link = if online {
            let mut conn = db.acquire().await?;
            guest_link(&mut conn, event).await.ok().flatten()
        } else {
            None
        };
        let meeting: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM meetings WHERE event_id = $1").bind(event).fetch_optional(db).await?;
        let when = human_time(start);
        let subject = format!("Erinnerung: {title} ({})", before(minutes));
        for (uid, email) in users {
            if !claim(db, event, &format!("u:{uid}"), minutes).await? {
                continue;
            }
            sent += 1;
            let ev = json!({ "type": "calendar", "event": "reminder", "id": event, "title": title, "starts_at": start,
                             "minutes": minutes, "meeting": meeting });
            super::chat::send_user(uid, &ev.to_string());
            let mut text = format!("Erinnerung an Ihren Termin:\r\n\r\n{title}\r\n{when}\r\n");
            if !location.is_empty() {
                text.push_str(&format!("Ort: {location}\r\n"));
            }
            if let Some(m) = meeting {
                text.push_str(&format!("\r\nOnline-Meeting im Portal: {}/portal/meeting/{m}\r\n", public_url()));
            }
            let db2 = db.clone();
            let subject = subject.clone();
            tokio::spawn(async move {
                crate::mail::system_send(&db2, &email, &subject, &text, None).await;
            });
        }
        for email in guests {
            if !claim(db, event, &format!("g:{}", email.to_lowercase()), minutes).await? {
                continue;
            }
            sent += 1;
            let mut text = format!("Erinnerung an den Termin:\r\n\r\n{title}\r\n{when}\r\n");
            if let Some(l) = &link {
                text.push_str(&format!("\r\nOnline teilnehmen (ohne Konto): {l}\r\n"));
            }
            text.push_str("\r\nKM Code Craft\r\n");
            let db2 = db.clone();
            let subject = subject.clone();
            tokio::spawn(async move {
                crate::mail::system_send(&db2, &email, &subject, &text, None).await;
            });
        }
    }
    Ok(sent)
}

async fn claim(db: &PgPool, event: Uuid, recipient: &str, minutes: i32) -> Result<bool, sqlx::Error> {
    let r = sqlx::query(
        "INSERT INTO calendar_reminders_sent (event_id, recipient, minutes) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
    )
    .bind(event)
    .bind(recipient)
    .bind(minutes)
    .execute(db)
    .await?;
    Ok(r.rows_affected() == 1)
}

// ── Zugang zum Meeting ──────────────────────────────────────────────────────

struct Access {
    meeting: Uuid,
    title: String,
    starts_at: DateTime<Utc>,
    ends_at: DateTime<Utc>,
    lobby: bool,
    event: Uuid,
    owner: bool,
}

type AccessRow = (Uuid, String, DateTime<Utc>, DateTime<Utc>, bool, Uuid, Uuid);
const ACCESS_SELECT: &str =
    "SELECT m.id, e.title, e.starts_at, e.ends_at, m.lobby, e.id, e.created_by FROM meetings m JOIN calendar_events e ON e.id = m.event_id";

async fn by_link(db: &PgPool, link: &str) -> ApiResult<Access> {
    let r: AccessRow = sqlx::query_as(&format!("{ACCESS_SELECT} WHERE m.token_hash = $1"))
        .bind(hash_token(link.trim()))
        .fetch_optional(db)
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Access { meeting: r.0, title: r.1, starts_at: r.2, ends_at: r.3, lobby: r.4, event: r.5, owner: false })
}

async fn by_member(db: &PgPool, meeting: Uuid, user: Uuid, role: Role) -> ApiResult<Access> {
    let r: AccessRow = sqlx::query_as(&format!("{ACCESS_SELECT} WHERE m.id = $1"))
        .bind(meeting)
        .fetch_optional(db)
        .await?
        .ok_or(ApiError::NotFound)?;
    let attendee: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM calendar_attendees WHERE event_id = $1 AND user_id = $2)")
            .bind(r.5)
            .bind(user)
            .fetch_one(db)
            .await?;
    let owner = r.6 == user || role == Role::Admin;
    if !owner && !attendee {
        return Err(ApiError::NotFound);
    }
    Ok(Access { meeting: r.0, title: r.1, starts_at: r.2, ends_at: r.3, lobby: r.4, event: r.5, owner })
}

/// Gäste: 30 min vor Beginn bis 3 h nach Ende; Mitglieder: ab 2 h vorher
fn state(a: &Access, guest: bool, now: DateTime<Utc>) -> &'static str {
    let early = if guest { Duration::minutes(30) } else { Duration::hours(2) };
    if now < a.starts_at - early {
        "early"
    } else if now > a.ends_at + Duration::hours(3) {
        "ended"
    } else {
        "open"
    }
}

fn info(a: &Access, guest: bool, headers: &HeaderMap) -> Value {
    json!({
        "id": a.meeting, "title": a.title, "starts_at": a.starts_at, "ends_at": a.ends_at, "lobby": a.lobby,
        "state": state(a, guest, Utc::now()), "iceServers": super::chat::ice_servers(headers, a.meeting)["iceServers"],
    })
}

#[derive(Deserialize)]
pub struct LinkQuery {
    pub link: String,
}

/// Öffentlich: Angaben zum Meeting für die Gastseite
pub async fn public_info(
    State(s): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<LinkQuery>,
) -> ApiResult<Json<Value>> {
    let a = by_link(&s.db, &q.link).await?;
    Ok(Json(info(&a, true, &headers)))
}

/// Mitglieder: Angaben + Gastlink (Organisator/Admin)
pub async fn member_info(
    State(s): State<AppState>,
    headers: HeaderMap,
    user: User,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Value>> {
    let a = by_member(&s.db, id, user.id, user.role).await?;
    let mut v = info(&a, false, &headers);
    if a.owner {
        let mut conn = s.db.acquire().await?;
        v["link"] = json!(guest_link(&mut conn, a.event).await?);
    }
    v["owner"] = json!(a.owner);
    v["name"] = json!(
        sqlx::query_scalar::<_, String>("SELECT display_name FROM users WHERE id = $1")
            .bind(user.id)
            .fetch_one(&s.db)
            .await?
    );
    Ok(Json(v))
}

#[derive(Deserialize)]
pub struct WsQuery {
    /// Gast: Link-Schlüssel + Name
    pub link: Option<String>,
    pub name: Option<String>,
    /// Mitglied: Meeting + Sitzungs-Token
    pub meeting: Option<Uuid>,
    pub token: Option<String>,
}

fn clean_name(s: &str) -> String {
    s.chars()
        .filter(|c| !c.is_control())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(60)
        .collect()
}

pub async fn ws(State(s): State<AppState>, Query(q): Query<WsQuery>, up: WebSocketUpgrade) -> ApiResult<Response> {
    let (a, name, guest) = if let (Some(m), Some(t)) = (q.meeting, q.token.as_deref()) {
        let row: Option<(Uuid, String, String)> = sqlx::query_as(
            "SELECT u.id, u.display_name, u.role FROM api_tokens t JOIN users u ON u.id = t.user_id
              WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.is_active AND NOT u.must_change_password
                AND (t.expires_at IS NULL OR t.expires_at > now())",
        )
        .bind(hash_token(t))
        .fetch_optional(&s.db)
        .await?;
        let (uid, name, role) = row.ok_or(ApiError::Unauthorized)?;
        let role = Role::parse(&role).ok_or(ApiError::Forbidden)?;
        (by_member(&s.db, m, uid, role).await?, name, false)
    } else if let Some(link) = q.link.as_deref() {
        let name = clean_name(q.name.as_deref().unwrap_or(""));
        if name.chars().count() < 2 {
            return Err(ApiError::BadRequest("Bitte Namen angeben".into()));
        }
        (by_link(&s.db, link).await?, name, true)
    } else {
        return Err(ApiError::Unauthorized);
    };
    match state(&a, guest, Utc::now()) {
        "early" => return Err(ApiError::Conflict("Das Meeting hat noch nicht begonnen".into())),
        "ended" => return Err(ApiError::Conflict("Das Meeting ist beendet".into())),
        _ => {}
    }
    let (meeting, lobby) = (a.meeting, a.lobby);
    Ok(up.max_message_size(128 * 1024).on_upgrade(move |socket| session(meeting, lobby, name, guest, socket)))
}

// ── Räume im Speicher ───────────────────────────────────────────────────────

struct Peer {
    id: Uuid,
    name: String,
    guest: bool,
    admitted: bool,
    tx: UnboundedSender<String>,
}

static ROOMS: LazyLock<Mutex<HashMap<Uuid, Vec<Peer>>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

fn pinfo(p: &Peer) -> Value {
    json!({ "id": p.id, "name": p.name, "guest": p.guest })
}

fn send_to<'a>(peers: impl Iterator<Item = &'a Peer>, msg: &Value) {
    let m = msg.to_string();
    for p in peers {
        let _ = p.tx.send(m.clone());
    }
}

/// Teilnehmerzahl eines Meetings (für Tests/Anzeige)
pub fn present(meeting: Uuid) -> usize {
    ROOMS.lock().unwrap().get(&meeting).map(|r| r.len()).unwrap_or(0)
}

async fn session(meeting: Uuid, lobby: bool, name: String, guest: bool, socket: WebSocket) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = unbounded_channel::<String>();
    let me = Uuid::new_v4();
    let full = {
        let mut rooms = ROOMS.lock().unwrap();
        let room = rooms.entry(meeting).or_default();
        if room.len() >= MAX_PEOPLE {
            true
        } else {
            let admitted = !guest || !lobby;
            let peer = Peer { id: me, name: name.clone(), guest, admitted, tx: tx.clone() };
            let others: Vec<Value> = room.iter().filter(|p| p.admitted).map(pinfo).collect();
            let waiting: Vec<Value> = room.iter().filter(|p| !p.admitted).map(pinfo).collect();
            let _ = tx.send(
                json!({ "type": "welcome", "you": pinfo(&peer), "admitted": admitted, "host": !guest,
                    "peers": if admitted { others } else { vec![] }, "waiting": if guest { vec![] } else { waiting } })
                .to_string(),
            );
            if admitted {
                send_to(room.iter().filter(|p| p.admitted), &json!({ "type": "joined", "peer": pinfo(&peer) }));
            } else {
                send_to(
                    room.iter().filter(|p| p.admitted && !p.guest),
                    &json!({ "type": "knock", "peer": pinfo(&peer) }),
                );
            }
            room.push(peer);
            false
        }
    };
    if full {
        let _ = sink.send(Message::Text(json!({ "type": "full" }).to_string().into())).await;
        return;
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
        let target = v.get("to").or_else(|| v.get("id")).and_then(|t| t.as_str()).and_then(|t| t.parse::<Uuid>().ok());
        let mut rooms = ROOMS.lock().unwrap();
        let Some(room) = rooms.get_mut(&meeting) else { break };
        let Some(self_peer) = room.iter().find(|p| p.id == me) else { break };
        if !self_peer.admitted {
            continue; // im Vorraum: nichts senden
        }
        let host = !self_peer.guest;
        match v.get("type").and_then(|t| t.as_str()) {
            Some("signal") => {
                if let Some(t) = target.and_then(|t| room.iter().find(|p| p.id == t && p.admitted)) {
                    let _ = t.tx.send(
                        json!({ "type": "signal", "from": me, "data": v.get("data").cloned().unwrap_or(Value::Null) })
                            .to_string(),
                    );
                }
            }
            Some("chat") => {
                let text: String = v.get("text").and_then(|t| t.as_str()).unwrap_or("").chars().take(1000).collect();
                if !text.trim().is_empty() {
                    let ev = json!({ "type": "chat", "from": me, "name": name, "text": text, "at": Utc::now() });
                    send_to(room.iter().filter(|p| p.admitted), &ev);
                }
            }
            Some("admit") if host => {
                if let Some(t) = target {
                    if let Some(i) = room.iter().position(|p| p.id == t && !p.admitted) {
                        room[i].admitted = true;
                        let peers: Vec<Value> = room.iter().filter(|p| p.admitted && p.id != t).map(pinfo).collect();
                        let _ = room[i].tx.send(json!({ "type": "admitted", "peers": peers }).to_string());
                        let joined = json!({ "type": "joined", "peer": pinfo(&room[i]) });
                        send_to(room.iter().filter(|p| p.admitted && p.id != t), &joined);
                        send_to(
                            room.iter().filter(|p| p.admitted && !p.guest),
                            &json!({ "type": "knock-done", "id": t }),
                        );
                    }
                }
            }
            Some("deny") if host => {
                if let Some(t) = target {
                    if let Some(i) = room.iter().position(|p| p.id == t && !p.admitted) {
                        let p = room.remove(i);
                        let _ = p.tx.send(json!({ "type": "denied" }).to_string());
                        send_to(
                            room.iter().filter(|p| p.admitted && !p.guest),
                            &json!({ "type": "knock-done", "id": t }),
                        );
                    }
                }
            }
            Some("media") => {
                let ev = json!({ "type": "media", "id": me, "mic": v.get("mic"), "cam": v.get("cam") });
                send_to(room.iter().filter(|p| p.admitted && p.id != me), &ev);
            }
            _ => {}
        }
    }
    writer.abort();
    let mut rooms = ROOMS.lock().unwrap();
    if let Some(room) = rooms.get_mut(&meeting) {
        if let Some(i) = room.iter().position(|p| p.id == me) {
            let p = room.remove(i);
            if p.admitted {
                send_to(room.iter().filter(|p| p.admitted), &json!({ "type": "left", "id": me }));
            } else {
                send_to(room.iter().filter(|p| p.admitted && !p.guest), &json!({ "type": "knock-done", "id": me }));
            }
        }
        if room.is_empty() {
            rooms.remove(&meeting);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn times_and_files() {
        let winter = "2026-11-09T09:00:00Z".parse::<DateTime<Utc>>().unwrap();
        assert_eq!(human_time(winter), "09.11.2026 10:00 Uhr Berlin / 12:00 Damaskus");
        let summer = "2026-07-01T09:00:00Z".parse::<DateTime<Utc>>().unwrap();
        assert!(human_time(summer).starts_with("01.07.2026 11:00"));
        let f = ics(
            Uuid::nil(),
            "Abnahme; Teil 1",
            "Zeile\nzwei",
            "",
            winter,
            winter + Duration::hours(1),
            Some("https://x/meet/abc"),
        );
        assert!(f.contains("SUMMARY:Abnahme\\; Teil 1"));
        assert!(f.contains("DTSTART:20261109T090000Z"));
        assert!(f.contains("URL:https://x/meet/abc"));
        assert!(f.contains("LOCATION:https://x/meet/abc"));
        assert!(valid_email("a.b@firma.de") && !valid_email("a@b") && !valid_email("x y@z.de"));
        assert_eq!(clean_name("  Max \n Muster\u{7}  "), "Max Muster");
        assert_eq!(before(1440), "morgen");
    }
}
