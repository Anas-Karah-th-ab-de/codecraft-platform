// Selbstregistrierung: Kunde legt Konto und Firma an (/portal/registrieren),
// aktiv nach Klick auf den Link aus der E-Mail (/portal/registrieren/bestaetigen?t=…).
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../api";
import { useI18n } from "../../i18n";
import { Field, LangSwitch } from "../../ui";

const R = {
  de: {
    link: "Noch kein Konto?", linkGo: "Konto erstellen",
    h: "Konto erstellen", lead: "Für Kunden: Ihr Zugang zu Projekten, Tickets, Rechnungen und Nachrichten.",
    you: "Ihre Kontaktdaten", firm: "Ihre Firma",
    name: "Vor- und Nachname", email: "E-Mail", phone: "Telefon (optional)", pw: "Passwort (mindestens 10 Zeichen)",
    company: "Firmenname", address: "Adresse", vat: "USt-IdNr. (optional)",
    submit: "Konto erstellen", have: "Schon ein Konto?", login: "Anmelden",
    sentH: "Fast geschafft.", sent: (e: string) => `Wir haben einen Link an ${e} geschickt. Öffnen Sie ihn innerhalb von 48 Stunden, um Konto und Firma zu aktivieren. Keine E-Mail? Schauen Sie auch im Spam-Ordner nach.`,
    checking: "Konto wird aktiviert …", okH: "Ihr Konto ist aktiv.", ok: "Sie können sich jetzt mit Ihrer E-Mail und Ihrem Passwort anmelden.",
    bad: "Der Link ist ungültig oder abgelaufen. Bitte registrieren Sie sich erneut.", exists: "Für diese E-Mail gibt es bereits ein Konto. Bitte melden Sie sich an.",
    many: "Zu viele Versuche. Bitte versuchen Sie es in einer Stunde erneut.", invalid: "Bitte prüfen Sie Ihre Angaben.", short: "Das Passwort braucht mindestens 10 Zeichen.",
    again: "Erneut registrieren", privacy: "Ihre Daten nutzen wir nur für Ihr Kundenkonto.",
  },
  en: {
    link: "No account yet?", linkGo: "Create account",
    h: "Create account", lead: "For customers: your access to projects, tickets, invoices and messages.",
    you: "Your contact details", firm: "Your company",
    name: "Full name", email: "Email", phone: "Phone (optional)", pw: "Password (at least 10 characters)",
    company: "Company name", address: "Address", vat: "VAT ID (optional)",
    submit: "Create account", have: "Already have an account?", login: "Sign in",
    sentH: "Almost done.", sent: (e: string) => `We sent a link to ${e}. Open it within 48 hours to activate your account and company. No email? Check your spam folder too.`,
    checking: "Activating your account …", okH: "Your account is active.", ok: "You can now sign in with your email and password.",
    bad: "This link is invalid or has expired. Please register again.", exists: "There is already an account for this email. Please sign in.",
    many: "Too many attempts. Please try again in an hour.", invalid: "Please check your details.", short: "The password needs at least 10 characters.",
    again: "Register again", privacy: "We only use your details for your customer account.",
  },
  ar: {
    link: "ليس لديك حساب؟", linkGo: "أنشئ حساباً",
    h: "إنشاء حساب", lead: "للعملاء: الوصول إلى المشاريع والتذاكر والفواتير والرسائل.",
    you: "بيانات التواصل", firm: "شركتك",
    name: "الاسم الكامل", email: "البريد الإلكتروني", phone: "الهاتف (اختياري)", pw: "كلمة المرور (10 أحرف على الأقل)",
    company: "اسم الشركة", address: "العنوان", vat: "الرقم الضريبي (اختياري)",
    submit: "إنشاء الحساب", have: "لديك حساب؟", login: "تسجيل الدخول",
    sentH: "اقتربنا من النهاية.", sent: (e: string) => `أرسلنا رابطاً إلى ${e}. افتحه خلال 48 ساعة لتفعيل حسابك وشركتك. لم تصلك الرسالة؟ تحقق أيضاً من مجلد الرسائل غير المرغوب فيها.`,
    checking: "جارٍ تفعيل الحساب …", okH: "حسابك مفعّل.", ok: "يمكنك الآن تسجيل الدخول ببريدك الإلكتروني وكلمة المرور.",
    bad: "الرابط غير صالح أو منتهي الصلاحية. يرجى التسجيل من جديد.", exists: "يوجد حساب بهذا البريد الإلكتروني بالفعل. يرجى تسجيل الدخول.",
    many: "محاولات كثيرة. يرجى المحاولة بعد ساعة.", invalid: "يرجى التحقق من البيانات.", short: "كلمة المرور تحتاج 10 أحرف على الأقل.",
    again: "التسجيل من جديد", privacy: "نستخدم بياناتك لحساب العميل فقط.",
  },
};

/** Hinweis unter dem Anmeldeformular */
export function RegisterLink() {
  const { locale } = useI18n();
  const T = R[locale];
  return <p className="login-alt">{T.link} <Link to="/portal/registrieren">{T.linkGo}</Link></p>;
}

function Shell({ art, children }: { art: ReactNode; children: ReactNode }) {
  return (
    <div className="login-wrap">
      {art}
      <div className="login-side">
        <div className="row between" style={{ marginBottom: 14 }}>
          <Link to="/" className="logo"><img src="/brand/logo.png" alt="KM Code Craft" width="95" height="40" /></Link>
          <LangSwitch />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Register({ art }: { art: ReactNode }) {
  const { pathname } = useLocation();
  return pathname.includes("/bestaetigen") ? <Confirm art={art} /> : <SignupForm art={art} />;
}

function SignupForm({ art }: { art: ReactNode }) {
  const { locale } = useI18n();
  const T = R[locale];
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", company: "", address: "", vat_id: "", website: "" });
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  useEffect(() => { document.title = `${T.h} · KM Code Craft`; }, [T.h]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 10) return setErr(T.short);
    setBusy(true);
    setErr(null);
    try {
      await api("/api/v1/public/register", { body: { ...f, locale } });
      setSent(f.email.trim());
    } catch (e: any) {
      setErr(e.status === 429 ? T.many : T.invalid);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Shell art={art}>
        <h2>{T.sentH}</h2>
        <p className="login-note">{T.sent(sent)}</p>
        <Link className="btn ghost" to="/portal">{T.login}</Link>
      </Shell>
    );
  }
  return (
    <Shell art={art}>
      <form onSubmit={submit} className="reg-form">
        <h2>{T.h}</h2>
        <p className="login-note">{T.lead}</p>
        <fieldset>
          <legend>{T.you}</legend>
          <Field label={T.name}><input required maxLength={200} autoComplete="name" value={f.name} onChange={set("name")} /></Field>
          <Field label={T.email}><input type="email" dir="ltr" required maxLength={254} autoComplete="email" value={f.email} onChange={set("email")} /></Field>
          <Field label={T.phone}><input type="tel" dir="ltr" maxLength={40} autoComplete="tel" value={f.phone} onChange={set("phone")} /></Field>
          <Field label={T.pw}><input type="password" dir="ltr" required minLength={10} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
        </fieldset>
        <fieldset>
          <legend>{T.firm}</legend>
          <Field label={T.company}><input required maxLength={200} autoComplete="organization" value={f.company} onChange={set("company")} /></Field>
          <Field label={T.address}><textarea rows={2} maxLength={500} autoComplete="street-address" value={f.address} onChange={set("address")} /></Field>
          <Field label={T.vat}><input dir="ltr" maxLength={40} value={f.vat_id} onChange={set("vat_id")} /></Field>
        </fieldset>
        {/* Falle für Bots – für Menschen unsichtbar */}
        <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} />
        {err && <div className="alert">{err}</div>}
        <button className="btn" disabled={busy}>{T.submit}</button>
        <p className="login-alt">{T.have} <Link to="/portal">{T.login}</Link></p>
        <p className="login-fine">{T.privacy}</p>
      </form>
    </Shell>
  );
}

function Confirm({ art }: { art: ReactNode }) {
  const { locale } = useI18n();
  const T = R[locale];
  const { search } = useLocation();
  const token = new URLSearchParams(search).get("t") ?? "";
  const [state, setState] = useState<"busy" | "ok" | "bad" | "exists" | "many">("busy");
  const sentOnce = useRef(false);
  useEffect(() => {
    if (sentOnce.current) return; // Link nur einmal einlösen (StrictMode ruft Effekte doppelt auf)
    sentOnce.current = true;
    if (!token) { setState("bad"); return; }
    api("/api/v1/public/register/confirm", { body: { token } })
      .then(() => setState("ok"))
      .catch((e: any) => setState(e.status === 409 ? "exists" : e.status === 429 ? "many" : "bad"));
  }, [token]);
  return (
    <Shell art={art}>
      {state === "busy" && <p className="login-note">{T.checking}</p>}
      {state === "ok" && (<><h2>{T.okH}</h2><p className="login-note">{T.ok}</p><Link className="btn" to="/portal">{T.login}</Link></>)}
      {state === "exists" && (<><p className="login-note">{T.exists}</p><Link className="btn" to="/portal">{T.login}</Link></>)}
      {(state === "bad" || state === "many") && (<><div className="alert">{state === "many" ? T.many : T.bad}</div><Link className="btn ghost" to="/portal/registrieren">{T.again}</Link></>)}
    </Shell>
  );
}
