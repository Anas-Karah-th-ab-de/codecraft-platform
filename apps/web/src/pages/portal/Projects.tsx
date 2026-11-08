import { Fragment, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, can, openPdf, useApi, useAuth } from "../../api";
import { fmtDate, money, useI18n, type Key } from "../../i18n";
import { Badge, Field, Loading, Modal, useSubmit } from "../../ui";
import { ProgressBar, ProjectProgress, type Milestone, type Update } from "./Progress";
import QuoteEditor from "./QuoteEditor";

type InvRow = {
  id: string; number: string | null; status: string; kind: string; currency: string; gross_cents: number | null;
  issue_date: string | null; created_at: string; service_from: string | null; service_to: string | null;
};
type Project = {
  id: string; organization_id: string | null; organization_name: string | null; name: string; slug: string; code: string | null;
  description: string; status: string; repo_url: string | null; start_date: string | null; target_date: string | null;
  invoice_count: number; quote_count: number; invoiced_cents: number; open_cents: number;
  progress: number; milestones_total: number; milestones_done: number;
  kind: "customer" | "internal" | "opensource"; license: string | null; is_public: boolean; budget_hours: number | null; department_code: string | null;
};

const PK = {
  de: { new: "Neues Projekt", kind: "Art", customer: "Kundenprojekt", internal: "Intern", opensource: "Open Source", name: "Name", client: "Kunde",
    dept: "Abteilung", desc: "Beschreibung", start: "Start", end: "Ziel", budget: "Budget (Stunden)", repo: "Repository (https://…)", license: "Lizenz",
    pub: "Auf der Webseite zeigen", create: "Anlegen", status: "Status" },
  en: { new: "New project", kind: "Type", customer: "Customer project", internal: "Internal", opensource: "Open source", name: "Name", client: "Customer",
    dept: "Department", desc: "Description", start: "Start", end: "Target", budget: "Budget (hours)", repo: "Repository (https://…)", license: "License",
    pub: "Show on the website", create: "Create", status: "Status" },
  ar: { new: "مشروع جديد", kind: "النوع", customer: "مشروع عميل", internal: "داخلي", opensource: "مفتوح المصدر", name: "الاسم", client: "العميل",
    dept: "القسم", desc: "الوصف", start: "البداية", end: "الهدف", budget: "الميزانية (ساعات)", repo: "المستودع (https://…)", license: "الترخيص",
    pub: "عرض على الموقع", create: "إنشاء", status: "الحالة" },
};

function NewProject({ onClose }: { onClose: () => void }) {
  const { locale } = useI18n();
  const T = PK[locale];
  const nav = useNavigate();
  const orgs = useApi<{ id: string; name: string }[]>("/api/v1/organizations");
  const depts = useApi<{ code: string; name: { de: string; en: string; ar: string } }[]>("/api/v1/departments");
  const [f, setF] = useState({ kind: "internal", name: "", organization_id: "", department: "DEV", description: "", start_date: "", target_date: "",
    budget_hours: "", repo_url: "", license: "", is_public: false, status: "planning" });
  const s = useSubmit();
  return (
    <Modal title={T.new} onClose={onClose}>
      <form onSubmit={s.run(async () => {
        const r = await api<{ id: string }>("/api/v1/projects", { body: {
          ...f, organization_id: f.kind === "customer" ? f.organization_id : null, start_date: f.start_date || null, target_date: f.target_date || null,
          budget_hours: f.budget_hours ? +f.budget_hours : null, repo_url: f.repo_url || null, license: f.license || null, is_public: f.kind === "opensource" && f.is_public,
        } });
        nav(`/portal/projekte/${r.id}`);
      })}>
        <Field label={T.kind}>
          <div className="seg">
            {(["customer", "internal", "opensource"] as const).map((k) => <button type="button" key={k} className={f.kind === k ? "on" : ""} onClick={() => setF({ ...f, kind: k })}>{T[k]}</button>)}
          </div>
        </Field>
        <Field label={T.name}><input required maxLength={200} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid2">
          {f.kind === "customer" && (
            <Field label={T.client}>
              <select required value={f.organization_id} onChange={(e) => setF({ ...f, organization_id: e.target.value })}>
                <option value="">—</option>
                {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          )}
          <Field label={T.dept}>
            <select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
              {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.name[locale]}</option>)}
            </select>
          </Field>
          <Field label={T.start}><input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label={T.end}><input type="date" min={f.start_date} value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} /></Field>
          <Field label={T.budget}><input type="number" min={0} value={f.budget_hours} onChange={(e) => setF({ ...f, budget_hours: e.target.value })} /></Field>
          <Field label={T.repo}><input dir="ltr" type="url" pattern="https://.*" value={f.repo_url} onChange={(e) => setF({ ...f, repo_url: e.target.value })} /></Field>
          {f.kind === "opensource" && <>
            <Field label={T.license}><input dir="ltr" list="licenses" maxLength={60} value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} /></Field>
            <datalist id="licenses">{["MIT", "Apache-2.0", "GPL-3.0", "AGPL-3.0", "MPL-2.0", "BSD-3-Clause"].map((l) => <option key={l} value={l} />)}</datalist>
            <label className="row" style={{ gap: 6, alignSelf: "end" }}><input type="checkbox" style={{ width: "auto" }} checked={f.is_public} onChange={(e) => setF({ ...f, is_public: e.target.checked })} />{T.pub}</label>
          </>}
        </div>
        <Field label={T.desc}><textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {s.error && <div className="alert">{s.error}</div>}
        <button className="btn" disabled={s.busy}>{T.create}</button>
      </form>
    </Modal>
  );
}
type QuoteRow = {
  id: string; organization_id: string; organization_name: string; project_id: string | null; project_name: string | null;
  number: string; title: string; revision: string | null; status: string; currency: string; tax_mode: string; locale: string;
  valid_until: string | null; net_cents: number; tax_cents: number; gross_cents: number; sent_at: string | null; created_at: string;
};
type QuoteDetail = QuoteRow & {
  description: string; notes: string; tax_note: string | null; project_start: string | null; project_end: string | null;
  hourly_rate_cents: number | null; discounted_rate_cents: number | null; total_hours_milli: number | null; advance_percent: number | null;
  customer_response: string | null; responded_at: string | null;
  items: { block_nr: number | null; block_title: string | null; position_nr: string | null; description: string; quantity_milli: number; unit: string; unit_price_cents: number; total_cents: number }[];
  milestones: { label: string; title: string; blocks: string | null; goal: string | null }[];
  payments: { label: string; due_date: string | null; amount_cents: number; currency: string; description: string | null; paid_at: string | null }[];
};

const qty = (m: number) => (m % 1000 === 0 ? String(m / 1000) : (m / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 }));

export function Projects() {
  return (
    <Routes>
      <Route index element={<ProjectList />} />
      <Route path=":id" element={<ProjectDetail />} />
    </Routes>
  );
}

export function Quotes() {
  return (
    <Routes>
      <Route index element={<QuoteList />} />
      <Route path="neu" element={<QuoteEditor />} />
      <Route path=":id/bearbeiten" element={<QuoteEditor />} />
      <Route path=":id" element={<QuoteView />} />
    </Routes>
  );
}

function ProjectList() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data, error } = useApi<Project[]>("/api/v1/projects");
  const [q, setQ] = useState("");
  const rows = (data ?? []).filter((p) => !q || `${p.name} ${p.code ?? ""} ${p.organization_name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="row between">
        <h1>{t("p.projects")}</h1>
        {me?.is_employee && can(me, "invoice_write") && <button className="btn" onClick={() => setCreating(true)}>+ {PK[locale].new}</button>}
      </div>
      {creating && <NewProject onClose={() => setCreating(false)} />}
      <input placeholder={t("p.search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, marginBottom: 12 }} />
      {!data ? <Loading error={error} /> : rows.length === 0 ? <div className="card"><p className="spin">{t("p.empty")}</p></div> : (
        <div className="grid">
          {rows.map((p) => (
            <Link key={p.id} to={`/portal/projekte/${p.id}`} className="card proj">
              <div className="row between"><Badge s={p.status} />{p.code && <code className="muted">{p.code}</code>}</div>
              <h3>{p.name}</h3>
              <div className="muted">{p.organization_name ?? PK[locale][p.kind]}{p.kind === "opensource" && ` · ${p.license ?? "OSS"}${p.is_public ? " · 🌐" : ""}`}</div>
              {(p.milestones_total > 0 || p.progress > 0) && <div style={{ margin: "8px 0" }}><ProgressBar value={p.progress} /></div>}
              <div className="row between proj-num">
                <span>{p.invoice_count} {t("p.invoices")} · {p.quote_count} {t("p.quotes")}</span>
                {p.invoiced_cents > 0 && <b>{money(p.invoiced_cents, locale, "EUR")}</b>}
              </div>
              {p.open_cents > 0 && <div className="badge issued">{t("p.open")}: {money(p.open_cents, locale, "EUR")}</div>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function ProjectDetail() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const { data: p, error, reload } = useApi<Project & { invoices: InvRow[]; quotes: QuoteRow[]; milestones: Milestone[]; updates: Update[] }>(`/api/v1/projects/${id}`, [id]);
  if (!p) return <Loading error={error} />;
  return (
    <>
      <Link to="/portal/projekte">← {t("p.projects")}</Link>
      <div className="row" style={{ margin: "8px 0" }}>
        <h1 style={{ margin: 0 }}>{p.name}</h1><Badge s={p.status} />
      </div>
      {p.description && <p className="muted" style={{ whiteSpace: "pre-line" }}>{p.description}</p>}
      <ProjectProgress projectId={p.id} progress={p.progress} milestones={p.milestones} updates={p.updates} onChange={reload} />
      <div className="grid2" style={{ margin: "16px 0" }}>
        <div className="card"><div className="muted">{t("p.customer")}</div><b>{p.organization_name ?? t("p.internal")}</b></div>
        <div className="card"><div className="muted">{t("p.period")}</div><b>{fmtDate(p.start_date, locale)}</b> → {fmtDate(p.target_date, locale)}</div>
        <div className="card"><div className="muted">{t("p.invoiced")}</div><b>{money(p.invoiced_cents, locale, "EUR")}</b>
          {p.open_cents > 0 && <span className="muted"> · {t("p.open")} {money(p.open_cents, locale, "EUR")}</span>}</div>
        {p.repo_url && <div className="card"><div className="muted">Repository</div><a href={p.repo_url} target="_blank" rel="noopener noreferrer" dir="ltr">{p.repo_url.replace("https://github.com/", "")}</a></div>}
      </div>
      <h2>{t("p.invoices")}</h2>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        {p.invoices.length === 0 ? <p className="spin">{t("p.empty")}</p> : (
          <table>
            <thead><tr><th>{t("p.number")}</th><th>{t("p.period")}</th><th>{t("p.status")}</th><th className="n">{t("p.total")}</th></tr></thead>
            <tbody>{p.invoices.map((i) => (
              <tr key={i.id}>
                <td><Link to={`/portal/rechnungen/${i.id}`}>{i.number ?? t("st.draft")}</Link>{i.kind === "credit_note" && " ↩"}</td>
                <td>{i.service_from ? `${fmtDate(i.service_from, locale)} – ${fmtDate(i.service_to, locale)}` : fmtDate(i.issue_date ?? i.created_at, locale)}</td>
                <td><Badge s={i.status} /></td>
                <td className="n">{i.gross_cents != null ? money(i.gross_cents, locale, i.currency) : "–"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <h2>{t("p.quotes")}</h2>
      <QuoteTable rows={p.quotes} />
    </>
  );
}

function QuoteTable({ rows, showCustomer }: { rows: QuoteRow[]; showCustomer?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <div className="card" style={{ padding: 0 }}>
      {rows.length === 0 ? <p className="spin">{t("p.empty")}</p> : (
        <table>
          <thead><tr><th>{t("p.number")}</th><th>{t("p.title")}</th>{showCustomer && <th>{t("p.customer")}</th>}<th>{t("p.status")}</th><th className="n">{t("p.total")}</th></tr></thead>
          <tbody>{rows.map((q) => (
            <tr key={q.id}>
              <td style={{ whiteSpace: "nowrap" }}><Link to={`/portal/angebote/${q.id}`}>{q.number}</Link></td>
              <td dir="auto">{q.title}{q.revision && <span className="muted"> · {q.revision}</span>}</td>
              {showCustomer && <td dir="auto">{q.organization_name}</td>}
              <td><Badge s={q.status} /></td>
              <td className="n">{money(q.gross_cents, locale, q.currency)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

const QA = {
  de: { new: "Neues Angebot", edit: "Bearbeiten", send: "An Kunden senden", sendQ: "Angebot jetzt an den Kunden senden? Danach ist es nicht mehr änderbar.",
    del: "Löschen", copy: "Als neue Revision kopieren", accept: "Angebot annehmen", reject: "Ablehnen", comment: "Kommentar (optional)",
    invFull: "Rechnung (komplett)", invAdv: "Anzahlungsrechnung", invPay: "Rechnung Rate", response: "Antwort des Kunden", acceptQ: "Angebot verbindlich annehmen?" },
  en: { new: "New quote", edit: "Edit", send: "Send to customer", sendQ: "Send this quote to the customer now? It can't be changed afterwards.",
    del: "Delete", copy: "Copy as new revision", accept: "Accept quote", reject: "Decline", comment: "Comment (optional)",
    invFull: "Invoice (full)", invAdv: "Advance invoice", invPay: "Invoice instalment", response: "Customer response", acceptQ: "Accept this quote bindingly?" },
  ar: { new: "عرض جديد", edit: "تعديل", send: "إرسال إلى العميل", sendQ: "إرسال العرض للعميل الآن؟ لا يمكن تعديله بعد ذلك.",
    del: "حذف", copy: "نسخ كمراجعة جديدة", accept: "قبول العرض", reject: "رفض", comment: "تعليق (اختياري)",
    invFull: "فاتورة (كاملة)", invAdv: "فاتورة الدفعة المقدمة", invPay: "فاتورة دفعة", response: "رد العميل", acceptQ: "هل تقبل هذا العرض بشكل ملزم؟" },
};

function QuoteActions({ q, reload }: { q: QuoteDetail; reload: () => void }) {
  const { locale } = useI18n();
  const T = QA[locale];
  const { me } = useAuth();
  const nav = useNavigate();
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const run = (p: Promise<unknown>, after?: (r: any) => void) => p.then((r) => { after ? after(r) : reload(); }).catch((e) => setErr(e.message));
  const staff = !!me?.is_employee && can(me, "invoice_write");
  return (
    <div className="card" style={{ margin: "12px 0" }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {staff && q.status === "draft" && <>
          <Link className="btn small" to={`/portal/angebote/${q.id}/bearbeiten`}>✎ {T.edit}</Link>
          <button className="btn small" onClick={() => confirm(T.sendQ) && run(api(`/api/v1/quotes/${q.id}/send`, { method: "POST" }))}>✉ {T.send}</button>
          <button className="btn small danger" onClick={() => confirm(T.del + "?") && run(api(`/api/v1/quotes/${q.id}`, { method: "DELETE" }), () => nav("/portal/angebote"))}>{T.del}</button>
        </>}
        {staff && <button className="btn small ghost" onClick={() => run(api<{ id: string }>(`/api/v1/quotes/${q.id}/duplicate`, { method: "POST" }), (r) => nav(`/portal/angebote/${r.id}/bearbeiten`))}>⧉ {T.copy}</button>}
        {staff && q.status === "accepted" && <>
          {q.advance_percent ? <button className="btn small" onClick={() => run(api<{ invoice_id: string }>(`/api/v1/quotes/${q.id}/invoice`, { body: { mode: "advance" } }), (r) => nav(`/portal/rechnungen/${r.invoice_id}`))}>{T.invAdv} ({q.advance_percent} %)</button> : null}
          {q.payments.map((p, i) => (
            <button key={i} className="btn small ghost" onClick={() => run(api<{ invoice_id: string }>(`/api/v1/quotes/${q.id}/invoice`, { body: { mode: "payment", payment: i + 1 } }), (r) => nav(`/portal/rechnungen/${r.invoice_id}`))}>{T.invPay} {i + 1}</button>
          ))}
          <button className="btn small ghost" onClick={() => run(api<{ invoice_id: string }>(`/api/v1/quotes/${q.id}/invoice`, { body: { mode: "full" } }), (r) => nav(`/portal/rechnungen/${r.invoice_id}`))}>{T.invFull}</button>
        </>}
        {!me?.is_employee && q.status === "sent" && <>
          <input style={{ flex: 1, minWidth: 200 }} placeholder={T.comment} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn" onClick={() => confirm(T.acceptQ) && run(api(`/api/v1/quotes/${q.id}/respond`, { body: { accept: true, comment } }))}>✓ {T.accept}</button>
          <button className="btn danger" onClick={() => run(api(`/api/v1/quotes/${q.id}/respond`, { body: { accept: false, comment } }))}>{T.reject}</button>
        </>}
      </div>
      {q.customer_response && <p className="muted" style={{ marginTop: 8 }}>{T.response}: „{q.customer_response}“</p>}
      {err && <div className="alert">{err}</div>}
    </div>
  );
}

function QuoteList() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const { data, error } = useApi<QuoteRow[]>("/api/v1/quotes");
  const [status, setStatus] = useState("");
  const rows = (data ?? []).filter((q) => !status || q.status === status);
  return (
    <>
      <div className="row between">
        <h1>{t("p.quotes")}</h1>
        {me?.is_employee && can(me, "invoice_write") && <Link className="btn" to="/portal/angebote/neu">+ {QA[locale].new}</Link>}
      </div>
      <div className="tabs" style={{ marginBottom: 12 }}>
        {["", "draft", "sent", "accepted", "rejected"].map((s) => (
          <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s ? t(`st.${s}` as Key) : "∑"}</button>
        ))}
      </div>
      {!data ? <Loading error={error} /> : <QuoteTable rows={rows} showCustomer />}
    </>
  );
}

function QuoteView() {
  const { id } = useParams();
  const { t, locale } = useI18n();
  const { data: q, error, reload } = useApi<QuoteDetail>(`/api/v1/quotes/${id}`, [id]);
  if (!q) return <Loading error={error} />;
  const m = (c: number) => money(c, locale, q.currency);
  // Positionen nach Block gruppieren
  const blocks: { title: string | null; items: QuoteDetail["items"] }[] = [];
  for (const it of q.items) {
    const last = blocks[blocks.length - 1];
    if (last && last.title === it.block_title) last.items.push(it);
    else blocks.push({ title: it.block_title, items: [it] });
  }
  const dir = q.locale === "ar" ? "rtl" : "ltr";
  return (
    <>
      <Link to="/portal/angebote">← {t("p.quotes")}</Link>
      <div className="row" style={{ margin: "8px 0" }}>
        <h1 style={{ margin: 0 }}>{q.number}</h1><Badge s={q.status} />{q.revision && <span className="muted">{q.revision}</span>}
        <span style={{ marginInlineStart: "auto" }} className="row">
          {(["de", "en", "ar"] as const).map((l) => (
            <button key={l} className="btn ghost small" onClick={() => openPdf(`/api/v1/quotes/${q.id}/pdf?locale=${l}`)}>⬇ PDF {l.toUpperCase()}</button>
          ))}
        </span>
      </div>
      <h2 dir={dir} style={{ fontSize: "1.15em" }}>{q.title}</h2>
      <QuoteActions q={q} reload={reload} />
      <div className="grid2" style={{ margin: "16px 0" }}>
        <div className="card"><div className="muted">{t("p.customer")}</div><b dir="auto">{q.organization_name}</b>
          {q.project_id && <div><Link to={`/portal/projekte/${q.project_id}`}>{q.project_name}</Link></div>}</div>
        <div className="card"><div className="muted">{t("p.date")} · {t("p.valid_until")}</div>
          <b>{fmtDate(q.sent_at ?? q.created_at, locale)}</b> → {fmtDate(q.valid_until, locale)}</div>
        <div className="card"><div className="muted">{t("p.total")}</div><b>{m(q.gross_cents)}</b>
          {q.advance_percent != null && <div className="muted">{t("p.advance")}: {q.advance_percent} %</div>}</div>
        {(q.project_start || q.total_hours_milli) && (
          <div className="card"><div className="muted">{t("p.period")}</div>
            <b>{fmtDate(q.project_start, locale)}</b> → {fmtDate(q.project_end, locale)}
            {q.total_hours_milli != null && <div className="muted">{qty(q.total_hours_milli)} h
              {q.hourly_rate_cents != null && ` · ${m(q.discounted_rate_cents ?? q.hourly_rate_cents)}/h`}
              {q.discounted_rate_cents != null && q.hourly_rate_cents != null && <s> {m(q.hourly_rate_cents)}</s>}</div>}
          </div>
        )}
      </div>
      {q.description && <div className="card" dir={dir} style={{ marginBottom: 16, whiteSpace: "pre-line" }}>{q.description}</div>}
      <div className="card" style={{ padding: 0, marginBottom: 16 }} dir={dir}>
        <table>
          <thead><tr><th>#</th><th>{t("p.description")}</th><th className="n">{t("p.qty")}</th><th className="n">{t("p.unit_price")}</th><th className="n">{t("p.total")}</th></tr></thead>
          <tbody>
            {blocks.map((b, bi) => (
              <Fragment key={bi}>
                {b.title && <tr className="blk"><td colSpan={5}>{b.items[0].block_nr != null && `${b.items[0].block_nr}. `}{b.title}</td></tr>}
                {b.items.map((it, i) => (
                  <tr key={i}>
                    <td className="muted">{it.position_nr ?? ""}</td>
                    <td>{it.description}</td>
                    <td className="n"><bdi dir="ltr">{qty(it.quantity_milli)}</bdi> {it.unit}</td>
                    <td className="n"><bdi dir="ltr">{m(it.unit_price_cents)}</bdi></td>
                    <td className="n"><bdi dir="ltr">{m(it.total_cents)}</bdi></td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "12px 16px", textAlign: "end" }}>
          <div>{t("p.net")}: <bdi dir="ltr">{m(q.net_cents)}</bdi></div>
          {q.tax_cents > 0 && <div>{t("p.tax")}: <bdi dir="ltr">{m(q.tax_cents)}</bdi></div>}
          <div style={{ fontSize: "1.2em", fontWeight: 700 }}>{t("p.total")}: <bdi dir="ltr">{m(q.gross_cents)}</bdi></div>
          {q.tax_note && <div className="muted">{q.tax_note}</div>}
          {!q.tax_note && q.tax_mode !== "standard" && <div className="muted">{t(`tax.${q.tax_mode}` as Key)}</div>}
        </div>
      </div>
      <div className="grid2">
        {q.milestones.length > 0 && (
          <div className="card" dir={dir}>
            <h3>{t("p.milestones")}</h3>
            {q.milestones.map((ms, i) => (
              <div key={i} className="ms"><b>{ms.label} · {ms.title}</b>{ms.blocks && <span className="muted"> ({ms.blocks})</span>}
                {ms.goal && <div className="muted">{ms.goal}</div>}</div>
            ))}
          </div>
        )}
        {q.payments.length > 0 && (
          <div className="card" dir={dir}>
            <h3>{t("p.payments")}</h3>
            <table><tbody>{q.payments.map((pm, i) => (
              <tr key={i}>
                <td><b>{pm.label}</b>{pm.description && <div className="muted">{pm.description}</div>}</td>
                <td className="n"><bdi dir="ltr">{money(pm.amount_cents, locale, pm.currency)}</bdi>{pm.paid_at && " ✓"}</td>
              </tr>
            ))}</tbody></table>
          </div>
        )}
      </div>
      {q.notes && <div className="card" dir={dir} style={{ marginTop: 16, whiteSpace: "pre-line", fontSize: ".93em" }}>{q.notes}</div>}
    </>
  );
}
