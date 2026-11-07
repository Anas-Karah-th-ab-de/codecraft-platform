-- POS Code Craft v3: Leistungsumfang je Lizenz (für Webseite und Angebote)
UPDATE product_prices SET features = '{
 "de":["Windows-EXE + Android-APK","Offline-Betrieb","1 Kassenkonfiguration, 1 Gerät","Grundfunktionen","Community-Support"],
 "en":["Windows EXE + Android APK","Offline operation","1 POS configuration, 1 device","Basic functions","Community support"],
 "ar":["نسخة Windows EXE و Android APK","عمل دون اتصال","إعداد نقطة بيع واحد، جهاز واحد","الوظائف الأساسية","دعم المجتمع"]}'
 WHERE id = '00000000-0000-7000-8000-000000000241';
UPDATE product_prices SET features = '{
 "de":["Mehrere Währungen","3 Kassenkonfigurationen","Netzwerk, bis 3 Geräte","1 Jahr kostenlose Updates","E-Mail-Support"],
 "en":["Multi-currency support","3 POS configurations","Networking, up to 3 devices","1 year free updates","Email support"],
 "ar":["دعم عملات متعددة","3 إعدادات لنقاط البيع","شبكة حتى 3 أجهزة","تحديثات مجانية لمدة سنة","دعم بالبريد الإلكتروني"]}'
 WHERE id = '00000000-0000-7000-8000-000000000242';
UPDATE product_prices SET features = '{
 "de":["Goldhandel-Modul","Netzwerk, bis 10 Geräte","Cloud-Sync & Backup","Erweiterte Berichte, Küchendisplay","Bevorzugter E-Mail-Support"],
 "en":["Gold trade module","Networking, up to 10 devices","Cloud sync & backup","Advanced reports, kitchen display","Priority email support"],
 "ar":["وحدة تجارة الذهب","شبكة حتى 10 أجهزة","مزامنة ونسخ احتياطي سحابي","تقارير متقدمة وشاشة مطبخ","دعم بريد بأولوية"]}'
 WHERE id = '00000000-0000-7000-8000-000000000243';
UPDATE product_prices SET features = '{
 "de":["99 Kassenkonfigurationen, bis 99 Geräte","Mehrere Standorte","API-Zugang, Selbstbedienungs-Kiosk","Individuelle Integrationen","Bevorzugter Support per Telefon & E-Mail"],
 "en":["99 POS configurations, up to 99 devices","Multi-location operation","API access, self-order kiosk","Custom integrations","Priority support, phone & email"],
 "ar":["99 إعداداً حتى 99 جهازاً","تشغيل متعدد الفروع","وصول API وكشك طلب ذاتي","تكاملات مخصصة","دعم بأولوية عبر الهاتف والبريد"]}'
 WHERE id = '00000000-0000-7000-8000-000000000244';
