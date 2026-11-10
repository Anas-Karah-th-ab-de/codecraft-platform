// Produktseiten: /kasse, /ki-server, /karten – Inhalte in productText.ts (DE/EN/AR)
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../api";
import { useI18n } from "../../i18n";
import { type Block, type ProductKey, PRODUCTS, PRODUCT_PATH, TEASER, UI } from "./productText";

type Price = { id: string; code: string; name: string; billing: string; amount_cents: number | null; currency: string; features: string[] };
type CatalogProduct = { prices: Price[] };

const money = (cents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale === "ar" ? "ar-SY-u-nu-latn" : locale === "en" ? "en-GB" : "de-DE", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(cents / 100);

/** Interne Ziele als Link, externe als neuer Tab */
function Go({ to, className, children }: { to: string; className: string; children: React.ReactNode }) {
  return to.startsWith("http")
    ? <a className={className} href={to} target="_blank" rel="noopener noreferrer">{children}</a>
    : <Link className={className} to={to}>{children}</Link>;
}

export function ProductPage({ k }: { k: ProductKey }) {
  const { locale } = useI18n();
  const P = PRODUCTS[k][locale];
  const U = UI[locale];
  useEffect(() => {
    document.title = `${P.title} · KM Code Craft`;
    window.scrollTo(0, 0);
  }, [P.title]);
  const others = (Object.keys(PRODUCTS) as ProductKey[]).filter((x) => x !== k);
  return (
    <div className="hx pp">
      <section className="pp-hero">
        <div className="hx-wrap pp-hero-grid">
          <div>
            <nav className="pp-crumbs"><Link to="/produkte">{U.products}</Link> <span aria-hidden="true">›</span> <span>{TEASER[locale][k][0]}</span></nav>
            <p className="hx-eyebrow">{P.eyebrow}</p>
            <h1>{P.h1}</h1>
            <p className="pp-sub">{P.sub}</p>
            <div className="hx-actions">
              <Go to={P.primary.to} className="hx-btn">{P.primary.label}</Go>
              {P.secondary && <Go to={P.secondary.to} className="hx-link">{P.secondary.label}</Go>}
            </div>
          </div>
          <aside className="pp-sheet" aria-label={U.sheet}>
            <p className="pp-sheet-h">{U.sheet}</p>
            <dl>{P.sheet.map(([a, b]) => <div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
          </aside>
        </div>
      </section>
      {P.blocks.map((b, i) => <BlockView key={i} b={b} alt={i % 2 === 1} />)}
      <section className="pp-close">
        <div className="hx-wrap pp-close-grid">
          <div>
            <h2>{P.closing.h}</h2>
            <p>{P.closing.text}</p>
          </div>
          <Go to={P.primary.to} className="hx-btn">{P.primary.label}</Go>
        </div>
      </section>
      <section className="pp-others">
        <div className="hx-wrap">
          <h2 className="hx-h2-small" style={{ marginTop: 0 }}>{U.others}</h2>
          <ul>
            {others.map((o) => (
              <li key={o}><Link to={PRODUCT_PATH[o]}><b>{TEASER[locale][o][0]}</b><span>{TEASER[locale][o][1]}</span><i aria-hidden="true">{locale === "ar" ? "←" : "→"}</i></Link></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function BlockView({ b, alt }: { b: Block; alt: boolean }) {
  const { locale } = useI18n();
  const dark = (b.kind === "points" && b.dark) || b.kind === "plans";
  const cls = `pp-block ${dark ? "pp-dark" : alt ? "pp-alt" : ""}`;
  return (
    <section className={cls}>
      <div className="hx-wrap">
        <h2>{b.h}</h2>
        {"lead" in b && b.lead && <p className="hx-intro">{b.lead}</p>}
        {b.kind === "features" && (
          <div className={`pp-feat ${b.items.length % 4 === 0 ? "four" : ""}`}>{b.items.map(([t, d]) => <div key={t}><h3>{t}</h3><p>{d}</p></div>)}</div>
        )}
        {b.kind === "points" && <ul className="pp-points">{b.items.map((t) => <li key={t}>{t}</li>)}</ul>}
        {b.kind === "plans" && (
          <div className="pos-tiers pp-tiers">
            {b.plans.map((p) => (
              <div key={p.n} className={`tier ${p.hl ? "pop" : ""}`}>
                <p className="tier-name">{p.n}</p>
                <p className="pp-tag">{p.tag}</p>
                <ul>{p.items.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        {b.kind === "catalog" && <Catalog slug={b.slug} month={b.month} custom={b.custom} locale={locale} />}
        {b.kind === "table" && (
          <table className="pp-table">
            <thead><tr><th>{b.head[0]}</th><th>{b.head[1]}</th></tr></thead>
            <tbody>{b.rows.map(([a, c]) => <tr key={a}><th scope="row">{a}</th><td>{c}</td></tr>)}</tbody>
          </table>
        )}
        {b.kind === "steps" && (
          <ol className="steps pp-steps">{b.items.map((s, i) => <li key={s}><span dir="ltr">{i + 1}</span>{s}</li>)}</ol>
        )}
      </div>
    </section>
  );
}

function Catalog({ slug, month, custom, locale }: { slug: string; month: string; custom: string; locale: string }) {
  const c = useApi<CatalogProduct>(`/api/v1/public/products/${slug}?locale=${locale}`, [slug, locale]);
  return (
    <div className="ai-plans pp-catalog">
      {(c.data?.prices ?? []).map((p, i) => (
        <div key={p.id} className="ai-plan">
          <div className="ai-plan-head">
            <span className="leds" aria-hidden="true">{[0, 1, 2, 3].map((n) => <i key={n} className={n <= i ? "on" : ""} />)}</span>
            <b>{p.name}</b>
            <span className="ai-price" dir="ltr">{p.amount_cents != null ? <>{money(p.amount_cents, p.currency, locale)}<small>{month}</small></> : custom}</span>
          </div>
          <p>{p.features.join(" · ")}</p>
        </div>
      ))}
    </div>
  );
}
