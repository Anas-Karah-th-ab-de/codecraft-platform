#!/bin/bash
# Nach der DNS-Umstellung: Zertifikate für www/portal/team/maps/apimap holen, Maps-vhost aktivieren, prüfen.
set -uo pipefail
HOST=root@194.62.29.64
for n in www portal team maps apimap; do
  ip=$(dig +short @1.1.1.1 $n.code-craft.tech A | tail -1)
  printf "%-8s %s\n" $n "$ip"; [ "$ip" = 194.62.29.64 ] || { echo "DNS für $n noch nicht umgestellt"; exit 1; }
done
ssh -o BatchMode=yes $HOST '
set -e
W="certonly --webroot -w /var/www/html --non-interactive --agree-tos -m admin@code-craft.tech --expand"
certbot $W --cert-name code-craft.tech -d code-craft.tech -d www.code-craft.tech | tail -1
certbot $W --cert-name legacy.code-craft.tech $(openssl x509 -noout -ext subjectAltName -in /etc/letsencrypt/live/legacy.code-craft.tech/cert.pem | grep -o "DNS:[^,]*" | sed "s/DNS:/-d /" | grep -v -e portal -e team | xargs) -d portal.code-craft.tech -d team.code-craft.tech | tail -1
certbot $W --cert-name maps.code-craft.tech -d maps.code-craft.tech -d apimap.code-craft.tech | tail -1
ln -sf /etc/nginx/sites-available/maps.conf /etc/nginx/sites-enabled/maps.conf
nginx -t 2>&1 | tail -1 && systemctl reload nginx'
for u in https://www.code-craft.tech/ https://portal.code-craft.tech/ https://maps.code-craft.tech/ https://apimap.code-craft.tech/health \
         "https://apimap.code-craft.tech/tiles/planet_osm_line/12/2460/1636" "https://apimap.code-craft.tech/geocoding/search?q=Damascus"; do
  curl -sS -o /dev/null -w "%{http_code} %{redirect_url}  $u\n" --max-time 20 "$u"
done
