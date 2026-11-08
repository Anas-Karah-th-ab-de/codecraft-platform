// Konto: angemeldete Geräte/Sitzungen beenden, persönliche Schlüssel für VS Code & Desktop.
import { useEffect, useState } from "react";
import { api } from "../../api";
import { useI18n } from "../../i18n";
import { Icon } from "../../icons";

const ST = {
  de: {
    title: "Angemeldete Geräte & Schlüssel", intro: "Beenden Sie Sitzungen, die Sie nicht kennen. Schlüssel verbinden Erweiterungen wie VS Code mit dem Portal (Anrufe, Mitteilungen).",
    session: "Browser-Sitzung", key: "Schlüssel", current: "dieses Gerät", created: "seit", expires: "gültig bis", used: "zuletzt benutzt", end: "Beenden",
    newKey: "Neuer Schlüssel", name: "Name, z. B. VS Code Laptop", create: "Erstellen", once: "Nur jetzt sichtbar – in VS Code einfügen:",
    vsTitle: "Anrufe und Mitteilungen in VS Code", vs1: "Erweiterung herunterladen", vs2: "In VS Code: Erweiterungen → „…“ → „Aus VSIX installieren…“",
    vs3: "Befehl „KM Portal: Anmelden“ ausführen und Portal-Adresse sowie Schlüssel einfügen.", vs4: "Eingehende Anrufe klingeln dann auch in VS Code – „Annehmen“ öffnet das Portal.",
    copy: "Kopieren", copied: "Kopiert",
  },
  en: {
    title: "Signed-in devices & keys", intro: "End sessions you don't recognise. Keys connect extensions like VS Code to the portal (calls, notifications).",
    session: "Browser session", key: "Key", current: "this device", created: "since", expires: "valid until", used: "last used", end: "End",
    newKey: "New key", name: "Name, e.g. VS Code laptop", create: "Create", once: "Shown only now – paste it into VS Code:",
    vsTitle: "Calls and notifications in VS Code", vs1: "Download extension", vs2: "In VS Code: Extensions → “…” → “Install from VSIX…”",
    vs3: "Run “KM Portal: Sign in” and paste the portal address and the key.", vs4: "Incoming calls then ring in VS Code too – “Accept” opens the portal.",
    copy: "Copy", copied: "Copied",
  },
  ar: {
    title: "الأجهزة المسجلة والمفاتيح", intro: "أنهِ الجلسات التي لا تعرفها. المفاتيح تربط إضافات مثل VS Code بالبوابة (المكالمات والإشعارات).",
    session: "جلسة متصفح", key: "مفتاح", current: "هذا الجهاز", created: "منذ", expires: "صالح حتى", used: "آخر استخدام", end: "إنهاء",
    newKey: "مفتاح جديد", name: "الاسم، مثلاً VS Code الحاسوب", create: "إنشاء", once: "يظهر الآن فقط – الصقه في VS Code:",
    vsTitle: "المكالمات والإشعارات في VS Code", vs1: "تنزيل الإضافة", vs2: "في VS Code: الإضافات ← «…» ← «التثبيت من VSIX…»",
    vs3: "نفّذ الأمر «KM Portal: Sign in» والصق عنوان البوابة والمفتاح.", vs4: "عندها ترنّ المكالمات الواردة في VS Code أيضاً – «قبول» يفتح البوابة.",
    copy: "نسخ", copied: "تم النسخ",
  },
};

type Tok = { id: string; name: string; created_at: string; expires_at: string | null; last_used_at: string | null; current: boolean };

export function Sessions() {
  const { locale } = useI18n();
  const T = ST[locale];
  const [list, setList] = useState<Tok[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<Tok[]>("/api/v1/account/tokens").then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  const d = (s: string) => new Date(s).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="grid2">
      <div className="card">
        <h3><Icon name="shield" /> {T.title}</h3>
        <p className="muted">{T.intro}</p>
        <div className="tok-list">
          {list.map((x) => {
            const key = x.name.startsWith("key:");
            return (
              <div key={x.id} className="dev-row">
                <Icon name={key ? "key" : "monitor"} />
                <div>
                  <b>{key ? x.name.slice(4) : T.session}{x.current && <span className="tag ok" style={{ marginInlineStart: 8 }}>{T.current}</span>}</b>
                  <small className="muted">{T.created} {d(x.created_at)}{x.expires_at && ` · ${T.expires} ${d(x.expires_at)}`}{x.last_used_at && ` · ${T.used} ${d(x.last_used_at)}`}</small>
                </div>
                {!x.current && <button className="btn small ghost" onClick={() => api(`/api/v1/account/tokens/${x.id}`, { method: "DELETE" }).then(load)}>{T.end}</button>}
              </div>
            );
          })}
        </div>
        <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => {
          e.preventDefault(); setErr(null);
          api<{ token: string }>("/api/v1/account/tokens", { body: { name } }).then((r) => { setFresh(r.token); setName(""); setCopied(false); load(); }).catch((x) => setErr(x.message));
        }}>
          <input placeholder={T.name} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          <button className="btn small"><Icon name="plus" size={16} /> {T.create}</button>
        </form>
        {fresh && (
          <div className="note-ok">{T.once}
            <div className="row" style={{ marginTop: 6 }}>
              <code className="big-code" dir="ltr">{fresh}</code>
              <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(fresh).then(() => setCopied(true))}>{copied ? T.copied : T.copy}</button>
            </div>
          </div>
        )}
        {err && <p className="error">{err}</p>}
      </div>
      <div className="card">
        <h3><Icon name="vscode" /> {T.vsTitle}</h3>
        <ol className="olist">
          <li><a className="btn small" href="/downloads/km-portal.vsix" download><Icon name="download" size={16} /> {T.vs1}</a></li>
          <li>{T.vs2}</li>
          <li>{T.vs3} <code dir="ltr">{location.origin}</code></li>
          <li>{T.vs4}</li>
        </ol>
      </div>
    </div>
  );
}
