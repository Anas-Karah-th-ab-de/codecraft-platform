-- Abteilungen & Produktkatalog: EINE Quelle für Webseite, Portal, Rechnungen, Lizenzen und Geräte.
-- Konsistenz wird von der Datenbank erzwungen, nicht nur vom Code.

-- Text muss in DE, EN und AR vorhanden und nicht leer sein
CREATE FUNCTION i18n_ok(t JSONB) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
    SELECT jsonb_typeof(t) = 'object'
       AND length(trim(coalesce(t->>'de', ''))) > 0
       AND length(trim(coalesce(t->>'en', ''))) > 0
       AND length(trim(coalesce(t->>'ar', ''))) > 0
$$;

CREATE TABLE departments (
    id          UUID PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z]{2,5}$'),
    slug        TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name        JSONB NOT NULL CHECK (i18n_ok(name)),
    description JSONB NOT NULL CHECK (i18n_ok(description)),
    color       TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    icon        TEXT NOT NULL,
    modules     TEXT[] NOT NULL DEFAULT '{}' CHECK (modules <@ ARRAY[
                    'tasks','time-tracking','calendar','employees','reports','projects','dev-tasks','git',
                    'code-review','tickets','remote','knowledge-base','products','orders','customers',
                    'invoices','licenses','devices']::TEXT[]),
    parent_id   UUID REFERENCES departments(id),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (parent_id IS DISTINCT FROM id)
);

CREATE TABLE user_departments (
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    is_primary    BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, department_id)
);
-- höchstens eine Hauptabteilung je Benutzer
CREATE UNIQUE INDEX user_primary_department ON user_departments (user_id) WHERE is_primary;

CREATE TABLE products (
    id            UUID PRIMARY KEY,
    sku           TEXT NOT NULL UNIQUE CHECK (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
    slug          TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    kind          TEXT NOT NULL CHECK (kind IN ('software','hardware','service','appliance','rental')),
    -- verantwortliche Abteilung (Pflicht)
    department_id UUID NOT NULL REFERENCES departments(id),
    -- Gerätetyp, falls das Produkt ein Gerät an der Plattform ist
    device_kind   TEXT CHECK (device_kind IN ('agent','esp32','ai_appliance','pos')),
    name          JSONB NOT NULL CHECK (i18n_ok(name)),
    description   JSONB NOT NULL CHECK (i18n_ok(description)),
    is_public     BOOLEAN NOT NULL DEFAULT true,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    sort          INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Geräte-Produkte brauchen einen Gerätetyp, Dienstleistungen dürfen keinen haben
    CHECK (kind <> 'appliance' OR device_kind IS NOT NULL),
    CHECK (kind <> 'service' OR device_kind IS NULL)
);
CREATE INDEX products_department_idx ON products (department_id);

-- department_id = verantwortliche (liefernde) Abteilung. Der Vertrieb (SAL) verkauft alle Produkte,
-- daher wird kein Abteilungsmodul für die Zuordnung verlangt.

CREATE TABLE product_prices (
    id           UUID PRIMARY KEY,
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    code         TEXT NOT NULL CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name         JSONB NOT NULL CHECK (i18n_ok(name)),
    billing      TEXT NOT NULL CHECK (billing IN ('one_time','hourly','monthly','yearly','on_request')),
    amount_cents BIGINT CHECK (amount_cents >= 0),
    currency     CHAR(3) NOT NULL DEFAULT 'EUR',
    -- Leistungsmerkmale je Sprache: {"de":[...],"en":[...],"ar":[...]} – gleiche Anzahl Einträge
    features     JSONB NOT NULL DEFAULT '{"de":[],"en":[],"ar":[]}',
    is_active    BOOLEAN NOT NULL DEFAULT true,
    sort         INT NOT NULL DEFAULT 0,
    UNIQUE (product_id, code),
    UNIQUE (id, product_id),
    CHECK ((billing = 'on_request') = (amount_cents IS NULL)),
    CHECK (jsonb_typeof(features->'de') = 'array' AND jsonb_typeof(features->'en') = 'array'
           AND jsonb_typeof(features->'ar') = 'array'
           AND jsonb_array_length(features->'de') = jsonb_array_length(features->'en')
           AND jsonb_array_length(features->'de') = jsonb_array_length(features->'ar'))
);

-- ── Rechnungspositionen an den Katalog koppeln ───────────────────────────────
ALTER TABLE invoice_items
    ADD COLUMN product_id UUID REFERENCES products(id),
    ADD COLUMN price_id   UUID,
    -- Preis muss zum Produkt gehören
    ADD CONSTRAINT invoice_items_price_fk FOREIGN KEY (price_id, product_id) REFERENCES product_prices (id, product_id),
    ADD CONSTRAINT invoice_items_price_needs_product CHECK (price_id IS NULL OR product_id IS NOT NULL);

-- ── Geräte an den Katalog koppeln ────────────────────────────────────────────
ALTER TABLE devices ADD COLUMN product_id UUID REFERENCES products(id);

CREATE FUNCTION devices_product_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    dk TEXT;
BEGIN
    IF NEW.product_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT device_kind INTO dk FROM products WHERE id = NEW.product_id;
    IF dk IS DISTINCT FROM NEW.kind THEN
        RAISE EXCEPTION 'Gerätetyp % passt nicht zum Produkt (erwartet %)', NEW.kind, coalesce(dk, 'kein Gerät')
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER devices_product_guard_trg BEFORE INSERT OR UPDATE OF kind, product_id ON devices
    FOR EACH ROW EXECUTE FUNCTION devices_product_guard();

-- Gerätetyp eines Produkts nicht ändern, solange Geräte darauf verweisen
CREATE FUNCTION products_device_kind_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.device_kind IS DISTINCT FROM OLD.device_kind
       AND EXISTS (SELECT 1 FROM devices WHERE product_id = NEW.id) THEN
        RAISE EXCEPTION 'Gerätetyp von Produkt % ist in Verwendung', OLD.sku USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER products_device_kind_guard_trg BEFORE UPDATE OF device_kind ON products
    FOR EACH ROW EXECUTE FUNCTION products_device_kind_guard();
