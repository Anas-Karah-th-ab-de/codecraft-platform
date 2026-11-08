#!/usr/bin/env bash
# Nach prepare.sh auf frischem Server: PDF-Erzeugung (Chrome Headless Shell), Umgebung ergänzen,
# Dienst starten, Konten anlegen (Passwörter auf dem Server erzeugt), DKIM ausgeben. Wiederholbar.
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
ENV=/etc/codecraft/server.env
add() { grep -q "^$1=" "$ENV" || echo "$1=$2" >> "$ENV"; }

echo "== PDF: Chrome Headless Shell (ohne Snap)"
if [ ! -x /opt/chrome-headless-shell/chrome-headless-shell ]; then
  apt-get install -y -qq unzip libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64 fonts-noto-core fonts-noto-color-emoji >/dev/null
  URL=$(curl -fsS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json \
    | jq -r '.channels.Stable.downloads["chrome-headless-shell"][] | select(.platform=="linux64") | .url')
  T=$(mktemp -d); curl -fsSL -o "$T/c.zip" "$URL"; unzip -q "$T/c.zip" -d "$T"
  rm -rf /opt/chrome-headless-shell; mv "$T/chrome-headless-shell-linux64" /opt/chrome-headless-shell; rm -rf "$T"
fi
# eigener Aufruf ohne Sandbox (nur eigenes HTML, Dienst ist selbst abgeschottet)
cat > /usr/local/bin/codecraft-chromium <<'W'
#!/bin/sh
exec /opt/chrome-headless-shell/chrome-headless-shell --no-sandbox --no-zygote --disable-dev-shm-usage "$@"
W
chmod 755 /usr/local/bin/codecraft-chromium
install -d -o codecraft -g codecraft -m 700 /var/lib/codecraft/pdf-tmp
add CHROMIUM_BIN /usr/local/bin/codecraft-chromium
add PDF_TMP_DIR /var/lib/codecraft/pdf-tmp
add PUBLIC_URL https://code-craft.tech
add PUSH_SUBJECT mailto:ak@code-craft.tech
add SYSTEM_MAIL_FROM noreply@code-craft.tech

# V8 braucht ausführbaren Speicher (nur für den PDF-Kindprozess relevant)
mkdir -p /etc/systemd/system/codecraft.service.d
cat > /etc/systemd/system/codecraft.service.d/pdf.conf <<'D'
[Service]
MemoryDenyWriteExecute=no
SystemCallFilter=
SystemCallFilter=@system-service
D
systemctl daemon-reload

echo "== Dienst starten"
systemctl enable --now codecraft.service >/dev/null
systemctl restart codecraft.service
sleep 5
systemctl is-active codecraft.service
ss -tlnpu | grep codecraft | awk '{print $1, $5}' | sort -u
curl -fsS http://127.0.0.1:8090/health && echo

echo "== Konten (Passwörter werden hier erzeugt, nie angezeigt)"
set -a; . "$ENV"; set +a
CC() { sudo --preserve-env=DATABASE_URL,MAIL_ENC_KEY -u codecraft /opt/codecraft-platform/bin/codecraft-server "$@" 2>/dev/null; }
PSQL() { sudo -u postgres psql -p 5434 -d codecraft -qAt -c "$1"; }
Z=/root/codecraft-zugang.txt
(umask 077; touch "$Z")
pw() { openssl rand -base64 30 | tr -d '/+=\n' | head -c 20; }
person() {
  if ! grep -q "^$1 " "$Z"; then p=$(pw); echo "$1 $p" >> "$Z"; else p=$(grep "^$1 " "$Z" | cut -d' ' -f2); fi
  printf '%s\n' "$p" | CC mail-account "$1" "$2" "$3" >/dev/null
}
person ak@code-craft.tech "Anas Karah" admin
person ah@code-craft.tech "Ali Hennawi" staff
person lu@code-craft.tech "Luban Kara Mohamad" staff
person info@code-craft.tech "Info" manager
person noreply@code-craft.tech "No Reply" staff
PSQL "INSERT INTO user_departments (user_id, department_id, is_primary)
      SELECT u.id, d.id, d.code = 'MGT' FROM users u, departments d WHERE u.email = 'ak@code-craft.tech' ON CONFLICT DO NOTHING"
for a in admin support postmaster abuse; do
  PSQL "INSERT INTO mail_aliases (address, mailbox_id) SELECT '$a@code-craft.tech', id FROM mailboxes WHERE address = 'ak@code-craft.tech' ON CONFLICT DO NOTHING"
done
PSQL "SELECT u.email || ' | ' || u.role || ' | ' || coalesce(m.address,'') FROM users u LEFT JOIN mailboxes m ON m.user_id = u.id ORDER BY 1"

echo "== DKIM (neu erzeugt beim Start)"
PSQL "SELECT domain || ' ' || dkim_selector || ' ' || coalesce(length(dkim_public_b64)::text,'-') FROM mail_domains"
PSQL "SELECT dkim_selector || '._domainkey ' || 'v=DKIM1; k=rsa; p=' || dkim_public_b64 FROM mail_domains WHERE domain='code-craft.tech'" > /root/dkim-dns.txt
echo "FINISH FERTIG"
EOF
umask 077
{ echo "# Produktion – Zugangsdaten (Adresse Passwort)"; ssh -o BatchMode=yes "$HOST" cat /root/codecraft-zugang.txt
  echo "# Schlüssel"; ssh -o BatchMode=yes "$HOST" "grep -E '^(MAIL_ENC_KEY|TURN_SECRET)=' /etc/codecraft/server.env"; } > "$ROOT/.prod-zugang.local"
chmod 600 "$ROOT/.prod-zugang.local"
ssh -o BatchMode=yes "$HOST" cat /root/dkim-dns.txt > "$ROOT/.prod-dkim.local"
echo "Lokal: .prod-zugang.local, .prod-dkim.local"
