-- Kassensystem (universal-pos-erp): Lizenzen, verknüpfte Kassen, verschlüsselte Backups.
-- Kunden ohne Lizenz/Kasse sehen im Portal nichts davon.

CREATE TABLE pos_licenses (
    id              UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    plan            TEXT NOT NULL CHECK (plan IN ('basic', 'pro', 'business')),
    slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'),
    -- available = gekauft, noch keiner Kasse zugeordnet; active = an Betrieb (tenant_id) gebunden
    status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'active', 'revoked')),
    tenant_id       TEXT,
    register_id     UUID,
    signed_key      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at    TIMESTAMPTZ,
    note            TEXT
);
CREATE INDEX pos_licenses_org ON pos_licenses(organization_id);

-- Master-Kassen, die mit dem Portal verbunden sind (eigener Zugangsschlüssel, kein Benutzer-Token)
CREATE TABLE pos_registers (
    id              UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,
    linked_by       UUID REFERENCES users(id),
    app_version     TEXT,
    platform        TEXT,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX pos_registers_org ON pos_registers(organization_id);

ALTER TABLE pos_licenses ADD CONSTRAINT pos_licenses_register FOREIGN KEY (register_id) REFERENCES pos_registers(id);

-- Backups: Ende-zu-Ende verschlüsselt (Schlüssel nur beim Kunden: Wiederherstellungscode)
CREATE TABLE pos_backups (
    id              UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    register_id     UUID REFERENCES pos_registers(id),
    tenant_id       TEXT NOT NULL,
    business_name   TEXT,
    size_bytes      BIGINT NOT NULL,
    sha256          TEXT NOT NULL,
    app_version     TEXT,
    path            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pos_backups_org ON pos_backups(organization_id, created_at DESC);
