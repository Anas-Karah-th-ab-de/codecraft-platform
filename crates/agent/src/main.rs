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

use codecraft_agent::{flag, kind_from_env, load_config_file, Agent};
use codecraft_protocol::remote::Capabilities;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt().with_env_filter("info").init();
    let _ = rustls::crypto::ring::default_provider().install_default();
    load_config_file();
    let api = std::env::var("CC_API_URL").map_err(|_| "CC_API_URL fehlt")?;
    let token = std::env::var("CC_DEVICE_TOKEN").map_err(|_| "CC_DEVICE_TOKEN fehlt")?;
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
    let agent = Agent::start(&api, &token, caps, kind_from_env());
    tokio::signal::ctrl_c().await?;
    agent.stop();
    Ok(())
}
