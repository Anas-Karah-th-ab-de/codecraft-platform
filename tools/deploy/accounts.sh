#!/usr/bin/env bash
# Konten, Weiterleitungen und DKIM auf dem Produktionsserver einrichten (nur neue Datenbank, Mailcow unberührt).
# Passwörter werden auf dem Server erzeugt bzw. aus den .env der alten Portale übernommen und nie angezeigt.
# Zugangsdaten landen in /root/codecraft-zugang.txt (600) und lokal in .prod-zugang.local (600, nie ins Git).
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ssh -o BatchMode=yes "$HOST" 'bash -s' <<'EOF'
set -euo pipefail
set -a; . /etc/codecraft/server.env; set +a
CC() { sudo --preserve-env=DATABASE_URL,MAIL_ENC_KEY -u codecraft /opt/codecraft-platform/bin/codecraft-server "$@" 2>/dev/null; }
PSQL() { sudo -u postgres psql -p 5434 -d codecraft -qAt -c "$1"; }
Z=/root/codecraft-zugang.txt
(umask 077; touch "$Z")
pw() { openssl rand -base64 30 | tr -d '/+=\n' | head -c 20; }
person() { # adresse name rolle
  if ! grep -q "^$1 " "$Z"; then p=$(pw); echo "$1 $p" >> "$Z"; else p=$(grep "^$1 " "$Z" | cut -d' ' -f2); fi
  printf '%s\n' "$p" | CC mail-account "$1" "$2" "$3"
}
envpass() { grep '^SMTP_PASS=' "$1" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }

echo "== Personen"
person ak@code-craft.tech "Anas Karah" admin
person ah@code-craft.tech "Ali Hennawi" staff
person lu@code-craft.tech "Luban Kara Mohamad" staff
# Admin: alle Abteilungen (wie create-admin)
PSQL "INSERT INTO user_departments (user_id, department_id, is_primary)
      SELECT u.id, d.id, d.code = 'MGT' FROM users u, departments d WHERE u.email = 'ak@code-craft.tech' ON CONFLICT DO NOTHING"

echo "== Funktionskonten mit den Passwörtern der alten Portale"
P1=$(envpass /opt/code-craft/corporate-web/.env)
P2=$(envpass /opt/code-craft/customer-portal/.env)
P3=$(envpass /opt/code-craft/employee-portal/.env)
printf '%s\n' "$P1" | CC mail-account info@code-craft.tech "Info" manager
printf '%s\n' "$P2" | CC mail-account noreply@code-craft.tech "No Reply" staff
[ "$P2" = "$P3" ] && echo "noreply: beide Portale nutzen dasselbe Passwort" || echo "WARNUNG: Portale nutzen verschiedene noreply-Passwörter"

echo "== Weiterleitungen"
for a in admin support postmaster abuse; do
  PSQL "INSERT INTO mail_aliases (address, mailbox_id) SELECT '$a@code-craft.tech', id FROM mailboxes WHERE address = 'ak@code-craft.tech' ON CONFLICT DO NOTHING"
done
PSQL "SELECT address || ' -> ak@code-craft.tech' FROM mail_aliases ORDER BY 1"

echo "== DKIM: bestehenden Mailcow-Schlüssel (Selektor dkim) übernehmen – DNS bleibt unverändert"
RS=$(docker ps --format '{{.Names}}' | grep -m1 rspamd-mailcow)
KEY=$(docker exec "$RS" cat /data/dkim/keys/code-craft.tech.dkim)
DER=$(printf '%s\n' "$KEY" | openssl rsa -traditional -outform DER 2>/dev/null | xxd -p | tr -d '\n')
PUB=$(printf '%s\n' "$KEY" | openssl rsa -pubout -outform DER 2>/dev/null | base64 -w0)
DNS=$(dig +short TXT dkim._domainkey.code-craft.tech | tr -d '" \n' | sed 's/.*p=//')
[ "$PUB" = "$DNS" ] && echo "DKIM: Schlüssel passt zum DNS-Eintrag" || { echo "DKIM: passt NICHT zum DNS – Abbruch"; exit 1; }
PSQL "UPDATE mail_domains SET dkim_selector = 'dkim', dkim_private_der = decode('$DER', 'hex'), dkim_public_b64 = '$PUB' WHERE domain = 'code-craft.tech'"
unset KEY DER

echo "== Übersicht"
PSQL "SELECT u.email || ' | ' || u.role || ' | ' || coalesce(m.address,'') FROM users u LEFT JOIN mailboxes m ON m.user_id = u.id ORDER BY 1"
EOF
# zweite Kopie der Zugangsdaten und des Mail-Schlüssels lokal (Schlüsselverlust = Mails unlesbar)
umask 077
{ echo "# Produktion – Zugangsdaten (Adresse Passwort)"; ssh -o BatchMode=yes "$HOST" cat /root/codecraft-zugang.txt
  echo "# Schlüssel"; ssh -o BatchMode=yes "$HOST" "grep -E '^(MAIL_ENC_KEY|TURN_SECRET)=' /etc/codecraft/server.env"; } > "$ROOT/.prod-zugang.local"
chmod 600 "$ROOT/.prod-zugang.local"
echo "Lokale Kopie: $ROOT/.prod-zugang.local ($(wc -l < "$ROOT/.prod-zugang.local") Zeilen)"
