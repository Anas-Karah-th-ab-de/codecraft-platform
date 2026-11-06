//! Geräte: Registrierung (Admin) und Reports (Gerätetoken).

use crate::auth::{hash_token, new_token, Device, User};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use codecraft_domain::access::Permission;
use codecraft_protocol::{is_compatible, DeviceKind, Level, LicenseState, Report, ReportAck, PROTOCOL_VERSION};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

/// Kulanzzeit nach Lizenzablauf
const GRACE_DAYS: i64 = 7;

fn kind_str(k: DeviceKind) -> &'static str {
    match k {
        DeviceKind::Agent => "agent",
        DeviceKind::Esp32 => "esp32",
        DeviceKind::AiAppliance => "ai_appliance",
        DeviceKind::Pos => "pos",
    }
}

fn level_str(l: Level) -> &'static str {
    match l {
        Level::Info => "info",
        Level::Warn => "warn",
        Level::Error => "error",
    }
}

#[derive(Debug, Deserialize)]
pub struct NewDevice {
    pub kind: DeviceKind,
    pub name: String,
    pub organization_id: Option<Uuid>,
    pub license_expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct RegisteredDevice {
    pub id: Uuid,
    /// Wird nur einmal angezeigt – auf dem Gerät speichern
    pub token: String,
}

pub async fn register(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewDevice>,
) -> ApiResult<(StatusCode, Json<RegisteredDevice>)> {
    user.require(Permission::DeviceManage, None)?;
    if b.name.trim().is_empty() {
        return Err(ApiError::BadRequest("Name fehlt".into()));
    }
    let id = Uuid::now_v7();
    let token = new_token("cc_d_");
    let mut tx = s.db.begin().await?;
    sqlx::query(
        "INSERT INTO devices (id, organization_id, kind, name, token_hash, license_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(id)
    .bind(b.organization_id)
    .bind(kind_str(b.kind))
    .bind(b.name.trim())
    .bind(hash_token(&token))
    .bind(b.license_expires_at)
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "register", "device", id, json!({ "kind": kind_str(b.kind) })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(RegisteredDevice { id, token })))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeviceRow {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub kind: String,
    pub name: String,
    pub version: Option<String>,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub license_expires_at: Option<DateTime<Utc>>,
    pub online: bool,
}

pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<DeviceRow>>> {
    let org = if user.role.is_employee() {
        user.require(Permission::DeviceManage, None)?;
        None
    } else {
        Some(user.organization_id.ok_or(ApiError::Forbidden)?)
    };
    let rows = sqlx::query_as(
        "SELECT id, organization_id, kind, name, version, last_seen_at, license_expires_at,
                COALESCE(last_seen_at > now() - make_interval(secs => report_interval_s * 3), false) AS online
           FROM devices
          WHERE revoked_at IS NULL AND ($1::uuid IS NULL OR organization_id = $1)
          ORDER BY name",
    )
    .bind(org)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

pub fn license_state(kind: &str, expires: Option<DateTime<Utc>>, now: DateTime<Utc>) -> LicenseState {
    match (kind, expires) {
        ("agent", _) => LicenseState::NotRequired,
        (_, None) => LicenseState::Valid { expires_at: None },
        (_, Some(e)) if e > now => LicenseState::Valid { expires_at: Some(e.to_rfc3339()) },
        (_, Some(e)) => {
            let left = GRACE_DAYS - (now - e).num_days();
            if left > 0 {
                LicenseState::Grace { days_left: left as u16 }
            } else {
                LicenseState::Expired
            }
        }
    }
}

pub async fn report(State(s): State<AppState>, device: Device, Json(r): Json<Report>) -> ApiResult<Json<ReportAck>> {
    if !is_compatible(r.protocol) {
        return Err(ApiError::BadRequest(format!("Protokollversion {} nicht unterstützt", r.protocol)));
    }
    if kind_str(r.kind) != device.kind {
        return Err(ApiError::BadRequest("Gerätetyp passt nicht zum Token".into()));
    }
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE devices SET last_seen_at = now(), version = $2, last_report = $3 WHERE id = $1")
        .bind(device.id)
        .bind(&r.version)
        .bind(serde_json::to_value(&r).unwrap_or_default())
        .execute(&mut *tx)
        .await?;
    for e in r.events.iter().take(50) {
        sqlx::query("INSERT INTO device_events (device_id, level, code, message) VALUES ($1, $2, $3, $4)")
            .bind(device.id)
            .bind(level_str(e.level))
            .bind(&e.code)
            .bind(&e.message)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;

    Ok(Json(ReportAck {
        protocol: PROTOCOL_VERSION,
        next_report_s: device.report_interval_s.max(10) as u32,
        license: license_state(&device.kind, device.license_expires_at, Utc::now()),
        update: None, // Firmware-Releases folgen in Meilenstein 3
        commands: vec![],
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn license_states() {
        let now = Utc::now();
        assert_eq!(license_state("agent", Some(now - Duration::days(100)), now), LicenseState::NotRequired);
        assert_eq!(license_state("pos", None, now), LicenseState::Valid { expires_at: None });
        assert!(matches!(license_state("pos", Some(now + Duration::days(1)), now), LicenseState::Valid { .. }));
        assert_eq!(license_state("pos", Some(now - Duration::days(2)), now), LicenseState::Grace { days_left: 5 });
        assert_eq!(license_state("esp32", Some(now - Duration::days(8)), now), LicenseState::Expired);
    }
}
