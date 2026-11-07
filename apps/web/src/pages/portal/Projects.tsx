import { Fragment, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { useApi } from "../../api";
import { fmtDate, money, useI18n, type Key } from "../../i18n";
import { Badge, Loading } from "../../ui";

type InvRow = {
  id: string; number: string | null; status: string; kind: string; currency: string; gross_cents: number | null;
  issue_date: string | null; created_at: string; service_from: string | null; service_to: string | null;
};
type Project = {
  id: string; organization_id: string | null; organization_name: string | null; name: string; slug: string; code: string | null;
  description: string; status: string; repo_url: string | null; start_date: string | null; target_date: string | null;
  invoice_count: number; quote_count: number; invoiced_cents: number; open_cents: number;
};
type QuoteRow = {
  id: string; organization_id: string; organization_name: string; project_id: string | null; project_name: string | null;
  number: string; title: string; revision: string | null; status: string; currency: string; tax_mode: string; locale: string;
  valid_until: string | null; net_cents: number; tax_cents: number; gross_cents: number; sent_at: string | null; created_at: string;
};
type QuoteDetail = QuoteRow & {
  description: string; notes: string; tax_note: string | null; project_start: string | null; project_end: string | null;
  hourly_rate_cents: number | null; discounted_rate_cents: number | null; total_hours_milli: number | null; advance_percent: number | null;
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
      <Route path=":id" element={<QuoteView />} />
    </Routes>
  );
}

function ProjectList() {
  const { t, locale } = useI18n();
  const { data, error } = useApi<Project[]>("/api/v1/projects");
  const [q, setQ] = useState("");
  const rows = (data ?? []).filter((p) => !q || `${p.name} ${p.code ?? ""} ${p.organization_name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <h1>{t("p.projects")}</h1>
      <input placeholder={t("p.search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, marginBottom: 12 }} />
      {!data ? <Loading error={error} /> : rows.length === 0 ? <div className="card"><p className="spin">{t("p.empty")}</p></div> : (
        <div className="grid">
          {rows.map((p) => (
            <Link key={p.id} to={`/portal/projekte/${p.id}`} className="card proj">
              <div className="row between"><Badge s={p.status} />{p.code && <code className="muted">{p.code}</code>}</div>
              <h3>{p.name}</h3>
              <div className="muted">{p.organization_name ?? t("p.internal")}</div>
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
  const { data: p, error } = useApi<Project & { invoices: InvRow[]; quotes: QuoteRow[] }>(`/api/v1/projects/${id}`, [id]);
  if (!p) return <Loading error={error} />;
  return (
    <>
      <Link to="/portal/projekte">← {t("p.projects")}</Link>
      <div className="row" style={{ margin: "8px 0" }}>
        <h1 style={{ margin: 0 }}>{p.name}</h1><Badge s={p.status} />
      </div>
      {p.description && <p className="muted" style={{ whiteSpace: "pre-line" }}>{p.description}</p>}
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

function QuoteList() {
  const { t } = useI18n();
  const { data, error } = useApi<QuoteRow[]>("/api/v1/quotes");
  const [status, setStatus] = useState("");
  const rows = (data ?? []).filter((q) => !status || q.status === status);
  return (
    <>
      <h1>{t("p.quotes")}</h1>
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
  const { data: q, error } = useApi<QuoteDetail>(`/api/v1/quotes/${id}`, [id]);
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
      </div>
      <h2 dir={dir} style={{ fontSize: "1.15em" }}>{q.title}</h2>
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
