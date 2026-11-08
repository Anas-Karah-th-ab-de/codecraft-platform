// Mitarbeiter-Bereich: Zeiterfassung, Urlaub/Abwesenheit, Kalender.
// Leitung (eigene Abteilungen) und Admin: Zeiten korrigieren, Urlaub genehmigen, Vertretung, verbindliche Termine.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, useApi, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Field, Loading, Modal, useSubmit, ListTools, Filter, matches } from "../../ui";
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
  // Reiter in der Adresse (/portal/arbeit?tab=kalender) → verlinkbar, Zurück-Taste funktioniert
  const [sp, setSp] = useSearchParams();
  const TABS = { zeit: "time", urlaub: "leave", kalender: "calendar" } as const;
  const tab = TABS[(sp.get("tab") ?? "zeit") as keyof typeof TABS] ?? "time";
  const setTab = (v: "time" | "leave" | "calendar") => setSp({ tab: Object.entries(TABS).find(([, x]) => x === v)![0] });
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
  const [q, setQ] = useState("");
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
      {list.data && list.data.entries.length > 0 && (
        <ListTools q={q} setQ={setQ} shown={list.data.entries.filter((e) => matches(q, e.note, e.project, e.user_name, new Date(e.started_at).toLocaleDateString(locale))).length} total={list.data.entries.length} />
      )}
      <div className="card" style={{ padding: 0 }}>
        {!list.data ? <Loading error={list.error} /> : (
          <table>
            <thead><tr><th>{T.start}</th><th>{T.end}</th><th>{T.pause}</th><th className="n">{T.total}</th><th>{T.note}</th><th /></tr></thead>
            <tbody>
              {list.data.entries.filter((e) => matches(q, e.note, e.project, e.user_name, new Date(e.started_at).toLocaleDateString(locale))).map((e) => (
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
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [lk, setLk] = useState("");
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
      <ListTools q={q} setQ={setQ} shown={data.items.filter((l) => (!st || l.status === st) && (!lk || l.kind === lk) && matches(q, l.user_name, T.k[l.kind], l.substitute, l.note)).length} total={data.items.length}>
        <Filter label={T.status} value={st} onChange={setSt} options={Object.entries(T.s)} />
        <Filter label={T.kind} value={lk} onChange={setLk} options={Object.entries(T.k)} />
      </ListTools>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr>{scope === "team" && <th>{T.person}</th>}<th>{T.kind}</th><th>{T.from}</th><th>{T.to}</th><th className="n">{T.days}</th><th>{T.substitute}</th><th>{T.status}</th><th /></tr></thead>
          <tbody>
            {data.items.filter((l) => (!st || l.status === st) && (!lk || l.kind === lk) && matches(q, l.user_name, T.k[l.kind], l.substitute, l.note)).map((l) => {
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
type Guest = { email: string; name: string; invited?: boolean };
type Ev = { id: string; title: string; description: string; location: string; starts_at: string; ends_at: string; all_day: boolean; mandatory: boolean;
  created_by: string; created_by_name: string; attendees: { id: string; name: string; response: keyof L["r"] }[]; can_edit: boolean;
  reminders: number[]; online: boolean; lobby: boolean; meeting_id: string | null; guests: Guest[] };
type Edit = Partial<Ev> & { attendeeIds?: string[] };
const REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880];
const CT = {
  de: { online: "Online-Meeting (Video im Browser)", lobby: "Gäste warten im Vorraum, bis jemand aus dem Team sie einlässt", remind: "Erinnerung (bis zu 3)",
    guests: "Gäste ohne Konto", guestsHint: "Bekommen eine Einladung per E-Mail mit Link – kein Konto nötig.", addGuest: "+ Gast", email: "E-Mail", name: "Name",
    join: "Meeting beitreten", now: "Sofort-Meeting", link: "Gastlink", copy: "Kopieren", copied: "Kopiert", invited: "eingeladen", dayHint: "Tag anklicken für neuen Termin",
    rem: (m: number) => (m === 0 ? "bei Beginn" : m < 60 ? `${m} min` : m < 1440 ? `${m / 60} Std.` : `${m / 1440} ${m === 1440 ? "Tag" : "Tage"}`) },
  en: { online: "Online meeting (video in the browser)", lobby: "Guests wait in a waiting room until someone from the team admits them", remind: "Reminder (up to 3)",
    guests: "Guests without an account", guestsHint: "They get an email invitation with a link – no account needed.", addGuest: "+ Guest", email: "Email", name: "Name",
    join: "Join meeting", now: "Instant meeting", link: "Guest link", copy: "Copy", copied: "Copied", invited: "invited", dayHint: "Click a day to add an event",
    rem: (m: number) => (m === 0 ? "at start" : m < 60 ? `${m} min` : m < 1440 ? `${m / 60} h` : `${m / 1440} ${m === 1440 ? "day" : "days"}`) },
  ar: { online: "اجتماع عبر الإنترنت (فيديو في المتصفح)", lobby: "ينتظر الضيوف في غرفة الانتظار حتى يُدخلهم أحد أعضاء الفريق", remind: "تذكير (حتى 3)",
    guests: "ضيوف بدون حساب", guestsHint: "يتلقون دعوة بالبريد الإلكتروني مع رابط – لا حاجة لحساب.", addGuest: "+ ضيف", email: "البريد الإلكتروني", name: "الاسم",
    join: "الانضمام إلى الاجتماع", now: "اجتماع فوري", link: "رابط الضيف", copy: "نسخ", copied: "تم النسخ", invited: "تمت الدعوة", dayHint: "انقر على يوم لإضافة موعد",
    rem: (m: number) => (m === 0 ? "عند البدء" : m < 60 ? `${m} دقيقة` : m < 1440 ? `${m / 60} ساعة` : `${m / 1440} يوم`) },
};

function Calendar({ people }: { people: Person[] }) {
  const T = useT();
  const { locale } = useI18n();
  const C = CT[locale];
  const { me } = useAuth();
  const nav = useNavigate();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [team, setTeam] = useState(false);
  const [data, setData] = useState<{ events: Ev[]; leaves: LeaveRow[] } | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  // Gastlink für den Organisator nachladen
  useEffect(() => {
    setLink(null); setCopied(false);
    if (edit?.id && edit.meeting_id && edit.can_edit) api<{ link?: string }>(`/api/v1/meetings/${edit.meeting_id}`).then((i) => setLink(i.link ?? null)).catch(() => {});
  }, [edit?.id, edit?.meeting_id, edit?.can_edit]);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const evOn = (d: Date) => (data?.events ?? []).filter((e) => new Date(e.starts_at) < new Date(d.getTime() + 86400000) && new Date(e.ends_at) >= d);
  const lvOn = (d: Date) => (data?.leaves ?? []).filter((l) => new Date(l.start_date) <= d && new Date(l.end_date + "T23:59:59") >= d);
  const respond = (id: string, response: string) => api(`/api/v1/calendar/${id}/respond`, { body: { response } }).then(load).catch((e) => setErr(e.message));
  const s = useSubmit();
  const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }));
  const blank = (start: Date, minutes = 60): Edit => ({ title: "", starts_at: local(start), ends_at: local(new Date(start.getTime() + minutes * 60000)), attendeeIds: [],
    mandatory: false, all_day: false, location: "", description: "", reminders: [15], online: false, lobby: true, guests: [] });
  const newOn = (d: Date) => {
    const st = new Date(d);
    if (sameDay(d, new Date())) { const n = new Date(); st.setHours(n.getHours() + 1, 0, 0, 0); } else st.setHours(9, 0, 0, 0);
    setEdit(blank(st));
  };
  const instant = s.run(async () => {
    const st = new Date();
    const r = await api<{ meeting_id: string }>("/api/v1/calendar", { body: { title: C.now, starts_at: st.toISOString(), ends_at: new Date(st.getTime() + 3600000).toISOString(),
      attendees: [], online: true, lobby: true, reminders: [], guests: [] } });
    nav(`/portal/meeting/${r.meeting_id}`);
  });
  const joinable = (e: Partial<Ev>) => !!e.meeting_id && new Date(e.ends_at!).getTime() + 3 * 3600000 > Date.now() && new Date(e.starts_at!).getTime() - 2 * 3600000 < Date.now();
  const setGuest = (i: number, g: Partial<Guest>) => setEdit({ ...edit!, guests: (edit!.guests ?? []).map((x, j) => (j === i ? { ...x, ...g } : x)) });
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row">
          <button className="btn small ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="‹">{T.prev}</button>
          <b style={{ minWidth: 150, textAlign: "center" }}>{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</b>
          <button className="btn small ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="›">{T.next}</button>
          <button className="btn small ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>{T.todayBtn}</button>
          {isLead && <label className="row" style={{ gap: 6, margin: 0 }}><input type="checkbox" checked={team} onChange={(e) => setTeam(e.target.checked)} />{T.team}</label>}
        </div>
        <div className="row">
          <button className="btn small ghost" onClick={instant} disabled={s.busy}>🎥 {C.now}</button>
          <button className="btn small" onClick={() => newOn(new Date())}>+ {T.newEvent}</button>
        </div>
      </div>
      {(err || (!edit && s.error)) && <div className="alert">{err ?? s.error}</div>}
      <p className="muted" style={{ fontSize: ".82rem", margin: "0 0 8px" }}>{C.dayHint}</p>
      <div className="cal">
        {wd.map((w) => <div key={w} className="cal-h">{w}</div>)}
        {days.map((d) => (
          <div key={d.toISOString()} className={`cal-d ${d.getMonth() !== month.getMonth() ? "out" : ""} ${sameDay(d, new Date()) ? "today" : ""}`}
            role="button" tabIndex={0} aria-label={`${d.toLocaleDateString(locale)} – ${T.newEvent}`}
            onClick={() => newOn(d)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) newOn(d); }}>
            <div className="cal-n">{d.getDate()}</div>
            {lvOn(d).map((l) => <div key={l.id} className={`cal-lv lv-${l.status}`} onClick={(e) => e.stopPropagation()} title={`${l.user_name}: ${T.k[l.kind]}${l.substitute ? ` · ${T.substitute}: ${l.substitute}` : ""}`}>🏖 {team ? l.user_name.split("@")[0] : T.k[l.kind]}</div>)}
            {evOn(d).map((e) => {
              const myResp = e.attendees.find((a) => a.id === me?.id)?.response;
              return (
                <button key={e.id} className={`cal-ev ${e.mandatory ? "mand" : ""} ${myResp === "declined" ? "declined" : ""}`}
                  onClick={(x) => { x.stopPropagation(); setEdit({ ...e, starts_at: local(new Date(e.starts_at)), ends_at: local(new Date(e.ends_at)), attendeeIds: e.attendees.map((a) => a.id) }); }}>
                  {!e.all_day && new Date(e.starts_at).toLocaleTimeString(locale, { timeStyle: "short" })} {e.online && "🎥"}{e.mandatory && "📌"}{e.title}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? edit.title ?? "" : T.newEvent} onClose={() => setEdit(null)}>
          {edit.id && joinable(edit) && (
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="btn primary" onClick={() => nav(`/portal/meeting/${edit.meeting_id}`)}>🎥 {C.join}</button>
            </div>
          )}
          {link && (
            <Field label={C.link}>
              <div className="link-box"><span style={{ flex: 1 }} dir="ltr">{link}</span>
                <button type="button" className="btn small ghost" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); }}>{copied ? C.copied : C.copy}</button></div>
            </Field>
          )}
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
                starts_at: new Date(edit.starts_at!).toISOString(), ends_at: new Date(edit.ends_at!).toISOString(), attendees: edit.attendeeIds ?? [],
                reminders: edit.reminders ?? [], online: !!edit.online, lobby: edit.lobby !== false,
                guests: (edit.guests ?? []).filter((g) => g.email.trim()).map((g) => ({ email: g.email.trim(), name: g.name.trim() })) };
              await api(edit.id ? `/api/v1/calendar/${edit.id}` : "/api/v1/calendar", { method: edit.id ? "PUT" : "POST", body });
              setEdit(null); load();
            })}>
              <Field label={T.title}><input required maxLength={200} autoFocus={!edit.id} value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <div className="grid2">
                <Field label={T.start}><input type="datetime-local" required value={edit.starts_at} onChange={(e) => {
                  // Ende mitverschieben (gleiche Dauer)
                  const dur = new Date(edit.ends_at!).getTime() - new Date(edit.starts_at!).getTime();
                  const st = new Date(e.target.value);
                  setEdit({ ...edit, starts_at: e.target.value, ends_at: isNaN(st.getTime()) ? edit.ends_at : local(new Date(st.getTime() + Math.max(dur, 0))) });
                }} /></Field>
                <Field label={T.end}><input type="datetime-local" required min={edit.starts_at} value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></Field>
                <Field label={T.place}><input maxLength={300} value={edit.location ?? ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
                <label className="row" style={{ gap: 6, alignSelf: "end" }}><input type="checkbox" checked={!!edit.all_day} onChange={(e) => setEdit({ ...edit, all_day: e.target.checked })} />{T.allDay}</label>
              </div>
              <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!edit.online} onChange={(e) => setEdit({ ...edit, online: e.target.checked })} />🎥 {C.online}</label>
              {edit.online && <label className="row" style={{ gap: 6, marginInlineStart: 22 }}><input type="checkbox" checked={edit.lobby !== false} onChange={(e) => setEdit({ ...edit, lobby: e.target.checked })} />{C.lobby}</label>}
              <Field label={C.remind}>
                <div className="chips">
                  {REMINDERS.map((m) => {
                    const on = edit.reminders?.includes(m) ?? false;
                    return <button type="button" key={m} className={on ? "on" : ""} aria-pressed={on}
                      onClick={() => setEdit({ ...edit, reminders: on ? edit.reminders!.filter((x) => x !== m) : [...(edit.reminders ?? []), m].slice(-3) })}>{C.rem(m)}</button>;
                  })}
                </div>
              </Field>
              <Field label={T.note}><textarea rows={2} maxLength={5000} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label={T.invite}>
                <div className="att-pick">
                  {people.filter((p) => p.id !== me?.id).map((p) => (
                    <label key={p.id} className="row" style={{ gap: 4, margin: 0 }}>
                      <input type="checkbox" checked={edit.attendeeIds?.includes(p.id) ?? false}
                        onChange={(e) => setEdit({ ...edit, attendeeIds: e.target.checked ? [...(edit.attendeeIds ?? []), p.id] : (edit.attendeeIds ?? []).filter((x) => x !== p.id) })} />
                      {p.name}{edit.id && edit.attendees?.find((a) => a.id === p.id) && <span className="muted"> ({T.r[edit.attendees.find((a) => a.id === p.id)!.response]})</span>}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={C.guests}>
                <p className="muted" style={{ fontSize: ".8rem", margin: "0 0 6px" }}>{C.guestsHint}</p>
                {(edit.guests ?? []).map((g, i) => (
                  <div key={i} className="guest-row">
                    <input type="email" dir="ltr" placeholder={C.email} value={g.email} onChange={(e) => setGuest(i, { email: e.target.value })} />
                    <input placeholder={C.name} maxLength={100} value={g.name} onChange={(e) => setGuest(i, { name: e.target.value })} />
                    <button type="button" className="btn small ghost" aria-label="✕" onClick={() => setEdit({ ...edit, guests: edit.guests!.filter((_, j) => j !== i) })}>
                      {g.invited ? `✓ ${C.invited} ✕` : "✕"}</button>
                  </div>
                ))}
                <button type="button" className="btn small ghost" onClick={() => setEdit({ ...edit, online: true, guests: [...(edit.guests ?? []), { email: "", name: "" }] })}>{C.addGuest}</button>
              </Field>
              {isLead && <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!edit.mandatory} onChange={(e) => setEdit({ ...edit, mandatory: e.target.checked })} />📌 {T.mandatory}</label>}
              {s.error && <div className="alert">{s.error}</div>}
              <div className="row between">
                <button className="btn" disabled={s.busy}>{T.save}</button>
                {edit.id && <button type="button" className="btn small danger" onClick={() => confirm(`${T.del}?`) && api(`/api/v1/calendar/${edit.id}`, { method: "DELETE" }).then(() => { setEdit(null); load(); }).catch((e) => setErr(e.message))}>{T.del}</button>}
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
