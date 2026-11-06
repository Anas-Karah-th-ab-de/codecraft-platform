//! API-Server: Router, Zustand, Migrationen.

pub mod auth;
pub mod error;
pub mod routes;

use axum::Router;
use sqlx::PgPool;
use std::time::Duration;
use tower_http::{limit::RequestBodyLimitLayer, trace::TraceLayer};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .merge(routes::router())
        .with_state(state)
        .layer(RequestBodyLimitLayer::new(1024 * 1024))
        .layer(TraceLayer::new_for_http())
}
