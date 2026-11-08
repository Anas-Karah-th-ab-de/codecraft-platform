#!/bin/bash
# Läuft auf dem Server (von maps.sh gestartet). Idempotent.
set -euo pipefail
cd /opt/maps-sy
set -a; . ./.env; set +a
log() { echo "[$(date '+%F %T')] $*"; }

# App-Download (Weboberfläche verlinkt /downloads/app-release.apk)
mkdir -p app/build/app/outputs/flutter-apk
APK=$(ls -1 *.apk 2>/dev/null | head -1 || true)
[ -n "$APK" ] && cp -f "$APK" app/build/app/outputs/flutter-apk/app-release.apk

command -v osm2pgsql >/dev/null || { log "osm2pgsql installieren"; DEBIAN_FRONTEND=noninteractive apt-get install -y -q osm2pgsql; }

PBF=data/osm/syria-latest.osm.pbf
if [ ! -s "$PBF" ]; then
  log "OSM Syrien laden"
  wget -q -O "$PBF.tmp" https://download.geofabrik.de/asia/syria-latest.osm.pbf
  wget -q -O "$PBF.md5" https://download.geofabrik.de/asia/syria-latest.osm.pbf.md5
  [ "$(md5sum < "$PBF.tmp" | cut -d' ' -f1)" = "$(cut -d' ' -f1 "$PBF.md5")" ] || { log "MD5 falsch"; exit 1; }
  mv "$PBF.tmp" "$PBF"
fi
ls -lh "$PBF"

log "Postgres starten"
docker compose up -d postgres
until [ "$(docker inspect -f '{{.State.Health.Status}}' maps_postgres)" = healthy ]; do sleep 3; done
bash infra/init_db.sh

if ! docker exec maps_postgres psql -U mapssy -d mapssy -tAc "select to_regclass('planet_osm_line')" | grep -q planet; then
  log "osm2pgsql Import"
  docker exec maps_postgres psql -U mapssy -d mapssy -c "CREATE EXTENSION IF NOT EXISTS hstore;"
  PGPASSWORD="$POSTGRES_PASSWORD" osm2pgsql --host 127.0.0.1 --port 5432 --username mapssy --database mapssy \
    --slim --hstore --number-processes 6 --cache 4096 "$PBF"
  docker exec maps_postgres psql -U mapssy -d mapssy -c "
    CREATE INDEX IF NOT EXISTS planet_osm_line_highway_idx ON planet_osm_line (highway) WHERE highway IS NOT NULL;"
  for t in line point polygon; do docker exec maps_postgres psql -U mapssy -d mapssy -c "VACUUM ANALYZE planet_osm_$t"; done
fi

log "Images bauen und alle Dienste starten"
docker compose build -q
docker compose up -d
log "warte auf Backend (Migrationen)"
for i in $(seq 1 120); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' maps_backend 2>/dev/null)" = healthy ] && break; sleep 5
done
docker inspect -f 'backend: {{.State.Health.Status}}' maps_backend

log "Kartenansichten nachziehen"
for m in 013_fix_mobile_tile_views 015_mobile_buildings_height 016_ai_verified_features 017_fix_mobile_buildings_roads_srid 018_multilingual_mobile_labels 019_multilingual_names; do
  docker exec -i maps_postgres psql -q -v ON_ERROR_STOP=1 -U mapssy -d mapssy < backend/db/migrations/$m.sql || log "Hinweis: $m"
done
docker exec maps_postgres psql -U mapssy -d mapssy -c "SELECT refresh_mobile_label_views();" || true
docker compose restart martin

log "fertig – Valhalla-Kacheln und Nominatim bauen weiter im Hintergrund"
docker compose ps --format '{{.Name}} {{.Status}}'
