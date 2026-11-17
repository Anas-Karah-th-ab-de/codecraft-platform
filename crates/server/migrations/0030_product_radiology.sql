-- KM Code Craft Radiology im Katalog (Webseite /produkte, Produktauswahl im Kontaktformular).
-- Ohne Preise: Der Preis folgt nach der Standortaufnahme als festes Angebot.
-- ON CONFLICT: Die Zeile wurde am 17.11.2026 schon von Hand in die Produktivdatenbank eingetragen.
INSERT INTO products (id, sku, slug, kind, department_id, device_kind, name, description, is_public, sort) VALUES
('00000000-0000-7000-8000-000000000108', 'KM-RADIOLOGY', 'km-code-craft-radiology', 'software',
 '00000000-0000-7000-8000-000000000001', NULL,
 '{"de":"KM Code Craft Radiology","en":"KM Code Craft Radiology","ar":"KM Code Craft Radiology"}',
 '{"de":"RIS, Bildarchiv (PACS), Viewer und Befundung im eigenen Haus – auf Arabisch, Englisch und Deutsch.","en":"RIS, image archive (PACS), viewer and reporting on your premises – in Arabic, English and German.","ar":"نظام معلومات الأشعة والأرشيف (PACS) والعارض والتقارير داخل منشأتك – بالعربية والإنجليزية والألمانية."}',
 true, 80)
ON CONFLICT DO NOTHING;
