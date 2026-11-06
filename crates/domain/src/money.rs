//! Geldbeträge als ganze Cent (i64) – niemals Fließkomma.

use serde::{Deserialize, Serialize};
use std::fmt;

/// ISO-4217-Währungscode (z. B. "EUR", "USD", "SYP").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct Currency([u8; 3]);

impl Currency {
    pub const EUR: Currency = Currency(*b"EUR");
    pub const USD: Currency = Currency(*b"USD");

    pub fn as_str(&self) -> &str {
        // Konstruktor erlaubt nur ASCII-Großbuchstaben
        std::str::from_utf8(&self.0).unwrap_or("???")
    }
}

impl TryFrom<String> for Currency {
    type Error = String;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        s.as_str().parse()
    }
}

impl std::str::FromStr for Currency {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let b = s.as_bytes();
        if b.len() == 3 && b.iter().all(u8::is_ascii_uppercase) {
            Ok(Currency([b[0], b[1], b[2]]))
        } else {
            Err(format!("ungültiger Währungscode: {s}"))
        }
    }
}

impl From<Currency> for String {
    fn from(c: Currency) -> Self {
        c.as_str().to_owned()
    }
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Betrag in der kleinsten Einheit (Cent).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Cents(pub i64);

impl Cents {
    pub const ZERO: Cents = Cents(0);

    pub fn checked_add(self, o: Cents) -> Option<Cents> {
        self.0.checked_add(o.0).map(Cents)
    }
}

impl std::ops::Add for Cents {
    type Output = Cents;
    fn add(self, o: Cents) -> Cents {
        Cents(self.0 + o.0)
    }
}

impl std::ops::Neg for Cents {
    type Output = Cents;
    fn neg(self) -> Cents {
        Cents(-self.0)
    }
}

impl std::iter::Sum for Cents {
    fn sum<I: Iterator<Item = Cents>>(iter: I) -> Cents {
        Cents(iter.map(|c| c.0).sum())
    }
}

impl fmt::Display for Cents {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let sign = if self.0 < 0 { "-" } else { "" };
        let a = self.0.unsigned_abs();
        write!(f, "{sign}{}.{:02}", a / 100, a % 100)
    }
}

/// Kaufmännische Rundung (half away from zero) von `num / den`.
pub fn div_round(num: i128, den: i128) -> i128 {
    debug_assert!(den > 0);
    let q = num / den;
    let r = num % den;
    if r.abs() * 2 >= den {
        q + num.signum()
    } else {
        q
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounding_half_away_from_zero() {
        assert_eq!(div_round(5, 10), 1);
        assert_eq!(div_round(4, 10), 0);
        assert_eq!(div_round(-5, 10), -1);
        assert_eq!(div_round(-4, 10), 0);
        assert_eq!(div_round(15, 10), 2);
    }

    #[test]
    fn display() {
        assert_eq!(Cents(123456).to_string(), "1234.56");
        assert_eq!(Cents(-5).to_string(), "-0.05");
    }

    #[test]
    fn currency_parse() {
        assert_eq!("EUR".parse::<Currency>().unwrap(), Currency::EUR);
        assert!("eur".parse::<Currency>().is_err());
        assert!("EURO".parse::<Currency>().is_err());
    }
}
