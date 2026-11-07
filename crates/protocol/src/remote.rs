//! Fernwartung über eine dauerhafte WebSocket-Verbindung (`/api/v1/devices/ws`, TLS + Gerätetoken).
//!
//! Textnachrichten: JSON ([`ToDevice`] / [`FromDevice`]).
//! Binärnachrichten: Bildschirm-Frames, siehe [`encode_frame`] / [`decode_frame`].
//!
//! Sicherheit: Das Gerät bestimmt selbst, was erlaubt ist ([`Capabilities`], bei der Installation festgelegt).
//! Bildschirmsitzungen brauchen die Zustimmung am Gerät, außer der Besitzer hat „unbeaufsichtigt“ erlaubt.

use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

/// Was der Besitzer des Geräts erlaubt hat (Agent-Einstellung, nicht vom Server änderbar)
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Capabilities {
    /// Bildschirm sehen und steuern (immer mit Zustimmung, außer `unattended`)
    pub screen: bool,
    /// Bildschirmsitzung ohne Rückfrage (nur für eigene Geräte wie Kasse/KI-Appliance)
    pub unattended: bool,
    /// Befehle ausführen
    pub exec: bool,
    /// Dateien lesen/schreiben
    pub files: bool,
}

/// Plattform → Gerät
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum ToDevice {
    Ping,
    /// Inventar abfragen
    Inventory {
        id: String,
    },
    /// Programm ausführen (ohne Shell, Argumente einzeln)
    Exec {
        id: String,
        program: String,
        args: Vec<String>,
        timeout_s: u32,
    },
    Reboot {
        id: String,
    },
    /// Verzeichnis auflisten
    ListDir {
        id: String,
        path: String,
    },
    /// Datei holen (in Blöcken als FileChunk)
    GetFile {
        id: String,
        path: String,
    },
    /// Datei schreiben (Block für Block, `offset` 0 legt neu an)
    PutFile {
        id: String,
        path: String,
        offset: u64,
        data_b64: String,
        last: bool,
    },
    /// Bildschirmsitzung anfragen; `operator` wird dem Kunden angezeigt
    ScreenStart {
        session: String,
        operator: String,
        max_fps: u8,
        max_width: u32,
    },
    ScreenStop {
        session: String,
    },
    Input {
        session: String,
        event: InputEvent,
    },
}

/// Gerät → Plattform
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum FromDevice {
    Hello {
        protocol: u16,
        version: String,
        hostname: String,
        os: String,
        arch: String,
        caps: Capabilities,
    },
    Pong,
    Result {
        id: String,
        ok: bool,
        code: Option<i32>,
        output: String,
    },
    Inventory {
        id: String,
        info: Inventory,
    },
    Dir {
        id: String,
        entries: Vec<DirEntry>,
    },
    FileChunk {
        id: String,
        offset: u64,
        data_b64: String,
        last: bool,
        size: u64,
    },
    /// Antwort des Kunden auf die Bildschirmanfrage
    ScreenConsent {
        session: String,
        granted: bool,
    },
    ScreenEnded {
        session: String,
        reason: String,
    },
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Inventory {
    pub hostname: String,
    pub os: String,
    pub arch: String,
    pub cpu: String,
    pub cores: u32,
    pub mem_total_mb: u64,
    pub disks: Vec<Disk>,
    pub ips: Vec<String>,
    pub uptime_s: u64,
    pub user: Option<String>,
    pub screens: Vec<(u32, u32)>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Disk {
    pub mount: String,
    pub total_gb: f64,
    pub free_gb: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub dir: bool,
    pub size: u64,
    pub modified: Option<i64>,
}

/// Eingaben des Technikers. Koordinaten relativ (0–10000) zur Bildbreite/-höhe.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "k", rename_all = "snake_case")]
pub enum InputEvent {
    Move {
        x: u16,
        y: u16,
    },
    Button {
        button: MouseButton,
        down: bool,
    },
    Wheel {
        dy: i16,
    },
    /// Taste nach Web-`KeyboardEvent.code` (z. B. "KeyA", "Enter", "ShiftLeft")
    Key {
        code: String,
        down: bool,
    },
    /// Text direkt eingeben (Umlaute, Arabisch)
    Text {
        text: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

/// Binärer Frame: 1 Byte Typ (1 = JPEG), 16 Byte Sitzungs-ID (UUID), 2+2 Byte Breite/Höhe, dann JPEG
pub const FRAME_JPEG: u8 = 1;

pub fn encode_frame(session: &[u8; 16], width: u16, height: u16, jpeg: &[u8]) -> Vec<u8> {
    let mut v = Vec::with_capacity(21 + jpeg.len());
    v.push(FRAME_JPEG);
    v.extend_from_slice(session);
    v.extend_from_slice(&width.to_be_bytes());
    v.extend_from_slice(&height.to_be_bytes());
    v.extend_from_slice(jpeg);
    v
}

/// → (Sitzung, Breite, Höhe, JPEG)
pub fn decode_frame(b: &[u8]) -> Option<([u8; 16], u16, u16, &[u8])> {
    if b.len() < 21 || b[0] != FRAME_JPEG {
        return None;
    }
    let mut s = [0u8; 16];
    s.copy_from_slice(&b[1..17]);
    Some((s, u16::from_be_bytes([b[17], b[18]]), u16::from_be_bytes([b[19], b[20]]), &b[21..]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::string::ToString;

    #[test]
    fn messages_roundtrip() {
        let m = ToDevice::Input {
            session: "s1".to_string(),
            event: InputEvent::Key { code: "KeyA".to_string(), down: true },
        };
        let j = serde_json::to_string(&m).unwrap();
        assert!(j.contains("\"t\":\"input\"") && j.contains("\"k\":\"key\""));
        assert_eq!(serde_json::from_str::<ToDevice>(&j).unwrap(), m);
        let h = FromDevice::Hello {
            protocol: 1,
            version: "0.1.0".to_string(),
            hostname: "kasse-1".to_string(),
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            caps: Capabilities { screen: true, ..Default::default() },
        };
        assert_eq!(serde_json::from_str::<FromDevice>(&serde_json::to_string(&h).unwrap()).unwrap(), h);
    }

    #[test]
    fn frames() {
        let f = encode_frame(&[7; 16], 1280, 720, &[0xFF, 0xD8, 1, 2]);
        let (s, w, h, j) = decode_frame(&f).unwrap();
        assert_eq!((s, w, h, j), ([7; 16], 1280, 720, &[0xFF, 0xD8, 1, 2][..]));
        assert!(decode_frame(&[2; 30]).is_none());
    }
}
