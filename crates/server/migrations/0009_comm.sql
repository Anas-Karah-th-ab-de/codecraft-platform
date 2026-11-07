-- Eigene Kommunikation: Postfächer (Mailserver folgt in Stufe 2), Chat, Anrufe.
-- Ein Plattform-Konto = Login + Postfach (Mitarbeiter) + Chat-Konto (alle).

CREATE TABLE mail_domains (
    domain      TEXT PRIMARY KEY CHECK (domain = lower(domain)),
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO mail_domains (domain, is_default) VALUES ('code-craft.tech', true);

CREATE TABLE mailboxes (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    address     TEXT NOT NULL UNIQUE CHECK (address = lower(address) AND address LIKE '%@%'),
    domain      TEXT NOT NULL REFERENCES mail_domains(domain),
    quota_mb    INT  NOT NULL DEFAULT 5120,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_rooms (
    id               UUID PRIMARY KEY,
    kind             TEXT NOT NULL CHECK (kind IN ('direct','group','support','project')),
    name             TEXT,
    organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
    project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
    direct_key       TEXT UNIQUE,                 -- „idA:idB“ (sortiert) für Direktchats
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (kind <> 'direct' OR direct_key IS NOT NULL),
    CHECK (kind <> 'support' OR organization_id IS NOT NULL)
);
CREATE UNIQUE INDEX chat_rooms_support_org ON chat_rooms (organization_id) WHERE kind = 'support';

CREATE TABLE chat_members (
    room_id       UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, user_id)
);
CREATE INDEX chat_members_user_idx ON chat_members (user_id);

CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY,
    room_id     UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    kind        TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','call','system')),
    body        TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_room_time_idx ON chat_messages (room_id, created_at DESC);

-- Bestehende Mitarbeiter mit Adresse der Hausdomain bekommen ihr Postfach
INSERT INTO mailboxes (id, user_id, address, domain)
SELECT gen_random_uuid(), u.id, lower(u.email), 'code-craft.tech'
  FROM users u
 WHERE u.role IN ('trainee','staff','manager','lead','admin')
   AND lower(u.email) LIKE '%@code-craft.tech'
ON CONFLICT DO NOTHING;
