// Nachrichten: Räume, Verlauf, Schreiben, Anrufe starten.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, useAuth } from "../../api";
import { fmtDate, useI18n } from "../../i18n";
import { TX, useComm } from "./Comm";

type Room = {
  id: string; kind: string; name: string | null; peer_id: string | null; peer_name: string | null;
  last_body: string | null; last_kind: string | null; last_at: string | null; unread: number; member_count: number;
};
type Msg = { id: string; room_id: string; sender_id: string | null; sender_name: string | null; kind: string; body: string; created_at: string };
type Contact = { id: string; display_name: string; role: string; organization_name: string | null; mailbox: string | null };

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const time = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Summe ungelesener Nachrichten für das Menü-Abzeichen. */
export function useUnread() {
  const { unreadBump } = useComm();
  const [n, setN] = useState(0);
  useEffect(() => {
    api<Room[]>("/api/v1/chat/rooms").then((r) => setN(r.reduce((a, x) => a + x.unread, 0))).catch(() => {});
  }, [unreadBump]);
  return n;
}

export default function Chat() {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = TX[locale];
  const comm = useComm();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [members, setMembers] = useState<{ id: string; display_name: string }[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [picker, setPicker] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const lastTyping = useRef(0);

  const loadRooms = useCallback(() => api<Room[]>("/api/v1/chat/rooms").then(setRooms).catch(() => {}), []);
  useEffect(() => { loadRooms(); }, [loadRooms]);

  const open = useCallback(async (id: string) => {
    setActive(id);
    const r = await api<{ messages: Msg[]; members: { id: string; display_name: string }[] }>(`/api/v1/chat/rooms/${id}/messages`);
    setMsgs(r.messages); setMembers(r.members);
    await api(`/api/v1/chat/rooms/${id}/read`, { method: "POST" }).catch(() => {});
    setRooms((rs) => rs.map((x) => (x.id === id ? { ...x, unread: 0 } : x)));
    comm.bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-Ereignisse
  useEffect(() => comm.subscribe(async (e) => {
    if (e.type === "message") {
      const m: Msg = e.message;
      setTyping((t) => { const n = { ...t }; delete n[m.room_id]; return n; });
      if (m.room_id === activeRef.current) {
        setMsgs((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
        // erst als gelesen markieren, dann Liste und Abzeichen neu laden
        await api(`/api/v1/chat/rooms/${m.room_id}/read`, { method: "POST" }).catch(() => {});
        comm.bump();
      }
      loadRooms();
    }
    if (e.type === "typing") {
      setTyping((t) => ({ ...t, [e.room]: e.name }));
      window.setTimeout(() => setTyping((t) => { if (t[e.room] !== e.name) return t; const n = { ...t }; delete n[e.room]; return n; }), 4000);
    }
  }), [comm, loadRooms]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const room = rooms.find((r) => r.id === active);
  const title = (r: Room) => r.peer_name ?? r.name ?? (r.kind === "support" ? T.support : "–");

  const send = async () => {
    const body = text.trim();
    if (!body || !active) return;
    setText("");
    const m = await api<Msg>(`/api/v1/chat/rooms/${active}/messages`, { method: "POST", body: { body } });
    setMsgs((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
    loadRooms();
  };
  const onType = (v: string) => {
    setText(v);
    if (active && Date.now() - lastTyping.current > 2500) { lastTyping.current = Date.now(); comm.send({ type: "typing", room: active }); }
  };

  const startDirect = async (c: Contact) => {
    setPicker(false);
    const r = await api<{ id: string }>("/api/v1/chat/rooms", { method: "POST", body: { user_id: c.id } });
    await loadRooms();
    open(r.id);
  };

  const filtered = rooms.filter((r) => title(r).toLowerCase().includes(q.toLowerCase()));
  const peerOnline = room?.peer_id ? comm.online.has(room.peer_id) : false;

  return (
    <div className={`chat ${active ? "has-room" : ""}`}>
      <aside className="chat-list">
        <div className="chat-head">
          <h1>{T.title}</h1>
          <button className="btn small" onClick={() => setPicker(true)}>＋ {T.newChat}</button>
        </div>
        <input className="chat-search" placeholder={T.search} value={q} onChange={(e) => setQ(e.target.value)} />
        {filtered.length === 0 && <p className="muted" style={{ padding: 16 }}>{T.noRooms}</p>}
        {filtered.map((r) => (
          <button key={r.id} className={`chat-item ${r.id === active ? "on" : ""}`} onClick={() => open(r.id)}>
            <span className={`av ${r.peer_id && comm.online.has(r.peer_id) ? "online" : ""}`}>{r.kind === "direct" ? initials(title(r)) : r.kind === "support" ? "✦" : "#"}</span>
            <span className="ci-main">
              <b>{title(r)}</b>
              <span className="ci-last">{typing[r.id] ? `${typing[r.id]} ${T.typing}` : r.last_body ?? ""}</span>
            </span>
            <span className="ci-meta">
              {r.last_at && <small>{fmtDate(r.last_at, locale)}</small>}
              {r.unread > 0 && <span className="badge-n">{r.unread}</span>}
            </span>
          </button>
        ))}
      </aside>

      <section className="chat-room">
        {!room ? <div className="chat-empty">{T.empty}</div> : (
          <>
            <header className="room-head">
              <button className="btn small ghost back" onClick={() => setActive(null)} aria-label="Zurück">←</button>
              <div className="rh-title">
                <b>{title(room)}</b>
                <small>{room.kind === "direct" ? (peerOnline ? `● ${T.online}` : T.offline) : `${room.member_count} ${T.members}: ${members.map((m) => m.display_name).join(", ")}`}</small>
              </div>
              {room.kind === "direct" && room.peer_id && (
                <div className="row">
                  <button className="btn small ghost" onClick={() => comm.startCall(room.id, room.peer_id!, title(room), "audio")}>📞 {T.audio}</button>
                  <button className="btn small" onClick={() => comm.startCall(room.id, room.peer_id!, title(room), "video")}>📹 {T.video}</button>
                </div>
              )}
            </header>
            <div className="room-msgs">
              {msgs.map((m, i) => {
                const mine = m.sender_id === me?.id;
                const showName = !mine && room.kind !== "direct" && msgs[i - 1]?.sender_id !== m.sender_id;
                if (m.kind !== "text") return <div key={m.id} className="msg-sys">{m.body} · {time(m.created_at)}</div>;
                return (
                  <div key={m.id} className={`msg ${mine ? "mine" : ""}`}>
                    {showName && <small className="msg-name">{m.sender_name}</small>}
                    <div className="bubble">{m.body}<time>{time(m.created_at)}</time></div>
                  </div>
                );
              })}
              {active && typing[active] && <div className="msg-typing">{typing[active]} {T.typing}</div>}
              <div ref={endRef} />
            </div>
            <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea rows={1} value={text} placeholder={T.write} onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="btn" disabled={!text.trim()}>{T.send}</button>
            </form>
          </>
        )}
      </section>

      {picker && <Picker T={T} onPick={startDirect} onClose={() => setPicker(false)} online={comm.online} />}
    </div>
  );
}

function Picker({ T, onPick, onClose, online }: { T: (typeof TX)["de"]; onPick: (c: Contact) => void; onClose: () => void; online: Set<string> }) {
  const [list, setList] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { api<Contact[]>("/api/v1/chat/contacts").then(setList).catch(() => {}); }, []);
  const shown = useMemo(() => list.filter((c) => `${c.display_name} ${c.organization_name ?? ""}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T.contacts}>
        <h2>{T.contacts}</h2>
        <input className="chat-search" autoFocus placeholder={T.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pick-list">
          {shown.map((c) => (
            <button key={c.id} className="chat-item" onClick={() => onPick(c)}>
              <span className={`av ${online.has(c.id) ? "online" : ""}`}>{initials(c.display_name)}</span>
              <span className="ci-main"><b>{c.display_name}</b><span className="ci-last">{c.organization_name ?? c.mailbox ?? c.role}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
