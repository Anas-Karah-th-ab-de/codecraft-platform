-- Kalender: Erinnerungen, externe Gäste, Online-Meetings (auch für Gäste ohne Konto)

ALTER TABLE calendar_events
    ADD COLUMN reminders INT[] NOT NULL DEFAULT '{15}'
        CHECK (cardinality(reminders) <= 3 AND reminders <@ ARRAY[0,5,10,15,30,60,120,1440,2880]),
    ADD COLUMN online BOOLEAN NOT NULL DEFAULT false;

-- Externe Teilnehmer (ohne Konto): Einladung + Erinnerung per E-Mail mit Gastlink
CREATE TABLE calendar_guests (
    id        UUID PRIMARY KEY,
    event_id  UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    email     TEXT NOT NULL CHECK (length(email) <= 200 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    name      TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 100),
    invited_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX calendar_guests_email ON calendar_guests (event_id, lower(email));

-- Online-Meeting zu einem Termin. Der Gastlink-Schlüssel liegt nur als Hash (Prüfung)
-- und verschlüsselt (Anzeige für den Organisator) in der Datenbank.
CREATE TABLE meetings (
    id           UUID PRIMARY KEY,
    event_id     UUID NOT NULL UNIQUE REFERENCES calendar_events(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,
    token_sealed BYTEA NOT NULL,
    -- Gäste warten im Vorraum, bis ein Teilnehmer mit Konto sie einlässt
    lobby        BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Versandprotokoll der Erinnerungen (jede Erinnerung genau einmal je Empfänger)
CREATE TABLE calendar_reminders_sent (
    event_id  UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL,
    minutes   INT NOT NULL,
    sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, recipient, minutes)
);
CREATE INDEX calendar_events_starts ON calendar_events (starts_at);
