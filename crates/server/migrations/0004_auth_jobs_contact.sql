-- Login mit Passwort (Argon2id) + TOTP-2FA, Sitzungen mit Ablauf, Stellenanzeigen, Kontaktanfragen

ALTER TABLE users
    ADD COLUMN password_hash       TEXT,
    ADD COLUMN totp_secret         TEXT,
    ADD COLUMN totp_pending_secret TEXT,
    ADD COLUMN is_active           BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN last_login_at       TIMESTAMPTZ;

ALTER TABLE api_tokens ADD COLUMN expires_at TIMESTAMPTZ;

-- ── Stellenanzeigen ─────────────────────────────────────────────────────────
CREATE TABLE job_positions (
    id              UUID PRIMARY KEY,
    department_id   UUID NOT NULL REFERENCES departments(id),
    slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title           JSONB NOT NULL CHECK (i18n_ok(title)),
    summary         JSONB NOT NULL CHECK (i18n_ok(summary)),
    description     JSONB NOT NULL CHECK (i18n_ok(description)),
    location        TEXT NOT NULL DEFAULT '',
    employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time','part_time','internship','freelance')),
    remote          BOOLEAN NOT NULL DEFAULT false,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status = 'draft' OR published_at IS NOT NULL)
);

CREATE TABLE job_applications (
    id          UUID PRIMARY KEY,
    job_id      UUID NOT NULL REFERENCES job_positions(id),
    name        TEXT NOT NULL CHECK (length(trim(name)) > 1),
    email       TEXT NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    phone       TEXT,
    message     TEXT NOT NULL DEFAULT '',
    locale      TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de','en','ar')),
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','rejected','hired')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX job_applications_job_idx ON job_applications (job_id, created_at DESC);

-- ── Kontaktanfragen (Webseite) ──────────────────────────────────────────────
CREATE TABLE contact_requests (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL CHECK (length(trim(name)) > 1),
    email       TEXT NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    phone       TEXT,
    subject     TEXT NOT NULL,
    message     TEXT NOT NULL CHECK (length(trim(message)) > 4),
    product_id  UUID REFERENCES products(id),
    locale      TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de','en','ar')),
    status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','done')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Beispiel-Stelle (Entwicklung), damit Karriereseite und Portal sofort Inhalt haben
INSERT INTO job_positions (id, department_id, slug, title, summary, description, location, employment_type, remote, status, published_at)
VALUES ('00000000-0000-7000-8000-000000000301', '00000000-0000-7000-8000-000000000001', 'rust-entwickler',
 '{"de":"Rust-Entwickler (m/w/d)","en":"Rust Developer (m/f/d)","ar":"مطوّر Rust"}',
 '{"de":"Backend, Geräte-Firmware und KI-Plattform mitentwickeln.","en":"Build backend, device firmware and our AI platform.","ar":"المشاركة في تطوير الخادم وبرمجيات الأجهزة ومنصة الذكاء الاصطناعي."}',
 '{"de":"Du entwickelst unsere Plattform in Rust (Axum, PostgreSQL) und die Firmware unserer Geräte.\n\nWir bieten: flexible Arbeitszeiten, Remote-Arbeit, moderne Technik.","en":"You build our platform in Rust (Axum, PostgreSQL) and the firmware of our devices.\n\nWe offer: flexible hours, remote work, modern tech.","ar":"ستطوّر منصتنا بلغة Rust (Axum وPostgreSQL) وبرمجيات أجهزتنا.\n\nنقدّم: ساعات عمل مرنة، عمل عن بُعد، تقنيات حديثة."}',
 'Idlib / Remote', 'full_time', true, 'published', now());
