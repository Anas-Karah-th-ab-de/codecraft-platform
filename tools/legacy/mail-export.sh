#!/usr/bin/env bash
# Mailcow-Postfächer NUR LESEND exportieren (doveadm fetch, Pager-Format).
# Ergebnis: ~/prod-export/mail/<adresse>.pager  (nie ins Git!)
# Nutzung: tools/legacy/mail-export.sh [adresse …]   (ohne Angabe: alle Postfächer)
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
OUT=${OUT:-$HOME/prod-export/mail}
mkdir -p "$OUT"
chmod 700 "$OUT"
users=("$@")
if [ ${#users[@]} -eq 0 ]; then
  mapfile -t users < <(ssh -o BatchMode=yes "$HOST" \
    'docker exec $(docker ps --format "{{.Names}}" | grep -m1 dovecot-mailcow) doveadm user "*"' | grep -v '@mailcow.local$')
fi
for u in "${users[@]}"; do
  printf '%-32s' "$u"
  ssh -o BatchMode=yes "$HOST" "docker exec \$(docker ps --format '{{.Names}}' | grep -m1 dovecot-mailcow) \
    doveadm -f pager fetch -u '$u' 'mailbox uid flags date.received text' ALL" > "$OUT/$u.pager"
  n=$(grep -c $'^\f$' "$OUT/$u.pager" || true)
  echo " $(du -h "$OUT/$u.pager" | cut -f1)  ${n} Trenner"
done
