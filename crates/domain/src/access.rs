//! Rollen & Berechtigungen – ein Portal für Mitarbeiter und Kunden.
//!
//! Zwei Stufen: Die **Rolle** legt fest, *was* jemand grundsätzlich darf (lesen, schreiben,
//! ausstellen …). Die **Abteilung** legt fest, *in welchem Bereich*: Finanzen sehen nur
//! Buchhaltung, Vertrieb und Management, Fernwartung nur Support/Entwicklung usw.
//! Admins dürfen alles, Kunden nur Daten ihrer eigenen Firma.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    /// Kunde – sieht nur Daten der eigenen Organisation
    Customer,
    Trainee,
    Staff,
    Manager,
    Lead,
    Admin,
    /// Maschinenkonto eines Geräts (Agent, ESP32, KI-Appliance, POS)
    Device,
}

impl Role {
    pub fn parse(s: &str) -> Option<Role> {
        Some(match s {
            "customer" => Role::Customer,
            "trainee" => Role::Trainee,
            "staff" => Role::Staff,
            "manager" => Role::Manager,
            "lead" => Role::Lead,
            "admin" => Role::Admin,
            "device" => Role::Device,
            _ => return None,
        })
    }

    pub fn is_employee(self) -> bool {
        matches!(self, Role::Trainee | Role::Staff | Role::Manager | Role::Lead | Role::Admin)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    /// Rechnungen, Angebote, Verträge, Bestellungen lesen
    InvoiceRead,
    InvoiceWrite,
    InvoiceIssue,
    CustomerRead,
    CustomerWrite,
    DeviceReport,
    DeviceManage,
    /// Abteilungen & Produktkatalog lesen (intern, inkl. nicht öffentlicher Produkte)
    CatalogRead,
    /// Produkte, Preise, Abteilungen pflegen
    CatalogWrite,
    /// Stellenanzeigen & Bewerbungen, Kontaktanfragen
    JobsManage,
    /// Benutzer, Zahlungsarten, Postfächer verwalten
    UserManage,
    /// Projekte & Entwicklungsanfragen lesen
    ProjectRead,
    /// Projekte, Meilensteine, Anfragen bearbeiten
    ProjectWrite,
    /// Support-Tickets aller Kunden bearbeiten
    TicketWork,
}

/// Rollen-Matrix. `own_org` = Datensatz gehört zur Organisation des Kunden.
pub fn allowed(role: Role, perm: Permission, own_org: bool) -> bool {
    use Permission::*;
    use Role::*;
    match (role, perm) {
        (Admin, _) => perm != DeviceReport,
        (Device, DeviceReport) => true,
        (Device, _) => false,
        (Customer, InvoiceRead | CustomerRead | ProjectRead) => own_org,
        (Customer, _) => false,
        (Lead, CatalogWrite) => true,
        (Lead | Manager, JobsManage) => true,
        (
            Lead | Manager,
            InvoiceRead | InvoiceWrite | InvoiceIssue | CustomerRead | CustomerWrite | DeviceManage | CatalogRead
            | ProjectRead | ProjectWrite | TicketWork,
        ) => true,
        (Staff, InvoiceRead | CustomerRead | InvoiceWrite | CatalogRead | ProjectRead | ProjectWrite | TicketWork) => {
            true
        }
        (Trainee, CustomerRead | CatalogRead | ProjectRead | TicketWork) => true,
        _ => false,
    }
}

/// Abteilungen, in denen ein Recht gilt (für Mitarbeiter außer Admins).
/// ACC Buchhaltung · SAL Vertrieb · SUP Support · DEV Entwicklung · MGT Management
pub fn departments_for(perm: Permission) -> &'static [&'static str] {
    use Permission::*;
    match perm {
        InvoiceRead | InvoiceWrite | InvoiceIssue => &["ACC", "SAL", "MGT"],
        CustomerRead => &["ACC", "SAL", "SUP", "DEV", "MGT"],
        CustomerWrite => &["ACC", "SAL", "MGT"],
        DeviceManage => &["SUP", "DEV", "MGT"],
        CatalogRead => &["ACC", "SAL", "SUP", "DEV", "MGT"],
        CatalogWrite => &["SAL", "MGT"],
        JobsManage => &["MGT"],
        ProjectRead => &["DEV", "SAL", "ACC", "MGT"],
        ProjectWrite => &["DEV", "SAL", "MGT"],
        TicketWork => &["SUP", "DEV", "MGT"],
        UserManage | DeviceReport => &[],
    }
}

/// Rolle *und* Abteilung prüfen
pub fn allowed_in(role: Role, departments: &[String], perm: Permission, own_org: bool) -> bool {
    if !allowed(role, perm, own_org) {
        return false;
    }
    match role {
        Role::Admin | Role::Customer | Role::Device => true,
        _ => departments_for(perm).iter().any(|d| departments.iter().any(|x| x == d)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Permission::*;

    fn d(x: &[&str]) -> Vec<String> {
        x.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn matrix() {
        assert!(allowed(Role::Admin, InvoiceIssue, false));
        assert!(allowed(Role::Manager, InvoiceIssue, false));
        assert!(!allowed(Role::Staff, InvoiceIssue, false));
        assert!(allowed(Role::Customer, InvoiceRead, true));
        assert!(!allowed(Role::Customer, InvoiceRead, false));
        assert!(!allowed(Role::Customer, InvoiceWrite, true));
        assert!(allowed(Role::Device, DeviceReport, false));
        assert!(!allowed(Role::Device, InvoiceRead, false));
        assert!(!allowed(Role::Admin, DeviceReport, false));
        assert!(allowed(Role::Lead, CatalogWrite, false));
        assert!(!allowed(Role::Manager, CatalogWrite, false));
        assert!(allowed(Role::Staff, CatalogRead, false));
        assert!(!allowed(Role::Customer, CatalogRead, true));
        assert!(!allowed(Role::Staff, DeviceManage, false));
    }

    #[test]
    fn departments_separate_areas() {
        // Entwickler sieht keine Rechnungen, Buchhaltung keine Fernwartung
        assert!(!allowed_in(Role::Staff, &d(&["DEV"]), InvoiceRead, false));
        assert!(allowed_in(Role::Staff, &d(&["ACC"]), InvoiceRead, false));
        assert!(!allowed_in(Role::Lead, &d(&["ACC"]), DeviceManage, false));
        assert!(allowed_in(Role::Lead, &d(&["SUP"]), DeviceManage, false));
        assert!(allowed_in(Role::Staff, &d(&["SUP"]), TicketWork, false));
        assert!(!allowed_in(Role::Staff, &d(&["ACC"]), TicketWork, false));
        // ohne Abteilung nichts, Admin alles
        assert!(!allowed_in(Role::Manager, &[], CustomerRead, false));
        assert!(allowed_in(Role::Admin, &[], InvoiceIssue, false));
        // Kunden: nur eigene Firma
        assert!(allowed_in(Role::Customer, &[], ProjectRead, true));
        assert!(!allowed_in(Role::Customer, &[], ProjectRead, false));
        // Rolle bleibt Grenze: Praktikant schreibt keine Rechnung, auch in ACC
        assert!(!allowed_in(Role::Trainee, &d(&["ACC"]), InvoiceWrite, false));
    }
}
