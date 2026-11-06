# Architektur

## Ziele
1. **Eine Quelle der Wahrheit:** ein API-Server, eine Datenbank. Webseite, Portal, Apps und Geräte sprechen nur mit der API, nie direkt mit der DB.
2. **Rechtssichere Belege:** lückenlose Nummern, Festschreibung nach Ausstellung (auch auf DB-Ebene), Storno nur per Gutschrift, Audit-Log append-only.
3. **Keine Duplikate:** ein Produktkatalog, ein Lizenzsystem, eine Zeiterfassung, ein Portal mit Rollen.
4. **Ressourcenschonend:** Server ist eine Rust-Binärdatei (gemessen: 13 MB RAM) statt 3 Node-Prozessen mit je 0,5–1 GB Limit.
5. **Dreisprachig ab Tag 1:** DE/EN/AR (RTL) in Webseite, Portal, Belegen und E-Mails.

## Bausteine

```
   code-craft.tech (Astro, statisch)      Portal (React, Rollen)      Tauri-App
                 │                                 │                       │
                 └─────────────── HTTPS /api/v1 ───┴───────────────────────┘
                                         │
                            codecraft-server (Rust/Axum)
                            ├─ domain   (reine Fachlogik)
                            └─ PostgreSQL (Migrationen, Trigger)
                                         │
                ┌──────── POST /api/v1/devices/report (protocol v1) ────────┐
           codecraft-agent        ESP32-Firmware        KI-Appliance        POS
```

| Crate | Aufgabe | Regeln |
|---|---|---|
| `domain` | Geld (Cent), Steuern, Rechnungen, Nummernformat, Rechte | kein I/O, vollständig unit-getestet |
| `protocol` | Nachrichten Gerät ↔ Plattform | `no_std`, versioniert, in v1 nur additive Änderungen |
| `server` | HTTP-API, Auth, Persistenz | Regeln kommen aus `domain`; jede Mutation in einer Transaktion mit Audit-Eintrag |
| `agent` | Status/Metriken, Lizenz, Updates, Befehle | ein Binary für PC, KI-Appliance, POS (`CC_DEVICE_KIND`) |
| `firmware/esp32` | dasselbe für eigene Hardware | eigenes Target, nutzt `protocol` |

## Fachmodule (neu) und was sie ersetzen

| Modul | Inhalt | Ersetzt im Altsystem |
|---|---|---|
| **Organisationen & Benutzer** ✅ | Kunden = Organisationen, Benutzer mit Rolle (`customer` … `admin`) | `Customer`, `User`, getrennte Kunden-/Mitarbeiter-Auth |
| **Abrechnung** ✅ | Rechnungen, Zahlungen, Gutschriften; Angebote und E-Rechnung folgen in M2 | `Invoice` aus 3 Action-Dateien, 2 Nummerngeneratoren, `CostProposal*` |
| **Katalog** | *ein* Produktmodell (Software, Hardware, Dienstleistung) mit Übersetzungen, Preisen, Specs | `SoftwareProduct*` **und** `Product*` |
| **Lizenzen** | Lizenz = Produkt + Organisation + Laufzeit + Features; Aktivierung pro Gerät | `SoftwareLicense*` **und** `License*`/`LicenseValidation` |
| **Projekte** | Projekte, Anfragen, Aufgaben, Git/GitHub, Builds, Doku | `Project*`, `DevTask*`, `ProjectRequest*` |
| **Zeit** | *eine* Zeiterfassung mit Bezug auf Projekt, Ticket oder Vertrag; abrechenbar → Rechnungsposition | `TimeEntry` **und** `SupportTimeEntry` |
| **Support** | Tickets, Chat, Verträge mit Stundenkontingent, Fernwartung | `Ticket*`, `SupportChat*`, `SupportContract*`, `RemoteSession` |
| **Geräte** ✅ | Registrierung, Reports, Lizenzstatus; OTA und Befehle in M3 | `ManagedDevice`, Agent-API `v1/agent/*` |
| **Organisation intern** | Abteilungen, Mitarbeiter, Kalender, E-Learning, Stellen | gleichnamige Module |
| **Kommunikation** | Matrix (Chat), LiveKit (Video), Mailcow bleiben externe Dienste – die API vermittelt nur Tokens | bestehende Integrationen |

## Abrechnung im Detail
- Beträge `i64` Cent, Mengen in Tausendstel; Position kaufmännisch gerundet, USt je Steuersatz auf die Nettosumme.
- Steuermodi: `standard`, `reverse_charge` (USt-IdNr. Pflicht), `not_taxable`; Pflichthinweis in DE/EN/AR.
- Status: `draft → issued → paid`, `issued|paid → cancelled` (nur über Gutschrift `GS-…`).
- Nummern `RE-JJJJ-NNNNN` aus `number_sequences` in **derselben Transaktion** wie die Ausstellung → keine Lücken, keine Doppelten (getestet mit 10 parallelen Ausstellungen).
- Trigger `invoices_guard` / `invoice_items_guard` verhindern Änderungen an festgeschriebenen Belegen auch bei direktem SQL.
- Empfängeradresse und Summen werden beim Ausstellen eingefroren.

## Sicherheit
- Tokens: 256 Bit Zufall, nur SHA-256 in der DB, Präfix `cc_u_` (Benutzer) / `cc_d_` (Gerät).
- Rechtematrix zentral in `domain::access`; Kunden sehen nur Daten der eigenen Organisation und keine Entwürfe.
- Body-Limit 1 MB, Fehlermeldungen ohne interne Details.
- Geplant (M2): Login mit Passwort (Argon2id) + TOTP, kurzlebige Sessions, Rate-Limit.

## Meilensteine
1. **Fundament** ✅ – Workspace, Abrechnung, Geräte-Reports, 22 Tests, CI
2. **Portal & Webseite** – Login/2FA, Organisationen/Benutzer-UI, Rechnungen-UI + PDF + XRechnung/ZUGFeRD, Angebote, Astro-Webseite mit Katalog/Jobs/Kontakt/Termin
3. **Katalog, Lizenzen, Geräte-OTA** – Firmware-Releases, signierte Updates, Lizenzaktivierung für KI-Appliance & POS, ESP32-Provisionierung
4. **Projekte, Zeit, Support** – Migration der Dev- und Support-Daten
5. **Interne Module & Abschaltung Altsystem**
