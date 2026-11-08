//! Zahlungsarten: vom Admin gepflegt (ShamCash als Standard, Banküberweisung, weitere).
//!
//! Auswahl je Beleg (Rechnung, Angebot, Vertrag) → sonst Standard des Kunden → sonst globaler
//! Standard (DB-Trigger beim Anlegen). Beim Ausstellen einer Rechnung werden die Zahlungsdaten
//! eingefroren, spätere Änderungen ändern keine ausgestellte Rechnung. Kontodaten liegen nur in der DB.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use codecraft_domain::access::{Permission, Role};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sqlx::PgConnection;
use uuid::Uuid;

const KINDS: [&str; 5] = ["shamcash", "bank", "cash", "paypal", "other"];
/// `qr`: Bild des Zahlungs-QR-Codes (z. B. aus der ShamCash-App) unter `/payment/…`
/// `sender_bic`: BIC der Absenderbank für Auslandsüberweisungen (wie im Altsystem gedruckt)
const FIELDS: [&str; 9] =
    ["payee", "provider", "account", "account_label", "bic", "address", "note", "qr", "sender_bic"];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Method {
    pub id: Uuid,
    pub kind: String,
    pub name: String,
    pub details: Value,
    pub is_default: bool,
    pub is_active: bool,
    pub sort: i32,
}

const SELECT: &str = "SELECT id, kind, name, details, is_default, is_active, sort FROM payment_methods";

/// Aktive Zahlungsarten (Kunden sehen die Kontodaten, um zu bezahlen); Admin auch inaktive
pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<Method>>> {
    let all = user.role == Role::Admin;
    let rows = sqlx::query_as(&format!("{SELECT} WHERE is_active OR $1 ORDER BY NOT is_active, sort, name"))
        .bind(all)
        .fetch_all(&s.db)
        .await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct MethodIn {
    pub kind: String,
    pub name: String,
    #[serde(default)]
    pub details: Map<String, Value>,
    #[serde(default)]
    pub is_default: bool,
    #[serde(default = "yes")]
    pub is_active: bool,
    #[serde(default)]
    pub sort: i32,
}

fn yes() -> bool {
    true
}

fn clean(b: &MethodIn) -> ApiResult<Value> {
    if !KINDS.contains(&b.kind.as_str()) {
        return Err(ApiError::BadRequest("Art: shamcash, bank, cash, paypal oder other".into()));
    }
    let name = b.name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err(ApiError::BadRequest("Name 1–80 Zeichen".into()));
    }
    if b.is_default && !b.is_active {
        return Err(ApiError::BadRequest("Die Standard-Zahlungsart muss aktiv sein".into()));
    }
    let mut out = Map::new();
    for (k, v) in &b.details {
        if !FIELDS.contains(&k.as_str()) {
            return Err(ApiError::BadRequest(format!("Unbekanntes Feld: {k}")));
        }
        let v = v.as_str().ok_or_else(|| ApiError::BadRequest(format!("{k}: Text erwartet")))?.trim();
        if v.chars().count() > 300 {
            return Err(ApiError::BadRequest(format!("{k}: höchstens 300 Zeichen")));
        }
        if k == "qr"
            && !v.is_empty()
            && !(v.starts_with("/payment/")
                && !v.contains("..")
                && [".jpg", ".jpeg", ".png"].iter().any(|e| v.to_lowercase().ends_with(e)))
        {
            return Err(ApiError::BadRequest("qr: Bild unter /payment/… (jpg/png)".into()));
        }
        if !v.is_empty() {
            out.insert(k.clone(), Value::String(v.to_string()));
        }
    }
    Ok(Value::Object(out))
}

async fn unset_default(conn: &mut PgConnection, keep: Uuid) -> ApiResult<()> {
    sqlx::query("UPDATE payment_methods SET is_default = false WHERE is_default AND id <> $1")
        .bind(keep)
        .execute(conn)
        .await?;
    Ok(())
}

pub async fn create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<MethodIn>,
) -> ApiResult<(StatusCode, Json<Method>)> {
    user.require(Permission::UserManage, None)?;
    let details = clean(&b)?;
    let id = Uuid::now_v7();
    let mut tx = s.db.begin().await?;
    if b.is_default {
        unset_default(&mut tx, id).await?;
    }
    let m: Method = sqlx::query_as(
        "INSERT INTO payment_methods (id, kind, name, details, is_default, is_active, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, kind, name, details, is_default, is_active, sort",
    )
    .bind(id)
    .bind(&b.kind)
    .bind(b.name.trim())
    .bind(&details)
    .bind(b.is_default)
    .bind(b.is_active)
    .bind(b.sort)
    .fetch_one(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "create", "payment_method", id, json!({ "kind": b.kind, "name": m.name }))
        .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(m)))
}

pub async fn update(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<MethodIn>,
) -> ApiResult<Json<Method>> {
    user.require(Permission::UserManage, None)?;
    let details = clean(&b)?;
    let mut tx = s.db.begin().await?;
    let was_default: bool = sqlx::query_scalar("SELECT is_default FROM payment_methods WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(ApiError::NotFound)?;
    if was_default && !b.is_default {
        return Err(ApiError::Conflict("Erst eine andere Zahlungsart als Standard festlegen".into()));
    }
    if b.is_default {
        unset_default(&mut tx, id).await?;
    }
    let m: Method = sqlx::query_as(
        "UPDATE payment_methods SET kind=$2, name=$3, details=$4, is_default=$5, is_active=$6, sort=$7, updated_at=now()
          WHERE id=$1 RETURNING id, kind, name, details, is_default, is_active, sort",
    )
    .bind(id)
    .bind(&b.kind)
    .bind(b.name.trim())
    .bind(&details)
    .bind(b.is_default)
    .bind(b.is_active)
    .bind(b.sort)
    .fetch_one(&mut *tx)
    .await?;
    // Kontodaten nicht ins Protokoll – nur, dass sie geändert wurden
    super::audit(
        &mut tx,
        &user.actor(),
        "update",
        "payment_method",
        id,
        json!({ "name": m.name, "active": m.is_active }),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(m))
}

#[derive(Deserialize)]
pub struct OrgMethod {
    pub payment_method_id: Option<Uuid>,
}

/// Standard-Zahlungsart eines Kunden (leer = globaler Standard)
pub async fn set_org_default(
    State(s): State<AppState>,
    user: User,
    Path(org): Path<Uuid>,
    Json(b): Json<OrgMethod>,
) -> ApiResult<StatusCode> {
    user.require(Permission::CustomerWrite, None)?;
    let mut tx = s.db.begin().await?;
    if let Some(m) = b.payment_method_id {
        check_active(&mut tx, m).await?;
    }
    let r = sqlx::query("UPDATE organizations SET payment_method_id = $2 WHERE id = $1")
        .bind(org)
        .bind(b.payment_method_id)
        .execute(&mut *tx)
        .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    super::audit(
        &mut tx,
        &user.actor(),
        "set_payment_method",
        "organization",
        org,
        json!({ "method": b.payment_method_id }),
    )
    .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Gewählte Zahlungsart muss existieren und aktiv sein
pub(crate) async fn check_active(conn: &mut PgConnection, id: Uuid) -> ApiResult<()> {
    let ok: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM payment_methods WHERE id = $1 AND is_active)")
        .bind(id)
        .fetch_one(conn)
        .await?;
    if ok {
        Ok(())
    } else {
        Err(ApiError::BadRequest("Zahlungsart unbekannt oder deaktiviert".into()))
    }
}

/// `{kind, name, details}` einer Zahlungsart
/// Zahlungsart, wenn im Beleg keine gewählt ist: Standard des Kunden → bei arabischen Belegen
/// ShamCash (falls aktiv) → globaler Standard (Banküberweisung)
pub(crate) const DEFAULT_SQL: &str = "COALESCE(
    (SELECT o.payment_method_id FROM organizations o JOIN payment_methods p ON p.id = o.payment_method_id
      WHERE o.id = $1 AND p.is_active),
    (SELECT id FROM payment_methods WHERE $2 = 'ar' AND kind = 'shamcash' AND is_active ORDER BY is_default DESC, sort LIMIT 1),
    (SELECT id FROM payment_methods WHERE is_default AND is_active))";

pub(crate) async fn default_for(conn: &mut PgConnection, org: Uuid, locale: &str) -> ApiResult<Option<Uuid>> {
    Ok(sqlx::query_scalar(&format!("SELECT {DEFAULT_SQL}")).bind(org).bind(locale).fetch_one(conn).await?)
}

pub(crate) async fn info(conn: &mut PgConnection, id: Option<Uuid>) -> ApiResult<Option<Value>> {
    let Some(id) = id else { return Ok(None) };
    Ok(sqlx::query_scalar("SELECT jsonb_build_object('id', id, 'kind', kind, 'name', name, 'details', details) FROM payment_methods WHERE id = $1")
        .bind(id)
        .fetch_optional(conn)
        .await?)
}

fn s<'a>(p: &'a Value, k: &str) -> &'a str {
    p["details"][k].as_str().unwrap_or("")
}

fn tr(locale: &str, de: &str, en: &str, ar: &str) -> String {
    match locale {
        "en" => en,
        "ar" => ar,
        _ => de,
    }
    .to_string()
}

fn account_label(p: &Value, locale: &str) -> String {
    let custom = s(p, "account_label");
    if !custom.is_empty() {
        return custom.to_string();
    }
    match p["kind"].as_str().unwrap_or("") {
        "bank" => "IBAN".into(),
        "shamcash" => tr(locale, "ShamCash-Konto", "ShamCash account", "حساب شام كاش"),
        "paypal" => "PayPal".into(),
        _ => tr(locale, "Konto", "Account", "الحساب"),
    }
}

/// Zahlungsdaten in die Druckvorlage der Rechnung übernehmen (Felder „Zahlungsinformationen“)
pub(crate) fn apply_to_template(template: &mut Value, p: &Value) {
    let bank = p["kind"] == "bank";
    let provider = if s(p, "provider").is_empty() { p["name"].as_str().unwrap_or("") } else { s(p, "provider") };
    template["payeeName"] = json!(s(p, "payee"));
    template["bankName"] = json!(provider);
    template["bankIban"] = json!(s(p, "account"));
    template["bankBic"] = json!(s(p, "bic"));
    template["bankAddress"] = json!(if s(p, "note").is_empty() { s(p, "address") } else { s(p, "note") });
    template["senderBic"] = json!(s(p, "sender_bic"));
    // QR-Code der Zahlungsart (Renderer lädt das Bild aus seinem Ordner public/)
    template["paymentQr"] = json!(s(p, "qr"));
    if !template["labels"].is_object() {
        template["labels"] = json!({});
    }
    let labels = &mut template["labels"];
    labels["iban"] = json!({ "de": format!("{}:", account_label(p, "de")), "en": format!("{}:", account_label(p, "en")), "ar": format!("{}:", account_label(p, "ar")) });
    if !bank {
        labels["bank"] = json!({ "de": "Zahlungsart:", "en": "Payment method:", "ar": "طريقة الدفع:" });
        labels["bic"] = json!({ "de": "Referenz:", "en": "Reference:", "ar": "المرجع:" });
        labels["bankAddr"] = json!({ "de": "Hinweis:", "en": "Note:", "ar": "ملاحظة:" });
    }
}

/// Zahlungsart als Textabsatz (Angebote/Verträge)
pub(crate) fn text(p: &Value, locale: &str) -> String {
    let mut parts = vec![format!(
        "**{}:** {}",
        tr(locale, "Zahlungsart", "Payment method", "طريقة الدفع"),
        p["name"].as_str().unwrap_or("")
    )];
    let payee = s(p, "payee");
    if !payee.is_empty() {
        parts.push(format!("{}: {payee}", tr(locale, "Empfänger", "Payee", "المستفيد")));
    }
    let account = s(p, "account");
    if !account.is_empty() {
        parts.push(format!("{}: {account}", account_label(p, locale)));
    }
    if !s(p, "bic").is_empty() {
        parts.push(format!("BIC: {}", s(p, "bic")));
    }
    if !s(p, "note").is_empty() {
        parts.push(s(p, "note").to_string());
    }
    parts.join(" · ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_for_shamcash() {
        let p = json!({ "kind": "shamcash", "name": "ShamCash", "details": { "payee": "KM Code Craft", "account": "SC-123" } });
        let mut t = json!({ "bankIban": "DE00", "labels": {} });
        apply_to_template(&mut t, &p);
        assert_eq!(t["bankIban"], "SC-123");
        assert_eq!(t["bankName"], "ShamCash");
        assert_eq!(t["labels"]["iban"]["de"], "ShamCash-Konto:");
        assert_eq!(t["labels"]["bank"]["ar"], "طريقة الدفع:");
        assert!(text(&p, "de").contains("SC-123"));
    }
}
