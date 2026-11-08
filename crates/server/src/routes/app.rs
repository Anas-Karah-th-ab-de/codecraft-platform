//! Portal-App (Android, Windows, Linux): Installation anmelden.
//!
//! Die App bekommt zwei Zugänge, die nur auf dem Gerät gespeichert werden:
//! - einen persönlichen Schlüssel für Mitteilungen/Anrufe (Ereignis-Stream, auch im Hintergrund)
//! - ein Gerätetoken für den Fernwartungs-Agenten – der verbindet sich erst, wenn der Benutzer
//!   „Support-Zugriff“ startet. Kunden geben den Zugriff zusätzlich per Einmal-Code frei.

use crate::auth::{hash_token, new_token, User};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct EnrollIn {
    /// Zufällige ID der Installation (von der App erzeugt und gespeichert)
    pub install_id: String,
    pub name: String,
    pub platform: String,
}

pub async fn enroll(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<EnrollIn>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let install = b.install_id.trim();
    if !(8..=80).contains(&install.len()) || !install.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(ApiError::BadRequest("Ungültige Installations-ID".into()));
    }
    if !["android", "windows", "linux", "macos", "ios"].contains(&b.platform.as_str()) {
        return Err(ApiError::BadRequest("Unbekannte Plattform".into()));
    }
    let name: String = b.name.trim().chars().take(60).collect();
    let name = if name.is_empty() { format!("App ({})", b.platform) } else { name };
    let mut tx = s.db.begin().await?;
    // Neuanmeldung derselben Installation: alte Zugänge ungültig machen
    let old: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE devices SET revoked_at = now() WHERE owner_user_id = $1 AND install_id = $2 AND revoked_at IS NULL RETURNING id",
    )
    .bind(user.id)
    .bind(install)
    .fetch_all(&mut *tx)
    .await?;
    let old_keys: Vec<Uuid> = sqlx::query_scalar(
        "UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND name = $2 AND revoked_at IS NULL RETURNING id",
    )
    .bind(user.id)
    .bind(format!("app:{install}"))
    .fetch_all(&mut *tx)
    .await?;
    let device_id = Uuid::now_v7();
    let device_token = new_token("cc_d_");
    let display_name: String =
        sqlx::query_scalar("SELECT display_name FROM users WHERE id = $1").bind(user.id).fetch_one(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO devices (id, organization_id, kind, name, token_hash, owner_user_id, install_id, platform, report_interval_s)
         VALUES ($1, $2, 'agent', $3, $4, $5, $6, $7, 300)",
    )
    .bind(device_id)
    .bind(user.organization_id)
    .bind(format!("{name} · {display_name}"))
    .bind(hash_token(&device_token))
    .bind(user.id)
    .bind(install)
    .bind(&b.platform)
    .execute(&mut *tx)
    .await?;
    let key = new_token("cc_u_");
    sqlx::query(
        "INSERT INTO api_tokens (id, token_hash, user_id, name, expires_at) VALUES ($1, $2, $3, $4, now() + interval '365 days')",
    )
    .bind(Uuid::now_v7())
    .bind(hash_token(&key))
    .bind(user.id)
    .bind(format!("app:{install}"))
    .execute(&mut *tx)
    .await?;
    super::audit(
        &mut tx,
        &user.actor(),
        "app_enroll",
        "device",
        device_id,
        json!({ "platform": b.platform, "name": name, "replaced": old }),
    )
    .await?;
    tx.commit().await?;
    for d in old {
        super::remote::drop_device(d);
    }
    for k in old_keys {
        super::chat::kick_token(k);
    }
    Ok((
        StatusCode::CREATED,
        Json(json!({ "device_id": device_id, "device_token": device_token, "key": key, "name": name })),
    ))
}
