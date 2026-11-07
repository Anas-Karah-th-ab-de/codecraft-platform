//! Ausgehende Post: Warteschlange in Postgres, Zustellung per SMTP an den MX der Empfänger-Domain
//! (STARTTLS wenn angeboten), Wiederholungen mit wachsendem Abstand, Rückmeldung bei Fehlschlag.

use super::hostname;
use sqlx::PgPool;
use std::sync::{Arc, LazyLock, OnceLock};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::Notify;
use tokio::time::timeout;
use tokio_rustls::rustls;
use uuid::Uuid;

static WAKE: LazyLock<Notify> = LazyLock::new(Notify::new);

/// Versand sofort anstoßen (statt auf den nächsten Takt zu warten)
pub fn wake() {
    WAKE.notify_one();
}

/// Wartezeit vor dem n-ten Wiederholungsversuch
fn backoff(attempts: i32) -> Duration {
    const STEPS: [u64; 8] = [5, 15, 30, 60, 120, 240, 480, 720];
    Duration::from_secs(60 * STEPS[(attempts.max(1) as usize - 1).min(STEPS.len() - 1)])
}
/// Nach dieser Zeit wird endgültig aufgegeben
const GIVE_UP: chrono::TimeDelta = chrono::TimeDelta::days(3);

pub async fn worker(db: PgPool) {
    let _ = sqlx::query("UPDATE mail_queue SET status = 'queued' WHERE status = 'sending'").execute(&db).await;
    loop {
        if let Err(e) = run_once(&db).await {
            tracing::warn!("Mail-Versand: {e}");
        }
        let _ = timeout(Duration::from_secs(30), WAKE.notified()).await;
    }
}

type Job = (Uuid, Option<Uuid>, String, String, Vec<String>, Vec<u8>, i32, chrono::DateTime<chrono::Utc>);

pub async fn run_once(db: &PgPool) -> Result<(), sqlx::Error> {
    let jobs: Vec<Job> = sqlx::query_as(
        "UPDATE mail_queue SET status = 'sending'
          WHERE id IN (SELECT id FROM mail_queue WHERE status = 'queued' AND next_attempt_at <= now()
                        ORDER BY next_attempt_at LIMIT 20 FOR UPDATE SKIP LOCKED)
          RETURNING id, mailbox_id, mail_from, rcpt_domain, rcpts, raw, attempts, created_at",
    )
    .fetch_all(db)
    .await?;
    let tasks: Vec<_> = jobs
        .into_iter()
        .map(|job| {
            let db = db.clone();
            tokio::spawn(async move { process(&db, job).await })
        })
        .collect();
    for t in tasks {
        let _ = t.await;
    }
    Ok(())
}

async fn process(
    db: &PgPool,
    (id, mailbox, from, domain, rcpts, raw, attempts, created): Job,
) -> Result<(), sqlx::Error> {
    let res = deliver(&domain, &from, &rcpts, &raw).await;
    let temp: Vec<String> = res.iter().filter(|r| r.1 == Outcome::Temporary).map(|r| r.0.clone()).collect();
    for (rcpt, outcome, msg) in &res {
        if *outcome == Outcome::Permanent {
            if let Some(mb) = mailbox {
                bounce(db, mb, rcpt, msg).await?;
            }
        }
    }
    let last_error = res
        .iter()
        .filter(|r| r.1 != Outcome::Delivered)
        .map(|r| format!("{}: {}", r.0, r.2))
        .collect::<Vec<_>>()
        .join("; ");
    if temp.is_empty() {
        let all_failed = res.iter().all(|r| r.1 != Outcome::Delivered);
        sqlx::query("UPDATE mail_queue SET status = $2, sent_at = now(), attempts = attempts + 1, last_error = NULLIF($3, '') WHERE id = $1")
            .bind(id)
            .bind(if all_failed { "failed" } else { "sent" })
            .bind(&last_error)
            .execute(db)
            .await?;
    } else if chrono::Utc::now() - created > GIVE_UP {
        for r in &temp {
            if let Some(mb) = mailbox {
                bounce(db, mb, r, &format!("Seit 3 Tagen nicht zustellbar ({last_error})")).await?;
            }
        }
        sqlx::query("UPDATE mail_queue SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE id = $1")
            .bind(id)
            .bind(&last_error)
            .execute(db)
            .await?;
    } else {
        let wait = backoff(attempts + 1);
        sqlx::query(
            "UPDATE mail_queue SET status = 'queued', attempts = attempts + 1, rcpts = $2, last_error = $3,
                    next_attempt_at = now() + make_interval(secs => $4) WHERE id = $1",
        )
        .bind(id)
        .bind(&temp)
        .bind(&last_error)
        .bind(wait.as_secs_f64())
        .execute(db)
        .await?;
    }
    Ok(())
}

/// Unzustellbarkeits-Nachricht ins Postfach des Absenders legen
pub async fn bounce(db: &PgPool, mailbox_id: Uuid, rcpt: &str, reason: &str) -> Result<(), sqlx::Error> {
    let host = hostname();
    let raw = format!(
        "From: Mail-System <mailer-daemon@{host}>\r\nSubject: Unzustellbar: {rcpt}\r\nDate: {}\r\nMessage-ID: <{}@{host}>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\nIhre Nachricht konnte nicht an {rcpt} zugestellt werden.\r\n\r\nGrund: {reason}\r\n",
        chrono::Utc::now().to_rfc2822(),
        Uuid::now_v7()
    );
    super::store(db, mailbox_id, "inbox", raw.as_bytes(), None, false).await?;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Delivered,
    Temporary,
    Permanent,
}

fn tls_connector() -> tokio_rustls::TlsConnector {
    static C: OnceLock<tokio_rustls::TlsConnector> = OnceLock::new();
    C.get_or_init(|| {
        let roots = rustls::RootCertStore { roots: webpki_roots::TLS_SERVER_ROOTS.to_vec() };
        let cfg = rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .expect("TLS-Versionen")
            .with_root_certificates(roots)
            .with_no_client_auth();
        tokio_rustls::TlsConnector::from(Arc::new(cfg))
    })
    .clone()
}

/// Zielserver: MAIL_RELAY (host:port) oder MX-Einträge (nach Vorrang), sonst die Domain selbst
async fn targets(domain: &str) -> Vec<(String, u16)> {
    if let Ok(relay) = std::env::var("MAIL_RELAY") {
        let (h, p) = relay.rsplit_once(':').unwrap_or((&relay, "25"));
        return vec![(h.to_string(), p.parse().unwrap_or(25))];
    }
    let mut hosts = vec![];
    if let Ok(a) = mail_auth::MessageAuthenticator::new_system_conf() {
        if let Ok(mx) = a.mx_lookup(domain, None::<&mail_auth::dns::NoCache>).await {
            let mut list: Vec<_> = mx.records.iter().collect();
            list.sort_by_key(|m| m.preference);
            for m in list {
                for h in m.exchanges.iter() {
                    hosts.push((h.trim_end_matches('.').to_string(), 25));
                }
            }
        }
    }
    if hosts.is_empty() {
        hosts.push((domain.to_string(), 25));
    }
    hosts
}

/// Zustellung an alle Empfänger einer Domain: (Empfänger, Ergebnis, Meldung)
pub async fn deliver(domain: &str, from: &str, rcpts: &[String], raw: &[u8]) -> Vec<(String, Outcome, String)> {
    let mut last = String::from("kein Zielserver erreichbar");
    let hosts = targets(domain).await;
    // Null-MX (RFC 7505): Domain nimmt grundsätzlich keine Post an
    if hosts.iter().all(|(h, _)| h.is_empty() || h == ".") {
        return rcpts
            .iter()
            .map(|r| (r.clone(), Outcome::Permanent, "Domain nimmt keine E-Mails an (Null-MX)".into()))
            .collect();
    }
    for (host, port) in hosts.into_iter().filter(|(h, _)| !h.is_empty()) {
        match deliver_to(&host, port, from, rcpts, raw).await {
            Ok(r) => return r,
            Err(e) => last = format!("{host}: {e}"),
        }
    }
    rcpts.iter().map(|r| (r.clone(), Outcome::Temporary, last.clone())).collect()
}

/// Zustellung an einen bestimmten Server
pub async fn deliver_to(
    host: &str,
    port: u16,
    from: &str,
    rcpts: &[String],
    raw: &[u8],
) -> Res<Vec<(String, Outcome, String)>> {
    let sock = timeout(Duration::from_secs(30), TcpStream::connect((host, port)))
        .await
        .map_err(|_| "Zeitüberschreitung")??;
    session(sock, host, from, rcpts, raw).await
}

type Res<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

async fn session(
    sock: TcpStream,
    host: &str,
    from: &str,
    rcpts: &[String],
    raw: &[u8],
) -> Res<Vec<(String, Outcome, String)>> {
    let mut io = BufReader::new(sock);
    expect(&mut io, 220).await?;
    let caps = cmd(&mut io, &format!("EHLO {}", hostname())).await?;
    if caps.0 != 250 {
        return Err(format!("EHLO: {}", caps.1).into());
    }
    if caps.1.to_uppercase().contains("STARTTLS") {
        let r = cmd(&mut io, "STARTTLS").await?;
        if r.0 == 220 {
            let name = rustls::pki_types::ServerName::try_from(host.to_string())?;
            let tls = tls_connector().connect(name, io.into_inner()).await?;
            let mut io = BufReader::new(tls);
            cmd(&mut io, &format!("EHLO {}", hostname())).await?;
            return transaction(&mut io, from, rcpts, raw).await;
        }
    }
    transaction(&mut io, from, rcpts, raw).await
}

async fn transaction<S: AsyncRead + AsyncWrite + Unpin>(
    io: &mut BufReader<S>,
    from: &str,
    rcpts: &[String],
    raw: &[u8],
) -> Res<Vec<(String, Outcome, String)>> {
    let classify = |code: u16| match code {
        200..=299 => Outcome::Delivered,
        500..=599 => Outcome::Permanent,
        _ => Outcome::Temporary,
    };
    let r = cmd(io, &format!("MAIL FROM:<{from}> SIZE={}", raw.len())).await?;
    if r.0 != 250 {
        return Ok(rcpts.iter().map(|x| (x.clone(), classify(r.0), r.1.clone())).collect());
    }
    let mut out = vec![];
    let mut accepted = vec![];
    for rc in rcpts {
        let r = cmd(io, &format!("RCPT TO:<{rc}>")).await?;
        if classify(r.0) == Outcome::Delivered {
            accepted.push(rc.clone());
        } else {
            out.push((rc.clone(), classify(r.0), r.1));
        }
    }
    if accepted.is_empty() {
        let _ = cmd(io, "QUIT").await;
        return Ok(out);
    }
    let r = cmd(io, "DATA").await?;
    if r.0 != 354 {
        out.extend(accepted.iter().map(|x| (x.clone(), classify(r.0), r.1.clone())));
        return Ok(out);
    }
    let w = io.get_mut();
    for line in raw.split_inclusive(|b| *b == b'\n') {
        if line.starts_with(b".") {
            w.write_all(b".").await?;
        }
        w.write_all(line).await?;
    }
    if !raw.ends_with(b"\r\n") {
        w.write_all(b"\r\n").await?;
    }
    w.write_all(b".\r\n").await?;
    w.flush().await?;
    let r = read_reply(io).await?;
    out.extend(accepted.iter().map(|x| (x.clone(), classify(r.0), r.1.clone())));
    let _ = cmd(io, "QUIT").await;
    Ok(out)
}

async fn cmd<S: AsyncRead + AsyncWrite + Unpin>(io: &mut BufReader<S>, line: &str) -> Res<(u16, String)> {
    let w = io.get_mut();
    w.write_all(line.as_bytes()).await?;
    w.write_all(b"\r\n").await?;
    w.flush().await?;
    read_reply(io).await
}

async fn expect<S: AsyncRead + AsyncWrite + Unpin>(io: &mut BufReader<S>, code: u16) -> Res<()> {
    let r = read_reply(io).await?;
    if r.0 == code {
        Ok(())
    } else {
        Err(format!("erwartet {code}: {} {}", r.0, r.1).into())
    }
}

/// Mehrzeilige Antwort lesen: (Code, Text)
async fn read_reply<S: AsyncRead + AsyncWrite + Unpin>(io: &mut BufReader<S>) -> Res<(u16, String)> {
    let mut text = String::new();
    loop {
        let mut line = String::new();
        let n = timeout(Duration::from_secs(300), io.read_line(&mut line)).await??;
        if n == 0 || line.len() < 3 {
            return Err("Verbindung beendet".into());
        }
        let code: u16 = line[..3].parse()?;
        text.push_str(line.get(4..).unwrap_or("").trim_end());
        text.push(' ');
        if line.as_bytes().get(3) != Some(&b'-') {
            return Ok((code, text.trim_end().to_string()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::backoff;

    #[test]
    fn backoff_grows_and_caps() {
        assert_eq!(backoff(1).as_secs(), 300);
        assert_eq!(backoff(2).as_secs(), 900);
        assert_eq!(backoff(50).as_secs(), 720 * 60);
    }
}
