#!/bin/bash
# Tägliche Sicherung auf dem Produktionsserver: Datenbank (pg_dump) und Medien, 14 Tage aufbewahrt.
# Einrichtung und Wiederherstellung: siehe README.md, Abschnitt „Datensicherung“.
# Ohne /etc/codecraft/backup.env bleibt die Sicherung nur lokal; mit BACKUP_REMOTE wird sie
# zusätzlich auf den Backup-Server übertragen.
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

# Übertragung auf den Backup-Server (erst aktiv, wenn BACKUP_REMOTE gesetzt ist)
BACKUP_REMOTE=""
BACKUP_SSH_KEY=/root/.ssh/codecraft_backup
BACKUP_SSH_PORT=22
[ -f /etc/codecraft/backup.env ] && . /etc/codecraft/backup.env
if [ -n "$BACKUP_REMOTE" ]; then
  rsync -a --chmod=F600,D700 \
    -e "ssh -i $BACKUP_SSH_KEY -p $BACKUP_SSH_PORT -o BatchMode=yes -o StrictHostKeyChecking=yes" \
    "$D/" "$BACKUP_REMOTE/"
  echo "Sicherung übertragen nach $BACKUP_REMOTE"
else
  echo "Sicherung nur lokal (kein BACKUP_REMOTE gesetzt)"
fi
