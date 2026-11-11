-- Selbstregistrierung von Kunden: Antrag mit Kontaktdaten und Firma, aktiv erst nach Bestätigung der E-Mail.
-- Der Link enthält ein Zufalls-Token; gespeichert wird nur dessen SHA-256.
CREATE TABLE signup_requests (
    id            UUID PRIMARY KEY,
    token_hash    TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    display_name  TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 200),
    phone         TEXT,
    password_hash TEXT NOT NULL,
    company       TEXT NOT NULL CHECK (length(trim(company)) BETWEEN 1 AND 200),
    address       TEXT NOT NULL DEFAULT '',
    vat_id        TEXT,
    locale        TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de', 'en', 'ar')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    confirmed_at  TIMESTAMPTZ,
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX signup_requests_email ON signup_requests (lower(email));
