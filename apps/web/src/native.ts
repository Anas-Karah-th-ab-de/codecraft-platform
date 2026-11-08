// Brücke zur Portal-App (Tauri: Android, Windows, Linux). Im Browser ist `isApp()` false.
import { api, type Me } from "./api";

export type SupportStatus = { running: boolean; until: number | null; files: boolean; control: boolean };
export type AppInfo = {
  app: true; platform: "android" | "windows" | "linux" | "macos"; version: string; server: string;
  install_id: string; enrolled: boolean; device_id: string | null; support: SupportStatus;
};

const tauri = () => (window as unknown as { __TAURI__?: { core?: { invoke: (c: string, a?: unknown) => Promise<unknown> } } }).__TAURI__?.core;

export const isApp = () => !!tauri();

export function native<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const t = tauri();
  if (!t) return Promise.reject(new Error("keine App"));
  return t.invoke(cmd, args) as Promise<T>;
}

const USER_KEY = "km_app_user";

/** Nach der Anmeldung: diese Installation beim Server anmelden (Mitteilungen + Support-Agent) */
export async function ensureEnrolled(me: Me) {
  if (!isApp()) return;
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
