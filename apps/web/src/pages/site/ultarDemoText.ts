// Interaktive Ultar-OS-Demo: statische Seite unter /products/ultar-os/demo/ (Quelle: Repo ultar-os, Entwurf „Ultar Noir“).
// Öffnet sich als eigene Seite (die Webseite erlaubt keine Einbettung in Rahmen).
import type { Locale } from "../../i18n";

export const DEMO_URL = (l: Locale) => `/products/ultar-os/demo/index.html?lang=${l}`;
export const DEMO_POSTER = (l: Locale) => `/products/ultar-os/demo/poster-${l}.webp`;

export const ULTAR_DEMO: Record<Locale, { eyebrow: string; h2: string; text: string; points: string[]; start: string; more: string; note: string; alt: string }> = {
  de: {
    eyebrow: "Ultar OS · Live-Demo",
    h2: "Unser Betriebssystem – direkt im Browser ausprobieren.",
    text: "Entsperren, Apps öffnen, Einstellungen ändern, mit dem Helfer sprechen und im Desktop-Modus Fenster verschieben – auf Arabisch, Deutsch oder Englisch.",
    points: ["Über 20 Apps und alle Einstellungen bedienbar", "KM-Helfer versteht Befehle und prüft Links", "Handy- und Desktop-Modus", "Beispieldaten, nichts verlässt Ihren Browser"],
    start: "Demo starten", more: "Mehr zu Ultar OS", note: "Demo-PIN: 1234", alt: "Ultar OS: Startbildschirm und Mobilfunk-Einstellungen",
  },
  en: {
    eyebrow: "Ultar OS · live demo",
    h2: "Our operating system – try it right in your browser.",
    text: "Unlock, open apps, change settings, talk to the helper and move windows in desktop mode – in Arabic, German or English.",
    points: ["20+ apps and every setting work", "The KM helper understands commands and checks links", "Phone and desktop mode", "Sample data, nothing leaves your browser"],
    start: "Start the demo", more: "More about Ultar OS", note: "Demo PIN: 1234", alt: "Ultar OS: home screen and mobile settings",
  },
  ar: {
    eyebrow: "Ultar OS · عرض حيّ",
    h2: "نظام التشغيل الخاص بنا – جرّبه مباشرة في المتصفح.",
    text: "افتح القفل، شغّل التطبيقات، غيّر الإعدادات، تحدّث مع المساعد وحرّك النوافذ في وضع سطح المكتب – بالعربية أو الألمانية أو الإنجليزية.",
    points: ["أكثر من 20 تطبيقاً وكل الإعدادات قابلة للاستخدام", "مساعد KM يفهم الأوامر ويفحص الروابط", "وضع الهاتف ووضع سطح المكتب", "بيانات تجريبية، لا شيء يغادر متصفحك"],
    start: "ابدأ العرض", more: "المزيد عن Ultar OS", note: "رمز العرض: 1234", alt: "Ultar OS: الشاشة الرئيسية وإعدادات الشبكة الخلوية",
  },
};
