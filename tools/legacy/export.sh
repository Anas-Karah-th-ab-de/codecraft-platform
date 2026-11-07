#!/usr/bin/env bash
# Altsystem (employee_portal, Prisma) lesend exportieren: Vollsicherung + JSON je Tabelle.
# Aufruf: tools/legacy/export.sh [root@194.62.29.64] [~/prod-export]
# Die Ausgabe enthält Kundendaten und Passwort-Hashes → nie ins Git.
set -euo pipefail
HOST=${1:-root@194.62.29.64}
OUT=${2:-$HOME/prod-export}
mkdir -p "$OUT"; chmod 700 "$OUT"
S="ssh -o BatchMode=yes $HOST"
TS=$(date +%Y%m%d-%H%M)
$S "docker exec codecraft-postgres pg_dump -U codecraft -Fc employee_portal" > "$OUT/employee_portal-$TS.dump"
for t in InvoiceTemplate Customer Project Invoice InvoiceItem CostProposal CostProposalItem CostProposalMilestone CostProposalPaymentSchedule; do
  $S "docker exec codecraft-postgres psql -U codecraft -d employee_portal -At -c \"select coalesce(json_agg(t),'[]') from \\\"$t\\\" t\"" > "$OUT/$t.json"
  echo "$t: $(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))))" "$OUT/$t.json")"
done
chmod 600 "$OUT"/*
echo "Export: $OUT"
