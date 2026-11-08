// Entwicklungsanfragen: Kunde beschreibt Vorhaben, Team prüft, Angebot, Projekt mit Fortschritt.
import { useCallback, useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, useApi, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Field, Loading, Modal, useSubmit, ListTools, Filter, matches, NoHits } from "../../ui";
import { useComm } from "./Comm";
import { ProgressBar } from "./Progress";

const RT = {
  de: { title: "Entwicklung & Projekte", new: "Neue Anfrage", kind: "Art", what: "Titel", desc: "Beschreibung", budget: "Budget (optional)", date: "Wunschtermin (optional)",
    send: "Anfrage senden", status: "Status", customer: "Kunde", progress: "Fortschritt", empty: "Noch keine Anfragen.", back: "← Anfragen", reply: "Nachricht", sendMsg: "Senden",
    quote: "Angebot", project: "Projekt", toProject: "Projekt anlegen", accept: "Angebot annehmen", reject: "Angebot ablehnen", openProject: "Projekt öffnen",
    descPh: "Ziel, Nutzer, wichtigste Funktionen, vorhandene Systeme …",
    k: { new_project: "Neues Projekt", feature: "Neue Funktion", change: "Änderung", integration: "Anbindung/Schnittstelle", other: "Sonstiges" },
    s: { submitted: "eingegangen", in_review: "in Prüfung", quoted: "Angebot liegt vor", accepted: "angenommen", rejected: "abgelehnt", in_progress: "in Umsetzung", done: "fertig" } },
  en: { title: "Development & projects", new: "New request", kind: "Type", what: "Title", desc: "Description", budget: "Budget (optional)", date: "Desired date (optional)",
    send: "Send request", status: "Status", customer: "Customer", progress: "Progress", empty: "No requests yet.", back: "← Requests", reply: "Message", sendMsg: "Send",
    quote: "Quote", project: "Project", toProject: "Create project", accept: "Accept quote", reject: "Decline quote", openProject: "Open project",
    descPh: "Goal, users, key features, existing systems …",
    k: { new_project: "New project", feature: "New feature", change: "Change", integration: "Integration/API", other: "Other" },
    s: { submitted: "received", in_review: "in review", quoted: "quote available", accepted: "accepted", rejected: "declined", in_progress: "in progress", done: "done" } },
  ar: { title: "التطوير والمشاريع", new: "طلب جديد", kind: "النوع", what: "العنوان", desc: "الوصف", budget: "الميزانية (اختياري)", date: "الموعد المرغوب (اختياري)",
    send: "إرسال الطلب", status: "الحالة", customer: "العميل", progress: "التقدم", empty: "لا توجد طلبات بعد.", back: "← الطلبات", reply: "رسالة", sendMsg: "إرسال",
    quote: "عرض السعر", project: "المشروع", toProject: "إنشاء مشروع", accept: "قبول العرض", reject: "رفض العرض", openProject: "فتح المشروع",
    descPh: "الهدف، المستخدمون، أهم الوظائف، الأنظمة الحالية …",
    k: { new_project: "مشروع جديد", feature: "ميزة جديدة", change: "تعديل", integration: "ربط/واجهة برمجية", other: "أخرى" },
    s: { submitted: "مستلم", in_review: "قيد المراجعة", quoted: "العرض جاهز", accepted: "مقبول", rejected: "مرفوض", in_progress: "قيد التنفيذ", done: "منجز" } },
};
type L = (typeof RT)["de"];
const useT = () => RT[useI18n().locale];

type Req = {
  id: string; number: string; organization_id: string; customer: string; kind: keyof L["k"]; title: string; description: string; budget: string | null;
  desired_date: string | null; status: keyof L["s"]; project_id: string | null; project: string | null; project_progress: number | null;
  quote_id: string | null; quote_number: string | null; created_at: string; updated_at: string;
};
type Full = Req & { thread: { id: string; author: string | null; team: boolean; body: string; at: string }[] };

export default function DevRequests() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path=":id" element={<View />} />
    </Routes>
  );
}

function List() {
  const T = useT();
  const { locale } = useI18n();
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const { data, error, reload } = useApi<Req[]>("/api/v1/dev-requests");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [kind, setKind] = useState("");
  const comm = useComm();
  useEffect(() => comm.subscribe((e) => { if (e.type === "request" || e.type === "project") reload(); }), [comm, reload]);
  const rows = (data ?? []).filter((r) => (!st || r.status === st) && (!kind || r.kind === kind) && matches(q, r.number, r.title, r.customer, r.description, r.project, T.k[r.kind]));
  return (
    <>
      <div className="row between">
        <h1>{T.title}</h1>
        {!staff && <button className="btn" onClick={() => setOpen(true)}>+ {T.new}</button>}
      </div>
      {data && data.length > 0 && (
        <ListTools q={q} setQ={setQ} shown={rows.length} total={data.length}>
          <Filter label={T.status} value={st} onChange={setSt} options={Object.entries(T.s)} />
          <Filter label={T.kind} value={kind} onChange={setKind} options={Object.entries(T.k)} />
        </ListTools>
      )}
      {!data ? <Loading error={error} /> : data.length === 0 ? <div className="card"><p className="muted">{T.empty}</p></div> : rows.length === 0 ? <NoHits /> : (
        <div className="grid">
          {rows.map((r) => (
            <Link key={r.id} to={`/portal/anfragen-entwicklung/${r.id}`} className="card proj">
              <div className="row between"><span className={`badge req-${r.status}`}>{T.s[r.status]}</span><code className="muted">{r.number}</code></div>
              <h3>{r.title}</h3>
              <div className="muted">{T.k[r.kind]}{staff && ` · ${r.customer}`} · {new Date(r.created_at).toLocaleDateString(locale)}</div>
              {r.project_progress != null && <div style={{ marginTop: 8 }}><ProgressBar value={r.project_progress} /></div>}
            </Link>
          ))}
        </div>
      )}
      {open && <NewRequest onClose={() => setOpen(false)} />}
    </>
  );
}

function NewRequest({ onClose }: { onClose: () => void }) {
  const T = useT();
  const nav = useNavigate();
  const [f, setF] = useState({ kind: "new_project", title: "", description: "", budget: "", desired_date: "" });
  const s = useSubmit();
  return (
    <Modal title={T.new} onClose={onClose}>
      <form onSubmit={s.run(async () => {
        const r = await api<{ id: string }>("/api/v1/dev-requests", { body: { ...f, budget: f.budget || null, desired_date: f.desired_date || null } });
        nav(`/portal/anfragen-entwicklung/${r.id}`);
      })}>
        <Field label={T.kind}>
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {Object.entries(T.k).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label={T.what}><input required minLength={3} maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={T.desc}><textarea required rows={7} placeholder={T.descPh} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid2">
          <Field label={T.budget}><input maxLength={100} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></Field>
          <Field label={T.date}><input type="date" value={f.desired_date} onChange={(e) => setF({ ...f, desired_date: e.target.value })} /></Field>
        </div>
        {s.error && <div className="alert">{s.error}</div>}
        <button className="btn" disabled={s.busy}>{T.send}</button>
      </form>
    </Modal>
  );
}

function View() {
  const T = useT();
  const { locale } = useI18n();
  const { id } = useParams();
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const [r, setR] = useState<Full | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const s = useSubmit();
  const comm = useComm();
  const load = useCallback(() => api<Full>(`/api/v1/dev-requests/${id}`).then(setR).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => comm.subscribe((e) => { if (e.type === "request" && e.id === id) load(); }), [comm, id, load]);
  const patch = (b: Record<string, unknown>) => api(`/api/v1/dev-requests/${id}`, { method: "PATCH", body: b }).then(load).catch((e) => setErr(e.message));
  if (!r) return <div className="card">{err ?? <Loading />}</div>;
  return (
    <div className="ticket">
      <Link to="/portal/anfragen-entwicklung" className="muted">{T.back}</Link>
      <div className="row between" style={{ marginTop: 8, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}>{r.title}</h1>
          <div className="muted">{r.number} · {T.k[r.kind]} · {r.customer} · {new Date(r.created_at).toLocaleDateString(locale)}
            {r.budget && ` · ${r.budget}`}{r.desired_date && ` · ${new Date(r.desired_date).toLocaleDateString(locale)}`}</div>
        </div>
        <span className={`badge req-${r.status}`}>{T.s[r.status]}</span>
      </div>
      <div className="card" style={{ whiteSpace: "pre-wrap", margin: "12px 0" }}>{r.description}</div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {r.quote_id && <Link className="btn small ghost" to={`/portal/angebote/${r.quote_id}`}>{T.quote}: {r.quote_number}</Link>}
        {r.project_id && <Link className="btn small ghost" to={`/portal/projekte/${r.project_id}`}>{T.openProject}</Link>}
        {!staff && r.status === "quoted" && (r.quote_id
          ? <Link className="btn small" to={`/portal/angebote/${r.quote_id}`}>{T.accept} / {T.reject}</Link>
          : <>
            <button className="btn small" onClick={() => patch({ status: "accepted" })}>{T.accept}</button>
            <button className="btn small danger" onClick={() => patch({ status: "rejected" })}>{T.reject}</button>
          </>)}
        {staff && (
          <select value={r.status} style={{ width: "auto" }} onChange={(e) => patch({ status: e.target.value })}>
            {Object.entries(T.s).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        {staff && !r.quote_id && <Link className="btn small" to={`/portal/angebote/neu?org=${r.organization_id}&request=${r.id}${r.project_id ? `&project=${r.project_id}` : ""}`}>+ {T.quote}</Link>}
        {staff && !r.project_id && <button className="btn small" onClick={() => api(`/api/v1/dev-requests/${id}/project`, { method: "POST" }).then(load).catch((e) => setErr(e.message))}>{T.toProject}</button>}
      </div>
      {r.project_progress != null && <div style={{ margin: "12px 0" }}><div className="muted">{T.progress}</div><ProgressBar value={r.project_progress} /></div>}
      <div className="thread">
        {r.thread.map((m) => (
          <div key={m.id} className={`tmsg ${m.team ? "team" : "cust"}`}>
            <div className="muted" style={{ fontSize: ".8em" }}>{m.author ?? "?"} · {new Date(m.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</div>
            <div className="tbody">{m.body}</div>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={s.run(async () => { await api(`/api/v1/dev-requests/${id}/messages`, { body: { body } }); setBody(""); load(); })}>
        <textarea required rows={3} placeholder={T.reply} value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn" style={{ marginTop: 8 }} disabled={s.busy}>{T.sendMsg}</button>
        {(s.error || err) && <div className="alert">{s.error ?? err}</div>}
      </form>
    </div>
  );
}
