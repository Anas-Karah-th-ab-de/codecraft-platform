-- Druck im Layout des Altsystems (pdf-legacy):
-- Firmenvorlage (alte Tabelle InvoiceTemplate) und eingefrorene Original-Druckdaten übernommener Belege.
CREATE TABLE document_templates (
    id          TEXT PRIMARY KEY,
    data        JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wird beim Import im Entwurf gesetzt und mit dem Ausstellen festgeschrieben (invoices_guard)
ALTER TABLE invoices ADD COLUMN pdf_snapshot JSONB;
ALTER TABLE quotes   ADD COLUMN pdf_snapshot JSONB;
