#!/usr/bin/env bash
# Alte Benutzer und Kunden (Altsystem-Export) auf dem Produktionsserver übernehmen.
# Jeder bekommt ein eigenes Einmal-Passwort und muss beim ersten Login ein neues setzen.
# Liste: /root/codecraft-einmal-passwoerter.txt (600) und lokal .prod-einmal-passwoerter.local (600, nie ins Git).
# Wiederholbar: vorhandene Benutzer bleiben unverändert.
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
EXPORT=${1:-$HOME/prod-export}

# Demo-/Testkonten des Altsystems und Adressen, die schon Weiterleitungen sind
SKIP="maria@code-craft.tech,thomas@code-craft.tech,lisa@code-craft.tech,lukas@code-craft.tech,markus@code-craft.tech"
SKIP+=",aemos1996@gmail.com,anaskarah996@gmail.com,admin@code-craft.tech"

for f in User Customer UserDepartment Department; do [ -f "$EXPORT/$f.json" ] || { echo "fehlt: $EXPORT/$f.json"; exit 1; }; done
TMP=$(ssh -o BatchMode=yes "$HOST" 'd=$(mktemp -d); chmod 755 "$d"; echo "$d"')
trap 'ssh -o BatchMode=yes "$HOST" "rm -rf $TMP"' EXIT
tar -C "$EXPORT" -cf - User.json Customer.json UserDepartment.json Department.json \
  | ssh -o BatchMode=yes "$HOST" "tar -C $TMP -xf - && chown -R codecraft $TMP && chmod 600 $TMP/*.json"

ssh -o BatchMode=yes "$HOST" "TMP=$TMP SKIP=$SKIP bash -s" <<'EOF'
set -euo pipefail
set -a; . /etc/codecraft/server.env; set +a
L=/root/codecraft-einmal-passwoerter.txt
OUT=$TMP/liste.csv
sudo --preserve-env=DATABASE_URL,MAIL_ENC_KEY -u codecraft \
  /opt/codecraft-platform/bin/codecraft-server import-users "$TMP" "$OUT" --skip "$SKIP"
(umask 077; tail -n +2 "$OUT" >> "$L")
echo "Neu: $(($(wc -l < "$OUT") - 1)) – Gesamtliste: $L"
EOF

umask 077
ssh -o BatchMode=yes "$HOST" cat /root/codecraft-einmal-passwoerter.txt > "$ROOT/.prod-einmal-passwoerter.local"
chmod 600 "$ROOT/.prod-einmal-passwoerter.local"
echo "Lokale Kopie: $ROOT/.prod-einmal-passwoerter.local"
