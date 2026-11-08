-- Zahlungsarten (vom Admin gepflegt), Standard je Kunde, Auswahl je Beleg;
-- Verträge als Angebotsart; mündliche Vereinbarung durch das Team.

CREATE TABLE payment_methods (
    id          UUID PRIMARY KEY,
    kind        TEXT NOT NULL CHECK (kind IN ('shamcash', 'bank', 'cash', 'paypal', 'other')),
    name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    -- payee, provider, account, account_label, bic, address, note – nur in der DB, nie im Git
    details     JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
    is_default  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort        INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (NOT is_default OR is_active)
);
-- genau eine Standard-Zahlungsart
CREATE UNIQUE INDEX payment_methods_one_default ON payment_methods (is_default) WHERE is_default;

-- ShamCash als Standard (Kontodaten trägt der Admin ein), Banküberweisung aus der bisherigen Firmenvorlage
INSERT INTO payment_methods (id, kind, name, is_default, sort)
VALUES ('01900000-0000-7000-8000-00000000a001', 'shamcash', 'ShamCash', true, 0);
INSERT INTO payment_methods (id, kind, name, details, sort)
SELECT '01900000-0000-7000-8000-00000000a002', 'bank', 'Banküberweisung',
       COALESCE((SELECT jsonb_strip_nulls(jsonb_build_object(
                    'payee', data->>'payeeName', 'provider', data->>'bankName', 'account', data->>'bankIban',
                    'bic', data->>'bankBic', 'address', data->>'bankAddress'))
                   FROM document_templates WHERE id = 'default'), '{}'),
       1;

ALTER TABLE organizations ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id);
ALTER TABLE invoices ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id);
-- beim Ausstellen eingefrorene Zahlungsdaten (spätere Änderungen ändern keine Rechnung)
ALTER TABLE invoices ADD COLUMN payment_snapshot JSONB;
ALTER TABLE quotes ADD COLUMN payment_method_id UUID REFERENCES payment_methods(id);

-- Zahlungsart vorbelegen: Beleg → Kunde → Standard
CREATE FUNCTION payment_method_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.payment_method_id IS NULL THEN
        NEW.payment_method_id := COALESCE(
            (SELECT o.payment_method_id FROM organizations o JOIN payment_methods p ON p.id = o.payment_method_id
              WHERE o.id = NEW.organization_id AND p.is_active),
            (SELECT id FROM payment_methods WHERE is_default));
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER invoices_payment_default BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION payment_method_default();
CREATE TRIGGER quotes_payment_default BEFORE INSERT ON quotes
    FOR EACH ROW EXECUTE FUNCTION payment_method_default();

-- Beim Ausstellen Zahlungsdaten festschreiben
CREATE FUNCTION invoices_payment_freeze() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'draft' AND NEW.status <> 'draft' AND NEW.payment_snapshot IS NULL THEN
        NEW.payment_snapshot := (SELECT jsonb_build_object('kind', kind, 'name', name, 'details', details)
                                   FROM payment_methods WHERE id = NEW.payment_method_id);
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER invoices_payment_freeze BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION invoices_payment_freeze();

-- Verträge & mündliche Vereinbarung
ALTER TABLE quotes
    ADD COLUMN doc_kind         TEXT NOT NULL DEFAULT 'quote' CHECK (doc_kind IN ('quote', 'contract')),
    ADD COLUMN contract_start   DATE,
    ADD COLUMN contract_end     DATE,
    ADD COLUMN billing_interval TEXT CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly')),
    ADD COLUMN recurring_cents  BIGINT CHECK (recurring_cents >= 0),
    ADD COLUMN notice_days      INT CHECK (notice_days BETWEEN 0 AND 730),
    ADD COLUMN accepted_via     TEXT CHECK (accepted_via IN ('customer', 'verbal')),
    ADD COLUMN accepted_by      UUID REFERENCES users(id),
    ADD COLUMN acceptance_note  TEXT,
    ADD CONSTRAINT quotes_contract_fields CHECK (
        doc_kind = 'quote' OR (contract_start IS NOT NULL AND billing_interval IS NOT NULL AND recurring_cents IS NOT NULL)),
    ADD CONSTRAINT quotes_contract_dates CHECK (contract_end IS NULL OR contract_end >= contract_start);
UPDATE quotes SET accepted_via = 'customer' WHERE status = 'accepted';
