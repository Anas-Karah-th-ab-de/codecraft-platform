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
