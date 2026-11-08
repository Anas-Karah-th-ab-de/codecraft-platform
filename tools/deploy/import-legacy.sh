#!/usr/bin/env bash
# Geschäftsdaten des Altsystems (Kunden, Projekte, Angebote, Rechnungen) auf dem Server übernehmen.
# Wiederholbar (feste UUIDs, legacy_id). Danach import-users.sh für Kundenzugänge.
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXPORT=${1:-$HOME/prod-export}
SQL=$(mktemp)
trap 'rm -f "$SQL"' EXIT
python3 "$ROOT/tools/legacy/import.py" "$EXPORT" > "$SQL"
echo "SQL: $(wc -l < "$SQL") Zeilen"
scp -q "$SQL" "$HOST:/var/lib/codecraft-import/legacy.sql"
ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
chmod 600 /var/lib/codecraft-import/legacy.sql
PGPASSWORD=$(cat /etc/codecraft/db.pass) psql -h 127.0.0.1 -p 5434 -U codecraft -d codecraft -q -v ON_ERROR_STOP=1 -f /var/lib/codecraft-import/legacy.sql
sudo -u postgres psql -p 5434 -d codecraft -At -c "select 'Firmen ' || count(*) from organizations" -c "select 'Projekte ' || count(*) from projects" \
  -c "select 'Angebote ' || count(*) from quotes" -c "select 'Rechnungen ' || count(*) from invoices"
EOF
