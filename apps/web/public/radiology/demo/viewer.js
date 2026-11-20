// The viewer part of the demo: fixed pictures taken from the real viewer (public, anonymised
// research images), with the interactions a visitor would try first. No DICOM, no server.
import { make, sleep, t, topBar } from "./demo.js";

topBar("viewer");
const info = await (await fetch("media/info.json")).json();

const text = {
  title: { ar: "العارض – جرّبه", en: "The viewer – try it", de: "Der Viewer – zum Ausprobieren" },
  play: { ar: "▶ اعرضه لي", en: "▶ Show me", de: "▶ Vorführen" },
  next: { ar: "التالي", en: "Next", de: "Weiter" },
  back: { ar: "السابق", en: "Back", de: "Zurück" },
  loading: { ar: "تحميل الصور …", en: "Loading images …", de: "Bilder werden geladen …" },
  image: { ar: "صورة", en: "Image", de: "Bild" },
  now: { ar: "الفحص الحالي", en: "Current examination", de: "Aktuelle Untersuchung" },
  earlier: { ar: "الفحص السابق (مُطابَق)", en: "Earlier examination (fitted)", de: "Voruntersuchung (angepasst)" },
  lung: { ar: "رئة", en: "Lung", de: "Lunge" },
  soft: { ar: "أنسجة رخوة", en: "Soft tissue", de: "Weichteile" },
  bone: { ar: "عظم", en: "Bone", de: "Knochen" },
  vessels: { ar: "أوعية", en: "Vessels", de: "Gefäße" },
  modeNow: { ar: "الحالي", en: "Current", de: "Aktuell" },
  modePrev: { ar: "السابق", en: "Earlier", de: "Vorher" },
  modeBlend: { ar: "مزج", en: "Blend", de: "Überblenden" },
  modeDiff: { ar: "خريطة الفرق", en: "Difference map", de: "Differenzkarte" },
  risen: { ar: "زاد", en: "risen", de: "zugenommen" },
  fallen: { ar: "نقص", en: "fallen", de: "abgenommen" },
  diffNote: {
    ar: "فرق (محسوب) – اختلاف الوضعية والتنفس يظهران كتغيّر. ليس قياسًا.",
    en: "Difference (computed) – positioning and breathing appear as change. Not a measurement.",
    de: "Differenz (berechnet) – Lagerung und Atmung erscheinen als Änderung. Keine Messung.",
  },
  pet: { ar: "PET", en: "PET", de: "PET" },
  clear: { ar: "امسح القياس", en: "Clear measurement", de: "Messung löschen" },
  render3d: {
    ar: "عرض ثلاثي الأبعاد (محسوب) – ليس للقياس",
    en: "3D rendering (computed) – not for measuring",
    de: "3D-Darstellung (berechnet) – nicht zum Messen",
  },
  steps: [
    {
      id: "scroll",
      name: { ar: "تصفّح", en: "Scroll", de: "Blättern" },
      h: { ar: "تصفّح الفحص", en: "Scroll through the examination", de: "Durch die Untersuchung blättern" },
      p: {
        ar: "تصوير مقطعي للصدر. في النظام تُحمَّل الصور من الأرشيف مباشرةً في المتصفح، دون برنامج إضافي.",
        en: "A chest CT. In the system the images come straight from the archive into the browser, with no extra program.",
        de: "Eine CT des Brustkorbs. Im System kommen die Bilder direkt aus dem Archiv in den Browser, ohne Zusatzprogramm.",
      },
      act: {
        ar: "دوّر عجلة الفأرة فوق الصورة أو اسحب للأعلى والأسفل.",
        en: "Turn the mouse wheel over the image, or drag up and down.",
        de: "Drehen Sie das Mausrad über dem Bild oder ziehen Sie nach oben und unten.",
      },
    },
    {
      id: "window",
      name: { ar: "النافذة", en: "Window", de: "Fenster" },
      h: { ar: "السطوع والتباين بنقرة", en: "Brightness and contrast in one click", de: "Helligkeit und Kontrast mit einem Klick" },
      p: {
        ar: "الصورة نفسها بثلاث نوافذ: الرئة، الأنسجة الرخوة، العظم. في النظام يكفي مفتاح واحد (F2، F4، F3)، ويحسبها معالج الرسوم.",
        en: "The same image in three windows: lung, soft tissue, bone. In the system one key is enough (F2, F4, F3), worked out by the graphics chip.",
        de: "Dasselbe Bild in drei Fenstern: Lunge, Weichteile, Knochen. Im System genügt eine Taste (F2, F4, F3), gerechnet auf dem Grafikchip.",
      },
      act: {
        ar: "اختر نافذة من الأزرار فوق الصورة.",
        en: "Pick a window with the buttons above the image.",
        de: "Wählen Sie ein Fenster mit den Knöpfen über dem Bild.",
      },
    },
    {
      id: "measure",
      name: { ar: "القياس", en: "Measure", de: "Messen" },
      h: { ar: "قِس مسافة", en: "Measure a distance", de: "Einen Abstand messen" },
      p: {
        ar: "في النظام: مسافة، زاوية، زاوية كوب، مساحة وقيمة الكثافة. القياسات تدخل التقرير كمرجع وتُحفظ في الأرشيف.",
        en: "In the system: distance, angle, Cobb angle, area and density value. Measurements go into the report as references and are kept in the archive.",
        de: "Im System: Abstand, Winkel, Cobb-Winkel, Fläche und Dichtewert. Messungen gehen als Verweis in den Befund und werden im Archiv abgelegt.",
      },
      act: {
        ar: "اسحب خطًّا فوق الآفة في الرئة.",
        en: "Drag a line across the lesion in the lung.",
        de: "Ziehen Sie eine Linie über den Herd in der Lunge.",
      },
    },
    {
      id: "follow",
      name: { ar: "المتابعة", en: "Follow-up", de: "Verlauf" },
      h: { ar: "ماذا تغيّر منذ الفحص السابق؟", en: "What changed since the earlier examination?", de: "Was hat sich seit der Voruntersuchung verändert?" },
      p: {
        ar: "فحصان للمريض نفسه بفارق سبعة أسابيع. يطابق العارض الفحص السابق تلقائيًا في الفراغ ويلوّن الفرق: الزيادة بالأحمر والنقص بالأخضر. الآفة صغرت – تظهر خضراء.",
        en: "Two examinations of the same patient, seven weeks apart. The viewer fits the earlier one in space by itself and colours the difference: risen red, fallen green. The lesion has shrunk – it shows green.",
        de: "Zwei Untersuchungen desselben Patienten im Abstand von sieben Wochen. Der Viewer passt die frühere von selbst räumlich an und färbt den Unterschied: zugenommen rot, abgenommen grün. Der Herd ist kleiner geworden – er erscheint grün.",
      },
      act: {
        ar: "بدّل بين «الحالي» و«السابق» و«خريطة الفرق»، أو حرّك منزلق المزج.",
        en: "Switch between “Current”, “Earlier” and “Difference map”, or move the blend slider.",
        de: "Wechseln Sie zwischen „Aktuell“, „Vorher“ und „Differenzkarte“ oder schieben Sie den Regler.",
      },
    },
    {
      id: "pet",
      name: { ar: "PET-CT", en: "PET-CT", de: "PET-CT" },
      h: { ar: "PET فوق CT", en: "PET over CT", de: "PET über CT" },
      p: {
        ar: "صورة الاستقلاب مطابقة فوق التصوير المقطعي. تتوهّج البؤرة النشطة في موضعها.",
        en: "The metabolic image lies exactly over the CT. The active focus lights up in its place.",
        de: "Die Stoffwechselaufnahme liegt deckungsgleich über der CT. Der aktive Herd leuchtet an seiner Stelle.",
      },
      act: {
        ar: "حرّك منزلق PET وتصفّح الصور.",
        en: "Move the PET slider and scroll through the images.",
        de: "Schieben Sie den PET-Regler und blättern Sie durch die Bilder.",
      },
    },
    {
      id: "volume",
      name: { ar: "ثلاثي الأبعاد", en: "3D", de: "3D" },
      h: { ar: "الجسم من كل الجهات", en: "The body from all sides", de: "Der Körper von allen Seiten" },
      p: {
        ar: "من الصور المقطعية نفسها يحسب العارض جسمًا ثلاثي الأبعاد في المتصفح، على معالج الرسوم في جهاز الطبيب.",
        en: "From the same CT slices the viewer works out a 3D body in the browser, on the graphics chip of the physician's computer.",
        de: "Aus denselben CT-Schichten rechnet der Viewer einen 3D-Körper im Browser, auf dem Grafikchip des Arztrechners.",
      },
      act: {
        ar: "اسحب يمينًا ويسارًا للتدوير. بدّل بين العظم والأوعية.",
        en: "Drag left and right to turn it. Switch between bone and vessels.",
        de: "Ziehen Sie nach links und rechts zum Drehen. Wechseln Sie zwischen Knochen und Gefäßen.",
      },
    },
  ],
};
document.title = `KM Code Craft Radiology – ${t(text.title)}`;

const state = {
  step: 0,
  slice: { follow: info.follow.lesion.slice, pet: info.pet.focus },
  window: "lung",
  mode: "diff",
  mix: 0.5,
  pet: 1,
  yaw: 0,
  preset: "bone",
  line: null,
  done: new Set(),
};
let run = 0; // every user action raises it, which stops a running demonstration

// ── pictures ────────────────────────────────────────────────────────────────
const pictures = new Map();
function picture(set, name) {
  const key = `${set}/${name}`;
  if (!pictures.has(key)) {
    pictures.set(
      key,
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = `media/${key}.jpg`;
      }),
    );
  }
  return pictures.get(key);
}
const yaws = Array.from({ length: 24 }, (_, at) => at * 15);
/** The pictures a step can show, so that scrolling does not wait for the network. */
function needed(id) {
  const follow = (kinds) => info.follow.slices.flatMap((slice) => kinds.map((kind) => ["follow", `${kind}-${slice}`]));
  if (id === "scroll" || id === "measure") return follow(["lung"]);
  if (id === "window") return follow(["lung", "soft", "bone"]);
  if (id === "follow") return follow(["lung", "prev", "diff"]);
  if (id === "pet") return info.pet.slices.flatMap((slice) => [["pet", `ct-${slice}`], ["pet", `fus-${slice}`]]);
  return ["bone", "vessels"].flatMap((preset) => yaws.map((yaw) => ["pet", `${preset}-${yaw}`]));
}

// ── page ────────────────────────────────────────────────────────────────────
const canvas = make("canvas", { width: info.follow.width, height: info.follow.height });
const context = canvas.getContext("2d");
const corners = { tl: make("div", { class: "corner tl" }), tr: make("div", { class: "corner tr" }), bl: make("div", { class: "corner bl" }) };
const loading = make("div", { class: "loading", text: t(text.loading) });
const pic = make("div", { class: "pic" }, [canvas, corners.tl, corners.tr, corners.bl, loading]);
const bar = make("div", { class: "bar" });
const steps = make("div", { class: "steps" });
const guide = make("aside", { class: "guide" });
document.body.append(
  make("main", { class: "wrap" }, [
    make("h1", { text: t(text.title) }),
    steps,
    make("div", { class: "stage" }, [make("div", { class: "viewer" }, [bar, pic]), guide]),
  ]),
);

const current = () => text.steps[state.step];
const dataset = () => (current().id === "pet" || current().id === "volume" ? "pet" : "follow");

function tools() {
  const id = current().id;
  const choice = (label, on, pick, pulse = false) =>
    make("button", { class: `pill${on ? " on" : ""}${pulse ? " pulse" : ""}`, text: label, onclick: () => { run += 1; pick(); touched(); render(); } });
  const untouched = !state.done.has(id);
  const items = [];
  if (id === "window")
    for (const name of ["lung", "soft", "bone"])
      items.push(choice(t(text[name]), state.window === name, () => { state.window = name; }, untouched && name === "soft"));
  if (id === "measure")
    items.push(make("button", { class: "pill", text: t(text.clear), onclick: () => { run += 1; state.line = null; render(); } }));
  if (id === "follow") {
    for (const [mode, label] of [["now", text.modeNow], ["prev", text.modePrev], ["diff", text.modeDiff], ["blend", text.modeBlend]])
      items.push(choice(t(label), state.mode === mode, () => { state.mode = mode; }, untouched && mode === "prev"));
    const slider = make("input", { type: "range", min: "0", max: "100", value: String(Math.round(state.mix * 100)), "aria-label": t(text.modeBlend) });
    slider.addEventListener("input", () => { run += 1; state.mode = "blend"; state.mix = Number(slider.value) / 100; touched(); render(false); });
    items.push(make("label", {}, [make("span", { text: t(text.modeNow) }), slider, make("span", { text: t(text.modePrev) })]));
    items.push(make("span", { class: "sep" }), make("label", { class: "legend" }, [
      make("i", { class: "red" }), make("span", { text: t(text.risen) }),
      make("i", { class: "green" }), make("span", { text: t(text.fallen) }),
    ]));
  }
  if (id === "pet") {
    const slider = make("input", { type: "range", min: "0", max: "100", value: String(Math.round(state.pet * 100)), "aria-label": t(text.pet) });
    slider.addEventListener("input", () => { run += 1; state.pet = Number(slider.value) / 100; touched(); render(false); });
    items.push(make("label", { class: untouched ? "pulse" : "" }, [make("span", { text: "CT" }), slider, make("span", { text: t(text.pet) })]));
  }
  if (id === "volume")
    for (const name of ["bone", "vessels"])
      items.push(choice(t(text[name]), state.preset === name, () => { state.preset = name; }, untouched && name === "vessels"));
  if (items.length === 0) items.push(make("span", { class: "dim", text: t(current().act) }));
  bar.replaceChildren(...items);
}

function touched() {
  state.done.add(current().id);
}

function buildGuide() {
  const step = current();
  guide.replaceChildren(
    make("div", { class: "count", text: `${state.step + 1} / ${text.steps.length}` }),
    make("h2", { text: t(step.h) }),
    make("p", { class: "dim", text: t(step.p) }),
    make("div", { class: "do", text: t(step.act) }),
    make("div", { class: "row" }, [
      make("button", { class: "btn", text: t(text.play), onclick: () => demonstrate() }),
      make("button", { class: "btn ghost", text: t(text.back), disabled: state.step === 0 ? "" : null, onclick: () => go(state.step - 1) }),
      make("button", { class: "btn ghost", text: t(text.next), disabled: state.step === text.steps.length - 1 ? "" : null, onclick: () => go(state.step + 1) }),
    ]),
  );
  steps.replaceChildren(
    ...text.steps.map((item, at) =>
      make("button", {
        class: `${at === state.step ? "on" : ""}${state.done.has(item.id) ? " done" : ""}`,
        text: t(item.name),
        onclick: () => go(at),
      }),
    ),
  );
}

/** Draws the picture of the current step; with `rebuild` also the buttons and the guide. */
async function render(rebuild = true) {
  if (rebuild) {
    tools();
    buildGuide();
  }
  const id = current().id;
  const set = dataset();
  const mine = ++render.turn;
  let layers = [];
  let label = "";
  if (id === "volume") {
    layers = [[`${state.preset}-${yaws[state.yaw]}`, 1]];
    corners.tl.textContent = "CT";
    corners.tr.textContent = t(text[state.preset]);
    label = t(text.render3d);
  } else if (id === "pet") {
    const slice = info.pet.slices[state.slice.pet];
    layers = [[`ct-${slice}`, 1], [`fus-${slice}`, state.pet]];
    corners.tl.textContent = "PET-CT · Lung-PET-CT-Dx (TCIA)";
    corners.tr.textContent = `PET ${Math.round(state.pet * 100)}%`;
    label = `${t(text.image)} ${slice + 1} / ${info.pet.count}`;
  } else {
    const slice = info.follow.slices[state.slice.follow];
    const window = id === "window" ? state.window : "lung";
    const mode = id === "follow" ? state.mode : "now";
    if (mode === "now") layers = [[`${window}-${slice}`, 1]];
    if (mode === "prev") layers = [[`prev-${slice}`, 1]];
    if (mode === "diff") layers = [[`diff-${slice}`, 1]];
    if (mode === "blend") layers = [[`lung-${slice}`, 1], [`prev-${slice}`, state.mix]];
    corners.tl.textContent = "CT · RIDER Lung CT (TCIA)";
    corners.tr.textContent =
      mode === "prev" ? `${t(text.earlier)}\n2006-09-05` : mode === "now" ? `${t(text.now)}\n2006-10-24` : `${t(text.now)} 2006-10-24\n${t(text.earlier)} 2006-09-05`;
    label = `${t(text.image)} ${slice + 1} / ${info.follow.count}`;
    if (mode === "diff") label += `\n${t(text.diffNote)}`;
    if (id === "window") label += `\n${t(text[window])}`;
  }
  const images = await Promise.all(layers.map(([name]) => picture(set, name)));
  if (mine !== render.turn) return;
  context.globalAlpha = 1;
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  images.forEach((image, at) => {
    if (!image) return;
    context.globalAlpha = layers[at][1];
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  });
  context.globalAlpha = 1;
  if (id === "measure" && state.line) {
    const { x0, y0, x1, y1 } = state.line;
    const millimetres = Math.hypot(x1 - x0, y1 - y0) * info.follow.mmPerPixel;
    context.strokeStyle = "#ffd84d";
    context.fillStyle = "#ffd84d";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      context.beginPath();
      context.arc(x, y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.font = "600 15px sans-serif";
    context.shadowColor = "#000";
    context.shadowBlur = 4;
    context.fillText(`${millimetres.toFixed(1)} mm`, Math.max(x0, x1) + 8, (y0 + y1) / 2);
    context.shadowBlur = 0;
  }
  corners.bl.textContent = label;
}
render.turn = 0;

async function go(step) {
  run += 1;
  state.step = Math.max(0, Math.min(text.steps.length - 1, step));
  state.line = null;
  pic.classList.toggle("ew", current().id === "volume");
  loading.hidden = false;
  const mine = run;
  // The picture in view first; the others of this step load behind it.
  await render();
  loading.hidden = true;
  if (mine !== run) return;
  await Promise.all(needed(current().id).map(([set, name]) => picture(set, name)));
  if (mine !== run) return;
  // The first time a step opens, it shows by itself what can be done here.
  if (!state.done.has(current().id)) demonstrate(true);
}

/** Plays what the step is about; any action of the visitor stops it. */
async function demonstrate(quiet = false) {
  const mine = ++run;
  const alive = () => mine === run;
  const id = current().id;
  const pause = async (ms) => { await sleep(ms); return alive(); };
  const sweep = async (set, from, to, ms = 90) => {
    const direction = to > from ? 1 : -1;
    for (let at = from; at !== to + direction; at += direction) {
      if (!alive()) return false;
      state.slice[set] = at;
      render(false);
      await sleep(ms);
    }
    return alive();
  };
  if (!(await pause(quiet ? 700 : 100))) return;
  const last = info.follow.slices.length - 1;
  if (id === "scroll") {
    const start = state.slice.follow;
    (await sweep("follow", start, last)) && (await sweep("follow", last, 0)) && (await sweep("follow", 0, start));
  } else if (id === "window") {
    for (const name of ["soft", "bone", "lung"]) {
      state.window = name;
      render();
      if (!(await pause(1300))) return;
    }
  } else if (id === "measure") {
    state.slice.follow = info.follow.lesion.slice;
    const { x0, y0, x1, y1 } = info.follow.lesion;
    for (let part = 0; part <= 1.001; part += 0.05) {
      if (!alive()) return;
      state.line = { x0, y0, x1: x0 + (x1 - x0) * part, y1: y0 + (y1 - y0) * part };
      render(false);
      await sleep(45);
    }
  } else if (id === "follow") {
    state.slice.follow = info.follow.lesion.slice;
    for (const mode of ["now", "prev", "now", "prev", "diff"]) {
      state.mode = mode;
      render();
      if (!(await pause(1250))) return;
    }
  } else if (id === "pet") {
    state.slice.pet = info.pet.focus;
    for (const value of [0, 0.25, 0.5, 0.75, 1, 0.5, 0, 0.5, 1]) {
      state.pet = value;
      render();
      if (!(await pause(420))) return;
    }
  } else {
    for (let turn = 0; turn < 24; turn += 1) {
      if (!alive()) return;
      state.yaw = (state.yaw + 1) % 24;
      render(false);
      await sleep(110);
    }
  }
}

// ── pointer and wheel ───────────────────────────────────────────────────────
const point = (event) => {
  const box = canvas.getBoundingClientRect();
  return { x: ((event.clientX - box.left) / box.width) * canvas.width, y: ((event.clientY - box.top) / box.height) * canvas.height };
};
function scroll(by) {
  const id = current().id;
  if (id === "volume") {
    state.yaw = (((state.yaw + by) % 24) + 24) % 24;
  } else {
    const set = dataset();
    state.slice[set] = Math.max(0, Math.min(info[set].slices.length - 1, state.slice[set] + by));
  }
  touchedIf(id);
  render(false);
}
/** Scrolling completes the steps that are about scrolling, not the others. */
function touchedIf(id) {
  if (id === "scroll" || id === "volume") {
    const before = state.done.size;
    touched();
    if (state.done.size !== before) buildGuide();
  }
}
let drag = null;
pic.addEventListener("pointerdown", (event) => {
  run += 1;
  pic.setPointerCapture(event.pointerId);
  const at = point(event);
  drag = { ...at, carried: 0 };
  if (current().id === "measure") state.line = { x0: at.x, y0: at.y, x1: at.x, y1: at.y };
});
pic.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const at = point(event);
  const id = current().id;
  if (id === "measure") {
    state.line.x1 = at.x;
    state.line.y1 = at.y;
    render(false);
    return;
  }
  drag.carried += id === "volume" ? at.x - drag.x : at.y - drag.y;
  drag.x = at.x;
  drag.y = at.y;
  const stride = id === "volume" ? 14 : 16;
  while (Math.abs(drag.carried) >= stride) {
    scroll(drag.carried > 0 ? 1 : -1);
    drag.carried -= Math.sign(drag.carried) * stride;
  }
});
pic.addEventListener("pointerup", () => {
  if (current().id === "measure" && state.line && Math.hypot(state.line.x1 - state.line.x0, state.line.y1 - state.line.y0) > 6) {
    touched();
    buildGuide();
  }
  drag = null;
});
pic.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    run += 1;
    scroll(event.deltaY > 0 ? 1 : -1);
  },
  { passive: false },
);
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    run += 1;
    scroll(event.key === "ArrowDown" ? 1 : -1);
  }
});

go(0);
