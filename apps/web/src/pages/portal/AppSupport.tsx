// Support-Zugriff in der App: der Fernwartungs-Agent läuft nur, solange der Benutzer ihn freigibt.
import { useCallback, useEffect, useState } from "react";
import { api, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Icon } from "../../icons";
import { isApp, native, type AppInfo, type SupportStatus } from "../../native";

const ST = {
  de: {
    title: "Support-Zugriff", intro: "Unser Support kann dieses Gerät nur erreichen, während Sie den Zugriff hier freigeben. Den Bildschirm sieht er erst nach Ihrer Zustimmung – jedes Mal.",
    off: "Aus – niemand kann auf dieses Gerät zugreifen.", on: (t: string) => `Freigegeben bis ${t}`, start: "Support-Zugriff freigeben", stop: "Zugriff beenden",
    dur: "Dauer", min: (n: number) => (n < 60 ? `${n} Min.` : `${n / 60} Std.`), files: "Dateien austauschen erlauben",
    code: "Nennen Sie dem Techniker diesen Code:", codeHint: (m: number) => `Gültig zum Einlösen 15 Minuten, Zugriff danach ${m} Minuten.`,
    staff: "Mitarbeiter mit Geräterechten sehen dieses Gerät jetzt unter „Geräte“.",
    ctrlTitle: "Steuerung am Handy", ctrlOff: "Der Support kann nur zusehen. Damit er tippen und wischen kann, die Bedienungshilfe „KM Portal Fernsteuerung“ einschalten.",
    ctrlOn: "Steuerung ist eingeschaltet (Bedienungshilfe aktiv).", ctrlBtn: "Bedienungshilfe öffnen",
    ctrlNone: "Diese App-Version enthält keine Fernsteuerung – der Support kann nur zusehen. Für Steuerung die Variante mit Fernsteuerung installieren (ersetzt diese App).", ctrlDl: "Variante mit Fernsteuerung",
    what: "Was passiert?", w1: "Die App verbindet sich mit dem Support-Server (verschlüsselt).", w2: "Möchte ein Techniker den Bildschirm sehen, fragt das Gerät Sie mit seinem Namen.",
    w3: "Sie sehen jederzeit, dass eine Sitzung läuft, und können sie sofort beenden.", w4: "Nach Ablauf der Dauer trennt sich die App automatisch.",
    notApp: "Diese Funktion gibt es in der KM-Portal-App für Android, Windows und Linux.", device: "Gerät",
  },
  en: {
    title: "Support access", intro: "Our support can only reach this device while you allow it here. They only see the screen after you agree – every time.",
    off: "Off – nobody can access this device.", on: (t: string) => `Allowed until ${t}`, start: "Allow support access", stop: "End access",
    dur: "Duration", min: (n: number) => (n < 60 ? `${n} min` : `${n / 60} h`), files: "Allow file transfer",
    code: "Tell the technician this code:", codeHint: (m: number) => `Valid for 15 minutes to redeem, then access for ${m} minutes.`,
    staff: "Staff with device rights now see this device under “Devices”.",
    ctrlTitle: "Control on the phone", ctrlOff: "Support can only watch. To let them tap and swipe, turn on the accessibility service “KM Portal remote control”.",
    ctrlOn: "Control is on (accessibility service active).", ctrlBtn: "Open accessibility",
    ctrlNone: "This app version has no remote control – support can only watch. For control, install the remote-control variant (replaces this app).", ctrlDl: "Remote-control variant",
    what: "What happens?", w1: "The app connects to the support server (encrypted).", w2: "If a technician wants to see the screen, the device asks you, showing their name.",
    w3: "You always see that a session is running and can end it at once.", w4: "When the time is up, the app disconnects automatically.",
    notApp: "This feature is available in the KM Portal app for Android, Windows and Linux.", device: "Device",
  },
  ar: {
    title: "الوصول للدعم", intro: "لا يمكن لفريق الدعم الوصول إلى هذا الجهاز إلا أثناء سماحك بذلك هنا. ولا يرى الشاشة إلا بعد موافقتك – في كل مرة.",
    off: "متوقف – لا أحد يمكنه الوصول إلى هذا الجهاز.", on: (t: string) => `مسموح حتى ${t}`, start: "السماح بوصول الدعم", stop: "إنهاء الوصول",
    dur: "المدة", min: (n: number) => (n < 60 ? `${n} دقيقة` : `${n / 60} ساعة`), files: "السماح بتبادل الملفات",
    code: "أعطِ الفني هذا الرمز:", codeHint: (m: number) => `صالح للاستخدام 15 دقيقة، ثم وصول لمدة ${m} دقيقة.`,
    staff: "يرى الموظفون أصحاب صلاحية الأجهزة هذا الجهاز الآن في «الأجهزة».",
    ctrlTitle: "التحكم في الهاتف", ctrlOff: "يمكن للدعم المشاهدة فقط. للسماح باللمس والسحب فعّل خدمة الإتاحة «KM Portal Fernsteuerung».",
    ctrlOn: "التحكم مفعّل (خدمة الإتاحة نشطة).", ctrlBtn: "فتح إعدادات الإتاحة",
    ctrlNone: "هذه النسخة لا تتضمن التحكم عن بُعد – يمكن للدعم المشاهدة فقط. للتحكم ثبّت النسخة مع التحكم عن بُعد (تحل محل هذا التطبيق).", ctrlDl: "النسخة مع التحكم عن بُعد",
    what: "ماذا يحدث؟", w1: "يتصل التطبيق بخادم الدعم (مشفّر).", w2: "إذا أراد فني رؤية الشاشة يسألك الجهاز مع ذكر اسمه.",
    w3: "ترى دائماً أن جلسة تعمل ويمكنك إنهاؤها فوراً.", w4: "عند انتهاء المدة ينقطع التطبيق تلقائياً.",
    notApp: "هذه الميزة متوفرة في تطبيق KM Portal لأندرويد وويندوز ولينكس.", device: "الجهاز",
  },
};

export function AppSupport() {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = ST[locale];
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [st, setSt] = useState<SupportStatus | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [files, setFiles] = useState(false);
  const [code, setCode] = useState<{ code: string; minutes: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!isApp()) return;
    native<AppInfo>("app_info").then((i) => { setInfo(i); setSt(i.support); }).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const t = window.setInterval(() => native<SupportStatus>("support_status").then(setSt).catch(() => {}), 5000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [load]);

  if (!isApp()) return <div className="card muted"><Icon name="device" /> {T.notApp}</div>;
  const start = async () => {
    setBusy(true); setErr(null);
    try {
      const s = await native<SupportStatus>("support_start", { minutes, files });
      setSt(s);
      // Kunden: Einmal-Code nur für dieses Gerät erzeugen
      if (me?.role === "customer" && info?.device_id) {
        const r = await api<{ code: string; minutes: number }>("/api/v1/access-codes", { body: { device_ids: [info.device_id], minutes } });
        setCode(r);
      }
    } catch (e) { setErr((e as Error).message ?? String(e)); } finally { setBusy(false); }
  };
  const stop = async () => { setSt(await native<SupportStatus>("support_stop")); setCode(null); };
  const until = st?.until ? new Date(st.until * 1000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="grid2">
      <div className={`card support-card ${st?.running ? "live" : ""}`}>
        <h3><Icon name="shield" /> {T.title}</h3>
        <p className="muted">{T.intro}</p>
        <div className={`support-state ${st?.running ? "on" : ""}`}>
          <span className="dot" /> <b>{st?.running ? T.on(until) : T.off}</b>
        </div>
        {!st?.running ? (
          <>
            <div className="field-l">{T.dur}</div>
            <div className="seg sm wrap">
              {[15, 30, 60, 120].map((m) => <button key={m} className={minutes === m ? "on" : ""} onClick={() => setMinutes(m)}>{T.min(m)}</button>)}
            </div>
            {info?.platform !== "android" && (
              <label className="check-row"><input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} /> {T.files}</label>
            )}
            <button className="btn" style={{ marginTop: 12 }} disabled={busy || !info?.enrolled} onClick={start}><Icon name="unlock" size={16} /> {T.start}</button>
          </>
        ) : (
          <button className="btn danger" style={{ marginTop: 12 }} onClick={stop}><Icon name="lock" size={16} /> {T.stop}</button>
        )}
        {st?.running && code && (
          <div className="note-ok">{T.code}<code className="big-code" dir="ltr">{code.code}</code><small>{T.codeHint(code.minutes)}</small></div>
        )}
        {st?.running && me?.is_employee && <p className="muted">{T.staff}</p>}
        {err && <p className="error">{err}</p>}
        {info && <small className="muted">{T.device}: {info.platform} · App {info.version}</small>}
      </div>
      <div className="card">
        {info?.platform === "android" && (
          <>
            <h3><Icon name="device" /> {T.ctrlTitle}</h3>
            {st?.control_available === false ? (
              <>
                <p className="muted">{T.ctrlNone}</p>
                <a className="btn small ghost" href="/downloads/km-portal-fernsteuerung.apk" download><Icon name="download" size={16} /> {T.ctrlDl}</a>
              </>
            ) : (
              <>
                <p className={st?.control ? "ok-t" : "muted"}>{st?.control ? T.ctrlOn : T.ctrlOff}</p>
                {!st?.control && <button className="btn small ghost" onClick={() => native("control_settings")}><Icon name="settings" size={16} /> {T.ctrlBtn}</button>}
              </>
            )}
            <hr />
          </>
        )}
        <h3><Icon name="info" /> {T.what}</h3>
        <ul className="olist"><li>{T.w1}</li><li>{T.w2}</li><li>{T.w3}</li><li>{T.w4}</li></ul>
      </div>
    </div>
  );
}
