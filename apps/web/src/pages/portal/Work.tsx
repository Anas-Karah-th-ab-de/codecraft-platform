// Mitarbeiter-Bereich: Zeiterfassung, Urlaub/Abwesenheit, Kalender.
// Leitung (eigene Abteilungen) und Admin: Zeiten korrigieren, Urlaub genehmigen, Vertretung, verbindliche Termine.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, useApi, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Field, Loading, Modal, useSubmit } from "../../ui";
import { useComm } from "./Comm";

const WT = {
  de: {
    time: "Zeiterfassung", leave: "Urlaub & Abwesenheit", calendar: "Kalender", clockIn: "Einstempeln", clockOut: "Ausstempeln", running: "läuft seit",
    today: "Heute", week: "Diese Woche", pause: "Pause (min)", note: "Notiz", add: "Zeit nachtragen", start: "Beginn", end: "Ende", save: "Speichern",
    del: "Löschen", person: "Mitarbeiter", me: "Ich", total: "Summe", edited: "korrigiert", from: "Von", to: "Bis", apply: "Beantragen",
    kind: "Art", half: "halber Tag", substitute: "Vertretung", days: "Tage", status: "Status", approve: "Genehmigen", reject: "Ablehnen", cancel: "Zurückziehen",
    left: "Resturlaub", taken: "genommen", pending: "beantragt", entitled: "Anspruch", team: "Team", mine: "Meine", none: "—",
    newEvent: "Neuer Termin", title: "Titel", place: "Ort", allDay: "ganztägig", invite: "Teilnehmer", mandatory: "Verbindlich vorgeben (Leitung)",
    accept: "Zusagen", decline: "Absagen", prev: "‹", next: "›", todayBtn: "Heute", forWhom: "Für Mitarbeiter (Leitung)",
    k: { vacation: "Urlaub", sick: "Krank", special: "Sonderurlaub", unpaid: "Unbezahlt", training: "Fortbildung", remote: "Homeoffice" },
    s: { requested: "beantragt", approved: "genehmigt", rejected: "abgelehnt", cancelled: "zurückgezogen" },
    r: { pending: "offen", accepted: "zugesagt", declined: "abgesagt" },
  },
  en: {
    time: "Time tracking", leave: "Leave & absence", calendar: "Calendar", clockIn: "Clock in", clockOut: "Clock out", running: "running since",
    today: "Today", week: "This week", pause: "Break (min)", note: "Note", add: "Add time", start: "Start", end: "End", save: "Save",
    del: "Delete", person: "Employee", me: "Me", total: "Total", edited: "corrected", from: "From", to: "To", apply: "Request",
    kind: "Type", half: "half day", substitute: "Substitute", days: "Days", status: "Status", approve: "Approve", reject: "Reject", cancel: "Withdraw",
    left: "Remaining", taken: "taken", pending: "requested", entitled: "Entitlement", team: "Team", mine: "Mine", none: "—",
    newEvent: "New event", title: "Title", place: "Location", allDay: "all day", invite: "Attendees", mandatory: "Make mandatory (lead)",
    accept: "Accept", decline: "Decline", prev: "‹", next: "›", todayBtn: "Today", forWhom: "For employee (lead)",
    k: { vacation: "Vacation", sick: "Sick", special: "Special leave", unpaid: "Unpaid", training: "Training", remote: "Remote work" },
    s: { requested: "requested", approved: "approved", rejected: "rejected", cancelled: "withdrawn" },
    r: { pending: "pending", accepted: "accepted", declined: "declined" },
  },
  ar: {
    time: "تسجيل الوقت", leave: "الإجازات والغياب", calendar: "التقويم", clockIn: "تسجيل الدخول", clockOut: "تسجيل الخروج", running: "منذ",
    today: "اليوم", week: "هذا الأسبوع", pause: "استراحة (دقيقة)", note: "ملاحظة", add: "إضافة وقت", start: "البداية", end: "النهاية", save: "حفظ",
    del: "حذف", person: "الموظف", me: "أنا", total: "المجموع", edited: "معدّل", from: "من", to: "إلى", apply: "تقديم الطلب",
    kind: "النوع", half: "نصف يوم", substitute: "البديل", days: "الأيام", status: "الحالة", approve: "موافقة", reject: "رفض", cancel: "سحب",
    left: "المتبقي", taken: "مستخدم", pending: "مطلوب", entitled: "الاستحقاق", team: "الفريق", mine: "طلباتي", none: "—",
    newEvent: "موعد جديد", title: "العنوان", place: "المكان", allDay: "طوال اليوم", invite: "المشاركون", mandatory: "إلزامي (للمدير)",
    accept: "قبول", decline: "اعتذار", prev: "›", next: "‹", todayBtn: "اليوم", forWhom: "لموظف (للمدير)",
    k: { vacation: "إجازة", sick: "مرضية", special: "إجازة خاصة", unpaid: "بدون راتب", training: "تدريب", remote: "عمل عن بعد" },
    s: { requested: "مطلوبة", approved: "موافق عليها", rejected: "مرفوضة", cancelled: "مسحوبة" },
    r: { pending: "معلّق", accepted: "مقبول", declined: "معتذر" },
  },
};
type L = (typeof WT)["de"];
const useT = () => WT[useI18n().locale];
type Person = { id: string; name: string; role: string; managed: boolean };
const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.abs(m % 60)).padStart(2, "0")} h`;
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function Work() {
  const T = useT();
  const [tab, setTab] = useState<"time" | "leave" | "calendar">("time");
  const people = useApi<Person[]>("/api/v1/people");
  return (
    <>
      <div className="row between">
        <h1>{T[tab]}</h1>
        <div className="seg">
          {(["time", "leave", "calendar"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{T[t]}</button>)}
        </div>
      </div>
      {tab === "time" && <Time people={people.data ?? []} />}
      {tab === "leave" && <Leave people={people.data ?? []} />}
      {tab === "calendar" && <Calendar people={people.data ?? []} />}
    </>
  );
}

// ── Zeiterfassung ──
type Entry = { id: string; user_name: string; started_at: string; ended_at: string | null; break_minutes: number; minutes: number; project: string | null; note: string; source: string; edited: boolean };

function Time({ people }: { people: Person[] }) {
  const T = useT();
  const { locale } = useI18n();
  const { me } = useAuth();
  const [who, setWho] = useState("");
  const status = useApi<{ running: Entry | null; today_minutes: number; week_minutes: number }>("/api/v1/time/status");
  const listPath = `/api/v1/time${who ? `?user=${who}` : ""}`;
  const list = useApi<{ entries: Entry[]; total_minutes: number }>(listPath, [listPath]);
  const [pause, setPause] = useState(30);
  const [form, setForm] = useState<{ id?: string; started_at: string; ended_at: string; break_minutes: number; note: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  const reload = () => { status.reload(); list.reload(); };
  const clock = (action: "in" | "out") => api("/api/v1/time/clock", { body: { action, break_minutes: pause } }).then(reload).catch((e) => setErr(e.message));
  const managed = people.filter((p) => p.managed);
  const run = status.data?.running;
  const s = useSubmit();
  return (
    <>
      <div className="kpis">
        <div className="card clock">
          {run ? <>
            <div className="muted">{T.running} {new Date(run.started_at).toLocaleTimeString(locale, { timeStyle: "short" })}</div>
            <div className="kpi">{hm(Math.round((Date.now() - new Date(run.started_at).getTime()) / 60000))}</div>
            <div className="row"><label className="row" style={{ gap: 4, margin: 0 }}>{T.pause}<input type="number" min={0} max={600} style={{ width: 70 }} value={pause} onChange={(e) => setPause(+e.target.value)} /></label>
              <button className="btn danger" onClick={() => clock("out")}>⏹ {T.clockOut}</button></div>
          </> : <button className="btn big" onClick={() => clock("in")}>▶ {T.clockIn}</button>}
        </div>
        <div className="card"><div className="muted">{T.today}</div><div className="kpi">{hm(status.data?.today_minutes ?? 0)}</div></div>
        <div className="card"><div className="muted">{T.week}</div><div className="kpi">{hm(status.data?.week_minutes ?? 0)}</div></div>
      </div>
      {err && <div className="alert">{err}</div>}
      <div className="row between" style={{ margin: "12px 0" }}>
        {managed.length > 0 ? (
          <select value={who} onChange={(e) => setWho(e.target.value)} style={{ width: "auto" }}>
            <option value="">{T.me}</option>
            {managed.filter((p) => p.id !== me?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : <span />}
        <button className="btn small" onClick={() => { const e = new Date(); const b = new Date(e.getTime() - 8 * 3600000); setForm({ started_at: local(b), ended_at: local(e), break_minutes: 30, note: "" }); }}>+ {T.add}</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!list.data ? <Loading error={list.error} /> : (
          <table>
            <thead><tr><th>{T.start}</th><th>{T.end}</th><th>{T.pause}</th><th className="n">{T.total}</th><th>{T.note}</th><th /></tr></thead>
            <tbody>
              {list.data.entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.started_at).toLocaleString(locale, { weekday: "short", dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions)}</td>
                  <td>{e.ended_at ? new Date(e.ended_at).toLocaleTimeString(locale, { timeStyle: "short" }) : "…"}</td>
                  <td>{e.break_minutes}</td>
                  <td className="n"><b>{hm(e.minutes)}</b></td>
                  <td>{e.note}{e.project && <span className="muted"> · {e.project}</span>}{e.edited && <span className="badge" style={{ marginInlineStart: 6 }}>{T.edited}</span>}</td>
                  <td className="n">{e.ended_at && <>
                    <button className="btn small ghost" onClick={() => setForm({ id: e.id, started_at: local(new Date(e.started_at)), ended_at: local(new Date(e.ended_at!)), break_minutes: e.break_minutes, note: e.note })}>✎</button>
                    <button className="btn small ghost" onClick={() => confirm(T.del + "?") && api(`/api/v1/time/${e.id}`, { method: "DELETE" }).then(reload).catch((x) => setErr(x.message))}>✕</button>
                  </>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>{T.total}</td><td className="n"><b>{hm(list.data.total_minutes)}</b></td><td colSpan={2} /></tr></tfoot>
          </table>
        )}
      </div>
      {form && (
        <Modal title={T.add} onClose={() => setForm(null)}>
          <form onSubmit={s.run(async () => {
            const body = { user_id: who || undefined, started_at: new Date(form.started_at).toISOString(), ended_at: new Date(form.ended_at).toISOString(), break_minutes: form.break_minutes, note: form.note };
            await api(form.id ? `/api/v1/time/${form.id}` : "/api/v1/time", { method: form.id ? "PUT" : "POST", body });
            setForm(null); reload();
          })}>
            <div className="grid2">
              <Field label={T.start}><input type="datetime-local" required value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} /></Field>
              <Field label={T.end}><input type="datetime-local" required value={form.ended_at} onChange={(e) => setForm({ ...form, ended_at: e.target.value })} /></Field>
              <Field label={T.pause}><input type="number" min={0} max={600} value={form.break_minutes} onChange={(e) => setForm({ ...form, break_minutes: +e.target.value })} /></Field>
              <Field label={T.note}><input maxLength={2000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            </div>
            {s.error && <div className="alert">{s.error}</div>}
            <button className="btn" disabled={s.busy}>{T.save}</button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ── Urlaub ──
type LeaveRow = { id: string; user_id: string; user_name: string; kind: keyof L["k"]; start_date: string; end_date: string; half_day: boolean; days: number;
  status: keyof L["s"]; substitute_id: string | null; substitute: string | null; note: string; decided_by_name: string | null };
type LeaveData = { items: LeaveRow[]; balance: { entitled: number; taken: number; pending: number; left: number }; can_decide: boolean };

function Leave({ people }: { people: Person[] }) {
  const T = useT();
  const { locale } = useI18n();
  const { me } = useAuth();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const path = `/api/v1/leave?scope=${scope}`;
  const { data, error, reload } = useApi<LeaveData>(path, [path]);
  const [f, setF] = useState({ kind: "vacation", start_date: "", end_date: "", half_day: false, substitute_id: "", note: "", user_id: "" });
  const [err, setErr] = useState<string | null>(null);
  const s = useSubmit();
  const comm = useComm();
  useEffect(() => comm.subscribe((e) => { if (e.type === "leave") reload(); }), [comm, reload]);
  const patch = (id: string, body: Record<string, unknown>) => api(`/api/v1/leave/${id}`, { method: "PATCH", body }).then(reload).catch((e) => setErr(e.message));
  const others = people.filter((p) => p.id !== me?.id);
  const managed = people.filter((p) => p.managed && p.id !== me?.id);
  const d = (x: string) => new Date(x).toLocaleDateString(locale);
  if (!data) return <Loading error={error} />;
  const b = data.balance;
  return (
    <>
      <div className="kpis">
        <div className="card"><div className="muted">{T.left}</div><div className="kpi">{b.left}</div></div>
        <div className="card"><div className="muted">{T.entitled}</div><div className="kpi">{b.entitled}</div></div>
        <div className="card"><div className="muted">{T.taken}</div><div className="kpi">{b.taken}</div></div>
        <div className="card"><div className="muted">{T.pending}</div><div className="kpi">{b.pending}</div></div>
      </div>
      <form className="card grid2" style={{ margin: "12px 0" }} onSubmit={s.run(async () => {
        await api("/api/v1/leave", { body: { ...f, substitute_id: f.substitute_id || null, user_id: f.user_id || undefined, end_date: f.half_day ? f.start_date : f.end_date || f.start_date } });
        setF({ ...f, start_date: "", end_date: "", note: "", half_day: false }); reload();
      })}>
        {managed.length > 0 && (
          <Field label={T.forWhom}>
            <select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
              <option value="">{T.me}</option>
              {managed.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={T.kind}>
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {Object.entries(T.k).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label={T.from}><input type="date" required value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
        {!f.half_day && <Field label={T.to}><input type="date" min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>}
        <label className="row" style={{ gap: 6, alignSelf: "end" }}><input type="checkbox" style={{ width: "auto" }} checked={f.half_day} onChange={(e) => setF({ ...f, half_day: e.target.checked })} />{T.half}</label>
        <Field label={T.substitute}>
          <select value={f.substitute_id} onChange={(e) => setF({ ...f, substitute_id: e.target.value })}>
            <option value="">{T.none}</option>
            {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label={T.note}><input maxLength={2000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button className="btn" style={{ alignSelf: "end", justifySelf: "start" }} disabled={s.busy}>{T.apply}</button>
        {s.error && <div className="alert">{s.error}</div>}
      </form>
      {data.can_decide && (
        <div className="seg" style={{ marginBottom: 8 }}>
          <button className={scope === "mine" ? "on" : ""} onClick={() => setScope("mine")}>{T.mine}</button>
          <button className={scope === "team" ? "on" : ""} onClick={() => setScope("team")}>{T.team}</button>
        </div>
      )}
      {err && <div className="alert">{err}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr>{scope === "team" && <th>{T.person}</th>}<th>{T.kind}</th><th>{T.from}</th><th>{T.to}</th><th className="n">{T.days}</th><th>{T.substitute}</th><th>{T.status}</th><th /></tr></thead>
          <tbody>
            {data.items.map((l) => {
              const mine = l.user_id === me?.id;
              const canDecide = scope === "team" && !mine && people.find((p) => p.id === l.user_id)?.managed;
              return (
                <tr key={l.id}>
                  {scope === "team" && <td>{l.user_name}</td>}
                  <td>{T.k[l.kind]}{l.half_day && ` (${T.half})`}</td>
                  <td>{d(l.start_date)}</td><td>{d(l.end_date)}</td><td className="n">{l.days}</td>
                  <td>{canDecide ? (
                    <select value={l.substitute_id ?? ""} style={{ width: "auto" }} onChange={(e) => e.target.value && patch(l.id, { substitute_id: e.target.value })}>
                      <option value="">{T.none}</option>
                      {people.filter((p) => p.id !== l.user_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : l.substitute ?? T.none}</td>
                  <td><span className={`badge lv-${l.status}`}>{T.s[l.status]}</span>{l.decided_by_name && <div className="muted" style={{ fontSize: ".75em" }}>{l.decided_by_name}</div>}</td>
                  <td className="n">
                    {canDecide && l.status === "requested" && <>
                      <button className="btn small" onClick={() => patch(l.id, { status: "approved" })}>{T.approve}</button>
                      <button className="btn small danger" onClick={() => patch(l.id, { status: "rejected" })}>{T.reject}</button>
                    </>}
                    {mine && ["requested", "approved"].includes(l.status) && new Date(l.start_date) > new Date() && (
                      <button className="btn small ghost" onClick={() => patch(l.id, { status: "cancelled" })}>{T.cancel}</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Kalender ──
type Ev = { id: string; title: string; description: string; location: string; starts_at: string; ends_at: string; all_day: boolean; mandatory: boolean;
  created_by: string; created_by_name: string; attendees: { id: string; name: string; response: keyof L["r"] }[]; can_edit: boolean };

function Calendar({ people }: { people: Person[] }) {
  const T = useT();
  const { locale } = useI18n();
  const { me } = useAuth();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [team, setTeam] = useState(false);
  const [data, setData] = useState<{ events: Ev[]; leaves: LeaveRow[] } | null>(null);
  const [edit, setEdit] = useState<Partial<Ev> & { attendeeIds?: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isLead = people.some((p) => p.managed);
  const days = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // Montag zuerst
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const load = useCallback(() => {
    const from = days[0].toISOString(), to = new Date(days[41].getTime() + 86400000).toISOString();
    api<{ events: Ev[]; leaves: LeaveRow[] }>(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${team ? "&team=true" : ""}`)
      .then(setData).catch((e) => setErr(e.message));
  }, [days, team]);
  useEffect(() => { load(); }, [load]);
  const comm = useComm();
  useEffect(() => comm.subscribe((e) => { if (e.type === "calendar" || e.type === "leave") load(); }), [comm, load]);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const evOn = (d: Date) => (data?.events ?? []).filter((e) => new Date(e.starts_at) < new Date(d.getTime() + 86400000) && new Date(e.ends_at) >= d);
  const lvOn = (d: Date) => (data?.leaves ?? []).filter((l) => new Date(l.start_date) <= d && new Date(l.end_date + "T23:59:59") >= d);
  const respond = (id: string, response: string) => api(`/api/v1/calendar/${id}/respond`, { body: { response } }).then(load).catch((e) => setErr(e.message));
  const s = useSubmit();
  const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }));
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row">
          <button className="btn small ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>{T.prev}</button>
          <b style={{ minWidth: 150, textAlign: "center" }}>{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</b>
          <button className="btn small ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>{T.next}</button>
          <button className="btn small ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>{T.todayBtn}</button>
          {isLead && <label className="row" style={{ gap: 6, margin: 0 }}><input type="checkbox" style={{ width: "auto" }} checked={team} onChange={(e) => setTeam(e.target.checked)} />{T.team}</label>}
        </div>
        <button className="btn small" onClick={() => { const st = new Date(); st.setMinutes(0, 0, 0); st.setHours(st.getHours() + 1); setEdit({ title: "", starts_at: local(st), ends_at: local(new Date(st.getTime() + 3600000)), attendeeIds: [], mandatory: false, all_day: false, location: "", description: "" }); }}>+ {T.newEvent}</button>
      </div>
      {err && <div className="alert">{err}</div>}
      <div className="cal">
        {wd.map((w) => <div key={w} className="cal-h">{w}</div>)}
        {days.map((d) => (
          <div key={d.toISOString()} className={`cal-d ${d.getMonth() !== month.getMonth() ? "out" : ""} ${sameDay(d, new Date()) ? "today" : ""}`}>
            <div className="cal-n">{d.getDate()}</div>
            {lvOn(d).map((l) => <div key={l.id} className={`cal-lv lv-${l.status}`} title={`${l.user_name}: ${T.k[l.kind]}${l.substitute ? ` · ${T.substitute}: ${l.substitute}` : ""}`}>🏖 {team ? l.user_name.split("@")[0] : T.k[l.kind]}</div>)}
            {evOn(d).map((e) => {
              const myResp = e.attendees.find((a) => a.id === me?.id)?.response;
              return (
                <button key={e.id} className={`cal-ev ${e.mandatory ? "mand" : ""} ${myResp === "declined" ? "declined" : ""}`}
                  onClick={() => setEdit({ ...e, starts_at: local(new Date(e.starts_at)), ends_at: local(new Date(e.ends_at)), attendeeIds: e.attendees.map((a) => a.id) })}>
                  {!e.all_day && new Date(e.starts_at).toLocaleTimeString(locale, { timeStyle: "short" })} {e.mandatory && "📌"}{e.title}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? edit.title ?? "" : T.newEvent} onClose={() => setEdit(null)}>
          {edit.id && !edit.can_edit ? (
            <div>
              <p className="muted">{new Date(edit.starts_at!).toLocaleString(locale)} – {new Date(edit.ends_at!).toLocaleString(locale)}{edit.location && ` · ${edit.location}`}</p>
              {edit.description && <p style={{ whiteSpace: "pre-wrap" }}>{edit.description}</p>}
              <p className="muted">{edit.created_by_name}{edit.mandatory && " · 📌"}</p>
              <ul>{edit.attendees?.map((a) => <li key={a.id}>{a.name} – {T.r[a.response]}</li>)}</ul>
              {edit.attendees?.some((a) => a.id === me?.id) && (
                <div className="row">
                  <button className="btn small" onClick={() => { respond(edit.id!, "accepted"); setEdit(null); }}>{T.accept}</button>
                  {!edit.mandatory && <button className="btn small danger" onClick={() => { respond(edit.id!, "declined"); setEdit(null); }}>{T.decline}</button>}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={s.run(async () => {
              const body = { title: edit.title, description: edit.description ?? "", location: edit.location ?? "", all_day: !!edit.all_day, mandatory: !!edit.mandatory,
                starts_at: new Date(edit.starts_at!).toISOString(), ends_at: new Date(edit.ends_at!).toISOString(), attendees: edit.attendeeIds ?? [] };
              await api(edit.id ? `/api/v1/calendar/${edit.id}` : "/api/v1/calendar", { method: edit.id ? "PUT" : "POST", body });
              setEdit(null); load();
            })}>
              <Field label={T.title}><input required maxLength={200} value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <div className="grid2">
                <Field label={T.start}><input type="datetime-local" required value={edit.starts_at} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></Field>
                <Field label={T.end}><input type="datetime-local" required value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
                <Field label={T.place}><input maxLength={300} value={edit.location ?? ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
                <label className="row" style={{ gap: 6, alignSelf: "end" }}><input type="checkbox" style={{ width: "auto" }} checked={!!edit.all_day} onChange={(e) => setEdit({ ...edit, all_day: e.target.checked })} />{T.allDay}</label>
              </div>
              <Field label={T.note}><textarea rows={2} maxLength={5000} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label={T.invite}>
                <div className="att-pick">
                  {people.filter((p) => p.id !== me?.id).map((p) => (
                    <label key={p.id} className="row" style={{ gap: 4, margin: 0 }}>
                      <input type="checkbox" style={{ width: "auto" }} checked={edit.attendeeIds?.includes(p.id) ?? false}
                        onChange={(e) => setEdit({ ...edit, attendeeIds: e.target.checked ? [...(edit.attendeeIds ?? []), p.id] : (edit.attendeeIds ?? []).filter((x) => x !== p.id) })} />
                      {p.name}{edit.id && edit.attendees?.find((a) => a.id === p.id) && <span className="muted"> ({T.r[edit.attendees.find((a) => a.id === p.id)!.response]})</span>}
                    </label>
                  ))}
                </div>
              </Field>
              {isLead && <label className="row" style={{ gap: 6 }}><input type="checkbox" style={{ width: "auto" }} checked={!!edit.mandatory} onChange={(e) => setEdit({ ...edit, mandatory: e.target.checked })} />📌 {T.mandatory}</label>}
              {s.error && <div className="alert">{s.error}</div>}
              <div className="row between">
                <button className="btn" disabled={s.busy}>{T.save}</button>
                {edit.id && <button type="button" className="btn small danger" onClick={() => api(`/api/v1/calendar/${edit.id}`, { method: "DELETE" }).then(() => { setEdit(null); load(); }).catch((e) => setErr(e.message))}>{T.del}</button>}
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
