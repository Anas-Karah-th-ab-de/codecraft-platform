use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use codecraft_domain::access::Permission;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub address: String,
    pub vat_id: Option<String>,
    pub email: Option<String>,
    pub locale: String,
    pub customer_number: Option<String>,
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub sla: String,
    pub payment_method_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct NewOrganization {
    pub name: String,
    #[serde(default)]
    pub address: String,
    pub vat_id: Option<String>,
    pub email: Option<String>,
    #[serde(default = "default_locale")]
    pub locale: String,
}

fn default_locale() -> String {
    "de".into()
}

pub async fn create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewOrganization>,
) -> ApiResult<(StatusCode, Json<Organization>)> {
    user.require(Permission::CustomerWrite, None)?;
    if b.name.trim().is_empty() {
        return Err(ApiError::BadRequest("Name fehlt".into()));
    }
    let mut tx = s.db.begin().await?;
    let org: Organization = sqlx::query_as(
        "INSERT INTO organizations (id, name, address, vat_id, email, locale)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, address, vat_id, email, locale, customer_number, contact_name, phone, sla, payment_method_id",
    )
    .bind(Uuid::now_v7())
    .bind(b.name.trim())
    .bind(b.address.trim())
    .bind(b.vat_id.as_deref().map(str::trim).filter(|v| !v.is_empty()))
    .bind(b.email.as_deref().map(str::trim).filter(|v| !v.is_empty()))
    .bind(&b.locale)
    .fetch_one(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "create", "organization", org.id, serde_json::json!({ "name": org.name }))
        .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(org)))
}

pub async fn list(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<Organization>>> {
    // Kunden sehen nur die eigene Organisation
    let rows: Vec<Organization> = if user.role.is_employee() {
        user.require(Permission::CustomerRead, None)?;
        sqlx::query_as("SELECT id, name, address, vat_id, email, locale, customer_number, contact_name, phone, sla, payment_method_id FROM organizations ORDER BY name")
            .fetch_all(&s.db)
            .await?
    } else {
        let org = user.organization_id.ok_or(ApiError::Forbidden)?;
        user.require(Permission::CustomerRead, Some(org))?;
        sqlx::query_as("SELECT id, name, address, vat_id, email, locale, customer_number, contact_name, phone, sla, payment_method_id FROM organizations WHERE id = $1")
            .bind(org)
            .fetch_all(&s.db)
            .await?
    };
    Ok(Json(rows))
}

pub async fn get(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Organization>> {
    user.require(Permission::CustomerRead, Some(id))?;
    let org: Organization =
        sqlx::query_as("SELECT id, name, address, vat_id, email, locale, customer_number, contact_name, phone, sla, payment_method_id FROM organizations WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?
            .ok_or(ApiError::NotFound)?;
    Ok(Json(org))
}

#[derive(Debug, Deserialize)]
pub struct OrgPatch {
    pub name: Option<String>,
    pub address: Option<String>,
    pub vat_id: Option<String>,
    pub email: Option<String>,
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub locale: Option<String>,
}

/// Leerer Text → NULL; Feld fehlt → unverändert (None)
fn opt(v: &Option<String>) -> Option<String> {
    v.as_ref().map(|s| s.trim().to_string())
}

/// Firmendaten ändern (Adresse nachtragen usw.).
/// Team mit Kunden-Schreibrecht: alles. Kunde: nur die eigene Firma, ohne Firmennamen.
pub async fn patch(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<OrgPatch>,
) -> ApiResult<Json<Organization>> {
    if user.role.is_employee() {
        user.require(Permission::CustomerWrite, None)?;
    } else {
        if user.organization_id != Some(id) {
            return Err(ApiError::NotFound);
        }
        user.require(Permission::CustomerRead, Some(id))?;
        if b.name.is_some() {
            return Err(ApiError::BadRequest("Den Firmennamen ändert KM Code Craft – bitte kurz melden".into()));
        }
    }
    let name = opt(&b.name);
    if name.as_deref().is_some_and(|n| n.is_empty() || n.chars().count() > 200) {
        return Err(ApiError::BadRequest("Name fehlt oder ist zu lang".into()));
    }
    let address = opt(&b.address);
    if address.as_deref().is_some_and(|a| a.chars().count() > 1000) {
        return Err(ApiError::BadRequest("Adresse ist zu lang".into()));
    }
    let email = opt(&b.email);
    if email
        .as_deref()
        .is_some_and(|e| !e.is_empty() && (!e.contains('@') || e.len() > 254 || e.contains(char::is_whitespace)))
    {
        return Err(ApiError::BadRequest("E-Mail-Adresse ungültig".into()));
    }
    if b.locale.as_deref().is_some_and(|l| !["de", "en", "ar"].contains(&l)) {
        return Err(ApiError::BadRequest("Sprache ungültig".into()));
    }
    for (v, max) in [(&b.vat_id, 40), (&b.contact_name, 200), (&b.phone, 60)] {
        if opt(v).is_some_and(|x| x.chars().count() > max) {
            return Err(ApiError::BadRequest("Eingabe zu lang".into()));
        }
    }
    let mut tx = s.db.begin().await?;
    let org: Organization = sqlx::query_as(
        "UPDATE organizations SET
                name = COALESCE($2, name),
                address = COALESCE($3, address),
                vat_id = CASE WHEN $4::text IS NULL THEN vat_id ELSE NULLIF($4, '') END,
                email = CASE WHEN $5::text IS NULL THEN email ELSE NULLIF($5, '') END,
                contact_name = CASE WHEN $6::text IS NULL THEN contact_name ELSE NULLIF($6, '') END,
                phone = CASE WHEN $7::text IS NULL THEN phone ELSE NULLIF($7, '') END,
                locale = COALESCE($8, locale)
          WHERE id = $1
         RETURNING id, name, address, vat_id, email, locale, customer_number, contact_name, phone, sla, payment_method_id",
    )
    .bind(id)
    .bind(&name)
    .bind(&address)
    .bind(opt(&b.vat_id))
    .bind(&email)
    .bind(opt(&b.contact_name))
    .bind(opt(&b.phone))
    .bind(&b.locale)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    let changed: Vec<&str> = [
        ("name", b.name.is_some()),
        ("address", b.address.is_some()),
        ("vat_id", b.vat_id.is_some()),
        ("email", b.email.is_some()),
        ("contact_name", b.contact_name.is_some()),
        ("phone", b.phone.is_some()),
        ("locale", b.locale.is_some()),
    ]
    .into_iter()
    .filter(|(_, c)| *c)
    .map(|(k, _)| k)
    .collect();
    super::audit(&mut tx, &user.actor(), "update", "organization", id, serde_json::json!({ "fields": changed }))
        .await?;
    tx.commit().await?;
    Ok(Json(org))
}
