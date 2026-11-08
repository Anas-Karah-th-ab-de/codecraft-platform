// Nachrichten: Räume, Verlauf, Schreiben, Anrufe starten.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, getToken, useAuth } from "../../api";
import { fmtDate, useI18n } from "../../i18n";
import { TX, useComm } from "./Comm";

type Room = {
  id: string; kind: string; name: string | null; peer_id: string | null; peer_name: string | null;
  last_body: string | null; last_kind: string | null; last_at: string | null; unread: number; member_count: number;
};
type FileRef = { id: string; name: string; mime: string; size: number };
type Msg = { id: string; room_id: string; sender_id: string | null; sender_name: string | null; kind: string; body: string; created_at: string; file?: FileRef | null };
const MAX_FILE = 50 * 1048576;
const fsize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const isImage = (m: string) => ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(m);

/** Datei mit Anmeldung laden (Bilder als Vorschau, sonst Download) */
async function fetchFile(f: FileRef, inline: boolean) {
  const r = await fetch(`/api/v1/chat/files/${f.id}${inline ? "?inline=true" : ""}`, { headers: { authorization: `Bearer ${getToken()}` } });
  if (!r.ok) throw new Error(r.statusText);
  return URL.createObjectURL(await r.blob());
}

function FileBubble({ f }: { f: FileRef }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage(f.mime) || f.size > 15 * 1048576) return;
    let url: string | null = null;
    fetchFile(f, true).then((u) => { url = u; setSrc(u); }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [f]);
  const download = async () => {
    const u = await fetchFile(f, false);
    const a = Object.assign(document.createElement("a"), { href: u, download: f.name });
    a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000);
  };
  return (
    <div className="chat-file">
      {src && <img src={src} alt={f.name} onClick={download} />}
      <button type="button" className="att" onClick={download}>📎 {f.name} <small>{fsize(f.size)}</small> ⬇</button>
    </div>
  );
}
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
  const [uploading, setUploading] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadRooms = useCallback(() => api<Room[]>("/api/v1/chat/rooms").then(setRooms).catch(() => {}), []);
  useEffect(() => { loadRooms(); }, [loadRooms]);
  // Direkt öffnen: /portal/nachrichten?room=<id> (aus Mitteilung, Push, VS Code)
  const [params] = useSearchParams();
  const wanted = params.get("room");

  const open = useCallback(async (id: string) => {
    setActive(id);
    const r = await api<{ messages: Msg[]; members: { id: string; display_name: string }[] }>(`/api/v1/chat/rooms/${id}/messages`);
    setMsgs(r.messages); setMembers(r.members);
    await api(`/api/v1/chat/rooms/${id}/read`, { method: "POST" }).catch(() => {});
    setRooms((rs) => rs.map((x) => (x.id === id ? { ...x, unread: 0 } : x)));
    comm.bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (wanted && wanted !== activeRef.current) open(wanted).catch(() => {}); }, [wanted, open]);

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
  const sendFiles = async (files: File[]) => {
    if (!active || !files.length) return;
    setFileErr(null);
    for (const f of files) {
      if (f.size > MAX_FILE) { setFileErr(`${f.name}: max. 50 MB`); continue; }
      setUploading(f.name);
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await fetch(`/api/v1/chat/rooms/${active}/files`, { method: "POST", headers: { authorization: `Bearer ${getToken()}` }, body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.message ?? r.statusText);
        setMsgs((ms) => (ms.some((x) => x.id === j.id) ? ms : [...ms, j]));
      } catch (e) { setFileErr((e as Error).message); }
    }
    setUploading(null);
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
              <span className="ci-last">{typing[r.id] ? `${typing[r.id]} ${T.typing}` : (r.last_kind === "file" ? `📎 ${r.last_body ?? ""}` : r.last_body ?? "")}</span>
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
                  <button className="btn small ghost" onClick={() => comm.startCall(room.id, [{ id: room.peer_id!, name: title(room) }], title(room), "audio")}>📞 {T.audio}</button>
                  <button className="btn small" onClick={() => comm.startCall(room.id, [{ id: room.peer_id!, name: title(room) }], title(room), "video")}>📹 {T.video}</button>
                </div>
              )}
              {room.kind !== "direct" && (() => {
                // Gruppenanruf: alle Mitglieder, die gerade online sind
                const people = members.filter((m) => m.id !== me?.id && comm.online.has(m.id)).map((m) => ({ id: m.id, name: m.display_name }));
                return (
                  <div className="row">
                    <button className="btn small ghost" disabled={!people.length} title={T.groupCall} onClick={() => comm.startCall(room.id, people, title(room), "audio", true)}>📞</button>
                    <button className="btn small" disabled={!people.length} onClick={() => comm.startCall(room.id, people, title(room), "video", true)}>📹 {T.groupCall} ({people.length + 1})</button>
                  </div>
                );
              })()}
            </header>
            <div className="room-msgs">
              {msgs.map((m, i) => {
                const mine = m.sender_id === me?.id;
                const showName = !mine && room.kind !== "direct" && msgs[i - 1]?.sender_id !== m.sender_id;
                if (m.kind !== "text" && m.kind !== "file") return <div key={m.id} className="msg-sys">{m.body} · {time(m.created_at)}</div>;
                return (
                  <div key={m.id} className={`msg ${mine ? "mine" : ""}`}>
                    {showName && <small className="msg-name">{m.sender_name}</small>}
                    <div className="bubble">
                      {m.file ? <><FileBubble f={m.file} />{m.body !== m.file.name && <div>{m.body}</div>}</> : m.body}
                      <time>{time(m.created_at)}</time>
                    </div>
                  </div>
                );
              })}
              {active && typing[active] && <div className="msg-typing">{typing[active]} {T.typing}</div>}
              <div ref={endRef} />
            </div>
            {(uploading || fileErr) && <div className={fileErr ? "alert" : "muted"} style={{ padding: "4px 12px" }}>{fileErr ?? `⬆ ${uploading} …`}</div>}
            <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); sendFiles(Array.from(e.dataTransfer.files)); }}>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => { sendFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <button type="button" className="btn small ghost" title="Datei senden" aria-label="Datei senden" disabled={!!uploading} onClick={() => fileInput.current?.click()}>📎</button>
              <textarea rows={1} value={text} placeholder={T.write} onChange={(e) => onType(e.target.value)}
                onPaste={(e) => { const f = Array.from(e.clipboardData.files); if (f.length) { e.preventDefault(); sendFiles(f); } }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="btn" disabled={!text.trim()}>{T.send}</button>
            </form>
          </>
        )}
      </section>

      {picker && <Picker T={T} onPick={startDirect} onClose={() => setPicker(false)} online={comm.online} canGroup={!!me?.is_employee}
        onGroup={async (name, ids) => {
          setPicker(false);
          const r = await api<{ id: string }>("/api/v1/chat/rooms", { method: "POST", body: { name, members: ids } });
          await loadRooms();
          open(r.id);
        }} />}
    </div>
  );
}

function Picker({ T, onPick, onClose, online, canGroup, onGroup }: {
  T: (typeof TX)["de"]; onPick: (c: Contact) => void; onClose: () => void; online: Set<string>;
  canGroup: boolean; onGroup: (name: string, ids: string[]) => void;
}) {
  const [list, setList] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  useEffect(() => { api<Contact[]>("/api/v1/chat/contacts").then(setList).catch(() => {}); }, []);
  const shown = useMemo(() => list.filter((c) => `${c.display_name} ${c.organization_name ?? ""}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={T.contacts}>
        <div className="row between">
          <h2>{group ? T.group : T.contacts}</h2>
          {canGroup && <button className="btn small ghost" onClick={() => setGroup(!group)}>{group ? T.contacts : `＋ ${T.group}`}</button>}
        </div>
        {group && <input className="chat-search" placeholder={T.groupName} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
        <input className="chat-search" autoFocus placeholder={T.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pick-list">
          {shown.map((c) => (
            <button key={c.id} className={`chat-item ${group && sel.has(c.id) ? "on" : ""}`} onClick={() => (group ? toggle(c.id) : onPick(c))}>
              <span className={`av ${online.has(c.id) ? "online" : ""}`}>{group && sel.has(c.id) ? "✓" : initials(c.display_name)}</span>
              <span className="ci-main"><b>{c.display_name}</b><span className="ci-last">{c.organization_name ?? c.mailbox ?? c.role}</span></span>
            </button>
          ))}
        </div>
        {group && (
          <div className="row between" style={{ marginTop: 12 }}>
            <small className="muted">{sel.size} {T.members}</small>
            <button className="btn" disabled={!name.trim() || sel.size === 0} onClick={() => onGroup(name.trim(), [...sel])}>{T.create}</button>
          </div>
        )}
      </div>
    </div>
  );
}
