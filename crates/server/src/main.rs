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
    // mail-key : neuen Schlüssel für MAIL_ENC_KEY ausgeben
    if args.first().map(String::as_str) == Some("mail-key") {
        println!("{}", codecraft_server::mail::guard::new_key());
        return Ok(());
    }
    // mail-import <datei.pager>… : Mailcow-Export übernehmen (Postfach = Dateiname ohne .pager)
    if args.first().map(String::as_str) == Some("mail-import") {
        for file in &args[1..] {
            let path = std::path::Path::new(file);
            let address =
                path.file_name().and_then(|n| n.to_str()).unwrap_or("").trim_end_matches(".pager").to_string();
            let records = codecraft_server::mail::import::parse_pager(&std::fs::read(path)?);
            match codecraft_server::mail::import::import(&db, &address, &records).await {
                Ok((done, skipped)) => {
                    println!("{address}: {} gelesen, {done} übernommen, {skipped} übersprungen", records.len())
                }
                Err(e) => println!("{address}: {e}"),
            }
        }
        return Ok(());
    }
    if !args.is_empty() {
        return Err("Unbekannter Befehl. Nutzung: codecraft-server [create-admin <email> <name> <passwort>]".into());
    }

    let bind = std::env::var("BIND").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let static_dir = PathBuf::from(std::env::var("STATIC_DIR").unwrap_or_else(|_| "apps/web/dist".into()));
    let state_db = db.clone();
    let state = AppState { db };
    let router = if static_dir.join("index.html").exists() {
        tracing::info!("Frontend aus {}", static_dir.display());
        app_with_frontend(state, static_dir)
    } else {
        tracing::warn!("Kein Frontend unter {} – nur API", static_dir.display());
        app(state)
    };
    // Eigener STUN/TURN-Server für Anrufe (UDP); STUN_BIND=off schaltet ihn ab, TURN=off nur das Relay
    let stun = std::env::var("STUN_BIND").unwrap_or_else(|_| "0.0.0.0:3478".into());
    if stun != "off" {
        tokio::spawn(codecraft_server::turn::serve(stun));
    }
    start_mail(&state_db);
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!("codecraft-server: http://{bind}");
    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}

/// Eigener Mailserver: DKIM-Schlüssel, Versand-Warteschlange, SMTP (25/587/465) und IMAP (143/993).
/// Jede Adresse per Umgebungsvariable änderbar, „off“ schaltet ab; MAIL=off schaltet alles ab.
fn start_mail(db: &sqlx::PgPool) {
    use codecraft_server::mail::{self, smtp::Mode};
    if std::env::var("MAIL").is_ok_and(|v| v == "off") {
        return;
    }
    let env = |k: &str, d: &str| std::env::var(k).unwrap_or_else(|_| d.into());
    let on = |v: &String| v != "off";
    let tls = mail::tls::acceptor().is_some();
    {
        let db = db.clone();
        tokio::spawn(async move {
            if let Err(e) = mail::ensure_dkim(&db).await {
                tracing::error!("DKIM: {e}");
            }
        });
    }
    tokio::spawn(mail::outbound::worker(db.clone()));
    let smtp = env("SMTP_BIND", "0.0.0.0:25");
    if on(&smtp) {
        tokio::spawn(mail::smtp::serve(db.clone(), smtp, Mode::Mx));
    }
    let sub = env("SUBMISSION_BIND", "0.0.0.0:587");
    if on(&sub) {
        tokio::spawn(mail::smtp::serve(db.clone(), sub, Mode::Submission));
    }
    let imap = env("IMAP_BIND", "0.0.0.0:143");
    if on(&imap) {
        tokio::spawn(mail::imap::serve(db.clone(), imap, false));
    }
    if tls {
        let subs = env("SUBMISSIONS_BIND", "0.0.0.0:465");
        if on(&subs) {
            tokio::spawn(mail::smtp::serve(db.clone(), subs, Mode::SubmissionTls));
        }
        let imaps = env("IMAPS_BIND", "0.0.0.0:993");
        if on(&imaps) {
            tokio::spawn(mail::imap::serve(db.clone(), imaps, true));
        }
    } else {
        tracing::warn!("Mail-TLS fehlt (MAIL_TLS_CERT/MAIL_TLS_KEY) – Ports 465/993 aus, Anmeldung nur mit MAIL_ALLOW_PLAIN_AUTH=1");
    }
}
