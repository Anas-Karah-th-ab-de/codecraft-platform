#!/usr/bin/env bash
# Rückweg: neue Plattform anhalten, Mailcow wieder starten, nginx-Stand von vorher.
# Mails, die inzwischen im neuen System eingegangen sind, bleiben dort erhalten (nichts wird gelöscht).
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
systemctl disable --now codecraft.service || true
B=$(ls -1t /etc/nginx/nginx.conf.vor-codecraft-* 2>/dev/null | head -1)
[ -n "$B" ] && cp -a "$B" /etc/nginx/nginx.conf && nginx -t && systemctl reload nginx
cd /opt/mailcow-dockerized && docker compose start
echo "Rückweg fertig – Mailcow läuft wieder"
EOF
