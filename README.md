# KM Code Craft Plattform

Neuaufbau von code-craft.tech, Mitarbeiter- und Kundenportal sowie Geräte-Anbindung.
Ersetzt schrittweise `code-craft-vps-life-time` (3× Next.js, ~155 k Zeilen).

| Teil | Technik | Ordner | Stand |
|---|---|---|---|
| API-Server | Rust · Axum · PostgreSQL (sqlx) | `crates/server` | ✅ Abrechnung, Abteilungen, Katalog, Organisationen, Geräte |
| Fachlogik (Rechnungen, Steuern, Rechte) | Rust, ohne I/O | `crates/domain` | ✅ |
| Geräteprotokoll (no_std) | Rust | `crates/protocol` | ✅ v1 |
| Geräte-Agent (PC, KI-Appliance, POS) | Rust | `crates/agent` | ✅ Reports, Lizenzstatus |
| ESP32-Firmware | Rust (ESP-IDF) | `firmware/esp32` | 🟡 Gerüst |
| Webseite + Portal (DE/EN/AR, RTL) | React + Vite, vom Server ausgeliefert | `apps/web` | ✅ Start, Produkte, Karriere, Kontakt · Portal mit Login/2FA |
| Rechnungs-PDF | HTML-Vorlage → Headless-Chromium | `crates/server/src/pdf.rs` | ✅ DE/EN/AR |

## Lokal starten (ein Befehl)

```bash
./dev.sh          # DB anlegen, Frontend + Server bauen, starten
                  # Webseite: http://localhost:8080   Portal: http://localhost:8080/portal
                  # Beim ersten Start: Admin-Zugang steht in .admin.local
./dev.sh test     # alle Tests (Rust + TypeScript)
```

Frontend-Entwicklung mit Hot-Reload: Server laufen lassen, dann `cd apps/web && npm run dev` (Port 5173).

## Schnellstart manuell (WSL/Ubuntu)

```bash
sudo apt install postgresql && sudo service postgresql start
sudo -u postgres createuser -s $USER && createdb codecraft
export DATABASE_URL=postgres:///codecraft
cargo test --workspace                                                   # 36 Tests inkl. DB
cargo run -p codecraft-server -- create-admin ak@code-craft.tech "Anas" "<passwort>"
cargo run -p codecraft-server                                            # API auf 127.0.0.1:8080
```

## API (v1)

| Methode | Pfad | Recht |
|---|---|---|
| GET | `/health` | – |
| POST | `/api/v1/auth/login` (+ `code` bei 2FA) · `/logout` · `/password` · `/2fa/setup|enable|disable` | – / Sitzung |
| GET | `/api/v1/public/jobs` · `/public/jobs/{slug}` · POST `/apply` · POST `/public/contact` | öffentlich |
| GET/POST | `/api/v1/users` | UserManage (Admin) |
| GET/POST · PUT | `/api/v1/jobs` · `/jobs/{id}/status` · GET `/applications` · `/contact-requests` | JobsManage |
| PATCH · POST | `/api/v1/products/{id}` · `/products/{id}/prices` · PATCH `/prices/{id}` | CatalogWrite |
| GET | `/api/v1/invoices/{id}/pdf` (`?format=html` = Druckansicht) | InvoiceRead |
| GET | `/api/v1/public/catalog?locale=de\|en\|ar` | öffentlich (Webseite) |
| GET | `/api/v1/departments` | CatalogRead |
| GET/POST | `/api/v1/products` | CatalogRead / CatalogWrite |
| GET | `/api/v1/reports/revenue-by-department?year=` | InvoiceRead (Mitarbeiter) |
| GET/POST | `/api/v1/organizations` | CustomerRead / CustomerWrite |
| GET/POST | `/api/v1/invoices` | InvoiceRead / InvoiceWrite |
| GET/DELETE | `/api/v1/invoices/{id}` | Lesen / Entwurf löschen |
| PUT | `/api/v1/invoices/{id}/items` | nur Entwurf |
| POST | `/api/v1/invoices/{id}/issue` · `/pay` · `/cancel` | InvoiceIssue |
| GET/POST | `/api/v1/devices` | DeviceManage |
| POST | `/api/v1/devices/report` | Gerätetoken |

Siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) und [docs/MIGRATION.md](docs/MIGRATION.md).
