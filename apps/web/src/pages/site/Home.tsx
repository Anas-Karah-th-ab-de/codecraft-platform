import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../../api";
import { useI18n } from "../../i18n";
import { CONTACT, HOME, STACK } from "./homeText";
import { Board } from "./Board";

type Price = { id: string; code: string; name: string; billing: string; amount_cents: number | null; currency: string; features: string[] };
type ProductDetail = { slug: string; name: string; prices: Price[] };

const fmt = (amount: number, currency: string, locale: string, digits = 2) =>
  new Intl.NumberFormat(locale === "ar" ? "ar-SY-u-nu-latn" : locale === "en" ? "en-GB" : "de-DE", {
    style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(amount);

export function Home() {
  const { locale } = useI18n();
  const T = HOME[locale];
  const { hash } = useLocation();
  useEffect(() => {
    document.title = "code-craft · Technology. Crafted.";
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);
  return (
    <div className="hx">
      <Hero />
      <section className="hx-craft">
        <div className="hx-wrap hx-craft-grid">
          <img src="/brand/mark-circuit.png" alt="" width="300" height="270" loading="lazy" />
          <div>
            <p className="hx-lead">{T.craft}</p>
            <blockquote>{T.quote}</blockquote>
            <dl className="hx-facts">
              {T.facts.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
            </dl>
          </div>
        </div>
      </section>
      <Till />
      <Ai />
      <Services />
      <section className="hx-stack">
        <div className="hx-wrap">
          <p className="hx-eyebrow">{T.stack.eyebrow}</p>
          <p className="hx-stack-list" dir="ltr">{STACK.map((s) => <span key={s}>{s}</span>)}</p>
        </div>
      </section>
      <Story />
      <section className="hx-work">
        <div className="hx-wrap">
          <h2 className="hx-h2-small" style={{ marginTop: 0 }}>{T.work.eyebrow}</h2>
          <ul>
            {T.work.list.map(([name, desc, url]) => (
              <li key={name}>
                {url.startsWith("/") ? <Link to={url}><b>{name}</b><span>{desc}</span><i aria-hidden="true">{locale === "ar" ? "←" : "→"}</i></Link>
                  : url.startsWith("#") ? <a href={url}><b>{name}</b><span>{desc}</span><i aria-hidden="true">↓</i></a>
                  : url ? <a href={url} target="_blank" rel="noopener noreferrer"><b>{name}</b><span>{desc}</span><i aria-hidden="true">↗</i></a>
                  : <div><b>{name}</b><span>{desc}</span><i /></div>}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Contact />
    </div>
  );
}

function Hero() {
  const { locale } = useI18n();
  const T = HOME[locale];
  return (
    <section className="hx-hero" id="top">
      <div className="hx-wrap hx-hero-grid">
        <div className="hx-hero-body">
          <h1 dir="ltr"><span>{T.h1a}</span><span>{T.h1b}</span></h1>
          <p className="hx-hero-sub">{T.sub}</p>
          <div className="hx-actions">
            <Link to="/kontakt" className="hx-btn">{T.ctaStart}</Link>
            <a href="#kasse" className="hx-link">{T.ctaTill.replace(/\s*[↓↑]\s*$/, "")}</a>
          </div>
          <p className="hx-made">{T.made}</p>
        </div>
        <Board items={T.board} label={T.boardAria} />
      </div>
    </section>
  );
}

// ── Kassen-Demo ────────────────────────────────────────────────────────────

const RATES: Record<string, number> = { EUR: 1, USD: 1.08, TRY: 37.2, SYP: 14200 };
type Line = { i: number; qty: number };
type Sale = { id: number; total: number; currency: string; at: string; synced: boolean };

function Till() {
  const { locale } = useI18n();
  const T = HOME[locale].till;
  const pos = useApi<ProductDetail>(`/api/v1/public/products/pos-code-craft-v3?locale=${locale}`, [locale]);
  const [cur, setCur] = useState("EUR");
  const [lines, setLines] = useState<Line[]>([]);
  const [online, setOnline] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const nextId = useRef(1);
  const rate = RATES[cur];
  const digits = cur === "SYP" ? 0 : 2;
  const money = (eur: number) => fmt(eur * rate, cur, locale, digits);
  const totalEur = lines.reduce((s, l) => s + T.items[l.i].p * l.qty, 0);
  const waiting = sales.filter((s) => !s.synced).length;
  const last = sales[0];

  const add = (i: number) =>
    setLines((ls) => (ls.some((l) => l.i === i) ? ls.map((l) => (l.i === i ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { i, qty: 1 }]));
  const pay = () => {
    if (!lines.length) return;
    const at = new Date().toLocaleTimeString(locale === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setSales((s) => [{ id: nextId.current++, total: totalEur, currency: cur, at, synced: online }, ...s].slice(0, 20));
    setLines([]);
  };
  // Kabel wieder drin → offene Verkäufe nacheinander synchronisieren
  useEffect(() => {
    if (!online || waiting === 0) { setSyncing(false); return; }
    setSyncing(true);
    const id = setTimeout(() => setSales((s) => {
      const idx = [...s].reverse().findIndex((x) => !x.synced);
      if (idx < 0) return s;
      const real = s.length - 1 - idx;
      return s.map((x, k) => (k === real ? { ...x, synced: true } : x));
    }), 550);
    return () => clearTimeout(id);
  }, [online, waiting, sales]);

  const status = !online ? T.offline(waiting) : syncing ? T.syncing : T.online;
  return (
    <section className="hx-till" id="kasse">
      <div className="hx-wrap">
        <p className="hx-eyebrow">{T.eyebrow}</p>
        <h2>{T.h2}</h2>
        <p className="hx-intro">{T.text}</p>
        <div className="till-demo">
          <div className="till-main">
            <div className="till-cable">
              <button className={`cable ${online ? "" : "pulled"}`} onClick={() => setOnline(!online)} aria-pressed={!online}>
                <svg viewBox="0 0 40 90" aria-hidden="true"><path d="M20 0 V38" /><rect x="11" y="38" width="18" height="22" rx="3" /><path d="M15 60 v8 M25 60 v8" /></svg>
                <span>{online ? T.pull : T.plug}</span>
              </button>
              <span className={`till-status ${online ? (syncing ? "sync" : "on") : "off"}`} role="status">{status}</span>
            </div>
            <div className={`till-screen ${online ? "" : "is-off"}`}>
              <div className="till-bar">
                <span>code-craft POS v3</span>
                <span className="till-cur" role="group">
                  {Object.keys(RATES).map((c) => <button key={c} className={c === cur ? "on" : ""} onClick={() => setCur(c)}>{c}</button>)}
                </span>
              </div>
              <div className="till-body">
                <div className="till-items">
                  {T.items.map((it, i) => (
                    <button key={i} onClick={() => add(i)}>
                      <b>{it.n}</b>{"sub" in it && it.sub && <small>{it.sub}</small>}<span dir="ltr">{money(it.p)}</span>
                    </button>
                  ))}
                </div>
                <div className="till-cart">
                  {lines.length === 0 ? <p className="till-empty">{T.tap}</p> : (
                    <ul>{lines.map((l) => (
                      <li key={l.i}><span>{l.qty} × {T.items[l.i].n}</span><span dir="ltr">{money(T.items[l.i].p * l.qty)}</span></li>
                    ))}</ul>
                  )}
                  <div className="till-total">
                    <small>{T.base} EUR</small>
                    <div><span>{T.total}</span><b dir="ltr">{money(totalEur)}</b></div>
                    <div className="till-btns">
                      <button onClick={() => setLines([])} disabled={!lines.length}>{T.clear}</button>
                      <button className="pay" onClick={pay} disabled={!lines.length}>{T.pay}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="till-note">{T.note}</p>
          </div>
          <aside className="till-side">
            <div className="receipt">
              <b>code-craft POS v3</b>
              {last ? (
                <>
                  <span>#{String(last.id).padStart(4, "0")} · {last.at}</span>
                  <span className="r-total" dir="ltr">{fmt(last.total * RATES[last.currency], last.currency, locale, last.currency === "SYP" ? 0 : 2)}</span>
                  <span>{last.synced ? `✓ ${T.synced}` : `⏸ ${T.queued}`}</span>
                </>
              ) : <span>{T.receiptEmpty}</span>}
            </div>
            <div className="queue">
              <div className="queue-head"><b>{T.waiting}</b><span className="queue-n">{waiting}</span></div>
              {waiting === 0 ? <p>{T.nothing}</p> : (
                <ul>{sales.filter((s) => !s.synced).map((s) => (
                  <li key={s.id}><span>#{String(s.id).padStart(4, "0")}</span><span dir="ltr">{fmt(s.total * RATES[s.currency], s.currency, locale, s.currency === "SYP" ? 0 : 2)}</span></li>
                ))}</ul>
              )}
            </div>
          </aside>
        </div>
        <h2 className="hx-h2-small">{T.pricesH}</h2>
        <div className="pos-tiers">
          {(pos.data?.prices ?? []).map((p) => (
            <div key={p.id} className={`tier ${p.code === "basic" ? "pop" : ""}`}>
              <p className="tier-name">{p.name}{p.code === "basic" && <em>{T.popular}</em>}</p>
              <p className={`tier-price ${p.amount_cents == null ? "ask" : ""}`} dir={p.amount_cents == null ? undefined : "ltr"}>
                {p.amount_cents == null ? T.request : <>{fmt(p.amount_cents / 100, p.currency, locale, 0)}{p.amount_cents > 0 && <small> {T.once}</small>}</>}
              </p>
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          ))}
        </div>
        <dl className="specs">
          {T.specs.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
        <div className="hx-actions till-more">
          <Link className="hx-btn" to="/kasse">{T.more}</Link>
          <a className="hx-link dark" href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer">{T.ask}</a>
        </div>
      </div>
    </section>
  );
}

function Ai() {
  const { locale } = useI18n();
  const T = HOME[locale].ai;
  const ai = useApi<ProductDetail>(`/api/v1/public/products/ki-server?locale=${locale}`, [locale]);
  return (
    <section className="hx-ai" id="ki">
      <div className="hx-wrap hx-ai-grid">
        <div>
          <p className="hx-eyebrow">{T.eyebrow}</p>
          <h2>{T.h2}</h2>
          <p className="hx-intro">{T.text}</p>
          <ul className="hx-uses">{T.uses.map((u) => <li key={u}>{u}</li>)}</ul>
          <Link className="hx-link ai-more" to="/ki-server">{T.more}</Link>
        </div>
        <div className="ai-plans">
          {(ai.data?.prices ?? []).map((p, i) => (
            <div key={p.id} className="ai-plan">
              <div className="ai-plan-head">
                <span className="leds" aria-hidden="true">{[0, 1, 2, 3].map((k) => <i key={k} className={k <= i ? "on" : ""} />)}</span>
                <b>{p.name}</b>
                <span className="ai-price" dir="ltr">{p.amount_cents != null ? <>{fmt(p.amount_cents / 100, p.currency, locale, 0)}<small>{T.month}</small></> : T.custom}</span>
              </div>
              <p>{p.features.join(" · ")}</p>
            </div>
          ))}
          <Link className="hx-btn block" to="/kontakt?produkt=ki-server">{T.cta}</Link>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const { locale } = useI18n();
  const T = HOME[locale].services;
  const [open, setOpen] = useState(0);
  return (
    <section className="hx-services" id="leistungen">
      <div className="hx-wrap">
        <h2>{T.h2}</h2>
        <ul className="acc">
          {T.list.map((s, i) => (
            <li key={s.t} className={open === i ? "open" : ""}>
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span className="acc-n" dir="ltr">0{i + 1}</span>
                <span className="acc-t">{s.t}</span>
                <span className="acc-d">{s.d}</span>
                <span className="acc-x" aria-hidden="true">+</span>
              </button>
              {open === i && <ul className="acc-tags">{s.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
            </li>
          ))}
        </ul>
        <ol className="steps">
          {T.steps.map((s, i) => (<li key={s}><span dir="ltr">{i + 1}</span>{s}</li>))}
        </ol>
      </div>
    </section>
  );
}

function Story() {
  const { locale } = useI18n();
  const T = HOME[locale].story;
  return (
    <section className="hx-story" id="geschichte">
      <div className="hx-wrap">
        <p className="hx-eyebrow">{T.eyebrow}</p>
        <h2>{T.h2}</h2>
        <ol className="timeline">
          {T.timeline.map(([y, d], i) => (
            <li key={y} className={i === T.timeline.length - 1 ? "now" : ""}><b dir="ltr">{y}</b><span>{d}</span></li>
          ))}
        </ol>
        <div className="hx-mission">
          <p>{T.mission}</p>
          <span>{T.sign}</span>
        </div>
      </div>
    </section>
  );
}

/** Geschäftszeiten Mo–Fr 9–18 Uhr Berlin */
function useOpenNow() {
  return useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", hour12: false })
      .formatToParts(new Date());
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    return !["Sat", "Sun"].includes(wd) && h >= 9 && h < 18;
  }, []);
}

function Contact() {
  const { locale } = useI18n();
  const T = HOME[locale].contact;
  const open = useOpenNow();
  return (
    <section className="hx-contact" id="kontakt">
      <div className="hx-wrap hx-contact-grid">
        <div>
          <h2>{T.h2}</h2>
          <p>{T.text}</p>
          <div className="hx-actions">
            <a className="hx-btn ink" href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp <bdi dir="ltr">{CONTACT.whatsapp}</bdi></a>
            <a className="hx-link light" href={`mailto:${CONTACT.email}`} dir="ltr">{CONTACT.email}</a>
          </div>
        </div>
        <dl className="hx-cdetails">
          <div><dt>{T.hours}</dt><dd>{T.hoursV}<br /><b>{open ? T.open : T.closed}</b></dd></div>
          <div><dt>Matrix</dt><dd dir="ltr">{CONTACT.matrix}</dd></div>
          <div><dt>{T.meeting}</dt><dd><Link to="/kontakt?betreff=beratung">{T.meetingV}</Link></dd></div>
          <div><dt>{T.address}</dt><dd style={{ whiteSpace: "pre-line" }}>{CONTACT.address}</dd></div>
        </dl>
      </div>
    </section>
  );
}
