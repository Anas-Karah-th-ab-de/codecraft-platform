-- Projektarten: Kundenprojekt, internes Projekt, Open-Source-Projekt (ohne Kunde, optional öffentlich)
ALTER TABLE projects
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'customer' CHECK (kind IN ('customer', 'internal', 'opensource')),
    ADD COLUMN license TEXT CHECK (length(license) <= 60),
    -- Open Source: auf der Webseite zeigen
    ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

UPDATE projects SET kind = 'internal' WHERE organization_id IS NULL;

-- Altdaten-Import u. Ä. ohne Art: ohne Kunde = intern
CREATE FUNCTION projects_default_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.organization_id IS NULL AND NEW.kind = 'customer' THEN
        NEW.kind := 'internal';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER projects_default_kind_trg BEFORE INSERT ON projects FOR EACH ROW EXECUTE FUNCTION projects_default_kind();

ALTER TABLE projects
    ADD CONSTRAINT projects_kind_org CHECK ((kind = 'customer') = (organization_id IS NOT NULL)),
    ADD CONSTRAINT projects_public_only_oss CHECK (NOT is_public OR kind = 'opensource');
