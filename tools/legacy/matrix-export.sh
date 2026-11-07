#!/usr/bin/env bash
# Matrix/Synapse-Verlauf NUR LESEND als Archiv sichern (JSON, eine Nachricht je Zeile).
# Ergebnis: ~/prod-export/matrix/messages.jsonl + rooms.txt + users.txt  (nie ins Git!)
set -euo pipefail
HOST=${PROD_HOST:-root@194.62.29.64}
OUT=${OUT:-$HOME/prod-export/matrix}
mkdir -p "$OUT"; chmod 700 "$OUT"
q() { ssh -o BatchMode=yes "$HOST" "docker exec codecraft-postgres psql -U synapse -d synapse -At -c \"$1\""; }
q "select json_build_object('room', e.room_id, 'room_name', s.name, 'sender', e.sender, 'ts', to_timestamp(e.origin_server_ts/1000.0), 'content', (j.json::json)->'content')
   from events e join event_json j using (event_id) left join room_stats_state s on s.room_id = e.room_id
   where e.type = 'm.room.message' order by e.origin_server_ts" > "$OUT/messages.jsonl"
q "select room_id || ' | ' || coalesce(name,'') from room_stats_state order by 1" > "$OUT/rooms.txt"
q "select u.name || ' | ' || coalesce(p.displayname,'') from users u left join profiles p on p.full_user_id = u.name order by 1" > "$OUT/users.txt"
wc -l "$OUT"/*
