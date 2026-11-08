// Eigener Chat + Sprach-/Videoanrufe (WebRTC, Mesh: 1:1 und Gruppen bis ~6 Personen).
// Signale laufen über den WebSocket des Portals; der Server reicht sie nur zwischen Raummitgliedern weiter.
// Paar-Regel: Bei jedem Teilnehmerpaar erstellt die kleinere Benutzer-ID das Angebot (offer).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ringback, ringtone } from "./Notify";
import { api, getToken, useAuth } from "../../api";
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
    noMedia: "Kein Zugriff auf Mikrofon/Kamera. Bitte im Browser erlauben.", conn: "Verbindung wird hergestellt …",
    mailbox: "Postfach", you: "Sie", groupCall: "Gruppenanruf", remind: "Erinnerung", startsIn: (m: number) => (m <= 0 ? "beginnt jetzt" : m < 60 ? `beginnt in ${m} Minuten` : m < 1440 ? `beginnt in ${Math.round(m / 60)} Std.` : "beginnt morgen"), joinNow: "Meeting beitreten", ok: "OK", participants: "Teilnehmende", screen: "Bildschirm teilen", screenStop: "Teilen beenden",
  },
  en: {
    title: "Messages", newChat: "New chat", search: "Search …", empty: "Pick a chat on the left or start a new one.",
    noRooms: "No conversations yet.", write: "Write a message …", send: "Send", typing: "is typing …",
    online: "online", offline: "offline", audio: "Call", video: "Video call", group: "Group", groupName: "Group name",
    create: "Create", contacts: "Contacts", members: "Members", support: "Support",
    incoming: "is calling …", calling: "Calling …", connecting: "Connecting …", accept: "Accept", decline: "Decline",
    hangup: "Hang up", mute: "Mute", unmute: "Unmute", camOff: "Camera off", camOn: "Camera on",
    callAudio: "Call", callVideo: "Video call", missed: "Missed call", declined: "Call declined", busy: "Busy",
    noMedia: "No access to microphone/camera. Please allow it in your browser.", conn: "Connecting …",
    mailbox: "Mailbox", you: "You", groupCall: "Group call", remind: "Reminder", startsIn: (m: number) => (m <= 0 ? "starts now" : m < 60 ? `starts in ${m} minutes` : m < 1440 ? `starts in ${Math.round(m / 60)} h` : "starts tomorrow"), joinNow: "Join meeting", ok: "OK", participants: "Participants", screen: "Share screen", screenStop: "Stop sharing",
  },
  ar: {
    title: "الرسائل", newChat: "محادثة جديدة", search: "بحث …", empty: "اختر محادثة أو ابدأ محادثة جديدة.",
    noRooms: "لا توجد محادثات بعد.", write: "اكتب رسالة …", send: "إرسال", typing: "يكتب …",
    online: "متصل", offline: "غير متصل", audio: "اتصال", video: "مكالمة فيديو", group: "مجموعة", groupName: "اسم المجموعة",
    create: "إنشاء", contacts: "جهات الاتصال", members: "الأعضاء", support: "الدعم",
    incoming: "يتصل …", calling: "جارٍ الاتصال …", connecting: "جارٍ الوصل …", accept: "قبول", decline: "رفض",
    hangup: "إنهاء", mute: "كتم", unmute: "إلغاء الكتم", camOff: "إيقاف الكاميرا", camOn: "تشغيل الكاميرا",
    callAudio: "مكالمة", callVideo: "مكالمة فيديو", missed: "مكالمة فائتة", declined: "تم رفض المكالمة", busy: "مشغول",
    noMedia: "لا يوجد وصول إلى الميكروفون/الكاميرا. يرجى السماح بذلك في المتصفح.", conn: "جارٍ الاتصال …",
    mailbox: "البريد", you: "أنت", groupCall: "مكالمة جماعية", remind: "تذكير", startsIn: (m: number) => (m <= 0 ? "يبدأ الآن" : m < 60 ? `يبدأ خلال ${m} دقيقة` : m < 1440 ? `يبدأ خلال ${Math.round(m / 60)} ساعة` : "يبدأ غداً"), joinNow: "الانضمام إلى الاجتماع", ok: "حسناً", participants: "المشاركون", screen: "مشاركة الشاشة", screenStop: "إيقاف المشاركة",
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
  const [reminder, setReminder] = useState<{ id: string; title: string; starts_at: string; meeting: string | null } | null>(null);
  const ringTimer = useRef<number | null>(null);
  const myId = me?.id ?? "";
  const nav = useNavigate();
  const { search, pathname } = useLocation();
  const pendingDecline = useRef<{ room: string; to: string } | null>(null);

  const send = useCallback((e: Ev) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(e));
  }, []);
  const signal = useCallback((room: string, to: string, data: any) => send({ type: "call", room, to, data }), [send]);

  // ── Verbindung mit automatischem Neuaufbau ──
  useEffect(() => {
    if (!me) return;
    let stop = false, retry = 0, timer: number | undefined;
    api<{ iceServers: RTCIceServer[]; online: string[] }>("/api/v1/chat/ice")
      .then((r) => { ice.current = r.iceServers; setOnline(new Set(r.online)); }).catch(() => {});
    const open = () => {
      const token = getToken();
      if (!token || stop) return;
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0; setConnected(true);
        const d = pendingDecline.current;
        if (d) { ws.send(JSON.stringify({ type: "call", room: d.room, to: d.to, data: { kind: "decline" } })); pendingDecline.current = null; }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stop) timer = window.setTimeout(open, Math.min(15000, 1000 * 2 ** retry++));
      };
      ws.onmessage = (m) => {
        const e: Ev = JSON.parse(m.data);
        if (e.type === "presence") setOnline((s) => { const n = new Set(s); e.online ? n.add(e.user) : n.delete(e.user); return n; });
        if (e.type === "message" && e.message.sender_id !== me.id) setBump((b) => b + 1);
        if (e.type === "call") onSignal(e);
        // auf einem anderen Gerät angenommen/abgelehnt oder vom Anrufer beendet → hier nicht weiterklingeln
        if (e.type === "call-handled" && callRef.current?.state === "incoming" && callRef.current.room === e.room) cleanup();
        if (e.type === "calendar" && e.event === "reminder") {
          setReminder({ id: e.id, title: e.title, starts_at: e.starts_at, meeting: e.meeting ?? null });
          if ("Notification" in window && Notification.permission === "granted") new Notification(e.title, { body: TX[locale].startsIn(Math.round((new Date(e.starts_at).getTime() - Date.now()) / 60000)) });
        }
        subs.current.forEach((fn) => fn(e));
      };
    };
    open();
    return () => { stop = true; clearTimeout(timer); wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const subscribe = useCallback((fn: (e: Ev) => void) => { subs.current.add(fn); return () => { subs.current.delete(fn); }; }, []);

  useEffect(() => {
    const p = new URLSearchParams(search);
    const room = p.get("ring"), from = p.get("from");
    if (!room || !from || !me) return;
    const fresh = Date.now() - Number(p.get("t") ?? 0) < 45000;
    if (p.get("decline")) {
      if (wsRef.current?.readyState === WebSocket.OPEN) signal(room, from, { kind: "decline" });
      else api(`/api/v1/chat/rooms/${room}/signal`, { body: { to: from, data: { kind: "decline" } } }).catch(() => { pendingDecline.current = { room, to: from }; });
    } else if (fresh && !callRef.current) {
      const name = p.get("name") ?? "";
      setCall({ state: "incoming", room, title: name, media: p.get("media") === "video" ? "video" : "audio", group: false, host: from, invited: [], peers: [{ id: from, name }] });
    }
    nav(`${pathname}?room=${room}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, me?.id]);

  // Klingeln: Ton, Vibration, System-Hinweis wenn das Portal im Hintergrund ist, Titel blinkt
  const callState = call?.state;
  useEffect(() => {
    const c = callRef.current;
    if (callState === "incoming" && c) {
      const stop = ringtone();
      let sys: Notification | null = null;
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        sys = new Notification(`${c.title} – ${T.incoming}`, { body: c.media === "video" ? T.callVideo : T.callAudio, tag: `call-${c.room}`, requireInteraction: true, icon: "/brand/icon-192.png" });
        sys.onclick = () => { window.focus(); sys?.close(); };
      }
      const old = document.title;
      const blink = window.setInterval(() => { document.title = document.title === old ? `📞 ${c.title}` : old; }, 1000);
      return () => { stop(); sys?.close(); clearInterval(blink); document.title = old; };
    }
    if (callState === "outgoing") return ringback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  // ── Medien und Verbindungen ──
  const media = async (kind: "audio" | "video") => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" ? { width: 1280, height: 720 } : false });
    local.current = s; setLocalStream(s); setMuted(false); setCamOff(false);
    return s;
  };

  const connectTo = async (room: string, peer: string) => {
    if (pcs.current.has(peer)) return;
    // ICE-Server (inkl. TURN-Zugang) frisch holen – Zugangsdaten laufen ab
    try { ice.current = (await api<{ iceServers: RTCIceServer[] }>("/api/v1/chat/ice")).iceServers; } catch { /* alte behalten */ }
    const p = new RTCPeerConnection({ iceServers: ice.current });
    pcs.current.set(peer, p);
    p.onicecandidate = (e) => { if (e.candidate) signal(room, peer, { kind: "ice", candidate: e.candidate.toJSON() }); };
    p.ontrack = (e) => setRemotes((r) => ({ ...r, [peer]: e.streams[0] }));
    p.onconnectionstatechange = () => {
      if (p.connectionState === "connected") setCall((c) => (c ? { ...c, state: "live", startedAt: c.startedAt ?? Date.now() } : c));
      if (p.connectionState === "failed") dropPeer(peer);
    };
    local.current?.getTracks().forEach((t) => p.addTrack(t, local.current!));
    if (myId < peer) {
      const offer = await p.createOffer();
      await p.setLocalDescription(offer);
      signal(room, peer, { kind: "offer", sdp: offer });
    }
  };

  const dropPeer = (peer: string) => {
    pcs.current.get(peer)?.close();
    pcs.current.delete(peer);
    pending.current.delete(peer);
    setRemotes((r) => { const n = { ...r }; delete n[peer]; return n; });
    const c = callRef.current;
    if (!c) return;
    const peers = c.peers.filter((x) => x.id !== peer);
    if (peers.length === 0 && c.state === "live") { end(false); return; }
    setCall({ ...c, peers });
  };

  const cleanup = () => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    pcs.current.forEach((p) => p.close()); pcs.current.clear(); pending.current.clear();
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null;
    setLocalStream(null); setRemotes({}); setSharing(false); setCall(null);
  };
  const logCall = (room: string, text: string) =>
    api(`/api/v1/chat/rooms/${room}/messages`, { method: "POST", body: { body: text, kind: "call" } }).catch(() => {});

  const end = (notify: boolean) => {
    const c = callRef.current;
    if (!c) return;
    if (notify) {
      if (c.state === "incoming") signal(c.room, c.host, { kind: "decline" });
      else new Set([...c.peers.map((p) => p.id), ...c.invited.map((p) => p.id)]).forEach((id) => signal(c.room, id, { kind: "hangup" }));
    }
    const label = c.group ? T.groupCall : c.media === "video" ? T.callVideo : T.callAudio;
    // Protokoll schreibt, wer als Letzte/r auflegt bzw. wer vergeblich angerufen hat
    if (c.state === "live" && c.startedAt && (notify ? !c.group || c.host === myId : c.group && c.host === myId)) logCall(c.room, `📞 ${label} · ${fmtDur(Date.now() - c.startedAt)}`);
    else if (c.state === "outgoing") logCall(c.room, `📞 ${T.missed}`);
    cleanup();
  };

  const startCall = async (room: string, people: Person[], title: string, m: "audio" | "video", group = false) => {
    if (callRef.current) return;
    const others = people.filter((p) => p.id !== myId);
    if (others.length === 0) return;
    try { await media(m); } catch { setNotice(T.noMedia); return; }
    setCall({ state: "outgoing", room, title, media: m, group, host: myId, invited: others, peers: [] });
    others.forEach((p) => signal(room, p.id, { kind: "ring", media: m, group, title }));
    ringTimer.current = window.setTimeout(() => { if (callRef.current?.state === "outgoing") end(true); }, 45000);
  };

  const accept = async () => {
    const c = callRef.current;
    if (!c) return;
    try { await media(c.media); } catch { setNotice(T.noMedia); end(true); return; }
    setCall({ ...c, state: "live" });
    signal(c.room, c.host, { kind: "accept" });
  };

  async function onSignal(e: Ev) {
    const d = e.data ?? {};
    const c = callRef.current;
    const from: string = e.from;
    const person = { id: from, name: e.name as string };
    switch (d.kind) {
      case "ring":
        if (c) { signal(e.room, from, { kind: "busy" }); return; }
        setCall({ state: "incoming", room: e.room, title: d.group ? (d.title ?? e.name) : e.name, media: d.media === "video" ? "video" : "audio",
          group: !!d.group, host: from, invited: [], peers: [person] });
        return;
      case "accept": {
        // Gastgeber: Neue/n mit allen bisherigen bekannt machen
        if (!c || c.room !== e.room) return;
        if (ringTimer.current && c.state === "outgoing") clearTimeout(ringTimer.current);
        const existing = c.peers.filter((p) => p.id !== from);
        signal(c.room, from, { kind: "peers", list: existing });
        existing.forEach((p) => signal(c.room, p.id, { kind: "joined", user: person }));
        setCall({ ...c, state: c.state === "outgoing" ? "live" : c.state, peers: [...existing, person] });
        await connectTo(c.room, from);
        return;
      }
      case "peers":
        if (!c || c.room !== e.room) return;
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
        if (!c || c.room !== e.room) return;
        if (!pcs.current.has(from)) await connectTo(c.room, from);
        const p = pcs.current.get(from)!;
        await p.setRemoteDescription(d.sdp);
        for (const i of pending.current.get(from) ?? []) await p.addIceCandidate(i).catch(() => {});
        pending.current.delete(from);
        const answer = await p.createAnswer();
        await p.setLocalDescription(answer);
        signal(c.room, from, { kind: "answer", sdp: answer });
        return;
      }
      case "answer": {
        const p = pcs.current.get(from);
        if (!p) return;
        await p.setRemoteDescription(d.sdp);
        for (const i of pending.current.get(from) ?? []) await p.addIceCandidate(i).catch(() => {});
        pending.current.delete(from);
        return;
      }
      case "ice": {
        const p = pcs.current.get(from);
        if (p?.remoteDescription) await p.addIceCandidate(d.candidate).catch(() => {});
        else pending.current.set(from, [...(pending.current.get(from) ?? []), d.candidate]);
        return;
      }
      case "hangup":
        if (!c) return;
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

  const toggleMute = () => { local.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted); };
  const toggleCam = () => { local.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff); };
  const toggleScreen = async () => {
    const cam = local.current?.getVideoTracks()[0];
    const swap = (track: MediaStreamTrack) => pcs.current.forEach((p) => p.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(track));
    if (!sharing) {
      try {
        const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const t = scr.getVideoTracks()[0];
        swap(t); setSharing(true);
        setLocalStream(new MediaStream([t, ...(local.current?.getAudioTracks() ?? [])]));
        t.onended = () => { if (cam) swap(cam); setSharing(false); setLocalStream(local.current); };
      } catch { /* abgebrochen */ }
    } else if (cam) { swap(cam); setSharing(false); setLocalStream(local.current); }
  };

  const value = useMemo<Comm>(() => ({ online, connected, unreadBump, bump: () => setBump((b) => b + 1), subscribe, send, startCall, call }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [online, connected, unreadBump, call]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {notice && <div className="toast" role="status" onClick={() => setNotice(null)}>{notice}</div>}
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
        <CallView call={call} T={T} local={localStream} remotes={remotes} muted={muted} camOff={camOff} sharing={sharing}
          onAccept={accept} onDecline={() => end(true)} onHangup={() => end(true)} onMute={toggleMute} onCam={toggleCam} onScreen={toggleScreen} />
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
  call: Call; T: (typeof TX)["de"]; local: MediaStream | null; remotes: Record<string, MediaStream>; muted: boolean; camOff: boolean; sharing: boolean;
  onAccept: () => void; onDecline: () => void; onHangup: () => void; onMute: () => void; onCam: () => void; onScreen: () => void;
}) {
  const { call, T } = p;
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const video = call.media === "video";
  const live = call.state === "live";
  const status = call.state === "incoming" ? T.incoming : call.state === "outgoing" ? T.calling
    : call.startedAt ? fmtDur(Date.now() - call.startedAt) : T.connecting;
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
            {video && live && "getDisplayMedia" in (navigator.mediaDevices ?? {}) && (
              <button className={`cv-btn ${p.sharing ? "on" : ""}`} onClick={p.onScreen}>🖥 {p.sharing ? T.screenStop : T.screen}</button>
            )}
            <button className="cv-btn end" onClick={p.onHangup}>✕ {T.hangup}</button>
          </>
        )}
      </div>
    </div>
  );
}
