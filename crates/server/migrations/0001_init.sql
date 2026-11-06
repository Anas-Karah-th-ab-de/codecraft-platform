-- KM Code Craft Plattform – Grundschema
-- Konventionen: UUID-PKs, Beträge in Cent (BIGINT), Zeitstempel TIMESTAMPTZ.

CREATE TABLE organizations (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
    address     TEXT NOT NULL DEFAULT '',
    vat_id      TEXT,
    email       TEXT,
    locale      TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de', 'en', 'ar')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('customer','trainee','staff','manager','lead','admin')),
    organization_id UUID REFERENCES organizations(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Kunden gehören immer zu einer Organisation
    CHECK (role <> 'customer' OR organization_id IS NOT NULL)
);

-- API-Tokens (Portal-Sessions, Integrationen). Gespeichert wird nur der SHA-256-Hash.
CREATE TABLE api_tokens (
    id          UUID PRIMARY KEY,
    token_hash  TEXT NOT NULL UNIQUE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ
);

-- Lückenlose Belegnummern je Serie und Jahr (Vergabe in derselben Transaktion wie die Ausstellung)
CREATE TABLE number_sequences (
    series      TEXT NOT NULL,
    year        INT  NOT NULL,
    last_value  BIGINT NOT NULL,
    PRIMARY KEY (series, year)
);

CREATE TABLE invoices (
    id                  UUID PRIMARY KEY,
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    kind                TEXT NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice', 'credit_note')),
    corrects_invoice_id UUID REFERENCES invoices(id),
    number              TEXT UNIQUE,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','cancelled')),
    currency            CHAR(3) NOT NULL DEFAULT 'EUR',
    tax_mode            TEXT NOT NULL DEFAULT 'standard' CHECK (tax_mode IN ('standard','reverse_charge','not_taxable')),
    locale              TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de', 'en', 'ar')),
    notes               TEXT NOT NULL DEFAULT '',
    -- beim Ausstellen eingefroren
    recipient_name      TEXT,
    recipient_address   TEXT,
    recipient_vat_id    TEXT,
    issue_date          DATE,
    due_date            DATE,
    net_cents           BIGINT,
    tax_cents           BIGINT,
    gross_cents         BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_at           TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    CHECK (status = 'draft' OR (number IS NOT NULL AND issued_at IS NOT NULL AND gross_cents IS NOT NULL)),
    CHECK (kind = 'invoice' OR corrects_invoice_id IS NOT NULL)
);
CREATE INDEX invoices_org_idx ON invoices (organization_id, created_at DESC);
CREATE INDEX invoices_status_idx ON invoices (status);

CREATE TABLE invoice_items (
    id                UUID PRIMARY KEY,
    invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position          INT  NOT NULL,
    description       TEXT NOT NULL,
    quantity_milli    BIGINT NOT NULL,
    unit              TEXT NOT NULL CHECK (unit IN ('hour','piece','day','month','flat')),
    unit_price_cents  BIGINT NOT NULL,
    vat_rate_bp       INT NOT NULL CHECK (vat_rate_bp BETWEEN 0 AND 10000),
    UNIQUE (invoice_id, position)
);

-- ── GoBD: Festschreibung ausgestellter Belege auf DB-Ebene ──────────────────
CREATE FUNCTION invoices_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'draft' THEN
            RAISE EXCEPTION 'Beleg % ist festgeschrieben und kann nicht gelöscht werden', OLD.number
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status <> 'draft'
       AND (to_jsonb(NEW) - 'status' - 'paid_at' - 'cancelled_at')
           IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'paid_at' - 'cancelled_at') THEN
        RAISE EXCEPTION 'Beleg % ist festgeschrieben – nur Status/Zahlung/Storno änderbar', OLD.number
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER invoices_guard_trg BEFORE UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION invoices_guard();

CREATE FUNCTION invoice_items_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    st TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT status INTO st FROM invoices WHERE id = OLD.invoice_id;
    ELSE
        SELECT status INTO st FROM invoices WHERE id = NEW.invoice_id;
    END IF;
    -- st IS NULL: Rechnung wird gerade per CASCADE gelöscht (nur bei Entwürfen möglich)
    IF st IS NOT NULL AND st <> 'draft' THEN
        RAISE EXCEPTION 'Positionen eines ausgestellten Belegs sind unveränderlich'
            USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER invoice_items_guard_trg BEFORE INSERT OR UPDATE OR DELETE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION invoice_items_guard();

-- ── Geräte (Agent, ESP32, KI-Appliance, POS) ────────────────────────────────
CREATE TABLE devices (
    id                  UUID PRIMARY KEY,
    organization_id     UUID REFERENCES organizations(id),
    kind                TEXT NOT NULL CHECK (kind IN ('agent','esp32','ai_appliance','pos')),
    name                TEXT NOT NULL,
    token_hash          TEXT NOT NULL UNIQUE,
    license_expires_at  TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    version             TEXT,
    last_seen_at        TIMESTAMPTZ,
    last_report         JSONB,
    report_interval_s   INT NOT NULL DEFAULT 60 CHECK (report_interval_s BETWEEN 10 AND 86400),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE device_events (
    id          BIGSERIAL PRIMARY KEY,
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    level       TEXT NOT NULL,
    code        TEXT NOT NULL,
    message     TEXT NOT NULL
);
CREATE INDEX device_events_idx ON device_events (device_id, at DESC);

-- ── Audit-Log (append-only) ──────────────────────────────────────────────────
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   UUID,
    data        JSONB NOT NULL DEFAULT '{}'
);

CREATE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log ist append-only' USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER audit_log_append_only_trg BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
