// KM Code Craft Portal für VS Code: hört auf den Ereignis-Stream des Portals (/api/v1/events)
// und zeigt Anrufe, Mitteilungen und Chat-Nachrichten. Keine Abhängigkeiten (fetch + Streams aus Node ≥ 18).
"use strict";
const vscode = require("vscode");

const SECRET = "kmPortal.token";
let stopped = true;
let abort = null;
let me = null;
let unread = 0;
let bar;
let retry = 0;

const de = vscode.env.language.startsWith("de");
const ar = vscode.env.language.startsWith("ar");
const tr = (d, e, a) => (de ? d : ar ? a : e);

function base() {
  return String(vscode.workspace.getConfiguration("kmPortal").get("url") || "https://code-craft.tech").replace(/\/+$/, "");
}

function setBar(state) {
  if (!bar) return;
  if (state === "off") {
    bar.text = "$(bell-slash) KM";
    bar.tooltip = tr("KM Portal: nicht angemeldet – klicken zum Anmelden", "KM Portal: signed out – click to sign in", "بوابة KM: غير مسجل");
    bar.command = "kmPortal.signIn";
  } else if (state === "wait") {
    bar.text = "$(sync~spin) KM";
    bar.tooltip = tr("KM Portal: verbinde …", "KM Portal: connecting …", "بوابة KM: جارٍ الاتصال …");
    bar.command = "kmPortal.open";
  } else {
    bar.text = unread > 0 ? `$(bell-dot) ${unread}` : "$(bell) KM";
    bar.tooltip = `KM Portal${me ? ` · ${me}` : ""} – ${tr("Mitteilungen öffnen", "open notifications", "فتح الإشعارات")}`;
    bar.command = "kmPortal.open";
  }
  bar.show();
}

async function api(ctx, path, opts = {}) {
  const token = await ctx.secrets.get(SECRET);
  const res = await fetch(base() + path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: { authorization: `Bearer ${token}`, ...(opts.body ? { "content-type": "application/json" } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.status === 204 ? null : res.json();
}

const open = (path) => vscode.env.openExternal(vscode.Uri.parse(base() + path));

async function onEvent(ctx, e) {
  const cfg = vscode.workspace.getConfiguration("kmPortal");
  switch (e.type) {
    case "hello":
      me = e.name; unread = e.unread || 0; setBar("on");
      return;
    case "call": {
      const d = e.data || {};
      if (d.kind !== "ring") return;
      const media = d.media === "video" ? "video" : "audio";
      const label = d.group && d.title ? `${e.name} · ${d.title}` : e.name;
      const yes = tr("Annehmen", "Accept", "قبول"), no = tr("Ablehnen", "Decline", "رفض");
      const pick = await vscode.window.showWarningMessage(
        `📞 ${label} ${tr("ruft an", "is calling", "يتصل")} (${media === "video" ? tr("Video", "video", "فيديو") : tr("Audio", "audio", "صوت")})`, yes, no);
      if (pick === yes) {
        const q = new URLSearchParams({ ring: e.room, from: e.from, media, name: e.name, t: String(Date.now()) });
        open(`/portal/nachrichten?${q}`);
      } else if (pick === no) {
        api(ctx, `/api/v1/chat/rooms/${e.room}/signal`, { body: { to: e.from, data: { kind: "decline" } } }).catch(() => {});
      }
      return;
    }
    case "notification": {
      unread += 1; setBar("on");
      const n = e.notification;
      if (e.quiet || !cfg.get("notifications")) return;
      const btn = tr("Öffnen", "Open", "فتح");
      const show = n.priority >= 2 ? vscode.window.showWarningMessage : vscode.window.showInformationMessage;
      const pick = await show(`${n.actor ? n.actor + ": " : ""}${n.title}${n.body ? " – " + n.body : ""}`, btn);
      if (pick === btn) open(n.link || "/portal/mitteilungen");
      return;
    }
    case "notification-read":
      api(ctx, "/api/v1/notifications?unread=true").then((r) => { unread = r.unread; setBar("on"); }).catch(() => {});
      return;
    case "message": {
      const m = e.message;
      if (!cfg.get("chatMessages") || !m || m.sender_name === me || m.kind === "call") return;
      const btn = tr("Antworten", "Reply", "رد");
      const pick = await vscode.window.showInformationMessage(`💬 ${m.sender_name}: ${String(m.body).slice(0, 160)}`, btn);
      if (pick === btn) open(`/portal/nachrichten?room=${m.room_id}`);
      return;
    }
  }
}

async function connect(ctx) {
  const token = await ctx.secrets.get(SECRET);
  if (!token) { setBar("off"); return; }
  stopped = false;
  while (!stopped) {
    setBar("wait");
    abort = new AbortController();
    try {
      const res = await fetch(base() + "/api/v1/events", { headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" }, signal: abort.signal });
      if (res.status === 401) {
        stopped = true;
        await ctx.secrets.delete(SECRET);
        setBar("off");
        vscode.window.showErrorMessage(tr("KM Portal: Schlüssel ungültig oder widerrufen. Bitte neu anmelden.", "KM Portal: key invalid or revoked. Please sign in again.", "بوابة KM: المفتاح غير صالح. يرجى تسجيل الدخول مجدداً."));
        return;
      }
      if (!res.ok || !res.body) throw new Error(String(res.status));
      retry = 0;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
          if (data) { try { onEvent(ctx, JSON.parse(data)); } catch { /* ignorieren */ } }
        }
      }
    } catch (err) {
      if (stopped) return;
    }
    if (stopped) return;
    setBar("wait");
    await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * 2 ** retry++)));
  }
}

function disconnect() {
  stopped = true;
  try { abort && abort.abort(); } catch { /* egal */ }
}

function activate(ctx) {
  bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  ctx.subscriptions.push(bar);
  ctx.subscriptions.push(vscode.commands.registerCommand("kmPortal.signIn", async () => {
    const url = await vscode.window.showInputBox({ prompt: tr("Adresse des Portals", "Portal address", "عنوان البوابة"), value: base(), ignoreFocusOut: true });
    if (!url) return;
    const key = await vscode.window.showInputBox({
      prompt: tr("Schlüssel aus Portal → Konto → „Neuer Schlüssel“", "Key from Portal → Account → “New key”", "المفتاح من البوابة ← الحساب ← «مفتاح جديد»"),
      password: true, ignoreFocusOut: true, placeHolder: "cc_u_…",
    });
    if (!key) return;
    await vscode.workspace.getConfiguration("kmPortal").update("url", url.replace(/\/+$/, ""), vscode.ConfigurationTarget.Global);
    await ctx.secrets.store(SECRET, key.trim());
    disconnect();
    setTimeout(() => connect(ctx), 50);
  }));
  ctx.subscriptions.push(vscode.commands.registerCommand("kmPortal.signOut", async () => {
    disconnect();
    await ctx.secrets.delete(SECRET);
    setBar("off");
  }));
  ctx.subscriptions.push(vscode.commands.registerCommand("kmPortal.open", () => open("/portal/mitteilungen")));
  ctx.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("kmPortal.url")) { disconnect(); setTimeout(() => connect(ctx), 50); }
  }));
  connect(ctx);
}

function deactivate() {
  disconnect();
}

module.exports = { activate, deactivate };
