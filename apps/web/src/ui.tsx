import { useState, type FormEvent, type ReactNode } from "react";
import { LOCALES, LOCALE_NAMES, useI18n, type Locale } from "./i18n";

export function LangSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <span className="lang">
      <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} aria-label="Language">
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Badge({ s }: { s: string }) {
  const { t } = useI18n();
  const key = `st.${s}` as any;
  const text = t(key);
  return <span className={`badge ${s}`}>{text === key ? s : text}</span>;
}

export function Loading({ error }: { error?: string | null }) {
  const { t } = useI18n();
  return error ? <div className="alert">{error}</div> : <div className="spin">{t("p.loading")}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Formular mit Senden-Zustand, Fehler- und Erfolgsmeldung */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const run = (fn: () => Promise<unknown>) => async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await fn();
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Fehler");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, done, run, setDone };
}

/** Eingabe in Euro → Cent */
export const toCents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100);
