#!/usr/bin/env bash
# Gesicherte Postfächer (doveadm-Export *.pager) in die Plattform übernehmen.
# admin@/support@ waren Weiterleitungen → landen im Archiv von ak@.
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
SRC=${1:-$HOME/prod-export/mail}
ssh -o BatchMode=yes "$HOST" 'install -d -m 700 /var/lib/codecraft-import/mail'
rsync -a --chmod=F600 "$SRC"/*.pager "$HOST:/var/lib/codecraft-import/mail/"
ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
set -a; . /etc/codecraft/server.env; set +a
B=/opt/codecraft-platform/bin/codecraft-server
I=/var/lib/codecraft-import/mail
for u in ak ah lu info noreply; do
  f="$I/$u@code-craft.tech.pager"; [ -s "$f" ] && { echo "-- $u"; $B mail-import "$f" 2>&1 | tail -1; }
done
for u in admin support; do
  f="$I/$u@code-craft.tech.pager"; [ -s "$f" ] && { echo "-- $u → ak (Archiv)"; $B mail-import --into ak@code-craft.tech --folder archive "$f" 2>&1 | tail -1; }
done
sudo -u postgres psql -p 5434 -d codecraft -At -c "SELECT b.address || ' ' || m.folder || ': ' || count(*) FROM mail_messages m JOIN mailboxes b ON b.id = m.mailbox_id GROUP BY b.address, m.folder ORDER BY 1"
EOF
