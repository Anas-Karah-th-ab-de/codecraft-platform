//! Login (Passwort + optional TOTP), Logout, 2FA einrichten, Benutzerverwaltung.

use crate::auth::{
    check_totp, hash_password, hash_token, new_token, new_totp_secret, password_policy, totp_for, verify_password, User,
};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use codecraft_domain::access::{Permission, Role};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Sitzungsdauer
const SESSION_HOURS: i64 = 12;

/// Einfaches Rate-Limit gegen Passwort-Raten (pro E-Mail): 5 Fehlversuche / 10 Minuten
static FAILS: Mutex<Option<HashMap<String, (u32, Instant)>>> = Mutex::new(None);

fn too_many(key: &str) -> bool {
    let mut g = FAILS.lock().unwrap_or_else(|e| e.into_inner());
    let m = g.get_or_insert_with(HashMap::new);
    match m.get(key) {
        Some((n, t)) if t.elapsed() < Duration::from_secs(600) => *n >= 5,
        _ => false,
    }
}

fn record_fail(key: &str) {
    let mut g = FAILS.lock().unwrap_or_else(|e| e.into_inner());
    let m = g.get_or_insert_with(HashMap::new);
    let e = m.entry(key.to_owned()).or_insert((0, Instant::now()));
    if e.1.elapsed() >= Duration::from_secs(600) {
        *e = (0, Instant::now());
    }
    e.0 += 1;
}

fn clear_fails(key: &str) {
    if let Some(m) = FAILS.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
        m.remove(key);
    }
}

#[derive(Debug, Deserialize)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
    pub code: Option<String>,
}

type LoginRow = (Uuid, String, String, String, Option<Uuid>, Option<String>, Option<String>);

pub async fn login(State(s): State<AppState>, Json(b): Json<LoginBody>) -> ApiResult<Json<Value>> {
    let email = b.email.trim().to_lowercase();
    if too_many(&email) {
        return Err(ApiError::TooManyRequests);
    }
    let row: Option<LoginRow> = sqlx::query_as(
        "SELECT id, email, display_name, role, organization_id, password_hash, totp_secret
           FROM users WHERE lower(email) = $1 AND is_active",
    )
    .bind(&email)
    .fetch_optional(&s.db)
    .await?;
    let Some((id, email_db, name, role, org, Some(hash), totp)) = row else {
        // gleiche Laufzeit wie bei existierendem Benutzer
        let _ = verify_password(&b.password, "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$AAAAAAAAAAAAAAAAAAAAAA");
        record_fail(&email);
        return Err(ApiError::Unauthorized);
    };
    if !verify_password(&b.password, &hash) {
        record_fail(&email);
        return Err(ApiError::Unauthorized);
    }
    if let Some(secret) = totp {
        match b.code.as_deref().filter(|c| !c.trim().is_empty()) {
            None => return Ok(Json(json!({ "two_factor_required": true }))),
            Some(code) if check_totp(&secret, &email_db, code) => {}
            Some(_) => {
                record_fail(&email);
                return Err(ApiError::BadRequest("2FA-Code ist falsch".into()));
            }
        }
    }
    clear_fails(&email);
    let token = new_token("cc_s_");
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "INSERT INTO api_tokens (id, token_hash, user_id, name, expires_at)
         VALUES ($1, $2, $3, 'session', now() + make_interval(hours => $4))",
    )
    .bind(Uuid::now_v7())
    .bind(hash_token(&token))
    .bind(id)
    .bind(SESSION_HOURS as i32)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE users SET last_login_at = now() WHERE id = $1").bind(id).execute(&mut *tx).await?;
    super::audit(&mut tx, &format!("user:{id}"), "login", "user", id, json!({})).await?;
    tx.commit().await?;
    Ok(Json(json!({
        "token": token,
        "expires_in_s": SESSION_HOURS * 3600,
        "user": { "id": id, "email": email_db, "display_name": name, "role": role, "organization_id": org }
    })))
}

pub async fn logout(State(s): State<AppState>, user: User) -> ApiResult<StatusCode> {
    sqlx::query("UPDATE api_tokens SET revoked_at = now() WHERE id = $1").bind(user.token_id).execute(&s.db).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn me(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    let (name, totp, depts): (String, bool, Vec<String>) = sqlx::query_as(
        "SELECT u.display_name, u.totp_secret IS NOT NULL,
                COALESCE(array_agg(d.code ORDER BY d.code) FILTER (WHERE d.code IS NOT NULL), '{}')
           FROM users u
           LEFT JOIN user_departments ud ON ud.user_id = u.id
           LEFT JOIN departments d ON d.id = ud.department_id
          WHERE u.id = $1 GROUP BY u.id",
    )
    .bind(user.id)
    .fetch_one(&s.db)
    .await?;
    Ok(Json(json!({
        "id": user.id, "email": user.email, "display_name": name, "role": user.role,
        "organization_id": user.organization_id, "two_factor": totp, "departments": depts,
        "is_employee": user.role.is_employee(),
    })))
}

/// 2FA einrichten: neues Geheimnis + QR-Code (PNG, Base64). Aktiv erst nach `enable`.
pub async fn totp_setup(State(s): State<AppState>, user: User) -> ApiResult<Json<Value>> {
    let secret = new_totp_secret();
    let totp = totp_for(&secret, &user.email)?;
    let qr = totp.get_qr_base64().map_err(|e| ApiError::BadRequest(format!("QR: {e}")))?;
    sqlx::query("UPDATE users SET totp_pending_secret = $2 WHERE id = $1")
        .bind(user.id)
        .bind(&secret)
        .execute(&s.db)
        .await?;
    Ok(Json(json!({ "secret": secret, "otpauth_url": totp.get_url(), "qr_png_base64": qr })))
}

#[derive(Debug, Deserialize)]
pub struct CodeBody {
    pub code: String,
}

pub async fn totp_enable(State(s): State<AppState>, user: User, Json(b): Json<CodeBody>) -> ApiResult<StatusCode> {
    let (pending,): (Option<String>,) =
        sqlx::query_as("SELECT totp_pending_secret FROM users WHERE id = $1").bind(user.id).fetch_one(&s.db).await?;
    let pending = pending.ok_or_else(|| ApiError::BadRequest("Zuerst 2FA-Einrichtung starten".into()))?;
    if !check_totp(&pending, &user.email, &b.code) {
        return Err(ApiError::BadRequest("2FA-Code ist falsch".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL WHERE id = $1")
        .bind(user.id)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "2fa_enable", "user", user.id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn totp_disable(State(s): State<AppState>, user: User, Json(b): Json<CodeBody>) -> ApiResult<StatusCode> {
    let (secret,): (Option<String>,) =
        sqlx::query_as("SELECT totp_secret FROM users WHERE id = $1").bind(user.id).fetch_one(&s.db).await?;
    let secret = secret.ok_or_else(|| ApiError::BadRequest("2FA ist nicht aktiv".into()))?;
    if !check_totp(&secret, &user.email, &b.code) {
        return Err(ApiError::BadRequest("2FA-Code ist falsch".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE users SET totp_secret = NULL WHERE id = $1").bind(user.id).execute(&mut *tx).await?;
    super::audit(&mut tx, &user.actor(), "2fa_disable", "user", user.id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct PasswordBody {
    pub current: String,
    pub new: String,
}

pub async fn change_password(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<PasswordBody>,
) -> ApiResult<StatusCode> {
    password_policy(&b.new)?;
    let (hash,): (Option<String>,) =
        sqlx::query_as("SELECT password_hash FROM users WHERE id = $1").bind(user.id).fetch_one(&s.db).await?;
    if !hash.is_some_and(|h| verify_password(&b.current, &h)) {
        return Err(ApiError::BadRequest("Aktuelles Passwort ist falsch".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1")
        .bind(user.id)
        .bind(hash_password(&b.new)?)
        .execute(&mut *tx)
        .await?;
    // alle anderen Sitzungen beenden
    sqlx::query("UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL")
        .bind(user.id)
        .bind(user.token_id)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "password_change", "user", user.id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Benutzerverwaltung (Admin) ──────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub role: String,
    pub organization_id: Option<Uuid>,
    pub is_active: bool,
    pub two_factor: bool,
    pub departments: Vec<String>,
    pub last_login_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn list_users(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<UserRow>>> {
    user.require(Permission::UserManage, None)?;
    let rows = sqlx::query_as(
        "SELECT u.id, u.email, u.display_name, u.role, u.organization_id, u.is_active,
                u.totp_secret IS NOT NULL AS two_factor,
                COALESCE(array_agg(d.code ORDER BY d.code) FILTER (WHERE d.code IS NOT NULL), '{}') AS departments,
                u.last_login_at
           FROM users u
           LEFT JOIN user_departments ud ON ud.user_id = u.id
           LEFT JOIN departments d ON d.id = ud.department_id
          GROUP BY u.id ORDER BY u.display_name",
    )
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct NewUser {
    pub email: String,
    pub display_name: String,
    pub role: Role,
    pub password: String,
    pub organization_id: Option<Uuid>,
    #[serde(default)]
    pub departments: Vec<String>,
}

pub async fn create_user(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewUser>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    user.require(Permission::UserManage, None)?;
    password_policy(&b.password)?;
    if b.role == Role::Device {
        return Err(ApiError::BadRequest("Geräte werden unter /devices registriert".into()));
    }
    if b.role == Role::Customer && b.organization_id.is_none() {
        return Err(ApiError::BadRequest("Kunden brauchen eine Organisation".into()));
    }
    let role = serde_json::to_value(b.role).ok().and_then(|v| v.as_str().map(String::from)).unwrap_or_default();
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "INSERT INTO users (id, email, display_name, role, organization_id, password_hash)
         VALUES ($1, lower($2), $3, $4, $5, $6)",
    )
    .bind(id)
    .bind(b.email.trim())
    .bind(b.display_name.trim())
    .bind(&role)
    .bind(b.organization_id)
    .bind(hash_password(&b.password)?)
    .execute(&mut *tx)
    .await?;
    for (i, code) in b.departments.iter().enumerate() {
        let r = sqlx::query(
            "INSERT INTO user_departments (user_id, department_id, is_primary)
             SELECT $1, id, $3 FROM departments WHERE code = $2",
        )
        .bind(id)
        .bind(code)
        .bind(i == 0)
        .execute(&mut *tx)
        .await?;
        if r.rows_affected() == 0 {
            return Err(ApiError::BadRequest(format!("Abteilung {code} existiert nicht")));
        }
    }
    super::audit(&mut tx, &user.actor(), "create", "user", id, json!({ "email": b.email, "role": role })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

/// Header-Helfer für Logs (IP hinter Proxy)
pub fn client_ip(h: &HeaderMap) -> String {
    h.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .unwrap_or("local")
        .trim()
        .to_owned()
}
