use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use codecraft_domain::invoice::InvoiceError;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("nicht authentifiziert")]
    Unauthorized,
    #[error("keine Berechtigung")]
    Forbidden,
    #[error("nicht gefunden")]
    NotFound,
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Conflict(String),
    #[error("zu viele Versuche – bitte später erneut")]
    TooManyRequests,
    #[error("Bitte zuerst ein eigenes Passwort festlegen")]
    PasswordChangeRequired,
    #[error("Für dieses Kundengerät ist ein Zugriffscode des Kunden nötig")]
    AccessCodeRequired,
    #[error(transparent)]
    Invoice(#[from] InvoiceError),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

pub type ApiResult<T> = Result<T, ApiError>;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            ApiError::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            ApiError::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            ApiError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            ApiError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            ApiError::TooManyRequests => (StatusCode::TOO_MANY_REQUESTS, "too_many_requests"),
            ApiError::PasswordChangeRequired => (StatusCode::FORBIDDEN, "password_change_required"),
            ApiError::AccessCodeRequired => (StatusCode::FORBIDDEN, "access_code_required"),
            ApiError::Invoice(InvoiceError::Locked | InvoiceError::InvalidTransition { .. }) => {
                (StatusCode::CONFLICT, "invoice_state")
            }
            ApiError::Invoice(_) => (StatusCode::UNPROCESSABLE_ENTITY, "invoice_invalid"),
            ApiError::Db(sqlx::Error::RowNotFound) => (StatusCode::NOT_FOUND, "not_found"),
            ApiError::Db(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23505") => {
                (StatusCode::CONFLICT, "duplicate")
            }
            ApiError::Db(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23503") => {
                (StatusCode::UNPROCESSABLE_ENTITY, "reference_missing")
            }
            ApiError::Db(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23514") => {
                (StatusCode::CONFLICT, "constraint")
            }
            ApiError::Db(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        };
        let message = if status == StatusCode::INTERNAL_SERVER_ERROR {
            tracing::error!(error = %self, "interner Fehler");
            "interner Fehler".to_string()
        } else {
            self.to_string()
        };
        (status, Json(json!({ "error": code, "message": message }))).into_response()
    }
}
