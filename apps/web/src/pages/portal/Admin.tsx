import { useEffect, useState } from "react";
import { Icon } from "../../icons";
import { api, can, useApi, useAuth } from "../../api";
import { fmtDate, useI18n, type Key, type Locale } from "../../i18n";
import { Badge, Field, Loading, Modal, useSubmit, ListTools, Filter, matches, NoHits } from "../../ui";
import { I18nInput } from "./Products";
import type { Product } from "./Invoices";
import { RedeemCode, ResetPassword, useMustChangeLabel } from "./Access";
import { PaymentMethodsAdmin, PaymentSelect, PT, usePaymentMethods } from "./Payment";

type I18n = { de: string; en: string; ar: string };
type Dept = { code: string; name: I18n };

// ── Kunden ──────────────────────────────────────────────────────────────────
type Org = { id: string; name: string; address: string; vat_id: string | null; email: string | null; locale: string; sla: "basic" | "business" | "premium"; payment_method_id: string | null };

export function Customers() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const methods = usePaymentMethods();
  const { data, error, reload } = useApi<Org[]>("/api/v1/organizations");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", address: "", vat_id: "", email: "", locale: "de" });
  const [q, setQ] = useState("");
  const [sla, setSla] = useState("");
  const [pm, setPm] = useState("");
  const rows = (data ?? []).filter((o) => (!sla || o.sla === sla) && (!pm || (o.payment_method_id ?? "-") === pm)
    && matches(q, o.name, o.address, o.vat_id, o.email));
  const s = useSubmit();
  return (
    <>
      <div className="row between">
        <h1>{t("p.customers")}</h1>
        {can(me, "invoice_issue") && <button className="btn" onClick={() => setOpen(true)}>+ {t("p.new")}</button>}
      </div>
      <ListTools q={q} setQ={setQ} shown={rows.length} total={data?.length ?? 0}>
        <Filter label="SLA" value={sla} onChange={setSla} options={[["basic", "Basis"], ["business", "Business"], ["premium", "Premium"]]} />
        <Filter label={PT[locale].method} value={pm} onChange={setPm} options={[["-", PT[locale].auto], ...(methods.data ?? []).map((m) => [m.id, m.name] as [string, string])]} />
      </ListTools>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : data.length === 0 ? <p className="spin">{t("p.empty")}</p> : rows.length === 0 ? <NoHits /> : (
          <table>
            <thead><tr><th>{t("p.customer")}</th><th>{t("p.address")}</th><th>{t("p.vat_id")}</th><th>{t("p.email")}</th><th>{t("p.language")}</th><th>SLA</th><th>{PT[locale].method}</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}><td><b>{o.name}</b></td><td style={{ whiteSpace: "pre-line" }}>{o.address}</td><td>{o.vat_id ?? "–"}</td><td>{o.email ?? "–"}</td><td>{o.locale.toUpperCase()}</td>
                  <td>{me && ["admin", "lead"].includes(me.role) ? (
                    <select value={o.sla} onChange={(e) => api(`/api/v1/organizations/${o.id}/sla`, { method: "PUT", body: { sla: e.target.value } }).then(reload)}>
                      <option value="basic">Basis</option><option value="business">Business</option><option value="premium">Premium</option>
                    </select>
                  ) : o.sla}</td>
                  <td>{can(me, "customer_write") ? (
                    <PaymentSelect value={o.payment_method_id ?? ""} onChange={(v) => api(`/api/v1/organizations/${o.id}/payment-method`, { method: "PUT", body: { payment_method_id: v || null } }).then(reload)} />
                  ) : methods.data?.find((m) => m.id === o.payment_method_id)?.name ?? PT[locale].auto}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && (
        <Modal title={`${t("p.customers")} – ${t("p.new")}`} onClose={() => setOpen(false)}>
          <form onSubmit={s.run(async () => {
            await api("/api/v1/organizations", { body: { ...f, vat_id: f.vat_id || null, email: f.email || null } });
            setOpen(false); setF({ name: "", address: "", vat_id: "", email: "", locale: "de" }); reload();
          })}>
            <Field label={t("p.customer")}><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={t("p.address")}><textarea required rows={3} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
            <div className="grid2">
              <Field label={t("p.vat_id")}><input dir="ltr" value={f.vat_id} onChange={(e) => setF({ ...f, vat_id: e.target.value })} /></Field>
              <Field label={t("p.email")}><input type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label={t("p.language")}>
                <select value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}>
                  <option value="de">Deutsch</option><option value="en">English</option><option value="ar">العربية</option>
                </select>
              </Field>
            </div>
            {s.error && <div className="alert">{s.error}</div>}
            <button className="btn" disabled={s.busy}>{t("p.create")}</button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ── Stellen & Bewerbungen ───────────────────────────────────────────────────
type Job = {
  id: string; slug: string; department_code: string; title: I18n; status: string; location: string;
  employment_type: string; remote: boolean; applications: number; published_at: string | null;
};
type Application = { id: string; job_slug: string; name: string; email: string; phone: string | null; message: string; locale: string; status: string; created_at: string };

export function Jobs() {
  const { t, locale } = useI18n();
  const { data, error, reload } = useApi<Job[]>("/api/v1/jobs");
  const apps = useApi<Application[]>("/api/v1/applications");
  const depts = useApi<Dept[]>("/api/v1/departments");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [qa, setQa] = useState("");
  const [job, setJob] = useState("");
  const jobs = (data ?? []).filter((j) => matches(q, ...Object.values(j.title), j.department_code, j.location, j.status));
  const applications = (apps.data ?? []).filter((a) => (!job || a.job_slug === job) && matches(qa, a.name, a.email, a.phone, a.message, a.job_slug));
  const s = useSubmit();
  const setStatus = (id: string, status: string) => s.run(async () => { await api(`/api/v1/jobs/${id}/status`, { method: "PUT", body: { status } }); reload(); });
  return (
    <>
      <div className="row between">
        <h1>{t("p.jobs")}</h1>
        <button className="btn" onClick={() => setOpen(true)}>+ {t("p.new_job")}</button>
      </div>
      {s.error && <div className="alert">{s.error}</div>}
      <ListTools q={q} setQ={setQ} shown={jobs.length} total={data?.length ?? 0} />
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        {!data ? <Loading error={error} /> : (
          <table>
            <thead><tr><th>Titel</th><th>{t("p.department")}</th><th>{t("p.location")}</th><th>{t("p.status")}</th><th className="n">{t("p.applications")}</th><th className="n">{t("p.actions")}</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td><a href={`/karriere/${j.slug}`} target="_blank" rel="noreferrer">{j.title[locale as Locale]}</a></td>
                  <td>{j.department_code}</td>
                  <td>{j.location} · {t(`emp.${j.employment_type}` as Key)}</td>
                  <td><Badge s={j.status} /></td>
                  <td className="n">{j.applications}</td>
                  <td className="n">
                    {j.status !== "published" && <button className="btn small" onClick={setStatus(j.id, "published")}>{t("p.publish")}</button>}{" "}
                    {j.status === "published" && <button className="btn small ghost" onClick={setStatus(j.id, "closed")}>{t("p.close")}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <h2>{t("p.applications")}</h2>
      <ListTools q={qa} setQ={setQa} shown={applications.length} total={apps.data?.length ?? 0}>
        <Filter label={t("p.jobs")} value={job} onChange={setJob} options={[...new Set((apps.data ?? []).map((a) => a.job_slug))].map((s) => [s, s])} />
      </ListTools>
      <div className="card" style={{ padding: 0 }}>
        {!apps.data ? <Loading error={apps.error} /> : apps.data.length === 0 ? <p className="spin">{t("p.empty")}</p> : applications.length === 0 ? <NoHits /> : (
          <table>
            <thead><tr><th>{t("p.date")}</th><th>{t("form.name")}</th><th>{t("p.email")}</th><th>{t("p.jobs")}</th><th>{t("form.message")}</th></tr></thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDate(a.created_at, locale)}</td><td>{a.name}</td>
                  <td><a href={`mailto:${a.email}`}>{a.email}</a>{a.phone && <div className="muted">{a.phone}</div>}</td>
                  <td>{a.job_slug}</td><td style={{ whiteSpace: "pre-line", maxWidth: 380 }}>{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && <NewJob depts={depts.data ?? []} onClose={() => { setOpen(false); reload(); }} />}
    </>
  );
}

function NewJob({ depts, onClose }: { depts: Dept[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const e = () => ({ de: "", en: "", ar: "" });
  const [title, setTitle] = useState<I18n>(e());
  const [summary, setSummary] = useState<I18n>(e());
  const [description, setDescription] = useState<I18n>(e());
  const [f, setF] = useState({ department_code: depts.some((d) => d.code === "DEV") ? "DEV" : depts[0]?.code ?? "DEV", slug: "", location: "", employment_type: "full_time", remote: false, publish: true });
  const s = useSubmit();
  return (
    <Modal title={t("p.new_job")} onClose={onClose}>
      <form onSubmit={s.run(() => api("/api/v1/jobs", { body: { ...f, title, summary, description } }).then(onClose))}>
        <I18nInput label="Titel / Title / العنوان" value={title} onChange={(v) => {
          setTitle(v);
          setF((o) => ({ ...o, slug: v.de.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
        }} />
        <I18nInput label={t("p.summary")} value={summary} onChange={setSummary} />
        <I18nInput label={t("p.description")} value={description} onChange={setDescription} area />
        <div className="grid2">
          <Field label={t("p.department")}>
            <select value={f.department_code} onChange={(ev) => setF({ ...f, department_code: ev.target.value })}>
              {depts.map((d) => <option key={d.code} value={d.code}>{d.name[locale as Locale]}</option>)}
            </select>
          </Field>
          <Field label={t("p.slug")}><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={f.slug} onChange={(ev) => setF({ ...f, slug: ev.target.value })} /></Field>
          <Field label={t("p.location")}><input value={f.location} onChange={(ev) => setF({ ...f, location: ev.target.value })} /></Field>
          <Field label={t("p.employment")}>
            <select value={f.employment_type} onChange={(ev) => setF({ ...f, employment_type: ev.target.value })}>
              {["full_time", "part_time", "internship", "freelance"].map((x) => <option key={x} value={x}>{t(`emp.${x}` as Key)}</option>)}
            </select>
          </Field>
        </div>
        <div className="row">
          <label className="row" style={{ gap: 4 }}><input type="checkbox" style={{ width: "auto" }} checked={f.remote} onChange={(ev) => setF({ ...f, remote: ev.target.checked })} /> Remote</label>
          <label className="row" style={{ gap: 4 }}><input type="checkbox" style={{ width: "auto" }} checked={f.publish} onChange={(ev) => setF({ ...f, publish: ev.target.checked })} /> {t("p.publish")}</label>
        </div>
        {s.error && <div className="alert">{s.error}</div>}
        <button className="btn" disabled={s.busy} style={{ marginTop: 12 }}>{t("p.create")}</button>
      </form>
    </Modal>
  );
}

// ── Kontaktanfragen ─────────────────────────────────────────────────────────
type Req = { id: string; name: string; email: string; phone: string | null; subject: string; message: string; product_sku: string | null; locale: string; status: string; created_at: string };

export function Requests() {
  const { t, locale } = useI18n();
  const { data, error } = useApi<Req[]>("/api/v1/contact-requests");
  const [q, setQ] = useState("");
  const [prod, setProd] = useState("");
  const rows = (data ?? []).filter((r) => (!prod || (r.product_sku ?? "-") === prod) && matches(q, r.name, r.email, r.phone, r.subject, r.message));
  return (
    <>
      <h1>{t("p.requests")}</h1>
      <ListTools q={q} setQ={setQ} shown={rows.length} total={data?.length ?? 0}>
        <Filter label={t("p.product")} value={prod} onChange={setProd} options={[...new Set((data ?? []).map((r) => r.product_sku ?? "-"))].map((s) => [s, s === "-" ? "–" : s])} />
      </ListTools>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : data.length === 0 ? <p className="spin">{t("p.empty")}</p> : rows.length === 0 ? <NoHits /> : (
          <table>
            <thead><tr><th>{t("p.date")}</th><th>{t("form.name")}</th><th>{t("form.subject")}</th><th>{t("p.product")}</th><th>{t("form.message")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.created_at, locale)}<div className="muted">{r.locale.toUpperCase()}</div></td>
                  <td>{r.name}<div><a href={`mailto:${r.email}?subject=${encodeURIComponent("Re: " + r.subject)}`}>{r.email}</a></div>{r.phone && <div className="muted">{r.phone}</div>}</td>
                  <td><b>{r.subject}</b></td>
                  <td>{r.product_sku ?? "–"}</td>
                  <td style={{ whiteSpace: "pre-line", maxWidth: 420 }}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Geräte ──────────────────────────────────────────────────────────────────
type Device = { id: string; kind: string; name: string; version: string | null; last_seen_at: string | null; online: boolean; organization_id: string | null; access_policy: "code" | "staff" };

export function Devices() {
  const { t, locale } = useI18n();
  const { data, error, reload } = useApi<Device[]>("/api/v1/devices");
  const products = useApi<Product[]>("/api/v1/products");
  const orgs = useApi<{ id: string; name: string }[]>("/api/v1/organizations");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "agent", name: "", product_id: "", organization_id: "" });
  const orgName = (id: string | null) => (id ? orgs.data?.find((o) => o.id === id)?.name ?? "…" : "KM Code Craft");
  const [token, setToken] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [owner, setOwner] = useState("");
  const rows = (data ?? []).filter((d) => (!state || (d.online ? "on" : "off") === state) && (!owner || (d.organization_id ?? "-") === owner)
    && matches(q, d.name, d.kind, d.version, orgName(d.organization_id)));
  const s = useSubmit();
  const matching = products.data?.filter((p) => p.device_kind === f.kind) ?? [];
  return (
    <>
      <div className="row between">
        <h1>{t("p.devices")}</h1>
        <button className="btn" onClick={() => { setOpen(true); setToken(null); }}>+ {t("p.register_device")}</button>
      </div>
      <div style={{ marginBottom: 16 }}><RedeemCode /></div>
      <ListTools q={q} setQ={setQ} shown={rows.length} total={data?.length ?? 0}>
        <Filter label={t("p.status")} value={state} onChange={setState} options={[["on", t("p.online")], ["off", t("p.offline")]]} />
        <Filter label={t("p.customer")} value={owner} onChange={setOwner} options={[["-", "KM Code Craft"], ...(orgs.data ?? []).filter((o) => data?.some((d) => d.organization_id === o.id)).map((o) => [o.id, o.name] as [string, string])]} />
      </ListTools>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : data.length === 0 ? <p className="spin">{t("p.empty")}</p> : rows.length === 0 ? <NoHits /> : (
          <table>
            <thead><tr><th>Name</th><th>{t("p.customer")}</th><th>{t("p.device")}</th><th>{t("p.version")}</th><th>{t("p.last_seen")}</th><th>{t("p.status")}</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}><td><a href={`/portal/geraete/${d.id}`} onClick={(e) => { e.preventDefault(); history.pushState({}, "", `/portal/geraete/${d.id}`); dispatchEvent(new PopStateEvent("popstate")); }}>{d.name}</a></td>
                  <td>{orgName(d.organization_id)}{d.organization_id && <span title="Zugriff" style={{ marginInlineStart: 6 }}>{d.access_policy === "code" ? "🔐" : "🔓"}</span>}</td>
                  <td>{d.kind}</td><td>{d.version ?? "–"}</td><td>{fmtDate(d.last_seen_at, locale)}</td>
                  <td><span className={`badge ${d.online ? "online" : "offline"}`}>{d.online ? t("p.online") : t("p.offline")}</span></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && (
        <Modal title={t("p.register_device")} onClose={() => setOpen(false)}>
          {token ? (
            <>
              <div className="alert ok">{t("p.token_once")}</div>
              <pre dir="ltr" style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{token}</pre>
              <button className="btn" onClick={() => navigator.clipboard?.writeText(token)}>Copy</button>
            </>
          ) : (
            <form onSubmit={s.run(async () => {
              const r = await api<{ token: string }>("/api/v1/devices", { body: { ...f, product_id: f.product_id || null, organization_id: f.organization_id || null } });
              setToken(r.token); setF({ kind: "agent", name: "", product_id: "", organization_id: "" }); reload();
            })}>
              <div className="grid2">
                <Field label="Name"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
                <Field label={t("p.customer")}>
                  <select value={f.organization_id} onChange={(e) => setF({ ...f, organization_id: e.target.value })}>
                    <option value="">KM Code Craft (intern)</option>
                    {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </Field>
                <Field label={t("p.device")}>
                  <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, product_id: "" })}>
                    {["agent", "esp32", "ai_appliance", "pos"].map((k) => <option key={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label={t("p.product")}>
                  <select value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
                    <option value="">—</option>
                    {matching.map((p) => <option key={p.id} value={p.id}>{p.name[locale as Locale]}</option>)}
                  </select>
                </Field>
              </div>
              {s.error && <div className="alert">{s.error}</div>}
              <button className="btn" disabled={s.busy}>{t("p.create")}</button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

// ── Benutzer ────────────────────────────────────────────────────────────────
type UserRow = { id: string; email: string; display_name: string; role: string; organization_id: string | null; is_active: boolean; two_factor: boolean; mailbox: string | null; departments: string[]; last_login_at: string | null; must_change_password: boolean;
  deactivated_at: string | null; deactivated_reason: string | null; removed_at: string | null; removed_email: string | null };
const stateOf = (u: UserRow) => (u.removed_at ? "removed" : u.is_active ? "active" : "locked");

export function Users() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const mustChange = useMustChangeLabel();
  const { data, error, reload } = useApi<UserRow[]>("/api/v1/users");
  const depts = useApi<Dept[]>("/api/v1/departments");
  const orgs = useApi<{ id: string; name: string }[]>("/api/v1/organizations");
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<UserRow | null>(null);
  const [lock, setLock] = useState<UserRow | null>(null);
  const [unlocked, setUnlocked] = useState<{ name: string; password: string } | null>(null);
  const [f, setF] = useState({ email: "", display_name: "", role: "staff", password: "", organization_id: "", departments: [] as string[] });
  const [view, setView] = useState<"staff" | "customers">("staff");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [dept, setDept] = useState("");
  const [org, setOrg] = useState("");
  const [active, setActive] = useState("active");
  const U = UT[locale];
  const staff = (data ?? []).filter((u) => u.role !== "customer" && u.role !== "device");
  const customers = (data ?? []).filter((u) => u.role === "customer");
  const base = view === "staff" ? staff : customers;
  const orgName = (id: string | null) => orgs.data?.find((o) => o.id === id)?.name ?? "–";
  const rows = base.filter((u) => (!active || stateOf(u) === active) && (view !== "staff" || ((!role || u.role === role) && (!dept || u.departments.includes(dept))))
    && (view !== "customers" || !org || u.organization_id === org)
    && matches(q, u.display_name, u.email, u.mailbox, u.role, ...u.departments, view === "customers" ? orgName(u.organization_id) : ""));
  const s = useSubmit();
  const twofa = (u: UserRow) => (u.two_factor ? "✅" : "—");
  const status = (u: UserRow) => (<>
    {u.must_change_password && u.is_active && <div className="muted" style={{ fontSize: ".8em" }}>⏳ {mustChange}</div>}
    {u.removed_at ? <span className="badge closed" style={{ marginInlineStart: 4 }} title={u.removed_email ?? ""}>{U.removed}</span>
      : !u.is_active && <span className="badge warn" style={{ marginInlineStart: 4 }} title={u.deactivated_reason ?? ""}><Icon name="lock" size={12} /> {U.locked}</span>}
    {!u.is_active && (u.deactivated_reason || u.deactivated_at) && <div className="muted" style={{ fontSize: ".78em" }}>{fmtDate(u.deactivated_at, locale)}{u.deactivated_reason && ` · ${u.deactivated_reason}`}</div>}
  </>);
  const actions = (u: UserRow, employee: boolean) => u.id === me?.id || u.removed_at ? null : u.is_active ? (
    <>
      {employee && <button className="btn small ghost" onClick={() => setAccess(u)}>{RT[locale].rights}</button>}
      <ResetPassword userId={u.id} />
      <button className="icon-btn sm danger" title={U.lock} onClick={() => setLock(u)}><Icon name="user-x" size={17} /></button>
    </>
  ) : (
    <>
      <button className="btn small ghost" onClick={() => api<{ password: string }>(`/api/v1/users/${u.id}/reactivate`, { method: "POST" }).then((r) => { setUnlocked({ name: u.display_name, password: r.password }); reload(); })}>
        <Icon name="unlock" size={15} /> {U.unlock}</button>
      <button className="icon-btn sm danger" title={U.remove} onClick={() => setLock(u)}><Icon name="trash" size={17} /></button>
    </>
  );
  return (
    <>
      <div className="row between">
        <h1>{t("p.users")}</h1>
        <button className="btn" onClick={() => { setF({ ...f, role: view === "customers" ? "customer" : "staff" }); setOpen(true); }}>
          + {view === "customers" ? U.newCustomer : U.newStaff}</button>
      </div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={view === "staff"} className={view === "staff" ? "on" : ""} onClick={() => { setView("staff"); setQ(""); }}>{U.staff} ({staff.length})</button>
        <button role="tab" aria-selected={view === "customers"} className={view === "customers" ? "on" : ""} onClick={() => { setView("customers"); setQ(""); }}>{U.customers} ({customers.length})</button>
      </div>
      <ListTools q={q} setQ={setQ} shown={rows.length} total={base.length}>
        <Filter label={t("p.status")} value={active} onChange={setActive} options={[["active", t("p.active")], ["locked", U.locked], ["removed", U.removed]]} />
        {view === "staff" ? <>
          <Filter label={t("p.role")} value={role} onChange={setRole} options={["admin", "lead", "manager", "staff", "trainee"].map((r) => [r, r])} />
          <Filter label={t("p.department")} value={dept} onChange={setDept} options={(depts.data ?? []).map((d) => [d.code, d.name[locale as Locale]])} />
        </> : (
          <Filter label={U.company} value={org} onChange={setOrg} options={(orgs.data ?? []).filter((o) => customers.some((u) => u.organization_id === o.id)).map((o) => [o.id, o.name])} />
        )}
      </ListTools>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : rows.length === 0 ? <NoHits /> : view === "staff" ? (
          <table>
            <thead><tr><th>Name</th><th>{t("p.email")}</th><th>{t("p.mailbox")}</th><th>{t("p.role")}</th><th>{t("p.department")}</th><th>2FA</th><th>{t("p.last_seen")}</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}><td>{u.display_name}{status(u)}</td><td>{u.email}</td><td>{u.mailbox ?? "–"}</td><td>{u.role}</td>
                  <td>{u.departments.join(", ") || <span className="badge warn">{U.noDept}</span>}</td>
                  <td>{twofa(u)}</td><td>{fmtDate(u.last_login_at, locale)}</td>
                  <td><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>{actions(u, true)}</div></td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>{t("p.email")}</th><th>{U.company}</th><th>2FA</th><th>{t("p.last_seen")}</th><th /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}><td>{u.display_name}{status(u)}</td><td>{u.email}</td><td>{orgName(u.organization_id)}</td>
                  <td>{twofa(u)}</td><td>{fmtDate(u.last_login_at, locale)}</td>
                  <td><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>{actions(u, false)}</div></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && (
        <Modal title={t("p.new_user")} onClose={() => setOpen(false)}>
          <form onSubmit={s.run(async () => {
            await api("/api/v1/users", { body: { ...f, organization_id: f.organization_id || null } });
            setOpen(false); reload();
          })}>
            <div className="grid2">
              <Field label="Name"><input required value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
              <Field label={t("p.email")}><input required type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label={t("p.password")}><input required minLength={10} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
              <Field label={t("p.role")}>
                <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                  {["admin", "lead", "manager", "staff", "trainee", "customer"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              {f.role === "customer" && (
                <Field label={t("p.customer")}>
                  <select required value={f.organization_id} onChange={(e) => setF({ ...f, organization_id: e.target.value })}>
                    <option value="">—</option>
                    {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
            {f.role !== "customer" && (
              <Field label={t("p.department")}>
                <div className="row">
                  {depts.data?.map((d) => (
                    <label key={d.code} className="row" style={{ gap: 4, margin: 0 }}>
                      <input type="checkbox" style={{ width: "auto" }} checked={f.departments.includes(d.code)}
                        onChange={(e) => setF({ ...f, departments: e.target.checked ? [...f.departments, d.code] : f.departments.filter((x) => x !== d.code) })} />
                      {d.name[locale as Locale]}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {s.error && <div className="alert">{s.error}</div>}
            <button className="btn" disabled={s.busy}>{t("p.create")}</button>
          </form>
        </Modal>
      )}
      {access && <AccessForm u={access} depts={depts.data ?? []} onClose={() => { setAccess(null); reload(); }} />}
      {lock && <LockDialog u={lock} staff={staff.filter((x) => x.is_active && x.id !== lock.id)} onClose={(changed) => { setLock(null); if (changed) reload(); }} />}
      {unlocked && (
        <Modal title={`${U.unlocked}: ${unlocked.name}`} onClose={() => setUnlocked(null)}>
          <p>{U.unlockedHint}</p>
          <code className="big-code" dir="ltr">{unlocked.password}</code>
        </Modal>
      )}
      <RoleHelp />
      <PaymentMethodsAdmin />
    </>
  );
}

const UT = {
  de: { staff: "Mitarbeiter", customers: "Kunden", company: "Firma", inactive: "deaktiviert", newStaff: "Mitarbeiter anlegen", newCustomer: "Kundenzugang anlegen", noDept: "keine Abteilung – sieht nichts",
    locked: "gesperrt", removed: "entfernt", lock: "Sperren / entfernen", unlock: "Entsperren", remove: "Endgültig entfernen", unlocked: "Entsperrt", unlockedHint: "Einmal-Passwort – nur jetzt sichtbar. Beim ersten Login muss ein eigenes Passwort gewählt werden." },
  en: { staff: "Employees", customers: "Customers", company: "Company", inactive: "disabled", newStaff: "Add employee", newCustomer: "Add customer login", noDept: "no department – sees nothing",
    locked: "locked", removed: "removed", lock: "Lock / remove", unlock: "Unlock", remove: "Remove permanently", unlocked: "Unlocked", unlockedHint: "One-time password – shown only now. A new password must be chosen at first sign-in." },
  ar: { staff: "الموظفون", customers: "العملاء", company: "الشركة", inactive: "معطّل", newStaff: "إضافة موظف", newCustomer: "إضافة دخول عميل", noDept: "بدون قسم – لا يرى شيئاً",
    locked: "موقوف", removed: "محذوف", lock: "إيقاف / إزالة", unlock: "إعادة التفعيل", remove: "إزالة نهائية", unlocked: "تمت إعادة التفعيل", unlockedHint: "كلمة مرور لمرة واحدة – تظهر الآن فقط. يجب اختيار كلمة مرور جديدة عند أول دخول." },
};

const LT = {
  de: { title: "Benutzer sperren oder entfernen", what: "Das passiert sofort", s1: "Alle Sitzungen, Schlüssel, App-Passwörter und Push-Geräte werden ungültig.",
    s2: "Offene Verbindungen (Portal, App, VS Code) werden getrennt, laufende Zeiterfassung beendet.", s3: "Belege, Tickets, Nachrichten und Verlauf bleiben erhalten.",
    reason: "Grund (intern, optional)", reasonPh: "z. B. Austritt zum 31.10., Vertragsende", handover: "Aufgaben übergeben an", none: "niemand – Tickets zurück in die Warteschlange",
    forward: "E-Mails an das Postfach der Übernahme-Person weiterleiten (mit Kopie)", remove: "Konto endgültig entfernen", removeHint: "E-Mail-Adresse wird frei, Konto verschwindet aus Listen, Abteilungen werden gelöst, kann nicht wieder freigeschaltet werden.",
    found: "Offen bei dieser Person", tickets: "Tickets", subs: "Vertretungen", events: "künftige Termine (als Organisator)", sessions: "aktive Sitzungen", devices: "Push-Geräte", rooms: "Gruppen-/Support-Räume", timer: "laufende Zeiterfassung",
    lockBtn: "Sperren", removeBtn: "Entfernen", cancel: "Abbrechen", confirm: (n: string) => `„${n}“ jetzt sperren?`, confirmRemove: (n: string) => `„${n}“ endgültig entfernen? Das kann nicht rückgängig gemacht werden.`,
    done: "Erledigt", moved: (t: number, s: number, e: number) => `${t} Tickets, ${s} Vertretungen, ${e} Termine übergeben.` },
  en: { title: "Lock or remove user", what: "What happens right away", s1: "All sessions, keys, app passwords and push devices become invalid.",
    s2: "Open connections (portal, app, VS Code) are cut, a running time entry is stopped.", s3: "Documents, tickets, messages and history are kept.",
    reason: "Reason (internal, optional)", reasonPh: "e.g. leaving on 31 Oct, contract ended", handover: "Hand tasks over to", none: "nobody – tickets go back to the queue",
    forward: "Forward emails to the mailbox of the person taking over (keep a copy)", remove: "Remove account permanently", removeHint: "Frees the email address, hides the account, removes departments, cannot be unlocked again.",
    found: "Open with this person", tickets: "Tickets", subs: "Substitutions", events: "upcoming events (organiser)", sessions: "active sessions", devices: "push devices", rooms: "group/support rooms", timer: "running time entry",
    lockBtn: "Lock", removeBtn: "Remove", cancel: "Cancel", confirm: (n: string) => `Lock “${n}” now?`, confirmRemove: (n: string) => `Remove “${n}” permanently? This cannot be undone.`,
    done: "Done", moved: (t: number, s: number, e: number) => `${t} tickets, ${s} substitutions, ${e} events handed over.` },
  ar: { title: "إيقاف أو إزالة مستخدم", what: "ما يحدث فوراً", s1: "تُلغى كل الجلسات والمفاتيح وكلمات مرور التطبيقات وأجهزة الإشعارات.",
    s2: "تُقطع الاتصالات المفتوحة (البوابة، التطبيق، VS Code) ويتوقف تسجيل الوقت الجاري.", s3: "تبقى المستندات والتذاكر والرسائل والسجل محفوظة.",
    reason: "السبب (داخلي، اختياري)", reasonPh: "مثلاً: ترك العمل في 31.10", handover: "نقل المهام إلى", none: "لا أحد – تعود التذاكر إلى قائمة الانتظار",
    forward: "تحويل البريد إلى صندوق الشخص المستلم (مع نسخة)", remove: "إزالة الحساب نهائياً", removeHint: "يُحرَّر عنوان البريد ويختفي الحساب من القوائم وتُزال الأقسام، ولا يمكن إعادة تفعيله.",
    found: "مفتوح لدى هذا الشخص", tickets: "تذاكر", subs: "إنابات", events: "مواعيد قادمة (كمنظّم)", sessions: "جلسات نشطة", devices: "أجهزة إشعارات", rooms: "غرف مجموعات/دعم", timer: "تسجيل وقت جارٍ",
    lockBtn: "إيقاف", removeBtn: "إزالة", cancel: "إلغاء", confirm: (n: string) => `إيقاف «${n}» الآن؟`, confirmRemove: (n: string) => `إزالة «${n}» نهائياً؟ لا يمكن التراجع.`,
    done: "تم", moved: (t: number, s: number, e: number) => `تم نقل ${t} تذاكر و${s} إنابات و${e} مواعيد.` },
};

type Handover = { tickets: number; substitute_for: number; leave_open: number; events: number; sessions: number; devices: number; rooms: number; mailbox: string | null; running_timer: number };

function LockDialog({ u, staff, onClose }: { u: UserRow; staff: UserRow[]; onClose: (changed: boolean) => void }) {
  const { locale } = useI18n();
  const L = LT[locale];
  const [info, setInfo] = useState<Handover | null>(null);
  const [reason, setReason] = useState("");
  const [to, setTo] = useState("");
  const [forward, setForward] = useState(false);
  const [remove, setRemove] = useState(!u.is_active);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => { api<Handover>(`/api/v1/users/${u.id}/handover`).then(setInfo).catch((e) => setErr(e.message)); }, [u.id]);
  const target = staff.find((s) => s.id === to);
  const submit = async () => {
    if (!confirm(remove ? L.confirmRemove(u.display_name) : L.confirm(u.display_name))) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ tickets: number; substitutes: number; events: number }>(`/api/v1/users/${u.id}/deactivate`, {
        body: { reason, handover_to: to || null, forward_mail: forward && !!to, remove },
      });
      setDone(L.moved(r.tickets, r.substitutes, r.events));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const facts: [string, number][] = info ? [[L.tickets, info.tickets], [L.subs, info.substitute_for], [L.events, info.events], [L.sessions, info.sessions], [L.devices, info.devices], [L.rooms, info.rooms], [L.timer, info.running_timer]] : [];
  return (
    <Modal title={`${L.title}: ${u.display_name}`} onClose={() => onClose(!!done)}>
      {done ? (
        <>
          <div className="alert ok">{L.done}. {done}</div>
          <button className="btn" onClick={() => onClose(true)}>OK</button>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {u.is_active && (
            <div className="lock-what">
              <b>{L.what}</b>
              <ul><li>{L.s1}</li><li>{L.s2}</li><li>{L.s3}</li></ul>
            </div>
          )}
          {info && (
            <div className="lock-facts">
              <b>{L.found}</b>
              <div className="chips">{facts.filter(([, n]) => n > 0).map(([k, n]) => <span key={k} className="chip on">{n} {k}</span>)}
                {info.mailbox && <span className="chip"><Icon name="mail" size={13} /> {info.mailbox}</span>}</div>
            </div>
          )}
          {u.is_active && <>
            <Field label={L.reason}><input maxLength={500} placeholder={L.reasonPh} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <Field label={L.handover}>
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">{L.none}</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name} · {s.departments.join(", ") || s.role}</option>)}
              </select>
            </Field>
            {info?.mailbox && to && target?.mailbox && (
              <label className="check-row"><input type="checkbox" checked={forward} onChange={(e) => setForward(e.target.checked)} /> {L.forward} → <span dir="ltr">{target.mailbox}</span></label>
            )}
          </>}
          <label className="check-row danger-row"><input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} /> <b>{L.remove}</b></label>
          {remove && <p className="muted" style={{ marginTop: 0 }}>{L.removeHint}</p>}
          {err && <div className="alert">{err}</div>}
          <div className="row">
            <button className="btn danger" disabled={busy || (!u.is_active && !remove)}><Icon name={remove ? "trash" : "lock"} size={16} /> {remove ? L.removeBtn : L.lockBtn}</button>
            <button type="button" className="btn ghost" onClick={() => onClose(false)}>{L.cancel}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const RT = {
  de: { rights: "Rechte", title: "Rolle & Abteilungen", save: "Speichern", help: "Wer sieht was?",
    rows: [["Buchhaltung (ACC)", "Rechnungen, Angebote, Verträge, Bestellungen, Kunden"], ["Vertrieb (SAL)", "Angebote, Verträge, Bestellungen, Kunden, Projekte, Produkte"],
      ["Support (SUP)", "Tickets, Geräte & Fernwartung, Kunden"], ["Entwicklung (DEV)", "Projekte, Entwicklungsanfragen, Tickets, Geräte"], ["Management (MGT)", "alles außer Benutzerverwaltung"],
      ["Rolle", "Praktikant: nur lesen · Mitarbeiter: anlegen, nicht ausstellen · Manager/Lead: ausstellen, Kunden ändern · Admin: alles"]] },
  en: { rights: "Rights", title: "Role & departments", save: "Save", help: "Who sees what?",
    rows: [["Accounting (ACC)", "Invoices, quotes, contracts, orders, customers"], ["Sales (SAL)", "Quotes, contracts, orders, customers, projects, products"],
      ["Support (SUP)", "Tickets, devices & remote access, customers"], ["Development (DEV)", "Projects, development requests, tickets, devices"], ["Management (MGT)", "everything except user admin"],
      ["Role", "Trainee: read only · Staff: create, not issue · Manager/Lead: issue, edit customers · Admin: everything"]] },
  ar: { rights: "الصلاحيات", title: "الدور والأقسام", save: "حفظ", help: "من يرى ماذا؟",
    rows: [["المحاسبة (ACC)", "الفواتير، العروض، العقود، الطلبات، العملاء"], ["المبيعات (SAL)", "العروض، العقود، الطلبات، العملاء، المشاريع، المنتجات"],
      ["الدعم (SUP)", "التذاكر، الأجهزة والوصول عن بُعد، العملاء"], ["التطوير (DEV)", "المشاريع، طلبات التطوير، التذاكر، الأجهزة"], ["الإدارة (MGT)", "كل شيء عدا إدارة المستخدمين"],
      ["الدور", "متدرب: قراءة فقط · موظف: إنشاء دون إصدار · مدير/قائد: إصدار وتعديل العملاء · المسؤول: كل شيء"]] },
};

function RoleHelp() {
  const { locale } = useI18n();
  const T = RT[locale];
  return (
    <details className="card" style={{ marginTop: 16 }}>
      <summary><b>{T.help}</b></summary>
      <table style={{ marginTop: 8 }}><tbody>{T.rows.map(([a, b]) => <tr key={a}><td><b>{a}</b></td><td>{b}</td></tr>)}</tbody></table>
    </details>
  );
}

function AccessForm({ u, depts, onClose }: { u: UserRow; depts: Dept[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const T = RT[locale];
  const [role, setRole] = useState(u.role);
  const [sel, setSel] = useState<string[]>(u.departments);
  const s = useSubmit();
  return (
    <Modal title={`${T.title} – ${u.display_name}`} onClose={onClose}>
      <form onSubmit={s.run(async () => { await api(`/api/v1/users/${u.id}/access`, { method: "PUT", body: { role, departments: sel } }); onClose(); })}>
        <Field label={t("p.role")}>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {["admin", "lead", "manager", "staff", "trainee"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={t("p.department")}>
          <div className="row">
            {depts.map((d) => (
              <label key={d.code} className="row" style={{ gap: 4, margin: 0 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={sel.includes(d.code)}
                  onChange={(e) => setSel(e.target.checked ? [...sel, d.code] : sel.filter((x) => x !== d.code))} />
                {d.name[locale as Locale]}
              </label>
            ))}
          </div>
        </Field>
        {s.error && <div className="alert">{s.error}</div>}
        <button className="btn" disabled={s.busy}>{T.save}</button>
      </form>
    </Modal>
  );
}
