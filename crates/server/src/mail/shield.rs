//! Schutz der offenen Mail-Ports gegen Spam und Missbrauch.
//!
//! - Sperre nach Fehlanmeldungen (SMTP 587/465 und IMAP): 10 Fehlversuche in 15 min → IP 1 h gesperrt
//! - DNS-Blocklisten (Spamhaus ZEN, SpamCop) für Port 25
//! - Greylisting: erster Zustellversuch einer unbekannten Kombination (Netz, Absender, Empfänger)
//!   wird 5 min vertagt – echte Mailserver versuchen es erneut, Spam-Schleudern meist nicht
//! - Frühsender-Erkennung: wer vor der Begrüßung schon sendet, ist ein Bot
//!
//! Abschalten (nur für Tests/Notfall): MAIL_GREYLIST=0, MAIL_DNSBL= (leer)

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

// ── Sperre nach Fehlanmeldungen ────────────────────────────────────────

const FAIL_WINDOW: Duration = Duration::from_secs(15 * 60);
const FAIL_MAX: u32 = 10;
const BAN: Duration = Duration::from_secs(60 * 60);

struct Fails {
    count: u32,
    since: Instant,
    banned_until: Option<Instant>,
}

static FAILS: LazyLock<Mutex<HashMap<IpAddr, Fails>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// IP ist gesperrt (Verbindung sofort trennen)
pub fn banned(ip: IpAddr) -> bool {
    let m = FAILS.lock().unwrap_or_else(|e| e.into_inner());
    m.get(&ip).and_then(|f| f.banned_until).is_some_and(|u| u > Instant::now())
}

/// Fehlanmeldung zählen; true = jetzt gesperrt
pub fn auth_failed(ip: IpAddr) -> bool {
    if ip.is_loopback() {
        return false;
    }
    let mut m = FAILS.lock().unwrap_or_else(|e| e.into_inner());
    if m.len() > 100_000 {
        m.retain(|_, f| f.since.elapsed() < FAIL_WINDOW || f.banned_until.is_some_and(|u| u > Instant::now()));
    }
    let f = m.entry(ip).or_insert(Fails { count: 0, since: Instant::now(), banned_until: None });
    if f.since.elapsed() > FAIL_WINDOW {
        *f = Fails { count: 0, since: Instant::now(), banned_until: None };
    }
    f.count += 1;
    if f.count >= FAIL_MAX {
        f.banned_until = Some(Instant::now() + BAN);
        tracing::warn!("Mail: {ip} nach {} Fehlanmeldungen für 1 h gesperrt", f.count);
        return true;
    }
    false
}

// ── DNS-Blocklisten ────────────────────────────────────────────────────

fn zones() -> Vec<String> {
    std::env::var("MAIL_DNSBL")
        .unwrap_or_else(|_| "zen.spamhaus.org,bl.spamcop.net".into())
        .split(',')
        .map(|z| z.trim().to_string())
        .filter(|z| !z.is_empty())
        .collect()
}

/// Nur öffentliche IPv4-Adressen werden geprüft
fn checkable(ip: IpAddr) -> Option<[u8; 4]> {
    match ip {
        IpAddr::V4(v4) if !(v4.is_loopback() || v4.is_private() || v4.is_link_local() || v4.is_unspecified()) => {
            Some(v4.octets())
        }
        _ => None,
    }
}

/// Antwort einer Blockliste: nur 127.0.0.2–127.0.0.99 heißt „gelistet“
/// (127.255.255.x = Fehler/Abfrage über öffentlichen Resolver – nicht werten)
pub fn listed_code(a: IpAddr) -> bool {
    matches!(a, IpAddr::V4(v) if v.octets()[0] == 127 && v.octets()[1] == 0 && v.octets()[2] == 0 && (2..=99).contains(&v.octets()[3]))
}

/// Liste, auf der die IP steht (None = sauber oder nicht prüfbar)
pub async fn dnsbl(ip: IpAddr) -> Option<String> {
    let o = checkable(ip)?;
    for zone in zones() {
        let name = format!("{}.{}.{}.{}.{zone}:25", o[3], o[2], o[1], o[0]);
        if let Ok(Ok(addrs)) = tokio::time::timeout(Duration::from_secs(3), tokio::net::lookup_host(name)).await {
            if addrs.map(|s| s.ip()).any(listed_code) {
                return Some(zone);
            }
        }
    }
    None
}

// ── Greylisting ────────────────────────────────────────────────────────

const GREY_DELAY: Duration = Duration::from_secs(5 * 60);
const GREY_RETRY_MAX: Duration = Duration::from_secs(24 * 3600);
const WHITE_TTL: Duration = Duration::from_secs(36 * 24 * 3600);

struct Grey {
    first: Instant,
    passed: Option<Instant>,
}

static GREY: LazyLock<Mutex<HashMap<String, Grey>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
/// Netze, die einmal sauber erneut zugestellt haben (Auto-Whitelist)
static WHITE: LazyLock<Mutex<HashMap<String, Instant>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

fn greylist_enabled() -> bool {
    std::env::var("MAIL_GREYLIST").map(|v| v != "0").unwrap_or(true)
}

/// /24 (IPv4) bzw. /64 (IPv6): große Anbieter liefern aus wechselnden Adressen eines Netzes
fn net(ip: IpAddr) -> String {
    match ip {
        IpAddr::V4(v) => {
            let o = v.octets();
            format!("{}.{}.{}", o[0], o[1], o[2])
        }
        IpAddr::V6(v) => {
            let s = v.segments();
            format!("{:x}:{:x}:{:x}:{:x}", s[0], s[1], s[2], s[3])
        }
    }
}

/// true = jetzt vertagen (451)
pub fn greylist(ip: IpAddr, from: &str, rcpt: &str) -> bool {
    if !greylist_enabled() || ip.is_loopback() {
        return false;
    }
    let n = net(ip);
    {
        let w = WHITE.lock().unwrap_or_else(|e| e.into_inner());
        if w.get(&n).is_some_and(|t| t.elapsed() < WHITE_TTL) {
            return false;
        }
    }
    let key = format!("{n}|{}|{}", from.to_lowercase(), rcpt.to_lowercase());
    let mut g = GREY.lock().unwrap_or_else(|e| e.into_inner());
    if g.len() > 200_000 {
        g.retain(|_, e| e.first.elapsed() < GREY_RETRY_MAX || e.passed.is_some_and(|p| p.elapsed() < WHITE_TTL));
    }
    let now = Instant::now();
    let e = g.entry(key).or_insert(Grey { first: now, passed: None });
    if e.passed.is_some_and(|p| p.elapsed() < WHITE_TTL) {
        return false;
    }
    let age = e.first.elapsed();
    if age >= GREY_DELAY && age < GREY_RETRY_MAX {
        e.passed = Some(now);
        WHITE.lock().unwrap_or_else(|e| e.into_inner()).insert(n, now);
        return false;
    }
    if age >= GREY_RETRY_MAX {
        e.first = now;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bans_after_failures() {
        let ip: IpAddr = "203.0.113.9".parse().unwrap();
        assert!(!banned(ip));
        for _ in 0..FAIL_MAX - 1 {
            assert!(!auth_failed(ip));
        }
        assert!(auth_failed(ip));
        assert!(banned(ip));
        // lokal nie sperren
        let lo: IpAddr = "127.0.0.1".parse().unwrap();
        for _ in 0..20 {
            assert!(!auth_failed(lo));
        }
        assert!(!banned(lo));
    }

    #[test]
    fn blocklist_answers() {
        assert!(listed_code("127.0.0.2".parse().unwrap()));
        assert!(listed_code("127.0.0.11".parse().unwrap()));
        assert!(!listed_code("127.255.255.254".parse().unwrap()));
        assert!(!listed_code("127.0.0.1".parse().unwrap()));
        assert!(checkable("10.1.2.3".parse().unwrap()).is_none());
        assert_eq!(checkable("198.51.100.7".parse().unwrap()), Some([198, 51, 100, 7]));
    }

    #[test]
    fn greylisting_defers_first_attempt() {
        let ip: IpAddr = "198.51.100.20".parse().unwrap();
        assert!(greylist(ip, "a@x.de", "b@code-craft.tech"));
        assert!(greylist(ip, "a@x.de", "b@code-craft.tech"), "zu früh erneut");
        // Zeit vordrehen: erster Versuch liegt 6 min zurück
        {
            let mut g = GREY.lock().unwrap();
            let e = g.get_mut("198.51.100|a@x.de|b@code-craft.tech").unwrap();
            e.first -= Duration::from_secs(360);
        }
        assert!(!greylist(ip, "a@x.de", "b@code-craft.tech"));
        // Netz ist jetzt bekannt → andere Absender sofort
        assert!(!greylist("198.51.100.21".parse().unwrap(), "c@y.de", "d@code-craft.tech"));
        assert!(!greylist("127.0.0.1".parse().unwrap(), "x@y.de", "z@code-craft.tech"));
    }
}
