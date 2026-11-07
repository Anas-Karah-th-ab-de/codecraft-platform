#!/usr/bin/env python3
"""Altsystem → codecraft-platform: Kunden, Projekte, Rechnungen, Kostenvoranschläge.

Erzeugt SQL für psql (eine Transaktion). Wiederholbar: Datensätze tragen ihre Alt-ID
(legacy_id) und feste UUIDs (uuid5) – bereits übernommene werden übersprungen.

Rechnungen laufen den normalen Weg Entwurf → ausgestellt → bezahlt/storniert, damit die
GoBD-Trigger greifen. Originalnummern bleiben unverändert; der Zähler für neue Rechnungen
wird auf die höchste CC-Nummer gesetzt (nächste: CC-JJJJ-(n+1)).

Aufruf:  python3 tools/legacy/import.py ~/prod-export > /tmp/import.sql
         psql -v ON_ERROR_STOP=1 -d codecraft -f /tmp/import.sql
"""
import json, re, sys, uuid
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
NS = uuid.UUID('6f1c2b8e-4a3d-5e7f-9a0b-c0dec4af7000')
J = lambda t: json.load(open(f'{SRC}/{t}.json', encoding='utf-8'))
uid = lambda kind, key: str(uuid.uuid5(NS, f'{kind}:{key}'))
problems = []


def q(v):
    """SQL-Literal"""
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int,)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def cents(x):
    return int((Decimal(str(x or 0)) * 100).quantize(Decimal('1'), ROUND_HALF_UP))


def milli(x):
    return int((Decimal(str(x or 0)) * 1000).quantize(Decimal('1'), ROUND_HALF_UP))


def ts(x):  # Prisma speichert UTC ohne Zone
    return None if not x else x.replace('T', ' ') + '+00'


def day(x):
    return None if not x else x[:10]


def clean(s):
    s = (s or '').strip()
    return s or None


def iso(x):  # wie Prisma-Date im JSON des Altsystems
    return None if not x else (x if x.endswith('Z') else x + ('.000' if '.' not in x else '') + 'Z')


def num(x):
    return float(x) if x is not None else None


def drop_none(d):
    return {k: v for k, v in d.items() if v is not None}


def norm(name):
    return re.sub(r'\s+', ' ', (name or '').strip()).casefold()


customers = J('Customer')
projects = J('Project')
invoices = J('Invoice')
inv_items = J('InvoiceItem')
quotes = J('CostProposal')
q_items = J('CostProposalItem')
q_miles = J('CostProposalMilestone')
q_pay = J('CostProposalPaymentSchedule')

# ── Kunden: nur verwendete; gleiche Firmennamen zusammenführen ──────────────
used = {i['customerId'] for i in invoices} | {c['customerId'] for c in quotes} | {
    p['customerId'] for p in projects if p.get('customerId')}
groups = defaultdict(list)
for c in customers:
    if c['id'] in used:
        groups[norm(c['companyName'])].append(c)
org_of = {}  # legacy customer id → org uuid
org_locale = {}
out = ['\\set ON_ERROR_STOP 1', 'BEGIN;', '-- Firmenvorlage für den Druck (Layout des Altsystems)']
tpl = next((t for t in J('InvoiceTemplate') if t.get('isDefault')), None)
if tpl:
    out.append(f"INSERT INTO document_templates (id, data) VALUES ('default', {q(json.dumps(tpl, ensure_ascii=False))}::jsonb)"
               f" ON CONFLICT (id) DO NOTHING;")
out.append('-- Kunden')
for key, cs in groups.items():
    oid = uid('org', key)
    refs = lambda c: sum(1 for i in invoices if i['customerId'] == c['id']) + sum(
        1 for x in quotes if x['customerId'] == c['id'])
    # Hauptdatensatz: meiste Belege, keine eigene (code-craft) Adresse als Kontakt
    main = sorted(cs, key=lambda c: (c['email'].endswith('code-craft.tech'), -refs(c), c['customerNr']))[0]
    addr_src = next((c for c in cs if clean(c.get('street'))), main)
    city = clean(addr_src.get('city')) or ''
    addr = '\n'.join(x for x in [clean(addr_src.get('street')),
                                  ' '.join(x for x in [clean(addr_src.get('postalCode')), city] if x)] if x)
    vat = next((clean(c.get('vatId')) for c in cs if clean(c.get('vatId'))), None)
    loc = main.get('locale') if main.get('locale') in ('de', 'en', 'ar') else 'de'
    for c in cs:
        org_of[c['id']] = oid
    org_locale[oid] = loc
    ids = '{' + ','.join(c['id'] for c in cs) + '}'
    out.append(
        f"INSERT INTO organizations (id, name, address, vat_id, email, locale, customer_number, contact_name, phone,"
        f" country, legacy_ids, created_at) VALUES ({q(oid)}, {q(main['companyName'].strip())}, {q(addr)}, {q(vat)},"
        f" {q(main['email'])}, {q(loc)}, {q(main['customerNr'])}, {q(clean(main.get('contactName')))},"
        f" {q(clean(main.get('phone')))}, {q((main.get('country') or '')[:2] or None)}, {q(ids)},"
        f" {q(ts(min(c['createdAt'] for c in cs)))}) ON CONFLICT (id) DO NOTHING;")

# ── Projekte ───────────────────────────────────────────────────────────────
out.append('-- Projekte')
proj_of = {}
for p in projects:
    org = org_of.get(p.get('customerId'))
    if not org:  # Kunde über Rechnungen/KV ableiten (falls eindeutig)
        cands = {org_of[i['customerId']] for i in invoices if i.get('projectId') == p['id']} | {
            org_of[x['customerId']] for x in quotes if x.get('projectId') == p['id']}
        org = cands.pop() if len(cands) == 1 else None
    pid = uid('project', p['id'])
    proj_of[p['id']] = pid
    out.append(
        f"INSERT INTO projects (id, organization_id, department_id, name, slug, code, description, status, repo_url,"
        f" start_date, target_date, completed_at, budget_hours, legacy_id, created_at) VALUES ({q(pid)}, {q(org)},"
        f" (SELECT id FROM departments WHERE code = 'DEV'), {q(p['name'].strip())}, {q(p['slug'])}, {q(p.get('code'))},"
        f" {q(p.get('description') or '')}, {q(p['status'].lower())}, {q(clean(p.get('repoUrl')))},"
        f" {q(day(p.get('startDate')))}, {q(day(p.get('targetDate')))}, {q(ts(p.get('completedAt')))},"
        f" {q(p.get('budgetHours'))}, {q(p['id'])}, {q(ts(p['createdAt']))}) ON CONFLICT (legacy_id) DO NOTHING;")

# ── Rechnungen ─────────────────────────────────────────────────────────────
out.append('-- Rechnungen')
items_by = defaultdict(list)
for it in inv_items:
    items_by[it['invoiceId']].append(it)
max_cc = defaultdict(int)
for inv in sorted(invoices, key=lambda i: i['issuedAt']):
    iid = uid('invoice', inv['id'])
    org = org_of[inv['customerId']]
    notes = inv.get('notes') or ''
    tax_mode = ('standard' if Decimal(str(inv['tax'])) > 0 else
                'reverse_charge' if re.search(r'reverse.?charge', notes, re.I) else 'not_taxable')
    unit = 'hour' if inv.get('unitType') == 'HOURS' else 'piece'
    rate_bp = int(Decimal(str(inv['taxRate'])) * 100)
    lines = []
    for it in sorted(items_by[inv['id']], key=lambda x: (x['sortOrder'], x['id'])):
        lines.append((it['description'].strip(), milli(it['quantity']), unit, cents(it['unitPrice']),
                      clean(it.get('blockTitle'))))
        if cents(it['totalPrice']) != round(milli(it['quantity']) * cents(it['unitPrice']) / 1000):
            problems.append(f"{inv['invoiceNumber']}: Positionssumme weicht ab ({it['description'][:30]})")
    disc = cents(inv.get('discountAmount') or inv.get('discount') or 0)
    if disc:
        label = clean(inv.get('discountDescription')) or 'Rabatt / Nachlass'
        lines.append((label, 1000, 'flat', -disc, None))
    net = sum(round(m * p / 1000) for _, m, _, p, _ in lines)
    gross, tax = cents(inv['total']), cents(inv['tax'])
    if net + tax != gross:
        problems.append(f"{inv['invoiceNumber']}: Netto {net} + USt {tax} ≠ Brutto {gross}")
    a = inv.get('customerAddress') or {}
    rname = clean(a.get('company')) or clean(a.get('companyName')) or inv['customerName']
    contact = clean(a.get('name'))
    raddr = '\n'.join(x for x in [contact if contact and contact != rname else None, clean(a.get('street')),
                                  ' '.join(x for x in [clean(a.get('zip')), clean(a.get('city'))] if x)] if x)
    cust = next(c for c in customers if c['id'] == inv['customerId'])
    m = re.fullmatch(r'CC-(\d{4})-(\d+)', inv['invoiceNumber'])
    if m:
        max_cc[int(m.group(1))] = max(max_cc[int(m.group(1))], int(m.group(2)))
    st = {'PAID': 'paid', 'CANCELLED': 'cancelled', 'DRAFT': 'draft'}.get(inv['status'], 'issued')
    snap = {
        'invoiceNumber': inv['invoiceNumber'], 'issuedAt': iso(inv['issuedAt']), 'dueDate': iso(inv['dueDate']),
        'serviceFrom': iso(inv.get('serviceFrom')), 'serviceTo': iso(inv.get('serviceTo')),
        'customerName': inv['customerName'], 'customerAddress': inv.get('customerAddress') or {},
        'items': [{'description': it['description'], 'quantity': num(it['quantity']), 'unitPrice': num(it['unitPrice']),
                   'totalPrice': num(it['totalPrice']), 'discount': num(it['discount']) if it.get('discount') else None,
                   'discountType': it.get('discountType')}
                  for it in sorted(items_by[inv['id']], key=lambda x: (x['sortOrder'], x['id']))],
        'subtotal': num(inv['subtotal']), 'tax': num(inv['tax']), 'taxRate': num(inv['taxRate']), 'total': num(inv['total']),
        'currency': inv['currency'], 'notes': inv.get('notes'),
        'discount': num(inv['discount']) if inv.get('discount') else None, 'discountType': inv.get('discountType'),
        'discountAmount': num(inv['discountAmount']) if inv.get('discountAmount') else None,
        'discountDescription': inv.get('discountDescription'), 'unitType': inv.get('unitType') or 'QUANTITY',
    }
    body = [
        f"INSERT INTO invoices (id, organization_id, kind, status, currency, tax_mode, locale, notes, project_id,"
        f" service_from, service_to, legacy_id, created_at, pdf_snapshot) VALUES ({q(iid)}, {q(org)}, 'invoice', 'draft',"
        f" {q(inv['currency'])}, {q(tax_mode)}, {q(org_locale[org])}, {q(notes)},"
        f" {q(proj_of.get(inv.get('projectId')))}, {q(day(inv.get('serviceFrom')))}, {q(day(inv.get('serviceTo')))},"
        f" {q(inv['id'])}, {q(ts(inv['createdAt']))}, {q(json.dumps(snap, ensure_ascii=False))}::jsonb);"]
    for n, (d, mq, u, p, blk) in enumerate(lines, 1):
        body.append(
            f"INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit, unit_price_cents,"
            f" vat_rate_bp, block_title) VALUES ({q(uid('item', f'{iid}:{n}'))}, {q(iid)}, {n}, {q(d)}, {mq}, {q(u)},"
            f" {p}, {rate_bp}, {q(blk)});")
    if st != 'draft':
        body.append(
            f"UPDATE invoices SET status = 'issued', number = {q(inv['invoiceNumber'])}, recipient_name = {q(rname)},"
            f" recipient_address = {q(raddr)}, recipient_vat_id = {q(clean(cust.get('vatId')))},"
            f" issue_date = {q(day(inv['issuedAt']))}, due_date = {q(day(inv['dueDate']))}, net_cents = {net},"
            f" tax_cents = {tax}, gross_cents = {gross}, issued_at = {q(ts(inv['issuedAt']))} WHERE id = {q(iid)};")
    if st == 'paid':
        body.append(f"UPDATE invoices SET status = 'paid', paid_at = {q(ts(inv['paidAt']))} WHERE id = {q(iid)};")
    if st == 'cancelled':
        body.append(f"UPDATE invoices SET status = 'cancelled', cancelled_at = {q(ts(inv['cancelledAt']))}"
                    f" WHERE id = {q(iid)};")
    body.append(f"INSERT INTO audit_log (actor, action, entity, entity_id, data) VALUES ('import', 'import_legacy',"
                f" 'invoice', {q(iid)}, {q(json.dumps({'number': inv['invoiceNumber'], 'legacy_id': inv['id']}))}::jsonb);")
    out.append(f"DO $imp$ BEGIN IF NOT EXISTS (SELECT 1 FROM invoices WHERE legacy_id = {q(inv['id'])}) THEN\n  "
               + '\n  '.join(body) + "\nEND IF; END $imp$;")
for year, n in max_cc.items():
    out.append(f"INSERT INTO number_sequences (series, year, last_value) VALUES ('invoice', {year}, {n})"
               f" ON CONFLICT (series, year) DO UPDATE SET last_value = GREATEST(number_sequences.last_value, {n});")

# ── Kostenvoranschläge ─────────────────────────────────────────────────────
out.append('-- Kostenvoranschläge')
max_kv = defaultdict(int)
for x in quotes:
    qid = uid('quote', x['id'])
    org = org_of[x['customerId']]
    m = re.fullmatch(r'KV-(\d{4})-(\d+)', x['proposalNr'])
    if m:
        max_kv[int(m.group(1))] = max(max_kv[int(m.group(1))], int(m.group(2)))
    rate = Decimal(str(x['taxRate']))
    tax_mode = 'reverse_charge' if x.get('reverseCharge') else ('standard' if rate > 0 else 'not_taxable')
    status = x['status'].lower() if x['status'].lower() in ('draft', 'sent', 'accepted', 'rejected', 'expired') else 'sent'
    its = sorted((i for i in q_items if i['proposalId'] == x['id']), key=lambda i: (i['sortOrder'], i['id']))
    cust = next(c for c in customers if c['id'] == x['customerId'])
    by_block = sorted(its, key=lambda i: (i.get('blockNr') is None, i.get('blockNr') or 0, i['sortOrder']))
    truthy = lambda v: num(v) if v else None
    snap = drop_none({
        'proposalNr': x['proposalNr'], 'title': x['title'], 'description': x.get('description'),
        'revision': x.get('revision'), 'projectStart': iso(x.get('projectStart')), 'projectEnd': iso(x.get('projectEnd')),
        'hourlyRate': truthy(x.get('hourlyRate')), 'discountedHourlyRate': truthy(x.get('discountedHourlyRate')),
        'totalHours': truthy(x.get('totalHours')),
        'subtotal': num(x['subtotal']), 'tax': num(x['tax']), 'taxRate': num(x['taxRate']), 'total': num(x['total']),
        'currency': x['currency'], 'reverseCharge': bool(x.get('reverseCharge')),
        'reverseChargeNote': x.get('reverseChargeNote'), 'advancePaymentPercent': x.get('advancePaymentPercent'),
        'status': x['status'], 'validUntil': iso(x.get('validUntil')), 'issuedAt': iso(x['createdAt']),
        'customerName': cust['companyName'],
        'customerAddress': drop_none({'companyName': cust['companyName'], 'street': cust.get('street'),
                                      'zip': cust.get('postalCode'), 'city': cust.get('city'), 'country': cust['country']}),
        'items': [drop_none({'blockNr': i.get('blockNr'), 'blockTitle': i.get('blockTitle'), 'positionNr': i.get('positionNr'),
                             'description': i['description'], 'quantity': num(i['quantity']), 'unit': i['unit'],
                             'unitPrice': num(i['unitPrice']), 'totalPrice': num(i['totalPrice'])}) for i in by_block],
        'milestones': [drop_none({'milestoneNr': m['milestoneNr'], 'title': m['title'], 'blocks': m.get('blocks'),
                                  'goal': m.get('goal')})
                       for m in sorted((m for m in q_miles if m['proposalId'] == x['id']), key=lambda m: m['sortOrder'])],
        'paymentSchedule': [drop_none({'dueLabel': p['dueLabel'], 'amount': num(p['amount']), 'currency': p['currency'],
                                       'description': p.get('description')})
                            for p in sorted((p for p in q_pay if p['proposalId'] == x['id']), key=lambda p: p['sortOrder'])],
        'notes': x.get('notes'),
    })
    if sum(cents(i['totalPrice']) for i in its) != cents(x['subtotal']):
        problems.append(f"{x['proposalNr']}: Positionen ≠ Zwischensumme")
    body = [
        f"INSERT INTO quotes (id, organization_id, project_id, number, title, description, revision, status, currency,"
        f" tax_mode, tax_rate_bp, tax_note, locale, valid_until, project_start, project_end, hourly_rate_cents,"
        f" discounted_rate_cents, total_hours_milli, advance_percent, net_cents, tax_cents, gross_cents, notes,"
        f" sent_at, responded_at, customer_response, legacy_id, created_at, updated_at, pdf_snapshot) VALUES ({q(qid)}, {q(org)},"
        f" {q(proj_of.get(x.get('projectId')))}, {q(x['proposalNr'])}, {q(x['title'].strip())},"
        f" {q(x.get('description') or '')}, {q(clean(x.get('revision')))}, {q(status)}, {q(x['currency'])},"
        f" {q(tax_mode)}, {int(rate * 100)}, {q(clean(x.get('reverseChargeNote')))}, {q(org_locale[org])},"
        f" {q(day(x.get('validUntil')))}, {q(day(x.get('projectStart')))}, {q(day(x.get('projectEnd')))},"
        f" {q(cents(x['hourlyRate']) if x.get('hourlyRate') is not None else None)},"
        f" {q(cents(x['discountedHourlyRate']) if x.get('discountedHourlyRate') is not None else None)},"
        f" {q(milli(x['totalHours']) if x.get('totalHours') is not None else None)},"
        f" {q(x.get('advancePaymentPercent'))}, {cents(x['subtotal'])}, {cents(x['tax'])}, {cents(x['total'])},"
        f" {q(x.get('notes') or '')}, {q(ts(x.get('sentAt')))}, {q(ts(x.get('respondedAt')))},"
        f" {q(clean(x.get('customerResponse')))}, {q(x['id'])}, {q(ts(x['createdAt']))}, {q(ts(x['updatedAt']))},"
        f" {q(json.dumps(snap, ensure_ascii=False))}::jsonb);"]
    for n, i in enumerate(its, 1):
        body.append(
            f"INSERT INTO quote_items (id, quote_id, position, block_nr, block_title, position_nr, description,"
            f" quantity_milli, unit, unit_price_cents, total_cents) VALUES ({q(uid('qitem', i['id']))}, {q(qid)}, {n},"
            f" {q(i.get('blockNr'))}, {q(clean(i.get('blockTitle')))}, {q(clean(i.get('positionNr')))},"
            f" {q(i['description'].strip())}, {milli(i['quantity'])}, {q(i['unit'])}, {cents(i['unitPrice'])},"
            f" {cents(i['totalPrice'])});")
    for n, ms in enumerate(sorted((m for m in q_miles if m['proposalId'] == x['id']),
                                  key=lambda m: (m['sortOrder'], m['id'])), 1):
        body.append(
            f"INSERT INTO quote_milestones (id, quote_id, position, label, title, blocks, goal) VALUES"
            f" ({q(uid('qms', ms['id']))}, {q(qid)}, {n}, {q(ms['milestoneNr'])}, {q(ms['title'])},"
            f" {q(clean(ms.get('blocks')))}, {q(clean(ms.get('goal')))});")
    for n, pm in enumerate(sorted((p for p in q_pay if p['proposalId'] == x['id']),
                                  key=lambda p: (p['sortOrder'], p['id'])), 1):
        body.append(
            f"INSERT INTO quote_payments (id, quote_id, position, label, due_date, amount_cents, currency, description,"
            f" paid_at) VALUES ({q(uid('qpay', pm['id']))}, {q(qid)}, {n}, {q(pm['dueLabel'])}, {q(day(pm.get('dueDate')))},"
            f" {cents(pm['amount'])}, {q(pm['currency'])}, {q(clean(pm.get('description')))}, {q(ts(pm.get('paidAt')))});")
    out.append(f"DO $imp$ BEGIN IF NOT EXISTS (SELECT 1 FROM quotes WHERE legacy_id = {q(x['id'])}) THEN\n  "
               + '\n  '.join(body) + "\nEND IF; END $imp$;")
for year, n in max_kv.items():
    out.append(f"INSERT INTO number_sequences (series, year, last_value) VALUES ('proposal', {year}, {n})"
               f" ON CONFLICT (series, year) DO UPDATE SET last_value = GREATEST(number_sequences.last_value, {n});")

out.append('COMMIT;')
if problems:
    sys.stderr.write('PRÜFUNG FEHLGESCHLAGEN:\n  ' + '\n  '.join(problems) + '\n')
    sys.exit(1)
sys.stderr.write(f'OK: {len(groups)} Kunden, {len(projects)} Projekte, {len(invoices)} Rechnungen, '
                 f'{len(quotes)} Kostenvoranschläge\n')
print('\n'.join(out))
