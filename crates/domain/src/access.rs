//! Rollen & Berechtigungen – ein Portal für Mitarbeiter und Kunden.

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
}

/// Zentrale Rechtematrix. `own_org` = Datensatz gehört zur Organisation des Kunden.
pub fn allowed(role: Role, perm: Permission, own_org: bool) -> bool {
    use Permission::*;
    use Role::*;
    match (role, perm) {
        (Admin, _) => perm != DeviceReport,
        (Device, DeviceReport) => true,
        (Device, _) => false,
        (Customer, InvoiceRead | CustomerRead) => own_org,
        (Customer, _) => false,
        (Lead, CatalogWrite) => true,
        (
            Lead | Manager,
            InvoiceRead | InvoiceWrite | InvoiceIssue | CustomerRead | CustomerWrite | DeviceManage | CatalogRead,
        ) => true,
        (Staff, InvoiceRead | CustomerRead | InvoiceWrite | CatalogRead) => true,
        (Trainee, CustomerRead | CatalogRead) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Permission::*;

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
    }
}
