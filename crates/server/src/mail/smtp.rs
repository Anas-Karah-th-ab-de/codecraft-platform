//! SMTP-Server (RFC 5321): Empfang fremder Post (MX, Port 25) und Einlieferung
//! eigener Post durch Mail-Programme (Port 587 mit STARTTLS bzw. 465 mit TLS, nur mit Anmeldung).

use super::tls::{self, Stream};
use super::{bare_address, domain_of, hostname, MailUser, MAX_SIZE};
use base64::Engine;
use mail_auth::{AuthenticatedMessage, AuthenticationResults, DmarcResult, MessageAuthenticator};
use sqlx::PgPool;
use std::net::{IpAddr, SocketAddr};
use std::sync::OnceLock;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::time::timeout;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Mode {
    /// Port 25: nimmt nur Post für eigene Adressen an, prüft SPF/DKIM/DMARC
    Mx,
    /// Port 587: Anmeldung Pflicht, STARTTLS
    Submission,
    /// Port 465: wie Submission, aber TLS ab der ersten Zeile
    SubmissionTls,
}

const CMD_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_RCPTS: usize = 100;

pub async fn serve(db: PgPool, bind: String, mode: Mode) {
    match TcpListener::bind(&bind).await {
        Ok(l) => {
            tracing::info!("SMTP ({mode:?}) lauscht auf {bind}");
            run(db, l, mode).await
        }
        Err(e) => tracing::error!("SMTP {mode:?} auf {bind} nicht möglich: {e}"),
    }
}

pub async fn run(db: PgPool, listener: TcpListener, mode: Mode) {
    loop {
        let Ok((sock, peer)) = listener.accept().await else { continue };
        let db = db.clone();
        tokio::spawn(async move {
            let stream = if mode == Mode::SubmissionTls {
                let Some(acc) = tls::acceptor() else { return };
                match acc.accept(sock).await {
                    Ok(t) => Stream::Tls(Box::new(t)),
                    Err(_) => return,
                }
            } else {
                Stream::Plain(sock)
            };
            if let Err(e) = session(db, stream, peer, mode).await {
                tracing::debug!("SMTP {peer}: {e}");
            }
        });
    }
}

fn authenticator() -> Option<&'static MessageAuthenticator> {
    static A: OnceLock<Option<MessageAuthenticator>> = OnceLock::new();
    A.get_or_init(|| MessageAuthenticator::new_system_conf().ok()).as_ref()
}

struct Envelope {
    from: Option<String>,
    rcpts: Vec<String>,
}

async fn session(db: PgPool, stream: Stream, peer: SocketAddr, mode: Mode) -> std::io::Result<()> {
    let host = hostname();
    let mut io = BufReader::new(stream);
    let mut helo = String::new();
    let mut user: Option<MailUser> = None;
    let mut env = Envelope { from: None, rcpts: vec![] };
    let mut bad = 0u32;
    reply(&mut io, &format!("220 {host} ESMTP KM Code Craft")).await?;
    loop {
        let Some(line) = read_line(&mut io, 4096).await? else { return Ok(()) };
        let line = String::from_utf8_lossy(&line).trim_end().to_string();
        let (verb, arg) = line
            .split_once(' ')
            .map(|(a, b)| (a.to_uppercase(), b.trim().to_string()))
            .unwrap_or((line.to_uppercase(), String::new()));
        let tls_on = io.get_ref().is_tls();
        let auth_ok = mode != Mode::Mx && (tls_on || tls::plain_auth_allowed());
        match verb.as_str() {
            "EHLO" | "HELO" => {
                helo = arg.clone();
                env = Envelope { from: None, rcpts: vec![] };
                if verb == "HELO" {
                    reply(&mut io, &format!("250 {host}")).await?;
                    continue;
                }
                let mut caps = vec![
                    host.clone(),
                    "PIPELINING".into(),
                    format!("SIZE {MAX_SIZE}"),
                    "8BITMIME".into(),
                    "SMTPUTF8".into(),
                    "ENHANCEDSTATUSCODES".into(),
                ];
                if !tls_on && tls::acceptor().is_some() {
                    caps.push("STARTTLS".into());
                }
                if auth_ok {
                    caps.push("AUTH PLAIN LOGIN".into());
                }
                let n = caps.len();
                let text: String = caps
                    .iter()
                    .enumerate()
                    .map(|(i, c)| format!("250{}{c}\r\n", if i + 1 == n { ' ' } else { '-' }))
                    .collect();
                io.get_mut().write_all(text.as_bytes()).await?;
                io.get_mut().flush().await?;
            }
            "STARTTLS" => match tls::acceptor() {
                Some(acc) if !tls_on => {
                    reply(&mut io, "220 2.0.0 TLS starten").await?;
                    let s = io.into_inner().upgrade(&acc).await?;
                    io = BufReader::new(s);
                    helo.clear();
                    env = Envelope { from: None, rcpts: vec![] };
                }
                _ => reply(&mut io, "454 4.7.0 TLS nicht verfügbar").await?,
            },
            "AUTH" if auth_ok && user.is_none() => {
                let mut parts = arg.splitn(2, ' ');
                let mech = parts.next().unwrap_or("").to_uppercase();
                let initial = parts.next().map(str::to_string);
                let creds = match mech.as_str() {
                    "PLAIN" => {
                        let b64 = match initial {
                            Some(i) => i,
                            None => {
                                reply(&mut io, "334 ").await?;
                                read_text(&mut io).await?
                            }
                        };
                        decode(&b64).and_then(|d| {
                            let mut f = d.split(|b| *b == 0);
                            let _authz = f.next()?;
                            Some((
                                String::from_utf8(f.next()?.to_vec()).ok()?,
                                String::from_utf8(f.next()?.to_vec()).ok()?,
                            ))
                        })
                    }
                    "LOGIN" => {
                        let u = match initial {
                            Some(i) => i,
                            None => {
                                reply(&mut io, "334 VXNlcm5hbWU6").await?;
                                read_text(&mut io).await?
                            }
                        };
                        reply(&mut io, "334 UGFzc3dvcmQ6").await?;
                        let p = read_text(&mut io).await?;
                        decode(&u)
                            .zip(decode(&p))
                            .and_then(|(u, p)| Some((String::from_utf8(u).ok()?, String::from_utf8(p).ok()?)))
                    }
                    _ => {
                        reply(&mut io, "504 5.5.4 Verfahren nicht unterstützt").await?;
                        continue;
                    }
                };
                match creds {
                    Some((l, p)) => match super::authenticate(&db, &l, &p).await {
                        Some(u) => {
                            user = Some(u);
                            reply(&mut io, "235 2.7.0 Angemeldet").await?;
                        }
                        None => {
                            bad += 1;
                            tokio::time::sleep(Duration::from_secs(2)).await;
                            reply(&mut io, "535 5.7.8 Anmeldung fehlgeschlagen").await?;
                        }
                    },
                    None => reply(&mut io, "501 5.5.2 Ungültige Daten").await?,
                }
            }
            "AUTH" => reply(&mut io, "503 5.5.1 Anmeldung hier nicht möglich").await?,
            "MAIL" => {
                if helo.is_empty() {
                    reply(&mut io, "503 5.5.1 Bitte zuerst EHLO").await?;
                } else if mode != Mode::Mx && user.is_none() {
                    reply(&mut io, "530 5.7.0 Anmeldung erforderlich").await?;
                } else if let Some(addr) = path_arg(&arg, "FROM:") {
                    let size: usize = arg
                        .split_whitespace()
                        .find_map(|p| p.to_uppercase().strip_prefix("SIZE=").and_then(|v| v.parse().ok()))
                        .unwrap_or(0);
                    if size > MAX_SIZE {
                        reply(&mut io, "552 5.3.4 Nachricht zu groß").await?;
                    } else {
                        env = Envelope { from: Some(addr), rcpts: vec![] };
                        reply(&mut io, "250 2.1.0 OK").await?;
                    }
                } else {
                    reply(&mut io, "501 5.5.4 Syntax: MAIL FROM:<adresse>").await?;
                }
            }
            "RCPT" => {
                let Some(addr) = path_arg(&arg, "TO:").filter(|a| a.contains('@')) else {
                    reply(&mut io, "501 5.5.4 Syntax: RCPT TO:<adresse>").await?;
                    continue;
                };
                if env.from.is_none() {
                    reply(&mut io, "503 5.5.1 Bitte zuerst MAIL").await?;
                } else if env.rcpts.len() >= MAX_RCPTS {
                    reply(&mut io, "452 4.5.3 Zu viele Empfänger").await?;
                } else if mode == Mode::Mx {
                    match super::resolve_local(&db, &addr).await {
                        Ok(Some(_)) => {
                            env.rcpts.push(addr);
                            reply(&mut io, "250 2.1.5 OK").await?;
                        }
                        Ok(None) => {
                            bad += 1;
                            reply(&mut io, "550 5.1.1 Unbekannter Empfänger").await?;
                        }
                        Err(_) => reply(&mut io, "451 4.3.0 Vorübergehender Fehler").await?,
                    }
                } else {
                    env.rcpts.push(addr);
                    reply(&mut io, "250 2.1.5 OK").await?;
                }
            }
            "DATA" => {
                if env.rcpts.is_empty() {
                    reply(&mut io, "503 5.5.1 Keine Empfänger").await?;
                    continue;
                }
                reply(&mut io, "354 Nachricht senden, Ende mit <CRLF>.<CRLF>").await?;
                let Some(body) = read_data(&mut io).await? else {
                    reply(&mut io, "552 5.3.4 Nachricht zu groß").await?;
                    env = Envelope { from: None, rcpts: vec![] };
                    continue;
                };
                let answer = match mode {
                    Mode::Mx => accept_inbound(&db, &env, &body, peer.ip(), &helo, tls_on).await,
                    _ => {
                        accept_submission(&db, user.as_ref().expect("angemeldet"), &env, &body, peer.ip(), &helo).await
                    }
                };
                reply(&mut io, &answer).await?;
                env = Envelope { from: None, rcpts: vec![] };
            }
            "RSET" => {
                env = Envelope { from: None, rcpts: vec![] };
                reply(&mut io, "250 2.0.0 OK").await?;
            }
            "NOOP" => reply(&mut io, "250 2.0.0 OK").await?,
            "VRFY" => reply(&mut io, "252 2.5.0 Wird nicht geprüft").await?,
            "QUIT" => {
                reply(&mut io, "221 2.0.0 Auf Wiedersehen").await?;
                return Ok(());
            }
            _ => {
                bad += 1;
                reply(&mut io, "500 5.5.2 Unbekannter Befehl").await?;
            }
        }
        if bad >= 10 {
            reply(&mut io, "421 4.7.0 Zu viele Fehler").await?;
            return Ok(());
        }
    }
}

/// `FROM:<a@b> SIZE=1` → `a@b` (leerer Absender `<>` → "")
fn path_arg(arg: &str, prefix: &str) -> Option<String> {
    let up = arg.to_uppercase();
    if !up.starts_with(prefix) {
        return None;
    }
    let rest = arg[prefix.len()..].trim_start();
    let end = rest.find('>').map(|i| i + 1).unwrap_or_else(|| rest.find(' ').unwrap_or(rest.len()));
    Some(bare_address(&rest[..end]))
}

fn decode(s: &str) -> Option<Vec<u8>> {
    base64::engine::general_purpose::STANDARD.decode(s.trim()).ok()
}

async fn reply(io: &mut BufReader<Stream>, text: &str) -> std::io::Result<()> {
    let w = io.get_mut();
    w.write_all(text.as_bytes()).await?;
    w.write_all(b"\r\n").await?;
    w.flush().await
}

/// Eine Zeile (inkl. Zeilenende) mit Zeitlimit; None = Verbindung zu
async fn read_line(io: &mut BufReader<Stream>, max: usize) -> std::io::Result<Option<Vec<u8>>> {
    let mut buf = Vec::new();
    let n = timeout(CMD_TIMEOUT, (&mut *io).take(max as u64).read_until(b'\n', &mut buf))
        .await
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "Zeitüberschreitung"))??;
    Ok((n > 0).then_some(buf))
}

async fn read_text(io: &mut BufReader<Stream>) -> std::io::Result<String> {
    Ok(read_line(io, 4096).await?.map(|l| String::from_utf8_lossy(&l).trim().to_string()).unwrap_or_default())
}

/// DATA-Block lesen, Punkt-Maskierung entfernen. None = zu groß (Rest wird verworfen).
async fn read_data(io: &mut BufReader<Stream>) -> std::io::Result<Option<Vec<u8>>> {
    let mut out = Vec::new();
    let mut too_big = false;
    loop {
        let Some(line) = read_line(io, 1 << 20).await? else {
            return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "DATA abgebrochen"));
        };
        if line == b".\r\n" || line == b".\n" {
            break;
        }
        let line = if line.starts_with(b"..") { &line[1..] } else { &line[..] };
        if out.len() + line.len() > MAX_SIZE {
            too_big = true;
        }
        if !too_big {
            // Zeilenenden auf CRLF vereinheitlichen
            if line.ends_with(b"\r\n") {
                out.extend_from_slice(line);
            } else if line.ends_with(b"\n") {
                out.extend_from_slice(&line[..line.len() - 1]);
                out.extend_from_slice(b"\r\n");
            } else {
                out.extend_from_slice(line);
            }
        }
    }
    Ok((!too_big).then_some(out))
}

fn received(helo: &str, ip: IpAddr, with: &str, rcpt: &str) -> String {
    format!(
        "Received: from {helo} ([{ip}])\r\n\tby {} with {with}\r\n\tfor <{rcpt}>; {}\r\n",
        hostname(),
        chrono::Utc::now().to_rfc2822()
    )
}

/// Fremde Post annehmen: SPF/DKIM/DMARC prüfen, ggf. in „Spam“ ablegen oder abweisen.
async fn accept_inbound(db: &PgPool, env: &Envelope, body: &[u8], ip: IpAddr, helo: &str, tls_on: bool) -> String {
    let mail_from = env.from.clone().unwrap_or_default();
    let mut auth_header = String::new();
    let mut junk = false;
    if !ip.is_loopback() {
        if let (Some(a), Some(msg)) = (authenticator(), AuthenticatedMessage::parse(body)) {
            let host = hostname();
            let from_dom = if mail_from.is_empty() { helo.to_string() } else { domain_of(&mail_from).to_string() };
            let dkim = a.verify_dkim(&msg).await;
            let spf_params = mail_auth::spf::verify::SpfParameters::mail_from(ip, helo, &host, &mail_from);
            let spf = a.verify_spf(spf_params).await;
            let dmarc =
                a.verify_dmarc(mail_auth::dmarc::verify::DmarcParameters::new(&msg, &dkim, &from_dom, &spf)).await;
            let failed = dmarc.dkim_result() != &DmarcResult::Pass && dmarc.spf_result() != &DmarcResult::Pass;
            let failed = failed && !matches!(dmarc.dkim_result(), DmarcResult::None);
            if failed {
                match dmarc.policy() {
                    mail_auth::dmarc::Policy::Reject => {
                        return "550 5.7.1 Von DMARC-Richtlinie des Absenders abgelehnt".into()
                    }
                    mail_auth::dmarc::Policy::Quarantine => junk = true,
                    _ => {}
                }
            }
            auth_header = AuthenticationResults::new(&host)
                .with_dkim_results(&dkim, msg.first_from_address())
                .with_spf_result(&spf, &spf_params)
                .with_dmarc_result(&dmarc)
                .to_string();
        }
    }
    let with = if tls_on { "ESMTPS" } else { "ESMTP" };
    let mut failed = 0;
    for r in &env.rcpts {
        let raw = [received(helo, ip, with, r).into_bytes(), auth_header.clone().into_bytes(), body.to_vec()].concat();
        match super::deliver_local(db, r, &raw, Some(auth_header.trim()).filter(|s| !s.is_empty()), junk).await {
            Ok(super::Local::Delivered) => {}
            Ok(super::Local::OverQuota) => return "452 4.2.2 Postfach voll".into(),
            _ => failed += 1,
        }
    }
    if failed == env.rcpts.len() {
        "451 4.3.0 Zustellung vorübergehend nicht möglich".into()
    } else {
        "250 2.0.0 Angenommen".into()
    }
}

/// Eigene Post aus einem Mail-Programm: Absender muss zum angemeldeten Postfach gehören.
async fn accept_submission(
    db: &PgPool,
    user: &MailUser,
    env: &Envelope,
    body: &[u8],
    ip: IpAddr,
    helo: &str,
) -> String {
    let header_from = super::meta(body).from_addr;
    let allowed: Vec<String> = sqlx::query_scalar("SELECT address FROM mail_aliases WHERE mailbox_id = $1")
        .bind(user.mailbox_id)
        .fetch_all(db)
        .await
        .unwrap_or_default();
    let own = |a: &str| a == user.address || allowed.iter().any(|x| x == a);
    let env_from = env.from.clone().unwrap_or_default();
    if !own(&header_from) || !(env_from.is_empty() || own(&env_from)) {
        return format!("553 5.7.1 Absender muss {} sein", user.address);
    }
    let mut raw = format!(
        "Received: from {helo} ([{ip}])\r\n\tby {} with ESMTPSA; {}\r\n",
        hostname(),
        chrono::Utc::now().to_rfc2822()
    )
    .into_bytes();
    raw.extend_from_slice(body);
    match super::submit(db, user, &env.rcpts, &raw, false).await {
        Ok(_) => "250 2.0.0 Zur Zustellung angenommen".into(),
        Err(_) => "451 4.3.0 Vorübergehender Fehler".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::path_arg;

    #[test]
    fn paths() {
        assert_eq!(path_arg("FROM:<Jana@X.de> SIZE=12", "FROM:").as_deref(), Some("jana@x.de"));
        assert_eq!(path_arg("from: <>", "FROM:").as_deref(), Some(""));
        assert_eq!(path_arg("TO:<a@b.c>", "TO:").as_deref(), Some("a@b.c"));
        assert_eq!(path_arg("XYZ", "TO:"), None);
    }
}
