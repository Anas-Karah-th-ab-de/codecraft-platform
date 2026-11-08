-- Eigene App-Geräte zeitlich begrenzt für bestimmte Kolleginnen/Kollegen freigeben
-- (z. B. während eines Anrufs: Bildschirm sehen und steuern). Nur Bildschirm, keine Befehle/Dateien.
CREATE TABLE device_shares (
    id           uuid PRIMARY KEY,
    device_id    uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    owner_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grantee_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    expires_at   timestamptz NOT NULL,
    revoked_at   timestamptz
);
CREATE INDEX device_shares_active ON device_shares (device_id, grantee_id) WHERE revoked_at IS NULL;
