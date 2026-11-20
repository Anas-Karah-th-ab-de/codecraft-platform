// The workflow part of the demo: one invented patient from reception to the released report.
// A hand-built imitation with fixed content - it shows the order of the work, not the real screens.
import { lang, make, sleep, t, topBar } from "./demo.js";

topBar("workflow");

const T = {
  title: { ar: "سير العمل – مريض واحد من الاستقبال حتى التقرير", en: "The workflow – one patient from reception to the report", de: "Der Ablauf – ein Patient vom Empfang bis zum Befund" },
  playAll: { ar: "▶ اعرض كل شيء", en: "▶ Show everything", de: "▶ Alles vorführen" },
  stop: { ar: "■ إيقاف", en: "■ Stop", de: "■ Anhalten" },
  next: { ar: "التالي", en: "Next", de: "Weiter" },
  back: { ar: "السابق", en: "Back", de: "Zurück" },
  restart: { ar: "من البداية", en: "Start over", de: "Von vorn" },
  log: { ar: "ما سجّله النظام (سجل التدقيق)", en: "What the system recorded (audit trail)", de: "Was das System festgehalten hat (Protokoll)" },
  patient: { ar: "لينا نموذج", en: "Lina Sample", de: "Lina Muster" },
  born: "1968-03-14",
  number: "P-2026-0412",
  exam: { ar: "تصوير مقطعي للصدر مع مادة تباين", en: "Chest CT with contrast", de: "CT Thorax mit Kontrastmittel" },
  device: "CT 1",
  name: { ar: "الاسم", en: "Name", de: "Name" },
  birth: { ar: "تاريخ الميلاد", en: "Date of birth", de: "Geburtsdatum" },
  no: { ar: "الرقم", en: "Number", de: "Nummer" },
  status: { ar: "الحالة", en: "Status", de: "Status" },
  time: { ar: "الوقت", en: "Time", de: "Zeit" },
  // roles
  rReception: { ar: "الاستقبال", en: "Reception", de: "Anmeldung" },
  rPlanning: { ar: "تنظيم المواعيد", en: "Scheduling", de: "Terminplanung" },
  rPatient: { ar: "المريض (هاتفه)", en: "Patient (own phone)", de: "Patient (eigenes Handy)" },
  rTech: { ar: "فنّي الأشعة", en: "Radiographer", de: "MTR" },
  rRadiologist: { ar: "طبيب الأشعة", en: "Radiologist", de: "Radiologe" },
  rSenior: { ar: "القارئ الثاني", en: "Second reader", de: "Zweitleser" },
  // step 0
  newPatient: { ar: "مريض جديد", en: "New patient", de: "Neuer Patient" },
  save: { ar: "حفظ", en: "Save", de: "Speichern" },
  today: { ar: "مرضى اليوم", en: "Today's patients", de: "Patienten heute" },
  searchFirst: { ar: "ابحث أولًا، ثم أنشئ: لا يوجد مريض بهذا الاسم وتاريخ الميلاد.", en: "Search first, then create: no patient with this name and date of birth.", de: "Erst suchen, dann anlegen: kein Patient mit diesem Namen und Geburtsdatum vorhanden." },
  lRecord: { ar: "أُنشئ ملف المريض", en: "Patient record created", de: "Patientenakte angelegt" },
  // step 1
  examLabel: { ar: "الفحص", en: "Examination", de: "Untersuchung" },
  slotLabel: { ar: "موعد على", en: "Slot on", de: "Termin an" },
  busy: { ar: "محجوز", en: "taken", de: "belegt" },
  conflict: { ar: "هذا الوقت محجوز على الجهاز – النظام يمنع الحجز المزدوج.", en: "This time is taken on the device – the system prevents double booking.", de: "Diese Zeit ist am Gerät belegt – das System verhindert die Doppelbelegung." },
  book: { ar: "احجز الموعد", en: "Book the appointment", de: "Termin vergeben" },
  booked: { ar: "تم الحجز. يظهر الفحص في قائمة العمل على الجهاز (DICOM Worklist)، والمريض يتلقى رابط الاستبيان.", en: "Booked. The examination appears in the worklist at the device (DICOM worklist), and the patient receives the questionnaire link.", de: "Vergeben. Die Untersuchung erscheint in der Arbeitsliste am Gerät (DICOM-Worklist), der Patient erhält den Link zum Fragebogen." },
  lOrder: { ar: "طلب فحص وموعد", en: "Order and appointment", de: "Auftrag und Termin" },
  // step 2
  qTitle: { ar: "قبل فحصك", en: "Before your examination", de: "Vor Ihrer Untersuchung" },
  qLead: { ar: "دون حساب ودون تطبيق – عبر الرابط أو رمز QR.", en: "No account, no app – by link or QR code.", de: "Ohne Konto, ohne App – per Link oder QR-Code." },
  q1: { ar: "هل لديك منظّم لضربات القلب؟", en: "Do you have a pacemaker?", de: "Tragen Sie einen Herzschrittmacher?" },
  q2: { ar: "هل لديك حساسية من مادة التباين؟", en: "Are you allergic to contrast medium?", de: "Sind Sie gegen Kontrastmittel allergisch?" },
  q3: { ar: "هل تتناول ميتفورمين؟", en: "Do you take metformin?", de: "Nehmen Sie Metformin?" },
  yes: { ar: "نعم", en: "Yes", de: "Ja" },
  nope: { ar: "لا", en: "No", de: "Nein" },
  send: { ar: "إرسال", en: "Send", de: "Absenden" },
  sent: { ar: "شكرًا. وصلت إجاباتك إلى الفريق.", en: "Thank you. Your answers have reached the team.", de: "Danke. Ihre Antworten sind beim Team angekommen." },
  teamSees: { ar: "ما يراه الفريق", en: "What the team sees", de: "Was das Team sieht" },
  warnAllergy: { ar: "⚠ تحذير من الاستبيان: حساسية من مادة التباين", en: "⚠ Warning from the questionnaire: contrast allergy", de: "⚠ Warnung aus dem Fragebogen: Kontrastmittelallergie" },
  noWarn: { ar: "لا تحذيرات من الاستبيان.", en: "No warnings from the questionnaire.", de: "Keine Warnungen aus dem Fragebogen." },
  waiting: { ar: "بانتظار إجابات المريض …", en: "Waiting for the patient's answers …", de: "Wartet auf die Antworten des Patienten …" },
  lQuestion: { ar: "أجاب المريض على الاستبيان", en: "Patient answered the questionnaire", de: "Patient hat den Fragebogen beantwortet" },
  // step 3
  cExpected: { ar: "متوقَّع اليوم", en: "Expected today", de: "Heute erwartet" },
  cWaiting: { ar: "غرفة الانتظار", en: "Waiting room", de: "Wartezimmer" },
  cDevice: { ar: "في الجهاز", en: "In the device", de: "Im Gerät" },
  cDone: { ar: "انتهى", en: "Done", de: "Fertig" },
  arrive: { ar: "وصل", en: "Arrived", de: "Angekommen" },
  start: { ar: "ابدأ الفحص", en: "Start examination", de: "Untersuchung starten" },
  finish: { ar: "انتهى الفحص", en: "Examination finished", de: "Untersuchung fertig" },
  free: { ar: "متاح", en: "free", de: "frei" },
  occupied: { ar: "مشغول", en: "occupied", de: "belegt" },
  imagesIn: { ar: "وصلت الصور إلى الأرشيف ورُبطت بالطلب تلقائيًا.", en: "The images have arrived in the archive and were matched to the order by themselves.", de: "Die Bilder sind im Archiv angekommen und wurden dem Auftrag von selbst zugeordnet." },
  lArrive: { ar: "تسجيل الوصول", en: "Arrival recorded", de: "Ankunft erfasst" },
  lStart: { ar: "بدء الفحص", en: "Examination started", de: "Untersuchung begonnen" },
  lFinish: { ar: "انتهاء الفحص، 265 صورة في الأرشيف", en: "Examination finished, 265 images in the archive", de: "Untersuchung beendet, 265 Bilder im Archiv" },
  // step 4
  openViewer: { ar: "افتح الصور في العارض ←", en: "Open the images in the viewer →", de: "Bilder im Viewer öffnen →" },
  template: { ar: "قالب: مقطعي للصدر", en: "Template: chest CT", de: "Vorlage: CT Thorax" },
  dictate: { ar: "🎤 إملاء", en: "🎤 Dictate", de: "🎤 Diktat" },
  structure: { ar: "رتّب النص (ذكاء اصطناعي)", en: "Structure the text (AI)", de: "Text gliedern (KI)" },
  critical: { ar: "نتيجة حرجة – أبلِغ الطبيب المحوِّل", en: "Critical finding – alert the referrer", de: "Kritischer Befund – Zuweiser alarmieren" },
  submit: { ar: "أرسل للاعتماد", en: "Submit for release", de: "Zur Freigabe einreichen" },
  aiNote: { ar: "الترتيب لا يضيف شيئًا إلى النص، والطبيب يراجعه قبل الإرسال.", en: "Structuring adds nothing to the text, and the physician checks it before submitting.", de: "Das Gliedern fügt dem Text nichts hinzu; der Arzt prüft ihn vor dem Einreichen." },
  tplText: {
    ar: "الفحص: تصوير مقطعي للصدر مع مادة تباين.\nالمقارنة: الفحص السابق قبل سبعة أسابيع.\n",
    en: "Examination: chest CT with contrast.\nComparison: earlier examination seven weeks ago.\n",
    de: "Untersuchung: CT Thorax mit Kontrastmittel.\nVergleich: Voruntersuchung vor sieben Wochen.\n",
  },
  dictText: {
    ar: "الكتلة في الفص السفلي الأيمن أصغر مما كانت في الفحص السابق. لا بؤر جديدة. لا انصباب جنبي. استجابة جزئية للعلاج، يُنصح بمتابعة بعد ثلاثة أشهر.",
    en: "The mass in the right lower lobe is smaller than in the earlier examination. No new foci. No pleural effusion. Partial response to treatment, follow-up in three months advised.",
    de: "Die Raumforderung im rechten Unterlappen ist kleiner als in der Voruntersuchung. Keine neuen Herde. Kein Pleuraerguss. Teilweises Ansprechen auf die Behandlung, Kontrolle in drei Monaten empfohlen.",
  },
  structured: {
    ar: "السؤال السريري\nمتابعة تحت العلاج.\n\nالتقنية\nتصوير مقطعي للصدر مع مادة تباين. المقارنة: الفحص السابق قبل سبعة أسابيع.\n\nالنتائج\nالكتلة في الفص السفلي الأيمن أصغر مما كانت في الفحص السابق. لا بؤر جديدة. لا انصباب جنبي.\n\nالخلاصة\nاستجابة جزئية للعلاج، يُنصح بمتابعة بعد ثلاثة أشهر.",
    en: "CLINICAL QUESTION\nFollow-up under treatment.\n\nTECHNIQUE\nChest CT with contrast. Comparison: earlier examination seven weeks ago.\n\nFINDINGS\nThe mass in the right lower lobe is smaller than in the earlier examination. No new foci. No pleural effusion.\n\nIMPRESSION\nPartial response to treatment, follow-up in three months advised.",
    de: "FRAGESTELLUNG\nVerlaufskontrolle unter Behandlung.\n\nTECHNIK\nCT Thorax mit Kontrastmittel. Vergleich: Voruntersuchung vor sieben Wochen.\n\nBEFUND\nDie Raumforderung im rechten Unterlappen ist kleiner als in der Voruntersuchung. Keine neuen Herde. Kein Pleuraerguss.\n\nBEURTEILUNG\nTeilweises Ansprechen auf die Behandlung, Kontrolle in drei Monaten empfohlen.",
  },
  question: { ar: "السؤال السريري: متابعة تحت العلاج.\n", en: "Clinical question: follow-up under treatment.\n", de: "Fragestellung: Verlaufskontrolle unter Behandlung.\n" },
  lDraft: { ar: "مسودة التقرير محفوظة", en: "Report draft saved", de: "Befundentwurf gespeichert" },
  lSubmit: { ar: "أُرسل التقرير للاعتماد", en: "Report submitted for release", de: "Befund zur Freigabe eingereicht" },
  // step 5
  review: { ar: "تقرير بانتظار الاعتماد", en: "Report waiting for release", de: "Befund wartet auf Freigabe" },
  release: { ar: "اعتمد", en: "Release", de: "Freigeben" },
  giveBack: { ar: "أعِد مع السبب", en: "Return with a reason", de: "Zurückgeben mit Begründung" },
  backNote: { ar: "في النظام يعود التقرير إلى كاتبه مع السبب. هنا نتابع بالاعتماد.", en: "In the system the report goes back to its author with the reason. Here we go on with the release.", de: "Im System geht der Befund mit der Begründung an den Verfasser zurück. Hier geht es mit der Freigabe weiter." },
  released: { ar: "معتمد · غير قابل للتغيير · ختم النظام · PDF/A-2b", en: "Released · unchangeable · system seal · PDF/A-2b", de: "Freigegeben · unveränderlich · Systemsiegel · PDF/A-2b" },
  lRelease: { ar: "اعتمد القارئ الثاني التقرير وخُتم", en: "Second reader released the report, sealed", de: "Zweitleser hat den Befund freigegeben, gesiegelt" },
  // step 6
  access: { ar: "وصول المريض", en: "Patient access", de: "Patientenzugang" },
  accessLead: { ar: "يُسلَّم المريض رابطًا أو رمز QR. دون حساب.", en: "The patient gets a link or a QR code. No account.", de: "Der Patient bekommt einen Link oder QR-Code. Ohne Konto." },
  showPhone: { ar: "افتح على هاتف المريض", en: "Open on the patient's phone", de: "Auf dem Handy des Patienten öffnen" },
  guest: { ar: "رابط ضيف لرأي ثانٍ – صالح 7 أيام على الأكثر", en: "Guest link for a second opinion – valid 7 days at most", de: "Gast-Link für eine Zweitmeinung – höchstens 7 Tage gültig" },
  plainH: { ar: "تقريرك بكلمات بسيطة", en: "Your report in simple words", de: "Ihr Befund in einfachen Worten" },
  plain: {
    ar: "الكتلة في رئتك اليمنى صارت أصغر مما كانت قبل سبعة أسابيع. لم يظهر شيء جديد. العلاج يُظهر أثرًا. سيتحدث طبيبك معك عن الخطوة التالية؛ يُنصح بفحص آخر بعد ثلاثة أشهر.",
    en: "The lump in your right lung has become smaller than it was seven weeks ago. Nothing new has appeared. The treatment is showing an effect. Your physician will talk with you about the next step; another examination in three months is advised.",
    de: "Der Knoten in Ihrer rechten Lunge ist kleiner geworden als vor sieben Wochen. Es ist nichts Neues hinzugekommen. Die Behandlung zeigt Wirkung. Ihr Arzt bespricht mit Ihnen den nächsten Schritt; eine weitere Untersuchung in drei Monaten wird empfohlen.",
  },
  plainNote: { ar: "شرح آلي للتقرير المعتمد. لا يغني عن الحديث مع طبيبك.", en: "A machine-made explanation of the released report. It does not replace talking with your physician.", de: "Eine maschinell erstellte Erklärung des freigegebenen Befunds. Sie ersetzt nicht das Gespräch mit Ihrem Arzt." },
  lAccess: { ar: "فتح المريض تقريره عبر الرابط", en: "Patient opened the report by link", de: "Patient hat den Befund per Link geöffnet" },
  finished: { ar: "هذا هو الطريق كله. كل خطوة مسجَّلة بالاسم والوقت.", en: "That is the whole way. Every step is on record with name and time.", de: "Das ist der ganze Weg. Jeder Schritt ist mit Name und Zeit festgehalten." },
  contact: { ar: "اطلب عرضًا حيًّا", en: "Ask for a live demonstration", de: "Live-Vorführung anfragen" },
};

const steps = [
  { id: "record", role: "rReception", name: { ar: "التسجيل", en: "Registration", de: "Anmeldung" },
    h: { ar: "ملف المريض", en: "The patient record", de: "Die Patientenakte" },
    p: { ar: "الاستقبال يبحث أولًا عن المريض ثم ينشئ الملف. كل تصحيح لاحق يُحفظ مع السبب.", en: "Reception first searches for the patient, then creates the record. Every later correction is kept with its reason.", de: "Die Anmeldung sucht zuerst nach dem Patienten und legt dann die Akte an. Jede spätere Korrektur wird mit Grund aufbewahrt." },
    act: { ar: "انقر «مريض جديد» ثم «حفظ».", en: "Click “New patient”, then “Save”.", de: "Klicken Sie „Neuer Patient“, dann „Speichern“." } },
  { id: "slot", role: "rPlanning", name: { ar: "الموعد", en: "Appointment", de: "Termin" },
    h: { ar: "الفحص والموعد", en: "Examination and appointment", de: "Untersuchung und Termin" },
    p: { ar: "الغرف والأجهزة محمية من الحجز المزدوج.", en: "Rooms and devices are protected against double booking.", de: "Räume und Geräte sind gegen Doppelbelegung geschützt." },
    act: { ar: "اختر وقتًا متاحًا (جرّب وقتًا محجوزًا أيضًا)، ثم احجز.", en: "Pick a free time (try a taken one, too), then book.", de: "Wählen Sie eine freie Zeit (probieren Sie auch eine belegte), dann vergeben." } },
  { id: "questions", role: "rPatient", name: { ar: "الاستبيان", en: "Questionnaire", de: "Fragebogen" },
    h: { ar: "المريض يجيب مسبقًا", en: "The patient answers beforehand", de: "Der Patient antwortet vorab" },
    p: { ar: "منظّم القلب، المعادن، الحساسية، الحمل، الكلى، الميتفورمين، رهاب الأماكن المغلقة – والفريق يرى التحذير قبل الفحص.", en: "Pacemaker, metal, allergy, pregnancy, kidneys, metformin, claustrophobia – and the team sees the warning before the examination.", de: "Schrittmacher, Metall, Allergie, Schwangerschaft, Niere, Metformin, Platzangst – und das Team sieht die Warnung vor der Untersuchung." },
    act: { ar: "أجب «نعم» على سؤال الحساسية ثم أرسل.", en: "Answer “Yes” to the allergy question, then send.", de: "Antworten Sie bei der Allergie mit „Ja“ und senden Sie ab." } },
  { id: "board", role: "rTech", name: { ar: "لوحة اليوم", en: "Day board", de: "Tagesübersicht" },
    h: { ar: "اليوم في لمحة", en: "The day at a glance", de: "Der Tag auf einen Blick" },
    p: { ar: "متوقَّع، في الانتظار، في الجهاز، انتهى – ولكل جهاز: متاح أو مشغول. على الجهاز يختار الفنّي المريض من القائمة بدل الكتابة.", en: "Expected, waiting, in the device, done – and every device free or occupied. At the device the radiographer picks the patient from the list instead of typing.", de: "Erwartet, wartet, im Gerät, fertig – und jedes Gerät frei oder belegt. Am Gerät wählt die MTR den Patienten aus der Liste, statt zu tippen." },
    act: { ar: "حرّك المريضة عبر الأعمدة بالأزرار.", en: "Move the patient through the columns with the buttons.", de: "Führen Sie die Patientin mit den Knöpfen durch die Spalten." } },
  { id: "report", role: "rRadiologist", name: { ar: "التقرير", en: "Report", de: "Befund" },
    h: { ar: "كتابة التقرير", en: "Writing the report", de: "Den Befund schreiben" },
    p: { ar: "قالب، إملاء بالصوت، ونقرة ترتّب النص في أربعة أقسام. القياسات والصور الأساسية تأتي من العارض.", en: "Template, dictation by voice, and one click that sorts the text into four sections. Measurements and key images come from the viewer.", de: "Vorlage, Diktat per Sprache und ein Klick, der den Text in vier Abschnitte gliedert. Messungen und Schlüsselbilder kommen aus dem Viewer." },
    act: { ar: "القالب ← الإملاء ← الترتيب ← أرسل للاعتماد.", en: "Template → dictate → structure → submit for release.", de: "Vorlage → Diktat → Gliedern → zur Freigabe einreichen." } },
  { id: "release", role: "rSenior", name: { ar: "الاعتماد", en: "Release", de: "Freigabe" },
    h: { ar: "أربع عيون", en: "Four eyes", de: "Vier Augen" },
    p: { ar: "قارئ ثانٍ يعتمد التقرير أو يعيده مع السبب (يمكن إيقاف ذلك). التقرير المعتمد لا يتغيّر؛ الإضافات تُكتب كملحق.", en: "A second reader releases the report or returns it with a reason (can be switched off). A released report does not change; additions are written as an addendum.", de: "Ein Zweitleser gibt den Befund frei oder gibt ihn mit Begründung zurück (abschaltbar). Ein freigegebener Befund ändert sich nicht; Ergänzungen kommen als Nachtrag." },
    act: { ar: "انقر «اعتمد».", en: "Click “Release”.", de: "Klicken Sie „Freigeben“." } },
  { id: "access", role: "rPatient", name: { ar: "المريض", en: "Patient", de: "Patient" },
    h: { ar: "التقرير عند المريض", en: "The report with the patient", de: "Der Befund beim Patienten" },
    p: { ar: "برابط أو رمز QR يرى المريض صوره وتقريره مشروحًا بكلمات بسيطة – بالعربية أو الإنجليزية أو الألمانية.", en: "By link or QR code the patient sees the images and the report explained in simple words – in Arabic, English or German.", de: "Per Link oder QR-Code sieht der Patient seine Bilder und den Befund in einfachen Worten erklärt – auf Arabisch, Englisch oder Deutsch." },
    act: { ar: "افتح التقرير على هاتف المريض.", en: "Open the report on the patient's phone.", de: "Öffnen Sie den Befund auf dem Handy des Patienten." } },
];

const fresh = () => ({
  step: 0,
  form: false, saved: false,
  slot: null, conflict: false, booked: false,
  allergy: null, sent: false,
  place: 0, // 0 expected, 1 waiting, 2 device, 3 done
  body: "", typing: false, templated: false, dictated: false, structured: false, critical: false, submitted: false,
  returned: false, released: false,
  phone: false,
  log: [],
});
let state = fresh();
let run = 0;
let playing = false;

const app = make("div", { class: "app" });
const guide = make("aside", { class: "guide" });
const stepBar = make("div", { class: "steps" });
document.title = `KM Code Craft Radiology – ${t(T.title)}`;
document.body.append(
  make("main", { class: "wrap" }, [
    make("h1", { text: t(T.title) }),
    stepBar,
    make("div", { class: "stage" }, [app, guide]),
  ]),
);

const clock = () => `0${8 + Math.floor(state.log.length / 3)}`.slice(-2) + `:${`0${(state.log.length * 7) % 60}`.slice(-2)}`;
function record(key, role) {
  state.log.push(`${clock()} · ${t(T[role])} · ${t(T[key])}`);
}
const complete = (id) =>
  ({ record: state.saved, slot: state.booked, questions: state.sent, board: state.place === 3, report: state.submitted, release: state.released, access: state.phone })[id];

/** A button; `hint` makes it pulse as the next thing to click. */
const button = (label, action, { hint = false, ghost = false, off = false } = {}) =>
  make("button", {
    class: `btn${ghost ? " ghost" : ""}${hint && !off ? " pulse" : ""}`,
    text: t(label),
    disabled: off ? "" : null,
    onclick: () => { if (!playing) run += 1; action(); render(); },
  });
const field = (label, value) => make("div", { class: "field" }, [make("label", { text: t(label) }), make("input", { value, readonly: "" })]);

const screens = {
  record() {
    const rows = [
      ["P-2026-0398", { ar: "سامي مثال", en: "Sami Example", de: "Sami Beispiel" }, "1975-11-02"],
      ["P-2026-0405", { ar: "هدى عيّنة", en: "Huda Specimen", de: "Huda Probe" }, "1990-06-21"],
    ];
    if (state.saved) rows.push([T.number, T.patient, T.born, true]);
    return [
      make("div", { class: "row" }, [button(T.newPatient, () => { state.form = true; }, { hint: !state.form && !state.saved, off: state.form || state.saved })]),
      state.form && !state.saved
        ? make("div", {}, [
            make("p", { class: "alert ok", text: t(T.searchFirst) }),
            field(T.name, t(T.patient)),
            field(T.birth, T.born),
            field(T.no, T.number),
            button(T.save, () => { state.saved = true; record("lRecord", "rReception"); }, { hint: true }),
          ])
        : null,
      make("h3", { text: t(T.today) }),
      make("table", {}, [
        make("thead", {}, make("tr", {}, [T.no, T.name, T.birth].map((head) => make("th", { text: t(head) })))),
        make("tbody", {}, rows.map(([no, name, born, isNew]) => make("tr", { class: isNew ? "new" : "" }, [no, t(name), born].map((cell) => make("td", { text: cell }))))),
      ]),
    ];
  },
  slot() {
    const times = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
    const taken = new Set(["08:00", "08:30", "09:30", "11:00"]);
    return [
      field(T.name, `${t(T.patient)} · ${T.number}`),
      field(T.examLabel, t(T.exam)),
      make("h3", { text: `${t(T.slotLabel)} ${T.device}` }),
      make("div", { class: "slots" }, times.map((time) =>
        make("button", {
          class: `${taken.has(time) ? "busy" : ""}${state.slot === time ? " picked" : ""}${!state.slot && time === "09:00" ? " pulse" : ""}`,
          text: taken.has(time) ? `${time} · ${t(T.busy)}` : time,
          "data-time": time,
          disabled: state.booked ? "" : null,
          onclick: () => {
            if (!playing) run += 1;
            if (taken.has(time)) state.conflict = true;
            else { state.slot = time; state.conflict = false; }
            render();
          },
        }))),
      state.conflict ? make("p", { class: "alert bad", text: t(T.conflict) }) : null,
      make("div", { class: "row" }, [button(T.book, () => { state.booked = true; record("lOrder", "rPlanning"); }, { hint: state.slot !== null, off: state.slot === null || state.booked })]),
      state.booked ? make("p", { class: "alert ok", text: t(T.booked) }) : null,
    ];
  },
  questions() {
    const ask = (label, key, pulseYes) =>
      make("div", {}, [
        make("p", { text: t(label) }),
        make("div", { class: "row" }, [
          make("button", { class: `pill${state[key] === true ? " on" : ""}${pulseYes && state[key] === null ? " pulse" : ""}`, text: t(T.yes), "data-answer": key ? "yes" : null, disabled: state.sent ? "" : null, onclick: () => { if (key) { state[key] = true; render(); } } }),
          make("button", { class: `pill${key ? (state[key] === false ? " on" : "") : " on"}`, text: t(T.nope), disabled: state.sent ? "" : null, onclick: () => { if (key) { state[key] = false; render(); } } }),
        ]),
      ]);
    return [
      make("div", { class: "split" }, [
        make("div", { class: "phone" }, [
          make("h4", { text: t(T.qTitle) }),
          make("p", { class: "small", text: t(T.qLead) }),
          ask(T.q1, null, false),
          ask(T.q2, "allergy", true),
          ask(T.q3, null, false),
          state.sent
            ? make("p", { class: "plain", text: t(T.sent) })
            : button(T.send, () => { state.sent = true; if (state.allergy === null) state.allergy = false; record("lQuestion", "rPatient"); }, { hint: state.allergy !== null }),
        ]),
        make("div", {}, [
          make("h3", { text: t(T.teamSees) }),
          make("div", { class: "ticket mine" }, [
            make("strong", { text: `${state.slot ?? "09:00"} · ${t(T.patient)}` }),
            make("div", { class: "dim", text: `${t(T.exam)} · ${T.device}` }),
            !state.sent
              ? make("p", { class: "dim", text: t(T.waiting) })
              : state.allergy
                ? make("p", { class: "alert bad", text: t(T.warnAllergy) })
                : make("p", { class: "alert ok", text: t(T.noWarn) }),
          ]),
        ]),
      ]),
    ];
  },
  board() {
    const columns = [T.cExpected, T.cWaiting, T.cDevice, T.cDone];
    const others = [
      [{ ar: "سامي مثال", en: "Sami Example", de: "Sami Beispiel" }, 3],
      [{ ar: "هدى عيّنة", en: "Huda Specimen", de: "Huda Probe" }, 0],
    ];
    const actions = [[T.arrive, "lArrive"], [T.start, "lStart"], [T.finish, "lFinish"]];
    const mine = make("div", { class: "ticket mine" }, [
      make("strong", { text: `${state.slot ?? "09:00"} · ${t(T.patient)}` }),
      make("div", { class: "dim", text: t(T.exam) }),
      state.allergy ? make("div", { class: "badge bad", text: t(T.warnAllergy) }) : null,
      state.place < 3
        ? button(actions[state.place][0], () => { record(actions[state.place][1], "rTech"); state.place += 1; }, { hint: true })
        : null,
    ]);
    return [
      make("p", {}, [
        make("span", { text: `${T.device}: ` }),
        make("span", { class: `badge ${state.place === 2 ? "warn" : "ok"}`, text: t(state.place === 2 ? T.occupied : T.free) }),
      ]),
      make("div", { class: "board" }, columns.map((title, at) =>
        make("div", { class: "col" }, [
          make("h4", { text: t(title) }),
          ...others.filter(([, place]) => place === at).map(([name]) => make("div", { class: "ticket" }, [make("strong", { text: t(name) })])),
          state.place === at ? mine : null,
        ]))),
      state.place === 3 ? make("p", { class: "alert ok", text: t(T.imagesIn) }) : null,
    ];
  },
  report() {
    const area = make("textarea", { readonly: "", "aria-label": t(steps[4].name) });
    area.value = state.body;
    const busy = state.typing || state.submitted;
    return [
      make("div", { class: "split" }, [
        make("div", {}, [
          make("img", { class: "thumb", src: "media/follow/lung-180.jpg", alt: "" }),
          make("p", {}, [make("a", { href: `viewer.html?lang=${lang}`, text: t(T.openViewer) })]),
          make("label", { class: "check" }, [
            (() => { const box = make("input", { type: "checkbox" }); box.checked = state.critical; box.disabled = state.submitted; box.addEventListener("change", () => { state.critical = box.checked; }); return box; })(),
            make("span", { text: ` ${t(T.critical)}` }),
          ]),
        ]),
        make("div", {}, [
          make("div", { class: "row" }, [
            button(T.template, () => { state.templated = true; state.body = t(T.question) + t(T.tplText); record("lDraft", "rRadiologist"); }, { hint: !state.templated, off: state.templated || busy, ghost: state.templated }),
            button(T.dictate, () => dictate(), { hint: state.templated && !state.dictated, off: !state.templated || state.dictated || busy, ghost: state.dictated }),
            button(T.structure, () => { state.structured = true; state.body = t(T.structured); }, { hint: state.dictated && !state.structured, off: !state.dictated || state.structured || busy, ghost: state.structured }),
          ]),
          area,
          state.structured ? make("p", { class: "dim", text: t(T.aiNote) }) : null,
          make("div", { class: "row" }, [
            button(T.submit, () => { state.submitted = true; record("lSubmit", "rRadiologist"); }, { hint: state.structured, off: !state.dictated || busy }),
          ]),
        ]),
      ]),
    ];
  },
  release() {
    const area = make("textarea", { readonly: "" });
    area.value = state.body || t(T.structured);
    return [
      make("p", {}, [
        make("strong", { text: `${t(T.patient)} · ${t(T.exam)} · ` }),
        make("span", { class: `badge ${state.released ? "ok" : "warn"}`, text: state.released ? t(T.released) : t(T.review) }),
      ]),
      area,
      state.returned && !state.released ? make("p", { class: "alert", text: t(T.backNote) }) : null,
      make("div", { class: "row" }, [
        button(T.release, () => { state.released = true; record("lRelease", "rSenior"); }, { hint: true, off: state.released }),
        button(T.giveBack, () => { state.returned = true; }, { ghost: true, off: state.released }),
      ]),
    ];
  },
  access() {
    return [
      make("div", { class: "split" }, [
        make("div", {}, [
          make("h3", { text: t(T.access) }),
          make("p", { class: "dim", text: t(T.accessLead) }),
          make("div", { class: "qr", role: "img", "aria-label": "QR" }),
          make("p", {}, [button(T.showPhone, () => { state.phone = true; record("lAccess", "rPatient"); }, { hint: true, off: state.phone })]),
          make("p", { class: "dim", text: t(T.guest) }),
          state.phone ? make("p", { class: "alert ok", text: t(T.finished) }) : null,
          state.phone ? make("p", {}, [make("a", { class: "btn", href: "https://code-craft.tech/kontakt?produkt=radiologie", text: t(T.contact) })]) : null,
        ]),
        make("div", { class: "phone" }, state.phone
          ? [
              make("h4", { text: t(T.plainH) }),
              make("p", { class: "small", text: `${t(T.patient)} · ${t(T.exam)}` }),
              make("p", { class: "plain", text: t(T.plain) }),
              make("p", { class: "small", text: t(T.plainNote) }),
            ]
          : [make("h4", { text: "KM Code Craft Radiology" }), make("p", { class: "small", text: t(T.accessLead) })]),
      ]),
    ];
  },
};

/** The dictation types itself into the report, as speech recognition would. */
async function dictate() {
  const mine = run;
  state.typing = true;
  const words = t(T.dictText).split(" ");
  const start = `${state.body}\n`;
  for (let count = 1; count <= words.length; count += 1) {
    if (mine !== run && !playing) break;
    state.body = `${start}${words.slice(0, count).join(" ")}`;
    const area = app.querySelector("textarea");
    if (area) { area.value = state.body; area.scrollTop = area.scrollHeight; }
    await sleep(70);
  }
  state.body = `${start}${t(T.dictText)}`;
  state.typing = false;
  state.dictated = true;
  render();
}

function render() {
  const step = steps[state.step];
  app.replaceChildren(
    make("div", { class: "appbar" }, [
      make("strong", { text: "KM Code Craft Radiology" }),
      make("span", { class: "dim", text: t(step.h) }),
      make("span", { class: "role", text: t(T[step.role]) }),
    ]),
    make("div", { class: "body" }, screens[step.id]().filter(Boolean)),
  );
  const done = complete(step.id);
  guide.replaceChildren(
    make("div", { class: "count", text: `${state.step + 1} / ${steps.length} · ${t(T[step.role])}` }),
    make("h2", { text: t(step.h) }),
    make("p", { class: "dim", text: t(step.p) }),
    make("div", { class: "do", text: t(step.act) }),
    make("div", { class: "row" }, [
      make("button", { class: "btn", text: t(playing ? T.stop : T.playAll), onclick: () => (playing ? stop() : playAll()) }),
      button(T.back, () => { state.step -= 1; }, { ghost: true, off: state.step === 0 || playing }),
      state.step < steps.length - 1
        ? button(T.next, () => { state.step += 1; }, { ghost: !done, hint: done, off: playing })
        : button(T.restart, () => { state = fresh(); }, { ghost: true, off: playing }),
    ]),
    make("div", { class: "log" }, [
      make("strong", { text: t(T.log) }),
      ...state.log.slice().reverse().map((line) => make("div", { text: line })),
    ]),
  );
  stepBar.replaceChildren(
    ...steps.map((item, at) =>
      make("button", {
        class: `${at === state.step ? "on" : ""}${complete(item.id) ? " done" : ""}`,
        text: t(item.name),
        onclick: () => { if (playing) return; run += 1; state.step = at; render(); },
      })),
  );
}

function stop() {
  playing = false;
  run += 1;
  render();
}

/** Plays the whole way by itself: the same clicks a visitor would make, with pauses to read. */
async function playAll() {
  state = fresh();
  playing = true;
  const mine = ++run;
  const alive = () => playing && mine === run;
  const wait = async (ms) => { await sleep(ms); return alive(); };
  const click = async (selector, pause = 1100) => {
    const target = app.querySelector(selector);
    if (!target || target.disabled) return alive();
    target.classList.add("pulse");
    if (!(await wait(pause))) return false;
    target.click();
    return wait(500);
  };
  render();
  const script = [
    async () => (await click(".body button.btn:not([disabled])")) && (await click(".field ~ button.btn")),
    async () => (await click('[data-time="08:30"]', 900)) && (await wait(1300)) && (await click('[data-time="09:00"]', 900)) && (await click(".row button.btn")),
    async () => (await click('[data-answer="yes"]')) && (await click(".phone > button.btn")),
    async () => (await click(".ticket.mine button.btn")) && (await click(".ticket.mine button.btn")) && (await click(".ticket.mine button.btn")),
    async () => {
      if (!(await click(".row button.btn:not([disabled])"))) return false;
      if (!(await click(".row button.btn:not([disabled]):not(.ghost)"))) return false;
      while (state.typing) if (!(await wait(200))) return false;
      return (await click(".row button.btn:not([disabled]):not(.ghost)")) && (await wait(1200)) && (await click(".body .split > div:last-child > .row:last-child button.btn"));
    },
    async () => click(".row button.btn:not([disabled]):not(.ghost)"),
    async () => click(".split button.btn:not([disabled])"),
  ];
  for (let at = 0; at < steps.length; at += 1) {
    state.step = at;
    render();
    if (!(await wait(1400))) return;
    if (!(await script[at]())) return;
    if (!(await wait(1700))) return;
  }
  playing = false;
  render();
}

render();
