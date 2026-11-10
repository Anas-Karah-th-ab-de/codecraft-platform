-- Kassensystem: Paket-Schlüssel (vom Admin erzeugt, in der Kasse eingelöst) und Fehlerberichte.

CREATE TABLE pos_keys (
    id              UUID PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,
    -- license = Abo-Paket (plan + days), ai = KI-Einheiten
    kind            TEXT NOT NULL CHECK (kind IN ('license', 'ai')),
    plan            TEXT CHECK (plan IN ('basic', 'pro', 'business')),
    days            INTEGER CHECK (days BETWEEN 1 AND 3660),
    units           INTEGER CHECK (units BETWEEN 1 AND 1000000),
    note            TEXT,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'redeemed', 'revoked')),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    redeemed_at     TIMESTAMPTZ,
    organization_id UUID REFERENCES organizations(id),
    tenant_id       TEXT,
    business_name   TEXT,
    license_id      UUID REFERENCES pos_licenses(id),
    CHECK ((kind = 'license' AND plan IS NOT NULL AND days IS NOT NULL) OR (kind = 'ai' AND units IS NOT NULL))
);
CREATE INDEX pos_keys_status ON pos_keys(status, created_at DESC);

-- Fehlerberichte aus der Kasse: landen als Ticket; Details (Protokoll, Gerät) hier
ALTER TABLE tickets ADD COLUMN source TEXT NOT NULL DEFAULT 'portal';
CREATE TABLE pos_reports (
    id              UUID PRIMARY KEY,
    ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    register_id     UUID REFERENCES pos_registers(id),
    tenant_id       TEXT NOT NULL,
    business_name   TEXT NOT NULL,
    app_version     TEXT,
    platform        TEXT,
    diagnostics     JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pos_reports_ticket ON pos_reports(ticket_id);
