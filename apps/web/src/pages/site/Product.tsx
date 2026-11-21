// Produktseiten: /km-one, /ultar-os, /kasse, /ki-server, /karten, /e-health – Inhalte in productText.ts (DE/EN/AR)
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../api";
import { useI18n } from "../../i18n";
import { UltarDemo } from "./Home";
import { type Block, type ProductKey, PRODUCTS, PRODUCT_PATH, TEASER, UI } from "./productText";

type Price = { id: string; code: string; name: string; billing: string; amount_cents: number | null; currency: string; features: string[] };
type CatalogProduct = { prices: Price[] };

const money = (cents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale === "ar" ? "ar-SY-u-nu-latn" : locale === "en" ? "en-GB" : "de-DE", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(cents / 100);

/** Interne Ziele als Link, externe als neuer Tab */
function Go({ to, className, children }: { to: string; className: string; children: React.ReactNode }) {
  // Dateien (PDF) sind keine Seiten der Anwendung: normaler Link statt Router
  if (to.startsWith("/downloads/") || to.startsWith("/radiology/") || to.startsWith("#")) return <a className={className} href={to}>{children}</a>;
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
      {k === "ultar-os" && <UltarDemo more={false} />}
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
    <section className={cls} id={b.id}>
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
        {b.kind === "gallery" && (
          <div className="pp-gallery">{b.items.map(([src, cap]) => (
            <figure key={src}><a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={cap} loading="lazy" width={1280} height={800} /></a><figcaption>{cap}</figcaption></figure>
          ))}</div>
        )}
        {b.kind === "faq" && (
          <div className="pp-faq">{b.items.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}</div>
        )}
        {b.kind === "anatomy" && (
          <div className="pp-anat">
            <img src={b.img} alt={b.alt} loading="lazy" width={1000} height={1250} />
            <ol>{b.items.map(([t, d], i) => <li key={t}><span dir="ltr">{i + 1}</span><div><b>{t}</b><p>{d}</p></div></li>)}</ol>
          </div>
        )}
        {b.kind === "matrix" && (
          <div className="pp-matrix">{b.items.map(([st, t, d]) => (
            <div key={st} className={`mx-${st}`}>
              <div className="dots" aria-hidden="true">{dotPattern(st).map((on, i) => <i key={i} className={on ? "on" : ""} />)}</div>
              <b>{t}</b>
              <p>{d}</p>
            </div>
          ))}</div>
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

/** 15 × 7 Punkte der Rückseiten-Anzeige des KM One (wie im Design-Entwurf) */
function dotPattern(name: string): boolean[] {
  const g: number[][] = Array.from({ length: 7 }, () => Array(15).fill(0));
  const put = (rows: string[], x0: number, y0: number) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "#" && g[y0 + y] && x0 + x < 15) g[y0 + y][x0 + x] = 1; }));
  const S = ["###", "#..", "###", "..#", "###"], O = ["###", "#.#", "#.#", "#.#", "###"];
  if (name === "sos") { put(S, 2, 1); put(O, 6, 1); put(S, 10, 1); }
  else if (name === "msg") put(["###########", "##.......##", "#.#.....#.#", "#..#...#..#", "#...#.#...#", "#....#....#", "###########"], 2, 0);
  else if (name === "sat") { put(S, 2, 1); put([".#.", "#.#", "###", "#.#", "#.#"], 6, 1); put(["###", ".#.", ".#.", ".#.", ".#."], 10, 1); }
  else if (name === "charge") { put(["############.", "#..........##", "#..........##", "#..........##", "############."], 1, 1); for (let y = 2; y <= 4; y++) for (let x = 3; x <= 9; x++) g[y][x] = 1; }
  else [2, 3, 4, 5, 7].forEach((h, i) => { for (let y = 7 - h; y < 7; y++) { g[y][1 + i * 3] = 1; g[y][2 + i * 3] = 1; } });
  return g.flat().map((v) => v === 1);
}
