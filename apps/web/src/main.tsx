import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { AuthProvider } from "./api";
import { Home } from "./pages/site/Home";
import { SiteLayout, Products, ProductDetail, Careers, JobDetail, Contact } from "./pages/site/Site";
import "@fontsource/red-hat-display/latin-500.css";
import "@fontsource/red-hat-display/latin-700.css";
import "@fontsource/red-hat-display/latin-800.css";
import "@fontsource/red-hat-text/latin-400.css";
import "@fontsource/red-hat-text/latin-500.css";
import "@fontsource/red-hat-text/latin-600.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./styles.css";

// Portal wird erst beim Aufruf geladen → Webseite bleibt schlank und schnell
const Portal = lazy(() => import("./pages/portal/Portal"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="spin">…</div>}>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route index element={<Home />} />
                <Route path="produkte" element={<Products />} />
                <Route path="produkte/:slug" element={<ProductDetail />} />
                <Route path="karriere" element={<Careers />} />
                <Route path="karriere/:slug" element={<JobDetail />} />
                <Route path="kontakt" element={<Contact />} />
              </Route>
              <Route path="portal/*" element={<Portal />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
