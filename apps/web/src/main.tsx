import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { AuthProvider } from "./api";
import { SiteLayout, Home, Products, Careers, JobDetail, Contact } from "./pages/site/Site";
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
