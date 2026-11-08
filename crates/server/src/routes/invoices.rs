//! Rechnungen & Gutschriften.
//!
//! Ablauf: Entwurf anlegen → Positionen setzen → ausstellen (Nummer + Festschreibung)
//! → bezahlt markieren oder per Gutschrift stornieren.
//!
//! Positionen können aus dem Katalog kommen (`price_id`): Bezeichnung, Einheit und Preis werden
//! dann aus dem Katalog übernommen – ein abweichender Preis wird abgelehnt.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{Datelike, NaiveDate, Utc};
use codecraft_domain::access::Permission;
use codecraft_domain::catalog::{Billing, I18n};
use codecraft_domain::invoice::{
    compute_totals, credit_note_items, validate_for_issue, BillingParty, InvoiceError, InvoiceStatus, LineItem, RateBp,
    TaxMode, Totals, Unit,
};
use codecraft_domain::money::{Cents, Currency};
use codecraft_domain::numbering::{format_number, Series};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::types::Json as SqlJson;
use sqlx::PgConnection;
use uuid::Uuid;

// ── DB-Zeilen ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct InvoiceRow {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub kind: String,
    pub corrects_invoice_id: Option<Uuid>,
    pub number: Option<String>,
    pub status: String,
    pub currency: String,
    pub tax_mode: String,
    pub locale: String,
    pub notes: String,
    pub recipient_name: Option<String>,
    pub recipient_address: Option<String>,
    pub recipient_vat_id: Option<String>,
    pub issue_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub net_cents: Option<i64>,
    pub tax_cents: Option<i64>,
    pub gross_cents: Option<i64>,
    pub created_at: chrono::DateTime<Utc>,
    pub issued_at: Option<chrono::DateTime<Utc>>,
    pub paid_at: Option<chrono::DateTime<Utc>>,
    pub cancelled_at: Option<chrono::DateTime<Utc>>,
    pub project_id: Option<Uuid>,
    pub project_name: Option<String>,
    pub service_from: Option<NaiveDate>,
    pub service_to: Option<NaiveDate>,
    /// aus dem Altsystem übernommen
    pub legacy: bool,
}

pub(crate) const COLS: &str =
    "id, organization_id, kind, corrects_invoice_id, number, status, currency::text AS currency,
    tax_mode, locale, notes, recipient_name, recipient_address, recipient_vat_id, issue_date, due_date,
    net_cents, tax_cents, gross_cents, created_at, issued_at, paid_at, cancelled_at, project_id,
    (SELECT pr.name FROM projects pr WHERE pr.id = invoices.project_id) AS project_name,
    service_from, service_to, legacy_id IS NOT NULL AS legacy";

#[derive(Debug, sqlx::FromRow)]
struct ItemRow {
    description: String,
    quantity_milli: i64,
    unit: String,
    unit_price_cents: i64,
    vat_rate_bp: i32,
    product_id: Option<Uuid>,
    price_id: Option<Uuid>,
}

/// Position inkl. Katalogbezug
#[derive(Debug, Clone, Serialize)]
pub struct Item {
    #[serde(flatten)]
    pub line: LineItem,
    pub product_id: Option<Uuid>,
    pub price_id: Option<Uuid>,
}

/// Eingabe: entweder frei (Beschreibung + Preis) oder aus dem Katalog (`price_id`)
#[derive(Debug, Deserialize)]
pub struct ItemInput {
    pub price_id: Option<Uuid>,
    pub description: Option<String>,
    pub quantity_milli: i64,
    pub unit: Option<Unit>,
    pub unit_price: Option<Cents>,
    pub vat_rate_bp: RateBp,
}

fn unit_to_str(u: Unit) -> &'static str {
    match u {
        Unit::Hour => "hour",
        Unit::Piece => "piece",
        Unit::Day => "day",
        Unit::Month => "month",
        Unit::Flat => "flat",
    }
}

fn unit_from_str(s: &str) -> Unit {
    match s {
        "piece" => Unit::Piece,
        "day" => Unit::Day,
        "month" => Unit::Month,
        "flat" => Unit::Flat,
        _ => Unit::Hour,
    }
}

fn billing_from_str(s: &str) -> Billing {
    match s {
        "hourly" => Billing::Hourly,
        "monthly" => Billing::Monthly,
        "yearly" => Billing::Yearly,
        "on_request" => Billing::OnRequest,
        _ => Billing::OneTime,
    }
}

fn tax_mode_to_str(m: TaxMode) -> &'static str {
    match m {
        TaxMode::Standard => "standard",
        TaxMode::ReverseCharge => "reverse_charge",
        TaxMode::NotTaxable => "not_taxable",
    }
}

fn tax_mode_from_str(s: &str) -> TaxMode {
    match s {
        "reverse_charge" => TaxMode::ReverseCharge,
        "not_taxable" => TaxMode::NotTaxable,
        _ => TaxMode::Standard,
    }
}

impl From<ItemRow> for Item {
    fn from(r: ItemRow) -> Self {
        Item {
            line: LineItem {
                description: r.description,
                quantity_milli: r.quantity_milli,
                unit: unit_from_str(&r.unit),
                unit_price: Cents(r.unit_price_cents),
                vat_rate_bp: r.vat_rate_bp.max(0) as u32,
            },
            product_id: r.product_id,
            price_id: r.price_id,
        }
    }
}

fn lines(items: &[Item]) -> Vec<LineItem> {
    items.iter().map(|i| i.line.clone()).collect()
}

fn status(row: &InvoiceRow) -> InvoiceStatus {
    InvoiceStatus::parse(&row.status).unwrap_or(InvoiceStatus::Draft)
}

async fn load(conn: &mut PgConnection, id: Uuid, lock: bool) -> ApiResult<InvoiceRow> {
    let sql = format!("SELECT {COLS} FROM invoices WHERE id = $1{}", if lock { " FOR UPDATE" } else { "" });
    sqlx::query_as(&sql).bind(id).fetch_optional(conn).await?.ok_or(ApiError::NotFound)
}

async fn load_items(conn: &mut PgConnection, id: Uuid) -> ApiResult<Vec<Item>> {
    let rows: Vec<ItemRow> = sqlx::query_as(
        "SELECT description, quantity_milli, unit, unit_price_cents, vat_rate_bp, product_id, price_id
           FROM invoice_items WHERE invoice_id = $1 ORDER BY position",
    )
    .bind(id)
    .fetch_all(conn)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

type CatalogPrice = (Uuid, SqlJson<I18n>, SqlJson<I18n>, String, Option<i64>, String);

/// Eingaben auflösen: Katalogpositionen übernehmen Bezeichnung/Einheit/Preis aus dem Katalog.
async fn resolve(
    conn: &mut PgConnection,
    locale: &str,
    currency: &str,
    inputs: Vec<ItemInput>,
) -> ApiResult<Vec<Item>> {
    let mut out = Vec::with_capacity(inputs.len());
    for (i, inp) in inputs.into_iter().enumerate() {
        let n = i + 1;
        let Some(price_id) = inp.price_id else {
            let (Some(description), Some(unit_price)) = (inp.description, inp.unit_price) else {
                return Err(ApiError::BadRequest(format!(
                    "Position {n}: ohne price_id sind description und unit_price Pflicht"
                )));
            };
            out.push(Item {
                line: LineItem {
                    description,
                    quantity_milli: inp.quantity_milli,
                    unit: inp.unit.unwrap_or(Unit::Hour),
                    unit_price,
                    vat_rate_bp: inp.vat_rate_bp,
                },
                product_id: None,
                price_id: None,
            });
            continue;
        };
        let row: Option<CatalogPrice> = sqlx::query_as(
            "SELECT p.id, p.name, pp.name, pp.billing, pp.amount_cents, pp.currency::text
               FROM product_prices pp JOIN products p ON p.id = pp.product_id
               JOIN departments d ON d.id = p.department_id
              WHERE pp.id = $1 AND pp.is_active AND p.is_active AND d.is_active",
        )
        .bind(price_id)
        .fetch_optional(&mut *conn)
        .await?;
        let (product_id, product_name, price_name, billing, amount, price_currency) =
            row.ok_or_else(|| ApiError::BadRequest(format!("Position {n}: Katalogpreis unbekannt oder inaktiv")))?;
        let billing = billing_from_str(&billing);
        let unit_price = match (amount, inp.unit_price) {
            (Some(a), None) => Cents(a),
            (Some(a), Some(p)) if p.0 == a => p,
            (Some(a), Some(p)) => {
                return Err(ApiError::BadRequest(format!(
                    "Position {n}: Preis {p} weicht vom Katalog ({}) ab",
                    Cents(a)
                )))
            }
            // Preis auf Anfrage → Betrag muss angegeben werden
            (None, Some(p)) => p,
            (None, None) => {
                return Err(ApiError::BadRequest(format!("Position {n}: Preis auf Anfrage – unit_price fehlt")))
            }
        };
        if amount.is_some() && price_currency != currency {
            return Err(ApiError::BadRequest(format!(
                "Position {n}: Katalogwährung {price_currency} passt nicht zur Rechnung ({currency})"
            )));
        }
        let description = inp
            .description
            .filter(|d| !d.trim().is_empty())
            .unwrap_or_else(|| format!("{} – {}", product_name.get(locale), price_name.get(locale)));
        out.push(Item {
            line: LineItem {
                description,
                quantity_milli: inp.quantity_milli,
                // Bei 'Preis auf Anfrage' legt die Position den Zeitraum fest (z. B. Monat)
                unit: if billing == Billing::OnRequest { inp.unit.unwrap_or(Unit::Flat) } else { billing.unit() },
                unit_price,
                vat_rate_bp: inp.vat_rate_bp,
            },
            product_id: Some(product_id),
            price_id: Some(price_id),
        });
    }
    Ok(out)
}

async fn insert_items(conn: &mut PgConnection, invoice_id: Uuid, items: &[Item]) -> ApiResult<()> {
    for (i, it) in items.iter().enumerate() {
        sqlx::query(
            "INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit,
                                        unit_price_cents, vat_rate_bp, product_id, price_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(Uuid::now_v7())
        .bind(invoice_id)
        .bind(i as i32 + 1)
        .bind(it.line.description.trim())
        .bind(it.line.quantity_milli)
        .bind(unit_to_str(it.line.unit))
        .bind(it.line.unit_price.0)
        .bind(it.line.vat_rate_bp as i32)
        .bind(it.product_id)
        .bind(it.price_id)
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

/// Nächste lückenlose Nummer. Die Zeile bleibt bis zum Commit gesperrt;
/// bei Rollback wird auch der Zähler zurückgesetzt → keine Lücken.
pub(crate) async fn next_number(conn: &mut PgConnection, series: Series, year: i32) -> ApiResult<String> {
    let (seq,): (i64,) = sqlx::query_as(
        "INSERT INTO number_sequences (series, year, last_value) VALUES ($1, $2, 1)
         ON CONFLICT (series, year) DO UPDATE SET last_value = number_sequences.last_value + 1
         RETURNING last_value",
    )
    .bind(series.key())
    .bind(year)
    .fetch_one(conn)
    .await?;
    Ok(format_number(series, year, seq))
}

// ── Antworten ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct InvoiceDetail {
    #[serde(flatten)]
    pub invoice: InvoiceRow,
    pub items: Vec<Item>,
    pub totals: Totals,
    pub tax_notice: Option<&'static str>,
}

async fn detail(conn: &mut PgConnection, id: Uuid) -> ApiResult<InvoiceDetail> {
    let invoice = load(conn, id, false).await?;
    let items = load_items(conn, id).await?;
    let mode = tax_mode_from_str(&invoice.tax_mode);
    let totals = compute_totals(&lines(&items), mode);
    let tax_notice = codecraft_domain::invoice::tax_notice(mode, &invoice.locale);
    Ok(InvoiceDetail { invoice, items, totals, tax_notice })
}

// ── Handler ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct NewInvoice {
    pub organization_id: Uuid,
    #[serde(default = "eur")]
    pub currency: Currency,
    #[serde(default = "standard")]
    pub tax_mode: TaxMode,
    pub locale: Option<String>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub items: Vec<ItemInput>,
}

fn eur() -> Currency {
    Currency::EUR
}
fn standard() -> TaxMode {
    TaxMode::Standard
}

pub async fn create_draft(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewInvoice>,
) -> ApiResult<(StatusCode, Json<InvoiceDetail>)> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    let (org_locale,): (String,) = sqlx::query_as("SELECT locale FROM organizations WHERE id = $1")
        .bind(b.organization_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Organisation existiert nicht".into()))?;
    let locale = b.locale.unwrap_or(org_locale);
    let items = resolve(&mut tx, &locale, b.currency.as_str(), b.items).await?;
    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO invoices (id, organization_id, currency, tax_mode, locale, notes) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(id)
    .bind(b.organization_id)
    .bind(b.currency.as_str())
    .bind(tax_mode_to_str(b.tax_mode))
    .bind(&locale)
    .bind(&b.notes)
    .execute(&mut *tx)
    .await?;
    insert_items(&mut tx, id, &items).await?;
    super::audit(&mut tx, &user.actor(), "create_draft", "invoice", id, json!({})).await?;
    let d = detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(d)))
}

/// Rechnungsentwurf mit freien Positionen (z. B. aus einem Angebot)
#[allow(clippy::too_many_arguments)]
pub(crate) async fn draft_with_lines(
    conn: &mut PgConnection,
    actor: &str,
    organization_id: Uuid,
    project_id: Option<Uuid>,
    currency: &str,
    tax_mode: &str,
    lines: Vec<(String, i64, Unit, i64, u32)>,
    notes: &str,
) -> ApiResult<Uuid> {
    let (locale,): (String,) = sqlx::query_as("SELECT locale FROM organizations WHERE id = $1")
        .bind(organization_id)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Organisation existiert nicht".into()))?;
    let inputs = lines
        .into_iter()
        .map(|(description, quantity_milli, unit, price, vat)| ItemInput {
            price_id: None,
            description: Some(description),
            quantity_milli,
            unit: Some(unit),
            unit_price: Some(Cents(price)),
            vat_rate_bp: vat,
        })
        .collect();
    let items = resolve(conn, &locale, currency, inputs).await?;
    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO invoices (id, organization_id, currency, tax_mode, locale, notes, project_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(id)
    .bind(organization_id)
    .bind(currency)
    .bind(tax_mode)
    .bind(&locale)
    .bind(notes)
    .bind(project_id)
    .execute(&mut *conn)
    .await?;
    insert_items(conn, id, &items).await?;
    super::audit(conn, actor, "create_draft", "invoice", id, json!({ "source": "quote" })).await?;
    Ok(id)
}

/// Rechnungsentwurf aus Katalogpreisen (z. B. aus einer Shop-Bestellung): `(price_id, Menge)`.
/// MwSt. 19 % – abweichende Steuerfälle passt die Buchhaltung im Entwurf an.
pub(crate) async fn draft_from_catalog(
    conn: &mut PgConnection,
    actor: &str,
    organization_id: Uuid,
    currency: &str,
    lines: &[(Uuid, i64)],
    notes: &str,
) -> ApiResult<Uuid> {
    let (locale,): (String,) = sqlx::query_as("SELECT locale FROM organizations WHERE id = $1")
        .bind(organization_id)
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Organisation existiert nicht".into()))?;
    let inputs = lines
        .iter()
        .map(|(price_id, qty)| ItemInput {
            price_id: Some(*price_id),
            description: None,
            quantity_milli: qty * 1000,
            unit: None,
            unit_price: None,
            vat_rate_bp: 1900,
        })
        .collect();
    let items = resolve(conn, &locale, currency, inputs).await?;
    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO invoices (id, organization_id, currency, tax_mode, locale, notes) VALUES ($1, $2, $3, 'standard', $4, $5)",
    )
    .bind(id)
    .bind(organization_id)
    .bind(currency)
    .bind(&locale)
    .bind(notes)
    .execute(&mut *conn)
    .await?;
    insert_items(conn, id, &items).await?;
    super::audit(conn, actor, "create_draft", "invoice", id, json!({ "source": "order" })).await?;
    Ok(id)
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub status: Option<String>,
    pub organization_id: Option<Uuid>,
}

pub async fn list(
    State(s): State<AppState>,
    user: User,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Vec<InvoiceRow>>> {
    // Kunden: nur eigene Organisation, keine Entwürfe
    let (org, hide_drafts) = if user.role.is_employee() {
        user.require(Permission::InvoiceRead, None)?;
        (q.organization_id, false)
    } else {
        let org = user.organization_id.ok_or(ApiError::Forbidden)?;
        user.require(Permission::InvoiceRead, Some(org))?;
        (Some(org), true)
    };
    let sql = format!(
        "SELECT {COLS} FROM invoices
          WHERE ($1::uuid IS NULL OR organization_id = $1)
            AND ($2::text IS NULL OR status = $2)
            AND (NOT $3 OR status <> 'draft')
          ORDER BY created_at DESC LIMIT 500"
    );
    let rows = sqlx::query_as(&sql).bind(org).bind(q.status).bind(hide_drafts).fetch_all(&s.db).await?;
    Ok(Json(rows))
}

pub async fn get(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<InvoiceDetail>> {
    let mut conn = s.db.acquire().await?;
    let d = detail(&mut conn, id).await?;
    user.require(Permission::InvoiceRead, Some(d.invoice.organization_id))?;
    if !user.role.is_employee() && status(&d.invoice) == InvoiceStatus::Draft {
        return Err(ApiError::NotFound);
    }
    Ok(Json(d))
}

#[derive(Debug, Deserialize)]
pub struct ItemsBody {
    pub items: Vec<ItemInput>,
}

pub async fn replace_items(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Json(b): Json<ItemsBody>,
) -> ApiResult<Json<InvoiceDetail>> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    let inv = load(&mut tx, id, true).await?;
    if !status(&inv).is_editable() {
        return Err(InvoiceError::Locked.into());
    }
    let items = resolve(&mut tx, &inv.locale, &inv.currency, b.items).await?;
    sqlx::query("DELETE FROM invoice_items WHERE invoice_id = $1").bind(id).execute(&mut *tx).await?;
    insert_items(&mut tx, id, &items).await?;
    let d = detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(d))
}

pub async fn delete_draft(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    user.require(Permission::InvoiceWrite, None)?;
    let mut tx = s.db.begin().await?;
    let inv = load(&mut tx, id, true).await?;
    if !status(&inv).is_editable() {
        return Err(InvoiceError::Locked.into());
    }
    sqlx::query("DELETE FROM invoices WHERE id = $1").bind(id).execute(&mut *tx).await?;
    super::audit(&mut tx, &user.actor(), "delete_draft", "invoice", id, json!({})).await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Default, Deserialize)]
pub struct IssueBody {
    /// Zahlungsziel in Tagen (Standard 14)
    pub payment_terms_days: Option<u16>,
}

/// Stellt einen Entwurf aus: validieren, Empfänger einfrieren, Nummer vergeben, Summen festschreiben.
async fn issue_in_tx(tx: &mut PgConnection, actor: &str, id: Uuid, payment_terms_days: u16) -> ApiResult<()> {
    let inv = load(tx, id, true).await?;
    let st = status(&inv);
    if !st.can_transition(InvoiceStatus::Issued) {
        return Err(InvoiceError::InvalidTransition { from: st, to: InvoiceStatus::Issued }.into());
    }
    let items = lines(&load_items(tx, id).await?);
    let (name, address, vat_id): (String, String, Option<String>) =
        sqlx::query_as("SELECT name, address, vat_id FROM organizations WHERE id = $1")
            .bind(inv.organization_id)
            .fetch_one(&mut *tx)
            .await?;
    let recipient = BillingParty { name, address, vat_id };
    let mode = tax_mode_from_str(&inv.tax_mode);
    validate_for_issue(&items, mode, &recipient)?;
    let totals = compute_totals(&items, mode);

    let today = Utc::now().date_naive();
    let series = if inv.kind == "credit_note" { Series::CreditNote } else { Series::Invoice };
    let number = next_number(tx, series, today.year()).await?;
    let due = today + chrono::Duration::days(payment_terms_days as i64);

    sqlx::query(
        "UPDATE invoices SET status = 'issued', number = $2, issued_at = now(), issue_date = $3, due_date = $4,
                recipient_name = $5, recipient_address = $6, recipient_vat_id = $7,
                net_cents = $8, tax_cents = $9, gross_cents = $10
          WHERE id = $1",
    )
    .bind(id)
    .bind(&number)
    .bind(today)
    .bind(due)
    .bind(&recipient.name)
    .bind(&recipient.address)
    .bind(&recipient.vat_id)
    .bind(totals.net.0)
    .bind(totals.tax.0)
    .bind(totals.gross.0)
    .execute(&mut *tx)
    .await?;
    super::audit(tx, actor, "issue", "invoice", id, json!({ "number": number, "gross_cents": totals.gross.0 })).await?;
    Ok(())
}

pub async fn issue(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    body: Option<Json<IssueBody>>,
) -> ApiResult<Json<InvoiceDetail>> {
    user.require(Permission::InvoiceIssue, None)?;
    let terms = body.and_then(|b| b.0.payment_terms_days).unwrap_or(14);
    let mut tx = s.db.begin().await?;
    issue_in_tx(&mut tx, &user.actor(), id, terms).await?;
    let d = detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(d))
}

pub async fn mark_paid(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<Json<InvoiceDetail>> {
    user.require(Permission::InvoiceIssue, None)?;
    let mut tx = s.db.begin().await?;
    let inv = load(&mut tx, id, true).await?;
    let st = status(&inv);
    if inv.kind != "invoice" || !st.can_transition(InvoiceStatus::Paid) {
        return Err(InvoiceError::InvalidTransition { from: st, to: InvoiceStatus::Paid }.into());
    }
    sqlx::query("UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "mark_paid", "invoice", id, json!({})).await?;
    let d = detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(d))
}

/// Storno: erzeugt eine ausgestellte Gutschrift mit negierten Positionen (inkl. Katalogbezug,
/// damit der Umsatz je Abteilung korrekt gemindert wird) und setzt das Original auf `cancelled`.
pub async fn cancel(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
) -> ApiResult<(StatusCode, Json<InvoiceDetail>)> {
    user.require(Permission::InvoiceIssue, None)?;
    let mut tx = s.db.begin().await?;
    let inv = load(&mut tx, id, true).await?;
    let st = status(&inv);
    if inv.kind != "invoice" || !st.can_transition(InvoiceStatus::Cancelled) {
        return Err(InvoiceError::InvalidTransition { from: st, to: InvoiceStatus::Cancelled }.into());
    }
    let items = load_items(&mut tx, id).await?;
    let negated: Vec<Item> = credit_note_items(&lines(&items))
        .into_iter()
        .zip(&items)
        .map(|(line, orig)| Item { line, product_id: orig.product_id, price_id: orig.price_id })
        .collect();
    let cn_id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO invoices (id, organization_id, kind, corrects_invoice_id, currency, tax_mode, locale, notes)
         VALUES ($1, $2, 'credit_note', $3, $4, $5, $6, $7)",
    )
    .bind(cn_id)
    .bind(inv.organization_id)
    .bind(id)
    .bind(&inv.currency)
    .bind(&inv.tax_mode)
    .bind(&inv.locale)
    .bind(format!("Storno zu {}", inv.number.as_deref().unwrap_or("")))
    .execute(&mut *tx)
    .await?;
    insert_items(&mut tx, cn_id, &negated).await?;
    issue_in_tx(&mut tx, &user.actor(), cn_id, 0).await?;
    sqlx::query("UPDATE invoices SET status = 'cancelled', cancelled_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    super::audit(&mut tx, &user.actor(), "cancel", "invoice", id, json!({ "credit_note_id": cn_id })).await?;
    let d = detail(&mut tx, cn_id).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(d)))
}

#[derive(Debug, Deserialize)]
pub struct PdfQuery {
    /// `html` liefert die Druckansicht statt PDF
    pub format: Option<String>,
    /// Sprache des Belegs (Standard: Sprache der Rechnung)
    pub locale: Option<String>,
}

/// Rechnung als PDF (oder HTML-Druckansicht). Entwürfe erhalten ein Wasserzeichen.
pub async fn pdf(
    State(s): State<AppState>,
    user: User,
    Path(id): Path<Uuid>,
    Query(q): Query<PdfQuery>,
) -> ApiResult<axum::response::Response> {
    use axum::response::IntoResponse;
    let mut conn = s.db.acquire().await?;
    let d = detail(&mut conn, id).await?;
    user.require(Permission::InvoiceRead, Some(d.invoice.organization_id))?;
    if !user.role.is_employee() && status(&d.invoice) == InvoiceStatus::Draft {
        return Err(ApiError::NotFound);
    }
    // Entwurf: aktuelle Kundendaten; ausgestellt: eingefrorene Empfängerdaten
    let (org_name, org_addr, org_vat): (String, String, Option<String>) =
        sqlx::query_as("SELECT name, address, vat_id FROM organizations WHERE id = $1")
            .bind(d.invoice.organization_id)
            .fetch_one(&mut *conn)
            .await?;
    let inv = &d.invoice;
    let items = lines(&d.items);
    let name = inv.number.clone().unwrap_or_else(|| format!("Entwurf-{}", &id.to_string()[..8]));
    let pdf_response = |bytes: Vec<u8>| {
        (
            [
                (axum::http::header::CONTENT_TYPE, "application/pdf".to_string()),
                (axum::http::header::CONTENT_DISPOSITION, format!("inline; filename=\"{name}.pdf\"")),
            ],
            bytes,
        )
            .into_response()
    };
    // 1. Layout des Altsystems (übernommene Belege: Original-Druckdaten)
    if q.format.as_deref() != Some("html") {
        let (snapshot,): (Option<serde_json::Value>,) =
            sqlx::query_as("SELECT pdf_snapshot FROM invoices WHERE id = $1").bind(id).fetch_one(&mut *conn).await?;
        let data = snapshot.unwrap_or_else(|| {
            crate::legacy_pdf::invoice_data(
                inv.number.as_deref(),
                inv.issue_date,
                inv.due_date,
                (inv.service_from, inv.service_to),
                inv.recipient_name.as_deref().unwrap_or(&org_name),
                inv.recipient_address.as_deref().unwrap_or(&org_addr),
                &items,
                &d.totals,
                &inv.currency,
                &inv.notes,
            )
        });
        let template = crate::legacy_pdf::template(&mut conn).await;
        let locale = q.locale.as_deref().unwrap_or(&inv.locale);
        if let Some(bytes) = crate::legacy_pdf::render("invoice", locale, template, data).await {
            return Ok(pdf_response(bytes));
        }
    }
    // 2. Ersatz: eigene HTML-Vorlage über Chromium
    let doc = crate::pdf::PdfInvoice {
        kind: &inv.kind,
        number: inv.number.as_deref(),
        status: &inv.status,
        locale: &inv.locale,
        currency: &inv.currency,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        service: inv.service_from.map(|f| (f, inv.service_to.unwrap_or(f))),
        recipient_name: inv.recipient_name.as_deref().unwrap_or(&org_name),
        recipient_address: inv.recipient_address.as_deref().unwrap_or(&org_addr),
        recipient_vat_id: if inv.recipient_name.is_some() {
            inv.recipient_vat_id.as_deref()
        } else {
            org_vat.as_deref()
        },
        notes: &inv.notes,
        items: &items,
        groups: &d.totals.groups,
        net: d.totals.net.0,
        tax: d.totals.tax.0,
        gross: d.totals.gross.0,
        tax_notice: d.tax_notice,
    };
    let html = crate::pdf::render_html(&doc, &crate::pdf::Company::from_env());
    if q.format.as_deref() != Some("html") {
        if let Some(bytes) = crate::pdf::html_to_pdf(&html).await {
            return Ok(pdf_response(bytes));
        }
        tracing::warn!("Chromium nicht verfügbar – liefere HTML-Druckansicht");
    }
    Ok(([(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8".to_string())], html).into_response())
}
