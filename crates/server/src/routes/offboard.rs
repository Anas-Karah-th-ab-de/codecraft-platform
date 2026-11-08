//! Benutzer sperren, entsperren und entfernen – mit Übergabe der offenen Aufgaben.
//!
//! Sperren wirkt sofort: alle Sitzungen, Schlüssel, App-Passwörter und Push-Abos werden
//! ungültig, offene Verbindungen (Portal, App, VS Code) getrennt. Belege, Tickets und
//! Nachrichten bleiben erhalten (Aufbewahrungspflicht, Nachvollziehbarkeit).
//! Entfernen gibt zusätzlich die E-Mail-Adresse frei und blendet das Konto aus.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::Json;
use codecraft_domain::access::Permission;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

/// Was hängt an dem Konto? (für den Übergabe-Dialog)
pub async fn handover_info(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    user.require(Permission::UserManage, None)?;
    let (role, name, active): (String, String, bool) =
        sqlx::query_as("SELECT role, display_name, is_active FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&s.db)
            .await?
            .ok_or(ApiError::NotFound)?;
    let r: (i64, i64, i64, i64, i64, i64, i64, Option<String>, i64) = sqlx::query_as(
        "SELECT
           (SELECT count(*) FROM tickets WHERE assignee_id = $1 AND status NOT IN ('resolved','closed')),
           (SELECT count(*) FROM leave_requests WHERE substitute_id = $1 AND status IN ('requested','approved') AND end_date >= current_date),
           (SELECT count(*) FROM leave_requests WHERE user_id = $1 AND status = 'requested'),
           (SELECT count(*) FROM calendar_events WHERE created_by = $1 AND starts_at > now()),
           (SELECT count(*) FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())),
           (SELECT count(*) FROM push_subscriptions WHERE user_id = $1),
           (SELECT count(*) FROM chat_members m JOIN chat_rooms r ON r.id = m.room_id WHERE m.user_id = $1 AND r.kind IN ('group','support','project')),
           (SELECT address FROM mailboxes WHERE user_id = $1),
           (SELECT count(*) FROM time_entries WHERE user_id = $1 AND ended_at IS NULL)",
    )
    .bind(id)
    .fetch_one(&s.db)
    .await?;
    Ok(Json(json!({
        "name": name, "role": role, "active": active,
        "tickets": r.0, "substitute_for": r.1, "leave_open": r.2, "events": r.3, "sessions": r.4,
        "devices": r.5, "rooms": r.6, "mailbox": r.7, "running_timer": r.8,
    })))
}

#[derive(Deserialize)]
pub struct DeactivateIn {
    #[serde(default)]
    pub reason: String,
    /// Offene Tickets, Vertretungen, künftige Termine an diese Person
    pub handover_to: Option<Uuid>,
    /// E-Mails ans Postfach der Übernahme-Person weiterleiten (Postfach bleibt empfangsbereit)
    #[serde(default)]
    pub forward_mail: bool,
    /// Konto entfernen: E-Mail-Adresse freigeben, aus Listen ausblenden, Abteilungen lösen
    #[serde(default)]
    pub remove: bool,
}

pub async fn deactivate(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<DeactivateIn>,
) -> ApiResult<Json<Value>> {
    user.require(Permission::UserManage, None)?;
    if id == user.id {
        return Err(ApiError::Conflict("Das eigene Konto kann nicht gesperrt werden".into()));
    }
    if b.reason.chars().count() > 500 {
        return Err(ApiError::BadRequest("Grund höchstens 500 Zeichen".into()));
    }
    let mut tx = s.db.begin().await?;
    let (role, name, email, active, removed): (String, String, String, bool, bool) = sqlx::query_as(
        "SELECT role, display_name, email, is_active, removed_at IS NOT NULL FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    if role == "device" {
        return Err(ApiError::BadRequest("Geräte werden unter Geräte verwaltet".into()));
    }
    if removed {
        return Err(ApiError::Conflict("Konto ist bereits entfernt".into()));
    }
    if role == "admin" && active {
        let admins: i64 =
            sqlx::query_scalar("SELECT count(*) FROM users WHERE role = 'admin' AND is_active AND id <> $1")
                .bind(id)
                .fetch_one(&mut *tx)
                .await?;
        if admins == 0 {
            return Err(ApiError::Conflict("Der letzte aktive Admin kann nicht gesperrt werden".into()));
        }
    }
    // Übernahme-Person muss aktiver Mitarbeiter sein
    let target: Option<(Uuid, String, Option<String>)> = match b.handover_to {
        Some(h) if h != id => sqlx::query_as(
            "SELECT u.id, u.display_name, (SELECT address FROM mailboxes WHERE user_id = u.id AND is_active)
               FROM users u WHERE u.id = $1 AND u.is_active AND u.role NOT IN ('customer','device')",
        )
        .bind(h)
        .fetch_optional(&mut *tx)
        .await?
        .map(Some)
        .ok_or_else(|| ApiError::BadRequest("Übernahme-Person ist kein aktiver Mitarbeiter".into()))?,
        Some(_) => return Err(ApiError::BadRequest("Übergabe an sich selbst".into())),
        None => None,
    };
    if b.forward_mail && target.as_ref().and_then(|t| t.2.as_ref()).is_none() {
        return Err(ApiError::BadRequest("Für die Weiterleitung braucht die Übernahme-Person ein Postfach".into()));
    }

    // 1. Konto sperren
    sqlx::query(
        "UPDATE users SET is_active = false, deactivated_at = COALESCE(deactivated_at, now()), deactivated_by = $2,
                deactivated_reason = NULLIF($3, '') WHERE id = $1",
    )
    .bind(id)
    .bind(user.id)
    .bind(b.reason.trim())
    .execute(&mut *tx)
    .await?;
    // 2. Zugänge entziehen
    let sessions = sqlx::query("UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL")
        .bind(id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    sqlx::query("DELETE FROM app_passwords WHERE user_id = $1").bind(id).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM push_subscriptions WHERE user_id = $1").bind(id).execute(&mut *tx).await?;
    // laufende Zeiterfassung beenden
    let timers = sqlx::query("UPDATE time_entries SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL")
        .bind(id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    // offene eigene Urlaubsanträge zurückziehen
    sqlx::query("UPDATE leave_requests SET status = 'cancelled' WHERE user_id = $1 AND status = 'requested'")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // 3. Übergabe (ohne Übernahme-Person: Tickets zurück in die Warteschlange, Vertretung frei)
    let to = target.as_ref().map(|t| t.0);
    let tickets = sqlx::query(
        "UPDATE tickets SET assignee_id = $2, updated_at = now() WHERE assignee_id = $1 AND status NOT IN ('resolved','closed')",
    )
    .bind(id)
    .bind(to)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let subs = sqlx::query(
        "UPDATE leave_requests SET substitute_id = CASE WHEN user_id = $2 THEN NULL ELSE $2 END
          WHERE substitute_id = $1 AND status IN ('requested','approved') AND end_date >= current_date",
    )
    .bind(id)
    .bind(to)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let events = match to {
        Some(to) => {
            sqlx::query("UPDATE calendar_events SET created_by = $2 WHERE created_by = $1 AND starts_at > now()")
                .bind(id)
                .bind(to)
                .execute(&mut *tx)
                .await?
                .rows_affected()
        }
        None => 0,
    };
    // Zusage zu künftigen Terminen zurücknehmen
    sqlx::query(
        "DELETE FROM calendar_attendees a USING calendar_events e WHERE a.event_id = e.id AND a.user_id = $1 AND e.starts_at > now()",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    // 4. E-Mail
    let mailbox: Option<(Uuid, String)> = sqlx::query_as("SELECT id, address FROM mailboxes WHERE user_id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    let mut forwarded = None;
    if let Some((mb, _)) = &mailbox {
        if b.forward_mail {
            let to_addr = target.as_ref().and_then(|t| t.2.clone()).unwrap_or_default();
            sqlx::query("UPDATE mail_rules SET is_active = false WHERE mailbox_id = $1")
                .bind(mb)
                .execute(&mut *tx)
                .await?;
            sqlx::query(
                "INSERT INTO mail_rules (id, mailbox_id, sender, forward_to, keep_copy, note, created_by)
                 VALUES ($1, $2, NULL, $3, true, $4, $5)",
            )
            .bind(Uuid::now_v7())
            .bind(mb)
            .bind(&to_addr)
            .bind(format!("Übergabe: {name} gesperrt"))
            .bind(user.id)
            .execute(&mut *tx)
            .await?;
            forwarded = Some(to_addr);
        } else if b.remove {
            // entfernt und keine Weiterleitung → Postfach nimmt nichts mehr an
            sqlx::query("UPDATE mailboxes SET is_active = false WHERE id = $1").bind(mb).execute(&mut *tx).await?;
            sqlx::query("DELETE FROM mail_aliases WHERE mailbox_id = $1").bind(mb).execute(&mut *tx).await?;
        }
    }

    // 5. Chat: aus Gruppen/Support-Räumen austragen (Direktchats bleiben als Verlauf)
    let rooms = sqlx::query(
        "DELETE FROM chat_members m USING chat_rooms r WHERE r.id = m.room_id AND m.user_id = $1 AND r.kind IN ('group','support','project')",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    // 6. Entfernen: Adresse freigeben, Abteilungen lösen
    if b.remove {
        sqlx::query(
            "UPDATE users SET removed_at = now(), removed_email = email,
                    email = 'entfernt+' || id || '@invalid.local', totp_secret = NULL, password_hash = NULL
              WHERE id = $1",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
        sqlx::query("DELETE FROM user_departments WHERE user_id = $1").bind(id).execute(&mut *tx).await?;
    }

    let summary = json!({
        "sessions": sessions, "tickets": tickets, "substitutes": subs, "events": events, "rooms": rooms,
        "timers": timers, "forward_mail": forwarded, "removed": b.remove, "handover_to": target.as_ref().map(|t| t.0),
    });
    super::audit(
        &mut tx,
        &user.actor(),
        if b.remove { "remove" } else { "deactivate" },
        "user",
        id,
        json!({ "email": email, "reason": b.reason, "summary": summary }),
    )
    .await?;
    tx.commit().await?;

    // sofort trennen (Portal, App, VS Code)
    super::chat::kick_user(id);
    // Übernahme-Person informieren
    if let Some((to, _, _)) = &target {
        let mut body = vec![];
        if tickets > 0 {
            body.push(format!("{tickets} Tickets"));
        }
        if subs > 0 {
            body.push(format!("{subs} Vertretungen"));
        }
        if events > 0 {
            body.push(format!("{events} Termine"));
        }
        if let Some(f) = &forwarded {
            body.push(format!("E-Mails → {f}"));
        }
        super::notify::emit(
            &s.db,
            &[*to],
            super::notify::Note::new("user", "deactivated", Some(id), &name).body(&body.join(" · ")).priority(2),
        );
    }
    Ok(Json(summary))
}

/// Gesperrtes (nicht entferntes) Konto wieder freischalten – mit Einmal-Passwort
pub async fn reactivate(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<Value>> {
    user.require(Permission::UserManage, None)?;
    let mut tx = s.db.begin().await?;
    let row: Option<(bool, bool)> = sqlx::query_as(
        "SELECT is_active, removed_at IS NOT NULL FROM users WHERE id = $1 AND role <> 'device' FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    match row {
        None => return Err(ApiError::NotFound),
        Some((_, true)) => return Err(ApiError::Conflict("Entfernte Konten bitte neu anlegen".into())),
        Some((true, _)) => return Err(ApiError::Conflict("Konto ist aktiv".into())),
        _ => {}
    }
    sqlx::query(
        "UPDATE users SET is_active = true, deactivated_at = NULL, deactivated_by = NULL, deactivated_reason = NULL WHERE id = $1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    // Weiterleitung aus der Übergabe beenden
    sqlx::query(
        "UPDATE mail_rules SET is_active = false WHERE note LIKE 'Übergabe:%' AND mailbox_id IN (SELECT id FROM mailboxes WHERE user_id = $1)",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    let pw = super::account::set_onetime_password(&mut tx, &user.actor(), id).await?;
    super::audit(&mut tx, &user.actor(), "reactivate", "user", id, json!({})).await?;
    tx.commit().await?;
    Ok(Json(json!({ "password": pw })))
}
