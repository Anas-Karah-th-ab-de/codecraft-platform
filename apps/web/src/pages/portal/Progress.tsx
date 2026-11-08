// Projektfortschritt: Fortschrittsbalken, Meilensteine, Neuigkeiten (Team pflegt, Kunde sieht).
import { useState } from "react";
import { api, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { useSubmit } from "../../ui";

const PT = {
  de: { progress: "Fortschritt", milestones: "Meilensteine", updates: "Neuigkeiten", add: "Meilenstein hinzufügen", title: "Titel", due: "fällig",
    post: "Veröffentlichen", internal: "nur intern", write: "Was gibt es Neues im Projekt?", none: "Noch keine Meilensteine.", noUpdates: "Noch keine Neuigkeiten.",
    s: { planned: "geplant", in_progress: "in Arbeit", done: "erledigt" }, manual: "Fortschritt (ohne Meilensteine)" },
  en: { progress: "Progress", milestones: "Milestones", updates: "Updates", add: "Add milestone", title: "Title", due: "due",
    post: "Publish", internal: "internal only", write: "What's new in the project?", none: "No milestones yet.", noUpdates: "No updates yet.",
    s: { planned: "planned", in_progress: "in progress", done: "done" }, manual: "Progress (without milestones)" },
  ar: { progress: "التقدم", milestones: "المراحل", updates: "المستجدات", add: "إضافة مرحلة", title: "العنوان", due: "الموعد",
    post: "نشر", internal: "داخلي فقط", write: "ما الجديد في المشروع؟", none: "لا توجد مراحل بعد.", noUpdates: "لا توجد مستجدات بعد.",
    s: { planned: "مخططة", in_progress: "قيد العمل", done: "منجزة" }, manual: "التقدم (بدون مراحل)" },
};

export type Milestone = { id: string; position: number; title: string; description: string; due_date: string | null; status: "planned" | "in_progress" | "done"; done_at: string | null };
export type Update = { id: string; author: string | null; body: string; for_customer: boolean; created_at: string };

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="pbar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /><span>{value} %</span>
    </div>
  );
}

export function ProjectProgress({ projectId, progress, milestones, updates, onChange }: {
  projectId: string; progress: number; milestones: Milestone[]; updates: Update[]; onChange: () => void;
}) {
  const { locale } = useI18n();
  const T = PT[locale];
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const [m, setM] = useState({ title: "", due_date: "" });
  const [u, setU] = useState({ body: "", for_customer: true });
  const sm = useSubmit();
  const su = useSubmit();
  const setStatus = (id: string, status: string) => api(`/api/v1/milestones/${id}`, { method: "PATCH", body: { status } }).then(onChange);
  return (
    <div className="grid2" style={{ margin: "16px 0", alignItems: "start" }}>
      <div className="card">
        <h3>{T.progress}</h3>
        <ProgressBar value={progress} />
        {staff && milestones.length === 0 && (
          <label className="muted" style={{ display: "block", marginTop: 8 }}>{T.manual}
            <input type="range" min={0} max={100} step={5} defaultValue={progress}
              onMouseUp={(e) => api(`/api/v1/projects/${projectId}`, { method: "PATCH", body: { progress: +(e.target as HTMLInputElement).value } }).then(onChange)} />
          </label>
        )}
        <h3 style={{ marginTop: 16 }}>{T.milestones}</h3>
        {milestones.length === 0 && <p className="muted">{T.none}</p>}
        <ol className="milestones">
          {milestones.map((x) => (
            <li key={x.id} className={`ms-${x.status}`}>
              <span className="ms-dot">{x.status === "done" ? "✓" : x.status === "in_progress" ? "◐" : "○"}</span>
              <div style={{ flex: 1 }}>
                <b>{x.title}</b>
                <div className="muted" style={{ fontSize: ".8em" }}>{T.s[x.status]}{x.due_date && ` · ${T.due} ${new Date(x.due_date).toLocaleDateString(locale)}`}</div>
              </div>
              {staff && (
                <select value={x.status} onChange={(e) => setStatus(x.id, e.target.value)} style={{ width: "auto" }}>
                  {Object.entries(T.s).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
            </li>
          ))}
        </ol>
        {staff && (
          <form className="row" onSubmit={sm.run(async () => {
            await api(`/api/v1/projects/${projectId}/milestones`, { body: { title: m.title, due_date: m.due_date || null } });
            setM({ title: "", due_date: "" }); onChange();
          })}>
            <input required placeholder={T.title} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} />
            <input type="date" style={{ width: "auto" }} value={m.due_date} onChange={(e) => setM({ ...m, due_date: e.target.value })} />
            <button className="btn small" disabled={sm.busy}>{T.add}</button>
          </form>
        )}
      </div>
      <div className="card">
        <h3>{T.updates}</h3>
        {staff && (
          <form onSubmit={su.run(async () => {
            await api(`/api/v1/projects/${projectId}/updates`, { body: u });
            setU({ body: "", for_customer: true }); onChange();
          })}>
            <textarea required rows={3} placeholder={T.write} value={u.body} onChange={(e) => setU({ ...u, body: e.target.value })} />
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn small" disabled={su.busy}>{T.post}</button>
              <label className="row" style={{ gap: 6, margin: 0 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={!u.for_customer} onChange={(e) => setU({ ...u, for_customer: !e.target.checked })} />🔒 {T.internal}
              </label>
            </div>
          </form>
        )}
        {updates.length === 0 && <p className="muted">{T.noUpdates}</p>}
        {updates.map((x) => (
          <div key={x.id} className={`pupd ${x.for_customer ? "" : "internal"}`}>
            <div className="muted" style={{ fontSize: ".8em" }}>{x.author ?? ""} · {new Date(x.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}{!x.for_customer && ` · 🔒 ${T.internal}`}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{x.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
