import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { api, can, useApi, useAuth } from "../../api";
import { money, useI18n, type Key } from "../../i18n";
import { Field, LangSwitch, Loading, useSubmit } from "../../ui";
import Invoices from "./Invoices";
import { Projects, Quotes } from "./Projects";
import ProductsAdmin from "./Products";
import { Customers, Devices, Jobs, Requests, Users } from "./Admin";
import { CommProvider } from "./Comm";
import Chat, { useUnread } from "./Chat";
import Mail, { AppPasswords, useMailUnread } from "./Mail";
import Remote from "./Remote";
import { CustomerAccess, ForcePassword } from "./Access";
import Tickets from "./Tickets";
import Shop from "./Shop";
import DevRequests from "./DevRequests";
import Work from "./Work";
import { BrokenTrace } from "../site/Board";
import Meeting from "../Meeting";
import Help, { PageHelp } from "./Help";
import { AnnouncementBanner, Announcements, Bell, NotificationsPage, NotifyProvider, useNotify } from "./Notify";
import { Icon } from "../../icons";
import { Sessions } from "./Sessions";
import { AppSupport } from "./AppSupport";
import { AppDownload, UpdateBanner } from "./AppDownload";
import { isApp, useIsApp } from "../../native";

const Badge = ({ n }: { n: number }) => (n > 0 ? <span className="badge-n">{n > 99 ? "99+" : n}</span> : null);
const UnreadBadge = () => <Badge n={useUnread()} />;
const MailBadge = () => <Badge n={useMailUnread()} />;
const NoteBadge = () => <Badge n={useNotify().unread} />;
const AnnBadge = () => <Badge n={useNotify().annUnread} />;

const NAV_ICON: Record<string, string> = {
  "": "home", nachrichten: "chat", mail: "mail", mitteilungen: "bell", ankuendigungen: "megaphone", support: "support",
  "anfragen-entwicklung": "code", projekte: "folder", shop: "cart", kunden: "building", produkte: "box", geraete: "cpu",
  fernzugriff: "key", angebote: "quote", rechnungen: "receipt", arbeit: "clock", stellen: "briefcase", anfragen: "inbox2",
  benutzer: "users", konto: "account", hilfe: "help", "support-zugriff": "shield", app: "download",
};

/** Seitenmenü eingeklappt? Eigene Wahl wird gemerkt; ohne Wahl klappt E-Mail automatisch ein (mehr Platz). */
function useCollapsed(seg: string): [boolean, () => void] {
  const [pref, setPref] = useState<string | null>(() => { try { return localStorage.getItem("cc_side"); } catch { return null; } });
  const collapsed = pref === "1" || (pref === null && seg === "mail");
  const toggle = () => {
    const next = collapsed ? "0" : "1";
    try { localStorage.setItem("cc_side", next); } catch { /* egal */ }
    setPref(next);
  };
  return [collapsed, toggle];
}

const PT = {
  de: { groups: ["Übersicht", "Kunden & Aufträge", "Finanzen", "Team", "Verwaltung"], menu: "Menü", nf: "Diese Seite gibt es im Portal nicht.", back: "Zur Übersicht",
    artH: "Ein Zugang für Team und Kunden.", artP: "Projekte, Tickets, Rechnungen, Nachrichten und Fernwartung an einem Ort." },
  en: { groups: ["Overview", "Customers & work", "Finance", "Team", "Administration"], menu: "Menu", nf: "This page doesn't exist in the portal.", back: "Back to overview",
    artH: "One login for team and customers.", artP: "Projects, tickets, invoices, messages and remote support in one place." },
  ar: { groups: ["نظرة عامة", "العملاء والأعمال", "المالية", "الفريق", "الإدارة"], menu: "القائمة", nf: "هذه الصفحة غير موجودة في البوابة.", back: "العودة إلى النظرة العامة",
    artH: "دخول واحد للفريق والعملاء.", artP: "المشاريع والتذاكر والفواتير والرسائل والدعم عن بُعد في مكان واحد." },
};

type NavItem = [to: string, key: Key, show: boolean, group: number];

export default function Portal() {
  const { me, ready, logout } = useAuth();
  const inApp = useIsApp();
  const { t, locale } = useI18n();
  const T = PT[locale];
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const seg = pathname.replace(/^\/portal\/?/, "").split("/")[0];
  const [collapsed, toggleSide] = useCollapsed(seg);
  useEffect(() => { setMenu(false); setHelp(false); window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [pathname]);
  const items: NavItem[] = !me ? [] : [
    ["", "p.dashboard", true, 0],
    ["nachrichten", "p.messages", true, 0],
    ["mail", "p.mail", me.is_employee, 0],
    ["mitteilungen", "p.notifications", true, 0],
    ["ankuendigungen", "p.announcements", true, 0],
    ["support", "p.support", true, 1],
    ["anfragen-entwicklung", "p.dev", can(me, "project_read"), 1],
    ["projekte", "p.projects", can(me, "project_read"), 1],
    ["shop", "p.shop", !me.is_employee || can(me, "invoice_read"), 1],
    ["kunden", "p.customers", me.is_employee && can(me, "customer_read"), 1],
    ["produkte", "p.products", me.is_employee && can(me, "catalog_read"), 1],
    ["geraete", "p.devices", can(me, "devices"), 1],
    ["fernzugriff", "p.access", me.role === "customer", 1],
    ["angebote", "p.quotes", can(me, "invoice_read"), 2],
    ["rechnungen", "p.invoices", can(me, "invoice_read"), 2],
    ["arbeit", "p.work", me.is_employee, 3],
    ["stellen", "p.jobs", can(me, "jobs"), 3],
    ["anfragen", "p.requests", can(me, "jobs"), 3],
    ["benutzer", "p.users", can(me, "users"), 4],
    ["konto", "p.account", true, 4],
    ["support-zugriff", "p.remote_help", inApp, 4],
    ["app", "p.app", !inApp, 4],
    ["hilfe", "p.help", true, 4],
  ];
  const current = items.find((l) => l[0] === seg);
  const title = current ? t(current[1]) : "404";
  useEffect(() => { if (me) document.title = `${title} · KM Code Craft`; }, [title, me]);
  if (!ready) return <Loading />;
  if (!me) return <Login />;
  if (me.must_change_password) return <ForcePassword />;

  const visible = items.filter((l) => l[2]);
  const groups = T.groups.map((name, g) => ({ name, links: visible.filter((l) => l[3] === g) })).filter((g) => g.links.length > 0);
  const initials = me.display_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  // Meeting im Vollbild, ohne Portal-Rahmen
  if (seg === "meeting") return <Routes><Route path="meeting/:id" element={<Meeting member />} /></Routes>;

  return (
    <CommProvider>
    <NotifyProvider>
    <div className={`portal ${menu ? "menu-open" : ""} ${collapsed ? "side-mini" : ""}`}>
      <aside className="side" id="portal-menu">
        <div className="side-top">
          <Link to="/" className="logo logo-home"><img src="/brand/logo.png" alt="KM Code Craft" width="95" height="40" /></Link>
          <button className="side-toggle" onClick={toggleSide} aria-label={t(collapsed ? "p.expand" : "p.collapse")} title={t(collapsed ? "p.expand" : "p.collapse")}>
            <Icon name="panel-left" size={18} />
          </button>
        </div>
        <nav aria-label={T.menu}>
          {groups.map((g) => (
            <div key={g.name} className="side-group">
              {me.is_employee && <span>{g.name}</span>}
              {g.links.map(([to, key]) => (
                <NavLink key={to} to={to ? `/portal/${to}` : "/portal"} end={to === ""} title={collapsed ? t(key) : undefined} aria-label={collapsed ? t(key) : undefined}>
                  <Icon name={NAV_ICON[to] ?? "dot"} size={18} className="nav-ic" />
                  <span className="nav-t">{t(key)}</span>
                  {to === "nachrichten" && <UnreadBadge />}{to === "mail" && <MailBadge />}{to === "mitteilungen" && <NoteBadge />}{to === "ankuendigungen" && <AnnBadge />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-mobile row">
            <LangSwitch />
            <button className="btn small ghost" onClick={logout}>{t("login.logout")}</button>
          </div>
          <span>KM Code Craft Portal</span>
        </div>
      </aside>
      <div className="scrim" onClick={() => setMenu(false)} />
      {help && <PageHelp seg={seg} onClose={() => setHelp(false)} />}
      <div className="portal-body">
        <header className="topbar">
          <button className="burger" aria-label={T.menu} aria-controls="portal-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><span /><span /><span /></button>
          <nav className="crumb" aria-label="Breadcrumb">
            <span>{me.is_employee && current ? T.groups[current[3]] : "Portal"}</span>
            <b>{title}</b>
          </nav>
          <div className="topbar-right">
            <Bell />
            <button className="help-btn" onClick={() => setHelp(true)} aria-label={t("p.help")} title={t("p.help")}>?</button>
            <span className="hide-sm"><LangSwitch /></span>
            <div className="user-chip">
              <div className="who"><b>{me.display_name}</b><small>{me.role}{me.departments.length > 0 && ` · ${me.departments.join(", ")}`}</small></div>
              <span className="av" aria-hidden="true">{initials}</span>
            </div>
            <button className="btn small ghost hide-sm" onClick={logout}>{t("login.logout")}</button>
          </div>
        </header>
        <section className={`main ${seg === "mail" ? "wide" : ""}`}>
          <AnnouncementBanner />
          <UpdateBanner />
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="nachrichten" element={<Chat />} />
            <Route path="support/*" element={<Tickets />} />
            <Route path="shop" element={<Shop />} />
            <Route path="anfragen-entwicklung/*" element={<DevRequests />} />
            <Route path="mail" element={<Mail />} />
            <Route path="mitteilungen" element={<NotificationsPage />} />
            <Route path="ankuendigungen" element={<Announcements />} />
            <Route path="arbeit" element={<Work />} />
            <Route path="projekte/*" element={<Projects />} />
            <Route path="angebote/*" element={<Quotes />} />
            <Route path="rechnungen/*" element={<Invoices />} />
            <Route path="kunden" element={<Customers />} />
            <Route path="produkte" element={<ProductsAdmin />} />
            <Route path="stellen" element={<Jobs />} />
            <Route path="anfragen" element={<Requests />} />
            <Route path="geraete" element={<Devices />} />
            <Route path="geraete/:id" element={<Remote />} />
            <Route path="fernzugriff" element={<CustomerAccess />} />
            <Route path="benutzer" element={<Users />} />
            <Route path="konto" element={<Account />} />
            <Route path="support-zugriff" element={<><h1>{t("p.remote_help")}</h1><AppSupport /></>} />
            <Route path="app" element={<><h1>{t("p.app")}</h1><AppDownload /></>} />
            <Route path="hilfe" element={<Help areas={visible.filter((l) => !["", "konto", "hilfe", "mitteilungen", "ankuendigungen", "support-zugriff", "app"].includes(l[0])).map((l) => t(l[1]))} />} />
            <Route path="*" element={
              <div className="notfound" style={{ minHeight: "50vh" }}>
                <div><BrokenTrace /><h1>404</h1><p>{T.nf}</p><Link className="btn" to="/portal">{T.back}</Link></div>
              </div>
            } />
          </Routes>
        </section>
      </div>
    </div>
    </NotifyProvider>
    </CommProvider>
  );
}

/** Dekoration der Anmeldeseite: Leiterbahnen zum Formular */
function LoginArt() {
  const { locale } = useI18n();
  const T = PT[locale];
  return (
    <div className="login-art" aria-hidden="true">
      <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
        {["M-10 140 H180 L240 200 H610", "M-10 300 H90 L150 360 H420 L470 310 H610", "M120 -10 V60 L180 120 H360 L400 80 V-10", "M300 810 V640 L340 600 H610"].map((d, i) => (
          <path key={d} d={d} fill="none" stroke={i === 1 ? "#d9b56c" : "#333940"} strokeWidth={i === 1 ? 2.5 : 2} strokeLinejoin="round" />
        ))}
        {[[240, 200], [150, 360], [470, 310], [180, 120], [340, 600]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 1 ? 7 : 5} fill="#16191d" stroke={i === 1 || i === 2 ? "#d9b56c" : "#4a5158"} strokeWidth="2" />
        ))}
      </svg>
      <b>{T.artH}</b>
      <p>{T.artP}</p>
    </div>
  );
}

function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"pw" | "2fa">("pw");
  // In der App (Android-WebView: Brücke kommt evtl. erst später) und als installierte Web-App angemeldet bleiben
  const [remember, setRemember] = useState(() => isApp() || /; wv\)/.test(navigator.userAgent) || matchMedia("(display-mode: standalone)").matches);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await login(email, password, step === "2fa" ? code : undefined, remember);
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
      <LoginArt />
      <form onSubmit={submit}>
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
            <label className="check-row" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t("login.remember")}
            </label>
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
      <div style={{ marginTop: 16 }}><Sessions /></div>
      {me.is_employee && <div style={{ marginTop: 16 }}><AppPasswords /></div>}
    </>
  );
}
