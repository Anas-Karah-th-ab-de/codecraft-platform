//! PC (Windows, Linux): Infobereich, Fenster schließen = im Hintergrund weiterlaufen,
//! Mitteilungen/Anrufe über den Ereignis-Stream des Portals als System-Benachrichtigung.

use futures_util::StreamExt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_notification::NotificationExt;

static GEN: AtomicU64 = AtomicU64::new(0);
static PENDING: Mutex<Option<String>> = Mutex::new(None);
static ME: Mutex<String> = Mutex::new(String::new());

pub fn take_pending_url() -> Option<String> {
    PENDING.lock().unwrap().take()
}

fn show(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Seite im Fenster öffnen (Portal fragt `app_pending_url` ab, sobald es sichtbar wird)
fn open(app: &AppHandle, url: &str) {
    *PENDING.lock().unwrap() = Some(url.to_string());
    show(app);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval("window.dispatchEvent(new Event('km-app-open'))");
    }
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    let open_i = MenuItem::with_id(app, "open", "Portal öffnen", true, None::<&str>)?;
    let stop_i = MenuItem::with_id(app, "support_stop", "Support-Zugriff beenden", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_i, &stop_i, &quit_i])?;
    let mut tray = TrayIconBuilder::with_id("main").tooltip("KM Code Craft Portal").menu(&menu).show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, ev| match ev.id().as_ref() {
        "open" => show(app),
        "support_stop" => {
            let st = app.state::<crate::AppState>();
            if let Some(s) = st.support.lock().unwrap().take() {
                s.agent.stop();
            }
            support_changed(app, false);
        }
        "quit" => app.exit(0),
        _ => {}
    })
    .on_tray_icon_event(|tray, ev| {
        if let TrayIconEvent::Click { button: MouseButton::Left, .. } = ev {
            show(tray.app_handle());
        }
    })
    .build(app)?;

    // Schließen = in den Infobereich (Anrufe kommen weiter an)
    if let Some(w) = app.get_webview_window("main") {
        let w2 = w.clone();
        w.on_window_event(move |e| {
            if let WindowEvent::CloseRequested { api, .. } = e {
                api.prevent_close();
                let _ = w2.hide();
            }
        });
        if std::env::args().any(|a| a == "--hidden") {
            let _ = w.hide();
        }
    }
    Ok(())
}

pub fn support_changed(app: &AppHandle, running: bool) {
    if let Some(t) = app.tray_by_id("main") {
        let _ = t.set_tooltip(Some(if running {
            "KM Code Craft Portal – Support-Zugriff aktiv"
        } else {
            "KM Code Craft Portal"
        }));
    }
    let text = if running {
        "Support-Zugriff ist freigegeben. Bildschirm nur nach Ihrer Zustimmung."
    } else {
        "Support-Zugriff beendet."
    };
    let _ = app.notification().builder().title("KM Portal").body(text).show();
}

pub fn stop_listen() {
    GEN.fetch_add(1, Ordering::SeqCst);
}

/// Ereignis-Stream lesen und Meldungen zeigen; verbindet bei Abbruch neu
pub fn listen(app: AppHandle, server: String, key: String) {
    let gen = GEN.fetch_add(1, Ordering::SeqCst) + 1;
    tauri::async_runtime::spawn(async move {
        let http = reqwest::Client::builder().connect_timeout(Duration::from_secs(15)).build().unwrap_or_default();
        let mut backoff = 2u64;
        while GEN.load(Ordering::SeqCst) == gen {
            match http.get(format!("{server}/api/v1/events")).bearer_auth(&key).send().await {
                Ok(r) if r.status() == reqwest::StatusCode::UNAUTHORIZED => {
                    tracing::warn!("Mitteilungen: Schlüssel ungültig");
                    let _ = app.notification().builder().title("KM Portal").body("Bitte in der App neu anmelden.").show();
                    return;
                }
                Ok(r) if r.status().is_success() => {
                    backoff = 2;
                    let mut stream = r.bytes_stream();
                    let mut buf = String::new();
                    loop {
                        if GEN.load(Ordering::SeqCst) != gen {
                            return;
                        }
                        // Server sendet alle 25 s ein Lebenszeichen
                        let next = tokio::time::timeout(Duration::from_secs(70), stream.next()).await;
                        let Ok(Some(Ok(chunk))) = next else { break };
                        buf.push_str(&String::from_utf8_lossy(&chunk));
                        while let Some(i) = buf.find("\n\n") {
                            let block: String = buf.drain(..i + 2).collect();
                            let data: Vec<&str> =
                                block.lines().filter_map(|l| l.strip_prefix("data:")).map(str::trim_start).collect();
                            if !data.is_empty() {
                                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data.join("\n")) {
                                    on_event(&app, &v);
                                }
                            }
                        }
                    }
                }
                Ok(r) => tracing::warn!("Mitteilungen: HTTP {}", r.status()),
                Err(e) => tracing::warn!("Mitteilungen: {e}"),
            }
            tokio::time::sleep(Duration::from_secs(backoff)).await;
            backoff = (backoff * 2).min(60);
        }
    });
}

fn window_visible(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .is_some_and(|w| w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false))
}

fn on_event(app: &AppHandle, v: &serde_json::Value) {
    let s = |p: &str| v.pointer(p).and_then(|x| x.as_str()).unwrap_or_default().to_string();
    match v["type"].as_str() {
        Some("hello") => *ME.lock().unwrap() = s("/user"),
        Some("call") if s("/data/kind") == "ring" => {
            // Anruf: Fenster nach vorne holen – das Portal klingelt selbst (WebSocket)
            let media = if s("/data/media") == "video" { "video" } else { "audio" };
            let url = format!(
                "/portal/nachrichten?ring={}&from={}&media={media}&name={}&t={}",
                s("/room"),
                s("/from"),
                s("/name").replace(['&', '?', '#'], " "),
                std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
            );
            let _ = app.notification().builder().title(format!("📞 {}", s("/name"))).body("ruft an …").show();
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.request_user_attention(Some(tauri::UserAttentionType::Critical));
            }
            if !window_visible(app) {
                open(app, &url);
            }
        }
        Some("notification") if !v["quiet"].as_bool().unwrap_or(false) && !window_visible(app) => {
            let title = s("/notification/title");
            let body = s("/notification/body");
            let _ = app.notification().builder().title("KM Portal").body(if body.is_empty() { title } else { format!("{title}\n{body}") }).show();
            let link = s("/notification/link");
            if !link.is_empty() {
                *PENDING.lock().unwrap() = Some(link);
            }
        }
        Some("message") if !window_visible(app) => {
            let m = &v["message"];
            if m["kind"].as_str() == Some("call") || m["sender_id"].as_str() == Some(ME.lock().unwrap().as_str()) {
                return;
            }
            let name = m["sender_name"].as_str().unwrap_or("");
            let body: String = m["body"].as_str().unwrap_or("").chars().take(160).collect();
            let _ = app.notification().builder().title(format!("💬 {name}")).body(body).show();
        }
        _ => {}
    }
}
