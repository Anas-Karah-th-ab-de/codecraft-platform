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
| **Katalog** ✅ | *ein* Produktmodell (Software, Hardware, Dienstleistung) mit Übersetzungen, Preisen, Specs | `SoftwareProduct*` **und** `Product*` |
| **Lizenzen** | Lizenz = Produkt + Organisation + Laufzeit + Features; Aktivierung pro Gerät | `SoftwareLicense*` **und** `License*`/`LicenseValidation` |
| **Projekte** | Projekte, Anfragen, Aufgaben, Git/GitHub, Builds, Doku | `Project*`, `DevTask*`, `ProjectRequest*` |
| **Zeit** | *eine* Zeiterfassung mit Bezug auf Projekt, Ticket oder Vertrag; abrechenbar → Rechnungsposition | `TimeEntry` **und** `SupportTimeEntry` |
| **Support** | Tickets, Chat, Verträge mit Stundenkontingent, Fernwartung | `Ticket*`, `SupportChat*`, `SupportContract*`, `RemoteSession` |
| **Geräte** ✅ | Registrierung, Reports, Lizenzstatus; OTA und Befehle in M3 | `ManagedDevice`, Agent-API `v1/agent/*` |
| **Organisation intern** | Abteilungen, Mitarbeiter, Kalender, E-Learning, Stellen | gleichnamige Module |
| **Kommunikation** | Matrix (Chat), LiveKit (Video), Mailcow bleiben externe Dienste – die API vermittelt nur Tokens | bestehende Integrationen |

## Abteilungen & Katalog (eine Quelle)
Im Altsystem standen Preise an drei Stellen, die nicht übereinstimmten: im Webseiten-Text (KI-Server, Pakete,
Stundensätze), in `SoftwareProduct` (POS) und in `Product` (Hardware). Jetzt gilt:

- **Abteilungen** (`DEV`, `SUP`, `MGT`, `SAL`, `ACC`) mit Portal-Modulen; Namen/Beschreibung in DE/EN/AR sind Pflicht (DB-Check `i18n_ok`).
- **Jedes Produkt gehört genau einer verantwortlichen Abteilung**; Preise (netto, Cent) mit Abrechnungsart
  `one_time | hourly | monthly | yearly | on_request`, Leistungsmerkmale je Sprache mit gleicher Anzahl.
- **Webseite** liest nur `GET /api/v1/public/catalog?locale=…` – keine Preise mehr im Webseiten-Text.
- **Rechnungsposition mit `price_id`** übernimmt Bezeichnung (in Rechnungssprache), Einheit und Preis aus dem Katalog;
  ein abweichender Preis wird abgelehnt. Per FK muss der Preis zum Produkt gehören.
- **Geräte** verweisen auf ihr Produkt; Gerätetyp muss zum Produkt passen (API + Trigger), und der Gerätetyp eines
  verwendeten Produkts ist nicht mehr änderbar.
- **Umsatz je Abteilung** (`/api/v1/reports/revenue-by-department`) ergibt sich aus der Produktzuordnung; Gutschriften
  übernehmen den Katalogbezug und mindern den Umsatz automatisch.

| Produkt (SKU) | Abteilung | Gerät | Preise |
|---|---|---|---|
| DEV-HOURLY | DEV | – | Junior 85 €/h · Senior 120 €/h · KI/DevOps 150 €/h |
| CONSULTING | MGT | – | 180 €/h |
| PROJECT-PACKAGE | DEV | – | Light 2.500 € · Core 7.500 € · Plus 15.000 € |
| AI-SERVER-RENT | DEV | ai_appliance | Pilot 499 €/Monat · Starter 999 € · Professional 1.999 € · Enterprise auf Anfrage |
| KM-AI (nicht öffentlich) | DEV | ai_appliance | auf Anfrage |
| CC-POS-V3 | DEV | pos | Kostenlos · Basic 99 € · Professional 299 € · Enterprise 599 € |
| SUPPORT-AGENT | SUP | agent | kostenlos |

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
- Login: Argon2id-Passworthashes, TOTP-2FA (QR-Code), Sitzungen 12 h (Token nur in sessionStorage), 5 Fehlversuche / 10 min je E-Mail.
- Öffentliche Formulare: Honeypot + 5 Einsendungen je IP und Stunde.
- Antwort-Header: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`; gzip-Kompression.

## Meilensteine
1. **Fundament** ✅ – Workspace, Abrechnung, Geräte-Reports, Abteilungen & Katalog, 29 Tests, CI
2. **Portal & Webseite** ✅ – Login (Argon2id) + TOTP-2FA, Sitzungen mit Ablauf, Rate-Limit; Webseite (Start, Produkte aus Katalog,
   Karriere + Bewerbung, Kontakt) und Portal (Rechnungen inkl. PDF, Kunden, Produktpflege, Stellen, Anfragen, Geräte, Benutzer, Konto)
   als eine React-App, vom Rust-Server ausgeliefert. Offen: XRechnung/ZUGFeRD, Angebote, Terminbuchung, SEO-Vorrendern
3. **Katalog, Lizenzen, Geräte-OTA** – Firmware-Releases, signierte Updates, Lizenzaktivierung für KI-Appliance & POS, ESP32-Provisionierung
4. **Projekte, Zeit, Support** – Migration der Dev- und Support-Daten
5. **Interne Module & Abschaltung Altsystem**
