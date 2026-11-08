//! Benachrichtigungen: gespeichert (Mitteilungs-Center), live per WebSocket/Ereignis-Stream,
//! als Web-Push an Handy/PC. Dazu Einstellungen (stumm, „Nicht stören“), Geräte-Abos und
//! persönliche Zugangsschlüssel für Erweiterungen (z. B. VS Code).

use crate::auth::{hash_token, new_token, User};
use crate::error::{ApiError, ApiResult};
use crate::push::{self, Urgency};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use chrono::{DateTime, Utc};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::convert::Infallible;
use uuid::Uuid;

/// Eine Benachrichtigung
#[derive(Clone, Debug, Default)]
pub struct Note {
    pub kind: String,
    pub event: String,
    pub ref_id: Option<Uuid>,
    pub title: String,
    pub body: String,
    pub link: Option<String>,
    pub actor: Option<String>,
    /// 0 = leise (nur Liste), 1 = normal, 2 = wichtig
    pub priority: i16,
}

impl Note {
    pub fn new(kind: &str, event: &str, ref_id: Option<Uuid>, title: &str) -> Self {
        Note {
            kind: kind.into(),
            event: event.into(),
            ref_id,
            title: title.chars().take(300).collect(),
            link: link_for(kind, event, ref_id),
            priority: 1,
            ..Default::default()
        }
    }
    pub fn body(mut self, b: &str) -> Self {
        self.body = b.chars().take(1000).collect();
        self
    }
    pub fn priority(mut self, p: i16) -> Self {
        self.priority = p.clamp(0, 2);
        self
    }
    pub fn link(mut self, l: &str) -> Self {
        self.link = Some(l.into());
        self
    }
    pub fn actor(mut self, a: &str) -> Self {
        self.actor = Some(a.into());
        self
    }
}

/// Wohin ein Klick führt
pub fn link_for(kind: &str, event: &str, id: Option<Uuid>) -> Option<String> {
    let id = id.map(|i| i.to_string()).unwrap_or_default();
    Some(match kind {
        "ticket" => format!("/portal/support/{id}"),
        "request" => format!("/portal/anfragen-entwicklung/{id}"),
        "project" => format!("/portal/projekte/{id}"),
        "quote" => format!("/portal/angebote/{id}"),
        "order" => "/portal/shop".into(),
        "leave" => "/portal/arbeit?tab=urlaub".into(),
        "calendar" => "/portal/arbeit?tab=kalender".into(),
        "announcement" => format!("/portal/ankuendigungen#{id}"),
        "call" | "message" => format!("/portal/nachrichten?room={id}"),
        "user" if event == "deactivated" => "/portal/benutzer".into(),
        _ => return None,
    })
}

/// Text für Push (Server kennt die Sprache des Benutzers)
pub fn label(kind: &str, event: &str, l: &str) -> &'static str {
    let i = match l {
        "en" => 1,
        "ar" => 2,
        _ => 0,
    };
    let t: [&str; 3] = match (kind, event) {
        ("ticket", "new") => ["Neues Ticket", "New ticket", "تذكرة جديدة"],
        ("ticket", "message") => ["Neue Antwort im Ticket", "New reply on ticket", "رد جديد على التذكرة"],
        ("ticket", _) => ["Ticket aktualisiert", "Ticket updated", "تم تحديث التذكرة"],
        ("order", "new") => ["Neue Bestellung", "New order", "طلب شراء جديد"],
        ("order", _) => ["Bestellung aktualisiert", "Order updated", "تم تحديث الطلب"],
        ("quote", "sent") => ["Neues Angebot", "New quote", "عرض سعر جديد"],
        ("quote", "accepted") => ["Angebot angenommen", "Quote accepted", "تم قبول العرض"],
        ("quote", _) => ["Angebot geändert", "Quote changed", "تم تغيير العرض"],
        ("request", "new") => ["Neue Entwicklungsanfrage", "New development request", "طلب تطوير جديد"],
        ("request", "message") => ["Neue Nachricht zur Anfrage", "New message on request", "رسالة جديدة على الطلب"],
        ("request", _) => ["Anfrage aktualisiert", "Request updated", "تم تحديث الطلب"],
        ("project", _) => ["Projekt aktualisiert", "Project updated", "تم تحديث المشروع"],
        ("leave", "new") => ["Neuer Urlaubsantrag", "New leave request", "طلب إجازة جديد"],
        ("leave", _) => ["Urlaubsantrag aktualisiert", "Leave request updated", "تم تحديث طلب الإجازة"],
        ("calendar", "new") => ["Neue Einladung", "New invitation", "دعوة جديدة"],
        ("calendar", "update") => ["Termin geändert", "Event changed", "تم تغيير الموعد"],
        ("calendar", "delete") => ["Termin abgesagt", "Event cancelled", "تم إلغاء الموعد"],
        ("calendar", "response") => ["Antwort auf Einladung", "Invitation response", "رد على الدعوة"],
        ("calendar", _) => ["Erinnerung", "Reminder", "تذكير"],
        ("call", "ring") => ["Eingehender Anruf", "Incoming call", "مكالمة واردة"],
        ("call", _) => ["Verpasster Anruf", "Missed call", "مكالمة فائتة"],
        ("message", _) => ["Neue Nachricht", "New message", "رسالة جديدة"],
        ("mail", _) => ["Neue E-Mail", "New email", "بريد جديد"],
        ("announcement", _) => ["Ankündigung", "Announcement", "إعلان"],
        ("user", "deactivated") => {
            ["Konto gesperrt – Aufgaben übergeben", "Account locked – tasks handed over", "تم إيقاف حساب – نقل المهام"]
        }
        ("user", _) => ["Benutzerkonto", "User account", "حساب المستخدم"],
        _ => ["Benachrichtigung", "Notification", "إشعار"],
    };
    t[i]
}

/// Im Hintergrund zustellen (für synchrone Aufrufer)
pub fn emit(db: &PgPool, users: &[Uuid], n: Note) {
    let (db, users) = (db.clone(), users.to_vec());
    tokio::spawn(async move {
        if let Err(e) = deliver(&db, &users, &n).await {
            tracing::warn!("notify: {e}");
        }
    });
}

#[derive(Serialize, sqlx::FromRow, Clone)]
pub struct Row {
    pub id: Uuid,
    pub kind: String,
    pub event: String,
    pub ref_id: Option<Uuid>,
    pub title: String,
    pub body: String,
    pub link: Option<String>,
    pub actor: Option<String>,
    pub priority: i16,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
}

type Target = (Uuid, String, Vec<String>, Option<DateTime<Utc>>);

/// Speichern, live senden, Push an Geräte (beachtet stumm/„Nicht stören“)
pub async fn deliver(db: &PgPool, users: &[Uuid], n: &Note) -> Result<usize, sqlx::Error> {
    let mut users: Vec<Uuid> = users.to_vec();
    users.sort();
    users.dedup();
    if users.is_empty() {
        return Ok(0);
    }
    // nur aktive Konten
    let targets: Vec<Target> = sqlx::query_as(
        "SELECT u.id, u.locale, COALESCE(p.muted, '{}'), p.dnd_until
           FROM users u LEFT JOIN notification_prefs p ON p.user_id = u.id
          WHERE u.id = ANY($1) AND u.is_active",
    )
    .bind(&users)
    .fetch_all(db)
    .await?;
    let now = Utc::now();
    for (uid, locale, muted, dnd) in &targets {
        let row = Row {
            id: Uuid::now_v7(),
            kind: n.kind.clone(),
            event: n.event.clone(),
            ref_id: n.ref_id,
            title: n.title.clone(),
            body: n.body.clone(),
            link: n.link.clone(),
            actor: n.actor.clone(),
            priority: n.priority,
            created_at: now,
            read_at: None,
        };
        sqlx::query(
            "INSERT INTO notifications (id, user_id, kind, event, ref_id, title, body, link, actor, priority)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(row.id)
        .bind(uid)
        .bind(&row.kind)
        .bind(&row.event)
        .bind(row.ref_id)
        .bind(&row.title)
        .bind(&row.body)
        .bind(&row.link)
        .bind(&row.actor)
        .bind(row.priority)
        .execute(db)
        .await?;
        let quiet = n.priority == 0 || muted.contains(&n.kind) || dnd.is_some_and(|d| d > now);
        super::chat::send_user(
            *uid,
            &json!({ "type": "notification", "notification": row, "quiet": quiet }).to_string(),
        );
        if !quiet {
            push::send(
                db.clone(),
                vec![*uid],
                json!({
                    "title": label(&n.kind, &n.event, locale),
                    "body": if n.body.is_empty() { n.title.clone() } else { format!("{}\n{}", n.title, n.body) },
                    "url": n.link.clone().unwrap_or_else(|| "/portal/mitteilungen".into()),
                    "tag": format!("{}-{}", n.kind, n.ref_id.map(|r| r.to_string()).unwrap_or_default()),
                    "kind": n.kind,
                }),
                if n.priority >= 2 { Urgency::High } else { Urgency::Normal },
                24 * 3600,
            );
        }
    }
    Ok(targets.len())
}

/// Nur Push, ohne Eintrag (z. B. Chat-Nachricht, Anruf, E-Mail) – nicht bei stumm/„Nicht stören“
pub async fn push_only(db: &PgPool, user: Uuid, kind: &str, event: &str, text: &str, url: &str, extra: Value) {
    let pref: Option<(String, Vec<String>, Option<DateTime<Utc>>)> = sqlx::query_as(
        "SELECT u.locale, COALESCE(p.muted, '{}'), p.dnd_until
           FROM users u LEFT JOIN notification_prefs p ON p.user_id = u.id WHERE u.id = $1 AND u.is_active",
    )
    .bind(user)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();
    let Some((locale, muted, dnd)) = pref else { return };
    if muted.iter().any(|m| m == kind) || dnd.is_some_and(|d| d > Utc::now()) {
        return;
    }
    let mut payload = json!({ "title": label(kind, event, &locale), "body": text, "url": url, "kind": kind, "tag": format!("{kind}-{event}") });
    if let (Some(p), Some(e)) = (payload.as_object_mut(), extra.as_object()) {
        p.extend(e.clone());
    }
    let call = kind == "call" && event == "ring";
    push::send(
        db.clone(),
        vec![user],
        payload,
        if call { Urgency::High } else { Urgency::Normal },
        if call { 40 } else { 3600 },
    );
}

// ── Mitteilungs-Center ──────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ListQ {
    #[serde(default)]
    pub unread: bool,
    pub kind: Option<String>,
    pub before: Option<DateTime<Utc>>,
}

pub async fn list(State(s): State<AppState>, user: User, Query(q): Query<ListQ>) -> ApiResult<Json<Value>> {
    let items: Vec<Row> = sqlx::query_as(
        "SELECT id, kind, event, ref_id, title, body, link, actor, priority, created_at, read_at
           FROM notifications
          WHERE user_id = $1 AND (NOT $2 OR read_at IS NULL) AND ($3::text IS NULL OR kind = $3)
            AND ($4::timestamptz IS NULL OR created_at < $4)
          ORDER BY created_at DESC LIMIT 60",
    )
    .bind(user.id)
    .bind(q.unread)
    .bind(q.kind.filter(|k| !k.is_empty()))
    .bind(q.before)
    .fetch_all(&s.db)
    .await?;
    let unread: i64 = sqlx::query_scalar("SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL")
        .bind(user.id)
        .fetch_one(&s.db)
        .await?;
    Ok(Json(json!({ "items": items, "unread": unread })))
}

#[derive(Deserialize)]
pub struct ReadIn {
    #[serde(default)]
    pub ids: Vec<Uuid>,
    #[serde(default)]
    pub all: bool,
    /// zurück auf ungelesen
    #[serde(default)]
    pub unread: bool,
}

pub async fn mark(State(s): State<AppState>, user: User, Json(b): Json<ReadIn>) -> ApiResult<Json<Value>> {
    let n = sqlx::query(
        "UPDATE notifications SET read_at = CASE WHEN $4 THEN NULL ELSE COALESCE(read_at, now()) END
          WHERE user_id = $1 AND ($2 OR id = ANY($3))",
    )
    .bind(user.id)
    .bind(b.all)
    .bind(&b.ids)
    .bind(b.unread)
    .execute(&s.db)
    .await?
    .rows_affected();
    super::chat::send_user(user.id, &json!({ "type": "notification-read" }).to_string());
    Ok(Json(json!({ "changed": n })))
}

pub async fn remove(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    sqlx::query("DELETE FROM notifications WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .execute(&s.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Alle gelesenen löschen
pub async fn clear(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    let n = sqlx::query("DELETE FROM notifications WHERE user_id = $1 AND read_at IS NOT NULL")
        .bind(user.id)
        .execute(&s.db)
        .await?
        .rows_affected();
    Ok(Json(json!({ "deleted": n })))
}

/// Test an alle eigenen Geräte
pub async fn test(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    let locale: String =
        sqlx::query_scalar("SELECT locale FROM users WHERE id = $1").bind(user.id).fetch_one(&s.db).await?;
    let text = match locale.as_str() {
        "en" => "It works – notifications reach this device.",
        "ar" => "يعمل – تصل الإشعارات إلى هذا الجهاز.",
        _ => "Es klappt – Benachrichtigungen kommen auf diesem Gerät an.",
    };
    deliver(&s.db, &[user.id], &Note::new("system", "test", None, text).link("/portal/mitteilungen")).await?;
    let devices = push::send_now(
        &s.db,
        &[user.id],
        &json!({ "title": "KM Code Craft", "body": text, "url": "/portal/mitteilungen", "tag": "test" }),
        Urgency::Normal,
        300,
    )
    .await?;
    Ok(Json(json!({ "devices": devices })))
}

// ── Einstellungen ───────────────────────────────────────────────────────────

pub const KINDS: [&str; 12] = [
    "ticket",
    "request",
    "project",
    "quote",
    "order",
    "leave",
    "calendar",
    "call",
    "message",
    "mail",
    "announcement",
    "user",
];

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Prefs {
    pub muted: Vec<String>,
    pub sound: bool,
    pub dnd_until: Option<DateTime<Utc>>,
}

pub async fn get_prefs(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    let p: Option<Prefs> = sqlx::query_as("SELECT muted, sound, dnd_until FROM notification_prefs WHERE user_id = $1")
        .bind(user.id)
        .fetch_optional(&s.db)
        .await?;
    let p = p.unwrap_or(Prefs { muted: vec![], sound: true, dnd_until: None });
    Ok(Json(json!({ "muted": p.muted, "sound": p.sound, "dnd_until": p.dnd_until, "kinds": KINDS })))
}

pub async fn put_prefs(State(s): State<AppState>, user: User, Json(b): Json<Prefs>) -> ApiResult<StatusCode> {
    if b.muted.iter().any(|m| !KINDS.contains(&m.as_str())) {
        return Err(ApiError::BadRequest("Unbekannte Art".into()));
    }
    if b.dnd_until.is_some_and(|d| d > Utc::now() + chrono::Duration::days(30)) {
        return Err(ApiError::BadRequest("„Nicht stören“ höchstens 30 Tage".into()));
    }
    sqlx::query(
        "INSERT INTO notification_prefs (user_id, muted, sound, dnd_until) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET muted = $2, sound = $3, dnd_until = $4",
    )
    .bind(user.id)
    .bind(&b.muted)
    .bind(b.sound)
    .bind(b.dnd_until)
    .execute(&s.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct LocaleIn {
    pub locale: String,
}

pub async fn set_locale(State(s): State<AppState>, user: User, Json(b): Json<LocaleIn>) -> ApiResult<StatusCode> {
    if !["de", "en", "ar"].contains(&b.locale.as_str()) {
        return Err(ApiError::BadRequest("Sprache".into()));
    }
    sqlx::query("UPDATE users SET locale = $2 WHERE id = $1").bind(user.id).bind(&b.locale).execute(&s.db).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Web-Push-Abos ───────────────────────────────────────────────────────────

pub async fn push_key(State(s): State<AppState>, _user: User) -> ApiResult<Json<Value>> {
    let k = push::vapid(&s.db).await?;
    Ok(Json(json!({ "key": push::public_key(&k) })))
}

#[derive(Deserialize)]
pub struct Keys {
    pub p256dh: String,
    pub auth: String,
}

#[derive(Deserialize)]
pub struct SubIn {
    pub endpoint: String,
    pub keys: Keys,
    #[serde(default)]
    pub label: String,
}

pub async fn subscribe(State(s): State<AppState>, user: User, Json(b): Json<SubIn>) -> ApiResult<StatusCode> {
    if !b.endpoint.starts_with("https://")
        || b.endpoint.len() > 1000
        || b.keys.p256dh.len() > 200
        || b.keys.auth.len() > 64
    {
        return Err(ApiError::BadRequest("Ungültiges Abo".into()));
    }
    // Abo gehört dem zuletzt angemeldeten Benutzer dieses Browsers
    sqlx::query(
        "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, label) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = $2, p256dh = $4, auth = $5, label = $6, failures = 0",
    )
    .bind(Uuid::now_v7())
    .bind(user.id)
    .bind(&b.endpoint)
    .bind(&b.keys.p256dh)
    .bind(&b.keys.auth)
    .bind(b.label.chars().take(120).collect::<String>())
    .execute(&s.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct UnsubIn {
    pub endpoint: String,
}

pub async fn unsubscribe(State(s): State<AppState>, user: User, Json(b): Json<UnsubIn>) -> ApiResult<StatusCode> {
    sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2")
        .bind(&b.endpoint)
        .bind(user.id)
        .execute(&s.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize, sqlx::FromRow)]
pub struct DeviceRow {
    pub id: Uuid,
    pub label: String,
    pub host: String,
    pub created_at: DateTime<Utc>,
    pub last_ok_at: Option<DateTime<Utc>>,
}

pub async fn devices(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<DeviceRow>>> {
    let rows = sqlx::query_as(
        "SELECT id, label, split_part(split_part(endpoint, '://', 2), '/', 1) AS host, created_at, last_ok_at
           FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user.id)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

pub async fn delete_device(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    sqlx::query("DELETE FROM push_subscriptions WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .execute(&s.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Zugangsschlüssel und Sitzungen ──────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct TokenRow {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub current: bool,
}

/// Aktive Sitzungen und persönliche Schlüssel
pub async fn tokens(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<TokenRow>>> {
    let rows = sqlx::query_as(
        "SELECT id, name, created_at, expires_at, last_used_at, id = $2 AS current FROM api_tokens
          WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
            AND name NOT IN ('shot')
          ORDER BY created_at DESC",
    )
    .bind(user.id)
    .bind(user.token_id)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct TokenIn {
    pub name: String,
}

pub async fn create_token(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<TokenIn>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let name = b.name.trim();
    if name.is_empty() || name.chars().count() > 60 || name == "session" {
        return Err(ApiError::BadRequest("Name 1–60 Zeichen".into()));
    }
    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL AND name <> 'session'
            AND (expires_at IS NULL OR expires_at > now())",
    )
    .bind(user.id)
    .fetch_one(&s.db)
    .await?;
    if n >= 10 {
        return Err(ApiError::Conflict("Höchstens 10 Schlüssel".into()));
    }
    let token = new_token("cc_u_");
    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO api_tokens (id, token_hash, user_id, name, expires_at) VALUES ($1, $2, $3, $4, now() + interval '365 days')",
    )
    .bind(id)
    .bind(hash_token(&token))
    .bind(user.id)
    .bind(format!("key:{name}"))
    .execute(&s.db)
    .await?;
    let mut c = s.db.acquire().await?;
    super::audit(&mut c, &user.actor(), "create_token", "user", user.id, json!({ "name": name })).await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "token": token }))))
}

pub async fn revoke_token(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    let n =
        sqlx::query("UPDATE api_tokens SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL")
            .bind(id)
            .bind(user.id)
            .execute(&s.db)
            .await?
            .rows_affected();
    if n == 0 {
        return Err(ApiError::NotFound);
    }
    super::chat::kick_token(id);
    Ok(StatusCode::NO_CONTENT)
}

// ── Ereignis-Stream (Server-Sent Events) für Erweiterungen/Desktop ──────────

#[derive(Deserialize)]
pub struct StreamQ {
    pub token: Option<String>,
}

pub async fn events(
    State(s): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<StreamQ>,
) -> ApiResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let token = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Bearer "))
        .map(str::trim)
        .map(String::from)
        .or(q.token)
        .ok_or(ApiError::Unauthorized)?;
    let row: Option<(Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT u.id, t.id, u.display_name FROM api_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.is_active AND NOT u.must_change_password
            AND (t.expires_at IS NULL OR t.expires_at > now())",
    )
    .bind(hash_token(&token))
    .fetch_optional(&s.db)
    .await?;
    let (user, token_id, name) = row.ok_or(ApiError::Unauthorized)?;
    sqlx::query("UPDATE api_tokens SET last_used_at = now() WHERE id = $1").bind(token_id).execute(&s.db).await?;
    let unread: i64 = sqlx::query_scalar("SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL")
        .bind(user)
        .fetch_one(&s.db)
        .await?;
    let conn = super::chat::Registration::new(user, token_id);
    let hello = json!({ "type": "hello", "user": user, "name": name, "unread": unread }).to_string();
    let stream = futures_util::stream::unfold((conn, Some(hello)), |(mut conn, first)| async move {
        if let Some(h) = first {
            return Some((Ok(Event::default().data(h)), (conn, None)));
        }
        loop {
            let msg = conn.rx.recv().await?;
            if msg == super::chat::KICK {
                return None;
            }
            // Tippen/Anwesenheit sind für Erweiterungen nur Lärm
            if msg.contains("\"type\":\"typing\"") || msg.contains("\"type\":\"presence\"") {
                continue;
            }
            return Some((Ok(Event::default().data(msg)), (conn, None)));
        }
    });
    Ok(Sse::new(stream).keep_alive(KeepAlive::new().interval(std::time::Duration::from_secs(25))))
}
