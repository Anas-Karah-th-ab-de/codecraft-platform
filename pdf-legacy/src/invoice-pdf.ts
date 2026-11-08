/**
 * Invoice PDF Generator
 *
 * Erzeugt Rechnungs-PDFs on-the-fly basierend auf InvoiceTemplate + Invoice-Daten.
 * Unterstützt mehrere Sprachen (de, en, ar).
 * Arabische Texte werden korrekt gerendert (Amiri-Font + Reshaping + RTL).
 * Alle Sprachen verwenden westliche Ziffern (1234567890).
 */

import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// ─── Types ───

export interface InvoiceTemplateData {
  companyName: string;
  contactName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
  website: string;
  phone: string;
  taxId: string;
  bankName: string;
  bankIban: string;
  bankBic: string;
  bankAddress: string;
  senderBic: string;
  payeeName: string;
  logoUrl?: string | null;
  logoBase64?: string | null;
  primaryColor: string;
  accentColor: string;
  headerTitle: Record<string, string>;
  introText: Record<string, string>;
  footerText: Record<string, string>;
  closingText: Record<string, string>;
  taxNote: Record<string, string>;
  labels: Record<string, Record<string, string>>;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedAt: Date | string;
  dueDate: Date | string;
  serviceFrom?: Date | string | null;
  serviceTo?: Date | string | null;
  customerName: string;
  customerAddress: {
    company?: string;
    name?: string;
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    discount?: number | null;
    discountType?: string | null;
  }[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  currency: string;
  notes?: string | null;
  discount?: number | null;
  discountType?: string | null;
  discountAmount?: number | null;
  discountDescription?: string | null;
  unitType?: string;
}

// ─── Default Labels ───

const DEFAULT_LABELS: Record<string, Record<string, string>> = {
  issuer: { de: "Aussteller:", en: "Issuer:", ar: "المُصدر:" },
  invoiceTo: { de: "Rechnung an:", en: "Invoice to:", ar: "فاتورة إلى:" },
  invoiceNumber: { de: "Rechnungsnummer", en: "Invoice Number", ar: "رقم الفاتورة" },
  invoiceDate: { de: "Rechnungsdatum", en: "Invoice Date", ar: "تاريخ الفاتورة" },
  dueDate: { de: "Fälligkeitsdatum", en: "Due Date", ar: "تاريخ الاستحقاق" },
  servicePeriod: { de: "Leistungszeitraum:", en: "Service period:", ar: "فترة الخدمة:" },
  pos: { de: "Pos", en: "No.", ar: "رقم" },
  description: { de: "Beschreibung", en: "Description", ar: "الوصف" },
  quantity: { de: "Menge", en: "Qty", ar: "الكمية" },
  hours: { de: "Std.", en: "Hrs", ar: "ساعات" },
  unitPrice: { de: "Einzelpreis", en: "Unit Price", ar: "سعر الوحدة" },
  totalCol: { de: "Gesamt", en: "Total", ar: "الإجمالي" },
  totalAmount: { de: "Gesamtsumme", en: "Total", ar: "المبلغ الإجمالي" },
  paymentInfo: { de: "Zahlungsinformationen:", en: "Payment Information:", ar: "معلومات الدفع:" },
  payee: { de: "Empfänger:", en: "Payee:", ar: "المستفيد:" },
  bank: { de: "Bank:", en: "Bank:", ar: "البنك:" },
  iban: { de: "IBAN:", en: "IBAN:", ar: "IBAN:" },
  bic: { de: "BIC:", en: "BIC:", ar: "BIC:" },
  bankAddr: { de: "Adresse der Bank:", en: "Bank Address:", ar: "عنوان البنك:" },
  senderBic: { de: "BIC der Senderbank:", en: "Sender Bank BIC:", ar: "BIC بنك المرسل:" },
  subtotal: { de: "Zwischensumme", en: "Subtotal", ar: "المجموع الفرعي" },
  totalQuantity: { de: "Gesamte Menge", en: "Total Quantity", ar: "إجمالي الكمية" },
  totalHours: { de: "Gesamte Stunden", en: "Total Hours", ar: "إجمالي الساعات" },
  discount: { de: "Rabatt", en: "Discount", ar: "الخصم" },
  taxLabel: { de: "MwSt.", en: "Tax", ar: "الضريبة" },
  to: { de: "bis", en: "to", ar: "إلى" },
};

// ─── Helpers ───

function getLabel(template: InvoiceTemplateData, key: string, locale: string): string {
  const custom = template.labels?.[key];
  if (custom && custom[locale]) return custom[locale];
  return DEFAULT_LABELS[key]?.[locale] ?? DEFAULT_LABELS[key]?.["en"] ?? key;
}

function getText(field: Record<string, string>, locale: string): string {
  return field[locale] ?? field["en"] ?? field["de"] ?? "";
}

/** Always use Western Arabic digits (1234567890), never ٠١٢٣... Also strips bidi control chars. */
function toWesternDigits(str: string): string {
  return str
    .replace(/[\u200F\u200E\u061C\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function formatDate(d: Date | string, locale: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const formatted = date.toLocaleDateString(
    locale === "ar" ? "ar-EG-u-nu-latn" : locale === "en" ? "en-GB" : "de-DE",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
  return toWesternDigits(formatted);
}

function formatCurrency(amount: number, currency: string, locale: string): string {
  const loc = locale === "ar" ? "ar-EG-u-nu-latn" : locale === "en" ? "en-US" : "de-DE";
  const formatted = new Intl.NumberFormat(loc, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
  return toWesternDigits(formatted);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ─── Arabic Text Processing ───

/**
 * Strip bidi control characters from text.
 * The Amiri font provides Arabic glyphs, and the PDF viewer (Chrome/Firefox)
 * natively handles RTL display via the Unicode Bidi Algorithm.
 * We do NOT reverse or reshape — the viewer does it automatically.
 */
function processArabicText(text: string): string {
  return text.replace(/[\u200F\u200E\u061C\u202A-\u202E\u2066-\u2069]/g, "");
}

// ─── Font Loading ───

let amiriFontsLoaded = false;
let amiriRegularBase64: string | null = null;
let amiriBoldBase64: string | null = null;

function loadAmiriFonts(): void {
  if (amiriFontsLoaded) return;
  try {
    const basePaths = [
      path.join(process.cwd(), "src", "assets", "fonts"),
      path.join(process.cwd(), ".next", "server", "src", "assets", "fonts"),
    ];
    for (const basePath of basePaths) {
      const regularPath = path.join(basePath, "Amiri-Regular.ttf");
      const boldPath = path.join(basePath, "Amiri-Bold.ttf");
      if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
        amiriRegularBase64 = fs.readFileSync(regularPath).toString("base64");
        amiriBoldBase64 = fs.readFileSync(boldPath).toString("base64");
        amiriFontsLoaded = true;
        return;
      }
    }
    console.warn("Amiri fonts not found — Arabic may not render correctly");
  } catch (err) {
    console.warn("Failed to load Amiri fonts:", err);
  }
}

function registerAmiriFonts(doc: jsPDF): void {
  if (!amiriRegularBase64 || !amiriBoldBase64) return;
  doc.addFileToVFS("Amiri-Regular.ttf", amiriRegularBase64);
  doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
  doc.addFileToVFS("Amiri-Bold.ttf", amiriBoldBase64);
  doc.addFont("Amiri-Bold.ttf", "Amiri", "bold");
}

// ─── PDF Text Helpers ───

function setFont(doc: jsPDF, locale: string, style: "normal" | "bold" | "italic"): void {
  if (locale === "ar" && amiriFontsLoaded) {
    doc.setFont("Amiri", style === "italic" ? "normal" : style);
  } else {
    doc.setFont("helvetica", style);
  }
}

function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  locale: string,
  options?: { align?: "left" | "right" | "center" },
): void {
  const processed = locale === "ar" ? processArabicText(text) : text;
  doc.text(processed, x, y, options);
}

function splitText(doc: jsPDF, text: string, maxWidth: number, locale: string): string[] {
  const clean = locale === "ar" ? processArabicText(text) : text;
  return doc.splitTextToSize(clean, maxWidth);
}

// ─── Main Generator ───

export function generateInvoicePdf(
  template: InvoiceTemplateData,
  invoice: InvoicePdfData,
  locale: string = "de",
): Buffer {
  if (locale === "ar") loadAmiriFonts();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  const primary = hexToRgb(template.primaryColor);
  const accent = hexToRgb(template.accentColor);

  if (locale === "ar") registerAmiriFonts(doc);

  let y = 20;

  // ── Logo (oben links)
  if (template.logoBase64) {
    try {
      doc.addImage(template.logoBase64, "PNG", marginL, y - 5, 25, 10.4);
    } catch {
      // weiter ohne Logo
    }
  }

  // ── Header: Titel (oben rechts)
  setFont(doc, locale, "bold");
  doc.setFontSize(24);
  doc.setTextColor(...accent);
  drawText(doc, getText(template.headerTitle, locale), pageW - marginR, y, locale, { align: "right" });

  y = template.logoBase64 ? y + 12 : y;

  // ── Aussteller-Info
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  setFont(doc, locale, "normal");
  drawText(doc, getLabel(template, "issuer", locale), marginL, y, locale);
  y += 5;

  doc.setFontSize(14);
  doc.setTextColor(...primary);
  setFont(doc, locale, "bold");
  drawText(doc, template.companyName, marginL, y, locale);
  y += 10;

  // ── Zwei-Spalten: Adresse links, Meta rechts
  const metaStartY = y;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  setFont(doc, locale, "normal");
  drawText(doc, getLabel(template, "invoiceTo", locale), marginL, y, locale);
  y += 5;

  doc.setFontSize(10);
  doc.setTextColor(...primary);
  setFont(doc, locale, "bold");
  drawText(doc, invoice.customerName, marginL, y, locale);
  y += 5;

  setFont(doc, locale, "normal");
  doc.setFontSize(9);
  const addr = invoice.customerAddress;
  const addrLines = [
    addr.street,
    [addr.zip, addr.city].filter(Boolean).join(" "),
    addr.country,
  ].filter(Boolean);
  for (const line of addrLines) {
    drawText(doc, line!, marginL, y, locale);
    y += 4;
  }

  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const senderLines = [
    template.contactName ? `Name: ${template.contactName}` : null,
    template.addressLine1 || null,
    template.addressLine2 || null,
    [template.postalCode, template.city].filter(Boolean).join(", "),
    template.country,
    template.email ? `E-Mail: ${template.email}` : null,
    template.website ? `Website: ${template.website}` : null,
  ].filter(Boolean);
  for (const line of senderLines) {
    drawText(doc, line!, marginL, y, locale);
    y += 3.5;
  }

  // Rechte Spalte: Meta
  const metaX = 120;
  let metaY = metaStartY;

  const metaRows: [string, string][] = [
    [getLabel(template, "invoiceNumber", locale), invoice.invoiceNumber],
    [getLabel(template, "invoiceDate", locale), formatDate(invoice.issuedAt, locale)],
    [getLabel(template, "dueDate", locale), formatDate(invoice.dueDate, locale)],
  ];

  doc.setFontSize(9);
  for (const [label, value] of metaRows) {
    doc.setTextColor(120, 120, 120);
    setFont(doc, locale, "normal");
    drawText(doc, label, metaX, metaY, locale);
    metaY += 4.5;
    doc.setTextColor(...primary);
    setFont(doc, locale, "bold");
    drawText(doc, value, metaX, metaY, locale);
    metaY += 7;
  }

  if (invoice.serviceFrom && invoice.serviceTo) {
    doc.setTextColor(120, 120, 120);
    setFont(doc, locale, "normal");
    const spText = `${getLabel(template, "servicePeriod", locale)} ${formatDate(invoice.serviceFrom, locale)} ${getLabel(template, "to", locale)} ${formatDate(invoice.serviceTo, locale)}`;
    drawText(doc, spText, metaX, metaY, locale);
    metaY += 6;
  }

  y = Math.max(y, metaY) + 8;

  // ── Intro-Text
  setFont(doc, locale, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...primary);
  const introText = getText(template.introText, locale);
  if (introText) {
    const introLines = splitText(doc, introText, contentW, locale);
    for (const line of introLines) {
      doc.text(line, marginL, y);
      y += 4.5;
    }
    y += 4;
  }

  // ── Positionen-Tabelle
  const colWidths = [12, 80, 18, 30, 30];
  const colX = [marginL, marginL + 12, marginL + 92, marginL + 110, marginL + 140];

  doc.setFillColor(...accent);
  doc.rect(marginL, y, contentW, 7, "F");
  doc.setTextColor(255, 255, 255);
  setFont(doc, locale, "bold");
  doc.setFontSize(8);

  const headers = [
    getLabel(template, "pos", locale),
    getLabel(template, "description", locale),
    getLabel(template, invoice.unitType === "HOURS" ? "hours" : "quantity", locale),
    getLabel(template, "unitPrice", locale),
    getLabel(template, "totalCol", locale),
  ];

  y += 5;
  for (let i = 0; i < headers.length; i++) {
    const align = i >= 2 ? ("right" as const) : ("left" as const);
    const x = i >= 2 ? colX[i] + colWidths[i] : colX[i];
    drawText(doc, headers[i], x, y, locale, { align });
  }
  y += 5;

  // Zeilen
  doc.setTextColor(...primary);
  setFont(doc, locale, "normal");
  doc.setFontSize(9);

  for (let idx = 0; idx < invoice.items.length; idx++) {
    const item = invoice.items[idx];

    if (idx % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(marginL, y - 4, contentW, 7, "F");
    }

    doc.setTextColor(...primary);
    doc.text(String(idx + 1), colX[0], y);

    const descLines = splitText(doc, item.description, colWidths[1] - 2, locale);
    doc.text(descLines[0], colX[1], y);

    const qtyStr = Number(item.quantity) % 1 === 0 ? String(Math.round(Number(item.quantity))) : Number(item.quantity).toFixed(2);
    doc.text(qtyStr, colX[2] + colWidths[2], y, { align: "right" });
    doc.text(
      formatCurrency(item.unitPrice, invoice.currency, locale),
      colX[3] + colWidths[3], y, { align: "right" },
    );
    doc.text(
      formatCurrency(item.totalPrice, invoice.currency, locale),
      colX[4] + colWidths[4], y, { align: "right" },
    );

    y += 7;

    if (descLines.length > 1) {
      for (let l = 1; l < descLines.length; l++) {
        doc.text(descLines[l], colX[1], y);
        y += 5;
      }
    }

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  }

  // ── Summenblock
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(marginL + 100, y, pageW - marginR, y);
  y += 6;

  const sumX = marginL + 100;
  const sumValX = pageW - marginR;

  // Gesamte Menge / Stunden
  const totalQty = invoice.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  setFont(doc, locale, "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  const qtyLabel = getLabel(template, invoice.unitType === "HOURS" ? "totalHours" : "totalQuantity", locale);
  const totalQtyStr = totalQty % 1 === 0 ? String(Math.round(totalQty)) : totalQty.toFixed(2);
  drawText(doc, qtyLabel, sumX, y, locale);
  doc.text(totalQtyStr, sumValX, y, { align: "right" });
  y += 5;

  if (invoice.tax > 0 || (invoice.discountAmount && invoice.discountAmount > 0)) {
    setFont(doc, locale, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...primary);
    drawText(doc, getLabel(template, "subtotal", locale), sumX, y, locale);
    doc.text(formatCurrency(invoice.subtotal, invoice.currency, locale), sumValX, y, { align: "right" });
    y += 5;

    if (invoice.discountAmount && invoice.discountAmount > 0) {
      doc.setTextColor(200, 100, 0);
      let discLabel: string;
      if (invoice.discountDescription) {
        discLabel = invoice.discountType === "PERCENT"
          ? `${invoice.discountDescription} (${invoice.discount}%)`
          : invoice.discountDescription;
      } else {
        discLabel = invoice.discountType === "PERCENT"
          ? `${getLabel(template, "discount", locale)} (${invoice.discount}%)`
          : getLabel(template, "discount", locale);
      }
      drawText(doc, discLabel, sumX, y, locale);
      doc.text(`-${formatCurrency(invoice.discountAmount, invoice.currency, locale)}`, sumValX, y, { align: "right" });
      y += 5;
      doc.setTextColor(...primary);
    }

    if (invoice.tax > 0) {
      drawText(doc, `${getLabel(template, "taxLabel", locale)} (${invoice.taxRate}%)`, sumX, y, locale);
      doc.text(formatCurrency(invoice.tax, invoice.currency, locale), sumValX, y, { align: "right" });
      y += 6;
    }
  }

  doc.setFillColor(...accent);
  doc.rect(sumX - 2, y - 4, pageW - marginR - sumX + 4, 8, "F");
  doc.setTextColor(255, 255, 255);
  setFont(doc, locale, "bold");
  doc.setFontSize(10);
  drawText(doc, getLabel(template, "totalAmount", locale), sumX, y, locale);
  doc.text(formatCurrency(invoice.total, invoice.currency, locale), sumValX, y, { align: "right" });
  y += 12;

  // ── Steuer-Hinweis
  const taxNote = getText(template.taxNote, locale);
  if (taxNote && invoice.taxRate === 0) {
    setFont(doc, locale, "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    const taxLines = splitText(doc, taxNote, contentW, locale);
    for (const line of taxLines) {
      doc.text(line, marginL, y);
      y += 3.5;
    }
    y += 6;
  }

  if (y > 235) {
    doc.addPage();
    y = 20;
  }

  // ── Zahlungsinformationen
  const payTop = y;
  setFont(doc, locale, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...primary);
  drawText(doc, getLabel(template, "paymentInfo", locale), marginL, y, locale);
  y += 5;

  setFont(doc, locale, "normal");
  doc.setFontSize(8);
  const paymentLines: [string, string][] = [
    [getLabel(template, "payee", locale), template.payeeName],
    [getLabel(template, "bank", locale), template.bankName],
    [getLabel(template, "iban", locale), template.bankIban],
    [getLabel(template, "bic", locale), template.bankBic],
    [getLabel(template, "bankAddr", locale), template.bankAddress],
  ];
  if (template.senderBic) {
    paymentLines.push([getLabel(template, "senderBic", locale), template.senderBic]);
  }

  for (const [label, value] of paymentLines) {
    if (!value) continue;
    doc.setTextColor(120, 120, 120);
    drawText(doc, label, marginL, y, locale);
    doc.setTextColor(...primary);
    doc.text(value, marginL + 45, y);
    y += 4;
  }
  // QR-Code der Zahlungsart (z. B. ShamCash) rechts daneben
  const qr = loadPaymentQr((template as unknown as { paymentQr?: string }).paymentQr);
  if (qr) {
    const w = 30, h = qr.ratio * 30;
    try {
      doc.addImage(qr.dataUrl, qr.format, marginL + contentW - w, payTop - 3, w, h);
      y = Math.max(y, payTop - 3 + h + 2);
    } catch { /* Bild unlesbar → ohne QR */ }
  }
  y += 4;

  // Footer
  const footerText = getText(template.footerText, locale)
    .replace("{days}", String(Math.ceil((new Date(invoice.dueDate).getTime() - new Date(invoice.issuedAt).getTime()) / 86400000)))
    .replace("{invoiceNumber}", invoice.invoiceNumber);
  if (footerText) {
    setFont(doc, locale, "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const fLines = splitText(doc, footerText, contentW, locale);
    for (const line of fLines) {
      doc.text(line, marginL, y);
      y += 3.5;
    }
    y += 6;
  }

  // Closing
  const closingText = getText(template.closingText, locale);
  if (closingText) {
    setFont(doc, locale, "italic");
    doc.setFontSize(9);
    doc.setTextColor(...primary);
    drawText(doc, closingText, marginL, y, locale);
    y += 5;
    if (template.contactName) {
      setFont(doc, locale, "bold");
      drawText(doc, `${template.contactName} – ${template.companyName}`, marginL, y, locale);
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/** QR-Bild aus `public/` (nur /payment/…, JPEG/PNG, kein Path-Traversal) */
function loadPaymentQr(src?: string): { dataUrl: string; format: "JPEG" | "PNG"; ratio: number } | null {
  if (!src || !src.startsWith("/payment/") || src.includes("..")) return null;
  const format = /\.png$/i.test(src) ? "PNG" : /\.jpe?g$/i.test(src) ? "JPEG" : null;
  if (!format) return null;
  try {
    const publicDir = path.join(process.cwd(), "public");
    const file = path.resolve(publicDir, `.${src}`);
    if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    let ratio = 1.32;
    if (format === "PNG" && buf.length > 24) ratio = buf.readUInt32BE(20) / buf.readUInt32BE(16);
    if (format === "JPEG") {
      for (let i = 2; i + 9 < buf.length; ) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { ratio = buf.readUInt16BE(i + 5) / buf.readUInt16BE(i + 7); break; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    const mime = format === "PNG" ? "image/png" : "image/jpeg";
    return { dataUrl: `data:${mime};base64,${buf.toString("base64")}`, format, ratio: ratio > 0 && ratio < 4 ? ratio : 1.32 };
  } catch {
    return null;
  }
}
