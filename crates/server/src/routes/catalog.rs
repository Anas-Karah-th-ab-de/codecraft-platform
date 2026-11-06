//! Abteilungen & Produktkatalog.
//!
//! - `GET /api/v1/public/catalog?locale=ar` – öffentlich, für die Webseite (nur aktive, öffentliche Produkte)
//! - `GET /api/v1/departments`, `GET/POST /api/v1/products` – intern
//! - `GET /api/v1/reports/revenue-by-department?year=` – Umsatz je Abteilung über die Produktzuordnung

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::Json;
use codecraft_domain::access::Permission;
use codecraft_domain::catalog::{validate_code, validate_price, Billing, I18n, ProductKind};
use codecraft_protocol::DeviceKind;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::types::Json as SqlJson;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Department {
    pub id: Uuid,
    pub code: String,
    pub slug: String,
    pub name: SqlJson<I18n>,
    pub description: SqlJson<I18n>,
    pub color: String,
    pub icon: String,
    pub modules: Vec<String>,
    pub parent_id: Option<Uuid>,
    pub is_active: bool,
}

pub async fn departments(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<Department>>> {
    user.require(Permission::CatalogRead, None)?;
    let rows = sqlx::query_as(
        "SELECT id, code, slug, name, description, color, icon, modules, parent_id, is_active
           FROM departments ORDER BY code",
    )
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PriceRow {
    pub id: Uuid,
    pub product_id: Uuid,
    pub code: String,
    pub name: SqlJson<I18n>,
    pub billing: String,
    pub amount_cents: Option<i64>,
    pub currency: String,
    pub features: SqlJson<Value>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProductRow {
    pub id: Uuid,
    pub sku: String,
    pub slug: String,
    pub kind: String,
    pub department_id: Uuid,
    pub department_code: String,
    pub device_kind: Option<String>,
    pub name: SqlJson<I18n>,
    pub description: SqlJson<I18n>,
    pub is_public: bool,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct ProductOut {
    #[serde(flatten)]
    pub product: ProductRow,
    pub prices: Vec<PriceRow>,
}

const PRODUCT_COLS: &str = "p.id, p.sku, p.slug, p.kind, p.department_id, d.code AS department_code, p.device_kind,
    p.name, p.description, p.is_public, p.is_active";
const PRICE_COLS: &str =
    "id, product_id, code, name, billing, amount_cents, currency::text AS currency, features, is_active";

async fn products_with_prices(db: &sqlx::PgPool, only_public: bool) -> ApiResult<Vec<ProductOut>> {
    let filter = if only_public { "WHERE p.is_active AND p.is_public AND d.is_active" } else { "" };
    let products: Vec<ProductRow> = sqlx::query_as(&format!(
        "SELECT {PRODUCT_COLS} FROM products p JOIN departments d ON d.id = p.department_id {filter}
          ORDER BY p.sort, p.sku"
    ))
    .fetch_all(db)
    .await?;
    let price_filter = if only_public { "WHERE is_active" } else { "" };
    let mut prices: Vec<PriceRow> =
        sqlx::query_as(&format!("SELECT {PRICE_COLS} FROM product_prices {price_filter} ORDER BY sort, code"))
            .fetch_all(db)
            .await?;
    Ok(products
        .into_iter()
        .map(|product| {
            let (mine, rest): (Vec<_>, Vec<_>) = prices.drain(..).partition(|p| p.product_id == product.id);
            prices = rest;
            ProductOut { product, prices: mine }
        })
        .collect())
}

pub async fn products(State(s): State<AppState>, user: User) -> ApiResult<Json<Vec<ProductOut>>> {
    user.require(Permission::CatalogRead, None)?;
    Ok(Json(products_with_prices(&s.db, false).await?))
}

// ── Öffentlicher Katalog (Webseite) ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LocaleQuery {
    pub locale: Option<String>,
}

pub async fn public_catalog(State(s): State<AppState>, Query(q): Query<LocaleQuery>) -> ApiResult<Json<Value>> {
    let locale = match q.locale.as_deref() {
        Some(l @ ("de" | "en" | "ar")) => l.to_owned(),
        _ => "de".into(),
    };
    let depts: Vec<(Uuid, String, SqlJson<I18n>, String, String)> =
        sqlx::query_as("SELECT id, code, name, color, icon FROM departments WHERE is_active ORDER BY code")
            .fetch_all(&s.db)
            .await?;
    let products = products_with_prices(&s.db, true).await?;
    let out = json!({
        "locale": locale,
        "dir": if locale == "ar" { "rtl" } else { "ltr" },
        "departments": depts.iter().map(|(id, code, name, color, icon)| json!({
            "id": id, "code": code, "name": name.get(&locale), "color": color, "icon": icon,
        })).collect::<Vec<_>>(),
        "products": products.iter().map(|p| json!({
            "id": p.product.id,
            "sku": p.product.sku,
            "slug": p.product.slug,
            "kind": p.product.kind,
            "department": p.product.department_code,
            "name": p.product.name.get(&locale),
            "description": p.product.description.get(&locale),
            "prices": p.prices.iter().map(|pr| json!({
                "id": pr.id,
                "code": pr.code,
                "name": pr.name.get(&locale),
                "billing": pr.billing,
                "amount_cents": pr.amount_cents,
                "currency": pr.currency,
                "features": pr.features.get(&locale).cloned().unwrap_or(json!([])),
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
    });
    Ok(Json(out))
}

// ── Produkt anlegen ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct NewPrice {
    pub code: String,
    pub name: I18n,
    pub billing: Billing,
    pub amount_cents: Option<i64>,
    #[serde(default)]
    pub features: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct NewProduct {
    pub sku: String,
    pub slug: String,
    pub kind: ProductKind,
    pub department_code: String,
    pub device_kind: Option<DeviceKind>,
    pub name: I18n,
    pub description: I18n,
    #[serde(default = "yes")]
    pub is_public: bool,
    pub prices: Vec<NewPrice>,
}

fn yes() -> bool {
    true
}

fn enum_str<T: Serialize>(v: &T) -> String {
    serde_json::to_value(v).ok().and_then(|v| v.as_str().map(String::from)).unwrap_or_default()
}

pub async fn create_product(
    State(s): State<AppState>,
    user: User,
    Json(b): Json<NewProduct>,
) -> ApiResult<(StatusCode, Json<ProductOut>)> {
    user.require(Permission::CatalogWrite, None)?;
    let bad = |e: codecraft_domain::catalog::CatalogError| ApiError::BadRequest(e.to_string());
    b.name.validate("name").map_err(bad)?;
    b.description.validate("description").map_err(bad)?;
    validate_code(&b.slug).map_err(bad)?;
    if b.prices.is_empty() {
        return Err(ApiError::BadRequest("Produkt braucht mindestens einen Preis".into()));
    }
    for p in &b.prices {
        validate_code(&p.code).map_err(bad)?;
        p.name.validate("price.name").map_err(bad)?;
        validate_price(&p.code, p.billing, p.amount_cents).map_err(bad)?;
    }

    let mut tx = s.db.begin().await?;
    let dept: (Uuid,) = sqlx::query_as("SELECT id FROM departments WHERE code = $1 AND is_active")
        .bind(&b.department_code)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| ApiError::BadRequest(format!("Abteilung {} existiert nicht", b.department_code)))?;
    let id = Uuid::now_v7();
    sqlx::query(
        "INSERT INTO products (id, sku, slug, kind, department_id, device_kind, name, description, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(id)
    .bind(&b.sku)
    .bind(&b.slug)
    .bind(enum_str(&b.kind))
    .bind(dept.0)
    .bind(b.device_kind.as_ref().map(enum_str))
    .bind(SqlJson(&b.name))
    .bind(SqlJson(&b.description))
    .bind(b.is_public)
    .execute(&mut *tx)
    .await?;
    for (i, p) in b.prices.iter().enumerate() {
        sqlx::query(
            "INSERT INTO product_prices (id, product_id, code, name, billing, amount_cents, features, sort)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(Uuid::now_v7())
        .bind(id)
        .bind(&p.code)
        .bind(SqlJson(&p.name))
        .bind(enum_str(&p.billing))
        .bind(p.amount_cents)
        .bind(p.features.clone().unwrap_or(json!({ "de": [], "en": [], "ar": [] })))
        .bind(i as i32 + 1)
        .execute(&mut *tx)
        .await?;
    }
    super::audit(&mut tx, &user.actor(), "create", "product", id, json!({ "sku": b.sku })).await?;
    tx.commit().await?;
    let out =
        products_with_prices(&s.db, false).await?.into_iter().find(|p| p.product.id == id).ok_or(ApiError::NotFound)?;
    Ok((StatusCode::CREATED, Json(out)))
}

// ── Umsatz je Abteilung ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct YearQuery {
    pub year: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DepartmentRevenue {
    /// NULL = Positionen ohne Katalogbezug
    pub department_code: Option<String>,
    pub net_cents: i64,
    pub items: i64,
}

pub async fn revenue_by_department(
    State(s): State<AppState>,
    user: User,
    Query(q): Query<YearQuery>,
) -> ApiResult<Json<Vec<DepartmentRevenue>>> {
    user.require(Permission::InvoiceRead, None)?;
    if !user.role.is_employee() {
        return Err(ApiError::Forbidden);
    }
    let year = q.year.unwrap_or_else(|| chrono::Datelike::year(&chrono::Utc::now().date_naive()));
    // Ausgestellte Rechnungen und Gutschriften (Gutschriften mindern den Umsatz automatisch, da negativ)
    let rows = sqlx::query_as(
        "SELECT d.code AS department_code,
                COALESCE(SUM(ROUND(ii.quantity_milli::numeric * ii.unit_price_cents / 1000)), 0)::bigint AS net_cents,
                COUNT(*) AS items
           FROM invoice_items ii
           JOIN invoices i ON i.id = ii.invoice_id
           LEFT JOIN products p ON p.id = ii.product_id
           LEFT JOIN departments d ON d.id = p.department_id
          WHERE i.status <> 'draft' AND EXTRACT(YEAR FROM i.issue_date) = $1
          GROUP BY d.code
          ORDER BY d.code NULLS LAST",
    )
    .bind(year)
    .fetch_all(&s.db)
    .await?;
    Ok(Json(rows))
}
