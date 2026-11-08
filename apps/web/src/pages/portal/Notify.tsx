// Mitteilungen: Glocke mit Zähler, Live-Hinweise (Ton, System-Benachrichtigung), Mitteilungs-Center,
// Einstellungen (stumm, Nicht stören, Push auf diesem Gerät), Ankündigungen mit Lesebestätigung.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Icon } from "../../icons";
import { Filter, ListTools, matches, NoHits } from "../../ui";
import { useComm } from "./Comm";
import { ensureEnrolled, isApp, native, waitApp } from "../../native";

type L = "de" | "en" | "ar";
const tri = (de: string, en: string, ar: string) => ({ de, en, ar });

/** Bezeichnung je Art/Ereignis (wie im Server für Push) */
const LABEL: Record<string, Record<string, { de: string; en: string; ar: string }>> = {
  ticket: { new: tri("Neues Ticket", "New ticket", "تذكرة جديدة"), message: tri("Neue Antwort im Ticket", "New reply on ticket", "رد جديد على التذكرة"), "*": tri("Ticket aktualisiert", "Ticket updated", "تم تحديث التذكرة") },
  order: { new: tri("Neue Bestellung", "New order", "طلب شراء جديد"), "*": tri("Bestellung aktualisiert", "Order updated", "تم تحديث الطلب") },
  quote: { sent: tri("Neues Angebot", "New quote", "عرض سعر جديد"), accepted: tri("Angebot angenommen", "Quote accepted", "تم قبول العرض"), "*": tri("Angebot geändert", "Quote changed", "تم تغيير العرض") },
  request: { new: tri("Neue Entwicklungsanfrage", "New development request", "طلب تطوير جديد"), message: tri("Neue Nachricht zur Anfrage", "New message on request", "رسالة جديدة على الطلب"), "*": tri("Anfrage aktualisiert", "Request updated", "تم تحديث الطلب") },
  project: { "*": tri("Projekt aktualisiert", "Project updated", "تم تحديث المشروع") },
  leave: { new: tri("Neuer Urlaubsantrag", "New leave request", "طلب إجازة جديد"), "*": tri("Urlaubsantrag aktualisiert", "Leave request updated", "تم تحديث طلب الإجازة") },
  calendar: { new: tri("Neue Einladung", "New invitation", "دعوة جديدة"), update: tri("Termin geändert", "Event changed", "تم تغيير الموعد"), delete: tri("Termin abgesagt", "Event cancelled", "تم إلغاء الموعد"), response: tri("Antwort auf Einladung", "Invitation response", "رد على الدعوة"), "*": tri("Erinnerung", "Reminder", "تذكير") },
  call: { ring: tri("Eingehender Anruf", "Incoming call", "مكالمة واردة"), "*": tri("Verpasster Anruf", "Missed call", "مكالمة فائتة") },
  message: { "*": tri("Neue Nachricht", "New message", "رسالة جديدة") },
  mail: { "*": tri("Neue E-Mail", "New email", "بريد جديد") },
  announcement: { "*": tri("Ankündigung", "Announcement", "إعلان") },
  user: { deactivated: tri("Konto gesperrt – Aufgaben an Sie übergeben", "Account locked – tasks handed to you", "تم إيقاف حساب – نُقلت المهام إليك"), "*": tri("Benutzerkonto", "User account", "حساب المستخدم") },
  system: { "*": tri("System", "System", "النظام") },
};
export const labelOf = (kind: string, event: string, l: L) => (LABEL[kind]?.[event] ?? LABEL[kind]?.["*"] ?? tri("Benachrichtigung", "Notification", "إشعار"))[l];

const KIND_ICON: Record<string, string> = {
  ticket: "support", order: "cart", quote: "quote", request: "code", project: "folder", leave: "briefcase", calendar: "calendar",
  call: "phone", message: "chat", mail: "mail", announcement: "megaphone", user: "user-x", system: "info",
};
const KIND_NAME: Record<string, { de: string; en: string; ar: string }> = {
  ticket: tri("Support-Tickets", "Support tickets", "تذاكر الدعم"), request: tri("Entwicklungsanfragen", "Development requests", "طلبات التطوير"),
  project: tri("Projekte", "Projects", "المشاريع"), quote: tri("Angebote", "Quotes", "عروض الأسعار"), order: tri("Bestellungen", "Orders", "الطلبات"),
  leave: tri("Urlaub", "Leave", "الإجازات"), calendar: tri("Kalender & Erinnerungen", "Calendar & reminders", "التقويم والتذكيرات"),
  call: tri("Anrufe", "Calls", "المكالمات"), message: tri("Chat-Nachrichten", "Chat messages", "رسائل الدردشة"), mail: tri("E-Mails", "Emails", "البريد"),
  announcement: tri("Ankündigungen", "Announcements", "الإعلانات"), user: tri("Benutzer & Übergaben", "Users & handovers", "المستخدمون ونقل المهام"),
};

export const NT = {
  de: {
    title: "Mitteilungen", all: "Alle", unread: "Ungelesen", markAll: "Alle als gelesen", clear: "Gelesene löschen", empty: "Keine Mitteilungen.",
    openAll: "Alle Mitteilungen", settings: "Einstellungen", thisDevice: "Dieses Gerät", pushOn: "Benachrichtigungen auf diesem Gerät sind aktiv.",
    pushOff: "Dieses Gerät bekommt noch keine Benachrichtigungen, wenn das Portal geschlossen ist.", pushBlocked: "Benachrichtigungen sind im Browser blockiert. Bitte in den Seiteneinstellungen erlauben.",
    pushNo: "Dieser Browser unterstützt keine Push-Benachrichtigungen. Tipp: Portal als App installieren (Chrome/Edge: Menü → „App installieren“, iPhone: Teilen → „Zum Home-Bildschirm“).",
    enable: "Auf diesem Gerät aktivieren", disable: "Deaktivieren", test: "Test senden", testOk: (n: number) => `Gesendet – ${n} Gerät(e) erreicht.`,
    sound: "Ton bei neuen Mitteilungen", dnd: "Nicht stören", dndOff: "aus", dnd1: "1 Stunde", dndEve: "bis morgen 8 Uhr", dndUntil: "bis",
    muted: "Ohne Ton und ohne Push (bleibt in der Liste)", devices: "Geräte mit Push", noDevices: "Noch keine Geräte.", remove: "Entfernen",
    lastOk: "zuletzt erreicht", never: "noch nie", read: "Gelesen", markUnread: "Als ungelesen", del: "Löschen", kind: "Art",
    inApp: "Sie nutzen die KM-Portal-App: Mitteilungen und Anrufe kommen über den App-Dienst – auch wenn die App geschlossen ist.", install: "App installieren", installHint: "Portal wie eine App auf Handy oder PC – mit Anrufen und Mitteilungen.", saved: "Gespeichert.",
    now: "gerade eben", min: (n: number) => `vor ${n} Min.`, hours: (n: number) => `vor ${n} Std.`, more: "Mehr laden",
  },
  en: {
    title: "Notifications", all: "All", unread: "Unread", markAll: "Mark all read", clear: "Delete read", empty: "No notifications.",
    openAll: "All notifications", settings: "Settings", thisDevice: "This device", pushOn: "Notifications on this device are on.",
    pushOff: "This device doesn't receive notifications yet while the portal is closed.", pushBlocked: "Notifications are blocked in the browser. Please allow them in the site settings.",
    pushNo: "This browser doesn't support push. Tip: install the portal as an app (Chrome/Edge: menu → “Install app”, iPhone: Share → “Add to Home Screen”).",
    enable: "Enable on this device", disable: "Disable", test: "Send test", testOk: (n: number) => `Sent – reached ${n} device(s).`,
    sound: "Sound for new notifications", dnd: "Do not disturb", dndOff: "off", dnd1: "1 hour", dndEve: "until 8 am tomorrow", dndUntil: "until",
    muted: "No sound and no push (still listed)", devices: "Devices with push", noDevices: "No devices yet.", remove: "Remove",
    lastOk: "last reached", never: "never", read: "Read", markUnread: "Mark unread", del: "Delete", kind: "Type",
    inApp: "You are using the KM Portal app: notifications and calls arrive through the app service – even when the app is closed.", install: "Install app", installHint: "Use the portal like an app on phone or PC – with calls and notifications.", saved: "Saved.",
    now: "just now", min: (n: number) => `${n} min ago`, hours: (n: number) => `${n} h ago`, more: "Load more",
  },
  ar: {
    title: "الإشعارات", all: "الكل", unread: "غير مقروء", markAll: "تعليم الكل كمقروء", clear: "حذف المقروء", empty: "لا توجد إشعارات.",
    openAll: "كل الإشعارات", settings: "الإعدادات", thisDevice: "هذا الجهاز", pushOn: "الإشعارات مفعّلة على هذا الجهاز.",
    pushOff: "هذا الجهاز لا يتلقى إشعارات بعد عندما تكون البوابة مغلقة.", pushBlocked: "الإشعارات محظورة في المتصفح. يرجى السماح بها من إعدادات الموقع.",
    pushNo: "هذا المتصفح لا يدعم الإشعارات. نصيحة: ثبّت البوابة كتطبيق (Chrome/Edge: القائمة ← «تثبيت التطبيق»، iPhone: مشاركة ← «إضافة إلى الشاشة الرئيسية»).",
    enable: "تفعيل على هذا الجهاز", disable: "إيقاف", test: "إرسال تجربة", testOk: (n: number) => `تم الإرسال – وصل إلى ${n} جهاز.`,
    sound: "صوت للإشعارات الجديدة", dnd: "عدم الإزعاج", dndOff: "متوقف", dnd1: "ساعة واحدة", dndEve: "حتى الثامنة صباح الغد", dndUntil: "حتى",
    muted: "بدون صوت وبدون إشعار (تبقى في القائمة)", devices: "الأجهزة المفعّلة", noDevices: "لا توجد أجهزة بعد.", remove: "إزالة",
    lastOk: "آخر وصول", never: "أبداً", read: "مقروء", markUnread: "تعليم كغير مقروء", del: "حذف", kind: "النوع",
    inApp: "أنت تستخدم تطبيق KM Portal: تصل الإشعارات والمكالمات عبر خدمة التطبيق – حتى عندما يكون التطبيق مغلقاً.", install: "تثبيت التطبيق", installHint: "استخدم البوابة كتطبيق على الهاتف أو الحاسوب – مع المكالمات والإشعارات.", saved: "تم الحفظ.",
    now: "الآن", min: (n: number) => `قبل ${n} دقيقة`, hours: (n: number) => `قبل ${n} ساعة`, more: "تحميل المزيد",
  },
};

export type Note = {
  id: string; kind: string; event: string; ref_id: string | null; title: string; body: string; link: string | null;
  actor: string | null; priority: number; created_at: string; read_at: string | null;
};
type Prefs = { muted: string[]; sound: boolean; dnd_until: string | null; kinds: string[] };
type Banner = { id: string; title: string; level: "info" | "important" | "urgent"; require_ack: boolean };

export function ago(iso: string, l: L) {
  const T = NT[l];
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return T.now;
  if (m < 60) return T.min(m);
  if (m < 24 * 60) return T.hours(Math.round(m / 60));
  return new Date(iso).toLocaleDateString(l, { day: "2-digit", month: "short" });
}

// ── Töne (ohne Audiodateien, per WebAudio) ──────────────────────────────────

let audio: AudioContext | null = null;
const ctx = () => (audio ??= new (window.AudioContext || (window as any).webkitAudioContext)());
// Browser erlauben Ton erst nach einer Interaktion → beim ersten Klick vorbereiten
if (typeof window !== "undefined") window.addEventListener("pointerdown", () => { try { ctx().resume(); } catch { /* egal */ } }, { once: true });

function tone(freqs: number[], dur: number, at = 0, vol = 0.08) {
  try {
    const c = ctx();
    const t0 = c.currentTime + at;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.setValueAtTime(vol, t0 + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    g.connect(c.destination);
    freqs.forEach((f) => { const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + dur); });
  } catch { /* kein Ton möglich */ }
}

/** Kurzer Hinweiston (zwei Töne) */
export const chime = () => { tone([880], 0.12, 0, 0.06); tone([1320], 0.18, 0.13, 0.06); };

/** Klingelton für eingehende Anrufe (bis stop) */
export function ringtone(): () => void {
  let on = true;
  const ring = () => {
    if (!on) return;
    tone([440, 480], 0.4, 0, 0.09); tone([440, 480], 0.4, 0.5, 0.09);
    navigator.vibrate?.([400, 200, 400]);
  };
  ring();
  const i = window.setInterval(ring, 2600);
  return () => { on = false; clearInterval(i); navigator.vibrate?.(0); };
}

/** Freiton beim Anrufen */
export function ringback(): () => void {
  const beep = () => tone([425], 1.0, 0, 0.04);
  beep();
  const i = window.setInterval(beep, 4000);
  return () => clearInterval(i);
}

// ── Push auf diesem Gerät ───────────────────────────────────────────────────

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const b64ToBytes = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const app = matchMedia("(display-mode: standalone)").matches ? " · App" : "";
  return `${br}${os ? ` · ${os}` : ""}${app}`;
}

export async function registerSw() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}

export async function currentSub() {
  const reg = await navigator.serviceWorker?.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(perm);
  const reg = (await registerSw()) ?? (await navigator.serviceWorker.ready);
  const { key } = await api<{ key: string }>("/api/v1/push/key");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  const j = sub.toJSON();
  await api("/api/v1/push/subscribe", { body: { endpoint: j.endpoint, keys: j.keys, label: deviceLabel() } });
}

export async function disablePush() {
  const sub = await currentSub();
  if (sub) {
    await api("/api/v1/push/unsubscribe", { body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
}

// ── Kontext ─────────────────────────────────────────────────────────────────

type Ctx = {
  unread: number; latest: Note[]; prefs: Prefs | null; banner: Banner[]; annUnread: number;
  reload: () => void; markRead: (ids: string[] | "all") => Promise<void>; setPrefs: (p: Prefs) => Promise<void>; reloadAnn: () => void;
};
const NCtx = createContext<Ctx | null>(null);
export const useNotify = () => useContext(NCtx)!;

export function NotifyProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { locale } = useI18n();
  const comm = useComm();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState<Note[]>([]);
  const [prefs, setPrefsState] = useState<Prefs | null>(null);
  const [banner, setBanner] = useState<Banner[]>([]);
  const [annUnread, setAnnUnread] = useState(0);
  const [toasts, setToasts] = useState<Note[]>([]);
  const prefsRef = useRef<Prefs | null>(null);
  prefsRef.current = prefs;

  const reload = useCallback(() => {
    api<{ items: Note[]; unread: number }>("/api/v1/notifications").then((r) => { setLatest(r.items.slice(0, 8)); setUnread(r.unread); }).catch(() => {});
  }, []);
  const reloadAnn = useCallback(() => {
    api<{ unread: number; banner: Banner[] }>("/api/v1/announcements/pending").then((r) => { setBanner(r.banner); setAnnUnread(r.unread); }).catch(() => {});
  }, []);

  useEffect(() => {
    reload(); reloadAnn();
    api<Prefs>("/api/v1/notifications/prefs").then(setPrefsState).catch(() => {});
    // Service Worker bereitstellen; ein vorhandenes Abo neu melden (Schlüssel/Benutzer könnten gewechselt haben)
    if (!isApp() && !/; wv\)/.test(navigator.userAgent)) registerSw().then(async () => {
      if (pushSupported() && Notification.permission === "granted") {
        const sub = await currentSub();
        if (sub) { const j = sub.toJSON(); api("/api/v1/push/subscribe", { body: { endpoint: j.endpoint, keys: j.keys, label: deviceLabel() } }).catch(() => {}); }
      }
    });
  }, [reload, reloadAnn, me?.id]);

  // App: Installation anmelden; Seite aus einer Benachrichtigung öffnen
  useEffect(() => {
    if (!me) return;
    // Die App-Brücke kann auf Android erst kurz nach dem Seitenstart da sein → ensureEnrolled wartet selbst
    const take = () => { if (isApp()) native<string | null>("app_pending_url").then((u) => { if (u) nav(u); }).catch(() => {}); };
    ensureEnrolled(me).then(take).catch((x) => {
      // Fehler der Geräte-Anmeldung im Server-Log sichtbar machen (sonst unbemerkt keine Benachrichtigungen)
      fetch(`/api/v1/app/diag?err=${encodeURIComponent(String((x as Error)?.message ?? x).slice(0, 200))}`).catch(() => {});
    });
    const vis = () => { if (document.visibilityState === "visible") take(); };
    window.addEventListener("km-app-open", take);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("km-app-open", take); document.removeEventListener("visibilitychange", vis); };
  }, [me, nav]);

  // Sprache für Push-Texte am Server merken
  useEffect(() => { if (me && me.locale !== locale) api("/api/v1/me/locale", { method: "PUT", body: { locale } }).catch(() => {}); }, [locale, me]);

  // Klick auf System-Benachrichtigung → Seite im offenen Portal öffnen
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "open" && typeof e.data.url === "string") nav(e.data.url.replace(location.origin, "")); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, [nav]);

  useEffect(() => comm.subscribe((e) => {
    if (e.type === "notification") {
      const n: Note = e.notification;
      setUnread((u) => u + 1);
      setLatest((l) => [n, ...l].slice(0, 8));
      if (n.kind === "announcement") reloadAnn();
      if (e.quiet) return;
      if (prefsRef.current?.sound !== false) chime();
      setToasts((t) => [n, ...t].slice(0, 3));
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), n.priority >= 2 ? 12000 : 6000);
      // Portal im Hintergrund → System-Benachrichtigung (ohne Push)
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const sys = new Notification(labelOf(n.kind, n.event, locale), { body: n.body ? `${n.title}\n${n.body}` : n.title, tag: n.id, icon: "/brand/icon-192.png" });
        sys.onclick = () => { window.focus(); if (n.link) nav(n.link); sys.close(); };
      }
    }
    if (e.type === "notification-read") reload();
    if (e.type === "announcement") reloadAnn();
  }), [comm, reload, reloadAnn, locale, nav]);

  // Seite der Mitteilung geöffnet → als gelesen markieren
  useEffect(() => {
    const hit = latest.filter((n) => !n.read_at && n.link && n.link.split(/[?#]/)[0] === pathname);
    if (hit.length) markRead(hit.map((n) => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, latest]);

  const markRead = async (ids: string[] | "all") => {
    await api("/api/v1/notifications/read", { body: ids === "all" ? { all: true } : { ids } });
    reload();
  };
  const setPrefs = async (p: Prefs) => {
    await api("/api/v1/notifications/prefs", { method: "PUT", body: { muted: p.muted, sound: p.sound, dnd_until: p.dnd_until } });
    setPrefsState(p);
  };

  const value = useMemo(() => ({ unread, latest, prefs, banner, annUnread, reload, markRead, setPrefs, reloadAnn }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unread, latest, prefs, banner, annUnread]);
  const T = NT[locale];
  return (
    <NCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((n) => (
          <div key={n.id} className={`ntoast p${n.priority}`} role="status">
            <span className="ntoast-ic"><Icon name={KIND_ICON[n.kind] ?? "bell"} /></span>
            <button className="ntoast-body" onClick={() => { setToasts((t) => t.filter((x) => x.id !== n.id)); if (n.link) nav(n.link); markRead([n.id]); }}>
              <small>{labelOf(n.kind, n.event, locale)}</small>
              <b dir="auto">{n.title}</b>
              {n.body && <span dir="auto">{n.body}</span>}
            </button>
            <button className="ntoast-x" aria-label={T.read} onClick={() => setToasts((t) => t.filter((x) => x.id !== n.id))}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
    </NCtx.Provider>
  );
}

// ── Glocke in der Kopfzeile ─────────────────────────────────────────────────

export function Bell() {
  const { locale } = useI18n();
  const T = NT[locale];
  const n = useNotify();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const dnd = n.prefs?.dnd_until && new Date(n.prefs.dnd_until) > new Date();
  return (
    <div className="bell-wrap" ref={ref}>
      <button className={`icon-btn ${open ? "on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog"
        aria-label={`${T.title}${n.unread ? ` (${n.unread})` : ""}`} title={T.title}>
        <Icon name={dnd ? "bell-off" : "bell"} size={19} />
        {n.unread > 0 && <span className="dot-n">{n.unread > 99 ? "99+" : n.unread}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label={T.title}>
          <div className="bell-head">
            <b>{T.title}</b>
            {n.unread > 0 && <button className="linkish" onClick={() => n.markRead("all")}><Icon name="check" size={15} /> {T.markAll}</button>}
          </div>
          <div className="bell-list">
            {n.latest.length === 0 && <p className="muted" style={{ padding: 16 }}>{T.empty}</p>}
            {n.latest.map((x) => <NoteRow key={x.id} n={x} compact onOpen={() => setOpen(false)} />)}
          </div>
          <Link className="bell-foot" to="/portal/mitteilungen">{T.openAll}<Icon name="chevron" size={16} /></Link>
        </div>
      )}
    </div>
  );
}

function NoteRow({ n, compact, onOpen, selected, onSelect }: { n: Note; compact?: boolean; onOpen?: () => void; selected?: boolean; onSelect?: () => void }) {
  const { locale } = useI18n();
  const T = NT[locale];
  const ctx = useNotify();
  const nav = useNavigate();
  const go = () => { if (!n.read_at) ctx.markRead([n.id]); onOpen?.(); if (n.link) nav(n.link); };
  return (
    <div className={`nrow ${n.read_at ? "" : "unread"} p${n.priority}`}>
      {onSelect && <input type="checkbox" checked={!!selected} onChange={onSelect} aria-label={n.title} />}
      <span className="nrow-ic"><Icon name={KIND_ICON[n.kind] ?? "bell"} /></span>
      <button className="nrow-main" onClick={go}>
        <small>{labelOf(n.kind, n.event, locale)}{n.actor && ` · ${n.actor}`}</small>
        <b dir="auto">{n.title}</b>
        {!compact && n.body && <span dir="auto">{n.body}</span>}
      </button>
      <time dateTime={n.created_at} title={new Date(n.created_at).toLocaleString(locale)}>{ago(n.created_at, locale)}</time>
      {!compact && (
        <span className="nrow-act">
          <button className="icon-btn sm" title={n.read_at ? T.markUnread : T.read}
            onClick={() => api("/api/v1/notifications/read", { body: { ids: [n.id], unread: !!n.read_at } }).then(ctx.reload)}>
            <Icon name={n.read_at ? "mail" : "check"} size={16} />
          </button>
          <button className="icon-btn sm" title={T.del} onClick={() => api(`/api/v1/notifications/${n.id}`, { method: "DELETE" }).then(() => { ctx.reload(); window.dispatchEvent(new Event("cc-notes")); })}>
            <Icon name="trash" size={16} />
          </button>
        </span>
      )}
    </div>
  );
}

// ── Banner für wichtige Ankündigungen ───────────────────────────────────────

const AT = {
  de: { title: "Ankündigungen", new: "Neue Ankündigung", ack: "Gelesen und verstanden", read: "Gelesen", open: "Ansehen", level: { info: "Info", important: "Wichtig", urgent: "Dringend" },
    audience: { all: "Alle", employees: "Mitarbeiter", customers: "Kunden", departments: "Abteilungen" }, pinned: "Angeheftet", requireAck: "Lesebestätigung verlangen",
    starts: "Sichtbar ab", ends: "Sichtbar bis (optional)", publish: "Veröffentlichen", save: "Speichern", cancel: "Abbrechen", edit: "Bearbeiten", del: "Löschen",
    confirmDel: "Ankündigung löschen?", body: "Text", headline: "Titel", stats: (r: number, a: number, n: number, ack: boolean) => ack ? `${a} von ${n} bestätigt · ${r} gelesen` : `${r} von ${n} gelesen`,
    lvlL: "Wichtigkeit", audL: "Zielgruppe", who: "Wer hat gelesen?", planned: "geplant", ended: "abgelaufen", empty: "Keine Ankündigungen.", acked: "bestätigt", notYet: "offen", by: "von" },
  en: { title: "Announcements", new: "New announcement", ack: "Read and understood", read: "Read", open: "View", level: { info: "Info", important: "Important", urgent: "Urgent" },
    audience: { all: "Everyone", employees: "Employees", customers: "Customers", departments: "Departments" }, pinned: "Pinned", requireAck: "Require read confirmation",
    starts: "Visible from", ends: "Visible until (optional)", publish: "Publish", save: "Save", cancel: "Cancel", edit: "Edit", del: "Delete",
    confirmDel: "Delete announcement?", body: "Text", headline: "Title", stats: (r: number, a: number, n: number, ack: boolean) => ack ? `${a} of ${n} confirmed · ${r} read` : `${r} of ${n} read`,
    lvlL: "Importance", audL: "Audience", who: "Who has read it?", planned: "scheduled", ended: "ended", empty: "No announcements.", acked: "confirmed", notYet: "open", by: "by" },
  ar: { title: "الإعلانات", new: "إعلان جديد", ack: "قرأت وفهمت", read: "مقروء", open: "عرض", level: { info: "معلومة", important: "مهم", urgent: "عاجل" },
    audience: { all: "الجميع", employees: "الموظفون", customers: "العملاء", departments: "أقسام" }, pinned: "مثبّت", requireAck: "طلب تأكيد القراءة",
    starts: "يظهر من", ends: "يظهر حتى (اختياري)", publish: "نشر", save: "حفظ", cancel: "إلغاء", edit: "تعديل", del: "حذف",
    confirmDel: "حذف الإعلان؟", body: "النص", headline: "العنوان", stats: (r: number, a: number, n: number, ack: boolean) => ack ? `${a} من ${n} أكّدوا · ${r} قرأوا` : `${r} من ${n} قرأوا`,
    lvlL: "الأهمية", audL: "الجمهور", who: "من قرأ؟", planned: "مجدول", ended: "منتهٍ", empty: "لا توجد إعلانات.", acked: "مؤكَّد", notYet: "مفتوح", by: "من" },
};

export function AnnouncementBanner() {
  const { locale } = useI18n();
  const A = AT[locale];
  const n = useNotify();
  const { pathname } = useLocation();
  if (n.banner.length === 0 || pathname.startsWith("/portal/ankuendigungen")) return null;
  const b = n.banner[0];
  return (
    <div className={`ann-banner lv-${b.level}`} role="alert">
      <Icon name="megaphone" />
      <span><small>{A.level[b.level]}</small> <b dir="auto">{b.title}</b>{n.banner.length > 1 && <small> · +{n.banner.length - 1}</small>}</span>
      <Link className="btn small" to={`/portal/ankuendigungen#${b.id}`}>{A.open}</Link>
    </div>
  );
}

// ── Seite: Mitteilungen + Einstellungen ─────────────────────────────────────

export function NotificationsPage() {
  const { locale } = useI18n();
  const T = NT[locale];
  const ctx = useNotify();
  const [items, setItems] = useState<Note[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [more, setMore] = useState(true);
  const load = useCallback((before?: string) => {
    const p = new URLSearchParams();
    if (unreadOnly) p.set("unread", "true");
    if (kind) p.set("kind", kind);
    if (before) p.set("before", before);
    api<{ items: Note[] }>(`/api/v1/notifications?${p}`).then((r) => { setItems((x) => (before ? [...x, ...r.items] : r.items)); setMore(r.items.length === 60); }).catch(() => {});
  }, [unreadOnly, kind]);
  useEffect(() => { load(); }, [load, ctx.unread]);
  useEffect(() => { const f = () => load(); window.addEventListener("cc-notes", f); return () => window.removeEventListener("cc-notes", f); }, [load]);
  const shown = items.filter((n) => matches(q, n.title, n.body, n.actor, labelOf(n.kind, n.event, locale)));
  const kinds = Object.keys(KIND_NAME);
  const toggle = (id: string) => setSel((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; });
  const bulk = async (read: boolean) => { await api("/api/v1/notifications/read", { body: { ids: [...sel], unread: !read } }); setSel(new Set()); ctx.reload(); };
  return (
    <>
      <div className="row between"><h1>{T.title}</h1>
        <div className="row">
          {ctx.unread > 0 && <button className="btn small ghost" onClick={() => ctx.markRead("all")}><Icon name="check" size={16} /> {T.markAll}</button>}
          <button className="btn small ghost" onClick={() => api("/api/v1/notifications", { method: "DELETE" }).then(() => load())}><Icon name="trash" size={16} /> {T.clear}</button>
        </div>
      </div>
      <div className="notes-layout">
        <div>
          <ListTools q={q} setQ={setQ} shown={shown.length} total={items.length}>
            <div className="seg sm">
              <button className={!unreadOnly ? "on" : ""} onClick={() => setUnreadOnly(false)}>{T.all}</button>
              <button className={unreadOnly ? "on" : ""} onClick={() => setUnreadOnly(true)}>{T.unread}{ctx.unread > 0 && ` (${ctx.unread})`}</button>
            </div>
            <Filter label={T.kind} value={kind} onChange={setKind} options={kinds.map((k) => [k, KIND_NAME[k][locale]] as [string, string])} />
          </ListTools>
          {sel.size > 0 && (
            <div className="selbar">
              <b>{sel.size}</b>
              <button className="btn small ghost" onClick={() => bulk(true)}><Icon name="check" size={16} /> {T.read}</button>
              <button className="btn small ghost" onClick={() => bulk(false)}><Icon name="mail" size={16} /> {T.markUnread}</button>
              <button className="icon-btn sm" onClick={() => setSel(new Set())} aria-label="✕"><Icon name="x" size={16} /></button>
            </div>
          )}
          <div className="card flush">
            {items.length === 0 ? <p className="muted" style={{ padding: 20 }}>{T.empty}</p> : shown.length === 0 ? <NoHits /> :
              shown.map((n) => <NoteRow key={n.id} n={n} selected={sel.has(n.id)} onSelect={() => toggle(n.id)} />)}
          </div>
          {more && items.length > 0 && <button className="btn small ghost" style={{ marginTop: 12 }} onClick={() => load(items[items.length - 1].created_at)}>{T.more}</button>}
        </div>
        <NotifySettings />
      </div>
    </>
  );
}

function NotifySettings() {
  const { locale } = useI18n();
  const T = NT[locale];
  const ctx = useNotify();
  const p = ctx.prefs;
  const [state, setState] = useState<"on" | "off" | "blocked" | "unsupported" | "app" | "…">("…");
  const [msg, setMsg] = useState<string | null>(null);
  const [devices, setDevices] = useState<{ id: string; label: string; host: string; last_ok_at: string | null }[]>([]);
  const [install, setInstall] = useState<any>(null);
  const loadDev = () => api<typeof devices>("/api/v1/push/devices").then(setDevices).catch(() => {});
  const check = useCallback(async () => {
    if (await waitApp()) return setState("app");
    if (!pushSupported()) return setState("unsupported");
    if (Notification.permission === "denied") return setState("blocked");
    setState((await currentSub()) && Notification.permission === "granted" ? "on" : "off");
  }, []);
  useEffect(() => { check(); loadDev(); }, [check]);
  useEffect(() => {
    const f = (e: Event) => { e.preventDefault(); setInstall(e); };
    window.addEventListener("beforeinstallprompt", f);
    return () => window.removeEventListener("beforeinstallprompt", f);
  }, []);
  if (!p) return null;
  const dnd = p.dnd_until && new Date(p.dnd_until) > new Date() ? p.dnd_until : null;
  const tomorrow8 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.toISOString(); };
  const save = (x: Partial<Prefs>) => ctx.setPrefs({ ...p, ...x }).then(() => setMsg(T.saved)).catch((e) => setMsg(e.message));
  return (
    <aside className="notes-side">
      <div className="card">
        <h3><Icon name="device" /> {T.thisDevice}</h3>
        <p className="muted">{state === "app" ? T.inApp : state === "on" ? T.pushOn : state === "blocked" ? T.pushBlocked : state === "unsupported" ? T.pushNo : T.pushOff}</p>
        <div className="row">
          {state === "off" && <button className="btn small" onClick={() => enablePush().then(() => { check(); loadDev(); }).catch((e) => { setMsg(e.message); check(); })}><Icon name="bell" size={16} /> {T.enable}</button>}
          {state === "on" && <button className="btn small ghost" onClick={() => disablePush().then(() => { check(); loadDev(); })}>{T.disable}</button>}
          <button className="btn small ghost" onClick={() => api<{ devices: number }>("/api/v1/notifications/test", { method: "POST" }).then((r) => setMsg(T.testOk(r.devices)))}>{T.test}</button>
        </div>
        {install && <div className="install-box"><p className="muted">{T.installHint}</p><button className="btn small" onClick={() => { install.prompt(); setInstall(null); }}><Icon name="download" size={16} /> {T.install}</button></div>}
        {msg && <p className="muted" role="status">{msg}</p>}
      </div>
      <div className="card">
        <h3><Icon name="settings" /> {T.settings}</h3>
        <label className="check-row"><input type="checkbox" checked={p.sound} onChange={(e) => save({ sound: e.target.checked })} /> {T.sound}</label>
        <div className="field-l">{T.dnd}</div>
        <div className="seg sm wrap">
          <button className={!dnd ? "on" : ""} onClick={() => save({ dnd_until: null })}>{T.dndOff}</button>
          <button onClick={() => save({ dnd_until: new Date(Date.now() + 3600e3).toISOString() })}>{T.dnd1}</button>
          <button onClick={() => save({ dnd_until: tomorrow8() })}>{T.dndEve}</button>
        </div>
        {dnd && <p className="muted"><Icon name="bell-off" size={15} /> {T.dndUntil} {new Date(dnd).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p>}
        <div className="field-l">{T.muted}</div>
        <div className="kind-grid">
          {p.kinds.map((k) => (
            <label key={k} className="check-row">
              <input type="checkbox" checked={p.muted.includes(k)} onChange={(e) => save({ muted: e.target.checked ? [...p.muted, k] : p.muted.filter((x) => x !== k) })} />
              <Icon name={KIND_ICON[k] ?? "bell"} size={16} /> {KIND_NAME[k]?.[locale] ?? k}
            </label>
          ))}
        </div>
      </div>
      <div className="card">
        <h3><Icon name="monitor" /> {T.devices}</h3>
        {devices.length === 0 ? <p className="muted">{T.noDevices}</p> : devices.map((d) => (
          <div key={d.id} className="dev-row">
            <div><b>{d.label || d.host}</b><small className="muted">{T.lastOk}: {d.last_ok_at ? new Date(d.last_ok_at).toLocaleString(locale) : T.never}</small></div>
            <button className="icon-btn sm" title={T.remove} onClick={() => api(`/api/v1/push/devices/${d.id}`, { method: "DELETE" }).then(() => { loadDev(); check(); })}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ── Seite: Ankündigungen ────────────────────────────────────────────────────

type Ann = {
  id: string; title: string; body: string; level: "info" | "important" | "urgent"; audience: "all" | "employees" | "customers" | "departments";
  departments: string[]; pinned: boolean; require_ack: boolean; starts_at: string; ends_at: string | null; created_by: string | null; author: string | null;
  created_at: string; read_at: string | null; acked_at: string | null; reads: number | null; acks: number | null; audience_size: number | null;
};
const DEPTS = ["ACC", "SAL", "SUP", "DEV", "MGT"];
const localInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function Announcements() {
  const { me } = useAuth();
  const { locale } = useI18n();
  const A = AT[locale];
  const ctx = useNotify();
  const [list, setList] = useState<Ann[] | null>(null);
  const [form, setForm] = useState<Partial<Ann> | null>(null);
  const [readers, setReaders] = useState<{ id: string; list: { id: string; display_name: string; read_at: string | null; acked_at: string | null }[] } | null>(null);
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { hash } = useLocation();
  const load = useCallback(() => api<Ann[]>("/api/v1/announcements").then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load, ctx.annUnread]);
  // Angesprungene/sichtbare Ankündigungen als gelesen markieren
  useEffect(() => {
    if (!list) return;
    const now = Date.now();
    const unread = list.filter((a) => !a.read_at && new Date(a.starts_at).getTime() <= now);
    if (unread.length) Promise.all(unread.map((a) => api(`/api/v1/announcements/${a.id}/read`, { method: "POST" }))).then(() => { ctx.reloadAnn(); ctx.reload(); load(); });
    if (hash) document.getElementById(`a-${hash.slice(1)}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.length, hash]);
  const ack = (id: string) => api(`/api/v1/announcements/${id}/read`, { body: { ack: true } }).then(() => { load(); ctx.reloadAnn(); });
  const submit = async () => {
    if (!form) return;
    setErr(null);
    const body = { ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null };
    try {
      if (form.id) await api(`/api/v1/announcements/${form.id}`, { method: "PUT", body });
      else await api("/api/v1/announcements", { body });
      setForm(null); load(); ctx.reloadAnn();
    } catch (e) { setErr((e as Error).message); }
  };
  const now = Date.now();
  const shown = (list ?? []).filter((a) => (!lvl || a.level === lvl) && matches(q, a.title, a.body, a.author));
  return (
    <>
      <div className="row between"><h1>{A.title}</h1>
        {me?.may_announce && !form && <button className="btn" onClick={() => setForm({ level: "info", audience: "all", departments: [], pinned: false, require_ack: false, title: "", body: "" })}><Icon name="plus" size={16} /> {A.new}</button>}
      </div>
      {form && (
        <form className="card ann-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label>{A.headline}<input required minLength={3} maxLength={200} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>{A.body}<textarea required rows={6} maxLength={20000} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          <div className="grid3">
            <label>{A.lvlL}
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as Ann["level"] })}>
                {(["info", "important", "urgent"] as const).map((l) => <option key={l} value={l}>{A.level[l]}</option>)}
              </select></label>
            <label>{A.audL}
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Ann["audience"] })}>
                {(["all", "employees", "customers", "departments"] as const).map((l) => <option key={l} value={l}>{A.audience[l]}</option>)}
              </select></label>
            <label>{A.starts}<input type="datetime-local" value={localInput(form.starts_at ?? null)} onChange={(e) => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></label>
            <label>{A.ends}<input type="datetime-local" value={localInput(form.ends_at ?? null)} onChange={(e) => setForm({ ...form, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          </div>
          {form.audience === "departments" && (
            <div className="chips">
              {DEPTS.map((d) => (
                <button type="button" key={d} className={`chip ${form.departments?.includes(d) ? "on" : ""}`}
                  onClick={() => setForm({ ...form, departments: form.departments?.includes(d) ? form.departments.filter((x) => x !== d) : [...(form.departments ?? []), d] })}>{d}</button>
              ))}
            </div>
          )}
          <div className="row">
            <label className="check-row"><input type="checkbox" checked={!!form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> <Icon name="pin" size={16} /> {A.pinned}</label>
            <label className="check-row"><input type="checkbox" checked={!!form.require_ack} onChange={(e) => setForm({ ...form, require_ack: e.target.checked })} /> <Icon name="check" size={16} /> {A.requireAck}</label>
          </div>
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn"><Icon name="megaphone" size={16} /> {form.id ? A.save : A.publish}</button>
            <button type="button" className="btn ghost" onClick={() => { setForm(null); setErr(null); }}>{A.cancel}</button>
          </div>
        </form>
      )}
      <ListTools q={q} setQ={setQ} shown={shown.length} total={list?.length ?? 0}>
        <Filter label={A.lvlL} value={lvl} onChange={setLvl} options={(["info", "important", "urgent"] as const).map((l) => [l, A.level[l]] as [string, string])} />
      </ListTools>
      {list && list.length === 0 && <div className="card muted">{A.empty}</div>}
      {list && list.length > 0 && shown.length === 0 && <NoHits />}
      <div className="ann-list">
        {shown.map((a) => {
          const planned = new Date(a.starts_at).getTime() > now;
          const ended = a.ends_at && new Date(a.ends_at).getTime() <= now;
          const mine = a.reads !== null;
          return (
            <article key={a.id} id={`a-${a.id}`} className={`ann lv-${a.level} ${a.read_at ? "" : "unread"} ${planned || ended ? "dim" : ""}`}>
              <header>
                <span className={`lv-tag lv-${a.level}`}>{A.level[a.level]}</span>
                {a.pinned && <span className="tag"><Icon name="pin" size={14} /> {A.pinned}</span>}
                {planned && <span className="tag">{A.planned}</span>}
                {ended && <span className="tag">{A.ended}</span>}
                {me?.is_employee && <span className="tag muted">{A.audience[a.audience]}{a.audience === "departments" && `: ${a.departments.join(", ")}`}</span>}
                <time>{new Date(a.starts_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time>
              </header>
              <h2 dir="auto">{a.title}</h2>
              <div className="ann-body" dir="auto">{a.body}</div>
              <footer>
                {a.author && <small className="muted">{A.by} {a.author}</small>}
                {mine && a.audience_size !== null && (
                  <button className="linkish" onClick={() => api<NonNullable<typeof readers>["list"]>(`/api/v1/announcements/${a.id}/readers`).then((l) => setReaders({ id: a.id, list: l }))}>
                    <Icon name="eye" size={15} /> {A.stats(a.reads ?? 0, a.acks ?? 0, a.audience_size, a.require_ack)}
                  </button>
                )}
                <span style={{ flex: 1 }} />
                {a.require_ack && !a.acked_at && !planned && <button className="btn small" onClick={() => ack(a.id)}><Icon name="check" size={16} /> {A.ack}</button>}
                {a.require_ack && a.acked_at && <span className="tag ok"><Icon name="check" size={14} /> {A.acked}</span>}
                {mine && <>
                  <button className="icon-btn sm" title={A.edit} onClick={() => { setForm(a); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon name="edit" size={16} /></button>
                  <button className="icon-btn sm" title={A.del} onClick={() => confirm(A.confirmDel) && api(`/api/v1/announcements/${a.id}`, { method: "DELETE" }).then(load)}><Icon name="trash" size={16} /></button>
                </>}
              </footer>
              {readers?.id === a.id && (
                <div className="readers">
                  <div className="row between"><b>{A.who}</b><button className="icon-btn sm" onClick={() => setReaders(null)}><Icon name="x" size={16} /></button></div>
                  <ul>
                    {readers.list.map((r) => (
                      <li key={r.id}><span>{r.display_name}</span>
                        <small className={r.acked_at || (!a.require_ack && r.read_at) ? "ok-t" : "muted"}>
                          {r.acked_at ? `${A.acked} ${new Date(r.acked_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}`
                            : r.read_at ? `${A.read} ${new Date(r.read_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}` : A.notYet}
                        </small></li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
