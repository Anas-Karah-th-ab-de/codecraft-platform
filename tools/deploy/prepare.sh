#!/usr/bin/env bash
# Phase A: codecraft-server auf dem Produktionsserver vorbereiten (stört den laufenden Betrieb nicht).
# Wiederholbar: vorhandene Geheimnisse/Datenbank bleiben erhalten. Der Dienst wird NICHT gestartet.
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
test -x target/release/codecraft-server || { echo "zuerst: cargo build --release -p codecraft-server"; exit 1; }
test -f apps/web/dist/index.html || { echo "zuerst: Frontend bauen"; exit 1; }

echo "== Dateien hochladen"
ssh -o BatchMode=yes "$HOST" 'id codecraft >/dev/null 2>&1 || useradd --system --home /var/lib/codecraft --create-home --shell /usr/sbin/nologin codecraft
install -d -o root -g root -m 755 /opt/codecraft-platform /opt/codecraft-platform/bin
install -d -o root -g codecraft -m 750 /etc/codecraft /etc/codecraft/tls
install -d -o codecraft -g codecraft -m 700 /var/lib/codecraft /var/lib/codecraft/media
install -d -o root -g root -m 700 /var/lib/codecraft-import'
scp -q target/release/codecraft-server "$HOST:/opt/codecraft-platform/bin/codecraft-server.new"
tar -C apps/web -czf - dist | ssh -o BatchMode=yes "$HOST" 'rm -rf /opt/codecraft-platform/web.new && mkdir /opt/codecraft-platform/web.new && tar -C /opt/codecraft-platform/web.new -xzf - --strip-components=1'

ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
cd /opt/codecraft-platform
mv -f bin/codecraft-server.new bin/codecraft-server && chmod 755 bin/codecraft-server
rm -rf web && mv web.new web

echo "== Datenbank (Host-Postgres 5434, nur lokal erreichbar)"
if [ ! -f /etc/codecraft/db.pass ]; then
  (umask 077; openssl rand -base64 48 | tr -d '/+=\n' | head -c 40 > /etc/codecraft/db.pass)
fi
DBPW=$(cat /etc/codecraft/db.pass)
sudo -u postgres psql -p 5434 -qtAc "SELECT 1 FROM pg_roles WHERE rolname='codecraft'" | grep -q 1 \
  || sudo -u postgres psql -p 5434 -qc "CREATE ROLE codecraft LOGIN PASSWORD '$DBPW'"
sudo -u postgres psql -p 5434 -qtAc "SELECT 1 FROM pg_database WHERE datname='codecraft'" | grep -q 1 \
  || sudo -u postgres psql -p 5434 -qc "CREATE DATABASE codecraft OWNER codecraft"

echo "== Geheimnisse und Umgebung (auf dem Server erzeugt)"
ENV=/etc/codecraft/server.env
if [ ! -f "$ENV" ]; then
  (umask 077; cat > "$ENV" <<CONF
DATABASE_URL=postgres://codecraft:${DBPW}@127.0.0.1:5434/codecraft
BIND=127.0.0.1:8090
STATIC_DIR=/opt/codecraft-platform/web
MEDIA_DIR=/var/lib/codecraft/media
RUST_LOG=info,tower_http=warn
MAIL_HOSTNAME=mail.code-craft.tech
MAIL_TLS_CERT=/etc/codecraft/tls/fullchain.pem
MAIL_TLS_KEY=/etc/codecraft/tls/privkey.pem
MAIL_ENC_KEY=$(openssl rand -base64 32)
PUBLIC_HOST=code-craft.tech
STUN_BIND=0.0.0.0:3479
STUN_PORT=3479
TURN_PUBLIC_IP=194.62.29.64
TURN_SECRET=$(openssl rand -hex 32)
TURN_MIN_PORT=41000
TURN_MAX_PORT=41999
CONF
)
fi
chown root:codecraft "$ENV"; chmod 640 "$ENV"
grep -q '^MAIL_ENC_KEY=.\{44\}$' "$ENV" || { echo "MAIL_ENC_KEY fehlt!"; exit 1; }

echo "== TLS (certbot-Zertifikat mail.code-craft.tech + Hook für Verlängerung)"
HOOK=/etc/letsencrypt/renewal-hooks/deploy/codecraft-mail.sh
cat > "$HOOK" <<'H'
#!/bin/sh
# Zertifikat für den eigenen Mailserver bereitstellen und Dienst neu starten
L=/etc/letsencrypt/live/mail.code-craft.tech
install -o root -g codecraft -m 640 "$L/fullchain.pem" /etc/codecraft/tls/fullchain.pem
install -o root -g codecraft -m 640 "$L/privkey.pem" /etc/codecraft/tls/privkey.pem
systemctl try-restart codecraft.service || true
H
chmod 755 "$HOOK"
RENEWED_LINEAGE= "$HOOK"

echo "== systemd-Dienst (gehärtet, eigener Benutzer, nicht root)"
cat > /etc/systemd/system/codecraft.service <<'U'
[Unit]
Description=KM Code Craft Plattform (Web, Portal, Mail, Chat, Anrufe)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=codecraft
Group=codecraft
EnvironmentFile=/etc/codecraft/server.env
WorkingDirectory=/var/lib/codecraft
ExecStart=/opt/codecraft-platform/bin/codecraft-server
Restart=always
RestartSec=3
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
ProtectProc=invisible
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallFilter=~@privileged @resources
ReadWritePaths=/var/lib/codecraft
UMask=0077
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
U
systemctl daemon-reload

echo "== Migrationen"
set -a; . /etc/codecraft/server.env; set +a
sudo --preserve-env=DATABASE_URL -u codecraft /opt/codecraft-platform/bin/codecraft-server mail-key >/dev/null
sudo -u postgres psql -p 5434 -d codecraft -Atc "select count(*) || ' Migrationen' from _sqlx_migrations"
echo "PHASE A FERTIG"
EOF
