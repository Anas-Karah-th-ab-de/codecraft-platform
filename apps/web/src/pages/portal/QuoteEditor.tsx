// Angebot erstellen/bearbeiten: Kopf, Positionen in Blöcken, Meilensteine, Zahlungsplan, Live-Summen.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, useApi } from "../../api";
import { money, useI18n } from "../../i18n";
import { Field, Loading } from "../../ui";
import { PaymentSelect, PT } from "./Payment";

const QT = {
  de: { new: "Neues Angebot", edit: "Angebot bearbeiten", head: "Kopfdaten", customer: "Kunde", project: "Projekt (optional)", request: "Zu Anfrage (optional)",
    title: "Titel", desc: "Beschreibung", currency: "Währung", tax: "Steuer", lang: "Sprache", valid: "Gültig bis", start: "Projektstart", end: "Projektende",
    rate: "Stundensatz", advance: "Anzahlung %", notes: "Weitere Hinweise (Markdown)", items: "Positionen", block: "Block", blockTitle: "Block-Titel", pos: "Pos.",
    descr: "Beschreibung", qty: "Menge", unit: "Einheit", price: "Einzelpreis", total: "Gesamt", addItem: "+ Position", milestones: "Meilensteine", label: "Kürzel",
    mtitle: "Titel", blocks: "Blöcke", goal: "Ziel", addMs: "+ Meilenstein", payments: "Zahlungsplan", plabel: "Fällig / Bezeichnung", amount: "Betrag (brutto)",
    pdesc: "Hinweis", addPay: "+ Rate", autoPay: "Aus Anzahlung erzeugen", net: "Netto", vat: "USt. 19 %", gross: "Gesamt", save: "Speichern", cancel: "Abbrechen",
    payDiff: "Zahlungsplan weicht von der Summe ab", none: "—",
    kind: "Art", quote: "Angebot", contract: "Vertrag", newC: "Neuer Vertrag", cStart: "Vertragsbeginn", cEnd: "Vertragsende (leer = unbefristet)",
    interval: "Abrechnung", fee: "Entgelt je Zeitraum (netto)", notice: "Kündigungsfrist (Tage)", oneTime: "Einmalige Positionen (optional bei Verträgen)",
    iv: { monthly: "monatlich", quarterly: "vierteljährlich", yearly: "jährlich" },
    tx: { standard: "Standard (19 %)", reverse_charge: "Reverse Charge (0 %)", not_taxable: "Nicht steuerbar (0 %)" } },
  en: { new: "New quote", edit: "Edit quote", head: "Header", customer: "Customer", project: "Project (optional)", request: "For request (optional)",
    title: "Title", desc: "Description", currency: "Currency", tax: "Tax", lang: "Language", valid: "Valid until", start: "Project start", end: "Project end",
    rate: "Hourly rate", advance: "Advance %", notes: "Further notes (Markdown)", items: "Items", block: "Block", blockTitle: "Block title", pos: "Pos.",
    descr: "Description", qty: "Qty", unit: "Unit", price: "Unit price", total: "Total", addItem: "+ Item", milestones: "Milestones", label: "Label",
    mtitle: "Title", blocks: "Blocks", goal: "Goal", addMs: "+ Milestone", payments: "Payment schedule", plabel: "Due / label", amount: "Amount (gross)",
    pdesc: "Note", addPay: "+ Instalment", autoPay: "Create from advance", net: "Net", vat: "VAT 19 %", gross: "Total", save: "Save", cancel: "Cancel",
    payDiff: "Payment schedule differs from total", none: "—",
    kind: "Type", quote: "Quote", contract: "Contract", newC: "New contract", cStart: "Contract start", cEnd: "Contract end (empty = indefinite)",
    interval: "Billing", fee: "Fee per period (net)", notice: "Notice period (days)", oneTime: "One-time items (optional for contracts)",
    iv: { monthly: "monthly", quarterly: "quarterly", yearly: "yearly" },
    tx: { standard: "Standard (19 %)", reverse_charge: "Reverse charge (0 %)", not_taxable: "Not taxable (0 %)" } },
  ar: { new: "عرض جديد", edit: "تعديل العرض", head: "البيانات الأساسية", customer: "العميل", project: "المشروع (اختياري)", request: "للطلب (اختياري)",
    title: "العنوان", desc: "الوصف", currency: "العملة", tax: "الضريبة", lang: "اللغة", valid: "صالح حتى", start: "بداية المشروع", end: "نهاية المشروع",
    rate: "سعر الساعة", advance: "الدفعة المقدمة %", notes: "ملاحظات إضافية (Markdown)", items: "البنود", block: "القسم", blockTitle: "عنوان القسم", pos: "رقم",
    descr: "الوصف", qty: "الكمية", unit: "الوحدة", price: "سعر الوحدة", total: "الإجمالي", addItem: "+ بند", milestones: "المراحل", label: "الرمز",
    mtitle: "العنوان", blocks: "الأقسام", goal: "الهدف", addMs: "+ مرحلة", payments: "جدول الدفعات", plabel: "الاستحقاق / الوصف", amount: "المبلغ (إجمالي)",
    pdesc: "ملاحظة", addPay: "+ دفعة", autoPay: "إنشاء من الدفعة المقدمة", net: "الصافي", vat: "ضريبة 19 %", gross: "الإجمالي", save: "حفظ", cancel: "إلغاء",
    payDiff: "جدول الدفعات لا يطابق الإجمالي", none: "—",
    kind: "النوع", quote: "عرض سعر", contract: "عقد", newC: "عقد جديد", cStart: "بداية العقد", cEnd: "نهاية العقد (فارغ = غير محدد)",
    interval: "الفوترة", fee: "الرسوم لكل فترة (صافي)", notice: "مدة الإشعار (أيام)", oneTime: "بنود لمرة واحدة (اختيارية في العقود)",
    iv: { monthly: "شهرياً", quarterly: "كل ربع سنة", yearly: "سنوياً" },
    tx: { standard: "عادي (19 %)", reverse_charge: "احتساب عكسي (0 %)", not_taxable: "غير خاضع (0 %)" } },
};

type Item = { block_nr: string; block_title: string; position_nr: string; description: string; qty: string; unit: string; price: string };
type Ms = { label: string; title: string; blocks: string; goal: string };
type Pay = { label: string; due_date: string; amount: string; description: string };
type Form = {
  organization_id: string; project_id: string; request_id: string; title: string; description: string; revision: string; currency: string; tax_mode: string;
  locale: string; valid_until: string; project_start: string; project_end: string; hourly_rate: string; advance_percent: string; notes: string;
  items: Item[]; milestones: Ms[]; payments: Pay[];
  doc_kind: "quote" | "contract"; contract_start: string; contract_end: string; billing_interval: "monthly" | "quarterly" | "yearly";
  recurring: string; notice_days: string; payment_method_id: string;
};
const num = (s: string) => { const n = parseFloat(String(s).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const cents = (s: string) => Math.round(num(s) * 100);
const emptyItem = (prev?: Item): Item => ({ block_nr: prev?.block_nr ?? "1", block_title: prev?.block_title ?? "", position_nr: "", description: "", qty: "1", unit: prev?.unit ?? "Std.", price: prev?.price ?? "" });

export default function QuoteEditor() {
  const { locale } = useI18n();
  const T = QT[locale];
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const orgs = useApi<{ id: string; name: string; locale: string }[]>("/api/v1/organizations");
  const projects = useApi<{ id: string; name: string; organization_id: string | null }[]>("/api/v1/projects");
  const requests = useApi<{ id: string; number: string; title: string; organization_id: string }[]>("/api/v1/dev-requests");
  const [f, setF] = useState<Form | null>(id ? null : {
    organization_id: sp.get("org") ?? "", project_id: sp.get("project") ?? "", request_id: sp.get("request") ?? "", title: "", description: "", revision: "",
    currency: "EUR", tax_mode: "standard", locale: "", valid_until: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), project_start: "", project_end: "",
    hourly_rate: "", advance_percent: sp.get("kind") === "contract" ? "" : "30", notes: "",
    items: sp.get("kind") === "contract" ? [] : [emptyItem()], milestones: [], payments: [],
    doc_kind: sp.get("kind") === "contract" ? "contract" : "quote", contract_start: "", contract_end: "", billing_interval: "monthly",
    recurring: "", notice_days: "30", payment_method_id: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Bearbeiten: vorhandenes Angebot laden
  useEffect(() => {
    if (!id) return;
    api<any>(`/api/v1/quotes/${id}`).then((q) => setF({
      organization_id: q.organization_id, project_id: q.project_id ?? "", request_id: "", title: q.title, description: q.description ?? "", revision: q.revision ?? "",
      currency: q.currency, tax_mode: q.tax_mode, locale: q.locale, valid_until: q.valid_until ?? "", project_start: q.project_start ?? "", project_end: q.project_end ?? "",
      hourly_rate: q.hourly_rate_cents != null ? String(q.hourly_rate_cents / 100) : "", advance_percent: q.advance_percent != null ? String(q.advance_percent) : "", notes: q.notes ?? "",
      items: q.items.map((i: any) => ({ block_nr: i.block_nr != null ? String(i.block_nr) : "", block_title: i.block_title ?? "", position_nr: i.position_nr ?? "", description: i.description,
        qty: String(i.quantity_milli / 1000), unit: i.unit, price: String(i.unit_price_cents / 100) })),
      milestones: q.milestones.map((m: any) => ({ label: m.label, title: m.title, blocks: m.blocks ?? "", goal: m.goal ?? "" })),
      payments: q.payments.map((p: any) => ({ label: p.label, due_date: p.due_date ?? "", amount: String(p.amount_cents / 100), description: p.description ?? "" })),
      doc_kind: q.doc_kind ?? "quote", contract_start: q.contract_start ?? "", contract_end: q.contract_end ?? "", billing_interval: q.billing_interval ?? "monthly",
      recurring: q.recurring_cents != null ? String(q.recurring_cents / 100) : "", notice_days: q.notice_days != null ? String(q.notice_days) : "",
      payment_method_id: q.payment_method_id ?? "",
    })).catch((e) => setErr(e.message));
  }, [id]);

  const totals = useMemo(() => {
    if (!f) return { net: 0, tax: 0, gross: 0, lines: [] as number[] };
    const lines = f.items.map((i) => Math.round(num(i.qty) * cents(i.price)));
    const net = lines.reduce((a, b) => a + b, 0);
    const tax = f.tax_mode === "standard" ? Math.round(net * 0.19) : 0;
    return { net, tax, gross: net + tax, lines };
  }, [f]);
  if (!f) return <div className="card">{err ?? <Loading />}</div>;
  const m = (c: number) => money(c, locale, f.currency);
  const paySum = f.payments.reduce((a, p) => a + cents(p.amount), 0);
  const set = (patch: Partial<Form>) => setF({ ...f, ...patch });
  const setItem = (i: number, p: Partial<Item>) => set({ items: f.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setMs = (i: number, p: Partial<Ms>) => set({ milestones: f.milestones.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setPay = (i: number, p: Partial<Pay>) => set({ payments: f.payments.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const autoPay = () => {
    const a = Math.round(totals.gross * num(f.advance_percent) / 100);
    set({ payments: a > 0 && a < totals.gross
      ? [{ label: `Anzahlung ${f.advance_percent} %`, due_date: "", amount: (a / 100).toFixed(2), description: "" }, { label: "Nach Abnahme", due_date: "", amount: ((totals.gross - a) / 100).toFixed(2), description: "" }]
      : [{ label: "Nach Abnahme", due_date: "", amount: (totals.gross / 100).toFixed(2), description: "" }] });
  };
  const save = async () => {
    setErr(null); setBusy(true);
    try {
      const body = {
        organization_id: f.organization_id, project_id: f.project_id || null, request_id: f.request_id || null, title: f.title, description: f.description,
        revision: f.revision || null, currency: f.currency, tax_mode: f.tax_mode, locale: f.locale || null, valid_until: f.valid_until || null,
        project_start: f.project_start || null, project_end: f.project_end || null, hourly_rate_cents: f.hourly_rate ? cents(f.hourly_rate) : null,
        advance_percent: f.advance_percent ? Math.round(num(f.advance_percent)) : null, notes: f.notes,
        items: f.items.map((i) => ({ block_nr: i.block_nr ? parseInt(i.block_nr) : null, block_title: i.block_title || null, position_nr: i.position_nr || null,
          description: i.description, quantity_milli: Math.round(num(i.qty) * 1000), unit: i.unit, unit_price_cents: cents(i.price) })),
        milestones: f.milestones.map((x) => ({ label: x.label, title: x.title, blocks: x.blocks || null, goal: x.goal || null })),
        payments: f.payments.map((p) => ({ label: p.label, due_date: p.due_date || null, amount_cents: cents(p.amount), description: p.description || null })),
        payment_method_id: f.payment_method_id || null, doc_kind: f.doc_kind,
        ...(f.doc_kind === "contract" ? { contract_start: f.contract_start || null, contract_end: f.contract_end || null, billing_interval: f.billing_interval,
          recurring_cents: cents(f.recurring), notice_days: f.notice_days ? Math.round(num(f.notice_days)) : null } : {}),
      };
      if (id) { await api(`/api/v1/quotes/${id}`, { method: "PUT", body }); nav(`/portal/angebote/${id}`); }
      else { const r = await api<{ id: string }>("/api/v1/quotes", { body }); nav(`/portal/angebote/${r.id}`); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const dir = f.locale === "ar" ? "rtl" : undefined;
  return (
    <form className="quote-ed" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Link to={id ? `/portal/angebote/${id}` : "/portal/angebote"}>← {T.cancel}</Link>
      <h1>{id ? T.edit : f.doc_kind === "contract" ? T.newC : T.new}</h1>
      <div className="tabs" style={{ marginBottom: 12 }}>
        {(["quote", "contract"] as const).map((k) => (
          <button type="button" key={k} className={f.doc_kind === k ? "on" : ""} onClick={() => set({ doc_kind: k, items: k === "quote" && f.items.length === 0 ? [emptyItem()] : f.items })}>{T[k]}</button>
        ))}
      </div>
      {f.doc_kind === "contract" && (
        <div className="card grid2" style={{ marginBottom: 12 }}>
          <Field label={T.cStart}><input required type="date" value={f.contract_start} onChange={(e) => set({ contract_start: e.target.value })} /></Field>
          <Field label={T.cEnd}><input type="date" min={f.contract_start} value={f.contract_end} onChange={(e) => set({ contract_end: e.target.value })} /></Field>
          <Field label={T.interval}>
            <select value={f.billing_interval} onChange={(e) => set({ billing_interval: e.target.value as Form["billing_interval"] })}>
              {Object.entries(T.iv).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={`${T.fee} (${f.currency})`}><input required inputMode="decimal" value={f.recurring} onChange={(e) => set({ recurring: e.target.value })} /></Field>
          <Field label={T.notice}><input type="number" min={0} max={730} value={f.notice_days} onChange={(e) => set({ notice_days: e.target.value })} /></Field>
        </div>
      )}
      <div className="card grid2">
        <Field label={T.customer}>
          <select required value={f.organization_id} onChange={(e) => set({ organization_id: e.target.value, project_id: "", request_id: "", locale: orgs.data?.find((o) => o.id === e.target.value)?.locale ?? "" })}>
            <option value="">—</option>
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label={T.project}>
          <select value={f.project_id} onChange={(e) => set({ project_id: e.target.value })}>
            <option value="">{T.none}</option>
            {projects.data?.filter((p) => p.organization_id === f.organization_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        {!id && (
          <Field label={T.request}>
            <select value={f.request_id} onChange={(e) => { const r = requests.data?.find((x) => x.id === e.target.value); set({ request_id: e.target.value, title: f.title || r?.title || "" }); }}>
              <option value="">{T.none}</option>
              {requests.data?.filter((r) => r.organization_id === f.organization_id).map((r) => <option key={r.id} value={r.id}>{r.number} · {r.title}</option>)}
            </select>
          </Field>
        )}
        <Field label={T.lang}>
          <select value={f.locale} onChange={(e) => set({ locale: e.target.value })}>
            <option value="">{T.none}</option><option value="de">Deutsch</option><option value="en">English</option><option value="ar">العربية</option>
          </select>
        </Field>
        <Field label={T.title}><input required dir={dir} maxLength={300} value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Revision"><input placeholder="Rev. 1" value={f.revision} onChange={(e) => set({ revision: e.target.value })} /></Field>
        <Field label={T.currency}>
          <select value={f.currency} onChange={(e) => set({ currency: e.target.value })}>{["EUR", "USD", "CHF", "GBP", "SAR", "AED", "TRY"].map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label={T.tax}>
          <select value={f.tax_mode} onChange={(e) => set({ tax_mode: e.target.value })}>{Object.entries(T.tx).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        <Field label={T.valid}><input type="date" value={f.valid_until} onChange={(e) => set({ valid_until: e.target.value })} /></Field>
        <Field label={T.advance}><input type="number" min={0} max={100} value={f.advance_percent} onChange={(e) => set({ advance_percent: e.target.value })} /></Field>
        <Field label={T.start}><input type="date" value={f.project_start} onChange={(e) => set({ project_start: e.target.value })} /></Field>
        <Field label={T.end}><input type="date" min={f.project_start} value={f.project_end} onChange={(e) => set({ project_end: e.target.value })} /></Field>
        <Field label={T.rate}><input inputMode="decimal" value={f.hourly_rate} onChange={(e) => set({ hourly_rate: e.target.value })} /></Field>
        <Field label={PT[locale].method}><PaymentSelect value={f.payment_method_id} onChange={(v) => set({ payment_method_id: v })} /></Field>
      </div>
      <Field label={T.desc}><textarea dir={dir} rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>

      <h2>{f.doc_kind === "contract" ? T.oneTime : T.items}</h2>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="qe-items" dir={dir}>
          <thead><tr><th>{T.block}</th><th>{T.blockTitle}</th><th>{T.pos}</th><th style={{ minWidth: 260 }}>{T.descr}</th><th>{T.qty}</th><th>{T.unit}</th><th>{T.price}</th><th className="n">{T.total}</th><th /></tr></thead>
          <tbody>
            {f.items.map((it, i) => (
              <tr key={i}>
                <td><input style={{ width: 50 }} inputMode="numeric" value={it.block_nr} onChange={(e) => setItem(i, { block_nr: e.target.value })} /></td>
                <td><input value={it.block_title} onChange={(e) => setItem(i, { block_title: e.target.value })} /></td>
                <td><input style={{ width: 60 }} value={it.position_nr} onChange={(e) => setItem(i, { position_nr: e.target.value })} /></td>
                <td><textarea required rows={2} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></td>
                <td><input required style={{ width: 70 }} inputMode="decimal" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></td>
                <td><input required style={{ width: 80 }} list="units" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
                <td><input required style={{ width: 100 }} inputMode="decimal" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} /></td>
                <td className="n"><bdi dir="ltr">{m(totals.lines[i] ?? 0)}</bdi></td>
                <td><button type="button" className="btn small ghost" disabled={f.items.length === 1 && f.doc_kind === "quote"} onClick={() => set({ items: f.items.filter((_, j) => j !== i) })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="units">{["Std.", "Stk.", "Tag", "Monat", "Pauschale", "Lizenz", "hours", "pcs", "ساعة", "حزمة"].map((u) => <option key={u} value={u} />)}</datalist>
        <div className="row between" style={{ padding: "10px 14px" }}>
          <button type="button" className="btn small" onClick={() => set({ items: [...f.items, emptyItem(f.items[f.items.length - 1])] })}>{T.addItem}</button>
          <div style={{ textAlign: "end" }}>
            <div>{T.net}: <bdi dir="ltr">{m(totals.net)}</bdi></div>
            {f.tax_mode === "standard" && <div>{T.vat}: <bdi dir="ltr">{m(totals.tax)}</bdi></div>}
            <div style={{ fontWeight: 700, fontSize: "1.15em" }}>{T.gross}: <bdi dir="ltr">{m(totals.gross)}</bdi></div>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16, alignItems: "start" }}>
        <div className="card">
          <h3>{T.milestones}</h3>
          {f.milestones.map((x, i) => (
            <div key={i} className="qe-row">
              <input style={{ width: 60 }} required placeholder="M1" value={x.label} onChange={(e) => setMs(i, { label: e.target.value })} />
              <input required placeholder={T.mtitle} value={x.title} onChange={(e) => setMs(i, { title: e.target.value })} />
              <input placeholder={T.blocks} value={x.blocks} onChange={(e) => setMs(i, { blocks: e.target.value })} />
              <input placeholder={T.goal} value={x.goal} onChange={(e) => setMs(i, { goal: e.target.value })} />
              <button type="button" className="btn small ghost" onClick={() => set({ milestones: f.milestones.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn small" onClick={() => set({ milestones: [...f.milestones, { label: `M${f.milestones.length + 1}`, title: "", blocks: "", goal: "" }] })}>{T.addMs}</button>
        </div>
        <div className="card">
          <h3>{T.payments}</h3>
          {f.payments.map((p, i) => (
            <div key={i} className="qe-row">
              <input required placeholder={T.plabel} value={p.label} onChange={(e) => setPay(i, { label: e.target.value })} />
              <input type="date" style={{ width: "auto" }} value={p.due_date} onChange={(e) => setPay(i, { due_date: e.target.value })} />
              <input required style={{ width: 110 }} inputMode="decimal" placeholder={T.amount} value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} />
              <button type="button" className="btn small ghost" onClick={() => set({ payments: f.payments.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <div className="row">
            <button type="button" className="btn small" onClick={() => set({ payments: [...f.payments, { label: "", due_date: "", amount: "", description: "" }] })}>{T.addPay}</button>
            <button type="button" className="btn small ghost" onClick={autoPay}>{T.autoPay}</button>
          </div>
          {f.payments.length > 0 && paySum !== totals.gross && <div className="alert">{T.payDiff}: {m(paySum)} ≠ {m(totals.gross)}</div>}
        </div>
      </div>
      <Field label={T.notes}><textarea dir={dir} rows={6} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      {err && <div className="alert">{err}</div>}
      <div className="row" style={{ margin: "12px 0 40px" }}>
        <button className="btn" disabled={busy}>{T.save}</button>
        <Link className="btn ghost" to={id ? `/portal/angebote/${id}` : "/portal/angebote"}>{T.cancel}</Link>
      </div>
    </form>
  );
}
