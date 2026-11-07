-- Projekte, Kostenvoranschläge (KV) und Felder für die Übernahme aus dem Altsystem.
-- legacy_id: ID im Altsystem (Prisma/cuid) → Import ist wiederholbar ohne Doppelungen.

ALTER TABLE organizations
    ADD COLUMN customer_number TEXT UNIQUE,
    ADD COLUMN contact_name    TEXT,
    ADD COLUMN phone           TEXT,
    ADD COLUMN country         CHAR(2),
    ADD COLUMN legacy_ids      TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE projects (
    id               UUID PRIMARY KEY,
    organization_id  UUID REFERENCES organizations(id),   -- NULL = internes Projekt
    department_id    UUID REFERENCES departments(id),
    name             TEXT NOT NULL CHECK (length(trim(name)) > 0),
    slug             TEXT NOT NULL UNIQUE,
    code             TEXT,
    description      TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'planning'
                     CHECK (status IN ('planning','active','on_hold','completed','archived')),
    repo_url         TEXT,
    start_date       DATE,
    target_date      DATE,
    completed_at     TIMESTAMPTZ,
    budget_hours     INT,
    legacy_id        TEXT UNIQUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX projects_org_idx ON projects (organization_id);

-- Rechnungen: Projektbezug, Leistungszeitraum, Herkunft.
-- Diese Spalten werden wie alle anderen beim Ausstellen festgeschrieben (invoices_guard).
ALTER TABLE invoices
    ADD COLUMN project_id   UUID REFERENCES projects(id),
    ADD COLUMN service_from DATE,
    ADD COLUMN service_to   DATE,
    ADD COLUMN legacy_id    TEXT UNIQUE;
CREATE INDEX invoices_project_idx ON invoices (project_id);

ALTER TABLE invoice_items ADD COLUMN block_title TEXT;

-- Kostenvoranschläge / Angebote
CREATE TABLE quotes (
    id                    UUID PRIMARY KEY,
    organization_id       UUID NOT NULL REFERENCES organizations(id),
    project_id            UUID REFERENCES projects(id),
    number                TEXT NOT NULL UNIQUE,
    title                 TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    revision              TEXT,
    status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent','accepted','rejected','expired')),
    currency              CHAR(3) NOT NULL DEFAULT 'EUR',
    tax_mode              TEXT NOT NULL DEFAULT 'standard'
                          CHECK (tax_mode IN ('standard','reverse_charge','not_taxable')),
    tax_rate_bp           INT NOT NULL DEFAULT 0,
    tax_note              TEXT,
    locale                TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de','en','ar')),
    valid_until           DATE,
    project_start         DATE,
    project_end           DATE,
    hourly_rate_cents     BIGINT,
    discounted_rate_cents BIGINT,
    total_hours_milli     BIGINT,
    advance_percent       INT CHECK (advance_percent BETWEEN 0 AND 100),
    net_cents             BIGINT NOT NULL,
    tax_cents             BIGINT NOT NULL,
    gross_cents           BIGINT NOT NULL,
    notes                 TEXT NOT NULL DEFAULT '',
    sent_at               TIMESTAMPTZ,
    responded_at          TIMESTAMPTZ,
    customer_response     TEXT,
    legacy_id             TEXT UNIQUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quotes_org_idx ON quotes (organization_id);
CREATE INDEX quotes_project_idx ON quotes (project_id);

CREATE TABLE quote_items (
    id               UUID PRIMARY KEY,
    quote_id         UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    position         INT  NOT NULL,
    block_nr         INT,
    block_title      TEXT,
    position_nr      TEXT,
    description      TEXT NOT NULL,
    quantity_milli   BIGINT NOT NULL,
    unit             TEXT NOT NULL,          -- frei (z. B. „Std.“, „حزمة“)
    unit_price_cents BIGINT NOT NULL,
    total_cents      BIGINT NOT NULL,
    UNIQUE (quote_id, position)
);

CREATE TABLE quote_milestones (
    id        UUID PRIMARY KEY,
    quote_id  UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    position  INT  NOT NULL,
    label     TEXT NOT NULL,                 -- z. B. M1
    title     TEXT NOT NULL,
    blocks    TEXT,
    goal      TEXT,
    UNIQUE (quote_id, position)
);

CREATE TABLE quote_payments (
    id           UUID PRIMARY KEY,
    quote_id     UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    position     INT  NOT NULL,
    label        TEXT NOT NULL,              -- z. B. „Vor Projektstart“
    due_date     DATE,
    amount_cents BIGINT NOT NULL,
    currency     CHAR(3) NOT NULL,
    description  TEXT,
    paid_at      TIMESTAMPTZ,
    UNIQUE (quote_id, position)
);
