// Hilfe: Anleitungen je Rolle (Kunde/Mitarbeiter, Rechte), Suche, und die Hilfe zur aktuellen Seite.
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { can, useAuth, type Me, type Right } from "../../api";
import { useI18n } from "../../i18n";
import { ListTools, matches, NoHits } from "../../ui";
import { HELP, HT, type Article } from "./helpText";

/** Anleitungen, die zu diesem Benutzer passen */
export function articlesFor(me: Me | null, all: Article[]): Article[] {
  if (!me) return [];
  return all.filter((a) => a.who === "all" || (a.who === "customer" && !me.is_employee)
    || (a.who === "employee" && me.is_employee && (!a.right || can(me, a.right as Right))));
}

function ArticleView({ a, open, T }: { a: Article; open?: boolean; T: (typeof HT)["de"] }) {
  return (
    <details className="help-a card" id={`hilfe-${a.id}`} open={open}>
      <summary><b>{a.title}</b><span className="muted">{a.intro}</span></summary>
      <h4>{T.steps}</h4>
      <ol>{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {a.tips && a.tips.length > 0 && <><h4>{T.tips}</h4><ul>{a.tips.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {a.seg !== undefined && <Link className="help-go" to={`/portal/${a.seg}`}>→ /portal/{a.seg}</Link>}
    </details>
  );
}

export default function Help({ areas }: { areas: string[] }) {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = HT[locale];
  const [sp] = useSearchParams();
  const topic = sp.get("thema");
  const [q, setQ] = useState("");
  const list = useMemo(() => articlesFor(me, HELP[locale]), [me, locale]);
  const rows = list.filter((a) => matches(q, a.title, a.intro, ...a.steps, ...(a.tips ?? [])));
  useEffect(() => {
    if (topic) document.getElementById(`hilfe-${topic}`)?.scrollIntoView({ block: "start" });
  }, [topic]);
  return (
    <>
      <h1>{T.title}</h1>
      <p className="muted" style={{ marginTop: -8 }}>{T.intro}</p>
      {me?.is_employee && (
        <div className="card help-me">
          <h3>{T.rights}</h3>
          <dl>
            <div><dt>{T.role}</dt><dd>{me.role}</dd></div>
            <div><dt>{T.depts}</dt><dd>{me.departments.join(", ") || "–"}</dd></div>
            <div><dt>{T.areas}</dt><dd>{areas.join(" · ")}</dd></div>
          </dl>
        </div>
      )}
      <ListTools q={q} setQ={setQ} shown={rows.length} total={list.length} placeholder={T.search} />
      {rows.length === 0 ? <NoHits /> : (
        <div className="help-list">{rows.map((a) => <ArticleView key={a.id} a={a} T={T} open={a.id === topic || (!!q && rows.length <= 3)} />)}</div>
      )}
      <p className="muted" style={{ marginTop: 24 }}>{T.contact} <Link to="/portal/nachrichten">→</Link></p>
    </>
  );
}

/** „?“ in der Kopfleiste: Anleitung zur aktuellen Seite */
export function PageHelp({ seg, onClose }: { seg: string; onClose: () => void }) {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = HT[locale];
  const list = articlesFor(me, HELP[locale]).filter((a) => a.seg === seg);
  return (
    <div className="help-drawer-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="help-drawer" role="dialog" aria-label={T.page}>
        <div className="row between"><h2 style={{ margin: 0 }}>{T.page}</h2><button className="btn ghost small" onClick={onClose} aria-label="✕">✕</button></div>
        {list.length === 0 ? <p className="muted">{T.none}</p> : list.map((a) => <ArticleView key={a.id} a={a} T={T} open />)}
        <Link className="btn ghost" to="/portal/hilfe" onClick={onClose}>{T.all}</Link>
      </aside>
    </div>
  );
}
