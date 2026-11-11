//! Selbstregistrierung: Kunde legt Konto und Firma an. Aktiv erst nach Klick auf den Link in der E-Mail.
//! Antwort auf den Antrag ist immer gleich – ob die Adresse schon ein Konto hat, verrät sie nicht.

use crate::auth::{hash_password, hash_token, new_token, password_policy};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Gültigkeit des Bestätigungslinks
const LINK_HOURS: i32 = 48;

/// Grenzen je Stunde: Anträge je Adresse und je E-Mail, Bestätigungsversuche je Adresse
static HITS: Mutex<Option<HashMap<String, (u32, Instant)>>> = Mutex::new(None);

fn allow(key: String, limit: u32) -> bool {
    let mut g = HITS.lock().unwrap_or_else(|e| e.into_inner());
    let m = g.get_or_insert_with(HashMap::new);
    if m.len() >= 20_000 {
        m.retain(|_, v| v.1.elapsed() < Duration::from_secs(3600));
    }
    let e = m.entry(key).or_insert((0, Instant::now()));
    if e.1.elapsed() >= Duration::from_secs(3600) {
        *e = (0, Instant::now());
    }
    e.0 += 1;
    e.0 <= limit
}

fn locale_of(l: &str) -> &'static str {
    match l {
        "en" => "en",
        "ar" => "ar",
        _ => "de",
    }
}

fn public_url() -> String {
    std::env::var("PUBLIC_URL").unwrap_or_else(|_| "https://code-craft.tech".into()).trim_end_matches('/').to_string()
}

fn opt(v: &Option<String>, max: usize) -> Result<Option<String>, ApiError> {
    let v = v.as_deref().map(str::trim).filter(|v| !v.is_empty());
    match v {
        Some(x) if x.chars().count() > max => Err(ApiError::BadRequest("Eingabe zu lang".into())),
        _ => Ok(v.map(String::from)),
    }
}

fn plausible_email(e: &str) -> bool {
    let Some((local, domain)) = e.split_once('@') else { return false };
    !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && e.len() <= 254
        && !e.chars().any(|c| c.is_whitespace() || c.is_control() || c == ',' || c == ';' || c == '<' || c == '>')
}

#[derive(Debug, Deserialize)]
pub struct SignupBody {
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub password: String,
    pub company: String,
    #[serde(default)]
    pub address: String,
    pub vat_id: Option<String>,
    #[serde(default)]
    pub locale: String,
    /// Falle für Bots: bleibt bei Menschen leer
    #[serde(default)]
    pub website: String,
}

pub async fn register(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(b): Json<SignupBody>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let done = || Ok((StatusCode::ACCEPTED, Json(json!({ "ok": true }))));
    if !b.website.is_empty() {
        return done();
    }
    let ip = super::account::client_ip(&headers);
    let email = b.email.trim().to_lowercase();
    if !allow(format!("reg-ip:{ip}"), 5) || !allow(format!("reg-mail:{email}"), 3) {
        return Err(ApiError::TooManyRequests);
    }
    let name = b.name.trim();
    let company = b.company.trim();
    if name.is_empty() || company.is_empty() {
        return Err(ApiError::BadRequest("Bitte Name und Firma angeben".into()));
    }
    if name.chars().count() > 200 || company.chars().count() > 200 || b.address.chars().count() > 500 {
        return Err(ApiError::BadRequest("Eingabe zu lang".into()));
    }
    if !plausible_email(&email) {
        return Err(ApiError::BadRequest("Bitte eine gültige E-Mail-Adresse angeben".into()));
    }
    password_policy(&b.password)?;
    if b.password.len() > 1024 {
        return Err(ApiError::BadRequest("Passwort zu lang".into()));
    }
    let phone = opt(&b.phone, 40)?;
    let vat = opt(&b.vat_id, 40)?;
    let locale = locale_of(&b.locale);

    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE lower(email) = $1)")
        .bind(&email)
        .fetch_one(&s.db)
        .await?;
    let url = public_url();
    if exists {
        // Kein Hinweis in der Antwort; der Inhaber der Adresse erfährt es per E-Mail
        let (subj, text) = match locale {
            "ar" => ("لديك حساب بالفعل", format!("لديك حساب بهذا البريد الإلكتروني في بوابة KM Code Craft.\r\nسجّل الدخول هنا: {url}/portal\r\n\r\nإذا لم تطلب ذلك، تجاهل هذه الرسالة.\r\n")),
            "en" => ("You already have an account", format!("There is already a KM Code Craft portal account for this e-mail address.\r\nSign in here: {url}/portal\r\n\r\nIf you did not request this, just ignore this message.\r\n")),
            _ => ("Sie haben bereits ein Konto", format!("Für diese E-Mail-Adresse gibt es bereits ein Konto im KM-Code-Craft-Portal.\r\nHier anmelden: {url}/portal\r\n\r\nWenn Sie das nicht waren, ignorieren Sie diese Nachricht einfach.\r\n")),
        };
        let db = s.db.clone();
        tokio::spawn(async move {
            crate::mail::system_send(&db, &email, subj, &text, None).await;
        });
        return done();
    }

    let password = b.password.clone();
    let hash = tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|_| ApiError::BadRequest("Passwort konnte nicht verarbeitet werden".into()))??;
    let token = new_token("cc_r_");
    let mut tx = s.db.begin().await?;
    // Ältere offene Anträge derselben Adresse verfallen – nur der neueste Link gilt
    sqlx::query("DELETE FROM signup_requests WHERE lower(email) = $1 AND confirmed_at IS NULL")
        .bind(&email)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO signup_requests (id, token_hash, email, display_name, phone, password_hash, company, address, vat_id, locale, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now() + make_interval(hours => $11))",
    )
    .bind(Uuid::now_v7())
    .bind(hash_token(&token))
    .bind(&email)
    .bind(name)
    .bind(&phone)
    .bind(&hash)
    .bind(company)
    .bind(b.address.trim())
    .bind(&vat)
    .bind(locale)
    .bind(LINK_HOURS)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let link = format!("{url}/portal/registrieren/bestaetigen?t={token}");
    let (subj, text) = match locale {
        "ar" => ("أكّد حسابك لدى KM Code Craft", format!("مرحباً {name}،\r\n\r\nلتفعيل حسابك وحساب شركتك «{company}» افتح هذا الرابط خلال {LINK_HOURS} ساعة:\r\n{link}\r\n\r\nإذا لم تطلب ذلك، تجاهل هذه الرسالة – لن يتم إنشاء أي حساب.\r\n")),
        "en" => ("Confirm your KM Code Craft account", format!("Hello {name},\r\n\r\nTo activate your account and your company \"{company}\", open this link within {LINK_HOURS} hours:\r\n{link}\r\n\r\nIf you did not request this, ignore this message – no account will be created.\r\n")),
        _ => ("Bitte bestätigen Sie Ihr KM-Code-Craft-Konto", format!("Hallo {name},\r\n\r\num Ihr Konto und Ihre Firma „{company}“ zu aktivieren, öffnen Sie bitte innerhalb von {LINK_HOURS} Stunden diesen Link:\r\n{link}\r\n\r\nWenn Sie das nicht waren, ignorieren Sie diese Nachricht – es wird kein Konto angelegt.\r\n")),
    };
    let db = s.db.clone();
    tokio::spawn(async move {
        crate::mail::system_send(&db, &email, subj, &text, None).await;
    });
    done()
}

#[derive(Debug, Deserialize)]
pub struct ConfirmBody {
    pub token: String,
}

type SignupRow = (Uuid, String, String, Option<String>, String, String, String, Option<String>, String);

pub async fn confirm(
    State(s): State<AppState>,
    headers: HeaderMap,
    Json(b): Json<ConfirmBody>,
) -> ApiResult<Json<Value>> {
    let ip = super::account::client_ip(&headers);
    if !allow(format!("confirm-ip:{ip}"), 20) {
        return Err(ApiError::TooManyRequests);
    }
    let invalid =
        || ApiError::BadRequest("Der Link ist ungültig oder abgelaufen. Bitte registrieren Sie sich erneut.".into());
    if b.token.len() > 200 {
        return Err(invalid());
    }
    let mut tx = s.db.begin().await?;
    let row: Option<SignupRow> = sqlx::query_as(
        "SELECT id, email, display_name, phone, password_hash, company, address, vat_id, locale FROM signup_requests
          WHERE token_hash = $1 AND confirmed_at IS NULL AND expires_at > now() FOR UPDATE",
    )
    .bind(hash_token(b.token.trim()))
    .fetch_optional(&mut *tx)
    .await?;
    let (req, email, name, phone, hash, company, address, vat, locale) = row.ok_or_else(invalid)?;
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower($1))")
        .bind(&email)
        .fetch_one(&mut *tx)
        .await?;
    if exists {
        return Err(ApiError::Conflict(
            "Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte melden Sie sich an.".into(),
        ));
    }
    let org = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO organizations (id, name, address, vat_id, email, locale, contact_name, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(org)
    .bind(&company)
    .bind(&address)
    .bind(&vat)
    .bind(&email)
    .bind(&locale)
    .bind(&name)
    .bind(&phone)
    .execute(&mut *tx)
    .await?;
    let user = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO users (id, email, display_name, role, organization_id, password_hash, locale) VALUES ($1, $2, $3, 'customer', $4, $5, $6)",
    )
    .bind(user)
    .bind(&email)
    .bind(&name)
    .bind(org)
    .bind(&hash)
    .bind(&locale)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE signup_requests SET confirmed_at = now(), user_id = $2, password_hash = '' WHERE id = $1")
        .bind(req)
        .bind(user)
        .execute(&mut *tx)
        .await?;
    let actor = format!("signup:{user}");
    super::audit(&mut tx, &actor, "create", "organization", org, json!({ "name": company, "self_service": true }))
        .await?;
    super::audit(&mut tx, &actor, "create_user", "user", user, json!({ "role": "customer", "self_service": true }))
        .await?;
    tx.commit().await?;

    // Vertrieb und Leitung erfahren von neuen Kunden
    let team = super::shop::team(&s, "SAL").await;
    super::notify::emit(
        &s.db,
        &team,
        super::notify::Note::new("user", "registered", Some(org), &format!("Neuer Kunde: {company}"))
            .body(&format!("{name} · {email}"))
            .link("/portal/kunden"),
    );
    Ok(Json(json!({ "ok": true, "email": email })))
}
