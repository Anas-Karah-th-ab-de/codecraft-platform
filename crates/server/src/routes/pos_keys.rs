//! Kassensystem: Paket-Schlüssel und Fehlerberichte.
//!
//! * Admins erzeugen Schlüssel für Abo-Pakete (Plan + Laufzeit) oder KI-Einheiten, z. B. zum
//!   Verkauf über Händler. Die Kasse löst den Schlüssel ein – verbunden mit dem Portal (Firma der
//!   Kasse) oder ohne (dann wird die Firma aus dem Betriebsnamen angelegt). Ergebnis: signierte
//!   Lizenz bzw. signierte KI-Gutschrift, sofort in der Kasse installiert.
//! * Fehlerbericht mit einem Klick aus der Kasse: wird ein Ticket für das Support-Team, mit
//!   Ladenname, Gerät, Version und Protokoll (interne Notiz).

use super::account::LoginGuard;
use super::pos::{customer_name, sign_license, signing_key, tunnel_domain, Register};
use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::Json;
use base64::Engine;
use chrono::{DateTime, Duration, Utc};
use codecraft_domain::access::Permission;
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

/// Ohne verwechselbare Zeichen (0/O, 1/I/L)
const ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";

pub fn new_code() -> String {
    let mut rng = rand::thread_rng();
    let groups: Vec<String> =
        (0..4).map(|_| (0..4).map(|_| ALPHABET[rng.gen_range(0..ALPHABET.len())] as char).collect()).collect();
    format!("KMK-{}", groups.join("-"))
}

/// Eingabe tolerant normalisieren: Kleinbuchstaben, Leerzeichen, fehlende Bindestriche
pub fn normalize_code(raw: &str) -> String {
    let c: String = raw.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_uppercase();
    let c = c.strip_prefix("KMK").unwrap_or(&c).to_string();
    if c.len() != 16 {
        return String::new();
    }
    format!("KMK-{}-{}-{}-{}", &c[0..4], &c[4..8], &c[8..12], &c[12..16])
}

/// Subdomain aus dem Betriebsnamen (nur a–z/0–9; arabische Namen → laden-xxxx)
pub fn slug_from(name: &str) -> String {
    let mut s = String::new();
    for ch in name.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            s.push(ch);
        } else if !s.ends_with('-') && !s.is_empty() {
            s.push('-');
        }
    }
    let s = s.trim_matches('-').chars().take(30).collect::<String>().trim_matches('-').to_string();
    if s.len() >= 3 {
        s
    } else {
        format!("laden-{}", &new_code()[4..8].to_lowercase())
    }
}

#[derive(Serialize, sqlx::FromRow)]
pub struct KeyRow {
    pub id: Uuid,
    pub code: String,
    pub kind: String,
    pub plan: Option<String>,
    pub days: Option<i32>,
    pub units: Option<i32>,
    pub note: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub redeemed_at: Option<DateTime<Utc>>,
    pub business_name: Option<String>,
    pub organization_id: Option<Uuid>,
}
const KEY_COLS: &str =
    "id, code, kind, plan, days, units, note, status, created_at, redeemed_at, business_name, organization_id";

fn require_admin(user: &User) -> ApiResult<()> {
    if !user.role.is_employee() {
        return Err(ApiError::Forbidden);
    }
    user.require(Permission::CustomerWrite, None)
}

#[derive(Deserialize)]
pub struct KeyQuery {
    pub status: Option<String>,
}

pub async fn list_keys(State(s): State<AppState>, user: User, Query(q): Query<KeyQuery>) -> ApiResult<Json<Vec<KeyRow>>> {
    require_admin(&user)?;
    Ok(Json(
        sqlx::query_as(&format!(
            "SELECT {KEY_COLS} FROM pos_keys WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 500"
        ))
        .bind(q.status.as_deref())
        .fetch_all(&s.db)
        .await?,
    ))
}

#[derive(Deserialize)]
pub struct NewKeys {
    pub kind: String,
    pub plan: Option<String>,
    pub days: Option<i32>,
    pub units: Option<i32>,
    pub count: Option<u32>,
    pub note: Option<String>,
}

pub async fn create_keys(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewKeys>,
) -> ApiResult<(StatusCode, Json<Vec<KeyRow>>)> {
    require_admin(&user)?;
    let count = b.count.unwrap_or(1).clamp(1, 200);
    let (plan, days, units) = match b.kind.as_str() {
        "license" => {
            let plan = b.plan.filter(|p| ["basic", "pro", "business"].contains(&p.as_str()));
            let days = b.days.filter(|d| (1..=3660).contains(d));
            if plan.is_none() || days.is_none() {
                return Err(ApiError::BadRequest("Paket und Laufzeit (1–3660 Tage) angeben".into()));
            }
            (plan, days, None)
        }
        "ai" => {
            let units = b.units.filter(|u| (1..=1_000_000).contains(u));
            if units.is_none() {
                return Err(ApiError::BadRequest("KI-Einheiten: 1–1.000.000".into()));
            }
            (None, None, units)
        }
        _ => return Err(ApiError::BadRequest("Art: license oder ai".into())),
    };
    let note = b.note.map(|n| n.trim().chars().take(200).collect::<String>()).filter(|n| !n.is_empty());
    let mut tx = s.db.begin().await?;
    let mut out = vec![];
    for _ in 0..count {
        let id = Uuid::now_v7();
        let row: KeyRow = sqlx::query_as(&format!(
            "INSERT INTO pos_keys (id, code, kind, plan, days, units, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING {KEY_COLS}"
        ))
        .bind(id)
        .bind(new_code())
        .bind(&b.kind)
        .bind(plan.as_deref())
        .bind(days)
        .bind(units)
        .bind(note.as_deref())
        .bind(user.id)
        .fetch_one(&mut *tx)
        .await?;
        out.push(row);
    }
    super::audit(
        &mut tx,
        &user.actor(),
        "pos_keys_create",
        "pos_key",
        out[0].id,
        json!({"kind": b.kind, "plan": plan, "days": days, "units": units, "count": count}),
    )
    .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(out)))
}

pub async fn revoke_key(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    require_admin(&user)?;
    let mut tx = s.db.begin().await?;
    let n = sqlx::query("UPDATE pos_keys SET status = 'revoked' WHERE id = $1 AND status = 'open'")
        .bind(id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(ApiError::Conflict("Schlüssel ist schon eingelöst oder gesperrt".into()));
    }
    super::audit(&mut tx, &user.actor(), "pos_key_revoke", "pos_key", id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Einlösen (Kasse) ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct Redeem {
    pub code: String,
    pub tenant_id: String,
    pub business_name: String,
}

fn valid_tenant(t: &str) -> ApiResult<()> {
    if t.len() < 8 || t.len() > 64 || !t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(ApiError::BadRequest("Betriebs-ID ungültig".into()));
    }
    Ok(())
}

async fn redeem_inner(s: &AppState, headers: &HeaderMap, reg: Option<Register>, b: Redeem) -> ApiResult<Json<Value>> {
    let code = normalize_code(&b.code);
    let guard = LoginGuard::check(&format!("poskey:{}", b.tenant_id.trim()), "", headers)?;
    let tenant = reg.as_ref().map(|r| r.tenant_id.clone()).unwrap_or_else(|| b.tenant_id.trim().to_string());
    valid_tenant(&tenant)?;
    let name = b.business_name.trim().chars().take(120).collect::<String>();
    if name.chars().count() < 2 {
        return Err(ApiError::BadRequest("Betriebsname fehlt".into()));
    }
    let mut tx = s.db.begin().await?;
    type K = (Uuid, String, Option<String>, Option<i32>, Option<i32>, String);
    let key: Option<K> = if code.is_empty() {
        None
    } else {
        sqlx::query_as("SELECT id, kind, plan, days, units, status FROM pos_keys WHERE code = $1 FOR UPDATE")
            .bind(&code)
            .fetch_optional(&mut *tx)
            .await?
    };
    let Some((key_id, kind, plan, days, units, status)) = key else {
        guard.fail();
        return Err(ApiError::BadRequest("Schlüssel unbekannt – bitte prüfen".into()));
    };
    if status != "open" {
        guard.fail();
        return Err(ApiError::Conflict("Schlüssel wurde bereits eingelöst oder gesperrt".into()));
    }
    guard.ok();
    // Firma: die der verbundenen Kasse, sonst eine früher für diesen Betrieb angelegte, sonst neu
    let org = match &reg {
        Some(r) => r.organization_id,
        None => {
            let known: Option<Uuid> = sqlx::query_scalar(
                "SELECT organization_id FROM pos_keys WHERE tenant_id = $1 AND organization_id IS NOT NULL
                 UNION SELECT organization_id FROM pos_licenses WHERE tenant_id = $1 LIMIT 1",
            )
            .bind(&tenant)
            .fetch_optional(&mut *tx)
            .await?;
            match known {
                Some(o) => o,
                None => {
                    let o = Uuid::now_v7();
                    sqlx::query("INSERT INTO organizations (id, name, locale) VALUES ($1, $2, 'ar')")
                        .bind(o)
                        .bind(&name)
                        .execute(&mut *tx)
                        .await?;
                    o
                }
            }
        }
    };
    let actor = reg.as_ref().map(|r| format!("pos:{}", r.id)).unwrap_or_else(|| format!("pos-tenant:{tenant}"));
    let result = if kind == "license" {
        let (plan, days) = (plan.unwrap_or_default(), days.unwrap_or(30));
        // Bestehende aktive Lizenz des Betriebs: Restlaufzeit wird angerechnet
        let current: Option<(Uuid, DateTime<Utc>, String)> = sqlx::query_as(
            "SELECT id, expires_at, slug FROM pos_licenses WHERE tenant_id = $1 AND status = 'active' FOR UPDATE",
        )
        .bind(&tenant)
        .fetch_optional(&mut *tx)
        .await?;
        let mut slug = current.as_ref().map(|c| c.2.clone()).unwrap_or_else(|| slug_from(&name));
        let start = current.as_ref().map(|c| c.1.max(Utc::now())).unwrap_or_else(Utc::now);
        let exp = start + Duration::days(days as i64);
        if let Some((old, ..)) = &current {
            sqlx::query("UPDATE pos_licenses SET status = 'revoked', note = COALESCE(note,'') || ' → ersetzt durch Schlüssel' WHERE id = $1")
                .bind(old)
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE pos_licenses SET slug = slug || '-alt-' || substr(id::text, 1, 6) WHERE id = $1")
                .bind(old)
                .execute(&mut *tx)
                .await?;
        } else {
            let taken: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pos_licenses WHERE slug = $1)")
                .bind(&slug)
                .fetch_one(&mut *tx)
                .await?;
            if taken {
                slug = format!("{}-{}", slug.chars().take(30).collect::<String>(), &new_code()[4..8].to_lowercase());
            }
        }
        let lic = Uuid::now_v7();
        let customer = if reg.is_some() { customer_name(s, org).await? } else { name.clone() };
        let signed = sign_license(lic, &tenant, &customer, &plan, &slug, exp)?;
        sqlx::query(
            "INSERT INTO pos_licenses (id, organization_id, plan, slug, status, tenant_id, register_id, signed_key, expires_at, activated_at, note)
             VALUES ($1,$2,$3,$4,'active',$5,$6,$7,$8, now(), $9)",
        )
        .bind(lic)
        .bind(org)
        .bind(&plan)
        .bind(&slug)
        .bind(&tenant)
        .bind(reg.as_ref().map(|r| r.id))
        .bind(&signed)
        .bind(exp)
        .bind(format!("Schlüssel {code}"))
        .execute(&mut *tx)
        .await?;
        sqlx::query("UPDATE pos_keys SET license_id = $2 WHERE id = $1").bind(key_id).bind(lic).execute(&mut *tx).await?;
        json!({ "kind": "license", "key": signed, "plan": plan, "expires_at": exp, "public_url": format!("https://{slug}.{}", tunnel_domain()) })
    } else {
        use ed25519_dalek::Signer;
        let units = units.unwrap_or(0);
        let credit = Uuid::now_v7();
        let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD;
        let payload = b64.encode(
            serde_json::to_vec(&json!({"credit_id": credit.to_string(), "tenant_id": tenant, "units": units as i64, "issued_at": Utc::now().to_rfc3339()}))
                .map_err(|e| ApiError::BadRequest(e.to_string()))?,
        );
        let ai_code = format!("KMAI1.{payload}.{}", b64.encode(signing_key()?.sign(payload.as_bytes()).to_bytes()));
        sqlx::query(
            "INSERT INTO pos_ai_credits (id, organization_id, units, note, tenant_id, delivered_at, code) VALUES ($1,$2,$3,$4,$5, now(), $6)",
        )
        .bind(credit)
        .bind(org)
        .bind(units)
        .bind(format!("Schlüssel {code}"))
        .bind(&tenant)
        .bind(&ai_code)
        .execute(&mut *tx)
        .await?;
        json!({ "kind": "ai", "units": units, "ai_code": ai_code })
    };
    sqlx::query(
        "UPDATE pos_keys SET status = 'redeemed', redeemed_at = now(), organization_id = $2, tenant_id = $3, business_name = $4 WHERE id = $1",
    )
    .bind(key_id)
    .bind(org)
    .bind(&tenant)
    .bind(&name)
    .execute(&mut *tx)
    .await?;
    super::audit(&mut tx, &actor, "pos_key_redeem", "pos_key", key_id, json!({"tenant_id": tenant, "kind": kind})).await?;
    tx.commit().await?;
    Ok(Json(result))
}

/// Verbundene Kasse löst ein (Firma = Firma der Kasse)
pub async fn redeem_register(State(s): State<AppState>, r: Register, headers: HeaderMap, Json(b): Json<Redeem>) -> ApiResult<Json<Value>> {
    redeem_inner(&s, &headers, Some(r), b).await
}

/// Kasse ohne Portal-Verbindung löst ein (Firma wird angelegt bzw. wiedererkannt)
pub async fn redeem(State(s): State<AppState>, headers: HeaderMap, Json(b): Json<Redeem>) -> ApiResult<Json<Value>> {
    if headers.get(header::AUTHORIZATION).is_some() {
        return Err(ApiError::BadRequest("Verbundene Kassen nutzen /pos/register/redeem".into()));
    }
    redeem_inner(&s, &headers, None, b).await
}

// ── Fehlerbericht → Ticket ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct Report {
    pub tenant_id: String,
    pub business_name: String,
    pub message: Option<String>,
    /// normal | high (Kasse steht) | critical
    pub urgency: Option<String>,
    pub contact: Option<String>,
    pub app_version: Option<String>,
    pub platform: Option<String>,
    #[serde(default)]
    pub diagnostics: Value,
}

const MAX_DIAG: usize = 200 * 1024;

async fn report_inner(s: &AppState, headers: &HeaderMap, reg: Option<Register>, b: Report) -> ApiResult<(StatusCode, Json<Value>)> {
    // Bremse: höchstens ~10 Berichte je Betrieb/Adresse kurz hintereinander
    let guard = LoginGuard::check(&format!("posreport:{}", b.tenant_id.trim()), "", headers)?;
    guard.fail();
    let tenant = reg.as_ref().map(|r| r.tenant_id.clone()).unwrap_or_else(|| b.tenant_id.trim().to_string());
    valid_tenant(&tenant)?;
    let name = b.business_name.trim().chars().take(120).collect::<String>();
    if name.is_empty() {
        return Err(ApiError::BadRequest("Betriebsname fehlt".into()));
    }
    let diag = if b.diagnostics.to_string().len() > MAX_DIAG { json!({"truncated": true}) } else { b.diagnostics.clone() };
    let urgency = match b.urgency.as_deref() {
        Some("high") => "high",
        Some("critical") => "critical",
        _ => "normal",
    };
    let msg = b.message.as_deref().map(str::trim).filter(|m| !m.is_empty()).map(|m| m.chars().take(4000).collect::<String>());
    // Firma: verbundene Kasse, sonst über frühere Lizenz/Schlüssel
    let org: Option<Uuid> = match &reg {
        Some(r) => Some(r.organization_id),
        None => sqlx::query_scalar(
            "SELECT organization_id FROM pos_licenses WHERE tenant_id = $1 UNION SELECT organization_id FROM pos_keys WHERE tenant_id = $1 AND organization_id IS NOT NULL LIMIT 1",
        )
        .bind(&tenant)
        .fetch_optional(&s.db)
        .await?,
    };
    // Ticket-Ersteller: wer die Kasse verbunden hat, sonst ein Benutzer der Firma, sonst ein Admin
    let creator: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM (
            SELECT linked_by AS id, 1 AS o FROM pos_registers WHERE id = $1 AND linked_by IS NOT NULL
            UNION ALL SELECT id, 2 FROM users WHERE is_active AND $2::uuid IS NOT NULL AND organization_id = $2
            UNION ALL SELECT id, 3 FROM users WHERE is_active AND role = 'admin'
         ) x ORDER BY o LIMIT 1",
    )
    .bind(reg.as_ref().map(|r| r.id))
    .bind(org)
    .fetch_optional(&s.db)
    .await?;
    let creator = creator.ok_or_else(|| ApiError::Conflict("Kein Support-Benutzer eingerichtet".into()))?;
    let sla: String = match org {
        Some(o) => sqlx::query_scalar("SELECT sla FROM organizations WHERE id = $1").bind(o).fetch_optional(&s.db).await?.unwrap_or_else(|| "basic".into()),
        None => "basic".into(),
    };
    let prio = super::tickets::priority(urgency, &sla);
    let short = msg.as_deref().map(|m| m.lines().next().unwrap_or("").chars().take(70).collect::<String>()).filter(|m| !m.is_empty());
    let subject = format!("Kasse „{}“: {}", name.chars().take(60).collect::<String>(), short.unwrap_or_else(|| "Fehlerbericht".into()));
    let version = b.app_version.clone().or_else(|| diag.get("version").and_then(|v| v.as_str()).map(String::from));
    let platform = b.platform.clone().or_else(|| diag.get("platform").and_then(|v| v.as_str()).map(String::from));
    let body = format!(
        "{}\n\n— Fehlerbericht aus der Kasse —\nLaden: {name}\nBetriebs-ID: {tenant}\nVersion: {}\nGerät: {}\nPortal verbunden: {}\nKontakt: {}",
        msg.as_deref().unwrap_or("(ohne Beschreibung – automatisch gesendet)"),
        version.as_deref().unwrap_or("?"),
        platform.as_deref().unwrap_or("?"),
        if reg.is_some() { "ja" } else { "nein" },
        b.contact.as_deref().map(str::trim).filter(|c| !c.is_empty()).unwrap_or("–"),
    );
    let mut details = serde_json::to_string_pretty(&diag).unwrap_or_default();
    if details.len() > 19_000 {
        let mut cut = 19_000;
        while !details.is_char_boundary(cut) {
            cut -= 1;
        }
        details.truncate(cut);
        details.push_str("\n…");
    }
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    let n: i64 = sqlx::query_scalar("SELECT nextval('ticket_number_seq')").fetch_one(&mut *tx).await?;
    let number = format!("T-{}-{n:05}", Utc::now().format("%Y"));
    sqlx::query(
        "INSERT INTO tickets (id, number, organization_id, created_by, subject, category, urgency, sla, priority, response_due_at, department_id, source)
         VALUES ($1,$2,$3,$4,$5,'software',$6,$7,$8, now() + make_interval(secs => $9), (SELECT id FROM departments WHERE code = 'SUP'), 'pos')",
    )
    .bind(id)
    .bind(&number)
    .bind(org)
    .bind(creator)
    .bind(&subject)
    .bind(urgency)
    .bind(&sla)
    .bind(prio)
    .bind(super::tickets::response_time(prio).num_seconds() as f64)
    .execute(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO ticket_messages (id, ticket_id, author_id, body) VALUES ($1,$2,NULL,$3)")
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(&body)
        .execute(&mut *tx)
        .await?;
    if !details.trim().is_empty() && details != "null" {
        sqlx::query("INSERT INTO ticket_messages (id, ticket_id, author_id, body, internal) VALUES ($1,$2,NULL,$3,true)")
            .bind(Uuid::now_v7())
            .bind(id)
            .bind(format!("Diagnose (automatisch):\n{details}"))
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query(
        "INSERT INTO pos_reports (id, ticket_id, organization_id, register_id, tenant_id, business_name, app_version, platform, diagnostics)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    )
    .bind(Uuid::now_v7())
    .bind(id)
    .bind(org)
    .bind(reg.as_ref().map(|r| r.id))
    .bind(&tenant)
    .bind(&name)
    .bind(version.as_deref())
    .bind(platform.as_deref())
    .bind(&diag)
    .execute(&mut *tx)
    .await?;
    if let Some(r) = &reg {
        sqlx::query("UPDATE pos_registers SET name = $2 WHERE id = $1").bind(r.id).bind(&name).execute(&mut *tx).await?;
    }
    super::audit(&mut tx, &format!("pos-tenant:{tenant}"), "pos_report", "ticket", id, json!({"number": number})).await?;
    tx.commit().await?;
    super::tickets::notify(&s.db, Uuid::nil(), &super::tickets::support_team(s).await, "new", id, &number, &subject);
    Ok((StatusCode::CREATED, Json(json!({ "number": number, "id": id }))))
}

pub async fn report_register(State(s): State<AppState>, r: Register, headers: HeaderMap, Json(b): Json<Report>) -> ApiResult<(StatusCode, Json<Value>)> {
    report_inner(&s, &headers, Some(r), b).await
}

pub async fn report(State(s): State<AppState>, headers: HeaderMap, Json(b): Json<Report>) -> ApiResult<(StatusCode, Json<Value>)> {
    if headers.get(header::AUTHORIZATION).is_some() {
        return Err(ApiError::BadRequest("Verbundene Kassen nutzen /pos/register/report".into()));
    }
    report_inner(&s, &headers, None, b).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn codes() {
        let c = new_code();
        assert_eq!(c.len(), 23);
        assert_eq!(normalize_code(&c.to_lowercase().replace('-', " ")), c);
        assert_eq!(normalize_code("kmk abcd"), "");
        assert_eq!(slug_from("Café Sham & Co"), "caf-sham-co");
        assert!(slug_from("مقهى الشام").starts_with("laden-"));
    }
}
