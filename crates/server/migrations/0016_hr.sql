-- Mitarbeiter: Zeiterfassung, Urlaub/Abwesenheit mit Vertretung, Kalender.
-- Abteilungsleiter (lead) verwalten Mitarbeiter ihrer Abteilungen, Admins alle.

ALTER TABLE users ADD COLUMN vacation_days_per_year NUMERIC(4,1) NOT NULL DEFAULT 30
    CHECK (vacation_days_per_year BETWEEN 0 AND 60);

-- ── Zeiterfassung ────────────────────────────────────────────────────────────
CREATE TABLE time_entries (
    id             UUID PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at     TIMESTAMPTZ NOT NULL,
    ended_at       TIMESTAMPTZ,                       -- NULL = läuft gerade
    break_minutes  INT NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 600),
    project_id     UUID REFERENCES projects(id),
    ticket_id      UUID REFERENCES tickets(id),
    note           TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
    source         TEXT NOT NULL DEFAULT 'clock' CHECK (source IN ('clock', 'manual')),
    edited_by      UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR ended_at > started_at),
    CHECK (ended_at IS NULL OR ended_at - started_at <= interval '16 hours')
);
CREATE UNIQUE INDEX time_entries_one_running ON time_entries (user_id) WHERE ended_at IS NULL;
CREATE INDEX time_entries_user ON time_entries (user_id, started_at DESC);

-- ── Urlaub & Abwesenheit ─────────────────────────────────────────────────────
CREATE TABLE leave_requests (
    id             UUID PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind           TEXT NOT NULL DEFAULT 'vacation'
                   CHECK (kind IN ('vacation', 'sick', 'special', 'unpaid', 'training', 'remote')),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    half_day       BOOLEAN NOT NULL DEFAULT false,
    days           NUMERIC(5,1) NOT NULL CHECK (days >= 0),
    status         TEXT NOT NULL DEFAULT 'requested'
                   CHECK (status IN ('requested', 'approved', 'rejected', 'cancelled')),
    substitute_id  UUID REFERENCES users(id),
    note           TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
    decided_by     UUID REFERENCES users(id),
    decided_at     TIMESTAMPTZ,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date),
    CHECK (NOT half_day OR start_date = end_date),
    CHECK (substitute_id IS NULL OR substitute_id <> user_id)
);
CREATE INDEX leave_user ON leave_requests (user_id, start_date);
CREATE INDEX leave_period ON leave_requests (start_date, end_date) WHERE status = 'approved';

-- ── Kalender ─────────────────────────────────────────────────────────────────
CREATE TABLE calendar_events (
    id           UUID PRIMARY KEY,
    title        TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    description  TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
    location     TEXT NOT NULL DEFAULT '' CHECK (length(location) <= 300),
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    all_day      BOOLEAN NOT NULL DEFAULT false,
    -- vom Leiter/Admin vorgegeben: Teilnehmer können nicht absagen
    mandatory    BOOLEAN NOT NULL DEFAULT false,
    created_by   UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at >= starts_at)
);
CREATE INDEX calendar_events_time ON calendar_events (starts_at, ends_at);

CREATE TABLE calendar_attendees (
    event_id  UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response  TEXT NOT NULL DEFAULT 'pending' CHECK (response IN ('pending', 'accepted', 'declined')),
    PRIMARY KEY (event_id, user_id)
);
CREATE INDEX calendar_attendees_user ON calendar_attendees (user_id);
