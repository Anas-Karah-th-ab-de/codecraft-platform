// Webmail: Ordner, Liste, Lesen (HTML abgeschottet), Schreiben/Antworten/Weiterleiten, Anhänge; Verwaltung für Admins.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, can, getToken, useAuth } from "../../api";
import { deliverBlob } from "../../native";
import { fmtDate, useI18n } from "../../i18n";
import { useComm } from "./Comm";
import { Icon } from "../../icons";

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
type Draft = { to: string; cc: string; bcc: string; subject: string; text: string; reply_to_id?: string; forward_id?: string; forwarded?: string[]; files: File[] };

const FOLDER_ICON: Record<string, string> = { inbox: "inbox", sent: "send", drafts: "draft", trash: "trash", junk: "spam", archive: "archive" };
const FOLDER_ORDER = ["inbox", "drafts", "sent", "archive", "junk", "trash"] as const;
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

const XT = {
  de: { selectAll: "Alle auswählen", selected: (n: number) => `${n} ausgewählt`, read: "Gelesen", unreadM: "Ungelesen", star: "Markieren", archive: "Archivieren",
    moveTo: "Verschieben nach …", emptyTrash: "Papierkorb leeren", emptyJunk: "Spam leeren", confirmEmpty: (n: number) => `${n} Nachrichten endgültig löschen? Das kann nicht rückgängig gemacht werden.`,
    confirmDel: (n: number) => `${n} Nachrichten endgültig löschen?`, allRead: "Alle als gelesen", refresh: "Aktualisieren", moved: (n: number, f: string) => `${n} → ${f}`, undo: "Rückgängig",
    deleted: (n: number) => `${n} gelöscht`, today: "Heute", yesterday: "Gestern", week: "Diese Woche", older: "Älter", keys: "Tastenkürzel", prev: "Vorherige", next: "Nächste",
    shortcuts: [["j / ↓", "nächste"], ["k / ↑", "vorherige"], ["Enter", "öffnen"], ["x", "auswählen"], ["s", "markieren"], ["e", "archivieren"], ["#  Entf", "löschen"], ["u", "ungelesen"], ["r / a / f", "antworten / allen / weiterleiten"], ["c", "neue E-Mail"], ["/", "suchen"], ["Esc", "schließen"]] as [string, string][],
    trashHint: "Nachrichten im Papierkorb werden beim Löschen endgültig entfernt.", noSubject: "(kein Betreff)" },
  en: { selectAll: "Select all", selected: (n: number) => `${n} selected`, read: "Read", unreadM: "Unread", star: "Flag", archive: "Archive",
    moveTo: "Move to …", emptyTrash: "Empty trash", emptyJunk: "Empty spam", confirmEmpty: (n: number) => `Permanently delete ${n} messages? This cannot be undone.`,
    confirmDel: (n: number) => `Permanently delete ${n} messages?`, allRead: "Mark all read", refresh: "Refresh", moved: (n: number, f: string) => `${n} → ${f}`, undo: "Undo",
    deleted: (n: number) => `${n} deleted`, today: "Today", yesterday: "Yesterday", week: "This week", older: "Older", keys: "Keyboard shortcuts", prev: "Previous", next: "Next",
    shortcuts: [["j / ↓", "next"], ["k / ↑", "previous"], ["Enter", "open"], ["x", "select"], ["s", "flag"], ["e", "archive"], ["#  Del", "delete"], ["u", "unread"], ["r / a / f", "reply / all / forward"], ["c", "compose"], ["/", "search"], ["Esc", "close"]] as [string, string][],
    trashHint: "Deleting messages in the trash removes them permanently.", noSubject: "(no subject)" },
  ar: { selectAll: "تحديد الكل", selected: (n: number) => `${n} محددة`, read: "مقروء", unreadM: "غير مقروء", star: "تمييز", archive: "أرشفة",
    moveTo: "نقل إلى …", emptyTrash: "إفراغ المحذوفات", emptyJunk: "إفراغ المزعج", confirmEmpty: (n: number) => `حذف ${n} رسالة نهائياً؟ لا يمكن التراجع.`,
    confirmDel: (n: number) => `حذف ${n} رسالة نهائياً؟`, allRead: "تعليم الكل كمقروء", refresh: "تحديث", moved: (n: number, f: string) => `${n} ← ${f}`, undo: "تراجع",
    deleted: (n: number) => `تم حذف ${n}`, today: "اليوم", yesterday: "أمس", week: "هذا الأسبوع", older: "أقدم", keys: "اختصارات لوحة المفاتيح", prev: "السابق", next: "التالي",
    shortcuts: [["j / ↓", "التالي"], ["k / ↑", "السابق"], ["Enter", "فتح"], ["x", "تحديد"], ["s", "تمييز"], ["e", "أرشفة"], ["#  Del", "حذف"], ["u", "غير مقروء"], ["r / a / f", "رد / للكل / توجيه"], ["c", "رسالة جديدة"], ["/", "بحث"], ["Esc", "إغلاق"]] as [string, string][],
    trashHint: "حذف الرسائل من المحذوفات يزيلها نهائياً.", noSubject: "(بلا موضوع)" },
};

const AV_COLORS = ["#b5832a", "#2f6f8f", "#6b4fa0", "#2e7d5b", "#a64545", "#4d5a6a", "#8a6d1f", "#3c6e71"];
const avColor = (s: string) => AV_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
const initials = (s: string) => s.replace(/[<>"]/g, "").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

function dayGroup(iso: string, X: (typeof XT)["de"]) {
  const d = new Date(iso), now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff <= 0) return X.today;
  if (diff === 1) return X.yesterday;
  if (diff < 7) return X.week;
  return X.older;
}

function shortDate(iso: string, locale: string) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 6 * 86400000) return d.toLocaleDateString(locale, { weekday: "short" });
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "2-digit" } : {}) });
}

export default function Mail() {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = MT[locale];
  const X = XT[locale];
  const comm = useComm();
  const [ov, setOv] = useState<Overview | null | false>(null);
  const [folder, setFolder] = useState<string>("inbox");
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [cur, setCur] = useState<Full | null>(null);
  const [focus, setFocus] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const lastClick = useRef<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"mail" | "admin">("mail");
  const [note, setNote] = useState<{ text: string; undo?: () => void } | null>(null);
  const [keys, setKeys] = useState(false);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Admin: fremdes Postfach ansehen (nur lesen, serverseitig protokolliert)
  const [box, setBox] = useState("");
  const [boxes, setBoxes] = useState<Box[]>([]);
  const mq = box ? `mailbox=${box}` : "";
  const isAdmin = me?.role === "admin";
  const readOnly = !!box;
  useEffect(() => { if (isAdmin) api<Box[]>("/api/v1/mail/mailboxes").then(setBoxes).catch(() => {}); }, [isAdmin]);

  const loadOv = useCallback(() => api<Overview>(`/api/v1/mail?${mq}`).then(setOv).catch(() => setOv(false)), [mq]);
  const loadList = useCallback((more = false) => {
    const before = more && items.length ? `&before=${encodeURIComponent(items[items.length - 1].sent_at)}` : "";
    return api<Item[]>(`/api/v1/mail/messages?folder=${folder}&q=${encodeURIComponent(q)}${before}&${mq}`)
      .then((r) => setItems((old) => (more ? [...old, ...r] : r))).catch(() => {});
  }, [folder, q, items, mq]);
  const refresh = () => { loadList(); loadOv(); comm.bump(); };

  useEffect(() => { loadOv(); }, [loadOv]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCur(null); setSel(new Set()); setFocus(0); loadList(); }, [folder, box]);
  useEffect(() => { const t = setTimeout(() => loadList(), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);
  useEffect(() => comm.subscribe((e) => {
    if (e.type === "mail") { loadOv(); if (e.folder === folder) loadList(); setNote({ text: `✉ ${e.from}: ${e.subject}` }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [comm, folder]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), note.undo ? 8000 : 4000); return () => clearTimeout(t); }, [note]);

  const open = async (id: string) => {
    const m = await api<Full>(`/api/v1/mail/messages/${id}?${mq}`);
    setCur(m);
    const i = items.findIndex((x) => x.id === id);
    if (i >= 0) setFocus(i);
    if (box) return;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, seen: true } : x)));
    loadOv(); comm.bump();
  };

  /** Mehrfachaktion (auch für die geöffnete Nachricht) – mit „Rückgängig“ beim Verschieben/Löschen */
  const act = async (ids: string[], action: string, target?: string) => {
    if (!ids.length || readOnly) return;
    const inTrash = folder === "trash";
    if (action === "delete" && inTrash && !confirm(X.confirmDel(ids.length))) return;
    setBusy(true);
    try {
      await api("/api/v1/mail/bulk", { body: { ids, action, folder: target } });
      const from = folder;
      if (action === "move" || action === "delete") {
        setItems((xs) => xs.filter((x) => !ids.includes(x.id)));
        if (cur && ids.includes(cur.id)) setCur(null);
        const dest = action === "delete" ? "trash" : target!;
        if (!(action === "delete" && inTrash)) {
          setNote({ text: X.moved(ids.length, T[dest as keyof TT] as string), undo: () => api("/api/v1/mail/bulk", { body: { ids, action: "move", folder: from } }).then(refresh) });
        } else setNote({ text: X.deleted(ids.length) });
      } else {
        const patch: Partial<Item> = action === "read" ? { seen: true } : action === "unread" ? { seen: false } : action === "flag" ? { flagged: true } : { flagged: false };
        setItems((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, ...patch } : x)));
        if (cur && ids.includes(cur.id) && "flagged" in patch) setCur({ ...cur, flagged: !!patch.flagged });
      }
      setSel(new Set());
      loadOv(); comm.bump();
    } catch (e) { setNote({ text: (e as Error).message }); } finally { setBusy(false); }
  };
  const emptyFolder = async () => {
    const f = ov && ov.folders.find((x) => x.id === folder);
    if (!f || !confirm(X.confirmEmpty(f.total))) return;
    await api(`/api/v1/mail/folders/${folder}/empty`, { method: "POST" });
    setCur(null); setSel(new Set()); refresh();
  };
  const allRead = async () => { await api(`/api/v1/mail/folders/${folder}/read`, { method: "POST" }); refresh(); };

  const download = async (path: string, name: string) => {
    const r = await fetch(`${path}?${mq}`, { headers: { authorization: `Bearer ${getToken()}` } });
    await deliverBlob(await r.blob(), name);
  };

  const quote = (m: Full) => `\n\n${fmtDate(m.sent_at, locale)}, ${m.from_name ?? m.from_addr} ${T.wrote}:\n` + (m.text ?? "").split("\n").map((l) => `> ${l}`).join("\n");
  const reply = (m: Full, all: boolean) => setDraft({
    to: m.from_addr, cc: all ? [...m.to, ...m.cc].filter((a) => ov && a !== ov.address).join(", ") : "", bcc: "",
    subject: /^re:/i.test(m.subject) ? m.subject : `Re: ${m.subject}`, text: quote(m), reply_to_id: m.id, files: [],
  });
  const forward = (m: Full) => setDraft({ to: "", cc: "", bcc: "", subject: `Fwd: ${m.subject}`, text: quote(m), files: [],
    forward_id: m.attachments.length ? m.id : undefined, forwarded: m.attachments.map((a) => a.name) });
  const compose = () => setDraft({ to: "", cc: "", bcc: "", subject: "", text: "", files: [] });

  // Auswahl: Klick, Umschalt-Klick (Bereich)
  const toggle = (i: number, shift: boolean) => {
    setSel((s) => {
      const n = new Set(s);
      if (shift && lastClick.current !== null) {
        const [a, b] = [Math.min(lastClick.current, i), Math.max(lastClick.current, i)];
        const on = !s.has(items[i].id);
        for (let k = a; k <= b; k++) on ? n.add(items[k].id) : n.delete(items[k].id);
      } else n.has(items[i].id) ? n.delete(items[i].id) : n.add(items[i].id);
      return n;
    });
    lastClick.current = i;
  };
  const allSel = items.length > 0 && items.every((x) => sel.has(x.id));
  const targetIds = () => (sel.size ? [...sel] : cur ? [cur.id] : items[focus] ? [items[focus].id] : []);

  // Tastenkürzel
  useEffect(() => {
    if (tab !== "mail") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : document.body;
      if (draft || el.closest("input, textarea, select, [contenteditable]")) { if (e.key === "Escape" && el === searchRef.current) searchRef.current?.blur(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const move = (d: number) => { const n = Math.max(0, Math.min(items.length - 1, focus + d)); setFocus(n); listRef.current?.querySelectorAll<HTMLElement>(".ml")[n]?.scrollIntoView({ block: "nearest" }); if (cur && items[n]) open(items[n].id); };
      if (k === "j" || k === "ArrowDown") { e.preventDefault(); move(1); }
      else if (k === "k" || k === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (k === "Enter" && items[focus]) open(items[focus].id);
      else if (k === "x" && items[focus]) toggle(focus, e.shiftKey);
      else if (k === "Escape") { if (keys) setKeys(false); else if (sel.size) setSel(new Set()); else setCur(null); }
      else if (k === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (k === "?") setKeys((v) => !v);
      else if (readOnly) return;
      else if (k === "c") { e.preventDefault(); compose(); }
      else if (k === "s") { const ids = targetIds(); const it = items.find((x) => x.id === ids[0]); act(ids, it?.flagged ? "unflag" : "flag"); }
      else if (k === "e" && folder !== "archive") act(targetIds(), "move", "archive");
      else if (k === "#" || k === "Delete") act(targetIds(), "delete");
      else if (k === "u") act(targetIds(), "unread");
      else if (cur && k === "r") { e.preventDefault(); reply(cur, false); }
      else if (cur && k === "a") { e.preventDefault(); reply(cur, true); }
      else if (cur && k === "f") { e.preventDefault(); forward(cur); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (ov === false) return <div className="card">{T.noMailbox}</div>;
  const admin = can(me, "users");
  const fInfo = ov ? ov.folders.find((f) => f.id === folder) : undefined;
  const others = FOLDER_ORDER.filter((f) => f !== folder);
  let lastGroup = "";

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
            {box ? <div className="warn-box"><Icon name="eye" size={16} /> {T.readonly}</div> : (
              <button className="btn compose-btn" onClick={compose}><Icon name="edit" size={17} /> {T.compose}</button>
            )}
            <nav className="mf-list">
              {ov && FOLDER_ORDER.map((id) => {
                const f = ov.folders.find((x) => x.id === id);
                if (!f) return null;
                return (
                  <button key={f.id} className={`mf ${f.id === folder ? "on" : ""}`} onClick={() => setFolder(f.id)} title={T[f.id]}>
                    <Icon name={FOLDER_ICON[f.id]} size={18} />
                    <span className="mf-t">{T[f.id]}</span>
                    {f.unread > 0 && f.id !== "sent" && f.id !== "trash" ? <span className="badge-n">{f.unread}</span>
                      : (f.id === "trash" || f.id === "junk") && f.total > 0 ? <small className="muted">{f.total}</small> : null}
                  </button>
                );
              })}
            </nav>
            {ov && (
              <div className="mail-quota">
                <small className="muted" dir="ltr">{ov.address}</small>
                <div className="bar"><i style={{ width: `${Math.min(100, (ov.used / ov.quota) * 100)}%` }} /></div>
                <small className="muted">{size(ov.used)} / {size(ov.quota)} {T.used}</small>
              </div>
            )}
          </aside>
          <section className="mail-list">
            <div className="ml-search">
              <Icon name="search" size={17} />
              <input ref={searchRef} placeholder={T.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={T.search} />
              {q && <button className="icon-btn sm" onClick={() => setQ("")} aria-label="✕"><Icon name="x" size={15} /></button>}
            </div>
            <div className={`ml-bar ${sel.size ? "has-sel" : ""}`}>
              {!readOnly && <input type="checkbox" checked={allSel} ref={(el) => { if (el) el.indeterminate = sel.size > 0 && !allSel; }}
                onChange={() => setSel(allSel ? new Set() : new Set(items.map((x) => x.id)))} aria-label={X.selectAll} title={X.selectAll} />}
              {sel.size > 0 ? (
                <>
                  <span className="ml-count">{X.selected(sel.size)}</span>
                  <button className="icon-btn sm" disabled={busy} title={X.read} onClick={() => act([...sel], "read")}><Icon name="mail-open" size={17} /></button>
                  <button className="icon-btn sm" disabled={busy} title={X.unreadM} onClick={() => act([...sel], "unread")}><Icon name="mail" size={17} /></button>
                  <button className="icon-btn sm" disabled={busy} title={X.star} onClick={() => act([...sel], "flag")}><Icon name="star" size={17} /></button>
                  {folder !== "archive" && <button className="icon-btn sm" disabled={busy} title={X.archive} onClick={() => act([...sel], "move", "archive")}><Icon name="archive" size={17} /></button>}
                  <button className="icon-btn sm" disabled={busy} title={folder === "junk" ? T.notSpam : T.spam} onClick={() => act([...sel], "move", folder === "junk" ? "inbox" : "junk")}><Icon name="spam" size={17} /></button>
                  <select className="ml-move" value="" onChange={(e) => e.target.value && act([...sel], "move", e.target.value)} aria-label={X.moveTo}>
                    <option value="">{X.moveTo}</option>
                    {others.map((f) => <option key={f} value={f}>{T[f as keyof TT] as string}</option>)}
                  </select>
                  <button className="icon-btn sm danger" disabled={busy} title={T.del} onClick={() => act([...sel], "delete")}><Icon name="trash" size={17} /></button>
                </>
              ) : (
                <>
                  <b className="ml-title">{T[folder as keyof TT] as string}</b>
                  <span style={{ flex: 1 }} />
                  {!readOnly && fInfo && fInfo.unread > 0 && <button className="icon-btn sm" title={X.allRead} onClick={allRead}><Icon name="check" size={17} /></button>}
                  <button className="icon-btn sm" title={X.refresh} onClick={refresh}><Icon name="refresh" size={17} /></button>
                  <button className="icon-btn sm" title={X.keys} onClick={() => setKeys(!keys)}><span aria-hidden="true" style={{ fontWeight: 700 }}>⌨</span></button>
                </>
              )}
            </div>
            {!readOnly && (folder === "trash" || folder === "junk") && fInfo && fInfo.total > 0 && (
              <div className="ml-empty-bar">
                <small className="muted">{X.trashHint}</small>
                <button className="btn small danger" onClick={emptyFolder}><Icon name="trash" size={15} /> {folder === "trash" ? X.emptyTrash : X.emptyJunk}</button>
              </div>
            )}
            <div className="ml-items" ref={listRef} role="listbox" aria-multiselectable="true" aria-label={T[folder as keyof TT] as string}>
              {items.length === 0 && <div className="ml-none"><Icon name={FOLDER_ICON[folder] ?? "inbox"} size={34} /><p className="muted">{T.empty}</p></div>}
              {items.map((m, i) => {
                const g = dayGroup(m.sent_at, X);
                const head = g !== lastGroup ? (lastGroup = g) : null;
                const who = folder === "sent" || folder === "drafts" ? m.to_addrs.join(", ") : m.from_name ?? m.from_addr;
                return (
                  <div key={m.id}>
                    {head && <div className="ml-group">{head}</div>}
                    <div role="option" aria-selected={sel.has(m.id)} tabIndex={-1}
                      className={`ml ${m.seen ? "" : "unseen"} ${cur?.id === m.id ? "on" : ""} ${sel.has(m.id) ? "sel" : ""} ${focus === i ? "focus" : ""}`}
                      onClick={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) { toggle(i, e.shiftKey); return; } open(m.id); }}>
                      {!readOnly && (
                        <label className="ml-check" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={sel.has(m.id)} onChange={(e) => toggle(i, (e.nativeEvent as MouseEvent).shiftKey)} aria-label={m.subject} />
                        </label>
                      )}
                      <span className="ml-av" style={{ background: avColor(who) }} aria-hidden="true">{initials(who)}</span>
                      <div className="ml-body">
                        <div className="ml-top">
                          <b className="ml-who" dir="auto">{who}</b>
                          <span className="ml-icons">
                            {m.has_attachments && <Icon name="clip" size={14} />}
                            {m.answered && <Icon name="reply" size={14} />}
                          </span>
                          <time dateTime={m.sent_at} title={new Date(m.sent_at).toLocaleString(locale)}>{shortDate(m.sent_at, locale)}</time>
                        </div>
                        <div className="ml-subj" dir="auto">{m.subject || X.noSubject}</div>
                        <div className="ml-prev" dir="auto">{m.preview}</div>
                      </div>
                      {!readOnly && (
                        <div className="ml-quick" onClick={(e) => e.stopPropagation()}>
                          <button className={`icon-btn sm ${m.flagged ? "flagged" : ""}`} title={X.star} onClick={() => act([m.id], m.flagged ? "unflag" : "flag")}><Icon name="star" size={16} fill={m.flagged} /></button>
                          <button className="icon-btn sm hover-only" title={m.seen ? X.unreadM : X.read} onClick={() => act([m.id], m.seen ? "unread" : "read")}><Icon name={m.seen ? "mail" : "mail-open"} size={16} /></button>
                          {folder !== "archive" && <button className="icon-btn sm hover-only" title={X.archive} onClick={() => act([m.id], "move", "archive")}><Icon name="archive" size={16} /></button>}
                          <button className="icon-btn sm hover-only" title={T.del} onClick={() => act([m.id], "delete")}><Icon name="trash" size={16} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {items.length >= 50 && items.length % 50 === 0 && <button className="btn small ghost" style={{ margin: 12 }} onClick={() => loadList(true)}>{T.more}</button>}
            </div>
          </section>
          <section className="mail-read">
            {!cur ? <div className="chat-empty"><Icon name="mail-open" size={40} /><p>{T.pick}</p><small className="muted">? = {X.keys}</small></div> : (
              <Reader m={cur} T={T} X={X} readOnly={readOnly} onBack={() => setCur(null)} onReply={reply} onForward={forward}
                onAct={(a, f) => act([cur.id], a, f)} onDownload={download}
                onPrev={focus > 0 ? () => open(items[focus - 1].id) : undefined}
                onNext={focus < items.length - 1 ? () => open(items[focus + 1].id) : undefined} />
            )}
          </section>
        </div>
      )}
      {keys && (
        <div className="modal-bg" onClick={() => setKeys(false)}>
          <div className="modal keys" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={X.keys}>
            <div className="row between"><h2>{X.keys}</h2><button className="icon-btn" onClick={() => setKeys(false)} aria-label="✕"><Icon name="x" /></button></div>
            <dl>{X.shortcuts.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
          </div>
        </div>
      )}
      {draft && <Compose T={T} draft={draft} onClose={() => setDraft(null)}
        onSent={() => { setDraft(null); setNote({ text: T.sentOk }); loadOv(); if (folder === "sent") loadList(); }} />}
      {note && (
        <div className="toast mail-toast" role="status">
          <span>{note.text}</span>
          {note.undo && <button className="linkish" onClick={() => { note.undo!(); setNote(null); }}>{X.undo}</button>}
          <button className="icon-btn sm" onClick={() => setNote(null)} aria-label="✕"><Icon name="x" size={15} /></button>
        </div>
      )}
    </div>
  );
}

function Reader({ m, T, X, readOnly, onBack, onReply, onForward, onAct, onDownload, onPrev, onNext }: {
  m: Full; T: TT; X: (typeof XT)["de"]; readOnly?: boolean; onBack: () => void; onReply: (m: Full, all: boolean) => void; onForward: (m: Full) => void;
  onAct: (action: string, folder?: string) => void; onDownload: (path: string, name: string) => void; onPrev?: () => void; onNext?: () => void;
}) {
  const { locale } = useI18n();
  const [imgs, setImgs] = useState(false);
  useEffect(() => setImgs(false), [m.id]);
  const doc = useMemo(() => {
    if (!m.html) return null;
    const csp = imgs ? "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https:" : "default-src 'none'; img-src data:; style-src 'unsafe-inline'";
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
      <style>body{font:14px/1.55 system-ui,sans-serif;margin:0;padding:4px;color:#111;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${m.html}</body></html>`;
  }, [m.html, imgs]);
  const spamFail = m.auth_results && /dmarc=fail/i.test(m.auth_results);
  const who = m.from_name ?? m.from_addr;
  return (
    <article className="reader">
      <div className="reader-bar">
        <button className="icon-btn back" onClick={onBack} aria-label="←"><Icon name="arrow-left" /></button>
        {!readOnly && <>
          <button className="btn small" onClick={() => onReply(m, false)}><Icon name="reply" size={16} /> {T.reply}</button>
          <button className="icon-btn" title={T.replyAll} onClick={() => onReply(m, true)}><Icon name="reply-all" /></button>
          <button className="icon-btn" title={T.forward} onClick={() => onForward(m)}><Icon name="forward" /></button>
          <span className="sep" />
          {m.folder !== "archive" && <button className="icon-btn" title={X.archive} onClick={() => onAct("move", "archive")}><Icon name="archive" /></button>}
          <button className="icon-btn" title={m.folder === "junk" ? T.notSpam : T.spam} onClick={() => onAct("move", m.folder === "junk" ? "inbox" : "junk")}><Icon name="spam" /></button>
          <button className="icon-btn danger" title={T.del} onClick={() => onAct("delete")}><Icon name="trash" /></button>
          <span className="sep" />
          <button className={`icon-btn ${m.flagged ? "flagged" : ""}`} title={T.flag} onClick={() => onAct(m.flagged ? "unflag" : "flag")}><Icon name="star" fill={m.flagged} /></button>
          <button className="icon-btn" title={T.unread} onClick={() => onAct("unread")}><Icon name="mail" /></button>
        </>}
        <span style={{ flex: 1 }} />
        <button className="icon-btn" disabled={!onPrev} title={X.prev} onClick={onPrev}><Icon name="chevron-left" className="flip-rtl" /></button>
        <button className="icon-btn" disabled={!onNext} title={X.next} onClick={onNext}><Icon name="chevron" className="flip-rtl" /></button>
      </div>
      <h2 className="reader-subj" dir="auto">{m.subject || X.noSubject}</h2>
      <div className="reader-meta">
        <span className="ml-av big" style={{ background: avColor(who) }} aria-hidden="true">{initials(who)}</span>
        <div>
          <b>{who}</b> <small className="muted" dir="ltr">&lt;{m.from_addr}&gt;</small>
          <div className="muted"><small>{T.to}: <span dir="ltr">{m.to.join(", ")}</span>{m.cc.length > 0 && <> · {T.cc}: <span dir="ltr">{m.cc.join(", ")}</span></>}</small></div>
        </div>
        <small className="muted" style={{ marginInlineStart: "auto" }}>{new Date(m.sent_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</small>
      </div>
      {spamFail && <div className="warn-box"><Icon name="alert" size={16} /> DMARC/SPF/DKIM: {T.spam}</div>}
      {m.attachments.length > 0 && (
        <div className="atts">
          {m.attachments.map((a) => (
            <button key={a.index} className="att" onClick={() => onDownload(`/api/v1/mail/messages/${m.id}/attachments/${a.index}`, a.name)}>
              <Icon name="clip" size={15} /> {a.name} <small>{size(a.size)}</small> <Icon name="download" size={15} />
            </button>
          ))}
        </div>
      )}
      {doc ? (
        <>
          {!imgs && /<img[^>]+src=["']?https?:/i.test(m.html ?? "") && <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setImgs(true)}><Icon name="eye" size={15} /> {T.images}</button>}
          <iframe className="mail-html" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} title={m.subject} />
        </>
      ) : <pre className="mail-text">{m.text}</pre>}
      <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => onDownload(`/api/v1/mail/messages/${m.id}/raw`, `${m.subject || "mail"}.eml`)}><Icon name="download" size={15} /> {T.raw} (.eml)</button>
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
      await api("/api/v1/mail/send", { body: { to: split(d.to), cc: split(d.cc), bcc: split(d.bcc), subject: d.subject, text: d.text, reply_to_id: d.reply_to_id, forward_id: d.forward_id, attachments } });
      onSent();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal compose" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } if (e.key === "Escape") onClose(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setD({ ...d, files: [...d.files, ...Array.from(e.dataTransfer.files)] }); }}>
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
          {d.forward_id && d.forwarded?.map((n) => (
            <span key={`fw-${n}`} className="att">↪📎 {n}
              <button type="button" aria-label="Entfernen" onClick={() => setD({ ...d, forward_id: undefined, forwarded: [] })}>✕</button></span>
          ))}
          {d.files.map((f, i) => (
            <span key={i} className="att">📎 {f.name} <small>{size(f.size)}</small>
              <button type="button" aria-label="Entfernen" onClick={() => setD({ ...d, files: d.files.filter((_, j) => j !== i) })}>✕</button></span>
          ))}
        </div>
        {err && <p className="error">{err}</p>}
        <div className="row between">
          <label className="btn small ghost"><Icon name="clip" size={16} /> {T.attach}<input type="file" multiple hidden onChange={(e) => setD({ ...d, files: [...d.files, ...Array.from(e.target.files ?? [])] })} /></label>
          <div className="row">
            <button type="button" className="btn ghost" onClick={onClose}>{T.cancel}</button>
            <button className="btn" disabled={busy} title="Ctrl+Enter"><Icon name="send" size={16} /> {busy ? "…" : T.send}</button>
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
