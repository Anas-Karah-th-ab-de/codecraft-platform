import { useState } from "react";
import { api, can, useApi, useAuth } from "../../api";
import { fmtDate, useI18n, type Key, type Locale } from "../../i18n";
import { Badge, Field, Loading, Modal, useSubmit } from "../../ui";
import { I18nInput } from "./Products";
import type { Product } from "./Invoices";
import { RedeemCode, ResetPassword, useMustChangeLabel } from "./Access";

type I18n = { de: string; en: string; ar: string };
type Dept = { code: string; name: I18n };

// ── Kunden ──────────────────────────────────────────────────────────────────
type Org = { id: string; name: string; address: string; vat_id: string | null; email: string | null; locale: string; sla: "basic" | "business" | "premium" };

export function Customers() {
  const { t } = useI18n();
  const { me } = useAuth();
  const { data, error, reload } = useApi<Org[]>("/api/v1/organizations");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", address: "", vat_id: "", email: "", locale: "de" });
  const [q, setQ] = useState("");
  const s = useSubmit();
  return (
    <>
      <div className="row between">
        <h1>{t("p.customers")}</h1>
        {can(me, "invoice_issue") && <button className="btn" onClick={() => setOpen(true)}>+ {t("p.new")}</button>}
      </div>
      <input placeholder={t("p.search")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, marginBottom: 12 }} />
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : data.length === 0 ? <p className="spin">{t("p.empty")}</p> : (
          <table>
            <thead><tr><th>{t("p.customer")}</th><th>{t("p.address")}</th><th>{t("p.vat_id")}</th><th>{t("p.email")}</th><th>{t("p.language")}</th><th>SLA</th></tr></thead>
            <tbody>
              {data.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase())).map((o) => (
                <tr key={o.id}><td><b>{o.name}</b></td><td style={{ whiteSpace: "pre-line" }}>{o.address}</td><td>{o.vat_id ?? "–"}</td><td>{o.email ?? "–"}</td><td>{o.locale.toUpperCase()}</td>
                  <td>{me && ["admin", "lead"].includes(me.role) ? (
                    <select value={o.sla} onChange={(e) => api(`/api/v1/organizations/${o.id}/sla`, { method: "PUT", body: { sla: e.target.value } }).then(reload)}>
                      <option value="basic">Basis</option><option value="business">Business</option><option value="premium">Premium</option>
                    </select>
                  ) : o.sla}</td></tr>
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
  const s = useSubmit();
  const setStatus = (id: string, status: string) => s.run(async () => { await api(`/api/v1/jobs/${id}/status`, { method: "PUT", body: { status } }); reload(); });
  return (
    <>
      <div className="row between">
        <h1>{t("p.jobs")}</h1>
        <button className="btn" onClick={() => setOpen(true)}>+ {t("p.new_job")}</button>
      </div>
      {s.error && <div className="alert">{s.error}</div>}
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        {!data ? <Loading error={error} /> : (
          <table>
            <thead><tr><th>Titel</th><th>{t("p.department")}</th><th>{t("p.location")}</th><th>{t("p.status")}</th><th className="n">{t("p.applications")}</th><th className="n">{t("p.actions")}</th></tr></thead>
            <tbody>
              {data.map((j) => (
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
      <div className="card" style={{ padding: 0 }}>
        {!apps.data ? <Loading error={apps.error} /> : apps.data.length === 0 ? <p className="spin">{t("p.empty")}</p> : (
          <table>
            <thead><tr><th>{t("p.date")}</th><th>{t("form.name")}</th><th>{t("p.email")}</th><th>{t("p.jobs")}</th><th>{t("form.message")}</th></tr></thead>
            <tbody>
              {apps.data.map((a) => (
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
  return (
    <>
      <h1>{t("p.requests")}</h1>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : data.length === 0 ? <p className="spin">{t("p.empty")}</p> : (
          <table>
            <thead><tr><th>{t("p.date")}</th><th>{t("form.name")}</th><th>{t("form.subject")}</th><th>{t("p.product")}</th><th>{t("form.message")}</th></tr></thead>
            <tbody>
              {data.map((r) => (
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
  const s = useSubmit();
  const matching = products.data?.filter((p) => p.device_kind === f.kind) ?? [];
  return (
    <>
      <div className="row between">
        <h1>{t("p.devices")}</h1>
        <button className="btn" onClick={() => { setOpen(true); setToken(null); }}>+ {t("p.register_device")}</button>
      </div>
      <div style={{ marginBottom: 16 }}><RedeemCode /></div>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : data.length === 0 ? <p className="spin">{t("p.empty")}</p> : (
          <table>
            <thead><tr><th>Name</th><th>{t("p.customer")}</th><th>{t("p.device")}</th><th>{t("p.version")}</th><th>{t("p.last_seen")}</th><th>{t("p.status")}</th></tr></thead>
            <tbody>
              {data.map((d) => (
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
type UserRow = { id: string; email: string; display_name: string; role: string; is_active: boolean; two_factor: boolean; mailbox: string | null; departments: string[]; last_login_at: string | null; must_change_password: boolean };

export function Users() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const mustChange = useMustChangeLabel();
  const { data, error, reload } = useApi<UserRow[]>("/api/v1/users");
  const depts = useApi<Dept[]>("/api/v1/departments");
  const orgs = useApi<{ id: string; name: string }[]>("/api/v1/organizations");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", display_name: "", role: "staff", password: "", organization_id: "", departments: [] as string[] });
  const s = useSubmit();
  return (
    <>
      <div className="row between">
        <h1>{t("p.users")}</h1>
        <button className="btn" onClick={() => setOpen(true)}>+ {t("p.new_user")}</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {!data ? <Loading error={error} /> : (
          <table>
            <thead><tr><th>Name</th><th>{t("p.email")}</th><th>{t("p.mailbox")}</th><th>{t("p.role")}</th><th>{t("p.department")}</th><th>2FA</th><th>{t("p.last_seen")}</th><th /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}><td>{u.display_name}{u.must_change_password && <div className="muted" style={{ fontSize: ".8em" }}>⏳ {mustChange}</div>}</td><td>{u.email}</td><td>{u.mailbox ?? "–"}</td><td>{u.role}</td><td>{u.departments.join(", ") || "–"}</td>
                  <td>{u.two_factor ? "✅" : "—"}</td><td>{fmtDate(u.last_login_at, locale)}</td>
                  <td>{u.id !== me?.id && <ResetPassword userId={u.id} />}</td></tr>
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
    </>
  );
}
