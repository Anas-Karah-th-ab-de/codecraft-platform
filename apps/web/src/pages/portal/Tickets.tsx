// Support-Tickets: Kunden melden Anliegen, das Team arbeitet nach Priorität (SLA) ab.
import { useCallback, useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, useApi, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Field, Loading, Modal, useSubmit, ListTools, Filter, matches, NoHits } from "../../ui";
import { useComm } from "./Comm";

const TT = {
  de: {
    title: "Support", new: "Neues Ticket", open: "Offen", done: "Erledigt", all: "Alle", mine: "Nur meine", subject: "Betreff", desc: "Beschreibung",
    category: "Kategorie", urgency: "Dringlichkeit", device: "Gerät", project: "Projekt", customer: "Kunde", internal: "intern", none: "—",
    create: "Ticket senden", status: "Status", assignee: "Bearbeiter", prio: "Prio", due: "Reaktion bis", overdue: "überfällig", empty: "Keine Tickets.",
    reply: "Antworten", note: "Interne Notiz (nur Team)", send: "Senden", close: "Ticket schließen", reopen: "Wieder öffnen", back: "← Tickets",
    unassigned: "nicht zugewiesen", takeIt: "Übernehmen", team: "Team", sla: "Servicevertrag", kpiOpen: "Offen", kpiOverdue: "Überfällig", kpiFree: "Ohne Bearbeiter", kpiMine: "Meine",
    descPh: "Was ist passiert? Seit wann? Fehlermeldung?", created: "Ticket angelegt",
    c: { support: "Allgemeiner Support", device: "Gerät / Hardware", software: "Software-Fehler", billing: "Rechnung", feature: "Wunsch / Erweiterung", other: "Sonstiges" },
    u: { low: "niedrig", normal: "normal", high: "hoch", critical: "kritisch – Betrieb steht" },
    s: { open: "offen", in_progress: "in Bearbeitung", waiting_customer: "wartet auf Kunde", resolved: "gelöst", closed: "geschlossen" },
    l: { basic: "Basis", business: "Business", premium: "Premium" },
  },
  en: {
    title: "Support", new: "New ticket", open: "Open", done: "Done", all: "All", mine: "Mine only", subject: "Subject", desc: "Description",
    category: "Category", urgency: "Urgency", device: "Device", project: "Project", customer: "Customer", internal: "internal", none: "—",
    create: "Submit ticket", status: "Status", assignee: "Assignee", prio: "Prio", due: "Respond by", overdue: "overdue", empty: "No tickets.",
    reply: "Reply", note: "Internal note (team only)", send: "Send", close: "Close ticket", reopen: "Reopen", back: "← Tickets",
    unassigned: "unassigned", takeIt: "Take it", team: "Team", sla: "Service plan", kpiOpen: "Open", kpiOverdue: "Overdue", kpiFree: "Unassigned", kpiMine: "Mine",
    descPh: "What happened? Since when? Error message?", created: "Ticket created",
    c: { support: "General support", device: "Device / hardware", software: "Software bug", billing: "Billing", feature: "Feature request", other: "Other" },
    u: { low: "low", normal: "normal", high: "high", critical: "critical – business down" },
    s: { open: "open", in_progress: "in progress", waiting_customer: "waiting for customer", resolved: "resolved", closed: "closed" },
    l: { basic: "Basic", business: "Business", premium: "Premium" },
  },
  ar: {
    title: "الدعم الفني", new: "تذكرة جديدة", open: "مفتوحة", done: "منتهية", all: "الكل", mine: "تذاكري فقط", subject: "الموضوع", desc: "الوصف",
    category: "الفئة", urgency: "الأهمية", device: "الجهاز", project: "المشروع", customer: "العميل", internal: "داخلي", none: "—",
    create: "إرسال التذكرة", status: "الحالة", assignee: "المسؤول", prio: "الأولوية", due: "الرد قبل", overdue: "متأخر", empty: "لا توجد تذاكر.",
    reply: "رد", note: "ملاحظة داخلية (للفريق فقط)", send: "إرسال", close: "إغلاق التذكرة", reopen: "إعادة فتح", back: "← التذاكر",
    unassigned: "غير مسندة", takeIt: "استلام", team: "الفريق", sla: "عقد الخدمة", kpiOpen: "مفتوحة", kpiOverdue: "متأخرة", kpiFree: "بدون مسؤول", kpiMine: "تذاكري",
    descPh: "ماذا حدث؟ منذ متى؟ رسالة الخطأ؟", created: "تم إنشاء التذكرة",
    c: { support: "دعم عام", device: "جهاز / عتاد", software: "خطأ برمجي", billing: "فواتير", feature: "طلب ميزة", other: "أخرى" },
    u: { low: "منخفضة", normal: "عادية", high: "عالية", critical: "حرجة – العمل متوقف" },
    s: { open: "مفتوحة", in_progress: "قيد المعالجة", waiting_customer: "بانتظار العميل", resolved: "تم الحل", closed: "مغلقة" },
    l: { basic: "أساسي", business: "أعمال", premium: "مميز" },
  },
};
type L = (typeof TT)["de"];
const useT = () => TT[useI18n().locale];

type Ticket = {
  id: string; number: string; subject: string; category: keyof L["c"]; urgency: keyof L["u"]; sla: keyof L["l"]; priority: number;
  status: keyof L["s"]; organization_id: string | null; customer: string | null; assignee_id: string | null; assignee: string | null;
  device: string | null; project: string | null; response_due_at: string; first_response_at: string | null; overdue: boolean;
  created_at: string; updated_at: string; messages: number;
};
type Msg = { id: string; author: string | null; team: boolean; body: string; internal: boolean; at: string };
type Full = Ticket & { thread: Msg[] };
type Contact = { id: string; display_name: string; role: string };

const when = (d: string, locale: string) => new Date(d).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });

export default function Tickets() {
  return (
    <Routes>
      <Route index element={<TicketList />} />
      <Route path=":id" element={<TicketView />} />
    </Routes>
  );
}

function TicketList() {
  const T = useT();
  const { locale } = useI18n();
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const [view, setView] = useState<"open" | "done" | "all">("open");
  const [mine, setMine] = useState(false);
  const path = `/api/v1/tickets?view=${view}${mine ? "&mine=true" : ""}`;
  const { data, error, reload } = useApi<Ticket[]>(path, [path]);
  const stats = useApi<{ open: number; overdue: number; unassigned: number; mine: number }>(staff ? "/api/v1/tickets/stats" : null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState("");
  const [cat, setCat] = useState("");
  const comm = useComm();
  useEffect(() => comm.subscribe((e) => { if (e.type === "ticket") { reload(); stats.reload(); } }), [comm, reload, stats.reload]);
  const rows = (data ?? []).filter((t) => (!prio || String(t.priority) === prio) && (!cat || t.category === cat)
    && matches(q, t.number, t.subject, t.customer, t.assignee, t.device, t.project, T.c[t.category], T.s[t.status]));
  return (
    <>
      <div className="row between">
        <h1>{T.title}</h1>
        <button className="btn" onClick={() => setCreating(true)}>+ {T.new}</button>
      </div>
      {staff && stats.data && (
        <div className="kpis">
          <div className="card"><div className="muted">{T.kpiOpen}</div><div className="kpi">{stats.data.open}</div></div>
          <div className="card"><div className="muted">{T.kpiOverdue}</div><div className={`kpi ${stats.data.overdue ? "bad" : ""}`}>{stats.data.overdue}</div></div>
          <div className="card"><div className="muted">{T.kpiFree}</div><div className="kpi">{stats.data.unassigned}</div></div>
          <div className="card"><div className="muted">{T.kpiMine}</div><div className="kpi">{stats.data.mine}</div></div>
        </div>
      )}
      <div className="row" style={{ margin: "12px 0" }}>
        <div className="seg">
          {(["open", "done", "all"] as const).map((v) => <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{T[v]}</button>)}
        </div>
        {staff && <label className="row" style={{ gap: 6, margin: 0 }}><input type="checkbox" style={{ width: "auto" }} checked={mine} onChange={(e) => setMine(e.target.checked)} />{T.mine}</label>}
      </div>
      <ListTools q={q} setQ={setQ} shown={rows.length} total={data?.length ?? 0}>
        <Filter label={T.prio} value={prio} onChange={setPrio} options={[1, 2, 3, 4, 5].map((p) => [String(p), `P${p}`])} />
        <Filter label={T.category} value={cat} onChange={setCat} options={Object.entries(T.c)} />
      </ListTools>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : data.length === 0 ? <p className="muted" style={{ padding: 16 }}>{T.empty}</p> : rows.length === 0 ? <NoHits /> : (
          <table className="tickets">
            <thead><tr><th>{T.prio}</th><th>#</th><th>{T.subject}</th>{staff && <th>{T.customer}</th>}<th>{T.status}</th><th>{T.assignee}</th><th>{T.due}</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className={t.overdue ? "overdue" : ""}>
                  <td><span className={`prio p${t.priority}`}>P{t.priority}</span></td>
                  <td className="muted"><Link to={`/portal/support/${t.id}`}>{t.number}</Link></td>
                  <td><Link to={`/portal/support/${t.id}`}>{t.subject}</Link>
                    <div className="muted" style={{ fontSize: ".8em" }}>{T.c[t.category]}{t.device && ` · ${t.device}`}{t.project && ` · ${t.project}`} · 💬 {t.messages}</div></td>
                  {staff && <td>{t.customer ?? T.internal}{t.organization_id && <span className={`badge sla-${t.sla}`} style={{ marginInlineStart: 6 }}>{T.l[t.sla]}</span>}</td>}
                  <td><span className={`badge tst-${t.status}`}>{T.s[t.status]}</span></td>
                  <td>{t.assignee ?? <span className="muted">{T.unassigned}</span>}</td>
                  <td>{t.first_response_at ? "✓" : <>{when(t.response_due_at, locale)}{t.overdue && <b className="bad"> · {T.overdue}</b>}</>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <NewTicket onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); stats.reload(); }} />}
    </>
  );
}

function NewTicket({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const T = useT();
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const nav = useNavigate();
  const devices = useApi<{ id: string; name: string; organization_id: string | null }[]>("/api/v1/devices");
  const projects = useApi<{ id: string; name: string; organization_id: string | null }[]>("/api/v1/projects");
  const orgs = useApi<{ id: string; name: string }[]>(staff ? "/api/v1/organizations" : null);
  const [f, setF] = useState({ subject: "", body: "", category: "support", urgency: "normal", device_id: "", project_id: "", organization_id: "" });
  const s = useSubmit();
  const org = staff ? f.organization_id || null : me?.organization_id ?? null;
  const devs = devices.data?.filter((d) => d.organization_id === org) ?? [];
  const projs = projects.data?.filter((p) => p.organization_id === org) ?? [];
  return (
    <Modal title={T.new} onClose={onClose}>
      <form onSubmit={s.run(async () => {
        const r = await api<{ id: string }>("/api/v1/tickets", { body: {
          ...f, device_id: f.device_id || null, project_id: f.project_id || null, organization_id: staff ? f.organization_id || null : undefined,
        } });
        onDone();
        nav(`/portal/support/${r.id}`);
      })}>
        {staff && (
          <Field label={T.customer}>
            <select value={f.organization_id} onChange={(e) => setF({ ...f, organization_id: e.target.value, device_id: "", project_id: "" })}>
              <option value="">{T.internal}</option>
              {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={T.subject}><input required minLength={3} maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <div className="grid2">
          <Field label={T.category}>
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(T.c).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={T.urgency}>
            <select value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value })}>
              {Object.entries(T.u).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {devs.length > 0 && (
            <Field label={T.device}>
              <select value={f.device_id} onChange={(e) => setF({ ...f, device_id: e.target.value })}>
                <option value="">{T.none}</option>
                {devs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          )}
          {projs.length > 0 && (
            <Field label={T.project}>
              <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
                <option value="">{T.none}</option>
                {projs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <Field label={T.desc}><textarea required rows={6} placeholder={T.descPh} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        {s.error && <div className="alert">{s.error}</div>}
        <button className="btn" disabled={s.busy}>{T.create}</button>
      </form>
    </Modal>
  );
}

function TicketView() {
  const T = useT();
  const { locale } = useI18n();
  const { id } = useParams();
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const [t, setT] = useState<Full | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const team = useApi<Contact[]>(staff ? "/api/v1/chat/contacts" : null);
  const s = useSubmit();
  const comm = useComm();
  const load = useCallback(() => api<Full>(`/api/v1/tickets/${id}`).then(setT).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => comm.subscribe((e) => { if (e.type === "ticket" && e.id === id) load(); }), [comm, id, load]);
  const patch = (b: Record<string, unknown>) => api(`/api/v1/tickets/${id}`, { method: "PATCH", body: b }).then(load).catch((e) => setErr(e.message));
  if (!t) return <div className="card">{err ?? <Loading />}</div>;
  const staffList = (team.data ?? []).filter((c) => c.role !== "customer");
  const closed = t.status === "closed" || t.status === "resolved";
  return (
    <div className="ticket">
      <Link to="/portal/support" className="muted">{T.back}</Link>
      <div className="row between" style={{ marginTop: 8, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}><span className={`prio p${t.priority}`}>P{t.priority}</span> {t.subject}</h1>
          <div className="muted">{t.number} · {T.c[t.category]} · {when(t.created_at, locale)}{t.customer && ` · ${t.customer}`}{t.device && ` · ${T.device}: ${t.device}`}{t.project && ` · ${T.project}: ${t.project}`}</div>
        </div>
        <span className={`badge tst-${t.status}`}>{T.s[t.status]}</span>
      </div>
      {staff && (
        <div className="card ticket-ctl">
          <Field label={T.status}>
            <select value={t.status} onChange={(e) => patch({ status: e.target.value })}>
              {Object.entries(T.s).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={T.urgency}>
            <select value={t.urgency} onChange={(e) => patch({ urgency: e.target.value })}>
              {Object.entries(T.u).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={T.assignee}>
            <select value={t.assignee_id ?? ""} onChange={(e) => patch(e.target.value ? { assignee_id: e.target.value } : { unassign: true })}>
              <option value="">{T.unassigned}</option>
              {me && <option value={me.id}>{me.display_name}</option>}
              {staffList.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
          </Field>
          <div><div className="muted">{T.sla}</div><b>{T.l[t.sla]}</b> · {t.first_response_at ? "✓" : `${T.due} ${when(t.response_due_at, locale)}`}</div>
        </div>
      )}
      <div className="thread">
        {t.thread.map((m) => (
          <div key={m.id} className={`tmsg ${m.team ? "team" : "cust"} ${m.internal ? "internal" : ""}`}>
            <div className="muted" style={{ fontSize: ".8em" }}>{m.author ?? "?"}{m.team && !staff && ` · ${T.team}`}{m.internal && ` · 🔒 ${T.internal}`} · {when(m.at, locale)}</div>
            <div className="tbody">{m.body}</div>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={s.run(async () => {
        await api(`/api/v1/tickets/${id}/messages`, { body: { body, internal } });
        setBody(""); setInternal(false); load();
      })}>
        <textarea required rows={4} value={body} placeholder={T.reply} onChange={(e) => setBody(e.target.value)} />
        <div className="row between" style={{ marginTop: 8 }}>
          <div className="row">
            <button className="btn" disabled={s.busy}>{T.send}</button>
            {staff && <label className="row" style={{ gap: 6, margin: 0 }}><input type="checkbox" style={{ width: "auto" }} checked={internal} onChange={(e) => setInternal(e.target.checked)} />🔒 {T.note}</label>}
          </div>
          {!staff && (closed
            ? <button type="button" className="btn ghost small" onClick={() => patch({ status: "open" })}>{T.reopen}</button>
            : <button type="button" className="btn ghost small" onClick={() => patch({ status: "closed" })}>{T.close}</button>)}
        </div>
        {(s.error || err) && <div className="alert">{s.error ?? err}</div>}
      </form>
    </div>
  );
}
