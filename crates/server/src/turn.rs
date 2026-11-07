//! Eigener STUN/TURN-Server (RFC 5389 / RFC 8656, UDP) auf einem Port.
//!
//! - Binding: öffentliche Adresse melden (für normale Anrufe genügt das)
//! - TURN: Relay-Adresse vergeben, wenn direkte Verbindungen an Firewalls scheitern
//!
//! Zugang mit zeitlich begrenzten Daten (TURN-REST-Verfahren): Benutzername `<ablauf>:<benutzer-id>`,
//! Passwort = Base64(HMAC-SHA1(Geheimnis, Benutzername)). Das Portal vergibt sie über `/api/v1/chat/ice`.

use base64::Engine;
use hmac::{Hmac, Mac};
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, LazyLock, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tokio::net::UdpSocket;
use uuid::Uuid;

const MAGIC: u32 = 0x2112_A442;
// Methoden
const BINDING: u16 = 0x001;
const ALLOCATE: u16 = 0x003;
const REFRESH: u16 = 0x004;
const SEND: u16 = 0x006;
const DATA_IND: u16 = 0x007;
const CREATE_PERMISSION: u16 = 0x008;
const CHANNEL_BIND: u16 = 0x009;
// Klassen
const REQUEST: u16 = 0x000;
const INDICATION: u16 = 0x010;
const SUCCESS: u16 = 0x100;
const ERROR: u16 = 0x110;
// Attribute
const A_USERNAME: u16 = 0x0006;
const A_INTEGRITY: u16 = 0x0008;
const A_ERROR: u16 = 0x0009;
const A_CHANNEL: u16 = 0x000C;
const A_LIFETIME: u16 = 0x000D;
const A_PEER: u16 = 0x0012;
const A_DATA: u16 = 0x0013;
const A_REALM: u16 = 0x0014;
const A_NONCE: u16 = 0x0015;
const A_RELAYED: u16 = 0x0016;
const A_MAPPED: u16 = 0x0020;
const A_SOFTWARE: u16 = 0x8022;

const DEFAULT_LIFETIME: u32 = 600;
const MAX_LIFETIME: u32 = 3600;
const PERMISSION_TTL: Duration = Duration::from_secs(300);
const MAX_ALLOCATIONS_PER_USER: usize = 10;

type HmacSha1 = Hmac<sha1::Sha1>;

static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
static NONCE: LazyLock<String> = LazyLock::new(|| hex::encode(rand::random::<[u8; 12]>()));

fn secret() -> &'static [u8] {
    SECRET.get_or_init(|| match std::env::var("TURN_SECRET") {
        Ok(s) if s.len() >= 16 => s.into_bytes(),
        _ => rand::random::<[u8; 32]>().to_vec(),
    })
}

pub fn realm() -> String {
    std::env::var("TURN_REALM").unwrap_or_else(|_| "code-craft.tech".into())
}

/// Ist der Relay eingeschaltet? (TURN=off schaltet ab)
pub fn enabled() -> bool {
    !std::env::var("TURN").is_ok_and(|v| v == "off")
}

fn password_for(username: &str) -> String {
    let mut m = HmacSha1::new_from_slice(secret()).expect("HMAC");
    m.update(username.as_bytes());
    base64::engine::general_purpose::STANDARD.encode(m.finalize().into_bytes())
}

/// Zugangsdaten für einen Benutzer (24 h gültig)
pub fn credentials(user: Uuid) -> (String, String) {
    let expiry = chrono::Utc::now().timestamp() + 24 * 3600;
    let username = format!("{expiry}:{user}");
    let pw = password_for(&username);
    (username, pw)
}

fn long_term_key(username: &str, realm: &str, password: &str) -> [u8; 16] {
    use md5::Digest;
    md5::Md5::digest(format!("{username}:{realm}:{password}").as_bytes()).into()
}

// ── Nachrichten ────────────────────────────────────────────────────────

struct Msg<'a> {
    method: u16,
    class: u16,
    tid: [u8; 12],
    attrs: Vec<(u16, &'a [u8], usize)>, // (Typ, Wert, Position im Paket)
    raw: &'a [u8],
}

fn parse(b: &[u8]) -> Option<Msg<'_>> {
    if b.len() < 20 || b[0] & 0xC0 != 0 || u32::from_be_bytes([b[4], b[5], b[6], b[7]]) != MAGIC {
        return None;
    }
    let t = u16::from_be_bytes([b[0], b[1]]);
    let len = u16::from_be_bytes([b[2], b[3]]) as usize;
    if 20 + len > b.len() {
        return None;
    }
    let method = (t & 0x000F) | ((t & 0x00E0) >> 1) | ((t & 0x3E00) >> 2);
    let class = t & 0x0110;
    let mut attrs = vec![];
    let mut i = 20;
    while i + 4 <= 20 + len {
        let at = u16::from_be_bytes([b[i], b[i + 1]]);
        let al = u16::from_be_bytes([b[i + 2], b[i + 3]]) as usize;
        if i + 4 + al > b.len() {
            return None;
        }
        attrs.push((at, &b[i + 4..i + 4 + al], i));
        i += 4 + al.div_ceil(4) * 4;
    }
    Some(Msg { method, class, tid: b[8..20].try_into().ok()?, attrs, raw: b })
}

impl Msg<'_> {
    fn attr(&self, t: u16) -> Option<&[u8]> {
        self.attrs.iter().find(|a| a.0 == t).map(|a| a.1)
    }
    fn text(&self, t: u16) -> Option<String> {
        self.attr(t).map(|v| String::from_utf8_lossy(v).into_owned())
    }
}

struct Out {
    buf: Vec<u8>,
}

impl Out {
    fn new(method: u16, class: u16, tid: &[u8; 12]) -> Self {
        let t = (method & 0x000F) | ((method & 0x0070) << 1) | ((method & 0x0F80) << 2) | class;
        let mut buf = Vec::with_capacity(128);
        buf.extend_from_slice(&t.to_be_bytes());
        buf.extend_from_slice(&[0, 0]);
        buf.extend_from_slice(&MAGIC.to_be_bytes());
        buf.extend_from_slice(tid);
        Out { buf }
    }
    fn attr(mut self, t: u16, v: &[u8]) -> Self {
        self.buf.extend_from_slice(&t.to_be_bytes());
        self.buf.extend_from_slice(&(v.len() as u16).to_be_bytes());
        self.buf.extend_from_slice(v);
        while self.buf.len() % 4 != 0 {
            self.buf.push(0);
        }
        self.fix_len(0);
        self
    }
    fn addr(self, t: u16, a: SocketAddr) -> Self {
        let tid: [u8; 12] = self.buf[8..20].try_into().unwrap();
        let v = xor_addr(a, &tid);
        self.attr(t, &v)
    }
    fn fix_len(&mut self, extra: usize) {
        let len = (self.buf.len() - 20 + extra) as u16;
        self.buf[2..4].copy_from_slice(&len.to_be_bytes());
    }
    /// MESSAGE-INTEGRITY anhängen
    fn sign(mut self, key: &[u8]) -> Vec<u8> {
        self.fix_len(24);
        let mut m = HmacSha1::new_from_slice(key).expect("HMAC");
        m.update(&self.buf);
        let mac = m.finalize().into_bytes();
        self.buf.extend_from_slice(&A_INTEGRITY.to_be_bytes());
        self.buf.extend_from_slice(&20u16.to_be_bytes());
        self.buf.extend_from_slice(&mac);
        self.buf
    }
    fn error(method: u16, tid: &[u8; 12], code: u16, reason: &str) -> Self {
        let mut v = vec![0, 0, (code / 100) as u8, (code % 100) as u8];
        v.extend_from_slice(reason.as_bytes());
        Out::new(method, ERROR, tid).attr(A_ERROR, &v)
    }
}

fn xor_addr(a: SocketAddr, tid: &[u8; 12]) -> Vec<u8> {
    let mut v = vec![0];
    let port = a.port() ^ (MAGIC >> 16) as u16;
    match a.ip() {
        IpAddr::V4(ip) => {
            v.push(0x01);
            v.extend_from_slice(&port.to_be_bytes());
            v.extend_from_slice(&(u32::from(ip) ^ MAGIC).to_be_bytes());
        }
        IpAddr::V6(ip) => {
            v.push(0x02);
            v.extend_from_slice(&port.to_be_bytes());
            let mut key = [0u8; 16];
            key[..4].copy_from_slice(&MAGIC.to_be_bytes());
            key[4..].copy_from_slice(tid);
            v.extend(ip.octets().iter().zip(key).map(|(b, k)| b ^ k));
        }
    }
    v
}

fn read_xor_addr(v: &[u8], tid: &[u8; 12]) -> Option<SocketAddr> {
    if v.len() < 8 {
        return None;
    }
    let port = u16::from_be_bytes([v[2], v[3]]) ^ (MAGIC >> 16) as u16;
    match v[1] {
        0x01 => {
            Some(SocketAddr::new(Ipv4Addr::from(u32::from_be_bytes([v[4], v[5], v[6], v[7]]) ^ MAGIC).into(), port))
        }
        0x02 if v.len() >= 20 => {
            let mut key = [0u8; 16];
            key[..4].copy_from_slice(&MAGIC.to_be_bytes());
            key[4..].copy_from_slice(tid);
            let mut o = [0u8; 16];
            for i in 0..16 {
                o[i] = v[4 + i] ^ key[i];
            }
            Some(SocketAddr::new(std::net::Ipv6Addr::from(o).into(), port))
        }
        _ => None,
    }
}

/// MESSAGE-INTEGRITY prüfen → Schlüssel und Benutzer-ID
fn authenticate(m: &Msg) -> Result<([u8; 16], String), (u16, &'static str)> {
    let (Some(user), Some(_realm), Some(nonce), Some(mi)) =
        (m.text(A_USERNAME), m.text(A_REALM), m.text(A_NONCE), m.attrs.iter().find(|a| a.0 == A_INTEGRITY))
    else {
        return Err((401, "Unauthorized"));
    };
    if nonce != *NONCE {
        return Err((438, "Stale Nonce"));
    }
    let expiry: i64 = user.split(':').next().and_then(|e| e.parse().ok()).unwrap_or(0);
    if expiry < chrono::Utc::now().timestamp() {
        return Err((401, "Unauthorized"));
    }
    let key = long_term_key(&user, &realm(), &password_for(&user));
    let pos = mi.2;
    let mut head = m.raw[..pos].to_vec();
    let len = (pos - 20 + 24) as u16;
    head[2..4].copy_from_slice(&len.to_be_bytes());
    let mut mac = HmacSha1::new_from_slice(&key).expect("HMAC");
    mac.update(&head);
    if mac.verify_slice(mi.1).is_err() {
        return Err((401, "Unauthorized"));
    }
    Ok((key, user))
}

// ── Zustand ────────────────────────────────────────────────────────────

struct Allocation {
    user: String,
    key: [u8; 16],
    relay: Arc<UdpSocket>,
    expires: Instant,
    perms: HashMap<IpAddr, Instant>,
    channels: HashMap<u16, SocketAddr>,
    task: tokio::task::JoinHandle<()>,
}

type Table = Arc<Mutex<HashMap<SocketAddr, Allocation>>>;

fn public_ip() -> IpAddr {
    std::env::var("TURN_PUBLIC_IP").ok().and_then(|s| s.parse().ok()).unwrap_or(IpAddr::V4(Ipv4Addr::LOCALHOST))
}

async fn bind_relay() -> std::io::Result<UdpSocket> {
    let lo: u16 = std::env::var("TURN_MIN_PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(50000);
    let hi: u16 = std::env::var("TURN_MAX_PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(50999);
    for _ in 0..50 {
        let port = lo + rand::random::<u16>() % (hi - lo + 1);
        if let Ok(s) = UdpSocket::bind(("0.0.0.0", port)).await {
            return Ok(s);
        }
    }
    UdpSocket::bind("0.0.0.0:0").await
}

/// Server-Schleife (STUN + TURN auf einem UDP-Port)
pub async fn serve(bind: String) {
    let sock = match UdpSocket::bind(&bind).await {
        Ok(s) => Arc::new(s),
        Err(e) => {
            tracing::warn!("STUN/TURN nicht gestartet ({bind}): {e}");
            return;
        }
    };
    tracing::info!("STUN/TURN lauscht auf udp://{bind}{}", if enabled() { "" } else { " (nur STUN)" });
    run(sock).await
}

pub async fn run(sock: Arc<UdpSocket>) {
    let table: Table = Arc::new(Mutex::new(HashMap::new()));
    // abgelaufene Zuteilungen aufräumen
    {
        let table = table.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(30)).await;
                let now = Instant::now();
                table.lock().unwrap().retain(|_, a| {
                    a.perms.retain(|_, t| *t > now);
                    let keep = a.expires > now;
                    if !keep {
                        a.task.abort();
                    }
                    keep
                });
            }
        });
    }
    let mut buf = vec![0u8; 65536];
    loop {
        let Ok((n, from)) = sock.recv_from(&mut buf).await else { continue };
        let pkt = &buf[..n];
        // ChannelData (0x4000–0x7FFF): Kanal → Gegenstelle
        if n >= 4 && (0x40..0x80).contains(&pkt[0]) {
            let ch = u16::from_be_bytes([pkt[0], pkt[1]]);
            let len = u16::from_be_bytes([pkt[2], pkt[3]]) as usize;
            let target = {
                let t = table.lock().unwrap();
                t.get(&from).and_then(|a| a.channels.get(&ch).map(|p| (a.relay.clone(), *p)))
            };
            if let (Some((relay, peer)), true) = (target, 4 + len <= n) {
                let _ = relay.send_to(&pkt[4..4 + len], peer).await;
            }
            continue;
        }
        let Some(m) = parse(pkt) else { continue };
        if let Some(resp) = handle(&sock, &table, &m, from).await {
            let _ = sock.send_to(&resp, from).await;
        }
    }
}

async fn handle(sock: &Arc<UdpSocket>, table: &Table, m: &Msg<'_>, from: SocketAddr) -> Option<Vec<u8>> {
    let tid = m.tid;
    if m.method == BINDING && m.class == REQUEST {
        return Some(Out::new(BINDING, SUCCESS, &tid).addr(A_MAPPED, from).attr(A_SOFTWARE, b"KM Code Craft").buf);
    }
    if !enabled() {
        return None;
    }
    // Send-Indication: Daten an Gegenstelle (nur mit Erlaubnis)
    if m.method == SEND && m.class == INDICATION {
        let peer = m.attr(A_PEER).and_then(|v| read_xor_addr(v, &tid))?;
        let data = m.attr(A_DATA)?;
        let relay = {
            let t = table.lock().unwrap();
            let a = t.get(&from)?;
            a.perms.get(&peer.ip()).filter(|e| **e > Instant::now())?;
            a.relay.clone()
        };
        let _ = relay.send_to(data, peer).await;
        return None;
    }
    if m.class != REQUEST {
        return None;
    }
    let realm = realm();
    let unauthorized = |code: u16, reason: &str| {
        Out::error(m.method, &tid, code, reason).attr(A_REALM, realm.as_bytes()).attr(A_NONCE, NONCE.as_bytes()).buf
    };
    let (key, user) = match authenticate(m) {
        Ok(k) => k,
        Err((code, reason)) => return Some(unauthorized(code, reason)),
    };
    match m.method {
        ALLOCATE => {
            if table.lock().unwrap().contains_key(&from) {
                return Some(Out::error(ALLOCATE, &tid, 437, "Allocation Mismatch").sign(&key));
            }
            if m.attr(0x0019).map(|v| v.first() != Some(&17)).unwrap_or(true) {
                return Some(Out::error(ALLOCATE, &tid, 442, "Unsupported Transport Protocol").sign(&key));
            }
            let per_user = table.lock().unwrap().values().filter(|a| a.user == user).count();
            if per_user >= MAX_ALLOCATIONS_PER_USER {
                return Some(Out::error(ALLOCATE, &tid, 486, "Allocation Quota Reached").sign(&key));
            }
            let relay = match bind_relay().await {
                Ok(r) => Arc::new(r),
                Err(_) => return Some(Out::error(ALLOCATE, &tid, 508, "Insufficient Capacity").sign(&key)),
            };
            let relay_addr = SocketAddr::new(public_ip(), relay.local_addr().ok()?.port());
            let lifetime = lifetime(m);
            let task = tokio::spawn(relay_loop(relay.clone(), sock.clone(), table.clone(), from));
            table.lock().unwrap().insert(
                from,
                Allocation {
                    user,
                    key,
                    relay,
                    expires: Instant::now() + Duration::from_secs(lifetime as u64),
                    perms: HashMap::new(),
                    channels: HashMap::new(),
                    task,
                },
            );
            Some(
                Out::new(ALLOCATE, SUCCESS, &tid)
                    .addr(A_RELAYED, relay_addr)
                    .addr(A_MAPPED, from)
                    .attr(A_LIFETIME, &lifetime.to_be_bytes())
                    .attr(A_SOFTWARE, b"KM Code Craft")
                    .sign(&key),
            )
        }
        REFRESH => {
            let lt = lifetime(m);
            let mut t = table.lock().unwrap();
            match t.get_mut(&from) {
                Some(a) if a.key == key => {
                    if lt == 0 {
                        a.task.abort();
                        t.remove(&from);
                    } else {
                        a.expires = Instant::now() + Duration::from_secs(lt as u64);
                    }
                    Some(Out::new(REFRESH, SUCCESS, &tid).attr(A_LIFETIME, &lt.to_be_bytes()).sign(&key))
                }
                _ => Some(Out::error(REFRESH, &tid, 437, "Allocation Mismatch").sign(&key)),
            }
        }
        CREATE_PERMISSION => {
            let peers: Vec<SocketAddr> =
                m.attrs.iter().filter(|a| a.0 == A_PEER).filter_map(|a| read_xor_addr(a.1, &tid)).collect();
            let mut t = table.lock().unwrap();
            match t.get_mut(&from) {
                Some(a) if a.key == key && !peers.is_empty() => {
                    for p in peers {
                        a.perms.insert(p.ip(), Instant::now() + PERMISSION_TTL);
                    }
                    Some(Out::new(CREATE_PERMISSION, SUCCESS, &tid).sign(&key))
                }
                Some(_) => Some(Out::error(CREATE_PERMISSION, &tid, 400, "Bad Request").sign(&key)),
                None => Some(Out::error(CREATE_PERMISSION, &tid, 437, "Allocation Mismatch").sign(&key)),
            }
        }
        CHANNEL_BIND => {
            let ch = m.attr(A_CHANNEL).filter(|v| v.len() >= 2).map(|v| u16::from_be_bytes([v[0], v[1]]));
            let peer = m.attr(A_PEER).and_then(|v| read_xor_addr(v, &tid));
            let mut t = table.lock().unwrap();
            match (t.get_mut(&from), ch, peer) {
                (Some(a), Some(ch), Some(peer)) if a.key == key && (0x4000..0x8000).contains(&ch) => {
                    if a.channels.iter().any(|(c, p)| (*c == ch) != (*p == peer)) {
                        return Some(Out::error(CHANNEL_BIND, &tid, 400, "Bad Request").sign(&key));
                    }
                    a.channels.insert(ch, peer);
                    a.perms.insert(peer.ip(), Instant::now() + PERMISSION_TTL);
                    Some(Out::new(CHANNEL_BIND, SUCCESS, &tid).sign(&key))
                }
                (None, ..) => Some(Out::error(CHANNEL_BIND, &tid, 437, "Allocation Mismatch").sign(&key)),
                _ => Some(Out::error(CHANNEL_BIND, &tid, 400, "Bad Request").sign(&key)),
            }
        }
        _ => Some(Out::error(m.method, &tid, 400, "Bad Request").sign(&key)),
    }
}

fn lifetime(m: &Msg) -> u32 {
    m.attr(A_LIFETIME)
        .filter(|v| v.len() >= 4)
        .map(|v| u32::from_be_bytes([v[0], v[1], v[2], v[3]]))
        .map(|l| if l == 0 { 0 } else { l.clamp(60, MAX_LIFETIME) })
        .unwrap_or(DEFAULT_LIFETIME)
}

/// Pakete von Gegenstellen an den Client zurückreichen (Kanal oder Data-Indication)
async fn relay_loop(relay: Arc<UdpSocket>, sock: Arc<UdpSocket>, table: Table, client: SocketAddr) {
    let mut buf = vec![0u8; 65536];
    loop {
        let Ok((n, peer)) = relay.recv_from(&mut buf).await else { return };
        let out = {
            let t = table.lock().unwrap();
            let Some(a) = t.get(&client) else { return };
            if a.perms.get(&peer.ip()).is_none_or(|e| *e < Instant::now()) {
                continue;
            }
            match a.channels.iter().find(|(_, p)| **p == peer) {
                Some((ch, _)) => {
                    let mut v = Vec::with_capacity(4 + n + 3);
                    v.extend_from_slice(&ch.to_be_bytes());
                    v.extend_from_slice(&(n as u16).to_be_bytes());
                    v.extend_from_slice(&buf[..n]);
                    while v.len() % 4 != 0 {
                        v.push(0);
                    }
                    v
                }
                None => {
                    let tid: [u8; 12] = rand::random();
                    Out::new(DATA_IND, INDICATION, &tid).addr(A_PEER, peer).attr(A_DATA, &buf[..n]).buf
                }
            }
        };
        let _ = sock.send_to(&out, client).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimaler TURN-Client für den Test
    fn request(method: u16, tid: [u8; 12], attrs: &[(u16, Vec<u8>)], key: Option<&[u8]>) -> Vec<u8> {
        let mut o = Out::new(method, REQUEST, &tid);
        for (t, v) in attrs {
            o = o.attr(*t, v);
        }
        match key {
            Some(k) => o.sign(k),
            None => o.buf,
        }
    }

    #[tokio::test]
    async fn allocate_permission_and_relay() {
        let server = Arc::new(UdpSocket::bind("127.0.0.1:0").await.unwrap());
        let addr = server.local_addr().unwrap();
        tokio::spawn(run(server));
        let client = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let peer = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let mut buf = ();
        async fn recv(s: &UdpSocket, _: &mut ()) -> Vec<u8> {
            let mut b = vec![0u8; 2048];
            let n = tokio::time::timeout(Duration::from_secs(3), s.recv(&mut b))
                .await
                .expect("Zeitüberschreitung")
                .unwrap();
            b.truncate(n);
            b
        }

        // Binding
        client.send_to(&request(BINDING, [1; 12], &[], None), addr).await.unwrap();
        let r = recv(&client, &mut buf).await;
        let m = parse(&r).unwrap();
        assert_eq!((m.method, m.class), (BINDING, SUCCESS));
        assert_eq!(read_xor_addr(m.attr(A_MAPPED).unwrap(), &m.tid).unwrap(), client.local_addr().unwrap());

        // Allocate ohne Anmeldung → 401 mit Realm/Nonce
        let transport = (0x0019u16, vec![17, 0, 0, 0]);
        client.send_to(&request(ALLOCATE, [2; 12], std::slice::from_ref(&transport), None), addr).await.unwrap();
        let r = recv(&client, &mut buf).await;
        let m = parse(&r).unwrap();
        assert_eq!(m.class, ERROR);
        assert_eq!(m.attr(A_ERROR).unwrap()[2..4], [4, 1]);
        let nonce = m.text(A_NONCE).unwrap();

        // mit Zugangsdaten
        let (user, pw) = credentials(Uuid::now_v7());
        let key = long_term_key(&user, &realm(), &pw);
        let auth = vec![
            (A_USERNAME, user.clone().into_bytes()),
            (A_REALM, realm().into_bytes()),
            (A_NONCE, nonce.clone().into_bytes()),
        ];
        let mut attrs = vec![transport];
        attrs.extend(auth.clone());
        client.send_to(&request(ALLOCATE, [3; 12], &attrs, Some(&key)), addr).await.unwrap();
        let r = recv(&client, &mut buf).await;
        let m = parse(&r).unwrap();
        assert_eq!((m.method, m.class), (ALLOCATE, SUCCESS), "{:?}", m.attr(A_ERROR));
        let relayed = read_xor_addr(m.attr(A_RELAYED).unwrap(), &m.tid).unwrap();
        assert!(m.attr(A_INTEGRITY).is_some());

        // falsches Passwort
        let bad = long_term_key(&user, &realm(), "falsch");
        client.send_to(&request(REFRESH, [4; 12], &auth, Some(&bad)), addr).await.unwrap();
        assert_eq!(parse(&recv(&client, &mut buf).await).unwrap().class, ERROR);

        // Ohne Erlaubnis kommt nichts durch
        peer.send_to(b"vorher", SocketAddr::new(Ipv4Addr::LOCALHOST.into(), relayed.port())).await.unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Erlaubnis für die Gegenstelle, dann Kanal binden
        let p = peer.local_addr().unwrap();
        let mut attrs = vec![(A_PEER, xor_addr(p, &[5; 12]))];
        attrs.extend(auth.clone());
        client.send_to(&request(CREATE_PERMISSION, [5; 12], &attrs, Some(&key)), addr).await.unwrap();
        assert_eq!(parse(&recv(&client, &mut buf).await).unwrap().class, SUCCESS);

        // Gegenstelle → Relay → Client (Data-Indication)
        peer.send_to(b"hallo client", SocketAddr::new(Ipv4Addr::LOCALHOST.into(), relayed.port())).await.unwrap();
        let r = recv(&client, &mut buf).await;
        let m = parse(&r).unwrap();
        assert_eq!((m.method, m.class), (DATA_IND, INDICATION));
        assert_eq!(m.attr(A_DATA).unwrap(), b"hallo client");

        // Client → Relay → Gegenstelle (Send-Indication)
        let mut o = Out::new(SEND, INDICATION, &[6; 12]).addr(A_PEER, p);
        o = o.attr(A_DATA, b"hallo peer");
        client.send_to(&o.buf, addr).await.unwrap();
        let r = recv(&peer, &mut buf).await;
        assert_eq!(r, b"hallo peer");

        // Kanal 0x4001
        let mut attrs = vec![(A_CHANNEL, vec![0x40, 0x01, 0, 0]), (A_PEER, xor_addr(p, &[7; 12]))];
        attrs.extend(auth);
        client.send_to(&request(CHANNEL_BIND, [7; 12], &attrs, Some(&key)), addr).await.unwrap();
        assert_eq!(parse(&recv(&client, &mut buf).await).unwrap().class, SUCCESS);
        client.send_to(&[0x40, 0x01, 0, 3, b'a', b'b', b'c', 0], addr).await.unwrap();
        assert_eq!(recv(&peer, &mut buf).await, b"abc");
        peer.send_to(b"xyz", SocketAddr::new(Ipv4Addr::LOCALHOST.into(), relayed.port())).await.unwrap();
        assert_eq!(recv(&client, &mut buf).await, [0x40, 0x01, 0, 3, b'x', b'y', b'z', 0]);
    }
}
