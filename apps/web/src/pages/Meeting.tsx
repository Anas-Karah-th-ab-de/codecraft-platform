// Online-Meeting im Browser: Gäste per Link (ohne Konto, mit Vorraum), Teammitglieder über das Portal.
// Bild/Ton direkt zwischen den Browsern (WebRTC-Mesh); der Server reicht nur Signale weiter.
// Paar-Regel: Bei jedem Teilnehmerpaar macht die kleinere ID das Angebot (offer).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { LOCALES, LOCALE_NAMES, useI18n } from "../i18n";

const MT = {
  de: {
    join: "Beitreten", yourName: "Ihr Name", namePh: "Vor- und Nachname", mic: "Mikrofon", cam: "Kamera", on: "an", off: "aus",
    early: "Das Meeting beginnt erst. Sie können 30 Minuten vor Beginn beitreten.", ended: "Dieses Meeting ist beendet.",
    notFound: "Dieser Meeting-Link ist ungültig oder wurde entfernt.", lobby: "Sie sind im Vorraum. Sie werden gleich eingelassen.",
    lobbyHint: "Bitte dieses Fenster geöffnet lassen.", denied: "Der Zutritt wurde nicht gewährt.", full: "Das Meeting ist voll (12 Personen).",
    leave: "Verlassen", left: "Sie haben das Meeting verlassen.", rejoin: "Erneut beitreten", screen: "Bildschirm teilen", screenStop: "Teilen beenden",
    chat: "Chat", people: "Teilnehmende", waiting: "Im Vorraum", admit: "Einlassen", deny: "Ablehnen", copy: "Gastlink kopieren", copied: "Kopiert",
    send: "Senden", write: "Nachricht …", you: "Sie", guest: "Gast", noMedia: "Kein Zugriff auf Kamera/Mikrofon – Sie können trotzdem teilnehmen und zuhören.",
    knock: "möchte beitreten", conn: "Verbinde …", lost: "Verbindung unterbrochen – neu verbinden …", back: "Zurück zum Portal", alone: "Noch niemand da. Teilen Sie den Gastlink.",
    starts: "Beginn",
  },
  en: {
    join: "Join", yourName: "Your name", namePh: "First and last name", mic: "Microphone", cam: "Camera", on: "on", off: "off",
    early: "The meeting hasn't started yet. You can join 30 minutes before it starts.", ended: "This meeting has ended.",
    notFound: "This meeting link is invalid or has been removed.", lobby: "You're in the waiting room. You'll be let in shortly.",
    lobbyHint: "Please keep this window open.", denied: "Access was not granted.", full: "The meeting is full (12 people).",
    leave: "Leave", left: "You left the meeting.", rejoin: "Rejoin", screen: "Share screen", screenStop: "Stop sharing",
    chat: "Chat", people: "Participants", waiting: "Waiting room", admit: "Admit", deny: "Deny", copy: "Copy guest link", copied: "Copied",
    send: "Send", write: "Message …", you: "You", guest: "Guest", noMedia: "No access to camera/microphone – you can still join and listen.",
    knock: "wants to join", conn: "Connecting …", lost: "Connection lost – reconnecting …", back: "Back to portal", alone: "Nobody here yet. Share the guest link.",
    starts: "Starts",
  },
  ar: {
    join: "انضمام", yourName: "اسمك", namePh: "الاسم الكامل", mic: "الميكروفون", cam: "الكاميرا", on: "يعمل", off: "متوقف",
    early: "لم يبدأ الاجتماع بعد. يمكنك الانضمام قبل 30 دقيقة من البدء.", ended: "انتهى هذا الاجتماع.",
    notFound: "رابط الاجتماع غير صالح أو تمت إزالته.", lobby: "أنت في غرفة الانتظار. سيتم إدخالك قريباً.",
    lobbyHint: "يرجى إبقاء هذه النافذة مفتوحة.", denied: "لم يتم السماح بالدخول.", full: "الاجتماع ممتلئ (12 شخصاً).",
    leave: "مغادرة", left: "لقد غادرت الاجتماع.", rejoin: "الانضمام مجدداً", screen: "مشاركة الشاشة", screenStop: "إيقاف المشاركة",
    chat: "الدردشة", people: "المشاركون", waiting: "غرفة الانتظار", admit: "إدخال", deny: "رفض", copy: "نسخ رابط الضيف", copied: "تم النسخ",
    send: "إرسال", write: "رسالة …", you: "أنت", guest: "ضيف", noMedia: "لا يوجد وصول إلى الكاميرا/الميكروفون – يمكنك الانضمام والاستماع.",
    knock: "يريد الانضمام", conn: "جارٍ الاتصال …", lost: "انقطع الاتصال – إعادة الاتصال …", back: "العودة إلى البوابة", alone: "لا أحد هنا بعد. شارك رابط الضيف.",
    starts: "البداية",
  },
};

type Info = { id: string; title: string; starts_at: string; ends_at: string; state: "early" | "open" | "ended"; iceServers: RTCIceServer[]; link?: string | null; owner?: boolean; name?: string };
type Peer = { id: string; name: string; guest: boolean };
type Msg = { from: string; name: string; text: string; at: string };
type Phase = "loading" | "missing" | "pre" | "connecting" | "lobby" | "live" | "denied" | "full" | "left" | "closed";

/** Gast: /meet/:token  ·  Mitglied: /portal/meeting/:id */
export default function Meeting({ member }: { member?: boolean }) {
  const { token, id } = useParams();
  const { locale, setLocale } = useI18n();
  const T = MT[locale];
  const [info, setInfo] = useState<Info | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [name, setName] = useState(() => localStorage.getItem("meet_name") ?? "");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [noMedia, setNoMedia] = useState(false);
  const [me, setMe] = useState<Peer | null>(null);
  const [host, setHost] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [waiting, setWaiting] = useState<Peer[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState<Record<string, { mic?: boolean; cam?: boolean }>>({});
  const [chat, setChat] = useState<Msg[]>([]);
  const [panel, setPanel] = useState<"chat" | "people" | null>(null);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const local = useRef<MediaStream | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pending = useRef(new Map<string, RTCIceCandidateInit[]>());
  const meRef = useRef<Peer | null>(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  useEffect(() => {
    document.title = info ? `${info.title} · Meeting` : "Meeting · KM Code Craft";
  }, [info]);

  // Angaben laden
  useEffect(() => {
    const url = member ? `/api/v1/meetings/${id}` : `/api/v1/meet/info?link=${encodeURIComponent(token ?? "")}`;
    api<Info>(url)
      .then((i) => { setInfo(i); if (member && i.name) setName(i.name); setPhase("pre"); })
      .catch(() => setPhase("missing"));
  }, [member, id, token]);

  // Vorschau von Kamera/Mikrofon vor dem Beitritt
  const startMedia = useCallback(async () => {
    if (local.current) return local.current;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1280, height: 720 } });
      local.current = s;
    } catch {
      try { local.current = await navigator.mediaDevices.getUserMedia({ audio: true }); setCam(false); }
      catch { setNoMedia(true); local.current = new MediaStream(); }
    }
    setPreview(local.current);
    return local.current;
  }, []);
  useEffect(() => { if (phase === "pre" && info?.state === "open") startMedia(); }, [phase, info, startMedia]);
  useEffect(() => {
    local.current?.getAudioTracks().forEach((t) => (t.enabled = mic));
    local.current?.getVideoTracks().forEach((t) => (t.enabled = cam));
    send({ type: "media", mic, cam });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic, cam]);

  const send = (m: object) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m)); };
  const signal = (to: string, data: object) => send({ type: "signal", to, data });

  const dropPeer = (pid: string) => {
    pcs.current.get(pid)?.close();
    pcs.current.delete(pid);
    pending.current.delete(pid);
    setStreams((s) => { const n = { ...s }; delete n[pid]; return n; });
    setPeers((p) => p.filter((x) => x.id !== pid));
  };

  const connectTo = async (pid: string) => {
    if (pcs.current.has(pid) || !meRef.current) return;
    const pc = new RTCPeerConnection({ iceServers: info?.iceServers ?? [] });
    pcs.current.set(pid, pc);
    pc.onicecandidate = (e) => { if (e.candidate) signal(pid, { kind: "ice", candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => setStreams((s) => ({ ...s, [pid]: e.streams[0] }));
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") { pc.restartIce?.(); } };
    const s = local.current;
    if (s && s.getTracks().length) s.getTracks().forEach((t) => pc.addTrack(t, s));
    else { pc.addTransceiver("audio", { direction: "recvonly" }); pc.addTransceiver("video", { direction: "recvonly" }); }
    if (meRef.current.id < pid) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal(pid, { kind: "offer", sdp: offer });
    }
  };

  const onSignal = async (from: string, d: any) => {
    if (d.kind === "offer") {
      if (!pcs.current.has(from)) await connectTo(from);
      const pc = pcs.current.get(from)!;
      await pc.setRemoteDescription(d.sdp);
      for (const c of pending.current.get(from) ?? []) await pc.addIceCandidate(c).catch(() => {});
      pending.current.delete(from);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signal(from, { kind: "answer", sdp: answer });
    } else if (d.kind === "answer") {
      const pc = pcs.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(d.sdp);
      for (const c of pending.current.get(from) ?? []) await pc.addIceCandidate(c).catch(() => {});
      pending.current.delete(from);
    } else if (d.kind === "ice") {
      const pc = pcs.current.get(from);
      if (pc?.remoteDescription) await pc.addIceCandidate(d.candidate).catch(() => {});
      else pending.current.set(from, [...(pending.current.get(from) ?? []), d.candidate]);
    }
  };

  const join = async () => {
    if (!member) {
      if (name.trim().length < 2) return;
      localStorage.setItem("meet_name", name.trim());
    }
    await startMedia();
    setPhase("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const q = member
      ? `meeting=${id}&token=${encodeURIComponent(sessionStorage.getItem("cc_session") ?? "")}`
      : `link=${encodeURIComponent(token ?? "")}&name=${encodeURIComponent(name.trim())}`;
    const sock = new WebSocket(`${proto}://${location.host}/api/v1/meet/ws?${q}`);
    ws.current = sock;
    let opened = false;
    sock.onopen = () => { opened = true; };
    sock.onclose = () => {
      pcs.current.forEach((p) => p.close()); pcs.current.clear(); setStreams({}); setPeers([]);
      setPhase((p) => (p === "left" || p === "denied" || p === "full" ? p : opened ? "closed" : "missing"));
    };
    sock.onmessage = async (m) => {
      const e = JSON.parse(m.data);
      switch (e.type) {
        case "welcome":
          meRef.current = e.you; setMe(e.you); setHost(e.host); setWaiting(e.waiting ?? []);
          if (e.admitted) { setPhase("live"); setPeers(e.peers); for (const p of e.peers) await connectTo(p.id); }
          else setPhase("lobby");
          send({ type: "media", mic, cam });
          break;
        case "admitted":
          setPhase("live"); setPeers(e.peers);
          for (const p of e.peers) await connectTo(p.id);
          break;
        case "joined":
          setPeers((p) => (p.some((x) => x.id === e.peer.id) ? p : [...p, e.peer]));
          await connectTo(e.peer.id);
          send({ type: "media", mic, cam });
          break;
        case "left": dropPeer(e.id); break;
        case "knock": setWaiting((w) => [...w.filter((x) => x.id !== e.peer.id), e.peer]); setPanel((p) => p ?? "people"); break;
        case "knock-done": setWaiting((w) => w.filter((x) => x.id !== e.id)); break;
        case "signal": await onSignal(e.from, e.data); break;
        case "media": setMuted((m) => ({ ...m, [e.id]: { mic: e.mic, cam: e.cam } })); break;
        case "chat":
          setChat((c) => [...c.slice(-199), e]);
          if (panelRef.current !== "chat" && e.from !== meRef.current?.id) setUnread((u) => u + 1);
          break;
        case "denied": setPhase("denied"); sock.close(); break;
        case "full": setPhase("full"); break;
      }
    };
  };

  const leave = () => {
    setPhase("left");
    ws.current?.close();
    pcs.current.forEach((p) => p.close()); pcs.current.clear();
    setStreams({}); setPeers([]);
  };
  // Seite schließen = Meeting verlassen, Medien freigeben
  useEffect(() => () => { ws.current?.close(); local.current?.getTracks().forEach((t) => t.stop()); }, []);

  const toggleScreen = async () => {
    const camTrack = local.current?.getVideoTracks()[0];
    const swap = (t: MediaStreamTrack) => pcs.current.forEach((p) => p.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(t));
    if (!sharing) {
      try {
        const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const t = scr.getVideoTracks()[0];
        swap(t); setSharing(true); setPreview(new MediaStream([t]));
        t.onended = () => { if (camTrack) swap(camTrack); setSharing(false); setPreview(local.current); };
      } catch { /* abgebrochen */ }
    } else if (camTrack) { swap(camTrack); setSharing(false); setPreview(local.current); }
  };

  const fmt = (d: string) => new Date(d).toLocaleString(locale === "ar" ? "ar-SY-u-nu-latn" : locale, { dateStyle: "medium", timeStyle: "short" });

  // ── Ansichten ──
  const langPick = (
    <select className="meet-lang" value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)} aria-label="Sprache">
      {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
    </select>
  );
  if (phase === "loading") return <div className="meet meet-center"><p>{T.conn}</p></div>;
  if (phase === "missing" && !info) return <MeetNote T={T} text={T.notFound} lang={langPick} member={member} />;

  if (phase !== "live") {
    const msg = info?.state === "early" ? T.early : info?.state === "ended" ? T.ended
      : phase === "lobby" ? T.lobby : phase === "denied" ? T.denied : phase === "full" ? T.full
      : phase === "left" ? T.left : phase === "closed" ? T.lost : phase === "missing" ? T.notFound : null;
    const canJoin = info?.state === "open" && (phase === "pre" || phase === "left" || phase === "closed");
    return (
      <div className="meet meet-center">
        <div className="meet-pre">
          <div className="row between" style={{ marginBottom: 12 }}>
            <img src="/brand/logo.png" alt="KM Code Craft" height={34} />
            {langPick}
          </div>
          <h1>{info?.title}</h1>
          {info && <p className="meet-when">{T.starts}: {fmt(info.starts_at)}</p>}
          {canJoin && (
            <div className="meet-preview">
              {preview && cam && preview.getVideoTracks().length > 0 ? <Video stream={preview} muted mirror /> : <div className="meet-avatar">{initials(name || "?")}</div>}
              <div className="meet-toggles">
                <button type="button" className={mic ? "" : "off"} onClick={() => setMic(!mic)} aria-pressed={!mic}>🎙 {T.mic} {mic ? T.on : T.off}</button>
                <button type="button" className={cam ? "" : "off"} onClick={() => setCam(!cam)} aria-pressed={!cam}>📷 {T.cam} {cam ? T.on : T.off}</button>
              </div>
            </div>
          )}
          {noMedia && <p className="meet-warn">{T.noMedia}</p>}
          {msg && <p className={phase === "lobby" ? "meet-wait" : "meet-msg"}>{msg}{phase === "lobby" && <><br /><small>{T.lobbyHint}</small></>}</p>}
          {canJoin && (
            <form onSubmit={(e) => { e.preventDefault(); join(); }}>
              {!member && (
                <label>{T.yourName}
                  <input required minLength={2} maxLength={60} autoComplete="name" placeholder={T.namePh} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              )}
              <button className="btn primary" style={{ width: "100%", minHeight: 46 }}>{phase === "pre" ? T.join : T.rejoin}</button>
            </form>
          )}
          {phase === "connecting" && <p className="meet-msg">{T.conn}</p>}
          {member && <p style={{ marginTop: 16 }}><Link to="/portal/arbeit?tab=kalender">{T.back}</Link></p>}
        </div>
      </div>
    );
  }

  const tiles: { id: string; name: string; stream: MediaStream | null; self?: boolean; mic?: boolean; cam?: boolean }[] = [
    { id: me!.id, name: `${me!.name} (${T.you})`, stream: preview, self: true, mic, cam: cam || sharing },
    ...peers.map((p) => ({ id: p.id, name: p.guest ? `${p.name} · ${T.guest}` : p.name, stream: streams[p.id] ?? null, mic: muted[p.id]?.mic, cam: muted[p.id]?.cam })),
  ];
  return (
    <div className={`meet meet-live ${panel ? "with-panel" : ""}`}>
      <header className="meet-bar">
        <b>{info?.title}</b>
        <span className="meet-count">{tiles.length} {T.people}</span>
        {info?.owner && info.link && (
          <button className="meet-chip" onClick={() => { navigator.clipboard?.writeText(info.link!); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
            🔗 {copied ? T.copied : T.copy}
          </button>
        )}
      </header>
      <main className={`meet-grid n${Math.min(tiles.length, 9)}`}>
        {tiles.map((t) => (
          <div key={t.id} className="meet-tile">
            {t.stream && t.cam !== false && t.stream.getVideoTracks().length > 0
              ? <Video stream={t.stream} muted={t.self} mirror={t.self && !sharing} />
              : <><div className="meet-avatar">{initials(t.name)}</div>{t.stream && !t.self && <Audio stream={t.stream} />}</>}
            <span className="meet-name">{t.mic === false && "🔇 "}{t.name}</span>
          </div>
        ))}
        {peers.length === 0 && host && <p className="meet-alone">{T.alone}</p>}
      </main>
      {panel && (
        <aside className="meet-panel">
          <div className="seg" style={{ margin: 0 }}>
            <button className={panel === "people" ? "on" : ""} onClick={() => setPanel("people")}>{T.people}</button>
            <button className={panel === "chat" ? "on" : ""} onClick={() => { setPanel("chat"); setUnread(0); }}>{T.chat}</button>
          </div>
          {panel === "people" ? (
            <div className="meet-people">
              {host && waiting.length > 0 && <>
                <h3>{T.waiting}</h3>
                {waiting.map((w) => (
                  <div key={w.id} className="meet-knock">
                    <span><b>{w.name}</b> {T.knock}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <button className="btn small primary" onClick={() => send({ type: "admit", id: w.id })}>{T.admit}</button>
                      <button className="btn small ghost" onClick={() => send({ type: "deny", id: w.id })}>{T.deny}</button>
                    </span>
                  </div>
                ))}
              </>}
              <h3>{T.people}</h3>
              {tiles.map((t) => <div key={t.id} className="meet-person"><span className="meet-dot">{initials(t.name)}</span>{t.name}{t.mic === false && " 🔇"}</div>)}
            </div>
          ) : (
            <ChatBox msgs={chat} myId={me!.id} T={T} onSend={(text) => send({ type: "chat", text })} />
          )}
        </aside>
      )}
      <footer className="meet-controls">
        <button className={mic ? "" : "off"} onClick={() => setMic(!mic)} aria-pressed={!mic}>🎙<span>{T.mic}</span></button>
        <button className={cam ? "" : "off"} onClick={() => setCam(!cam)} aria-pressed={!cam}>📷<span>{T.cam}</span></button>
        {"getDisplayMedia" in (navigator.mediaDevices ?? {}) && (
          <button className={sharing ? "on" : ""} onClick={toggleScreen}>🖥<span>{sharing ? T.screenStop : T.screen}</span></button>
        )}
        <button className={panel === "people" ? "on" : ""} onClick={() => setPanel(panel === "people" ? null : "people")}>
          👥<span>{T.people}</span>{host && waiting.length > 0 && <i className="meet-badge">{waiting.length}</i>}
        </button>
        <button className={panel === "chat" ? "on" : ""} onClick={() => { setPanel(panel === "chat" ? null : "chat"); setUnread(0); }}>
          💬<span>{T.chat}</span>{unread > 0 && <i className="meet-badge">{unread}</i>}
        </button>
        <button className="end" onClick={leave}>✕<span>{T.leave}</span></button>
      </footer>
    </div>
  );
}

function MeetNote({ T, text, lang, member }: { T: (typeof MT)["de"]; text: string; lang: React.ReactNode; member?: boolean }) {
  return (
    <div className="meet meet-center">
      <div className="meet-pre">
        <div className="row between" style={{ marginBottom: 12 }}><img src="/brand/logo.png" alt="KM Code Craft" height={34} />{lang}</div>
        <p className="meet-msg">{text}</p>
        {member ? <Link to="/portal/arbeit?tab=kalender">{T.back}</Link> : <a href="/">code-craft.tech</a>}
      </div>
    </div>
  );
}

function ChatBox({ msgs, myId, T, onSend }: { msgs: Msg[]; myId: string; T: (typeof MT)["de"]; onSend: (t: string) => void }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs.length]);
  return (
    <div className="meet-chat">
      <div className="meet-msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`meet-m ${m.from === myId ? "mine" : ""}`}><b>{m.from === myId ? T.you : m.name}</b><span>{m.text}</span></div>
        ))}
        <div ref={end} />
      </div>
      <form className="row" style={{ gap: 6, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text); setText(""); } }}>
        <input value={text} maxLength={1000} placeholder={T.write} onChange={(e) => setText(e.target.value)} />
        <button className="btn small">{T.send}</button>
      </form>
    </div>
  );
}

const initials = (n: string) => n.replace(/\(.*\)|·.*/g, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

function Video({ stream, muted, mirror }: { stream: MediaStream; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? "mirror" : ""} />;
}

function Audio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <audio ref={ref} autoPlay />;
}
