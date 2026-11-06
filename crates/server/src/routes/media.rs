//! Produktbilder: Upload (JPEG/PNG/WebP), automatische Verkleinerung, Hauptbild, löschen.
//! Dateien liegen unter `MEDIA_DIR` (Standard `data/media`) und werden unter `/media/…` mit Langzeit-Cache ausgeliefert.

use crate::auth::User;
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::{Multipart, Path, State};
use axum::http::StatusCode;
use axum::Json;
use codecraft_domain::access::Permission;
use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageFormat, ImageReader};
use serde::Serialize;
use serde_json::json;
use std::io::Cursor;
use std::path::PathBuf;
use uuid::Uuid;

pub const MAX_UPLOAD: usize = 10 * 1024 * 1024;
const CARD_W: u32 = 480;
const FULL_W: u32 = 1600;

pub fn media_dir() -> PathBuf {
    PathBuf::from(std::env::var("MEDIA_DIR").unwrap_or_else(|_| "data/media".into()))
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ImageRow {
    pub id: Uuid,
    pub product_id: Uuid,
    pub card_path: String,
    pub full_path: String,
    pub width: i32,
    pub height: i32,
    pub sort: i32,
}

/// Öffentliche Darstellung (URLs statt Pfade)
#[derive(Debug, Clone, Serialize)]
pub struct ImageOut {
    pub id: Uuid,
    pub card: String,
    pub full: String,
    pub width: i32,
    pub height: i32,
}

impl From<&ImageRow> for ImageOut {
    fn from(r: &ImageRow) -> Self {
        ImageOut {
            id: r.id,
            card: format!("/media/{}", r.card_path),
            full: format!("/media/{}", r.full_path),
            width: r.width,
            height: r.height,
        }
    }
}

pub async fn images_for(db: &sqlx::PgPool, product_ids: &[Uuid]) -> Result<Vec<ImageRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, product_id, card_path, full_path, width, height, sort FROM product_images
          WHERE product_id = ANY($1) ORDER BY product_id, sort, created_at",
    )
    .bind(product_ids)
    .fetch_all(db)
    .await
}

struct Processed {
    card: Vec<u8>,
    full: Vec<u8>,
    ext: &'static str,
    width: u32,
    height: u32,
}

/// Dekodieren mit Größenlimit (Schutz gegen „Bildbomben“), verkleinern, neu kodieren.
/// Fotos → JPEG (Qualität 82), Bilder mit Transparenz → PNG.
fn process(bytes: &[u8]) -> Result<Processed, String> {
    let mut reader = ImageReader::new(Cursor::new(bytes)).with_guessed_format().map_err(|e| e.to_string())?;
    match reader.format() {
        Some(ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::WebP) => {}
        _ => return Err("Nur JPEG, PNG oder WebP erlaubt".into()),
    }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(12_000);
    limits.max_image_height = Some(12_000);
    limits.max_alloc = Some(256 * 1024 * 1024);
    reader.limits(limits);
    let img = reader.decode().map_err(|e| format!("Bild kann nicht gelesen werden: {e}"))?;
    let alpha = img.color().has_alpha();
    let full = shrink(&img, FULL_W);
    let card = shrink(&img, CARD_W);
    let (width, height) = full.dimensions();
    let enc = |i: &DynamicImage| -> Result<Vec<u8>, String> {
        let mut out = Vec::new();
        if alpha {
            i.write_to(&mut Cursor::new(&mut out), ImageFormat::Png).map_err(|e| e.to_string())?;
        } else {
            let rgb = i.to_rgb8();
            let mut c = Cursor::new(&mut out);
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut c, 82)
                .encode_image(&rgb)
                .map_err(|e| e.to_string())?;
        }
        Ok(out)
    };
    Ok(Processed { card: enc(&card)?, full: enc(&full)?, ext: if alpha { "png" } else { "jpg" }, width, height })
}

fn shrink(img: &DynamicImage, max_w: u32) -> DynamicImage {
    if img.width() <= max_w {
        img.clone()
    } else {
        img.resize(max_w, u32::MAX, FilterType::Lanczos3)
    }
}

pub async fn upload(
    State(s): State<AppState>,
    user: User,
    Path(product_id): Path<Uuid>,
    mut mp: Multipart,
) -> ApiResult<(StatusCode, Json<ImageOut>)> {
    user.require(Permission::CatalogWrite, None)?;
    let exists: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM products WHERE id = $1").bind(product_id).fetch_optional(&s.db).await?;
    exists.ok_or(ApiError::NotFound)?;

    let mut bytes = None;
    while let Some(field) = mp.next_field().await.map_err(|e| ApiError::BadRequest(e.to_string()))? {
        if field.name() == Some("file") {
            bytes = Some(field.bytes().await.map_err(|_| ApiError::BadRequest("Datei zu groß (max. 10 MB)".into()))?);
        }
    }
    let bytes = bytes.ok_or_else(|| ApiError::BadRequest("Feld 'file' fehlt".into()))?;
    let p = tokio::task::spawn_blocking(move || process(&bytes))
        .await
        .map_err(|_| ApiError::BadRequest("Verarbeitung abgebrochen".into()))?
        .map_err(ApiError::BadRequest)?;

    let id = Uuid::now_v7();
    let rel_dir = format!("products/{product_id}");
    let dir = media_dir().join(&rel_dir);
    tokio::fs::create_dir_all(&dir).await.map_err(|e| ApiError::BadRequest(format!("Speicher: {e}")))?;
    let card_path = format!("{rel_dir}/{id}-card.{}", p.ext);
    let full_path = format!("{rel_dir}/{id}.{}", p.ext);
    tokio::fs::write(media_dir().join(&card_path), &p.card).await.map_err(|e| ApiError::BadRequest(e.to_string()))?;
    tokio::fs::write(media_dir().join(&full_path), &p.full).await.map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let mut tx = s.db.begin().await?;
    let row: ImageRow = sqlx::query_as(
        "INSERT INTO product_images (id, product_id, card_path, full_path, width, height, sort)
         VALUES ($1, $2, $3, $4, $5, $6,
                 (SELECT COALESCE(max(sort), -1) + 1 FROM product_images WHERE product_id = $2))
         RETURNING id, product_id, card_path, full_path, width, height, sort",
    )
    .bind(id)
    .bind(product_id)
    .bind(&card_path)
    .bind(&full_path)
    .bind(p.width as i32)
    .bind(p.height as i32)
    .fetch_one(&mut *tx)
    .await?;
    super::audit(&mut tx, &user.actor(), "add_image", "product", product_id, json!({ "image": id })).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json((&row).into())))
}

pub async fn delete(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    user.require(Permission::CatalogWrite, None)?;
    let row: Option<ImageRow> = sqlx::query_as(
        "DELETE FROM product_images WHERE id = $1
         RETURNING id, product_id, card_path, full_path, width, height, sort",
    )
    .bind(id)
    .fetch_optional(&s.db)
    .await?;
    let row = row.ok_or(ApiError::NotFound)?;
    for p in [&row.card_path, &row.full_path] {
        let _ = tokio::fs::remove_file(media_dir().join(p)).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Bild als Hauptbild (erste Position) setzen
pub async fn make_primary(State(s): State<AppState>, user: User, Path(id): Path<Uuid>) -> ApiResult<StatusCode> {
    user.require(Permission::CatalogWrite, None)?;
    let r = sqlx::query(
        "UPDATE product_images SET sort = (SELECT min(sort) - 1 FROM product_images o
                                            WHERE o.product_id = product_images.product_id)
          WHERE id = $1",
    )
    .bind(id)
    .execute(&s.db)
    .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png(w: u32, h: u32, alpha: bool) -> Vec<u8> {
        let img = if alpha {
            DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(w, h, image::Rgba([10, 20, 30, 128])))
        } else {
            DynamicImage::ImageRgb8(image::RgbImage::from_pixel(w, h, image::Rgb([10, 20, 30])))
        };
        let mut out = Vec::new();
        img.write_to(&mut Cursor::new(&mut out), ImageFormat::Png).unwrap();
        out
    }

    #[test]
    fn resizes_and_picks_format() {
        let p = process(&png(3000, 1500, false)).unwrap();
        assert_eq!((p.width, p.height), (1600, 800));
        assert_eq!(p.ext, "jpg");
        let card = image::load_from_memory(&p.card).unwrap();
        assert_eq!(card.width(), 480);
        // Transparenz bleibt erhalten, kleine Bilder werden nicht vergrößert
        let p = process(&png(300, 200, true)).unwrap();
        assert_eq!((p.width, p.height, p.ext), (300, 200, "png"));
    }

    #[test]
    fn rejects_non_images() {
        assert!(process(b"%PDF-1.4 kein Bild").is_err());
        assert!(process(b"GIF89a....").is_err());
    }
}
