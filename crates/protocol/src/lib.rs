//! Gemeinsames Nachrichtenformat zwischen Plattform und Geräten.
//!
//! Wird von Server, Desktop-Agent, ESP32-Firmware, KI-Appliance und POS genutzt.
//! `no_std` + `alloc`, damit es auch auf Mikrocontrollern läuft.
//! Transport: JSON über HTTPS (`POST /api/v1/devices/report`), Auth per Gerätetoken.

#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

pub mod remote;

/// Protokollversion. Server lehnt Major-Versionen ab, die er nicht kennt.
pub const PROTOCOL_VERSION: u16 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceKind {
    /// Support-/Fernwartungs-Agent auf Kunden-PCs
    Agent,
    /// Eigene Hardware mit ESP32
    Esp32,
    /// KM Code Craft AI (Offline-KI-Appliance)
    AiAppliance,
    /// POS Code Craft Kasse
    Pos,
}

/// Gerät → Plattform
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Report {
    pub protocol: u16,
    pub kind: DeviceKind,
    /// Firmware-/Softwareversion (SemVer)
    pub version: String,
    pub uptime_s: u64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub metrics: Vec<Metric>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<Event>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Metric {
    /// z. B. "cpu_pct", "mem_used_mb", "temp_c", "rssi_dbm", "disk_free_gb"
    pub name: String,
    pub value: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Event {
    pub level: Level,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Level {
    Info,
    Warn,
    Error,
}

/// Plattform → Gerät (Antwort auf jeden Report)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReportAck {
    pub protocol: u16,
    /// Sekunden bis zum nächsten Report
    pub next_report_s: u32,
    pub license: LicenseState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub update: Option<UpdateOffer>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub commands: Vec<Command>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum LicenseState {
    Valid {
        expires_at: Option<String>,
    },
    Grace {
        days_left: u16,
    },
    Expired,
    Revoked,
    /// Gerät nutzt keine Lizenz (z. B. Agent)
    NotRequired,
}

/// OTA-/Update-Angebot. Gerät prüft `sha256` vor der Installation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateOffer {
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub size: u64,
    /// Pflichtupdate (Sicherheitsfix)
    pub mandatory: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Reboot,
    /// Fernwartungssitzung anfordern (Agent)
    StartRemoteSession {
        session_id: String,
    },
    SetReportInterval {
        seconds: u32,
    },
}

/// Kompatibilität: gleiche Protokollversion.
pub fn is_compatible(version: u16) -> bool {
    version == PROTOCOL_VERSION
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::string::ToString;
    use alloc::vec;

    #[test]
    fn report_roundtrip() {
        let r = Report {
            protocol: PROTOCOL_VERSION,
            kind: DeviceKind::Esp32,
            version: "1.2.0".to_string(),
            uptime_s: 3600,
            metrics: vec![Metric { name: "temp_c".to_string(), value: 41.5 }],
            events: vec![],
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"kind\":\"esp32\""));
        assert!(!json.contains("events"));
        assert_eq!(serde_json::from_str::<Report>(&json).unwrap(), r);
    }

    #[test]
    fn ack_tagged_enums() {
        let a = ReportAck {
            protocol: 1,
            next_report_s: 60,
            license: LicenseState::Grace { days_left: 3 },
            update: None,
            commands: vec![Command::SetReportInterval { seconds: 30 }],
        };
        let json = serde_json::to_string(&a).unwrap();
        assert!(json.contains("\"state\":\"grace\""));
        assert!(json.contains("\"type\":\"set_report_interval\""));
        assert_eq!(serde_json::from_str::<ReportAck>(&json).unwrap(), a);
    }
}
