import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const TOKEN_KEY = "cc_session";
// Normal: nur dieser Tab (sessionStorage). „Angemeldet bleiben“: localStorage (z. B. installierte App).
export const getToken = () => sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
const dropToken = () => { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && token && !path.endsWith("/auth/login")) {
    dropToken();
    window.dispatchEvent(new Event("cc-logout"));
  }
  if (!res.ok) {
    let msg = res.statusText;
    let code: string | undefined;
    try {
      const j = await res.json();
      msg = j.message ?? msg;
      code = j.error;
    } catch {
      /* kein JSON */
    }
    // Einmal-Passwort noch nicht geändert → Portal zeigt nur die Passwort-Seite
    if (code === "password_change_required") window.dispatchEvent(new Event("cc-must-change"));
    throw new ApiError(res.status, msg, code);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("json") ? res.json() : res.text()) as Promise<T>;
}

/** Datei (PDF) mit Token laden und in neuem Tab öffnen */
export async function openPdf(path: string) {
  const win = window.open("", "_blank");
  const res = await fetch(path, { headers: { authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    win?.close();
    throw new ApiError(res.status, "PDF");
  }
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else window.location.href = url;
}

/**
 * Zwischenspeicher für GET-Anfragen (stale-while-revalidate):
 * bereits geladene Seiten erscheinen sofort, im Hintergrund wird aktualisiert.
 */
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function fetchCached<T>(path: string): Promise<T> {
  let p = inflight.get(path) as Promise<T> | undefined;
  if (!p) {
    p = api<T>(path).then((d) => {
      cache.set(path, d);
      return d;
    });
    inflight.set(path, p);
    p.finally(() => inflight.delete(path));
  }
  return p;
}

/** Vorab laden (z. B. beim Überfahren eines Links), damit die nächste Seite sofort da ist */
export function prefetch(path: string) {
  if (!cache.has(path)) fetchCached(path).catch(() => {});
}

/** Für Komponenten: liegt etwas im Zwischenspeicher? */
export const peek = <T,>(path: string) => cache.get(path) as T | undefined;

/** Daten laden mit Lade-/Fehlerzustand und `reload` */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(() => (path ? ((cache.get(path) as T) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!(path && cache.has(path)));
  const load = useCallback(() => {
    if (!path) return;
    if (cache.has(path)) setData(cache.get(path) as T);
    else setLoading(true);
    fetchCached<T>(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(load, [load]);
  const reload = useCallback(() => {
    if (path) cache.delete(path);
    load();
  }, [path, load]);
  return { data, error, loading, reload, setData };
}

/** Datei hochladen (multipart) */
export async function upload<T = any>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(path, { method: "POST", headers: { authorization: `Bearer ${getToken()}` }, body: fd });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).message ?? msg;
    } catch {
      /* kein JSON */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

/** Nach Änderungen im Portal: öffentliche Daten neu laden lassen */
export function invalidate(prefix: string) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

export type Me = {
  id: string;
  email: string;
  display_name: string;
  role: "customer" | "trainee" | "staff" | "manager" | "lead" | "admin";
  organization_id: string | null;
  two_factor: boolean;
  departments: string[];
  is_employee: boolean;
  must_change_password: boolean;
  locale?: "de" | "en" | "ar";
  may_announce?: boolean;
};

type AuthCtx = {
  me: Me | null;
  ready: boolean;
  login: (email: string, password: string, code?: string, remember?: boolean) => Promise<"ok" | "2fa">;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Auth = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setReady(true);
      return;
    }
    try {
      setMe(await api<Me>("/api/v1/me"));
    } catch {
      setMe(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => setMe(null);
    const onMustChange = () => setMe((m) => (m && !m.must_change_password ? { ...m, must_change_password: true } : m));
    window.addEventListener("cc-logout", onLogout);
    window.addEventListener("cc-must-change", onMustChange);
    return () => {
      window.removeEventListener("cc-logout", onLogout);
      window.removeEventListener("cc-must-change", onMustChange);
    };
  }, [refresh]);

  const login = async (email: string, password: string, code?: string, remember = false) => {
    const r = await api<{ token?: string; two_factor_required?: boolean }>("/api/v1/auth/login", {
      body: { email, password, code, remember },
    });
    if (r.two_factor_required) return "2fa" as const;
    dropToken();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, r.token!);
    await refresh();
    return "ok" as const;
  };

  const logout = async () => {
    // Push-Abo dieses Geräts lösen: nach dem Abmelden keine Anrufe/Meldungen mehr hier
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/v1/push/unsubscribe", { body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
    } catch {
      /* egal */
    }
    try {
      const { appLogout } = await import("./native");
      await appLogout();
    } catch {
      /* egal */
    }
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      /* egal */
    }
    dropToken();
    cache.clear(); // keine Daten des vorherigen Benutzers im Speicher lassen
    setMe(null);
  };

  return <Auth.Provider value={{ me, ready, login, logout, refresh }}>{children}</Auth.Provider>;
}

export const useAuth = () => useContext(Auth);

/** Rechte wie im Backend (domain::access: Rolle + Abteilung) – nur für die Anzeige, geprüft wird serverseitig */
export type Right =
  | "invoice_read" | "invoice_write" | "invoice_issue" | "customer_read" | "customer_write"
  | "devices" | "catalog_read" | "catalog_write" | "jobs" | "users" | "project_read" | "project_write" | "tickets";

const ROLE_RIGHTS: Record<string, Right[]> = {
  lead: ["invoice_read", "invoice_write", "invoice_issue", "customer_read", "customer_write", "devices", "catalog_read", "catalog_write", "jobs", "project_read", "project_write", "tickets"],
  manager: ["invoice_read", "invoice_write", "invoice_issue", "customer_read", "customer_write", "devices", "catalog_read", "jobs", "project_read", "project_write", "tickets"],
  staff: ["invoice_read", "invoice_write", "customer_read", "catalog_read", "project_read", "project_write", "tickets"],
  trainee: ["customer_read", "catalog_read", "project_read", "tickets"],
};

const DEPTS: Record<Right, string[]> = {
  invoice_read: ["ACC", "SAL", "MGT"],
  invoice_write: ["ACC", "SAL", "MGT"],
  invoice_issue: ["ACC", "SAL", "MGT"],
  customer_read: ["ACC", "SAL", "SUP", "DEV", "MGT"],
  customer_write: ["ACC", "SAL", "MGT"],
  devices: ["SUP", "DEV", "MGT"],
  catalog_read: ["ACC", "SAL", "SUP", "DEV", "MGT"],
  catalog_write: ["SAL", "MGT"],
  jobs: ["MGT"],
  users: [],
  project_read: ["DEV", "SAL", "ACC", "MGT"],
  project_write: ["DEV", "SAL", "MGT"],
  tickets: ["SUP", "DEV", "MGT"],
};

export function can(me: Me | null, what: Right) {
  if (!me) return false;
  if (me.role === "admin") return true;
  if (me.role === "customer") return ["invoice_read", "customer_read", "project_read"].includes(what);
  if (!(ROLE_RIGHTS[me.role] ?? []).includes(what)) return false;
  return DEPTS[what].some((d) => me.departments.includes(d));
}
