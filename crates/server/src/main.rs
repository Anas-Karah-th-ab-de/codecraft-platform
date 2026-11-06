//! codecraft-server
//!
//!   codecraft-server                               → API starten (migriert automatisch)
//!   codecraft-server create-admin <email> <name>   → Admin anlegen und API-Token ausgeben (Bootstrap)

use codecraft_server::{app, auth, connect, AppState, MIGRATOR};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=info".into()))
        .init();

    let database_url = std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL fehlt")?;
    let db = connect(&database_url).await?;
    MIGRATOR.run(&db).await?;

    let args: Vec<String> = std::env::args().skip(1).collect();
    if let [cmd, email, name] = args.as_slice() {
        if cmd == "create-admin" {
            let user_id = Uuid::now_v7();
            let token = auth::new_token("cc_u_");
            let mut tx = db.begin().await?;
            sqlx::query("INSERT INTO users (id, email, display_name, role) VALUES ($1, $2, $3, 'admin')")
                .bind(user_id)
                .bind(email)
                .bind(name)
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
    }
    if !args.is_empty() {
        return Err("Unbekannter Befehl. Nutzung: codecraft-server [create-admin <email> <name>]".into());
    }

    let bind = std::env::var("BIND").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!("codecraft-server lauscht auf {bind}");
    axum::serve(listener, app(AppState { db }))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
