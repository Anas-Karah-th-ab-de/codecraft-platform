import { lang, make, t, topBar } from "./demo.js";

topBar("home");
const text = {
  h1: { ar: "جرّب النظام بنفسك", en: "Try the system yourself", de: "Das System selbst ausprobieren" },
  lead: {
    ar: "جولتان قصيرتان بمحتوى ثابت. تنقر وتسحب كما في النظام، أو تترك العرض يعمل وحده.",
    en: "Two short tours with fixed content. You click and drag as in the system, or let the demo run by itself.",
    de: "Zwei kurze Rundgänge mit festen Inhalten. Sie klicken und ziehen wie im System – oder lassen die Demo von selbst laufen.",
  },
  go: { ar: "ابدأ ←", en: "Start →", de: "Starten →" },
  cards: [
    {
      file: "viewer.html",
      h: { ar: "العارض", en: "The viewer", de: "Der Viewer" },
      p: {
        ar: "صور مقطعية حقيقية من مجموعات بحثية عامة: تصفّح، غيّر النافذة، قِس، قارن مع الفحص السابق.",
        en: "Real CT images from public research collections: scroll, change the window, measure, compare with the earlier examination.",
        de: "Echte CT-Aufnahmen aus öffentlichen Forschungssammlungen: blättern, fenstern, messen, mit der Voruntersuchung vergleichen.",
      },
      items: [
        { ar: "التصفّح والنوافذ والقياس", en: "Scrolling, windows, measuring", de: "Blättern, Fenster, Messen" },
        { ar: "متابعة الحالة: خريطة الفرق", en: "Follow-up: difference map", de: "Verlauf: Differenzkarte" },
        { ar: "PET فوق CT", en: "PET over CT", de: "PET über CT" },
        { ar: "عرض ثلاثي الأبعاد", en: "3D view", de: "3D-Ansicht" },
      ],
    },
    {
      file: "workflow.html",
      h: { ar: "سير العمل", en: "The workflow", de: "Der Ablauf" },
      p: {
        ar: "مريض واحد من الاستقبال حتى التقرير المعتمد، خطوة بخطوة.",
        en: "One patient from reception to the released report, step by step.",
        de: "Ein Patient vom Empfang bis zum freigegebenen Befund, Schritt für Schritt.",
      },
      items: [
        { ar: "التسجيل والموعد", en: "Registration and appointment", de: "Anmeldung und Termin" },
        { ar: "استبيان المريض ولوحة اليوم", en: "Patient questionnaire and day board", de: "Patientenfragebogen und Tagesübersicht" },
        { ar: "التقرير والإملاء والاعتماد", en: "Report, dictation, release", de: "Befund, Diktat, Freigabe" },
        { ar: "وصول المريض برمز QR", en: "Patient access by QR code", de: "Patientenzugang per QR-Code" },
      ],
    },
  ],
};
document.title = `KM Code Craft Radiology – ${t(text.h1)}`;
document.getElementById("main").append(
  make("h1", { text: t(text.h1) }),
  make("p", { class: "dim", text: t(text.lead) }),
  make(
    "div",
    { class: "cards" },
    text.cards.map((card) =>
      make("a", { class: "card", href: `${card.file}?lang=${lang}` }, [
        make("h2", { text: t(card.h) }),
        make("p", { class: "dim", text: t(card.p) }),
        make("ul", {}, card.items.map((item) => make("li", { text: t(item) }))),
        make("span", { class: "go", text: t(text.go) }),
      ]),
    ),
  ),
);
