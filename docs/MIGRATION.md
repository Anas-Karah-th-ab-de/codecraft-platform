# Migration aus `code-craft-vps-life-time`

Strategie: **Strangler** – das Altsystem läuft weiter, Module wechseln einzeln. Daten werden per Import-Werkzeug (`crates/migrate`, M2) aus der alten DB gelesen; die alte DB wird nie beschrieben.

| Alt (Prisma-Modell) | Neu | Hinweise |
|---|---|---|
| `Customer` (+ `parentCustomerId`) | `organizations` + Benutzer mit Rolle `customer` | Teams → mehrere Benutzer derselben Organisation |
| `User` (ADMIN/LEITER/MANAGER/MITARBEITER/AZUBI) | `users.role` admin/lead/manager/staff/trainee | 1:1 |
| `Invoice`, `InvoiceItem` | `invoices`, `invoice_items` | Bestandsrechnungen **unverändert** mit Originalnummer als `issued`/`paid` übernehmen; `number_sequences` startet nach der höchsten Altnummer je Jahr. Dezimal → Cent per `ROUND(x*100)`. |
| `CostProposal*` | eigene Tabelle `proposals` (M2), Nummernserie `KV` existiert bereits | Meilensteine/Zahlungsplan als Unterpositionen |
| `SoftwareProduct*` + `Product*` | `products` (Typ software/hardware/service) | Übersetzungen zusammenführen |
| `SoftwareLicense*` + `License*` | `licenses`, `license_activations` | bestehende Lizenzschlüssel bleiben gültig |
| `TimeEntry` + `SupportTimeEntry` | `time_entries` (Bezug Projekt/Ticket/Vertrag) | |
| `ManagedDevice`, Agent-Registrierung | `devices` | Agent erhält neues Token per Update |

## Reihenfolge der Umschaltung
1. Abrechnung: neue Rechnungen nur noch im neuen System, Altbestand importiert (lesbar).
2. Webseite: Astro-Build liest aus der API statt aus der DB → `corporate-web` abschalten.
3. Kundenportal → neues Portal (Rolle `customer`).
4. Dev- und Support-Module, dann interne Module.
5. Altsystem nur noch lesend, dann archivieren.
