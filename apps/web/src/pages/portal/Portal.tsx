import { useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { api, can, useApi, useAuth } from "../../api";
import { money, useI18n, type Key } from "../../i18n";
import { Field, LangSwitch, Loading, useSubmit } from "../../ui";
import Invoices from "./Invoices";
import { Projects, Quotes } from "./Projects";
import ProductsAdmin from "./Products";
import { Customers, Devices, Jobs, Requests, Users } from "./Admin";
import { CommProvider } from "./Comm";
import Chat, { useUnread } from "./Chat";

function UnreadBadge() {
  const n = useUnread();
  return n > 0 ? <span className="badge-n">{n > 99 ? "99+" : n}</span> : null;
}

export default function Portal() {
  const { me, ready, logout } = useAuth();
  const { t } = useI18n();
  if (!ready) return <Loading />;
  if (!me) return <Login />;

  const links: [string, Key, boolean][] = [
    ["", "p.dashboard", true],
    ["nachrichten", "p.messages", true],
    ["projekte", "p.projects", true],
    ["angebote", "p.quotes", true],
    ["rechnungen", "p.invoices", true],
    ["kunden", "p.customers", me.is_employee],
    ["produkte", "p.products", me.is_employee],
    ["stellen", "p.jobs", can(me, "jobs")],
    ["anfragen", "p.requests", can(me, "jobs")],
    ["geraete", "p.devices", can(me, "devices")],
    ["benutzer", "p.users", can(me, "users")],
    ["konto", "p.account", true],
  ];

  return (
    <CommProvider>
    <div className="portal">
      <aside className="side">
        <Link to="/" className="logo"><img src="/brand/logo.png" alt="KM Code Craft" width="95" height="40" /></Link>
        {links.filter((l) => l[2]).map(([to, key]) => (
          <NavLink key={to} to={`/portal/${to}`} end={to === ""}>{t(key)}{to === "nachrichten" && <UnreadBadge />}</NavLink>
        ))}
        <div className="me">
          <div style={{ color: "#fff", fontWeight: 600 }}>{me.display_name}</div>
          <div>{me.role} {me.departments.length > 0 && `· ${me.departments.join(", ")}`}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <LangSwitch />
            <button className="btn small ghost" style={{ color: "#cbd5e1", borderColor: "#334155" }} onClick={logout}>
              {t("login.logout")}
            </button>
          </div>
        </div>
      </aside>
      <section className="main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="nachrichten" element={<Chat />} />
          <Route path="projekte/*" element={<Projects />} />
          <Route path="angebote/*" element={<Quotes />} />
          <Route path="rechnungen/*" element={<Invoices />} />
          <Route path="kunden" element={<Customers />} />
          <Route path="produkte" element={<ProductsAdmin />} />
          <Route path="stellen" element={<Jobs />} />
          <Route path="anfragen" element={<Requests />} />
          <Route path="geraete" element={<Devices />} />
          <Route path="benutzer" element={<Users />} />
          <Route path="konto" element={<Account />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </section>
    </div>
    </CommProvider>
  );
}

function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"pw" | "2fa">("pw");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await login(email, password, step === "2fa" ? code : undefined);
      if (r === "2fa") setStep("2fa");
    } catch (e: any) {
      setErr(e.status === 401 ? t("login.failed") : e.message);
      if (step === "2fa") setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card" onSubmit={submit}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <Link to="/" className="logo"><img src="/brand/logo.png" alt="KM Code Craft" width="95" height="40" /></Link>
          <LangSwitch />
        </div>
        <h2>{t("login.title")}</h2>
        {step === "pw" ? (
          <>
            <Field label={t("form.email")}>
              <input type="email" dir="ltr" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("login.password")}>
              <input type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </>
        ) : (
          <Field label={t("login.code")}>
            <input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} required autoFocus
              style={{ fontSize: "1.6em", letterSpacing: ".4em", textAlign: "center" }}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </Field>
        )}
        {err && <div className="alert">{err}</div>}
        <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {step === "pw" ? t("login.submit") : t("login.verify")}
        </button>
      </form>
    </div>
  );
}

type Rev = { department_code: string | null; net_cents: number; items: number };
type Inv = { id: string; status: string; gross_cents: number | null; kind: string };
type Dept = { code: string; name: { de: string; en: string; ar: string }; color: string };

function Dashboard() {
  const { me } = useAuth();
  const { t, locale } = useI18n();
  const inv = useApi<Inv[]>("/api/v1/invoices");
  const rev = useApi<Rev[]>(me?.is_employee ? "/api/v1/reports/revenue-by-department" : null);
  const depts = useApi<Dept[]>(me?.is_employee ? "/api/v1/departments" : null);
  const open = inv.data?.filter((i) => i.status === "issued" && i.kind === "invoice") ?? [];
  const max = Math.max(1, ...(rev.data?.map((r) => Math.abs(r.net_cents)) ?? [1]));
  return (
    <>
      <h1>{t("p.dashboard")}</h1>
      <div className="grid2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="muted">{t("p.open")}</div>
          <div className="kpi">{open.length}</div>
          <div className="muted">{money(open.reduce((s, i) => s + (i.gross_cents ?? 0), 0), locale)}</div>
        </div>
        <div className="card">
          <div className="muted">{t("p.invoices")}</div>
          <div className="kpi">{inv.data?.length ?? "…"}</div>
          <Link to="/portal/rechnungen">→ {t("p.invoices")}</Link>
        </div>
      </div>
      {me?.is_employee && (
        <div className="card">
          <h3>{t("p.revenue")}</h3>
          {!rev.data ? <Loading error={rev.error} /> : rev.data.length === 0 ? <p className="muted">{t("p.empty")}</p> :
            rev.data.map((r) => {
              const d = depts.data?.find((x) => x.code === r.department_code);
              return (
                <div key={r.department_code ?? "-"} style={{ marginBottom: 10 }}>
                  <div className="row between">
                    <span>{d ? d.name[locale] : t("p.unassigned")}</span>
                    <b>{money(r.net_cents, locale)}</b>
                  </div>
                  <div className="bar" style={{ ["--c" as any]: d?.color }}>
                    <div style={{ width: `${(Math.abs(r.net_cents) / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}

function Account() {
  const { t } = useI18n();
  const { me, refresh } = useAuth();
  const [setup, setSetup] = useState<{ qr_png_base64: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState({ current: "", new: "" });
  const tfa = useSubmit();
  const pws = useSubmit();
  if (!me) return null;
  return (
    <>
      <h1>{t("p.account")}</h1>
      <div className="grid2">
        <div className="card">
          <h3>{t("p.2fa")}</h3>
          <p>{me.two_factor ? `✅ ${t("p.2fa_on")}` : `⚠️ ${t("p.2fa_off")}`}</p>
          {!me.two_factor && !setup && (
            <button className="btn" onClick={tfa.run(async () => setSetup(await api("/api/v1/auth/2fa/setup", { method: "POST" })))}>
              {t("p.2fa_setup")}
            </button>
          )}
          {setup && !me.two_factor && (
            <form onSubmit={tfa.run(async () => {
              await api("/api/v1/auth/2fa/enable", { body: { code } });
              setSetup(null);
              setCode("");
              await refresh();
            })}>
              <p className="muted">{t("p.2fa_scan")}</p>
              <img src={`data:image/png;base64,${setup.qr_png_base64}`} alt="QR" style={{ width: 200, height: 200 }} />
              <p dir="ltr" style={{ fontFamily: "monospace", fontSize: ".85em", wordBreak: "break-all" }}>{setup.secret}</p>
              <Field label={t("login.code")}>
                <input inputMode="numeric" dir="ltr" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
              </Field>
              <button className="btn" disabled={tfa.busy}>{t("login.verify")}</button>
            </form>
          )}
          {me.two_factor && (
            <form className="row" onSubmit={tfa.run(async () => {
              await api("/api/v1/auth/2fa/disable", { body: { code } });
              setCode("");
              await refresh();
            })}>
              <input inputMode="numeric" dir="ltr" maxLength={6} placeholder="123456" style={{ width: 140 }} required value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn danger small" disabled={tfa.busy}>{t("p.2fa_disable")}</button>
            </form>
          )}
          {tfa.error && <div className="alert">{tfa.error}</div>}
        </div>
        <div className="card">
          <h3>{t("p.change_pw")}</h3>
          <form onSubmit={pws.run(async () => {
            await api("/api/v1/auth/password", { body: pw });
            setPw({ current: "", new: "" });
          })}>
            <Field label={t("p.current_pw")}>
              <input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </Field>
            <Field label={t("p.new_pw")}>
              <input type="password" autoComplete="new-password" minLength={10} required value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} />
            </Field>
            {pws.error && <div className="alert">{pws.error}</div>}
            {pws.done && <div className="alert ok">{t("p.saved")}</div>}
            <button className="btn" disabled={pws.busy}>{t("p.save")}</button>
          </form>
        </div>
      </div>
    </>
  );
}
