// Webmail: Ordner, Liste, Lesen (HTML abgeschottet), Schreiben/Antworten/Weiterleiten, Anhänge; Verwaltung für Admins.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, can, getToken, useAuth } from "../../api";
import { fmtDate, useI18n } from "../../i18n";
import { useComm } from "./Comm";

const MT = {
  de: {
    title: "E-Mail", compose: "Schreiben", inbox: "Posteingang", sent: "Gesendet", drafts: "Entwürfe", trash: "Papierkorb", junk: "Spam", archive: "Archiv",
    search: "Suchen …", empty: "Keine Nachrichten.", pick: "Nachricht auswählen.", to: "An", cc: "Cc", bcc: "Bcc", subject: "Betreff",
    send: "Senden", cancel: "Abbrechen", reply: "Antworten", replyAll: "Allen antworten", forward: "Weiterleiten", del: "Löschen",
    archiveIt: "Archivieren", spam: "Spam", notSpam: "Kein Spam", unread: "Als ungelesen", flag: "Markieren", attach: "Anhang", sentOk: "Gesendet.",
    images: "Externe Bilder laden", raw: "Original", from: "Von", noMailbox: "Für dieses Konto gibt es kein Postfach.",
    used: "belegt", settings: "Einstellungen", dns: "DNS-Einträge", aliases: "Weiterleitungen", addAlias: "Weiterleitung anlegen",
    mailbox: "Postfach", queue: "Warteschlange", problems: "Zustellprobleme", wrote: "schrieb", more: "Mehr laden", tooBig: "Anhänge zusammen höchstens 25 MB.",
    own: "Eigenes Postfach", readonly: "Nur lesen – jeder Zugriff wird protokolliert", rules: "Automatische Weiterleitung",
    rMailbox: "Postfach", rSender: "Absender (leer = alle, @firma.de = ganze Domain)", rTarget: "Weiterleiten an", rKeep: "Kopie im Postfach behalten",
    rAdd: "Regel anlegen", rAll: "alle Absender", rOnly: "nur weiterleiten", rCopy: "mit Kopie", rOff: "pausiert",
  },
  en: {
    title: "Email", compose: "Compose", inbox: "Inbox", sent: "Sent", drafts: "Drafts", trash: "Trash", junk: "Spam", archive: "Archive",
    search: "Search …", empty: "No messages.", pick: "Select a message.", to: "To", cc: "Cc", bcc: "Bcc", subject: "Subject",
    send: "Send", cancel: "Cancel", reply: "Reply", replyAll: "Reply all", forward: "Forward", del: "Delete",
    archiveIt: "Archive", spam: "Spam", notSpam: "Not spam", unread: "Mark unread", flag: "Flag", attach: "Attachment", sentOk: "Sent.",
    images: "Load external images", raw: "Original", from: "From", noMailbox: "This account has no mailbox.",
    used: "used", settings: "Settings", dns: "DNS records", aliases: "Aliases", addAlias: "Add alias",
    mailbox: "Mailbox", queue: "Queue", problems: "Delivery problems", wrote: "wrote", more: "Load more", tooBig: "Attachments max. 25 MB in total.",
    own: "Own mailbox", readonly: "Read only – every access is logged", rules: "Automatic forwarding",
    rMailbox: "Mailbox", rSender: "Sender (empty = all, @company.com = whole domain)", rTarget: "Forward to", rKeep: "Keep a copy in the mailbox",
    rAdd: "Add rule", rAll: "all senders", rOnly: "forward only", rCopy: "with copy", rOff: "paused",
  },
  ar: {
    title: "البريد", compose: "رسالة جديدة", inbox: "الوارد", sent: "المرسل", drafts: "المسودات", trash: "المحذوفات", junk: "البريد المزعج", archive: "الأرشيف",
    search: "بحث …", empty: "لا توجد رسائل.", pick: "اختر رسالة.", to: "إلى", cc: "نسخة", bcc: "نسخة مخفية", subject: "الموضوع",
    send: "إرسال", cancel: "إلغاء", reply: "رد", replyAll: "رد على الكل", forward: "إعادة توجيه", del: "حذف",
    archiveIt: "أرشفة", spam: "مزعج", notSpam: "ليس مزعجاً", unread: "غير مقروء", flag: "تمييز", attach: "مرفق", sentOk: "تم الإرسال.",
    images: "تحميل الصور الخارجية", raw: "الأصل", from: "من", noMailbox: "لا يوجد بريد لهذا الحساب.",
    used: "مستخدم", settings: "الإعدادات", dns: "سجلات DNS", aliases: "عناوين التحويل", addAlias: "إضافة تحويل",
    mailbox: "صندوق البريد", queue: "قائمة الانتظار", problems: "مشاكل التسليم", wrote: "كتب", more: "تحميل المزيد", tooBig: "المرفقات بحد أقصى 25 ميغابايت.",
    own: "صندوقي", readonly: "قراءة فقط – يتم تسجيل كل وصول", rules: "التحويل التلقائي",
    rMailbox: "صندوق البريد", rSender: "المرسل (فارغ = الكل، ‎@company.com = النطاق كاملاً)", rTarget: "تحويل إلى", rKeep: "الاحتفاظ بنسخة في الصندوق",
    rAdd: "إضافة قاعدة", rAll: "كل المرسلين", rOnly: "تحويل فقط", rCopy: "مع نسخة", rOff: "متوقف",
  },
};
type TT = (typeof MT)["de"];

type Folder = { id: keyof TT; total: number; unread: number };
type Overview = { address: string; folders: Folder[]; used: number; quota: number };
type Item = {
  id: string; folder: string; subject: string; from_addr: string; from_name: string | null; to_addrs: string[]; sent_at: string;
  preview: string; seen: boolean; flagged: boolean; answered: boolean; has_attachments: boolean; size: number;
};
type Full = {
  id: string; folder: string; subject: string; from_addr: string; from_name: string | null; to: string[]; cc: string[]; sent_at: string;
  text: string | null; html: string | null; attachments: { index: number; name: string; mime: string; size: number }[];
  auth_results: string | null; flagged: boolean;
};
type Box = { id: string; address: string; owner: string; messages: number; unread: number; size: number };
type Rule = { id: string; mailbox: string; sender: string | null; forward_to: string; keep_copy: boolean; active: boolean; note: string | null };
type Draft = { to: string; cc: string; bcc: string; subject: string; text: string; reply_to_id?: string; files: File[] };

const ICONS: Record<string, string> = { inbox: "📥", sent: "📤", drafts: "📝", trash: "🗑", junk: "⚠", archive: "🗄" };
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const split = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
const b64 = (f: File) => new Promise<string>((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] ?? "");
  r.onerror = no;
  r.readAsDataURL(f);
});

/** Ungelesene im Posteingang für das Menü-Abzeichen */
export function useMailUnread() {
  const comm = useComm();
  const [n, setN] = useState(0);
  const load = useCallback(() => api<Overview>("/api/v1/mail").then((o) => setN(o.folders.find((f) => f.id === "inbox")?.unread ?? 0)).catch(() => {}), []);
  useEffect(() => { load(); }, [load, comm.unreadBump]);
  useEffect(() => comm.subscribe((e) => { if (e.type === "mail") load(); }), [comm, load]);
  return n;
}

export default function Mail() {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = MT[locale];
  const comm = useComm();
  const [ov, setOv] = useState<Overview | null | false>(null);
  const [folder, setFolder] = useState<string>("inbox");
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [cur, setCur] = useState<Full | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"mail" | "admin">("mail");
  const [note, setNote] = useState<string | null>(null);
  // Admin: fremdes Postfach ansehen (nur lesen, serverseitig protokolliert)
  const [box, setBox] = useState("");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const mq = box ? `mailbox=${box}` : "";
  const isAdmin = me?.role === "admin";
  useEffect(() => { if (isAdmin) api<Box[]>("/api/v1/mail/mailboxes").then(setBoxes).catch(() => {}); }, [isAdmin]);

  const loadOv = useCallback(() => api<Overview>(`/api/v1/mail?${mq}`).then(setOv).catch(() => setOv(false)), [mq]);
  const loadList = useCallback((more = false) => {
    const before = more && items.length ? `&before=${encodeURIComponent(items[items.length - 1].sent_at)}` : "";
    return api<Item[]>(`/api/v1/mail/messages?folder=${folder}&q=${encodeURIComponent(q)}${before}&${mq}`)
      .then((r) => setItems((old) => (more ? [...old, ...r] : r))).catch(() => {});
  }, [folder, q, items, mq]);

  useEffect(() => { loadOv(); }, [loadOv]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCur(null); loadList(); }, [folder, box]);
  useEffect(() => { const t = setTimeout(() => loadList(), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);
  useEffect(() => comm.subscribe((e) => {
    if (e.type === "mail") { loadOv(); if (e.folder === folder) loadList(); setNote(`✉ ${e.from}: ${e.subject}`); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [comm, folder]);

  const open = async (id: string) => {
    const m = await api<Full>(`/api/v1/mail/messages/${id}?${mq}`);
    setCur(m);
    if (box) return;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, seen: true } : x)));
    loadOv(); comm.bump();
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    await api(`/api/v1/mail/messages/${id}`, { method: "PATCH", body });
    if ("folder" in body) { setCur(null); }
    loadList(); loadOv(); comm.bump();
  };
  const remove = async (id: string) => {
    await api(`/api/v1/mail/messages/${id}`, { method: "DELETE" });
    setCur(null); loadList(); loadOv();
  };
  const download = async (path: string, name: string) => {
    const r = await fetch(`${path}?${mq}`, { headers: { authorization: `Bearer ${getToken()}` } });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await r.blob()), download: name });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const quote = (m: Full) => `\n\n${fmtDate(m.sent_at, locale)}, ${m.from_name ?? m.from_addr} ${T.wrote}:\n` + (m.text ?? "").split("\n").map((l) => `> ${l}`).join("\n");
  const reply = (m: Full, all: boolean) => setDraft({
    to: m.from_addr, cc: all ? [...m.to, ...m.cc].filter((a) => ov && a !== ov.address).join(", ") : "", bcc: "",
    subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`, text: quote(m), reply_to_id: m.id, files: [],
  });
  const forward = (m: Full) => setDraft({ to: "", cc: "", bcc: "", subject: `Fwd: ${m.subject}`, text: quote(m), files: [] });

  if (ov === false) return <div className="card">{T.noMailbox}</div>;
  const admin = can(me, "users");

  return (
    <div className="mail-wrap">
      {admin && (
        <div className="seg">
          <button className={tab === "mail" ? "on" : ""} onClick={() => setTab("mail")}>{T.title}</button>
          <button className={tab === "admin" ? "on" : ""} onClick={() => setTab("admin")}>{T.settings}</button>
        </div>
      )}
      {tab === "admin" ? <MailAdmin T={T} /> : (
        <div className={`mail ${cur ? "has-msg" : ""}`}>
          <aside className="mail-folders">
            {isAdmin && boxes.length > 0 && (
              <select className="mail-box" value={box} onChange={(e) => { setBox(e.target.value); setFolder("inbox"); }}>
                <option value="">{T.own}</option>
                {boxes.filter((b) => b.address !== (box ? "" : ov && ov.address)).map((b) => (
                  <option key={b.id} value={b.id}>{b.address}{b.unread ? ` (${b.unread})` : ""}</option>
                ))}
              </select>
            )}
            {box ? <div className="warn-box">👁 {T.readonly}</div> : (
              <button className="btn" onClick={() => setDraft({ to: "", cc: "", bcc: "", subject: "", text: "", files: [] })}>✎ {T.compose}</button>
            )}
            {ov && ov.folders.map((f) => (
              <button key={f.id} className={`mf ${f.id === folder ? "on" : ""}`} onClick={() => setFolder(f.id)}>
                <span>{ICONS[f.id]} {T[f.id]}</span>
                {f.unread > 0 && f.id !== "sent" && <span className="badge-n">{f.unread}</span>}
              </button>
            ))}
            {ov && (
              <div className="mail-quota">
                <small className="muted">{ov.address}</small>
                <div className="bar"><i style={{ width: `${Math.min(100, (ov.used / ov.quota) * 100)}%` }} /></div>
                <small className="muted">{size(ov.used)} / {size(ov.quota)} {T.used}</small>
              </div>
            )}
          </aside>
          <section className="mail-list">
            <input className="chat-search" placeholder={T.search} value={q} onChange={(e) => setQ(e.target.value)} />
            {items.length === 0 && <p className="muted" style={{ padding: 16 }}>{T.empty}</p>}
            {items.map((m) => (
              <button key={m.id} className={`ml ${m.seen ? "" : "unseen"} ${cur?.id === m.id ? "on" : ""}`} onClick={() => open(m.id)}>
                <div className="ml-top">
                  <b>{folder === "sent" || folder === "drafts" ? m.to_addrs.join(", ") : m.from_name ?? m.from_addr}</b>
                  <small>{fmtDate(m.sent_at, locale)}</small>
                </div>
                <div className="ml-subj">{m.flagged && "★ "}{m.answered && "↩ "}{m.subject || "—"}{m.has_attachments && " 📎"}</div>
                <div className="ml-prev">{m.preview}</div>
              </button>
            ))}
            {items.length >= 50 && <button className="btn small ghost" style={{ margin: 12 }} onClick={() => loadList(true)}>{T.more}</button>}
          </section>
          <section className="mail-read">
            {!cur ? <div className="chat-empty">{T.pick}</div> : (
              <Reader m={cur} T={T} readOnly={!!box} onBack={() => setCur(null)} onReply={reply} onForward={forward}
                onPatch={patch} onDelete={remove} onDownload={download} />
            )}
          </section>
        </div>
      )}
      {draft && <Compose T={T} draft={draft} onClose={() => setDraft(null)}
        onSent={() => { setDraft(null); setNote(T.sentOk); loadOv(); if (folder === "sent") loadList(); }} />}
      {note && <div className="toast" role="status" onClick={() => setNote(null)} onAnimationEnd={() => setNote(null)}>{note}</div>}
    </div>
  );
}

function Reader({ m, T, readOnly, onBack, onReply, onForward, onPatch, onDelete, onDownload }: {
  m: Full; T: TT; readOnly?: boolean; onBack: () => void; onReply: (m: Full, all: boolean) => void; onForward: (m: Full) => void;
  onPatch: (id: string, b: Record<string, unknown>) => void; onDelete: (id: string) => void; onDownload: (path: string, name: string) => void;
}) {
  const [imgs, setImgs] = useState(false);
  useEffect(() => setImgs(false), [m.id]);
  const doc = useMemo(() => {
    if (!m.html) return null;
    const csp = imgs ? "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https:" : "default-src 'none'; img-src data:; style-src 'unsafe-inline'";
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
      <style>body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:4px;color:#111;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${m.html}</body></html>`;
  }, [m.html, imgs]);
  const spamFail = m.auth_results && /dmarc=fail/i.test(m.auth_results);
  return (
    <article className="reader">
      <div className="reader-bar">
        <button className="btn small ghost back" onClick={onBack} aria-label="Zurück">←</button>
        {!readOnly && <>
        <button className="btn small" onClick={() => onReply(m, false)}>↩ {T.reply}</button>
        <button className="btn small ghost" onClick={() => onReply(m, true)}>{T.replyAll}</button>
        <button className="btn small ghost" onClick={() => onForward(m)}>↪ {T.forward}</button>
        <span style={{ flex: 1 }} />
        <button className="btn small ghost" title={T.flag} onClick={() => onPatch(m.id, { flagged: !m.flagged })}>{m.flagged ? "★" : "☆"}</button>
        <button className="btn small ghost" title={T.unread} onClick={() => onPatch(m.id, { seen: false })}>●</button>
        {m.folder !== "archive" && <button className="btn small ghost" title={T.archiveIt} onClick={() => onPatch(m.id, { folder: "archive" })}>🗄</button>}
        <button className="btn small ghost" title={m.folder === "junk" ? T.notSpam : T.spam} onClick={() => onPatch(m.id, { folder: m.folder === "junk" ? "inbox" : "junk" })}>⚠</button>
        <button className="btn small ghost" title={T.del} onClick={() => onDelete(m.id)}>🗑</button>
        </>}
      </div>
      <h2 className="reader-subj">{m.subject || "—"}</h2>
      <div className="reader-meta">
        <span className="av">{(m.from_name ?? m.from_addr).slice(0, 2).toUpperCase()}</span>
        <div>
          <b>{m.from_name ?? m.from_addr}</b> <small className="muted">&lt;{m.from_addr}&gt;</small>
          <div className="muted"><small>{T.to}: {m.to.join(", ")}{m.cc.length > 0 && ` · ${T.cc}: ${m.cc.join(", ")}`}</small></div>
        </div>
        <small className="muted" style={{ marginInlineStart: "auto" }}>{new Date(m.sent_at).toLocaleString()}</small>
      </div>
      {spamFail && <div className="warn-box">⚠ DMARC/SPF/DKIM: {T.spam}</div>}
      {m.attachments.length > 0 && (
        <div className="atts">
          {m.attachments.map((a) => (
            <button key={a.index} className="att" onClick={() => onDownload(`/api/v1/mail/messages/${m.id}/attachments/${a.index}`, a.name)}>
              📎 {a.name} <small>{size(a.size)}</small>
            </button>
          ))}
        </div>
      )}
      {doc ? (
        <>
          {!imgs && /<img[^>]+src=["']?https?:/i.test(m.html ?? "") && <button className="btn small ghost" onClick={() => setImgs(true)}>🖼 {T.images}</button>}
          <iframe className="mail-html" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} title={m.subject} />
        </>
      ) : <pre className="mail-text">{m.text}</pre>}
      <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => onDownload(`/api/v1/mail/messages/${m.id}/raw`, `${m.subject || "mail"}.eml`)}>{T.raw} (.eml)</button>
    </article>
  );
}

function Compose({ T, draft, onClose, onSent }: { T: TT; draft: Draft; onClose: () => void; onSent: () => void }) {
  const [d, setD] = useState(draft);
  const [showCc, setShowCc] = useState(!!draft.cc);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = d.files.reduce((a, f) => a + f.size, 0);
  const submit = async () => {
    setErr(null);
    if (total > 25 * 1048576) return setErr(T.tooBig);
    setBusy(true);
    try {
      const attachments = await Promise.all(d.files.map(async (f) => ({ name: f.name, mime: f.type || "application/octet-stream", data_b64: await b64(f) })));
      await api("/api/v1/mail/send", { body: { to: split(d.to), cc: split(d.cc), bcc: split(d.bcc), subject: d.subject, text: d.text, reply_to_id: d.reply_to_id, attachments } });
      onSent();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal compose" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h2>{d.subject || T.compose}</h2>
        <label className="cf"><span>{T.to}</span><input autoFocus={!d.to} value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} required />
          {!showCc && <button type="button" className="btn small ghost" onClick={() => setShowCc(true)}>Cc/Bcc</button>}</label>
        {showCc && <>
          <label className="cf"><span>{T.cc}</span><input value={d.cc} onChange={(e) => setD({ ...d, cc: e.target.value })} /></label>
          <label className="cf"><span>{T.bcc}</span><input value={d.bcc} onChange={(e) => setD({ ...d, bcc: e.target.value })} /></label>
        </>}
        <label className="cf"><span>{T.subject}</span><input value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} /></label>
        <textarea className="compose-text" rows={14} value={d.text} autoFocus={!!d.to} onChange={(e) => setD({ ...d, text: e.target.value })} />
        <div className="atts">
          {d.files.map((f, i) => (
            <span key={i} className="att">📎 {f.name} <small>{size(f.size)}</small>
              <button type="button" aria-label="Entfernen" onClick={() => setD({ ...d, files: d.files.filter((_, j) => j !== i) })}>✕</button></span>
          ))}
        </div>
        {err && <p className="error">{err}</p>}
        <div className="row between">
          <label className="btn small ghost">📎 {T.attach}<input type="file" multiple hidden onChange={(e) => setD({ ...d, files: [...d.files, ...Array.from(e.target.files ?? [])] })} /></label>
          <div className="row">
            <button type="button" className="btn ghost" onClick={onClose}>{T.cancel}</button>
            <button className="btn" disabled={busy}>{busy ? "…" : T.send}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

type AdminData = {
  hostname: string; domains: { domain: string; dns: { type: string; name: string; value: string }[] }[];
  aliases: { address: string; mailbox: string }[]; queue: { status: string; count: number }[];
  problems: { at: string; from: string; rcpts: string[]; error: string | null }[];
};

function MailAdmin({ T }: { T: TT }) {
  const [d, setD] = useState<AdminData | null>(null);
  const [alias, setAlias] = useState({ address: "", mailbox: "" });
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<AdminData>("/api/v1/mail/admin").then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (!d) return <div className="card">{err ?? "…"}</div>;
  return (
    <div className="mail-admin">
      <div className="card">
        <h2>{T.dns}</h2>
        <p className="muted">Server: <code>{d.hostname}</code></p>
        {d.domains.map((dm) => (
          <div key={dm.domain}>
            <h3>{dm.domain}</h3>
            <table><thead><tr><th>Typ</th><th>Name</th><th>Wert</th></tr></thead><tbody>
              {dm.dns.map((r, i) => (
                <tr key={i}><td>{r.type}</td><td><code>{r.name}</code></td>
                  <td><code className="dns-val" onClick={() => navigator.clipboard?.writeText(r.value)} title="Kopieren">{r.value}</code></td></tr>
              ))}
            </tbody></table>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>{T.aliases}</h2>
        <table><thead><tr><th>Alias</th><th>{T.mailbox}</th><th /></tr></thead><tbody>
          {d.aliases.map((a) => (
            <tr key={a.address}><td>{a.address}</td><td>{a.mailbox}</td>
              <td className="n"><button className="btn small ghost" onClick={() => api(`/api/v1/mail/aliases/${encodeURIComponent(a.address)}`, { method: "DELETE" }).then(load)}>✕</button></td></tr>
          ))}
        </tbody></table>
        <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => {
          e.preventDefault(); setErr(null);
          api("/api/v1/mail/aliases", { body: alias }).then(() => { setAlias({ address: "", mailbox: "" }); load(); }).catch((x) => setErr(x.message));
        }}>
          <input placeholder="info@code-craft.tech" value={alias.address} onChange={(e) => setAlias({ ...alias, address: e.target.value })} required />
          <span>→</span>
          <input placeholder="name@code-craft.tech" value={alias.mailbox} onChange={(e) => setAlias({ ...alias, mailbox: e.target.value })} required />
          <button className="btn small">{T.addAlias}</button>
        </form>
        {err && <p className="error">{err}</p>}
      </div>
      <MailRules T={T} />
      <div className="card">
        <h2>{T.queue}</h2>
        <p>{d.queue.length === 0 ? "–" : d.queue.map((q) => `${q.status}: ${q.count}`).join(" · ")}</p>
        {d.problems.length > 0 && <>
          <h3>{T.problems}</h3>
          <table><tbody>{d.problems.map((p, i) => (
            <tr key={i}><td>{new Date(p.at).toLocaleString()}</td><td>{p.from} → {p.rcpts.join(", ")}</td><td className="muted">{p.error}</td></tr>
          ))}</tbody></table>
        </>}
      </div>
    </div>
  );
}

function MailRules({ T }: { T: TT }) {
  const { me } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [f, setF] = useState({ mailbox: "", sender: "", forward_to: "", keep_copy: true });
  const [err, setErr] = useState<string | null>(null);
  const load = () => api<Rule[]>("/api/v1/mail/rules").then(setRules).catch((e) => setErr(e.message));
  useEffect(() => { if (me?.role === "admin") { load(); api<Box[]>("/api/v1/mail/mailboxes").then(setBoxes).catch(() => {}); } }, [me]);
  if (me?.role !== "admin") return null;
  return (
    <div className="card">
      <h2>{T.rules}</h2>
      {rules.length > 0 && (
        <table><thead><tr><th>{T.rMailbox}</th><th>{T.from}</th><th>{T.rTarget}</th><th /><th /></tr></thead><tbody>
          {rules.map((r) => (
            <tr key={r.id} style={r.active ? undefined : { opacity: 0.5 }}>
              <td>{r.mailbox}</td><td>{r.sender ?? T.rAll}</td><td>{r.forward_to}</td>
              <td className="muted">{r.active ? (r.keep_copy ? T.rCopy : T.rOnly) : T.rOff}</td>
              <td className="n">
                <button className="btn small ghost" onClick={() => api(`/api/v1/mail/rules/${r.id}`, { method: "PATCH", body: { active: !r.active } }).then(load)}>{r.active ? "⏸" : "▶"}</button>
                <button className="btn small ghost" onClick={() => api(`/api/v1/mail/rules/${r.id}`, { method: "DELETE" }).then(load)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody></table>
      )}
      <form className="grid2" style={{ marginTop: 12 }} onSubmit={(e) => {
        e.preventDefault(); setErr(null);
        api("/api/v1/mail/rules", { body: { ...f, sender: f.sender || null } })
          .then(() => { setF({ mailbox: f.mailbox, sender: "", forward_to: "", keep_copy: true }); load(); }).catch((x) => setErr(x.message));
      }}>
        <label>{T.rMailbox}
          <select required value={f.mailbox} onChange={(e) => setF({ ...f, mailbox: e.target.value })}>
            <option value="">—</option>
            {boxes.map((b) => <option key={b.id} value={b.address}>{b.address} · {b.owner}</option>)}
          </select>
        </label>
        <label>{T.rSender}<input dir="ltr" placeholder="@kunde.de" value={f.sender} onChange={(e) => setF({ ...f, sender: e.target.value })} /></label>
        <label>{T.rTarget}<input dir="ltr" type="email" required placeholder="ak@code-craft.tech" value={f.forward_to} onChange={(e) => setF({ ...f, forward_to: e.target.value })} /></label>
        <label className="row" style={{ gap: 6, alignSelf: "end" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={f.keep_copy} onChange={(e) => setF({ ...f, keep_copy: e.target.checked })} /> {T.rKeep}
        </label>
        <button className="btn small" style={{ justifySelf: "start" }}>{T.rAdd}</button>
      </form>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

const AP = {
  de: { title: "Mail-Programme & App-Passwörter", intro: "Für Outlook, Thunderbird, iPhone- oder Android-Mail. Bei aktiver Zwei-Faktor-Anmeldung ist ein App-Passwort Pflicht.",
    name: "Gerät, z. B. iPhone", create: "App-Passwort erstellen", once: "Nur jetzt sichtbar – im Mail-Programm als Passwort eintragen:", user: "Benutzername",
    last: "zuletzt benutzt", never: "nie", del: "Widerrufen" },
  en: { title: "Mail apps & app passwords", intro: "For Outlook, Thunderbird, iPhone or Android mail. Required when two-factor sign-in is on.",
    name: "Device, e.g. iPhone", create: "Create app password", once: "Shown only now – enter it as the password in your mail app:", user: "Username",
    last: "last used", never: "never", del: "Revoke" },
  ar: { title: "برامج البريد وكلمات مرور التطبيقات", intro: "لـ Outlook أو Thunderbird أو بريد iPhone/Android. مطلوبة عند تفعيل التحقق بخطوتين.",
    name: "الجهاز، مثلاً iPhone", create: "إنشاء كلمة مرور للتطبيق", once: "تظهر الآن فقط – أدخلها ككلمة مرور في برنامج البريد:", user: "اسم المستخدم",
    last: "آخر استخدام", never: "أبداً", del: "إلغاء" },
};

export function AppPasswords() {
  const { locale } = useI18n();
  const T = AP[locale];
  type Data = { items: { id: string; name: string; created_at: string; last_used_at: string | null }[]; settings: { address: string | null; imap: string; smtp: string } };
  const [d, setD] = useState<Data | null>(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const load = () => api<Data>("/api/v1/account/app-passwords").then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d?.settings.address) return null;
  return (
    <div className="card">
      <h2>{T.title}</h2>
      <p className="muted">{T.intro}</p>
      <table><tbody>
        <tr><td>{T.user}</td><td><code>{d.settings.address}</code></td></tr>
        <tr><td>IMAP</td><td><code>{d.settings.imap}</code></td></tr>
        <tr><td>SMTP</td><td><code>{d.settings.smtp}</code></td></tr>
      </tbody></table>
      {d.items.length > 0 && <table style={{ marginTop: 12 }}><tbody>
        {d.items.map((i) => (
          <tr key={i.id}><td><b>{i.name}</b></td><td className="muted">{T.last}: {i.last_used_at ? new Date(i.last_used_at).toLocaleString() : T.never}</td>
            <td className="n"><button className="btn small ghost" onClick={() => api(`/api/v1/account/app-passwords/${i.id}`, { method: "DELETE" }).then(load)}>{T.del}</button></td></tr>
        ))}
      </tbody></table>}
      {fresh && <div className="note-ok">{T.once} <code className="big-code">{fresh}</code></div>}
      <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => {
        e.preventDefault();
        api<{ password: string }>("/api/v1/account/app-passwords", { body: { name } }).then((r) => { setFresh(r.password); setName(""); load(); });
      }}>
        <input placeholder={T.name} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        <button className="btn small">{T.create}</button>
      </form>
    </div>
  );
}
