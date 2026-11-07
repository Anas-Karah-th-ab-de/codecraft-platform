//! Belegnummern: lückenlos pro Serie und Jahr (GoBD).
//!
//! Die Vergabe selbst passiert in der Datenbank unter Zeilensperre
//! (`number_sequences ... FOR UPDATE`); hier nur Format und Parsing.

/// Belegserien. Jede Serie hat einen eigenen, lückenlosen Zähler.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Series {
    /// Rechnung
    Invoice,
    /// Gutschrift / Stornorechnung
    CreditNote,
    /// Kostenvoranschlag / Angebot
    Proposal,
}

impl Series {
    pub fn prefix(self) -> &'static str {
        match self {
            Series::Invoice => "CC", // Fortsetzung der Reihe aus dem Altsystem
            Series::CreditNote => "GS",
            Series::Proposal => "KV",
        }
    }

    pub fn key(self) -> &'static str {
        match self {
            Series::Invoice => "invoice",
            Series::CreditNote => "credit_note",
            Series::Proposal => "proposal",
        }
    }
}

/// `CC-2026-00042`
pub fn format_number(series: Series, year: i32, seq: i64) -> String {
    format!("{}-{year}-{seq:05}", series.prefix())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats() {
        assert_eq!(format_number(Series::Invoice, 2026, 42), "CC-2026-00042");
        assert_eq!(format_number(Series::CreditNote, 2026, 1), "GS-2026-00001");
        assert_eq!(format_number(Series::Proposal, 2027, 123456), "KV-2027-123456");
    }
}
