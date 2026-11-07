//! Webmail im Portal: Ordner, Liste, Lesen, Anhänge, Senden; App-Passwörter; Verwaltung (Domains, Aliase, DNS).

use crate::auth::{hash_password, User};
use crate::error::{ApiError, ApiResult};
use crate::mail::{self, MailUser, FOLDERS};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::Engine;
use chrono::{DateTime, Utc};
use codecraft_domain::access::Permission;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

async fn mailbox(s: &AppState, user: &User) -> ApiResult<MailUser> {
    mail::mail_user(&s.db, user.id).await?.ok_or_else(|| ApiError::NotFound)
}

pub async fn overview(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    let mb = mailbox(&s, &user).await?;
    let counts: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT folder, count(*), count(*) FILTER (WHERE NOT seen) FROM mail_messages WHERE mailbox_id = $1 GROUP BY folder",
    )
    .bind(mb.mailbox_id)
    .fetch_all(&s.db)
    .await?;
    let folders: Vec<Value> = FOLDERS
        .iter()
        .map(|f| {
            let c = counts.iter().find(|c| c.0 == *f);
            json!({ "id": f, "total": c.map(|c| c.1).unwrap_or(0), "unread": c.map(|c| c.2).unwrap_or(0) })
        })
        .collect();
    let (used, quota) = mail::usage(&s.db, mb.mailbox_id).await?;
    Ok(Json(json!({ "address": mb.address, "folders": folders, "used": used, "quota": quota })))
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub folder: Option<String>,
    pub q: Option<String>,
    pub before: Option<DateTime<Utc>>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Item {
    pub id: Uuid,
    pub folder: String,
    pub subject: String,
    pub from_addr: String,
    pub from_name: Option<String>,
    pub to_addrs: Vec<String>,
    pub sent_at: DateTime<Utc>,
    pub preview: String,
    pub seen: bool,
    pub flagged: bool,
    pub answered: bool,
    pub has_attachments: bool,
    pub size: i32,
}

pub async fn list(State(s): State<AppState>, user: User, Query(q): Query<ListQuery>) -> ApiResult<Json<Vec<Item>>> {
    let mb = mailbox(&s, &user).await?;
    let folder = q.folder.unwrap_or_else(|| "inbox".into());
    if !FOLDERS.contains(&folder.as_str()) {
        return Err(ApiError::BadRequest("Unbekannter Ordner".into()));
    }
    let search = q.q.filter(|x| !x.trim().is_empty()).map(|x| format!("%{}%", x.trim().replace(['%', '_'], "")));
    let rows = sqlx::query_as::<_, Item>(
        "SELECT id, folder, subject, from_addr, from_name, to_addrs, sent_at, preview, seen, flagged, answered, has_attachments, size
           FROM mail_messages
          WHERE mailbox_id = $1 AND folder = $2 AND NOT deleted
            AND ($3::timestamptz IS NULL OR sent_at < $3)
            AND ($4::text IS NULL OR subject ILIKE $4 OR from_addr ILIKE $4 OR coalesce(from_name,'') ILIKE $4 OR preview ILIKE $4
                 OR array_to_string(to_addrs, ' ') ILIKE $4)
          ORDER BY sent_at DESC LIMIT 50",
    )
    .bind(mb.mailbox_id)
    .bind(&folder)
    .bind(q.before)
    .bind(search)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

async fn load(s: &AppState, mb: &MailUser, id: Uuid) -> ApiResult<(String, Vec<u8>, Option<String>, bool, bool)> {
    sqlx::query_as(
        "SELECT folder, raw, auth_results, flagged, answered FROM mail_messages WHERE id = $1 AND mailbox_id = $2",
    )
    .bind(id)
    .bind(mb.mailbox_id)
    .fetch_optional(&s.db)
    .await?
    .ok_or(ApiError::NotFound)
}

pub async fn get(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    let mb = mailbox(&s, &user).await?;
    let (folder, raw, auth, flagged, answered) = load(&s, &mb, id).await?;
    let sent_at: DateTime<Utc> =
        sqlx::query_scalar("UPDATE mail_messages SET seen = true WHERE id = $1 RETURNING sent_at")
            .bind(id)
            .fetch_one(&s.db)
            .await?;
    let m = mail::meta(&raw);
    let parsed = mail_parser::MessageParser::default().parse(&raw);
    let (text, html, attachments) = match &parsed {
        Some(p) => (
            p.body_text(0).map(|t| t.into_owned()),
            // nur echtes HTML anzeigen, nicht das aus Text erzeugte
            p.parts().any(|x| x.is_content_type("text", "html")).then(|| p.body_html(0).map(|t| t.into_owned())).flatten(),
            p.attachments()
                .enumerate()
                .map(|(i, a)| {
                    json!({
                        "index": i,
                        "name": a.attachment_name().unwrap_or("Anhang"),
                        "mime": a.content_type().map(|c| format!("{}/{}", c.ctype(), c.subtype().unwrap_or("octet-stream"))).unwrap_or_else(|| "application/octet-stream".into()),
                        "size": a.decoded().len(),
                    })
                })
                .collect::<Vec<_>>(),
        ),
        None => (Some(String::from_utf8_lossy(&raw).into_owned()), None, vec![]),
    };
    Ok(Json(json!({
        "id": id, "folder": folder, "subject": m.subject, "from_addr": m.from_addr, "from_name": m.from_name,
        "to": m.to, "cc": m.cc, "sent_at": sent_at, "message_id": m.message_id,
        "text": text, "html": html, "attachments": attachments, "auth_results": auth,
        "flagged": flagged, "answered": answered,
    })))
}

pub async fn raw(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Response> {
    let mb = mailbox(&s, &user).await?;
    let (_, raw, ..) = load(&s, &mb, id).await?;
    Ok((
        [
            (header::CONTENT_TYPE, "message/rfc822".to_string()),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{id}.eml\"")),
        ],
        raw,
    )
        .into_response())
}

pub async fn attachment(
    State(s): State<AppState>,
    user: User,
    Path((id, n)): Path<(Uuid, usize)>,
) -> ApiResult<Response> {
    let mb = mailbox(&s, &user).await?;
    let (_, raw, ..) = load(&s, &mb, id).await?;
    let parsed = mail_parser::MessageParser::default().parse(&raw).ok_or(ApiError::NotFound)?;
    let a = parsed.attachments().nth(n).ok_or(ApiError::NotFound)?;
    let name: String =
        a.attachment_name().unwrap_or("anhang").chars().filter(|c| !matches!(c, '"' | '\\' | '\r' | '\n')).collect();
    let mime = a
        .content_type()
        .map(|c| format!("{}/{}", c.ctype(), c.subtype().unwrap_or("octet-stream")))
        .unwrap_or_else(|| "application/octet-stream".into());
    Ok((
        [
            // HTML/SVG nie im Portal-Ursprung ausführen
            (
                header::CONTENT_TYPE,
                if mime.contains("html") || mime.contains("svg") { "application/octet-stream".into() } else { mime },
            ),
            (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{name}\"")),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".into()),
        ],
        a.decoded().to_vec(),
    )
        .into_response())
}

#[derive(Deserialize)]
pub struct Patch {
    pub seen: Option<bool>,
    pub flagged: Option<bool>,
    pub folder: Option<String>,
}

pub async fn patch(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Patch>,
) -> ApiResult<StatusCode> {
    let mb = mailbox(&s, &user).await?;
    if let Some(f) = &b.folder {
        if !FOLDERS.contains(&f.as_str()) {
            return Err(ApiError::BadRequest("Unbekannter Ordner".into()));
        }
    }
    let n = sqlx::query(
        "UPDATE mail_messages SET seen = COALESCE($3, seen), flagged = COALESCE($4, flagged),
                folder = COALESCE($5, folder),
                uid = CASE WHEN $5 IS NOT NULL AND $5 <> folder THEN nextval('mail_uid_seq') ELSE uid END
          WHERE id = $1 AND mailbox_id = $2",
    )
    .bind(id)
    .bind(mb.mailbox_id)
    .bind(b.seen)
    .bind(b.flagged)
    .bind(b.folder)
    .execute(&s.db)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Löschen: zuerst in den Papierkorb, aus dem Papierkorb endgültig
pub async fn delete(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    let mb = mailbox(&s, &user).await?;
    let (folder, ..) = load(&s, &mb, id).await?;
    if folder == "trash" {
        sqlx::query("DELETE FROM mail_messages WHERE id = $1").bind(id).execute(&s.db).await?;
    } else {
        sqlx::query("UPDATE mail_messages SET folder = 'trash', uid = nextval('mail_uid_seq') WHERE id = $1")
            .bind(id)
            .execute(&s.db)
            .await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct Attachment {
    pub name: String,
    pub mime: String,
    pub data_b64: String,
}

#[derive(Deserialize)]
pub struct Send {
    #[serde(default)]
    pub to: Vec<String>,
    #[serde(default)]
    pub cc: Vec<String>,
    #[serde(default)]
    pub bcc: Vec<String>,
    pub subject: String,
    pub text: String,
    pub reply_to_id: Option<Uuid>,
    #[serde(default)]
    pub attachments: Vec<Attachment>,
}

fn valid(a: &str) -> bool {
    let a = mail::bare_address(a);
    let ok_local = a.split_once('@').is_some_and(|(l, d)| !l.is_empty() && d.contains('.') && !d.starts_with('.'));
    ok_local && !a.contains(char::is_whitespace) && a.len() <= 254
}

pub async fn send(State(s): State<AppState>, user: User, Json(b): Json<Send>) -> ApiResult<(StatusCode, Json<Value>)> {
    let mb = mailbox(&s, &user).await?;
    let rcpts: Vec<String> = b.to.iter().chain(&b.cc).chain(&b.bcc).map(|a| mail::bare_address(a)).collect();
    if rcpts.is_empty() || rcpts.len() > 100 {
        return Err(ApiError::BadRequest("1 bis 100 Empfänger".into()));
    }
    if let Some(bad) = rcpts.iter().find(|a| !valid(a)) {
        return Err(ApiError::BadRequest(format!("Ungültige Adresse: {bad}")));
    }
    let name: String =
        sqlx::query_scalar("SELECT display_name FROM users WHERE id = $1").bind(user.id).fetch_one(&s.db).await?;
    let msg_id = format!("{}@{}", Uuid::now_v7(), mail::domain_of(&mb.address));
    let mut m = mail_builder::MessageBuilder::new()
        .from((name, mb.address.clone()))
        .subject(b.subject.trim().to_string())
        .message_id(msg_id)
        .date(chrono::Utc::now().timestamp())
        .text_body(b.text.clone());
    if !b.to.is_empty() {
        m = m.to(b.to.iter().map(|a| mail::bare_address(a)).collect::<Vec<_>>());
    }
    if !b.cc.is_empty() {
        m = m.cc(b.cc.iter().map(|a| mail::bare_address(a)).collect::<Vec<_>>());
    }
    if let Some(rid) = b.reply_to_id {
        let orig: Option<Option<String>> =
            sqlx::query_scalar("SELECT message_id FROM mail_messages WHERE id = $1 AND mailbox_id = $2")
                .bind(rid)
                .bind(mb.mailbox_id)
                .fetch_optional(&s.db)
                .await?;
        if let Some(Some(mid)) = orig {
            m = m.in_reply_to(mid.clone()).references(mid);
        }
        sqlx::query("UPDATE mail_messages SET answered = true WHERE id = $1").bind(rid).execute(&s.db).await?;
    }
    let mut total = 0usize;
    for a in &b.attachments {
        let data = base64::engine::general_purpose::STANDARD
            .decode(a.data_b64.as_bytes())
            .map_err(|_| ApiError::BadRequest("Anhang beschädigt".into()))?;
        total += data.len();
        m = m.attachment(a.mime.clone(), a.name.clone(), data);
    }
    if total > 25 * 1024 * 1024 {
        return Err(ApiError::BadRequest("Anhänge zusammen höchstens 25 MB".into()));
    }
    let raw = m.write_to_vec().map_err(|e| ApiError::BadRequest(e.to_string()))?;
    let id = mail::submit(&s.db, &mb, &rcpts, &raw, true).await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

// ── App-Passwörter ─────────────────────────────────────────────────────

pub async fn app_passwords(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    type AppPw = (Uuid, String, DateTime<Utc>, Option<DateTime<Utc>>);
    let rows: Vec<AppPw> = sqlx::query_as(
        "SELECT id, name, created_at, last_used_at FROM app_passwords WHERE user_id = $1 ORDER BY created_at",
    )
    .bind(user.id)
    .fetch_all(&s.db)
    .await?;
    let mb = mail::mail_user(&s.db, user.id).await?;
    let host = mail::hostname();
    Ok(Json(json!({
        "items": rows.iter().map(|r| json!({ "id": r.0, "name": r.1, "created_at": r.2, "last_used_at": r.3 })).collect::<Vec<_>>(),
        "settings": { "address": mb.map(|m| m.address), "imap": format!("{host}:993 (SSL/TLS)"), "smtp": format!("{host}:465 (SSL/TLS) oder 587 (STARTTLS)") },
    })))
}

#[derive(Deserialize)]
pub struct NewAppPassword {
    pub name: String,
}

pub async fn create_app_password(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewAppPassword>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let raw: String = {
        use rand::Rng;
        const ABC: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
        let mut rng = rand::thread_rng();
        (0..16).map(|_| ABC[rng.gen_range(0..ABC.len())] as char).collect()
    };
    let shown = format!("{}-{}-{}-{}", &raw[0..4], &raw[4..8], &raw[8..12], &raw[12..16]);
    let name = b.name.trim();
    if name.is_empty() || name.len() > 60 {
        return Err(ApiError::BadRequest("Name 1–60 Zeichen".into()));
    }
    let id = Uuid::now_v7();
    sqlx::query("INSERT INTO app_passwords (id, user_id, name, secret_hash) VALUES ($1,$2,$3,$4)")
        .bind(id)
        .bind(user.id)
        .bind(name)
        .bind(hash_password(&shown.replace('-', ""))?)
        .execute(&s.db)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "password": shown }))))
}

pub async fn delete_app_password(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    sqlx::query("DELETE FROM app_passwords WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .execute(&s.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Verwaltung ─────────────────────────────────────────────────────────

pub async fn admin(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    user.require(Permission::UserManage, None)?;
    let domains: Vec<String> =
        sqlx::query_scalar("SELECT domain FROM mail_domains ORDER BY is_default DESC, domain").fetch_all(&s.db).await?;
    let mut out = vec![];
    for d in domains {
        let recs = mail::dns_records(&s.db, &d).await?;
        out.push(json!({ "domain": d, "dns": recs.iter().map(|r| json!({ "type": r.0, "name": r.1, "value": r.2 })).collect::<Vec<_>>() }));
    }
    let aliases: Vec<(String, String)> = sqlx::query_as(
        "SELECT a.address, m.address FROM mail_aliases a JOIN mailboxes m ON m.id = a.mailbox_id ORDER BY a.address",
    )
    .fetch_all(&s.db)
    .await?;
    let queue: Vec<(String, i64)> =
        sqlx::query_as("SELECT status, count(*) FROM mail_queue GROUP BY status").fetch_all(&s.db).await?;
    type Problem = (DateTime<Utc>, String, Vec<String>, Option<String>);
    let failed: Vec<Problem> = sqlx::query_as(
        "SELECT created_at, mail_from, rcpts, last_error FROM mail_queue WHERE status IN ('failed','queued') AND last_error IS NOT NULL
          ORDER BY created_at DESC LIMIT 20",
    )
    .fetch_all(&s.db)
    .await?;
    Ok(Json(json!({
        "hostname": mail::hostname(),
        "domains": out,
        "aliases": aliases.iter().map(|a| json!({ "address": a.0, "mailbox": a.1 })).collect::<Vec<_>>(),
        "queue": queue.iter().map(|q| json!({ "status": q.0, "count": q.1 })).collect::<Vec<_>>(),
        "problems": failed.iter().map(|f| json!({ "at": f.0, "from": f.1, "rcpts": f.2, "error": f.3 })).collect::<Vec<_>>(),
    })))
}

#[derive(Deserialize)]
pub struct NewDomain {
    pub domain: String,
}

pub async fn add_domain(State(s): State<AppState>, user: User, Json(b): Json<NewDomain>) -> ApiResult<StatusCode> {
    user.require(Permission::UserManage, None)?;
    let d = b.domain.trim().to_lowercase();
    if !d.contains('.') || d.contains(char::is_whitespace) || d.contains('@') {
        return Err(ApiError::BadRequest("Ungültige Domain".into()));
    }
    sqlx::query("INSERT INTO mail_domains (domain) VALUES ($1) ON CONFLICT DO NOTHING").bind(&d).execute(&s.db).await?;
    mail::ensure_dkim(&s.db).await.map_err(|e| ApiError::BadRequest(e.to_string()))?;
    Ok(StatusCode::CREATED)
}

#[derive(Deserialize)]
pub struct NewAlias {
    pub address: String,
    pub mailbox: String,
}

pub async fn add_alias(State(s): State<AppState>, user: User, Json(b): Json<NewAlias>) -> ApiResult<StatusCode> {
    user.require(Permission::UserManage, None)?;
    let addr = mail::bare_address(&b.address);
    if !valid(&addr) || !mail::is_local_domain(&s.db, mail::domain_of(&addr)).await? {
        return Err(ApiError::BadRequest("Alias muss zu einer eigenen Domain gehören".into()));
    }
    let n = sqlx::query(
        "INSERT INTO mail_aliases (address, mailbox_id) SELECT $1, id FROM mailboxes WHERE address = $2
         ON CONFLICT (address) DO UPDATE SET mailbox_id = EXCLUDED.mailbox_id",
    )
    .bind(&addr)
    .bind(mail::bare_address(&b.mailbox))
    .execute(&s.db)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(ApiError::BadRequest("Postfach nicht gefunden".into()));
    }
    Ok(StatusCode::CREATED)
}

pub async fn delete_alias(State(s): State<AppState>, user: User, Path(addr): Path<String>) -> ApiResult<StatusCode> {
    user.require(Permission::UserManage, None)?;
    sqlx::query("DELETE FROM mail_aliases WHERE address = $1").bind(addr.to_lowercase()).execute(&s.db).await?;
    Ok(StatusCode::NO_CONTENT)
}
