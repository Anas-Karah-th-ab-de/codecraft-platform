-- Dateien im Chat (verschlüsselt gespeichert wie Mails, nur für Mitglieder des Raums)
CREATE TABLE chat_files (
    id           UUID PRIMARY KEY,
    room_id      UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    uploader_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
    mime         TEXT NOT NULL,
    size         BIGINT NOT NULL CHECK (size BETWEEN 1 AND 52428800),
    sha256       TEXT NOT NULL,
    data         BYTEA NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_files_room ON chat_files (room_id, created_at DESC);

ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_kind_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_kind_check CHECK (kind IN ('text', 'call', 'system', 'file'));
ALTER TABLE chat_messages ADD COLUMN file_id UUID REFERENCES chat_files(id) ON DELETE SET NULL;
