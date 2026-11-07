//! Eigener STUN-Server (RFC 5389, nur „Binding“).
//!
//! Browser fragen per UDP „Wie sieht meine öffentliche Adresse aus?“ – die Antwort
//! (XOR-MAPPED-ADDRESS) brauchen sie, um Anrufe über Router/NAT hinweg aufzubauen.
//! Kein Fremddienst nötig. Ein TURN-Relay für strenge Firewalls folgt in Stufe 3.

use std::net::{IpAddr, SocketAddr};
use tokio::net::UdpSocket;

const MAGIC: u32 = 0x2112_A442;
const BINDING_REQUEST: u16 = 0x0001;
const BINDING_SUCCESS: u16 = 0x0101;
const ATTR_XOR_MAPPED: u16 = 0x0020;
const ATTR_SOFTWARE: u16 = 0x8022;

/// Antwort auf eine Binding-Anfrage bauen; `None`, wenn es keine gültige Anfrage ist.
pub fn respond(req: &[u8], from: SocketAddr) -> Option<Vec<u8>> {
    if req.len() < 20 || req[0] & 0xC0 != 0 {
        return None;
    }
    let msg_type = u16::from_be_bytes([req[0], req[1]]);
    let magic = u32::from_be_bytes([req[4], req[5], req[6], req[7]]);
    if msg_type != BINDING_REQUEST || magic != MAGIC {
        return None;
    }
    let tid = &req[8..20];

    // XOR-MAPPED-ADDRESS
    let mut attr = Vec::with_capacity(24);
    let port = from.port() ^ (MAGIC >> 16) as u16;
    match from.ip() {
        IpAddr::V4(ip) => {
            attr.extend_from_slice(&[0, 0x01]);
            attr.extend_from_slice(&port.to_be_bytes());
            let x = u32::from(ip) ^ MAGIC;
            attr.extend_from_slice(&x.to_be_bytes());
        }
        IpAddr::V6(ip) => {
            attr.extend_from_slice(&[0, 0x02]);
            attr.extend_from_slice(&port.to_be_bytes());
            let mut key = [0u8; 16];
            key[..4].copy_from_slice(&MAGIC.to_be_bytes());
            key[4..].copy_from_slice(tid);
            for (b, k) in ip.octets().iter().zip(key) {
                attr.push(b ^ k);
            }
        }
    }
    let software = b"KM Code Craft";
    let mut body = Vec::new();
    push_attr(&mut body, ATTR_XOR_MAPPED, &attr);
    push_attr(&mut body, ATTR_SOFTWARE, software);

    let mut out = Vec::with_capacity(20 + body.len());
    out.extend_from_slice(&BINDING_SUCCESS.to_be_bytes());
    out.extend_from_slice(&(body.len() as u16).to_be_bytes());
    out.extend_from_slice(&MAGIC.to_be_bytes());
    out.extend_from_slice(tid);
    out.extend_from_slice(&body);
    Some(out)
}

fn push_attr(buf: &mut Vec<u8>, t: u16, v: &[u8]) {
    buf.extend_from_slice(&t.to_be_bytes());
    buf.extend_from_slice(&(v.len() as u16).to_be_bytes());
    buf.extend_from_slice(v);
    while buf.len() % 4 != 0 {
        buf.push(0); // Attribute sind auf 4 Byte ausgerichtet
    }
}

/// Läuft dauerhaft; Fehler beim Binden werden geloggt (Port belegt o. Ä.).
pub async fn serve(bind: String) {
    let sock = match UdpSocket::bind(&bind).await {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("STUN-Server nicht gestartet ({bind}): {e}");
            return;
        }
    };
    tracing::info!("STUN-Server lauscht auf udp://{bind}");
    let mut buf = [0u8; 1500];
    loop {
        let Ok((n, from)) = sock.recv_from(&mut buf).await else { continue };
        if let Some(resp) = respond(&buf[..n], from) {
            let _ = sock.send_to(&resp, from).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> Vec<u8> {
        let mut r = vec![0x00, 0x01, 0x00, 0x00];
        r.extend_from_slice(&MAGIC.to_be_bytes());
        r.extend_from_slice(&[7u8; 12]);
        r
    }

    #[test]
    fn answers_binding_with_xor_address() {
        let from: SocketAddr = "203.0.113.5:54321".parse().unwrap();
        let resp = respond(&request(), from).unwrap();
        assert_eq!(u16::from_be_bytes([resp[0], resp[1]]), BINDING_SUCCESS);
        assert_eq!(&resp[8..20], &[7u8; 12]);
        // erstes Attribut: XOR-MAPPED-ADDRESS
        assert_eq!(u16::from_be_bytes([resp[20], resp[21]]), ATTR_XOR_MAPPED);
        let port = u16::from_be_bytes([resp[26], resp[27]]) ^ (MAGIC >> 16) as u16;
        let ip = u32::from_be_bytes([resp[28], resp[29], resp[30], resp[31]]) ^ MAGIC;
        assert_eq!(port, 54321);
        assert_eq!(std::net::Ipv4Addr::from(ip).to_string(), "203.0.113.5");
        assert_eq!(resp.len() % 4, 0);
    }

    #[test]
    fn ignores_garbage() {
        assert!(respond(b"hello", "1.2.3.4:5".parse().unwrap()).is_none());
        let mut r = request();
        r[4] = 0; // falscher Magic Cookie
        assert!(respond(&r, "1.2.3.4:5".parse().unwrap()).is_none());
    }
}
