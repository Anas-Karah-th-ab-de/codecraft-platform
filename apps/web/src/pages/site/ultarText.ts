// Produktseite Ultar OS (/ultar-os) – DE/EN/AR.
// Quelle: Repo ultar-os (README, docs/ARCHITEKTUR.md, APPS.md, SYSTEM-FUNKTIONEN*.md, HELFER*.md, GESICHT.md,
// A30-*.md, tools/ultar-flash/LIESMICH.md), Stand 20.11.2026, Version 0.6.
// Bilder: docs/bilder/galerie (Beispieldaten, keine echten Kontakte). Bei neuem Stand die Tabelle „Stand“ anpassen.
import type { Locale } from "../../i18n";
import type { ProductPage } from "./productText";

const IMG = "/products/ultar-os";
const CONTACT = "/kontakt?produkt=ultar-os";

export const ULTAR_TEASER: Record<Locale, [string, string]> = {
  de: ["Ultar OS", "Eigenes Betriebssystem für Handy, Tablet und Platine – ohne Android-Ballast."],
  en: ["Ultar OS", "Our own operating system for phones, tablets and boards – without the Android baggage."],
  ar: ["Ultar OS", "نظام تشغيل خاص بنا للهاتف والتابلت واللوحات – بلا أعباء أندرويد."],
};

const de: ProductPage = {
  title: "Ultar OS – eigenes Betriebssystem für Handy, Tablet und Platine",
  eyebrow: "Ultar OS 0.6 · Betriebssystem in Rust · in Entwicklung",
  h1: "Ein Handy-Betriebssystem, das Ihnen gehört.",
  sub: "Ultar OS ersetzt Android vollständig: Linux-Kernel für die Treiber, darüber ein komplett eigenes System in Rust – Startprogramm, Dienste, Oberfläche, Apps, Mobilfunk, Sicherheit und ein Helfer mit eigener Intelligenz. Ohne Java-VM, ohne Google, ohne Herstellersoftware. Arabisch zuerst. Eine Desktop-Version für PC und Laptop folgt in Kürze.",
  sheet: [
    ["Stand", "Version 0.6, läuft auf dem Testgerät Samsung Galaxy A30"],
    ["Basis", "Linux-Kernel, 18 eigene Rust-Bausteine, keine Java-VM"],
    ["Geräte", "Handys, Tablets, Entwicklungsplatinen – Desktop folgt bald"],
    ["Speicher", "rund 65 MB RAM mit Oberfläche (Android: über 1 GB)"],
    ["Apps", "eigene Rust-Apps, Ubuntu-Pakete, Web-Apps, signierter App-Store"],
    ["Sicherheit", "Verschlüsselung, verifizierter Start, VPN mit Killswitch"],
    ["Sprachen", "Arabisch (rechts nach links), Englisch, Deutsch"],
  ],
  primary: { label: "Interesse melden", to: CONTACT },
  secondary: { label: "Stand der Entwicklung", to: "#stand" },
  blocks: [
    {
      kind: "features", h: "Was Ultar OS anders macht", items: [
        ["Kein Android-Ballast", "Android ist nicht wegen des Kernels langsam, sondern wegen Java-VM, Zygote und rund hundert Hintergrunddiensten. Ultar startet seine Dienste direkt: Das Startprogramm ist 1,5 MB groß und braucht im Leerlauf keine Rechenzeit."],
        ["Ubuntu-Programme inklusive", "Ubuntu 24.04 läuft abgeschottet auf demselben Kernel – keine virtuelle Maschine, kein Leistungsverlust. Pakete lassen sich mit apt oder offline als .deb installieren."],
        ["Volle Kontrolle", "Keine Herstellersoftware, kein Google-Konto, keine stillen Verbindungen. Jeder Dienst läuft mit eigenen Grenzen für Speicher und Rechenzeit."],
        ["Arabisch zuerst", "Rechts-nach-links-Oberfläche, arabische Bildschirmtastatur, Hijri-Datum, Gebetszeiten und Qibla sind eingebaut, nicht nachgerüstet."],
      ],
    },
    {
      kind: "gallery", h: "So sieht Ultar OS aus", lead: "Bildschirme aus der aktuellen Entwicklungsfassung, mit Beispieldaten.",
      items: [
        [`${IMG}/uebersicht.png`, "Start, Schnelleinstellungen, Funktürme, Mobilfunk, Anruf, Nachrichten, Dateien – auch auf Arabisch"],
        [`${IMG}/runde2.png`, "Werkzeuge, Gebetszeiten, Qibla, Aufgaben, Nutzungszeit, Gerätepflege, Akku-Verlauf, Modi"],
        [`${IMG}/apps-neu-ar.png`, "Eingebaute Apps auf Arabisch"],
        [`${IMG}/monitor.png`, "Monitor: Prozessor, Speicher und Datenverkehr"],
      ],
    },
    {
      kind: "features", h: "Telefon, Mobilfunk und Kommunikation", lead: "Mobilfunk so, wie Android ihn nie zeigt – und Anrufe, die nicht über fremde Server laufen.", items: [
        ["Funkturm-Wahl", "Radar mit allen Zellen in der Nähe, Live-Werte für Signal, Störabstand und Qualität. Auto nimmt das stärkste Signal, Smart das beste Tempo, Manuell die Zelle Ihrer Wahl."],
        ["Zwei SIM-Karten", "Für mobile Daten, Anrufe und SMS getrennt festlegen, SIM-PIN direkt entsperren, bevorzugte Technik und Roaming wählen. Der Verbindungsweg bis ins Internet wird angezeigt."],
        ["Eigene Ultar-Nummer", "Jedes Gerät bekommt eine eindeutige Nummer. Sprach- und Videoanrufe zwischen Ultar-Geräten sind Ende-zu-Ende verschlüsselt; unser Server vermittelt nur und sieht keine Inhalte."],
        ["Telegram, WhatsApp, YouTube, Spotify", "Telegram als eigener Client über das offizielle Protokoll. WhatsApp, YouTube und Spotify als Web-Apps mit getrennter, dauerhafter Anmeldung; Spotify-Connect als Lautsprecher ist vorbereitet."],
      ],
    },
    {
      kind: "features", h: "Sicherheit und Datenschutz", lead: "Nur geprüfte Standard-Verfahren, keine selbst erfundene Kryptografie. Alles ist einzeln schaltbar.", items: [
        ["Geräteverschlüsselung", "Persönliche Daten mit LUKS2 und AES-XTS 512 Bit; der Schlüssel entsteht aus Ihrem Passwort mit Argon2id. Ohne Passwort ist der Speicher reines Rauschen."],
        ["Verifizierter Start", "Das System wird bei jedem Start gegen eine signierte Prüfsumme geprüft. Jede Veränderung fällt auf und stoppt den Start."],
        ["VPN mit Killswitch", "Auf Wunsch läuft der gesamte Verkehr über WireGuard durch unseren Server. Bricht der Tunnel ab, geht nichts ungeschützt hinaus."],
        ["Signierte Apps und Updates", "Ohne gültige Signatur wird keine App installiert und kein Update eingespielt – geprüft auf dem Gerät, nicht auf dem Server."],
        ["Entsperren", "PIN mit Sperre nach Fehlversuchen, Fingerabdruck und Gesichtserkennung – die Gesichtserkennung rechnet vollständig offline auf dem Gerät."],
        ["Datenschutz-Zentrum", "Werbe- und Tracker-Server systemweit gesperrt; ein Hauptschalter für Netz, Kamera, Mikrofon und Standort."],
        ["Link-Prüfung", "Links werden vor dem Öffnen geprüft: nachgeahmte Marken, Täuschungszeichen, Kurzlinks – Weiterleitungen werden in einer abgeschotteten Box ohne Rechte verfolgt."],
        ["Android-Apps im Käfig (geplant)", "Echte Android-Apps optional in einem streng abgeschotteten Bereich, ohne Google-Dienste, standardmäßig aus und jederzeit vollständig löschbar."],
      ],
    },
    {
      kind: "features", h: "Der Helfer – Intelligenz im System", lead: "Eine kleine Figur auf jeder Seite, die das System wirklich kennt.", items: [
        ["Liest die Seite", "Weil Ultar jeden Text selbst zeichnet, weiß der Helfer, was auf dem Bildschirm steht – ohne Bildschirmfoto, ohne Texterkennung, ohne Zusatzrechte."],
        ["Versteht Befehle ohne Netz", "„Taschenlampe an“, „Wecker um 7:30“, „Notiz: Milch kaufen“, „ist dieser Link sicher?“ – auf Deutsch, Englisch und Arabisch, sofort und offline."],
        ["Begleitet und erinnert", "Stellt das System beim ersten Start vor, kennt die Hilfeseiten, erinnert an Termine und meldet sich bei gefährlichen Links von selbst."],
        ["Sprache und KI", "Sprachsteuerung über das Mikrofon. Ein kleines Sprachmodell direkt im Rust-Kern ist in Arbeit; auf Wunsch kann ein großes Modell im Netz angebunden werden."],
      ],
    },
    {
      kind: "features", h: "Über 100 Systemfunktionen", lead: "Was man von einem modernen Handy erwartet – und vieles, was Android nicht kann.", items: [
        ["Sperre und Zeit", "Sperrbildschirm, Zeitabgleich übers Netz, Zeitzonen mit automatischer Sommerzeit, Weltuhr, 12-/24-Stunden-Format."],
        ["Akku und Energie", "Energiesparmodus ab einstellbarem Akkustand, Leistungsprofile, Hitzewarnung, 24-Stunden-Verlauf, Restlaufzeit, Ladehinweis bei 80 %."],
        ["Anzeige", "Nachtlicht mit Zeitplan, automatische Helligkeit, hoher Kontrast, hell und dunkel automatisch, Drehung und Größe frei wählbar."],
        ["Ruhe und Töne", "Tonprofile, Nicht stören mit Zeitplan, Schlafmodus, Taschen-Schutz, Sperrliste für Anrufer, stündliches Zeitsignal."],
        ["Netz", "WLAN (auch versteckte Netze), eigene DNS-Server, Netzdiagnose, Datenlimit mit Warnung, Bluetooth-Suche, Datenverkehr je Tag."],
        ["Pflege und Sicherung", "Gerätepflege mit Zustandswert, Speicher-Analyse, Sicherung und Wiederherstellung, Werkseinstellungen mit dreifacher Bestätigung."],
        ["Bedienung", "Wischgesten, Übersicht der zuletzt genutzten Apps, App anheften, Zwischenablage mit Verlauf, globale Suche – auch arabisch tolerant."],
        ["Notausstieg", "Hängt etwas, starten Lauter und Leiser gemeinsam gehalten die Oberfläche oder alle Dienste neu – ein Wachhund prüft das System laufend."],
      ],
    },
    {
      kind: "features", h: "Eingebaute Apps", lead: "Alle Apps sind nativer Rust-Code und passen sich an Hochformat, Querformat und Tablets an.", items: [
        ["Telefon und Nachrichten", "Wählfeld, Anrufverlauf, eingehende Anrufe auf dem Sperrbildschirm, Näherungssensor am Ohr, Unterhaltungen als Sprechblasen."],
        ["Kamera", "Foto, Quadrat und Video, Selbstauslöser, Raster, Zoom, Autofokus, Front- und Rückkamera – mit Dokumentenscanner, der Ecken erkennt, entzerrt und als PDF speichert."],
        ["Galerie und Dateien", "Fotos nach Datum, Alben, Favoriten, Videos; Dateien kopieren, verschieben, umbenennen per langem Druck."],
        ["Uhr und Kalender", "Wecker, Timer und Stoppuhr, die auch bei ausgeschaltetem Bildschirm klingeln; Kalender mit Erinnerungen."],
        ["Notizen und Kontakte", "Lokal gespeichert, in der Sicherung enthalten und in der globalen Suche auffindbar."],
        ["Rechner", "Rechner mit Verlauf, Einheiten-, Währungs-, Prozent-, Raten- und Datumsrechner, Zahlensysteme."],
        ["Werkzeuge", "Kompass, Wasserwaage, Qibla, Gebetszeiten, Hijri-Datum, SOS-Licht im Morsecode, Fokus-Timer, Aufgaben, Erinnerungen, Notfall-Seite."],
        ["Monitor und Terminal", "Auslastung von Prozessor, Speicher, Grafik- und KI-Chip, Nutzungszeit je App, dazu ein Terminal und die Ubuntu-Programme."],
      ],
    },
    {
      kind: "features", h: "Für Entwickler, Hersteller und Betrieb", items: [
        ["Eigener Systemkern", "Ultar-init startet Dienste in Abhängigkeit, startet sie bei Fehlern neu und gibt jedem eigene Grenzen. Hardware wird beim ersten Start erkannt und gemerkt – ein Abbild für viele Geräte."],
        ["App-Store und Updates", "Eigenes Paketformat mit Ed25519-Signatur, App-Store und Systemupdates über Kanäle (stabil, beta) – alte Fassung bleibt als Rückfall erhalten."],
        ["Ultar Flash für Windows", "Sichert Treiber und Partitionen eines Android-Handys, spielt Ultar OS auf und schreibt bei Bedarf das Original zurück. Bootloader, Modem und Funkdaten werden nie überschrieben."],
        ["Offen für Platinen", "Läuft auch auf Entwicklungsplatinen und in der Emulation; vorbereitet für Rockchip RK3566/RK3588. Firmen-Apps wie unser Kassensystem lassen sich als Paket ausliefern."],
      ],
    },
    {
      kind: "table", id: "stand", h: "Stand der Entwicklung", lead: "Ehrlich und aktuell (20.11.2026, Version 0.6). Testgerät ist ein Samsung Galaxy A30.",
      head: ["Bereich", "Stand"],
      rows: [
        ["Oberfläche, Apps, Werkzeuge, Systemfunktionen", "fertig, getestet auf Deutsch, Englisch und Arabisch"],
        ["Anzeige, Touch, Tasten, Speicher, Akku, Sensoren", "laufen auf dem A30"],
        ["WLAN", "läuft auf dem A30"],
        ["Kamera mit Dokumentenscanner", "läuft auf dem A30"],
        ["Sperre mit PIN, Zeitabgleich, Nachtlicht, Sicherung", "am A30 geprüft"],
        ["Fingerabdruck, Gesichtserkennung, Sprachsteuerung", "eingebaut, Praxistest am Gerät läuft"],
        ["Ton und Mikrofon", "erste Funktionen laufen, Feinschliff läuft"],
        ["Bluetooth", "Gerätesuche läuft, Koppeln und Profile in Arbeit"],
        ["Mobilfunk und SIM", "Modem startet und findet das Netz, SIM-Anmeldung in Arbeit"],
        ["GPS", "in Arbeit"],
        ["Verschlüsselung, verifizierter Start, Ultar-Cloud, Anrufe übers Internet, VPN", "gebaut, Test am Gerät und im Betrieb steht aus"],
        ["Android-Apps im Käfig", "geplant und vorbereitet"],
        ["Desktop-Version (PC, Laptop)", "folgt in Kürze"],
      ],
    },
    {
      kind: "points", dark: true, h: "Für wen Ultar OS gedacht ist", items: [
        "Firmen, Behörden und Einrichtungen, die volle Kontrolle über ihre Geräte brauchen – ohne fremde Konten und ohne Cloud-Zwang.",
        "Geräte im Einsatz: Kassen, Handgeräte, Kiosk-Systeme und Industrie-Platinen mit genau den Funktionen, die gebraucht werden.",
        "Menschen, denen Privatsphäre wichtig ist: verschlüsselt, ohne Werbung und Tracker, mit eigenem VPN.",
        "Ältere Handys, die mit Android zu langsam geworden sind.",
        "Partner und Hersteller, die ein eigenes, arabischsprachiges System anbieten wollen.",
      ],
    },
  ],
  closing: { h: "Interesse an Ultar OS?", text: "Sie möchten Ultar OS auf Ihren Geräten testen, für Ihre Firma anpassen lassen, mitentwickeln oder als Erste von der Desktop-Version erfahren? Schreiben Sie uns kurz, welche Geräte Sie einsetzen." },
};

const en: ProductPage = {
  title: "Ultar OS – our own operating system for phones, tablets and boards",
  eyebrow: "Ultar OS 0.6 · operating system in Rust · in development",
  h1: "A phone operating system that belongs to you.",
  sub: "Ultar OS replaces Android completely: the Linux kernel for drivers, and on top an entirely own system written in Rust – init, services, interface, apps, mobile network, security and a helper with its own intelligence. No Java VM, no Google, no vendor software. Arabic first. A desktop version for PCs and laptops is coming soon.",
  sheet: [
    ["Status", "Version 0.6, runs on our test device, a Samsung Galaxy A30"],
    ["Base", "Linux kernel, 18 own Rust components, no Java VM"],
    ["Devices", "Phones, tablets, development boards – desktop coming soon"],
    ["Memory", "about 65 MB RAM with the interface (Android: over 1 GB)"],
    ["Apps", "our own Rust apps, Ubuntu packages, web apps, signed app store"],
    ["Security", "Encryption, verified boot, VPN with kill switch"],
    ["Languages", "Arabic (right to left), English, German"],
  ],
  primary: { label: "Register interest", to: CONTACT },
  secondary: { label: "Development status", to: "#stand" },
  blocks: [
    {
      kind: "features", h: "What makes Ultar OS different", items: [
        ["No Android baggage", "Android isn't slow because of its kernel but because of the Java VM, Zygote and around a hundred background services. Ultar starts its services directly: the init program is 1.5 MB and uses no CPU time when idle."],
        ["Ubuntu programs included", "Ubuntu 24.04 runs isolated on the same kernel – no virtual machine, no performance loss. Packages install with apt or offline as .deb."],
        ["Full control", "No vendor software, no Google account, no silent connections. Every service runs with its own memory and CPU limits."],
        ["Arabic first", "Right-to-left interface, Arabic on-screen keyboard, Hijri date, prayer times and Qibla are built in, not bolted on."],
      ],
    },
    {
      kind: "gallery", h: "What Ultar OS looks like", lead: "Screens from the current development build, with sample data.",
      items: [
        [`${IMG}/uebersicht.png`, "Home, quick settings, cell towers, mobile network, calls, messages, files – also in Arabic"],
        [`${IMG}/runde2.png`, "Tools, prayer times, Qibla, tasks, screen time, device care, battery history, modes"],
        [`${IMG}/apps-neu-ar.png`, "Built-in apps in Arabic"],
        [`${IMG}/monitor.png`, "Monitor: CPU, memory and data usage"],
      ],
    },
    {
      kind: "features", h: "Phone, mobile network and communication", lead: "The mobile network as Android never shows it – and calls that don't run through third-party servers.", items: [
        ["Cell tower choice", "A radar of all nearby cells with live signal, interference and quality values. Auto takes the strongest signal, Smart the best speed, Manual the cell you pick."],
        ["Dual SIM", "Choose the SIM for mobile data, calls and SMS separately, unlock the SIM PIN directly, set preferred technology and roaming. The route to the internet is shown."],
        ["Your own Ultar number", "Every device gets a unique number. Voice and video calls between Ultar devices are end-to-end encrypted; our server only connects the parties and sees no content."],
        ["Telegram, WhatsApp, YouTube, Spotify", "Telegram as a native client on the official protocol. WhatsApp, YouTube and Spotify as web apps with separate, persistent sign-ins; Spotify Connect as a speaker is prepared."],
      ],
    },
    {
      kind: "features", h: "Security and privacy", lead: "Only proven standard methods, no home-made cryptography. Everything can be switched individually.", items: [
        ["Device encryption", "Personal data with LUKS2 and AES-XTS 512-bit; the key is derived from your password with Argon2id. Without the password the storage is pure noise."],
        ["Verified boot", "The system is checked against a signed hash on every start. Any change is detected and stops the boot."],
        ["VPN with kill switch", "On request all traffic runs through our server via WireGuard. If the tunnel drops, nothing leaves unprotected."],
        ["Signed apps and updates", "No app is installed and no update applied without a valid signature – checked on the device, not on the server."],
        ["Unlocking", "PIN with lockout after failed attempts, fingerprint and face recognition – face recognition runs fully offline on the device."],
        ["Privacy centre", "Ad and tracker servers blocked system-wide; one main switch for network, camera, microphone and location."],
        ["Link check", "Links are checked before opening: imitated brands, look-alike characters, short links – redirects are followed in a sealed-off box without rights."],
        ["Android apps in a cage (planned)", "Real Android apps optionally in a strictly isolated area, without Google services, off by default and fully erasable at any time."],
      ],
    },
    {
      kind: "features", h: "The helper – intelligence in the system", lead: "A small figure on every screen that really knows the system.", items: [
        ["Reads the screen", "Because Ultar draws every text itself, the helper knows what is on the screen – no screenshot, no text recognition, no extra permissions."],
        ["Understands commands offline", "“Torch on”, “alarm at 7:30”, “note: buy milk”, “is this link safe?” – in German, English and Arabic, instantly and offline."],
        ["Guides and reminds", "Introduces the system on first start, knows the help pages, reminds you of appointments and speaks up on dangerous links by itself."],
        ["Voice and AI", "Voice control via the microphone. A small language model directly in the Rust core is in progress; a large online model can be connected on request."],
      ],
    },
    {
      kind: "features", h: "More than 100 system functions", lead: "What you expect from a modern phone – and a lot Android can't do.", items: [
        ["Lock and time", "Lock screen, network time sync, time zones with automatic daylight saving, world clock, 12/24-hour format."],
        ["Battery and power", "Power saving from a battery level you choose, performance profiles, heat warning, 24-hour history, remaining time, charge hint at 80 %."],
        ["Display", "Night light with schedule, automatic brightness, high contrast, automatic light and dark, free rotation and size."],
        ["Quiet and sound", "Sound profiles, do not disturb with schedule, sleep mode, pocket protection, caller block list, hourly time signal."],
        ["Network", "Wi-Fi (including hidden networks), custom DNS, network diagnostics, data limit with warning, Bluetooth scan, data usage per day."],
        ["Care and backup", "Device care with a health score, storage analysis, backup and restore, factory reset with triple confirmation."],
        ["Operation", "Swipe gestures, recent apps overview, app pinning, clipboard history, global search – tolerant of Arabic spelling."],
        ["Emergency exit", "If something hangs, holding volume up and down together restarts the interface or all services – a watchdog checks the system constantly."],
      ],
    },
    {
      kind: "features", h: "Built-in apps", lead: "All apps are native Rust code and adapt to portrait, landscape and tablets.", items: [
        ["Phone and messages", "Dial pad, call history, incoming calls on the lock screen, proximity sensor at the ear, conversations as chat bubbles."],
        ["Camera", "Photo, square and video, self-timer, grid, zoom, autofocus, front and rear camera – with a document scanner that finds edges, corrects them and saves as PDF."],
        ["Gallery and files", "Photos by date, albums, favourites, videos; copy, move and rename files with a long press."],
        ["Clock and calendar", "Alarms, timers and stopwatch that ring even with the screen off; calendar with reminders."],
        ["Notes and contacts", "Stored locally, included in backups and findable in global search."],
        ["Calculators", "Calculator with history, unit, currency, percent, loan and date calculators, number systems."],
        ["Tools", "Compass, spirit level, Qibla, prayer times, Hijri date, SOS light in Morse code, focus timer, tasks, reminders, emergency page."],
        ["Monitor and terminal", "Load of CPU, memory, graphics and AI chip, screen time per app, plus a terminal and the Ubuntu programs."],
      ],
    },
    {
      kind: "features", h: "For developers, manufacturers and operations", items: [
        ["Own system core", "Ultar-init starts services by dependency, restarts them on failure and gives each its own limits. Hardware is detected on first start and remembered – one image for many devices."],
        ["App store and updates", "Own package format with Ed25519 signature, app store and system updates via channels (stable, beta) – the previous version stays as a fallback."],
        ["Ultar Flash for Windows", "Backs up drivers and partitions of an Android phone, installs Ultar OS and writes the original back if needed. Bootloader, modem and radio data are never overwritten."],
        ["Open for boards", "Also runs on development boards and in emulation; prepared for Rockchip RK3566/RK3588. Company apps such as our POS system can be shipped as a package."],
      ],
    },
    {
      kind: "table", id: "stand", h: "Development status", lead: "Honest and current (20 Nov 2026, version 0.6). Our test device is a Samsung Galaxy A30.",
      head: ["Area", "Status"],
      rows: [
        ["Interface, apps, tools, system functions", "done, tested in German, English and Arabic"],
        ["Display, touch, buttons, storage, battery, sensors", "running on the A30"],
        ["Wi-Fi", "running on the A30"],
        ["Camera with document scanner", "running on the A30"],
        ["PIN lock, time sync, night light, backup", "verified on the A30"],
        ["Fingerprint, face recognition, voice control", "built in, hands-on testing on the device in progress"],
        ["Sound and microphone", "first functions running, fine-tuning in progress"],
        ["Bluetooth", "device scan running, pairing and profiles in progress"],
        ["Mobile network and SIM", "modem starts and finds the network, SIM registration in progress"],
        ["GPS", "in progress"],
        ["Encryption, verified boot, Ultar Cloud, internet calls, VPN", "built, testing on the device and in live operation pending"],
        ["Android apps in a cage", "planned and prepared"],
        ["Desktop version (PC, laptop)", "coming soon"],
      ],
    },
    {
      kind: "points", dark: true, h: "Who Ultar OS is for", items: [
        "Companies, authorities and institutions that need full control over their devices – without third-party accounts or forced cloud.",
        "Devices in the field: tills, handhelds, kiosk systems and industrial boards with exactly the functions they need.",
        "People who value privacy: encrypted, without ads and trackers, with their own VPN.",
        "Older phones that have become too slow with Android.",
        "Partners and manufacturers who want to offer their own Arabic-first system.",
      ],
    },
  ],
  closing: { h: "Interested in Ultar OS?", text: "Would you like to test Ultar OS on your devices, have it adapted for your company, build with us, or be the first to hear about the desktop version? Tell us briefly which devices you use." },
};

const ar: ProductPage = {
  title: "Ultar OS – نظام تشغيل خاص بنا للهاتف والتابلت واللوحات",
  eyebrow: "Ultar OS 0.6 · نظام تشغيل بلغة Rust · قيد التطوير",
  h1: "نظام تشغيل للهاتف ملكٌ لك.",
  sub: "يستبدل Ultar OS نظام أندرويد بالكامل: نواة لينكس للتعريفات، وفوقها نظام خاص بنا كلياً بلغة Rust – برنامج الإقلاع والخدمات والواجهة والتطبيقات والشبكة الخلوية والأمان، ومساعد بذكاء خاص به. دون آلة جافا الافتراضية، ودون Google، ودون برامج الشركات المصنّعة. العربية أولاً. ونسخة سطح المكتب للحاسوب واللابتوب قادمة قريباً.",
  sheet: [
    ["الحالة", "الإصدار 0.6، يعمل على جهاز الاختبار Samsung Galaxy A30"],
    ["الأساس", "نواة لينكس، و18 مكوّناً خاصاً بلغة Rust، دون آلة جافا"],
    ["الأجهزة", "الهواتف والتابلت ولوحات التطوير – سطح المكتب قريباً"],
    ["الذاكرة", "نحو 65 ميغابايت مع الواجهة (أندرويد: أكثر من 1 غيغابايت)"],
    ["التطبيقات", "تطبيقاتنا بلغة Rust، وحزم أوبونتو، وتطبيقات الويب، ومتجر تطبيقات موقّع"],
    ["الأمان", "تشفير، وإقلاع موثّق، وشبكة VPN مع قاطع للاتصال"],
    ["اللغات", "العربية (من اليمين لليسار)، الإنجليزية، الألمانية"],
  ],
  primary: { label: "سجّل اهتمامك", to: CONTACT },
  secondary: { label: "مرحلة التطوير", to: "#stand" },
  blocks: [
    {
      kind: "features", h: "ما الذي يميّز Ultar OS", items: [
        ["بلا أعباء أندرويد", "بطء أندرويد لا يأتي من النواة بل من آلة جافا وZygote ونحو مئة خدمة في الخلفية. يشغّل Ultar خدماته مباشرة: برنامج الإقلاع حجمه 1,5 ميغابايت ولا يستهلك المعالج أثناء الخمول."],
        ["برامج أوبونتو مشمولة", "يعمل أوبونتو 24.04 معزولاً على النواة نفسها – دون آلة افتراضية ودون خسارة في الأداء. تُثبَّت الحزم عبر apt أو دون إنترنت كملفات .deb."],
        ["تحكّم كامل", "لا برامج للشركات المصنّعة، ولا حساب Google، ولا اتصالات خفية. كل خدمة تعمل بحدود خاصة للذاكرة والمعالج."],
        ["العربية أولاً", "واجهة من اليمين لليسار، ولوحة مفاتيح عربية على الشاشة، والتاريخ الهجري، ومواقيت الصلاة، والقبلة مدمجة من الأساس لا مضافة لاحقاً."],
      ],
    },
    {
      kind: "gallery", h: "هكذا يبدو Ultar OS", lead: "شاشات من نسخة التطوير الحالية، ببيانات تجريبية.",
      items: [
        [`${IMG}/uebersicht.png`, "الشاشة الرئيسية، الإعدادات السريعة، أبراج الشبكة، الشبكة الخلوية، المكالمات، الرسائل، الملفات – وبالعربية أيضاً"],
        [`${IMG}/runde2.png`, "الأدوات، مواقيت الصلاة، القبلة، المهام، وقت الاستخدام، العناية بالجهاز، سجل البطارية، الأوضاع"],
        [`${IMG}/apps-neu-ar.png`, "التطبيقات المدمجة بالعربية"],
        [`${IMG}/monitor.png`, "المراقبة: المعالج والذاكرة واستهلاك البيانات"],
      ],
    },
    {
      kind: "features", h: "الهاتف والشبكة الخلوية والتواصل", lead: "الشبكة الخلوية كما لم يعرضها أندرويد قط – ومكالمات لا تمرّ عبر خوادم الآخرين.", items: [
        ["اختيار برج الاتصال", "رادار لكل الأبراج القريبة مع قيم مباشرة للإشارة ونسبة التشويش والجودة. التلقائي يختار أقوى إشارة، والذكي أفضل سرعة، واليدوي البرج الذي تختاره."],
        ["شريحتان", "حدّد الشريحة للبيانات والمكالمات والرسائل كلاً على حدة، وافتح رمز PIN مباشرة، واختر التقنية المفضّلة والتجوال. ويُعرض مسار الاتصال حتى الإنترنت."],
        ["رقم Ultar خاص", "يحصل كل جهاز على رقم فريد. المكالمات الصوتية والمرئية بين أجهزة Ultar مشفّرة من طرف إلى طرف؛ وخادمنا يصل الطرفين فقط ولا يرى أي محتوى."],
        ["تيليغرام وواتساب ويوتيوب وسبوتيفاي", "تيليغرام كتطبيق أصلي عبر البروتوكول الرسمي. وواتساب ويوتيوب وسبوتيفاي كتطبيقات ويب بتسجيل دخول منفصل ودائم؛ وتشغيل سبوتيفاي كمكبّر صوت Connect مجهّز."],
      ],
    },
    {
      kind: "features", h: "الأمان والخصوصية", lead: "إجراءات قياسية مُختبرة فقط، دون تشفير مُخترَع ذاتياً. وكل ميزة قابلة للتشغيل والإيقاف على حدة.", items: [
        ["تشفير الجهاز", "البيانات الشخصية مشفّرة بـ LUKS2 وAES-XTS بطول 512 بت؛ ويُشتق المفتاح من كلمة مرورك عبر Argon2id. ودون كلمة المرور تبقى الذاكرة ضجيجاً لا معنى له."],
        ["إقلاع موثّق", "يُفحص النظام في كل إقلاع مقابل بصمة موقّعة. وأي تعديل يُكتشف ويوقف الإقلاع."],
        ["VPN مع قاطع للاتصال", "عند الطلب تمرّ كل الحركة عبر خادمنا بتقنية WireGuard. وإذا انقطع النفق لا يخرج شيء دون حماية."],
        ["تطبيقات وتحديثات موقّعة", "لا يُثبَّت أي تطبيق ولا يُطبَّق أي تحديث دون توقيع صالح – ويجري الفحص على الجهاز لا على الخادم."],
        ["فتح القفل", "رمز PIN مع قفل بعد المحاولات الخاطئة، وبصمة الإصبع، والتعرّف على الوجه – ويعمل التعرّف على الوجه كاملاً على الجهاز دون إنترنت."],
        ["مركز الخصوصية", "حظر خوادم الإعلانات والتتبّع على مستوى النظام؛ ومفتاح رئيسي واحد للشبكة والكاميرا والميكروفون والموقع."],
        ["فحص الروابط", "تُفحص الروابط قبل فتحها: العلامات التجارية المقلَّدة، والحروف المتشابهة، والروابط المختصرة – وتُتتبَّع التحويلات داخل صندوق معزول دون صلاحيات."],
        ["تطبيقات أندرويد في قفص (مخطط)", "تطبيقات أندرويد حقيقية اختيارياً داخل منطقة معزولة بصرامة، دون خدمات Google، ومتوقفة افتراضياً، وقابلة للحذف الكامل في أي وقت."],
      ],
    },
    {
      kind: "features", h: "المساعد – الذكاء داخل النظام", lead: "شخصية صغيرة على كل شاشة تعرف النظام فعلاً.", items: [
        ["يقرأ الشاشة", "لأن Ultar يرسم كل نص بنفسه، يعرف المساعد ما على الشاشة – دون لقطة شاشة، ودون تعرّف ضوئي على النص، ودون صلاحيات إضافية."],
        ["يفهم الأوامر دون إنترنت", "«شغّل المصباح»، «منبّه الساعة 7:30»، «ملاحظة: اشترِ حليباً»، «هل هذا الرابط آمن؟» – بالعربية والإنجليزية والألمانية، فوراً ودون إنترنت."],
        ["يرافق ويذكّر", "يعرّفك بالنظام عند أول تشغيل، ويعرف صفحات المساعدة، ويذكّرك بالمواعيد، وينبّهك من تلقاء نفسه عند الروابط الخطرة."],
        ["الصوت والذكاء الاصطناعي", "تحكّم صوتي عبر الميكروفون. ونموذج لغوي صغير داخل نواة Rust قيد العمل؛ ويمكن عند الطلب ربط نموذج كبير عبر الإنترنت."],
      ],
    },
    {
      kind: "features", h: "أكثر من 100 وظيفة للنظام", lead: "ما تتوقعه من هاتف حديث – وكثير مما لا يستطيعه أندرويد.", items: [
        ["القفل والوقت", "شاشة القفل، ومزامنة الوقت عبر الشبكة، والمناطق الزمنية مع التوقيت الصيفي التلقائي، والساعة العالمية، ونظام 12 أو 24 ساعة."],
        ["البطارية والطاقة", "توفير الطاقة بدءاً من مستوى تختاره، وأنماط الأداء، وتحذير الحرارة، وسجل 24 ساعة، والوقت المتبقي، وتنبيه الشحن عند 80 %."],
        ["العرض", "الضوء الليلي بجدول زمني، والسطوع التلقائي، والتباين العالي، والوضع الفاتح والداكن تلقائياً، والتدوير والحجم بحرية."],
        ["الهدوء والصوت", "أنماط الصوت، وعدم الإزعاج بجدول زمني، ووضع النوم، وحماية الجيب، وقائمة حظر المتصلين، وإشارة الوقت كل ساعة."],
        ["الشبكة", "واي فاي (بما فيها الشبكات المخفية)، وخوادم DNS خاصة، وتشخيص الشبكة، وحدّ للبيانات مع تحذير، والبحث عن أجهزة بلوتوث، واستهلاك البيانات يومياً."],
        ["العناية والنسخ الاحتياطي", "العناية بالجهاز مع مؤشر للحالة، وتحليل التخزين، والنسخ الاحتياطي والاستعادة، وإعادة ضبط المصنع بتأكيد ثلاثي."],
        ["الاستخدام", "إيماءات السحب، ونظرة على التطبيقات الأخيرة، وتثبيت التطبيق، وسجل الحافظة، والبحث الشامل – متسامح مع الإملاء العربي."],
        ["مخرج الطوارئ", "إذا تعلّق شيء، فإن الضغط المطوّل على رفع الصوت وخفضه معاً يعيد تشغيل الواجهة أو كل الخدمات – ومراقب يفحص النظام باستمرار."],
      ],
    },
    {
      kind: "features", h: "التطبيقات المدمجة", lead: "كل التطبيقات مكتوبة بلغة Rust الأصلية وتتكيّف مع الوضع العمودي والأفقي والتابلت.", items: [
        ["الهاتف والرسائل", "لوحة الاتصال، وسجل المكالمات، والمكالمات الواردة على شاشة القفل، وحساس التقارب عند الأذن، والمحادثات كفقاعات."],
        ["الكاميرا", "صور ومربعة وفيديو، ومؤقت ذاتي، وشبكة، وتكبير، وتركيز تلقائي، وكاميرا أمامية وخلفية – مع ماسح للمستندات يكتشف الحواف ويصحّحها ويحفظها PDF."],
        ["المعرض والملفات", "الصور حسب التاريخ، والألبومات، والمفضّلة، والفيديو؛ ونسخ الملفات ونقلها وإعادة تسميتها بالضغط المطوّل."],
        ["الساعة والتقويم", "منبّهات ومؤقّت وساعة إيقاف ترنّ حتى والشاشة مطفأة؛ وتقويم مع تذكيرات."],
        ["الملاحظات وجهات الاتصال", "محفوظة محلياً، ومشمولة في النسخ الاحتياطي، وقابلة للعثور في البحث الشامل."],
        ["الحاسبات", "آلة حاسبة مع سجل، وحاسبات للوحدات والعملات والنسب والأقساط والتواريخ، وأنظمة العدّ."],
        ["الأدوات", "بوصلة، وميزان ماء، والقبلة، ومواقيت الصلاة، والتاريخ الهجري، وضوء استغاثة بشيفرة مورس، ومؤقّت التركيز، والمهام، والتذكيرات، وصفحة الطوارئ."],
        ["المراقبة والطرفية", "حمل المعالج والذاكرة ومعالج الرسوميات وشريحة الذكاء الاصطناعي، ووقت الاستخدام لكل تطبيق، إضافة إلى طرفية وبرامج أوبونتو."],
      ],
    },
    {
      kind: "features", h: "للمطوّرين والمصنّعين والتشغيل", items: [
        ["نواة نظام خاصة", "يشغّل Ultar-init الخدمات حسب اعتمادها، ويعيد تشغيلها عند الأعطال، ويمنح كلاً منها حدوداً خاصة. ويُكتشف العتاد عند أول تشغيل ويُحفظ – صورة واحدة لأجهزة كثيرة."],
        ["متجر التطبيقات والتحديثات", "صيغة حزم خاصة بتوقيع Ed25519، ومتجر تطبيقات، وتحديثات للنظام عبر قنوات (مستقرة، تجريبية) – وتبقى النسخة السابقة احتياطاً للرجوع."],
        ["Ultar Flash لويندوز", "ينسخ تعريفات هاتف أندرويد وأقسامه احتياطياً، ويثبّت Ultar OS، ويعيد النظام الأصلي عند الحاجة. ولا يُكتب فوق محمّل الإقلاع والمودم وبيانات الاتصال أبداً."],
        ["منفتح على اللوحات", "يعمل أيضاً على لوحات التطوير وفي المحاكاة؛ ومجهّز لـ Rockchip RK3566/RK3588. ويمكن تسليم تطبيقات الشركات مثل نظام الكاشير الخاص بنا كحزمة."],
      ],
    },
    {
      kind: "table", id: "stand", h: "مرحلة التطوير", lead: "بصدق وبأحدث المعلومات (20/11/2026، الإصدار 0.6). جهاز الاختبار هو Samsung Galaxy A30.",
      head: ["المجال", "الحالة"],
      rows: [
        ["الواجهة والتطبيقات والأدوات ووظائف النظام", "مكتملة، ومختبرة بالعربية والإنجليزية والألمانية"],
        ["الشاشة واللمس والأزرار والتخزين والبطارية والحساسات", "تعمل على A30"],
        ["واي فاي", "يعمل على A30"],
        ["الكاميرا مع ماسح المستندات", "تعمل على A30"],
        ["القفل برمز PIN، ومزامنة الوقت، والضوء الليلي، والنسخ الاحتياطي", "مختبرة على A30"],
        ["البصمة والتعرّف على الوجه والتحكم الصوتي", "مدمجة، والاختبار العملي على الجهاز جارٍ"],
        ["الصوت والميكروفون", "الوظائف الأولى تعمل، والتحسين جارٍ"],
        ["بلوتوث", "البحث عن الأجهزة يعمل، والاقتران والملفات الشخصية قيد العمل"],
        ["الشبكة الخلوية والشريحة", "المودم يعمل ويجد الشبكة، وتسجيل الشريحة قيد العمل"],
        ["GPS", "قيد العمل"],
        ["التشفير، والإقلاع الموثّق، وسحابة Ultar، والمكالمات عبر الإنترنت، وVPN", "مبنية، والاختبار على الجهاز وفي التشغيل الفعلي قادم"],
        ["تطبيقات أندرويد في القفص", "مخطط لها ومجهّزة"],
        ["نسخة سطح المكتب (حاسوب، لابتوب)", "قريباً"],
      ],
    },
    {
      kind: "points", dark: true, h: "لمن صُمّم Ultar OS", items: [
        "الشركات والجهات الحكومية والمؤسسات التي تحتاج تحكّماً كاملاً بأجهزتها – دون حسابات خارجية ودون سحابة إلزامية.",
        "الأجهزة الميدانية: أجهزة الكاشير والأجهزة المحمولة وأنظمة الأكشاك واللوحات الصناعية بالوظائف المطلوبة فقط.",
        "من يهتمون بالخصوصية: تشفير، ودون إعلانات أو تتبّع، مع VPN خاص.",
        "الهواتف القديمة التي أصبحت بطيئة مع أندرويد.",
        "الشركاء والمصنّعون الذين يريدون تقديم نظام خاص بهم يبدأ بالعربية.",
      ],
    },
  ],
  closing: { h: "مهتم بـ Ultar OS؟", text: "هل تريد تجربة Ultar OS على أجهزتك، أو تكييفه لشركتك، أو المشاركة في تطويره، أو أن تكون أول من يعرف بنسخة سطح المكتب؟ اكتب لنا باختصار ما الأجهزة التي تستخدمها." },
};

export const ULTAR: Record<Locale, ProductPage> = { de, en, ar };
