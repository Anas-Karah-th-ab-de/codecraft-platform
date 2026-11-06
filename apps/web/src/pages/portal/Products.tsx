import { useRef, useState } from "react";
import { api, can, invalidate, upload, useApi, useAuth } from "../../api";
import { money, useI18n, type Key, type Locale } from "../../i18n";
import { Field, Loading, Modal, toCents, useSubmit } from "../../ui";
import type { Price, Product } from "./Invoices";

type I18n = { de: string; en: string; ar: string };
type Dept = { id: string; code: string; name: I18n; color: string };
const KINDS = ["software", "hardware", "service", "appliance", "rental"];
const BILLINGS = ["one_time", "hourly", "monthly", "yearly", "on_request"];
const DEVICES = ["", "agent", "esp32", "ai_appliance", "pos"];
const emptyI18n = (): I18n => ({ de: "", en: "", ar: "" });

/** Drei Eingabefelder DE/EN/AR nebeneinander – Arabisch rechts-nach-links */
export function I18nInput({ label, value, onChange, area }: { label: string; value: I18n; onChange: (v: I18n) => void; area?: boolean }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="grid2" style={{ gap: 8 }}>
        {(["de", "en", "ar"] as const).map((l) => {
          const props = {
            required: true, placeholder: l.toUpperCase(), value: value[l], dir: l === "ar" ? "rtl" : "ltr",
            onChange: (e: any) => onChange({ ...value, [l]: e.target.value }),
          };
          return area ? <textarea key={l} rows={3} {...props} /> : <input key={l} {...props} />;
        })}
      </div>
    </div>
  );
}

export default function ProductsAdmin() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const { data, error, reload } = useApi<Product[]>("/api/v1/products");
  const depts = useApi<Dept[]>("/api/v1/departments");
  const [creating, setCreating] = useState(false);
  const [dept, setDept] = useState("");
  const edit = can(me, "catalog_write");
  const s = useSubmit();

  const patch = (id: string, body: object) => s.run(async () => { await api(`/api/v1/products/${id}`, { method: "PATCH", body }); invalidate("/api/v1/public"); reload(); });

  return (
    <>
      <div className="row between">
        <h1>{t("p.products")}</h1>
        {edit && <button className="btn" onClick={() => setCreating(true)}>+ {t("p.new_product")}</button>}
      </div>
      <div className="tabs">
        <button className={dept === "" ? "on" : ""} onClick={() => setDept("")}>{t("products.all")}</button>
        {depts.data?.map((d) => (
          <button key={d.code} className={dept === d.code ? "on" : ""} onClick={() => setDept(d.code)}>{d.name[locale as Locale]}</button>
        ))}
      </div>
      {s.error && <div className="alert">{s.error}</div>}
      {!data ? <Loading error={error} /> : (
        <div style={{ display: "grid", gap: 14 }}>
          {data.filter((p) => !dept || p.department_code === dept).map((p) => (
            <div key={p.id} className="card" style={{ opacity: p.is_active ? 1 : 0.55 }}>
              <div className="row between">
                <div>
                  <h3 style={{ margin: 0 }}>{p.name[locale as Locale]}</h3>
                  <div className="muted" style={{ fontSize: ".9em" }}>
                    {p.sku} · {t(`kind.${p.kind}` as Key)} · {depts.data?.find((d) => d.code === p.department_code)?.name[locale as Locale] ?? p.department_code}
                    {p.device_kind && ` · ${t("p.device")}: ${p.device_kind}`}
                  </div>
                </div>
                {edit && (
                  <div className="row">
                    <label className="row" style={{ margin: 0, gap: 4 }}>
                      <input type="checkbox" style={{ width: "auto" }} checked={p.is_public} onChange={patch(p.id, { is_public: !p.is_public })} /> {t("p.public")}
                    </label>
                    <label className="row" style={{ margin: 0, gap: 4 }}>
                      <input type="checkbox" style={{ width: "auto" }} checked={p.is_active} onChange={patch(p.id, { is_active: !p.is_active })} /> {t("p.active")}
                    </label>
                    <select value={p.department_code} style={{ width: "auto" }} onChange={(e) => patch(p.id, { department_code: e.target.value })()}>
                      {depts.data?.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <p className="muted" style={{ margin: "6px 0 10px" }}>{p.description[locale as Locale]}</p>
              <ImageManager p={p} edit={edit} onChange={() => { invalidate("/api/v1/public"); reload(); }} />
              <table>
                <thead><tr><th>{t("p.price_code")}</th><th>{t("p.prices")}</th><th>{t("p.billing")}</th><th className="n">{t("p.amount")}</th><th className="n">{t("p.active")}</th></tr></thead>
                <tbody>{p.prices.map((pr) => <PriceRow key={pr.id} pr={pr} edit={edit} onChange={reload} />)}</tbody>
              </table>
              {edit && <AddPrice productId={p.id} onDone={reload} />}
            </div>
          ))}
        </div>
      )}
      {creating && <NewProduct depts={depts.data ?? []} onClose={() => { setCreating(false); reload(); }} />}
    </>
  );
}

function PriceRow({ pr, edit, onChange }: { pr: Price; edit: boolean; onChange: () => void }) {
  const { t, locale } = useI18n();
  const [val, setVal] = useState(pr.amount_cents == null ? "" : String(pr.amount_cents / 100));
  const s = useSubmit();
  const save = (body: object) => s.run(async () => { await api(`/api/v1/prices/${pr.id}`, { method: "PATCH", body }); onChange(); });
  const changed = pr.amount_cents != null && toCents(val || "0") !== pr.amount_cents;
  return (
    <tr style={{ opacity: pr.is_active ? 1 : 0.5 }}>
      <td><code>{pr.code}</code></td>
      <td>{pr.name[locale as Locale]}</td>
      <td>{t(`bopt.${pr.billing}` as Key)}</td>
      <td className="n">
        {pr.amount_cents == null ? t("billing.on_request") : edit ? (
          <span className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
            <input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} style={{ width: 110, textAlign: "end" }} />
            {changed && <button className="btn small" disabled={s.busy} onClick={save({ amount_cents: toCents(val) })}>✓</button>}
          </span>
        ) : money(pr.amount_cents, locale, pr.currency)}
        {s.error && <div className="alert">{s.error}</div>}
      </td>
      <td className="n">
        <input type="checkbox" style={{ width: "auto" }} disabled={!edit} checked={pr.is_active} onChange={save({ is_active: !pr.is_active })} />
      </td>
    </tr>
  );
}

type PriceForm = { code: string; name: I18n; billing: string; amount: string };
const emptyPrice = (): PriceForm => ({ code: "", name: emptyI18n(), billing: "one_time", amount: "" });
const toBody = (p: PriceForm) => ({
  code: p.code.trim(), name: p.name, billing: p.billing, amount_cents: p.billing === "on_request" ? null : toCents(p.amount || "0"),
});

function PriceFields({ p, set }: { p: PriceForm; set: (p: PriceForm) => void }) {
  const { t } = useI18n();
  return (
    <>
      <div className="grid2">
        <Field label={t("p.price_code")}><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="basic" value={p.code} onChange={(e) => set({ ...p, code: e.target.value.toLowerCase() })} /></Field>
        <Field label={t("p.billing")}>
          <select value={p.billing} onChange={(e) => set({ ...p, billing: e.target.value })}>
            {BILLINGS.map((b) => <option key={b} value={b}>{t(`bopt.${b}` as Key)}</option>)}
          </select>
        </Field>
        {p.billing !== "on_request" && (
          <Field label={t("p.amount")}><input required inputMode="decimal" value={p.amount} onChange={(e) => set({ ...p, amount: e.target.value })} /></Field>
        )}
      </div>
      <I18nInput label={t("p.prices")} value={p.name} onChange={(name) => set({ ...p, name })} />
    </>
  );
}

function AddPrice({ productId, onDone }: { productId: string; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(emptyPrice());
  const s = useSubmit();
  if (!open) return <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>+ {t("p.add_price")}</button>;
  return (
    <Modal title={t("p.add_price")} onClose={() => setOpen(false)}>
      <form onSubmit={s.run(async () => { await api(`/api/v1/products/${productId}/prices`, { body: toBody(p) }); setOpen(false); setP(emptyPrice()); onDone(); })}>
        <PriceFields p={p} set={setP} />
        {s.error && <div className="alert">{s.error}</div>}
        <button className="btn" disabled={s.busy}>{t("p.create")}</button>
      </form>
    </Modal>
  );
}

function NewProduct({ depts, onClose }: { depts: Dept[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [f, setF] = useState({ sku: "", slug: "", kind: "software", department_code: depts.some((d) => d.code === "DEV") ? "DEV" : depts[0]?.code ?? "DEV", device_kind: "", is_public: true });
  const [name, setName] = useState(emptyI18n());
  const [desc, setDesc] = useState(emptyI18n());
  const [prices, setPrices] = useState<PriceForm[]>([emptyPrice()]);
  const s = useSubmit();
  const slugify = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const submit = () => api("/api/v1/products", {
    body: { ...f, device_kind: f.device_kind || null, name, description: desc, prices: prices.map(toBody) },
  }).then(onClose);
  return (
    <Modal title={t("p.new_product")} onClose={onClose}>
      <form onSubmit={s.run(submit)}>
        <I18nInput label="Name" value={name} onChange={(v) => { setName(v); if (!f.slug || f.slug === slugify(name.de)) setF({ ...f, slug: slugify(v.de) }); }} />
        <I18nInput label={t("p.description")} value={desc} onChange={setDesc} area />
        <div className="grid2">
          <Field label={t("p.sku")}><input required pattern="[A-Z0-9]+(-[A-Z0-9]+)*" placeholder="CC-POS-V4" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value.toUpperCase() })} /></Field>
          <Field label={t("p.slug")}><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
          <Field label={t("p.department")}>
            <select value={f.department_code} onChange={(e) => setF({ ...f, department_code: e.target.value })}>
              {depts.map((d) => <option key={d.code} value={d.code}>{d.name[locale as Locale]}</option>)}
            </select>
          </Field>
          <Field label={t("p.kind")}>
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, device_kind: e.target.value === "service" ? "" : f.device_kind })}>
              {KINDS.map((k) => <option key={k} value={k}>{t(`kind.${k}` as Key)}</option>)}
            </select>
          </Field>
          <Field label={t("p.device")}>
            <select value={f.device_kind} required={f.kind === "appliance"} disabled={f.kind === "service"} onChange={(e) => setF({ ...f, device_kind: e.target.value })}>
              {DEVICES.map((d) => <option key={d} value={d}>{d || "—"}</option>)}
            </select>
          </Field>
          <Field label={t("p.public")}>
            <input type="checkbox" style={{ width: "auto" }} checked={f.is_public} onChange={(e) => setF({ ...f, is_public: e.target.checked })} />
          </Field>
        </div>
        <h3>{t("p.prices")}</h3>
        {prices.map((p, i) => (
          <div key={i} className="card" style={{ padding: 12, marginBottom: 8 }}>
            <PriceFields p={p} set={(np) => setPrices(prices.map((x, j) => (j === i ? np : x)))} />
            {prices.length > 1 && <button type="button" className="btn ghost small" onClick={() => setPrices(prices.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => setPrices([...prices, emptyPrice()])}>+ {t("p.add_price")}</button>
        {s.error && <div className="alert">{s.error}</div>}
        <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost" onClick={onClose}>{t("p.cancel")}</button>
          <button className="btn" disabled={s.busy}>{t("p.create")}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Bilder: Drag & Drop oder Klick, mehrere auf einmal; erstes Bild = Hauptbild */
function ImageManager({ p, edit, onChange }: { p: Product; edit: boolean; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const send = async (files: FileList | File[]) => {
    setErr(null);
    const list = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (list.length === 0) return setErr("JPEG, PNG, WebP");
    setBusy(list.length);
    for (const f of list) {
      try {
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name}: > 10 MB`);
        await upload(`/api/v1/products/${p.id}/images`, f);
      } catch (e: any) {
        setErr(e.message);
      }
      setBusy((n) => n - 1);
    }
    onChange();
  };
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); onChange(); } catch (e: any) { setErr(e.message); }
  };
  if (!edit && p.images.length === 0) return null;
  return (
    <>
      <div className="imgs">
        {p.images.map((im, i) => (
          <div key={im.id} className={`im ${i === 0 ? "main" : ""}`}>
            <img src={im.card} alt="" loading="lazy" />
            {edit && (
              <div className="bar2">
                <button type="button" title="Hauptbild" disabled={i === 0} onClick={() => act(() => api(`/api/v1/product-images/${im.id}/primary`, { method: "POST" }))}>
                  {i === 0 ? "★" : "☆"}
                </button>
                <button type="button" title="Löschen" onClick={() => confirm("Bild löschen?") && act(() => api(`/api/v1/product-images/${im.id}`, { method: "DELETE" }))}>🗑</button>
              </div>
            )}
          </div>
        ))}
        {edit && (
          <div
            className={`drop ${over ? "over" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}
          >
            {busy > 0 ? <span>⏳ {busy}</span> : <><span style={{ fontSize: "1.6em" }}>＋</span><span>Bild hierher ziehen</span></>}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files && send(e.target.files)} />
          </div>
        )}
      </div>
      {err && <div className="alert">{err}</div>}
    </>
  );
}
