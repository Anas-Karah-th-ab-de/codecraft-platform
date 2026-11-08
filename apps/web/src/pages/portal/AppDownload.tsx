import { useI18n } from "../../i18n";
import { Icon } from "../../icons";
import { useEffect, useState } from "react";
import { native, useIsApp, type AppInfo } from "../../native";

/** App-Downloads für Kunden und Mitarbeiter (Android-APK, Linux-.deb) */
const AT = {
  de: {
    intro: "Mit der App bekommen Sie Nachrichten, Anrufe und Mitteilungen direkt auf Handy oder PC – auch wenn der Browser geschlossen ist. Ein Fernzugriff durch unseren Support ist nur möglich, wenn Sie ihn in der App ausdrücklich erlauben.",
    android: "Android", androidSub: "APK · ab Android 8", linux: "Linux", linuxSub: ".deb · Ubuntu, Debian, Mint",
    dl: "Herunterladen", howTitle: "So installieren Sie die App",
    a1: "Auf dem Handy diese Seite öffnen und „Android“ herunterladen.",
    a2: "Datei öffnen. Fragt Android nach „Unbekannte Apps installieren“, für den Browser erlauben.",
    a3: "App starten, mit Ihrem Portal-Zugang anmelden und Benachrichtigungen erlauben.",
    l1: "Datei herunterladen und per Doppelklick installieren – oder: sudo apt install ./km-portal_amd64.deb",
    inApp: "Sie nutzen das Portal bereits in der App.",
    win: "Windows folgt in Kürze.",
  },
  en: {
    intro: "With the app you receive messages, calls and notifications directly on your phone or PC – even when the browser is closed. Remote access by our support is only possible if you explicitly allow it in the app.",
    android: "Android", androidSub: "APK · Android 8 or later", linux: "Linux", linuxSub: ".deb · Ubuntu, Debian, Mint",
    dl: "Download", howTitle: "How to install",
    a1: "Open this page on your phone and download “Android”.",
    a2: "Open the file. If Android asks about “Install unknown apps”, allow it for your browser.",
    a3: "Start the app, sign in with your portal account and allow notifications.",
    l1: "Download the file and double-click to install – or: sudo apt install ./km-portal_amd64.deb",
    inApp: "You are already using the portal in the app.",
    win: "Windows is coming soon.",
  },
  ar: {
    intro: "مع التطبيق تصلك الرسائل والمكالمات والإشعارات مباشرة على الهاتف أو الحاسوب – حتى عند إغلاق المتصفح. الوصول عن بُعد من فريق الدعم ممكن فقط إذا سمحت به صراحةً في التطبيق.",
    android: "أندرويد", androidSub: "APK · أندرويد 8 أو أحدث", linux: "لينكس", linuxSub: ".deb · أوبونتو، ديبيان، مينت",
    dl: "تنزيل", howTitle: "طريقة التثبيت",
    a1: "افتح هذه الصفحة على الهاتف ونزّل «أندرويد».",
    a2: "افتح الملف. إذا سأل أندرويد عن «تثبيت التطبيقات غير المعروفة» فاسمح بذلك للمتصفح.",
    a3: "شغّل التطبيق وسجّل الدخول بحساب البوابة واسمح بالإشعارات.",
    l1: "نزّل الملف وثبّته بالنقر المزدوج – أو: sudo apt install ./km-portal_amd64.deb",
    inApp: "أنت تستخدم البوابة داخل التطبيق بالفعل.",
    win: "نسخة ويندوز قريباً.",
  },
};

export function AppDownload() {
  const { locale } = useI18n();
  const T = AT[locale];
  const inApp = useIsApp();
  return (
    <div className="grid2">
      <div className="card">
        <p>{T.intro}</p>
        {inApp && <p className="note-ok">{T.inApp}</p>}
        <div className="dev-row">
          <Icon name="phone" />
          <div><b>{T.android}</b><small className="muted">{T.androidSub}</small></div>
          <a className="btn small" href="/downloads/km-portal.apk" download><Icon name="download" size={16} /> {T.dl}</a>
        </div>
        <div className="dev-row">
          <Icon name="monitor" />
          <div><b>{T.linux}</b><small className="muted">{T.linuxSub}</small></div>
          <a className="btn small ghost" href="/downloads/km-portal_amd64.deb" download><Icon name="download" size={16} /> {T.dl}</a>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>{T.win}</p>
      </div>
      <div className="card">
        <h3><Icon name="info" /> {T.howTitle}</h3>
        <h4>{T.android}</h4>
        <ol className="olist"><li>{T.a1}</li><li>{T.a2}</li><li>{T.a3}</li></ol>
        <h4>{T.linux}</h4>
        <p dir="ltr" style={{ textAlign: "start" }}><small>{T.l1}</small></p>
      </div>
    </div>
  );
}

const UT = {
  de: { avail: (v: string) => `Neue App-Version ${v} verfügbar`, now: "Jetzt aktualisieren", later: "Später", copied: "Link kopiert – bitte im Browser öffnen, herunterladen und installieren.", hint: "Download startet im Browser – danach die Datei öffnen und installieren. Ihre Anmeldung bleibt erhalten." },
  en: { avail: (v: string) => `New app version ${v} available`, now: "Update now", later: "Later", copied: "Link copied – please open it in the browser, download and install.", hint: "The download starts in the browser – then open the file and install. You stay signed in." },
  ar: { avail: (v: string) => `يتوفر إصدار جديد للتطبيق ${v}`, now: "تحديث الآن", later: "لاحقاً", copied: "تم نسخ الرابط – افتحه في المتصفح ونزّل التطبيق وثبّته.", hint: "يبدأ التنزيل في المتصفح – ثم افتح الملف وثبّته. يبقى تسجيل دخولك محفوظاً." },
};

/** semver-artiger Vergleich „0.1.12“ > „0.1.9“ */
const newer = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d > 0; }
  return false;
};

/** In der App: neuere Version auf dem Server → Update anbieten (Android: passende Variante) */
export function UpdateBanner() {
  const { locale } = useI18n();
  const T = UT[locale];
  const inApp = useIsApp();
  const [offer, setOffer] = useState<{ version: string; url: string } | null>(null);
  useEffect(() => {
    if (!inApp) return;
    let stop = false;
    const check = async () => {
      try {
        const info = await native<AppInfo>("app_info");
        if (info.platform !== "android") return;
        const r = await fetch("/downloads/app-version.json", { cache: "no-store" });
        if (!r.ok) return;
        const m = await r.json() as { android?: { version: string; standard: string; control: string } };
        const a = m.android;
        if (!a || !newer(a.version, info.version)) return;
        let skipped: string | null = null;
        try { skipped = sessionStorage.getItem("km_update_later"); } catch { /* egal */ }
        if (skipped === a.version || stop) return;
        const path = info.support?.control_available ? a.control : a.standard;
        setOffer({ version: a.version, url: new URL(path, location.origin).href });
      } catch { /* offline o. ä. */ }
    };
    check();
    const t = window.setInterval(check, 6 * 3600 * 1000);
    return () => { stop = true; clearInterval(t); };
  }, [inApp]);
  if (!offer) return null;
  return (
    <div className="update-banner" role="status">
      <div><b>{T.avail(offer.version)}</b><small className="muted">{T.hint}</small></div>
      <div className="row">
        <button className="btn small" onClick={() => native("open_url", { url: offer.url }).catch(() => {
          // ältere App ohne open_url: Link kopieren, im Browser öffnen
          navigator.clipboard?.writeText(offer.url).catch(() => {});
          alert(`${offer.url}\n\n${T.copied}`);
        })}>{T.now}</button>
        <button className="btn small ghost" onClick={() => { try { sessionStorage.setItem("km_update_later", offer.version); } catch { /* egal */ } setOffer(null); }}>{T.later}</button>
      </div>
    </div>
  );
}
