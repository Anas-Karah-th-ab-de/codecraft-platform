// Erzeugt aus dem Repo Digitalen-Radiologie-Systems (site/content.mjs, npm run site:build).
// Nicht von Hand ändern: Inhalt dort pflegen und neu erzeugen, damit Seite und Produktmappe gleich bleiben.
import type { Locale } from "../../i18n";
import type { ProductPage } from "./productText";

export const RADIOLOGIE: Record<Locale, ProductPage> = {
  "de": {
    "title": "KM Code Craft Radiology – RIS, PACS und Befundung aus einer Hand",
    "eyebrow": "Radiologie-Informationssystem · Bildarchiv · Befundung",
    "h1": "Die ganze Radiologie in einem System. Im eigenen Haus.",
    "sub": "Von der Anmeldung über den Termin und das Gerät bis zum freigegebenen Befund: ein Arbeitsplatz im Browser, auf Arabisch, Englisch und Deutsch. Server und Daten stehen bei Ihnen, nicht in einer Cloud.",
    "sheet": [
      [
        "Umfang",
        "RIS, PACS-Archiv, Web-Viewer, Befundung, Dokumente"
      ],
      [
        "Betrieb",
        "Eigener Server vor Ort, läuft ohne Internet"
      ],
      [
        "Sprachen",
        "Arabisch als Hauptsprache (RTL), dazu Englisch und Deutsch"
      ],
      [
        "Geräte",
        "DICOM-Empfang und Modality Worklist"
      ],
      [
        "Zugang",
        "11 Rollen, zweiter Faktor, LDAP/AD möglich"
      ],
      [
        "Stand",
        "Version 0.1.0 · Pilotphase"
      ]
    ],
    "primary": {
      "label": "Vorführung anfragen",
      "to": "/kontakt"
    },
    "secondary": {
      "label": "Ausführliche Seite mit allen Unterlagen",
      "to": "/radiology/index.html?lang=de"
    },
    "blocks": [
      {
        "kind": "points",
        "id": "stand",
        "h": "Ehrlich zum Stand",
        "items": [
          "Das System ist in der Pilotphase. Bilder aus dem eingebauten Viewer sind nicht für die Primärdiagnostik freigegeben; das zeigt das Programm auf jeder Seite an. Eine Zulassung als Medizinprodukt liegt nicht vor und hängt vom Land ab, in dem Sie es einsetzen. Wir suchen Einrichtungen für Pilotinstallationen."
        ],
        "dark": true
      },
      {
        "kind": "features",
        "id": "module",
        "h": "Was das System kann",
        "lead": "Jeder Baustein ist einzeln schaltbar. Sie beginnen mit dem, was Sie brauchen.",
        "items": [
          [
            "Patientenakte",
            "Stammdaten mit lückenloser Korrekturhistorie, Suche nach Name und Nummer. Doppelte Akten werden im Vier-Augen-Verfahren zusammengeführt und lassen sich wieder trennen."
          ],
          [
            "Aufträge und Arbeitsliste",
            "Untersuchungen anlegen und verfolgen: angefordert, geplant, angekommen, in Arbeit, abgeschlossen. Jede Rolle sieht nur die Schritte, die sie ausführen darf."
          ],
          [
            "Terminplanung",
            "Räume und Geräte mit Schutz vor Doppelbelegung, Anmeldung am Tag der Untersuchung, Absage und Nichterscheinen."
          ],
          [
            "Arbeitsliste am Gerät",
            "Geplante Untersuchungen erscheinen per DICOM Modality Worklist am Gerät. Das Personal wählt den Patienten aus, statt zu tippen; Verwechslungen durch Tippfehler entfallen."
          ],
          [
            "Bildarchiv (PACS)",
            "Empfang per DICOM, automatische Zuordnung eindeutiger Studien zum Auftrag. Alles Zweifelhafte landet in einer Prüfliste und wird von einem Menschen zugeordnet oder abgelehnt."
          ],
          [
            "Bildbetrachtung",
            "Web-Viewer direkt aus der Untersuchung, über einen kurzlebigen, persönlichen Link. Zur Durchsicht und Demonstration, nicht für die Primärdiagnostik."
          ],
          [
            "Befundung",
            "Entwurf mit Vorlagen, Einreichen, Freigabe durch einen Zweitleser (abschaltbar), Zurückgeben mit Begründung, Nachträge. Ein freigegebener Befund ist unveränderlich."
          ],
          [
            "Siegel und PDF/A",
            "Jeder freigegebene Befund erhält ein kryptografisches Systemsiegel und lässt sich als PDF/A-2b für die Langzeitablage ausgeben."
          ],
          [
            "Dokumente",
            "Überweisungen, Einwilligungen und Vorbefunde als PDF oder Bild hochladen. Jede Datei wird vor dem Speichern auf Schadsoftware geprüft."
          ],
          [
            "Verwaltung",
            "Übersicht über Systemzustand, wartende Arbeit und eingeschaltete Funktionen. Benutzer, Rollen und zweiter Faktor in einer eigenen Verwaltungsoberfläche."
          ],
          [
            "KI-Assistent (Zusatzmodul)",
            "Auf Wunsch zuschaltbar und an einen KI-Server im eigenen Haus angebunden, etwa KM Code Craft AI: übersetzt Texte zwischen Arabisch, Englisch und Deutsch, prüft die Rechtschreibung im Befund und schlägt eine Reihenfolge der wartenden Arbeit vor. Er macht nur Vorschläge; übernommen wird nichts ohne einen Menschen."
          ]
        ]
      },
      {
        "kind": "gallery",
        "id": "einblick",
        "h": "So sieht die Arbeit aus",
        "lead": "Bildschirmfotos der echten Oberfläche mit erfundenen Beispieldaten.",
        "items": [
          [
            "/products/radiologie/de-worklist.png",
            "Arbeitsliste: Untersuchungen mit Status und den nächsten erlaubten Schritten"
          ],
          [
            "/products/radiologie/de-schedule.png",
            "Terminplan: Raum, Beginn, Dauer – Doppelbelegung wird vom Server verhindert"
          ],
          [
            "/products/radiologie/de-report.png",
            "Befundung: Entwurf, Vorlage, Einreichen zur Freigabe"
          ],
          [
            "/products/radiologie/de-admin.png",
            "Verwaltung: Zustand, wartende Arbeit, eingeschaltete Funktionen"
          ]
        ]
      },
      {
        "kind": "points",
        "id": "sicherheit",
        "h": "Sicherheit und Nachvollziehbarkeit",
        "lead": "Patientendaten verlassen Ihr Haus nicht. Wer was getan hat, lässt sich belegen.",
        "items": [
          "Betrieb vollständig vor Ort; das System braucht im Alltag keine Internetverbindung.",
          "Anmeldung mit zweitem Faktor für Befunder, Freigeber und Administration; Anbindung an LDAP oder Active Directory nur lesend.",
          "Zugriff auf Datenbankebene nach Standort und Abteilung getrennt.",
          "Manipulationssicheres Audit-Protokoll: jede Änderung und jeder Aktenzugriff wird in einer verketteten Prüfsummenreihe festgehalten, die sich jederzeit nachrechnen lässt.",
          "Freigegebene Befunde und Dokumentversionen sind unveränderlich; Korrekturen entstehen als Nachtrag oder neue Version.",
          "Sicherung mit Wiederherstellung auf einen beliebigen Zeitpunkt; das Verfahren ist automatisiert getestet.",
          "Verschlüsselte Verbindungen, Sicherheits-Header und Begrenzung der Anfragerate durch den vorgeschalteten Proxy.",
          "Uploads werden vor dem Speichern auf Schadsoftware geprüft; ohne erreichbaren Scanner wird nichts angenommen."
        ]
      },
      {
        "kind": "table",
        "id": "technik",
        "h": "Technik",
        "lead": "Bewährte offene Bausteine, sauber verbunden. Keine Lizenzgebühren an Dritte für die Kernkomponenten.",
        "head": [
          "Bereich",
          "Ausführung"
        ],
        "rows": [
          [
            "Arbeitsplatz",
            "Web-Anwendung für aktuelle Versionen von Chrome und Edge; keine Installation am Arbeitsplatz"
          ],
          [
            "Server",
            "Linux mit Docker; alle Dienste als gehärtete Container ohne Root-Rechte"
          ],
          [
            "Datenbank",
            "PostgreSQL 17 mit zeilenweiser Zugriffstrennung und fortlaufender Sicherung"
          ],
          [
            "Bildarchiv",
            "Orthanc (DICOM C-STORE, DICOMweb, Modality Worklist)"
          ],
          [
            "Viewer",
            "OHIF, eingebunden über kurzlebige Zugangslinks"
          ],
          [
            "Anmeldung",
            "Keycloak (OpenID Connect, TOTP), optional LDAP / Active Directory"
          ],
          [
            "Schnittstellen",
            "DICOM, DICOMweb, REST-API mit OpenAPI-3.1-Beschreibung, Prometheus-Metriken"
          ],
          [
            "Nicht enthalten",
            "HL7/FHIR-Schnittstellen, Abrechnung, Teleradiologie, persönliche qualifizierte Signatur"
          ],
          [
            "Richtwert Server",
            "Für eine kleine Abteilung: 8 Kerne, 32 GB RAM, SSD für die Datenbank, gespiegelter Bildspeicher nach Studienaufkommen, USV, getrenntes Sicherungsmedium. Die genaue Auslegung folgt aus der Standortaufnahme."
          ]
        ]
      },
      {
        "kind": "table",
        "id": "nachweise",
        "h": "Geprüft, nicht nur behauptet",
        "lead": "Alle Prüfungen laufen automatisch und sind im Projektprotokoll nachzulesen. Die Messwerte stammen vom Entwicklungsrechner und sind keine Zusage für Ihre Hardware.",
        "head": [
          "Prüfung",
          "Ergebnis"
        ],
        "rows": [
          [
            "Automatische Tests",
            "Über 300 Unit-Tests und 60 Tests gegen eine echte Datenbank bei jeder Änderung"
          ],
          [
            "Gesamtablauf im Browser",
            "Anmeldung → Termin → Untersuchung → Befund → Freigabe durch den Zweitleser, mit zweitem Faktor, gegen echten Server"
          ],
          [
            "Geräteanbindung",
            "Empfang und Arbeitsliste gegen ein echtes DICOM-Archiv mit simuliertem Gerät, auch mit arabischen Namen"
          ],
          [
            "Dauerlast 30 Minuten",
            "276.205 Anfragen ohne Fehler, Antwortzeit gleichbleibend 11 ms (95 %), Speicher stabil"
          ],
          [
            "Wiederherstellung",
            "11 GB Datenbank nach simuliertem Totalverlust in 75 Sekunden auf einen gewählten Zeitpunkt zurückgeholt"
          ],
          [
            "Befund-PDF",
            "PDF/A-2b mit eingebetteten Schriften, Arabisch und Deutsch"
          ]
        ]
      },
      {
        "kind": "steps",
        "id": "lieferung",
        "h": "Vom Gespräch zum laufenden Betrieb",
        "lead": "Wir liefern das System als fertige Anlage: Hardware, Installation, Schulung und Betreuung.",
        "items": [
          "Vorführung und Klärung des Umfangs: welche Module, wie viele Arbeitsplätze, welche Geräte.",
          "Standortaufnahme: Geräteliste, Netz, Speicherbedarf, Aufbewahrungsfristen, Benutzer und Rollen.",
          "Angebot mit Hardware, Installation und Betreuung.",
          "Aufbau und Installation mit dokumentierter Abnahmeprüfung, Anbindung jedes Geräts.",
          "Schulung je Rolle mit bebilderten Heften auf Arabisch und Deutsch.",
          "Probebetrieb mit Ihrer Abteilung, Freigabe durch Sie, danach Betreuung und Updates."
        ]
      },
      {
        "kind": "points",
        "id": "umfang",
        "h": "Im Lieferumfang",
        "items": [
          "Software mit allen oben genannten Modulen",
          "Installations- und Betriebsanleitung, Ausfallverfahren",
          "Lernhefte je Rolle (Arabisch, Deutsch) und Schulungsplan",
          "Schnittstellenbeschreibung (OpenAPI)",
          "Vorlagen für Standortaufnahme, Abnahme und Übergabe"
        ]
      },
      {
        "kind": "points",
        "id": "vor-ort",
        "h": "Entsteht bei Ihnen",
        "items": [
          "Anbindung und Test mit Ihren Geräten",
          "Abnahmeprüfung auf Ihrer Hardware, inklusive Messung der Wiederherstellungszeit",
          "Unabhängiger Sicherheitstest, wenn Sie ihn verlangen",
          "Klärung der rechtlichen Anforderungen Ihres Landes",
          "Inhalte Ihrer Befundvorlagen"
        ]
      },
      {
        "kind": "features",
        "id": "fragen",
        "h": "Häufige Fragen",
        "items": [
          [
            "Brauchen wir Internet?",
            "Nein. Das System läuft vollständig im eigenen Netz. Internet ist nur für die Fernbetreuung nötig, wenn Sie sie wünschen."
          ],
          [
            "Darf mit dem Viewer befundet werden?",
            "Der eingebaute Viewer ist zur Durchsicht gedacht und nicht für die Primärdiagnostik freigegeben. Für die Diagnostik nutzen Sie die dafür zugelassene Befundstation; das Archiv stellt ihr die Bilder per DICOM bereit."
          ],
          [
            "Welche Geräte lassen sich anbinden?",
            "Geräte, die DICOM senden. Für die Arbeitsliste am Gerät muss das Gerät Modality Worklist unterstützen und dafür lizenziert sein. Das klären wir in der Standortaufnahme."
          ],
          [
            "Ist das System als Medizinprodukt zugelassen?",
            "Nein. Ob und welche Zulassung nötig ist, hängt von Ihrem Land und vom Einsatzzweck ab. Wir klären das gemeinsam vor einer Installation."
          ],
          [
            "Was kostet es?",
            "Der Preis hängt von Hardware, Zahl der Geräte und Betreuungsumfang ab. Sie erhalten nach der Standortaufnahme ein festes Angebot."
          ],
          [
            "Wem gehören die Daten?",
            "Ihnen. Sie liegen auf Ihrem Server in offenen Formaten (DICOM, PostgreSQL, PDF/A)."
          ]
        ]
      }
    ],
    "closing": {
      "h": "Sehen Sie es sich an.",
      "text": "Wir zeigen Ihnen das System mit Beispieldaten und besprechen, was Ihre Abteilung braucht."
    }
  },
  "en": {
    "title": "KM Code Craft Radiology – RIS, PACS and reporting in one system",
    "eyebrow": "Radiology information system · Image archive · Reporting",
    "h1": "Your whole radiology department in one system. On your premises.",
    "sub": "From registration to the appointment, the modality and the released report: one workplace in the browser, in Arabic, English and German. The server and the data stay with you, not in a cloud.",
    "sheet": [
      [
        "Scope",
        "RIS, PACS archive, web viewer, reporting, documents"
      ],
      [
        "Operation",
        "Your own on-site server, works without internet"
      ],
      [
        "Languages",
        "Arabic first (RTL), plus English and German"
      ],
      [
        "Modalities",
        "DICOM receive and modality worklist"
      ],
      [
        "Access",
        "11 roles, second factor, LDAP/AD optional"
      ],
      [
        "Status",
        "Version 0.1.0 · pilot phase"
      ]
    ],
    "primary": {
      "label": "Request a demonstration",
      "to": "/kontakt"
    },
    "secondary": {
      "label": "Full page with all documents",
      "to": "/radiology/index.html?lang=en"
    },
    "blocks": [
      {
        "kind": "points",
        "id": "stand",
        "h": "Where we honestly stand",
        "items": [
          "The system is in its pilot phase. Images in the built-in viewer are not released for primary diagnosis; the program says so on every page. It is not approved as a medical device, and what approval is needed depends on the country you use it in. We are looking for sites for pilot installations."
        ],
        "dark": true
      },
      {
        "kind": "features",
        "id": "module",
        "h": "What the system does",
        "lead": "Every module can be switched on separately. You start with what you need.",
        "items": [
          [
            "Patient record",
            "Demographics with a complete correction history, search by name and number. Duplicate records are merged under a two-person rule and can be separated again."
          ],
          [
            "Orders and worklist",
            "Create and follow examinations: requested, scheduled, arrived, in progress, completed. Each role sees only the steps it may perform."
          ],
          [
            "Scheduling",
            "Rooms and devices with protection against double booking, check-in on the day, cancellation and no-show."
          ],
          [
            "Worklist at the modality",
            "Scheduled examinations appear on the device through DICOM modality worklist. Staff pick the patient instead of typing; mix-ups from typing errors disappear."
          ],
          [
            "Image archive (PACS)",
            "DICOM receive with automatic matching of unambiguous studies to their order. Anything doubtful goes to a review list and is assigned or rejected by a person."
          ],
          [
            "Image viewing",
            "Web viewer straight from the examination through a short-lived personal link. For review and demonstration, not for primary diagnosis."
          ],
          [
            "Reporting",
            "Draft with templates, submit, release by a second reader (can be switched off), return with a reason, addenda. A released report cannot be changed."
          ],
          [
            "Seal and PDF/A",
            "Every released report receives a cryptographic system seal and can be exported as PDF/A-2b for long-term filing."
          ],
          [
            "Documents",
            "Upload referrals, consent forms and previous reports as PDF or image. Every file is scanned for malware before it is stored."
          ],
          [
            "Administration",
            "Overview of system state, waiting work and enabled functions. Users, roles and second factor in a dedicated administration console."
          ],
          [
            "AI assistant (add-on module)",
            "Can be switched on and connected to an AI server in your own building, such as KM Code Craft AI: translates texts between Arabic, English and German, checks the spelling of a report and suggests an order for the waiting work. It only suggests; nothing is taken over without a person."
          ]
        ]
      },
      {
        "kind": "gallery",
        "id": "einblick",
        "h": "What the work looks like",
        "lead": "Screenshots of the real interface with invented sample data.",
        "items": [
          [
            "/products/radiologie/en-worklist.png",
            "Worklist: examinations with status and the next permitted steps"
          ],
          [
            "/products/radiologie/en-schedule.png",
            "Schedule: room, start, duration – double booking is prevented by the server"
          ],
          [
            "/products/radiologie/en-report.png",
            "Reporting: draft, template, submit for release"
          ],
          [
            "/products/radiologie/en-admin.png",
            "Administration: state, waiting work, enabled functions"
          ]
        ]
      },
      {
        "kind": "points",
        "id": "sicherheit",
        "h": "Security and traceability",
        "lead": "Patient data does not leave your building. Who did what can be proven.",
        "items": [
          "Fully on-premises; the system needs no internet connection in daily use.",
          "Sign-in with a second factor for authors, releasers and administrators; read-only connection to LDAP or Active Directory.",
          "Access separated by site and department at database level.",
          "Tamper-evident audit trail: every change and every record access is kept in a chained series of checksums that can be recomputed at any time.",
          "Released reports and document versions are immutable; corrections are made as an addendum or a new version.",
          "Backup with recovery to any point in time; the procedure is tested automatically.",
          "Encrypted connections, security headers and request-rate limiting by the reverse proxy in front.",
          "Uploads are scanned for malware before storage; without a reachable scanner nothing is accepted."
        ]
      },
      {
        "kind": "table",
        "id": "technik",
        "h": "Technology",
        "lead": "Proven open building blocks, cleanly connected. No third-party licence fees for the core components.",
        "head": [
          "Area",
          "Implementation"
        ],
        "rows": [
          [
            "Workplace",
            "Web application for current versions of Chrome and Edge; nothing to install on the workstation"
          ],
          [
            "Server",
            "Linux with Docker; all services as hardened containers without root privileges"
          ],
          [
            "Database",
            "PostgreSQL 17 with row-level access separation and continuous backup"
          ],
          [
            "Image archive",
            "Orthanc (DICOM C-STORE, DICOMweb, modality worklist)"
          ],
          [
            "Viewer",
            "OHIF, integrated through short-lived access links"
          ],
          [
            "Sign-in",
            "Keycloak (OpenID Connect, TOTP), optional LDAP / Active Directory"
          ],
          [
            "Interfaces",
            "DICOM, DICOMweb, REST API with OpenAPI 3.1 description, Prometheus metrics"
          ],
          [
            "Not included",
            "HL7/FHIR interfaces, billing, teleradiology, personal qualified signature"
          ],
          [
            "Server guideline",
            "For a small department: 8 cores, 32 GB RAM, SSD for the database, mirrored image storage sized by study volume, UPS, separate backup medium. Exact sizing follows from the site survey."
          ]
        ]
      },
      {
        "kind": "table",
        "id": "nachweise",
        "h": "Tested, not just claimed",
        "lead": "All checks run automatically and are recorded in the project log. The figures come from the development machine and are no promise for your hardware.",
        "head": [
          "Check",
          "Result"
        ],
        "rows": [
          [
            "Automated tests",
            "More than 300 unit tests and 60 tests against a real database on every change"
          ],
          [
            "Whole workflow in the browser",
            "Sign-in → appointment → examination → report → release by the second reader, with second factor, against a real server"
          ],
          [
            "Modality connection",
            "Receive and worklist against a real DICOM archive with a simulated device, including Arabic names"
          ],
          [
            "30-minute endurance load",
            "276,205 requests without an error, response time steady at 11 ms (95th percentile), memory stable"
          ],
          [
            "Recovery",
            "11 GB database restored to a chosen point in time in 75 seconds after a simulated total loss"
          ],
          [
            "Report PDF",
            "PDF/A-2b with embedded fonts, Arabic and German"
          ]
        ]
      },
      {
        "kind": "steps",
        "id": "lieferung",
        "h": "From first talk to daily operation",
        "lead": "We deliver the system as a finished installation: hardware, installation, training and support.",
        "items": [
          "Demonstration and scope: which modules, how many workplaces, which modalities.",
          "Site survey: device list, network, storage need, retention periods, users and roles.",
          "Quotation covering hardware, installation and support.",
          "Set-up and installation with a documented acceptance test, connection of every device.",
          "Training per role with illustrated guides in Arabic and German.",
          "Trial operation with your department, your approval, then support and updates."
        ]
      },
      {
        "kind": "points",
        "id": "umfang",
        "h": "Included",
        "items": [
          "Software with all modules listed above",
          "Installation and operating manual, downtime procedure",
          "Training guides per role (Arabic, German) and training plan",
          "Interface description (OpenAPI)",
          "Templates for site survey, acceptance and handover"
        ]
      },
      {
        "kind": "points",
        "id": "vor-ort",
        "h": "Done at your site",
        "items": [
          "Connection and testing with your modalities",
          "Acceptance test on your hardware, including measured recovery time",
          "Independent security test if you require one",
          "Clarifying the legal requirements of your country",
          "The content of your report templates"
        ]
      },
      {
        "kind": "features",
        "id": "fragen",
        "h": "Frequent questions",
        "items": [
          [
            "Do we need internet?",
            "No. The system runs entirely in your own network. Internet is only needed for remote support, if you want it."
          ],
          [
            "May the viewer be used for diagnosis?",
            "The built-in viewer is meant for review and is not released for primary diagnosis. For diagnosis you use an approved diagnostic workstation; the archive provides it with the images through DICOM."
          ],
          [
            "Which modalities can be connected?",
            "Devices that send DICOM. For the worklist at the device, the device must support modality worklist and be licensed for it. We clarify that in the site survey."
          ],
          [
            "Is the system approved as a medical device?",
            "No. Whether and which approval is required depends on your country and the intended use. We clarify this together before an installation."
          ],
          [
            "What does it cost?",
            "The price depends on hardware, number of devices and level of support. You receive a fixed quotation after the site survey."
          ],
          [
            "Who owns the data?",
            "You do. It lives on your server in open formats (DICOM, PostgreSQL, PDF/A)."
          ]
        ]
      }
    ],
    "closing": {
      "h": "See it for yourself.",
      "text": "We show you the system with sample data and discuss what your department needs."
    }
  },
  "ar": {
    "title": "KM Code Craft Radiology – نظام معلومات الأشعة والأرشيف والتقارير في نظام واحد",
    "eyebrow": "نظام معلومات الأشعة · أرشيف الصور · كتابة التقارير",
    "h1": "قسم الأشعة كاملاً في نظام واحد. داخل منشأتك.",
    "sub": "من التسجيل إلى الموعد والجهاز حتى التقرير المعتمد: مكان عمل واحد في المتصفح، بالعربية والإنجليزية والألمانية. الخادم والبيانات عندك، لا في السحابة.",
    "sheet": [
      [
        "النطاق",
        "RIS، أرشيف PACS، عارض ويب، تقارير، وثائق"
      ],
      [
        "التشغيل",
        "خادم خاص داخل المنشأة، يعمل بدون إنترنت"
      ],
      [
        "اللغات",
        "العربية هي اللغة الأساسية، مع الإنجليزية والألمانية"
      ],
      [
        "الأجهزة",
        "استقبال DICOM وقائمة عمل الأجهزة"
      ],
      [
        "الدخول",
        "11 دوراً، عامل تحقق ثانٍ، ربط LDAP/AD اختياري"
      ],
      [
        "الحالة",
        "الإصدار 0.1.0 · مرحلة تجريبية"
      ]
    ],
    "primary": {
      "label": "اطلب عرضاً تجريبياً",
      "to": "/kontakt"
    },
    "secondary": {
      "label": "الصفحة الكاملة مع كل الوثائق",
      "to": "/radiology/index.html?lang=ar"
    },
    "blocks": [
      {
        "kind": "points",
        "id": "stand",
        "h": "بصراحة عن الوضع الحالي",
        "items": [
          "النظام في مرحلته التجريبية. الصور في العارض المدمج غير معتمدة للتشخيص الأولي، والبرنامج يذكر ذلك في كل صفحة. لا يحمل النظام اعتماداً كجهاز طبي، ونوع الاعتماد المطلوب يتبع البلد الذي يُستخدم فيه. نبحث عن منشآت لتركيبات تجريبية."
        ],
        "dark": true
      },
      {
        "kind": "features",
        "id": "module",
        "h": "ماذا يقدّم النظام",
        "lead": "كل وحدة تُفعَّل بمفردها. تبدأ بما تحتاجه.",
        "items": [
          [
            "ملف المريض",
            "بيانات أساسية مع سجل كامل للتصحيحات، وبحث بالاسم والرقم. تُدمج الملفات المكررة بموافقة شخصين ويمكن فصلها من جديد."
          ],
          [
            "الطلبات وقائمة العمل",
            "إنشاء الفحوص ومتابعتها: مطلوب، مجدول، وصل، قيد التنفيذ، مكتمل. كل دور يرى فقط الخطوات المسموح له بها."
          ],
          [
            "جدولة المواعيد",
            "غرف وأجهزة مع منع الحجز المزدوج، تسجيل الحضور يوم الفحص، الإلغاء وعدم الحضور."
          ],
          [
            "قائمة العمل على الجهاز",
            "تظهر الفحوص المجدولة على الجهاز عبر DICOM Modality Worklist. يختار الفني المريض بدل الكتابة، فتزول أخطاء الإدخال."
          ],
          [
            "أرشيف الصور (PACS)",
            "استقبال عبر DICOM وربط تلقائي للدراسات الواضحة بطلبها. كل ما فيه شك يذهب إلى قائمة مراجعة ويربطه أو يرفضه شخص."
          ],
          [
            "عرض الصور",
            "عارض ويب من داخل الفحص مباشرة عبر رابط شخصي قصير الصلاحية. للمراجعة والعرض، لا للتشخيص الأولي."
          ],
          [
            "كتابة التقارير",
            "مسودة مع قوالب، إرسال، اعتماد من قارئ ثانٍ (يمكن إيقافه)، إعادة مع ذكر السبب، ملاحق. التقرير المعتمد لا يتغيّر."
          ],
          [
            "الختم و PDF/A",
            "كل تقرير معتمد يحصل على ختم تشفيري للنظام ويُصدَّر بصيغة PDF/A-2b للحفظ الطويل."
          ],
          [
            "الوثائق",
            "رفع الإحالات والموافقات والتقارير السابقة كملف PDF أو صورة. يُفحص كل ملف من البرمجيات الخبيثة قبل حفظه."
          ],
          [
            "الإدارة",
            "نظرة على حالة النظام والعمل المنتظر والوظائف المفعّلة. المستخدمون والأدوار وعامل التحقق الثاني في واجهة إدارة خاصة."
          ],
          [
            "المساعد الذكي (وحدة إضافية)",
            "يُفعَّل عند الرغبة ويُربط بخادم ذكاء اصطناعي داخل منشأتك مثل KM Code Craft AI: يترجم النصوص بين العربية والإنجليزية والألمانية، ويدقّق إملاء التقرير، ويقترح ترتيباً للعمل المنتظر. يقدّم اقتراحات فقط؛ لا يُعتمد شيء بدون إنسان."
          ]
        ]
      },
      {
        "kind": "gallery",
        "id": "einblick",
        "h": "هكذا يبدو العمل",
        "lead": "لقطات من الواجهة الحقيقية ببيانات تجريبية مختلقة.",
        "items": [
          [
            "/products/radiologie/ar-worklist.png",
            "قائمة العمل: الفحوص مع حالتها والخطوات المسموحة التالية"
          ],
          [
            "/products/radiologie/ar-schedule.png",
            "جدول المواعيد: الغرفة والبداية والمدة – الخادم يمنع الحجز المزدوج"
          ],
          [
            "/products/radiologie/ar-report.png",
            "كتابة التقرير: مسودة، قالب، إرسال للاعتماد"
          ],
          [
            "/products/radiologie/ar-admin.png",
            "الإدارة: الحالة، العمل المنتظر، الوظائف المفعّلة"
          ]
        ]
      },
      {
        "kind": "points",
        "id": "sicherheit",
        "h": "الأمان وإمكانية التتبّع",
        "lead": "بيانات المرضى لا تغادر منشأتك. ومن فعل ماذا يمكن إثباته.",
        "items": [
          "تشغيل كامل داخل المنشأة؛ لا يحتاج النظام إلى الإنترنت في العمل اليومي.",
          "دخول بعامل تحقق ثانٍ لكاتبي التقارير والمعتمدين والمسؤولين؛ ربط للقراءة فقط مع LDAP أو Active Directory.",
          "فصل الوصول حسب الموقع والقسم على مستوى قاعدة البيانات.",
          "سجل تدقيق مقاوم للتلاعب: كل تغيير وكل اطلاع على ملف يُحفظ في سلسلة مترابطة من المجاميع الاختبارية يمكن إعادة حسابها في أي وقت.",
          "التقارير المعتمدة وإصدارات الوثائق لا تتغيّر؛ التصحيح يكون بملحق أو بإصدار جديد.",
          "نسخ احتياطي مع استعادة إلى أي لحظة زمنية؛ الإجراء مُختبَر آلياً.",
          "اتصالات مشفّرة، ترويسات أمان، وتحديد لمعدّل الطلبات عبر الخادم الوسيط الأمامي.",
          "تُفحص الملفات المرفوعة من البرمجيات الخبيثة قبل الحفظ؛ وبدون ماسح متاح لا يُقبل شيء."
        ]
      },
      {
        "kind": "table",
        "id": "technik",
        "h": "التقنية",
        "lead": "مكوّنات مفتوحة مجرَّبة، مترابطة بعناية. لا رسوم ترخيص لأطراف أخرى على المكوّنات الأساسية.",
        "head": [
          "المجال",
          "التنفيذ"
        ],
        "rows": [
          [
            "مكان العمل",
            "تطبيق ويب للإصدارات الحديثة من Chrome و Edge؛ لا تثبيت على جهاز المستخدم"
          ],
          [
            "الخادم",
            "Linux مع Docker؛ كل الخدمات حاويات مُحصَّنة بلا صلاحيات الجذر"
          ],
          [
            "قاعدة البيانات",
            "PostgreSQL 17 مع فصل الوصول على مستوى الصف ونسخ احتياطي مستمر"
          ],
          [
            "أرشيف الصور",
            "Orthanc (DICOM C-STORE، DICOMweb، Modality Worklist)"
          ],
          [
            "العارض",
            "OHIF، مدمج عبر روابط دخول قصيرة الصلاحية"
          ],
          [
            "تسجيل الدخول",
            "Keycloak (OpenID Connect، TOTP)، واختيارياً LDAP / Active Directory"
          ],
          [
            "الواجهات",
            "DICOM، DICOMweb، واجهة REST مع وصف OpenAPI 3.1، مقاييس Prometheus"
          ],
          [
            "غير مشمول",
            "واجهات HL7/FHIR، الفوترة، الأشعة عن بُعد، التوقيع الشخصي المؤهَّل"
          ],
          [
            "خادم استرشادي",
            "لقسم صغير: 8 أنوية، 32 غيغابايت ذاكرة، قرص SSD لقاعدة البيانات، تخزين صور مرآوي بحسب حجم الدراسات، مزوّد طاقة احتياطي، وسيط نسخ احتياطي منفصل. التحديد الدقيق يتبع مسح الموقع."
          ]
        ]
      },
      {
        "kind": "table",
        "id": "nachweise",
        "h": "مُختبَر، لا مجرّد ادّعاء",
        "lead": "كل الفحوص تعمل آلياً ومدوَّنة في سجل المشروع. الأرقام من جهاز التطوير وليست وعداً لعتادك.",
        "head": [
          "الفحص",
          "النتيجة"
        ],
        "rows": [
          [
            "اختبارات آلية",
            "أكثر من 300 اختبار وحدة و60 اختباراً على قاعدة بيانات حقيقية مع كل تغيير"
          ],
          [
            "المسار الكامل في المتصفح",
            "دخول ← موعد ← فحص ← تقرير ← اعتماد القارئ الثاني، مع عامل تحقق ثانٍ، على خادم حقيقي"
          ],
          [
            "ربط الأجهزة",
            "الاستقبال وقائمة العمل على أرشيف DICOM حقيقي مع جهاز محاكى، وبأسماء عربية أيضاً"
          ],
          [
            "حمل متواصل 30 دقيقة",
            "276,205 طلباً بلا خطأ، زمن استجابة ثابت 11 ميلي ثانية (95%)، ذاكرة مستقرة"
          ],
          [
            "الاستعادة",
            "قاعدة بيانات 11 غيغابايت أُعيدت إلى لحظة محددة خلال 75 ثانية بعد فقدان كامل محاكى"
          ],
          [
            "تقرير PDF",
            "PDF/A-2b بخطوط مضمَّنة، بالعربية والألمانية"
          ]
        ]
      },
      {
        "kind": "steps",
        "id": "lieferung",
        "h": "من أول حديث إلى التشغيل اليومي",
        "lead": "نسلّم النظام كمنظومة جاهزة: عتاد، تثبيت، تدريب ومتابعة.",
        "items": [
          "عرض تجريبي وتحديد النطاق: أي وحدات، كم مكان عمل، أي أجهزة.",
          "مسح الموقع: قائمة الأجهزة، الشبكة، حاجة التخزين، مدد الحفظ، المستخدمون والأدوار.",
          "عرض سعر يشمل العتاد والتثبيت والمتابعة.",
          "التركيب والتثبيت مع فحص قبول موثَّق وربط كل جهاز.",
          "تدريب لكل دور بكتيّبات مصوّرة بالعربية والألمانية.",
          "تشغيل تجريبي مع قسمك، ثم موافقتك، وبعدها المتابعة والتحديثات."
        ]
      },
      {
        "kind": "points",
        "id": "umfang",
        "h": "ضمن التسليم",
        "items": [
          "البرنامج بكل الوحدات المذكورة أعلاه",
          "دليل التثبيت والتشغيل وإجراء التوقف",
          "كتيّبات تعليمية لكل دور (عربي، ألماني) وخطة تدريب",
          "وصف الواجهات (OpenAPI)",
          "نماذج لمسح الموقع والقبول والتسليم"
        ]
      },
      {
        "kind": "points",
        "id": "vor-ort",
        "h": "يُنجَز عندك",
        "items": [
          "الربط والاختبار مع أجهزتك",
          "فحص القبول على عتادك، مع قياس زمن الاستعادة",
          "اختبار أمني مستقل إذا طلبته",
          "توضيح المتطلبات القانونية في بلدك",
          "محتوى قوالب تقاريرك"
        ]
      },
      {
        "kind": "features",
        "id": "fragen",
        "h": "أسئلة متكررة",
        "items": [
          [
            "هل نحتاج إلى الإنترنت؟",
            "لا. النظام يعمل كاملاً داخل شبكتك. الإنترنت مطلوب فقط للدعم عن بُعد إذا رغبت به."
          ],
          [
            "هل يجوز التشخيص بالعارض؟",
            "العارض المدمج مخصص للمراجعة وغير معتمد للتشخيص الأولي. للتشخيص تُستخدم محطة تشخيص معتمدة، والأرشيف يزوّدها بالصور عبر DICOM."
          ],
          [
            "أي الأجهزة يمكن ربطها؟",
            "الأجهزة التي ترسل DICOM. ولقائمة العمل على الجهاز يجب أن يدعم الجهاز Modality Worklist وأن يكون مرخّصاً لها. نوضّح ذلك في مسح الموقع."
          ],
          [
            "هل النظام معتمد كجهاز طبي؟",
            "لا. الحاجة إلى اعتماد ونوعه يتبعان بلدك والغرض من الاستخدام. نوضّح ذلك معاً قبل أي تثبيت."
          ],
          [
            "كم يكلّف؟",
            "السعر يتبع العتاد وعدد الأجهزة ومستوى المتابعة. تحصل على عرض ثابت بعد مسح الموقع."
          ],
          [
            "لمن البيانات؟",
            "لك. تبقى على خادمك بصيغ مفتوحة (DICOM، PostgreSQL، PDF/A)."
          ]
        ]
      }
    ],
    "closing": {
      "h": "شاهده بنفسك.",
      "text": "نعرض لك النظام ببيانات تجريبية ونناقش ما يحتاجه قسمك."
    }
  }
};

export const RADIOLOGIE_TEASER: Record<Locale, [string, string]> = {
  "de": [
    "KM Code Craft Radiology",
    "RIS, Bildarchiv und Befundung im eigenen Haus – auf Arabisch."
  ],
  "en": [
    "KM Code Craft Radiology",
    "RIS, image archive and reporting on your premises – in Arabic."
  ],
  "ar": [
    "KM Code Craft Radiology",
    "نظام الأشعة والأرشيف والتقارير داخل منشأتك – بالعربية."
  ]
};
