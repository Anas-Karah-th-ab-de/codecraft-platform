// Startseite: „Eigene Produkte“ – alle eigenen Systeme auf einen Blick (DE/EN/AR).
import type { Locale } from "../../i18n";

export type Show = { key: string; name: string; line: string; state: string; to: string; img?: string; big?: boolean };
type T = { h2: string; text: string; all: string; items: Show[] };

const ONE = "/products/km-one/km-one-front.webp";
const ULTAR = "/products/ultar-os/uebersicht.png";

export const SHOWCASE: Record<Locale, T> = {
  de: {
    h2: "Eigene Produkte, nicht nur Aufträge.",
    text: "Neben Projekten für Kunden entwickeln wir unsere eigenen Systeme: vom Handy über das Betriebssystem bis zur Kasse und zum Bildarchiv der Klinik.",
    all: "Alle Produkte und Preise",
    items: [
      { key: "km-one", name: "KM One", line: "Robustes Handy mit LoRa, Satelliten-SOS und lokaler KI", state: "In Entwicklung", to: "/km-one", img: ONE, big: true },
      { key: "ultar-os", name: "Ultar OS", line: "Eigenes Betriebssystem in Rust für Handy und Tablet, bald auch Desktop", state: "Demo im Browser", to: "/ultar-os", img: ULTAR, big: true },
      { key: "kasse", name: "POS Code Craft v3", line: "Kasse, Lager und Warenwirtschaft, läuft auch offline", state: "Version 3.0", to: "/kasse" },
      { key: "ki-server", name: "KI-Server", line: "Eigene KI im Haus, ohne Cloud, zur Miete", state: "Zur Miete", to: "/ki-server" },
      { key: "radiologie", name: "KM Radiology", line: "RIS, Bildarchiv (PACS) und Befundung im eigenen Haus", state: "Demo online", to: "/e-health" },
      { key: "karten", name: "Maps Syria", line: "Karten, Routen und Orte für Syrien", state: "Online", to: "/karten" },
    ],
  },
  en: {
    h2: "Our own products, not just contracts.",
    text: "Alongside client projects we build our own systems: from the phone and its operating system to the till and the clinic image archive.",
    all: "All products and prices",
    items: [
      { key: "km-one", name: "KM One", line: "Rugged phone with LoRa, satellite SOS and on-device AI", state: "In development", to: "/km-one", img: ONE, big: true },
      { key: "ultar-os", name: "Ultar OS", line: "Our own operating system in Rust for phone and tablet, desktop coming soon", state: "Try it in the browser", to: "/ultar-os", img: ULTAR, big: true },
      { key: "kasse", name: "POS Code Craft v3", line: "Till, stock and inventory, keeps working offline", state: "Version 3.0", to: "/kasse" },
      { key: "ki-server", name: "AI server", line: "Your own AI in-house, no cloud, for rent", state: "For rent", to: "/ki-server" },
      { key: "radiologie", name: "KM Radiology", line: "RIS, image archive (PACS) and reporting on your own servers", state: "Demo online", to: "/e-health" },
      { key: "karten", name: "Maps Syria", line: "Maps, routes and places for Syria", state: "Online", to: "/karten" },
    ],
  },
  ar: {
    h2: "منتجاتنا الخاصة، لا مجرد مشاريع.",
    text: "إلى جانب مشاريع العملاء نطوّر أنظمتنا الخاصة: من الهاتف ونظام تشغيله إلى نقطة البيع وأرشيف الصور الطبية.",
    all: "كل المنتجات والأسعار",
    items: [
      { key: "km-one", name: "KM One", line: "هاتف متين مع LoRa وطوارئ عبر الأقمار الصناعية وذكاء اصطناعي محلي", state: "قيد التطوير", to: "/km-one", img: ONE, big: true },
      { key: "ultar-os", name: "Ultar OS", line: "نظام تشغيل خاص بلغة Rust للهاتف واللوحي، وقريباً للحاسوب", state: "جرّبه في المتصفح", to: "/ultar-os", img: ULTAR, big: true },
      { key: "kasse", name: "POS Code Craft v3", line: "نقطة بيع ومخزون وإدارة بضائع، تعمل دون إنترنت", state: "الإصدار 3.0", to: "/kasse" },
      { key: "ki-server", name: "خادم الذكاء الاصطناعي", line: "ذكاء اصطناعي داخل منشأتك، دون سحابة، بالإيجار", state: "للإيجار", to: "/ki-server" },
      { key: "radiologie", name: "KM Radiology", line: "نظام الأشعة وأرشيف الصور (PACS) والتقارير على خوادمك", state: "عرض تجريبي", to: "/e-health" },
      { key: "karten", name: "Maps Syria", line: "خرائط وطرق وأماكن في سوريا", state: "متاح", to: "/karten" },
    ],
  },
};

/** Bild der Kachel; den Radiologie-Bildschirm gibt es pro Sprache */
export const showImg = (s: Show, l: Locale) => (s.key === "radiologie" ? `/products/radiologie/${l}-viewer.png` : s.img);

/** Ersatzbilder für Katalog-Produkte ohne eigenes Bild (nach Slug) */
export const CATALOG_IMG: Record<string, string> = {
  "ultar-os": ULTAR,
  "km-code-craft-radiology": "/products/radiologie/de-viewer.png",
};
