//! Weiterleitungsregeln je Postfach (vom Admin gesetzt).
//!
//! Intern: Originalnachricht wird zusätzlich zugestellt.
//! Extern: neue Nachricht von der Postfach-Adresse mit dem Original als Anhang
//! (sonst würde SPF/DMARC beim Empfänger scheitern). Eine geheime Kennzeile verhindert Schleifen.

use super::{domain_of, is_local_domain, meta, MailUser};
use sqlx::PgPool;
use std::future::Future;
use std::pin::Pin;
use std::sync::LazyLock;
use uuid::Uuid;

/// Kennzeile weitergeleiteter Nachrichten; der Wert ist zufällig je Serverstart,
/// damit Fremde Regeln nicht mit einer gefälschten Kopfzeile umgehen können.
const MARK: &str = "X-CC-Forwarded";
static TOKEN: LazyLock<String> = LazyLock::new(|| crate::auth::new_token(""));

#[derive(Debug, Clone)]
pub struct Rule {
    pub forward_to: String,
    pub keep_copy: bool,
}

/// `None` = alle; `a@b.de` genau; `@b.de` Domain
pub fn sender_matches(pattern: Option<&str>, from: &str) -> bool {
    let from = from.trim().to_lowercase();
    match pattern {
        None => true,
        Some(p) if p.starts_with('@') => from.ends_with(p),
        Some(p) => from == p,
    }
}

fn already_forwarded(raw: &[u8]) -> bool {
    let head_end = raw.windows(4).position(|w| w == b"\r\n\r\n").unwrap_or(raw.len().min(64 * 1024));
    let head = String::from_utf8_lossy(&raw[..head_end]);
    let needle = format!("{MARK}: {}", *TOKEN);
    head.lines().any(|l| l.trim_end() == needle)
}

/// Passende aktive Regeln für eine eingehende Nachricht
pub async fn matching(db: &PgPool, mailbox: Uuid, raw: &[u8]) -> Result<Vec<Rule>, sqlx::Error> {
    if already_forwarded(raw) {
        return Ok(vec![]);
    }
    let rows: Vec<(Option<String>, String, bool)> =
        sqlx::query_as("SELECT sender, forward_to, keep_copy FROM mail_rules WHERE mailbox_id = $1 AND is_active")
            .bind(mailbox)
            .fetch_all(db)
            .await?;
    if rows.is_empty() {
        return Ok(vec![]);
    }
    let from = meta(raw).from_addr;
    Ok(rows
        .into_iter()
        .filter(|r| sender_matches(r.0.as_deref(), &from))
        .map(|r| Rule { forward_to: r.1, keep_copy: r.2 })
        .collect())
}

type Boxed = Pin<Box<dyn Future<Output = ()> + Send>>;

/// Weiterleiten im Hintergrund (Zustellung blockiert nicht)
pub fn forward(db: PgPool, mailbox: Uuid, raw: Vec<u8>, rules: Vec<Rule>) {
    let job: Boxed = Box::pin(async move {
        let Ok(Some((user_id, address))) =
            sqlx::query_as::<_, (Uuid, String)>("SELECT user_id, address FROM mailboxes WHERE id = $1")
                .bind(mailbox)
                .fetch_optional(&db)
                .await
        else {
            return;
        };
        let sender = MailUser { user_id, mailbox_id: mailbox, address: address.clone() };
        for r in rules {
            if r.forward_to == address {
                continue;
            }
            let local = is_local_domain(&db, domain_of(&r.forward_to)).await.unwrap_or(false);
            let msg = if local { marked(&raw) } else { wrapped(&address, &r.forward_to, &raw) };
            let rcpts = [r.forward_to.clone()];
            let send: Pin<Box<dyn Future<Output = Result<Uuid, sqlx::Error>> + Send + '_>> =
                Box::pin(super::submit(&db, &sender, &rcpts, &msg, false));
            if let Err(e) = send.await {
                tracing::warn!("Weiterleitung {address} → {} fehlgeschlagen: {e}", r.forward_to);
            }
        }
    });
    tokio::spawn(job);
}

/// Original mit Kennzeile (intern)
fn marked(raw: &[u8]) -> Vec<u8> {
    [format!("{MARK}: {}\r\n", *TOKEN).into_bytes(), raw.to_vec()].concat()
}

/// Neue Nachricht mit dem Original als Anhang (extern)
fn wrapped(from: &str, to: &str, raw: &[u8]) -> Vec<u8> {
    let m = meta(raw);
    let mut b = mail_builder::MessageBuilder::new()
        .from(("Weiterleitung".to_string(), from.to_string()))
        .to(to.to_string())
        .subject(format!("Fwd: {}", m.subject))
        .date(chrono::Utc::now().timestamp())
        .message_id(format!("{}@{}", Uuid::now_v7(), domain_of(from)))
        .header(MARK, mail_builder::headers::raw::Raw::new(TOKEN.clone()))
        .text_body(format!(
            "Automatisch weitergeleitet von {from}.\r\n\r\nAbsender: {}\r\nBetreff: {}\r\n\r\nDie Originalnachricht liegt als Anhang bei.\r\n",
            m.from_addr, m.subject
        ))
        .attachment("message/rfc822", "nachricht.eml", raw.to_vec());
    if !m.from_addr.is_empty() {
        b = b.reply_to(m.from_addr.clone());
    }
    b.write_to_vec().unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patterns() {
        assert!(sender_matches(None, "x@y.de"));
        assert!(sender_matches(Some("@kunde.de"), "Chef@Kunde.de"));
        assert!(!sender_matches(Some("@kunde.de"), "a@nichtkunde.com"));
        assert!(sender_matches(Some("a@b.de"), "A@B.de"));
        assert!(!sender_matches(Some("a@b.de"), "aa@b.de"));
    }

    #[test]
    fn loop_mark_is_secret() {
        let raw = b"From: a@b.de\r\nSubject: x\r\n\r\nHallo";
        assert!(!already_forwarded(raw));
        assert!(already_forwarded(&marked(raw)));
        // fremde Kennzeile ohne richtigen Wert zählt nicht
        assert!(!already_forwarded(b"X-CC-Forwarded: 1\r\nFrom: a@b.de\r\n\r\nx"));
        let w = wrapped("ak@code-craft.tech", "x@extern.de", raw);
        assert!(already_forwarded(&w));
        assert!(String::from_utf8_lossy(&w).contains("message/rfc822"));
    }
}
