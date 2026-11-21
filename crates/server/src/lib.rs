//! API-Server: Router, Zustand, Migrationen, Auslieferung des Frontends.

pub mod auth;
pub mod error;
pub mod legacy_pdf;
pub mod legacy_users;
pub mod mail;
pub mod pdf;
pub mod push;
pub mod routes;
pub mod seo;
pub mod stun;
pub mod turn;

use axum::extract::DefaultBodyLimit;
use axum::http::{header, HeaderValue};
use axum::Router;
use sqlx::PgPool;
use std::path::PathBuf;
use std::time::Duration;
use tower_http::compression::predicate::{DefaultPredicate, NotForContentType, Predicate};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::{compression::CompressionLayer, trace::TraceLayer};

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

/// Nur API (für Tests)
pub fn app(state: AppState) -> Router {
    Router::new()
        .merge(routes::router())
        .with_state(state)
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(TraceLayer::new_for_http())
}

/// API + Frontend (Webseite & Portal als Single-Page-App aus `static_dir`)
pub fn app_with_frontend(state: AppState, static_dir: PathBuf) -> Router {
    let index = static_dir.join("index.html");
    // Die Startseite (index.html) verweist auf Dateien mit Hash im Namen. Nach einem Deploy darf keine alte
    // Fassung aus dem Cache kommen – sonst lädt die App Dateien, die es nicht mehr gibt (weiße Seite).
    let spa = Router::new()
        .fallback_service(
            ServeDir::new(&static_dir).append_index_html_on_directories(true).fallback(ServeFile::new(index)),
        )
        // Titel, Beschreibung und Vorschaubild je Seite (für WhatsApp, Suchmaschinen …)
        .layer(axum::middleware::from_fn(seo::inject))
        .layer(SetResponseHeaderLayer::if_not_present(header::CACHE_CONTROL, |r: &axum::response::Response| {
            let html = r
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .is_some_and(|v| v.starts_with("text/html"));
            html.then(|| HeaderValue::from_static("no-cache"))
        }));
    // Produktbilder: Dateinamen enthalten eine UUID → unveränderlich, ein Jahr cachebar
    let media = Router::new().fallback_service(ServeDir::new(routes::media::media_dir())).layer(
        SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        ),
    );
    // Gebaute JS/CSS-Dateien tragen einen Hash im Namen → ebenfalls unveränderlich
    // (nur erfolgreiche Antworten – ein 404 für eine Datei eines alten Stands darf nicht ein Jahr im Cache bleiben)
    let assets = Router::new().fallback_service(ServeDir::new(static_dir.join("assets"))).layer(
        SetResponseHeaderLayer::overriding(header::CACHE_CONTROL, |r: &axum::response::Response| {
            let ok = r.status().is_success() || r.status() == axum::http::StatusCode::NOT_MODIFIED;
            Some(HeaderValue::from_static(if ok { "public, max-age=31536000, immutable" } else { "no-store" }))
        }),
    );
    // Logo, Videos, Poster: feste Namen → einen Tag cachen (Range-Anfragen für Videos unterstützt ServeDir)
    let brand = Router::new().fallback_service(ServeDir::new(static_dir.join("brand"))).layer(
        SetResponseHeaderLayer::overriding(header::CACHE_CONTROL, HeaderValue::from_static("public, max-age=86400")),
    );
    app(state)
        .nest_service("/media", media)
        .nest_service("/brand", brand)
        .nest_service("/assets", assets)
        .fallback_service(spa)
        .layer(
            CompressionLayer::new().compress_when(DefaultPredicate::new().and(NotForContentType::const_new("video/"))),
        )
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY")))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::REFERRER_POLICY,
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        // Nur eigene Skripte; Bilder auch https (Webmail „Bilder laden“); Verbindungen nur zum eigenen Server
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; \
                 media-src 'self' blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-src 'self' blob:; \
                 object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
            ),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=63072000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static(
                "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
            ),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            axum::http::HeaderName::from_static("cross-origin-opener-policy"),
            HeaderValue::from_static("same-origin"),
        ))
}
