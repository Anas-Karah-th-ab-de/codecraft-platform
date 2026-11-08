//! Fernwartung: dauerhafte Geräteverbindung (Agent) und Bedienung aus dem Portal.
//!
//! Gerät  ── WS /api/v1/devices/ws (Gerätetoken) ──┐
//!                                                ├─ Zentrale (HUB) vermittelt Befehle, Dateien, Bild
//! Portal ── REST /api/v1/devices/{id}/… ─────────┤
//! Portal ── WS /api/v1/devices/{id}/screen ──────┘   (Frames binär, Eingaben als JSON)
//!
//! Nur Mitarbeitende mit Geräteverwaltung. Jede Aktion steht im Audit-Protokoll.
//! Was erlaubt ist, entscheidet das Gerät selbst (Capabilities); Bild nur mit Zustimmung vor Ort.

use crate::auth::{hash_token, Device, User};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::body::Bytes;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::Engine;
use codecraft_domain::access::Role;
use codecraft_protocol::remote::{decode_frame, Capabilities, FromDevice, InputEvent, ToDevice};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use uuid::Uuid;

const CHUNK: usize = 256 * 1024;
const MAX_FILE: usize = 50 * 1024 * 1024;

struct Conn {
    tx: UnboundedSender<Message>,
    caps: Capabilities,
    conn_id: u64,
}

#[derive(Default)]
struct Hub {
    devices: HashMap<Uuid, Conn>,
    /// Anfrage-ID → wartender Aufrufer (alle Antworten mit dieser ID)
    pending: HashMap<String, UnboundedSender<FromDevice>>,
    /// Bildsitzung → (Gerät, Techniker-Verbindung)
    screens: HashMap<[u8; 16], (Uuid, UnboundedSender<Message>)>,
}

static HUB: LazyLock<Mutex<Hub>> = LazyLock::new(|| Mutex::new(Hub::default()));
static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

pub fn is_online(device: Uuid) -> bool {
    HUB.lock().unwrap().devices.contains_key(&device)
}

/// Verbindung eines (gesperrten/ersetzten) Geräts sofort trennen
pub fn drop_device(device: Uuid) {
    if let Some(c) = HUB.lock().unwrap().devices.remove(&device) {
        let _ = c.tx.send(Message::Close(None));
    }
}

fn send_to(device: Uuid, msg: &ToDevice) -> ApiResult<Capabilities> {
    let hub = HUB.lock().unwrap();
    let c = hub.devices.get(&device).ok_or_else(|| ApiError::BadRequest("Gerät ist nicht verbunden".into()))?;
    c.tx.send(Message::Text(serde_json::to_string(msg).unwrap_or_default().into()))
        .map_err(|_| ApiError::BadRequest("Gerät ist nicht verbunden".into()))?;
    Ok(c.caps)
}

fn caps_of(device: Uuid) -> ApiResult<Capabilities> {
    HUB.lock()
        .unwrap()
        .devices
        .get(&device)
        .map(|c| c.caps)
        .ok_or_else(|| ApiError::BadRequest("Gerät ist nicht verbunden".into()))
}

/// Anfrage senden und Antworten einsammeln (bis `done` sagt: fertig)
async fn request(
    device: Uuid,
    msg: ToDevice,
    id: &str,
    wait: Duration,
    mut done: impl FnMut(&FromDevice) -> bool,
) -> ApiResult<Vec<FromDevice>> {
    let (tx, mut rx) = unbounded_channel();
    HUB.lock().unwrap().pending.insert(id.to_string(), tx);
    let res = async {
        send_to(device, &msg)?;
        let mut out = vec![];
        loop {
            match tokio::time::timeout(wait, rx.recv()).await {
                Ok(Some(m)) => {
                    let fin = done(&m);
                    out.push(m);
                    if fin {
                        return Ok(out);
                    }
                }
                Ok(None) => return Err(ApiError::BadRequest("Verbindung zum Gerät verloren".into())),
                Err(_) => return Err(ApiError::BadRequest("Gerät antwortet nicht (Zeitüberschreitung)".into())),
            }
        }
    }
    .await;
    HUB.lock().unwrap().pending.remove(id);
    res
}

/// Mitarbeiter mit Geräterechten; Kundengeräte nur mit eingelöstem Einmal-Code
async fn access(s: &AppState, user: &User, device: Uuid) -> ApiResult<()> {
    super::access::authorize(&s.db, user.id, user.role, device).await
}

async fn audit(s: &AppState, user: &User, action: &str, device: Uuid, data: Value) -> ApiResult<()> {
    let mut conn = s.db.acquire().await?;
    super::audit(&mut conn, &user.actor(), action, "device", device, data).await?;
    Ok(())
}

fn rid() -> String {
    Uuid::now_v7().simple().to_string()
}

// ── Geräteseite ────────────────────────────────────────────────────────

pub async fn device_ws(State(s): State<AppState>, device: Device, up: WebSocketUpgrade) -> Response {
    up.max_message_size(8 * 1024 * 1024).on_upgrade(move |socket| device_session(s, device.id, socket))
}

async fn device_session(s: AppState, device: Uuid, socket: WebSocket) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = unbounded_channel::<Message>();
    let conn_id = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if sink.send(m).await.is_err() {
                break;
            }
        }
    });
    // erste Nachricht muss Hello sein
    let hello = match tokio::time::timeout(Duration::from_secs(15), stream.next()).await {
        Ok(Some(Ok(Message::Text(t)))) => serde_json::from_str::<FromDevice>(&t).ok(),
        _ => None,
    };
    let Some(FromDevice::Hello { caps, .. }) = hello.clone() else {
        writer.abort();
        return;
    };
    {
        let mut hub = HUB.lock().unwrap();
        // ältere Verbindung desselben Geräts ersetzen
        hub.devices.insert(device, Conn { tx: tx.clone(), caps, conn_id });
    }
    let _ =
        sqlx::query("UPDATE devices SET remote_hello = $2, remote_seen_at = now(), last_seen_at = now() WHERE id = $1")
            .bind(device)
            .bind(serde_json::to_value(&hello).unwrap_or_default())
            .execute(&s.db)
            .await;
    tracing::info!("Gerät {device} verbunden");
    let mut ping = tokio::time::interval(Duration::from_secs(30));
    loop {
        tokio::select! {
            m = stream.next() => match m {
                Some(Ok(Message::Text(t))) => {
                    let Ok(msg) = serde_json::from_str::<FromDevice>(&t) else { continue };
                    on_device_message(&s, device, msg).await;
                }
                Some(Ok(Message::Binary(b))) => {
                    // Bildschirm-Frame an den Techniker der Sitzung
                    if let Some((sess, ..)) = decode_frame(&b) {
                        let target = HUB.lock().unwrap().screens.get(&sess).filter(|x| x.0 == device).map(|x| x.1.clone());
                        if let Some(t) = target {
                            let _ = t.send(Message::Binary(b));
                        }
                    }
                }
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                _ => {}
            },
            _ = ping.tick() => {
                let _ = tx.send(Message::Text(serde_json::to_string(&ToDevice::Ping).unwrap_or_default().into()));
                let _ = sqlx::query("UPDATE devices SET remote_seen_at = now(), last_seen_at = now() WHERE id = $1").bind(device).execute(&s.db).await;
            }
        }
    }
    {
        let mut hub = HUB.lock().unwrap();
        if hub.devices.get(&device).is_some_and(|c| c.conn_id == conn_id) {
            hub.devices.remove(&device);
        }
        // offene Bildsitzungen dieses Geräts beenden
        let ended: Vec<_> = hub.screens.iter().filter(|(_, v)| v.0 == device).map(|(k, v)| (*k, v.1.clone())).collect();
        for (k, t) in ended {
            let _ =
                t.send(Message::Text(json!({ "t": "screen_ended", "reason": "Gerät getrennt" }).to_string().into()));
            hub.screens.remove(&k);
        }
    }
    writer.abort();
    tracing::info!("Gerät {device} getrennt");
}

async fn on_device_message(s: &AppState, device: Uuid, msg: FromDevice) {
    let id = match &msg {
        FromDevice::Result { id, .. } | FromDevice::Dir { id, .. } | FromDevice::FileChunk { id, .. } => {
            Some(id.clone())
        }
        FromDevice::Inventory { id, info } => {
            let _ = sqlx::query("UPDATE devices SET remote_inventory = $2 WHERE id = $1")
                .bind(device)
                .bind(serde_json::to_value(info).unwrap_or_default())
                .execute(&s.db)
                .await;
            Some(id.clone())
        }
        FromDevice::ScreenConsent { session, .. } | FromDevice::ScreenEnded { session, .. } => {
            if let Ok(u) = Uuid::parse_str(session) {
                let target =
                    HUB.lock().unwrap().screens.get(u.as_bytes()).filter(|x| x.0 == device).map(|x| x.1.clone());
                if let Some(t) = target {
                    let _ = t.send(Message::Text(serde_json::to_string(&msg).unwrap_or_default().into()));
                }
            }
            None
        }
        _ => None,
    };
    if let Some(id) = id {
        if let Some(t) = HUB.lock().unwrap().pending.get(&id) {
            let _ = t.send(msg);
        }
    }
}

// ── Portal ─────────────────────────────────────────────────────────────

type StatusRow = (String, String, Option<Value>, Option<Value>, Option<chrono::DateTime<chrono::Utc>>);

pub async fn status(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    access(&s, &user, id).await?;
    let row: Option<StatusRow> = sqlx::query_as(
        "SELECT name, kind, remote_hello, remote_inventory, remote_seen_at FROM devices WHERE id = $1 AND revoked_at IS NULL",
    )
    .bind(id)
    .fetch_optional(&s.db)
    .await?;
    let (name, kind, hello, inv, seen) = row.ok_or(ApiError::NotFound)?;
    Ok(Json(json!({
        "id": id, "name": name, "kind": kind, "online": is_online(id), "hello": hello, "inventory": inv, "seen_at": seen,
        "caps": caps_of(id).ok(),
    })))
}

pub async fn inventory(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    access(&s, &user, id).await?;
    let r = rid();
    let res = request(id, ToDevice::Inventory { id: r.clone() }, &r, Duration::from_secs(20), |_| true).await?;
    match res.into_iter().next() {
        Some(FromDevice::Inventory { info, .. }) => Ok(Json(serde_json::to_value(info).unwrap_or_default())),
        _ => Err(ApiError::BadRequest("Unerwartete Antwort".into())),
    }
}

#[derive(Deserialize)]
pub struct ExecBody {
    pub program: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub timeout_s: Option<u32>,
}

pub async fn exec(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<ExecBody>,
) -> ApiResult<Json<Value>> {
    access(&s, &user, id).await?;
    if !caps_of(id)?.exec {
        return Err(ApiError::BadRequest("Befehle sind auf diesem Gerät nicht erlaubt".into()));
    }
    let t = b.timeout_s.unwrap_or(60).clamp(1, 600);
    audit(&s, &user, "remote_exec", id, json!({ "program": b.program, "args": b.args })).await?;
    let r = rid();
    let msg = ToDevice::Exec { id: r.clone(), program: b.program, args: b.args, timeout_s: t };
    let res = request(id, msg, &r, Duration::from_secs(t as u64 + 10), |_| true).await?;
    match res.into_iter().next() {
        Some(FromDevice::Result { ok, code, output, .. }) => {
            Ok(Json(json!({ "ok": ok, "code": code, "output": output })))
        }
        _ => Err(ApiError::BadRequest("Unerwartete Antwort".into())),
    }
}

pub async fn reboot(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    access(&s, &user, id).await?;
    if !caps_of(id)?.exec {
        return Err(ApiError::BadRequest("Neustart ist auf diesem Gerät nicht erlaubt".into()));
    }
    audit(&s, &user, "remote_reboot", id, json!({})).await?;
    let r = rid();
    let res = request(id, ToDevice::Reboot { id: r.clone() }, &r, Duration::from_secs(20), |_| true).await?;
    match res.into_iter().next() {
        Some(FromDevice::Result { ok, output, .. }) => Ok(Json(json!({ "ok": ok, "output": output }))),
        _ => Err(ApiError::BadRequest("Unerwartete Antwort".into())),
    }
}

#[derive(Deserialize)]
pub struct PathQ {
    pub path: String,
}

pub async fn list_dir(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Query(q): Query<PathQ>,
) -> ApiResult<Json<Value>> {
    access(&s, &user, id).await?;
    if !caps_of(id)?.files {
        return Err(ApiError::BadRequest("Dateizugriff ist auf diesem Gerät nicht erlaubt".into()));
    }
    let r = rid();
    let res =
        request(id, ToDevice::ListDir { id: r.clone(), path: q.path }, &r, Duration::from_secs(20), |_| true).await?;
    match res.into_iter().next() {
        Some(FromDevice::Dir { entries, .. }) => Ok(Json(json!({ "entries": entries }))),
        Some(FromDevice::Result { output, .. }) => Err(ApiError::BadRequest(output)),
        _ => Err(ApiError::BadRequest("Unerwartete Antwort".into())),
    }
}

pub async fn get_file(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Query(q): Query<PathQ>,
) -> ApiResult<Response> {
    access(&s, &user, id).await?;
    if !caps_of(id)?.files {
        return Err(ApiError::BadRequest("Dateizugriff ist auf diesem Gerät nicht erlaubt".into()));
    }
    audit(&s, &user, "remote_file_get", id, json!({ "path": q.path })).await?;
    let r = rid();
    let res =
        request(id, ToDevice::GetFile { id: r.clone(), path: q.path.clone() }, &r, Duration::from_secs(30), |m| {
            matches!(m, FromDevice::FileChunk { last: true, .. } | FromDevice::Result { .. })
        })
        .await?;
    let mut data = vec![];
    for m in res {
        match m {
            FromDevice::FileChunk { data_b64, .. } => {
                data.extend(
                    base64::engine::general_purpose::STANDARD
                        .decode(data_b64)
                        .map_err(|_| ApiError::BadRequest("Datei beschädigt".into()))?,
                );
                if data.len() > MAX_FILE {
                    return Err(ApiError::BadRequest("Datei größer als 50 MB".into()));
                }
            }
            FromDevice::Result { output, .. } => return Err(ApiError::BadRequest(output)),
            _ => {}
        }
    }
    let name: String = q
        .path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("datei")
        .chars()
        .filter(|c| !matches!(c, '"' | '\r' | '\n'))
        .collect();
    Ok((
        [
            (header::CONTENT_TYPE, "application/octet-stream".to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{name}\"")),
        ],
        data,
    )
        .into_response())
}

pub async fn put_file(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Query(q): Query<PathQ>,
    body: Bytes,
) -> ApiResult<Json<Value>> {
    access(&s, &user, id).await?;
    if !caps_of(id)?.files {
        return Err(ApiError::BadRequest("Dateizugriff ist auf diesem Gerät nicht erlaubt".into()));
    }
    audit(&s, &user, "remote_file_put", id, json!({ "path": q.path, "size": body.len() })).await?;
    let chunks: Vec<&[u8]> = if body.is_empty() { vec![&[]] } else { body.chunks(CHUNK).collect() };
    let n = chunks.len();
    for (i, c) in chunks.into_iter().enumerate() {
        let r = rid();
        let msg = ToDevice::PutFile {
            id: r.clone(),
            path: q.path.clone(),
            offset: (i * CHUNK) as u64,
            data_b64: base64::engine::general_purpose::STANDARD.encode(c),
            last: i + 1 == n,
        };
        let res = request(id, msg, &r, Duration::from_secs(30), |_| true).await?;
        if let Some(FromDevice::Result { ok: false, output, .. }) = res.first() {
            return Err(ApiError::BadRequest(output.clone()));
        }
    }
    Ok(Json(json!({ "ok": true, "size": body.len() })))
}

// ── Bildschirm ─────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ScreenQuery {
    pub token: String,
    pub fps: Option<u8>,
    pub width: Option<u32>,
}

/// Techniker-Verbindung für eine Bildsitzung (Browser: Token als Parameter)
pub async fn screen_ws(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<ScreenQuery>,
    up: WebSocketUpgrade,
) -> ApiResult<Response> {
    let row: Option<(Uuid, String, String)> = sqlx::query_as(
        "SELECT u.id, u.display_name, u.role FROM api_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.is_active AND NOT u.must_change_password
            AND (t.expires_at IS NULL OR t.expires_at > now())",
    )
    .bind(hash_token(&q.token))
    .fetch_optional(&s.db)
    .await?;
    let (user, name, role) = row.ok_or(ApiError::Unauthorized)?;
    let role = Role::parse(&role).ok_or(ApiError::Forbidden)?;
    super::access::authorize(&s.db, user, role, id).await?;
    let caps = caps_of(id)?;
    if !caps.screen {
        return Err(ApiError::BadRequest("Bildschirmzugriff ist auf diesem Gerät nicht erlaubt".into()));
    }
    let fps = q.fps.unwrap_or(8).clamp(1, 20);
    let width = q.width.unwrap_or(1600).clamp(320, 3840);
    let who = Operator { id: user, name, role };
    Ok(up.max_message_size(64 * 1024).on_upgrade(move |socket| screen_session(s, id, who, fps, width, socket)))
}

struct Operator {
    id: Uuid,
    name: String,
    role: Role,
}

async fn screen_session(s: AppState, device: Uuid, op: Operator, fps: u8, width: u32, socket: WebSocket) {
    let Operator { id: user, name, role } = op;
    let session = Uuid::now_v7();
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = unbounded_channel::<Message>();
    HUB.lock().unwrap().screens.insert(*session.as_bytes(), (device, tx.clone()));
    if let Ok(mut c) = s.db.acquire().await {
        let _ = super::audit(
            &mut c,
            &format!("user:{user}"),
            "remote_screen_start",
            "device",
            device,
            json!({ "session": session }),
        )
        .await;
    }
    let start = ToDevice::ScreenStart { session: session.to_string(), operator: name, max_fps: fps, max_width: width };
    if send_to(device, &start).is_err() {
        let _ = sink
            .send(Message::Text(json!({ "t": "screen_ended", "reason": "Gerät nicht verbunden" }).to_string().into()))
            .await;
        HUB.lock().unwrap().screens.remove(session.as_bytes());
        return;
    }
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if sink.send(m).await.is_err() {
                break;
            }
        }
    });
    let started = std::time::Instant::now();
    // Freigabe läuft ab oder Kunde beendet sie → Sitzung endet spätestens nach 15 s
    let mut check = tokio::time::interval(Duration::from_secs(15));
    check.tick().await;
    loop {
        tokio::select! {
            m = stream.next() => {
                match m {
                    Some(Ok(Message::Text(t))) => {
                        // Eingaben des Technikers → Gerät
                        if let Ok(event) = serde_json::from_str::<InputEvent>(&t) {
                            let _ = send_to(device, &ToDevice::Input { session: session.to_string(), event });
                        }
                    }
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    _ => {}
                }
            }
            _ = check.tick() => {
                if super::access::authorize(&s.db, user, role, device).await.is_err() {
                    let _ = tx.send(Message::Text(
                        json!({ "t": "screen_ended", "reason": "Freigabe beendet" }).to_string().into(),
                    ));
                    tokio::time::sleep(Duration::from_millis(200)).await;
                    break;
                }
            }
        }
        if writer.is_finished() {
            break;
        }
    }
    let _ = send_to(device, &ToDevice::ScreenStop { session: session.to_string() });
    HUB.lock().unwrap().screens.remove(session.as_bytes());
    writer.abort();
    if let Ok(mut c) = s.db.acquire().await {
        let _ = super::audit(
            &mut c,
            &format!("user:{user}"),
            "remote_screen_end",
            "device",
            device,
            json!({ "session": session, "seconds": started.elapsed().as_secs() }),
        )
        .await;
    }
}
