// Shared by the pages of the interactive demo: language, top bar, small helpers.
// Everything shown is fixed sample content; nothing is sent anywhere.
export const langs = ["ar", "en", "de"];
const wanted = new URLSearchParams(location.search).get("lang");
let stored = null;
try {
  stored = localStorage.getItem("kmcc-demo-lang");
} catch {
  stored = null;
}
const browser = (navigator.language || "en").slice(0, 2);
export const lang = langs.includes(wanted)
  ? wanted
  : langs.includes(stored)
    ? stored
    : langs.includes(browser)
      ? browser
      : "en";
try {
  localStorage.setItem("kmcc-demo-lang", lang);
} catch {
  // private mode: the choice lives in the address only
}
document.documentElement.lang = lang;
document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

/** The text of this language out of { ar, en, de }. */
export const t = (text) => (typeof text === "string" ? text : (text[lang] ?? text.en));

export function make(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const common = {
  brand: "KM Code Craft Radiology",
  tag: { ar: "عرض تجريبي", en: "Demo", de: "Demo" },
  home: { ar: "البداية", en: "Start", de: "Start" },
  viewer: { ar: "العارض", en: "Viewer", de: "Viewer" },
  workflow: { ar: "سير العمل", en: "Workflow", de: "Ablauf" },
  site: { ar: "صفحة المنتج", en: "Product page", de: "Produktseite" },
  note: {
    ar: "عرض تجريبي بمحتوى ثابت: ليس النظام الحقيقي، ولا يُحفظ أو يُرسل شيء. الأشخاص والبيانات مختلقة؛ الصور من مجموعات بحثية عامة مجهولة الهوية (The Cancer Imaging Archive، ترخيص CC BY). خريطة الفرق والدمج والعرض ثلاثي الأبعاد وسائل مساعدة محسوبة، لا قياس ولا تشخيص.",
    en: "A demo with fixed content: not the real system, nothing is stored or sent. Persons and details are invented; the images come from public, anonymised research collections (The Cancer Imaging Archive, CC BY). Difference map, fusion and 3D are computed aids, not a measurement or a diagnosis.",
    de: "Eine Demo mit festen Inhalten: nicht das echte System, nichts wird gespeichert oder gesendet. Personen und Angaben sind erfunden; die Aufnahmen stammen aus öffentlichen, anonymisierten Forschungssammlungen (The Cancer Imaging Archive, CC BY). Differenzkarte, Überlagerung und 3D sind berechnete Hilfen, keine Messung und keine Diagnose.",
  },
};

/** Top bar with the pages of the demo and the languages; `here` is the page shown. */
export function topBar(here) {
  const page = (id, file) =>
    make("a", {
      class: `pill${here === id ? " on" : ""}`,
      href: `${file}?lang=${lang}`,
      text: t(common[id]),
    });
  const bar = make("header", { class: "top" }, [
    make("span", { class: "brand", text: common.brand }),
    make("span", { class: "tag", text: t(common.tag) }),
    make("nav", {}, [
      page("home", "index.html"),
      page("viewer", "viewer.html"),
      page("workflow", "workflow.html"),
    ]),
    make("span", { class: "grow" }),
    make(
      "nav",
      {},
      langs.map((code) =>
        make("a", {
          class: `pill${code === lang ? " on" : ""}`,
          href: `${location.pathname}?lang=${code}`,
          text: { ar: "العربية", en: "English", de: "Deutsch" }[code],
        }),
      ),
    ),
    make("a", { class: "pill", href: `../index.html?lang=${lang}`, text: t(common.site) }),
  ]);
  document.body.prepend(bar, make("div", { class: "note", text: t(common.note) }));
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
