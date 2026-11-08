//! Eigener Mailserver: Speicher in Postgres, lokale Zustellung, DKIM, Anmeldung für Mail-Programme.
//!
//! - `smtp`: SMTP-Empfang (Port 25, MX) und Einlieferung (Port 587, mit Anmeldung)
//! - `outbound`: Warteschlange und Versand an fremde Server (MX, STARTTLS, Wiederholungen)
//! - `imap`: IMAP4rev1-Server für Handy- und Desktop-Programme

pub mod guard;
pub mod imap;
pub mod import;
pub mod outbound;
pub mod smtp;
pub mod tls;

use crate::auth::verify_password;
use crate::routes::chat::send_user;
use mail_auth::crypto::{RsaKey, Sha256};
use mail_auth::dkim::DkimSigner;
use mail_auth::headers::HeaderWriter;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Größte angenommene Nachricht (Bytes)
pub const MAX_SIZE: usize = 30 * 1024 * 1024;
pub const FOLDERS: [&str; 6] = ["inbox", "sent", "drafts", "trash", "junk", "archive"];

/// Name dieses Servers (EHLO, Received, Message-ID)
pub fn hostname() -> String {
    std::env::var("MAIL_HOSTNAME").unwrap_or_else(|_| "mail.code-craft.tech".into())
}

/// `Name <a@b>` / `<a@b>` / `a@b` → `a@b` (klein)
pub fn bare_address(s: &str) -> String {
    let s = s.trim();
    let s = match (s.rfind('<'), s.rfind('>')) {
        (Some(a), Some(b)) if a < b => &s[a + 1..b],
        _ => s,
    };
    s.trim().trim_matches('"').to_lowercase()
}

pub fn domain_of(addr: &str) -> &str {
    addr.rsplit_once('@').map(|(_, d)| d).unwrap_or("")
}

pub async fn is_local_domain(db: &PgPool, domain: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>("SELECT EXISTS (SELECT 1 FROM mail_domains WHERE domain = $1)")
        .bind(domain.to_lowercase())
        .fetch_one(db)
        .await
}

/// Lokales Postfach zu einer Adresse (direkt, Alias oder `name+zusatz@`): (Postfach, Benutzer)
pub async fn resolve_local(db: &PgPool, addr: &str) -> Result<Option<(Uuid, Uuid)>, sqlx::Error> {
    let addr = bare_address(addr);
    let plain = match addr.split_once('@') {
        Some((local, dom)) => format!("{}@{dom}", local.split('+').next().unwrap_or(local)),
        None => return Ok(None),
    };
    sqlx::query_as(
        "SELECT m.id, m.user_id FROM mailboxes m JOIN users u ON u.id = m.user_id
          WHERE m.is_active AND u.is_active
            AND (m.address = $1 OR m.id = (SELECT mailbox_id FROM mail_aliases WHERE address = $1))",
    )
    .bind(plain)
    .fetch_optional(db)
    .await
}

/// Kopfdaten für Liste und Suche
#[derive(Debug, Default, Clone)]
pub struct Meta {
    pub message_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub subject: String,
    pub from_addr: String,
    pub from_name: Option<String>,
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub sent_at: Option<chrono::DateTime<chrono::Utc>>,
    pub preview: String,
    pub has_attachments: bool,
}

fn addrs(a: Option<mail_parser::AddressList<'_>>) -> Vec<String> {
    a.map(|a| a.mailboxes().filter_map(|x| x.address().map(|s| s.to_lowercase())).collect()).unwrap_or_default()
}

pub fn meta(raw: &[u8]) -> Meta {
    let Some(m) = mail_parser::MessageParser::default().parse(raw) else {
        return Meta::default();
    };
    let from = m.from().and_then(|f| f.first());
    let text = m.body_text(0).map(|t| t.into_owned()).unwrap_or_default();
    let attachments = m.attachments().len();
    let preview: String = text.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(180).collect();
    Meta {
        message_id: m.message_id().map(str::to_string),
        in_reply_to: m.in_reply_to().and_then(|t| t.first()).map(str::to_string),
        subject: m.subject().unwrap_or_default().chars().take(500).collect(),
        from_addr: from.and_then(|f| f.address()).unwrap_or_default().to_lowercase(),
        from_name: from.and_then(|f| f.name()).map(str::to_string),
        to: addrs(m.to()),
        cc: addrs(m.cc()),
        sent_at: m.date().and_then(|d| chrono::DateTime::from_timestamp(d.to_timestamp(), 0)),
        preview,
        has_attachments: attachments > 0,
    }
}

/// Nachricht in einem Ordner ablegen; meldet neue Post live an den Benutzer.
pub async fn store(
    db: &PgPool,
    mailbox_id: Uuid,
    folder: &str,
    raw: &[u8],
    auth_results: Option<&str>,
    seen: bool,
) -> Result<Uuid, sqlx::Error> {
    let m = meta(raw);
    let id = Uuid::now_v7();
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO mail_messages (id, mailbox_id, folder, message_id, in_reply_to, subject, from_addr, from_name,
                                    to_addrs, cc_addrs, sent_at, size, preview, has_attachments, auth_results, seen, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, now()),$12,$13,$14,$15,$16,$17)
         RETURNING (SELECT user_id FROM mailboxes WHERE id = $2)",
    )
    .bind(id)
    .bind(mailbox_id)
    .bind(folder)
    .bind(&m.message_id)
    .bind(&m.in_reply_to)
    .bind(&m.subject)
    .bind(&m.from_addr)
    .bind(&m.from_name)
    .bind(&m.to)
    .bind(&m.cc)
    .bind(m.sent_at)
    .bind(raw.len() as i32)
    .bind(&m.preview)
    .bind(m.has_attachments)
    .bind(auth_results)
    .bind(seen)
    .bind(guard::seal(raw))
    .fetch_one(db)
    .await?;
    if !seen {
        let ev = serde_json::json!({ "type": "mail", "folder": folder, "subject": m.subject, "from": m.from_name.unwrap_or(m.from_addr) });
        send_user(user, &ev.to_string());
    }
    Ok(id)
}

/// Belegter Speicher eines Postfachs und Kontingent (Bytes)
pub async fn usage(db: &PgPool, mailbox_id: Uuid) -> Result<(i64, i64), sqlx::Error> {
    sqlx::query_as(
        "SELECT COALESCE((SELECT sum(size)::bigint FROM mail_messages WHERE mailbox_id = $1), 0),
                (SELECT quota_mb::bigint * 1048576 FROM mailboxes WHERE id = $1)",
    )
    .bind(mailbox_id)
    .fetch_one(db)
    .await
}

/// Ergebnis der Zustellung an eine lokale Adresse
#[derive(Debug, PartialEq, Eq)]
pub enum Local {
    Delivered,
    Unknown,
    OverQuota,
}

pub async fn deliver_local(
    db: &PgPool,
    rcpt: &str,
    raw: &[u8],
    auth_results: Option<&str>,
    junk: bool,
) -> Result<Local, sqlx::Error> {
    let Some((mailbox, _)) = resolve_local(db, rcpt).await? else {
        return Ok(Local::Unknown);
    };
    let (used, quota) = usage(db, mailbox).await?;
    if used + raw.len() as i64 > quota {
        return Ok(Local::OverQuota);
    }
    store(db, mailbox, if junk { "junk" } else { "inbox" }, raw, auth_results, false).await?;
    Ok(Local::Delivered)
}

// ── DKIM ───────────────────────────────────────────────────────────────

/// Fehlende DKIM-Schlüssel (RSA 2048) für alle Domains erzeugen
pub async fn ensure_dkim(db: &PgPool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let missing: Vec<String> =
        sqlx::query_scalar("SELECT domain FROM mail_domains WHERE dkim_private_der IS NULL").fetch_all(db).await?;
    for domain in missing {
        let pair = tokio::task::spawn_blocking(|| mail_auth::dkim::generate::DkimKeyPair::generate_rsa(2048)).await??;
        let public = pair.encoded_public_key();
        let (private, _) = pair.into_inner();
        sqlx::query("UPDATE mail_domains SET dkim_private_der = $2, dkim_public_b64 = $3 WHERE domain = $1")
            .bind(&domain)
            .bind(private)
            .bind(public)
            .execute(db)
            .await?;
        tracing::info!("DKIM-Schlüssel für {domain} erzeugt");
    }
    Ok(())
}

/// DKIM-Signatur voranstellen, wenn die Absender-Domain uns gehört
pub async fn dkim_sign(db: &PgPool, from_domain: &str, raw: &[u8]) -> Vec<u8> {
    let key: Option<(String, Option<Vec<u8>>)> =
        sqlx::query_as("SELECT dkim_selector, dkim_private_der FROM mail_domains WHERE domain = $1")
            .bind(from_domain.to_lowercase())
            .fetch_optional(db)
            .await
            .ok()
            .flatten();
    let Some((selector, Some(der))) = key else {
        return raw.to_vec();
    };
    let der = tokio_rustls::rustls::pki_types::PrivatePkcs1KeyDer::from(der);
    let signed = RsaKey::<Sha256>::from_key_der(der.into()).and_then(|k| {
        DkimSigner::from_key(k)
            .domain(from_domain.to_lowercase())
            .selector(selector)
            .headers([
                "From",
                "To",
                "Cc",
                "Subject",
                "Date",
                "Message-ID",
                "In-Reply-To",
                "References",
                "MIME-Version",
                "Content-Type",
            ])
            .sign(raw)
    });
    match signed {
        Ok(sig) => [sig.to_header().into_bytes(), raw.to_vec()].concat(),
        Err(e) => {
            tracing::warn!("DKIM-Signatur fehlgeschlagen: {e}");
            raw.to_vec()
        }
    }
}

/// DNS-Einträge, die für eine Domain gesetzt sein müssen: (Typ, Name, Wert)
pub async fn dns_records(db: &PgPool, domain: &str) -> Result<Vec<(String, String, String)>, sqlx::Error> {
    let row: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT dkim_selector, dkim_public_b64 FROM mail_domains WHERE domain = $1")
            .bind(domain)
            .fetch_optional(db)
            .await?;
    let host = hostname();
    let mut out = vec![
        ("MX".into(), domain.to_string(), format!("10 {host}.")),
        ("TXT".into(), domain.to_string(), "v=spf1 mx -all".into()),
        // streng: Absender-Domain muss exakt passen; nach erfolgreichem Test auf p=reject stellen
        (
            "TXT".into(),
            format!("_dmarc.{domain}"),
            format!("v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:postmaster@{domain}"),
        ),
        // MTA-STS: fremde Server dürfen nur verschlüsselt und nur an unseren MX zustellen
        ("CNAME".into(), format!("mta-sts.{domain}"), format!("{host}.")),
        ("TXT".into(), format!("_mta-sts.{domain}"), "v=STSv1; id=2026110701".into()),
        ("TXT".into(), format!("_smtp._tls.{domain}"), format!("v=TLSRPTv1; rua=mailto:postmaster@{domain}")),
    ];
    if let Some((sel, Some(p))) = row {
        out.push(("TXT".into(), format!("{sel}._domainkey.{domain}"), format!("v=DKIM1; k=rsa; p={p}")));
    }
    Ok(out)
}

// ── Anmeldung für Mail-Programme (IMAP/SMTP) ───────────────────────────

static FAILS: LazyLock<Mutex<HashMap<String, (u32, Instant)>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

fn blocked(key: &str) -> bool {
    let m = FAILS.lock().unwrap();
    matches!(m.get(key), Some((n, t)) if *n >= 8 && t.elapsed() < Duration::from_secs(900))
}
fn fail(key: &str) {
    let mut m = FAILS.lock().unwrap();
    let e = m.entry(key.to_string()).or_insert((0, Instant::now()));
    if e.1.elapsed() > Duration::from_secs(900) {
        *e = (0, Instant::now());
    }
    e.0 += 1;
    e.1 = Instant::now();
}

#[derive(Debug, Clone)]
pub struct MailUser {
    pub user_id: Uuid,
    pub mailbox_id: Uuid,
    pub address: String,
}

/// Anmeldung mit Postfach-Adresse oder Login-E-Mail. Mit aktivem 2FA nur per App-Passwort;
/// ein Einmal-Passwort (noch nicht geändert) gilt nicht für Mail.
pub async fn authenticate(db: &PgPool, login: &str, password: &str) -> Option<MailUser> {
    let login = login.trim().to_lowercase();
    if blocked(&login) {
        return None;
    }
    let row: Option<(Uuid, Uuid, String, Option<String>, bool)> = sqlx::query_as(
        "SELECT u.id, m.id, m.address, u.password_hash, u.totp_secret IS NOT NULL OR u.must_change_password
           FROM users u JOIN mailboxes m ON m.user_id = u.id
          WHERE u.is_active AND m.is_active AND (m.address = $1 OR lower(u.email) = $1)",
    )
    .bind(&login)
    .fetch_optional(db)
    .await
    .ok()
    .flatten();
    let Some((user_id, mailbox_id, address, hash, two_factor)) = row else {
        fail(&login);
        return None;
    };
    let mut ok = !two_factor && hash.as_deref().is_some_and(|h| verify_password(password, h));
    if !ok {
        let apps: Vec<(Uuid, String)> = sqlx::query_as("SELECT id, secret_hash FROM app_passwords WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(db)
            .await
            .unwrap_or_default();
        let pw = password.replace([' ', '-'], "").to_lowercase();
        if let Some((id, _)) = apps.iter().find(|(_, h)| verify_password(&pw, h)) {
            ok = true;
            let _ =
                sqlx::query("UPDATE app_passwords SET last_used_at = now() WHERE id = $1").bind(id).execute(db).await;
        }
    }
    if !ok {
        fail(&login);
        return None;
    }
    Some(MailUser { user_id, mailbox_id, address })
}

pub async fn mail_user(db: &PgPool, user_id: Uuid) -> Result<Option<MailUser>, sqlx::Error> {
    let row: Option<(Uuid, String)> =
        sqlx::query_as("SELECT id, address FROM mailboxes WHERE user_id = $1 AND is_active")
            .bind(user_id)
            .fetch_optional(db)
            .await?;
    Ok(row.map(|(mailbox_id, address)| MailUser { user_id, mailbox_id, address }))
}

// ── Versand (Webmail und SMTP-Einlieferung) ────────────────────────────

/// Nachricht eines eigenen Postfachs verschicken: DKIM, lokal zustellen, Rest in die Warteschlange.
pub async fn submit(
    db: &PgPool,
    sender: &MailUser,
    rcpts: &[String],
    raw: &[u8],
    save_sent: bool,
) -> Result<Uuid, sqlx::Error> {
    let from = sender.address.clone();
    let signed = dkim_sign(db, domain_of(&from), raw).await;
    let sent_id =
        if save_sent { store(db, sender.mailbox_id, "sent", &signed, None, true).await? } else { Uuid::nil() };
    let mut remote: HashMap<String, Vec<String>> = HashMap::new();
    for r in rcpts {
        let r = bare_address(r);
        if is_local_domain(db, domain_of(&r)).await? {
            if deliver_local(db, &r, &signed, None, false).await? != Local::Delivered {
                outbound::bounce(db, sender.mailbox_id, &r, "Unbekannter Empfänger oder Postfach voll").await?;
            }
        } else {
            remote.entry(domain_of(&r).to_string()).or_default().push(r);
        }
    }
    for (domain, list) in remote {
        sqlx::query(
            "INSERT INTO mail_queue (id, mailbox_id, mail_from, rcpt_domain, rcpts, raw) VALUES ($1,$2,$3,$4,$5,$6)",
        )
        .bind(Uuid::now_v7())
        .bind(sender.mailbox_id)
        .bind(&from)
        .bind(domain)
        .bind(list)
        .bind(guard::seal(&signed))
        .execute(db)
        .await?;
    }
    outbound::wake();
    Ok(sent_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses() {
        assert_eq!(bare_address("Jana <Jana@Code-Craft.tech>"), "jana@code-craft.tech");
        assert_eq!(bare_address(" x@y.de "), "x@y.de");
        assert_eq!(domain_of("x@y.de"), "y.de");
    }

    #[test]
    fn parses_meta() {
        let raw = b"From: Jana <jana@example.org>\r\nTo: a@code-craft.tech, B <b@code-craft.tech>\r\nSubject: =?utf-8?q?Gr=C3=BC=C3=9Fe?=\r\nMessage-ID: <1@x>\r\nDate: Sat, 7 Nov 2026 10:00:00 +0000\r\n\r\nHallo   Welt\r\n";
        let m = meta(raw);
        assert_eq!(m.subject, "Grüße");
        assert_eq!(m.from_addr, "jana@example.org");
        assert_eq!(m.from_name.as_deref(), Some("Jana"));
        assert_eq!(m.to, vec!["a@code-craft.tech", "b@code-craft.tech"]);
        assert_eq!(m.preview, "Hallo Welt");
        assert_eq!(m.message_id.as_deref(), Some("1@x"));
        assert!(m.sent_at.is_some());
    }
}
