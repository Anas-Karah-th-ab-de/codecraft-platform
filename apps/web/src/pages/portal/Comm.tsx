// Eigener Chat + Sprach-/Videoanrufe (WebRTC) – Verbindung, Zustand und Anruf-Oberfläche.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, useAuth } from "../../api";
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
    mailbox: "Postfach", you: "Sie",
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
    mailbox: "Mailbox", you: "You",
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
    mailbox: "البريد", you: "أنت",
  },
};

type Ev = { type: string; [k: string]: any };
type Call = {
  state: "outgoing" | "incoming" | "connecting" | "live";
  room: string; peer: string; peerName: string; media: "audio" | "video"; startedAt?: number;
};

type Comm = {
  online: Set<string>;
  connected: boolean;
  unreadBump: number;
  bump: () => void;
  subscribe: (fn: (e: Ev) => void) => () => void;
  send: (e: Ev) => void;
  startCall: (room: string, peer: string, peerName: string, media: "audio" | "video") => void;
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
  const [call, setCall] = useState<Call | null>(null);
  const callRef = useRef<Call | null>(null);
  callRef.current = call;
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const ice = useRef<RTCIceServer[]>([]);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ringTimer = useRef<number | null>(null);

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
      const token = sessionStorage.getItem("cc_session");
      if (!token || stop) return;
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/v1/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => { retry = 0; setConnected(true); };
      ws.onclose = () => {
        setConnected(false);
        if (!stop) timer = window.setTimeout(open, Math.min(15000, 1000 * 2 ** retry++));
      };
      ws.onmessage = (m) => {
        const e: Ev = JSON.parse(m.data);
        if (e.type === "presence") setOnline((s) => { const n = new Set(s); e.online ? n.add(e.user) : n.delete(e.user); return n; });
        if (e.type === "message" && e.message.sender_id !== me.id) setBump((b) => b + 1);
        if (e.type === "call") onSignal(e);
        subs.current.forEach((fn) => fn(e));
      };
    };
    open();
    return () => { stop = true; clearTimeout(timer); wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const subscribe = useCallback((fn: (e: Ev) => void) => { subs.current.add(fn); return () => { subs.current.delete(fn); }; }, []);

  // ── Anruf-Logik (1:1, WebRTC) ──
  const media = async (kind: "audio" | "video") => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" ? { width: 1280, height: 720 } : false });
    local.current = s; setLocalStream(s); setMuted(false); setCamOff(false);
    return s;
  };
  const makePc = (room: string, peer: string) => {
    const p = new RTCPeerConnection({ iceServers: ice.current });
    p.onicecandidate = (e) => { if (e.candidate) signal(room, peer, { kind: "ice", candidate: e.candidate.toJSON() }); };
    p.ontrack = (e) => setRemote(e.streams[0]);
    p.onconnectionstatechange = () => {
      if (p.connectionState === "connected") setCall((c) => (c ? { ...c, state: "live", startedAt: c.startedAt ?? Date.now() } : c));
      if (p.connectionState === "failed") end(true);
    };
    local.current?.getTracks().forEach((t) => p.addTrack(t, local.current!));
    pc.current = p;
    return p;
  };
  const cleanup = () => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    pc.current?.close(); pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop()); local.current = null;
    setLocalStream(null); setRemote(null); pendingIce.current = []; setCall(null);
  };
  const logCall = (c: Call, text: string) =>
    api(`/api/v1/chat/rooms/${c.room}/messages`, { method: "POST", body: { body: text, kind: "call" } }).catch(() => {});

  const end = (notify: boolean) => {
    const c = callRef.current;
    if (!c) return;
    if (notify) signal(c.room, c.peer, { kind: "hangup" });
    const label = c.media === "video" ? T.callVideo : T.callAudio;
    if (c.state === "live" && c.startedAt) logCall(c, `📞 ${label} · ${fmtDur(Date.now() - c.startedAt)}`);
    else if (c.state === "outgoing") logCall(c, `📞 ${T.missed}`);
    cleanup();
  };

  const startCall = async (room: string, peer: string, peerName: string, m: "audio" | "video") => {
    if (callRef.current) return;
    try { await media(m); } catch { setNotice(T.noMedia); return; }
    setCall({ state: "outgoing", room, peer, peerName, media: m });
    signal(room, peer, { kind: "ring", media: m });
    ringTimer.current = window.setTimeout(() => end(true), 45000); // nach 45 s: verpasst
  };

  const accept = async () => {
    const c = callRef.current;
    if (!c) return;
    try { await media(c.media); } catch { setNotice(T.noMedia); decline(); return; }
    setCall({ ...c, state: "connecting" });
    signal(c.room, c.peer, { kind: "accept" });
  };
  const decline = () => {
    const c = callRef.current;
    if (c) signal(c.room, c.peer, { kind: "decline" });
    cleanup();
  };

  async function onSignal(e: Ev) {
    const d = e.data ?? {};
    const c = callRef.current;
    switch (d.kind) {
      case "ring":
        if (c) { signal(e.room, e.from, { kind: "busy" }); return; }
        setCall({ state: "incoming", room: e.room, peer: e.from, peerName: e.name, media: d.media === "video" ? "video" : "audio" });
        return;
      case "accept": {
        if (!c || c.peer !== e.from) return;
        if (ringTimer.current) clearTimeout(ringTimer.current);
        setCall({ ...c, state: "connecting" });
        const p = makePc(c.room, c.peer);
        const offer = await p.createOffer();
        await p.setLocalDescription(offer);
        signal(c.room, c.peer, { kind: "offer", sdp: offer });
        return;
      }
      case "offer": {
        if (!c || c.peer !== e.from) return;
        const p = makePc(c.room, c.peer);
        await p.setRemoteDescription(d.sdp);
        for (const i of pendingIce.current) await p.addIceCandidate(i).catch(() => {});
        pendingIce.current = [];
        const answer = await p.createAnswer();
        await p.setLocalDescription(answer);
        signal(c.room, c.peer, { kind: "answer", sdp: answer });
        return;
      }
      case "answer":
        if (pc.current && c?.peer === e.from) {
          await pc.current.setRemoteDescription(d.sdp);
          for (const i of pendingIce.current) await pc.current.addIceCandidate(i).catch(() => {});
          pendingIce.current = [];
        }
        return;
      case "ice":
        if (!c || c.peer !== e.from) return;
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(d.candidate).catch(() => {});
        else pendingIce.current.push(d.candidate);
        return;
      case "hangup":
        // Protokolliert wird nur von der Seite, die auflegt (siehe end)
        if (c && c.peer === e.from) cleanup();
        return;
      case "decline":
      case "busy":
        if (c && c.peer === e.from) { setNotice(d.kind === "busy" ? T.busy : T.declined); logCall(c, `📞 ${d.kind === "busy" ? T.busy : T.declined}`); cleanup(); }
        return;
    }
  }

  const toggleMute = () => { local.current?.getAudioTracks().forEach((t) => (t.enabled = muted)); setMuted(!muted); };
  const toggleCam = () => { local.current?.getVideoTracks().forEach((t) => (t.enabled = camOff)); setCamOff(!camOff); };

  const value = useMemo<Comm>(() => ({ online, connected, unreadBump, bump: () => setBump((b) => b + 1), subscribe, send, startCall, call }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [online, connected, unreadBump, call]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {notice && <div className="toast" role="status" onClick={() => setNotice(null)}>{notice}</div>}
      {call && (
        <CallView call={call} T={T} local={localStream} remote={remote} muted={muted} camOff={camOff}
          onAccept={accept} onDecline={decline} onHangup={() => end(true)} onMute={toggleMute} onCam={toggleCam} />
      )}
    </Ctx.Provider>
  );
}

function Video({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

function CallView(p: {
  call: Call; T: (typeof TX)["de"]; local: MediaStream | null; remote: MediaStream | null; muted: boolean; camOff: boolean;
  onAccept: () => void; onDecline: () => void; onHangup: () => void; onMute: () => void; onCam: () => void;
}) {
  const { call, T } = p;
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const status = call.state === "incoming" ? `${T.incoming}` : call.state === "outgoing" ? T.calling
    : call.state === "connecting" ? T.connecting : call.startedAt ? fmtDur(Date.now() - call.startedAt) : "";
  const initials = call.peerName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const video = call.media === "video";
  return (
    <div className={`callview ${video ? "is-video" : ""} st-${call.state}`} role="dialog" aria-label={video ? T.callVideo : T.callAudio}>
      {video && <Video stream={p.remote} className="cv-remote" />}
      {!video && <audio ref={(el) => { if (el) el.srcObject = p.remote; }} autoPlay />}
      <div className="cv-info">
        {!(video && call.state === "live") && <div className="cv-avatar">{initials}</div>}
        <b>{call.peerName}</b>
        <span>{status}</span>
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
            <button className="cv-btn end" onClick={p.onHangup}>✕ {T.hangup}</button>
          </>
        )}
      </div>
    </div>
  );
}
