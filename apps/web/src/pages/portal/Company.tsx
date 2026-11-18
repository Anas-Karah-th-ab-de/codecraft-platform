// Firmendaten (Adresse, USt-IdNr., Kontakt) nachträglich pflegen – Team in der Kundenliste, Kunde unter „Konto“.
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, useApi, useAuth } from "../../api";
import { useI18n } from "../../i18n";
import { Field, Modal, useSubmit } from "../../ui";

export type OrgData = {
  id: string; name: string; address: string; vat_id: string | null; email: string | null; locale: string;
  customer_number: string | null; contact_name: string | null; phone: string | null;
};

export const CT = {
  de: { company: "Firmendaten", edit: "Bearbeiten", missing: "Adresse fehlt", contact: "Ansprechpartner", phone: "Telefon", number: "Kundennummer",
    nameHint: "Den Firmennamen ändert KM Code Craft – bitte kurz über den Support melden.", addrHint: "Straße und Hausnummer, PLZ und Ort, Land – erscheint auf Rechnungen und Angeboten.",
    remind: "Für Ihre Firma ist noch keine Adresse hinterlegt. Bitte ergänzen – sie wird für Rechnungen und Angebote benötigt.", fill: "Jetzt ergänzen",
    issued: "Bereits ausgestellte Rechnungen bleiben unverändert; neue Rechnungen, Entwürfe und Angebote verwenden die neue Adresse." },
  en: { company: "Company details", edit: "Edit", missing: "Address missing", contact: "Contact person", phone: "Phone", number: "Customer number",
    nameHint: "KM Code Craft changes the company name – please let support know.", addrHint: "Street and number, postcode and city, country – shown on invoices and quotes.",
    remind: "No address is on file for your company yet. Please add it – it is needed for invoices and quotes.", fill: "Add now",
    issued: "Invoices already issued stay unchanged; new invoices, drafts and quotes use the new address." },
  ar: { company: "بيانات الشركة", edit: "تعديل", missing: "العنوان غير موجود", contact: "الشخص المسؤول", phone: "الهاتف", number: "رقم العميل",
    nameHint: "يتم تعديل اسم الشركة من قبل KM Code Craft – يرجى التواصل مع الدعم.", addrHint: "الشارع والرقم، المدينة، البلد – يظهر في الفواتير والعروض.",
    remind: "لا يوجد عنوان مسجّل لشركتكم بعد. يرجى إضافته – فهو مطلوب للفواتير والعروض.", fill: "إضافة الآن",
    issued: "الفواتير الصادرة سابقاً تبقى كما هي؛ الفواتير الجديدة والمسودات والعروض تستخدم العنوان الجديد." },
};

/** Formular für Firmendaten; `staff` darf auch den Namen ändern */
export function OrgForm({ org, staff, onSaved, onCancel }: { org: OrgData; staff: boolean; onSaved: () => void; onCancel?: () => void }) {
  const { t, locale } = useI18n();
  const T = CT[locale];
  const [f, setF] = useState({
    name: org.name, address: org.address, vat_id: org.vat_id ?? "", email: org.email ?? "",
    contact_name: org.contact_name ?? "", phone: org.phone ?? "", locale: org.locale,
  });
  const s = useSubmit();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={s.run(async () => {
      const { name, ...rest } = f;
      await api(`/api/v1/organizations/${org.id}`, { method: "PATCH", body: staff ? { name, ...rest } : rest });
      onSaved();
    })}>
      {staff ? (
        <Field label={t("p.customer")}><input required dir="auto" value={f.name} onChange={set("name")} /></Field>
      ) : (
        <Field label={t("p.customer")}><input disabled dir="auto" value={f.name} /><small className="muted">{T.nameHint}</small></Field>
      )}
      <Field label={t("p.address")}>
        <textarea required rows={3} dir="auto" value={f.address} onChange={set("address")} />
        <small className="muted">{T.addrHint}</small>
      </Field>
      <div className="grid2">
        <Field label={T.contact}><input dir="auto" value={f.contact_name} onChange={set("contact_name")} /></Field>
        <Field label={T.phone}><input type="tel" dir="ltr" value={f.phone} onChange={set("phone")} /></Field>
        <Field label={t("p.email")}><input type="email" dir="ltr" value={f.email} onChange={set("email")} /></Field>
        <Field label={t("p.vat_id")}><input dir="ltr" value={f.vat_id} onChange={set("vat_id")} /></Field>
        <Field label={t("p.language")}>
          <select value={f.locale} onChange={set("locale")}>
            <option value="de">Deutsch</option><option value="en">English</option><option value="ar">العربية</option>
          </select>
        </Field>
      </div>
      <p className="muted"><small>{T.issued}</small></p>
      {s.error && <div className="alert">{s.error}</div>}
      {s.done && <div className="alert ok">{t("p.saved")}</div>}
      <div className="row">
        <button className="btn" disabled={s.busy}>{t("p.save")}</button>
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>{t("p.cancel")}</button>}
      </div>
    </form>
  );
}

/** Team: Firmendaten im Dialog bearbeiten */
export function OrgEditDialog({ org, onClose, onSaved }: { org: OrgData; onClose: () => void; onSaved: () => void }) {
  const { locale } = useI18n();
  return (
    <Modal title={`${CT[locale].company} – ${org.name}`} onClose={onClose}>
      <OrgForm org={org} staff onSaved={() => { onSaved(); onClose(); }} onCancel={onClose} />
    </Modal>
  );
}

/** Kunde: eigene Firmendaten unter „Konto“ */
export function CompanyCard() {
  const { locale } = useI18n();
  const { data, reload } = useApi<OrgData[]>("/api/v1/organizations");
  const org = data?.[0];
  if (!org) return null;
  return (
    <div className="card" id="firma" style={{ marginTop: 16 }}>
      <h3>{CT[locale].company}{org.customer_number && <small className="muted" dir="ltr"> · {org.customer_number}</small>}</h3>
      <OrgForm key={org.id} org={org} staff={false} onSaved={reload} />
    </div>
  );
}

/** Kunde ohne Adresse: Hinweis oben im Portal */
export function AddressReminder() {
  const { locale } = useI18n();
  const { me } = useAuth();
  const { data } = useApi<OrgData[]>(me && !me.is_employee ? "/api/v1/organizations" : null);
  const org = data?.[0];
  if (!org || org.address.trim()) return null;
  return (
    <div className="alert" role="status" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <span style={{ flex: 1 }}>⚠️ {CT[locale].remind}</span>
      <Link className="btn small" to="/portal/konto#firma">{CT[locale].fill}</Link>
    </div>
  );
}
