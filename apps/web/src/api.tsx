import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TOKEN_KEY = "cc_session";
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);

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
    sessionStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("cc-logout"));
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).message ?? msg;
    } catch {
      /* kein JSON */
    }
    throw new ApiError(res.status, msg);
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

/** Daten laden mit Lade-/Fehlerzustand und `reload` */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    if (!path) return;
    setLoading(true);
    api<T>(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(load, [load]);
  return { data, error, loading, reload: load, setData };
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
};

type AuthCtx = {
  me: Me | null;
  ready: boolean;
  login: (email: string, password: string, code?: string) => Promise<"ok" | "2fa">;
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
    window.addEventListener("cc-logout", onLogout);
    return () => window.removeEventListener("cc-logout", onLogout);
  }, [refresh]);

  const login = async (email: string, password: string, code?: string) => {
    const r = await api<{ token?: string; two_factor_required?: boolean }>("/api/v1/auth/login", {
      body: { email, password, code },
    });
    if (r.two_factor_required) return "2fa" as const;
    sessionStorage.setItem(TOKEN_KEY, r.token!);
    await refresh();
    return "ok" as const;
  };

  const logout = async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      /* egal */
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setMe(null);
  };

  return <Auth.Provider value={{ me, ready, login, logout, refresh }}>{children}</Auth.Provider>;
}

export const useAuth = () => useContext(Auth);

/** Rechte wie im Backend (domain::access) – nur für die Anzeige, geprüft wird serverseitig */
export function can(me: Me | null, what: "invoice_issue" | "catalog_write" | "jobs" | "users" | "devices" | "invoice_write") {
  if (!me) return false;
  const r = me.role;
  switch (what) {
    case "invoice_issue":
    case "devices":
      return ["admin", "lead", "manager"].includes(r);
    case "invoice_write":
      return ["admin", "lead", "manager", "staff"].includes(r);
    case "catalog_write":
      return ["admin", "lead"].includes(r);
    case "jobs":
      return ["admin", "lead", "manager"].includes(r);
    case "users":
      return r === "admin";
  }
}
