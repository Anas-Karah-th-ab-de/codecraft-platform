-- App (Android, Windows, Linux): jede Installation ist ein Gerät des angemeldeten Benutzers.
-- Der Fernwartungs-Agent in der App verbindet sich nur, wenn der Benutzer Support-Zugriff startet.
ALTER TABLE devices
    ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN install_id    TEXT CHECK (install_id IS NULL OR length(install_id) BETWEEN 8 AND 80),
    ADD COLUMN platform      TEXT CHECK (platform IS NULL OR platform IN ('android', 'windows', 'linux', 'macos', 'ios'));

CREATE UNIQUE INDEX devices_app_install ON devices (owner_user_id, install_id)
    WHERE install_id IS NOT NULL AND revoked_at IS NULL;
