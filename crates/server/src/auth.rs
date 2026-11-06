//! Bearer-Token-Authentifizierung für Benutzer und Geräte.
//! Tokens werden nur als SHA-256-Hash gespeichert.

use crate::error::ApiError;
use crate::AppState;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use codecraft_domain::access::{allowed, Permission, Role};
use rand::RngCore;
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// Neues zufälliges Token (256 Bit) mit Präfix: `cc_u_…` (User) / `cc_d_…` (Device)
pub fn new_token(prefix: &str) -> String {
    let mut b = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut b);
    format!("{prefix}{}", hex::encode(b))
}

fn bearer(parts: &Parts) -> Option<&str> {
    parts.headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?.strip_prefix("Bearer ").map(str::trim)
}

/// Angemeldeter Benutzer
#[derive(Debug, Clone)]
pub struct User {
    pub id: Uuid,
    pub role: Role,
    pub organization_id: Option<Uuid>,
}

impl User {
    pub fn require(&self, perm: Permission, record_org: Option<Uuid>) -> Result<(), ApiError> {
        let own = record_org.is_some() && record_org == self.organization_id;
        if allowed(self.role, perm, own) {
            Ok(())
        } else {
            Err(ApiError::Forbidden)
        }
    }

    pub fn actor(&self) -> String {
        format!("user:{}", self.id)
    }
}

impl FromRequestParts<AppState> for User {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer(parts).ok_or(ApiError::Unauthorized)?;
        let row: Option<(Uuid, String, Option<Uuid>)> = sqlx::query_as(
            "SELECT u.id, u.role, u.organization_id
               FROM api_tokens t JOIN users u ON u.id = t.user_id
              WHERE t.token_hash = $1 AND t.revoked_at IS NULL",
        )
        .bind(hash_token(token))
        .fetch_optional(&state.db)
        .await?;
        let (id, role, organization_id) = row.ok_or(ApiError::Unauthorized)?;
        let role = Role::parse(&role).ok_or(ApiError::Unauthorized)?;
        Ok(User { id, role, organization_id })
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
}
