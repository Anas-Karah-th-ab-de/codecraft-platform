// Projekt-Dokumente: Berichte, Verträge, Spezifikationen … Team lädt hoch, Kunde sieht freigegebene Dokumente.
import { useRef, useState } from "react";
import { ApiError, api, getToken, openPdf, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { useSubmit } from "../../ui";

export type ProjectDocument = {
  id: string; title: string; kind: DocKind; name: string; mime: string; size: number;
  for_customer: boolean; uploader: string | null; created_at: string;
};
type DocKind = "report" | "contract" | "offer" | "spec" | "protocol" | "other";

const DT = {
  de: { title: "Dokumente", none: "Noch keine Dokumente.", upload: "Hochladen", name: "Titel (optional – sonst Dateiname)", file: "Datei wählen",
    internal: "nur intern", open: "Öffnen", del: "Löschen", delQ: (t: string) => `„${t}“ löschen?`, by: "von",
    hint: "Für den Kunden sichtbare Dokumente erscheinen auch unter Neuigkeiten, der Kunde wird benachrichtigt.",
    k: { report: "Fortschrittsbericht", contract: "Vertrag", offer: "Angebot", spec: "Spezifikation", protocol: "Protokoll", other: "Sonstiges" } },
  en: { title: "Documents", none: "No documents yet.", upload: "Upload", name: "Title (optional – file name otherwise)", file: "Choose file",
    internal: "internal only", open: "Open", del: "Delete", delQ: (t: string) => `Delete “${t}”?`, by: "by",
    hint: "Documents visible to the customer also appear under updates, and the customer is notified.",
    k: { report: "Progress report", contract: "Contract", offer: "Offer", spec: "Specification", protocol: "Minutes", other: "Other" } },
  ar: { title: "المستندات", none: "لا توجد مستندات بعد.", upload: "رفع", name: "العنوان (اختياري – وإلا اسم الملف)", file: "اختيار ملف",
    internal: "داخلي فقط", open: "فتح", del: "حذف", delQ: (t: string) => `حذف «${t}»؟`, by: "بواسطة",
    hint: "المستندات المرئية للعميل تظهر أيضاً في المستجدات ويتم إشعار العميل.",
    k: { report: "تقرير تقدّم", contract: "عقد", offer: "عرض", spec: "مواصفات", protocol: "محضر", other: "أخرى" } },
};

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function ProjectDocuments({ projectId, docs, onChange }: { projectId: string; docs: ProjectDocument[]; onChange: () => void }) {
  const { locale } = useI18n();
  const T = DT[locale];
  const { me } = useAuth();
  const staff = !!me?.is_employee;
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ title: "", kind: "report" as DocKind, internal: false });
  const [picked, setPicked] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const sub = useSubmit();

  const send = sub.run(async () => {
    const chosen = file.current?.files?.[0];
    if (!chosen) return;
    const fd = new FormData();
    fd.append("title", f.title.trim());
    fd.append("kind", f.kind);
    fd.append("for_customer", f.internal ? "false" : "true");
    fd.append("file", chosen);
    const res = await fetch(`/api/v1/projects/${projectId}/documents`, { method: "POST", headers: { authorization: `Bearer ${getToken()}` }, body: fd });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message ?? msg; } catch { /* kein JSON */ }
      throw new ApiError(res.status, msg);
    }
    setF({ title: "", kind: "report", internal: false });
    setPicked("");
    if (file.current) file.current.value = "";
    onChange();
  });

  const open = (d: ProjectDocument) => { setErr(null); openPdf(`/api/v1/project-documents/${d.id}`).catch((x) => setErr(String((x as Error).message ?? x))); };
  const remove = async (d: ProjectDocument) => {
    if (!confirm(T.delQ(d.title))) return;
    await api(`/api/v1/project-documents/${d.id}`, { method: "DELETE" });
    onChange();
  };

  return (
    <div className="card" style={{ margin: "16px 0" }}>
      <h3>{T.title}</h3>
      {docs.length === 0 && <p className="muted">{T.none}</p>}
      {docs.length > 0 && (
        <ul className="docs">
          {docs.map((d) => (
            <li key={d.id} className={d.for_customer ? "" : "internal"}>
              <span className="doc-ic" aria-hidden="true">{d.mime === "application/pdf" ? "📄" : "📎"}</span>
              <div className="doc-main">
                <b dir="auto">{d.title}</b>
                <small className="muted">
                  <span className="badge">{T.k[d.kind] ?? d.kind}</span>{" "}
                  {new Date(d.created_at).toLocaleDateString(locale)} · <span dir="ltr">{size(d.size)}</span>
                  {d.uploader && ` · ${T.by} ${d.uploader}`}{!d.for_customer && ` · 🔒 ${T.internal}`}
                </small>
              </div>
              <button className="btn small" onClick={() => open(d)}>{T.open}</button>
              {staff && <button className="btn small ghost" onClick={() => remove(d).catch((x) => setErr(String((x as Error).message ?? x)))} aria-label={T.del} title={T.del}>✕</button>}
            </li>
          ))}
        </ul>
      )}
      {err && <p className="alert">{err}</p>}
      {staff && (
        <form className="doc-up" onSubmit={send}>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <label className="btn small ghost" style={{ margin: 0 }}>
              📎 {picked || T.file}
              <input ref={file} type="file" required hidden onChange={(e) => setPicked(e.target.files?.[0]?.name ?? "")} />
            </label>
            <input placeholder={T.name} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ flex: "1 1 220px" }} dir="auto" />
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as DocKind })} style={{ width: "auto" }}>
              {Object.entries(T.k).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="row" style={{ gap: 6, margin: 0 }}>
              <input type="checkbox" style={{ width: "auto" }} checked={f.internal} onChange={(e) => setF({ ...f, internal: e.target.checked })} />🔒 {T.internal}
            </label>
            <button className="btn small" disabled={sub.busy || !picked}>{T.upload}</button>
          </div>
          <small className="muted">{T.hint}</small>
        </form>
      )}
    </div>
  );
}
