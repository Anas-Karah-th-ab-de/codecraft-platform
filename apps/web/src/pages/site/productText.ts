// Produktseiten (DE/EN/AR): POS Code Craft v3, KI-Server, Maps Syria.
// Quellen: Repos universal-pos-erp (README, docs/), km-code-craft-ai (README), maps-sy-1 (web/index.html).
// Preise kommen aus dem Katalog (KI-Server) bzw. stehen bewusst nicht hier (Kasse: Preis auf Anfrage).
import type { Locale } from "../../i18n";
import { RADIOLOGIE, RADIOLOGIE_TEASER } from "./radiologieText";

export type ProductKey = "kasse" | "ki-server" | "karten" | "radiologie";

export type Block =
  | { kind: "features"; id?: string; h: string; lead?: string; items: [string, string][] }
  | { kind: "points"; id?: string; h: string; lead?: string; items: string[]; dark?: boolean }
  | { kind: "plans"; id?: string; h: string; lead: string; plans: { n: string; tag: string; items: string[]; hl?: boolean }[] }
  | { kind: "catalog"; id?: string; h: string; lead: string; slug: string; month: string; custom: string }
  | { kind: "table"; id?: string; h: string; lead?: string; head: [string, string]; rows: [string, string][] }
  | { kind: "steps"; id?: string; h: string; lead?: string; items: string[] }
  | { kind: "gallery"; id?: string; h: string; lead?: string; items: [string, string][] };

export type ProductPage = {
  title: string;
  eyebrow: string;
  h1: string;
  sub: string;
  sheet: [string, string][];
  primary: { label: string; to: string };
  secondary?: { label: string; to: string; external?: boolean };
  blocks: Block[];
  closing: { h: string; text: string };
};

export const UI: Record<Locale, { products: string; sheet: string; more: string; others: string; back: string }> = {
  de: { products: "Produkte", sheet: "Auf einen Blick", more: "Alle Details", others: "Weitere Produkte", back: "Zur Startseite" },
  en: { products: "Products", sheet: "At a glance", more: "All details", others: "More products", back: "Back to home" },
  ar: { products: "المنتجات", sheet: "نظرة سريعة", more: "كل التفاصيل", others: "منتجات أخرى", back: "إلى الصفحة الرئيسية" },
};

/** Kurzbeschreibung für Querverweise zwischen den Produktseiten */
export const TEASER: Record<Locale, Record<ProductKey, [string, string]>> = {
  de: {
    kasse: ["POS Code Craft v3", "Kasse, Lager und Kunden-App – läuft auch ohne Internet."],
    "ki-server": ["KI-Server", "Ihre eigene KI im eigenen Haus, ohne Cloud."],
    karten: ["Maps Syria", "Karten und Navigation für Syrien, betrieben in Syrien."],
    radiologie: RADIOLOGIE_TEASER.de,
  },
  en: {
    kasse: ["POS Code Craft v3", "POS, stock and customer app – works without internet."],
    "ki-server": ["AI server", "Your own AI in your own building, no cloud."],
    karten: ["Maps Syria", "Maps and navigation for Syria, run in Syria."],
    radiologie: RADIOLOGIE_TEASER.en,
  },
  ar: {
    kasse: ["POS Code Craft v3", "كاشير ومستودع وتطبيق للزبائن – يعمل بدون إنترنت."],
    "ki-server": ["خادم الذكاء الاصطناعي", "ذكاء اصطناعي خاص بك داخل منشأتك، بدون سحابة."],
    karten: ["خرائط سوريا", "خرائط وملاحة لسوريا، تُدار من داخل سوريا."],
    radiologie: RADIOLOGIE_TEASER.ar,
  },
};

// ── POS Code Craft v3 ──────────────────────────────────────────────────────

const kasseDe: ProductPage = {
  title: "POS Code Craft v3 – Kasse & Lager offline",
  eyebrow: "POS Code Craft v3 · Kasse, Lager, Warenwirtschaft",
  h1: "Kasse und Lager, die ohne Internet weiterlaufen.",
  sub: "Ein System für Verkauf, Lager, Tische, Termine und eine Kunden-App. Läuft lokal auf einem Android-Tablet oder PC, Arabisch zuerst, mit Syrischer Lira und US-Dollar und einem Wechselkurs, den Sie mit einem Tipp ändern.",
  sheet: [
    ["Branchen", "Handel, Gastronomie, Dienstleister und Werkstatt"],
    ["Geräte", "Android, Windows, Linux"],
    ["Sprachen", "Arabisch, Englisch, Deutsch"],
    ["Währung", "SYP und USD, Kurs per Tipp"],
    ["Internet", "optional – kassiert immer weiter"],
    ["Daten", "lokal beim Betrieb, Backup verschlüsselt"],
  ],
  primary: { label: "Angebot anfragen", to: "/kontakt?produkt=pos-code-craft-v3" },
  secondary: { label: "Kundenportal", to: "/portal" },
  blocks: [
    { kind: "features", h: "Alles, was Ihr Betrieb braucht.", lead: "Startet kostenlos auf einem Gerät und wächst mit: mehrere Kassen, Etagen und Abteilungen, Lager, Mitarbeiterrechte.", items: [
      ["Schnelle Kasse", "Barcode, Waage, Rabatte, gemischt zahlen in SYP und USD, Wechselgeld in SYP-Scheinen, ShamCash-QR auf dem Beleg."],
      ["Restaurant & Café", "Tischplan mit freien Tischen, Küchenmonitor, Drucker je Zubereitungsort, Rechnung teilen."],
      ["Lebensmittel & Handel", "Bestand, Chargen und Mindesthaltbarkeit (GS1), Bestellungen, Inventur, elektronische Preisschilder, die dem Kurs folgen."],
      ["Dienstleister & Werkstatt", "Termine, Reparaturaufträge, Buchungsseite für Kunden."],
      ["Mehrere Betriebsteile, ein Haus", "Restaurant im 1. Stock, Schwimmbad im 2., Einkaufszentrum im 3. – eine Hauptkasse, getrennte Rechte und Lager."],
      ["Tickets & Armbänder", "Eintrittstickets für Bad oder Fitness, Gast-Armband mit einem Konto im ganzen Haus."],
      ["Rollen & Rechte", "Der Inhaber bestimmt, was jede Person sieht und darf; Zeiterfassung inklusive."],
      ["KI-Assistent", "Beantwortet Fragen, öffnet die richtige Seite und erledigt kleine Änderungen nach Bestätigung."],
      ["Verschlüsseltes Backup", "Tägliches Ende-zu-Ende-verschlüsseltes Backup ins Kundenportal; Wiederherstellung nur mit Ihrem Code."],
    ] },
    { kind: "points", dark: true, h: "Fällt das Internet aus, merkt es niemand.", lead: "Ein Android-Tablet oder PC ist die Hauptkasse. Alle anderen Geräte finden sie im WLAN von selbst.", items: [
      "Daten liegen lokal auf der Hauptkasse – keine externe Datenbank, kein Server in der Cloud nötig.",
      "Weitere Kassen, Kellner-Handys und Küchenmonitore gleichen sich live über das eigene Netz ab.",
      "Fällt die Hauptkasse aus, kassieren alle Geräte weiter und gleichen später ab, ohne doppelte Buchungen.",
      "Ein nicht erreichbarer Drucker blockiert nie die Kasse: Bons warten und werden automatisch nachgedruckt.",
      "Neuer Dollarkurs? Oben in der Kopfzeile antippen, Zahl eingeben – alle Kassen rechnen sofort damit.",
    ] },
    { kind: "features", h: "Eine Kunden-App mit dem Namen Ihres Ladens.", lead: "Trägt Name und Logo Ihres Ladens, läuft auf jedem Handy ohne App-Store und ist direkt mit der Kasse verbunden. Ab Paket Basic.", items: [
      ["Online bestellen", "Am Tisch per QR-Code oder Tischnummer, vor Ort, Abholung oder Lieferung – was Sie freischalten."],
      ["Treue, Stempel, Gutscheine", "Kundenkarte im Handy, Stempelkarte, Geschenkgutscheine, Nachrichten und Angebote."],
      ["Preis-Check", "Kunden scannen den Barcode oder halten das Produkt in die Kamera und sehen Preis und Verfügbarkeit."],
      ["Ladenkarte", "„Wo finde ich …?“ mit dem Weg zum Regal und der Einkaufsliste als Route."],
    ] },
    { kind: "table", h: "Drucker und Zubehör, die Sie schon haben.", lead: "Arabischer Text wird als Bild gedruckt – jeder ESC/POS-Bondrucker funktioniert, ohne arabische Codepage.", head: ["Gerät", "Anschluss"], rows: [
      ["Bondrucker 58/80 mm", "Netzwerk, Bluetooth am Kellner-Handy, USB"],
      ["Küchen- und Bardrucker", "je Zubereitungsort ein Drucker oder Sammelbon"],
      ["Eigene KM-Geräte (ESP32)", "Drucker, Display, Kombigerät – werden im WLAN automatisch gefunden"],
      ["Barcode-Scanner", "USB oder Bluetooth; alternativ die Kamera des Tablets"],
      ["Waage, Kartenterminal", "seriell bzw. ZVT über Netzwerk"],
      ["Elektronische Preisschilder", "MQTT, folgen automatisch dem Wechselkurs"],
    ] },
    { kind: "plans", h: "Pakete", lead: "Die Kasse läuft immer weiter – auch nach Ablauf des Abos. Preise richten sich nach der Größe Ihres Betriebs; fragen Sie ein Angebot an.", plans: [
      { n: "Free", tag: "kostenlos", items: ["Volle Kasse im eigenen Netz", "Mehrere Geräte im LAN", "Lager, Tische, Termine"] },
      { n: "Basic", tag: "ein Laden", hl: true, items: ["Alles aus Free", "Eigene Adresse unter poskm.code-craft.tech", "Kunden-App & Online-Bestellung", "Handy-Zugriff & Anwesenheit"] },
      { n: "Pro", tag: "wachsen", items: ["Alles aus Basic", "Automatischer Kurs per API", "Mehrere Filialen", "Schnittstelle (API)"] },
      { n: "Business", tag: "Ketten", items: ["Alles aus Pro", "Für Ketten und Filialnetze", "Bevorzugter Support"] },
    ] },
    { kind: "table", h: "Systemanforderungen", head: ["Gerät", "Mindestens"], rows: [
      ["Hauptkasse – PC oder Mini-PC", "Windows 10/11 64-Bit, Ubuntu 22.04+ oder Debian 12; 2 Kerne, 2 GB RAM"],
      ["Hauptkasse – Tablet", "Android 9+ (ARM64), 3 GB RAM; empfohlen 4–6 GB und dauerhaft am Netzteil"],
      ["Weitere Kasse, Kellner-Handy", "Android 8+, Windows 10+ oder Linux, 2 GB RAM"],
      ["Küchenmonitor, Kundendisplay", "jedes Gerät mit der App oder ein KM-Display"],
      ["Netzwerk", "alle Geräte im selben WLAN/LAN; Internet nur für Fernzugriff, Backup und Kurs-API"],
      ["Kunden-App", "jeder aktuelle Browser, keine Installation aus dem App-Store"],
    ] },
    { kind: "steps", h: "In vier Schritten starten.", lead: "Ohne Router-Einstellungen, ohne Technikwissen.", items: [
      "Kasse auf Android-Gerät oder PC installieren – wir liefern das Paket oder installieren vor Ort.",
      "Branche wählen – der Assistent legt Artikel, Steuern und Währung an.",
      "Mit Paket-Schlüssel aktivieren oder mit dem Kundenportal verbinden.",
      "Link oder QR-Code der Kunden-App teilen – fertig.",
    ] },
  ],
  closing: { h: "Lassen Sie uns über Ihren Betrieb sprechen.", text: "Sagen Sie uns Branche, Anzahl der Kassen und was Sie heute nutzen. Sie bekommen ein Angebot und auf Wunsch eine Vorführung." },
};

const kasseEn: ProductPage = {
  title: "POS Code Craft v3 – offline POS & stock",
  eyebrow: "POS Code Craft v3 · POS, stock, inventory",
  h1: "A till and stock system that keeps running without internet.",
  sub: "One system for sales, stock, tables, appointments and a customer app. Runs locally on an Android tablet or PC, Arabic first, with Syrian pound and US dollar and an exchange rate you change with one tap.",
  sheet: [
    ["Businesses", "Retail, restaurants, services and workshops"],
    ["Devices", "Android, Windows, Linux"],
    ["Languages", "Arabic, English, German"],
    ["Currency", "SYP and USD, rate in one tap"],
    ["Internet", "optional – sales never stop"],
    ["Data", "stays with you, encrypted backup"],
  ],
  primary: { label: "Request an offer", to: "/kontakt?produkt=pos-code-craft-v3" },
  secondary: { label: "Customer portal", to: "/portal" },
  blocks: [
    { kind: "features", h: "Everything your business needs.", lead: "Starts free on one device and grows with you: several registers, floors and departments, stock, staff permissions.", items: [
      ["Fast checkout", "Barcode, scale, discounts, mixed payment in SYP and USD, change in SYP notes, ShamCash QR on the receipt."],
      ["Restaurant & café", "Table plan with free tables, kitchen display, printers per preparation area, split bills."],
      ["Grocery & retail", "Stock, batches and expiry dates (GS1), purchase orders, counts, electronic shelf labels that follow the rate."],
      ["Services & workshops", "Appointments, repair tickets, booking page for customers."],
      ["Several outlets, one house", "Restaurant on floor 1, pool on floor 2, mall on floor 3 – one main register, separate access and stock."],
      ["Tickets & wristbands", "Admission tickets for pool or gym, guest wristband with one account across the house."],
      ["Roles & permissions", "The owner decides what each person sees and does; time clock included."],
      ["AI assistant", "Answers questions, opens the right page and makes small changes after confirmation."],
      ["Encrypted backup", "Daily end-to-end encrypted backup to the customer portal; restore only with your code."],
    ] },
    { kind: "points", dark: true, h: "When the internet drops, nobody notices.", lead: "An Android tablet or PC is the main register. Every other device finds it on the Wi-Fi by itself.", items: [
      "Data lives locally on the main register – no external database, no cloud server needed.",
      "Other registers, waiter phones and kitchen displays stay in sync live over your own network.",
      "If the main register fails, every device keeps selling and syncs later, without double bookings.",
      "An unreachable printer never blocks the till: receipts wait and print automatically later.",
      "New dollar rate? Tap it in the header, type the number – every register uses it at once.",
    ] },
    { kind: "features", h: "A customer app with your shop's name.", lead: "Carries your shop's name and logo, runs on any phone without an app store and is connected directly to the register. From plan Basic.", items: [
      ["Online ordering", "At the table via QR code or table number, eat in, pickup or delivery – whatever you enable."],
      ["Loyalty, stamps, vouchers", "Loyalty card on the phone, stamp card, gift vouchers, messages and offers."],
      ["Price check", "Customers scan the barcode or hold the product up to the camera and see price and availability."],
      ["Store map", "“Where do I find …?” with the way to the shelf and the shopping list as a route."],
    ] },
    { kind: "table", h: "Printers and devices you already have.", lead: "Arabic text is printed as an image – any ESC/POS receipt printer works, no Arabic code page needed.", head: ["Device", "Connection"], rows: [
      ["Receipt printer 58/80 mm", "Network, Bluetooth on the waiter's phone, USB"],
      ["Kitchen and bar printers", "one per preparation area or a combined ticket"],
      ["Our KM devices (ESP32)", "Printer, display, combo device – found on the Wi-Fi automatically"],
      ["Barcode scanner", "USB or Bluetooth; or the tablet's camera"],
      ["Scale, card terminal", "serial, or ZVT over the network"],
      ["Electronic shelf labels", "MQTT, follow the exchange rate automatically"],
    ] },
    { kind: "plans", h: "Plans", lead: "The register always keeps working – even after a subscription ends. Prices depend on the size of your business; ask for an offer.", plans: [
      { n: "Free", tag: "free", items: ["Full POS in your network", "Several devices on the LAN", "Stock, tables, appointments"] },
      { n: "Basic", tag: "single shop", hl: true, items: ["Everything in Free", "Own address under poskm.code-craft.tech", "Customer app & online ordering", "Phone access & attendance"] },
      { n: "Pro", tag: "growing", items: ["Everything in Basic", "Automatic exchange rate API", "Several branches", "API access"] },
      { n: "Business", tag: "chains", items: ["Everything in Pro", "For chains and branch networks", "Priority support"] },
    ] },
    { kind: "table", h: "System requirements", head: ["Device", "Minimum"], rows: [
      ["Main register – PC or mini PC", "Windows 10/11 64-bit, Ubuntu 22.04+ or Debian 12; 2 cores, 2 GB RAM"],
      ["Main register – tablet", "Android 9+ (ARM64), 3 GB RAM; 4–6 GB and always on the charger recommended"],
      ["Extra register, waiter phone", "Android 8+, Windows 10+ or Linux, 2 GB RAM"],
      ["Kitchen display, customer display", "any device with the app, or a KM display"],
      ["Network", "all devices on the same Wi-Fi/LAN; internet only for remote access, backup and rate API"],
      ["Customer app", "any current browser, nothing to install from an app store"],
    ] },
    { kind: "steps", h: "Start in four steps.", lead: "No router setup, no technical knowledge.", items: [
      "Install the register on an Android device or PC – we hand over the package or install it on site.",
      "Pick your business type – the wizard prepares products, taxes and currency.",
      "Activate with a plan key or connect to the customer portal.",
      "Share the link or QR code of the customer app – done.",
    ] },
  ],
  closing: { h: "Let's talk about your business.", text: "Tell us your business type, how many registers you need and what you use today. You get an offer and, if you like, a demo." },
};

const kasseAr: ProductPage = {
  title: "POS Code Craft v3 – كاشير ومستودع بدون إنترنت",
  eyebrow: "POS Code Craft v3 · كاشير، مستودع، إدارة مخزون",
  h1: "كاشير ومستودع يستمران في العمل بدون إنترنت.",
  sub: "نظام واحد للبيع والمخزون والطاولات والمواعيد وتطبيق الزبائن. يعمل محلياً على جهاز أندرويد أو كمبيوتر، بالعربية أولاً، بالليرة السورية والدولار مع سعر صرف تغيّره بنقرة واحدة.",
  sheet: [
    ["الأنشطة", "متاجر، مطاعم، خدمات وورش"],
    ["الأجهزة", "أندرويد، ويندوز، لينكس"],
    ["اللغات", "العربية، الإنجليزية، الألمانية"],
    ["العملة", "ليرة سورية ودولار، السعر بنقرة"],
    ["الإنترنت", "اختياري – البيع لا يتوقف"],
    ["البيانات", "تبقى عندك، مع نسخ احتياطي مشفّر"],
  ],
  primary: { label: "اطلب عرض سعر", to: "/kontakt?produkt=pos-code-craft-v3" },
  secondary: { label: "بوابة العملاء", to: "/portal" },
  blocks: [
    { kind: "features", h: "كل ما يحتاجه نشاطك.", lead: "يبدأ مجاناً على جهاز واحد ويكبر معك: عدة أجهزة كاشير، أقسام وطوابق، مستودع، صلاحيات للموظفين.", items: [
      ["كاشير سريع", "باركود، ميزان، خصومات، دفع مختلط بالليرة والدولار، باقي الصرف بفئات الليرة، رمز ShamCash على الفاتورة."],
      ["مطعم ومقهى", "مخطط طاولات مع الطاولات الفارغة، شاشة المطبخ، طابعات حسب مكان التحضير، تقسيم الحساب."],
      ["بقالة ومتجر", "مخزون ودفعات وتاريخ انتهاء GS1، طلبات شراء، جرد، ملصقات أسعار إلكترونية تتبع سعر الصرف."],
      ["خدمات وورش", "مواعيد، أوامر إصلاح، صفحة حجز للزبائن."],
      ["عدة أقسام تحت سقف واحد", "مطعم في الطابق الأول ومسبح في الثاني ومركز تسوق في الثالث – كاشير رئيسي واحد، صلاحيات ومخزون منفصلة."],
      ["تذاكر وأساور", "تذاكر الدخول للمسبح أو النادي، سوار ضيف بحساب واحد في كل المنشأة."],
      ["أدوار وصلاحيات", "المالك يحدد ما يراه ويفعله كل موظف، مع تسجيل الحضور والانصراف."],
      ["مساعد ذكي", "يجيب عن الأسئلة ويفتح الصفحة المطلوبة وينفذ تغييرات صغيرة بعد التأكيد."],
      ["نسخ احتياطي مشفّر", "نسخ يومي مشفّر من الطرف إلى الطرف إلى بوابة العملاء، والاستعادة برمزك فقط."],
    ] },
    { kind: "points", dark: true, h: "ينقطع الإنترنت، ولا يلاحظ أحد.", lead: "جهاز أندرويد أو كمبيوتر هو الكاشير الرئيسي، وكل الأجهزة الأخرى تجده في شبكة الواي فاي تلقائياً.", items: [
      "البيانات محفوظة محلياً على الكاشير الرئيسي – بدون قاعدة بيانات خارجية وبدون خادم سحابي.",
      "أجهزة الكاشير الأخرى وهواتف النُدُل وشاشات المطبخ تتزامن مباشرة عبر شبكتك الخاصة.",
      "إذا توقف الكاشير الرئيسي تستمر كل الأجهزة في البيع وتتزامن لاحقاً، بدون تكرار في القيود.",
      "الطابعة غير المتصلة لا توقف الكاشير أبداً: الفواتير تنتظر وتُطبع تلقائياً لاحقاً.",
      "سعر دولار جديد؟ اضغط عليه في الشريط العلوي واكتب الرقم – كل أجهزة الكاشير تعتمده فوراً.",
    ] },
    { kind: "features", h: "تطبيق للزبائن باسم متجرك.", lead: "يحمل اسم وشعار متجرك، يعمل على أي هاتف بدون متجر تطبيقات، ويتصل مباشرة بالكاشير. ابتداءً من باقة Basic.", items: [
      ["طلب أونلاين", "على الطاولة برمز QR أو رقم الطاولة، تناول في المكان، استلام أو توصيل – حسب ما تفعّله."],
      ["ولاء وأختام وقسائم", "بطاقة ولاء في الهاتف، بطاقة أختام، قسائم هدايا، رسائل وعروض."],
      ["فحص السعر", "يمسح الزبون الباركود أو يُظهر المنتج للكاميرا فيرى السعر والتوفر."],
      ["خريطة المتجر", "«أين أجد …؟» مع الطريق إلى الرف وقائمة التسوق كمسار."],
    ] },
    { kind: "table", h: "الطابعات والأجهزة الموجودة لديك تعمل.", lead: "النص العربي يُطبع كصورة – أي طابعة فواتير ESC/POS تعمل بدون صفحة ترميز عربية.", head: ["الجهاز", "طريقة الاتصال"], rows: [
      ["طابعة فواتير 58/80 مم", "شبكة، بلوتوث على هاتف النادل، USB"],
      ["طابعات المطبخ والبار", "طابعة لكل مكان تحضير أو فاتورة مجمّعة"],
      ["أجهزة KM الخاصة بنا (ESP32)", "طابعة، شاشة، جهاز مدمج – تُكتشف تلقائياً في الواي فاي"],
      ["قارئ باركود", "USB أو بلوتوث، أو كاميرا الجهاز اللوحي"],
      ["ميزان، جهاز دفع بالبطاقة", "منفذ تسلسلي، أو ZVT عبر الشبكة"],
      ["ملصقات أسعار إلكترونية", "MQTT، تتبع سعر الصرف تلقائياً"],
    ] },
    { kind: "plans", h: "الباقات", lead: "الكاشير يعمل دائماً – حتى بعد انتهاء الاشتراك. الأسعار حسب حجم نشاطك؛ اطلب عرض سعر.", plans: [
      { n: "Free", tag: "مجاناً", items: ["الكاشير كاملاً في شبكتك", "عدة أجهزة في الشبكة المحلية", "المخزون والطاولات والمواعيد"] },
      { n: "Basic", tag: "للمتجر الواحد", hl: true, items: ["كل ما في Free", "عنوان خاص على poskm.code-craft.tech", "تطبيق الزبائن والطلب أونلاين", "الوصول من الهاتف والحضور"] },
      { n: "Pro", tag: "للنمو", items: ["كل ما في Basic", "سعر صرف تلقائي عبر API", "عدة فروع", "واجهة برمجية"] },
      { n: "Business", tag: "للسلاسل", items: ["كل ما في Pro", "للسلاسل وشبكات الفروع", "دعم بأولوية"] },
    ] },
    { kind: "table", h: "متطلبات التشغيل", head: ["الجهاز", "الحد الأدنى"], rows: [
      ["الكاشير الرئيسي – كمبيوتر", "ويندوز 10/11 64 بت، أوبونتو 22.04+ أو ديبيان 12؛ نواتان، 2 غيغابايت ذاكرة"],
      ["الكاشير الرئيسي – جهاز لوحي", "أندرويد 9+ (ARM64)، 3 غيغابايت ذاكرة؛ يُنصح بـ 4–6 غيغابايت وموصول دائماً بالشاحن"],
      ["كاشير إضافي، هاتف النادل", "أندرويد 8+، ويندوز 10+ أو لينكس، 2 غيغابايت ذاكرة"],
      ["شاشة المطبخ، شاشة الزبون", "أي جهاز عليه التطبيق، أو شاشة KM"],
      ["الشبكة", "كل الأجهزة على نفس الواي فاي؛ الإنترنت فقط للوصول عن بُعد والنسخ الاحتياطي وسعر الصرف"],
      ["تطبيق الزبائن", "أي متصفح حديث، بدون تثبيت من متجر التطبيقات"],
    ] },
    { kind: "steps", h: "ابدأ في أربع خطوات.", lead: "بدون إعدادات راوتر وبدون خبرة تقنية.", items: [
      "ثبّت الكاشير على جهاز أندرويد أو كمبيوتر – نسلّمك الحزمة أو نركّبها لك في مكانك.",
      "اختر نوع النشاط – يجهّز المعالج الأصناف والضرائب والعملة.",
      "فعّل الاشتراك بمفتاح الباقة أو اربط الجهاز ببوابة العملاء.",
      "شارك رابط تطبيق الزبائن أو رمز QR – جاهز.",
    ] },
  ],
  closing: { h: "لنتحدث عن نشاطك.", text: "أخبرنا بنوع النشاط وعدد أجهزة الكاشير وما تستخدمه اليوم. ستحصل على عرض سعر، وعلى عرض تجريبي إن رغبت." },
};

// ── KI-Server (On-Prem, Software: KM Code Craft AI) ─────────────────────────

const kiDe: ProductPage = {
  title: "On-Prem-KI-Server – KM Code Craft AI",
  eyebrow: "On-Prem-KI-Server zur Miete · KM Code Craft AI",
  h1: "Ihre eigene KI. In Ihrem eigenen Gebäude.",
  sub: "Ein fertig eingerichteter KI-Server, der komplett ohne Internet arbeitet. Wir liefern, richten ein, warten und aktualisieren ihn – Ihre Daten verlassen Ihr Netzwerk nie, laufende Cloud-Kosten gibt es nicht.",
  sheet: [
    ["Betrieb", "vollständig offline, im eigenen Netz"],
    ["Software", "KM Code Craft AI"],
    ["Oberfläche", "Arabisch (RTL) und Englisch"],
    ["Updates", "signiertes Paket per USB-Stick"],
    ["Service", "Einrichtung, Wartung, Support inklusive"],
    ["Test", "Pilot mit 30 Tagen Testphase"],
  ],
  primary: { label: "Pilotprojekt starten", to: "/kontakt?produkt=ki-server" },
  blocks: [
    { kind: "points", h: "Wofür Unternehmen ihn einsetzen.", items: [
      "Dokumenten-Workflows: Verträge, Berichte und Akten lesen, zusammenfassen und durchsuchen.",
      "Interner KI-Assistent mit Ihrem Firmenwissen – Antworten mit Quellenangabe.",
      "Code-Unterstützung mit Ihrer eigenen Codebasis.",
      "Berichte und Auswertungen aus Ihren Daten, als fertiges PDF, Word- oder Excel-Dokument.",
    ] },
    { kind: "features", h: "Was auf dem Server läuft.", lead: "KM Code Craft AI ist unsere eigene Oberfläche für die KI im Haus – für Arbeitsplätze im Netz oder als Kiosk mit Touchscreen.", items: [
      ["Chat", "Mit Bildern als Eingabe, sichtbarem Denkweg, gespeichertem Verlauf und Export als PDF."],
      ["Dokumente", "PDF, Word, PowerPoint, Excel und Bilder: Texterkennung, Fragen mit Quellenangabe, Berichte als PDF."],
      ["Video und Sprache", "Filme nach Bild und Ton durchsuchen, auf Arabisch oder Englisch; Spracheingabe."],
      ["Werkzeuge", "Erstellt Präsentationen, Word- und Excel-Dateien, erzeugt Bilder offline und rechnet in einer abgeschotteten Umgebung."],
      ["Gedächtnis", "Lernt Stil und Vorlieben über Unterhaltungen hinweg – abschaltbar."],
      ["Kiosk und Touch", "Großmodus für Touchscreens, Kiosk-Modus, Admin-PIN, Verwaltung von USB-Sticks."],
      ["Sichere Updates", "Neue Funktionen und Modelle per signiertem USB-Paket; bei einem Fehler automatisch zurück zum alten Stand."],
      ["Support ohne Einblick", "Für den Support wird nur der Systemzustand exportiert – ohne Ihre Inhalte und ohne PIN."],
    ] },
    { kind: "table", h: "Die Modelle", lead: "Alle Modelle laufen auf dem Server selbst. Auf dem Referenzgerät antwortet der Chat mit etwa 22 bis 25 Token pro Sekunde.", head: ["Modell", "Aufgabe"], rows: [
      ["Code-Craft Chat 35B", "Chat, Bilder verstehen, Texterkennung"],
      ["Code-Craft Embed", "Suche in Ihren Dokumenten"],
      ["Code-Craft Vision", "Bilder aus Videos auswerten"],
      ["Code-Craft Voice", "Spracherkennung"],
      ["Code-Craft Image", "Bilder erzeugen"],
    ] },
    { kind: "catalog", h: "Pakete", lead: "Monatliche Miete inklusive Hardware, Einrichtung, Wartung und Updates.", slug: "ki-server", month: "/Monat", custom: "Auf Anfrage" },
    { kind: "steps", h: "So kommt die KI zu Ihnen.", items: [
      "Pilot anfragen und Bedarf klären: Nutzerzahl, Dokumente, Sprachen.",
      "Wir bereiten den Server vor und schließen ihn bei Ihnen an.",
      "30 Tage testen mit Ihren eigenen Daten.",
      "Betrieb, Wartung und Updates übernehmen wir.",
    ] },
  ],
  closing: { h: "Testen Sie die KI mit Ihren eigenen Daten.", text: "Beschreiben Sie kurz, wofür Sie die KI brauchen und wie viele Personen damit arbeiten. Wir melden uns mit einem Vorschlag für den Pilot." },
};

const kiEn: ProductPage = {
  title: "On-prem AI server – KM Code Craft AI",
  eyebrow: "On-prem AI server for rent · KM Code Craft AI",
  h1: "Your own AI. In your own building.",
  sub: "A ready-to-use AI server that works entirely without internet. We deliver, set up, maintain and update it – your data never leaves your network and there are no ongoing cloud costs.",
  sheet: [
    ["Operation", "fully offline, on your own network"],
    ["Software", "KM Code Craft AI"],
    ["Interface", "Arabic (RTL) and English"],
    ["Updates", "signed package on a USB stick"],
    ["Service", "setup, maintenance, support included"],
    ["Trial", "pilot with a 30-day trial"],
  ],
  primary: { label: "Start a pilot", to: "/kontakt?produkt=ki-server" },
  blocks: [
    { kind: "points", h: "What companies use it for.", items: [
      "Document workflows: read, summarise and search contracts, reports and files.",
      "An internal AI assistant with your company knowledge – answers with sources.",
      "Coding help with your own code base.",
      "Reports and analyses from your data, as a finished PDF, Word or Excel document.",
    ] },
    { kind: "features", h: "What runs on the server.", lead: "KM Code Craft AI is our own interface for in-house AI – for desks on the network or as a touchscreen kiosk.", items: [
      ["Chat", "With images as input, visible reasoning, saved history and PDF export."],
      ["Documents", "PDF, Word, PowerPoint, Excel and images: text recognition, questions with sources, reports as PDF."],
      ["Video and voice", "Search films by picture and sound, in Arabic or English; voice input."],
      ["Tools", "Creates presentations, Word and Excel files, generates images offline and computes in an isolated sandbox."],
      ["Memory", "Learns style and preferences across conversations – can be switched off."],
      ["Kiosk and touch", "Large mode for touchscreens, kiosk mode, admin PIN, USB stick management."],
      ["Safe updates", "New features and models via a signed USB package; on any error it rolls back automatically."],
      ["Support without access", "Support only receives the system status – without your content and without the PIN."],
    ] },
    { kind: "table", h: "The models", lead: "Every model runs on the server itself. On the reference device the chat answers at about 22 to 25 tokens per second.", head: ["Model", "Task"], rows: [
      ["Code-Craft Chat 35B", "Chat, understanding images, text recognition"],
      ["Code-Craft Embed", "Search in your documents"],
      ["Code-Craft Vision", "Analysing frames from videos"],
      ["Code-Craft Voice", "Speech recognition"],
      ["Code-Craft Image", "Generating images"],
    ] },
    { kind: "catalog", h: "Plans", lead: "Monthly rent including hardware, setup, maintenance and updates.", slug: "ki-server", month: "/month", custom: "On request" },
    { kind: "steps", h: "How the AI gets to you.", items: [
      "Request a pilot and tell us your needs: users, documents, languages.",
      "We prepare the server and connect it on your site.",
      "Test for 30 days with your own data.",
      "We take care of operation, maintenance and updates.",
    ] },
  ],
  closing: { h: "Try the AI with your own data.", text: "Tell us briefly what you need the AI for and how many people will use it. We get back to you with a proposal for the pilot." },
};

const kiAr: ProductPage = {
  title: "خادم ذكاء اصطناعي داخل منشأتك – KM Code Craft AI",
  eyebrow: "خادم ذكاء اصطناعي للإيجار داخل منشأتك · KM Code Craft AI",
  h1: "ذكاء اصطناعي خاص بك. داخل مبناك.",
  sub: "خادم ذكاء اصطناعي جاهز يعمل بالكامل بدون إنترنت. نحن نسلّمه ونجهّزه ونصونه ونحدّثه – بياناتك لا تغادر شبكتك أبداً، ولا توجد تكاليف سحابية شهرية.",
  sheet: [
    ["التشغيل", "بدون إنترنت بالكامل، داخل شبكتك"],
    ["البرنامج", "KM Code Craft AI"],
    ["الواجهة", "العربية والإنجليزية"],
    ["التحديثات", "حزمة موقّعة عبر فلاشة USB"],
    ["الخدمة", "التجهيز والصيانة والدعم مشمولة"],
    ["التجربة", "مشروع تجريبي مع 30 يوماً للتجربة"],
  ],
  primary: { label: "ابدأ مشروعاً تجريبياً", to: "/kontakt?produkt=ki-server" },
  blocks: [
    { kind: "points", h: "لماذا تستخدمه الشركات.", items: [
      "سير عمل المستندات: قراءة العقود والتقارير والملفات وتلخيصها والبحث فيها.",
      "مساعد ذكي داخلي يعرف معلومات شركتك – إجابات مع ذكر المصدر.",
      "مساعدة برمجية على شيفرتك الخاصة.",
      "تقارير وتحليلات من بياناتك، جاهزة كملف PDF أو Word أو Excel.",
    ] },
    { kind: "features", h: "ما الذي يعمل على الخادم.", lead: "KM Code Craft AI هي واجهتنا الخاصة للذكاء الاصطناعي داخل المنشأة – لأجهزة المكاتب على الشبكة أو كجهاز كشك بشاشة لمس.", items: [
      ["محادثة", "مع إدخال الصور، وعرض خطوات التفكير، وحفظ السجل، والتصدير كملف PDF."],
      ["المستندات", "PDF وWord وPowerPoint وExcel والصور: تعرّف على النصوص، أسئلة مع ذكر المصدر، تقارير بصيغة PDF."],
      ["الفيديو والصوت", "البحث في الأفلام بالصورة والصوت، بالعربية أو الإنجليزية؛ إدخال صوتي."],
      ["أدوات", "ينشئ عروضاً تقديمية وملفات Word وExcel، ويولّد الصور بدون إنترنت، وينفّذ الحسابات في بيئة معزولة."],
      ["ذاكرة", "يتعلم أسلوبك وتفضيلاتك عبر المحادثات – ويمكن إيقافها."],
      ["كشك ولمس", "وضع الخط الكبير لشاشات اللمس، وضع الكشك، رمز PIN للمسؤول، إدارة فلاشات USB."],
      ["تحديثات آمنة", "ميزات ونماذج جديدة عبر حزمة USB موقّعة؛ وعند أي خطأ يعود تلقائياً إلى النسخة السابقة."],
      ["دعم بدون اطلاع", "يُصدَّر للدعم الفني حالة النظام فقط – بدون محتواك وبدون رمز PIN."],
    ] },
    { kind: "table", h: "النماذج", lead: "كل النماذج تعمل على الخادم نفسه. على الجهاز المرجعي يجيب نموذج المحادثة بسرعة 22 إلى 25 رمزاً في الثانية تقريباً.", head: ["النموذج", "المهمة"], rows: [
      ["Code-Craft Chat 35B", "محادثة، فهم الصور، التعرّف على النصوص"],
      ["Code-Craft Embed", "البحث في مستنداتك"],
      ["Code-Craft Vision", "تحليل لقطات الفيديو"],
      ["Code-Craft Voice", "التعرّف على الكلام"],
      ["Code-Craft Image", "توليد الصور"],
    ] },
    { kind: "catalog", h: "الباقات", lead: "إيجار شهري يشمل الجهاز والتجهيز والصيانة والتحديثات.", slug: "ki-server", month: "/شهرياً", custom: "حسب الطلب" },
    { kind: "steps", h: "كيف يصل الذكاء الاصطناعي إليك.", items: [
      "اطلب مشروعاً تجريبياً وحدّد احتياجك: عدد المستخدمين، المستندات، اللغات.",
      "نجهّز الخادم ونركّبه في مكانك.",
      "جرّب لمدة 30 يوماً ببياناتك الخاصة.",
      "نتولى التشغيل والصيانة والتحديثات.",
    ] },
  ],
  closing: { h: "جرّب الذكاء الاصطناعي ببياناتك الخاصة.", text: "صف لنا باختصار لماذا تحتاج الذكاء الاصطناعي وكم شخصاً سيستخدمه. سنعود إليك باقتراح للمشروع التجريبي." },
};

// ── Maps Syria ──────────────────────────────────────────────────────────────

const mapsDe: ProductPage = {
  title: "Maps Syria – Karten und Navigation für Syrien",
  eyebrow: "Maps Syria · خرائط سوريا",
  h1: "Karten und Navigation für Syrien. Aus Syrien.",
  sub: "Ein Navigations- und Kartensystem, gebaut speziell für Syrien – im Browser und als Android-App. Eine verlässliche, lokale Alternative zu ausländischen Kartendiensten, kostenlos nutzbar.",
  sheet: [
    ["Plattform", "Webseite und Android-App mit Android Auto"],
    ["Navigation", "Auto und zu Fuß, mit Sprachansagen"],
    ["Suche", "Orte und Adressen in ganz Syrien"],
    ["Offline", "Städte herunterladen und ohne Netz nutzen"],
    ["Server", "betrieben von code-craft.tech in Syrien"],
    ["Kosten", "kostenlos"],
  ],
  primary: { label: "Karte öffnen", to: "https://maps.code-craft.tech" },
  blocks: [
    { kind: "features", h: "Was Maps Syria kann.", items: [
      ["Navigation", "Routen für Auto und Fußgänger mit Sprachansagen Schritt für Schritt."],
      ["Suche", "Orte und Adressen in ganz Syrien, mit lokalen Straßennamen."],
      ["Offline-Karten", "Städtedaten herunterladen und die Karte ohne Internet nutzen."],
      ["Live-Verkehr", "Staus und Verkehrslage aus anonymisierten Fahrten der Nutzer."],
      ["Meldungen", "Unfälle, Sperrungen und Stau melden – andere Nutzer bestätigen oder verwerfen sie."],
      ["Wichtige Orte", "Apotheken, Krankenhäuser und Tankstellen, mit Nachtdiensten."],
      ["Kartenansichten", "Straßenkarte, Satellitenbild und 3D-Ansicht."],
      ["KI-Kartenpflege", "Erkennt neue und gesperrte Straßen auf Satellitenbildern und hält die Karte aktuell."],
    ] },
    { kind: "points", dark: true, h: "Ihre Daten bleiben im Land.", lead: "Die Server stehen in Syrien und werden von code-craft.tech betrieben – Datenbank, Routing, Suche und Schnittstelle für Webseite und App.", items: [
      "Keine Daten auf Servern oder Clouds außerhalb Syriens.",
      "Standortdaten für den Verkehr werden anonym ausgewertet.",
      "Kartengrundlage ist OpenStreetMap, ergänzt um eigene Erhebungen und Vorschläge der Nutzer.",
      "Vorschläge für neue Orte prüft unser Team, bevor sie auf der Karte erscheinen.",
    ] },
  ],
  closing: { h: "Probieren Sie es aus.", text: "Öffnen Sie die Karte im Browser oder installieren Sie die Android-App direkt von der Kartenseite. Für Unternehmen und Behörden sprechen Sie uns gern an." },
};

const mapsEn: ProductPage = {
  title: "Maps Syria – maps and navigation for Syria",
  eyebrow: "Maps Syria · خرائط سوريا",
  h1: "Maps and navigation for Syria. From Syria.",
  sub: "A navigation and map system built specifically for Syria – in the browser and as an Android app. A reliable, local alternative to foreign map services, free to use.",
  sheet: [
    ["Platform", "Website and Android app with Android Auto"],
    ["Navigation", "Car and on foot, with voice guidance"],
    ["Search", "Places and addresses across Syria"],
    ["Offline", "Download cities and use them without signal"],
    ["Servers", "run by code-craft.tech inside Syria"],
    ["Cost", "free"],
  ],
  primary: { label: "Open the map", to: "https://maps.code-craft.tech" },
  blocks: [
    { kind: "features", h: "What Maps Syria does.", items: [
      ["Navigation", "Routes for cars and pedestrians with turn-by-turn voice guidance."],
      ["Search", "Places and addresses across Syria, with local street names."],
      ["Offline maps", "Download city data and use the map without internet."],
      ["Live traffic", "Jams and traffic from anonymised user trips."],
      ["Reports", "Report accidents, closures and jams – other users confirm or dismiss them."],
      ["Important places", "Pharmacies, hospitals and petrol stations, with night duty."],
      ["Map views", "Street map, satellite imagery and a 3D view."],
      ["AI map upkeep", "Detects new and closed roads on satellite images and keeps the map current."],
    ] },
    { kind: "points", dark: true, h: "Your data stays in the country.", lead: "The servers are in Syria and run by code-craft.tech – database, routing, search and the API for website and app.", items: [
      "No data on servers or clouds outside Syria.",
      "Location data for traffic is analysed anonymously.",
      "The base map is OpenStreetMap, extended with our own surveys and user suggestions.",
      "Our team reviews suggested places before they appear on the map.",
    ] },
  ],
  closing: { h: "Give it a try.", text: "Open the map in your browser or install the Android app straight from the map page. Companies and authorities are welcome to contact us." },
};

const mapsAr: ProductPage = {
  title: "خرائط سوريا – خرائط وملاحة لسوريا",
  eyebrow: "خرائط سوريا · Maps Syria",
  h1: "خرائط وملاحة لسوريا. من داخل سوريا.",
  sub: "نظام ملاحة وخرائط مصمم خصيصاً لسوريا – في المتصفح وكتطبيق أندرويد. بديل محلي موثوق لخدمات الخرائط الأجنبية، ومجاني الاستخدام.",
  sheet: [
    ["المنصة", "الموقع الإلكتروني وتطبيق أندرويد مع Android Auto"],
    ["الملاحة", "بالسيارة وسيراً على الأقدام، مع إرشاد صوتي"],
    ["البحث", "الأماكن والعناوين في كل سوريا"],
    ["بدون إنترنت", "نزّل المدن واستخدمها بدون شبكة"],
    ["الخوادم", "تديرها code-craft.tech داخل سوريا"],
    ["التكلفة", "مجاناً"],
  ],
  primary: { label: "افتح الخريطة", to: "https://maps.code-craft.tech" },
  blocks: [
    { kind: "features", h: "ماذا تقدم خرائط سوريا.", items: [
      ["الملاحة", "مسارات للسيارات والمشاة مع إرشاد صوتي خطوة بخطوة."],
      ["البحث", "الأماكن والعناوين في كل سوريا، بأسماء الشوارع المحلية."],
      ["خرائط بدون إنترنت", "نزّل بيانات المدن واستخدم الخريطة بدون إنترنت."],
      ["حركة السير مباشرة", "الازدحام وحالة الطرق من رحلات المستخدمين مجهولة المصدر."],
      ["البلاغات", "أبلغ عن الحوادث وإغلاق الطرق والازدحام – ويؤكدها المستخدمون الآخرون أو يرفضونها."],
      ["أماكن مهمة", "صيدليات ومستشفيات ومحطات وقود، مع المناوبات الليلية."],
      ["أنواع العرض", "خريطة الشوارع، صور الأقمار الصناعية، وعرض ثلاثي الأبعاد."],
      ["تحديث الخريطة بالذكاء الاصطناعي", "يكتشف الطرق الجديدة والمغلقة من صور الأقمار الصناعية ويحافظ على حداثة الخريطة."],
    ] },
    { kind: "points", dark: true, h: "بياناتك تبقى داخل البلد.", lead: "الخوادم موجودة في سوريا وتديرها code-craft.tech – قاعدة البيانات والتوجيه والبحث والواجهة البرمجية للموقع والتطبيق.", items: [
      "لا تُستضاف أي بيانات على خوادم أو سحابات خارج سوريا.",
      "بيانات الموقع لحركة السير تُحلَّل بشكل مجهول المصدر.",
      "أساس الخريطة OpenStreetMap، مع مسوحاتنا الخاصة واقتراحات المستخدمين.",
      "يراجع فريقنا الأماكن المقترحة قبل ظهورها على الخريطة.",
    ] },
  ],
  closing: { h: "جرّبها بنفسك.", text: "افتح الخريطة في المتصفح أو ثبّت تطبيق أندرويد مباشرة من صفحة الخريطة. يسعدنا تواصل الشركات والجهات الرسمية معنا." },
};

export const PRODUCTS: Record<ProductKey, Record<Locale, ProductPage>> = {
  kasse: { de: kasseDe, en: kasseEn, ar: kasseAr },
  "ki-server": { de: kiDe, en: kiEn, ar: kiAr },
  karten: { de: mapsDe, en: mapsEn, ar: mapsAr },
  radiologie: RADIOLOGIE,
};

export const PRODUCT_PATH: Record<ProductKey, string> = { kasse: "/kasse", "ki-server": "/ki-server", karten: "/karten", radiologie: "/radiologie" };
