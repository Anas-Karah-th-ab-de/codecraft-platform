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
    // import-users <export-ordner> <liste.csv> : alte Benutzer übernehmen, je ein Einmal-Passwort
    // reset-passwords <liste.csv> <email>…    : Einmal-Passwörter für bestehende Benutzer
    // Die Liste wird mit Rechten 600 neu angelegt (nie überschrieben) – sicher übergeben, dann löschen.
    if args.first().map(String::as_str) == Some("import-users") {
        let (dir, out, skip) = match args.as_slice() {
            [_, dir, out] => (dir, out, vec![]),
            [_, dir, out, flag, list] if flag == "--skip" => {
                (dir, out, list.split(',').map(|e| e.trim().to_lowercase()).collect())
            }
            _ => {
                return Err(
                    "Nutzung: codecraft-server import-users <export-ordner> <liste.csv> [--skip a@b.de,c@d.de]".into()
                )
            }
        };
        if std::path::Path::new(out).exists() {
            return Err(format!("{out} existiert bereits").into());
        }
        let (created, skipped) = codecraft_server::legacy_users::import(&db, std::path::Path::new(dir), &skip).await?;
        codecraft_server::legacy_users::write_list(std::path::Path::new(out), &created)?;
        for s in &skipped {
            eprintln!("übersprungen: {s}");
        }
        println!("{} Benutzer angelegt → {out}", created.len());
        return Ok(());
    }
    if args.first().map(String::as_str) == Some("reset-passwords") {
        let [_, out, emails @ ..] = args.as_slice() else {
            return Err("Nutzung: codecraft-server reset-passwords <liste.csv> <email>…".into());
        };
        if emails.is_empty() || std::path::Path::new(out).exists() {
            return Err("E-Mail-Adressen fehlen oder Liste existiert bereits".into());
        }
        let rows = codecraft_server::legacy_users::reset(&db, emails).await?;
        codecraft_server::legacy_users::write_list(std::path::Path::new(out), &rows)?;
        println!("{} Einmal-Passwörter → {out}", rows.len());
        return Ok(());
    }
    // mail-key : neuen Schlüssel für MAIL_ENC_KEY ausgeben
    if args.first().map(String::as_str) == Some("mail-key") {
        println!("{}", codecraft_server::mail::guard::new_key());
        return Ok(());
    }
    // mail-account <adresse> <name> <rolle> : Konto mit Postfach anlegen bzw. Passwort setzen.
    // Passwort kommt über stdin (nie als Argument, damit es nicht in der Prozessliste steht).
    if args.first().map(String::as_str) == Some("mail-account") {
        let [_, address, name, role] = args.as_slice() else {
            return Err("Nutzung: echo PASSWORT | codecraft-server mail-account <adresse> <name> <rolle>".into());
        };
        let role_enum: codecraft_domain::access::Role = serde_json::from_value(serde_json::json!(role))?;
        let mut pw = String::new();
        std::io::stdin().read_line(&mut pw)?;
        let pw = pw.trim_end_matches(['\r', '\n']);
        if pw.len() < 8 {
            return Err("Passwort zu kurz (mindestens 8 Zeichen)".into());
        }
        let hash = auth::hash_password(pw).map_err(|e| e.to_string())?;
        let address = address.to_lowercase();
        let mut tx = db.begin().await?;
        let existing: Option<Uuid> = sqlx::query_scalar("SELECT id FROM users WHERE lower(email) = $1")
            .bind(&address)
            .fetch_optional(&mut *tx)
            .await?;
        let user_id = match existing {
            Some(id) => {
                sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1")
                    .bind(id)
                    .bind(&hash)
                    .execute(&mut *tx)
                    .await?;
                id
            }
            None => {
                let id = Uuid::now_v7();
                sqlx::query(
                    "INSERT INTO users (id, email, display_name, role, password_hash) VALUES ($1, $2, $3, $4, $5)",
                )
                .bind(id)
                .bind(&address)
                .bind(name)
                .bind(role)
                .bind(&hash)
                .execute(&mut *tx)
                .await?;
                id
            }
        };
        let mailbox = codecraft_server::routes::chat::provision(&mut tx, user_id, &address, name, role_enum, None)
            .await
            .map_err(|e| format!("{e:?}"))?;
        tx.commit().await?;
        println!("{address}: Konto bereit, Postfach {}", mailbox.unwrap_or_else(|| "–".into()));
        return Ok(());
    }
    // mail-import [--into <adresse>] [--folder <ordner>] <datei.pager>… : Mailcow-Export übernehmen
    // (Postfach = Dateiname ohne .pager, außer bei --into)
    if args.first().map(String::as_str) == Some("mail-import") {
        let (mut into, mut folder, mut files) = (None::<String>, None::<String>, vec![]);
        let mut it = args[1..].iter();
        while let Some(a) = it.next() {
            match a.as_str() {
                "--into" => into = it.next().cloned(),
                "--folder" => folder = it.next().cloned(),
                f => files.push(f.to_string()),
            }
        }
        for file in &files {
            let path = std::path::Path::new(file);
            let address = into.clone().unwrap_or_else(|| {
                path.file_name().and_then(|n| n.to_str()).unwrap_or("").trim_end_matches(".pager").to_string()
            });
            let mut records = codecraft_server::mail::import::parse_pager(&std::fs::read(path)?);
            if let Some(f) = &folder {
                records.iter_mut().for_each(|r| r.mailbox = f.clone());
            }
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
    tokio::spawn(codecraft_server::routes::meet::reminder_worker(db.clone()));
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
