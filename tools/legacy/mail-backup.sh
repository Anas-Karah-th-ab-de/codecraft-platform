#!/usr/bin/env bash
# Vollsicherung der Mailcow-Rohdaten NUR LESEND (tar wird zum lokalen Rechner gestreamt, auf dem Server entsteht nichts).
# Sichert: vmail (alle Postfächer) + crypt (Schlüssel der Mail-Verschlüsselung, ohne sie sind die Rohdaten unlesbar)
# Ergebnis: ~/prod-export/mailcow-backup/<datum>/*.tar.gz + SHA256SUMS   (nie ins Git!)
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
OUT="${OUT:-$HOME/prod-export/mailcow-backup}/$(date +%F_%H%M)"
mkdir -p "$OUT"; chmod 700 "$(dirname "$OUT")" "$OUT"
for vol in vmail-vol-1 crypt-vol-1; do
  path=$(ssh -o BatchMode=yes "$HOST" "docker volume inspect -f '{{.Mountpoint}}' mailcowdockerized_${vol}")
  printf '%-14s %s … ' "$vol" "$path"
  ssh -o BatchMode=yes "$HOST" "tar -C '$path' -czf - ." > "$OUT/$vol.tar.gz"
  echo "$(du -h "$OUT/$vol.tar.gz" | cut -f1)"
done
(cd "$OUT" && sha256sum *.tar.gz > SHA256SUMS && tar -tzf vmail-vol-1.tar.gz | grep -c '/cur/\|/new/' | xargs echo "Dateien in Maildirs:")
chmod 600 "$OUT"/*
echo "Sicherung: $OUT"
