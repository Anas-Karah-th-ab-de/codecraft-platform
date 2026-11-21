import { Component, StrictMode, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { AuthProvider } from "./api";
import { Home } from "./pages/site/Home";
import { ProductPage } from "./pages/site/Product";
import { SiteLayout, Products, ProductDetail, Careers, JobDetail, Contact, NotFound } from "./pages/site/Site";
import "@fontsource/unbounded/latin-500.css";
import "@fontsource/unbounded/latin-600.css";
import "@fontsource/unbounded/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-500.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-600.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "./styles.css";

// Nach einem Update fehlen Dateien des alten Stands → einmal neu laden (höchstens alle 30 s, keine Schleife)
const reloadOnce = () => {
  try {
    const last = Number(sessionStorage.getItem("km_reload_at") ?? 0);
    if (Date.now() - last < 30000) return;
    sessionStorage.setItem("km_reload_at", String(Date.now()));
  } catch { /* ohne Speicher: einfach neu laden */ }
  location.reload();
};
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnce(); });

/**
 * Neue Version auf dem Server? Die App (und offene Browser-Tabs) halten die Seite oft tagelang offen und laufen
 * sonst mit dem alten Stand weiter – behobene Fehler blieben sichtbar. Beim Zurückkehren zur Seite und alle
 * 10 Minuten prüfen; neu geladen wird nur, wenn gerade kein Anruf läuft und nichts getippt wird.
 */
const current = () => Array.from(document.scripts).map((x) => x.getAttribute("src")).find((x) => x?.includes("/assets/index-")) ?? null;
let pendingReload = false;
const idle = () => {
  if (document.querySelector(".callview, .meet-live")) return false;
  const a = document.activeElement as HTMLInputElement | null;
  return !(a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT") && a.value);
};
const checkVersion = async () => {
  const mine = current();
  if (!mine) return; // Entwicklungsserver
  try {
    const html = await (await fetch("/", { cache: "no-store" })).text();
    const live = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
    if (live && !mine.endsWith(live)) pendingReload = true;
  } catch { /* offline */ }
  if (pendingReload && idle()) reloadOnce();
};
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkVersion(); });
window.addEventListener("online", checkVersion);
window.setInterval(checkVersion, 10 * 60 * 1000);

/** Fängt Fehler der Oberfläche ab: In der App gibt es keinen „Neu laden“-Knopf – eine weiße Seite wäre eine Sackgasse */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) {
    const m = String(e?.message ?? e);
    fetch(`/api/v1/app/diag?crash=${encodeURIComponent(m.slice(0, 200))}`).catch(() => {});
    if (/dynamically imported module|module script failed|ChunkLoadError|error loading dynamically/i.test(m)) reloadOnce();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const l = (navigator.language || "de").slice(0, 2);
    const [text, again] = l === "ar" ? ["حدث خطأ في عرض الصفحة.", "إعادة التحميل"] : l === "en" ? ["Something went wrong on this page.", "Reload"] : ["Auf dieser Seite ist ein Fehler aufgetreten.", "Neu laden"];
    return <div className="crash"><b>KM Code Craft</b><p>{text}</p><button className="btn" onClick={() => location.reload()}>{again}</button></div>;
  }
}

// Portal wird erst beim Aufruf geladen → Webseite bleibt schlank und schnell
const Portal = lazy(() => import("./pages/portal/Portal"));
const Meeting = lazy(() => import("./pages/Meeting"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boundary>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="spin">…</div>}>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route index element={<Home />} />
                <Route path="produkte" element={<Products />} />
                <Route path="produkte/:slug" element={<ProductDetail />} />
                <Route path="kasse" element={<ProductPage k="kasse" />} />
                <Route path="ki-server" element={<ProductPage k="ki-server" />} />
                <Route path="karten" element={<ProductPage k="karten" />} />
                <Route path="e-health" element={<ProductPage k="radiologie" />} />
                <Route path="radiologie" element={<ProductPage k="radiologie" />} />
                <Route path="ultar-os" element={<ProductPage k="ultar-os" />} />
                <Route path="km-one" element={<ProductPage k="km-one" />} />
                <Route path="karriere" element={<Careers />} />
                <Route path="karriere/:slug" element={<JobDetail />} />
                <Route path="kontakt" element={<Contact />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="meet/:token" element={<Meeting />} />
              <Route path="portal/*" element={<Portal />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
    </Boundary>
  </StrictMode>,
);
