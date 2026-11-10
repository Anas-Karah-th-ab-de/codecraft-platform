#!/bin/bash
# Tägliche Sicherung auf dem Produktionsserver: Datenbank (pg_dump) und Medien, 14 Tage aufbewahrt.
# Einrichtung: nach /usr/local/sbin/codecraft-backup kopieren, Timer codecraft-backup.timer (täglich 02:30 UTC).
# Liegt auf demselben Server – schützt vor Bedienfehlern und defekten Daten, nicht vor Serververlust.
set -euo pipefail
umask 077
D=/var/backups/codecraft
mkdir -p "$D"
TS=$(date -u +%Y%m%d-%H%M)
export PGPASSWORD=$(cat /etc/codecraft/db.pass)
pg_dump -h 127.0.0.1 -p 5434 -U codecraft -Fc codecraft > "$D/db-$TS.dump.tmp"
mv "$D/db-$TS.dump.tmp" "$D/db-$TS.dump"
M=$(grep '^MEDIA_DIR=' /etc/codecraft/server.env | cut -d= -f2-)
if [ -n "$M" ] && [ -d "$M" ]; then tar -czf "$D/media-$TS.tar.gz" -C "$M" .; fi
find "$D" -type f -mtime +14 -delete
