//! KM Code Craft Portal – App (Android, Windows, Linux).
//!
//! - zeigt das Portal des eigenen Servers (alle Funktionen wie im Browser)
//! - Mitteilungen und Anrufe kommen auch bei geschlossenem Fenster (Ereignis-Stream mit eigenem
//!   Schlüssel; Android: Vordergrund-Dienst, PC: Infobereich)
//! - der Fernwartungs-Agent (Rust, `codecraft-agent`) läuft NUR während einer vom Benutzer
//!   gestarteten Support-Freigabe und stoppt danach automatisch

use codecraft_agent::Agent;
use codecraft_protocol::remote::Capabilities;
use codecraft_protocol::DeviceKind;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

#[cfg(target_os = "android")]
mod android;
#[cfg(not(target_os = "android"))]
mod desktop;

pub const DEFAULT_SERVER: &str = "https://code-craft.tech";

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Config {
    pub server: String,
    pub install_id: String,
    pub device_id: Option<String>,
    pub device_token: Option<String>,
    pub key: Option<String>,
}

pub struct Support {
    agent: Agent,
    until: u64,
    files: bool,
}

pub struct AppState {
    pub cfg: Mutex<Config>,
    pub path: PathBuf,
    pub support: Mutex<Option<Support>>,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn platform() -> &'static str {
    if cfg!(target_os = "android") {
        "android"
    } else if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

impl AppState {
    fn load(dir: PathBuf) -> AppState {
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("config.json");
        let mut cfg: Config =
            std::fs::read(&path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
        if cfg.server.is_empty() {
            cfg.server = DEFAULT_SERVER.into();
        }
        if cfg.install_id.len() < 8 {
            cfg.install_id = uuid::Uuid::new_v4().to_string();
        }
        let s = AppState { cfg: Mutex::new(cfg), path, support: Mutex::new(None) };
        s.save();
        s
    }

    pub fn save(&self) {
        let cfg = self.cfg.lock().unwrap().clone();
        if let Ok(b) = serde_json::to_vec_pretty(&cfg) {
            let tmp = self.path.with_extension("tmp");
            if std::fs::write(&tmp, b).is_ok() {
                let _ = std::fs::rename(&tmp, &self.path);
            }
        }
        // Zugangsdaten nur für diesen Benutzer lesbar
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&self.path, std::fs::Permissions::from_mode(0o600));
        }
    }

    pub fn snapshot(&self) -> Config {
        self.cfg.lock().unwrap().clone()
    }
}

#[derive(Serialize)]
struct SupportStatus {
    running: bool,
    until: Option<u64>,
    files: bool,
    /// Android: Bedienungshilfe zum Steuern aktiv?
    control: bool,
    /// Android: enthält diese App-Variante die Fernsteuerung überhaupt? (Standard-APK nicht – Play Protect)
    control_available: bool,
}

fn support_status_of(state: &AppState) -> SupportStatus {
    let mut g = state.support.lock().unwrap();
    // abgelaufen → aufräumen
    if g.as_ref().is_some_and(|s| s.until <= now() || !s.agent.is_running()) {
        if let Some(s) = g.take() {
            s.agent.stop();
        }
    }
    SupportStatus {
        running: g.is_some(),
        until: g.as_ref().map(|s| s.until),
        files: g.as_ref().is_some_and(|s| s.files),
        control: control_enabled(),
        control_available: control_available(),
    }
}

#[cfg(target_os = "android")]
fn control_enabled() -> bool {
    android::control_enabled()
}
#[cfg(not(target_os = "android"))]
fn control_enabled() -> bool {
    true
}
#[cfg(target_os = "android")]
fn control_available() -> bool {
    android::control_available()
}
#[cfg(not(target_os = "android"))]
fn control_available() -> bool {
    true
}

// ── Befehle für das Portal ──────────────────────────────────────────────────

#[derive(Serialize)]
struct Info {
    app: bool,
    platform: &'static str,
    version: &'static str,
    server: String,
    install_id: String,
    enrolled: bool,
    device_id: Option<String>,
    support: SupportStatus,
}

#[tauri::command]
fn app_info(state: State<AppState>) -> Info {
    let c = state.snapshot();
    Info {
        app: true,
        platform: platform(),
        version: env!("CARGO_PKG_VERSION"),
        server: c.server,
        install_id: c.install_id,
        enrolled: c.key.is_some() && c.device_token.is_some(),
        device_id: c.device_id,
        support: support_status_of(&state),
    }
}

/// Nach der Anmeldung: Zugänge dieser Installation speichern (aus `/api/v1/app/enroll`)
#[tauri::command]
fn app_enroll(app: AppHandle, state: State<AppState>, device_id: String, device_token: String, key: String, server: String) -> Result<(), String> {
    if !key.starts_with("cc_u_") || !device_token.starts_with("cc_d_") {
        return Err("Ungültige Zugangsdaten".into());
    }
    {
        let mut c = state.cfg.lock().unwrap();
        c.device_id = Some(device_id);
        c.device_token = Some(device_token);
        c.key = Some(key);
        if server.starts_with("http") {
            c.server = server.trim_end_matches('/').to_string();
        }
    }
    state.save();
    start_listener(&app);
    Ok(())
}

#[tauri::command]
fn app_set_server(state: State<AppState>, server: String) -> Result<(), String> {
    let s = server.trim().trim_end_matches('/');
    if !(s.starts_with("https://") || s.starts_with("http://")) {
        return Err("Adresse muss mit https:// beginnen".into());
    }
    state.cfg.lock().unwrap().server = s.to_string();
    state.save();
    Ok(())
}

/// Abmelden: Zugänge vergessen, Mitteilungen und Support beenden
#[tauri::command]
fn app_reset(app: AppHandle, state: State<AppState>) {
    {
        let mut c = state.cfg.lock().unwrap();
        c.key = None;
        c.device_token = None;
        c.device_id = None;
    }
    state.save();
    if let Some(s) = state.support.lock().unwrap().take() {
        s.agent.stop();
    }
    stop_listener(&app);
}

/// Seite, die eine Benachrichtigung öffnen soll (Klick auf Mitteilung/Anruf)
#[tauri::command]
fn app_pending_url() -> Option<String> {
    pending_url()
}

#[cfg(target_os = "android")]
fn pending_url() -> Option<String> {
    android::take_pending_url()
}
#[cfg(not(target_os = "android"))]
fn pending_url() -> Option<String> {
    desktop::take_pending_url()
}

/// Support-Zugriff freigeben: Agent für `minutes` starten (Bildschirm mit Rückfrage, optional Dateien)
#[tauri::command]
fn support_start(app: AppHandle, state: State<AppState>, minutes: u32, files: bool) -> Result<SupportStatus, String> {
    let c = state.snapshot();
    let token = c.device_token.ok_or("App ist noch nicht angemeldet")?;
    let minutes = minutes.clamp(5, 480);
    {
        let mut g = state.support.lock().unwrap();
        if let Some(old) = g.take() {
            old.agent.stop();
        }
        let caps = Capabilities { screen: true, unattended: false, exec: false, files: files && !cfg!(target_os = "android") };
        // auf der Tauri-Laufzeit starten (lebt so lange wie die App)
        let agent = tauri::async_runtime::block_on(async { Agent::start(&c.server, &token, caps, DeviceKind::Agent) });
        *g = Some(Support { agent, until: now() + minutes as u64 * 60, files: caps.files });
    }
    support_changed(&app, true);
    // automatisch beenden
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(minutes as u64 * 60 + 1)).await;
        let st = app2.state::<AppState>();
        let expired = st.support.lock().unwrap().as_ref().is_some_and(|s| s.until <= now());
        if expired {
            if let Some(s) = st.support.lock().unwrap().take() {
                s.agent.stop();
            }
            support_changed(&app2, false);
        }
    });
    Ok(support_status_of(&state))
}

#[tauri::command]
fn support_stop(app: AppHandle, state: State<AppState>) -> SupportStatus {
    if let Some(s) = state.support.lock().unwrap().take() {
        s.agent.stop();
    }
    support_changed(&app, false);
    support_status_of(&state)
}

#[tauri::command]
fn support_status(state: State<AppState>) -> SupportStatus {
    support_status_of(&state)
}

/// Android: Einstellungen der Bedienungshilfe öffnen (für Steuerung durch den Support)
#[tauri::command]
fn control_settings() {
    #[cfg(target_os = "android")]
    android::open_control_settings();
}

fn support_changed(_app: &AppHandle, running: bool) {
    #[cfg(target_os = "android")]
    android::support_changed(running);
    #[cfg(not(target_os = "android"))]
    desktop::support_changed(_app, running);
}

/// Mitteilungs-Empfang (neu) starten
pub fn start_listener(app: &AppHandle) {
    let cfg = app.state::<AppState>().snapshot();
    let Some(key) = cfg.key else { return };
    #[cfg(target_os = "android")]
    {
        let _ = app;
        android::configure(&cfg.server, &key);
    }
    #[cfg(not(target_os = "android"))]
    desktop::listen(app.clone(), cfg.server, key);
}

fn stop_listener(_app: &AppHandle) {
    #[cfg(target_os = "android")]
    android::configure("", "");
    #[cfg(not(target_os = "android"))]
    desktop::stop_listen();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let _ = tracing_subscriber::fmt().with_env_filter("info").try_init();
    let builder = tauri::Builder::default();
    #[cfg(not(target_os = "android"))]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])));
    builder
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir().join("km-portal"));
            app.manage(AppState::load(dir));
            #[cfg(not(target_os = "android"))]
            desktop::setup(app)?;
            start_listener(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            app_enroll,
            app_set_server,
            app_reset,
            app_pending_url,
            support_start,
            support_stop,
            support_status,
            control_settings
        ])
        .run(tauri::generate_context!())
        .expect("App konnte nicht starten");
}
