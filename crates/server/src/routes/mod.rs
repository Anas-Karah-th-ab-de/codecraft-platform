mod account;
mod catalog;
mod devices;
mod invoices;
mod jobs;
mod organizations;

use crate::AppState;
use axum::routing::{get, patch, post, put};
use axum::{Json, Router};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        // Öffentlich (Webseite)
        .route("/api/v1/public/catalog", get(catalog::public_catalog))
        .route("/api/v1/public/jobs", get(jobs::public_jobs))
        .route("/api/v1/public/jobs/{slug}", get(jobs::public_job_detail))
        .route("/api/v1/public/jobs/{slug}/apply", post(jobs::apply))
        .route("/api/v1/public/contact", post(jobs::contact))
        // Konto
        .route("/api/v1/auth/login", post(account::login))
        .route("/api/v1/auth/logout", post(account::logout))
        .route("/api/v1/auth/password", post(account::change_password))
        .route("/api/v1/auth/2fa/setup", post(account::totp_setup))
        .route("/api/v1/auth/2fa/enable", post(account::totp_enable))
        .route("/api/v1/auth/2fa/disable", post(account::totp_disable))
        .route("/api/v1/me", get(account::me))
        .route("/api/v1/users", get(account::list_users).post(account::create_user))
        // Katalog
        .route("/api/v1/departments", get(catalog::departments))
        .route("/api/v1/products", get(catalog::products).post(catalog::create_product))
        .route("/api/v1/products/{id}", patch(catalog::update_product))
        .route("/api/v1/products/{id}/prices", post(catalog::add_price))
        .route("/api/v1/prices/{id}", patch(catalog::update_price))
        .route("/api/v1/reports/revenue-by-department", get(catalog::revenue_by_department))
        // Stellen & Kontakt
        .route("/api/v1/jobs", get(jobs::list_jobs).post(jobs::create_job))
        .route("/api/v1/jobs/{id}/status", put(jobs::set_job_status))
        .route("/api/v1/applications", get(jobs::applications))
        .route("/api/v1/contact-requests", get(jobs::contact_requests))
        // Kunden & Rechnungen
        .route("/api/v1/organizations", get(organizations::list).post(organizations::create))
        .route("/api/v1/organizations/{id}", get(organizations::get))
        .route("/api/v1/invoices", get(invoices::list).post(invoices::create_draft))
        .route("/api/v1/invoices/{id}", get(invoices::get).delete(invoices::delete_draft))
        .route("/api/v1/invoices/{id}/items", put(invoices::replace_items))
        .route("/api/v1/invoices/{id}/issue", post(invoices::issue))
        .route("/api/v1/invoices/{id}/pay", post(invoices::mark_paid))
        .route("/api/v1/invoices/{id}/cancel", post(invoices::cancel))
        .route("/api/v1/invoices/{id}/pdf", get(invoices::pdf))
        // Geräte
        .route("/api/v1/devices", get(devices::list).post(devices::register))
        .route("/api/v1/devices/report", post(devices::report))
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION") }))
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
