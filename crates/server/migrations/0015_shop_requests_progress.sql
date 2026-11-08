-- Shop (Bestellungen aus dem Katalog), Entwicklungsanfragen, Projektfortschritt.

CREATE SEQUENCE order_number_seq;
CREATE SEQUENCE request_number_seq;

-- ── Bestellungen ─────────────────────────────────────────────────────────────
-- Bezahlt wird per Rechnung: Mitarbeiter bestätigen und erzeugen daraus einen Rechnungsentwurf.
CREATE TABLE orders (
    id              UUID PRIMARY KEY,
    number          TEXT NOT NULL UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'confirmed', 'invoiced', 'delivered', 'cancelled')),
    currency        CHAR(3) NOT NULL,
    net_cents       BIGINT NOT NULL CHECK (net_cents >= 0),
    note            TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
    invoice_id      UUID REFERENCES invoices(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_org ON orders (organization_id, created_at DESC);

CREATE TABLE order_items (
    id               UUID PRIMARY KEY,
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES products(id),
    price_id         UUID NOT NULL REFERENCES product_prices(id),
    -- Momentaufnahme zum Bestellzeitpunkt
    name             TEXT NOT NULL,
    billing          TEXT NOT NULL,
    quantity         INT NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
    unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
    total_cents      BIGINT NOT NULL CHECK (total_cents >= 0)
);
CREATE INDEX order_items_order ON order_items (order_id);

-- ── Entwicklungsanfragen ─────────────────────────────────────────────────────
CREATE TABLE dev_requests (
    id              UUID PRIMARY KEY,
    number          TEXT NOT NULL UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    kind            TEXT NOT NULL DEFAULT 'new_project'
                    CHECK (kind IN ('new_project', 'feature', 'change', 'integration', 'other')),
    title           TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
    description     TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 20000),
    budget          TEXT CHECK (length(budget) <= 100),
    desired_date    DATE,
    status          TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'in_review', 'quoted', 'accepted', 'rejected', 'in_progress', 'done')),
    project_id      UUID REFERENCES projects(id),
    quote_id        UUID REFERENCES quotes(id),
    legacy_id       TEXT UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dev_requests_org ON dev_requests (organization_id, created_at DESC);

CREATE TABLE dev_request_messages (
    id          UUID PRIMARY KEY,
    request_id  UUID NOT NULL REFERENCES dev_requests(id) ON DELETE CASCADE,
    author_id   UUID REFERENCES users(id),
    body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dev_request_messages_req ON dev_request_messages (request_id, created_at);

-- ── Projektfortschritt ───────────────────────────────────────────────────────
-- Fortschritt = Anteil erledigter Meilensteine; ohne Meilensteine der manuelle Wert.
ALTER TABLE projects ADD COLUMN progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100);

CREATE TABLE project_milestones (
    id          UUID PRIMARY KEY,
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position    INT NOT NULL DEFAULT 0,
    title       TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    description TEXT NOT NULL DEFAULT '',
    due_date    DATE,
    status      TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done')),
    done_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_milestones_project ON project_milestones (project_id, position);

CREATE TABLE project_updates (
    id           UUID PRIMARY KEY,
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id    UUID REFERENCES users(id),
    body         TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
    -- false = interne Notiz (Kunde sieht sie nicht)
    for_customer BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_updates_project ON project_updates (project_id, created_at DESC);
