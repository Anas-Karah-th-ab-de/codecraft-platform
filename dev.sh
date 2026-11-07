#!/usr/bin/env bash
# Lokal starten: Datenbank, Frontend-Build, Server – alles in einem.
#   ./dev.sh          → http://localhost:8080  (Webseite)  ·  http://localhost:8080/portal  (Portal)
#   ./dev.sh test     → alle Tests
set -euo pipefail
cd "$(dirname "$0")"
source "$HOME/.cargo/env" 2>/dev/null || true

DB=${DB_NAME:-codecraft}
export DATABASE_URL=${DATABASE_URL:-postgres:///$DB}
export BIND=${BIND:-0.0.0.0:8080}
export RUST_LOG=${RUST_LOG:-info,tower_http=warn}
command -v chromium >/dev/null && export CHROMIUM_BIN=${CHROMIUM_BIN:-chromium}

# PostgreSQL
sudo service postgresql start >/dev/null 2>&1 || true
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$USER'" | grep -q 1 || sudo -u postgres createuser -s "$USER"
psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || createdb "$DB"

if [[ "${1:-}" == "test" ]]; then
  cargo test --workspace
  (cd apps/web && npx tsc --noEmit)
  exit 0
fi

# Frontend bauen
(cd apps/web && { [ -d node_modules ] || npm install --no-audit --no-fund; } && npx vite build --logLevel warn)
# Belege im Layout des Altsystems (jsPDF)
(cd pdf-legacy && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build --silent)

# Server bauen
cargo build --release -q -p codecraft-server
BIN=target/release/codecraft-server

# Erster Start: Admin anlegen (Passwort wird einmalig erzeugt und in .admin.local gespeichert)
if [[ "$(psql -d "$DB" -tAc "SELECT count(*) FROM users WHERE role='admin'" 2>/dev/null || echo 0)" == "0" ]]; then
  PW=$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 16)
  $BIN create-admin "${ADMIN_EMAIL:-ak@code-craft.tech}" "${ADMIN_NAME:-Anas Karah}" "$PW" >/dev/null
  printf 'E-Mail:   %s\nPasswort: %s\n' "${ADMIN_EMAIL:-ak@code-craft.tech}" "$PW" > .admin.local
  chmod 600 .admin.local
  echo "Admin angelegt – Zugangsdaten in $(pwd)/.admin.local"
fi

echo "▶ Webseite: http://localhost:8080   ▶ Portal: http://localhost:8080/portal"
exec $BIN
