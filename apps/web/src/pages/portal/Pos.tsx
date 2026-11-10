// Kasse (universal-pos-erp): Lizenzen, verbundene Kassen, Backups.
// Kunden sehen nur ihre Firma; Mitarbeiter wählen den Kunden und legen Lizenzen an.
import { useState } from "react";
import { api, can, useApi, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Field, Loading, useSubmit } from "../../ui";

const PT = {
  de: {
    keys: "Paket-Schlüssel", keysIntro: "Schlüssel erzeugen und an Kunden/Händler weitergeben. In der Kasse: Einstellungen → Abo → „Schlüssel einlösen“ – auch ohne Portal-Konto (die Firma wird dann aus dem Ladennamen angelegt).", kind: "Art", kLicense: "Abo-Paket", kAi: "KI-Einheiten", count: "Anzahl", generate: "Erzeugen", copy: "Kopieren", copied: "Kopiert", print: "Drucken", status: "Status", sOpen: "offen", sRedeemed: "eingelöst", sRevoked: "gesperrt", all: "Alle", revokeKeyQ: "Schlüssel sperren?", redeemedBy: "eingelöst von", reports: "Fehlerberichte aus Kassen erscheinen als Ticket unter Support (Quelle: Kasse).",
    ai: "KI-Einheiten (Assistent)", aiIntro: "Der KI-Assistent der Kasse beantwortet Fragen und erledigt kleine Änderungen. Nach {trial} Test-Antworten werden Einheiten benötigt – lokal auf dem Gerät oder über unsere API.", bought: "gekauft", apiUsed: "über API genutzt", delivered: "an Kasse übertragen", pending: "wird bei der nächsten Verbindung übertragen", units: "Einheiten", aiRequest: "Einheiten anfragen", aiAdd: "Einheiten gutschreiben", aiPacks: "Paket",
    title: "Kasse", intro: "Lizenzen, verbundene Kassen und Backups Ihres KM-Code-Craft-Kassensystems.",
    licenses: "Lizenzen", registers: "Verbundene Kassen", backups: "Backups", none: "Noch nichts vorhanden.",
    available: "nicht genutzt", active: "aktiv", until: "gültig bis", address: "Fernzugriff",
    howTo: "Unbenutzte Lizenz aktivieren: an der Hauptkasse Einstellungen → Kundenportal verbinden – die Kasse fragt dann, ob sie die Lizenz nutzen soll.",
    lastSeen: "zuletzt online", revoke: "Trennen", revokeQ: "Diese Kasse vom Portal trennen? Backups und Lizenzabgleich stoppen bis zur erneuten Verbindung.",
    e2e: "Ende-zu-Ende verschlüsselt – Wiederherstellung nur mit dem Wiederherstellungscode des Betriebs, direkt an der Kasse.",
    request: "Lizenz anfragen", requestText: "Gewünschter Plan", note: "Nachricht (optional)", send: "Anfrage senden", sent: "Anfrage gesendet – wir melden uns.",
    plans: { basic: "Basic – Fernzugriff, Anwesenheit", pro: "Pro – + Kurs-API, mehrere Filialen", business: "Business – + Priorität" },
    customer: "Kunde", create: "Lizenz anlegen", plan: "Plan", slug: "Subdomain", days: "Laufzeit (Tage)", extend: "Verlängern", extendQ: "Um wie viele Tage verlängern?", revokeLic: "Sperren", revokeLicQ: "Lizenz sperren? Die Kasse fällt nach der Kulanzzeit auf Free zurück.",
  },
  en: {
    keys: "Package keys", keysIntro: "Generate keys and hand them to customers/resellers. On the register: Settings → Subscription → “Redeem key” – works without a portal account too (the company is created from the shop name).", kind: "Type", kLicense: "Subscription package", kAi: "AI units", count: "Count", generate: "Generate", copy: "Copy", copied: "Copied", print: "Print", status: "Status", sOpen: "open", sRedeemed: "redeemed", sRevoked: "revoked", all: "All", revokeKeyQ: "Revoke key?", redeemedBy: "redeemed by", reports: "Error reports from registers appear as tickets under Support (source: POS).",
    ai: "AI units (assistant)", aiIntro: "The register's AI assistant answers questions and makes small changes. After {trial} trial answers units are needed – locally on the device or via our API.", bought: "bought", apiUsed: "used via API", delivered: "delivered to register", pending: "will be delivered on next connection", units: "units", aiRequest: "Request units", aiAdd: "Credit units", aiPacks: "Pack",
    title: "POS", intro: "Licences, connected registers and backups of your KM Code Craft POS.",
    licenses: "Licences", registers: "Connected registers", backups: "Backups", none: "Nothing yet.",
    available: "unused", active: "active", until: "valid until", address: "Remote access",
    howTo: "Activate an unused licence: on the main register go to Settings → Connect customer portal – the register then asks whether to use it.",
    lastSeen: "last online", revoke: "Disconnect", revokeQ: "Disconnect this register from the portal? Backups and licence sync stop until it is connected again.",
    e2e: "End-to-end encrypted – restore only with the business recovery code, directly on the register.",
    request: "Request licence", requestText: "Desired plan", note: "Message (optional)", send: "Send request", sent: "Request sent – we will get back to you.",
    plans: { basic: "Basic – remote access, attendance", pro: "Pro – + rate API, multiple branches", business: "Business – + priority" },
    customer: "Customer", create: "Create licence", plan: "Plan", slug: "Subdomain", days: "Duration (days)", extend: "Extend", extendQ: "Extend by how many days?", revokeLic: "Revoke", revokeLicQ: "Revoke licence? The register falls back to Free after the grace period.",
  },
  ar: {
    keys: "مفاتيح الباقات", keysIntro: "أنشئ مفاتيح وسلّمها للعملاء أو الموزعين. في الكاشير: الإعدادات ← الاشتراك ← «تفعيل مفتاح» – يعمل أيضاً بدون حساب في البوابة (تُنشأ الشركة من اسم المتجر).", kind: "النوع", kLicense: "باقة اشتراك", kAi: "وحدات الذكاء", count: "العدد", generate: "إنشاء", copy: "نسخ", copied: "تم النسخ", print: "طباعة", status: "الحالة", sOpen: "متاح", sRedeemed: "مُفعّل", sRevoked: "موقوف", all: "الكل", revokeKeyQ: "إيقاف المفتاح؟", redeemedBy: "فعّله", reports: "تظهر تقارير الأعطال من أجهزة الكاشير كتذاكر في قسم الدعم (المصدر: الكاشير).",
    ai: "وحدات الذكاء (المساعد)", aiIntro: "يجيب المساعد الذكي في الكاشير عن الأسئلة وينفذ تغييرات صغيرة. بعد {trial} إجابة تجريبية تحتاج إلى وحدات – محلياً على الجهاز أو عبر واجهتنا.", bought: "مشتراة", apiUsed: "مستخدمة عبر الواجهة", delivered: "أُرسلت إلى الكاشير", pending: "ستُرسل عند الاتصال التالي", units: "وحدة", aiRequest: "طلب وحدات", aiAdd: "إضافة وحدات", aiPacks: "باقة",
    title: "نظام الكاشير", intro: "التراخيص والأجهزة المتصلة والنسخ الاحتياطية لنظام الكاشير من KM Code Craft.",
    licenses: "التراخيص", registers: "الأجهزة المتصلة", backups: "النسخ الاحتياطية", none: "لا يوجد شيء بعد.",
    available: "غير مستخدم", active: "نشط", until: "صالح حتى", address: "الوصول عن بُعد",
    howTo: "لتفعيل ترخيص غير مستخدم: على الجهاز الرئيسي الإعدادات ← ربط بوابة العملاء – سيسألك الجهاز إن كنت تريد استخدامه.",
    lastSeen: "آخر اتصال", revoke: "فصل", revokeQ: "فصل هذا الجهاز عن البوابة؟ تتوقف النسخ الاحتياطية ومزامنة الترخيص حتى يُربط مجدداً.",
    e2e: "مشفّرة من الطرف إلى الطرف – الاستعادة فقط برمز الاستعادة الخاص بالنشاط ومباشرة على الجهاز.",
    request: "طلب ترخيص", requestText: "الخطة المطلوبة", note: "رسالة (اختياري)", send: "إرسال الطلب", sent: "تم إرسال الطلب – سنتواصل معك.",
    plans: { basic: "Basic – وصول عن بُعد، حضور", pro: "Pro – + أسعار صرف تلقائية، عدة فروع", business: "Business – + أولوية" },
    customer: "العميل", create: "إنشاء ترخيص", plan: "الخطة", slug: "النطاق الفرعي", days: "المدة (أيام)", extend: "تمديد", extendQ: "التمديد لكم يوماً؟", revokeLic: "إيقاف", revokeLicQ: "إيقاف الترخيص؟ سيعود الجهاز إلى الخطة المجانية بعد فترة السماح.",
  },
};

type License = { id: string; plan: string; slug: string; status: string; tenant_id: string | null; expires_at: string; activated_at: string | null; note: string | null };
type Register = { id: string; name: string; tenant_id: string; app_version: string | null; platform: string | null; last_seen_at: string | null; revoked_at: string | null };
type Backup = { id: string; business_name: string | null; size_bytes: number; created_at: string; app_version: string | null };
type Overview = { licenses: License[]; registers: Register[]; backups: Backup[]; tunnel_domain: string };

const dt = (d: string | null, l: string) => (d ? new Date(d).toLocaleString(l, { dateStyle: "short", timeStyle: "short" }) : "–");
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export default function Pos() {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = PT[locale];
  const staff = !!me?.is_employee;
  const orgs = useApi<{ id: string; name: string }[]>(staff ? "/api/v1/organizations" : null);
  const [org, setOrg] = useState("");
  const path = staff ? (org ? `/api/v1/pos/overview?organization_id=${org}` : null) : "/api/v1/pos/overview";
  const ov = useApi<Overview>(path, [path]);

  return (
    <div className="stack">
      <h1>{T.title}</h1>
      <p className="muted">{T.intro}</p>
      {staff && (
        <Field label={T.customer}>
          <select value={org} onChange={(e) => setOrg(e.target.value)}>
            <option value="">–</option>
            {(orgs.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      )}
      {path && !ov.data && <Loading error={ov.error} />}
      {ov.data && <Content ov={ov.data} reload={ov.reload} staff={staff} org={org} />}
      {(!staff || org) && <AiUnits staff={staff} org={org} />}
      {staff && me && can(me, "customer_write") && <Keys />}
      {!staff && <RequestLicense />}
    </div>
  );
}

function Content({ ov, reload, staff, org }: { ov: Overview; reload: () => void; staff: boolean; org: string }) {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = PT[locale];
  const act = async (fn: () => Promise<unknown>, q?: string) => {
    if (q && !confirm(q)) return;
    try {
      await fn();
      reload();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const manage = staff && me && can(me, "customer_write");
  return (
    <>
      <section className="card">
        <h2>{T.licenses}</h2>
        {ov.licenses.length === 0 && <p className="muted">{T.none}</p>}
        <table className="table">
          <tbody>
            {ov.licenses.map((l) => (
              <tr key={l.id}>
                <td><b>{l.plan.toUpperCase()}</b><br /><small className="muted">{l.note}</small></td>
                <td><span className={`badge ${l.status === "active" ? "ok" : "warn"}`}>{l.status === "active" ? T.active : T.available}</span></td>
                <td dir="ltr">{l.status === "active" ? <a href={`https://${l.slug}.${ov.tunnel_domain}`} target="_blank" rel="noreferrer">{l.slug}.{ov.tunnel_domain}</a> : `${l.slug}.${ov.tunnel_domain}`}</td>
                <td>{T.until} {dt(l.expires_at, locale)}</td>
                {manage && (
                  <td className="row">
                    <button className="btn small ghost" onClick={() => { const d = prompt(T.extendQ, "365"); if (d) act(() => api(`/api/v1/pos/admin/licenses/${l.id}/extend`, { method: "POST", body: { days: Number(d) } })); }}>{T.extend}</button>
                    <button className="btn small ghost" onClick={() => act(() => api(`/api/v1/pos/admin/licenses/${l.id}/revoke`, { method: "POST" }), T.revokeLicQ)}>{T.revokeLic}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {ov.licenses.some((l) => l.status === "available") && <p className="muted">{T.howTo}</p>}
        {manage && <CreateLicense org={org} onDone={reload} />}
      </section>

      <section className="card">
        <h2>{T.registers}</h2>
        {ov.registers.length === 0 && <p className="muted">{T.none}</p>}
        <table className="table">
          <tbody>
            {ov.registers.map((r) => (
              <tr key={r.id} style={r.revoked_at ? { opacity: 0.5 } : undefined}>
                <td><b>{r.name}</b><br /><small className="muted" dir="ltr">{r.tenant_id.slice(-12)} · {r.platform} {r.app_version}</small></td>
                <td>{T.lastSeen}: {dt(r.last_seen_at, locale)}</td>
                <td>{!r.revoked_at && <button className="btn small ghost" onClick={() => act(() => api(`/api/v1/pos/registers/${r.id}/revoke`, { method: "POST" }), T.revokeQ)}>{T.revoke}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>{T.backups}</h2>
        <p className="muted">{T.e2e}</p>
        {ov.backups.length === 0 && <p className="muted">{T.none}</p>}
        <table className="table">
          <tbody>
            {ov.backups.slice(0, 30).map((b) => (
              <tr key={b.id}><td>{dt(b.created_at, locale)}</td><td>{b.business_name}</td><td>{mb(b.size_bytes)}</td><td className="muted">{b.app_version}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function CreateLicense({ org, onDone }: { org: string; onDone: () => void }) {
  const { locale } = useI18n();
  const T = PT[locale];
  const [f, setF] = useState({ plan: "basic", slug: "", days: "365", note: "" });
  const { busy, error, run } = useSubmit();
  return (
    <form
      className="row wrap"
      onSubmit={run(async () => {
        await api("/api/v1/pos/admin/licenses", { method: "POST", body: { organization_id: org, plan: f.plan, slug: f.slug, days: Number(f.days), note: f.note || null } });
        setF({ ...f, slug: "", note: "" });
        onDone();
      })}
    >
      <Field label={T.plan}>
        <select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
          {(["basic", "pro", "business"] as const).map((p) => <option key={p} value={p}>{T.plans[p]}</option>)}
        </select>
      </Field>
      <Field label={T.slug}><input dir="ltr" required pattern="[a-z0-9][a-z0-9-]{1,40}[a-z0-9]" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} /></Field>
      <Field label={T.days}><input type="number" min={1} max={3660} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
      <Field label="Notiz"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      <button className="btn" disabled={busy || !org}>{T.create}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function RequestLicense() {
  const { locale } = useI18n();
  const T = PT[locale];
  const [plan, setPlan] = useState<"basic" | "pro" | "business">("basic");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  if (sent) return <p className="card">{T.sent}</p>;
  return (
    <section className="card">
      <h2>{T.request}</h2>
      <form
        onSubmit={run(async () => {
          await api("/api/v1/tickets", {
            method: "POST",
            body: { subject: `Kassen-Lizenz anfragen: ${plan.toUpperCase()}`, body: `${T.plans[plan]}\n\n${note}`.trim(), category: "billing", urgency: "normal" },
          });
          setSent(true);
        })}
      >
        <Field label={T.requestText}>
          <select value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)}>
            {(["basic", "pro", "business"] as const).map((p) => <option key={p} value={p}>{T.plans[p]}</option>)}
          </select>
        </Field>
        <Field label={T.note}><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <button className="btn" disabled={busy}>{T.send}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </section>
  );
}

type AiOverview = { credits: { id: string; units: number; note: string | null; created_at: string; tenant_id: string | null; delivered_at: string | null }[]; bought: number; api_used: number; trial: number };

/** KI-Einheiten: Kunde sieht Käufe/Übertragung und fragt an; Mitarbeiter schreiben gut. */
function AiUnits({ staff, org }: { staff: boolean; org: string }) {
  const { me } = useAuth();
  const { locale } = useI18n();
  const T = PT[locale];
  const path = staff ? `/api/v1/pos/ai?organization_id=${org}` : "/api/v1/pos/ai";
  const ai = useApi<AiOverview>(path, [path]);
  const [units, setUnits] = useState("500");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();
  const manage = staff && me && can(me, "customer_write");
  if (!ai.data) return <Loading error={ai.error} />;
  const d = ai.data;
  return (
    <section className="card">
      <h2>✨ {T.ai}</h2>
      <p className="muted">{T.aiIntro.replace("{trial}", String(d.trial))}</p>
      <p><b>{d.bought}</b> {T.bought} · <b>{d.api_used}</b> {T.apiUsed}</p>
      {d.credits.length > 0 && (
        <table className="table">
          <tbody>
            {d.credits.map((c) => (
              <tr key={c.id}>
                <td>{dt(c.created_at, locale)}</td>
                <td>{c.units} {T.units}</td>
                <td className="muted">{c.delivered_at ? `${T.delivered} ${dt(c.delivered_at, locale)}` : T.pending}</td>
                <td className="muted">{c.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {manage && (
        <form className="row wrap" onSubmit={run(async () => { await api("/api/v1/pos/admin/ai-credits", { method: "POST", body: { organization_id: org, units: Number(units), note: note || null } }); setNote(""); ai.reload(); })}>
          <Field label={T.units}><input type="number" min={1} max={1000000} value={units} onChange={(e) => setUnits(e.target.value)} /></Field>
          <Field label="Notiz"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn" disabled={busy || !org}>{T.aiAdd}</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
      {!staff && (sent ? <p>{T.sent}</p> : (
        <form className="row wrap" onSubmit={run(async () => {
          await api("/api/v1/tickets", { method: "POST", body: { subject: `KI-Einheiten anfragen: ${units}`, body: `${units} ${T.units}\n\n${note}`.trim(), category: "billing", urgency: "normal" } });
          setSent(true);
        })}>
          <Field label={T.aiPacks}>
            <select value={units} onChange={(e) => setUnits(e.target.value)}>
              {["500", "2000", "10000"].map((u) => <option key={u} value={u}>{u} {T.units}</option>)}
            </select>
          </Field>
          <Field label={T.note}><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn" disabled={busy}>{T.aiRequest}</button>
          {error && <p className="error">{error}</p>}
        </form>
      ))}
    </section>
  );
}

type Key = { id: string; code: string; kind: "license" | "ai"; plan: string | null; days: number | null; units: number | null; note: string | null; status: string; created_at: string; redeemed_at: string | null; business_name: string | null };

/** Admin: Schlüssel für Pakete (Abo/KI) erzeugen, weitergeben, sperren. */
function Keys() {
  const { locale } = useI18n();
  const T = PT[locale];
  const [filter, setFilter] = useState("open");
  const path = `/api/v1/pos/admin/keys${filter ? `?status=${filter}` : ""}`;
  const keys = useApi<Key[]>(path, [path]);
  const [f, setF] = useState({ kind: "license", plan: "basic", days: "365", units: "500", count: "1", note: "" });
  const [fresh, setFresh] = useState<Key[]>([]);
  const { busy, error, run } = useSubmit();
  const label = (k: Key) => (k.kind === "license" ? `${k.plan?.toUpperCase()} · ${k.days} d` : `${k.units} ${T.units}`);
  const print = (list: Key[]) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    w.document.write(`<html dir="${locale === "ar" ? "rtl" : "ltr"}"><head><title>KM Code Craft</title><style>body{font-family:sans-serif}.k{border:1px dashed #999;padding:14px;margin:8px;display:inline-block;width:300px}.c{font:700 18px monospace;letter-spacing:1px}img{height:28px}</style></head><body>${list.map((k) => `<div class="k"><img src="${location.origin}/brand/logo.png" alt=""><p>${esc(label(k))}</p><p class="c" dir="ltr">${esc(k.code)}</p><small>code-craft.tech</small></div>`).join("")}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };
  return (
    <section className="card">
      <h2>🔑 {T.keys}</h2>
      <p className="muted">{T.keysIntro}</p>
      <form className="row wrap" onSubmit={run(async () => {
        const body = f.kind === "license" ? { kind: "license", plan: f.plan, days: Number(f.days) } : { kind: "ai", units: Number(f.units) };
        const r = await api<Key[]>("/api/v1/pos/admin/keys", { method: "POST", body: { ...body, count: Number(f.count), note: f.note || null } });
        setFresh(r);
        keys.reload();
      })}>
        <Field label={T.kind}>
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="license">{T.kLicense}</option>
            <option value="ai">{T.kAi}</option>
          </select>
        </Field>
        {f.kind === "license" ? (
          <>
            <Field label={T.plan}>
              <select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
                {Object.entries(T.plans).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label={T.days}><input type="number" min={1} max={3660} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
          </>
        ) : (
          <Field label={T.units}><input type="number" min={1} max={1000000} value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} /></Field>
        )}
        <Field label={T.count}><input type="number" min={1} max={200} value={f.count} onChange={(e) => setF({ ...f, count: e.target.value })} /></Field>
        <Field label={T.note}><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button className="btn" disabled={busy}>{T.generate}</button>
        {error && <p className="error">{error}</p>}
      </form>
      {fresh.length > 0 && (
        <div className="stack">
          <pre dir="ltr" style={{ userSelect: "all" }}>{fresh.map((k) => `${k.code}  ${label(k)}`).join("\n")}</pre>
          <div className="row">
            <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(fresh.map((k) => k.code).join("\n"))}>{T.copy}</button>
            <button className="btn small ghost" onClick={() => print(fresh)}>{T.print}</button>
          </div>
        </div>
      )}
      <div className="row wrap">
        {[["open", T.sOpen], ["redeemed", T.sRedeemed], ["revoked", T.sRevoked], ["", T.all]].map(([v, l]) => (
          <button key={v} className={`btn small ${filter === v ? "" : "ghost"}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      {!keys.data ? <Loading error={keys.error} /> : keys.data.length === 0 ? <p className="muted">{T.none}</p> : (
        <table className="table">
          <tbody>
            {keys.data.map((k) => (
              <tr key={k.id}>
                <td dir="ltr"><code>{k.code}</code></td>
                <td>{label(k)}</td>
                <td>{k.status === "open" ? T.sOpen : k.status === "redeemed" ? T.sRedeemed : T.sRevoked}</td>
                <td className="muted">{k.business_name ? `${T.redeemedBy} ${k.business_name} · ${dt(k.redeemed_at, locale)}` : dt(k.created_at, locale)}{k.note ? ` · ${k.note}` : ""}</td>
                <td>{k.status === "open" && <button className="btn small ghost" onClick={async () => { if (confirm(T.revokeKeyQ)) { await api(`/api/v1/pos/admin/keys/${k.id}/revoke`, { method: "POST" }); keys.reload(); } }}>{T.revokeLic}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">ℹ️ {T.reports}</p>
    </section>
  );
}
