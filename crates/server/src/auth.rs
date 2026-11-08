//! Authentifizierung: Bearer-Tokens (nur SHA-256 gespeichert), Passwörter (Argon2id), TOTP-2FA.

use crate::error::ApiError;
use crate::AppState;
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use codecraft_domain::access::{allowed_in, Permission, Role};
use rand::RngCore;
use sha2::{Digest, Sha256};
use totp_rs::{Algorithm, Secret, TOTP};
use uuid::Uuid;

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// Neues zufälliges Token (256 Bit) mit Präfix: `cc_u_` (API), `cc_s_` (Sitzung), `cc_d_` (Gerät)
pub fn new_token(prefix: &str) -> String {
    let mut b = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut b);
    format!("{prefix}{}", hex::encode(b))
}

pub fn hash_password(pw: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(pw.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| ApiError::BadRequest("Passwort konnte nicht verarbeitet werden".into()))
}

pub fn verify_password(pw: &str, hash: &str) -> bool {
    PasswordHash::new(hash).is_ok_and(|h| Argon2::default().verify_password(pw.as_bytes(), &h).is_ok())
}

pub fn password_policy(pw: &str) -> Result<(), ApiError> {
    if pw.chars().count() < 10 {
        return Err(ApiError::BadRequest("Passwort muss mindestens 10 Zeichen haben".into()));
    }
    Ok(())
}

pub fn totp_for(secret_b32: &str, account: &str) -> Result<TOTP, ApiError> {
    let bytes = Secret::Encoded(secret_b32.to_owned())
        .to_bytes()
        .map_err(|_| ApiError::BadRequest("ungültiges 2FA-Geheimnis".into()))?;
    TOTP::new(Algorithm::SHA1, 6, 1, 30, bytes, Some("KM Code Craft".into()), account.to_owned())
        .map_err(|e| ApiError::BadRequest(format!("2FA: {e}")))
}

pub fn new_totp_secret() -> String {
    Secret::generate_secret().to_encoded().to_string()
}

pub fn check_totp(secret_b32: &str, account: &str, code: &str) -> bool {
    let code: String = code.chars().filter(|c| c.is_ascii_digit()).collect();
    totp_for(secret_b32, account).is_ok_and(|t| t.check_current(&code).unwrap_or(false))
}

fn bearer(parts: &Parts) -> Option<&str> {
    parts.headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?.strip_prefix("Bearer ").map(str::trim)
}

/// Angemeldeter Benutzer
#[derive(Debug, Clone)]
pub struct User {
    pub id: Uuid,
    pub token_id: Uuid,
    pub email: String,
    pub role: Role,
    pub organization_id: Option<Uuid>,
    /// Abteilungskürzel (ACC, SAL, SUP, DEV, MGT) – grenzen die Rechte auf Bereiche ein
    pub departments: Vec<String>,
}

impl User {
    /// Darf der Mitarbeiter das in seinen Abteilungen? (Kunden: nur eigene Firma)
    pub fn can(&self, perm: Permission) -> bool {
        allowed_in(self.role, &self.departments, perm, self.organization_id.is_some())
    }

    pub fn require(&self, perm: Permission, record_org: Option<Uuid>) -> Result<(), ApiError> {
        let own = record_org.is_some() && record_org == self.organization_id;
        if allowed_in(self.role, &self.departments, perm, own) {
            Ok(())
        } else {
            Err(ApiError::Forbidden)
        }
    }

    pub fn actor(&self) -> String {
        format!("user:{}", self.id)
    }
}

type UserRow = (Uuid, Uuid, String, String, Option<Uuid>, bool, Vec<String>);

/// Was ein Benutzer mit Einmal-Passwort aufrufen darf, bevor er ein eigenes gesetzt hat
const BEFORE_PASSWORD_CHANGE: &[&str] = &["/api/v1/me", "/api/v1/auth/password", "/api/v1/auth/logout"];

/// Zufälliges Einmal-Passwort, gut abtippbar (ohne 0/O, 1/l/I): `abcd-efgh-jkmn-pqrs` (~93 Bit)
pub fn onetime_password() -> String {
    const A: &[u8] = b"abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = (0..16).map(|_| A[(rng.next_u32() as usize) % A.len()] as char).collect();
    chars.chunks(4).map(|c| c.iter().collect::<String>()).collect::<Vec<_>>().join("-")
}

impl FromRequestParts<AppState> for User {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer(parts).ok_or(ApiError::Unauthorized)?;
        let row: Option<UserRow> = sqlx::query_as(
            "SELECT u.id, t.id, u.email, u.role, u.organization_id, u.must_change_password,
                    ARRAY(SELECT d.code FROM user_departments ud JOIN departments d ON d.id = ud.department_id
                           WHERE ud.user_id = u.id ORDER BY d.code)
               FROM api_tokens t JOIN users u ON u.id = t.user_id
              WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.is_active
                AND (t.expires_at IS NULL OR t.expires_at > now())",
        )
        .bind(hash_token(token))
        .fetch_optional(&state.db)
        .await?;
        let (id, token_id, email, role, organization_id, must_change, departments) =
            row.ok_or(ApiError::Unauthorized)?;
        if must_change && !BEFORE_PASSWORD_CHANGE.contains(&parts.uri.path()) {
            return Err(ApiError::PasswordChangeRequired);
        }
        let role = Role::parse(&role).ok_or(ApiError::Unauthorized)?;
        Ok(User { id, token_id, email, role, organization_id, departments })
    }
}

/// Authentifiziertes Gerät
#[derive(Debug, Clone)]
pub struct Device {
    pub id: Uuid,
    pub kind: String,
    pub license_expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub report_interval_s: i32,
}

type DeviceRow = (Uuid, String, Option<chrono::DateTime<chrono::Utc>>, i32);

impl FromRequestParts<AppState> for Device {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer(parts).ok_or(ApiError::Unauthorized)?;
        let row: Option<DeviceRow> = sqlx::query_as(
            "SELECT id, kind, license_expires_at, report_interval_s
               FROM devices WHERE token_hash = $1 AND revoked_at IS NULL",
        )
        .bind(hash_token(token))
        .fetch_optional(&state.db)
        .await?;
        let (id, kind, license_expires_at, report_interval_s) = row.ok_or(ApiError::Unauthorized)?;
        Ok(Device { id, kind, license_expires_at, report_interval_s })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_format_and_hash() {
        let t = new_token("cc_u_");
        assert!(t.starts_with("cc_u_"));
        assert_eq!(t.len(), 5 + 64);
        assert_ne!(new_token("cc_u_"), t);
        assert_eq!(hash_token("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    #[test]
    fn passwords() {
        let h = hash_password("sehr-geheim-123").unwrap();
        assert!(h.starts_with("$argon2id$"));
        assert!(verify_password("sehr-geheim-123", &h));
        assert!(!verify_password("falsch", &h));
        assert!(password_policy("kurz").is_err());
        let o = onetime_password();
        assert_eq!(o.len(), 19);
        assert!(password_policy(&o).is_ok());
        assert!(!o.contains(['0', 'O', '1', 'l', 'I']));
        assert_ne!(o, onetime_password());
    }

    #[test]
    fn totp_roundtrip() {
        let s = new_totp_secret();
        let code = totp_for(&s, "a@b.c").unwrap().generate_current().unwrap();
        assert!(check_totp(&s, "a@b.c", &code));
        assert!(!check_totp(&s, "a@b.c", "000000") || code == "000000");
    }
}
