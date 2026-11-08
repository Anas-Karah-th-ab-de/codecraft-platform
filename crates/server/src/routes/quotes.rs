//! Angebote (Kostenvoranschläge) erstellen, senden, annehmen, abrechnen.
//!
//! Ablauf: Entwurf (Positionen in Blöcken, Meilensteine, Zahlungsplan) → an Kunden senden
//! (Druckdaten werden eingefroren) → Kunde nimmt im Portal an oder lehnt ab → bei Annahme
//! entsteht das Projekt mit den Meilensteinen → Rechnung (komplett, Anzahlung oder Zahlungsrate).
//!
//! Verträge sind Angebote der Art `contract` mit Laufzeit, wiederkehrendem Entgelt und
//! Kündigungsfrist (Rechnung je Abrechnungszeitraum). Nach einer mündlichen Vereinbarung kann
//! das Team ein Angebot/einen Vertrag selbst als angenommen festhalten (mit Vermerk, protokolliert).

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{NaiveDate, Utc};
use codecraft_domain::access::Permission;
use codecraft_domain::invoice::{compute_totals, tax_notice, LineItem, TaxMode, Unit};
use codecraft_domain::money::Cents;
use codecraft_domain::numbering::Series;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgConnection;
use uuid::Uuid;

use super::shop::{notify, org_users};

const STANDARD_RATE_BP: u32 = 1900;

fn mode(s: &str) -> Option<TaxMode> {
    Some(match s {
        "standard" => TaxMode::Standard,
        "reverse_charge" => TaxMode::ReverseCharge,
        "not_taxable" => TaxMode::NotTaxable,
        _ => return None,
    })
}

fn is_hours(unit: &str) -> bool {
    let u = unit.to_lowercase();
    u.starts_with("std") || u.starts_with("stunde") || u.starts_with('h') || u.contains("hour") || u.contains("ساع")
}

#[derive(Deserialize, Clone)]
pub struct ItemIn {
    pub block_nr: Option<i32>,
    pub block_title: Option<String>,
    pub position_nr: Option<String>,
    pub description: String,
    /// Menge × 1000
    pub quantity_milli: i64,
    pub unit: String,
    pub unit_price_cents: i64,
}

#[derive(Deserialize, Clone)]
pub struct MilestoneIn {
    pub label: String,
    pub title: String,
    pub blocks: Option<String>,
    pub goal: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct PaymentIn {
    pub label: String,
    pub due_date: Option<NaiveDate>,
    pub amount_cents: i64,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct QuoteIn {
    pub organization_id: Uuid,
    pub project_id: Option<Uuid>,
    /// Entwicklungsanfrage, zu der das Angebot gehört (wird beim Senden auf „Angebot liegt vor“ gesetzt)
    pub request_id: Option<Uuid>,
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub revision: Option<String>,
    #[serde(default = "eur")]
    pub currency: String,
    #[serde(default = "standard")]
    pub tax_mode: String,
    pub tax_note: Option<String>,
    pub locale: Option<String>,
    pub valid_until: Option<NaiveDate>,
    pub project_start: Option<NaiveDate>,
    pub project_end: Option<NaiveDate>,
    pub hourly_rate_cents: Option<i64>,
    pub discounted_rate_cents: Option<i64>,
    pub advance_percent: Option<i32>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub items: Vec<ItemIn>,
    #[serde(default)]
    pub milestones: Vec<MilestoneIn>,
    #[serde(default)]
    pub payments: Vec<PaymentIn>,
    /// leer = Standard des Kunden bzw. globaler Standard
    pub payment_method_id: Option<Uuid>,
    /// quote | contract
    #[serde(default = "quote_kind")]
    pub doc_kind: String,
    pub contract_start: Option<NaiveDate>,
    pub contract_end: Option<NaiveDate>,
    /// monthly | quarterly | yearly
    pub billing_interval: Option<String>,
    /// Entgelt je Zeitraum (netto)
    pub recurring_cents: Option<i64>,
    pub notice_days: Option<i32>,
}

fn quote_kind() -> String {
    "quote".into()
}

fn eur() -> String {
    "EUR".into()
}
fn standard() -> String {
    "standard".into()
}

struct Checked {
    tax: TaxMode,
    rate_bp: i32,
    net: i64,
    tax_cents: i64,
    gross: i64,
    hours_milli: Option<i64>,
    totals: Vec<i64>,
}

fn check(b: &QuoteIn) -> ApiResult<Checked> {
    let tax = mode(&b.tax_mode).ok_or_else(|| ApiError::BadRequest("Steuerfall ungültig".into()))?;
    if !matches!(b.currency.as_str(), "EUR" | "USD" | "CHF" | "GBP" | "SAR" | "AED" | "TRY") {
        return Err(ApiError::BadRequest("Währung nicht unterstützt".into()));
    }
    let title = b.title.trim();
    if title.is_empty() || title.chars().count() > 300 {
        return Err(ApiError::BadRequest("Titel 1–300 Zeichen".into()));
    }
    let contract = match b.doc_kind.as_str() {
        "quote" => false,
        "contract" => true,
        _ => return Err(ApiError::BadRequest("Art: quote oder contract".into())),
    };
    if contract {
        let start = b.contract_start.ok_or_else(|| ApiError::BadRequest("Vertragsbeginn fehlt".into()))?;
        if b.contract_end.is_some_and(|e| e < start) {
            return Err(ApiError::BadRequest("Vertragsende vor Vertragsbeginn".into()));
        }
        if !b.billing_interval.as_deref().is_some_and(|i| matches!(i, "monthly" | "quarterly" | "yearly")) {
            return Err(ApiError::BadRequest("Abrechnung: monthly, quarterly oder yearly".into()));
        }
        if !b.recurring_cents.is_some_and(|c| c >= 0) {
            return Err(ApiError::BadRequest("Entgelt je Zeitraum fehlt".into()));
        }
        if b.notice_days.is_some_and(|d| !(0..=730).contains(&d)) {
            return Err(ApiError::BadRequest("Kündigungsfrist 0–730 Tage".into()));
        }
    }
    // Verträge dürfen ohne einmalige Positionen auskommen (nur laufendes Entgelt)
    if (b.items.is_empty() && !contract) || b.items.len() > 500 || b.milestones.len() > 50 || b.payments.len() > 20 {
        return Err(ApiError::BadRequest("1–500 Positionen, höchstens 50 Meilensteine und 20 Raten".into()));
    }
    if b.advance_percent.is_some_and(|p| !(0..=100).contains(&p)) {
        return Err(ApiError::BadRequest("Anzahlung 0–100 %".into()));
    }
    if let (Some(a), Some(z)) = (b.project_start, b.project_end) {
        if z < a {
            return Err(ApiError::BadRequest("Projektende vor Projektstart".into()));
        }
    }
    let mut lines = vec![];
    let mut totals = vec![];
    for (i, it) in b.items.iter().enumerate() {
        if it.description.trim().is_empty()
            || it.quantity_milli <= 0
            || it.unit_price_cents < 0
            || it.unit.trim().is_empty()
        {
            return Err(ApiError::BadRequest(format!(
                "Position {}: Beschreibung, Menge > 0, Einheit und Preis ≥ 0 angeben",
                i + 1
            )));
        }
        let li = LineItem {
            description: it.description.clone(),
            quantity_milli: it.quantity_milli,
            unit: Unit::Piece,
            unit_price: Cents(it.unit_price_cents),
            vat_rate_bp: STANDARD_RATE_BP,
        };
        totals.push(li.net().0);
        lines.push(li);
    }
    for p in &b.payments {
        if p.label.trim().is_empty() || p.amount_cents < 0 {
            return Err(ApiError::BadRequest("Zahlungsraten: Bezeichnung und Betrag ≥ 0".into()));
        }
    }
    for m in &b.milestones {
        if m.label.trim().is_empty() || m.title.trim().is_empty() {
            return Err(ApiError::BadRequest("Meilensteine: Kürzel und Titel angeben".into()));
        }
    }
    let t = compute_totals(&lines, tax);
    if !b.payments.is_empty() {
        let sum: i64 = b.payments.iter().map(|p| p.amount_cents).sum();
        if sum != t.gross.0 {
            return Err(ApiError::BadRequest(format!(
                "Zahlungsplan ({}) muss der Angebotssumme ({}) entsprechen",
                Cents(sum),
                t.gross
            )));
        }
    }
    let hours: i64 = b.items.iter().filter(|i| is_hours(&i.unit)).map(|i| i.quantity_milli).sum();
    Ok(Checked {
        tax,
        rate_bp: if tax == TaxMode::Standard { STANDARD_RATE_BP as i32 } else { 0 },
        net: t.net.0,
        tax_cents: t.tax.0,
        gross: t.gross.0,
        hours_milli: (hours > 0).then_some(hours),
        totals,
    })
}

async fn write_children(conn: &mut PgConnection, id: Uuid, b: &QuoteIn, totals: &[i64]) -> ApiResult<()> {
    for table in ["quote_items", "quote_milestones", "quote_payments"] {
        sqlx::query(&format!("DELETE FROM {table} WHERE quote_id = $1")).bind(id).execute(&mut *conn).await?;
    }
    for (i, it) in b.items.iter().enumerate() {
        sqlx::query(
            "INSERT INTO quote_items (id, quote_id, position, block_nr, block_title, position_nr, description, quantity_milli, unit, unit_price_cents, total_cents)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        )
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(i as i32 + 1)
        .bind(it.block_nr)
        .bind(it.block_title.as_deref().map(str::trim).filter(|x| !x.is_empty()))
        .bind(it.position_nr.as_deref().map(str::trim).filter(|x| !x.is_empty()))
        .bind(it.description.trim())
        .bind(it.quantity_milli)
        .bind(it.unit.trim())
        .bind(it.unit_price_cents)
        .bind(totals[i])
        .execute(&mut *conn)
        .await?;
    }
    for (i, m) in b.milestones.iter().enumerate() {
        sqlx::query("INSERT INTO quote_milestones (id, quote_id, position, label, title, blocks, goal) VALUES ($1,$2,$3,$4,$5,$6,$7)")
            .bind(Uuid::now_v7())
            .bind(id)
            .bind(i as i32 + 1)
            .bind(m.label.trim())
            .bind(m.title.trim())
            .bind(m.blocks.as_deref().map(str::trim).filter(|x| !x.is_empty()))
            .bind(m.goal.as_deref().map(str::trim).filter(|x| !x.is_empty()))
            .execute(&mut *conn)
            .await?;
    }
    for (i, p) in b.payments.iter().enumerate() {
        sqlx::query(
            "INSERT INTO quote_payments (id, quote_id, position, label, due_date, amount_cents, currency, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        )
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(i as i32 + 1)
        .bind(p.label.trim())
        .bind(p.due_date)
        .bind(p.amount_cents)
        .bind(&b.currency)
        .bind(p.description.as_deref().map(str::trim).filter(|x| !x.is_empty()))
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

async fn check_refs(conn: &mut PgConnection, b: &QuoteIn) -> ApiResult<String> {
    let locale: String = sqlx::query_scalar("SELECT locale FROM organizations WHERE id = $1")
        .bind(b.organization_id)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Kunde unbekannt".into()))?;
    for (table, id) in [("projects", b.project_id), ("dev_requests", b.request_id)] {
        if let Some(id) = id {
            let ok: bool = sqlx::query_scalar(&format!(
                "SELECT EXISTS (SELECT 1 FROM {table} WHERE id = $1 AND organization_id = $2)"
            ))
            .bind(id)
            .bind(b.organization_id)
            .fetch_one(&mut *conn)
            .await?;
            if !ok {
                return Err(ApiError::BadRequest("Projekt/Anfrage gehört nicht zu diesem Kunden".into()));
            }
        }
    }
    if let Some(m) = b.payment_method_id {
        super::payments::check_active(conn, m).await?;
    }
    Ok(b.locale.clone().filter(|l| matches!(l.as_str(), "de" | "en" | "ar")).unwrap_or(locale))
}

/// Zahlungsart und Vertragsfelder (ohne Zahlungsart: Standard des Kunden / global)
async fn write_terms(conn: &mut PgConnection, id: Uuid, b: &QuoteIn) -> ApiResult<()> {
    let contract = b.doc_kind == "contract";
    sqlx::query(
        "UPDATE quotes SET doc_kind = $2, contract_start = $3, contract_end = $4, billing_interval = $5, recurring_cents = $6, notice_days = $7,
                payment_method_id = COALESCE($8,
                    (SELECT o.payment_method_id FROM organizations o JOIN payment_methods p ON p.id = o.payment_method_id
                      WHERE o.id = quotes.organization_id AND p.is_active),
                    (SELECT id FROM payment_methods WHERE quotes.locale = 'ar' AND kind = 'shamcash' AND is_active ORDER BY sort LIMIT 1),
                    (SELECT id FROM payment_methods WHERE is_default))
          WHERE id = $1",
    )
    .bind(id)
    .bind(&b.doc_kind)
    .bind(b.contract_start.filter(|_| contract))
    .bind(b.contract_end.filter(|_| contract))
    .bind(b.billing_interval.as_deref().filter(|_| contract))
    .bind(b.recurring_cents.filter(|_| contract))
    .bind(b.notice_days.filter(|_| contract))
    .bind(b.payment_method_id)
    .execute(conn)
    .await?;
    Ok(())
}

fn default_note(tax: TaxMode, locale: &str, given: &Option<String>) -> Option<String> {
    given
        .as_deref()
        .map(str::trim)
        .filter(|x| !x.is_empty())
        .map(String::from)
        .or_else(|| tax_notice(tax, locale).map(String::from))
}

/// Neues Angebot (Entwurf) mit fortlaufender Nummer KV-JJJJ-NNNNN
pub async fn create(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<QuoteIn>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    user.require(Permission::InvoiceWrite, None)?;
    let c = check(&b)?;
    let mut tx = s.db.begin().await?;
    let locale = check_refs(&mut tx, &b).await?;
    let year = Utc::now().format("%Y").to_string().parse().unwrap_or(2026);
    // übernommene Nummern nicht doppelt vergeben
    let mut number = super::invoices::next_number(&mut tx, Series::Proposal, year).await?;
    for _ in 0..1000 {
        let taken: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM quotes WHERE number = $1)")
            .bind(&number)
            .fetch_one(&mut *tx)
            .await?;
        if !taken {
            break;
        }
        number = super::invoices::next_number(&mut tx, Series::Proposal, year).await?;
    }
    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO quotes (id, organization_id, project_id, number, title, description, revision, currency, tax_mode, tax_rate_bp, tax_note,
                             locale, valid_until, project_start, project_end, hourly_rate_cents, discounted_rate_cents, total_hours_milli,
                             advance_percent, net_cents, tax_cents, gross_cents, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)",
    )
    .bind(id)
    .bind(b.organization_id)
    .bind(b.project_id)
    .bind(&number)
    .bind(b.title.trim())
    .bind(b.description.trim())
    .bind(b.revision.as_deref().map(str::trim).filter(|x| !x.is_empty()))
    .bind(&b.currency)
    .bind(&b.tax_mode)
    .bind(c.rate_bp)
    .bind(default_note(c.tax, &locale, &b.tax_note))
    .bind(&locale)
    .bind(b.valid_until.or_else(|| Some(Utc::now().date_naive() + chrono::Days::new(30))))
    .bind(b.project_start)
    .bind(b.project_end)
    .bind(b.hourly_rate_cents)
    .bind(b.discounted_rate_cents)
    .bind(c.hours_milli)
    .bind(b.advance_percent)
    .bind(c.net)
    .bind(c.tax_cents)
    .bind(c.gross)
    .bind(b.notes.trim())
    .execute(&mut *tx)
    .await?;
    write_children(&mut tx, id, &b, &c.totals).await?;
    write_terms(&mut tx, id, &b).await?;
    if let Some(r) = b.request_id {
        sqlx::query("UPDATE dev_requests SET quote_id = $2, updated_at = now() WHERE id = $1")
            .bind(r)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    super::audit(&mut tx, &user.actor(), "create", "quote", id, json!({ "number": number, "gross": c.gross })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id, "number": number, "gross_cents": c.gross }))))
}

/// Entwurf ändern (gesendete Angebote: neue Revision über „Kopie“ – hier nicht änderbar)
pub async fn update(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<QuoteIn>,
) -> ApiResult<StatusCode> {
    user.require(Permission::InvoiceWrite, None)?;
    let c = check(&b)?;
    let mut tx = s.db.begin().await?;
    let status: String = sqlx::query_scalar("SELECT status FROM quotes WHERE id = $1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(ApiError::NotFound)?;
    if status != "draft" {
        return Err(ApiError::Conflict("Nur Entwürfe können geändert werden".into()));
    }
    let locale = check_refs(&mut tx, &b).await?;
    sqlx::query(
        "UPDATE quotes SET organization_id=$2, project_id=$3, title=$4, description=$5, revision=$6, currency=$7, tax_mode=$8, tax_rate_bp=$9,
                tax_note=$10, locale=$11, valid_until=$12, project_start=$13, project_end=$14, hourly_rate_cents=$15, discounted_rate_cents=$16,
                total_hours_milli=$17, advance_percent=$18, net_cents=$19, tax_cents=$20, gross_cents=$21, notes=$22, updated_at=now(), pdf_snapshot=NULL
          WHERE id=$1",
    )
    .bind(id)
    .bind(b.organization_id)
    .bind(b.project_id)
    .bind(b.title.trim())
    .bind(b.description.trim())
    .bind(b.revision.as_deref().map(str::trim).filter(|x| !x.is_empty()))
    .bind(&b.currency)
    .bind(&b.tax_mode)
    .bind(c.rate_bp)
    .bind(default_note(c.tax, &locale, &b.tax_note))
    .bind(&locale)
    .bind(b.valid_until)
    .bind(b.project_start)
    .bind(b.project_end)
    .bind(b.hourly_rate_cents)
    .bind(b.discounted_rate_cents)
    .bind(c.hours_milli)
    .bind(b.advance_percent)
    .bind(c.net)
    .bind(c.tax_cents)
    .bind(c.gross)
    .bind(b.notes.trim())
    .execute(&mut *tx)
    .await?;
    write_children(&mut tx, id, &b, &c.totals).await?;
    write_terms(&mut tx, id, &b).await?;
    if let Some(r) = b.request_id {
        sqlx::query("UPDATE dev_requests SET quote_id = $2, updated_at = now() WHERE id = $1")
            .bind(r)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    super::audit(&mut tx, &user.actor(), "update", "quote", id, json!({ "gross": c.gross })).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    sqlx::query("UPDATE dev_requests SET quote_id = NULL WHERE quote_id = $1").bind(id).execute(&mut *tx).await?;
    let r = sqlx::query("DELETE FROM quotes WHERE id = $1 AND status = 'draft'").bind(id).execute(&mut *tx).await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::Conflict("Nur Entwürfe können gelöscht werden".into()));
    }
    super::audit(&mut tx, &user.actor(), "delete", "quote", id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Druckdaten im Format des PDF-Renderers (wie im Altsystem)
pub async fn pdf_data(conn: &mut PgConnection, id: Uuid) -> ApiResult<Value> {
    #[derive(sqlx::FromRow)]
    struct Q {
        number: String,
        title: String,
        description: String,
        revision: Option<String>,
        currency: String,
        tax_mode: String,
        tax_rate_bp: i32,
        tax_note: Option<String>,
        valid_until: Option<NaiveDate>,
        project_start: Option<NaiveDate>,
        project_end: Option<NaiveDate>,
        hourly_rate_cents: Option<i64>,
        discounted_rate_cents: Option<i64>,
        total_hours_milli: Option<i64>,
        advance_percent: Option<i32>,
        net_cents: i64,
        tax_cents: i64,
        gross_cents: i64,
        notes: String,
        created_at: chrono::DateTime<Utc>,
        sent_at: Option<chrono::DateTime<Utc>>,
        customer: String,
        address: String,
        locale: String,
        payment_method_id: Option<Uuid>,
        doc_kind: String,
        contract_start: Option<NaiveDate>,
        contract_end: Option<NaiveDate>,
        billing_interval: Option<String>,
        recurring_cents: Option<i64>,
        notice_days: Option<i32>,
    }
    let q: Q = sqlx::query_as(
        "SELECT q.number, q.title, q.description, q.revision, q.currency::text AS currency, q.tax_mode, q.tax_rate_bp, q.tax_note, q.valid_until,
                q.project_start, q.project_end, q.hourly_rate_cents, q.discounted_rate_cents, q.total_hours_milli, q.advance_percent,
                q.net_cents, q.tax_cents, q.gross_cents, q.notes, q.created_at, q.sent_at, o.name AS customer, o.address,
                q.locale, q.payment_method_id, q.doc_kind, q.contract_start, q.contract_end, q.billing_interval, q.recurring_cents, q.notice_days
           FROM quotes q JOIN organizations o ON o.id = q.organization_id WHERE q.id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(ApiError::NotFound)?;
    type It = (Option<i32>, Option<String>, Option<String>, String, i64, String, i64, i64);
    let items: Vec<It> = sqlx::query_as(
        "SELECT block_nr, block_title, position_nr, description, quantity_milli, unit, unit_price_cents, total_cents FROM quote_items WHERE quote_id = $1 ORDER BY position",
    )
    .bind(id)
    .fetch_all(&mut *conn)
    .await?;
    let ms: Vec<(String, String, Option<String>, Option<String>)> =
        sqlx::query_as("SELECT label, title, blocks, goal FROM quote_milestones WHERE quote_id = $1 ORDER BY position")
            .bind(id)
            .fetch_all(&mut *conn)
            .await?;
    let pays: Vec<(String, i64, String, Option<String>)> =
        sqlx::query_as("SELECT label, amount_cents, currency::text, description FROM quote_payments WHERE quote_id = $1 ORDER BY position")
            .bind(id)
            .fetch_all(&mut *conn)
            .await?;
    let eur = |c: i64| c as f64 / 100.0;
    let date = |d: Option<NaiveDate>| d.map(|d| format!("{d}T00:00:00.000Z"));
    let mut notes: Vec<String> = vec![];
    if !q.notes.is_empty() {
        notes.push(q.notes.clone());
    }
    if q.doc_kind == "contract" {
        notes.push(contract_text(
            &q.locale,
            q.contract_start,
            q.contract_end,
            q.billing_interval.as_deref(),
            q.recurring_cents,
            q.notice_days,
            &q.currency,
        ));
    }
    if let Some(p) = super::payments::info(&mut *conn, q.payment_method_id).await? {
        notes.push(super::payments::text(&p, &q.locale));
    }
    let lines: Vec<&str> = q.address.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    Ok(json!({
        "proposalNr": q.number, "title": q.title, "description": q.description, "revision": q.revision, "currency": q.currency,
        "reverseCharge": q.tax_mode != "standard", "reverseChargeNote": q.tax_note, "taxRate": q.tax_rate_bp as f64 / 100.0,
        "validUntil": date(q.valid_until), "projectStart": date(q.project_start), "projectEnd": date(q.project_end),
        "hourlyRate": q.hourly_rate_cents.map(eur), "discountedHourlyRate": q.discounted_rate_cents.map(eur), "totalHours": q.total_hours_milli.map(|h| h as f64 / 1000.0),
        "advancePaymentPercent": q.advance_percent, "subtotal": eur(q.net_cents), "tax": eur(q.tax_cents), "total": eur(q.gross_cents),
        "notes": if notes.is_empty() { Value::Null } else { Value::String(notes.join("\n\n")) },
        "issuedAt": q.sent_at.unwrap_or(q.created_at).to_rfc3339(), "status": "SENT",
        "customerName": q.customer,
        "customerAddress": { "companyName": q.customer, "street": lines.first(), "city": lines.get(1) },
        "items": items.iter().map(|i| json!({
            "blockNr": i.0, "blockTitle": i.1, "positionNr": i.2, "description": i.3,
            "quantity": i.4 as f64 / 1000.0, "unit": i.5, "unitPrice": eur(i.6), "totalPrice": eur(i.7),
        })).collect::<Vec<_>>(),
        "milestones": ms.iter().map(|m| json!({ "milestoneNr": m.0, "title": m.1, "blocks": m.2, "goal": m.3 })).collect::<Vec<_>>(),
        "paymentSchedule": pays.iter().map(|p| json!({ "dueLabel": p.0, "amount": eur(p.1), "currency": p.2, "description": p.3 })).collect::<Vec<_>>(),
    }))
}

fn interval_label(locale: &str, i: &str) -> &'static str {
    match (locale, i) {
        ("en", "monthly") => "monthly",
        ("en", "quarterly") => "quarterly",
        ("en", _) => "yearly",
        ("ar", "monthly") => "شهرياً",
        ("ar", "quarterly") => "كل ربع سنة",
        ("ar", _) => "سنوياً",
        (_, "monthly") => "monatlich",
        (_, "quarterly") => "vierteljährlich",
        _ => "jährlich",
    }
}

/// Vertragsbedingungen als Absatz für das PDF
fn contract_text(
    locale: &str,
    start: Option<NaiveDate>,
    end: Option<NaiveDate>,
    interval: Option<&str>,
    cents: Option<i64>,
    notice: Option<i32>,
    currency: &str,
) -> String {
    let d = |x: NaiveDate| x.format("%d.%m.%Y").to_string();
    let amount = format!("{:.2} {currency}", cents.unwrap_or(0) as f64 / 100.0);
    let iv = interval_label(locale, interval.unwrap_or("monthly"));
    let start = start.map(d).unwrap_or_default();
    match locale {
        "en" => format!(
            "**Contract terms:** term from {start}{}, fee {amount} (net) {iv}{}.",
            end.map(|e| format!(" until {}", d(e))).unwrap_or_else(|| ", indefinite".into()),
            notice.map(|n| format!(", notice period {n} days")).unwrap_or_default()
        ),
        "ar" => format!(
            "**شروط العقد:** يبدأ في {start}{}، الرسوم {amount} (صافي) {iv}{}.",
            end.map(|e| format!(" حتى {}", d(e))).unwrap_or_else(|| "، لمدة غير محددة".into()),
            notice.map(|n| format!("، مدة الإشعار بالإلغاء {n} يوماً")).unwrap_or_default()
        ),
        _ => format!(
            "**Vertragsbedingungen:** Laufzeit ab {start}{}, Entgelt {amount} (netto) {iv}{}.",
            end.map(|e| format!(" bis {}", d(e))).unwrap_or_else(|| ", unbefristet".into()),
            notice.map(|n| format!(", Kündigungsfrist {n} Tage")).unwrap_or_default()
        ),
    }
}

/// An den Kunden senden: Druckdaten einfrieren, Kunde wird benachrichtigt
pub async fn send(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    let (org, status, number, title): (Uuid, String, String, String) =
        sqlx::query_as("SELECT organization_id, status, number, title FROM quotes WHERE id = $1 FOR UPDATE")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(ApiError::NotFound)?;
    if status != "draft" {
        return Err(ApiError::Conflict("Angebot wurde bereits gesendet".into()));
    }
    sqlx::query("UPDATE quotes SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    let data = pdf_data(&mut tx, id).await?;
    sqlx::query("UPDATE quotes SET pdf_snapshot = $2 WHERE id = $1").bind(id).bind(&data).execute(&mut *tx).await?;
    sqlx::query("UPDATE dev_requests SET status = 'quoted', updated_at = now() WHERE quote_id = $1 AND status IN ('submitted','in_review')")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "send", "quote", id, json!({ "number": number })).await?;
    tx.commit().await?;
    notify(&s.db, user.id, &org_users(&s, org).await, "quote", "sent", id, &number, &title);
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct Respond {
    pub accept: bool,
    #[serde(default)]
    pub comment: String,
}

/// Kunde nimmt an (→ Projekt mit Meilensteinen) oder lehnt ab
pub async fn respond(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Respond>,
) -> ApiResult<Json<Value>> {
    let org = user.organization_id.filter(|_| !user.role.is_employee()).ok_or(ApiError::Forbidden)?;
    let mut tx = s.db.begin().await?;
    let q: AcceptRow = sqlx::query_as(
        "SELECT organization_id, status, number, title, valid_until, project_id, project_start, project_end, description
           FROM quotes WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    if q.0 != org || q.1 == "draft" {
        return Err(ApiError::NotFound);
    }
    if q.1 != "sent" {
        return Err(ApiError::Conflict("Angebot wurde bereits beantwortet".into()));
    }
    if b.accept && q.4.is_some_and(|v| v < Utc::now().date_naive()) {
        sqlx::query("UPDATE quotes SET status = 'expired' WHERE id = $1").bind(id).execute(&mut *tx).await?;
        tx.commit().await?;
        return Err(ApiError::Conflict("Angebot ist abgelaufen – bitte neues Angebot anfordern".into()));
    }
    let status = if b.accept { "accepted" } else { "rejected" };
    sqlx::query(
        "UPDATE quotes SET status = $2, responded_at = now(), customer_response = NULLIF($3, ''), updated_at = now(),
                accepted_via = CASE WHEN $2 = 'accepted' THEN 'customer' END WHERE id = $1",
    )
    .bind(id)
    .bind(status)
    .bind(b.comment.trim().chars().take(4000).collect::<String>())
    .execute(&mut *tx)
    .await?;
    let project = after_response(&mut tx, id, org, &q, b.accept).await?;
    super::audit(&mut tx, &user.actor(), status, "quote", id, json!({ "project": project })).await?;
    tx.commit().await?;
    notify(&s.db, user.id, &super::shop::team(&s, "SAL").await, "quote", status, id, &q.2, &q.3);
    Ok(Json(json!({ "status": status, "project_id": project })))
}

type AcceptRow =
    (Uuid, String, String, String, Option<NaiveDate>, Option<Uuid>, Option<NaiveDate>, Option<NaiveDate>, String);

/// Nach Annahme: Projekt mit Meilensteinen anlegen (falls noch keins), Anfrage nachziehen
async fn after_response(
    conn: &mut PgConnection,
    id: Uuid,
    org: Uuid,
    q: &AcceptRow,
    accept: bool,
) -> ApiResult<Option<Uuid>> {
    let mut project = q.5;
    if accept && project.is_none() {
        let pid = Uuid::now_v7();
        let base = super::requests::slug(&q.3);
        let slug = format!("{}-{}", if base.is_empty() { "projekt" } else { &base }, &pid.simple().to_string()[24..]);
        sqlx::query(
            "INSERT INTO projects (id, organization_id, department_id, name, slug, code, description, status, start_date, target_date, kind)
             VALUES ($1,$2,(SELECT id FROM departments WHERE code = 'DEV'),$3,$4,$5,$6,'active',COALESCE($7, CURRENT_DATE),$8,'customer')",
        )
        .bind(pid)
        .bind(org)
        .bind(&q.3)
        .bind(&slug)
        .bind(&q.2)
        .bind(&q.8)
        .bind(q.6)
        .bind(q.7)
        .execute(&mut *conn)
        .await?;
        sqlx::query(
            "INSERT INTO project_milestones (id, project_id, position, title, description)
             SELECT gen_random_uuid(), $2, position, label || ' · ' || title, COALESCE(goal, '') FROM quote_milestones WHERE quote_id = $1",
        )
        .bind(id)
        .bind(pid)
        .execute(&mut *conn)
        .await?;
        sqlx::query("UPDATE quotes SET project_id = $2 WHERE id = $1").bind(id).bind(pid).execute(&mut *conn).await?;
        project = Some(pid);
    }
    sqlx::query(
        "UPDATE dev_requests SET status = $2, project_id = COALESCE(project_id, $3), updated_at = now() WHERE quote_id = $1",
    )
    .bind(id)
    .bind(if accept { "in_progress" } else { "rejected" })
    .bind(project)
    .execute(&mut *conn)
    .await?;
    Ok(project)
}

#[derive(Deserialize)]
pub struct Verbal {
    /// Wer hat wann was zugesagt (Pflicht, landet im Protokoll)
    pub note: String,
}

/// Team hält eine mündliche Vereinbarung fest: Angebot/Vertrag gilt als angenommen.
/// Entwürfe werden dabei eingefroren (wie beim Senden), der Kunde wird benachrichtigt.
pub async fn accept_verbal(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<Verbal>,
) -> ApiResult<Json<Value>> {
    user.require(Permission::InvoiceWrite, None)?;
    let note = b.note.trim();
    if note.chars().count() < 5 || note.chars().count() > 2000 {
        return Err(ApiError::BadRequest("Vermerk 5–2000 Zeichen (wer, wann, was vereinbart)".into()));
    }
    let mut tx = s.db.begin().await?;
    let q: AcceptRow = sqlx::query_as(
        "SELECT organization_id, status, number, title, valid_until, project_id, project_start, project_end, description
           FROM quotes WHERE id = $1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    if !matches!(q.1.as_str(), "draft" | "sent") {
        return Err(ApiError::Conflict("Angebot wurde bereits beantwortet".into()));
    }
    let was_draft = q.1 == "draft";
    sqlx::query(
        "UPDATE quotes SET status = 'accepted', sent_at = COALESCE(sent_at, now()), responded_at = now(), updated_at = now(),
                accepted_via = 'verbal', accepted_by = $2, acceptance_note = $3 WHERE id = $1",
    )
    .bind(id)
    .bind(user.id)
    .bind(note)
    .execute(&mut *tx)
    .await?;
    if was_draft {
        let data = pdf_data(&mut tx, id).await?;
        sqlx::query("UPDATE quotes SET pdf_snapshot = $2 WHERE id = $1").bind(id).bind(&data).execute(&mut *tx).await?;
    }
    let project = after_response(&mut tx, id, q.0, &q, true).await?;
    super::audit(&mut tx, &user.actor(), "accept_verbal", "quote", id, json!({ "note": note, "project": project }))
        .await?;
    tx.commit().await?;
    notify(&s.db, user.id, &org_users(&s, q.0).await, "quote", "accepted", id, &q.2, &q.3);
    Ok(Json(json!({ "status": "accepted", "project_id": project })))
}

#[derive(Deserialize)]
pub struct InvoiceReq {
    /// full | advance | payment
    pub mode: String,
    /// bei payment: Nummer der Rate (1 …)
    pub payment: Option<i32>,
    /// bei period (Verträge): Beginn des Abrechnungszeitraums (Standard: heute)
    pub period_start: Option<NaiveDate>,
}

/// Abrechnungszeitraum: Beginn → letzter Tag vor dem nächsten Beginn
fn period_end(start: NaiveDate, interval: &str) -> NaiveDate {
    let months = match interval {
        "quarterly" => 3,
        "yearly" => 12,
        _ => 1,
    };
    start.checked_add_months(chrono::Months::new(months)).map(|d| d - chrono::Days::new(1)).unwrap_or(start)
}

/// Rechnungsentwurf aus dem Angebot (komplett, Anzahlung laut Angebot, oder eine Zahlungsrate)
pub async fn invoice(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<InvoiceReq>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    type Row = (Uuid, Option<Uuid>, String, String, String, String, i32, i64, Option<i32>);
    let q: Row = sqlx::query_as(
        "SELECT organization_id, project_id, status, number, currency::text, tax_mode, tax_rate_bp, net_cents, advance_percent FROM quotes WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError::NotFound)?;
    if q.2 != "accepted" {
        return Err(ApiError::Conflict("Rechnung erst nach Annahme des Angebots".into()));
    }
    let vat: u32 = if q.5 == "standard" { STANDARD_RATE_BP } else { 0 };
    let lines: Vec<(String, i64, Unit, i64, u32)> = match b.mode.as_str() {
        "full" => {
            let items: Vec<(Option<String>, String, i64, String, i64)> = sqlx::query_as(
                "SELECT position_nr, description, quantity_milli, unit, unit_price_cents FROM quote_items WHERE quote_id = $1 ORDER BY position",
            )
            .bind(id)
            .fetch_all(&mut *tx)
            .await?;
            items
                .into_iter()
                .map(|(nr, d, qm, u, p)| {
                    (
                        nr.map(|n| format!("{n} {d}")).unwrap_or(d),
                        qm,
                        if is_hours(&u) { Unit::Hour } else { Unit::Piece },
                        p,
                        vat,
                    )
                })
                .collect()
        }
        "advance" => {
            let pct =
                q.8.filter(|p| *p > 0)
                    .ok_or_else(|| ApiError::BadRequest("Im Angebot ist keine Anzahlung vereinbart".into()))?;
            vec![(format!("Anzahlung {pct} % gemäß Angebot {}", q.3), 1000, Unit::Flat, q.7 * pct as i64 / 100, vat)]
        }
        "payment" => {
            let n = b.payment.ok_or_else(|| ApiError::BadRequest("Rate fehlt".into()))?;
            let (label, amount): (String, i64) =
                sqlx::query_as("SELECT label, amount_cents FROM quote_payments WHERE quote_id = $1 AND position = $2")
                    .bind(id)
                    .bind(n)
                    .fetch_optional(&mut *tx)
                    .await?
                    .ok_or(ApiError::NotFound)?;
            // Raten sind Bruttobeträge → netto zurückrechnen
            let net = if vat > 0 { (amount as i128 * 10_000 / (10_000 + vat as i128)) as i64 } else { amount };
            vec![(format!("{label} – Angebot {}", q.3), 1000, Unit::Flat, net, vat)]
        }
        "period" => {
            type C = (String, Option<NaiveDate>, Option<NaiveDate>, Option<String>, Option<i64>);
            let (kind, start, end, interval, cents): C = sqlx::query_as(
                "SELECT doc_kind, contract_start, contract_end, billing_interval, recurring_cents FROM quotes WHERE id = $1",
            )
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
            if kind != "contract" {
                return Err(ApiError::BadRequest("Zeitraum-Rechnung nur für Verträge".into()));
            }
            let interval = interval.unwrap_or_else(|| "monthly".into());
            let from = b.period_start.or(start).unwrap_or_else(|| Utc::now().date_naive());
            if start.is_some_and(|s| from < s) || end.is_some_and(|e| from > e) {
                return Err(ApiError::BadRequest("Zeitraum liegt außerhalb der Vertragslaufzeit".into()));
            }
            let to = period_end(from, &interval);
            let to = end.map(|e| e.min(to)).unwrap_or(to);
            vec![(
                format!(
                    "Vertragsentgelt {} {} – {} (Vertrag {})",
                    interval_label("de", &interval),
                    from.format("%d.%m.%Y"),
                    to.format("%d.%m.%Y"),
                    q.3
                ),
                1000,
                Unit::Flat,
                cents.unwrap_or(0),
                vat,
            )]
        }
        _ => return Err(ApiError::BadRequest("mode: full, advance, payment oder period".into())),
    };
    let inv = super::invoices::draft_with_lines(
        &mut tx,
        &user.actor(),
        q.0,
        q.1,
        &q.4,
        &q.5,
        lines,
        &format!("Angebot {}", q.3),
    )
    .await?;
    // Zahlungsart aus dem Angebot/Vertrag übernehmen
    sqlx::query("UPDATE invoices SET payment_method_id = COALESCE((SELECT payment_method_id FROM quotes WHERE id = $2), payment_method_id) WHERE id = $1")
        .bind(inv)
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "invoice_id": inv }))))
}

/// Kopie als neuer Entwurf (z. B. neue Revision eines gesendeten Angebots)
pub async fn duplicate(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM quotes WHERE id = $1)").bind(id).fetch_one(&mut *tx).await?;
    if !exists {
        return Err(ApiError::NotFound);
    }
    let year = Utc::now().format("%Y").to_string().parse().unwrap_or(2026);
    let mut number = super::invoices::next_number(&mut tx, Series::Proposal, year).await?;
    for _ in 0..1000 {
        let taken: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM quotes WHERE number = $1)")
            .bind(&number)
            .fetch_one(&mut *tx)
            .await?;
        if !taken {
            break;
        }
        number = super::invoices::next_number(&mut tx, Series::Proposal, year).await?;
    }
    let nid = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO quotes (id, organization_id, project_id, number, title, description, revision, currency, tax_mode, tax_rate_bp, tax_note, locale,
                             valid_until, project_start, project_end, hourly_rate_cents, discounted_rate_cents, total_hours_milli, advance_percent,
                             net_cents, tax_cents, gross_cents, notes, payment_method_id, doc_kind, contract_start, contract_end,
                             billing_interval, recurring_cents, notice_days)
         SELECT $2, organization_id, project_id, $3, title, description, revision, currency, tax_mode, tax_rate_bp, tax_note, locale,
                CURRENT_DATE + 30, project_start, project_end, hourly_rate_cents, discounted_rate_cents, total_hours_milli, advance_percent,
                net_cents, tax_cents, gross_cents, notes, payment_method_id, doc_kind, contract_start, contract_end,
                billing_interval, recurring_cents, notice_days FROM quotes WHERE id = $1",
    )
    .bind(id)
    .bind(nid)
    .bind(&number)
    .execute(&mut *tx)
    .await?;
    for (table, cols) in [
        ("quote_items", "position, block_nr, block_title, position_nr, description, quantity_milli, unit, unit_price_cents, total_cents"),
        ("quote_milestones", "position, label, title, blocks, goal"),
        ("quote_payments", "position, label, due_date, amount_cents, currency, description"),
    ] {
        sqlx::query(&format!("INSERT INTO {table} (id, quote_id, {cols}) SELECT gen_random_uuid(), $2, {cols} FROM {table} WHERE quote_id = $1"))
            .bind(id)
            .bind(nid)
            .execute(&mut *tx)
            .await?;
    }
    super::audit(&mut tx, &user.actor(), "duplicate", "quote", nid, json!({ "from": id })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": nid, "number": number }))))
}

#[cfg(test)]
mod tests {
    use super::is_hours;
    use chrono::NaiveDate;

    #[test]
    fn periods() {
        let d = |s: &str| s.parse::<NaiveDate>().unwrap();
        assert_eq!(super::period_end(d("2026-01-31"), "monthly"), d("2026-02-27"));
        assert_eq!(super::period_end(d("2026-01-01"), "monthly"), d("2026-01-31"));
        assert_eq!(super::period_end(d("2026-01-01"), "quarterly"), d("2026-03-31"));
        assert_eq!(super::period_end(d("2026-01-01"), "yearly"), d("2026-12-31"));
    }

    #[test]
    fn hour_units() {
        for u in ["Std.", "Stunden", "h", "hours", "ساعة"] {
            assert!(is_hours(u), "{u}");
        }
        for u in ["Stk.", "Pauschale", "حزمة", "Monat"] {
            assert!(!is_hours(u), "{u}");
        }
    }
}
