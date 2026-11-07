//! codecraft-agent – läuft auf Kunden-PCs, KI-Appliance oder POS.
//!
//! - meldet regelmäßig Zustand und Messwerte (HTTPS)
//! - hält eine dauerhafte Fernwartungsverbindung (WebSocket über TLS)
//!
//! Einstellungen (Umgebung oder Datei `codecraft-agent.conf`, Zeilen `SCHLÜSSEL=Wert`;
//! Linux: /etc/codecraft-agent.conf, Windows: neben der .exe, oder Pfad in CC_CONFIG):
//!   CC_API_URL       z. B. https://code-craft.tech
//!   CC_DEVICE_TOKEN  Gerätetoken aus der Registrierung (cc_d_…)
//!   CC_DEVICE_KIND   agent | ai_appliance | pos   (Standard: agent)
//!   CC_ALLOW_SCREEN  1 = Bildschirm sehen/steuern mit Zustimmung (Standard 1)
//!   CC_UNATTENDED    1 = ohne Rückfrage (nur eigene Geräte, Standard 0)
//!   CC_ALLOW_EXEC    1 = Befehle/Neustart erlauben (Standard 0)
//!   CC_ALLOW_FILES   1 = Dateien lesen/schreiben erlauben (Standard 0)

mod ops;
mod remote;
mod screen;

use codecraft_protocol::remote::Capabilities;
use codecraft_protocol::{Command, DeviceKind, LicenseState, Metric, Report, ReportAck, PROTOCOL_VERSION};
use std::time::{Duration, Instant};
use sysinfo::{Disks, System};

fn kind_from_env() -> DeviceKind {
    match std::env::var("CC_DEVICE_KIND").as_deref() {
        Ok("ai_appliance") => DeviceKind::AiAppliance,
        Ok("pos") => DeviceKind::Pos,
        _ => DeviceKind::Agent,
    }
}

fn flag(name: &str, default: bool) -> bool {
    std::env::var(name).map(|v| matches!(v.trim(), "1" | "true" | "ja" | "yes")).unwrap_or(default)
}

/// Einstellungsdatei laden (Umgebung hat Vorrang)
fn load_config_file() {
    let path = std::env::var("CC_CONFIG").ok().map(std::path::PathBuf::from).unwrap_or_else(|| {
        if cfg!(windows) {
            std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join("codecraft-agent.conf")))
                .unwrap_or_default()
        } else {
            "/etc/codecraft-agent.conf".into()
        }
    });
    let Ok(text) = std::fs::read_to_string(&path) else { return };
    for line in text.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')) {
        if let Some((k, v)) = line.split_once('=') {
            if std::env::var_os(k.trim()).is_none() {
                std::env::set_var(k.trim(), v.trim());
            }
        }
    }
}

fn collect(sys: &mut System, disks: &mut Disks) -> Vec<Metric> {
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    disks.refresh(true);
    let free_gb: f64 = disks.list().iter().map(|d| d.available_space() as f64).sum::<f64>() / 1e9;
    vec![
        Metric { name: "cpu_pct".into(), value: sys.global_cpu_usage() as f64 },
        Metric { name: "mem_used_mb".into(), value: sys.used_memory() as f64 / 1_048_576.0 },
        Metric { name: "mem_total_mb".into(), value: sys.total_memory() as f64 / 1_048_576.0 },
        Metric { name: "disk_free_gb".into(), value: (free_gb * 10.0).round() / 10.0 },
    ]
}

fn secs(s: u32) -> Duration {
    Duration::from_secs(s.clamp(10, 86_400) as u64)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt().with_env_filter("info").init();
    let _ = rustls::crypto::ring::default_provider().install_default();
    load_config_file();
    let api = std::env::var("CC_API_URL").map_err(|_| "CC_API_URL fehlt")?;
    let token = std::env::var("CC_DEVICE_TOKEN").map_err(|_| "CC_DEVICE_TOKEN fehlt")?;
    let api = api.trim_end_matches('/').to_string();
    let caps = Capabilities {
        screen: flag("CC_ALLOW_SCREEN", true),
        unattended: flag("CC_UNATTENDED", false),
        exec: flag("CC_ALLOW_EXEC", false),
        files: flag("CC_ALLOW_FILES", false),
    };
    tracing::info!(
        "Erlaubt: Bildschirm={} unbeaufsichtigt={} Befehle={} Dateien={}",
        caps.screen,
        caps.unattended,
        caps.exec,
        caps.files
    );
    let ws_url = format!("{}/api/v1/devices/ws", api.replacen("https://", "wss://", 1).replacen("http://", "ws://", 1));
    tokio::spawn(remote::run(remote::Config { ws_url, token: token.clone(), caps }));
    report_loop(&api, &token).await
}

async fn report_loop(api: &str, token: &str) -> Result<(), Box<dyn std::error::Error>> {
    let kind = kind_from_env();
    let url = format!("{api}/api/v1/devices/report");
    let http = reqwest::Client::builder().timeout(Duration::from_secs(15)).build()?;
    let started = Instant::now();
    let mut sys = System::new();
    let mut disks = Disks::new_with_refreshed_list();
    let mut interval = Duration::from_secs(60);
    let mut backoff = Duration::from_secs(5);

    loop {
        let report = Report {
            protocol: PROTOCOL_VERSION,
            kind,
            version: env!("CARGO_PKG_VERSION").into(),
            uptime_s: started.elapsed().as_secs(),
            metrics: collect(&mut sys, &mut disks),
            events: vec![],
        };
        match http.post(&url).bearer_auth(token).json(&report).send().await {
            Ok(res) if res.status().is_success() => {
                backoff = Duration::from_secs(5);
                let ack: ReportAck = res.json().await?;
                interval = secs(ack.next_report_s);
                match ack.license {
                    LicenseState::Expired | LicenseState::Revoked => {
                        tracing::warn!("Lizenz ungültig: {:?}", ack.license)
                    }
                    LicenseState::Grace { days_left } => {
                        tracing::warn!("Lizenz abgelaufen – noch {days_left} Tage Kulanz")
                    }
                    _ => {}
                }
                if let Some(u) = ack.update {
                    tracing::info!("Update verfügbar: {} ({} Bytes)", u.version, u.size);
                }
                for c in ack.commands {
                    if let Command::SetReportInterval { seconds } = c {
                        interval = secs(seconds);
                    }
                }
            }
            Ok(res) => {
                tracing::error!("Report abgelehnt: HTTP {}", res.status());
                if res.status() == reqwest::StatusCode::UNAUTHORIZED {
                    return Err("Gerätetoken ungültig oder widerrufen".into());
                }
            }
            Err(e) => {
                tracing::warn!("Plattform nicht erreichbar: {e} – neuer Versuch in {backoff:?}");
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(Duration::from_secs(300));
                continue;
            }
        }
        tokio::time::sleep(interval).await;
    }
}
