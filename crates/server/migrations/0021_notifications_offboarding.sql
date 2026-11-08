-- Benachrichtigungen (gespeichert, mit Gelesen-Status), Web-Push-Abos, Ankündigungen,
-- Sperren/Entfernen von Benutzern (Offboarding).

ALTER TABLE users
    ADD COLUMN locale             TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de', 'en', 'ar')),
    ADD COLUMN deactivated_at     TIMESTAMPTZ,
    ADD COLUMN deactivated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN deactivated_reason TEXT CHECK (length(deactivated_reason) <= 500),
    ADD COLUMN removed_at         TIMESTAMPTZ,
    ADD COLUMN removed_email      TEXT;

ALTER TABLE api_tokens ADD COLUMN last_used_at TIMESTAMPTZ;

CREATE TABLE notifications (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,                 -- ticket, order, quote, request, project, leave, calendar, call, announcement, user, system
    event       TEXT NOT NULL,
    ref_id      UUID,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    link        TEXT,
    actor       TEXT,                          -- wer es ausgelöst hat (Anzeigename)
    priority    SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 0 AND 2),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at     TIMESTAMPTZ
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE notification_prefs (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    muted       TEXT[] NOT NULL DEFAULT '{}',  -- Arten ohne Push/Ton (bleiben in der Liste)
    sound       BOOLEAN NOT NULL DEFAULT true,
    dnd_until   TIMESTAMPTZ                    -- „Nicht stören“ (Anrufe klingeln trotzdem im offenen Portal)
);

CREATE TABLE push_subscriptions (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '' CHECK (length(label) <= 120),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_ok_at  TIMESTAMPTZ,
    failures    INT NOT NULL DEFAULT 0
);
CREATE INDEX push_user ON push_subscriptions (user_id);

-- Schlüssel des Servers (z. B. VAPID für Web-Push), verschlüsselt abgelegt
CREATE TABLE server_keys (
    name        TEXT PRIMARY KEY,
    value       BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
    id           UUID PRIMARY KEY,
    title        TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
    body         TEXT NOT NULL CHECK (length(body) <= 20000),
    level        TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'important', 'urgent')),
    audience     TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'employees', 'customers', 'departments')),
    departments  TEXT[] NOT NULL DEFAULT '{}',
    pinned       BOOLEAN NOT NULL DEFAULT false,
    require_ack  BOOLEAN NOT NULL DEFAULT false,
    starts_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at      TIMESTAMPTZ,
    notified_at  TIMESTAMPTZ,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR ends_at > starts_at),
    CHECK (audience <> 'departments' OR cardinality(departments) > 0)
);
CREATE INDEX announcements_live ON announcements (starts_at DESC);

CREATE TABLE announcement_reads (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    acked_at        TIMESTAMPTZ,
    PRIMARY KEY (announcement_id, user_id)
);
