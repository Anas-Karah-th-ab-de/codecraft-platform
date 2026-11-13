import { StrictMode, Suspense, lazy } from "react";
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

// Portal wird erst beim Aufruf geladen → Webseite bleibt schlank und schnell
const Portal = lazy(() => import("./pages/portal/Portal"));
const Meeting = lazy(() => import("./pages/Meeting"));

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
                <Route path="kasse" element={<ProductPage k="kasse" />} />
                <Route path="ki-server" element={<ProductPage k="ki-server" />} />
                <Route path="karten" element={<ProductPage k="karten" />} />
                <Route path="radiologie" element={<ProductPage k="radiologie" />} />
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
  </StrictMode>,
);
