//! Abteilungen & Produktkatalog – eine Quelle für Webseite, Portal, Rechnungen, Lizenzen und Geräte.

use crate::invoice::Unit;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const LOCALES: [&str; 3] = ["de", "en", "ar"];

/// Text in allen drei Sprachen – keine Sprache darf fehlen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct I18n {
    pub de: String,
    pub en: String,
    pub ar: String,
}

impl I18n {
    pub fn get(&self, locale: &str) -> &str {
        match locale {
            "en" => &self.en,
            "ar" => &self.ar,
            _ => &self.de,
        }
    }

    pub fn validate(&self, field: &'static str) -> Result<(), CatalogError> {
        for (loc, v) in [("de", &self.de), ("en", &self.en), ("ar", &self.ar)] {
            if v.trim().is_empty() {
                return Err(CatalogError::MissingTranslation { field, locale: loc });
            }
        }
        Ok(())
    }
}

/// Module, die einer Abteilung im Portal zur Verfügung stehen.
pub const MODULES: &[&str] = &[
    "tasks",
    "time-tracking",
    "calendar",
    "employees",
    "reports",
    "projects",
    "dev-tasks",
    "git",
    "code-review",
    "tickets",
    "remote",
    "knowledge-base",
    "products",
    "orders",
    "customers",
    "invoices",
    "licenses",
    "devices",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProductKind {
    Software,
    Hardware,
    Service,
    /// Eigene Geräte mit Software (KI-Appliance, POS-Terminal, ESP32-Hardware)
    Appliance,
    /// Mietprodukte (z. B. KI-Server)
    Rental,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Billing {
    OneTime,
    Hourly,
    Monthly,
    Yearly,
    /// Preis auf Anfrage – Betrag wird in der Rechnung manuell gesetzt
    OnRequest,
}

impl Billing {
    /// Abrechnungseinheit auf der Rechnung
    pub fn unit(self) -> Unit {
        match self {
            Billing::Hourly => Unit::Hour,
            Billing::Monthly => Unit::Month,
            Billing::OneTime | Billing::Yearly | Billing::OnRequest => Unit::Flat,
        }
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CatalogError {
    #[error("{field}: Übersetzung '{locale}' fehlt")]
    MissingTranslation { field: &'static str, locale: &'static str },
    #[error("unbekanntes Modul: {0}")]
    UnknownModule(String),
    #[error("Preis '{0}': Betrag fehlt (nur bei 'on_request' erlaubt)")]
    MissingAmount(String),
    #[error("Preis '{0}': bei 'on_request' darf kein Betrag gesetzt sein")]
    UnexpectedAmount(String),
    #[error("Preis '{0}': Betrag darf nicht negativ sein")]
    NegativeAmount(String),
    #[error("Code '{0}' ist ungültig (a–z, 0–9, '-')")]
    InvalidCode(String),
}

pub fn validate_modules(modules: &[String]) -> Result<(), CatalogError> {
    match modules.iter().find(|m| !MODULES.contains(&m.as_str())) {
        Some(m) => Err(CatalogError::UnknownModule(m.clone())),
        None => Ok(()),
    }
}

pub fn validate_code(code: &str) -> Result<(), CatalogError> {
    let ok = !code.is_empty()
        && code.len() <= 64
        && code.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && !code.starts_with('-')
        && !code.ends_with('-');
    if ok {
        Ok(())
    } else {
        Err(CatalogError::InvalidCode(code.into()))
    }
}

pub fn validate_price(code: &str, billing: Billing, amount_cents: Option<i64>) -> Result<(), CatalogError> {
    match (billing, amount_cents) {
        (Billing::OnRequest, Some(_)) => Err(CatalogError::UnexpectedAmount(code.into())),
        (Billing::OnRequest, None) => Ok(()),
        (_, None) => Err(CatalogError::MissingAmount(code.into())),
        (_, Some(a)) if a < 0 => Err(CatalogError::NegativeAmount(code.into())),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(de: &str, en: &str, ar: &str) -> I18n {
        I18n { de: de.into(), en: en.into(), ar: ar.into() }
    }

    #[test]
    fn i18n_requires_all_languages() {
        assert!(t("Kasse", "POS", "نقطة البيع").validate("name").is_ok());
        assert_eq!(
            t("Kasse", "POS", " ").validate("name"),
            Err(CatalogError::MissingTranslation { field: "name", locale: "ar" })
        );
        assert_eq!(t("a", "b", "ج").get("ar"), "ج");
        assert_eq!(t("a", "b", "ج").get("fr"), "a");
    }

    #[test]
    fn modules_and_codes() {
        assert!(validate_modules(&["tickets".into(), "invoices".into()]).is_ok());
        assert_eq!(validate_modules(&["vertrieb".into()]), Err(CatalogError::UnknownModule("vertrieb".into())));
        assert!(validate_code("pos-code-craft-v3").is_ok());
        assert!(validate_code("POS").is_err());
        assert!(validate_code("-x").is_err());
    }

    #[test]
    fn prices() {
        assert!(validate_price("pilot", Billing::Monthly, Some(49_900)).is_ok());
        assert!(validate_price("enterprise", Billing::OnRequest, None).is_ok());
        assert!(validate_price("free", Billing::OneTime, Some(0)).is_ok());
        assert_eq!(validate_price("x", Billing::Hourly, None), Err(CatalogError::MissingAmount("x".into())));
        assert_eq!(validate_price("x", Billing::OnRequest, Some(1)), Err(CatalogError::UnexpectedAmount("x".into())));
        assert_eq!(Billing::Hourly.unit(), Unit::Hour);
        assert_eq!(Billing::Monthly.unit(), Unit::Month);
    }
}
