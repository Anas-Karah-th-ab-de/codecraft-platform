// Produktseite Ultar OS (/ultar-os) – DE/EN/AR.
// Quelle: Repo ultar-os (README, docs/ARCHITEKTUR.md, docs/APPS.md, docs/SYSTEM-FUNKTIONEN-2.md, docs/A30-*.md), Stand 20.11.2026.
// Bilder: docs/bilder/galerie (Beispieldaten, keine echten Kontakte). Bei neuem Entwicklungsstand die Tabelle „Stand“ anpassen.
import type { Locale } from "../../i18n";
import type { ProductPage } from "./productText";

const IMG = "/products/ultar-os";

export const ULTAR_TEASER: Record<Locale, [string, string]> = {
  de: ["Ultar OS", "Eigenes Betriebssystem für Handy, Tablet und Platine – ohne Android-Ballast."],
  en: ["Ultar OS", "Our own operating system for phones, tablets and boards – without the Android baggage."],
  ar: ["Ultar OS", "نظام تشغيل خاص بنا للهاتف والتابلت واللوحات – بلا أعباء أندرويد."],
};

const de: ProductPage = {
  title: "Ultar OS – eigenes Betriebssystem für Handy, Tablet und Platine",
  eyebrow: "Ultar OS · Betriebssystem in Rust · in Entwicklung",
  h1: "Ein Handy-Betriebssystem, das Ihnen gehört.",
  sub: "Ultar OS ersetzt Android durch ein schlankes System in Rust: Linux-Kernel für die Treiber, darüber unsere eigene Oberfläche und eigene Dienste – ohne Java-VM, ohne Herstellersoftware, ohne Datensammelei. Arabisch zuerst. Eine Desktop-Version für PC und Laptop folgt in Kürze.",
  sheet: [
    ["Stand", "In Entwicklung, läuft auf dem Testgerät Samsung Galaxy A30"],
    ["Basis", "Linux-Kernel, eigener Rust-Userspace, keine Java-VM"],
    ["Geräte", "Handys, Tablets, Entwicklungsplatinen – Desktop folgt bald"],
    ["Speicher", "rund 65 MB RAM mit Oberfläche (gemessen in der Emulation)"],
    ["Apps", "eigene Rust-Apps und Ubuntu-Pakete (apt/.deb)"],
    ["Sprachen", "Arabisch (rechts nach links), Englisch, Deutsch"],
  ],
  primary: { label: "Interesse melden", to: "/kontakt" },
  secondary: { label: "Stand der Entwicklung", to: "#stand" },
  blocks: [
    {
      kind: "features", h: "Was Ultar OS anders macht", items: [
        ["Kein Android-Ballast", "Android ist nicht wegen des Kernels langsam, sondern wegen der Schichten darüber. Ultar startet eigene Dienste direkt – das Startprogramm ist 1,5 MB groß und braucht im Leerlauf keine Rechenzeit."],
        ["Ubuntu-Programme inklusive", "Ubuntu 24.04 läuft abgeschottet auf demselben Kernel – keine virtuelle Maschine, kein Leistungsverlust. Pakete lassen sich mit apt oder offline als .deb installieren."],
        ["Volle Kontrolle", "Keine Herstellersoftware, keine Pflicht-Konten. Jeder Dienst läuft mit eigenen Grenzen für Speicher und Rechenzeit. Updates kommen nur mit passender Prüfsumme."],
        ["Arabisch zuerst", "Rechts-nach-links-Oberfläche, Hijri-Datum, Gebetszeiten und Qibla-Richtung sind eingebaut, nicht nachgerüstet."],
      ],
    },
    {
      kind: "gallery", h: "So sieht Ultar OS aus", lead: "Bildschirme aus der aktuellen Entwicklungsfassung, mit Beispieldaten.",
      items: [
        [`${IMG}/uebersicht.png`, "Start, Schnelleinstellungen, Mobilfunk, Telefon, Nachrichten – auch auf Arabisch"],
        [`${IMG}/runde2.png`, "Werkzeuge, Gebetszeiten, Qibla, Nutzungszeit, Gerätepflege, Akku-Verlauf"],
        [`${IMG}/apps-neu-ar.png`, "Eingebaute Apps auf Arabisch"],
        [`${IMG}/monitor.png`, "Monitor: Prozessor, Speicher und Datenverkehr"],
      ],
    },
    {
      kind: "features", h: "Schon eingebaut", lead: "Alle Apps sind nativer Rust-Code – sie passen sich an Hochformat, Querformat und Tablets an.", items: [
        ["Telefon und Mobilfunk", "Mobilfunk-Zentrum mit Funkturm-Wahl (automatisch, smart oder von Hand), zwei SIM-Karten, Nachrichten."],
        ["Kamera mit Scanner", "Foto und Video, Dokumentenscanner mit Ecken-Erkennung und Entzerrung als PDF, Taschenlampe."],
        ["Entsperren", "PIN, Fingerabdruck und Gesichtserkennung – die Gesichtserkennung rechnet vollständig offline auf dem Gerät."],
        ["Der Helfer", "Eine kleine Figur auf jeder Seite: erklärt das System beim ersten Start, erinnert an Termine und prüft Links in einer abgeschotteten Umgebung, bevor man sie öffnet."],
        ["Über 50 Werkzeuge", "Kompass, Wasserwaage, Qibla, Gebetszeiten, Rechner, Währungs- und Ratenrechner, Aufgaben, Erinnerungen, Notfall."],
        ["Datenschutz", "Werbe- und Tracker-Server werden systemweit gesperrt. Verschlüsselung der Daten und eigenes Netz-Relay sind vorbereitet."],
        ["Monitor", "Auslastung von Prozessor, Speicher, Grafik- und KI-Chip, Datenverkehr je Tag."],
        ["Lokaler KI-Agent", "Optional: ein Sprachmodell auf dem Gerät bedient das System per Sprache oder Text. Riskante Aktionen brauchen eine Bestätigung."],
      ],
    },
    {
      kind: "table", id: "stand", h: "Stand der Entwicklung", lead: "Ehrlich und aktuell (20.11.2026). Testgerät ist ein Samsung Galaxy A30.",
      head: ["Bereich", "Stand"],
      rows: [
        ["Oberfläche, Apps, Werkzeuge", "fertig, getestet auf Deutsch, Englisch und Arabisch"],
        ["Anzeige, Touch, Tasten, Speicher, Akku, WLAN, Sensoren", "laufen auf dem A30"],
        ["Kamera", "läuft auf dem A30, inklusive Dokumentenscanner"],
        ["Fingerabdruck, Gesicht, Sprachsteuerung", "eingebaut, Praxistest am Gerät läuft"],
        ["Ton und Mikrofon", "erste Funktionen laufen, Feinschliff läuft"],
        ["Mobilfunk und SIM", "Modem startet, SIM-Anmeldung in Arbeit"],
        ["Desktop-Version (PC, Laptop)", "folgt in Kürze"],
      ],
    },
    {
      kind: "points", dark: true, h: "Für wen Ultar OS gedacht ist", items: [
        "Firmen und Einrichtungen, die volle Kontrolle über ihre Geräte brauchen – ohne fremde Konten und Cloud-Zwang.",
        "Geräte im Einsatz: Kassen, Handgeräte, Kiosk-Systeme und Industrie-Platinen mit genau den Funktionen, die gebraucht werden.",
        "Ältere Handys, die mit Android zu langsam geworden sind.",
        "Partner und Hersteller, die ein eigenes, arabischsprachiges System anbieten wollen.",
      ],
    },
  ],
  closing: { h: "Interesse an Ultar OS?", text: "Sie möchten Ultar OS auf Ihren Geräten testen, mitentwickeln oder als Erste von der Desktop-Version erfahren? Schreiben Sie uns kurz, welche Geräte Sie einsetzen." },
};

const en: ProductPage = {
  title: "Ultar OS – our own operating system for phones, tablets and boards",
  eyebrow: "Ultar OS · operating system in Rust · in development",
  h1: "A phone operating system that belongs to you.",
  sub: "Ultar OS replaces Android with a lean system written in Rust: the Linux kernel for drivers, and on top our own interface and services – no Java VM, no vendor software, no data harvesting. Arabic first. A desktop version for PCs and laptops is coming soon.",
  sheet: [
    ["Status", "In development, runs on our test device, a Samsung Galaxy A30"],
    ["Base", "Linux kernel, own Rust userspace, no Java VM"],
    ["Devices", "Phones, tablets, development boards – desktop coming soon"],
    ["Memory", "about 65 MB RAM with the interface (measured in emulation)"],
    ["Apps", "our own Rust apps and Ubuntu packages (apt/.deb)"],
    ["Languages", "Arabic (right to left), English, German"],
  ],
  primary: { label: "Register interest", to: "/kontakt" },
  secondary: { label: "Development status", to: "#stand" },
  blocks: [
    {
      kind: "features", h: "What makes Ultar OS different", items: [
        ["No Android baggage", "Android isn't slow because of its kernel but because of the layers on top. Ultar starts its own services directly – the init program is 1.5 MB and uses no CPU time when idle."],
        ["Ubuntu programs included", "Ubuntu 24.04 runs isolated on the same kernel – no virtual machine, no performance loss. Packages install with apt or offline as .deb."],
        ["Full control", "No vendor software, no mandatory accounts. Every service runs with its own memory and CPU limits. Updates are only applied with a matching checksum."],
        ["Arabic first", "Right-to-left interface, Hijri date, prayer times and Qibla direction are built in, not bolted on."],
      ],
    },
    {
      kind: "gallery", h: "What Ultar OS looks like", lead: "Screens from the current development build, with sample data.",
      items: [
        [`${IMG}/uebersicht.png`, "Home, quick settings, mobile network, phone, messages – also in Arabic"],
        [`${IMG}/runde2.png`, "Tools, prayer times, Qibla, screen time, device care, battery history"],
        [`${IMG}/apps-neu-ar.png`, "Built-in apps in Arabic"],
        [`${IMG}/monitor.png`, "Monitor: CPU, memory and data usage"],
      ],
    },
    {
      kind: "features", h: "Already built in", lead: "All apps are native Rust code – they adapt to portrait, landscape and tablets.", items: [
        ["Phone and mobile network", "Mobile network centre with cell tower choice (automatic, smart or manual), dual SIM, messages."],
        ["Camera with scanner", "Photo and video, document scanner with edge detection and correction to PDF, torch."],
        ["Unlocking", "PIN, fingerprint and face recognition – face recognition runs fully offline on the device."],
        ["The helper", "A small figure on every screen: introduces the system on first start, reminds you of appointments and checks links in a sealed-off sandbox before you open them."],
        ["More than 50 tools", "Compass, spirit level, Qibla, prayer times, calculator, currency and loan calculator, tasks, reminders, emergency."],
        ["Privacy", "Ad and tracker servers are blocked system-wide. Data encryption and our own network relay are prepared."],
        ["Monitor", "Load of CPU, memory, graphics and AI chip, data usage per day."],
        ["Local AI agent", "Optional: a language model on the device operates the system by voice or text. Risky actions need confirmation."],
      ],
    },
    {
      kind: "table", id: "stand", h: "Development status", lead: "Honest and current (20 Nov 2026). Our test device is a Samsung Galaxy A30.",
      head: ["Area", "Status"],
      rows: [
        ["Interface, apps, tools", "done, tested in German, English and Arabic"],
        ["Display, touch, buttons, storage, battery, Wi-Fi, sensors", "running on the A30"],
        ["Camera", "running on the A30, including the document scanner"],
        ["Fingerprint, face, voice control", "built in, hands-on testing on the device in progress"],
        ["Sound and microphone", "first functions running, fine-tuning in progress"],
        ["Mobile network and SIM", "modem starts, SIM registration in progress"],
        ["Desktop version (PC, laptop)", "coming soon"],
      ],
    },
    {
      kind: "points", dark: true, h: "Who Ultar OS is for", items: [
        "Companies and institutions that need full control over their devices – without third-party accounts or forced cloud.",
        "Devices in the field: tills, handhelds, kiosk systems and industrial boards with exactly the functions they need.",
        "Older phones that have become too slow with Android.",
        "Partners and manufacturers who want to offer their own Arabic-first system.",
      ],
    },
  ],
  closing: { h: "Interested in Ultar OS?", text: "Would you like to test Ultar OS on your devices, build with us, or be the first to hear about the desktop version? Tell us briefly which devices you use." },
};

const ar: ProductPage = {
  title: "Ultar OS – نظام تشغيل خاص بنا للهاتف والتابلت واللوحات",
  eyebrow: "Ultar OS · نظام تشغيل بلغة Rust · قيد التطوير",
  h1: "نظام تشغيل للهاتف ملكٌ لك.",
  sub: "يستبدل Ultar OS نظام أندرويد بنظام خفيف مكتوب بلغة Rust: نواة لينكس للتعريفات، وفوقها واجهتنا وخدماتنا الخاصة – دون آلة جافا الافتراضية، ودون برامج الشركات المصنّعة، ودون جمع للبيانات. العربية أولاً. ونسخة سطح المكتب للحاسوب واللابتوب قادمة قريباً.",
  sheet: [
    ["الحالة", "قيد التطوير، يعمل على جهاز الاختبار Samsung Galaxy A30"],
    ["الأساس", "نواة لينكس، ومساحة مستخدم خاصة بلغة Rust، دون آلة جافا"],
    ["الأجهزة", "الهواتف والتابلت ولوحات التطوير – سطح المكتب قريباً"],
    ["الذاكرة", "نحو 65 ميغابايت مع الواجهة (مقاسة في المحاكاة)"],
    ["التطبيقات", "تطبيقاتنا بلغة Rust وحزم أوبونتو (apt/.deb)"],
    ["اللغات", "العربية (من اليمين لليسار)، الإنجليزية، الألمانية"],
  ],
  primary: { label: "سجّل اهتمامك", to: "/kontakt" },
  secondary: { label: "مرحلة التطوير", to: "#stand" },
  blocks: [
    {
      kind: "features", h: "ما الذي يميّز Ultar OS", items: [
        ["بلا أعباء أندرويد", "بطء أندرويد لا يأتي من النواة بل من الطبقات فوقها. يشغّل Ultar خدماته مباشرة – برنامج الإقلاع حجمه 1,5 ميغابايت ولا يستهلك المعالج أثناء الخمول."],
        ["برامج أوبونتو مشمولة", "يعمل أوبونتو 24.04 معزولاً على النواة نفسها – دون آلة افتراضية ودون خسارة في الأداء. تُثبَّت الحزم عبر apt أو دون إنترنت كملفات .deb."],
        ["تحكّم كامل", "لا برامج للشركات المصنّعة ولا حسابات إلزامية. كل خدمة تعمل بحدود خاصة للذاكرة والمعالج. ولا تُثبَّت التحديثات إلا بمجموع تحقق مطابق."],
        ["العربية أولاً", "واجهة من اليمين لليسار، والتاريخ الهجري، ومواقيت الصلاة، واتجاه القبلة مدمجة من الأساس لا مضافة لاحقاً."],
      ],
    },
    {
      kind: "gallery", h: "هكذا يبدو Ultar OS", lead: "شاشات من نسخة التطوير الحالية، ببيانات تجريبية.",
      items: [
        [`${IMG}/uebersicht.png`, "الشاشة الرئيسية، الإعدادات السريعة، الشبكة الخلوية، الهاتف، الرسائل – وبالعربية أيضاً"],
        [`${IMG}/runde2.png`, "الأدوات، مواقيت الصلاة، القبلة، وقت الاستخدام، العناية بالجهاز، سجل البطارية"],
        [`${IMG}/apps-neu-ar.png`, "التطبيقات المدمجة بالعربية"],
        [`${IMG}/monitor.png`, "المراقبة: المعالج والذاكرة واستهلاك البيانات"],
      ],
    },
    {
      kind: "features", h: "مدمج بالفعل", lead: "كل التطبيقات مكتوبة بلغة Rust الأصلية – وتتكيّف مع الوضع العمودي والأفقي والتابلت.", items: [
        ["الهاتف والشبكة الخلوية", "مركز للشبكة الخلوية مع اختيار برج الاتصال (تلقائي، ذكي أو يدوي)، وشريحتان، والرسائل."],
        ["كاميرا مع ماسح ضوئي", "صور وفيديو، وماسح للمستندات يكتشف الحواف ويصحّحها إلى PDF، ومصباح."],
        ["فتح القفل", "رمز PIN وبصمة الإصبع والتعرّف على الوجه – ويعمل التعرّف على الوجه كاملاً على الجهاز دون إنترنت."],
        ["المساعد", "شخصية صغيرة على كل شاشة: تعرّفك بالنظام عند أول تشغيل، وتذكّرك بالمواعيد، وتفحص الروابط في بيئة معزولة قبل فتحها."],
        ["أكثر من 50 أداة", "بوصلة، ميزان ماء، القبلة، مواقيت الصلاة، آلة حاسبة، حاسبة العملات والأقساط، المهام، التذكيرات، الطوارئ."],
        ["الخصوصية", "حظر خوادم الإعلانات والتتبّع على مستوى النظام. وتشفير البيانات ومرحّل الشبكة الخاص بنا جاهزان للتفعيل."],
        ["المراقبة", "حمل المعالج والذاكرة ومعالج الرسوميات وشريحة الذكاء الاصطناعي، واستهلاك البيانات يومياً."],
        ["وكيل ذكاء اصطناعي محلي", "اختياري: نموذج لغوي على الجهاز يشغّل النظام بالصوت أو الكتابة. والإجراءات الحساسة تحتاج إلى تأكيد."],
      ],
    },
    {
      kind: "table", id: "stand", h: "مرحلة التطوير", lead: "بصدق وبأحدث المعلومات (20/11/2026). جهاز الاختبار هو Samsung Galaxy A30.",
      head: ["المجال", "الحالة"],
      rows: [
        ["الواجهة والتطبيقات والأدوات", "مكتملة، ومختبرة بالعربية والإنجليزية والألمانية"],
        ["الشاشة واللمس والأزرار والتخزين والبطارية والواي فاي والحساسات", "تعمل على A30"],
        ["الكاميرا", "تعمل على A30، بما فيها ماسح المستندات"],
        ["البصمة والوجه والتحكم الصوتي", "مدمجة، والاختبار العملي على الجهاز جارٍ"],
        ["الصوت والميكروفون", "الوظائف الأولى تعمل، والتحسين جارٍ"],
        ["الشبكة الخلوية والشريحة", "المودم يعمل، وتسجيل الشريحة قيد العمل"],
        ["نسخة سطح المكتب (حاسوب، لابتوب)", "قريباً"],
      ],
    },
    {
      kind: "points", dark: true, h: "لمن صُمّم Ultar OS", items: [
        "الشركات والمؤسسات التي تحتاج تحكّماً كاملاً بأجهزتها – دون حسابات خارجية أو سحابة إلزامية.",
        "الأجهزة الميدانية: أجهزة الكاشير والأجهزة المحمولة وأنظمة الأكشاك واللوحات الصناعية بالوظائف المطلوبة فقط.",
        "الهواتف القديمة التي أصبحت بطيئة مع أندرويد.",
        "الشركاء والمصنّعون الذين يريدون تقديم نظام خاص بهم يبدأ بالعربية.",
      ],
    },
  ],
  closing: { h: "مهتم بـ Ultar OS؟", text: "هل تريد تجربة Ultar OS على أجهزتك، أو المشاركة في تطويره، أو أن تكون أول من يعرف بنسخة سطح المكتب؟ اكتب لنا باختصار ما الأجهزة التي تستخدمها." },
};

export const ULTAR: Record<Locale, ProductPage> = { de, en, ar };
