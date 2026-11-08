//! Einmal-Zugriffscodes für Kundengeräte.
//!
//! Der Kunde wählt in seiner App Geräte (Handy, Laptop, IoT, Router …) und eine Dauer und
//! bekommt einen 9-stelligen Code. Der Techniker löst ihn innerhalb von 15 Minuten ein und hat
//! danach für die gewählte Dauer Zugriff – nur auf genau diese Geräte. Der Kunde kann jederzeit
//! beenden. Ohne gültigen Code kein Zugriff auf Kundengeräte (außer der Kunde erlaubt für ein
//! Gerät ausdrücklich Dauerzugriff, z. B. bei Wartungsvertrag).

use crate::auth::{hash_token, User};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use codecraft_domain::access::{allowed_in, Permission, Role};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use uuid::Uuid;

/// Zeit zum Einlösen eines Codes
const REDEEM_MINUTES: i32 = 15;

/// Fehlversuche beim Einlösen je Techniker: 5 pro 10 Minuten
static FAILS: Mutex<Option<HashMap<Uuid, (u32, Instant)>>> = Mutex::new(None);

fn throttled(user: Uuid) -> bool {
    let mut g = FAILS.lock().unwrap_or_else(|e| e.into_inner());
    matches!(g.get_or_insert_with(HashMap::new).get(&user), Some((n, t)) if t.elapsed() < Duration::from_secs(600) && *n >= 5)
}

fn fail(user: Uuid) {
    let mut g = FAILS.lock().unwrap_or_else(|e| e.into_inner());
    let e = g.get_or_insert_with(HashMap::new).entry(user).or_insert((0, Instant::now()));
    if e.1.elapsed() >= Duration::from_secs(600) {
        *e = (0, Instant::now());
    }
    e.0 += 1;
}

/// Nur Ziffern; Leerzeichen/Bindestriche aus der Anzeige werden ignoriert
pub fn normalize(code: &str) -> String {
    code.chars().filter(char::is_ascii_digit).collect()
}

fn new_code() -> String {
    format!("{:09}", rand::thread_rng().gen_range(0..1_000_000_000u32))
}

/// Anzeigeform `123 456 789`
pub fn display(code: &str) -> String {
    code.as_bytes().chunks(3).map(|c| String::from_utf8_lossy(c).into_owned()).collect::<Vec<_>>().join(" ")
}

/// Darf dieser Benutzer das Gerät fernsteuern?
/// - interne Geräte (ohne Kunde): Mitarbeiter mit Geräterechten
/// - Kundengeräte: zusätzlich gültiger, eingelöster Code – oder Kunde erlaubt Dauerzugriff
pub async fn authorize(db: &PgPool, user: Uuid, role: Role, device: Uuid) -> ApiResult<()> {
    // Abteilungen frisch aus der DB – greift auch bei der Nachprüfung laufender Sitzungen
    let depts: Vec<String> = sqlx::query_scalar(
        "SELECT d.code FROM user_departments ud JOIN departments d ON d.id = ud.department_id WHERE ud.user_id = $1",
    )
    .bind(user)
    .fetch_all(db)
    .await?;
    if !allowed_in(role, &depts, Permission::DeviceManage, false) {
        return Err(ApiError::Forbidden);
    }
    let (org, policy): (Option<Uuid>, String) =
        sqlx::query_as("SELECT organization_id, access_policy FROM devices WHERE id = $1 AND revoked_at IS NULL")
            .bind(device)
            .fetch_optional(db)
            .await?
            .ok_or(ApiError::NotFound)?;
    if org.is_none() || policy == "staff" {
        return Ok(());
    }
    let ok: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM access_grants
                         WHERE redeemed_by = $1 AND $2 = ANY(device_ids)
                           AND revoked_at IS NULL AND access_until > now())",
    )
    .bind(user)
    .bind(device)
    .fetch_one(db)
    .await?;
    if ok {
        Ok(())
    } else {
        Err(ApiError::AccessCodeRequired)
    }
}

/// Bildschirm sehen/steuern: wie `authorize`, zusätzlich mit gültiger persönlicher Freigabe des Geräte-Besitzers
/// (z. B. im Anruf). Befehle und Dateien bleiben bei `authorize`.
pub async fn authorize_screen(db: &PgPool, user: Uuid, role: Role, device: Uuid) -> ApiResult<()> {
    if has_share(db, user, device).await? {
        return Ok(());
    }
    authorize(db, user, role, device).await
}

async fn has_share(db: &PgPool, user: Uuid, device: Uuid) -> ApiResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM device_shares s JOIN devices d ON d.id = s.device_id
                         JOIN users o ON o.id = s.owner_id
                         WHERE s.device_id = $1 AND s.grantee_id = $2 AND s.revoked_at IS NULL
                           AND s.expires_at > now() AND d.revoked_at IS NULL AND o.is_active)",
    )
    .bind(device)
    .bind(user)
    .fetch_one(db)
    .await?)
}

#[derive(Deserialize)]
pub struct NewShare {
    /// Kolleginnen/Kollegen (nur Mitarbeiter), die den Bildschirm sehen und steuern dürfen
    pub users: Vec<Uuid>,
    /// Dauer 5–240 Minuten, Standard 60
    pub minutes: Option<i32>,
}

/// Eigenes Gerät (App) für bestimmte Mitarbeiter freigeben – z. B. im laufenden Anruf
pub async fn share(
    State(s): State<AppState>,
    user: User,
    Path(device): Path<Uuid>,
    Json(b): Json<NewShare>,
) -> ApiResult<Json<Value>> {
    let owner: Option<Option<Uuid>> =
        sqlx::query_scalar("SELECT owner_user_id FROM devices WHERE id = $1 AND revoked_at IS NULL")
            .bind(device)
            .fetch_optional(&s.db)
            .await?;
    if owner.flatten() != Some(user.id) {
        return Err(ApiError::Forbidden);
    }
    let minutes = b.minutes.unwrap_or(60).clamp(5, 240);
    let grantees: Vec<Uuid> =
        sqlx::query_scalar("SELECT id FROM users WHERE id = ANY($1) AND id <> $2 AND is_active AND role <> 'customer'")
            .bind(&b.users)
            .bind(user.id)
            .fetch_all(&s.db)
            .await?;
    if grantees.is_empty() {
        return Err(ApiError::BadRequest("Freigabe nur für Mitarbeiter möglich".into()));
    }
    let mut tx = s.db.begin().await?;
    for g in &grantees {
        sqlx::query(
            "UPDATE device_shares SET revoked_at = now() WHERE device_id = $1 AND grantee_id = $2 AND revoked_at IS NULL",
        )
        .bind(device)
        .bind(g)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO device_shares (id, device_id, owner_id, grantee_id, expires_at)
             VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))",
        )
        .bind(Uuid::now_v7())
        .bind(device)
        .bind(user.id)
        .bind(g)
        .bind(minutes)
        .execute(&mut *tx)
        .await?;
    }
    super::audit(&mut tx, &user.actor(), "share", "device", device, json!({ "users": grantees, "minutes": minutes }))
        .await?;
    tx.commit().await?;
    Ok(Json(json!({ "users": grantees, "minutes": minutes })))
}

/// Alle Freigaben des eigenen Geräts beenden (laufende Bildschirm-Sitzungen enden binnen 15 s)
pub async fn unshare(State(s): State<AppState>, user: User, Path(device): Path<Uuid>) -> ApiResult<StatusCode> {
    let n = sqlx::query(
        "UPDATE device_shares SET revoked_at = now() WHERE device_id = $1 AND owner_id = $2 AND revoked_at IS NULL",
    )
    .bind(device)
    .bind(user.id)
    .execute(&s.db)
    .await?
    .rows_affected();
    if n > 0 {
        let mut c = s.db.acquire().await?;
        super::audit(&mut c, &user.actor(), "unshare", "device", device, json!({ "count": n })).await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

fn customer_org(user: &User) -> ApiResult<Uuid> {
    if user.role != Role::Customer {
        return Err(ApiError::Forbidden);
    }
    user.organization_id.ok_or(ApiError::Forbidden)
}

#[derive(Deserialize)]
pub struct NewCode {
    pub device_ids: Vec<Uuid>,
    /// Zugriffsdauer nach dem Einlösen (5–480 Minuten, Standard 60)
    pub minutes: Option<i32>,
}

/// Kunde: Code für ausgewählte eigene Geräte erzeugen (Klartext nur in dieser Antwort)
pub async fn create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewCode>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let org = customer_org(&user)?;
    let mut ids = b.device_ids;
    ids.sort();
    ids.dedup();
    if ids.is_empty() || ids.len() > 50 {
        return Err(ApiError::BadRequest("Bitte 1 bis 50 Geräte auswählen".into()));
    }
    let minutes = b.minutes.unwrap_or(60);
    if !(5..=480).contains(&minutes) {
        return Err(ApiError::BadRequest("Dauer muss zwischen 5 und 480 Minuten liegen".into()));
    }
    let own: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM devices WHERE id = ANY($1) AND organization_id = $2 AND revoked_at IS NULL",
    )
    .bind(&ids)
    .bind(org)
    .fetch_one(&s.db)
    .await?;
    if own != ids.len() as i64 {
        return Err(ApiError::Forbidden);
    }
    let id = Uuid::now_v7();
    // Kollision mit einem offenen Code → neuer Versuch
    for _ in 0..5 {
        let code = new_code();
        let mut tx = s.db.begin().await?;
        let r = sqlx::query(
            "INSERT INTO access_grants (id, organization_id, created_by, code_hash, device_ids, minutes, redeem_until)
             VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(mins => $7))
             ON CONFLICT DO NOTHING",
        )
        .bind(id)
        .bind(org)
        .bind(user.id)
        .bind(hash_token(&code))
        .bind(&ids)
        .bind(minutes)
        .bind(REDEEM_MINUTES)
        .execute(&mut *tx)
        .await?;
        if r.rows_affected() == 1 {
            super::audit(
                &mut tx,
                &user.actor(),
                "access_code_create",
                "access_grant",
                id,
                json!({ "devices": ids, "minutes": minutes }),
            )
            .await?;
            tx.commit().await?;
            return Ok((
                StatusCode::CREATED,
                Json(json!({ "id": id, "code": display(&code), "minutes": minutes, "redeem_minutes": REDEEM_MINUTES })),
            ));
        }
    }
    Err(ApiError::Conflict("Bitte erneut versuchen".into()))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct GrantRow {
    pub id: Uuid,
    pub devices: Value,
    pub minutes: i32,
    pub created_at: DateTime<Utc>,
    pub redeem_until: DateTime<Utc>,
    pub redeemed_at: Option<DateTime<Utc>>,
    pub access_until: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub technician: Option<String>,
    pub customer: Option<String>,
    /// waiting | active | expired | revoked
    pub state: String,
}

const GRANT_SELECT: &str = "
    SELECT g.id,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'kind', d.kind) ORDER BY d.name), '[]')
              FROM devices d WHERE d.id = ANY(g.device_ids)) AS devices,
           g.minutes, g.created_at, g.redeem_until, g.redeemed_at, g.access_until, g.revoked_at,
           t.display_name AS technician, o.name AS customer,
           CASE WHEN g.revoked_at IS NOT NULL THEN 'revoked'
                WHEN g.redeemed_at IS NULL AND g.redeem_until > now() THEN 'waiting'
                WHEN g.access_until > now() THEN 'active'
                ELSE 'expired' END AS state
      FROM access_grants g
      LEFT JOIN users t ON t.id = g.redeemed_by
      LEFT JOIN organizations o ON o.id = g.organization_id";

/// Kunde: Codes der eigenen Firma (30 Tage). Techniker: eigene aktive Freigaben.
pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<GrantRow>>> {
    let rows = if user.role == Role::Customer {
        let org = customer_org(&user)?;
        sqlx::query_as(&format!(
            "{GRANT_SELECT} WHERE g.organization_id = $1 AND g.created_at > now() - interval '30 days' ORDER BY g.created_at DESC"
        ))
        .bind(org)
        .fetch_all(&s.db)
        .await?
    } else {
        user.require(Permission::DeviceManage, None)?;
        sqlx::query_as(&format!(
            "{GRANT_SELECT} WHERE g.redeemed_by = $1 AND g.revoked_at IS NULL AND g.access_until > now() ORDER BY g.access_until"
        ))
        .bind(user.id)
        .fetch_all(&s.db)
        .await?
    };
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct RedeemBody {
    pub code: String,
}

/// Techniker: Code einlösen → Zugriff auf die freigegebenen Geräte
pub async fn redeem(State(s): State<AppState>, user: User, Json(b): Json<RedeemBody>) -> ApiResult<Json<Value>> {
    user.require(Permission::DeviceManage, None)?;
    if throttled(user.id) {
        return Err(ApiError::TooManyRequests);
    }
    let code = normalize(&b.code);
    if code.len() != 9 {
        fail(user.id);
        return Err(ApiError::BadRequest("Der Code hat 9 Ziffern".into()));
    }
    let mut tx = s.db.begin().await?;
    let row: Option<(Uuid, Vec<Uuid>, Uuid)> = sqlx::query_as(
        "UPDATE access_grants
            SET redeemed_by = $2, redeemed_at = now(), access_until = now() + make_interval(mins => minutes)
          WHERE code_hash = $1 AND redeemed_at IS NULL AND revoked_at IS NULL AND redeem_until > now()
          RETURNING id, device_ids, organization_id",
    )
    .bind(hash_token(&code))
    .bind(user.id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((id, devices, org)) = row else {
        drop(tx);
        fail(user.id);
        return Err(ApiError::BadRequest("Code ungültig oder abgelaufen".into()));
    };
    super::audit(
        &mut tx,
        &user.actor(),
        "access_code_redeem",
        "access_grant",
        id,
        json!({ "devices": devices, "organization": org }),
    )
    .await?;
    tx.commit().await?;
    let grant: GrantRow = sqlx::query_as(&format!("{GRANT_SELECT} WHERE g.id = $1")).bind(id).fetch_one(&s.db).await?;
    Ok(Json(serde_json::to_value(grant).unwrap_or_default()))
}

/// Kunde (eigene Firma) oder einlösender Techniker: Freigabe sofort beenden
pub async fn revoke(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    let r = sqlx::query(
        "UPDATE access_grants SET revoked_at = now()
          WHERE id = $1 AND revoked_at IS NULL
            AND (($2::uuid IS NOT NULL AND organization_id = $2) OR redeemed_by = $3)",
    )
    .bind(id)
    .bind(if user.role == Role::Customer { user.organization_id } else { None })
    .bind(user.id)
    .execute(&s.db)
    .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    let mut c = s.db.acquire().await?;
    super::audit(&mut c, &user.actor(), "access_code_revoke", "access_grant", id, json!({})).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct PolicyBody {
    /// `code` (nur mit Einmal-Code) oder `staff` (Dauerzugriff für Techniker)
    pub policy: String,
}

/// Kunde für eigene Geräte, Admin für alle: Zugriffsregel setzen
pub async fn set_policy(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<PolicyBody>,
) -> ApiResult<StatusCode> {
    if !matches!(b.policy.as_str(), "code" | "staff") {
        return Err(ApiError::BadRequest("Regel muss code oder staff sein".into()));
    }
    let org = match user.role {
        Role::Customer => Some(customer_org(&user)?),
        Role::Admin => None,
        _ => return Err(ApiError::Forbidden),
    };
    let r = sqlx::query(
        "UPDATE devices SET access_policy = $3
          WHERE id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR organization_id = $2)",
    )
    .bind(id)
    .bind(org)
    .bind(&b.policy)
    .execute(&s.db)
    .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    let mut c = s.db.acquire().await?;
    super::audit(&mut c, &user.actor(), "access_policy", "device", id, json!({ "policy": b.policy })).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_format() {
        let c = new_code();
        assert_eq!(c.len(), 9);
        assert_eq!(display("123456789"), "123 456 789");
        assert_eq!(normalize(" 123-456 789 "), "123456789");
    }
}
