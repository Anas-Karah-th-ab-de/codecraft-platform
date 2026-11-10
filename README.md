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
| Webseite + Portal (DE/EN/AR, RTL) | React + Vite, vom Server ausgeliefert | `apps/web` | ✅ Start, Produkte + Detailseiten, Karriere, Kontakt · Portal mit Login/2FA |
| Produktbilder | Upload → 480/1600 px (JPEG/PNG), `/media` mit Langzeit-Cache | `crates/server/src/routes/media.rs` | ✅ |
| Rechnungs-PDF | HTML-Vorlage → Headless-Chromium | `crates/server/src/pdf.rs` | ✅ DE/EN/AR |

## Lokal starten (ein Befehl)

```bash
./dev.sh          # DB anlegen, Frontend + Server bauen, starten
                  # Webseite: http://localhost:8080   Portal: http://localhost:8080/portal
                  # Beim ersten Start: Admin-Zugang steht in .admin.local
./dev.sh test     # alle Tests (Rust + TypeScript)
```

Bilder liegen unter `data/media` (`MEDIA_DIR`), nicht im Git.

Frontend-Entwicklung mit Hot-Reload: Server laufen lassen, dann `cd apps/web && npm run dev` (Port 5173).

## Schnellstart manuell (WSL/Ubuntu)

```bash
sudo apt install postgresql && sudo service postgresql start
sudo -u postgres createuser -s $USER && createdb codecraft
export DATABASE_URL=postgres:///codecraft
cargo test --workspace                                                   # 39 Tests inkl. DB
cargo run -p codecraft-server -- create-admin ak@code-craft.tech "Anas" "<passwort>"
cargo run -p codecraft-server                                            # API auf 127.0.0.1:8080
```

## API (v1)

| Methode | Pfad | Recht |
|---|---|---|
| GET | `/health` | – |
| POST | `/api/v1/auth/login` (+ `code` bei 2FA) · `/logout` · `/password` · `/2fa/setup|enable|disable` | – / Sitzung |
| GET | `/api/v1/public/products/{slug}?locale=` | öffentlich |
| POST · DELETE · POST | `/api/v1/products/{id}/images` (multipart `file`) · `/product-images/{id}` · `/product-images/{id}/primary` | CatalogWrite |
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

## Belege im Layout des Altsystems

Rechnungen und Kostenvoranschläge werden mit dem unveränderten jsPDF-Code des Altsystems gedruckt
(`pdf-legacy/`, Node). Übernommene Belege tragen ihre Original-Druckdaten (`pdf_snapshot`) und sehen
exakt aus wie vorher; Firmendaten/Bank/Texte kommen aus `document_templates` (alte `InvoiceTemplate`).
`invoice-pdf.ts` und `proposal-pdf.ts` nicht anpassen – sonst ändert sich das Layout.

```bash
(cd pdf-legacy && npm ci && npm run build)   # macht ./dev.sh automatisch
tools/legacy/export.sh                        # Altsystem lesend sichern (~/prod-export, nicht ins Git)
python3 tools/legacy/import.py ~/prod-export > /tmp/import.sql && psql -d codecraft -f /tmp/import.sql
```
Ohne Node fällt der Server auf die eigene HTML-Vorlage (Chromium) zurück.

## Kassensystem (KM POS) im Kundenportal

Kunden mit verknüpfter Kasse sehen im Portal den Bereich **Kasse** (Lizenzen, verbundene Geräte, verschlüsselte Backups, Lizenz anfragen). Alle anderen sehen nichts Neues. Mitarbeiter mit `customer_write` legen Lizenzen pro Kunde an, verlängern oder sperren sie.

| Variable | Zweck |
|---|---|
| `KMPOS_LICENSE_PRIVKEY` | Ed25519-Privatschlüssel (Base64, 32 Byte) – passend zu `KMPOS_LICENSE_PUBKEY` beim Bau der Kasse |
| `KMPOS_RELAY_URL` | Relay für Fernzugriff (Standard `wss://relay.code-craft.tech/agent`) |
| `KMPOS_TUNNEL_DOMAIN` | Subdomain-Basis (Standard `pos.code-craft.tech`) |
| `KMPOS_AI_URL` | OpenAI-kompatibler Endpunkt für den Kassen-Assistenten (z. B. llama.cpp-Server `http://127.0.0.1:8081/v1`); ohne → API meldet „noch nicht verfügbar“ |
| `KMPOS_AI_KEY` / `KMPOS_AI_MODEL` | optional: API-Schlüssel und Modellname des Endpunkts |
| `POS_BACKUP_DIR` | Ablage der E2E-verschlüsselten Backups, z. B. `/var/lib/codecraft/pos-backups` (30 je Kasse) |

Der Lizenzschlüssel ist eingerichtet (10. November 2026). Den öffentlichen Teil, den die Kassen-App beim Bauen braucht, steht in `deploy/kmpos-license.pub`. Der private Teil liegt nur auf dem Server (`/etc/codecraft/server.env`, `/etc/codecraft/kmpos-license.pem`); eine Sicherungskopie hat der Inhaber. Geht er verloren, werden alle ausgestellten Lizenzen ungültig.

**KI-Einheiten:** Mitarbeiter schreiben im Portal unter *Kasse → KI-Einheiten* Einheiten gut; die verbundene Hauptkasse holt sie beim stündlichen Abgleich als signierten Code (`KMAI1.`, an den Betrieb gebunden) ab. Antworten über `/api/v1/pos/register/assistant` werden serverseitig gezählt (100 Test-Antworten je Firma, danach 402).

Ablauf an der Kasse: Einstellungen → *Kundenportal* → mit Portal-Zugang anmelden → freie Lizenz/Backup wird angeboten. Backups sind mit dem Wiederherstellungscode der Kasse verschlüsselt; der Server kann sie nicht lesen.

## Datensicherung

Der Produktionsserver sichert sich täglich um 02:30 UTC selbst: Datenbank (`pg_dump`) und Medien
landen in `/var/backups/codecraft` und bleiben 14 Tage. Das Skript ist `tools/deploy/backup.sh`
(auf dem Server `/usr/local/sbin/codecraft-backup`), gestartet vom Timer `codecraft-backup.timer`.

Solange kein Backup-Server eingetragen ist, liegt die Sicherung **nur auf demselben Server**. Das
schützt vor Bedienfehlern und defekten Daten, nicht vor dem Verlust des Servers.

### Backup-Server anschließen

Alles ist vorbereitet; es fehlen nur das Ziel und die Freigabe des Schlüssels.

1. Auf dem Backup-Server einen eigenen Benutzer und Ordner anlegen:

   ```bash
   adduser --disabled-password backup-cc
   install -d -m 700 -o backup-cc -g backup-cc /srv/backups/codecraft
   ```

2. Den öffentlichen Schlüssel des Produktionsservers dort eintragen. Er liegt auf dem
   Produktionsserver in `/root/.ssh/codecraft_backup.pub` und gehört in
   `/home/backup-cc/.ssh/authorized_keys` auf dem Backup-Server.

3. Auf dem Produktionsserver den Backup-Server einmal als bekannt bestätigen (Fingerabdruck prüfen):

   ```bash
   ssh -i /root/.ssh/codecraft_backup backup-cc@BACKUP-SERVER true
   ```

4. Ziel eintragen: `deploy/backup.env.example` nach `/etc/codecraft/backup.env` kopieren
   (`chmod 600`) und `BACKUP_REMOTE` setzen, zum Beispiel
   `backup-cc@BACKUP-SERVER:/srv/backups/codecraft`.

5. Probelauf und Kontrolle:

   ```bash
   systemctl start codecraft-backup.service
   journalctl -u codecraft-backup.service -n 5   # „Sicherung übertragen nach …“
   ```

Der Produktionsserver löscht auf dem Backup-Server nichts. Dort alte Sicherungen selbst aufräumen,
zum Beispiel täglich mit `find /srv/backups/codecraft -type f -mtime +90 -delete`.

### Wiederherstellen

```bash
# Datenbank (überschreibt den aktuellen Stand – Dienst vorher anhalten)
systemctl stop codecraft
export PGPASSWORD=$(cat /etc/codecraft/db.pass)
pg_restore -h 127.0.0.1 -p 5434 -U codecraft -d codecraft --clean --if-exists /var/backups/codecraft/db-JJJJMMTT-HHMM.dump
systemctl start codecraft

# Medien
tar -xzf /var/backups/codecraft/media-JJJJMMTT-HHMM.tar.gz -C "$(grep '^MEDIA_DIR=' /etc/codecraft/server.env | cut -d= -f2-)"
```

Nicht in der Sicherung: `/etc/codecraft` (Schlüssel, Passwörter), die Zertifikate und die Maps-Datenbank.
