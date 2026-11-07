-- Fernwartung: letzter Verbindungsstand des Agenten (Hello inkl. erlaubter Funktionen) und Inventar
ALTER TABLE devices
    ADD COLUMN remote_hello      JSONB,
    ADD COLUMN remote_inventory  JSONB,
    ADD COLUMN remote_seen_at    TIMESTAMPTZ;
