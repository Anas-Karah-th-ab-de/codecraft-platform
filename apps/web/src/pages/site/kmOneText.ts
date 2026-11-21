// Produktseite KM One (/km-one) – DE/EN/AR.
// Quelle: Projekt-Konzept „KM Code Craft Handy“ (21.11.2026). Das Gerät ist in Entwicklung: Angaben sind Planung,
// Bilder sind Visualisierungen (tools/render/phone.py im Repo ultar-os), Bildschirme aus dem echten Ultar OS.
import type { Locale } from "../../i18n";
import type { ProductPage } from "./productText";

const IMG = "/products/km-one";
const CONTACT = "/kontakt?produkt=km-one";
const DEMO = (l: Locale) => `/products/ultar-os/demo/index.html?lang=${l}`;

export const KMONE_TEASER: Record<Locale, [string, string]> = {
  de: ["KM One", "Robustes Handy mit Ultar OS – Netz auch dort, wo andere keins haben."],
  en: ["KM One", "Rugged phone with Ultar OS – coverage where others have none."],
  ar: ["KM One", "هاتف متين بنظام Ultar OS – شبكة حيث لا يوجد لدى غيره."],
};

const de: ProductPage = {
  title: "KM One – robustes Handy mit Ultar OS",
  eyebrow: "KM One · in Entwicklung · Pilotkunden gesucht",
  h1: "Das Handy, das funktioniert, wo andere aufgeben.",
  sub: "KM One ist unser eigenes Handy mit unserem eigenen Betriebssystem Ultar OS. Es gewinnt nicht bei Kamera oder Rechenleistung gegen Samsung, sondern bei dem, was im Einsatz zählt: robust, mindestens 5 Jahre Updates, Datenschutz, Arabisch zuerst, lokale KI und Netz auch dort, wo andere keins haben.",
  sheet: [
    ["Stand", "In Entwicklung – Design-Entwurf, Pilotphase"],
    ["System", "Ultar OS Pur (ohne Android) oder Plus (mit abgeschotteter Android-Laufzeit)"],
    ["Plattform", "Qualcomm QCM6490 mit Langzeit-Support (geplant)"],
    ["Schutz", "IP68, Gummi-Eckpuffer, verschraubt"],
    ["Funk", "5G, LTE-450, LoRa, Wi-Fi HaLow, Satelliten-SOS (geplant)"],
    ["Updates", "mindestens 5 Jahre, eigener Update-Server"],
    ["Preis", "ca. 350 USD je Gerät, Service-Abo ca. 48 USD pro Jahr (Richtwerte)"],
    ["Für", "Firmen, Behörden und NGOs – zuerst in Syrien"],
  ],
  primary: { label: "Als Pilotkunde anfragen", to: CONTACT },
  secondary: { label: "Ultar OS im Browser ausprobieren", to: DEMO("de") },
  blocks: [
    {
      kind: "gallery", h: "So soll das KM One aussehen", lead: "Visualisierungen des geplanten Designs. Die Bildschirme stammen aus dem echten Ultar OS.", items: [
        [`${IMG}/km-one-hero.jpg`, "Vorder- und Rückseite mit Stabantenne"],
        [`${IMG}/km-one-colors.jpg`, "Drei Ausführungen: Noir Gold, Wüste, Signal"],
        [`${IMG}/km-one-back.jpg`, "Punktanzeige: neue Nachricht über LoRa"],
        [`${IMG}/km-one-sos.jpg`, "SOS aktiv – Notruf über Netz, LoRa oder Satellit"],
      ],
    },
    {
      kind: "features", h: "Warum KM One", items: [
        ["Robust", "IP68, Gummi-Eckpuffer, Schrauben statt Kleber. Akku und Rückdeckel sind tauschbar – gebaut für 5 Jahre und mehr."],
        ["Netz überall", "Ausziehbare Stabantenne, stärkere Sendeleistung, LoRa, Satelliten-SOS und LTE-450 für weite Flächen."],
        ["Privat und sicher", "Nur signierte Apps, Verschlüsselung, eigene Secure-Boot-Schlüssel, eigener VPN, Store und Update-Server."],
        ["Arabisch und lokale KI", "Oberfläche zuerst auf Arabisch, der KM-Helfer läuft offline auf dem Gerät. Ihre Daten bleiben bei Ihnen."],
      ],
    },
    {
      kind: "anatomy", id: "rueckseite", h: "Rückseite: Werkzeug, kein Schmuckstück", img: `${IMG}/km-one-back.jpg`, alt: "Rückseite des KM One", items: [
        ["Ausziehbare Stabantenne", "Oben rechts, mit goldener Kappe. Herausgezogen bringt sie im Randgebiet spürbar mehr Empfang."],
        ["Kamera-Insel", "50 MP mit Bildstabilisator plus Ultraweit. Verschraubt und einzeln tauschbar."],
        ["Punktanzeige", "15 × 7 Punkte zeigen Netz, LoRa-Nachricht, SOS, Satellit und Ladestand, ohne den Bildschirm einzuschalten."],
        ["Sichtfenster", "Die Antennen-Leiterbahnen für LoRa und LTE-450 bleiben sichtbar – als Zeichen für das Funkpaket."],
        ["Gummi-Eckpuffer", "Vier stoßdämpfende Ecken, IP68-dicht."],
        ["Sichtbare Schrauben", "Schrauben statt Klebstoff: Akku und Rückdeckel sind wechselbar, für 5 Jahre und mehr."],
        ["KM-Logo", "Graviert, darunter „Ultar OS · IP68“ und „صُمّم في سوريا“. Auf Wunsch Ihr eigenes Logo."],
        ["Trageband-Öse", "In der unteren Ecke, für Trageband oder Karabiner im Feldeinsatz."],
      ],
    },
    {
      kind: "matrix", id: "punktanzeige", h: "Punktanzeige: der Status auf einen Blick", lead: "Dieselbe Punktschrift wie die Uhr in Ultar OS. Das Handy kann mit dem Bildschirm nach unten liegen und zeigt trotzdem, was los ist – und spart Akku, weil der Bildschirm aus bleibt.", items: [
        ["signal", "Netzstärke", "Fünf Balken für Mobilfunk. Bei LTE-450 oder LoRa wechselt die Farbe."],
        ["msg", "LoRa-Nachricht", "Nachricht ohne Mobilfunk empfangen. Bis zum Lesen pulsiert sie langsam."],
        ["sos", "SOS aktiv", "Blinkt rot, solange der Notruf läuft. Dazu wird der Standort gesendet."],
        ["sat", "Satellit verbunden", "Kein Netz am Boden: SOS und Kurznachrichten gehen über Satellit."],
        ["charge", "Laden", "Ladestand beim Laden oder in der Autohalterung."],
      ],
    },
    {
      kind: "features", id: "tasten", h: "Tasten und Anschlüsse", lead: "Alles mit Handschuh bedienbar. Keine Taste liegt dort, wo man sie aus Versehen drückt.", items: [
        ["SOS-Taste", "Orange, geriffelt, versenkt hinter einem Steg. 3 Sekunden halten: Notruf über Netz, LoRa oder Satellit."],
        ["KM-Taste", "Frei belegbar: KM-Helfer, Funkgerät (Push-to-Talk) oder Taschenlampe."],
        ["Ein/Aus mit Fingerabdruck", "Entsperren ohne Kamera, auch bei Sonne und Staub. Daneben die Lautstärke-Wippe."],
        ["Oben", "Ausziehbare Stabantenne, Buchse mit Gummikappe für Auto- oder Hausantenne, Mikrofon."],
        ["Unten", "USB-C wasserdicht ohne Klappe, lauter Lautsprecher, Ladekontakte für Auto- oder Tischhalterung mit Außenantenne."],
        ["Seite", "Schublade für 2 SIM-Karten und microSD, abgedichtet."],
      ],
    },
    {
      kind: "features", id: "funk", h: "Netz auch ohne Netz", lead: "Das KM One soll mehrere Funkwege haben. Fällt einer aus, übernimmt der nächste.", items: [
        ["Stabantenne und höhere Sendeleistung", "Eigene Low-Band-Antenne, ausziehbare Stabantenne und HPUE. Nach unseren Berechnungen bringt das +10 bis 15 dB, also etwa 3- bis 5-fache Reichweite. Feldtests sind geplant."],
        ["LoRa", "Kurznachrichten, Standort und SOS ohne Mobilfunk – über eigene Gateways auf Hochpunkten oder von Gerät zu Gerät."],
        ["Satelliten-SOS", "Über ein NTN-Modem: Notruf und Kurznachrichten, wenn am Boden gar kein Netz da ist."],
        ["LTE-450 und Wi-Fi HaLow", "LTE-450 reicht von Bergstandorten sehr weit in die Fläche, HaLow verbindet Geräte über größere Entfernungen als normales WLAN."],
      ],
    },
    {
      kind: "features", h: "Ultar OS – das System im KM One", lead: "Rust auf Linux, rund 65 MB Arbeitsspeicher statt über 1 GB bei Android.", items: [
        ["Ultar Pur", "Ganz ohne Android. Eigene Apps, Web-Apps und Ubuntu-Programme. Für Geräte mit höchsten Anforderungen an Sicherheit."],
        ["Ultar Plus", "Zusätzlich eine abgeschottete Android-Laufzeit, die nur auf Abruf startet. Originale Android-Apps laufen darin."],
        ["Keine geklonten Apps", "Wir bauen keine fremden Apps nach. Wir nutzen offizielle Schnittstellen, Web-Apps und eigene Apps."],
        ["Eigene Infrastruktur", "Store, Update-Server und VPN betreiben wir selbst – auf Wunsch auch beim Kunden."],
      ],
    },
    {
      kind: "table", h: "Geplante Eckdaten", lead: "Stand der Planung. Werte können sich mit dem Herstellerangebot noch ändern.", head: ["Bereich", "Planung"], rows: [
        ["Chip", "Qualcomm QCM6490 auf einer ODM-Plattform, offizielles Qualcomm Linux mit Langzeit-Support"],
        ["KI", "NPU mit ca. 12 TOPS für lokale KI"],
        ["Mobilfunk", "5G, LTE inkl. Band 31/72 (LTE-450, wird geprüft), HPUE"],
        ["Zusatzfunk", "LoRa, Wi-Fi HaLow, Satelliten-SOS (NTN)"],
        ["Antennen", "Low-Band-Antenne, ausziehbare Stabantenne, Buchse für Außenantenne"],
        ["Gehäuse", "IP68, Gummi-Eckpuffer, verschraubt, Akku tauschbar"],
        ["Tasten", "SOS-Taste (orange, versenkt), frei belegbare KM-Taste, Ein/Aus mit Fingerabdruck"],
        ["Rückseite", "Punktanzeige 15 × 7 für Netz, Nachrichten, SOS und Laden"],
        ["Sicherheit", "Eigene Secure-Boot-Schlüssel, Verschlüsselung, nur signierte Apps"],
        ["Akku, Maße, Gewicht", "Werden mit dem Hersteller festgelegt"],
      ],
    },
    {
      kind: "points", dark: true, h: "Für wen das KM One gedacht ist", items: [
        "Firmen mit Außendienst, Baustellen und Lager",
        "Behörden und Verwaltung, die ihre Daten im eigenen Haus halten müssen",
        "NGOs und Hilfsorganisationen in Gebieten mit schwachem Netz",
        "Landwirtschaft, Transport und Rettungsdienste",
        "Als Komplettpaket: Gerät, Ultar OS, Apps, Server und Wartungsvertrag",
      ],
    },
    {
      kind: "steps", h: "So läuft ein Pilotprojekt", items: [
        "Gespräch: Wo setzen Sie die Geräte ein, welche Apps und welche Funkwege brauchen Sie?",
        "Angebot mit Anzahlung – die Geräte werden für die Pilotkunden gefertigt.",
        "Einrichtung: Ihr Firmenlogo auf Wunsch, Store, Update-Server und VPN für Ihr Unternehmen.",
        "Übergabe, Schulung und Wartungsvertrag mit Updates für mindestens 5 Jahre.",
      ],
    },
    {
      kind: "faq", id: "fragen", h: "Häufige Fragen", items: [
        ["Kann ich das KM One schon kaufen?", "Noch nicht. Das Gerät ist in Entwicklung. Wir suchen Pilotkunden – Firmen, Behörden und NGOs –, mit denen wir die erste Serie fertigen. Die Bilder auf dieser Seite sind Visualisierungen des geplanten Designs."],
        ["Was kostet das KM One?", "Geplant sind rund 350 USD pro Gerät und ein Service-Abo von rund 48 USD pro Jahr für Updates, Store, VPN und Wartung. Bei größeren Mengen erstellen wir ein eigenes Angebot."],
        ["Laufen WhatsApp, Telegram und andere Apps?", "In Ultar Plus ja: Originale Android-Apps laufen in einer abgeschotteten Laufzeit, die nur startet, wenn Sie sie brauchen. In Ultar Pur nutzen Sie Web-Apps, offizielle Schnittstellen und unsere eigenen Apps."],
        ["Warum nicht einfach Android?", "Android braucht über 1 GB Arbeitsspeicher und viele Dienste im Hintergrund, Updates hängen vom Hersteller ab. Ultar OS braucht rund 65 MB, wir kontrollieren jede Zeile und liefern die Updates selbst."],
        ["Wie funktioniert SOS ohne Mobilfunk?", "Die SOS-Taste 3 Sekunden halten. Das Handy nimmt dann den besten verfügbaren Weg: Mobilfunk, LoRa über Gateways oder andere Geräte, oder Satellit. Die Punktanzeige auf der Rückseite zeigt, dass der Notruf läuft."],
        ["Bringt die Stabantenne wirklich mehr Empfang?", "Nach unseren Berechnungen bringen Low-Band-Antenne, Stabantenne und höhere Sendeleistung zusammen +10 bis 15 dB, das ist etwa 3- bis 5-fache Reichweite. Das prüfen wir in Feldtests, bevor wir es zusagen."],
        ["Wie lange gibt es Updates?", "Mindestens 5 Jahre. Die Plattform hat Langzeit-Support vom Chiphersteller, und wir betreiben den Update-Server selbst."],
        ["Wo bleiben meine Daten?", "Auf dem Gerät, verschlüsselt. Der KM-Helfer rechnet lokal ohne Cloud. Store, Update-Server und VPN können auch bei Ihnen im Haus laufen."],
        ["Kann man das Gerät reparieren?", "Ja, das ist geplant: verschraubt statt verklebt, Akku und Rückdeckel tauschbar."],
        ["Bekommen wir unser eigenes Logo?", "Ja. Auf Wunsch tragen die Geräte Ihr Logo statt KM, in den Farben Noir Gold, Wüste oder Signal."],
        ["Kann ich Ultar OS heute schon ausprobieren?", "Ja. Die Demo läuft direkt im Browser, und Ultar OS läuft bereits auf unserem Testgerät Samsung Galaxy A30."],
      ],
    },
  ],
  closing: { h: "Werden Sie Pilotkunde.", text: "Erzählen Sie uns, wo Sie Ihre Geräte einsetzen. Wir melden uns mit einem Vorschlag für Ihr Pilotprojekt." },
};

const en: ProductPage = {
  title: "KM One – rugged phone with Ultar OS",
  eyebrow: "KM One · in development · looking for pilot customers",
  h1: "The phone that works where others give up.",
  sub: "KM One is our own phone running our own operating system, Ultar OS. It doesn't try to beat Samsung on camera or raw power, but on what matters in the field: rugged, at least 5 years of updates, privacy, Arabic first, on-device AI and coverage where others have none.",
  sheet: [
    ["Status", "In development – design draft, pilot phase"],
    ["System", "Ultar OS Pure (no Android) or Plus (with a sandboxed Android runtime)"],
    ["Platform", "Qualcomm QCM6490 with long-term support (planned)"],
    ["Protection", "IP68, rubber corner bumpers, screwed together"],
    ["Radio", "5G, LTE-450, LoRa, Wi-Fi HaLow, satellite SOS (planned)"],
    ["Updates", "at least 5 years, our own update server"],
    ["Price", "about USD 350 per device, service plan about USD 48 per year (guide values)"],
    ["For", "Companies, authorities and NGOs – starting in Syria"],
  ],
  primary: { label: "Become a pilot customer", to: CONTACT },
  secondary: { label: "Try Ultar OS in your browser", to: DEMO("en") },
  blocks: [
    {
      kind: "gallery", h: "How the KM One should look", lead: "Renderings of the planned design. The screens come from the real Ultar OS.", items: [
        [`${IMG}/km-one-hero.jpg`, "Front and back with pull-out antenna"],
        [`${IMG}/km-one-colors.jpg`, "Three editions: Noir Gold, Desert, Signal"],
        [`${IMG}/km-one-back.jpg`, "Dot display: new message over LoRa"],
        [`${IMG}/km-one-sos.jpg`, "SOS active – emergency call over cellular, LoRa or satellite"],
      ],
    },
    {
      kind: "features", h: "Why KM One", items: [
        ["Rugged", "IP68, rubber corner bumpers, screws instead of glue. Battery and back cover are replaceable – built for 5 years and more."],
        ["Coverage everywhere", "Pull-out antenna, higher transmit power, LoRa, satellite SOS and LTE-450 for wide areas."],
        ["Private and secure", "Signed apps only, encryption, our own secure-boot keys, our own VPN, store and update server."],
        ["Arabic and on-device AI", "Interface Arabic first, the KM helper runs offline on the phone. Your data stays with you."],
      ],
    },
    {
      kind: "anatomy", id: "rueckseite", h: "The back: a tool, not jewellery", img: `${IMG}/km-one-back.jpg`, alt: "Back of the KM One", items: [
        ["Pull-out antenna", "Top right, with a gold cap. Pulled out, it gives noticeably better reception at the edge of coverage."],
        ["Camera island", "50 MP with stabilisation plus ultra-wide. Screwed in and replaceable on its own."],
        ["Dot display", "15 × 7 dots show signal, LoRa message, SOS, satellite and charge – without turning on the screen."],
        ["Window", "The antenna traces for LoRa and LTE-450 stay visible – a sign of the radio package inside."],
        ["Rubber corner bumpers", "Four shock-absorbing corners, IP68 sealed."],
        ["Visible screws", "Screws instead of glue: battery and back cover are replaceable, for 5 years and more."],
        ["KM logo", "Engraved, with “Ultar OS · IP68” and “صُمّم في سوريا” below. Your own logo on request."],
        ["Lanyard eyelet", "In the bottom corner, for a lanyard or carabiner in the field."],
      ],
    },
    {
      kind: "matrix", id: "punktanzeige", h: "Dot display: status at a glance", lead: "The same dot font as the clock in Ultar OS. The phone can lie face down and still show what's going on – and saves battery because the screen stays off.", items: [
        ["signal", "Signal", "Five bars for cellular. The colour changes for LTE-450 or LoRa."],
        ["msg", "LoRa message", "A message received without cellular. It pulses slowly until read."],
        ["sos", "SOS active", "Flashes red while the emergency call runs, and the location is sent."],
        ["sat", "Satellite connected", "No network on the ground: SOS and short messages go via satellite."],
        ["charge", "Charging", "Charge level while charging or in the car mount."],
      ],
    },
    {
      kind: "features", id: "tasten", h: "Keys and ports", lead: "Everything works with gloves. No key sits where you'd press it by accident.", items: [
        ["SOS key", "Orange, ribbed, recessed behind a ridge. Hold for 3 seconds: emergency call over cellular, LoRa or satellite."],
        ["KM key", "Programmable: KM helper, push-to-talk radio or torch."],
        ["Power with fingerprint", "Unlock without the camera, even in sun and dust. Volume rocker next to it."],
        ["Top", "Pull-out antenna, sealed socket for a car or house antenna, microphone."],
        ["Bottom", "Waterproof USB-C without a flap, loud speaker, contacts for a car or desk mount with external antenna."],
        ["Side", "Sealed tray for 2 SIM cards and microSD."],
      ],
    },
    {
      kind: "features", id: "funk", h: "Coverage without coverage", lead: "The KM One is planned with several radio paths. If one fails, the next takes over.", items: [
        ["Pull-out antenna and higher power", "Dedicated low-band antenna, pull-out antenna and HPUE. By our calculations that adds +10 to 15 dB, roughly 3 to 5 times the range. Field tests are planned."],
        ["LoRa", "Short messages, location and SOS without cellular – via our own gateways on high points or from device to device."],
        ["Satellite SOS", "Through an NTN modem: emergency calls and short messages when there is no network on the ground at all."],
        ["LTE-450 and Wi-Fi HaLow", "LTE-450 reaches very far from mountain sites, HaLow links devices over longer distances than normal Wi-Fi."],
      ],
    },
    {
      kind: "features", h: "Ultar OS – the system inside", lead: "Rust on Linux, about 65 MB of RAM instead of over 1 GB on Android.", items: [
        ["Ultar Pure", "No Android at all. Our own apps, web apps and Ubuntu programs. For devices with the highest security needs."],
        ["Ultar Plus", "Adds a sandboxed Android runtime that only starts on demand. Original Android apps run inside it."],
        ["No cloned apps", "We don't copy other companies' apps. We use official interfaces, web apps and our own apps."],
        ["Own infrastructure", "We run the store, update server and VPN ourselves – on your premises if you prefer."],
      ],
    },
    {
      kind: "table", h: "Planned specifications", lead: "Current plan. Values may still change with the manufacturer's offer.", head: ["Area", "Plan"], rows: [
        ["Chip", "Qualcomm QCM6490 on an ODM platform, official Qualcomm Linux with long-term support"],
        ["AI", "NPU with about 12 TOPS for on-device AI"],
        ["Cellular", "5G, LTE incl. band 31/72 (LTE-450, being checked), HPUE"],
        ["Extra radio", "LoRa, Wi-Fi HaLow, satellite SOS (NTN)"],
        ["Antennas", "Low-band antenna, pull-out antenna, socket for an external antenna"],
        ["Housing", "IP68, rubber corner bumpers, screwed, replaceable battery"],
        ["Keys", "SOS key (orange, recessed), programmable KM key, power key with fingerprint"],
        ["Back", "15 × 7 dot display for signal, messages, SOS and charging"],
        ["Security", "Own secure-boot keys, encryption, signed apps only"],
        ["Battery, size, weight", "To be fixed with the manufacturer"],
      ],
    },
    {
      kind: "points", dark: true, h: "Who the KM One is for", items: [
        "Companies with field staff, construction sites and warehouses",
        "Authorities that must keep their data in-house",
        "NGOs and aid organisations in areas with weak coverage",
        "Agriculture, transport and rescue services",
        "As a complete package: device, Ultar OS, apps, server and maintenance contract",
      ],
    },
    {
      kind: "steps", h: "How a pilot project works", items: [
        "Conversation: where will you use the devices, which apps and radio paths do you need?",
        "Offer with a deposit – the devices are built for the pilot customers.",
        "Set-up: your company logo if you wish, store, update server and VPN for your organisation.",
        "Handover, training and maintenance contract with at least 5 years of updates.",
      ],
    },
    {
      kind: "faq", id: "fragen", h: "Frequently asked questions", items: [
        ["Can I buy the KM One yet?", "Not yet. The device is in development. We are looking for pilot customers – companies, authorities and NGOs – to build the first series with. The images on this page are renderings of the planned design."],
        ["What does the KM One cost?", "We plan about USD 350 per device and a service plan of about USD 48 per year for updates, store, VPN and maintenance. For larger quantities we make an individual offer."],
        ["Do WhatsApp, Telegram and other apps work?", "In Ultar Plus, yes: original Android apps run in a sandboxed runtime that only starts when you need it. In Ultar Pure you use web apps, official interfaces and our own apps."],
        ["Why not just Android?", "Android needs over 1 GB of RAM and many background services, and updates depend on the manufacturer. Ultar OS needs about 65 MB, we control every line and deliver updates ourselves."],
        ["How does SOS work without cellular?", "Hold the SOS key for 3 seconds. The phone takes the best path available: cellular, LoRa via gateways or other devices, or satellite. The dot display on the back shows the call is running."],
        ["Does the pull-out antenna really improve reception?", "By our calculations the low-band antenna, pull-out antenna and higher power together add +10 to 15 dB, roughly 3 to 5 times the range. We will confirm this in field tests before we promise it."],
        ["How long are updates provided?", "At least 5 years. The platform has long-term support from the chip maker, and we run the update server ourselves."],
        ["Where does my data stay?", "On the device, encrypted. The KM helper computes locally without a cloud. Store, update server and VPN can also run on your premises."],
        ["Can the device be repaired?", "Yes, that is the plan: screwed rather than glued, battery and back cover replaceable."],
        ["Can we have our own logo?", "Yes. On request the devices carry your logo instead of KM, in Noir Gold, Desert or Signal."],
        ["Can I try Ultar OS today?", "Yes. The demo runs right in your browser, and Ultar OS already runs on our test device, a Samsung Galaxy A30."],
      ],
    },
  ],
  closing: { h: "Become a pilot customer.", text: "Tell us where you will use your devices. We'll get back to you with a proposal for your pilot project." },
};

const ar: ProductPage = {
  title: "KM One – هاتف متين بنظام Ultar OS",
  eyebrow: "KM One · قيد التطوير · نبحث عن عملاء تجريبيين",
  h1: "الهاتف الذي يعمل حيث تتوقف الهواتف الأخرى.",
  sub: "KM One هو هاتفنا الخاص بنظام تشغيلنا الخاص Ultar OS. لا ينافس سامسونج في الكاميرا أو القوة، بل فيما يهم في العمل الميداني: متين، تحديثات لخمس سنوات على الأقل، خصوصية، العربية أولاً، ذكاء اصطناعي محلي وشبكة حيث لا يوجد لدى غيره.",
  sheet: [
    ["الحالة", "قيد التطوير – مسودة التصميم، مرحلة تجريبية"],
    ["النظام", "Ultar OS Pur (دون أندرويد) أو Plus (مع بيئة أندرويد معزولة)"],
    ["المنصة", "Qualcomm QCM6490 مع دعم طويل الأمد (مخطط)"],
    ["الحماية", "IP68، زوايا مطاطية، مثبّت بالبراغي"],
    ["الاتصال", "5G، LTE-450، LoRa، Wi-Fi HaLow، استغاثة عبر الأقمار الصناعية (مخطط)"],
    ["التحديثات", "5 سنوات على الأقل، خادم تحديثات خاص بنا"],
    ["السعر", "نحو 350 دولاراً للجهاز، واشتراك خدمة نحو 48 دولاراً سنوياً (قيم تقديرية)"],
    ["لمن", "الشركات والجهات الحكومية والمنظمات – في سوريا أولاً"],
  ],
  primary: { label: "اطلب أن تكون عميلاً تجريبياً", to: CONTACT },
  secondary: { label: "جرّب Ultar OS في المتصفح", to: DEMO("ar") },
  blocks: [
    {
      kind: "gallery", h: "هكذا سيبدو KM One", lead: "صور توضيحية للتصميم المخطط. الشاشات من نظام Ultar OS الحقيقي.", items: [
        [`${IMG}/km-one-hero.jpg`, "الوجه الأمامي والخلفي مع الهوائي القابل للسحب"],
        [`${IMG}/km-one-colors.jpg`, "ثلاثة إصدارات: أسود ذهبي، صحراوي، إشارة"],
        [`${IMG}/km-one-back.jpg`, "شاشة النقاط: رسالة جديدة عبر LoRa"],
        [`${IMG}/km-one-sos.jpg`, "الاستغاثة مفعّلة – عبر الشبكة أو LoRa أو الأقمار الصناعية"],
      ],
    },
    {
      kind: "features", h: "لماذا KM One", items: [
        ["متين", "IP68، زوايا مطاطية، براغٍ بدل اللاصق. البطارية والغطاء الخلفي قابلان للتبديل – مصمم لخمس سنوات وأكثر."],
        ["شبكة في كل مكان", "هوائي قابل للسحب، قدرة إرسال أعلى، LoRa، استغاثة عبر الأقمار الصناعية وLTE-450 للمساحات الواسعة."],
        ["خصوصية وأمان", "تطبيقات موقّعة فقط، تشفير، مفاتيح إقلاع آمن خاصة بنا، VPN ومتجر وخادم تحديثات خاصة بنا."],
        ["العربية وذكاء اصطناعي محلي", "الواجهة بالعربية أولاً، ومساعد KM يعمل دون إنترنت على الجهاز. بياناتك تبقى لديك."],
      ],
    },
    {
      kind: "anatomy", id: "rueckseite", h: "الخلف: أداة عمل لا قطعة زينة", img: `${IMG}/km-one-back.jpg`, alt: "الوجه الخلفي لهاتف KM One", items: [
        ["هوائي قابل للسحب", "في الأعلى يميناً بغطاء ذهبي. عند سحبه يحسّن الاستقبال بوضوح في أطراف التغطية."],
        ["جزيرة الكاميرا", "50 ميغابكسل مع مثبّت صورة وعدسة عريضة جداً. مثبّتة بالبراغي وقابلة للتبديل."],
        ["شاشة النقاط", "15 × 7 نقطة تُظهر الشبكة ورسائل LoRa والاستغاثة والقمر الصناعي والشحن دون تشغيل الشاشة."],
        ["نافذة شفافة", "تبقى مسارات هوائيات LoRa وLTE-450 ظاهرة – دلالة على حزمة الاتصال."],
        ["زوايا مطاطية", "أربع زوايا ماصّة للصدمات، محكمة بمعيار IP68."],
        ["براغٍ ظاهرة", "براغٍ بدل اللاصق: البطارية والغطاء الخلفي قابلان للتبديل، لخمس سنوات وأكثر."],
        ["شعار KM", "محفور، وتحته «Ultar OS · IP68» و«صُمّم في سوريا». ويمكن وضع شعاركم عند الطلب."],
        ["حلقة الحزام", "في الزاوية السفلية، لحزام أو مشبك في العمل الميداني."],
      ],
    },
    {
      kind: "matrix", id: "punktanzeige", h: "شاشة النقاط: الحالة بنظرة واحدة", lead: "بالخط النقطي نفسه لساعة Ultar OS. يمكن أن يكون الهاتف مقلوباً ويُظهر مع ذلك ما يحدث – ويوفّر البطارية لأن الشاشة تبقى مطفأة.", items: [
        ["signal", "قوة الشبكة", "خمسة أعمدة للشبكة الخلوية. يتغير اللون مع LTE-450 أو LoRa."],
        ["msg", "رسالة LoRa", "رسالة وصلت دون شبكة خلوية. تنبض ببطء حتى تُقرأ."],
        ["sos", "الاستغاثة مفعّلة", "تومض بالأحمر طوال نداء الطوارئ، ويُرسل الموقع معه."],
        ["sat", "متصل بالقمر الصناعي", "لا شبكة على الأرض: الاستغاثة والرسائل القصيرة عبر القمر الصناعي."],
        ["charge", "الشحن", "مستوى الشحن أثناء الشحن أو في حامل السيارة."],
      ],
    },
    {
      kind: "features", id: "tasten", h: "الأزرار والمنافذ", lead: "كل شيء يعمل مع القفازات. لا يوجد زر في مكان تضغطه فيه خطأً.", items: [
        ["زر الاستغاثة", "برتقالي، مضلّع، غائر خلف حافة. اضغطه 3 ثوانٍ: نداء طوارئ عبر الشبكة أو LoRa أو القمر الصناعي."],
        ["زر KM", "قابل للتخصيص: مساعد KM، جهاز لاسلكي (اضغط لتتحدث) أو مصباح."],
        ["زر التشغيل ببصمة الإصبع", "فتح القفل دون كاميرا، حتى في الشمس والغبار. وبجانبه زر الصوت."],
        ["في الأعلى", "هوائي قابل للسحب، منفذ محكم لهوائي السيارة أو المنزل، ميكروفون."],
        ["في الأسفل", "منفذ USB-C مقاوم للماء دون غطاء، مكبّر صوت قوي، نقاط تلامس لحامل السيارة أو المكتب مع هوائي خارجي."],
        ["على الجانب", "درج محكم لشريحتي SIM وبطاقة microSD."],
      ],
    },
    {
      kind: "features", id: "funk", h: "شبكة حتى دون شبكة", lead: "نخطط لأن يملك KM One عدة طرق للاتصال. إذا تعطّل أحدها يتولى الآخر.", items: [
        ["هوائي قابل للسحب وقدرة أعلى", "هوائي خاص للترددات المنخفضة، هوائي قابل للسحب وHPUE. بحسب حساباتنا يضيف ذلك 10 إلى 15 ديسيبل، أي مدى أكبر بثلاث إلى خمس مرات تقريباً. الاختبارات الميدانية مخططة."],
        ["LoRa", "رسائل قصيرة وموقع واستغاثة دون شبكة خلوية – عبر بوابات خاصة بنا على المرتفعات أو من جهاز إلى جهاز."],
        ["استغاثة عبر الأقمار الصناعية", "عبر مودم NTN: نداء طوارئ ورسائل قصيرة عندما لا توجد أي شبكة على الأرض."],
        ["LTE-450 وWi-Fi HaLow", "يصل LTE-450 بعيداً جداً من مواقع الجبال، ويربط HaLow الأجهزة لمسافات أطول من الواي فاي العادي."],
      ],
    },
    {
      kind: "features", h: "Ultar OS – النظام داخل KM One", lead: "لغة Rust على لينكس، نحو 65 ميغابايت ذاكرة بدل أكثر من 1 غيغابايت في أندرويد.", items: [
        ["Ultar Pur", "دون أندرويد إطلاقاً. تطبيقاتنا وتطبيقات الويب وبرامج أوبونتو. للأجهزة ذات أعلى متطلبات الأمان."],
        ["Ultar Plus", "يضيف بيئة أندرويد معزولة تعمل عند الطلب فقط. تعمل فيها تطبيقات أندرويد الأصلية."],
        ["لا نسخ لتطبيقات الآخرين", "لا نقلّد تطبيقات الشركات الأخرى، بل نستخدم الواجهات الرسمية وتطبيقات الويب وتطبيقاتنا الخاصة."],
        ["بنية تحتية خاصة", "نشغّل المتجر وخادم التحديثات وVPN بأنفسنا – ويمكن تشغيلها لديكم إن رغبتم."],
      ],
    },
    {
      kind: "table", h: "المواصفات المخططة", lead: "حسب الخطة الحالية. قد تتغير القيم مع عرض المصنّع.", head: ["المجال", "الخطة"], rows: [
        ["المعالج", "Qualcomm QCM6490 على منصة ODM، مع Qualcomm Linux الرسمي ودعم طويل الأمد"],
        ["الذكاء الاصطناعي", "وحدة NPU بنحو 12 TOPS للذكاء الاصطناعي المحلي"],
        ["الشبكة الخلوية", "5G، LTE مع النطاق 31/72 (LTE-450، قيد الدراسة)، HPUE"],
        ["اتصال إضافي", "LoRa، Wi-Fi HaLow، استغاثة عبر الأقمار الصناعية (NTN)"],
        ["الهوائيات", "هوائي للترددات المنخفضة، هوائي قابل للسحب، منفذ لهوائي خارجي"],
        ["الهيكل", "IP68، زوايا مطاطية، مثبّت بالبراغي، بطارية قابلة للتبديل"],
        ["الأزرار", "زر استغاثة (برتقالي، غائر)، زر KM قابل للتخصيص، زر تشغيل ببصمة الإصبع"],
        ["الخلف", "شاشة نقاط 15 × 7 للشبكة والرسائل والاستغاثة والشحن"],
        ["الأمان", "مفاتيح إقلاع آمن خاصة، تشفير، تطبيقات موقّعة فقط"],
        ["البطارية والأبعاد والوزن", "تُحدَّد مع المصنّع"],
      ],
    },
    {
      kind: "points", dark: true, h: "لمن صُمّم KM One", items: [
        "الشركات ذات الفرق الميدانية والمواقع الإنشائية والمستودعات",
        "الجهات الحكومية التي يجب أن تبقى بياناتها لديها",
        "المنظمات والجهات الإغاثية في المناطق ضعيفة التغطية",
        "الزراعة والنقل وخدمات الإنقاذ",
        "كحزمة متكاملة: الجهاز وUltar OS والتطبيقات والخادم وعقد الصيانة",
      ],
    },
    {
      kind: "steps", h: "كيف يسير المشروع التجريبي", items: [
        "حديث معكم: أين ستستخدمون الأجهزة، وما التطبيقات وطرق الاتصال التي تحتاجونها؟",
        "عرض مع دفعة مقدمة – تُصنَّع الأجهزة للعملاء التجريبيين.",
        "الإعداد: شعار شركتكم إن رغبتم، المتجر وخادم التحديثات وVPN لمؤسستكم.",
        "التسليم والتدريب وعقد صيانة مع تحديثات لخمس سنوات على الأقل.",
      ],
    },
    {
      kind: "faq", id: "fragen", h: "أسئلة شائعة", items: [
        ["هل يمكنني شراء KM One الآن؟", "ليس بعد. الجهاز قيد التطوير. نبحث عن عملاء تجريبيين – شركات وجهات حكومية ومنظمات – لنصنع معهم الدفعة الأولى. الصور في هذه الصفحة توضيحية للتصميم المخطط."],
        ["كم سعر KM One؟", "نخطط لنحو 350 دولاراً للجهاز واشتراك خدمة بنحو 48 دولاراً سنوياً يشمل التحديثات والمتجر وVPN والصيانة. للكميات الكبيرة نقدّم عرضاً خاصاً."],
        ["هل يعمل واتساب وتيليجرام وغيرها؟", "في Ultar Plus نعم: تعمل تطبيقات أندرويد الأصلية في بيئة معزولة لا تعمل إلا عند الحاجة. وفي Ultar Pur تستخدم تطبيقات الويب والواجهات الرسمية وتطبيقاتنا."],
        ["لماذا لا نستخدم أندرويد ببساطة؟", "يحتاج أندرويد أكثر من 1 غيغابايت من الذاكرة وخدمات كثيرة في الخلفية، والتحديثات بيد المصنّع. يحتاج Ultar OS نحو 65 ميغابايت، ونتحكم بكل سطر ونوفّر التحديثات بأنفسنا."],
        ["كيف تعمل الاستغاثة دون شبكة خلوية؟", "اضغط زر الاستغاثة 3 ثوانٍ. يختار الهاتف أفضل طريق متاح: الشبكة الخلوية، أو LoRa عبر البوابات أو أجهزة أخرى، أو الأقمار الصناعية. وتُظهر شاشة النقاط في الخلف أن النداء جارٍ."],
        ["هل يحسّن الهوائي القابل للسحب الاستقبال فعلاً؟", "بحسب حساباتنا يضيف هوائي الترددات المنخفضة والهوائي القابل للسحب والقدرة الأعلى معاً 10 إلى 15 ديسيبل، أي مدى أكبر بثلاث إلى خمس مرات تقريباً. سنتحقق من ذلك في اختبارات ميدانية قبل أن نعد به."],
        ["كم سنة تستمر التحديثات؟", "خمس سنوات على الأقل. للمنصة دعم طويل الأمد من مصنّع المعالج، ونشغّل خادم التحديثات بأنفسنا."],
        ["أين تبقى بياناتي؟", "على الجهاز ومشفّرة. يعمل مساعد KM محلياً دون سحابة. ويمكن تشغيل المتجر وخادم التحديثات وVPN لديكم أيضاً."],
        ["هل يمكن إصلاح الجهاز؟", "نعم، هذا هو المخطط: مثبّت بالبراغي لا باللاصق، والبطارية والغطاء الخلفي قابلان للتبديل."],
        ["هل يمكن وضع شعارنا الخاص؟", "نعم. عند الطلب تحمل الأجهزة شعاركم بدل KM، بألوان أسود ذهبي أو صحراوي أو إشارة."],
        ["هل يمكنني تجربة Ultar OS اليوم؟", "نعم. العرض يعمل مباشرة في المتصفح، ويعمل Ultar OS حالياً على جهاز الاختبار لدينا Samsung Galaxy A30."],
      ],
    },
  ],
  closing: { h: "كن عميلاً تجريبياً.", text: "أخبرنا أين ستستخدم أجهزتك، وسنعود إليك باقتراح لمشروعك التجريبي." },
};

export const KMONE: Record<Locale, ProductPage> = { de, en, ar };
