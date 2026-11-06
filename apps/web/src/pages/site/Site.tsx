import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useParams, useSearchParams } from "react-router-dom";
import { api, useApi } from "../../api";
import { money, useI18n, type Key } from "../../i18n";
import { Field, LangSwitch, Loading, useSubmit } from "../../ui";

type Price = { id: string; code: string; name: string; billing: string; amount_cents: number | null; currency: string; features: string[] };
type Product = { id: string; sku: string; slug: string; kind: string; department: string; name: string; description: string; prices: Price[] };
type Dept = { id: string; code: string; name: string; color: string; icon: string };
type Catalog = { products: Product[]; departments: Dept[] };
type Job = {
  slug: string; department: string; department_name: string; title: string; summary: string; description: string;
  location: string; employment_type: string; remote: boolean;
};

const useCatalog = () => {
  const { locale } = useI18n();
  return useApi<Catalog>(`/api/v1/public/catalog?locale=${locale}`, [locale]);
};

export function SiteLayout() {
  const { t } = useI18n();
  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="logo">
            <span>KM</span> Code Craft
          </Link>
          <nav className="nav">
            <NavLink to="/" end>{t("nav.home")}</NavLink>
            <NavLink to="/produkte">{t("nav.products")}</NavLink>
            <NavLink to="/karriere">{t("nav.careers")}</NavLink>
            <NavLink to="/kontakt">{t("nav.contact")}</NavLink>
          </nav>
          <LangSwitch />
          <Link to="/portal" className="btn small">{t("nav.portal")}</Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container row between">
          <span>© {new Date().getFullYear()} KM Code Craft · Mohamad Anas Kara Mohamad · {t("footer.rights")}</span>
          <a href="mailto:ak@code-craft.tech">ak@code-craft.tech</a>
        </div>
      </footer>
    </>
  );
}

function PriceLine({ p }: { p: Price }) {
  const { t, locale } = useI18n();
  if (p.amount_cents == null) return <div className="price">{t("billing.on_request")}</div>;
  return (
    <div className="price">
      {p.amount_cents === 0 ? "0 €" : money(p.amount_cents, locale, p.currency)}{" "}
      <small>{t(`billing.${p.billing}` as Key)}</small>
    </div>
  );
}

function ProductCard({ p }: { p: Product }) {
  const { t } = useI18n();
  const [sel, setSel] = useState(0);
  const price = p.prices[sel];
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row between">
        <span className="badge">{t(`kind.${p.kind}` as Key)}</span>
        <span className="muted" style={{ fontSize: ".8em" }}>{p.sku}</span>
      </div>
      <h3 style={{ margin: 0 }}>{p.name}</h3>
      <p className="muted" style={{ margin: 0 }}>{p.description}</p>
      {p.prices.length > 1 && (
        <div className="tabs" style={{ marginBottom: 0 }}>
          {p.prices.map((x, i) => (
            <button key={x.id} className={i === sel ? "on" : ""} onClick={() => setSel(i)}>
              {x.name}
            </button>
          ))}
        </div>
      )}
      {price && <PriceLine p={price} />}
      {price && price.features.length > 0 && (
        <ul className="feat">
          {price.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <Link className="btn small" to={`/kontakt?produkt=${p.id}`}>{t("products.request")}</Link>
      </div>
    </div>
  );
}

export function Home() {
  const { t } = useI18n();
  const { data } = useCatalog();
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>{t("home.title")}</h1>
          <p>{t("home.sub")}</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link className="btn" to="/produkte">{t("home.cta")}</Link>
            <Link className="btn ghost" to="/kontakt">{t("home.contact")}</Link>
          </div>
        </div>
      </section>
      <section className="section container">
        <h2>{t("home.departments")}</h2>
        <div className="grid">
          {data?.departments.filter((d) => data.products.some((p) => p.department === d.code)).map((d) => (
            <div key={d.code} className="card dept" style={{ ["--c" as any]: d.color }}>
              <h3>{d.name}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {data.products.filter((p) => p.department === d.code).map((p) => p.name).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="section container" style={{ paddingTop: 0 }}>
        <h2>{t("home.featured")}</h2>
        <div className="grid">{data?.products.slice(0, 3).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>
    </>
  );
}

export function Products() {
  const { t } = useI18n();
  const { data, error, loading } = useCatalog();
  const [kind, setKind] = useState<string>("all");
  const kinds = useMemo(() => [...new Set(data?.products.map((p) => p.kind) ?? [])], [data]);
  return (
    <section className="section container">
      <h1>{t("products.title")}</h1>
      <p className="muted">{t("products.sub")}</p>
      <div className="tabs">
        <button className={kind === "all" ? "on" : ""} onClick={() => setKind("all")}>{t("products.all")}</button>
        {kinds.map((k) => (
          <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{t(`kind.${k}` as Key)}</button>
        ))}
      </div>
      {loading && !data ? <Loading error={error} /> : (
        <div className="grid">
          {data?.products.filter((p) => kind === "all" || p.kind === kind).map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );
}

export function Careers() {
  const { t, locale } = useI18n();
  const { data, error, loading } = useApi<Job[]>(`/api/v1/public/jobs?locale=${locale}`, [locale]);
  return (
    <section className="section container">
      <h1>{t("careers.title")}</h1>
      <p className="muted">{t("careers.sub")}</p>
      {loading && !data ? <Loading error={error} /> : data?.length === 0 ? <p>{t("careers.none")}</p> : (
        <div className="grid">
          {data?.map((j) => (
            <Link key={j.slug} to={`/karriere/${j.slug}`} className="card" style={{ color: "inherit", textDecoration: "none" }}>
              <span className="badge">{j.department_name}</span>
              <h3 style={{ marginTop: 10 }}>{j.title}</h3>
              <p className="muted">{j.summary}</p>
              <div className="row muted" style={{ fontSize: ".9em" }}>
                <span>📍 {j.location}</span>
                <span>{t(`emp.${j.employment_type}` as Key)}</span>
                {j.remote && <span>🏠 {t("careers.remote")}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function JobDetail() {
  const { slug } = useParams();
  const { t, locale } = useI18n();
  const { data: job, error, loading } = useApi<Job>(`/api/v1/public/jobs/${slug}?locale=${locale}`, [locale, slug]);
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const s = useSubmit();
  if (loading && !job) return <div className="container section"><Loading error={error} /></div>;
  if (!job) return null;
  return (
    <section className="section container" style={{ maxWidth: 820 }}>
      <Link to="/karriere">← {t("careers.back")}</Link>
      <h1 style={{ marginTop: 12 }}>{job.title}</h1>
      <div className="row muted">
        <span className="badge">{job.department_name}</span>
        <span>📍 {job.location}</span>
        <span>{t(`emp.${job.employment_type}` as Key)}</span>
        {job.remote && <span>🏠 {t("careers.remote")}</span>}
      </div>
      <p style={{ whiteSpace: "pre-line", fontSize: "1.05em" }}>{job.description}</p>
      <div className="card" id="apply">
        <h2>{t("careers.apply")}</h2>
        {s.done ? <div className="alert ok">{t("form.sent")}</div> : (
          <form onSubmit={s.run(() => api(`/api/v1/public/jobs/${slug}/apply`, { body: { ...f, locale } }))}>
            <input type="text" name="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })}
              style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
            <div className="grid2">
              <Field label={t("form.name")}><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label={t("form.email")}><input required type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            </div>
            <Field label={t("form.phone")}><input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label={t("form.message")}><textarea rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            {s.error && <div className="alert">{t("form.error")}</div>}
            <button className="btn" disabled={s.busy}>{t("form.send")}</button>
          </form>
        )}
      </div>
    </section>
  );
}

export function Contact() {
  const { t, locale } = useI18n();
  const [params] = useSearchParams();
  const { data } = useCatalog();
  const [f, setF] = useState({
    name: "", email: "", phone: "", subject: "", message: "", product_id: params.get("produkt") ?? "", website: "",
  });
  const s = useSubmit();
  const submit = () => api("/api/v1/public/contact", { body: { ...f, product_id: f.product_id || null, locale } });
  return (
    <section className="section container" style={{ maxWidth: 760 }}>
      <h1>{t("contact.title")}</h1>
      <p className="muted">{t("contact.sub")}</p>
      <div className="card">
        {s.done ? <div className="alert ok">{t("form.sent")}</div> : (
          <form onSubmit={s.run(submit)}>
            <input type="text" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })}
              style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
            <div className="grid2">
              <Field label={t("form.name")}><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label={t("form.email")}><input required type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            </div>
            <div className="grid2">
              <Field label={t("form.phone")}><input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label={t("form.product")}>
                <select value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
                  <option value="">—</option>
                  {data?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("form.subject")}><input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
            <Field label={t("form.message")}><textarea required rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            {s.error && <div className="alert">{t("form.error")}</div>}
            <button className="btn" disabled={s.busy}>{t("form.send")}</button>
          </form>
        )}
      </div>
    </section>
  );
}
