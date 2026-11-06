//! Produktbilder: Upload, Katalog, Hauptbild, Löschen, Rechte, Validierung.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use codecraft_server::{app, auth, AppState};
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

const POS: &str = "00000000-0000-7000-8000-000000000106";

async fn token(db: &PgPool, role: &str) -> String {
    let id = Uuid::now_v7();
    let t = auth::new_token("cc_u_");
    sqlx::query("INSERT INTO users (id, email, display_name, role) VALUES ($1, $2, 'U', $3)")
        .bind(id)
        .bind(format!("{id}@t.de"))
        .bind(role)
        .execute(db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO api_tokens (id, token_hash, user_id, name) VALUES ($1, $2, $3, 't')")
        .bind(Uuid::now_v7())
        .bind(auth::hash_token(&t))
        .bind(id)
        .execute(db)
        .await
        .unwrap();
    t
}

fn png(w: u32, h: u32) -> Vec<u8> {
    let img = image::RgbImage::from_fn(w, h, |x, y| image::Rgb([(x % 255) as u8, (y % 255) as u8, 128]));
    let mut out = Vec::new();
    image::DynamicImage::ImageRgb8(img).write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png).unwrap();
    out
}

async fn send(db: &PgPool, req: Request<Body>) -> (StatusCode, Value) {
    let res = app(AppState { db: db.clone() }).oneshot(req).await.unwrap();
    let s = res.status();
    let b = res.into_body().collect().await.unwrap().to_bytes();
    (s, serde_json::from_slice(&b).unwrap_or(Value::Null))
}

async fn upload(db: &PgPool, token: &str, bytes: Vec<u8>) -> (StatusCode, Value) {
    let boundary = "XBOUNDARYX";
    let mut body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.png\"\r\nContent-Type: image/png\r\n\r\n"
    )
    .into_bytes();
    body.extend(bytes);
    body.extend(format!("\r\n--{boundary}--\r\n").into_bytes());
    let req = Request::post(format!("/api/v1/products/{POS}/images"))
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", format!("multipart/form-data; boundary={boundary}"))
        .body(Body::from(body))
        .unwrap();
    send(db, req).await
}

async fn get(db: &PgPool, uri: &str, token: &str) -> (StatusCode, Value) {
    send(db, Request::get(uri).header("authorization", format!("Bearer {token}")).body(Body::empty()).unwrap()).await
}

#[sqlx::test(migrator = "codecraft_server::MIGRATOR")]
async fn product_images(db: PgPool) {
    let dir = std::env::temp_dir().join(format!("cc-media-{}", Uuid::now_v7()));
    std::env::set_var("MEDIA_DIR", &dir);
    let admin = token(&db, "admin").await;
    let staff = token(&db, "staff").await;

    // Mitarbeiter ohne Katalogrecht darf nicht hochladen; kein Bild → 400
    assert_eq!(upload(&db, &staff, png(10, 10)).await.0, StatusCode::FORBIDDEN);
    assert_eq!(upload(&db, &admin, b"kein bild".to_vec()).await.0, StatusCode::BAD_REQUEST);

    // Großes Bild wird auf 1600 px verkleinert, Kartenbild 480 px
    let (s, a) = upload(&db, &admin, png(2400, 1200)).await;
    assert_eq!(s, StatusCode::CREATED, "{a}");
    assert_eq!((a["width"].as_i64(), a["height"].as_i64()), (Some(1600), Some(800)));
    let card = a["card"].as_str().unwrap().trim_start_matches("/media/");
    let saved = image::open(dir.join(card)).unwrap();
    assert_eq!(saved.width(), 480);
    let (_, b) = upload(&db, &admin, png(400, 300)).await;

    // Öffentlicher Katalog + Detail enthalten die Bilder, erstes = Hauptbild
    let (_, detail) = get(&db, "/api/v1/public/products/pos-code-craft-v3?locale=ar", "").await;
    let imgs = detail["images"].as_array().unwrap();
    assert_eq!(imgs.len(), 2);
    assert_eq!(imgs[0]["id"], a["id"]);

    // Hauptbild wechseln
    let req = Request::post(format!("/api/v1/product-images/{}/primary", b["id"].as_str().unwrap()))
        .header("authorization", format!("Bearer {admin}"))
        .body(Body::empty())
        .unwrap();
    assert_eq!(send(&db, req).await.0, StatusCode::NO_CONTENT);
    let (_, detail) = get(&db, "/api/v1/public/products/pos-code-craft-v3", "").await;
    assert_eq!(detail["images"][0]["id"], b["id"]);

    // Löschen entfernt auch die Dateien
    let req = Request::delete(format!("/api/v1/product-images/{}", a["id"].as_str().unwrap()))
        .header("authorization", format!("Bearer {admin}"))
        .body(Body::empty())
        .unwrap();
    assert_eq!(send(&db, req).await.0, StatusCode::NO_CONTENT);
    assert!(!dir.join(card).exists());
    let (_, detail) = get(&db, "/api/v1/public/products/pos-code-craft-v3", "").await;
    assert_eq!(detail["images"].as_array().unwrap().len(), 1);

    // Unbekanntes / nicht öffentliches Produkt
    assert_eq!(get(&db, "/api/v1/public/products/km-code-craft-ai", "").await.0, StatusCode::NOT_FOUND);
    let _ = std::fs::remove_dir_all(dir);
}
