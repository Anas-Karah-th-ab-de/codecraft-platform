-- KM One im Katalog (Webseite /produkte, Auswahl „Produkt (optional)“ im Kontaktformular).
-- In Entwicklung: Richtpreis ca. 350 USD, Anfrage als Pilotkunde (Firmen, Behörden, NGOs).
INSERT INTO products (id, sku, slug, kind, department_id, device_kind, name, description, is_public, sort) VALUES
('00000000-0000-7000-8000-000000000110', 'KM-ONE', 'km-one', 'hardware',
 '00000000-0000-7000-8000-000000000001', NULL,
 '{"de":"KM One","en":"KM One","ar":"KM One"}',
 '{"de":"Robustes Handy mit Ultar OS – IP68, Stabantenne, LoRa, Satelliten-SOS, eigener Browser Ultar Web, lokale KI auf Arabisch und mindestens 5 Jahre Updates. In Entwicklung, Pilotkunden gesucht.","en":"Rugged phone with Ultar OS – IP68, pull-out antenna, LoRa, satellite SOS, our own browser Ultar Web, on-device AI in Arabic and at least 5 years of updates. In development, looking for pilot customers.","ar":"هاتف متين بنظام Ultar OS – IP68، هوائي قابل للسحب، LoRa، استغاثة عبر الأقمار الصناعية، متصفحنا Ultar Web، ذكاء اصطناعي محلي بالعربية وتحديثات لخمس سنوات على الأقل. قيد التطوير، نبحث عن عملاء تجريبيين."}',
 true, 84)
ON CONFLICT DO NOTHING;

INSERT INTO product_prices (id, product_id, code, name, billing, amount_cents, features, sort) VALUES
('00000000-0000-7000-8000-000000000301', '00000000-0000-7000-8000-000000000110', 'pilot',
 '{"de":"Pilotkunde – Gerät ca. 350 USD, Service-Abo ca. 48 USD/Jahr, auf Anfrage","en":"Pilot customer – device about USD 350, service plan about USD 48/year, on request","ar":"عميل تجريبي – الجهاز نحو 350 دولاراً، اشتراك الخدمة نحو 48 دولاراً سنوياً، عند الطلب"}',
 'on_request', NULL,
 '{"de":["Gerät, Ultar OS, Apps, Server und Wartungsvertrag","Firmenlogo auf Wunsch","Mindestens 5 Jahre Updates"],"en":["Device, Ultar OS, apps, server and maintenance contract","Your company logo on request","At least 5 years of updates"],"ar":["الجهاز وUltar OS والتطبيقات والخادم وعقد الصيانة","شعار شركتكم عند الطلب","تحديثات لخمس سنوات على الأقل"]}',
 10)
ON CONFLICT DO NOTHING;
