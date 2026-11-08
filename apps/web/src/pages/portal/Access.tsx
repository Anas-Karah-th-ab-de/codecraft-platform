// Einmal-Passwort ändern, Einmal-Zugriffscodes (Kunde erzeugt, Techniker löst ein), Passwort-Reset durch Admin.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, useApi, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Field, LangSwitch, Loading, useSubmit } from "../../ui";

const AT = {
  de: {
    forceTitle: "Eigenes Passwort festlegen", forceText: "Sie haben ein Einmal-Passwort bekommen. Bitte legen Sie jetzt ein eigenes Passwort fest (mindestens 10 Zeichen). Erst danach sind Portal, Nachrichten und E-Mail freigeschaltet.",
    onetime: "Einmal-Passwort", newPw: "Neues Passwort", repeat: "Neues Passwort wiederholen", mismatch: "Die Passwörter stimmen nicht überein", save: "Passwort speichern", logout: "Abmelden",
    title: "Fernzugriff", intro: "Unsere Techniker können Ihre Geräte nur sehen und steuern, wenn Sie hier einen Code erzeugen und ihnen mitteilen. Der Code gilt 15 Minuten zum Einlösen und nur für die ausgewählten Geräte. Sie können den Zugriff jederzeit beenden.",
    devices: "Geräte auswählen", none: "Noch keine Geräte registriert.", duration: "Zugriffsdauer", create: "Code erzeugen", yourCode: "Ihr Zugriffscode", tellCode: "Nennen Sie diesen Code dem Techniker (Telefon, Chat). Gültig zum Einlösen bis", done: "Fertig",
    history: "Freigaben (30 Tage)", technician: "Techniker", until: "Zugriff bis", state: "Status", end: "Beenden",
    waiting: "wartet auf Einlösung", active: "aktiv", expired: "abgelaufen", revoked: "beendet",
    always: "Dauerzugriff (Wartungsvertrag)", alwaysHint: "Techniker brauchen für dieses Gerät keinen Code",
    redeemTitle: "Zugriffscode einlösen", redeemHint: "Den 9-stelligen Code nennt Ihnen der Kunde.", redeem: "Einlösen", myGrants: "Meine Freigaben", open: "öffnen",
    reset: "Einmal-Passwort", resetQ: "Neues Einmal-Passwort erzeugen? Alle Sitzungen und App-Passwörter dieses Benutzers werden beendet.", resetDone: "Einmal-Passwort (nur jetzt sichtbar – sicher übermitteln):", copy: "Kopieren", mustChange: "muss Passwort ändern",
    min: "Min.", h: "Std.", customer: "Kunde",
  },
  en: {
    forceTitle: "Set your own password", forceText: "You received a one-time password. Please set your own password now (at least 10 characters). Portal, messages and email are unlocked afterwards.",
    onetime: "One-time password", newPw: "New password", repeat: "Repeat new password", mismatch: "Passwords do not match", save: "Save password", logout: "Log out",
    title: "Remote access", intro: "Our technicians can only see and control your devices if you create a code here and give it to them. The code must be redeemed within 15 minutes and only covers the selected devices. You can end access at any time.",
    devices: "Select devices", none: "No devices registered yet.", duration: "Access duration", create: "Create code", yourCode: "Your access code", tellCode: "Tell this code to the technician (phone, chat). Redeemable until", done: "Done",
    history: "Grants (30 days)", technician: "Technician", until: "Access until", state: "Status", end: "End",
    waiting: "waiting to be redeemed", active: "active", expired: "expired", revoked: "ended",
    always: "Permanent access (maintenance contract)", alwaysHint: "Technicians need no code for this device",
    redeemTitle: "Redeem access code", redeemHint: "The customer gives you the 9-digit code.", redeem: "Redeem", myGrants: "My grants", open: "open",
    reset: "One-time password", resetQ: "Create a new one-time password? All sessions and app passwords of this user are ended.", resetDone: "One-time password (visible only now – hand over securely):", copy: "Copy", mustChange: "must change password",
    min: "min", h: "h", customer: "Customer",
  },
  ar: {
    forceTitle: "تعيين كلمة مرور خاصة", forceText: "حصلت على كلمة مرور لمرة واحدة. يرجى تعيين كلمة مرور خاصة بك الآن (10 أحرف على الأقل). بعدها يتم تفعيل البوابة والرسائل والبريد.",
    onetime: "كلمة المرور لمرة واحدة", newPw: "كلمة المرور الجديدة", repeat: "تكرار كلمة المرور الجديدة", mismatch: "كلمتا المرور غير متطابقتين", save: "حفظ كلمة المرور", logout: "تسجيل الخروج",
    title: "الوصول عن بُعد", intro: "لا يستطيع فنيونا رؤية أجهزتك أو التحكم بها إلا إذا أنشأت رمزاً هنا وأعطيته لهم. يجب استخدام الرمز خلال 15 دقيقة وهو صالح للأجهزة المختارة فقط. يمكنك إنهاء الوصول في أي وقت.",
    devices: "اختر الأجهزة", none: "لا توجد أجهزة مسجلة بعد.", duration: "مدة الوصول", create: "إنشاء رمز", yourCode: "رمز الوصول الخاص بك", tellCode: "أعطِ هذا الرمز للفني (هاتف، دردشة). صالح للاستخدام حتى", done: "تم",
    history: "التصاريح (30 يوماً)", technician: "الفني", until: "الوصول حتى", state: "الحالة", end: "إنهاء",
    waiting: "بانتظار الاستخدام", active: "نشط", expired: "منتهي", revoked: "تم الإنهاء",
    always: "وصول دائم (عقد صيانة)", alwaysHint: "لا يحتاج الفنيون إلى رمز لهذا الجهاز",
    redeemTitle: "استخدام رمز الوصول", redeemHint: "يعطيك العميل الرمز المكوّن من 9 أرقام.", redeem: "استخدام", myGrants: "تصاريحي", open: "فتح",
    reset: "كلمة مرور لمرة واحدة", resetQ: "إنشاء كلمة مرور جديدة لمرة واحدة؟ سيتم إنهاء جميع جلسات هذا المستخدم وكلمات مرور التطبيقات.", resetDone: "كلمة المرور لمرة واحدة (تظهر الآن فقط – سلّمها بأمان):", copy: "نسخ", mustChange: "يجب تغيير كلمة المرور",
    min: "دقيقة", h: "ساعة", customer: "العميل",
  },
};
const useAT = () => AT[useI18n().locale];

type Grant = {
  id: string; devices: { id: string; name: string; kind: string }[]; minutes: number; created_at: string; redeem_until: string;
  redeemed_at: string | null; access_until: string | null; revoked_at: string | null; technician: string | null; customer: string | null;
  state: "waiting" | "active" | "expired" | "revoked";
};
type Dev = { id: string; name: string; kind: string; online: boolean; access_policy: "code" | "staff" };

const time = (d: string | null, locale: string) => (d ? new Date(d).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : "–");

/** Nach Einmal-Passwort: nur diese Seite, bis ein eigenes Passwort gesetzt ist */
export function ForcePassword() {
  const T = useAT();
  const { logout, refresh } = useAuth();
  const [f, setF] = useState({ current: "", new: "", repeat: "" });
  const [err, setErr] = useState<string | null>(null);
  const s = useSubmit();
  return (
    <div className="login-wrap">
      <form className="card" onSubmit={(e) => {
        e.preventDefault();
        if (f.new !== f.repeat) return setErr(T.mismatch);
        setErr(null);
        s.run(async () => { await api("/api/v1/auth/password", { body: { current: f.current, new: f.new } }); await refresh(); })();
      }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <img src="/brand/logo.png" alt="KM Code Craft" width="95" height="40" />
          <LangSwitch />
        </div>
        <h2>{T.forceTitle}</h2>
        <p className="muted">{T.forceText}</p>
        <Field label={T.onetime}><input type="password" dir="ltr" autoComplete="current-password" required autoFocus value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label={T.newPw}><input type="password" dir="ltr" autoComplete="new-password" minLength={10} required value={f.new} onChange={(e) => setF({ ...f, new: e.target.value })} /></Field>
        <Field label={T.repeat}><input type="password" dir="ltr" autoComplete="new-password" minLength={10} required value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} /></Field>
        {(err || s.error) && <div className="alert">{err ?? s.error}</div>}
        <div className="row between">
          <button className="btn" disabled={s.busy}>{T.save}</button>
          <button type="button" className="btn ghost small" onClick={logout}>{T.logout}</button>
        </div>
      </form>
    </div>
  );
}

const DURATIONS = [15, 30, 60, 120, 240, 480];

/** Kunde: Geräte freigeben, Code anzeigen, Freigaben sehen und beenden */
export function CustomerAccess() {
  const T = useAT();
  const { locale } = useI18n();
  const devs = useApi<Dev[]>("/api/v1/devices");
  const grants = useApi<Grant[]>("/api/v1/access-codes");
  const [sel, setSel] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(60);
  const [code, setCode] = useState<{ code: string; until: number } | null>(null);
  const s = useSubmit();
  // Status live halten (Techniker löst ein → „aktiv“)
  useEffect(() => { const i = setInterval(grants.reload, 10000); return () => clearInterval(i); }, [grants.reload]);
  const dur = (m: number) => (m < 60 ? `${m} ${T.min}` : `${m / 60} ${T.h}`);
  return (
    <>
      <h1>{T.title}</h1>
      <p className="muted" style={{ maxWidth: 760 }}>{T.intro}</p>
      <div className="grid2">
        <div className="card">
          <h3>{T.devices}</h3>
          {!devs.data ? <Loading error={devs.error} /> : devs.data.length === 0 ? <p className="muted">{T.none}</p> : (
            <form onSubmit={s.run(async () => {
              const r = await api<{ code: string; redeem_minutes: number }>("/api/v1/access-codes", { body: { device_ids: sel, minutes } });
              setCode({ code: r.code, until: Date.now() + r.redeem_minutes * 60000 });
              setSel([]);
              grants.reload();
            })}>
              {devs.data.map((d) => (
                <div key={d.id} className="row between access-dev">
                  <label className="row" style={{ gap: 8, margin: 0 }}>
                    <input type="checkbox" style={{ width: "auto" }} disabled={d.access_policy === "staff"} checked={sel.includes(d.id)}
                      onChange={(e) => setSel(e.target.checked ? [...sel, d.id] : sel.filter((x) => x !== d.id))} />
                    <span><b>{d.name}</b> <span className="muted">· {d.kind}</span></span>
                    <span className={`badge ${d.online ? "online" : "offline"}`}>{d.online ? "●" : "○"}</span>
                  </label>
                  <label className="row muted" style={{ gap: 4, margin: 0, fontSize: ".85em" }} title={T.alwaysHint}>
                    <input type="checkbox" style={{ width: "auto" }} checked={d.access_policy === "staff"}
                      onChange={async (e) => { await api(`/api/v1/devices/${d.id}/access-policy`, { method: "PUT", body: { policy: e.target.checked ? "staff" : "code" } }); devs.reload(); }} />
                    {T.always}
                  </label>
                </div>
              ))}
              <div className="row" style={{ marginTop: 12 }}>
                <Field label={T.duration}>
                  <select value={minutes} onChange={(e) => setMinutes(+e.target.value)}>
                    {DURATIONS.map((m) => <option key={m} value={m}>{dur(m)}</option>)}
                  </select>
                </Field>
                <button className="btn" disabled={s.busy || sel.length === 0}>{T.create}</button>
              </div>
              {s.error && <div className="alert">{s.error}</div>}
            </form>
          )}
        </div>
        {code && (
          <div className="card access-code">
            <h3>{T.yourCode}</h3>
            <div className="code-big" dir="ltr">{code.code}</div>
            <p className="muted">{T.tellCode} {new Date(code.until).toLocaleTimeString(locale, { timeStyle: "short" })}</p>
            <button className="btn ghost" onClick={() => setCode(null)}>{T.done}</button>
          </div>
        )}
      </div>
      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <h3 style={{ padding: "14px 16px 0" }}>{T.history}</h3>
        {!grants.data ? <Loading error={grants.error} /> : <GrantTable grants={grants.data} customer onChange={grants.reload} />}
      </div>
    </>
  );
}

function GrantTable({ grants, customer, onChange }: { grants: Grant[]; customer?: boolean; onChange: () => void }) {
  const T = useAT();
  const { locale } = useI18n();
  if (grants.length === 0) return <p className="muted" style={{ padding: 16 }}>–</p>;
  return (
    <table>
      <thead><tr><th>{T.devices}</th><th>{customer ? T.technician : T.customer}</th><th>{T.until}</th><th>{T.state}</th><th /></tr></thead>
      <tbody>
        {grants.map((g) => (
          <tr key={g.id}>
            <td>{g.devices.map((d, i) => (
              <span key={d.id}>{i > 0 && ", "}{customer ? d.name : <Link to={`/portal/geraete/${d.id}`}>{d.name}</Link>}</span>
            ))}</td>
            <td>{(customer ? g.technician : g.customer) ?? "–"}</td>
            <td>{g.state === "waiting" ? time(g.redeem_until, locale) : time(g.access_until, locale)}</td>
            <td><span className={`badge grant-${g.state}`}>{T[g.state]}</span></td>
            <td>{(g.state === "waiting" || g.state === "active") && (
              <button className="btn danger small" onClick={async () => { await api(`/api/v1/access-codes/${g.id}/revoke`, { method: "POST" }); onChange(); }}>{T.end}</button>
            )}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Techniker: Code einlösen (+ eigene aktive Freigaben) */
export function RedeemCode({ onRedeemed, compact }: { onRedeemed?: () => void; compact?: boolean }) {
  const T = useAT();
  const [code, setCode] = useState("");
  const mine = useApi<Grant[]>(compact ? null : "/api/v1/access-codes");
  const s = useSubmit();
  return (
    <div className="card">
      <h3>{T.redeemTitle}</h3>
      <p className="muted">{T.redeemHint}</p>
      <form className="row" onSubmit={s.run(async () => {
        await api("/api/v1/access-codes/redeem", { body: { code } });
        setCode("");
        mine.reload();
        onRedeemed?.();
      })}>
        <input inputMode="numeric" dir="ltr" autoComplete="one-time-code" placeholder="123 456 789" required
          style={{ width: 200, fontSize: "1.3em", letterSpacing: ".15em", textAlign: "center" }}
          value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 11))} />
        <button className="btn" disabled={s.busy}>{T.redeem}</button>
      </form>
      {s.error && <div className="alert">{s.error}</div>}
      {!compact && mine.data && mine.data.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <b>{T.myGrants}</b>
          <GrantTable grants={mine.data} onChange={mine.reload} />
        </div>
      )}
    </div>
  );
}

/** Admin: Einmal-Passwort für einen Benutzer erzeugen */
export function ResetPassword({ userId, onDone }: { userId: string; onDone?: () => void }) {
  const T = useAT();
  const [pw, setPw] = useState<string | null>(null);
  const s = useSubmit();
  if (pw) {
    return (
      <span className="row" style={{ gap: 6 }}>
        <code dir="ltr" title={T.resetDone}>{pw}</code>
        <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(pw)}>{T.copy}</button>
      </span>
    );
  }
  return (
    <button className="btn small ghost" disabled={s.busy} title={s.error ?? undefined} onClick={() => {
      if (!confirm(T.resetQ)) return;
      s.run(async () => { setPw((await api<{ password: string }>(`/api/v1/users/${userId}/reset-password`, { method: "POST" })).password); onDone?.(); })();
    }}>{T.reset}</button>
  );
}

export const useMustChangeLabel = () => useAT().mustChange;
