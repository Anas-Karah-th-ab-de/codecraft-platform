// Eigener Chat + Sprach-/Videoanrufe (WebRTC, Mesh: 1:1 und Gruppen bis ~6 Personen).
// Signale laufen über den WebSocket des Portals; der Server reicht sie nur zwischen Raummitgliedern weiter.
// Paar-Regel: Bei jedem Teilnehmerpaar erstellt die kleinere Benutzer-ID das Angebot (offer).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ringback, ringtone } from "./Notify";
import { api, getToken, useAuth } from "../../api";
import { RemoteScreen } from "./Remote";
import { isApp, native, useIsApp, waitApp, type AppInfo } from "../../native";
import { useI18n } from "../../i18n";

export const TX = {
  de: {
    title: "Nachrichten", newChat: "Neuer Chat", search: "Suchen …", empty: "Wählen Sie links einen Chat oder starten Sie einen neuen.",
    noRooms: "Noch keine Unterhaltungen.", write: "Nachricht schreiben …", send: "Senden", typing: "schreibt …",
    online: "online", offline: "offline", audio: "Anrufen", video: "Videoanruf", group: "Gruppe", groupName: "Name der Gruppe",
    create: "Erstellen", contacts: "Kontakte", members: "Mitglieder", support: "Support",
    incoming: "ruft an …", calling: "Ruft an …", connecting: "Verbinde …", accept: "Annehmen", decline: "Ablehnen",
    hangup: "Auflegen", mute: "Stumm", unmute: "Ton an", camOff: "Kamera aus", camOn: "Kamera an",
    callAudio: "Anruf", callVideo: "Videoanruf", missed: "Verpasster Anruf", declined: "Anruf abgelehnt", busy: "Besetzt",
    noMedia: "Kein Zugriff auf Mikrofon/Kamera. Bitte im Browser erlauben.", noMic: "Mikrofon ist für die App nicht erlaubt – die Gegenseite kann Sie nicht hören.", openSettings: "Einstellungen öffnen", lost: "Verbindung verloren – der Anruf wurde beendet.", noServer: "Keine Verbindung zum Server – Anruf nicht möglich.", reconnecting: "Verbinde neu …", conn: "Verbindung wird hergestellt …",
    mailbox: "Postfach", you: "Sie", groupCall: "Gruppenanruf", remind: "Erinnerung", startsIn: (m: number) => (m <= 0 ? "beginnt jetzt" : m < 60 ? `beginnt in ${m} Minuten` : m < 1440 ? `beginnt in ${Math.round(m / 60)} Std.` : "beginnt morgen"), joinNow: "Meeting beitreten", ok: "OK", participants: "Teilnehmende", screen: "Bildschirm teilen", screenStop: "Teilen beenden", ctrlShare: "Steuerung freigeben", ctrlStop: "Freigabe beenden", ctrlView: (n: string) => `${n} steuern`, ctrlOffered: (n: string) => `${n} gibt das Gerät zur Steuerung frei`, ctrlAppOnly: "Steuerung freigeben geht in der KM-Portal-App (Handy/PC).", ctrlFail: "Freigabe nicht möglich", ctrlClose: "Schließen",
  },
  en: {
    title: "Messages", newChat: "New chat", search: "Search …", empty: "Pick a chat on the left or start a new one.",
    noRooms: "No conversations yet.", write: "Write a message …", send: "Send", typing: "is typing …",
    online: "online", offline: "offline", audio: "Call", video: "Video call", group: "Group", groupName: "Group name",
    create: "Create", contacts: "Contacts", members: "Members", support: "Support",
    incoming: "is calling …", calling: "Calling …", connecting: "Connecting …", accept: "Accept", decline: "Decline",
    hangup: "Hang up", mute: "Mute", unmute: "Unmute", camOff: "Camera off", camOn: "Camera on",
    callAudio: "Call", callVideo: "Video call", missed: "Missed call", declined: "Call declined", busy: "Busy",
    noMedia: "No access to microphone/camera. Please allow it in your browser.", noMic: "The app may not use the microphone – the other side cannot hear you.", openSettings: "Open settings", lost: "Connection lost – the call has ended.", noServer: "No connection to the server – cannot call.", reconnecting: "Reconnecting …", conn: "Connecting …",
    mailbox: "Mailbox", you: "You", groupCall: "Group call", remind: "Reminder", startsIn: (m: number) => (m <= 0 ? "starts now" : m < 60 ? `starts in ${m} minutes` : m < 1440 ? `starts in ${Math.round(m / 60)} h` : "starts tomorrow"), joinNow: "Join meeting", ok: "OK", participants: "Participants", screen: "Share screen", screenStop: "Stop sharing", ctrlShare: "Allow control", ctrlStop: "Stop control", ctrlView: (n: string) => `Control ${n}`, ctrlOffered: (n: string) => `${n} allows control of their device`, ctrlAppOnly: "Allowing control works in the KM Portal app (phone/PC).", ctrlFail: "Could not allow control", ctrlClose: "Close",
  },
  ar: {
    title: "الرسائل", newChat: "محادثة جديدة", search: "بحث …", empty: "اختر محادثة أو ابدأ محادثة جديدة.",
    noRooms: "لا توجد محادثات بعد.", write: "اكتب رسالة …", send: "إرسال", typing: "يكتب …",
    online: "متصل", offline: "غير متصل", audio: "اتصال", video: "مكالمة فيديو", group: "مجموعة", groupName: "اسم المجموعة",
    create: "إنشاء", contacts: "جهات الاتصال", members: "الأعضاء", support: "الدعم",
    incoming: "يتصل …", calling: "جارٍ الاتصال …", connecting: "جارٍ الوصل …", accept: "قبول", decline: "رفض",
    hangup: "إنهاء", mute: "كتم", unmute: "إلغاء الكتم", camOff: "إيقاف الكاميرا", camOn: "تشغيل الكاميرا",
    callAudio: "مكالمة", callVideo: "مكالمة فيديو", missed: "مكالمة فائتة", declined: "تم رفض المكالمة", busy: "مشغول",
    noMedia: "لا يوجد وصول إلى الميكروفون/الكاميرا. يرجى السماح بذلك في المتصفح.", noMic: "التطبيق لا يملك إذن الميكروفون – الطرف الآخر لا يسمعك.", openSettings: "فتح الإعدادات", lost: "انقطع الاتصال – انتهت المكالمة.", noServer: "لا يوجد اتصال بالخادم – تعذّر الاتصال.", reconnecting: "جارٍ إعادة الاتصال …", conn: "جارٍ الاتصال …",
    mailbox: "البريد", you: "أنت", groupCall: "مكالمة جماعية", remind: "تذكير", startsIn: (m: number) => (m <= 0 ? "يبدأ الآن" : m < 60 ? `يبدأ خلال ${m} دقيقة` : m < 1440 ? `يبدأ خلال ${Math.round(m / 60)} ساعة` : "يبدأ غداً"), joinNow: "الانضمام إلى الاجتماع", ok: "حسناً", participants: "المشاركون", screen: "مشاركة الشاشة", screenStop: "إيقاف المشاركة", ctrlShare: "السماح بالتحكم", ctrlStop: "إيقاف التحكم", ctrlView: (n: string) => `التحكم بجهاز ${n}`, ctrlOffered: (n: string) => `${n} يسمح بالتحكم بجهازه`, ctrlAppOnly: "السماح بالتحكم متاح في تطبيق KM Portal (الهاتف/الحاسوب).", ctrlFail: "تعذّر السماح بالتحكم", ctrlClose: "إغلاق",
  },
};

type Ev = { type: string; [k: string]: any };
type Person = { id: string; name: string };
type Call = {
  state: "outgoing" | "incoming" | "live";
  room: string; title: string; media: "audio" | "video"; group: boolean;
  host: string;            // wer angerufen hat (für Annehmen/Ablehnen)
  invited: Person[];       // angeklingelt
  peers: Person[];         // verbunden bzw. im Aufbau
  startedAt?: number;
};

type Comm = {
  online: Set<string>;
  connected: boolean;
  unreadBump: number;
  bump: () => void;
  subscribe: (fn: (e: Ev) => void) => () => void;
  send: (e: Ev) => void;
  startCall: (room: string, people: Person[], title: string, media: "audio" | "video", group?: boolean) => void;
  call: Call | null;
};
const Ctx = createContext<Comm | null>(null);
export const useComm = () => useContext(Ctx)!;

const PING = '{"type":"ping"}';
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, no) => window.setTimeout(() => no(new Error("timeout")), ms))]);

const fmtDur = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function CommProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = TX[locale];
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [unreadBump, setBump] = useState(0);
  const subs = useRef(new Set<(e: Ev) => void>());
  const wsRef = useRef<WebSocket | null>(null);
  const [call, setCallState] = useState<Call | null>(null);
  const callRef = useRef<Call | null>(null);
  const setCall = (c: Call | null | ((c: Call | null) => Call | null)) => {
    const next = typeof c === "function" ? c(callRef.current) : c;
    callRef.current = next;
    setCallState(next);
  };
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pending = useRef(new Map<string, RTCIceCandidateInit[]>());
  const local = useRef<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, MediaStream>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const ice = useRef<RTCIceServer[]>([]);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recon, setRecon] = useState(false);
  // Gerätesteuerung im Anruf: eigenes freigegebenes Gerät, Angebote der anderen, gerade geöffnete Ansicht
  const [ctrlMine, setCtrlMine] = useState<string | null>(null);
  const inApp = useIsApp();
  const ctrlRef = useRef<string | null>(null);
  const [offers, setOffers] = useState<{ from: string; name: string; device: string }[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{ id: string; title: string; starts_at: string; meeting: string | null } | null>(null);
  const ringTimer = useRef<number | null>(null);
  const myId = me?.id ?? "";
  const nav = useNavigate();
  const { search, pathname } = useLocation();
  const pendingDecline = useRef<{ room: string; to: string } | null>(null);
  // Anruf-Signale, die bei kurz unterbrochener Verbindung anfallen: nach dem Neuaufbau nachsenden (höchstens 15 s alt)
  const outbox = useRef<{ at: number; text: string }[]>([]);
  const reconnect = useRef<() => void>(() => {});
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const handled = useRef(new Map<string, number>()); // Raum → wann der Anruf hier beendet/abgelehnt wurde
  const acceptTimer = useRef<number | null>(null);
  const busyRef = useRef(false);
  const restartAt = useRef(new Map<string, number>());
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const acceptRef = useRef<() => void>(() => {});
  const byeRef = useRef<() => void>(() => {});

  const send = useCallback((e: Ev) => {
    const text = JSON.stringify(e);
    if (wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(text); return; }
    if (e.type !== "call") return;
    const now = Date.now();
    outbox.current = [...outbox.current.filter((m) => now - m.at < 15000).slice(-80), { at: now, text }];
    reconnect.current();
  }, []);
  const signal = useCallback((room: string, to: string, data: any) => send({ type: "call", room, to, data }), [send]);
  // Klingeln, Annehmen, Ablehnen, Auflegen gehen per REST an den Server: kommt sicher an, auch wenn die
  // Live-Verbindung gerade neu aufbaut. Der Reihe nach (Auflegen darf das Klingeln nicht überholen).
  // Ergebnis false: weder REST noch Live-Verbindung standen zur Verfügung.
  const control = useCallback((room: string, to: string, data: any): Promise<boolean> => {
    const run = () => withTimeout(api(`/api/v1/chat/rooms/${room}/signal`, { body: { to, data } }), 6000)
      .then(() => true)
      .catch(() => { const open = wsRef.current?.readyState === WebSocket.OPEN; signal(room, to, data); return open; });
    const p = chain.current.then(run, run);
    chain.current = p;
    return p;
  }, [signal]);

  // Seite wird verlassen/neu geladen oder Abmeldung: Gegenseite benachrichtigen, Mikrofon/Kamera freigeben
  // (vor der Verbindung definiert, damit beim Abbau die Verbindung noch steht)
  useEffect(() => {
    const bye = () => byeRef.current();
    window.addEventListener("pagehide", bye);
    return () => { window.removeEventListener("pagehide", bye); bye(); };
  }, []);

  // ── Verbindung mit automatischem Neuaufbau ──
  useEffect(() => {
    if (!me) return;
    let stop = false, retry = 0, timer: number | undefined;
    // Lebenszeichen: Eine Verbindung kann tot sein, ohne dass es jemand merkt (WLAN ↔ Mobilfunk, Standby).
    // Dann kämen weder Anrufe an noch gingen eigene Signale hinaus → erkennen und neu aufbauen.
    let pingAt = 0, lastSeen = Date.now(), pongs = false;
    let stale: WebSocket | null = null; // abgelöste Verbindung; wird erst geschlossen, wenn die neue steht (sonst blinkt „online“)
    api<{ iceServers: RTCIceServer[]; online: string[] }>("/api/v1/chat/ice")
      .then((r) => { ice.current = r.iceServers; setOnline(new Set(r.online)); }).catch(() => {});
    const open = () => {
      const token = getToken();
      if (!token || stop) return;
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        if (wsRef.current !== ws) { ws.close(); return; }
        try { stale?.close(); } catch { /* egal */ }
        stale = null;
        retry = 0; pingAt = 0; lastSeen = Date.now(); setConnected(true);
        const d = pendingDecline.current;
        if (d) { ws.send(JSON.stringify({ type: "call", room: d.room, to: d.to, data: { kind: "decline" } })); pendingDecline.current = null; }
        const now = Date.now(), q = outbox.current;
        outbox.current = [];
        q.filter((m) => now - m.at < 15000).forEach((m) => ws.send(m.text));
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return; // bereits durch eine neue Verbindung ersetzt
        setConnected(false);
        if (!stop) timer = window.setTimeout(open, Math.min(15000, 1000 * 2 ** retry++));
      };
      ws.onmessage = (m) => {
        lastSeen = Date.now(); pingAt = 0;
        const e: Ev = JSON.parse(m.data);
        if (e.type === "pong") { pongs = true; return; }
        if (e.type === "presence") setOnline((s) => { const n = new Set(s); e.online ? n.add(e.user) : n.delete(e.user); return n; });
        if (e.type === "message" && e.message.sender_id !== me.id) setBump((b) => b + 1);
        if (e.type === "call") onSignal(e).catch(() => {});
        // auf einem anderen Gerät angenommen/abgelehnt oder vom Anrufer beendet → hier nicht weiterklingeln
        if (e.type === "call-handled" && callRef.current?.state === "incoming" && callRef.current.room === e.room) cleanup();
        if (e.type === "calendar" && e.event === "reminder") {
          setReminder({ id: e.id, title: e.title, starts_at: e.starts_at, meeting: e.meeting ?? null });
          if ("Notification" in window && Notification.permission === "granted") new Notification(e.title, { body: TX[locale].startsIn(Math.round((new Date(e.starts_at).getTime() - Date.now()) / 60000)) });
        }
        subs.current.forEach((fn) => fn(e));
      };
    };
    // sofort neu aufbauen und die alte Verbindung verwerfen
    const reopen = () => {
      if (stop) return;
      clearTimeout(timer); retry = 0; pingAt = 0;
      const old = wsRef.current;
      wsRef.current = null;
      if (old) {
        // nichts mehr von der alten Verbindung verarbeiten (sonst kämen Ereignisse kurz doppelt an)
        old.onmessage = null; old.onclose = null; old.onopen = null;
        try { stale?.close(); } catch { /* egal */ }
        stale = old;
      }
      setConnected(false);
      open();
    };
    // kurze Probe: antwortet der Server nicht binnen 4 s, ist die Verbindung tot
    const probe = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try { ws.send(PING); } catch { reopen(); return; }
      const mark = (pingAt = Date.now());
      window.setTimeout(() => { if (!stop && pongs && pingAt === mark && wsRef.current === ws) reopen(); }, 4000);
    };
    const wake = (force: boolean) => {
      if (stop) return;
      const st = wsRef.current?.readyState;
      if (force || (st !== WebSocket.OPEN && st !== WebSocket.CONNECTING)) reopen();
      else if (st === WebSocket.OPEN) probe();
    };
    reconnect.current = () => wake(false);
    open();
    const beat = window.setInterval(() => {
      const ws = wsRef.current;
      if (stop || !ws || ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now(), busy = !!callRef.current;
      if (pingAt) { if (pongs && now - pingAt > (busy ? 8000 : 15000)) reopen(); return; }
      // im Anruf engmaschig prüfen, sonst nur wenn länger nichts kam
      if (busy || now - lastSeen > 20000) { try { ws.send(PING); pingAt = now; } catch { reopen(); } }
    }, 5000);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      wake(false);
      // Diagnose (nur App): sichtbare Fläche gegen Bildschirmgröße – zeigt, ob Ränder falsch gesetzt sind
      if (isApp()) fetch(`/api/v1/app/diag?vp=${innerWidth}x${innerHeight}&scr=${screen.width}x${screen.height}&dpr=${devicePixelRatio}`).catch(() => {});
    };
    const onOnline = () => wake(true); // Netz hat gewechselt → alte Verbindung ist in aller Regel tot
    const onFocus = () => wake(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      stop = true; clearTimeout(timer); clearInterval(beat); reconnect.current = () => {};
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
      try { stale?.close(); } catch { /* egal */ }
      document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onOnline); window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const subscribe = useCallback((fn: (e: Ev) => void) => { subs.current.add(fn); return () => { subs.current.delete(fn); }; }, []);

  useEffect(() => {
    const p = new URLSearchParams(search);
    const room = p.get("ring"), from = p.get("from");
    if (!room || !from || !me) return;
    const fresh = Date.now() - Number(p.get("t") ?? 0) < 45000;
    const t0 = Number(p.get("t") ?? 0);
    if (p.get("decline")) {
      control(room, from, { kind: "decline" });
    } else if (fresh && !callRef.current && (handled.current.get(room) ?? 0) < t0) {
      const name = p.get("name") ?? "";
      ringIn({ state: "incoming", room, title: name, media: p.get("media") === "video" ? "video" : "audio", group: false, host: from, invited: [], peers: [{ id: from, name }] }, Date.now() - t0);
      // „Annehmen“ in der Anruf-Mitteilung getippt → gleich annehmen
      if (p.get("accept")) window.setTimeout(() => acceptRef.current(), 0);
    }
    nav(`${pathname}?room=${room}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, me?.id]);

  // Klingeln: Ton, Vibration, System-Hinweis wenn das Portal im Hintergrund ist, Titel blinkt
  const callState = call?.state;
  useEffect(() => {
    const c = callRef.current;
    if (callState === "incoming" && c) {
      // App im Hintergrund: dort klingelt die Android-Mitteilung mit dem Klingelton des Handys – nicht doppelt
      let stop: (() => void) | null = null;
      const ring = () => { if (!stop && !(isApp() && document.hidden)) stop = ringtone(isApp() ? 0.22 : 0.09); };
      ring();
      document.addEventListener("visibilitychange", ring);
      let sys: Notification | null = null;
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        sys = new Notification(`${c.title} – ${T.incoming}`, { body: c.media === "video" ? T.callVideo : T.callAudio, tag: `call-${c.room}`, requireInteraction: true, icon: "/brand/icon-192.png" });
        sys.onclick = () => { window.focus(); sys?.close(); };
      }
      const old = document.title;
      const blink = window.setInterval(() => { document.title = document.title === old ? `📞 ${c.title}` : old; }, 1000);
      return () => { document.removeEventListener("visibilitychange", ring); stop?.(); sys?.close(); clearInterval(blink); document.title = old; };
    }
    if (callState === "outgoing") return ringback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // Läuft ein Anruf, hält die App (Android) das Mikrofon auch bei ausgeschaltetem Bildschirm offen
  const inCall = !!call && call.state !== "incoming";
  const ringing = call?.state === "incoming";
  const videoCall = inCall && call?.media === "video";
  useEffect(() => {
    // ringing: das Portal zeigt den Anruf selbst → die App nimmt ihre Anruf-Mitteilung zurück
    // video: Bildschirm bleibt an, kein Näherungssensor
    if (isApp()) native("app_call", { active: inCall, ringing, video: videoCall }).catch(() => {});
  }, [inCall, ringing, videoCall, inApp]);

  // ── Medien und Verbindungen ──
  const media = async (kind: "audio" | "video") => {
    const want: MediaStreamConstraints = { audio: true, video: kind === "video" ? { width: 1280, height: 720 } : false };
    const get = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c);
    let s: MediaStream;
    let camOff = false;
    local.current?.getTracks().forEach((t) => t.stop()); // Rest eines abgebrochenen Versuchs freigeben
    try {
      s = await get(want);
    } catch (e) {
      const name = (e as Error)?.name ?? String(e);
      // App (Android): Recht fehlt oder ist abgelaufen („Nur dieses Mal“) → nachfragen und neu versuchen
      let granted = false;
      if (isApp() && (name === "NotAllowedError" || name === "SecurityError" || name === "NotReadableError")) {
        granted = await native<boolean>("app_media_permission", { video: kind === "video" }).catch(() => false);
      }
      diag("media-retry", `${name} perm=${granted}`);
      try {
        s = await get(want);
      } catch (e2) {
        if (kind !== "video") throw e2;
        s = await get({ audio: true }); // Kamera fehlt/belegt → wenigstens mit Ton telefonieren
        camOff = true;
      }
    }
    local.current = s; setLocalStream(s); setMuted(false); setCamOff(camOff);
    return s;
  };
  const mediaFailed = (x: unknown) => {
    diag("media", String((x as Error)?.name ?? x));
    setNotice(isApp() ? T.noMic : T.noMedia);
  };

  // ICE-Server (inkl. TURN-Zugang, läuft ab) vor dem Anruf frisch holen – nicht erst beim Verbindungsaufbau
  const refreshIce = async () => {
    try { ice.current = (await api<{ iceServers: RTCIceServer[] }>("/api/v1/chat/ice")).iceServers; } catch { /* alte behalten */ }
  };
  // Diagnose im Server-Log: Zustand und gewählter Verbindungsweg (direkt/relay), Medienfehler
  const diag = (what: string, extra = "") => {
    fetch(`/api/v1/app/diag?call=${encodeURIComponent(what)}${extra ? `&x=${encodeURIComponent(extra.slice(0, 200))}` : ""}`).catch(() => {});
  };
  const pathOf = async (p: RTCPeerConnection) => {
    try {
      const st = await p.getStats();
      let pair: any = null; const cands = new Map<string, any>();
      st.forEach((r: any) => {
        if (r.type === "candidate-pair" && (r.nominated || r.selected) && r.state === "succeeded") pair = r;
        if (r.type === "local-candidate" || r.type === "remote-candidate") cands.set(r.id, r);
      });
      if (!pair) return "kein Paar";
      return `${cands.get(pair.localCandidateId)?.candidateType}>${cands.get(pair.remoteCandidateId)?.candidateType}`;
    } catch { return "?"; }
  };

  // Verbindung zu einer Person neu aushandeln (Netzwechsel). Das Angebot macht immer die kleinere Benutzer-ID.
  const restart = async (room: string, peer: string) => {
    const p = pcs.current.get(peer);
    if (!p) return;
    if (myId > peer) { signal(room, peer, { kind: "restart" }); return; }
    const now = Date.now();
    if (now - (restartAt.current.get(peer) ?? 0) < 4000) return;
    restartAt.current.set(peer, now);
    diag("restart", p.connectionState);
    try {
      await refreshIce();
      try { p.setConfiguration({ iceServers: ice.current }); } catch { /* bisherige Server behalten */ }
      const offer = await p.createOffer({ iceRestart: true });
      await p.setLocalDescription(offer);
      signal(room, peer, { kind: "offer", sdp: offer });
    } catch { /* nächster Versuch folgt */ }
  };

  const connectTo = async (room: string, peer: string) => {
    // synchron eintragen: ein gleichzeitig eintreffendes Angebot darf keine zweite Verbindung anlegen
    if (pcs.current.has(peer)) return;
    const p = new RTCPeerConnection({ iceServers: ice.current });
    pcs.current.set(peer, p);
    const mine = () => pcs.current.get(peer) === p;
    let tries = 0, retryT: number | undefined, giveUp: number | undefined;
    const fail = (why: string) => {
      if (!mine()) return;
      diag("failed", `${why} ice=${p.iceConnectionState} servers=${ice.current.length}`);
      control(room, peer, { kind: "hangup" });
      dropPeer(peer, true);
    };
    // Aufbau gelingt nicht (Netz blockiert, Gegenseite weg) → nicht endlos „Verbinde …“ zeigen
    const setup = window.setTimeout(() => { if (mine() && p.connectionState !== "connected") fail("setup"); }, 35000);
    p.onicecandidate = (e) => { if (e.candidate) signal(room, peer, { kind: "ice", candidate: e.candidate.toJSON() }); };
    p.ontrack = (e) => setRemotes((r) => ({ ...r, [peer]: e.streams[0] ?? new MediaStream([e.track]) }));
    p.onconnectionstatechange = () => {
      if (!mine()) return;
      const st = p.connectionState;
      if (st === "connected") {
        clearTimeout(setup); clearTimeout(retryT); clearTimeout(giveUp); giveUp = undefined; tries = 0;
        setRecon(false);
        setCall((c) => (c ? { ...c, state: "live", startedAt: c.startedAt ?? Date.now() } : c));
        pathOf(p).then((w) => diag("connected", `${w} tracks=${p.getReceivers().filter((r) => r.track?.readyState === "live").length}`));
      } else if (st === "disconnected" || st === "failed") {
        // Netzwechsel (WLAN ↔ Mobilfunk) oder Funkloch: neu aushandeln statt den Anruf sofort zu beenden
        setRecon(true);
        const attempt = () => {
          if (!mine() || p.connectionState === "connected" || tries >= 4) return;
          tries++;
          restart(room, peer);
          retryT = window.setTimeout(attempt, 6000);
        };
        clearTimeout(retryT);
        retryT = window.setTimeout(attempt, st === "failed" ? 0 : 2500);
        giveUp ??= window.setTimeout(() => { if (p.connectionState !== "connected") fail("lost"); }, 30000);
      }
    };
    local.current?.getTracks().forEach((t) => p.addTrack(t, local.current!));
    if (myId < peer) {
      const offer = await p.createOffer();
      await p.setLocalDescription(offer);
      signal(room, peer, { kind: "offer", sdp: offer });
      // Angebot kam nicht an (Verbindung der Gegenseite baute gerade neu auf) → wiederholen
      const again = (n: number) => window.setTimeout(() => {
        if (!mine() || p.signalingState !== "have-local-offer" || !p.localDescription) return;
        signal(room, peer, { kind: "offer", sdp: p.localDescription });
        if (n < 2) again(n + 1);
      }, 5000);
      again(0);
    }
  };

  const dropPeer = (peer: string, lost = false) => {
    pcs.current.get(peer)?.close();
    pcs.current.delete(peer);
    pending.current.delete(peer);
    restartAt.current.delete(peer);
    setRemotes((r) => { const n = { ...r }; delete n[peer]; return n; });
    setRecon(false);
    const c = callRef.current;
    if (!c) return;
    const peers = c.peers.filter((x) => x.id !== peer);
    if (peers.length === 0 && c.state === "live") { if (lost) setNotice(T.lost); end(false); return; }
    setCall({ ...c, peers });
  };

  const cleanup = () => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    if (acceptTimer.current) clearTimeout(acceptTimer.current);
    if (callRef.current) handled.current.set(callRef.current.room, Date.now());
    pcs.current.forEach((p) => p.close()); pcs.current.clear(); pending.current.clear(); restartAt.current.clear();
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null;
    screenTrack.current?.stop(); screenTrack.current = null;
    setLocalStream(null); setRemotes({}); setSharing(false); setRecon(false); setCall(null);
    if (ctrlRef.current) stopControl(false);
    setOffers([]); setViewing(null);
  };
  const logCall = (room: string, text: string) =>
    api(`/api/v1/chat/rooms/${room}/messages`, { method: "POST", body: { body: text, kind: "call" } }).catch(() => {});

  const end = (notify: boolean) => {
    const c = callRef.current;
    if (!c) return;
    if (notify) {
      if (c.state === "incoming") control(c.room, c.host, { kind: "decline" });
      else new Set([...c.peers.map((p) => p.id), ...c.invited.map((p) => p.id)]).forEach((id) => control(c.room, id, { kind: "hangup" }));
    }
    const label = c.group ? T.groupCall : c.media === "video" ? T.callVideo : T.callAudio;
    // Protokoll schreibt, wer als Letzte/r auflegt bzw. wer vergeblich angerufen hat
    if (c.state === "live" && c.startedAt && (notify ? !c.group || c.host === myId : c.group && c.host === myId)) logCall(c.room, `📞 ${label} · ${fmtDur(Date.now() - c.startedAt)}`);
    else if (c.state === "outgoing") logCall(c.room, `📞 ${T.missed}`);
    cleanup();
  };

  // Seite wird verlassen / Abmeldung: über die noch offene Live-Verbindung Bescheid geben, sonst per REST
  byeRef.current = () => {
    const c = callRef.current;
    if (!c) { local.current?.getTracks().forEach((t) => t.stop()); return; }
    const tell = wsRef.current?.readyState === WebSocket.OPEN ? signal : control;
    if (c.state === "incoming") tell(c.room, c.host, { kind: "decline" });
    else new Set([...c.peers.map((p) => p.id), ...c.invited.map((p) => p.id)]).forEach((id) => tell(c.room, id, { kind: "hangup" }));
    cleanup();
  };

  /** Eingehenden Anruf zeigen; klingelt höchstens so lange, wie der Anrufer noch wartet */
  const ringIn = (c: Call, ageMs = 0) => {
    setCall(c);
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = window.setTimeout(() => {
      const now = callRef.current;
      if (now?.state === "incoming" && now.room === c.room) cleanup();
    }, Math.max(4000, 50000 - ageMs));
  };

  const startCall = async (room: string, people: Person[], title: string, m: "audio" | "video", group = false) => {
    if (callRef.current || busyRef.current) return;
    const others = people.filter((p) => p.id !== myId);
    if (others.length === 0) return;
    busyRef.current = true;
    try {
      try { await refreshIce(); await media(m); } catch (x) { mediaFailed(x); return; }
      if (callRef.current) {
        // währenddessen kam ein Anruf herein → dieser hat Vorrang, eigenes Mikrofon wieder freigeben
        local.current?.getTracks().forEach((t) => t.stop()); local.current = null; setLocalStream(null);
        return;
      }
      setCall({ state: "outgoing", room, title, media: m, group, host: myId, invited: others, peers: [] });
      const mineOut = () => { const c = callRef.current as Call | null; return c?.state === "outgoing" && c.room === room; };
      ringTimer.current = window.setTimeout(() => { if (mineOut()) end(true); }, 45000);
      const sent = await Promise.all(others.map((p) => control(room, p.id, { kind: "ring", media: m, group, title })));
      if (!sent.some(Boolean) && mineOut()) {
        // Server nicht erreichbar: nicht 45 s ins Leere klingeln
        outbox.current = [];
        setNotice(T.noServer);
        cleanup();
      }
    } finally { busyRef.current = false; }
  };

  // Annahme melden; bleibt die Antwort des Anrufers aus (seine Verbindung baute gerade neu auf), wiederholen
  const sendAccept = (room: string, host: string, n = 0) => {
    control(room, host, { kind: "accept" });
    if (acceptTimer.current) clearTimeout(acceptTimer.current);
    acceptTimer.current = window.setTimeout(() => {
      const c = callRef.current;
      if (!c || c.room !== room || c.state !== "live" || pcs.current.size > 0) return;
      if (n < 3) sendAccept(room, host, n + 1);
      else { diag("no-answer"); setNotice(T.lost); end(true); }
    }, 6000);
  };

  const accept = async () => {
    const c = callRef.current;
    if (!c || c.state !== "incoming" || busyRef.current) return;
    busyRef.current = true;
    try {
      try { await refreshIce(); await media(c.media); } catch (x) { mediaFailed(x); if (callRef.current?.room === c.room) end(true); return; }
      const now = callRef.current;
      if (!now || now.room !== c.room || now.state !== "incoming") {
        // Anrufer hat inzwischen aufgelegt (z. B. während der Rückfrage zum Mikrofon)
        if (!now) { local.current?.getTracks().forEach((t) => t.stop()); local.current = null; setLocalStream(null); }
        return;
      }
      if (ringTimer.current) clearTimeout(ringTimer.current);
      setCall({ ...now, state: "live" });
      sendAccept(now.room, now.host);
    } finally { busyRef.current = false; }
  };
  acceptRef.current = accept;

  async function onSignal(e: Ev) {
    const d = e.data ?? {};
    const c = callRef.current;
    const from: string = e.from;
    const person = { id: from, name: e.name as string };
    switch (d.kind) {
      case "ring":
        if (c) { if (c.room !== e.room) control(e.room, from, { kind: "busy" }); return; }
        // erneut zugestellt (Verbindung war kurz weg), hier aber schon angenommen/abgelehnt/beendet
        if (e.age != null && Date.now() - (handled.current.get(e.room) ?? 0) < 60000) return;
        ringIn({ state: "incoming", room: e.room, title: d.group ? (d.title ?? e.name) : e.name, media: d.media === "video" ? "video" : "audio",
          group: !!d.group, host: from, invited: [], peers: [person] }, (Number(e.age) || 0) * 1000);
        return;
      case "accept": {
        // Gastgeber: Neue/n mit allen bisherigen bekannt machen
        if (!c || c.room !== e.room || c.state === "incoming") return;
        if (ringTimer.current && c.state === "outgoing") clearTimeout(ringTimer.current);
        const existing = c.peers.filter((p) => p.id !== from);
        signal(c.room, from, { kind: "peers", list: existing });
        // wiederholte Annahme (unsere Antwort kam nicht an) → nur erneut antworten
        if (c.peers.some((p) => p.id === from) && pcs.current.has(from)) return;
        existing.forEach((p) => signal(c.room, p.id, { kind: "joined", user: person }));
        setCall({ ...c, state: c.state === "outgoing" ? "live" : c.state, peers: [...existing, person] });
        await connectTo(c.room, from);
        return;
      }
      case "peers":
        if (!c || c.room !== e.room) return;
        if (acceptTimer.current) { clearTimeout(acceptTimer.current); acceptTimer.current = null; }
        for (const p of d.list as Person[]) {
          if (p.id === myId) continue;
          setCall((x) => (x && !x.peers.some((q) => q.id === p.id) ? { ...x, peers: [...x.peers, p] } : x));
          await connectTo(c.room, p.id);
        }
        await connectTo(c.room, from);
        return;
      case "joined": {
        if (!c || c.room !== e.room || d.user.id === myId) return;
        const p = d.user as Person;
        setCall((x) => (x && !x.peers.some((q) => q.id === p.id) ? { ...x, peers: [...x.peers, p] } : x));
        await connectTo(c.room, p.id);
        return;
      }
      case "offer": {
        if (!c || c.room !== e.room || c.state === "incoming") return;
        if (acceptTimer.current) { clearTimeout(acceptTimer.current); acceptTimer.current = null; }
        if (!pcs.current.has(from)) await connectTo(c.room, from);
        const p = pcs.current.get(from);
        if (!p) return;
        try {
          await p.setRemoteDescription(d.sdp);
          for (const i of pending.current.get(from) ?? []) await p.addIceCandidate(i).catch(() => {});
          pending.current.delete(from);
          const answer = await p.createAnswer();
          await p.setLocalDescription(answer);
          signal(c.room, from, { kind: "answer", sdp: answer });
        } catch (x) { diag("offer-err", String((x as Error)?.name ?? x)); }
        return;
      }
      case "answer": {
        const p = pcs.current.get(from);
        // doppelte Antwort (Angebot wurde wiederholt) ignorieren
        if (!p || p.signalingState !== "have-local-offer") return;
        try {
          await p.setRemoteDescription(d.sdp);
          for (const i of pending.current.get(from) ?? []) await p.addIceCandidate(i).catch(() => {});
          pending.current.delete(from);
        } catch (x) { diag("answer-err", String((x as Error)?.name ?? x)); }
        return;
      }
      case "ice": {
        const p = pcs.current.get(from);
        if (p?.remoteDescription) await p.addIceCandidate(d.candidate).catch(() => {});
        else pending.current.set(from, [...(pending.current.get(from) ?? []), d.candidate]);
        return;
      }
      case "restart":
        // Gegenseite hat die Verbindung verloren und bittet um ein neues Angebot
        if (c && c.room === e.room && myId < from) await restart(c.room, from);
        return;
      case "control_offer":
        if (!c || c.room !== e.room || typeof d.device !== "string") return;
        setOffers((o) => [...o.filter((x) => x.from !== from), { from, name: e.name as string, device: d.device }]);
        setNotice(T.ctrlOffered(e.name as string));
        return;
      case "control_end":
        setOffers((o) => { const gone = o.find((x) => x.from === from); if (gone) setViewing((v) => (v === gone.device ? null : v)); return o.filter((x) => x.from !== from); });
        return;
      case "hangup":
        if (!c) return;
        setOffers((o) => o.filter((x) => x.from !== from));
        if (c.state === "incoming" && c.host === from) { cleanup(); return; }
        dropPeer(from);
        return;
      case "decline":
      case "busy":
        if (!c || c.state !== "outgoing") return;
        {
          const invited = c.invited.filter((p) => p.id !== from);
          if (!c.group || invited.length === 0) {
            setNotice(d.kind === "busy" ? T.busy : T.declined);
            logCall(c.room, `📞 ${d.kind === "busy" ? T.busy : T.declined}`);
            cleanup();
          } else setCall({ ...c, invited });
        }
        return;
    }
  }

  const shareControl = async () => {
    const c = callRef.current;
    if (!c || c.state !== "live" || c.peers.length === 0) return;
    if (!(await waitApp())) { setNotice(T.ctrlAppOnly); return; }
    try {
      await native("support_start", { minutes: 60, files: false });
      const info = await native<AppInfo>("app_info");
      if (!info.device_id) throw new Error("kein Gerät");
      await api(`/api/v1/devices/${info.device_id}/share`, { body: { users: c.peers.map((p) => p.id), minutes: 60 } });
      ctrlRef.current = info.device_id; setCtrlMine(info.device_id);
      c.peers.forEach((p) => signal(c.room, p.id, { kind: "control_offer", device: info.device_id }));
    } catch (x) { setNotice(`${T.ctrlFail}: ${(x as Error).message}`); }
  };
  const stopControl = (notify = true) => {
    const id = ctrlRef.current;
    if (!id) return;
    ctrlRef.current = null; setCtrlMine(null);
    api(`/api/v1/devices/${id}/share`, { method: "DELETE" }).catch(() => {});
    native("support_stop").catch(() => {});
    const c = callRef.current;
    if (notify && c) c.peers.forEach((p) => signal(c.room, p.id, { kind: "control_end" }));
  };

  const toggleMute = () => { local.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted); };
  const toggleCam = () => { local.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff); };
  const toggleScreen = async () => {
    const cam = local.current?.getVideoTracks()[0];
    const swap = (track: MediaStreamTrack) => pcs.current.forEach((p) => p.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(track));
    if (!sharing) {
      try {
        const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const t = scr.getVideoTracks()[0];
        screenTrack.current = t;
        swap(t); setSharing(true);
        setLocalStream(new MediaStream([t, ...(local.current?.getAudioTracks() ?? [])]));
        t.onended = () => { if (screenTrack.current === t) screenTrack.current = null; if (cam) swap(cam); setSharing(false); setLocalStream(local.current); };
      } catch { /* abgebrochen */ }
    } else {
      if (cam) swap(cam);
      screenTrack.current?.stop(); screenTrack.current = null;
      setSharing(false); setLocalStream(local.current);
    }
  };

  const value = useMemo<Comm>(() => ({ online, connected, unreadBump, bump: () => setBump((b) => b + 1), subscribe, send, startCall, call }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [online, connected, unreadBump, call]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice(null)}>
          {notice}
          {notice === T.noMic && <button className="btn small" style={{ marginInlineStart: 10 }} onClick={() => native("app_settings").catch(() => {})}>{T.openSettings}</button>}
        </div>
      )}
      {reminder && (
        <div className="reminder" role="alert">
          <small>⏰ {T.remind}</small>
          <b>{reminder.title}</b>
          <span>{T.startsIn(Math.round((new Date(reminder.starts_at).getTime() - Date.now()) / 60000))} · {new Date(reminder.starts_at).toLocaleTimeString(locale, { timeStyle: "short" })}</span>
          <div className="row">
            {reminder.meeting && <Link className="btn small primary" to={`/portal/meeting/${reminder.meeting}`} onClick={() => setReminder(null)}>🎥 {T.joinNow}</Link>}
            <button className="btn small ghost" onClick={() => setReminder(null)}>{T.ok}</button>
          </div>
        </div>
      )}
      {call && (
        <CallView call={call} T={T} local={localStream} remotes={remotes} muted={muted} camOff={camOff} sharing={sharing} recon={recon}
          onAccept={accept} onDecline={() => end(true)} onHangup={() => end(true)} onMute={toggleMute} onCam={toggleCam} onScreen={toggleScreen}
          inApp={inApp} ctrlMine={!!ctrlMine} offers={offers} onShareCtrl={shareControl} onStopCtrl={() => stopControl()} onView={setViewing} />
      )}
      {call && viewing && (
        <div className="ctrl-overlay" role="dialog">
          <div className="row between">
            <b>{T.ctrlView(offers.find((o) => o.device === viewing)?.name ?? "")}</b>
            <button className="btn small ghost" onClick={() => setViewing(null)}>✕ {T.ctrlClose}</button>
          </div>
          <RemoteScreen id={viewing} />
        </div>
      )}
    </Ctx.Provider>
  );
}

function Video({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

function Audio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <audio ref={ref} autoPlay />;
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function CallView(p: {
  call: Call; T: (typeof TX)["de"]; local: MediaStream | null; remotes: Record<string, MediaStream>; muted: boolean; camOff: boolean; sharing: boolean; recon: boolean;
  onAccept: () => void; onDecline: () => void; onHangup: () => void; onMute: () => void; onCam: () => void; onScreen: () => void;
  inApp: boolean; ctrlMine: boolean; offers: { from: string; name: string; device: string }[]; onShareCtrl: () => void; onStopCtrl: () => void; onView: (d: string) => void;
}) {
  const { call, T } = p;
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const video = call.media === "video";
  const live = call.state === "live";
  const status = call.state === "incoming" ? T.incoming : call.state === "outgoing" ? T.calling
    : p.recon ? T.reconnecting : call.startedAt ? fmtDur(Date.now() - call.startedAt) : T.connecting;
  const tiles = call.peers;
  const full = video && live;
  return (
    <div className={`callview ${full ? "is-video st-live" : ""} st-${call.state} ${tiles.length > 1 ? "multi" : ""}`} role="dialog"
      aria-label={call.group ? T.groupCall : video ? T.callVideo : T.callAudio}>
      {full ? (
        <div className={`cv-grid n${Math.min(tiles.length, 6)}`}>
          {tiles.map((t) => (
            <div key={t.id} className="cv-tile">
              {p.remotes[t.id] ? <Video stream={p.remotes[t.id]} className="cv-remote" /> : <div className="cv-avatar">{initials(t.name)}</div>}
              <span className="cv-name">{t.name}</span>
            </div>
          ))}
        </div>
      ) : (
        Object.entries(p.remotes).map(([id, s]) => <Audio key={id} stream={s} />)
      )}
      <div className="cv-info">
        {!full && <div className="cv-avatar">{call.group ? "👥" : initials(call.title)}</div>}
        <b>{call.title}</b>
        <span>{status}{call.group && live && ` · ${tiles.length + 1} ${T.participants}`}</span>
      </div>
      {video && p.local && <Video stream={p.local} muted className="cv-local" />}
      <div className="cv-controls">
        {call.state === "incoming" ? (
          <>
            <button className="cv-btn ok" onClick={p.onAccept}>{video ? "📹" : "📞"} {T.accept}</button>
            <button className="cv-btn end" onClick={p.onDecline}>✕ {T.decline}</button>
          </>
        ) : (
          <>
            <button className={`cv-btn ${p.muted ? "on" : ""}`} onClick={p.onMute} aria-pressed={p.muted}>🎙 {p.muted ? T.unmute : T.mute}</button>
            {video && <button className={`cv-btn ${p.camOff ? "on" : ""}`} onClick={p.onCam} aria-pressed={p.camOff}>📷 {p.camOff ? T.camOn : T.camOff}</button>}
            {video && live && "getDisplayMedia" in (navigator.mediaDevices ?? {}) && !p.inApp && (
              <button className={`cv-btn ${p.sharing ? "on" : ""}`} onClick={p.onScreen}>🖥 {p.sharing ? T.screenStop : T.screen}</button>
            )}
            {live && (p.ctrlMine
              ? <button className="cv-btn on" onClick={p.onStopCtrl}>🖥 {T.screenStop}</button>
              : <button className="cv-btn" onClick={p.onShareCtrl}>🖥 {p.inApp ? T.screen : T.ctrlShare}</button>)}
            {live && p.offers.map((o) => <button key={o.from} className="cv-btn ok" onClick={() => p.onView(o.device)}>🖥 {T.ctrlView(o.name)}</button>)}
            <button className="cv-btn end" onClick={p.onHangup}>✕ {T.hangup}</button>
          </>
        )}
      </div>
    </div>
  );
}
