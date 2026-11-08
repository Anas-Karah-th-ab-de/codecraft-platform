// Fernwartung eines Geräts: Übersicht, Bildschirm (sehen + steuern), Befehle, Dateien.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, getToken } from "../../api";
import { useI18n } from "../../i18n";
import { RedeemCode } from "./Access";

const RT = {
  de: {
    back: "← Geräte", online: "verbunden", offline: "nicht verbunden", overview: "Übersicht", screen: "Bildschirm", commands: "Befehle", files: "Dateien",
    refresh: "Inventar abfragen", start: "Sitzung starten", stop: "Sitzung beenden", waiting: "Warte auf Zustimmung am Gerät …",
    denied: "Der Kunde hat die Freigabe abgelehnt.", ended: "Sitzung beendet", sendText: "Text senden", textPh: "Text ins Gerät tippen (auch Arabisch) …",
    program: "Programm", args: "Argumente (durch Leerzeichen)", run: "Ausführen", reboot: "Neustart", rebootQ: "Gerät wirklich neu starten?",
    path: "Pfad", open: "Öffnen", up: "↑ Ordner hoch", download: "Laden", upload: "Hochladen", notAllowed: "Am Gerät nicht erlaubt",
    allowed: "Am Gerät erlaubt", unattended: "unbeaufsichtigt", focus: "Klicken Sie ins Bild, um Maus und Tastatur zu steuern.", ctrlAltDel: "Strg+Alt+Entf",
    os: "System", cpu: "Prozessor", mem: "Arbeitsspeicher", disks: "Laufwerke", ips: "IP-Adressen", uptime: "Laufzeit", user: "Benutzer",
  },
  en: {
    back: "← Devices", online: "connected", offline: "not connected", overview: "Overview", screen: "Screen", commands: "Commands", files: "Files",
    refresh: "Query inventory", start: "Start session", stop: "End session", waiting: "Waiting for consent on the device …",
    denied: "The customer declined.", ended: "Session ended", sendText: "Send text", textPh: "Type text into the device (Arabic too) …",
    program: "Program", args: "Arguments (space separated)", run: "Run", reboot: "Reboot", rebootQ: "Really reboot the device?",
    path: "Path", open: "Open", up: "↑ Up", download: "Download", upload: "Upload", notAllowed: "Not allowed on the device",
    allowed: "Allowed on the device", unattended: "unattended", focus: "Click into the picture to control mouse and keyboard.", ctrlAltDel: "Ctrl+Alt+Del",
    os: "System", cpu: "CPU", mem: "Memory", disks: "Drives", ips: "IP addresses", uptime: "Uptime", user: "User",
  },
  ar: {
    back: "← الأجهزة", online: "متصل", offline: "غير متصل", overview: "نظرة عامة", screen: "الشاشة", commands: "الأوامر", files: "الملفات",
    refresh: "جلب المعلومات", start: "بدء الجلسة", stop: "إنهاء الجلسة", waiting: "بانتظار موافقة العميل على الجهاز …",
    denied: "رفض العميل المشاركة.", ended: "انتهت الجلسة", sendText: "إرسال نص", textPh: "اكتب نصاً في الجهاز (بالعربية أيضاً) …",
    program: "البرنامج", args: "المعاملات (مفصولة بمسافة)", run: "تنفيذ", reboot: "إعادة تشغيل", rebootQ: "هل تريد فعلاً إعادة تشغيل الجهاز؟",
    path: "المسار", open: "فتح", up: "↑ للأعلى", download: "تنزيل", upload: "رفع", notAllowed: "غير مسموح على الجهاز",
    allowed: "مسموح على الجهاز", unattended: "بدون حضور", focus: "انقر داخل الصورة للتحكم بالفأرة ولوحة المفاتيح.", ctrlAltDel: "Ctrl+Alt+Del",
    os: "النظام", cpu: "المعالج", mem: "الذاكرة", disks: "الأقراص", ips: "عناوين IP", uptime: "مدة التشغيل", user: "المستخدم",
  },
};
type TT = (typeof RT)["de"];
type Caps = { screen: boolean; unattended: boolean; exec: boolean; files: boolean };
type Inv = { hostname: string; os: string; arch: string; cpu: string; cores: number; mem_total_mb: number; disks: { mount: string; total_gb: number; free_gb: number }[]; ips: string[]; uptime_s: number; user: string | null; screens: [number, number][] };
type Status = { id: string; name: string; kind: string; online: boolean; caps: Caps | null; hello: { hostname: string; os: string; arch: string; version: string } | null; inventory: Inv | null; seen_at: string | null };

const dur = (s: number) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); return d ? `${d} T ${h} h` : `${h} h ${Math.floor((s % 3600) / 60)} min`; };

export default function Remote() {
  const { id } = useParams();
  const { locale } = useI18n();
  const T = RT[locale];
  const [st, setSt] = useState<Status | null>(null);
  const [tab, setTab] = useState<"overview" | "screen" | "commands" | "files">("overview");
  const [err, setErr] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const load = useCallback(() => api<Status>(`/api/v1/devices/${id}/remote`)
    .then((s) => { setSt(s); setErr(null); setNeedCode(false); })
    .catch((e) => {
      // Kundengerät ohne (oder mit abgelaufener) Freigabe → Code des Kunden einlösen
      if (e.code === "access_code_required") { setSt(null); setNeedCode(true); }
      setErr(e.message);
    }), [id]);
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);
  if (needCode) return (
    <div className="remote">
      <Link to="/portal/geraete" className="muted">{T.back}</Link>
      <div className="alert" style={{ margin: "12px 0" }}>{err}</div>
      <RedeemCode compact onRedeemed={load} />
    </div>
  );
  if (!st) return <div className="card">{err ?? "…"}</div>;
  const caps = st.caps;
  const tabs: [typeof tab, string, boolean][] = [
    ["overview", T.overview, true], ["screen", T.screen, !!caps?.screen], ["commands", T.commands, !!caps?.exec], ["files", T.files, !!caps?.files],
  ];
  return (
    <div className="remote">
      <Link to="/portal/geraete" className="muted">{T.back}</Link>
      <div className="row between" style={{ marginTop: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>{st.name}</h1>
          <small className="muted">{st.hello ? `${st.hello.hostname} · ${st.hello.os} · ${st.hello.arch} · Agent ${st.hello.version}` : st.kind}</small>
        </div>
        <span className={`badge ${st.online ? "online" : "offline"}`}>{st.online ? `● ${T.online}` : T.offline}</span>
      </div>
      {caps && (
        <p className="caps">{T.allowed}:{" "}
          {(["screen", "exec", "files"] as const).map((k) => <span key={k} className={`badge ${caps[k] ? "online" : "offline"}`}>{k === "screen" ? T.screen : k === "exec" ? T.commands : T.files}</span>)}
          {caps.unattended && <span className="badge warn">{T.unattended}</span>}
        </p>
      )}
      <div className="seg">
        {tabs.map(([k, label, ok]) => <button key={k} className={tab === k ? "on" : ""} disabled={!ok || !st.online} title={ok ? "" : T.notAllowed} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === "overview" && <Overview id={st.id} inv={st.inventory} T={T} online={st.online} onLoaded={load} />}
      {tab === "screen" && st.online && <Screen id={st.id} T={T} />}
      {tab === "commands" && st.online && <Commands id={st.id} T={T} />}
      {tab === "files" && st.online && <Files id={st.id} T={T} os={st.hello?.os ?? ""} />}
    </div>
  );
}

function Overview({ id, inv, T, online, onLoaded }: { id: string; inv: Inv | null; T: TT; online: boolean; onLoaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="card">
      <button className="btn small" disabled={!online || busy} onClick={async () => {
        setBusy(true); setErr(null);
        try { await api(`/api/v1/devices/${id}/inventory`, { method: "POST" }); onLoaded(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? "…" : T.refresh}</button>
      {err && <p className="error">{err}</p>}
      {inv && (
        <table style={{ marginTop: 12 }}><tbody>
          <tr><td>{T.os}</td><td>{inv.os} ({inv.arch}) · {inv.hostname}</td></tr>
          <tr><td>{T.cpu}</td><td>{inv.cpu} · {inv.cores} Kerne</td></tr>
          <tr><td>{T.mem}</td><td>{(inv.mem_total_mb / 1024).toFixed(1)} GB</td></tr>
          <tr><td>{T.disks}</td><td>{inv.disks.map((d) => `${d.mount}: ${d.free_gb} / ${d.total_gb} GB frei`).join(" · ")}</td></tr>
          <tr><td>{T.ips}</td><td dir="ltr">{inv.ips.join(", ")}</td></tr>
          <tr><td>{T.uptime}</td><td>{dur(inv.uptime_s)}</td></tr>
          <tr><td>{T.user}</td><td>{inv.user ?? "–"}</td></tr>
          <tr><td>{T.screen}</td><td>{inv.screens.map(([w, h]) => `${w}×${h}`).join(", ") || "–"}</td></tr>
        </tbody></table>
      )}
    </div>
  );
}

function Screen({ id, T }: { id: string; T: TT }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const [state, setState] = useState<"idle" | "waiting" | "live" | "denied" | "ended">("idle");
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [fps, setFps] = useState(0);
  const lastMove = useRef(0);
  const frames = useRef(0);

  const sendEv = (ev: object) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(ev)); };
  const stop = () => { ws.current?.close(); ws.current = null; setState((s) => (s === "live" || s === "waiting" ? "ended" : s)); };
  useEffect(() => () => ws.current?.close(), []);
  useEffect(() => { const i = setInterval(() => { setFps(frames.current); frames.current = 0; }, 1000); return () => clearInterval(i); }, []);

  const start = () => {
    setReason("");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const w = Math.min(1920, Math.round((canvas.current?.parentElement?.clientWidth ?? 1280) * devicePixelRatio));
    const s = new WebSocket(`${proto}://${location.host}/api/v1/devices/${id}/screen?token=${encodeURIComponent(getToken() ?? "")}&fps=10&width=${w}`);
    s.binaryType = "arraybuffer";
    ws.current = s;
    setState("waiting");
    s.onmessage = async (m) => {
      if (typeof m.data === "string") {
        const e = JSON.parse(m.data);
        if (e.t === "screen_consent") setState(e.granted ? "live" : "denied");
        if (e.t === "screen_ended") { setReason(e.reason ?? ""); setState("ended"); s.close(); }
        return;
      }
      const b = new Uint8Array(m.data);
      if (b[0] !== 1 || b.length < 22) return;
      const dv = new DataView(m.data);
      const fw = dv.getUint16(17), fh = dv.getUint16(19);
      const bmp = await createImageBitmap(new Blob([b.subarray(21)], { type: "image/jpeg" }));
      const c = canvas.current;
      if (!c) return;
      if (c.width !== fw || c.height !== fh) { c.width = fw; c.height = fh; }
      c.getContext("2d")?.drawImage(bmp, 0, 0);
      frames.current++;
      setState("live");
    };
    s.onclose = () => setState((x) => (x === "live" || x === "waiting" ? "ended" : x));
  };

  const rel = (e: React.MouseEvent) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 10000), y: Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 10000) };
  };
  const btn = (b: number) => (b === 2 ? "right" : b === 1 ? "middle" : "left");

  return (
    <div className="card screen-card">
      <div className="row between">
        <div className="row">
          {state === "live" || state === "waiting"
            ? <button className="btn small danger" onClick={stop}>■ {T.stop}</button>
            : <button className="btn small" onClick={start}>▶ {T.start}</button>}
          {state === "live" && <button className="btn small ghost" onClick={() => {
            ["ControlLeft", "AltLeft", "Delete"].forEach((code) => sendEv({ k: "key", code, down: true }));
            ["Delete", "AltLeft", "ControlLeft"].forEach((code) => sendEv({ k: "key", code, down: false }));
          }}>{T.ctrlAltDel}</button>}
        </div>
        <small className="muted">{state === "live" ? `${fps} fps · ${T.focus}` : state === "waiting" ? T.waiting : state === "denied" ? T.denied : state === "ended" ? `${T.ended}${reason ? `: ${reason}` : ""}` : ""}</small>
      </div>
      <div className="screen-wrap">
        <canvas ref={canvas} tabIndex={0} className={`screen ${state}`}
          onMouseMove={(e) => { const now = performance.now(); if (now - lastMove.current > 30) { lastMove.current = now; sendEv({ k: "move", ...rel(e) }); } }}
          onMouseDown={(e) => { e.currentTarget.focus(); sendEv({ k: "move", ...rel(e) }); sendEv({ k: "button", button: btn(e.button), down: true }); }}
          onMouseUp={(e) => sendEv({ k: "button", button: btn(e.button), down: false })}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => sendEv({ k: "wheel", dy: e.deltaY > 0 ? 1 : -1 })}
          onKeyDown={(e) => { e.preventDefault(); sendEv({ k: "key", code: e.code, down: true }); }}
          onKeyUp={(e) => { e.preventDefault(); sendEv({ k: "key", code: e.code, down: false }); }} />
      </div>
      {state === "live" && (
        <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (text) { sendEv({ k: "text", text }); setText(""); } }}>
          <input style={{ flex: 1 }} placeholder={T.textPh} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn small">{T.sendText}</button>
        </form>
      )}
    </div>
  );
}

function Commands({ id, T }: { id: string; T: TT }) {
  const [prog, setProg] = useState("");
  const [args, setArgs] = useState("");
  const [log, setLog] = useState<{ cmd: string; ok: boolean; out: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const cmd = `${prog} ${args}`.trim();
    try {
      const r = await api<{ ok: boolean; code: number | null; output: string }>(`/api/v1/devices/${id}/exec`, { body: { program: prog, args: args.match(/"[^"]*"|\S+/g)?.map((a) => a.replace(/^"|"$/g, "")) ?? [], timeout_s: 120 } });
      setLog((l) => [{ cmd, ok: r.ok, out: r.output || `(Code ${r.code})` }, ...l]);
    } catch (e) { setLog((l) => [{ cmd, ok: false, out: (e as Error).message }, ...l]); } finally { setBusy(false); }
  };
  return (
    <div className="card">
      <form className="row" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <input placeholder={T.program} value={prog} onChange={(e) => setProg(e.target.value)} required style={{ width: 200 }} dir="ltr" />
        <input placeholder={T.args} value={args} onChange={(e) => setArgs(e.target.value)} style={{ flex: 1 }} dir="ltr" />
        <button className="btn small" disabled={busy}>{busy ? "…" : T.run}</button>
        <button type="button" className="btn small danger" onClick={async () => { if (confirm(T.rebootQ)) await api(`/api/v1/devices/${id}/reboot`, { method: "POST" }).catch((e) => alert(e.message)); }}>⟳ {T.reboot}</button>
      </form>
      {log.map((l, i) => (
        <div key={i} className="cmd-out">
          <div className={l.ok ? "ok" : "bad"} dir="ltr">$ {l.cmd}</div>
          <pre dir="ltr">{l.out}</pre>
        </div>
      ))}
    </div>
  );
}

function Files({ id, T, os }: { id: string; T: TT; os: string }) {
  const win = /windows/i.test(os);
  const [path, setPath] = useState(win ? "" : "/");
  const [entries, setEntries] = useState<{ name: string; dir: boolean; size: number; modified: number | null }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const sep = win ? "\\" : "/";
  const join = (a: string, b: string) => (a === "" ? b : a.endsWith(sep) ? a + b : a + sep + b);
  const open = async (p: string) => {
    setErr(null);
    try { const r = await api<{ entries: typeof entries }>(`/api/v1/devices/${id}/files?path=${encodeURIComponent(p)}`); setEntries(r.entries); setPath(p); }
    catch (e) { setErr((e as Error).message); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { open(path); }, []);
  const up = () => {
    const t = path.replace(/[\\/]+$/, "");
    const i = Math.max(t.lastIndexOf("/"), t.lastIndexOf("\\"));
    open(i <= 0 ? (win ? (t.length > 3 ? t.slice(0, 3) : "") : "/") : t.slice(0, i + (win && i === 2 ? 1 : 0)));
  };
  const download = async (name: string) => {
    const r = await fetch(`/api/v1/devices/${id}/file?path=${encodeURIComponent(join(path, name))}`, { headers: { authorization: `Bearer ${getToken()}` } });
    if (!r.ok) return setErr((await r.json().catch(() => ({ message: r.statusText }))).message);
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await r.blob()), download: name });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const upload = async (f: File) => {
    const r = await fetch(`/api/v1/devices/${id}/file?path=${encodeURIComponent(join(path, f.name))}`, { method: "POST", headers: { authorization: `Bearer ${getToken()}` }, body: f });
    if (!r.ok) return setErr((await r.json().catch(() => ({ message: r.statusText }))).message);
    open(path);
  };
  return (
    <div className="card">
      <form className="row" onSubmit={(e) => { e.preventDefault(); open(path); }}>
        <button type="button" className="btn small ghost" onClick={up}>{T.up}</button>
        <input value={path} onChange={(e) => setPath(e.target.value)} style={{ flex: 1 }} dir="ltr" placeholder={T.path} />
        <button className="btn small">{T.open}</button>
        <label className="btn small ghost">⬆ {T.upload}<input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
      </form>
      {err && <p className="error">{err}</p>}
      <table style={{ marginTop: 10 }}><tbody>
        {entries.map((e) => (
          <tr key={e.name}>
            <td>{e.dir ? <a href="#" onClick={(x) => { x.preventDefault(); open(join(path, e.name)); }}>📁 {e.name}</a> : <>📄 {e.name}</>}</td>
            <td className="n muted">{e.dir ? "" : e.size > 1048576 ? `${(e.size / 1048576).toFixed(1)} MB` : `${Math.ceil(e.size / 1024)} KB`}</td>
            <td className="muted">{e.modified ? new Date(e.modified * 1000).toLocaleString() : ""}</td>
            <td className="n">{!e.dir && <button className="btn small ghost" onClick={() => download(e.name)}>⬇ {T.download}</button>}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
