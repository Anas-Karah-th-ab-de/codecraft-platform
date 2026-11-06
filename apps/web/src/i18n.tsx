import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "de" | "en" | "ar";
export const LOCALES: Locale[] = ["de", "en", "ar"];
export const LOCALE_NAMES: Record<Locale, string> = { de: "Deutsch", en: "English", ar: "العربية" };

const de = {
  "bopt.one_time": "Einmalig", "bopt.hourly": "Pro Stunde", "bopt.monthly": "Monatlich", "bopt.yearly": "Jährlich", "bopt.on_request": "Auf Anfrage", "unit.hour": "Stunde", "unit.piece": "Stück", "unit.day": "Tag", "unit.month": "Monat", "unit.flat": "Pauschal", "p.unit": "Einheit", "p.notes": "Notizen",
  "nav.home": "Start", "nav.products": "Produkte", "nav.careers": "Karriere", "nav.contact": "Kontakt", "nav.portal": "Portal",
  "home.title": "Software, KI-Server und Kassensysteme – aus einer Hand.",
  "home.sub": "Wir entwickeln, betreiben und betreuen Ihre IT. Datenschutzfreundlich, auch komplett offline.",
  "home.cta": "Produkte ansehen", "home.contact": "Projekt anfragen", "home.departments": "Unsere Bereiche",
  "home.featured": "Beliebte Produkte",
  "products.title": "Produkte & Preise", "products.sub": "Alle Preise netto. Direkt aus unserem Katalog – immer aktuell.",
  "products.request": "Anfragen", "products.all": "Alle",
  "billing.one_time": "einmalig", "billing.hourly": "/ Std.", "billing.monthly": "/ Monat", "billing.yearly": "/ Jahr",
  "billing.on_request": "Preis auf Anfrage",
  "kind.software": "Software", "kind.hardware": "Hardware", "kind.service": "Dienstleistung", "kind.appliance": "Gerät", "kind.rental": "Miete",
  "careers.title": "Karriere", "careers.sub": "Werde Teil unseres Teams.", "careers.none": "Aktuell keine offenen Stellen.",
  "careers.apply": "Jetzt bewerben", "careers.remote": "Remote möglich", "careers.back": "Alle Stellen",
  "emp.full_time": "Vollzeit", "emp.part_time": "Teilzeit", "emp.internship": "Praktikum", "emp.freelance": "Freiberuflich",
  "form.name": "Name", "form.email": "E-Mail", "form.phone": "Telefon (optional)", "form.subject": "Betreff",
  "form.message": "Nachricht", "form.send": "Absenden", "form.sent": "Danke! Wir melden uns schnell bei Ihnen.",
  "form.error": "Senden fehlgeschlagen. Bitte Eingaben prüfen.", "form.product": "Produkt (optional)",
  "contact.title": "Kontakt", "contact.sub": "Schreiben Sie uns – wir antworten in der Regel innerhalb eines Werktags.",
  "footer.rights": "Alle Rechte vorbehalten.",
  "login.title": "Anmelden", "login.password": "Passwort", "login.submit": "Anmelden", "login.code": "6-stelliger Code aus der Authenticator-App",
  "login.verify": "Bestätigen", "login.failed": "E-Mail oder Passwort falsch.", "login.logout": "Abmelden",
  "p.dashboard": "Übersicht", "p.invoices": "Rechnungen", "p.customers": "Kunden", "p.products": "Produkte",
  "p.jobs": "Stellen", "p.requests": "Anfragen", "p.devices": "Geräte", "p.users": "Benutzer", "p.account": "Konto",
  "p.revenue": "Umsatz je Abteilung (netto, dieses Jahr)", "p.unassigned": "ohne Zuordnung",
  "p.open": "Offene Rechnungen", "p.new": "Neu", "p.save": "Speichern", "p.cancel": "Abbrechen", "p.create": "Anlegen",
  "p.status": "Status", "p.actions": "Aktionen", "p.total": "Gesamt", "p.date": "Datum", "p.number": "Nummer",
  "p.customer": "Kunde", "p.address": "Adresse", "p.vat_id": "USt-IdNr.", "p.language": "Sprache",
  "p.items": "Positionen", "p.add_item": "Position hinzufügen", "p.from_catalog": "Aus Katalog", "p.free_text": "Freitext",
  "p.qty": "Menge", "p.unit_price": "Einzelpreis (€)", "p.vat": "USt. %", "p.description": "Beschreibung",
  "p.issue": "Ausstellen", "p.pay": "Bezahlt", "p.storno": "Stornieren", "p.pdf": "PDF", "p.delete": "Löschen",
  "p.tax_mode": "Steuer", "tax.standard": "Standard", "tax.reverse_charge": "Reverse Charge", "tax.not_taxable": "Nicht steuerbar",
  "st.draft": "Entwurf", "st.issued": "Ausgestellt", "st.paid": "Bezahlt", "st.cancelled": "Storniert",
  "st.published": "Veröffentlicht", "st.closed": "Geschlossen", "st.new": "Neu",
  "p.net": "Netto", "p.tax": "USt.", "p.gross": "Brutto", "p.confirm_issue": "Rechnung ausstellen? Danach ist sie nicht mehr änderbar.",
  "p.confirm_storno": "Rechnung per Gutschrift stornieren?",
  "p.department": "Abteilung", "p.sku": "Artikelnr.", "p.slug": "URL-Name", "p.kind": "Art", "p.device": "Gerätetyp",
  "p.public": "Öffentlich", "p.active": "Aktiv", "p.prices": "Preise", "p.price_code": "Preis-Code", "p.billing": "Abrechnung",
  "p.amount": "Betrag (€)", "p.name_de": "Name (DE)", "p.name_en": "Name (EN)", "p.name_ar": "Name (AR)",
  "p.desc_de": "Beschreibung (DE)", "p.desc_en": "Beschreibung (EN)", "p.desc_ar": "Beschreibung (AR)", "p.none": "–",
  "p.add_price": "Preis hinzufügen", "p.new_product": "Neues Produkt", "p.new_job": "Neue Stelle", "p.applications": "Bewerbungen",
  "p.title_de": "Titel (DE)", "p.title_en": "Titel (EN)", "p.title_ar": "Titel (AR)", "p.summary": "Kurzbeschreibung",
  "p.location": "Ort", "p.employment": "Anstellung", "p.publish": "Veröffentlichen", "p.close": "Schließen",
  "p.email": "E-Mail", "p.role": "Rolle", "p.new_user": "Neuer Benutzer", "p.password": "Passwort (min. 10 Zeichen)",
  "p.2fa": "Zwei-Faktor-Anmeldung", "p.2fa_on": "2FA ist aktiv.", "p.2fa_off": "2FA ist nicht aktiv.",
  "p.2fa_setup": "2FA einrichten", "p.2fa_scan": "QR-Code mit einer Authenticator-App scannen und Code eingeben.",
  "p.2fa_disable": "2FA deaktivieren", "p.change_pw": "Passwort ändern", "p.current_pw": "Aktuelles Passwort", "p.new_pw": "Neues Passwort",
  "p.saved": "Gespeichert.", "p.register_device": "Gerät registrieren", "p.token_once": "Token nur jetzt sichtbar – auf dem Gerät speichern:",
  "p.online": "online", "p.offline": "offline", "p.version": "Version", "p.last_seen": "Zuletzt gesehen", "p.product": "Produkt",
  "p.empty": "Noch keine Einträge.", "p.loading": "Lädt…", "p.error": "Fehler", "p.search": "Suchen…",
};

type Dict = Record<keyof typeof de, string>;

const en: Dict = {
  "bopt.one_time": "One-time", "bopt.hourly": "Per hour", "bopt.monthly": "Monthly", "bopt.yearly": "Yearly", "bopt.on_request": "On request", "unit.hour": "Hour", "unit.piece": "Piece", "unit.day": "Day", "unit.month": "Month", "unit.flat": "Flat", "p.unit": "Unit", "p.notes": "Notes",
  "nav.home": "Home", "nav.products": "Products", "nav.careers": "Careers", "nav.contact": "Contact", "nav.portal": "Portal",
  "home.title": "Software, AI servers and POS systems – from a single source.",
  "home.sub": "We build, run and support your IT. Privacy-friendly, even fully offline.",
  "home.cta": "View products", "home.contact": "Request a project", "home.departments": "What we do",
  "home.featured": "Popular products",
  "products.title": "Products & pricing", "products.sub": "All prices net. Straight from our catalog – always up to date.",
  "products.request": "Request", "products.all": "All",
  "billing.one_time": "one-time", "billing.hourly": "/ hour", "billing.monthly": "/ month", "billing.yearly": "/ year",
  "billing.on_request": "Price on request",
  "kind.software": "Software", "kind.hardware": "Hardware", "kind.service": "Service", "kind.appliance": "Device", "kind.rental": "Rental",
  "careers.title": "Careers", "careers.sub": "Join our team.", "careers.none": "No open positions right now.",
  "careers.apply": "Apply now", "careers.remote": "Remote possible", "careers.back": "All positions",
  "emp.full_time": "Full-time", "emp.part_time": "Part-time", "emp.internship": "Internship", "emp.freelance": "Freelance",
  "form.name": "Name", "form.email": "Email", "form.phone": "Phone (optional)", "form.subject": "Subject",
  "form.message": "Message", "form.send": "Send", "form.sent": "Thank you! We'll get back to you soon.",
  "form.error": "Sending failed. Please check your input.", "form.product": "Product (optional)",
  "contact.title": "Contact", "contact.sub": "Write to us – we usually reply within one business day.",
  "footer.rights": "All rights reserved.",
  "login.title": "Sign in", "login.password": "Password", "login.submit": "Sign in", "login.code": "6-digit code from your authenticator app",
  "login.verify": "Verify", "login.failed": "Wrong email or password.", "login.logout": "Sign out",
  "p.dashboard": "Overview", "p.invoices": "Invoices", "p.customers": "Customers", "p.products": "Products",
  "p.jobs": "Jobs", "p.requests": "Requests", "p.devices": "Devices", "p.users": "Users", "p.account": "Account",
  "p.revenue": "Revenue by department (net, this year)", "p.unassigned": "unassigned",
  "p.open": "Open invoices", "p.new": "New", "p.save": "Save", "p.cancel": "Cancel", "p.create": "Create",
  "p.status": "Status", "p.actions": "Actions", "p.total": "Total", "p.date": "Date", "p.number": "Number",
  "p.customer": "Customer", "p.address": "Address", "p.vat_id": "VAT ID", "p.language": "Language",
  "p.items": "Items", "p.add_item": "Add item", "p.from_catalog": "From catalog", "p.free_text": "Free text",
  "p.qty": "Qty", "p.unit_price": "Unit price (€)", "p.vat": "VAT %", "p.description": "Description",
  "p.issue": "Issue", "p.pay": "Paid", "p.storno": "Cancel invoice", "p.pdf": "PDF", "p.delete": "Delete",
  "p.tax_mode": "Tax", "tax.standard": "Standard", "tax.reverse_charge": "Reverse charge", "tax.not_taxable": "Not taxable",
  "st.draft": "Draft", "st.issued": "Issued", "st.paid": "Paid", "st.cancelled": "Cancelled",
  "st.published": "Published", "st.closed": "Closed", "st.new": "New",
  "p.net": "Net", "p.tax": "VAT", "p.gross": "Gross", "p.confirm_issue": "Issue invoice? It can no longer be changed afterwards.",
  "p.confirm_storno": "Cancel this invoice with a credit note?",
  "p.department": "Department", "p.sku": "SKU", "p.slug": "URL name", "p.kind": "Type", "p.device": "Device type",
  "p.public": "Public", "p.active": "Active", "p.prices": "Prices", "p.price_code": "Price code", "p.billing": "Billing",
  "p.amount": "Amount (€)", "p.name_de": "Name (DE)", "p.name_en": "Name (EN)", "p.name_ar": "Name (AR)",
  "p.desc_de": "Description (DE)", "p.desc_en": "Description (EN)", "p.desc_ar": "Description (AR)", "p.none": "–",
  "p.add_price": "Add price", "p.new_product": "New product", "p.new_job": "New position", "p.applications": "Applications",
  "p.title_de": "Title (DE)", "p.title_en": "Title (EN)", "p.title_ar": "Title (AR)", "p.summary": "Summary",
  "p.location": "Location", "p.employment": "Employment", "p.publish": "Publish", "p.close": "Close",
  "p.email": "Email", "p.role": "Role", "p.new_user": "New user", "p.password": "Password (min. 10 characters)",
  "p.2fa": "Two-factor sign-in", "p.2fa_on": "2FA is active.", "p.2fa_off": "2FA is not active.",
  "p.2fa_setup": "Set up 2FA", "p.2fa_scan": "Scan the QR code with an authenticator app and enter the code.",
  "p.2fa_disable": "Disable 2FA", "p.change_pw": "Change password", "p.current_pw": "Current password", "p.new_pw": "New password",
  "p.saved": "Saved.", "p.register_device": "Register device", "p.token_once": "Token shown only once – store it on the device:",
  "p.online": "online", "p.offline": "offline", "p.version": "Version", "p.last_seen": "Last seen", "p.product": "Product",
  "p.empty": "No entries yet.", "p.loading": "Loading…", "p.error": "Error", "p.search": "Search…",
};

const ar: Dict = {
  "bopt.one_time": "لمرة واحدة", "bopt.hourly": "بالساعة", "bopt.monthly": "شهرياً", "bopt.yearly": "سنوياً", "bopt.on_request": "عند الطلب", "unit.hour": "ساعة", "unit.piece": "قطعة", "unit.day": "يوم", "unit.month": "شهر", "unit.flat": "مقطوع", "p.unit": "الوحدة", "p.notes": "ملاحظات",
  "nav.home": "الرئيسية", "nav.products": "المنتجات", "nav.careers": "الوظائف", "nav.contact": "اتصل بنا", "nav.portal": "البوابة",
  "home.title": "برمجيات وخوادم ذكاء اصطناعي وأنظمة نقاط بيع – من مصدر واحد.",
  "home.sub": "نطوّر تقنيتك ونشغّلها وندعمها. مع حماية الخصوصية، وحتى دون اتصال بالإنترنت.",
  "home.cta": "عرض المنتجات", "home.contact": "اطلب مشروعاً", "home.departments": "مجالات عملنا",
  "home.featured": "منتجات مميزة",
  "products.title": "المنتجات والأسعار", "products.sub": "جميع الأسعار صافية. مباشرة من كتالوجنا – محدّثة دائماً.",
  "products.request": "اطلب الآن", "products.all": "الكل",
  "billing.one_time": "لمرة واحدة", "billing.hourly": "/ ساعة", "billing.monthly": "/ شهر", "billing.yearly": "/ سنة",
  "billing.on_request": "السعر عند الطلب",
  "kind.software": "برمجيات", "kind.hardware": "أجهزة", "kind.service": "خدمة", "kind.appliance": "جهاز", "kind.rental": "إيجار",
  "careers.title": "الوظائف", "careers.sub": "انضم إلى فريقنا.", "careers.none": "لا توجد وظائف شاغرة حالياً.",
  "careers.apply": "قدّم الآن", "careers.remote": "العمل عن بُعد ممكن", "careers.back": "كل الوظائف",
  "emp.full_time": "دوام كامل", "emp.part_time": "دوام جزئي", "emp.internship": "تدريب", "emp.freelance": "عمل حر",
  "form.name": "الاسم", "form.email": "البريد الإلكتروني", "form.phone": "الهاتف (اختياري)", "form.subject": "الموضوع",
  "form.message": "الرسالة", "form.send": "إرسال", "form.sent": "شكراً لك! سنتواصل معك قريباً.",
  "form.error": "تعذّر الإرسال. يرجى التحقق من البيانات.", "form.product": "المنتج (اختياري)",
  "contact.title": "اتصل بنا", "contact.sub": "راسلنا – نرد عادةً خلال يوم عمل واحد.",
  "footer.rights": "جميع الحقوق محفوظة.",
  "login.title": "تسجيل الدخول", "login.password": "كلمة المرور", "login.submit": "دخول", "login.code": "رمز من 6 أرقام من تطبيق المصادقة",
  "login.verify": "تأكيد", "login.failed": "البريد أو كلمة المرور غير صحيحة.", "login.logout": "تسجيل الخروج",
  "p.dashboard": "نظرة عامة", "p.invoices": "الفواتير", "p.customers": "العملاء", "p.products": "المنتجات",
  "p.jobs": "الوظائف", "p.requests": "الطلبات", "p.devices": "الأجهزة", "p.users": "المستخدمون", "p.account": "الحساب",
  "p.revenue": "الإيرادات حسب القسم (صافي، هذا العام)", "p.unassigned": "غير مصنّف",
  "p.open": "فواتير مفتوحة", "p.new": "جديد", "p.save": "حفظ", "p.cancel": "إلغاء", "p.create": "إنشاء",
  "p.status": "الحالة", "p.actions": "إجراءات", "p.total": "الإجمالي", "p.date": "التاريخ", "p.number": "الرقم",
  "p.customer": "العميل", "p.address": "العنوان", "p.vat_id": "الرقم الضريبي", "p.language": "اللغة",
  "p.items": "البنود", "p.add_item": "إضافة بند", "p.from_catalog": "من الكتالوج", "p.free_text": "نص حر",
  "p.qty": "الكمية", "p.unit_price": "سعر الوحدة (€)", "p.vat": "الضريبة %", "p.description": "الوصف",
  "p.issue": "إصدار", "p.pay": "مدفوعة", "p.storno": "إلغاء الفاتورة", "p.pdf": "PDF", "p.delete": "حذف",
  "p.tax_mode": "الضريبة", "tax.standard": "عادية", "tax.reverse_charge": "احتساب عكسي", "tax.not_taxable": "غير خاضعة",
  "st.draft": "مسودة", "st.issued": "صادرة", "st.paid": "مدفوعة", "st.cancelled": "ملغاة",
  "st.published": "منشورة", "st.closed": "مغلقة", "st.new": "جديد",
  "p.net": "الصافي", "p.tax": "الضريبة", "p.gross": "الإجمالي", "p.confirm_issue": "إصدار الفاتورة؟ لن يمكن تعديلها بعد ذلك.",
  "p.confirm_storno": "إلغاء الفاتورة بإشعار دائن؟",
  "p.department": "القسم", "p.sku": "رمز المنتج", "p.slug": "اسم الرابط", "p.kind": "النوع", "p.device": "نوع الجهاز",
  "p.public": "عام", "p.active": "نشط", "p.prices": "الأسعار", "p.price_code": "رمز السعر", "p.billing": "طريقة الفوترة",
  "p.amount": "المبلغ (€)", "p.name_de": "الاسم (ألماني)", "p.name_en": "الاسم (إنجليزي)", "p.name_ar": "الاسم (عربي)",
  "p.desc_de": "الوصف (ألماني)", "p.desc_en": "الوصف (إنجليزي)", "p.desc_ar": "الوصف (عربي)", "p.none": "–",
  "p.add_price": "إضافة سعر", "p.new_product": "منتج جديد", "p.new_job": "وظيفة جديدة", "p.applications": "طلبات التوظيف",
  "p.title_de": "العنوان (ألماني)", "p.title_en": "العنوان (إنجليزي)", "p.title_ar": "العنوان (عربي)", "p.summary": "ملخص",
  "p.location": "الموقع", "p.employment": "نوع التوظيف", "p.publish": "نشر", "p.close": "إغلاق",
  "p.email": "البريد الإلكتروني", "p.role": "الدور", "p.new_user": "مستخدم جديد", "p.password": "كلمة المرور (10 أحرف على الأقل)",
  "p.2fa": "التحقق بخطوتين", "p.2fa_on": "التحقق بخطوتين مفعّل.", "p.2fa_off": "التحقق بخطوتين غير مفعّل.",
  "p.2fa_setup": "تفعيل التحقق بخطوتين", "p.2fa_scan": "امسح رمز QR بتطبيق المصادقة وأدخل الرمز.",
  "p.2fa_disable": "إيقاف التحقق بخطوتين", "p.change_pw": "تغيير كلمة المرور", "p.current_pw": "كلمة المرور الحالية", "p.new_pw": "كلمة المرور الجديدة",
  "p.saved": "تم الحفظ.", "p.register_device": "تسجيل جهاز", "p.token_once": "الرمز يظهر مرة واحدة فقط – احفظه على الجهاز:",
  "p.online": "متصل", "p.offline": "غير متصل", "p.version": "الإصدار", "p.last_seen": "آخر ظهور", "p.product": "المنتج",
  "p.empty": "لا توجد إدخالات بعد.", "p.loading": "جارٍ التحميل…", "p.error": "خطأ", "p.search": "بحث…",
};

const DICTS: Record<Locale, Dict> = { de, en, ar };
export type Key = keyof typeof de;

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (k: Key) => string };
const I18nCtx = createContext<Ctx>({ locale: "de", setLocale: () => {}, t: (k) => de[k] });

function initial(): Locale {
  const saved = localStorage.getItem("locale") as Locale | null;
  if (saved && LOCALES.includes(saved)) return saved;
  const nav = navigator.language.slice(0, 2);
  return nav === "ar" ? "ar" : nav === "en" ? "en" : "de";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initial);
  useEffect(() => {
    localStorage.setItem("locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);
  return <I18nCtx.Provider value={{ locale, setLocale, t: (k) => DICTS[locale][k] ?? k }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);

const intlLocale = (l: Locale) => (l === "ar" ? "ar-SY-u-nu-latn" : l === "en" ? "en-GB" : "de-DE");

export function money(cents: number | null | undefined, locale: Locale, currency = "EUR") {
  if (cents == null) return "–";
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(cents / 100);
}

export function fmtDate(d: string | null | undefined, locale: Locale) {
  if (!d) return "–";
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(new Date(d));
}
