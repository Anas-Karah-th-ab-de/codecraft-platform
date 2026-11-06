//! Rechnungen: Berechnung, Validierung und Statusübergänge.
//!
//! Regeln (GoBD / UStG):
//! - Beträge in Cent, Mengen in Tausendstel (3 Nachkommastellen).
//! - Nettobetrag je Position wird kaufmännisch gerundet.
//! - USt. wird je Steuersatz auf die Summe der Nettobeträge berechnet.
//! - Nach Ausstellung (`Issued`) ist eine Rechnung unveränderlich.
//!   Korrekturen erfolgen ausschließlich über eine Gutschrift (Storno).

use crate::money::{div_round, Cents};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

/// Steuersatz in Basispunkten: 1900 = 19 %, 700 = 7 %, 0 = steuerfrei.
pub type RateBp = u32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaxMode {
    /// Normale Umsatzsteuer je Position
    Standard,
    /// Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG / Art. 196 MwStSystRL)
    ReverseCharge,
    /// Nicht steuerbar (z. B. Leistung an Drittland, Kleinunternehmer)
    NotTaxable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Unit {
    Hour,
    Piece,
    Day,
    Month,
    Flat,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineItem {
    pub description: String,
    /// Menge × 1000 (1,5 h = 1500)
    pub quantity_milli: i64,
    pub unit: Unit,
    pub unit_price: Cents,
    pub vat_rate_bp: RateBp,
}

impl LineItem {
    pub fn net(&self) -> Cents {
        Cents(div_round(self.quantity_milli as i128 * self.unit_price.0 as i128, 1000) as i64)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaxGroup {
    pub rate_bp: RateBp,
    pub net: Cents,
    pub tax: Cents,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Totals {
    pub net: Cents,
    pub tax: Cents,
    pub gross: Cents,
    pub groups: Vec<TaxGroup>,
}

/// Effektiver Steuersatz einer Position unter dem Steuermodus.
pub fn effective_rate(mode: TaxMode, item_rate: RateBp) -> RateBp {
    match mode {
        TaxMode::Standard => item_rate,
        TaxMode::ReverseCharge | TaxMode::NotTaxable => 0,
    }
}

pub fn compute_totals(items: &[LineItem], mode: TaxMode) -> Totals {
    let mut by_rate: BTreeMap<RateBp, i64> = BTreeMap::new();
    for it in items {
        *by_rate.entry(effective_rate(mode, it.vat_rate_bp)).or_default() += it.net().0;
    }
    let groups: Vec<TaxGroup> = by_rate
        .into_iter()
        .map(|(rate_bp, net)| TaxGroup {
            rate_bp,
            net: Cents(net),
            tax: Cents(div_round(net as i128 * rate_bp as i128, 10_000) as i64),
        })
        .collect();
    let net: Cents = groups.iter().map(|g| g.net).sum();
    let tax: Cents = groups.iter().map(|g| g.tax).sum();
    Totals { net, tax, gross: net + tax, groups }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    Draft,
    Issued,
    Paid,
    Cancelled,
}

impl InvoiceStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            InvoiceStatus::Draft => "draft",
            InvoiceStatus::Issued => "issued",
            InvoiceStatus::Paid => "paid",
            InvoiceStatus::Cancelled => "cancelled",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "draft" => InvoiceStatus::Draft,
            "issued" => InvoiceStatus::Issued,
            "paid" => InvoiceStatus::Paid,
            "cancelled" => InvoiceStatus::Cancelled,
            _ => return None,
        })
    }

    /// Erlaubte Übergänge. Entwürfe werden gelöscht, nicht storniert.
    pub fn can_transition(self, to: InvoiceStatus) -> bool {
        use InvoiceStatus::*;
        matches!((self, to), (Draft, Issued) | (Issued, Paid) | (Issued, Cancelled) | (Paid, Cancelled))
    }

    pub fn is_editable(self) -> bool {
        self == InvoiceStatus::Draft
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum InvoiceError {
    #[error("Rechnung hat keine Positionen")]
    NoItems,
    #[error("Position {0}: Beschreibung fehlt")]
    EmptyDescription(usize),
    #[error("Position {0}: Menge muss größer als 0 sein")]
    InvalidQuantity(usize),
    #[error("Position {0}: Steuersatz {1} bp ist ungültig")]
    InvalidRate(usize, RateBp),
    #[error("Reverse Charge erfordert die USt-IdNr. des Kunden")]
    ReverseChargeNeedsVatId,
    #[error("Kundenadresse fehlt")]
    MissingAddress,
    #[error("Statuswechsel {from:?} → {to:?} ist nicht erlaubt")]
    InvalidTransition { from: InvoiceStatus, to: InvoiceStatus },
    #[error("Rechnung ist festgeschrieben und kann nicht geändert werden")]
    Locked,
}

/// Empfängerdaten, die zum Zeitpunkt der Ausstellung eingefroren werden.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BillingParty {
    pub name: String,
    pub address: String,
    pub vat_id: Option<String>,
}

/// Prüft, ob ein Entwurf ausgestellt werden darf.
pub fn validate_for_issue(items: &[LineItem], mode: TaxMode, recipient: &BillingParty) -> Result<(), InvoiceError> {
    if items.is_empty() {
        return Err(InvoiceError::NoItems);
    }
    if recipient.name.trim().is_empty() || recipient.address.trim().is_empty() {
        return Err(InvoiceError::MissingAddress);
    }
    if mode == TaxMode::ReverseCharge && recipient.vat_id.as_deref().is_none_or(|v| v.trim().is_empty()) {
        return Err(InvoiceError::ReverseChargeNeedsVatId);
    }
    for (i, it) in items.iter().enumerate() {
        let n = i + 1;
        if it.description.trim().is_empty() {
            return Err(InvoiceError::EmptyDescription(n));
        }
        if it.quantity_milli <= 0 {
            return Err(InvoiceError::InvalidQuantity(n));
        }
        if it.vat_rate_bp > 10_000 {
            return Err(InvoiceError::InvalidRate(n, it.vat_rate_bp));
        }
    }
    Ok(())
}

/// Positionen einer Gutschrift zur vollständigen Stornierung einer Rechnung.
pub fn credit_note_items(original: &[LineItem]) -> Vec<LineItem> {
    original.iter().map(|it| LineItem { unit_price: -it.unit_price, ..it.clone() }).collect()
}

/// Pflichthinweis auf der Rechnung je Steuermodus (DE/EN/AR).
pub fn tax_notice(mode: TaxMode, locale: &str) -> Option<&'static str> {
    match (mode, locale) {
        (TaxMode::Standard, _) => None,
        (TaxMode::ReverseCharge, "en") => {
            Some("Reverse charge: VAT liability of the recipient (Art. 196 VAT Directive).")
        }
        (TaxMode::ReverseCharge, "ar") => {
            Some("الاحتساب العكسي: ضريبة القيمة المضافة مستحقة على المستلم (المادة 196 من توجيه ضريبة القيمة المضافة).")
        }
        (TaxMode::ReverseCharge, _) => {
            Some("Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 MwStSystRL).")
        }
        (TaxMode::NotTaxable, "en") => Some("Not taxable in Germany."),
        (TaxMode::NotTaxable, "ar") => Some("غير خاضع للضريبة في ألمانيا."),
        (TaxMode::NotTaxable, _) => Some("Nicht im Inland steuerbare Leistung."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(desc: &str, qty_milli: i64, price: i64, rate: RateBp) -> LineItem {
        LineItem {
            description: desc.into(),
            quantity_milli: qty_milli,
            unit: Unit::Hour,
            unit_price: Cents(price),
            vat_rate_bp: rate,
        }
    }

    fn party(vat: Option<&str>) -> BillingParty {
        BillingParty { name: "Firma GmbH".into(), address: "Str. 1, 10115 Berlin".into(), vat_id: vat.map(Into::into) }
    }

    #[test]
    fn line_net_rounds_commercially() {
        // 1,333 h × 33,33 € = 44,42889 € → 44,43 €
        assert_eq!(item("x", 1333, 3333, 1900).net(), Cents(4443));
        // 0,5 × 0,01 € = 0,005 → 0,01
        assert_eq!(item("x", 500, 1, 1900).net(), Cents(1));
    }

    #[test]
    fn totals_grouped_by_rate() {
        let items = [
            item("Entwicklung", 10_000, 8_500, 1900),
            item("Buch", 1_000, 2_000, 700),
            item("Mehr Entwicklung", 2_500, 8_500, 1900),
        ];
        let t = compute_totals(&items, TaxMode::Standard);
        assert_eq!(t.net, Cents(108_250));
        assert_eq!(t.groups.len(), 2);
        assert_eq!(t.groups[0], TaxGroup { rate_bp: 700, net: Cents(2_000), tax: Cents(140) });
        assert_eq!(t.groups[1], TaxGroup { rate_bp: 1900, net: Cents(106_250), tax: Cents(20_188) });
        assert_eq!(t.tax, Cents(20_328));
        assert_eq!(t.gross, Cents(128_578));
    }

    #[test]
    fn reverse_charge_has_no_tax() {
        let t = compute_totals(&[item("Dev", 1_000, 10_000, 1900)], TaxMode::ReverseCharge);
        assert_eq!(t.tax, Cents::ZERO);
        assert_eq!(t.gross, Cents(10_000));
        assert_eq!(t.groups[0].rate_bp, 0);
    }

    #[test]
    fn validation() {
        let ok = [item("Dev", 1_000, 100, 1900)];
        assert_eq!(validate_for_issue(&[], TaxMode::Standard, &party(None)), Err(InvoiceError::NoItems));
        assert_eq!(validate_for_issue(&ok, TaxMode::Standard, &party(None)), Ok(()));
        assert_eq!(
            validate_for_issue(&ok, TaxMode::ReverseCharge, &party(None)),
            Err(InvoiceError::ReverseChargeNeedsVatId)
        );
        assert_eq!(validate_for_issue(&ok, TaxMode::ReverseCharge, &party(Some("ATU12345678"))), Ok(()));
        assert_eq!(
            validate_for_issue(&[item(" ", 1_000, 1, 1900)], TaxMode::Standard, &party(None)),
            Err(InvoiceError::EmptyDescription(1))
        );
        assert_eq!(
            validate_for_issue(&[item("a", 0, 1, 1900)], TaxMode::Standard, &party(None)),
            Err(InvoiceError::InvalidQuantity(1))
        );
    }

    #[test]
    fn status_transitions() {
        use InvoiceStatus::*;
        assert!(Draft.can_transition(Issued));
        assert!(Issued.can_transition(Paid));
        assert!(Issued.can_transition(Cancelled));
        assert!(!Issued.can_transition(Draft));
        assert!(!Draft.can_transition(Cancelled));
        assert!(!Cancelled.can_transition(Paid));
        assert!(Draft.is_editable() && !Issued.is_editable());
    }

    #[test]
    fn credit_note_negates() {
        let items = [item("Dev", 2_000, 5_000, 1900)];
        let cn = credit_note_items(&items);
        let t = compute_totals(&cn, TaxMode::Standard);
        assert_eq!(t.net, Cents(-10_000));
        assert_eq!(t.tax, Cents(-1_900));
        assert_eq!(t.gross, Cents(-11_900));
    }
}
