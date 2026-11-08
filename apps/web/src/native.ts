// Brücke zur Portal-App (Tauri: Android, Windows, Linux). Im Browser ist `isApp()` false.
import { useEffect, useState } from "react";
import { api, type Me } from "./api";

export type SupportStatus = { running: boolean; until: number | null; files: boolean; control: boolean; control_available?: boolean };
export type AppInfo = {
  app: true; platform: "android" | "windows" | "linux" | "macos"; version: string; server: string;
  install_id: string; enrolled: boolean; device_id: string | null; support: SupportStatus;
};

type Invoke = { invoke: (c: string, a?: unknown) => Promise<unknown> };
type TauriWin = { __TAURI__?: { core?: Invoke }; __TAURI_INTERNALS__?: Invoke };

/** App-Brücke: `__TAURI__` (withGlobalTauri) oder – auf Android bei fremder Herkunft – nur `__TAURI_INTERNALS__` */
const tauri = (): Invoke | undefined => {
  const w = window as unknown as TauriWin;
  if (w.__TAURI__?.core) return w.__TAURI__.core;
  const i = w.__TAURI_INTERNALS__;
  return i?.invoke ? { invoke: (c, a) => i.invoke(c, a) } : undefined;
};

export const isApp = () => !!tauri();

/** Android-WebView (App) – die Brücke kann dort erst kurz nach dem Seitenstart verfügbar sein */
const inWebView = () => /; wv\)/.test(navigator.userAgent);

/** Wartet kurz auf die App-Brücke (true = App) */
export async function waitApp(): Promise<boolean> {
  const until = Date.now() + (inWebView() ? 5000 : 1200);
  while (Date.now() < until) {
    if (isApp()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return isApp();
}

/** React: läuft die Seite in der App? Aktualisiert sich, sobald die Brücke (Android: verzögert) da ist */
export function useIsApp(): boolean {
  const [app, setApp] = useState(isApp);
  useEffect(() => { if (!app) waitApp().then((a) => { if (a) setApp(true); }); }, [app]);
  return app;
}

export function native<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const t = tauri();
  if (!t) return Promise.reject(new Error("keine App"));
  return t.invoke(cmd, args) as Promise<T>;
}

const USER_KEY = "km_app_user";

/** Nach der Anmeldung: diese Installation beim Server anmelden (Mitteilungen + Support-Agent) */
export async function ensureEnrolled(me: Me) {
  const ok = await waitApp();
  if (inWebView()) {
    // Diagnose im Server-Log (einmal pro Start): welche Brücke ist da?
    const w = window as unknown as TauriWin;
    fetch(`/api/v1/app/diag?g=${!!w.__TAURI__}&i=${!!w.__TAURI_INTERNALS__}&ok=${ok}`).catch(() => {});
  }
  if (!ok) return;
  const info = await native<AppInfo>("app_info");
  let owner: string | null = null;
  try { owner = localStorage.getItem(USER_KEY); } catch { /* egal */ }
  if (info.enrolled && owner === me.id) return;
  const names = { android: "Android-App", windows: "Windows-App", linux: "Linux-App", macos: "Mac-App" };
  const r = await api<{ device_id: string; device_token: string; key: string }>("/api/v1/app/enroll", {
    body: { install_id: info.install_id, name: names[info.platform] ?? "App", platform: info.platform },
  });
  await native("app_enroll", { deviceId: r.device_id, deviceToken: r.device_token, key: r.key, server: location.origin });
  try { localStorage.setItem(USER_KEY, me.id); } catch { /* egal */ }
}

/** Beim Abmelden: Zugänge in der App vergessen */
export async function appLogout() {
  if (!isApp()) return;
  try { localStorage.removeItem(USER_KEY); } catch { /* egal */ }
  await native("app_reset").catch(() => {});
}

const toBase64 = (b: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ""));
  r.onerror = () => fail(r.error);
  r.readAsDataURL(b);
});

/** Datei ausliefern: in der App speichern und mit der passenden App öffnen, im Browser herunterladen */
export async function deliverBlob(blob: Blob, name: string): Promise<void> {
  if (isApp()) {
    try {
      await native("open_file", { name, mime: blob.type || "application/octet-stream", data: await toBase64(blob) });
    } catch (x) {
      const m = String((x as Error)?.message ?? x);
      fetch(`/api/v1/app/diag?file=${encodeURIComponent(m.slice(0, 200))}`).catch(() => {});
      alert(m.includes("not allowed") ? "Bitte die neueste KM-Portal-App installieren (Portal → App herunterladen)." : m);
    }
    return;
  }
  const u = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: u, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
