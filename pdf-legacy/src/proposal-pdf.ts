/**
 * Cost Proposal PDF Generator
 *
 * Erzeugt professionelle Kostenvoranschlag-PDFs (A4) aus CostProposal-Daten.
 * Unterstützt:
 *  – Block-Gruppierung (Block 1–N mit Summenzeilen)
 *  – Optionales Markdown-Notizen-Feld (freetext)
 *  – Meilensteine als Tabelle
 *  – Zahlungsplan
 *  – Reverse-Charge-Hinweis
 *  – Logo + Firmenbranding aus InvoiceTemplate
 *  – Mehrsprachig: de / en / ar (inkl. Amiri und RTL)
 */

import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProposalPdfCompany {
  companyName: string;
  contactName?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  email?: string;
  website?: string;
  phone?: string;
  taxId?: string;
  logoBase64?: string | null;
  primaryColor?: string;
  accentColor?: string;
}

export interface ProposalPdfItem {
  blockNr?: number | null;
  blockTitle?: string | null;
  positionNr?: string | null;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
}

export interface ProposalPdfMilestone {
  milestoneNr: string;
  title: string;
  blocks?: string | null;
  goal?: string | null;
}

export interface ProposalPdfPayment {
  dueLabel: string;
  amount: number;
  currency: string;
  description?: string | null;
}

export interface ProposalPdfData {
  proposalNr: string;
  title: string;
  description?: string | null;
  revision?: string | null;
  projectStart?: Date | string | null;
  projectEnd?: Date | string | null;

  // Stunden & Sätze
  hourlyRate?: number | null;
  discountedHourlyRate?: number | null;
  totalHours?: number | null;

  // Beträge
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  currency: string;

  // Steuer
  reverseCharge?: boolean;
  reverseChargeNote?: string | null;

  // Vorauszahlung
  advancePaymentPercent?: number | null;

  // Rabatt
  discountAmount?: number | null;
  discountDescription?: string | null;

  // Ablauf
  status: string;
  validUntil?: Date | string | null;
  issuedAt?: Date | string;

  // Kunde
  customerName: string;
  customerAddress?: {
    companyName?: string;
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
  } | null;

  // Inhalte
  items: ProposalPdfItem[];
  milestones?: ProposalPdfMilestone[];
  paymentSchedule?: ProposalPdfPayment[];

  // Freier Markdown-Notiz-Text (wird als formatierter Fließtext eingefügt)
  notes?: string | null;
}

// ─── Labels ─────────────────────────────────────────────────────────────────

type SupportedLocale = "de" | "en" | "ar";
type FontStyle = "normal" | "bold" | "italic";

const LABELS: Record<string, Record<SupportedLocale, string>> = {
  title:           { de: "Kostenvoranschlag", en: "Cost Proposal", ar: "عرض فني ومالي" },
  proposalNr:      { de: "Angebotsnummer", en: "Proposal Number", ar: "رقم العرض" },
  date:            { de: "Datum", en: "Date", ar: "تاريخ العرض" },
  validUntil:      { de: "Gültig bis", en: "Valid Until", ar: "صالح لغاية" },
  revision:        { de: "Revision", en: "Revision", ar: "الإصدار" },
  projectStart:    { de: "Projektstart", en: "Project Start", ar: "بدء المشروع" },
  projectEnd:      { de: "Projektende", en: "Project End", ar: "نهاية المشروع" },
  hourlyRate:      { de: "Normalstundensatz", en: "Standard Hourly Rate", ar: "سعر الساعة القياسي" },
  discountedRate:  { de: "Aktionsstundensatz", en: "Discounted Rate", ar: "سعر الساعة الخاص" },
  totalHours:      { de: "Gesamtstunden", en: "Total Hours", ar: "إجمالي الساعات" },
  proposalTo:      { de: "Angebot an:", en: "Proposal to:", ar: "مقدم إلى:" },
  from:            { de: "Von:", en: "From:", ar: "مقدم من:" },
  pos:             { de: "Pos.", en: "No.", ar: "البند" },
  description:     { de: "Leistungsbeschreibung", en: "Description", ar: "وصف الخدمة" },
  quantity:        { de: "Menge / Einheit", en: "Qty / Unit", ar: "الكمية / الوحدة" },
  hours:           { de: "Std.", en: "Hrs", ar: "الساعات" },
  hoursUnit:       { de: "Std.", en: "hrs", ar: "ساعة" },
  unitPrice:       { de: "Einzelpreis", en: "Unit Price", ar: "سعر الوحدة" },
  hourlyUnitPrice: { de: "Stundensatz", en: "Rate/h", ar: "سعر الساعة" },
  total:           { de: "Gesamt", en: "Total", ar: "الإجمالي" },
  services:        { de: "Leistungsübersicht", en: "Scope of Services", ar: "نطاق الخدمات والتكاليف" },
  block:           { de: "Block", en: "Block", ar: "الفئة" },
  blockSum:        { de: "Summe", en: "Subtotal", ar: "مجموع الفئة" },
  subtotal:        { de: "Zwischensumme", en: "Subtotal", ar: "المجموع الفرعي" },
  discount:        { de: "Abzug (bereits implementiert)", en: "Deduction (already implemented)", ar: "الخصم" },
  tax:             { de: "MwSt.", en: "Tax", ar: "الضريبة" },
  reverseChargeShort: { de: "Reverse Charge", en: "Reverse Charge", ar: "الاحتساب العكسي" },
  totalAmount:     { de: "Rechnungsbetrag", en: "Total Amount", ar: "المبلغ الإجمالي" },
  reverseCharge:   { de: "Steuerhinweis (Reverse Charge)", en: "Tax Note (Reverse Charge)", ar: "ملاحظة ضريبية (الاحتساب العكسي)" },
  milestones:      { de: "Meilensteine & Reihenfolge", en: "Milestones & Schedule", ar: "مراحل التنفيذ والتسليم" },
  milestone:       { de: "Meilenstein", en: "Milestone", ar: "المرحلة" },
  blocks:          { de: "Blöcke", en: "Blocks", ar: "المرجع" },
  goal:            { de: "Ziel", en: "Goal", ar: "الأنشطة والمخرجات" },
  payment:         { de: "Zahlungsplan", en: "Payment Schedule", ar: "جدول الدفع" },
  dueDate:         { de: "Fälligkeit", en: "Due Date", ar: "الدفعة والاستحقاق" },
  amount:          { de: "Betrag (netto)", en: "Amount (net)", ar: "المبلغ الصافي" },
  notes:           { de: "Zusatzhinweise & Vorbehalte", en: "Additional Notes", ar: "ملاحظات وشروط إضافية" },
  acceptance:      { de: "Annahme & Verbindlichkeit", en: "Acceptance & Binding Agreement", ar: "قبول العرض وسريانه" },
  acceptanceText:  {
    de: "Dieser Kostenvoranschlag wird durch Überweisung der Vorauszahlung verbindlich angenommen.",
    en: "This proposal is bindingly accepted upon receipt of the advance payment.",
    ar: "يصبح هذا العرض مقبولًا وملزمًا عند استلام الدفعة المقدمة، وتُستكمل التفاصيل التعاقدية بين الطرفين.",
  },
  reverseChargeDefault: {
    de: "Netto-Rechnung ohne MwSt. Reverse-Charge-Verfahren gem. Art. 196 MwStSystRL – Steuerschuld beim Auftraggeber.",
    en: "Net invoice without VAT. Reverse Charge pursuant to Art. 196 VAT Directive – tax liability transfers to the recipient.",
    ar: "فاتورة صافية دون ضريبة قيمة مضافة؛ تنتقل المسؤولية الضريبية إلى متلقي الخدمة وفق آلية الاحتساب العكسي.",
  },
  projectPeriod: { de: "Projektlaufzeit", en: "Project Period", ar: "مدة المشروع" },
  to:            { de: "–", en: "–", ar: "–" },
  footerNet: {
    de: "Nettobeträge; lokale Steuern, falls anwendbar, zusätzlich",
    en: "Net amounts; local taxes, if applicable, are additional",
    ar: "المبالغ صافية؛ تضاف الضرائب المحلية إن وجدت",
  },
  pageOf: { de: "Seite {p} von {n}", en: "Page {p} of {n}", ar: "صفحة {p} من {n}" },
};

function normalizeLocale(locale: string): SupportedLocale {
  const language = locale.toLowerCase().split("-")[0];
  return language === "en" || language === "ar" ? language : "de";
}

function L(key: string, locale: string): string {
  const language = normalizeLocale(locale);
  return LABELS[key]?.[language] ?? LABELS[key]?.de ?? key;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex ?? "#1e3a5f").replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) || 30,
    parseInt(h.substring(2, 4), 16) || 58,
    parseInt(h.substring(4, 6), 16) || 95,
  ];
}

/** Removes bidi controls and always returns Western digits (0–9). */
function toWesternDigits(value: string): string {
  return value
    .replace(/[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function processText(value: string): string {
  return toWesternDigits(value ?? "").replace(/\uFEFF/g, "");
}

function fmtDate(d: Date | string | null | undefined, locale: string): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const language = normalizeLocale(locale);
  const formatted = date.toLocaleDateString(language === "ar" ? "ar-EG-u-nu-latn" : language === "en" ? "en-GB" : "de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  return toWesternDigits(formatted);
}

function fmtCurrency(amount: number, currency: string, locale: string): string {
  const language = normalizeLocale(locale);
  if (language === "ar") {
    const amountText = new Intl.NumberFormat("ar-EG-u-nu-latn", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${toWesternDigits(amountText)} ${currency}`;
  }
  const formatted = new Intl.NumberFormat(
    language === "en" ? "en-US" : "de-DE",
    { style: "currency", currency, minimumFractionDigits: 2 },
  ).format(amount);
  return toWesternDigits(formatted);
}

function fmtNumber(value: number, locale: string): string {
  const language = normalizeLocale(locale);
  const formatted = new Intl.NumberFormat(
    language === "ar" ? "ar-EG-u-nu-latn" : language === "en" ? "en-US" : "de-DE",
    { maximumFractionDigits: 2 },
  ).format(value);
  return toWesternDigits(formatted);
}

function fmtHours(hours: number, locale: string): string {
  return `${fmtNumber(hours, locale)} ${L("hoursUnit", locale)}`;
}

function fmtQuantity(quantity: number, unit: string | undefined, locale: string): string {
  return [fmtNumber(quantity, locale), processText(unit ?? "")].filter(Boolean).join(" ");
}

function fmtCountry(country: string | undefined, locale: string): string | undefined {
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return country;
  try {
    const language = normalizeLocale(locale);
    return new Intl.DisplayNames(
      [language === "ar" ? "ar" : language === "en" ? "en" : "de"],
      { type: "region" },
    ).of(country.toUpperCase()) ?? country;
  } catch {
    return country;
  }
}

// ─── Arabic font loading ────────────────────────────────────────────────────

let amiriFontsLoaded = false;
let amiriRegularBase64: string | null = null;
let amiriBoldBase64: string | null = null;
const amiriDocuments = new WeakSet<jsPDF>();

function loadAmiriFonts(): void {
  if (amiriFontsLoaded) return;
  const basePaths = [
    path.join(process.cwd(), "src", "assets", "fonts"),
    path.join(process.cwd(), ".next", "server", "src", "assets", "fonts"),
  ];

  for (const basePath of basePaths) {
    const regularPath = path.join(basePath, "Amiri-Regular.ttf");
    const boldPath = path.join(basePath, "Amiri-Bold.ttf");
    if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) continue;
    amiriRegularBase64 = fs.readFileSync(regularPath).toString("base64");
    amiriBoldBase64 = fs.readFileSync(boldPath).toString("base64");
    amiriFontsLoaded = true;
    return;
  }

  console.warn("Amiri fonts not found — Arabic proposal text may not render correctly");
}

function registerAmiriFonts(doc: jsPDF): void {
  if (!amiriRegularBase64 || !amiriBoldBase64) return;
  doc.addFileToVFS("Amiri-Regular.ttf", amiriRegularBase64);
  doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  doc.addFileToVFS("Amiri-Bold.ttf", amiriBoldBase64);
  doc.addFont("Amiri-Bold.ttf", "Amiri", "bold");
  amiriDocuments.add(doc);
}

/** Lädt und registriert Amiri für ein beliebiges jsPDF-Dokument (für andere PDF-Generatoren). */
export function prepareArabicFonts(doc: jsPDF): boolean {
  loadAmiriFonts();
  registerAmiriFonts(doc);
  return amiriFontsLoaded;
}

function setPdfFont(doc: jsPDF, locale: string, style: FontStyle): void {
  if ((normalizeLocale(locale) === "ar" || amiriDocuments.has(doc)) && amiriFontsLoaded) {
    doc.setFont("Amiri", style === "italic" ? "normal" : style);
    return;
  }
  doc.setFont("helvetica", style);
}

function drawText(
  doc: jsPDF,
  value: string | string[],
  x: number,
  y: number,
  locale: string,
  options?: { align?: "left" | "right" | "center" },
): void {
  const processed = Array.isArray(value) ? value.map(processText) : processText(value);
  const bidiOptions = normalizeLocale(locale) === "ar"
    ? {
        // Input strings are stored in logical reading order. PDF content streams
        // need visual glyph order; LTR runs (USD, DICOM, numbers, URLs) must stay
        // intact inside the surrounding RTL sentence.
        isInputVisual: false,
        isInputRtl: true,
        isOutputVisual: true,
        isOutputRtl: false,
        isSymmetricSwapping: true,
      }
    : {};
  doc.text(processed, x, y, { ...options, ...bidiOptions });
}

function splitText(doc: jsPDF, value: string, maxWidth: number): string[] {
  return doc.splitTextToSize(processText(value), maxWidth);
}

// ─── Logo loading ─────────────────────────────────────────────────────────────

function loadLogoBase64(): string | null {
  try {
    const p = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(p)) return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  } catch { /* ignore */ }
  return null;
}

// Lädt ein Bild aus `public/` für Markdown-Bilder in den Notizen (nur PNG/JPEG, kein Path-Traversal).
function loadPublicImage(src: string): { dataUrl: string; format: "PNG" | "JPEG" } | null {
  if (!src.startsWith("/") || src.includes("..")) return null;
  const ext = path.extname(src).toLowerCase();
  const format = ext === ".png" ? "PNG" : ext === ".jpg" || ext === ".jpeg" ? "JPEG" : null;
  if (!format) return null;
  try {
    const publicDir = path.join(process.cwd(), "public");
    const resolved = path.resolve(publicDir, `.${src}`);
    if (!resolved.startsWith(publicDir + path.sep) || !fs.existsSync(resolved)) return null;
    const mime = format === "PNG" ? "image/png" : "image/jpeg";
    return { dataUrl: `data:${mime};base64,${fs.readFileSync(resolved).toString("base64")}`, format };
  } catch {
    return null;
  }
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 18;
const MR = 18;
const MT = 22;
const MB = 22;
const CW = PAGE_W - ML - MR; // 174

function newPage(doc: jsPDF): number {
  doc.addPage();
  return MT;
}

function checkPage(doc: jsPDF, y: number, needed: number = 10): number {
  if (y + needed > PAGE_H - MB) return newPage(doc);
  return y;
}

// ─── Section Header ──────────────────────────────────────────────────────────

function sectionHeader(
  doc: jsPDF,
  text: string,
  y: number,
  primary: [number, number, number],
  accent: [number, number, number],
  locale: string,
  keepWith: number = 0,
): number {
  // keepWith: Mindesthöhe des folgenden Inhalts, damit die Überschrift nicht allein am Seitenende steht
  y = checkPage(doc, y, 12 + keepWith);
  doc.setFillColor(...accent);
  doc.roundedRect(ML, y, CW, 7, 1, 1, "F");
  doc.setFontSize(9);
  setPdfFont(doc, locale, "bold");
  doc.setTextColor(255, 255, 255);
  const rtl = normalizeLocale(locale) === "ar";
  drawText(doc, rtl ? text : text.toUpperCase(), rtl ? PAGE_W - MR - 3 : ML + 3, y + 4.8, locale, {
    align: rtl ? "right" : "left",
  });
  return y + 11;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export function generateProposalPdf(
  company: ProposalPdfCompany,
  proposal: ProposalPdfData,
  locale: string = "de",
): Buffer {
  locale = normalizeLocale(locale);
  const rtl = locale === "ar";
  const isHourlyProposal = proposal.hourlyRate != null
    || proposal.discountedHourlyRate != null
    || proposal.totalHours != null;
  const containsArabicContent = /[\u0600-\u06FF]/.test(JSON.stringify(proposal));

  if (rtl || containsArabicContent) loadAmiriFonts();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  if (rtl || containsArabicContent) registerAmiriFonts(doc);

  const primary = hexToRgb(company.primaryColor ?? "#1e3a5f");
  const accent  = hexToRgb(company.accentColor  ?? "#e67e22");
  const gray: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [240, 240, 240];
  const logoBase64 = company.logoBase64 ?? loadLogoBase64();

  let y = MT;

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════════════════════

  // Logo oben links
  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", ML, y - 5, 28, 11.6); } catch { /* ignore */ }
    y += 8;
  }

  // Titel oben rechts
  doc.setFontSize(22);
  setPdfFont(doc, locale, "bold");
  doc.setTextColor(...accent);
  drawText(doc, L("title", locale), PAGE_W - MR, y - (logoBase64 ? 3 : 0), locale, { align: "right" });

  if (proposal.revision) {
    doc.setFontSize(8);
    setPdfFont(doc, locale, "normal");
    doc.setTextColor(...gray);
    drawText(doc, proposal.revision, PAGE_W - MR, y + 5, locale, { align: "right" });
  }

  y += 14;

  // Trennlinie
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.6);
  doc.line(ML, y, PAGE_W - MR, y);
  const metaStartY = y + 8;
  y += 8;

  // ── Zwei-Spalten: Kunde/Absender | Meta (bei Arabisch gespiegelt) ───────

  const partyX = rtl ? PAGE_W - MR : ML;
  const partyAlign = rtl ? "right" as const : "left" as const;
  const partyWidth = 82;

  doc.setFontSize(7.5);
  setPdfFont(doc, locale, "normal");
  doc.setTextColor(...gray);
  drawText(doc, L("proposalTo", locale), partyX, y, locale, { align: partyAlign });
  y += 5;

  doc.setFontSize(11);
  setPdfFont(doc, locale, "bold");
  doc.setTextColor(...primary);
  const customerLines = splitText(doc, proposal.customerName, partyWidth);
  drawText(doc, customerLines, partyX, y, locale, { align: partyAlign });
  y += customerLines.length * 5 + 1;

  const addr = proposal.customerAddress;
  doc.setFontSize(8.5);
  setPdfFont(doc, locale, "normal");
  doc.setTextColor(60, 60, 60);
  if (addr) {
    const addrLines = [
      addr.street,
      [addr.zip, addr.city].filter(Boolean).join(" "),
      fmtCountry(addr.country, locale),
    ].filter(Boolean) as string[];
    for (const line of addrLines) {
      const lines = splitText(doc, line, partyWidth);
      drawText(doc, lines, partyX, y, locale, { align: partyAlign });
      y += lines.length * 4.2;
    }
  }

  // Absender
  y += 4;
  doc.setFontSize(7.5);
  setPdfFont(doc, locale, "normal");
  doc.setTextColor(...gray);
  drawText(doc, L("from", locale), partyX, y, locale, { align: partyAlign });
  y += 4;

  doc.setFontSize(8.5);
  setPdfFont(doc, locale, "bold");
  doc.setTextColor(...primary);
  drawText(doc, company.companyName, partyX, y, locale, { align: partyAlign });
  y += 4.5;

  setPdfFont(doc, locale, "normal");
  doc.setTextColor(60, 60, 60);
  const senderLines = [
    company.contactName,
    company.addressLine1,
    [company.postalCode, company.city].filter(Boolean).join(" "),
    company.email,
    company.website,
  ].filter(Boolean) as string[];
  for (const line of senderLines) {
    const lines = splitText(doc, line, partyWidth);
    drawText(doc, lines, partyX, y, locale, { align: partyAlign });
    y += lines.length * 3.8;
  }

  // Meta-Tabelle auf der gegenüberliegenden Seite (unterhalb der Trennlinie)
  const metaRows: [string, string][] = [
    [L("proposalNr", locale), proposal.proposalNr],
    [L("date", locale), fmtDate(proposal.issuedAt ?? new Date(), locale)],
  ];
  if (proposal.validUntil) metaRows.push([L("validUntil", locale), fmtDate(proposal.validUntil, locale)]);
  if (proposal.projectStart && proposal.projectEnd) {
    metaRows.push([
      L("projectPeriod", locale),
      `${fmtDate(proposal.projectStart, locale)} ${L("to", locale)} ${fmtDate(proposal.projectEnd, locale)}`,
    ]);
  }
  if (proposal.hourlyRate != null) {
    metaRows.push([L("hourlyRate", locale), `${fmtCurrency(proposal.hourlyRate, proposal.currency, locale)} / ${L("hoursUnit", locale)}`]);
  }
  if (proposal.discountedHourlyRate != null) {
    metaRows.push([L("discountedRate", locale), `${fmtCurrency(proposal.discountedHourlyRate, proposal.currency, locale)} / ${L("hoursUnit", locale)}`]);
  }
  if (proposal.totalHours != null) {
    metaRows.push([L("totalHours", locale), fmtHours(proposal.totalHours, locale)]);
  }

  const metaBoxW = 74;
  const metaBoxX = rtl ? ML : PAGE_W - MR - metaBoxW;
  const metaTextX = rtl ? metaBoxX + metaBoxW - 3 : metaBoxX + 3;
  const metaAlign = rtl ? "right" as const : "left" as const;
  setPdfFont(doc, locale, "bold");
  doc.setFontSize(8.5);
  const wrappedMetaRows = metaRows.map(([label, value]) => ({
    label,
    valueLines: splitText(doc, value, metaBoxW - 6),
  }));
  const metaBoxH = 6 + wrappedMetaRows.reduce((height, row) => height + 5.8 + row.valueLines.length * 3.8, 0);
  doc.setFillColor(...lightGray);
  doc.roundedRect(metaBoxX, metaStartY - 4, metaBoxW, metaBoxH, 2, 2, "F");

  let metaY = metaStartY;
  for (const row of wrappedMetaRows) {
    doc.setFontSize(7.5);
    setPdfFont(doc, locale, "normal");
    doc.setTextColor(...gray);
    drawText(doc, row.label, metaTextX, metaY, locale, { align: metaAlign });
    metaY += 3.8;
    doc.setFontSize(8.5);
    setPdfFont(doc, locale, "bold");
    doc.setTextColor(...primary);
    drawText(doc, row.valueLines, metaTextX, metaY, locale, { align: metaAlign });
    metaY += row.valueLines.length * 3.8 + 2;
  }

  y = Math.max(y, metaStartY - 4 + metaBoxH) + 10;

  // ── Projekttitel ───────────────────────────────────────────────────────

  doc.setFontSize(12);
  setPdfFont(doc, locale, "bold");
  doc.setTextColor(...primary);
  const titleLines = splitText(doc, proposal.title, CW);
  drawText(doc, titleLines, rtl ? PAGE_W - MR : ML, y, locale, { align: partyAlign });
  y += titleLines.length * 5.5 + 3;

  if (proposal.description) {
    doc.setFontSize(8.5);
    setPdfFont(doc, locale, "normal");
    doc.setTextColor(60, 60, 60);
    const descLines = splitText(doc, proposal.description, CW);
    drawText(doc, descLines, rtl ? PAGE_W - MR : ML, y, locale, { align: partyAlign });
    y += descLines.length * 4 + 5;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEISTUNGSÜBERSICHT (Positionen nach Blöcken)
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionHeader(doc, L("services", locale), y, primary, accent, locale, 24);

  // Tabellen-Header: bei Arabisch läuft die logische Reihenfolge von rechts.
  const COL = rtl
    ? {
        total: { x: ML,       w: 27 },
        rate:  { x: ML + 27,  w: 27 },
        qty:   { x: ML + 54,  w: 28 },
        desc:  { x: ML + 82,  w: 78 },
        pos:   { x: ML + 160, w: 14 },
      }
    : {
        pos:   { x: ML,       w: 14 },
        desc:  { x: ML + 14,  w: 78 },
        qty:   { x: ML + 92,  w: 28 },
        rate:  { x: ML + 120, w: 27 },
        total: { x: ML + 147, w: 27 },
      };

  const textX = (column: { x: number; w: number }) => rtl ? column.x + column.w - 1 : column.x + 1;
  const textAlign = rtl ? "right" as const : "left" as const;
  const numericX = (column: { x: number; w: number }) => column.x + column.w - 1;

  function drawTableHeader(yy: number): number {
    yy = checkPage(doc, yy, 8);
    doc.setFillColor(...primary);
    doc.rect(ML, yy, CW, 7, "F");
    doc.setFontSize(7.5);
    setPdfFont(doc, locale, "bold");
    doc.setTextColor(255, 255, 255);
    drawText(doc, L("pos", locale), textX(COL.pos), yy + 4.7, locale, { align: textAlign });
    drawText(doc, L("description", locale), textX(COL.desc), yy + 4.7, locale, { align: textAlign });
    drawText(doc, L(isHourlyProposal ? "hours" : "quantity", locale), numericX(COL.qty), yy + 4.7, locale, { align: "right" });
    drawText(doc, L(isHourlyProposal ? "hourlyUnitPrice" : "unitPrice", locale), numericX(COL.rate), yy + 4.7, locale, { align: "right" });
    drawText(doc, L("total", locale), numericX(COL.total), yy + 4.7, locale, { align: "right" });
    return yy + 9;
  }

  y = drawTableHeader(y);

  // Positionen nach Blöcken gruppieren
  type GroupedBlock = { blockNr: number; blockTitle: string; items: ProposalPdfItem[] };
  const grouped: GroupedBlock[] = [];
  const ungrouped: ProposalPdfItem[] = [];

  for (const item of proposal.items) {
    if (item.blockNr != null) {
      let grp = grouped.find((g) => g.blockNr === item.blockNr);
      if (!grp) {
        grp = { blockNr: item.blockNr, blockTitle: item.blockTitle ?? `${L("block", locale)} ${item.blockNr}`, items: [] };
        grouped.push(grp);
      }
      grp.items.push(item);
    } else {
      ungrouped.push(item);
    }
  }
  grouped.sort((a, b) => a.blockNr - b.blockNr);

  let rowIdx = 0;
  let totalHoursSum = 0;

  function drawItemRow(item: ProposalPdfItem, idx: number, yy: number): number {
    setPdfFont(doc, locale, "normal");
    doc.setFontSize(7.5);
    const descLines = splitText(doc, item.description, COL.desc.w - 2);
    const quantityText = isHourlyProposal
      ? fmtHours(item.quantity, locale)
      : fmtQuantity(item.quantity, item.unit, locale);
    const quantityLines = splitText(doc, quantityText, COL.qty.w - 2);
    const rowH = Math.max(6, descLines.length * 4.2 + 2, quantityLines.length * 4.2 + 2);
    if (yy + rowH + 2 > PAGE_H - MB) {
      yy = drawTableHeader(newPage(doc));
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 248, 250);
      doc.rect(ML, yy - 1, CW, rowH + 1, "F");
    }

    doc.setFontSize(7.5);
    setPdfFont(doc, locale, "bold");
    doc.setTextColor(...primary);
    drawText(doc, item.positionNr ?? String(idx + 1), textX(COL.pos), yy + 3.8, locale, { align: textAlign });

    setPdfFont(doc, locale, "normal");
    doc.setTextColor(40, 40, 40);
    drawText(doc, descLines, textX(COL.desc), yy + 3.8, locale, { align: textAlign });

    setPdfFont(doc, locale, "normal");
    doc.setTextColor(60, 60, 60);
    drawText(doc, quantityLines, numericX(COL.qty), yy + 3.8, locale, { align: "right" });
    drawText(doc, fmtCurrency(item.unitPrice, proposal.currency, locale), numericX(COL.rate), yy + 3.8, locale, { align: "right" });
    setPdfFont(doc, locale, "bold");
    drawText(doc, fmtCurrency(item.totalPrice, proposal.currency, locale), numericX(COL.total), yy + 3.8, locale, { align: "right" });

    if (isHourlyProposal) totalHoursSum += item.quantity;
    return yy + rowH + 1;
  }

  function drawBlockHeader(blockNr: number, blockTitle: string, yy: number): number {
    doc.setFontSize(8);
    setPdfFont(doc, locale, "bold");
    const blockLines = splitText(doc, `${L("block", locale)} ${blockNr} – ${blockTitle}`, CW - 4);
    const blockH = Math.max(7, blockLines.length * 4.2 + 2);
    if (yy + blockH + 8 > PAGE_H - MB) {
      yy = drawTableHeader(newPage(doc));
    }
    doc.setFillColor(230, 235, 245);
    doc.rect(ML, yy, CW, blockH, "F");
    doc.setTextColor(...primary);
    drawText(doc, blockLines, rtl ? PAGE_W - MR - 2 : ML + 2, yy + 4.5, locale, { align: textAlign });
    return yy + blockH + 1.5;
  }

  function drawBlockSum(blockItems: ProposalPdfItem[], yy: number): number {
    yy = checkPage(doc, yy, 6);
    const blockHours = blockItems.reduce((s, i) => s + i.quantity, 0);
    const blockTotal = blockItems.reduce((s, i) => s + i.totalPrice, 0);
    doc.setFillColor(220, 228, 242);
    doc.rect(ML, yy, CW, 5.5, "F");
    doc.setFontSize(7.5);
    setPdfFont(doc, locale, "bold");
    doc.setTextColor(...primary);
    const blockLabel = `${L("blockSum", locale)} ${blockItems[0].blockNr ?? ""}`;
    drawText(doc, blockLabel, rtl ? PAGE_W - MR - 2 : ML + 2, yy + 3.8, locale, { align: textAlign });
    if (isHourlyProposal) {
      drawText(doc, fmtHours(blockHours, locale), numericX(COL.qty), yy + 3.8, locale, { align: "right" });
    }
    drawText(doc, fmtCurrency(blockTotal, proposal.currency, locale), numericX(COL.total), yy + 3.8, locale, { align: "right" });
    return yy + 8;
  }

  // Blöcke rendern
  for (const grp of grouped) {
    y = drawBlockHeader(grp.blockNr, grp.blockTitle, y);
    for (const item of grp.items) {
      y = drawItemRow(item, rowIdx++, y);
    }
    y = drawBlockSum(grp.items, y);
    y += 2;
  }

  // Ungruppiete Positionen
  for (const item of ungrouped) {
    y = drawItemRow(item, rowIdx++, y);
  }

  y += 4;

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMEN
  // ══════════════════════════════════════════════════════════════════════════

  y = checkPage(doc, y, 40);

  const sumX = rtl ? ML : 120;
  const sumW = 72;

  function drawSumRow(label: string, value: string, bold: boolean, highlight: boolean, yy: number): number {
    yy = checkPage(doc, yy, 7);
    if (highlight) {
      doc.setFillColor(...accent);
      doc.rect(sumX - 2, yy - 1, sumW + 2, 7, "F");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(60, 60, 60);
    }
    doc.setFontSize(8.5);
    setPdfFont(doc, locale, bold ? "bold" : "normal");
    drawText(doc, label, rtl ? sumX + sumW : sumX, yy + 4, locale, { align: rtl ? "right" : "left" });
    drawText(doc, value, rtl ? sumX : sumX + sumW, yy + 4, locale, { align: rtl ? "left" : "right" });
    return yy + 8;
  }

  const appliedHourlyRate = proposal.discountedHourlyRate ?? proposal.hourlyRate;
  const appliedHours = proposal.totalHours ?? totalHoursSum;
  const subtotalLabel = isHourlyProposal && appliedHourlyRate != null
    ? `${L("subtotal", locale)} (${fmtHours(appliedHours, locale)} × ${fmtCurrency(appliedHourlyRate, proposal.currency, locale)} / ${L("hoursUnit", locale)})`
    : L("subtotal", locale);

  y = drawSumRow(
    subtotalLabel,
    fmtCurrency(proposal.subtotal, proposal.currency, locale),
    false, false, y,
  );

  if (proposal.discountAmount && proposal.discountAmount > 0) {
    y = drawSumRow(
      L("discount", locale),
      `− ${fmtCurrency(proposal.discountAmount, proposal.currency, locale)}`,
      false, false, y,
    );
    if (proposal.discountDescription) {
      doc.setFontSize(7);
      setPdfFont(doc, locale, "italic");
      doc.setTextColor(...gray);
      const dLines = splitText(doc, proposal.discountDescription, sumW);
      drawText(doc, dLines, rtl ? sumX + sumW : sumX, y, locale, { align: rtl ? "right" : "left" });
      y += dLines.length * 3.5 + 2;
    }
  }

  if (proposal.taxRate > 0) {
    y = drawSumRow(
      `${L("tax", locale)} (${fmtNumber(proposal.taxRate, locale)} %)`,
      fmtCurrency(proposal.tax, proposal.currency, locale),
      false, false, y,
    );
  } else {
    const zeroTaxLabel = proposal.reverseCharge
      ? `${L("tax", locale)} (0 % – ${L("reverseChargeShort", locale)})`
      : `${L("tax", locale)} (0 %)`;
    y = drawSumRow(
      zeroTaxLabel,
      fmtCurrency(0, proposal.currency, locale),
      false, false, y,
    );
  }

  y = drawSumRow(
    L("totalAmount", locale),
    fmtCurrency(proposal.total, proposal.currency, locale),
    true, true, y,
  );

  y += 6;

  // ══════════════════════════════════════════════════════════════════════════
  // REVERSE CHARGE HINWEIS
  // ══════════════════════════════════════════════════════════════════════════

  if (proposal.reverseCharge) {
    y = checkPage(doc, y, 18);
    doc.setFillColor(255, 248, 230);
    const rcNote = proposal.reverseChargeNote ?? L("reverseChargeDefault", locale);
    setPdfFont(doc, locale, "normal");
    const rcLines = splitText(doc, rcNote, CW - 6);
    doc.roundedRect(ML, y, CW, rcLines.length * 4 + 8, 2, 2, "F");
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.roundedRect(ML, y, CW, rcLines.length * 4 + 8, 2, 2, "S");
    doc.setFontSize(7.5);
    setPdfFont(doc, locale, "bold");
    doc.setTextColor(...accent);
    drawText(doc, L("reverseCharge", locale), rtl ? PAGE_W - MR - 3 : ML + 3, y + 4.5, locale, { align: textAlign });
    setPdfFont(doc, locale, "normal");
    doc.setTextColor(80, 60, 20);
    drawText(doc, rcLines, rtl ? PAGE_W - MR - 3 : ML + 3, y + 9, locale, { align: textAlign });
    y += rcLines.length * 4 + 14;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ZAHLUNGSPLAN
  // ══════════════════════════════════════════════════════════════════════════

  if (proposal.paymentSchedule && proposal.paymentSchedule.length > 0) {
    y = sectionHeader(doc, L("payment", locale), y, primary, accent, locale, 24);

    const PAY = rtl
      ? {
          description: { x: ML,       w: 78 },
          amount:      { x: ML + 78,  w: 32 },
          due:         { x: ML + 110, w: 64 },
        }
      : {
          due:         { x: ML,       w: 64 },
          amount:      { x: ML + 64,  w: 32 },
          description: { x: ML + 96,  w: 78 },
        };

    function drawPaymentHeader(yy: number): number {
      yy = checkPage(doc, yy, 16);
      doc.setFillColor(...primary);
      doc.rect(ML, yy, CW, 7, "F");
      doc.setFontSize(7.5);
      setPdfFont(doc, locale, "bold");
      doc.setTextColor(255, 255, 255);
      drawText(doc, L("dueDate", locale), textX(PAY.due), yy + 4.7, locale, { align: textAlign });
      drawText(doc, L("amount", locale), numericX(PAY.amount), yy + 4.7, locale, { align: "right" });
      drawText(doc, L("description", locale), textX(PAY.description), yy + 4.7, locale, { align: textAlign });
      return yy + 9;
    }

    y = drawPaymentHeader(y);

    for (let i = 0; i < proposal.paymentSchedule.length; i++) {
      const p = proposal.paymentSchedule[i];
      doc.setFontSize(8);
      setPdfFont(doc, locale, "normal");
      const dueLines = splitText(doc, p.dueLabel, PAY.due.w - 3);
      const descriptionLines = p.description ? splitText(doc, p.description, PAY.description.w - 3) : [];
      const rowH = Math.max(7, dueLines.length * 4 + 3, descriptionLines.length * 4 + 3);
      if (y + rowH > PAGE_H - MB) y = drawPaymentHeader(newPage(doc));
      if (i % 2 === 1) { doc.setFillColor(248, 248, 250); doc.rect(ML, y - 1, CW, rowH, "F"); }
      doc.setFontSize(8);
      setPdfFont(doc, locale, "bold");
      doc.setTextColor(...primary);
      drawText(doc, dueLines, textX(PAY.due), y + 4, locale, { align: textAlign });
      doc.setTextColor(...accent);
      drawText(doc, fmtCurrency(p.amount, p.currency ?? proposal.currency, locale), numericX(PAY.amount), y + 4, locale, { align: "right" });
      if (descriptionLines.length > 0) {
        setPdfFont(doc, locale, "normal");
        doc.setTextColor(60, 60, 60);
        drawText(doc, descriptionLines, textX(PAY.description), y + 4, locale, { align: textAlign });
      }
      y += rowH + 1;
    }
    y += 4;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MEILENSTEINE
  // ══════════════════════════════════════════════════════════════════════════

  if (proposal.milestones && proposal.milestones.length > 0) {
    y = sectionHeader(doc, L("milestones", locale), y, primary, accent, locale, 24);

    const MILESTONE = rtl
      ? {
          goal:      { x: ML,       w: 104 },
          blocks:    { x: ML + 104, w: 32 },
          milestone: { x: ML + 136, w: 38 },
        }
      : {
          milestone: { x: ML,       w: 38 },
          blocks:    { x: ML + 38,  w: 32 },
          goal:      { x: ML + 70,  w: 104 },
        };

    function drawMilestoneHeader(yy: number): number {
      yy = checkPage(doc, yy, 16);
      doc.setFillColor(...primary);
      doc.rect(ML, yy, CW, 7, "F");
      doc.setFontSize(7.5);
      setPdfFont(doc, locale, "bold");
      doc.setTextColor(255, 255, 255);
      drawText(doc, L("milestone", locale), textX(MILESTONE.milestone), yy + 4.7, locale, { align: textAlign });
      drawText(doc, L("blocks", locale), textX(MILESTONE.blocks), yy + 4.7, locale, { align: textAlign });
      drawText(doc, L("goal", locale), textX(MILESTONE.goal), yy + 4.7, locale, { align: textAlign });
      return yy + 9;
    }

    y = drawMilestoneHeader(y);

    for (let i = 0; i < proposal.milestones.length; i++) {
      const m = proposal.milestones[i];
      doc.setFontSize(8);
      setPdfFont(doc, locale, "normal");
      const milestoneLines = splitText(doc, `${m.milestoneNr} – ${m.title}`, MILESTONE.milestone.w - 3);
      const blockLines = splitText(doc, m.blocks ?? "", MILESTONE.blocks.w - 3);
      const goalLines = splitText(doc, m.goal ?? "", MILESTONE.goal.w - 3);
      const rowH = Math.max(7, milestoneLines.length * 4 + 3, blockLines.length * 4 + 3, goalLines.length * 4 + 3);
      if (y + rowH > PAGE_H - MB) y = drawMilestoneHeader(newPage(doc));
      if (i % 2 === 1) { doc.setFillColor(248, 248, 250); doc.rect(ML, y - 1, CW, rowH, "F"); }
      setPdfFont(doc, locale, "bold");
      doc.setTextColor(...accent);
      drawText(doc, milestoneLines, textX(MILESTONE.milestone), y + 4, locale, { align: textAlign });
      setPdfFont(doc, locale, "normal");
      doc.setTextColor(60, 60, 60);
      if (m.blocks) drawText(doc, blockLines, textX(MILESTONE.blocks), y + 4, locale, { align: textAlign });
      drawText(doc, goalLines, textX(MILESTONE.goal), y + 4, locale, { align: textAlign });
      y += rowH + 1;
    }
    y += 4;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIZEN / VORBEHALTE (aus DB-Feld oder Markdown-Input)
  // ══════════════════════════════════════════════════════════════════════════

  if (proposal.notes) {
    y = sectionHeader(doc, L("notes", locale), y, primary, accent, locale, 16);

    // ── Emoji & problematic unicode → ASCII ──────────────────────────────
    function sanitize(str: string): string {
      return (str ?? "")
        .replace(/⚠️?/g,  "[!]")
        .replace(/✅/g,   "OK")
        .replace(/❌/g,   "X")
        .replace(/✓/g,   "✓")      // keep – jsPDF renders basic latin extended
        .replace(/✗/g,   "✗")      // keep
        .replace(/✔/g,   "✓")
        .replace(/✘/g,   "✗")
        .replace(/🔴/g,   "[!]")
        .replace(/🟡/g,   "[~]")
        .replace(/🟢/g,   "[OK]")
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")   // misc emoji
        .replace(/[\u{2700}-\u{2712}]/gu, "")      // dingbats (before ✓)
        .replace(/[\u{2714}-\u{2716}]/gu, "")      // dingbats (between ✓/✗)
        .replace(/[\u{2718}-\u{27BF}]/gu, "")      // dingbats (after ✗)
        .replace(/\uFEFF/gu, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/~~(.*?)~~/g, "")
        .replace(/`(.*?)`/g, "$1")
        .trim();
    }

    function parseCells(line: string): string[] {
      return line.split("|").slice(1, -1).map((s) => s.trim());
    }

    // ── Group consecutive lines into typed blocks ─────────────────────────
    type NoteBlock =
      | { k: "empty" }
      | { k: "h2";  text: string }
      | { k: "h3";  text: string }
      | { k: "num"; num: number; text: string }
      | { k: "bul"; text: string }
      | { k: "bq";  text: string }
      | { k: "tbl"; headers: string[]; rows: string[][] }
      | { k: "img"; src: string; alt: string }
      | { k: "txt"; text: string };

    const noteBlocks: NoteBlock[] = [];
    const nl = proposal.notes.split("\n");
    let ni = 0;

    while (ni < nl.length) {
      const raw = nl[ni].trimEnd();
      const t   = raw.trim();

      if (!t || t === "---") { noteBlocks.push({ k: "empty" }); ni++; continue; }

      // Table: collect all consecutive | lines
      if (t.startsWith("|")) {
        const tbRaw: string[] = [];
        while (ni < nl.length && nl[ni].trim().startsWith("|")) { tbRaw.push(nl[ni]); ni++; }
        const dataRows = tbRaw.filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()));
        if (dataRows.length > 0) {
          const hdr  = parseCells(dataRows[0]).map(sanitize);
          const rows = dataRows.slice(1).map((r) => parseCells(r).map(sanitize));
          noteBlocks.push({ k: "tbl", headers: hdr, rows });
        }
        continue;
      }

      const imgMatch = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (imgMatch)              { noteBlocks.push({ k: "img", alt: sanitize(imgMatch[1]), src: imgMatch[2] }); ni++; continue; }
      if (t.startsWith("> "))    { noteBlocks.push({ k: "bq",  text: sanitize(t.slice(2)) }); ni++; continue; }
      if (/^## /.test(t))        { noteBlocks.push({ k: "h2",  text: sanitize(t.slice(3)) }); ni++; continue; }
      if (/^### /.test(t))       { noteBlocks.push({ k: "h3",  text: sanitize(t.slice(4)) }); ni++; continue; }
      if (/^\d+\.\s/.test(t)) {
        const num = parseInt(t.match(/^(\d+)\./)?.[1] ?? "1");
        noteBlocks.push({ k: "num", num, text: sanitize(t.replace(/^\d+\.\s/, "")) });
        ni++; continue;
      }
      if (t.startsWith("- ") || t.startsWith("* ") || /^-(?=[^\s\d-])/.test(t)) {
        noteBlocks.push({ k: "bul", text: sanitize(t.replace(/^[-*]\s*/, "")) }); ni++; continue;
      }
      noteBlocks.push({ k: "txt", text: sanitize(t) }); ni++;
    }

    // ── Render blocks ─────────────────────────────────────────────────────
    for (const nb of noteBlocks) {
      if (nb.k === "empty") { y += 2; continue; }
      y = checkPage(doc, y, 8);

      if (nb.k === "h2") {
        y += 2;
        doc.setFontSize(9.5); setPdfFont(doc, locale, "bold"); doc.setTextColor(...primary);
        const headingLines = splitText(doc, nb.text, CW);
        // Überschrift nicht vom ersten Absatz trennen
        y = checkPage(doc, y, headingLines.length * 4.5 + 22);
        drawText(doc, headingLines, rtl ? PAGE_W - MR : ML, y + 4, locale, { align: textAlign });
        y += headingLines.length * 4.5 + 3;

      } else if (nb.k === "h3") {
        doc.setFontSize(8.5); setPdfFont(doc, locale, "bold"); doc.setTextColor(...accent);
        const headingLines = splitText(doc, nb.text, CW);
        y = checkPage(doc, y, headingLines.length * 4.2 + 12);
        drawText(doc, headingLines, rtl ? PAGE_W - MR : ML, y + 4, locale, { align: textAlign });
        y += headingLines.length * 4.2 + 3;

      } else if (nb.k === "num") {
        doc.setFontSize(8); setPdfFont(doc, locale, "normal");
        const tl = splitText(doc, nb.text, CW - 12);
        const rh = Math.max(6, tl.length * 4.2 + 1);
        y = checkPage(doc, y, rh + 1);
        setPdfFont(doc, locale, "bold"); doc.setTextColor(...accent);
        drawText(doc, `${nb.num}.`, rtl ? PAGE_W - MR - 1 : ML + 1, y + 3.5, locale, { align: textAlign });
        setPdfFont(doc, locale, "normal"); doc.setTextColor(50, 50, 50);
        drawText(doc, tl, rtl ? PAGE_W - MR - 10 : ML + 10, y + 3.5, locale, { align: textAlign });
        y += rh;

      } else if (nb.k === "bul") {
        doc.setFontSize(8); setPdfFont(doc, locale, "normal");
        const tl = splitText(doc, nb.text, CW - 10);
        const rh = Math.max(5, tl.length * 4.2 + 1);
        y = checkPage(doc, y, rh + 1);
        doc.setTextColor(...accent);
        drawText(doc, "•", rtl ? PAGE_W - MR - 2 : ML + 2, y + 3.5, locale, { align: textAlign });
        doc.setTextColor(50, 50, 50);
        drawText(doc, tl, rtl ? PAGE_W - MR - 8 : ML + 8, y + 3.5, locale, { align: textAlign });
        y += rh;

      } else if (nb.k === "bq") {
        doc.setFontSize(7.5); setPdfFont(doc, locale, "italic");
        const tl = splitText(doc, nb.text, CW - 8);
        const bh = tl.length * 4 + 6;
        y = checkPage(doc, y, bh + 2);
        doc.setFillColor(255, 248, 230);
        doc.rect(ML, y, CW, bh, "F");
        doc.setDrawColor(...accent); doc.setLineWidth(0.6);
        const quoteEdge = rtl ? PAGE_W - MR : ML;
        doc.line(quoteEdge, y, quoteEdge, y + bh);
        doc.setTextColor(80, 60, 20);
        drawText(doc, tl, rtl ? PAGE_W - MR - 4 : ML + 4, y + 4, locale, { align: textAlign });
        y += bh + 3;

      } else if (nb.k === "tbl") {
        // ── Inline table with auto column widths ───────────────────────
        const nCols = nb.headers.length;
        if (nCols === 0) continue;

        // Distribute column widths: first/last cols narrower
        const colW: number[] = (() => {
          if (nCols === 1)  return [CW];
          if (nCols === 2)  return [CW * 0.42, CW * 0.58];
          if (nCols === 3)  {
            // Detect comparison table (last 2 cols are short values like "Ja/Nein" or "✓/✗")
            const lastTwo = [...nb.rows].flatMap((r) => [r[1], r[2]]).join(" ");
            const isCompare = /✓|✗|ok|ja|nein|x\b/i.test(lastTwo);
            return isCompare
              ? [CW * 0.62, CW * 0.19, CW * 0.19]
              : [CW * 0.18, CW * 0.47, CW * 0.35];
          }
          if (nCols === 4)  return [CW * 0.08, CW * 0.22, CW * 0.50, CW * 0.20];
          if (nCols === 5)  return [CW * 0.06, CW * 0.24, CW * 0.18, CW * 0.18, CW * 0.34];
          // 6+ cols: equal distribution
          const eq = CW / nCols;
          return Array(nCols).fill(eq);
        })();
        const colX: number[] = colW.map((_, index) => {
          const precedingWidth = colW.slice(0, index).reduce((sum, width) => sum + width, 0);
          return rtl
            ? PAGE_W - MR - precedingWidth - colW[index]
            : ML + precedingWidth;
        });
        const noteCellX = (index: number) => rtl ? colX[index] + colW[index] - 1 : colX[index] + 1;

        doc.setFontSize(7.5);
        setPdfFont(doc, locale, "bold");
        const headerLines = nb.headers.map((header, index) => splitText(doc, header ?? "", colW[index] - 2));
        const headerMaxLines = Math.max(1, ...headerLines.map((lines) => lines.length));
        const headerH = Math.max(7, headerMaxLines * 4 + 3);

        function drawNotesTableHeader(yy: number): number {
          doc.setFillColor(...primary);
          doc.rect(ML, yy, CW, headerH, "F");
          doc.setFontSize(7.5);
          setPdfFont(doc, locale, "bold");
          doc.setTextColor(255, 255, 255);
          for (let ci = 0; ci < nCols; ci++) {
            drawText(doc, headerLines[ci] ?? [], noteCellX(ci), yy + 4.2, locale, { align: textAlign });
          }
          return yy + headerH + 1.5;
        }

        if (y + headerH > PAGE_H - MB) y = newPage(doc);
        y = drawNotesTableHeader(y);

        // Data rows
        for (let ri = 0; ri < nb.rows.length; ri++) {
          const row = nb.rows[ri];
          // Compute row height based on wrapped content
          let maxLines = 1;
          setPdfFont(doc, locale, "normal");
          const cellLines: string[][] = Array.from({ length: nCols }, (_, ci) => {
            const tl = splitText(doc, row[ci] ?? "", colW[ci] - 2);
            if (tl.length > maxLines) maxLines = tl.length;
            return tl;
          });
          const rh = Math.max(6, maxLines * 4 + 3);
          if (y + rh + 1 > PAGE_H - MB) y = drawNotesTableHeader(newPage(doc));

          if (ri % 2 === 1) {
            doc.setFillColor(248, 248, 250);
            doc.rect(ML, y - 1, CW, rh + 1, "F");
          }
          doc.setFontSize(7.5); setPdfFont(doc, locale, "normal"); doc.setTextColor(40, 40, 40);
          for (let ci = 0; ci < nCols; ci++) {
            const cellVal = (row[ci] ?? "").trim();
            // Colorize ✓ (green) and ✗ (red) cells
            if (cellVal === "✓" || cellVal === "OK" || cellVal === "Ja") {
              doc.setTextColor(34, 139, 34);
              setPdfFont(doc, locale, "bold");
            } else if (cellVal === "✗" || cellVal === "X" || cellVal === "Nein") {
              doc.setTextColor(180, 30, 30);
              setPdfFont(doc, locale, "bold");
            } else {
              doc.setTextColor(40, 40, 40);
              setPdfFont(doc, locale, "normal");
            }
            if (cellLines[ci]) {
              drawText(doc, cellLines[ci], noteCellX(ci), y + 3.5, locale, { align: textAlign });
            }
          }
          doc.setTextColor(40, 40, 40);
          setPdfFont(doc, locale, "normal");
          y += rh + 1;
        }
        y += 3;

      } else if (nb.k === "img") {
        const img = loadPublicImage(nb.src);
        if (!img) continue;
        const MAX_W = 50;
        const MAX_H = 65;
        let w = MAX_W;
        let h = MAX_W;
        try {
          const props = doc.getImageProperties(img.dataUrl);
          const scale = Math.min(MAX_W / props.width, MAX_H / props.height);
          w = props.width * scale;
          h = props.height * scale;
        } catch { /* fallback: quadratisch */ }
        const captionH = nb.alt ? 5 : 0;
        y = checkPage(doc, y, h + captionH + 4);
        const x = rtl ? PAGE_W - MR - w : ML;
        try { doc.addImage(img.dataUrl, img.format, x, y + 1, w, h); } catch { continue; }
        y += h + 2;
        if (nb.alt) {
          doc.setFontSize(7.5); setPdfFont(doc, locale, "normal"); doc.setTextColor(...gray);
          drawText(doc, nb.alt, rtl ? PAGE_W - MR : ML, y + 3, locale, { align: textAlign });
          y += captionH;
        }
        y += 2;

      } else if (nb.k === "txt") {
        doc.setFontSize(8); setPdfFont(doc, locale, "normal");
        const tl = splitText(doc, nb.text, CW);
        const rh = Math.max(5, tl.length * 4.2 + 1);
        y = checkPage(doc, y, rh);
        doc.setTextColor(50, 50, 50);
        drawText(doc, tl, rtl ? PAGE_W - MR : ML, y + 3.5, locale, { align: textAlign });
        y += rh;
      }
    }
    y += 4;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ANNAHME & VERBINDLICHKEIT
  // ══════════════════════════════════════════════════════════════════════════

  y = sectionHeader(doc, L("acceptance", locale), y, primary, accent, locale, 18);

  doc.setFillColor(240, 245, 255);
  doc.setFontSize(8.5);
  setPdfFont(doc, locale, "normal");
  const accLines = splitText(doc, L("acceptanceText", locale), CW - 6);
  doc.roundedRect(ML, y, CW, accLines.length * 4 + 10, 2, 2, "F");
  doc.setTextColor(40, 40, 80);
  drawText(doc, accLines, rtl ? PAGE_W - MR - 3 : ML + 3, y + 6, locale, { align: textAlign });
  y += accLines.length * 4 + 14;

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER auf jeder Seite
  // ══════════════════════════════════════════════════════════════════════════

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.3);
    doc.line(ML, PAGE_H - MB + 2, PAGE_W - MR, PAGE_H - MB + 2);
    doc.setFontSize(7);
    setPdfFont(doc, locale, "normal");
    doc.setTextColor(...gray);
    const leftFooter = [company.companyName, company.email, company.website].filter(Boolean).join("  |  ");
    drawText(doc, leftFooter, rtl ? PAGE_W - MR : ML, PAGE_H - MB + 6, locale, { align: textAlign });
    drawText(
      doc,
      L("pageOf", locale).replace("{p}", fmtNumber(p, locale)).replace("{n}", fmtNumber(totalPages, locale)),
      rtl ? ML : PAGE_W - MR,
      PAGE_H - MB + 6,
      locale,
      { align: rtl ? "left" : "right" },
    );
    if (p === totalPages) {
      const note = `${proposal.proposalNr}${proposal.revision ? ` · ${proposal.revision}` : ""} · ${fmtDate(proposal.issuedAt ?? new Date(), locale)} · ${L("footerNet", locale)}`;
      const footerNoteLines = splitText(doc, note, CW);
      drawText(doc, footerNoteLines, PAGE_W / 2, PAGE_H - MB + 10, locale, { align: "center" });
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}
