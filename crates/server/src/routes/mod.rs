pub mod access;
pub mod account;
mod catalog;
pub mod chat;
mod devices;
pub mod hr;
mod invoices;
mod jobs;
pub mod mail;
pub mod media;
mod organizations;
mod projects;
pub mod remote;
mod requests;
mod shop;
pub mod tickets;

use crate::AppState;
use axum::extract::DefaultBodyLimit;
use axum::routing::{delete, get, patch, post, put};
use axum::{Json, Router};
use serde_json::{json, Value};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        // Öffentlich (Webseite)
        .route("/api/v1/public/catalog", get(catalog::public_catalog))
        .route("/api/v1/public/products/{slug}", get(catalog::public_product_detail))
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
        .route("/api/v1/users/{id}/reset-password", post(account::reset_password))
        // Katalog
        .route("/api/v1/departments", get(catalog::departments))
        .route("/api/v1/products", get(catalog::products).post(catalog::create_product))
        .route("/api/v1/products/{id}", patch(catalog::update_product))
        .route("/api/v1/products/{id}/prices", post(catalog::add_price))
        .route("/api/v1/prices/{id}", patch(catalog::update_price))
        .route(
            "/api/v1/products/{id}/images",
            post(media::upload).layer(DefaultBodyLimit::max(media::MAX_UPLOAD + 64 * 1024)),
        )
        .route("/api/v1/product-images/{id}", delete(media::delete))
        .route("/api/v1/product-images/{id}/primary", post(media::make_primary))
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
        // Projekte & Kostenvoranschläge
        .route("/api/v1/projects", get(projects::list).post(projects::create))
        .route("/api/v1/public/projects", get(projects::public_list))
        .route("/api/v1/projects/{id}", get(projects::get).patch(projects::patch))
        .route("/api/v1/projects/{id}/milestones", post(projects::add_milestone))
        .route("/api/v1/projects/{id}/updates", post(projects::add_update))
        .route("/api/v1/milestones/{id}", patch(projects::patch_milestone).delete(projects::delete_milestone))
        // Shop & Entwicklungsanfragen
        .route("/api/v1/orders", get(shop::list).post(shop::create))
        .route("/api/v1/orders/{id}", patch(shop::patch))
        .route("/api/v1/orders/{id}/invoice", post(shop::invoice))
        .route("/api/v1/dev-requests", get(requests::list).post(requests::create))
        .route("/api/v1/dev-requests/{id}", get(requests::get).patch(requests::patch))
        .route("/api/v1/dev-requests/{id}/messages", post(requests::reply))
        .route("/api/v1/dev-requests/{id}/project", post(requests::to_project))
        .route("/api/v1/quotes", get(projects::list_quotes))
        .route("/api/v1/quotes/{id}", get(projects::get_quote))
        .route("/api/v1/quotes/{id}/pdf", get(projects::quote_pdf))
        // Kommunikation: Chat, Anrufe (WebRTC-Signalisierung), Echtzeit
        .route("/api/v1/ws", get(chat::ws))
        .route("/api/v1/chat/contacts", get(chat::contacts))
        .route("/api/v1/chat/ice", get(chat::ice))
        .route("/api/v1/chat/rooms", get(chat::rooms).post(chat::create_room))
        .route("/api/v1/chat/rooms/{id}/messages", get(chat::messages).post(chat::post_message))
        .route("/api/v1/chat/rooms/{id}/read", post(chat::mark_read))
        .route(
            "/api/v1/chat/rooms/{id}/files",
            post(chat::upload).layer(DefaultBodyLimit::max(chat::MAX_FILE + 1024 * 1024)),
        )
        .route("/api/v1/chat/files/{id}", get(chat::download))
        // Webmail
        .route("/.well-known/mta-sts.txt", get(mail::mta_sts))
        .route("/api/v1/mail", get(mail::overview))
        .route("/api/v1/mail/messages", get(mail::list))
        .route("/api/v1/mail/messages/{id}", get(mail::get).patch(mail::patch).delete(mail::delete))
        .route("/api/v1/mail/messages/{id}/raw", get(mail::raw))
        .route("/api/v1/mail/messages/{id}/attachments/{n}", get(mail::attachment))
        .route("/api/v1/mail/send", post(mail::send).layer(DefaultBodyLimit::max(40 * 1024 * 1024)))
        .route("/api/v1/mail/admin", get(mail::admin))
        .route("/api/v1/mail/mailboxes", get(mail::mailboxes))
        .route("/api/v1/mail/rules", get(mail::list_rules).post(mail::create_rule))
        .route("/api/v1/mail/rules/{id}", patch(mail::patch_rule).delete(mail::delete_rule))
        .route("/api/v1/mail/domains", post(mail::add_domain))
        .route("/api/v1/mail/aliases", post(mail::add_alias))
        .route("/api/v1/mail/aliases/{address}", delete(mail::delete_alias))
        .route("/api/v1/account/app-passwords", get(mail::app_passwords).post(mail::create_app_password))
        .route("/api/v1/account/app-passwords/{id}", delete(mail::delete_app_password))
        // Geräte
        .route("/api/v1/devices", get(devices::list).post(devices::register))
        .route("/api/v1/devices/report", post(devices::report))
        // Fernwartung
        .route("/api/v1/devices/ws", get(remote::device_ws))
        .route("/api/v1/devices/{id}/remote", get(remote::status))
        .route("/api/v1/devices/{id}/inventory", post(remote::inventory))
        .route("/api/v1/devices/{id}/exec", post(remote::exec))
        .route("/api/v1/devices/{id}/reboot", post(remote::reboot))
        .route("/api/v1/devices/{id}/files", get(remote::list_dir))
        .route(
            "/api/v1/devices/{id}/file",
            get(remote::get_file).post(remote::put_file).layer(DefaultBodyLimit::max(50 * 1024 * 1024)),
        )
        .route("/api/v1/devices/{id}/screen", get(remote::screen_ws))
        // Support-Tickets
        .route("/api/v1/tickets", get(tickets::list).post(tickets::create))
        .route("/api/v1/tickets/stats", get(tickets::stats))
        .route("/api/v1/tickets/{id}", get(tickets::get).patch(tickets::patch))
        .route("/api/v1/tickets/{id}/messages", post(tickets::reply))
        .route("/api/v1/organizations/{id}/sla", put(tickets::set_sla))
        // Mitarbeiter: Zeiterfassung, Urlaub, Kalender
        .route("/api/v1/time", get(hr::time_list).post(hr::time_add))
        .route("/api/v1/time/status", get(hr::time_status))
        .route("/api/v1/time/clock", post(hr::clock))
        .route("/api/v1/time/{id}", put(hr::time_update).delete(hr::time_delete))
        .route("/api/v1/leave", get(hr::leave_list).post(hr::leave_create))
        .route("/api/v1/leave/{id}", patch(hr::leave_patch))
        .route("/api/v1/calendar", get(hr::calendar).post(hr::event_create))
        .route("/api/v1/calendar/{id}", put(hr::event_update).delete(hr::event_delete))
        .route("/api/v1/calendar/{id}/respond", post(hr::event_respond))
        .route("/api/v1/people", get(hr::people))
        // Einmal-Zugriffscodes (Kunde gibt Geräte für Techniker frei)
        .route("/api/v1/access-codes", get(access::list).post(access::create))
        .route("/api/v1/access-codes/redeem", post(access::redeem))
        .route("/api/v1/access-codes/{id}/revoke", post(access::revoke))
        .route("/api/v1/devices/{id}/access-policy", put(access::set_policy))
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
