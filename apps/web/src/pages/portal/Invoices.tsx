import { useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, can, openPdf, useApi, useAuth } from "../../api";
import { fmtDate, money, useI18n, type Key, type Locale } from "../../i18n";
import { Badge, Field, Loading, Modal, toCents, useSubmit } from "../../ui";
import { PaymentBox, PaymentSelect, PT, type PaymentInfo } from "./Payment";

type I18n = { de: string; en: string; ar: string };
export type Price = { id: string; product_id: string; code: string; name: I18n; billing: string; amount_cents: number | null; is_active: boolean; currency: string; features: any };
export type Product = {
  id: string; sku: string; slug: string; kind: string; department_id: string; department_code: string; device_kind: string | null;
  name: I18n; description: I18n; is_public: boolean; is_active: boolean; prices: Price[];
  images: { id: string; card: string; full: string; width: number; height: number }[];
};
type Org = { id: string; name: string; locale: string; vat_id: string | null };
type Inv = {
  id: string; organization_id: string; kind: string; number: string | null; status: string; currency: string; locale: string;
  tax_mode: string; gross_cents: number | null; created_at: string; issue_date: string | null; due_date: string | null;
  recipient_name: string | null; notes: string;
  project_id: string | null; project_name: string | null; service_from: string | null; service_to: string | null; legacy: boolean;
};
type Item = { description: string; quantity_milli: number; unit: string; unit_price: number; vat_rate_bp: number; product_id: string | null; price_id: string | null };
type Detail = Inv & { items: Item[]; totals: { net: number; tax: number; gross: number }; tax_notice: string | null; payment: PaymentInfo | null };

export default function Invoices() {
  return (
    <Routes>
      <Route index element={<InvoiceList />} />
      <Route path=":id" element={<InvoiceDetail />} />
    </Routes>
  );
}

function InvoiceList() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, error } = useApi<Inv[]>(`/api/v1/invoices${status ? `?status=${status}` : ""}`, [status]);
  const orgs = useApi<Org[]>("/api/v1/organizations");
  const [creating, setCreating] = useState(false);
  const orgName = (id: string) => orgs.data?.find((o) => o.id === id)?.name ?? "…";
  const rows = (data ?? []).filter((i) => !q || `${i.number ?? ""} ${orgName(i.organization_id)}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="row between">
        <h1>{t("p.invoices")}</h1>
        {can(me, "invoice_write") && <button className="btn" onClick={() => setCreating(true)}>+ {t("p.new")}</button>}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder={t("p.search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <div className="tabs" style={{ margin: 0 }}>
          {["", "draft", "issued", "paid", "cancelled"].map((s) => (
            <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>
              {s ? t(`st.${s}` as Key) : "∑"}
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : rows.length === 0 ? <p className="spin">{t("p.empty")}</p> : (
          <table>
            <thead><tr><th>{t("p.number")}</th><th>{t("p.customer")}</th><th>{t("p.date")}</th><th>{t("p.status")}</th><th className="n">{t("p.total")}</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/portal/rechnungen/${i.id}`}>{i.number ?? `${t("st.draft")} …${i.id.slice(-6)}`}</Link>{i.kind === "credit_note" && " ↩"}</td>
                  <td>{orgName(i.organization_id)}{i.project_name && <div className="muted" style={{ fontSize: ".85em" }}>{i.project_name}</div>}</td>
                  <td>{fmtDate(i.issue_date ?? i.created_at, locale)}</td>
                  <td><Badge s={i.status} /></td>
                  <td className="n">{i.gross_cents != null ? money(i.gross_cents, locale, i.currency) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <InvoiceEditor onClose={() => setCreating(false)} />}
    </>
  );
}

type Row = { mode: "catalog" | "free"; price_id: string; description: string; qty: string; unit: string; unit_price: string; vat: string };
const emptyRow = (): Row => ({ mode: "catalog", price_id: "", description: "", qty: "1", unit: "hour", unit_price: "", vat: "19" });

/** Neue Rechnung bzw. Positionen eines Entwurfs bearbeiten */
function InvoiceEditor({ onClose, draft }: { onClose: () => void; draft?: Detail }) {
  const { t, locale } = useI18n();
  const nav = useNavigate();
  const orgs = useApi<Org[]>("/api/v1/organizations");
  const products = useApi<Product[]>("/api/v1/products");
  const [org, setOrg] = useState(draft?.organization_id ?? "");
  const [taxMode, setTaxMode] = useState(draft?.tax_mode ?? "standard");
  const [invLocale, setInvLocale] = useState<string>(draft?.locale ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [payment, setPayment] = useState("");
  const [rows, setRows] = useState<Row[]>(
    draft?.items.map((i) => ({
      mode: i.price_id ? "catalog" : "free", price_id: i.price_id ?? "", description: i.description,
      qty: String(i.quantity_milli / 1000), unit: i.unit, unit_price: String(i.unit_price / 100), vat: String(i.vat_rate_bp / 100),
    })) ?? [emptyRow()],
  );
  const s = useSubmit();

  const prices = useMemo(() => {
    const m = new Map<string, { p: Product; pr: Price }>();
    products.data?.filter((p) => p.is_active).forEach((p) => p.prices.filter((x) => x.is_active).forEach((pr) => m.set(pr.id, { p, pr })));
    return m;
  }, [products.data]);

  const rowNet = (r: Row) => {
    const q = parseFloat(r.qty.replace(",", ".")) || 0;
    const cat = r.mode === "catalog" ? prices.get(r.price_id)?.pr : undefined;
    const up = cat?.amount_cents ?? (toCents(r.unit_price || "0") || 0);
    return Math.round(q * up);
  };
  const net = rows.reduce((s, r) => s + rowNet(r), 0);
  const tax = taxMode === "standard" ? rows.reduce((s, r) => s + Math.round((rowNet(r) * (parseFloat(r.vat) || 0)) / 100), 0) : 0;
  const upd = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const items = () =>
    rows.map((r) => {
      const base = { quantity_milli: Math.round((parseFloat(r.qty.replace(",", ".")) || 0) * 1000), vat_rate_bp: Math.round((parseFloat(r.vat) || 0) * 100) };
      if (r.mode === "catalog") {
        const cat = prices.get(r.price_id)?.pr;
        return { ...base, price_id: r.price_id, ...(cat?.amount_cents == null ? { unit_price: toCents(r.unit_price || "0"), unit: r.unit } : {}) };
      }
      return { ...base, description: r.description, unit: r.unit, unit_price: toCents(r.unit_price || "0") };
    });

  const save = async () => {
    if (draft) {
      await api(`/api/v1/invoices/${draft.id}/items`, { method: "PUT", body: { items: items() } });
      onClose();
    } else {
      const d = await api<Detail>("/api/v1/invoices", {
        body: { organization_id: org, tax_mode: taxMode, locale: invLocale || undefined, notes, items: items(), payment_method_id: payment || null },
      });
      nav(`/portal/rechnungen/${d.id}`);
    }
  };

  return (
    <Modal title={draft ? t("p.items") : `${t("p.invoices")} – ${t("p.new")}`} onClose={onClose}>
      <form onSubmit={s.run(save)}>
        {!draft && (
          <div className="grid2">
            <Field label={t("p.customer")}>
              <select required value={org} onChange={(e) => { setOrg(e.target.value); setInvLocale(orgs.data?.find((o) => o.id === e.target.value)?.locale ?? ""); }}>
                <option value="">—</option>
                {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label={t("p.language")}>
              <select value={invLocale} onChange={(e) => setInvLocale(e.target.value)}>
                <option value="">—</option><option value="de">Deutsch</option><option value="en">English</option><option value="ar">العربية</option>
              </select>
            </Field>
            <Field label={t("p.tax_mode")}>
              <select value={taxMode} onChange={(e) => setTaxMode(e.target.value)}>
                {["standard", "reverse_charge", "not_taxable"].map((m) => <option key={m} value={m}>{t(`tax.${m}` as Key)}</option>)}
              </select>
            </Field>
            <Field label={PT[locale].method}><PaymentSelect value={payment} onChange={setPayment} /></Field>
          </div>
        )}
        <h3>{t("p.items")}</h3>
        {rows.map((r, i) => {
          const cat = r.mode === "catalog" ? prices.get(r.price_id)?.pr : undefined;
          return (
            <div key={i} className="card" style={{ padding: 12, marginBottom: 8 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <div className="tabs" style={{ margin: 0 }}>
                  <button type="button" className={r.mode === "catalog" ? "on" : ""} onClick={() => upd(i, { mode: "catalog" })}>{t("p.from_catalog")}</button>
                  <button type="button" className={r.mode === "free" ? "on" : ""} onClick={() => upd(i, { mode: "free" })}>{t("p.free_text")}</button>
                </div>
                <span style={{ flex: 1 }} />
                <b>{money(rowNet(r), locale)}</b>
                {rows.length > 1 && <button type="button" className="btn ghost small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>}
              </div>
              <div className="grid2">
                {r.mode === "catalog" ? (
                  <Field label={t("p.product")}>
                    <select required value={r.price_id} onChange={(e) => upd(i, { price_id: e.target.value })}>
                      <option value="">—</option>
                      {products.data?.filter((p) => p.is_active).map((p) => (
                        <optgroup key={p.id} label={`${p.name[locale as Locale]} (${p.department_code})`}>
                          {p.prices.filter((x) => x.is_active).map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name[locale as Locale]} – {pr.amount_cents == null ? t("billing.on_request") : `${money(pr.amount_cents, locale)} ${t(`billing.${pr.billing}` as Key)}`}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label={t("p.description")}><input required value={r.description} onChange={(e) => upd(i, { description: e.target.value })} /></Field>
                )}
                <Field label={t("p.qty")}><input required inputMode="decimal" value={r.qty} onChange={(e) => upd(i, { qty: e.target.value })} /></Field>
                {(r.mode === "free" || (cat && cat.amount_cents == null)) && (
                  <>
                    <Field label={t("p.unit_price")}><input required inputMode="decimal" value={r.unit_price} onChange={(e) => upd(i, { unit_price: e.target.value })} /></Field>
                    <Field label={t("p.unit")}>
                      <select value={r.unit} onChange={(e) => upd(i, { unit: e.target.value })}>
                        {["hour", "piece", "day", "month", "flat"].map((u) => <option key={u} value={u}>{t(`unit.${u}` as Key)}</option>)}
                      </select>
                    </Field>
                  </>
                )}
                <Field label={t("p.vat")}><input inputMode="decimal" value={r.vat} onChange={(e) => upd(i, { vat: e.target.value })} /></Field>
              </div>
            </div>
          );
        })}
        <button type="button" className="btn ghost small" onClick={() => setRows([...rows, emptyRow()])}>+ {t("p.add_item")}</button>
        {!draft && <Field label={t("p.notes")}><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>}
        <div className="row between" style={{ marginTop: 14 }}>
          <div>{t("p.net")}: <b>{money(net, locale)}</b> · {t("p.tax")}: {money(tax, locale)} · {t("p.gross")}: <b>{money(net + tax, locale)}</b></div>
          <div className="row">
            <button type="button" className="btn ghost" onClick={onClose}>{t("p.cancel")}</button>
            <button className="btn" disabled={s.busy}>{t("p.save")}</button>
          </div>
        </div>
        {s.error && <div className="alert">{s.error}</div>}
      </form>
    </Modal>
  );
}

function InvoiceDetail() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const nav = useNavigate();
  const { data: d, error, reload } = useApi<Detail>(`/api/v1/invoices/${id}`, [id]);
  const orgs = useApi<Org[]>("/api/v1/organizations");
  const [editing, setEditing] = useState(false);
  const s = useSubmit();
  if (!d) return <Loading error={error} />;
  const act = (path: string, confirmKey?: Key) => s.run(async () => {
    if (confirmKey && !confirm(t(confirmKey))) return;
    const r = await api<Detail>(`/api/v1/invoices/${d.id}/${path}`, { method: "POST" });
    if (r.id !== d.id) nav(`/portal/rechnungen/${r.id}`);
    else reload();
  });
  const unitLabel = (u: string) => ({ hour: "h", piece: "×", day: "d", month: "M", flat: "" } as Record<string, string>)[u] ?? u;
  return (
    <>
      <Link to="/portal/rechnungen">← {t("p.invoices")}</Link>
      <div className="row between" style={{ marginTop: 10 }}>
        <h1 style={{ margin: 0 }}>
          {d.kind === "credit_note" ? "↩ " : ""}{d.number ?? t("st.draft")} <Badge s={d.status} />
        </h1>
        <div className="row">
          <button className="btn ghost" onClick={s.run(() => openPdf(`/api/v1/invoices/${d.id}/pdf`))}>⬇ {t("p.pdf")}</button>
          {d.status === "draft" && can(me, "invoice_write") && (
            <>
              <button className="btn ghost" onClick={() => setEditing(true)}>✎ {t("p.items")}</button>
              <button className="btn ghost danger" style={{ color: "var(--bad)", borderColor: "var(--bad)", background: "transparent" }}
                onClick={s.run(async () => { if (confirm(t("p.delete") + "?")) { await api(`/api/v1/invoices/${d.id}`, { method: "DELETE" }); nav("/portal/rechnungen"); } })}>
                {t("p.delete")}
              </button>
            </>
          )}
          {d.status === "draft" && can(me, "invoice_issue") && <button className="btn" onClick={act("issue", "p.confirm_issue")}>{t("p.issue")}</button>}
          {d.status === "issued" && d.kind === "invoice" && can(me, "invoice_issue") && <button className="btn ok" onClick={act("pay")}>✓ {t("p.pay")}</button>}
          {["issued", "paid"].includes(d.status) && d.kind === "invoice" && can(me, "invoice_issue") && (
            <button className="btn danger" onClick={act("cancel", "p.confirm_storno")}>{t("p.storno")}</button>
          )}
        </div>
      </div>
      {s.error && <div className="alert">{s.error}</div>}
      <div className="grid2" style={{ margin: "16px 0" }}>
        <div className="card">
          <div className="muted">{t("p.customer")}</div>
          <b>{d.recipient_name ?? orgs.data?.find((o) => o.id === d.organization_id)?.name}</b>
          {d.project_id && <div><Link to={`/portal/projekte/${d.project_id}`}>{d.project_name}</Link></div>}
        </div>
        {d.service_from && (
          <div className="card">
            <div className="muted">{t("p.service_period")}</div>
            <b>{fmtDate(d.service_from, locale)} – {fmtDate(d.service_to, locale)}</b>
          </div>
        )}
        <div className="card">
          <div className="muted">{t("p.date")}</div>
          <b>{fmtDate(d.issue_date, locale)}</b> {d.due_date && <span className="muted">→ {fmtDate(d.due_date, locale)}</span>}
        </div>
        <div className="card">
          <div className="muted">{t("p.tax_mode")} · {t("p.language")}</div>
          <b>{t(`tax.${d.tax_mode}` as Key)} · {d.locale.toUpperCase()}</b>
          {d.legacy && <div className="muted" style={{ fontSize: ".85em" }}>↺ {t("p.legacy")}</div>}
        </div>
        {(d.payment || d.status === "draft") && (
          <div className="card">
            <PaymentBox p={d.payment} />
            {d.status === "draft" && can(me, "invoice_write") && (
              <div style={{ marginTop: 6 }}>
                <PaymentSelect required value={d.payment?.id ?? ""} onChange={(v) => s.run(async () => {
                  await api(`/api/v1/invoices/${d.id}/payment-method`, { method: "PUT", body: { payment_method_id: v } });
                  reload();
                })()} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>#</th><th>{t("p.description")}</th><th className="n">{t("p.qty")}</th><th className="n">{t("p.unit_price")}</th><th className="n">{t("p.vat")}</th><th className="n">{t("p.total")}</th></tr></thead>
          <tbody>
            {d.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.description} {it.price_id && <span className="badge" title="Katalog">✓</span>}</td>
                <td className="n">{it.quantity_milli / 1000} {unitLabel(it.unit)}</td>
                <td className="n">{money(it.unit_price, locale, d.currency)}</td>
                <td className="n">{it.vat_rate_bp / 100}%</td>
                <td className="n">{money(Math.round((it.quantity_milli * it.unit_price) / 1000), locale, d.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 16, textAlign: "end" }}>
          <div>{t("p.net")}: {money(d.totals.net, locale, d.currency)}</div>
          <div>{t("p.tax")}: {money(d.totals.tax, locale, d.currency)}</div>
          <div style={{ fontSize: "1.3em" }}><b>{t("p.gross")}: {money(d.totals.gross, locale, d.currency)}</b></div>
          {d.tax_notice && <div className="muted" style={{ marginTop: 6 }}>{d.tax_notice}</div>}
        </div>
      </div>
      {editing && <InvoiceEditor draft={d} onClose={() => { setEditing(false); reload(); }} />}
    </>
  );
}
