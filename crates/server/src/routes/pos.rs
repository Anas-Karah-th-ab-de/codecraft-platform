//! Kassensystem (universal-pos-erp) im Portal:
//! * Mitarbeiter legen Lizenzen für Kunden an (Plan, Subdomain, Laufzeit).
//! * Die Master-Kasse verbindet sich mit Portal-Zugangsdaten des Kunden, bekommt einen
//!   eigenen Kassen-Schlüssel, sieht unbenutzte Lizenzen und Backups und fragt den Nutzer.
//! * Lizenzen werden erst bei Aktivierung an den Betrieb (tenant_id) gebunden und mit
//!   Ed25519 signiert (gleiches Format wie `pos_core::license`).
//! * Backups sind Ende-zu-Ende verschlüsselt; das Portal speichert nur Chiffretext.

use crate::auth::{hash_token, new_token, verify_password, check_totp, User};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::body::Bytes;
use axum::extract::{FromRequestParts, Path, Query, State};
use axum::http::request::Parts;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::Engine;
use chrono::{DateTime, Duration, Utc};
use codecraft_domain::access::Permission;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Digest;
use std::path::PathBuf;
use uuid::Uuid;

pub const MAX_BACKUP: usize = 512 * 1024 * 1024;
const KEEP_BACKUPS: i64 = 30;

fn backup_dir() -> PathBuf {
    PathBuf::from(std::env::var("POS_BACKUP_DIR").unwrap_or_else(|_| "data/pos-backups".into()))
}
fn relay_url() -> String {
    std::env::var("KMPOS_RELAY_URL").unwrap_or_else(|_| "wss://relay.code-craft.tech/agent".into())
}
fn tunnel_domain() -> String {
    std::env::var("KMPOS_TUNNEL_DOMAIN").unwrap_or_else(|_| "pos.code-craft.tech".into())
}

// ── Lizenz signieren (kompatibel zu pos_core::license) ──────────────────────

#[derive(Serialize)]
struct LicensePayload<'a> {
    license_id: String,
    tenant_id: &'a str,
    customer: &'a str,
    plan: &'a str,
    extra_features: Vec<String>,
    tunnel_slug: Option<&'a str>,
    relay_url: Option<String>,
    tunnel_domain: Option<String>,
    max_nodes: u32,
    issued_at: String,
    expires_at: String,
}

fn signing_key() -> ApiResult<ed25519_dalek::SigningKey> {
    let b64 = std::env::var("KMPOS_LICENSE_PRIVKEY").map_err(|_| ApiError::Conflict("Lizenzschlüssel des Servers fehlt (KMPOS_LICENSE_PRIVKEY)".into()))?;
    let bytes: [u8; 32] = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .ok()
        .and_then(|b| b.try_into().ok())
        .ok_or_else(|| ApiError::Conflict("KMPOS_LICENSE_PRIVKEY ungültig".into()))?;
    Ok(ed25519_dalek::SigningKey::from_bytes(&bytes))
}

fn sign_license(id: Uuid, tenant_id: &str, customer: &str, plan: &str, slug: &str, expires: DateTime<Utc>) -> ApiResult<String> {
    use ed25519_dalek::Signer;
    let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let p = LicensePayload {
        license_id: id.to_string(),
        tenant_id,
        customer,
        plan,
        extra_features: vec![],
        tunnel_slug: Some(slug),
        relay_url: Some(relay_url()),
        tunnel_domain: Some(tunnel_domain()),
        max_nodes: 0,
        issued_at: Utc::now().to_rfc3339(),
        expires_at: expires.to_rfc3339(),
    };
    let payload = b64.encode(serde_json::to_vec(&p).map_err(|e| ApiError::BadRequest(e.to_string()))?);
    let sig = signing_key()?.sign(payload.as_bytes());
    Ok(format!("KMPOS1.{payload}.{}", b64.encode(sig.to_bytes())))
}

// ── Kassen-Authentifizierung ────────────────────────────────────────────────

pub struct Register {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub tenant_id: String,
}

impl FromRequestParts<AppState> for Register {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .filter(|t| t.starts_with("cc_pos_"))
            .ok_or(ApiError::Unauthorized)?;
        let row: Option<(Uuid, Uuid, String)> =
            sqlx::query_as("SELECT id, organization_id, tenant_id FROM pos_registers WHERE token_hash = $1 AND revoked_at IS NULL")
                .bind(hash_token(token))
                .fetch_optional(&state.db)
                .await?;
        let (id, organization_id, tenant_id) = row.ok_or(ApiError::Unauthorized)?;
        let version = parts.headers.get("x-kmpos-version").and_then(|v| v.to_str().ok()).map(str::to_string);
        sqlx::query("UPDATE pos_registers SET last_seen_at = now(), app_version = COALESCE($2, app_version) WHERE id = $1")
            .bind(id)
            .bind(version)
            .execute(&state.db)
            .await?;
        Ok(Register { id, organization_id, tenant_id })
    }
}

// ── Datentypen ──────────────────────────────────────────────────────────────

#[derive(Serialize, sqlx::FromRow)]
pub struct LicenseRow {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub plan: String,
    pub slug: String,
    pub status: String,
    pub tenant_id: Option<String>,
    pub register_id: Option<Uuid>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub activated_at: Option<DateTime<Utc>>,
    pub note: Option<String>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct RegisterRow {
    pub id: Uuid,
    pub tenant_id: String,
    pub name: String,
    pub app_version: Option<String>,
    pub platform: Option<String>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct BackupRow {
    pub id: Uuid,
    pub tenant_id: String,
    pub business_name: Option<String>,
    pub size_bytes: i64,
    pub sha256: String,
    pub app_version: Option<String>,
    pub created_at: DateTime<Utc>,
}

const LIC_COLS: &str = "id, organization_id, plan, slug, status, tenant_id, register_id, expires_at, created_at, activated_at, note";

async fn org_licenses(s: &AppState, org: Uuid) -> ApiResult<Vec<LicenseRow>> {
    Ok(sqlx::query_as(&format!("SELECT {LIC_COLS} FROM pos_licenses WHERE organization_id = $1 AND status != 'revoked' ORDER BY created_at DESC"))
        .bind(org)
        .fetch_all(&s.db)
        .await?)
}

async fn org_backups(s: &AppState, org: Uuid) -> ApiResult<Vec<BackupRow>> {
    Ok(sqlx::query_as(
        "SELECT id, tenant_id, business_name, size_bytes, sha256, app_version, created_at FROM pos_backups
          WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 100",
    )
    .bind(org)
    .fetch_all(&s.db)
    .await?)
}

// ── Portal: Übersicht für Kunde bzw. Mitarbeiter ────────────────────────────

#[derive(Deserialize)]
pub struct OrgQuery {
    pub organization_id: Option<Uuid>,
}

fn org_of(user: &User, q: Option<Uuid>) -> ApiResult<Uuid> {
    if user.role.is_employee() {
        user.require(Permission::CustomerRead, None)?;
        q.ok_or_else(|| ApiError::BadRequest("organization_id fehlt".into()))
    } else {
        user.organization_id.ok_or(ApiError::Forbidden)
    }
}

pub async fn overview(State(s): State<AppState>, user: User, Query(q): Query<OrgQuery>) -> ApiResult<Json<Value>> {
    let org = org_of(&user, q.organization_id)?;
    let registers: Vec<RegisterRow> = sqlx::query_as(
        "SELECT id, tenant_id, name, app_version, platform, last_seen_at, created_at, revoked_at FROM pos_registers
          WHERE organization_id = $1 ORDER BY created_at DESC",
    )
    .bind(org)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(json!({
        "licenses": org_licenses(&s, org).await?,
        "registers": registers,
        "backups": org_backups(&s, org).await?,
        "tunnel_domain": tunnel_domain(),
    })))
}

/// Hat die Firma etwas mit dem Kassensystem zu tun? (steuert den Menüpunkt im Portal)
pub async fn has_pos(db: &sqlx::PgPool, org: Option<Uuid>) -> bool {
    let Some(org) = org else { return false };
    sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM pos_licenses WHERE organization_id = $1 AND status != 'revoked')
             OR EXISTS (SELECT 1 FROM pos_registers WHERE organization_id = $1)",
    )
    .bind(org)
    .fetch_one(db)
    .await
    .unwrap_or(false)
}

pub async fn revoke_register(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    let org: Uuid = sqlx::query_scalar("SELECT organization_id FROM pos_registers WHERE id = $1")
        .bind(id)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    if user.role.is_employee() {
        user.require(Permission::CustomerWrite, None)?;
    } else if user.organization_id != Some(org) {
        return Err(ApiError::Forbidden);
    }
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE pos_registers SET revoked_at = now() WHERE id = $1").bind(id).execute(&mut *tx).await?;
    super::audit(&mut tx, &user.actor(), "pos_register_revoke", "pos_register", id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Mitarbeiter: Lizenzen verwalten ─────────────────────────────────────────

#[derive(Deserialize)]
pub struct NewLicense {
    pub organization_id: Uuid,
    pub plan: String,
    pub slug: String,
    pub days: i64,
    pub note: Option<String>,
}

pub async fn create_license(State(s): State<AppState>, user: User, Json(b): Json<NewLicense>) -> ApiResult<(StatusCode, Json<LicenseRow>)> {
    user.require(Permission::CustomerWrite, None)?;
    let slug = b.slug.trim().to_lowercase();
    if !["basic", "pro", "business"].contains(&b.plan.as_str()) || !(1..=3660).contains(&b.days) {
        return Err(ApiError::BadRequest("Plan oder Laufzeit ungültig".into()));
    }
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    let row: LicenseRow = sqlx::query_as(&format!(
        "INSERT INTO pos_licenses (id, organization_id, plan, slug, expires_at, created_by, note)
         VALUES ($1, $2, $3, $4, now() + make_interval(days => $5), $6, $7) RETURNING {LIC_COLS}"
    ))
    .bind(id)
    .bind(b.organization_id)
    .bind(&b.plan)
    .bind(&slug)
    .bind(b.days as i32)
    .bind(user.id)
    .bind(b.note.as_deref())
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(d) if d.is_unique_violation() => ApiError::Conflict("Subdomain bereits vergeben".into()),
        sqlx::Error::Database(d) if d.is_check_violation() => ApiError::BadRequest("Subdomain: 3–42 Zeichen a–z, 0–9, -".into()),
        _ => ApiError::Db(e),
    })?;
    super::audit(&mut tx, &user.actor(), "pos_license_create", "pos_license", id, json!({"plan": b.plan, "slug": slug, "days": b.days})).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(row)))
}

#[derive(Deserialize)]
pub struct Extend {
    pub days: i64,
}

/// Verlängern: aktive Lizenz wird neu signiert; die Kasse holt sie beim nächsten Abgleich selbst.
pub async fn extend_license(State(s): State<AppState>, user: User, Path(id): Path<Uuid>, Json(b): Json<Extend>) -> ApiResult<Json<LicenseRow>> {
    user.require(Permission::CustomerWrite, None)?;
    if !(1..=3660).contains(&b.days) {
        return Err(ApiError::BadRequest("Laufzeit ungültig".into()));
    }
    let mut tx = s.db.begin().await?;
    let (status, tenant, plan, slug, org, exp): (String, Option<String>, String, String, Uuid, DateTime<Utc>) =
        sqlx::query_as("SELECT status, tenant_id, plan, slug, organization_id, expires_at FROM pos_licenses WHERE id = $1 FOR UPDATE")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(ApiError::NotFound)?;
    if status == "revoked" {
        return Err(ApiError::Conflict("Lizenz ist gesperrt".into()));
    }
    let new_exp = exp.max(Utc::now()) + Duration::days(b.days);
    let key = match (&status[..], &tenant) {
        ("active", Some(t)) => Some(sign_license(id, t, &customer_name(&s, org).await?, &plan, &slug, new_exp)?),
        _ => None,
    };
    sqlx::query("UPDATE pos_licenses SET expires_at = $2, signed_key = COALESCE($3, signed_key) WHERE id = $1")
        .bind(id)
        .bind(new_exp)
        .bind(key)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "pos_license_extend", "pos_license", id, json!({"days": b.days})).await?;
    let row: LicenseRow = sqlx::query_as(&format!("SELECT {LIC_COLS} FROM pos_licenses WHERE id = $1")).bind(id).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn revoke_license(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    user.require(Permission::CustomerWrite, None)?;
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE pos_licenses SET status = 'revoked' WHERE id = $1").bind(id).execute(&mut *tx).await?;
    super::audit(&mut tx, &user.actor(), "pos_license_revoke", "pos_license", id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn customer_name(s: &AppState, org: Uuid) -> ApiResult<String> {
    Ok(sqlx::query_scalar("SELECT name FROM organizations WHERE id = $1").bind(org).fetch_one(&s.db).await?)
}

// ── Kasse ↔ Portal ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LinkBody {
    pub email: String,
    pub password: String,
    pub code: Option<String>,
    pub tenant_id: String,
    pub name: String,
    pub app_version: Option<String>,
    pub platform: Option<String>,
}

/// Kasse mit Kundenkonto verbinden (Inhaber meldet sich einmal mit Portal-Zugang an).
pub async fn link(State(s): State<AppState>, Json(b): Json<LinkBody>) -> ApiResult<Json<Value>> {
    let email = b.email.trim().to_lowercase();
    if super::account::too_many(&email) {
        return Err(ApiError::TooManyRequests);
    }
    let row: Option<(Uuid, String, Option<Uuid>, Option<String>, Option<String>)> =
        sqlx::query_as("SELECT id, email, organization_id, password_hash, totp_secret FROM users WHERE lower(email) = $1 AND is_active")
            .bind(&email)
            .fetch_optional(&s.db)
            .await?;
    let Some((uid, email_db, Some(org), Some(hash), totp)) = row else {
        super::account::record_fail(&email);
        return Err(ApiError::Unauthorized);
    };
    if !verify_password(&b.password, &hash) {
        super::account::record_fail(&email);
        return Err(ApiError::Unauthorized);
    }
    if let Some(secret) = totp {
        match b.code.as_deref().filter(|c| !c.trim().is_empty()) {
            None => return Ok(Json(json!({ "two_factor_required": true }))),
            Some(c) if check_totp(&secret, &email_db, c) => {}
            Some(_) => {
                super::account::record_fail(&email);
                return Err(ApiError::BadRequest("2FA-Code ist falsch".into()));
            }
        }
    }
    super::account::clear_fails(&email);
    let tenant = b.tenant_id.trim();
    if tenant.len() < 8 || tenant.len() > 64 {
        return Err(ApiError::BadRequest("Betriebs-ID ungültig".into()));
    }
    let token = new_token("cc_pos_");
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    // Gleiche Kasse erneut verbunden → alten Schlüssel ersetzen
    sqlx::query("UPDATE pos_registers SET revoked_at = now() WHERE organization_id = $1 AND tenant_id = $2 AND revoked_at IS NULL")
        .bind(org)
        .bind(tenant)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO pos_registers (id, organization_id, tenant_id, name, token_hash, linked_by, app_version, platform, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())",
    )
    .bind(id)
    .bind(org)
    .bind(tenant)
    .bind(b.name.trim().chars().take(80).collect::<String>())
    .bind(hash_token(&token))
    .bind(uid)
    .bind(b.app_version.as_deref())
    .bind(b.platform.as_deref())
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &format!("user:{uid}"), "pos_link", "pos_register", id, json!({"tenant_id": tenant})).await?;
    tx.commit().await?;
    Ok(Json(json!({
        "token": token,
        "register_id": id,
        "organization": { "id": org, "name": customer_name(&s, org).await? },
        "offers": offers_for(&s, org, tenant).await?,
    })))
}

async fn offers_for(s: &AppState, org: Uuid, tenant: &str) -> ApiResult<Value> {
    let lic = org_licenses(s, org).await?;
    let (mine, available): (Vec<_>, Vec<_>) = lic.into_iter().partition(|l| l.tenant_id.as_deref() == Some(tenant));
    let available: Vec<_> = available.into_iter().filter(|l| l.status == "available" && l.expires_at > Utc::now()).collect();
    let backups = org_backups(s, org).await?;
    Ok(json!({ "current": mine.into_iter().find(|l| l.status == "active"), "available": available, "backups": backups }))
}

pub async fn offers(State(s): State<AppState>, r: Register) -> ApiResult<Json<Value>> {
    Ok(Json(offers_for(&s, r.organization_id, &r.tenant_id).await?))
}

#[derive(Deserialize)]
pub struct Activate {
    pub license_id: Uuid,
}

/// Unbenutzte Lizenz an diese Kasse binden und signieren.
pub async fn activate(State(s): State<AppState>, r: Register, Json(b): Json<Activate>) -> ApiResult<Json<Value>> {
    let mut tx = s.db.begin().await?;
    let (status, org, plan, slug, exp, tenant): (String, Uuid, String, String, DateTime<Utc>, Option<String>) = sqlx::query_as(
        "SELECT status, organization_id, plan, slug, expires_at, tenant_id FROM pos_licenses WHERE id = $1 FOR UPDATE",
    )
    .bind(b.license_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    if org != r.organization_id {
        return Err(ApiError::Forbidden);
    }
    let reuse = status == "active" && tenant.as_deref() == Some(r.tenant_id.as_str());
    if status != "available" && !reuse {
        return Err(ApiError::Conflict("Lizenz ist bereits einer anderen Kasse zugeordnet".into()));
    }
    // Eine aktive Lizenz pro Betrieb: frühere wieder freigeben
    sqlx::query("UPDATE pos_licenses SET status = 'available', tenant_id = NULL, register_id = NULL, signed_key = NULL WHERE tenant_id = $1 AND status = 'active' AND id != $2")
        .bind(&r.tenant_id)
        .bind(b.license_id)
        .execute(&mut *tx)
        .await?;
    let key = sign_license(b.license_id, &r.tenant_id, &customer_name(&s, org).await?, &plan, &slug, exp)?;
    sqlx::query(
        "UPDATE pos_licenses SET status = 'active', tenant_id = $2, register_id = $3, signed_key = $4, activated_at = COALESCE(activated_at, now()) WHERE id = $1",
    )
    .bind(b.license_id)
    .bind(&r.tenant_id)
    .bind(r.id)
    .bind(&key)
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &format!("pos:{}", r.id), "pos_license_activate", "pos_license", b.license_id, json!({"tenant_id": r.tenant_id})).await?;
    tx.commit().await?;
    Ok(Json(json!({ "key": key, "public_url": format!("https://{slug}.{}", tunnel_domain()) })))
}

/// Aktuelle (ggf. verlängerte) Lizenz – die Kasse fragt regelmäßig nach.
pub async fn current_license(State(s): State<AppState>, r: Register) -> ApiResult<Json<Value>> {
    let row: Option<(Option<String>, DateTime<Utc>)> =
        sqlx::query_as("SELECT signed_key, expires_at FROM pos_licenses WHERE tenant_id = $1 AND status = 'active' AND organization_id = $2")
            .bind(&r.tenant_id)
            .bind(r.organization_id)
            .fetch_optional(&s.db)
            .await?;
    Ok(Json(match row {
        Some((key, exp)) => json!({ "key": key, "expires_at": exp }),
        None => json!({ "key": null }),
    }))
}

pub async fn unlink(State(s): State<AppState>, r: Register) -> ApiResult<StatusCode> {
    sqlx::query("UPDATE pos_registers SET revoked_at = now() WHERE id = $1").bind(r.id).execute(&s.db).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Verschlüsseltes Backup hochladen (Rohdaten im Body). Ältere als die letzten 30 werden entfernt.
pub async fn upload_backup(State(s): State<AppState>, r: Register, headers: HeaderMap, body: Bytes) -> ApiResult<(StatusCode, Json<Value>)> {
    if body.len() < 64 {
        return Err(ApiError::BadRequest("Backup leer".into()));
    }
    // Format-Kennung der Kasse: verschlüsselt (KMBK1 + Salt + Nonce + Chiffretext)
    if !body.starts_with(b"KMBK1") {
        return Err(ApiError::BadRequest("Nur verschlüsselte Backups werden angenommen".into()));
    }
    let sha = hex::encode(sha2::Sha256::digest(&body));
    if let Some(claimed) = headers.get("x-sha256").and_then(|v| v.to_str().ok()) {
        if !claimed.eq_ignore_ascii_case(&sha) {
            return Err(ApiError::BadRequest("Prüfsumme stimmt nicht".into()));
        }
    }
    let id = Uuid::now_v7();
    let dir = backup_dir().join(r.organization_id.to_string());
    tokio::fs::create_dir_all(&dir).await.map_err(|e| ApiError::Conflict(format!("Speicher: {e}")))?;
    let path = dir.join(format!("{id}.kmbk"));
    tokio::fs::write(&path, &body).await.map_err(|e| ApiError::Conflict(format!("Speicher: {e}")))?;
    let name = headers.get("x-business-name").and_then(|v| v.to_str().ok()).map(|v| pct_decode(v).chars().take(120).collect::<String>());
    let version = headers.get("x-kmpos-version").and_then(|v| v.to_str().ok()).map(str::to_string);
    sqlx::query(
        "INSERT INTO pos_backups (id, organization_id, register_id, tenant_id, business_name, size_bytes, sha256, app_version, path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(id)
    .bind(r.organization_id)
    .bind(r.id)
    .bind(&r.tenant_id)
    .bind(name)
    .bind(body.len() as i64)
    .bind(&sha)
    .bind(version)
    .bind(path.to_string_lossy().to_string())
    .execute(&s.db)
    .await?;
    // Aufräumen je Betrieb
    let old: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id, path FROM pos_backups WHERE organization_id = $1 AND tenant_id = $2 ORDER BY created_at DESC OFFSET $3",
    )
    .bind(r.organization_id)
    .bind(&r.tenant_id)
    .bind(KEEP_BACKUPS)
    .fetch_all(&s.db)
    .await?;
    for (oid, p) in old {
        let _ = tokio::fs::remove_file(&p).await;
        sqlx::query("DELETE FROM pos_backups WHERE id = $1").bind(oid).execute(&s.db).await?;
    }
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "sha256": sha }))))
}

pub async fn download_backup(State(s): State<AppState>, r: Register, Path(id): Path<Uuid>) -> ApiResult<Response> {
    let (org, path): (Uuid, String) = sqlx::query_as("SELECT organization_id, path FROM pos_backups WHERE id = $1")
        .bind(id)
        .fetch_optional(&s.db)
        .await?
        .ok_or(ApiError::NotFound)?;
    if org != r.organization_id {
        return Err(ApiError::Forbidden);
    }
    let data = tokio::fs::read(&path).await.map_err(|_| ApiError::NotFound)?;
    Ok(([(header::CONTENT_TYPE, "application/octet-stream")], data).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn license_format_matches_pos() {
        std::env::set_var("KMPOS_LICENSE_PRIVKEY", base64::engine::general_purpose::STANDARD.encode([7u8; 32]));
        let k = sign_license(Uuid::nil(), "T1", "Café", "basic", "cafe", Utc::now() + Duration::days(1)).unwrap();
        let mut parts = k.split('.');
        assert_eq!(parts.next(), Some("KMPOS1"));
        let payload = parts.next().unwrap();
        let sig = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(parts.next().unwrap()).unwrap();
        let vk = ed25519_dalek::SigningKey::from_bytes(&[7u8; 32]).verifying_key();
        use ed25519_dalek::Verifier;
        vk.verify(payload.as_bytes(), &ed25519_dalek::Signature::from_slice(&sig).unwrap()).unwrap();
        let v: Value = serde_json::from_slice(&base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(payload).unwrap()).unwrap();
        assert_eq!(v["plan"], "basic");
        assert_eq!(v["tunnel_slug"], "cafe");
    }
}

/// Kasse sendet den Betriebsnamen UTF-8-percent-kodiert (HTTP-Header sind ASCII).
fn pct_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() && s.is_char_boundary(i + 3) {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod pct_tests {
    #[test]
    fn decodes_arabic() {
        assert_eq!(super::pct_decode("Caf%C3%A9 %D9%85"), "Café م");
        assert_eq!(super::pct_decode("100%"), "100%");
    }
}
