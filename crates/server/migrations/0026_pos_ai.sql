-- KI-Einheiten für den Kassen-Assistenten: Kauf (Gutschrift je Firma) und API-Verbrauch.
-- Gutschriften werden beim Abholen durch die Kasse an deren Betrieb (tenant_id) gebunden und signiert.
CREATE TABLE pos_ai_credits (
    id              UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    units           INTEGER NOT NULL CHECK (units BETWEEN 1 AND 1000000),
    note            TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id       TEXT,
    delivered_at    TIMESTAMPTZ,
    code            TEXT
);
CREATE INDEX pos_ai_credits_org ON pos_ai_credits(organization_id);

-- Antworten über die code-craft.tech-API (serverseitig gezählt)
CREATE TABLE pos_ai_usage (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    register_id     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pos_ai_usage_org ON pos_ai_usage(organization_id, created_at);
