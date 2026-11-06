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
| Webseite code-craft.tech (DE/EN/AR) | Astro, statisch | `apps/web` | ⏳ Meilenstein 2 |
| Portal (Mitarbeiter + Kunden, Rollen) | React + Vite | `apps/portal` | ⏳ Meilenstein 2 |

## Schnellstart (WSL/Ubuntu)

```bash
sudo apt install postgresql && sudo service postgresql start
sudo -u postgres createuser -s $USER && createdb codecraft
export DATABASE_URL=postgres:///codecraft
cargo test --workspace                                                   # 29 Tests inkl. DB
cargo run -p codecraft-server -- create-admin ak@code-craft.tech "Anas"  # gibt Admin-Token aus
cargo run -p codecraft-server                                            # API auf 127.0.0.1:8080
```

## API (v1)

| Methode | Pfad | Recht |
|---|---|---|
| GET | `/health` | – |
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
