-- Support-Tickets mit Priorität nach Servicevertrag (SLA) der Firma.
--   basic    = ohne Vertrag
--   business = Wartungsvertrag / gekaufte Geräte mit Support
--   premium  = Premium-Support (kürzeste Reaktionszeiten)
ALTER TABLE organizations
    ADD COLUMN sla TEXT NOT NULL DEFAULT 'basic' CHECK (sla IN ('basic', 'business', 'premium'));

CREATE SEQUENCE ticket_number_seq;

CREATE TABLE tickets (
    id                UUID PRIMARY KEY,
    number            TEXT NOT NULL UNIQUE,
    organization_id   UUID REFERENCES organizations(id),          -- NULL = intern
    created_by        UUID NOT NULL REFERENCES users(id),
    subject           TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 3 AND 200),
    category          TEXT NOT NULL DEFAULT 'support'
                      CHECK (category IN ('support', 'device', 'software', 'billing', 'feature', 'other')),
    device_id         UUID REFERENCES devices(id),
    project_id        UUID REFERENCES projects(id),
    -- Dringlichkeit laut Kunde, SLA zum Zeitpunkt der Anlage, daraus berechnete Priorität (1 = höchste)
    urgency           TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
    sla               TEXT NOT NULL DEFAULT 'basic' CHECK (sla IN ('basic', 'business', 'premium')),
    priority          SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 5),
    status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
    assignee_id       UUID REFERENCES users(id),
    department_id     UUID REFERENCES departments(id),
    response_due_at   TIMESTAMPTZ NOT NULL,
    first_response_at TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tickets_queue ON tickets (status, priority, response_due_at);
CREATE INDEX tickets_org ON tickets (organization_id, created_at DESC);
CREATE INDEX tickets_assignee ON tickets (assignee_id) WHERE status NOT IN ('resolved', 'closed');

CREATE TABLE ticket_messages (
    id          UUID PRIMARY KEY,
    ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id   UUID REFERENCES users(id),
    body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
    -- interne Notiz: nur für Mitarbeiter sichtbar
    internal    BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_messages_ticket ON ticket_messages (ticket_id, created_at);
