//! codecraft-server
//!
//!   codecraft-server                                          → API + Webseite/Portal starten (migriert automatisch)
//!   codecraft-server create-admin <email> <name> <passwort>   → Admin anlegen (alle Abteilungen), gibt API-Token aus

use codecraft_server::{app, app_with_frontend, auth, connect, AppState, MIGRATOR};
use std::path::PathBuf;
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=warn".into()))
        .init();

    let database_url = std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL fehlt")?;
    let db = connect(&database_url).await?;
    MIGRATOR.run(&db).await?;

    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("create-admin") {
        let [_, email, name, password] = args.as_slice() else {
            return Err("Nutzung: codecraft-server create-admin <email> <name> <passwort>".into());
        };
        auth::password_policy(password).map_err(|e| e.to_string())?;
        let user_id = Uuid::now_v7();
        let token = auth::new_token("cc_u_");
        let mut tx = db.begin().await?;
        sqlx::query(
            "INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, lower($2), $3, 'admin', $4)",
        )
        .bind(user_id)
        .bind(email)
        .bind(name)
        .bind(auth::hash_password(password).map_err(|e| e.to_string())?)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO user_departments (user_id, department_id, is_primary)
             SELECT $1, id, code = 'MGT' FROM departments",
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO api_tokens (id, token_hash, user_id, name) VALUES ($1, $2, $3, 'bootstrap')")
            .bind(Uuid::now_v7())
            .bind(auth::hash_token(&token))
            .bind(user_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        println!("{token}");
        return Ok(());
    }
    if !args.is_empty() {
        return Err("Unbekannter Befehl. Nutzung: codecraft-server [create-admin <email> <name> <passwort>]".into());
    }

    let bind = std::env::var("BIND").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let static_dir = PathBuf::from(std::env::var("STATIC_DIR").unwrap_or_else(|_| "apps/web/dist".into()));
    let state = AppState { db };
    let router = if static_dir.join("index.html").exists() {
        tracing::info!("Frontend aus {}", static_dir.display());
        app_with_frontend(state, static_dir)
    } else {
        tracing::warn!("Kein Frontend unter {} – nur API", static_dir.display());
        app(state)
    };
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!("codecraft-server: http://{bind}");
    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
