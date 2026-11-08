#!/usr/bin/env bash
# Frisch installierten Produktionsserver (Ubuntu) vorbereiten. Wiederholbar.
# Pakete, Absicherung (SSH nur Schlüssel, Firewall, fail2ban, automatische Sicherheitsupdates),
# Platte auf volle Größe, Swap, PostgreSQL auf Port 5434 (nur lokal), Docker, nginx, certbot.
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "== Pakete"
apt-get update -qq
apt-get -y -qq -o Dpkg::Options::=--force-confold upgrade >/dev/null
apt-get install -y -qq nginx certbot python3-certbot-nginx postgresql docker.io docker-compose-v2 \
  ufw fail2ban unattended-upgrades osm2pgsql git curl wget jq dnsutils rsync >/dev/null
systemctl enable --now docker >/dev/null

echo "== Platte: logisches Volume auf volle Größe"
if [ "$(vgs --noheadings -o vg_free --units g ubuntu-vg | tr -d ' g' | cut -d. -f1)" -gt 1 ]; then
  lvextend -q -l +100%FREE -r /dev/ubuntu-vg/ubuntu-lv
fi
df -h / | tail -1

echo "== Swap 8 GB (für Karten-Import)"
if [ ! -f /swapfile ]; then
  fallocate -l 8G /swapfile && chmod 600 /swapfile && mkswap -q /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "== SSH: nur Schlüssel, root nur mit Schlüssel"
cat > /etc/ssh/sshd_config.d/10-codecraft.conf <<'S'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 4
S
sshd -t && systemctl reload ssh
sshd -T | grep -iE '^(passwordauthentication|permitrootlogin) ' || true

echo "== Firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null; ufw default allow outgoing >/dev/null
for p in 22/tcp 80/tcp 443/tcp 25/tcp 465/tcp 587/tcp 993/tcp 3479/tcp 3479/udp 41000:41999/udp; do ufw allow "$p" >/dev/null; done
ufw --force enable >/dev/null
ufw status | head -20

echo "== fail2ban, automatische Sicherheitsupdates"
cat > /etc/fail2ban/jail.d/sshd.local <<'F'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
F
systemctl enable --now fail2ban >/dev/null && systemctl restart fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

echo "== PostgreSQL nur lokal auf Port 5434"
V=$(ls /etc/postgresql | sort -V | tail -1)
C=/etc/postgresql/$V/main/postgresql.conf
sed -i -E "s/^#?port = [0-9]+/port = 5434/; s/^#?listen_addresses = .*/listen_addresses = 'localhost'/" "$C"
systemctl restart postgresql
sudo -u postgres psql -p 5434 -Atc "select 'Postgres ' || version()" | cut -c1-40

echo "== Docker: Logs begrenzen"
mkdir -p /etc/docker
[ -f /etc/docker/daemon.json ] || echo '{"log-driver":"json-file","log-opts":{"max-size":"20m","max-file":"3"}}' > /etc/docker/daemon.json
systemctl restart docker
docker version --format 'Docker {{.Server.Version}}'; docker compose version
echo "BOOTSTRAP FERTIG"
EOF
