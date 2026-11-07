//! Dauerhafte Verbindung zur Plattform (WebSocket über TLS, Gerätetoken) und Ausführung der Fernwartung.

use crate::{ops, screen};
use codecraft_protocol::remote::{encode_frame, Capabilities, FromDevice, InputEvent, ToDevice};
use codecraft_protocol::PROTOCOL_VERSION;
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

pub struct Config {
    pub ws_url: String,
    pub token: String,
    pub caps: Capabilities,
}

struct ScreenCtl {
    stop: Arc<AtomicBool>,
    input: mpsc::Sender<InputEvent>,
}

type Out = UnboundedSender<Message>;

fn reply(out: &Out, m: &FromDevice) {
    let _ = out.send(Message::Text(serde_json::to_string(m).unwrap_or_default().into()));
}

fn denied(id: String, what: &str) -> FromDevice {
    FromDevice::Result { id, ok: false, code: None, output: format!("{what} ist auf diesem Gerät nicht erlaubt") }
}

/// Läuft dauerhaft, verbindet bei Abbruch neu
pub async fn run(cfg: Config) {
    let mut backoff = Duration::from_secs(2);
    loop {
        let started = Instant::now();
        match session(&cfg).await {
            Ok(()) => tracing::info!("Fernwartung: Verbindung beendet"),
            Err(e) => tracing::warn!("Fernwartung: {e}"),
        }
        if started.elapsed() > Duration::from_secs(60) {
            backoff = Duration::from_secs(2);
        }
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(Duration::from_secs(120));
    }
}

async fn session(cfg: &Config) -> Result<(), String> {
    let mut req = cfg.ws_url.as_str().into_client_request().map_err(|e| e.to_string())?;
    req.headers_mut().insert("authorization", format!("Bearer {}", cfg.token).parse().map_err(|_| "Token ungültig")?);
    let (ws, _) = tokio::time::timeout(Duration::from_secs(20), tokio_tungstenite::connect_async(req))
        .await
        .map_err(|_| "Zeitüberschreitung beim Verbinden".to_string())?
        .map_err(|e| e.to_string())?;
    tracing::info!("Fernwartung: verbunden");
    let (mut sink, mut stream) = ws.split();
    let (out, mut rx) = unbounded_channel::<Message>();
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if sink.send(m).await.is_err() {
                break;
            }
        }
    });
    let inv = ops::inventory(vec![]);
    reply(
        &out,
        &FromDevice::Hello {
            protocol: PROTOCOL_VERSION,
            version: env!("CARGO_PKG_VERSION").into(),
            hostname: inv.hostname,
            os: inv.os,
            arch: inv.arch,
            caps: cfg.caps,
        },
    );
    let mut screens: HashMap<String, ScreenCtl> = HashMap::new();
    let res = loop {
        let msg = match tokio::time::timeout(Duration::from_secs(90), stream.next()).await {
            Ok(Some(Ok(m))) => m,
            Ok(Some(Err(e))) => break Err(e.to_string()),
            Ok(None) => break Ok(()),
            Err(_) => break Err("Keine Nachricht seit 90 s".into()),
        };
        let Message::Text(t) = msg else { continue };
        let Ok(cmd) = serde_json::from_str::<ToDevice>(&t) else { continue };
        handle(cfg.caps, cmd, &out, &mut screens);
        if writer.is_finished() {
            break Err("Verbindung verloren".into());
        }
    };
    for (_, s) in screens.drain() {
        s.stop.store(true, Ordering::Relaxed);
    }
    writer.abort();
    res
}

fn handle(caps: Capabilities, cmd: ToDevice, out: &Out, screens: &mut HashMap<String, ScreenCtl>) {
    let out = out.clone();
    match cmd {
        ToDevice::Ping => reply(&out, &FromDevice::Pong),
        ToDevice::Inventory { id } => {
            tokio::task::spawn_blocking(move || {
                let screens = screen::Desktop::open().map(|d| vec![screen::Display::size(&d)]).unwrap_or_default();
                reply(&out, &FromDevice::Inventory { id, info: ops::inventory(screens) });
            });
        }
        ToDevice::Exec { id, program, args, timeout_s } => {
            if !caps.exec {
                return reply(&out, &denied(id, "Befehle ausführen"));
            }
            tracing::info!("Fernwartung: Befehl {program} {args:?}");
            tokio::spawn(async move { reply(&out, &ops::exec(id, program, args, timeout_s).await) });
        }
        ToDevice::Reboot { id } => {
            if !caps.exec {
                return reply(&out, &denied(id, "Neustart"));
            }
            tracing::warn!("Fernwartung: Neustart angefordert");
            reply(&out, &ops::reboot(id));
        }
        ToDevice::ListDir { id, path } => {
            if !caps.files {
                return reply(&out, &denied(id, "Dateizugriff"));
            }
            tokio::task::spawn_blocking(move || reply(&out, &ops::list_dir(id, &path)));
        }
        ToDevice::GetFile { id, path } => {
            if !caps.files {
                return reply(&out, &denied(id, "Dateizugriff"));
            }
            tracing::info!("Fernwartung: Datei lesen {path}");
            tokio::task::spawn_blocking(move || ops::get_file(id, &path).iter().for_each(|m| reply(&out, m)));
        }
        ToDevice::PutFile { id, path, offset, data_b64, .. } => {
            if !caps.files {
                return reply(&out, &denied(id, "Dateizugriff"));
            }
            if offset == 0 {
                tracing::info!("Fernwartung: Datei schreiben {path}");
            }
            tokio::task::spawn_blocking(move || reply(&out, &ops::put_file(id, &path, offset, &data_b64)));
        }
        ToDevice::ScreenStart { session, operator, max_fps, max_width } => {
            if !caps.screen {
                return reply(&out, &FromDevice::ScreenConsent { session, granted: false });
            }
            let stop = Arc::new(AtomicBool::new(false));
            let (itx, irx) = mpsc::channel();
            screens.insert(session.clone(), ScreenCtl { stop: stop.clone(), input: itx });
            std::thread::spawn(move || screen_thread(caps, session, operator, max_fps, max_width, stop, irx, out));
        }
        ToDevice::ScreenStop { session } => {
            if let Some(s) = screens.remove(&session) {
                s.stop.store(true, Ordering::Relaxed);
            }
        }
        ToDevice::Input { session, event } => {
            if let Some(s) = screens.get(&session) {
                let _ = s.input.send(event);
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn screen_thread(
    caps: Capabilities,
    session: String,
    operator: String,
    max_fps: u8,
    max_width: u32,
    stop: Arc<AtomicBool>,
    input: mpsc::Receiver<InputEvent>,
    out: Out,
) {
    use screen::Display;
    let granted = caps.unattended || screen::ask_consent(&operator);
    reply(&out, &FromDevice::ScreenConsent { session: session.clone(), granted });
    if !granted || stop.load(Ordering::Relaxed) {
        tracing::info!("Fernwartung: Bildschirmfreigabe abgelehnt");
        return;
    }
    let mut desk = match screen::Desktop::open() {
        Ok(d) => d,
        Err(e) => {
            reply(&out, &FromDevice::ScreenEnded { session, reason: e });
            return;
        }
    };
    tracing::warn!("Fernwartung: Bildschirmsitzung mit {operator} gestartet");
    screen::notify(&format!("{operator} sieht und steuert jetzt Ihren Bildschirm."));
    let sid = uuid::Uuid::parse_str(&session).map(|u| *u.as_bytes()).unwrap_or([0; 16]);
    let frame_time = Duration::from_millis(1000 / max_fps.clamp(1, 20) as u64);
    let mut last_fp = 0u64;
    let mut last_sent = Instant::now() - Duration::from_secs(10);
    let reason = loop {
        if stop.load(Ordering::Relaxed) {
            break "beendet".to_string();
        }
        let t0 = Instant::now();
        while let Ok(ev) = input.try_recv() {
            if let Err(e) = desk.input(&ev) {
                tracing::warn!("Eingabe: {e}");
            }
        }
        match desk.capture() {
            Ok(px) => {
                let fp = screen::fingerprint(&px);
                // unverändert: nur alle 2 s ein Bild (hält die Anzeige frisch)
                if fp != last_fp || last_sent.elapsed() > Duration::from_secs(2) {
                    let (w, h) = desk.size();
                    if let Ok((jpeg, ow, oh)) = screen::encode_jpeg(&px, w, h, max_width, 60) {
                        if out.send(Message::Binary(encode_frame(&sid, ow as u16, oh as u16, &jpeg).into())).is_err() {
                            break "Verbindung verloren".into();
                        }
                        last_fp = fp;
                        last_sent = Instant::now();
                    }
                }
            }
            Err(e) => break e,
        }
        let spent = t0.elapsed();
        if spent < frame_time {
            // in der Wartezeit Eingaben sofort ausführen
            let deadline = Instant::now() + (frame_time - spent);
            while let Some(left) = deadline.checked_duration_since(Instant::now()) {
                match input.recv_timeout(left) {
                    Ok(ev) => {
                        let _ = desk.input(&ev);
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => break,
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        }
    };
    tracing::warn!("Fernwartung: Bildschirmsitzung beendet ({reason})");
    screen::notify("Die Fernwartung wurde beendet.");
    reply(&out, &FromDevice::ScreenEnded { session, reason });
}
