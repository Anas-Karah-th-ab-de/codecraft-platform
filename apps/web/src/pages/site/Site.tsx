import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link, NavLink, Outlet, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api, prefetch, useApi } from "../../api";
import { money, useI18n, type Key, type Locale } from "../../i18n";
import { Field, LangSwitch, useSubmit } from "../../ui";
import { TEASER } from "./productText";
import { ADDRESS, CONTACT, HOME, ourMapUrl } from "./homeText";
import { BrokenTrace } from "./Board";
import { CATALOG_IMG, FOOT, SHOWCASE } from "./showcaseText";

type Price = { id: string; code: string; name: string; billing: string; amount_cents: number | null; currency: string; features: string[] };
type Img = { id: string; card: string; full: string; width: number; height: number };
export type Product = {
  id: string; sku: string; slug: string; kind: string; department: string; name: string; description: string;
  prices: Price[]; images: Img[];
};
type Dept = { id: string; code: string; name: string; color: string; icon: string };
type Catalog = { products: Product[]; departments: Dept[] };
type Job = {
  slug: string; department: string; department_name: string; title: string; summary: string; description: string;
  location: string; employment_type: string; remote: boolean;
};

const catalogPath = (l: Locale) => `/api/v1/public/catalog?locale=${l}`;

const useCatalog = () => {
  const { locale } = useI18n();
  return useApi<Catalog>(catalogPath(locale), [locale]);
};

/** Seitentitel setzen (Tab, Verlauf, Lesezeichen) */
function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · KM Code Craft` : "KM Code Craft";
  }, [title]);
}

/** Bei Seitenwechsel nach oben springen – außer bei Zurück/Vor (Browser stellt Position wieder her) */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // Sprungmarken (/#kasse) scrollt die Startseite selbst
    if (!hash) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Kopfzeile: Lesefortschritt als Leiterbahn (--sp 0…1) und schmalere Leiste nach dem Scrollen */
function useHeaderScroll(ref: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.setProperty("--sp", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
      el.classList.toggle("scrolled", window.scrollY > 24);
      document.body.classList.toggle("past-hero", window.scrollY > window.innerHeight * 0.8);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [ref, key]);
}

export function SiteLayout() {
  const { t, locale } = useI18n();
  const H = HOME[locale];
  const [menu, setMenu] = useState(false);
  const { pathname, hash } = useLocation();
  const head = useRef<HTMLElement>(null);
  const F = FOOT[locale];
  useHeaderScroll(head, pathname);
  useEffect(() => setMenu(false), [pathname, hash]);
  // Offenes Menü auf dem Handy: Seite dahinter steht still, Escape schließt
  useEffect(() => {
    document.body.classList.toggle("menu-open", menu);
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.classList.remove("menu-open"); };
  }, [menu]);
  useEffect(() => prefetch(catalogPath(locale)), [locale]); // Katalog früh laden → Produktseite sofort da
  const skip = locale === "ar" ? "انتقل إلى المحتوى" : locale === "en" ? "Skip to content" : "Zum Inhalt";
  return (
    <div className="site">
      <ScrollToTop />
      <a href="#inhalt" className="skip">{skip}</a>
      <header className="site-header" ref={head}>
        <div className="container">
          <Link to="/" className="logo" aria-label="KM Code Craft"><img src="/brand/logo.png" alt="KM Code Craft" width="95" height="40" /></Link>
          <nav id="hauptmenue" className={`nav ${menu ? "open" : ""}`} aria-label={t("nav.products")}>
            <NavLink to="/produkte">{t("nav.products")}</NavLink>
            <NavLink to="/km-one">{H.nav.phone}</NavLink>
            <Link to="/#leistungen">{H.nav.services}</Link>
            <NavLink to="/kasse">{H.nav.till}</NavLink>
            <NavLink to="/ki-server">{H.nav.ai}</NavLink>
            <NavLink to="/e-health">{H.nav.health}</NavLink>
            <NavLink to="/karriere" onMouseEnter={() => prefetch(`/api/v1/public/jobs?locale=${locale}`)}>{t("nav.careers")}</NavLink>
            <NavLink to="/kontakt">{t("nav.contact")}</NavLink>
            <Link to="/portal" className="portal-link"><i aria-hidden="true" />{t("nav.portal")}</Link>
            <a className="nav-wa" href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp <bdi dir="ltr">{CONTACT.whatsapp}</bdi></a>
          </nav>
          <div className="head-actions">
            <LangSwitch />
            <Link to="/portal" className="portal-link hide-sm"><i aria-hidden="true" />{t("nav.portal")}</Link>
            <button className="burger" aria-label="Menü" aria-controls="hauptmenue" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>
      <main id="inhalt" className="fade" key={pathname}>
        <Outlet />
      </main>
      {pathname !== "/kontakt" && (
        <a className="fab-wa" href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${CONTACT.whatsapp}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /></svg>
          <span>{locale === "ar" ? "راسلنا" : locale === "en" ? "Message us" : "Schreiben Sie uns"}</span>
        </a>
      )}
      <footer className="site-footer">
        {/* Oben: der direkte Weg zu uns */}
        <div className="container foot-cta">
          <p className="foot-cta-h">{F.cta}</p>
          <div className="foot-cta-btns">
            <a className="foot-btn gold" href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp <bdi dir="ltr">{CONTACT.whatsapp}</bdi></a>
            <a className="foot-btn" href={`mailto:${CONTACT.email}`}><bdi dir="ltr">{CONTACT.email}</bdi></a>
          </div>
        </div>
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link to="/" className="logo"><img src="/brand/logo.png" alt="KM Code Craft" width="95" height="40" loading="lazy" /></Link>
            <p>{H.foot.about}</p>
            <a className="foot-addr" href={CONTACT.googleMaps} target="_blank" rel="noopener noreferrer">{ADDRESS[locale].split("\n").slice(1).join("\n")}</a>
            <p className="foot-hours">{H.contact.hoursV}</p>
          </div>
          <nav aria-label={F.products}>
            <b>{F.products}</b>
            {SHOWCASE[locale].items.map((s) => <Link key={s.key} to={s.to}>{s.name}</Link>)}
            <Link to="/produkte" className="foot-all">{SHOWCASE[locale].all}</Link>
          </nav>
          <nav aria-label={H.foot.company}>
            <b>{H.foot.company}</b>
            <Link to="/#leistungen">{H.nav.services}</Link>
            <Link to="/#geschichte">{H.nav.story}</Link>
            <Link to="/#besuch">{F.visit}</Link>
            <Link to="/karriere">{t("nav.careers")}</Link>
            <Link to="/portal">{F.portal}</Link>
          </nav>
          <nav aria-label={H.foot.reach}>
            <b>{H.foot.reach}</b>
            <Link to="/kontakt">{F.form}</Link>
            <Link to="/kontakt?betreff=beratung">{H.contact.meetingV}</Link>
            <a href={CONTACT.googleMaps} target="_blank" rel="noopener noreferrer">Google Maps</a>
            <a href={ourMapUrl(locale)} target="_blank" rel="noopener">Maps Syria</a>
            <a href="https://linkedin.com/company/code-craft-tech" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </nav>
        </div>
        <div className="container footer-base">
          <span>© {new Date().getFullYear()} <bdi>KM Code Craft</bdi> · {F.owner}. {t("footer.rights")}</span>
          <span>{t("footer.made")}</span>
        </div>
      </footer>
    </div>
  );
}

/** 404 innerhalb der Webseite */
export function NotFound() {
  const { locale } = useI18n();
  const T = HOME[locale].nf;
  useTitle("404");
  // Eine Datei (z. B. Demo-Seite) wurde über die Anwendung statt vom Server geöffnet → einmal echt laden
  useEffect(() => {
    const { pathname, href } = window.location;
    if (!/\.[a-z0-9]{2,5}$/i.test(pathname)) return;
    try {
      if (sessionStorage.getItem("nf-reload") === href) return;
      sessionStorage.setItem("nf-reload", href);
    } catch { return; }
    window.location.replace(href);
  }, []);
  return (
    <section className="notfound">
      <div>
        <BrokenTrace />
        <h1>{T.h}</h1>
        <p>{T.p}</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
          <Link className="btn primary" to="/">{T.home}</Link>
          <Link className="btn ghost" to="/kontakt">{T.contact}</Link>
        </div>
      </div>
    </section>
  );
}

// ── Bausteine ───────────────────────────────────────────────────────────────


/** Produktbild mit festem Seitenverhältnis (keine Layout-Sprünge), Lazy-Loading, sonst gestalteter Platzhalter */
function ProductImage({ p, img, size = "card", eager }: { p: Product; img?: Img; size?: "card" | "full"; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const i = img ?? p.images[0];
  const shot = CATALOG_IMG[p.slug];
  if (!i && shot) {
    return (
      <div className={`pimg shot ${loaded ? "loaded" : ""}`}>
        <img src={shot} alt={p.name} loading={eager ? "eager" : "lazy"} decoding="async" onLoad={() => setLoaded(true)} />
      </div>
    );
  }
  if (!i) {
    return (
      <div className={`pimg ph k-${p.kind}`} aria-hidden>
        <span className="ph-kind">{p.sku}</span>
      </div>
    );
  }
  return (
    <div className={`pimg ${loaded ? "loaded" : ""}`}>
      <img
        src={size === "card" ? i.card : i.full}
        alt={p.name}
        width={i.width}
        height={i.height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function PriceTag({ p }: { p: Price }) {
  const { t, locale } = useI18n();
  if (p.amount_cents == null) return <span className="price ask">{t("billing.on_request")}</span>;
  return (
    <span className={`price ${p.amount_cents === 0 ? "ask" : ""}`}>
      {p.amount_cents === 0 ? (locale === "ar" ? "مجاناً" : locale === "en" ? "Free" : "Kostenlos") : money(p.amount_cents, locale, p.currency)}{" "}
      {p.amount_cents > 0 && <small>{t(`billing.${p.billing}` as Key)}</small>}
    </span>
  );
}

/** „ab“-Preis: günstigster Preis mit Betrag */
function FromPrice({ prices }: { prices: Price[] }) {
  const { locale } = useI18n();
  const withAmount = prices.filter((x) => x.amount_cents != null);
  if (withAmount.length === 0) return prices[0] ? <PriceTag p={prices[0]} /> : null;
  const min = withAmount.reduce((a, b) => (b.amount_cents! < a.amount_cents! ? b : a));
  const from = prices.length > 1 && min.amount_cents! > 0 ? (locale === "ar" ? "ابتداءً من " : locale === "en" ? "from " : "ab ") : "";
  return <span className="from">{from}<PriceTag p={min} /></span>;
}

function ProductCard({ p }: { p: Product }) {
  const { t, locale } = useI18n();
  const detail = `/api/v1/public/products/${p.slug}?locale=${locale}`;
  return (
    <Link to={`/produkte/${p.slug}`} className="card pcard" onMouseEnter={() => prefetch(detail)} onFocus={() => prefetch(detail)}>
      <ProductImage p={p} />
      <div className="pcard-body">
        <span className="badge">{t(`kind.${p.kind}` as Key)}</span>
        <h3>{p.name}</h3>
        <p className="muted clamp">{p.description}</p>
        <div className="pcard-foot">
          <FromPrice prices={p.prices} />
          <span className="arrow" aria-hidden>→</span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonGrid({ n = 6 }: { n?: number }) {
  return (
    <div className="grid" aria-busy="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card pcard">
          <div className="pimg sk" />
          <div className="pcard-body">
            <div className="sk line" style={{ width: "30%" }} />
            <div className="sk line" style={{ width: "70%", height: 18 }} />
            <div className="sk line" />
            <div className="sk line" style={{ width: "50%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Seiten ──────────────────────────────────────────────────────────────────

export function Products() {
  const { t } = useI18n();
  const { data, error } = useCatalog();
  // Filter stehen in der URL → Zurück-Taste und geteilte Links behalten die Auswahl
  const [params, setParams] = useSearchParams();
  const kind = params.get("art") ?? "";
  const dept = params.get("bereich") ?? "";
  const q = params.get("q") ?? "";
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };
  useTitle(t("products.title"));
  const kinds = useMemo(() => [...new Set(data?.products.map((p) => p.kind) ?? [])], [data]);
  // Eigene Software zuerst, dann Miete, dann Dienstleistungen
  const order: Record<string, number> = { software: 0, rental: 1, service: 2 };
  const list = [...(data?.products ?? [])].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9)).filter(
    (p) =>
      (!kind || p.kind === kind) &&
      (!dept || p.department === dept) &&
      (!q || `${p.name} ${p.description} ${p.sku}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <section className="section container">
      <h1>{t("products.title")}</h1>
      <p className="muted">{t("products.sub")}</p>
      <div className="filters">
        <input type="search" placeholder={t("p.search")} value={q} onChange={(e) => set("q", e.target.value)} aria-label={t("p.search")} />
        <div className="tabs" role="tablist">
          <button className={!kind ? "on" : ""} onClick={() => set("art", "")}>{t("products.all")}</button>
          {kinds.map((k) => (
            <button key={k} className={kind === k ? "on" : ""} onClick={() => set("art", k)}>{t(`kind.${k}` as Key)}</button>
          ))}
        </div>
        {dept && (
          <button className="chip" onClick={() => set("bereich", "")}>
            {data?.departments.find((d) => d.code === dept)?.name ?? dept} ✕
          </button>
        )}
      </div>
      {error ? <div className="alert">{error}</div> : !data ? <SkeletonGrid /> : list.length === 0 ? (
        <div className="empty">🔍 {t("p.empty")}</div>
      ) : (
        <div className="grid pgrid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </section>
  );
}

export function ProductDetail() {
  const { slug } = useParams();
  const { t, locale } = useI18n();
  const { data: p, error } = useApi<Product>(`/api/v1/public/products/${slug}?locale=${locale}`, [slug, locale]);
  const cat = useCatalog();
  const [imgIdx, setImgIdx] = useState(0);
  const [priceIdx, setPriceIdx] = useState(0);
  useEffect(() => { setImgIdx(0); setPriceIdx(0); }, [slug]);
  useTitle(p?.name);
  if (error) return <div className="container section"><div className="alert">{error}</div><Link to="/produkte">← {t("products.all")}</Link></div>;
  if (!p) return <div className="container section"><div className="detail"><div className="pimg sk" /><div><div className="sk line" style={{ height: 28, width: "60%" }} /><div className="sk line" /><div className="sk line" /></div></div></div>;
  const price = p.prices[priceIdx];
  const related = cat.data?.products.filter((x) => x.department === p.department && x.id !== p.id).slice(0, 3) ?? [];
  const dept = cat.data?.departments.find((d) => d.code === p.department);
  return (
    <section className="section container">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/produkte">{t("nav.products")}</Link> <span>›</span>
        {dept && <><Link to={`/produkte?bereich=${dept.code}`}>{dept.name}</Link> <span>›</span></>}
        <span>{p.name}</span>
      </nav>
      <div className="detail">
        <div>
          <ProductImage p={p} img={p.images[imgIdx]} size="full" eager />
          {p.images.length > 1 && (
            <div className="thumbs">
              {p.images.map((im, i) => (
                <button key={im.id} className={i === imgIdx ? "on" : ""} onClick={() => setImgIdx(i)} aria-label={`${i + 1}`}>
                  <img src={im.card} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="badge">{t(`kind.${p.kind}` as Key)}</span>
          <h1 style={{ margin: "10px 0" }}>{p.name}</h1>
          <p style={{ fontSize: "1.08em" }}>{p.description}</p>
          {p.prices.length > 1 && (
            <div className="tiers" role="radiogroup">
              {p.prices.map((x, i) => (
                <button key={x.id} role="radio" aria-checked={i === priceIdx} className={i === priceIdx ? "on" : ""} onClick={() => setPriceIdx(i)}>
                  <b>{x.name}</b>
                  {x.amount_cents !== 0 && <PriceTag p={x} />}
                </button>
              ))}
            </div>
          )}
          {price && (
            <div className="card buybox">
              <div className="row between">
                {price.amount_cents !== 0 && <b>{price.name}</b>}
                <PriceTag p={price} />
              </div>
              {price.features.length > 0 && (
                <ul className="checks">{price.features.map((f) => <li key={f}>{f}</li>)}</ul>
              )}
              <Link className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} to={`/kontakt?produkt=${p.id}&preis=${price.code}`}>
                {t("products.request")}
              </Link>
              <p className="muted" style={{ fontSize: ".85em", margin: "8px 0 0" }}>{t("products.sub")}</p>
            </div>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <>
          <h2 style={{ marginTop: 48 }}>{dept?.name}</h2>
          <div className="grid">{related.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </>
      )}
    </section>
  );
}

export function Careers() {
  const { t, locale } = useI18n();
  const { data, error } = useApi<Job[]>(`/api/v1/public/jobs?locale=${locale}`, [locale]);
  useTitle(t("careers.title"));
  return (
    <section className="section container">
      <h1>{t("careers.title")}</h1>
      <p className="muted">{t("careers.sub")}</p>
      {error ? <div className="alert">{error}</div> : !data ? <SkeletonGrid n={2} /> : data.length === 0 ? <div className="empty">{t("careers.none")}</div> : (
        <div className="grid">
          {data.map((j) => (
            <Link key={j.slug} to={`/karriere/${j.slug}`} className="card jcard" onMouseEnter={() => prefetch(`/api/v1/public/jobs/${j.slug}?locale=${locale}`)}>
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
  const { data: job, error } = useApi<Job>(`/api/v1/public/jobs/${slug}?locale=${locale}`, [locale, slug]);
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const s = useSubmit();
  useTitle(job?.title);
  if (error) return <div className="container section"><div className="alert">{error}</div></div>;
  if (!job) return <div className="container section"><div className="sk line" style={{ height: 30, width: "50%" }} /><div className="sk line" /><div className="sk line" /></div>;
  return (
    <section className="section container" style={{ maxWidth: 820 }}>
      <nav className="crumbs"><Link to="/karriere">{t("careers.title")}</Link> <span>›</span> <span>{job.title}</span></nav>
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
        {s.done ? <div className="alert ok">✓ {t("form.sent")}</div> : (
          <form onSubmit={s.run(() => api(`/api/v1/public/jobs/${slug}/apply`, { body: { ...f, locale } }))}>
            <input type="text" name="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="hp" tabIndex={-1} autoComplete="off" aria-hidden />
            <div className="grid2">
              <Field label={t("form.name")}><input required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label={t("form.email")}><input required type="email" autoComplete="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            </div>
            <Field label={t("form.phone")}><input type="tel" autoComplete="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label={t("form.message")}><textarea rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            {s.error && <div className="alert">{t("form.error")}</div>}
            <button className="btn" disabled={s.busy}>{s.busy ? "…" : t("form.send")}</button>
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
  const pre = params.get("produkt") ?? "";
  const tier = params.get("preis");
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: "", message: "", product_id: pre, website: "" });
  // Betreff aus gewähltem Produkt vorbelegen
  useEffect(() => {
    const p = data?.products.find((x) => x.id === pre);
    if (p && !f.subject) {
      const pr = p.prices.find((x) => x.code === tier);
      setF((o) => ({ ...o, subject: pr ? `${p.name} – ${pr.name}` : p.name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pre, tier]);
  // Produkte mit eigener Seite, die (noch) nicht im Katalog der Datenbank stehen: Die Anfrage
  // geht ohne Katalog-Nummer hinaus, der Produktname steht dann vorn im Betreff.
  const pages = [
    { key: "radiologie", name: TEASER[locale].radiologie[0] },
    { key: "ultar-os", name: TEASER[locale]["ultar-os"][0] },
    { key: "km-one", name: TEASER[locale]["km-one"][0] },
  ];
  const extra = pages.filter(
    (x) => !data?.products.some((p) => p.name === x.name),
  );
  useEffect(() => {
    const x = extra.find((e) => e.key === pre);
    if (x && !f.subject) setF((o) => ({ ...o, subject: x.name }));
    // Steht das Produkt inzwischen im Katalog, wird der Katalogeintrag vorgewählt.
    const page = pages.find((x) => x.key === pre);
    const known = page ? data?.products.find((p) => p.name === page.name) : undefined;
    if (known) setF((o) => ({ ...o, product_id: known.id, subject: o.subject || known.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pre, data]);
  const s = useSubmit();
  useTitle(t("contact.title"));
  const submit = () => {
    const x = extra.find((e) => e.key === f.product_id);
    const subject = x && !f.subject.includes(x.name) ? `${x.name} – ${f.subject}` : f.subject;
    return api("/api/v1/public/contact", { body: { ...f, subject, product_id: x ? null : f.product_id || null, locale } });
  };
  return (
    <section className="section container contact-page">
      <div className="contact-aside">
        <h1>{t("contact.title")}</h1>
        <p className="muted">{t("contact.sub")}</p>
        <ul className="channels">
          <li><a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer"><b>WhatsApp</b><bdi dir="ltr">{CONTACT.whatsapp}</bdi></a></li>
          <li><a href={`mailto:${CONTACT.email}`}><b>E-Mail</b><bdi dir="ltr">{CONTACT.email}</bdi></a></li>
          <li><div><b>{HOME[locale].contact.hours}</b><span>{HOME[locale].contact.hoursV}</span></div></li>
          <li><a href={CONTACT.googleMaps} target="_blank" rel="noopener noreferrer"><b>{HOME[locale].contact.address}</b><span className="addr">{ADDRESS[locale]}</span></a></li>
          <li className="map-links">
            <a href={CONTACT.googleMaps} target="_blank" rel="noopener noreferrer">Google Maps</a>
            <a href={ourMapUrl(locale)} target="_blank" rel="noopener">Maps Syria</a>
          </li>
        </ul>
      </div>
      <div className="card contact-form">
        {s.done ? <div className="alert ok">✓ {t("form.sent")}</div> : (
          <form onSubmit={s.run(submit)}>
            <input type="text" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="hp" tabIndex={-1} autoComplete="off" aria-hidden />
            <div className="grid2">
              <Field label={t("form.name")}><input required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label={t("form.email")}><input required type="email" autoComplete="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            </div>
            <div className="grid2">
              <Field label={t("form.phone")}><input type="tel" autoComplete="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label={t("form.product")}>
                <select value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
                  <option value="">—</option>
                  {data?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {extra.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("form.subject")}><input required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
            <Field label={t("form.message")}><textarea required minLength={5} rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
            {s.error && <div className="alert">{t("form.error")}</div>}
            <button className="btn" disabled={s.busy}>{s.busy ? "…" : t("form.send")}</button>
          </form>
        )}
      </div>
    </section>
  );
}
