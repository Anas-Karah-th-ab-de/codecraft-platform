//! Web-Push (RFC 8030/8291/8292): Benachrichtigungen an Handy und PC, auch wenn das Portal geschlossen ist.
//!
//! - VAPID-Schlüssel (P-256) wird einmal erzeugt und verschlüsselt in `server_keys` abgelegt.
//! - Inhalt wird pro Abo mit `aes128gcm` verschlüsselt (ECDH + HKDF), der Push-Dienst sieht nur Chiffrat.
//! - Abgelaufene Abos (404/410) werden gelöscht, wiederholte Fehler nach 20 Versuchen ebenso.

use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use base64::Engine;
use p256::ecdsa::signature::Signer;
use p256::ecdsa::{Signature, SigningKey};
use p256::elliptic_curve::sec1::ToEncodedPoint;
use p256::{PublicKey, SecretKey};
use rand::RngCore;
use serde_json::{json, Value};
use sqlx::PgPool;
use std::sync::OnceLock;
use uuid::Uuid;

const KEY_NAME: &str = "vapid_p256";

/// VAPID-Schlüssel laden oder anlegen
pub async fn vapid(db: &PgPool) -> Result<SigningKey, sqlx::Error> {
    if let Some(v) = sqlx::query_scalar::<_, Vec<u8>>("SELECT value FROM server_keys WHERE name = $1")
        .bind(KEY_NAME)
        .fetch_optional(db)
        .await?
    {
        if let Ok(k) = SigningKey::from_slice(&crate::mail::guard::open(v)) {
            return Ok(k);
        }
    }
    let key = SigningKey::random(&mut rand::rngs::OsRng);
    sqlx::query("INSERT INTO server_keys (name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING")
        .bind(KEY_NAME)
        .bind(crate::mail::guard::seal(&key.to_bytes()))
        .execute(db)
        .await?;
    // bei gleichzeitigem Anlegen gewinnt der erste Eintrag
    let v: Vec<u8> =
        sqlx::query_scalar("SELECT value FROM server_keys WHERE name = $1").bind(KEY_NAME).fetch_one(db).await?;
    Ok(SigningKey::from_slice(&crate::mail::guard::open(v)).unwrap_or(key))
}

/// Öffentlicher Schlüssel für `pushManager.subscribe({ applicationServerKey })`
pub fn public_key(key: &SigningKey) -> String {
    B64.encode(key.verifying_key().to_encoded_point(false).as_bytes())
}

fn subject() -> String {
    std::env::var("PUSH_SUBJECT").unwrap_or_else(|_| "mailto:support@code-craft.tech".into())
}

/// JWT (ES256) für den Push-Dienst; `aud` = Ursprung des Endpunkts
fn vapid_header(key: &SigningKey, endpoint: &str) -> Option<String> {
    let aud = {
        let rest = endpoint.strip_prefix("https://")?;
        format!("https://{}", rest.split('/').next()?)
    };
    let exp = chrono::Utc::now().timestamp() + 12 * 3600;
    let head = B64.encode(br#"{"typ":"JWT","alg":"ES256"}"#);
    let claims = B64.encode(json!({ "aud": aud, "exp": exp, "sub": subject() }).to_string());
    let input = format!("{head}.{claims}");
    let sig: Signature = key.sign(input.as_bytes());
    Some(format!("vapid t={input}.{}, k={}", B64.encode(sig.to_bytes()), public_key(key)))
}

/// Inhalt nach RFC 8291 verschlüsseln (ein Datensatz, `aes128gcm`)
pub fn encrypt(p256dh_b64: &str, auth_b64: &str, payload: &[u8]) -> Option<Vec<u8>> {
    use aes_gcm::aead::{Aead, KeyInit};
    use hkdf::Hkdf;
    use sha2::Sha256;
    let ua_pub_bytes = B64.decode(p256dh_b64.trim_end_matches('=')).ok()?;
    let auth = B64.decode(auth_b64.trim_end_matches('=')).ok()?;
    let ua_pub = PublicKey::from_sec1_bytes(&ua_pub_bytes).ok()?;
    let as_secret = SecretKey::random(&mut rand::rngs::OsRng);
    let as_pub = as_secret.public_key().to_encoded_point(false);
    let shared = p256::ecdh::diffie_hellman(as_secret.to_nonzero_scalar(), ua_pub.as_affine());

    let mut key_info = b"WebPush: info\0".to_vec();
    key_info.extend_from_slice(&ua_pub_bytes);
    key_info.extend_from_slice(as_pub.as_bytes());
    let mut ikm = [0u8; 32];
    Hkdf::<Sha256>::new(Some(&auth), shared.raw_secret_bytes()).expand(&key_info, &mut ikm).ok()?;

    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let hk = Hkdf::<Sha256>::new(Some(&salt), &ikm);
    let mut cek = [0u8; 16];
    let mut nonce = [0u8; 12];
    hk.expand(b"Content-Encoding: aes128gcm\0", &mut cek).ok()?;
    hk.expand(b"Content-Encoding: nonce\0", &mut nonce).ok()?;

    let mut plain = payload.to_vec();
    plain.push(2); // letzter Datensatz, keine Auffüllung
    let cipher = aes_gcm::Aes128Gcm::new_from_slice(&cek).ok()?;
    let ct = cipher.encrypt(aes_gcm::Nonce::from_slice(&nonce), plain.as_slice()).ok()?;

    let mut out = Vec::with_capacity(16 + 4 + 1 + 65 + ct.len());
    out.extend_from_slice(&salt);
    out.extend_from_slice(&4096u32.to_be_bytes());
    out.push(as_pub.as_bytes().len() as u8);
    out.extend_from_slice(as_pub.as_bytes());
    out.extend_from_slice(&ct);
    Some(out)
}

fn client() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

/// Dringlichkeit nach RFC 8030 – `high` weckt Handys sofort (Anrufe)
#[derive(Clone, Copy)]
pub enum Urgency {
    Normal,
    High,
}

/// Im Hintergrund an alle Geräte der Benutzer senden (Fehler werden nur protokolliert)
pub fn send(db: PgPool, users: Vec<Uuid>, payload: Value, urgency: Urgency, ttl: u32) {
    if users.is_empty() || std::env::var("PUSH_DISABLED").is_ok() {
        return;
    }
    tokio::spawn(async move {
        if let Err(e) = send_now(&db, &users, &payload, urgency, ttl).await {
            tracing::warn!("push: {e}");
        }
    });
}

pub async fn send_now(
    db: &PgPool,
    users: &[Uuid],
    payload: &Value,
    urgency: Urgency,
    ttl: u32,
) -> Result<usize, sqlx::Error> {
    let subs: Vec<(Uuid, String, String, String)> =
        sqlx::query_as("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)")
            .bind(users)
            .fetch_all(db)
            .await?;
    if subs.is_empty() {
        return Ok(0);
    }
    let key = vapid(db).await?;
    let body = payload.to_string();
    let mut ok = 0;
    for (id, endpoint, p256dh, auth) in subs {
        let (Some(data), Some(authz)) = (encrypt(&p256dh, &auth, body.as_bytes()), vapid_header(&key, &endpoint))
        else {
            sqlx::query("DELETE FROM push_subscriptions WHERE id = $1").bind(id).execute(db).await?;
            continue;
        };
        let res = client()
            .post(&endpoint)
            .header("authorization", authz)
            .header("content-encoding", "aes128gcm")
            .header("content-type", "application/octet-stream")
            .header("ttl", ttl.to_string())
            .header("urgency", if matches!(urgency, Urgency::High) { "high" } else { "normal" })
            .body(data)
            .send()
            .await;
        match res.map(|r| r.status().as_u16()) {
            Ok(200..=299) => {
                ok += 1;
                sqlx::query("UPDATE push_subscriptions SET last_ok_at = now(), failures = 0 WHERE id = $1")
                    .bind(id)
                    .execute(db)
                    .await?;
            }
            // Abo abgelaufen oder vom Nutzer entfernt
            Ok(404 | 410) => {
                sqlx::query("DELETE FROM push_subscriptions WHERE id = $1").bind(id).execute(db).await?;
            }
            other => {
                tracing::debug!("push {endpoint}: {other:?}");
                sqlx::query("UPDATE push_subscriptions SET failures = failures + 1 WHERE id = $1")
                    .bind(id)
                    .execute(db)
                    .await?;
                sqlx::query("DELETE FROM push_subscriptions WHERE id = $1 AND failures >= 20")
                    .bind(id)
                    .execute(db)
                    .await?;
            }
        }
    }
    Ok(ok)
}

#[cfg(test)]
mod tests {
    use super::*;
    use aes_gcm::aead::{Aead, KeyInit};
    use hkdf::Hkdf;
    use sha2::Sha256;

    /// Gegenprobe: so entschlüsselt der Browser (Empfängerseite von RFC 8291)
    #[test]
    fn encrypt_roundtrip() {
        let ua = SecretKey::random(&mut rand::rngs::OsRng);
        let ua_pub = ua.public_key().to_encoded_point(false);
        let mut auth = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut auth);
        let msg = br#"{"title":"Anruf","body":"Jana ruft an"}"#;
        let out = encrypt(&B64.encode(ua_pub.as_bytes()), &B64.encode(auth), msg).unwrap();

        let salt = &out[..16];
        assert_eq!(u32::from_be_bytes(out[16..20].try_into().unwrap()), 4096);
        let idlen = out[20] as usize;
        let as_pub = &out[21..21 + idlen];
        let ct = &out[21 + idlen..];
        let shared =
            p256::ecdh::diffie_hellman(ua.to_nonzero_scalar(), PublicKey::from_sec1_bytes(as_pub).unwrap().as_affine());
        let mut info = b"WebPush: info\0".to_vec();
        info.extend_from_slice(ua_pub.as_bytes());
        info.extend_from_slice(as_pub);
        let mut ikm = [0u8; 32];
        Hkdf::<Sha256>::new(Some(&auth), shared.raw_secret_bytes()).expand(&info, &mut ikm).unwrap();
        let hk = Hkdf::<Sha256>::new(Some(salt), &ikm);
        let (mut cek, mut nonce) = ([0u8; 16], [0u8; 12]);
        hk.expand(b"Content-Encoding: aes128gcm\0", &mut cek).unwrap();
        hk.expand(b"Content-Encoding: nonce\0", &mut nonce).unwrap();
        let plain =
            aes_gcm::Aes128Gcm::new_from_slice(&cek).unwrap().decrypt(aes_gcm::Nonce::from_slice(&nonce), ct).unwrap();
        assert_eq!(&plain[..plain.len() - 1], msg);
        assert_eq!(*plain.last().unwrap(), 2);
    }

    #[test]
    fn vapid_jwt() {
        let key = SigningKey::random(&mut rand::rngs::OsRng);
        let h = vapid_header(&key, "https://fcm.googleapis.com/fcm/send/abc").unwrap();
        assert!(h.starts_with("vapid t="));
        let t = h.strip_prefix("vapid t=").unwrap().split(", k=").next().unwrap();
        let parts: Vec<&str> = t.split('.').collect();
        assert_eq!(parts.len(), 3);
        let claims: Value = serde_json::from_slice(&B64.decode(parts[1]).unwrap()).unwrap();
        assert_eq!(claims["aud"], "https://fcm.googleapis.com");
        // Signatur prüfen
        use p256::ecdsa::signature::Verifier;
        let sig = Signature::from_slice(&B64.decode(parts[2]).unwrap()).unwrap();
        key.verifying_key().verify(format!("{}.{}", parts[0], parts[1]).as_bytes(), &sig).unwrap();
        assert!(vapid_header(&key, "http://unsicher/x").is_none());
    }
}
