-- Dokumente zu Projekten (Fortschrittsberichte, Verträge, Spezifikationen …); Team lädt hoch, Kunde sieht freigegebene
CREATE TABLE project_documents (
    id           UUID PRIMARY KEY,
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title        TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    kind         TEXT NOT NULL DEFAULT 'report' CHECK (kind IN ('report', 'contract', 'offer', 'spec', 'protocol', 'other')),
    name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
    mime         TEXT NOT NULL,
    size         BIGINT NOT NULL CHECK (size BETWEEN 1 AND 52428800),
    sha256       TEXT NOT NULL,
    data         BYTEA NOT NULL,
    -- false = nur für das Team
    for_customer BOOLEAN NOT NULL DEFAULT true,
    uploader_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_documents_project ON project_documents (project_id, created_at DESC);
