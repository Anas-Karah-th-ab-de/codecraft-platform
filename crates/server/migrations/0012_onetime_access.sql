-- Einmal-Passwörter: nach Vergabe durch Admin muss der Benutzer beim ersten Login ein eigenes setzen.
-- Bis dahin: kein Portal, kein Mail-Login.
ALTER TABLE users
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false,
    -- ID im Altsystem (User bzw. Customer) → Übernahme ist wiederholbar
    ADD COLUMN legacy_id TEXT UNIQUE;

-- Fernzugriff auf Kundengeräte
--   code  = nur mit Einmal-Code, den der Kunde in seiner App erzeugt (Standard)
--   staff = Kunde erlaubt Technikern Dauerzugriff (Wartungsvertrag)
ALTER TABLE devices ADD COLUMN access_policy TEXT NOT NULL DEFAULT 'code'
    CHECK (access_policy IN ('code', 'staff'));

CREATE TABLE access_grants (
    id              UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    -- SHA-256 des Codes; Klartext sieht nur der Kunde einmal
    code_hash       TEXT NOT NULL,
    device_ids      UUID[] NOT NULL CHECK (cardinality(device_ids) BETWEEN 1 AND 50),
    minutes         INT NOT NULL CHECK (minutes BETWEEN 5 AND 480),
    redeem_until    TIMESTAMPTZ NOT NULL,
    redeemed_by     UUID REFERENCES users(id),
    redeemed_at     TIMESTAMPTZ,
    access_until    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((redeemed_by IS NULL) = (redeemed_at IS NULL) AND (redeemed_at IS NULL) = (access_until IS NULL))
);
CREATE UNIQUE INDEX access_grants_open_code ON access_grants (code_hash) WHERE redeemed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX access_grants_tech ON access_grants (redeemed_by, access_until) WHERE revoked_at IS NULL;
CREATE INDEX access_grants_org ON access_grants (organization_id, created_at DESC);
