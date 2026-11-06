-- Produktbilder: Original wird nicht gespeichert, nur optimierte Größen (Karte 480 px, Detail 1600 px)
CREATE TABLE product_images (
    id          UUID PRIMARY KEY,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    card_path   TEXT NOT NULL,
    full_path   TEXT NOT NULL,
    width       INT  NOT NULL CHECK (width > 0),
    height      INT  NOT NULL CHECK (height > 0),
    -- kleinster Wert = Hauptbild
    sort        INT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON product_images (product_id, sort, created_at);
