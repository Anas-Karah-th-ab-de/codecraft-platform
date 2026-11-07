-- Stufe 2: eigener Mailserver. Nachrichten liegen roh (RFC 5322) in Postgres,
-- die wichtigsten Kopfzeilen zusätzlich als Spalten für Liste und Suche.

ALTER TABLE mail_domains
    ADD COLUMN dkim_selector    TEXT NOT NULL DEFAULT 'cc1',
    ADD COLUMN dkim_private_der BYTEA,          -- PKCS#1, wird beim Start erzeugt, falls leer
    ADD COLUMN dkim_public_b64  TEXT;

-- Weiterleitungs-Adressen (info@, support@ …) → Postfach
CREATE TABLE mail_aliases (
    address     TEXT PRIMARY KEY CHECK (address = lower(address) AND address LIKE '%@%'),
    mailbox_id  UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMAP-UIDs: global aufsteigend → innerhalb jedes Ordners streng steigend
CREATE SEQUENCE mail_uid_seq;

CREATE TABLE mail_messages (
    id           UUID PRIMARY KEY,
    mailbox_id   UUID NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
    folder       TEXT NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox','sent','drafts','trash','junk','archive')),
    uid          BIGINT NOT NULL DEFAULT nextval('mail_uid_seq'),
    message_id   TEXT,
    in_reply_to  TEXT,
    subject      TEXT NOT NULL DEFAULT '',
    from_addr    TEXT NOT NULL DEFAULT '',
    from_name    TEXT,
    to_addrs     TEXT[] NOT NULL DEFAULT '{}',
    cc_addrs     TEXT[] NOT NULL DEFAULT '{}',
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    size         INT NOT NULL,
    preview      TEXT NOT NULL DEFAULT '',
    has_attachments BOOLEAN NOT NULL DEFAULT false,
    auth_results TEXT,                         -- SPF/DKIM/DMARC beim Empfang
    seen         BOOLEAN NOT NULL DEFAULT false,
    flagged      BOOLEAN NOT NULL DEFAULT false,
    answered     BOOLEAN NOT NULL DEFAULT false,
    deleted      BOOLEAN NOT NULL DEFAULT false, -- IMAP \Deleted (bis EXPUNGE)
    raw          BYTEA NOT NULL
);
CREATE UNIQUE INDEX mail_messages_uid ON mail_messages (mailbox_id, folder, uid);
CREATE INDEX mail_messages_list ON mail_messages (mailbox_id, folder, sent_at DESC);
CREATE INDEX mail_messages_unseen ON mail_messages (mailbox_id, folder) WHERE NOT seen;

-- Ausgehende Warteschlange (ein Eintrag je Empfänger-Domain)
CREATE TABLE mail_queue (
    id              UUID PRIMARY KEY,
    mailbox_id      UUID REFERENCES mailboxes(id) ON DELETE SET NULL,
    mail_from       TEXT NOT NULL,
    rcpt_domain     TEXT NOT NULL,
    rcpts           TEXT[] NOT NULL,
    raw             BYTEA NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed')),
    attempts        INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ
);
CREATE INDEX mail_queue_due ON mail_queue (next_attempt_at) WHERE status = 'queued';

-- App-Passwörter für Mail-Programme (IMAP/SMTP). Pflicht bei aktivem 2FA.
CREATE TABLE app_passwords (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    secret_hash   TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ
);
