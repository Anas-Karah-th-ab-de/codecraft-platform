-- Automatische Weiterleitung (vom Admin gesetzt): alle oder bestimmte Absender eines Postfachs
-- an eine andere Adresse – intern als Original, extern als Anhang (DMARC-sicher).
CREATE TABLE mail_rules (
    id          UUID PRIMARY KEY,
    mailbox_id  UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    -- NULL = alle Absender; 'a@b.de' = genau dieser; '@b.de' = ganze Domain
    sender      TEXT CHECK (sender IS NULL OR (sender = lower(sender) AND sender LIKE '%@%')),
    forward_to  TEXT NOT NULL CHECK (forward_to = lower(forward_to) AND forward_to LIKE '%_@_%.__%'),
    -- false = Nachricht nicht im Postfach behalten (nur weiterleiten)
    keep_copy   BOOLEAN NOT NULL DEFAULT true,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    note        TEXT,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mail_rules_mailbox ON mail_rules (mailbox_id) WHERE is_active;
