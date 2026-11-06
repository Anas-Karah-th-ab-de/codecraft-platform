mod devices;
mod invoices;
mod organizations;

use crate::AppState;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/me", get(me))
        .route("/api/v1/organizations", get(organizations::list).post(organizations::create))
        .route("/api/v1/organizations/{id}", get(organizations::get))
        .route("/api/v1/invoices", get(invoices::list).post(invoices::create_draft))
        .route("/api/v1/invoices/{id}", get(invoices::get).delete(invoices::delete_draft))
        .route("/api/v1/invoices/{id}/items", put(invoices::replace_items))
        .route("/api/v1/invoices/{id}/issue", post(invoices::issue))
        .route("/api/v1/invoices/{id}/pay", post(invoices::mark_paid))
        .route("/api/v1/invoices/{id}/cancel", post(invoices::cancel))
        .route("/api/v1/devices", get(devices::list).post(devices::register))
        .route("/api/v1/devices/report", post(devices::report))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION") }))
}

async fn me(user: crate::auth::User) -> Json<Value> {
    Json(json!({ "id": user.id, "role": user.role, "organization_id": user.organization_id }))
}

/// Eintrag ins Audit-Log innerhalb einer Transaktion
pub(crate) async fn audit(
    conn: &mut sqlx::PgConnection,
    actor: &str,
    action: &str,
    entity: &str,
    entity_id: uuid::Uuid,
    data: Value,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO audit_log (actor, action, entity, entity_id, data) VALUES ($1, $2, $3, $4, $5)")
        .bind(actor)
        .bind(action)
        .bind(entity)
        .bind(entity_id)
        .bind(data)
        .execute(conn)
        .await?;
    Ok(())
}
