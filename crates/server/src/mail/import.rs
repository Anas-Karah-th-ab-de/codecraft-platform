//! Übernahme aus Mailcow/Dovecot: `doveadm -f pager fetch 'mailbox uid flags date.received text' ALL`
//! (siehe tools/legacy/mail-export.sh). Wiederholbar: bereits vorhandene Nachrichten werden übersprungen.

use sqlx::PgPool;

#[derive(Debug, Clone, PartialEq)]
pub struct Legacy {
    pub mailbox: String,
    pub flags: String,
    pub received: Option<chrono::DateTime<chrono::Utc>>,
    pub raw: Vec<u8>,
}

/// Pager-Ausgabe zerlegen (Datensätze durch eine Zeile mit Seitenvorschub getrennt)
pub fn parse_pager(data: &[u8]) -> Vec<Legacy> {
    let mut out = vec![];
    let mut records: Vec<&[u8]> = vec![];
    let mut start = 0;
    let mut i = 0;
    while i < data.len() {
        if data[i] == 0x0c && (i == 0 || data[i - 1] == b'\n') && data.get(i + 1) == Some(&b'\n') {
            records.push(&data[start..i]);
            start = i + 2;
            i += 2;
            continue;
        }
        i += 1;
    }
    records.push(&data[start..]);
    for rec in records {
        let Some(pos) = rec.windows(6).position(|w| w == b"text:\n") else { continue };
        let head = String::from_utf8_lossy(&rec[..pos]);
        let field =
            |k: &str| head.lines().find_map(|l| l.strip_prefix(k)).map(|v| v.trim().to_string()).unwrap_or_default();
        let body = &rec[pos + 6..];
        // Dovecot liefert LF – für RFC 5322 wieder CRLF
        let mut raw = Vec::with_capacity(body.len() + body.len() / 30);
        for (j, b) in body.iter().enumerate() {
            if *b == b'\n' && (j == 0 || body[j - 1] != b'\r') {
                raw.push(b'\r');
            }
            raw.push(*b);
        }
        while raw.ends_with(b"\r\n\r\n") {
            raw.truncate(raw.len() - 2);
        }
        if raw.is_empty() {
            continue;
        }
        let received = chrono::NaiveDateTime::parse_from_str(&field("date.received:"), "%Y-%m-%d %H:%M:%S")
            .ok()
            .map(|d| d.and_utc());
        out.push(Legacy { mailbox: field("mailbox:"), flags: field("flags:"), received, raw });
    }
    out
}

pub fn folder_for(mailbox: &str) -> &'static str {
    match mailbox.to_lowercase().as_str() {
        "inbox" => "inbox",
        "sent" | "sent messages" | "sent items" | "gesendet" | "gesendete elemente" => "sent",
        "drafts" | "entwürfe" => "drafts",
        "trash" | "deleted messages" | "papierkorb" => "trash",
        "junk" | "spam" => "junk",
        _ => "archive",
    }
}

/// In das Postfach `address` übernehmen → (übernommen, übersprungen)
pub async fn import(db: &PgPool, address: &str, records: &[Legacy]) -> Result<(usize, usize), String> {
    let mailbox: uuid::Uuid = sqlx::query_scalar("SELECT id FROM mailboxes WHERE address = $1")
        .bind(address.to_lowercase())
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Kein Postfach {address} – zuerst den Benutzer anlegen"))?;
    let (mut done, mut skipped) = (0, 0);
    for r in records {
        let flags = r.flags.to_lowercase();
        if flags.contains("\\deleted") {
            skipped += 1;
            continue;
        }
        let folder = folder_for(&r.mailbox);
        let meta = super::meta(&r.raw);
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM mail_messages WHERE mailbox_id = $1 AND folder = $2 AND size = $3
                              AND message_id IS NOT DISTINCT FROM $4 AND subject = $5)",
        )
        .bind(mailbox)
        .bind(folder)
        .bind(r.raw.len() as i32)
        .bind(&meta.message_id)
        .bind(&meta.subject)
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?;
        if exists {
            skipped += 1;
            continue;
        }
        let id = super::store(db, mailbox, folder, &r.raw, None, true).await.map_err(|e| e.to_string())?;
        sqlx::query(
            "UPDATE mail_messages SET seen = $2, flagged = $3, answered = $4, received_at = COALESCE($5, received_at) WHERE id = $1",
        )
        .bind(id)
        .bind(flags.contains("\\seen"))
        .bind(flags.contains("\\flagged"))
        .bind(flags.contains("\\answered"))
        .bind(r.received)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;
        done += 1;
    }
    Ok((done, skipped))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_doveadm_pager() {
        let data = b"mailbox: INBOX\nuid: 1\nflags: \\Seen\ndate.received: 2026-03-21 14:27:25\ntext:\nFrom: a@b.c\nSubject: Eins\n\nHallo\n\n\x0c\nmailbox: Sent\nuid: 7\nflags: \ndate.received: 2026-03-22 08:00:00\ntext:\nSubject: Zwei\n\nx\n";
        let r = parse_pager(data);
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].mailbox, "INBOX");
        assert_eq!(r[0].flags, "\\Seen");
        assert_eq!(r[0].raw, b"From: a@b.c\r\nSubject: Eins\r\n\r\nHallo\r\n");
        assert_eq!(r[1].mailbox, "Sent");
        assert_eq!(r[1].received.unwrap().to_rfc3339(), "2026-03-22T08:00:00+00:00");
        assert_eq!(folder_for("Archiv/2024"), "archive");
    }
}
