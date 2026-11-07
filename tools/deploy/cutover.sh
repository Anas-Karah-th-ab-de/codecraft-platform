#!/usr/bin/env bash
# Phase B: Mailcow → codecraft-server. Mailcow wird nur ANGEHALTEN (Daten bleiben), Rückweg: tools/deploy/rollback.sh
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
I=/var/lib/codecraft-import
MC=/opt/mailcow-dockerized
DOV=$(docker ps --format '{{.Names}}' | grep -m1 dovecot-mailcow)
PF=$(docker ps --format '{{.Names}}' | grep -m1 postfix-mailcow)
USERS=$(docker exec "$DOV" doveadm user '*' | grep -v '@mailcow.local$')

echo "== 1. Mailcow nimmt keine neue Post mehr an (fremde Server stellen später erneut zu)"
docker exec "$PF" postqueue -p | tail -1
docker stop "$PF" >/dev/null && echo "postfix angehalten $(date +%T)"

echo "== 2. Letzter vollständiger Export (doveadm, nur lesend)"
: > "$I/counts-before.txt"
for u in $USERS; do
  docker exec "$DOV" doveadm mailbox status -u "$u" messages '*' | awk -v u="$u" '{s+=substr($2,10)} END {print u, s+0}' >> "$I/counts-before.txt"
  docker exec "$DOV" doveadm -f pager fetch -u "$u" 'mailbox uid flags date.received text' ALL > "$I/$u.pager"
done
cat "$I/counts-before.txt"

echo "== 3. Mailcow anhalten (nicht löschen)"
(cd "$MC" && docker compose stop >/dev/null 2>&1) && echo "Mailcow angehalten $(date +%T)"

echo "== 4. Import in die neue Plattform"
set -a; . /etc/codecraft/server.env; set +a
B=/opt/codecraft-platform/bin/codecraft-server
for u in ak ah lu info noreply; do
  f="$I/$u@code-craft.tech.pager"; [ -s "$f" ] && $B mail-import "$f" 2>/dev/null
done
[ -s "$I/admin@code-craft.tech.pager" ] && $B mail-import --into ak@code-craft.tech --folder archive "$I/admin@code-craft.tech.pager" 2>/dev/null
[ -s "$I/support@code-craft.tech.pager" ] && $B mail-import --into ak@code-craft.tech --folder archive "$I/support@code-craft.tech.pager" 2>/dev/null
echo "-- Abgleich (Mailcow vorher | neu gespeichert)"
for u in $USERS; do
  before=$(grep "^$u " "$I/counts-before.txt" | cut -d' ' -f2)
  recs=$(grep -c $'^\f$' "$I/$u.pager" 2>/dev/null || true); [ -s "$I/$u.pager" ] && recs=$((recs+1)) || recs=0
  echo "$u: Mailcow $before | exportiert $recs"
done
sudo -u postgres psql -p 5434 -d codecraft -At -c "SELECT b.address || ' ' || m.folder || ': ' || count(*) FROM mail_messages m JOIN mailboxes b ON b.id = m.mailbox_id GROUP BY 1 ORDER BY 1" | column -t

echo "== 5. Neuen Dienst starten"
systemctl enable --now codecraft.service
sleep 4
systemctl is-active codecraft.service
ss -tlnpu | grep codecraft-serv | awk '{print $1, $5}' | sort -u

echo "== 6. Webmail auf die neue Plattform"
cp -a /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.vor-codecraft-$(date +%F-%H%M)"
python3 - <<'PY'
import re
p = "/etc/nginx/nginx.conf"
s = open(p).read()
i = s.index("server_name webmail.code-craft.tech;")
j = s.index("proxy_pass https://127.0.0.1:8443;", i)
s = s[:j] + "proxy_pass http://127.0.0.1:8090;" + s[j + len("proxy_pass https://127.0.0.1:8443;"):]
s = s.replace("            proxy_ssl_verify off;\n", "", 1) if s.find("proxy_ssl_verify off;", j) - j < 200 else s
k = s.index("location / {", i)
if "return 302 /portal/mail" not in s[i:k]:
    s = s[:k] + "location = / { return 302 /portal/mail; }\n        client_max_body_size 40m;\n        " + s[k:]
open(p, "w").write(s)
PY
nginx -t 2>&1 | tail -1 && systemctl reload nginx && echo "nginx neu geladen"
echo "UMSCHALTUNG FERTIG $(date +%T)"
EOF
