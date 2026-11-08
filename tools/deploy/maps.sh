#!/bin/bash
# Maps Syria (maps.code-craft.tech / apimap.code-craft.tech) auf dem Produktionsserver neu aufsetzen.
# Kopiert ~/maps-sy-1 nach /opt/maps-sy, neue DB-Passwörter, nginx-Container nur auf 127.0.0.1:8081
# (TLS macht der Host-nginx), OSM-Daten frisch von Geofabrik, danach Import im Hintergrund.
set -euo pipefail
HOST=root@194.62.29.64
SRC=~/maps-sy-1

rsync -az --delete --exclude .git --exclude .env --exclude 'data/osm/*.osm.pbf' \
  --exclude 'data/osm/offline_packages' "$SRC/" $HOST:/opt/maps-sy/

# .env: übernehmen, DB-Passwörter neu, Ports lokal
PG=$(openssl rand -hex 24); NM=$(openssl rand -hex 24)
grep -vE '^(POSTGRES_PASSWORD|NOMINATIM_PASSWORD|NGINX_HTTP_PORT|NGINX_HTTPS_PORT|#.?PGPASSWORD)=' "$SRC/.env" \
  | sed '/^#.PGPASSWORD/d' > /tmp/maps.env
printf 'POSTGRES_PASSWORD=%s\nNOMINATIM_PASSWORD=%s\nNGINX_HTTP_PORT=127.0.0.1:8081\nNGINX_HTTPS_PORT=127.0.0.1:8443\n' "$PG" "$NM" >> /tmp/maps.env
ssh -o BatchMode=yes $HOST 'test -f /opt/maps-sy/.env' || scp -q /tmp/maps.env $HOST:/opt/maps-sy/.env
rm -f /tmp/maps.env

scp -q "$(dirname "$0")/maps-remote.sh" $HOST:/opt/maps-sy/maps-remote.sh
ssh -o BatchMode=yes $HOST 'chmod 600 /opt/maps-sy/.env; chmod 755 /opt/maps-sy/maps-remote.sh
  nohup /opt/maps-sy/maps-remote.sh > /var/log/maps-deploy.log 2>&1 &
  echo "läuft im Hintergrund: tail -f /var/log/maps-deploy.log"'
