-- Ultar OS im Katalog (Webseite /produkte, Auswahl „Produkt (optional)“ im Kontaktformular).
-- In Entwicklung: kein Preis, Anfrage für Pilotgeräte, Firmenanpassung oder Partnerschaft.
INSERT INTO products (id, sku, slug, kind, department_id, device_kind, name, description, is_public, sort) VALUES
('00000000-0000-7000-8000-000000000109', 'KM-ULTAR-OS', 'ultar-os', 'software',
 '00000000-0000-7000-8000-000000000001', NULL,
 '{"de":"Ultar OS","en":"Ultar OS","ar":"Ultar OS"}',
 '{"de":"Eigenes Betriebssystem in Rust für Handy, Tablet und Platine – Android-Ersatz ohne Google, mit Verschlüsselung, eigenem VPN und Arabisch zuerst. Desktop-Version folgt.","en":"Our own operating system in Rust for phones, tablets and boards – an Android replacement without Google, with encryption, its own VPN and Arabic first. Desktop version coming.","ar":"نظام تشغيل خاص بنا بلغة Rust للهاتف والتابلت واللوحات – بديل لأندرويد دون Google، مع التشفير وشبكة VPN خاصة والعربية أولاً. نسخة سطح المكتب قادمة."}',
 true, 85)
ON CONFLICT DO NOTHING;

INSERT INTO product_prices (id, product_id, code, name, billing, amount_cents, features, sort) VALUES
('00000000-0000-7000-8000-000000000291', '00000000-0000-7000-8000-000000000109', 'anfrage',
 '{"de":"Pilotgeräte, Firmenanpassung, Partnerschaft – auf Anfrage","en":"Pilot devices, company customisation, partnership – on request","ar":"أجهزة تجريبية، تكييف للشركات، شراكة – عند الطلب"}',
 'on_request', NULL,
 '{"de":["Für Handys, Tablets und Platinen","Ohne Google, mit Verschlüsselung und VPN","Arabisch, Englisch, Deutsch"],"en":["For phones, tablets and boards","No Google, with encryption and VPN","Arabic, English, German"],"ar":["للهواتف والتابلت واللوحات","دون Google، مع التشفير وVPN","العربية والإنجليزية والألمانية"]}',
 10)
ON CONFLICT DO NOTHING;
