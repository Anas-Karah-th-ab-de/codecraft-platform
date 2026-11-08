//! Schutzmaßnahmen des Mailservers:
//! - Verschlüsselung der Nachrichten in der Datenbank (AES-256-GCM, Schlüssel MAIL_ENC_KEY)
//! - Verbindungen je IP begrenzen (SMTP/IMAP)
//! - Versandlimit je Postfach (gekaperte Konten können nicht massenhaft Spam schicken)
//! - Gefährliche Anhänge (ausführbare Dateien, Skripte, Makro-Formate) abweisen

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{LazyLock, Mutex, OnceLock};
use std::time::{Duration, Instant};
use uuid::Uuid;

const MAGIC: &[u8; 4] = b"CCE1";

static CIPHER: OnceLock<Option<Aes256Gcm>> = OnceLock::new();

fn cipher() -> Option<&'static Aes256Gcm> {
    CIPHER
        .get_or_init(|| {
            let key = std::env::var("MAIL_ENC_KEY").ok()?;
            let raw = base64::engine::general_purpose::STANDARD.decode(key.trim()).ok().filter(|k| k.len() == 32);
            match raw {
                Some(k) => Some(Aes256Gcm::new_from_slice(&k).expect("32 Byte")),
                None => {
                    tracing::error!(
                        "MAIL_ENC_KEY ungültig (erwartet: 32 Byte, Base64) – Mails werden NICHT verschlüsselt"
                    );
                    None
                }
            }
        })
        .as_ref()
}

/// Für Tests: festen Schlüssel setzen
pub fn set_key_for_tests(key: [u8; 32]) {
    let _ = CIPHER.set(Some(Aes256Gcm::new_from_slice(&key).expect("32 Byte")));
}

pub fn encryption_enabled() -> bool {
    cipher().is_some()
}

/// Rohnachricht für die Datenbank verschlüsseln (ohne Schlüssel unverändert)
pub fn seal(raw: &[u8]) -> Vec<u8> {
    let Some(c) = cipher() else { return raw.to_vec() };
    let nonce: [u8; 12] = rand::random();
    let ct = c.encrypt(Nonce::from_slice(&nonce), raw).expect("AES-GCM");
    [MAGIC.as_slice(), &nonce, &ct].concat()
}

/// Aus der Datenbank gelesene Nachricht entschlüsseln (unverschlüsselte Altdaten bleiben lesbar)
pub fn open(stored: Vec<u8>) -> Vec<u8> {
    if stored.len() < 16 + 12 || &stored[..4] != MAGIC {
        return stored;
    }
    match cipher().and_then(|c| c.decrypt(Nonce::from_slice(&stored[4..16]), &stored[16..]).ok()) {
        Some(p) => p,
        None => {
            tracing::error!("Nachricht nicht entschlüsselbar (falscher MAIL_ENC_KEY?)");
            b"Subject: [Nachricht nicht entschluesselbar]\r\n\r\nSchluessel fehlt oder ist falsch.\r\n".to_vec()
        }
    }
}

/// Neuen Schlüssel erzeugen (für die Einrichtung)
pub fn new_key() -> String {
    base64::engine::general_purpose::STANDARD.encode(rand::random::<[u8; 32]>())
}

// ── Verbindungen je IP ─────────────────────────────────────────────────

static CONNS: LazyLock<Mutex<HashMap<IpAddr, usize>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub struct ConnGuard(IpAddr);

/// Platz für eine weitere Verbindung dieser IP? (None = zu viele gleichzeitig)
pub fn connection(ip: IpAddr, max: usize) -> Option<ConnGuard> {
    let mut m = CONNS.lock().unwrap();
    let n = m.entry(ip).or_insert(0);
    if *n >= max {
        return None;
    }
    *n += 1;
    Some(ConnGuard(ip))
}

impl Drop for ConnGuard {
    fn drop(&mut self) {
        let mut m = CONNS.lock().unwrap();
        if let Some(n) = m.get_mut(&self.0) {
            *n -= 1;
            if *n == 0 {
                m.remove(&self.0);
            }
        }
    }
}

// ── Versandlimit ───────────────────────────────────────────────────────

static SENT: LazyLock<Mutex<HashMap<Uuid, (Instant, u32)>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

fn limit() -> u32 {
    std::env::var("MAIL_RCPT_PER_HOUR").ok().and_then(|v| v.parse().ok()).unwrap_or(300)
}

/// Darf dieses Postfach jetzt an `rcpts` Empfänger senden? Zählt bei Ja mit.
pub fn send_allowed(mailbox: Uuid, rcpts: usize) -> bool {
    let mut m = SENT.lock().unwrap();
    let e = m.entry(mailbox).or_insert((Instant::now(), 0));
    if e.0.elapsed() > Duration::from_secs(3600) {
        *e = (Instant::now(), 0);
    }
    if e.1 as usize + rcpts > limit() as usize {
        tracing::warn!("Versandlimit erreicht für Postfach {mailbox}");
        return false;
    }
    e.1 += rcpts as u32;
    true
}

// ── Gefährliche Anhänge ────────────────────────────────────────────────

const BLOCKED: &[&str] = &[
    "exe",
    "com",
    "scr",
    "pif",
    "bat",
    "cmd",
    "msi",
    "msp",
    "mst",
    "cpl",
    "dll",
    "sys",
    "drv",
    "ocx",
    "hta",
    "jar",
    "js",
    "jse",
    "vbs",
    "vbe",
    "wsf",
    "wsh",
    "wsc",
    "ps1",
    "psm1",
    "psd1",
    "lnk",
    "inf",
    "reg",
    "scf",
    "url",
    "iso",
    "img",
    "vhd",
    "vhdx",
    "appx",
    "msix",
    "application",
    "gadget",
    "chm",
    "docm",
    "xlsm",
    "pptm",
    "dotm",
    "xltm",
    "xlam",
    "ppam",
    "sldm",
    "one",
];

/// Einzelne Datei (Chat-Upload): gesperrte Endung, Programm-Typ oder Windows-Programm (MZ)?
pub fn dangerous_file(name: &str, mime: &str, data: &[u8]) -> bool {
    let name = name.trim().trim_end_matches('.').to_lowercase();
    let ext = name.rsplit_once('.').map(|(_, e)| e).unwrap_or("");
    let ct = mime.to_lowercase();
    BLOCKED.contains(&ext)
        || ct.contains("x-msdownload")
        || ct.contains("x-msdos-program")
        || ct.contains("x-executable")
        || ct.contains("x-ms-installer")
        || data.starts_with(b"MZ")
}

/// Name des ersten gesperrten Anhangs (auch „rechnung.pdf.exe“ oder ohne Endung als Programm deklariert)
pub fn dangerous_attachment(raw: &[u8]) -> Option<String> {
    let m = mail_parser::MessageParser::default().parse(raw)?;
    for a in m.attachments() {
        let name = a.attachment_name().unwrap_or("").trim().trim_end_matches('.').to_lowercase();
        let ext = name.rsplit_once('.').map(|(_, e)| e).unwrap_or("");
        let ct = a
            .content_type()
            .map(|c| format!("{}/{}", c.ctype(), c.subtype().unwrap_or("")))
            .unwrap_or_default()
            .to_lowercase();
        let exec_type = ct.contains("x-msdownload")
            || ct.contains("x-msdos-program")
            || ct.contains("x-executable")
            || ct.contains("x-ms-installer");
        let exe_bytes = a.decoded().starts_with(b"MZ");
        if BLOCKED.contains(&ext) || exec_type || exe_bytes {
            return Some(if name.is_empty() { "unbenannt".into() } else { name });
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypts_and_decrypts() {
        set_key_for_tests([7; 32]);
        let raw = b"Subject: Geheim\r\n\r\nInhalt".to_vec();
        let sealed = seal(&raw);
        assert!(sealed.starts_with(b"CCE1") && !sealed.windows(6).any(|w| w == b"Geheim"));
        assert_eq!(open(sealed), raw);
        assert_eq!(open(raw.clone()), raw, "Altdaten bleiben lesbar");
    }

    #[test]
    fn limits_connections_and_sending() {
        let ip: IpAddr = "203.0.113.9".parse().unwrap();
        let a = connection(ip, 2).unwrap();
        let _b = connection(ip, 2).unwrap();
        assert!(connection(ip, 2).is_none());
        drop(a);
        assert!(connection(ip, 2).is_some());
        let mb = Uuid::now_v7();
        assert!(send_allowed(mb, 299));
        assert!(!send_allowed(mb, 2));
        assert!(send_allowed(mb, 1));
    }

    #[test]
    fn blocks_dangerous_attachments() {
        let mk = |name: &str, body: &str| {
            format!(
            "Subject: x\r\nContent-Type: multipart/mixed; boundary=B\r\n\r\n--B\r\nContent-Type: text/plain\r\n\r\nHi\r\n--B\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename=\"{name}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n{body}\r\n--B--\r\n"
        )
        };
        assert_eq!(
            dangerous_attachment(mk("Rechnung.pdf.exe", "QUJD").as_bytes()).as_deref(),
            Some("rechnung.pdf.exe")
        );
        assert_eq!(dangerous_attachment(mk("angebot.docm", "QUJD").as_bytes()).as_deref(), Some("angebot.docm"));
        assert!(
            dangerous_attachment(mk("tarnung.pdf", "TVqQAAMAAAAEAAAA").as_bytes()).is_some(),
            "Programm mit falscher Endung"
        );
        assert!(dangerous_attachment(mk("angebot.pdf", "JVBERi0=").as_bytes()).is_none());
    }
}
