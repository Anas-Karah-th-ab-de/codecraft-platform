-- POS Code Craft v3: Katalog auf Abo-Pakete umstellen (Free, Basic, Pro, Business – Preis auf Anfrage)
UPDATE products SET description = '{
  "de": "Kasse, Lager und Warenwirtschaft für Handel, Gastronomie und Dienstleister – läuft auch ohne Internet.",
  "en": "POS, stock and inventory for retail, restaurants and services – works without internet.",
  "ar": "كاشير ومستودع وإدارة مخزون للمتاجر والمطاعم والخدمات – يعمل بدون إنترنت."
}'::jsonb WHERE slug = 'pos-code-craft-v3';

UPDATE product_prices SET name = '{"de":"Free","en":"Free","ar":"Free"}', billing = 'one_time', amount_cents = 0,
  features = '{
    "de": ["Volle Kasse im eigenen Netz", "Mehrere Geräte im LAN", "Lager, Tische, Termine"],
    "en": ["Full POS in your network", "Several devices on the LAN", "Stock, tables, appointments"],
    "ar": ["الكاشير كاملاً في شبكتك", "عدة أجهزة في الشبكة المحلية", "المخزون والطاولات والمواعيد"]
  }' WHERE id = '00000000-0000-7000-8000-000000000241';

UPDATE product_prices SET name = '{"de":"Basic","en":"Basic","ar":"Basic"}', billing = 'on_request', amount_cents = NULL,
  features = '{
    "de": ["Alles aus Free", "Eigene Adresse unter poskm.code-craft.tech", "Kunden-App & Online-Bestellung", "Handy-Zugriff & Anwesenheit"],
    "en": ["Everything in Free", "Own address under poskm.code-craft.tech", "Customer app & online ordering", "Phone access & attendance"],
    "ar": ["كل ما في Free", "عنوان خاص على poskm.code-craft.tech", "تطبيق الزبائن والطلب أونلاين", "الوصول من الهاتف والحضور"]
  }' WHERE id = '00000000-0000-7000-8000-000000000242';

UPDATE product_prices SET code = 'pro', name = '{"de":"Pro","en":"Pro","ar":"Pro"}', billing = 'on_request', amount_cents = NULL,
  features = '{
    "de": ["Alles aus Basic", "Automatischer Kurs per API", "Mehrere Filialen", "Schnittstelle (API)"],
    "en": ["Everything in Basic", "Automatic exchange rate API", "Several branches", "API access"],
    "ar": ["كل ما في Basic", "سعر صرف تلقائي عبر API", "عدة فروع", "واجهة برمجية"]
  }' WHERE id = '00000000-0000-7000-8000-000000000243';

UPDATE product_prices SET code = 'business', name = '{"de":"Business","en":"Business","ar":"Business"}', billing = 'on_request', amount_cents = NULL,
  features = '{
    "de": ["Alles aus Pro", "Für Ketten und Filialnetze", "Bevorzugter Support"],
    "en": ["Everything in Pro", "For chains and branch networks", "Priority support"],
    "ar": ["كل ما في Pro", "للسلاسل وشبكات الفروع", "دعم بأولوية"]
  }' WHERE id = '00000000-0000-7000-8000-000000000244';

