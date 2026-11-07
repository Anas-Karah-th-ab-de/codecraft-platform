/**
 * Beleg-PDFs im unveränderten Layout des Altsystems.
 *
 * invoice-pdf.ts und proposal-pdf.ts sind 1:1 aus dem Altsystem übernommen (jsPDF) –
 * nicht anpassen, sonst ändert sich das Layout. Die Zuordnung Vorlage → Daten entspricht
 * den alten API-Routen /api/invoices/[id]/pdf und /api/proposals/[id]/pdf.
 *
 * Eingabe (stdin, JSON): { kind: "invoice" | "proposal", locale, template, data }
 *   template: Zeile der alten Tabelle InvoiceTemplate (Firmendaten, Texte, Farben)
 *   data:     InvoicePdfData bzw. ProposalPdfData
 * Ausgabe (stdout): PDF
 *
 * Arbeitsverzeichnis muss dieser Ordner sein (Schriften unter src/assets/fonts, Logo unter public/).
 */
import fs from "fs";
import path from "path";
import { generateInvoicePdf } from "./invoice-pdf";
import type { InvoicePdfData, InvoiceTemplateData } from "./invoice-pdf";
import { generateProposalPdf } from "./proposal-pdf";
import type { ProposalPdfCompany, ProposalPdfData } from "./proposal-pdf";

type Input = { kind: "invoice" | "proposal"; locale?: string; template: any; data: any };

function logo(t: any): string | null {
  if (t?.logoUrl?.startsWith("data:")) return t.logoUrl;
  try {
    const p = path.join(process.cwd(), "public", "logo.png");
    return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  } catch {
    return null;
  }
}

function invoiceTemplate(t: any): InvoiceTemplateData {
  return {
    companyName: t.companyName,
    contactName: t.contactName,
    addressLine1: t.addressLine1,
    addressLine2: t.addressLine2,
    city: t.city,
    postalCode: t.postalCode,
    country: t.country,
    email: t.email,
    website: t.website,
    phone: t.phone,
    taxId: t.taxId,
    bankName: t.bankName,
    bankIban: t.bankIban,
    bankBic: t.bankBic,
    bankAddress: t.bankAddress,
    senderBic: t.senderBic,
    payeeName: t.payeeName,
    logoUrl: t.logoUrl,
    logoBase64: logo(t),
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    headerTitle: t.headerTitle,
    introText: t.introText,
    footerText: t.footerText,
    closingText: t.closingText,
    taxNote: t.taxNote,
    labels: t.labels,
  };
}

function proposalCompany(t: any): ProposalPdfCompany {
  return {
    companyName: t?.companyName ?? "Code Craft",
    contactName: t?.contactName ?? undefined,
    addressLine1: t?.addressLine1 ?? undefined,
    addressLine2: t?.addressLine2 ?? undefined,
    postalCode: t?.postalCode ?? undefined,
    city: t?.city ?? undefined,
    country: t?.country ?? undefined,
    email: t?.email ?? undefined,
    website: t?.website ?? undefined,
    primaryColor: t?.primaryColor ?? "#1e3a5f",
    accentColor: t?.accentColor ?? "#e67e22",
    logoBase64: logo(t),
  };
}

const chunks: Buffer[] = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  const input: Input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const loc = (input.locale ?? "de").toLowerCase().split("-")[0];
  const locale = loc === "en" || loc === "ar" ? loc : "de";
  const pdf =
    input.kind === "proposal"
      ? generateProposalPdf(proposalCompany(input.template), input.data as ProposalPdfData, locale)
      : generateInvoicePdf(invoiceTemplate(input.template), input.data as InvoicePdfData, locale);
  process.stdout.write(Buffer.from(pdf));
});
