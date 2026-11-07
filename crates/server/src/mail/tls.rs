//! TLS für SMTP/IMAP: Zertifikat aus MAIL_TLS_CERT / MAIL_TLS_KEY (PEM, z. B. Let's Encrypt).
//! `Stream` fasst Klartext- und TLS-Verbindung zusammen (für STARTTLS).

use std::io;
use std::pin::Pin;
use std::sync::{Arc, OnceLock};
use std::task::{Context, Poll};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::net::TcpStream;
use tokio_rustls::rustls::{self, pki_types::PrivateKeyDer};
use tokio_rustls::{server::TlsStream, TlsAcceptor};

static ACCEPTOR: OnceLock<Option<TlsAcceptor>> = OnceLock::new();

/// TLS-Annahme, falls Zertifikat konfiguriert
pub fn acceptor() -> Option<TlsAcceptor> {
    ACCEPTOR
        .get_or_init(|| {
            let cert = std::env::var("MAIL_TLS_CERT").ok()?;
            let key = std::env::var("MAIL_TLS_KEY").ok()?;
            match load(&cert, &key) {
                Ok(a) => Some(a),
                Err(e) => {
                    tracing::error!("Mail-TLS nicht geladen ({cert}): {e}");
                    None
                }
            }
        })
        .clone()
}

pub fn load(cert: &str, key: &str) -> Result<TlsAcceptor, Box<dyn std::error::Error>> {
    let certs =
        rustls_pemfile::certs(&mut io::BufReader::new(std::fs::File::open(cert)?)).collect::<Result<Vec<_>, _>>()?;
    let key: PrivateKeyDer<'static> =
        rustls_pemfile::private_key(&mut io::BufReader::new(std::fs::File::open(key)?))?.ok_or("kein Schlüssel")?;
    let cfg = rustls::ServerConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions()?
        .with_no_client_auth()
        .with_single_cert(certs, key)?;
    Ok(TlsAcceptor::from(Arc::new(cfg)))
}

pub enum Stream {
    Plain(TcpStream),
    Tls(Box<TlsStream<TcpStream>>),
}

impl Stream {
    pub fn is_tls(&self) -> bool {
        matches!(self, Stream::Tls(_))
    }
    /// STARTTLS: Klartext-Verbindung in TLS umwandeln
    pub async fn upgrade(self, acc: &TlsAcceptor) -> io::Result<Stream> {
        match self {
            Stream::Plain(s) => Ok(Stream::Tls(Box::new(acc.accept(s).await?))),
            t => Ok(t),
        }
    }
}

impl AsyncRead for Stream {
    fn poll_read(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &mut ReadBuf<'_>) -> Poll<io::Result<()>> {
        match self.get_mut() {
            Stream::Plain(s) => Pin::new(s).poll_read(cx, buf),
            Stream::Tls(s) => Pin::new(s.as_mut()).poll_read(cx, buf),
        }
    }
}

impl AsyncWrite for Stream {
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &[u8]) -> Poll<io::Result<usize>> {
        match self.get_mut() {
            Stream::Plain(s) => Pin::new(s).poll_write(cx, buf),
            Stream::Tls(s) => Pin::new(s.as_mut()).poll_write(cx, buf),
        }
    }
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        match self.get_mut() {
            Stream::Plain(s) => Pin::new(s).poll_flush(cx),
            Stream::Tls(s) => Pin::new(s.as_mut()).poll_flush(cx),
        }
    }
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        match self.get_mut() {
            Stream::Plain(s) => Pin::new(s).poll_shutdown(cx),
            Stream::Tls(s) => Pin::new(s.as_mut()).poll_shutdown(cx),
        }
    }
}

/// Klartext-Anmeldung nur über TLS – außer lokal/Entwicklung (MAIL_ALLOW_PLAIN_AUTH=1)
/// Für Tests: Klartext-Anmeldung erlauben
pub static ALLOW_PLAIN_AUTH: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub fn plain_auth_allowed() -> bool {
    ALLOW_PLAIN_AUTH.load(std::sync::atomic::Ordering::Relaxed)
        || std::env::var("MAIL_ALLOW_PLAIN_AUTH").is_ok_and(|v| v == "1")
}
