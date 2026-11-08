// Zahlungsarten: Auswahl in Belegen, Anzeige, Pflege durch den Admin.
import { useState } from "react";
import { api, useApi } from "../../api";
import { useI18n } from "../../i18n";
import { Field, ListTools, Loading, Modal, matches } from "../../ui";

export type PaymentMethod = {
  id: string; kind: "shamcash" | "bank" | "cash" | "paypal" | "other"; name: string; is_default: boolean; is_active: boolean; sort: number;
  details: { payee?: string; provider?: string; account?: string; account_label?: string; bic?: string; address?: string; note?: string };
};
export type PaymentInfo = { id?: string; kind: string; name: string; details: PaymentMethod["details"] };

export const PT = {
  de: { title: "Zahlungsarten", method: "Zahlungsart", standard: "Standard", auto: "Standard des Kunden", new: "+ Zahlungsart", edit: "Zahlungsart bearbeiten",
    kind: "Art", name: "Name", payee: "Empfänger", provider: "Anbieter / Bank", account: "Konto / IBAN / ID", accountLabel: "Bezeichnung des Kontos",
    bic: "BIC", address: "Adresse", note: "Hinweis für Kunden", active: "aktiv", inactive: "deaktiviert", makeDefault: "als Standard",
    save: "Speichern", cancel: "Abbrechen", hint: "Kontodaten werden nur in der Datenbank gespeichert. Ausgestellte Rechnungen behalten die Daten von damals.",
    kinds: { shamcash: "ShamCash", bank: "Banküberweisung", cash: "Bar", paypal: "PayPal", other: "Andere" } },
  en: { title: "Payment methods", method: "Payment method", standard: "Default", auto: "Customer default", new: "+ Payment method", edit: "Edit payment method",
    kind: "Type", name: "Name", payee: "Payee", provider: "Provider / bank", account: "Account / IBAN / ID", accountLabel: "Account label",
    bic: "BIC", address: "Address", note: "Note for customers", active: "active", inactive: "disabled", makeDefault: "as default",
    save: "Save", cancel: "Cancel", hint: "Account details are stored only in the database. Issued invoices keep the details from that time.",
    kinds: { shamcash: "ShamCash", bank: "Bank transfer", cash: "Cash", paypal: "PayPal", other: "Other" } },
  ar: { title: "طرق الدفع", method: "طريقة الدفع", standard: "افتراضي", auto: "افتراضي العميل", new: "+ طريقة دفع", edit: "تعديل طريقة الدفع",
    kind: "النوع", name: "الاسم", payee: "المستفيد", provider: "المزوّد / البنك", account: "الحساب / IBAN / المعرّف", accountLabel: "تسمية الحساب",
    bic: "BIC", address: "العنوان", note: "ملاحظة للعملاء", active: "مفعّل", inactive: "معطّل", makeDefault: "كافتراضي",
    save: "حفظ", cancel: "إلغاء", hint: "تُحفظ بيانات الحساب في قاعدة البيانات فقط. تحتفظ الفواتير الصادرة ببياناتها وقت الإصدار.",
    kinds: { shamcash: "شام كاش", bank: "تحويل بنكي", cash: "نقداً", paypal: "PayPal", other: "أخرى" } },
};

export function usePaymentMethods() {
  return useApi<PaymentMethod[]>("/api/v1/payment-methods");
}

/** Auswahl; leer = Standard des Kunden bzw. globaler Standard */
export function PaymentSelect({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const { locale } = useI18n();
  const T = PT[locale];
  const { data } = usePaymentMethods();
  return (
    <select value={value} required={required} onChange={(e) => onChange(e.target.value)}>
      {!required && <option value="">{T.auto}</option>}
      {data?.filter((m) => m.is_active).map((m) => <option key={m.id} value={m.id}>{m.name}{m.is_default ? ` (${T.standard})` : ""}</option>)}
    </select>
  );
}

/** Zahlungsdaten für Kunden und Team */
export function PaymentBox({ p }: { p: PaymentInfo | null | undefined }) {
  const { locale } = useI18n();
  const T = PT[locale];
  if (!p) return null;
  const d = p.details ?? {};
  const rows: [string, string | undefined][] = [
    [T.payee, d.payee], [T.provider, d.provider], [d.account_label || (p.kind === "bank" ? "IBAN" : T.account), d.account], [T.bic, d.bic], [T.note, d.note],
  ];
  return (
    <div>
      <div className="muted">{T.method}</div>
      <b>{p.name}</b>
      {rows.filter((r) => r[1]).map(([l, v]) => <div key={l} style={{ fontSize: ".9em" }}><span className="muted">{l}:</span> <bdi dir="ltr">{v}</bdi></div>)}
    </div>
  );
}

/** Pflege der Zahlungsarten (nur Admin) */
export function PaymentMethodsAdmin() {
  const { locale } = useI18n();
  const T = PT[locale];
  const { data, error, reload } = usePaymentMethods();
  const [edit, setEdit] = useState<PaymentMethod | "new" | null>(null);
  const [q, setQ] = useState("");
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row between"><h2 style={{ margin: 0 }}>{T.title}</h2><button className="btn small" onClick={() => setEdit("new")}>{T.new}</button></div>
      <p className="muted" style={{ fontSize: ".9em" }}>{T.hint}</p>
      {data && data.length > 4 && <ListTools q={q} setQ={setQ} shown={data.filter((m) => matches(q, m.name, T.kinds[m.kind], m.details.account, m.details.payee)).length} total={data.length} />}
      {!data ? <Loading error={error} /> : (
        <table>
          <thead><tr><th>{T.name}</th><th>{T.kind}</th><th>{T.account}</th><th /></tr></thead>
          <tbody>{data.filter((m) => matches(q, m.name, T.kinds[m.kind], m.details.account, m.details.payee)).map((m) => (
            <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.5 }}>
              <td><b>{m.name}</b>{m.is_default && <span className="badge" style={{ marginInlineStart: 6 }}>{T.standard}</span>}{!m.is_active && <span className="muted"> · {T.inactive}</span>}</td>
              <td>{T.kinds[m.kind]}</td>
              <td><bdi dir="ltr">{m.details.account ?? "—"}</bdi></td>
              <td><button className="btn small ghost" onClick={() => setEdit(m)}>✎</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {edit && <MethodForm m={edit === "new" ? null : edit} onClose={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function MethodForm({ m, onClose }: { m: PaymentMethod | null; onClose: () => void }) {
  const { locale } = useI18n();
  const T = PT[locale];
  const [f, setF] = useState({
    kind: m?.kind ?? "other", name: m?.name ?? "", is_default: m?.is_default ?? false, is_active: m?.is_active ?? true, sort: m?.sort ?? 0,
    details: { ...(m?.details ?? {}) } as Record<string, string>,
  });
  const [err, setErr] = useState<string | null>(null);
  const det = (k: string) => (
    <Field label={(T as any)[k === "account_label" ? "accountLabel" : k]}>
      <input dir="auto" maxLength={300} value={f.details[k] ?? ""} onChange={(e) => setF({ ...f, details: { ...f.details, [k]: e.target.value } })} />
    </Field>
  );
  const save = async () => {
    setErr(null);
    try {
      const body = { ...f, details: Object.fromEntries(Object.entries(f.details).filter(([, v]) => v.trim())) };
      await api(m ? `/api/v1/payment-methods/${m.id}` : "/api/v1/payment-methods", { method: m ? "PUT" : "POST", body });
      onClose();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Modal title={m ? T.edit : T.new} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid2">
          <Field label={T.kind}>
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PaymentMethod["kind"] })}>
              {Object.entries(T.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={T.name}><input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          {det("payee")}{det("provider")}{det("account")}{det("account_label")}{det("bic")}{det("address")}
        </div>
        {det("note")}
        <div className="row" style={{ gap: 16, margin: "8px 0" }}>
          <label><input type="checkbox" checked={f.is_active} disabled={f.is_default} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> {T.active}</label>
          <label><input type="checkbox" checked={f.is_default} disabled={m?.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked, is_active: e.target.checked || f.is_active })} /> {T.makeDefault}</label>
        </div>
        {err && <div className="alert">{err}</div>}
        <div className="row"><button className="btn">{T.save}</button><button type="button" className="btn ghost" onClick={onClose}>{T.cancel}</button></div>
      </form>
    </Modal>
  );
}
