import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import RouteErrorBoundary from "./components/RouteErrorBoundary";
import ProtectedAppRoute from "./components/ProtectedAppRoute";
import { ViewFallback } from "./components/ViewFallback";
import { safeOpaqueToken } from "./utils/htmlEscape.js";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage"));
const BlogArticlePage = lazy(() => import("./pages/BlogArticlePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const DocsHubPage = lazy(() => import("./pages/DocsHubPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const SecurityPosturePage = lazy(() => import("./pages/SecurityPosturePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const MainAppLayout = lazy(() => import("./layout/MainAppLayout"));

const PublicClientPortalView = lazy(() =>
  import("./components/ClientPortal").then((m) => ({ default: m.PublicClientPortalView }))
);
const PublicSubcontractorView = lazy(() =>
  import("./modules/SubcontractorPortal").then((m) => ({ default: m.PublicSubcontractorView }))
);
const PublicRamsShareView = lazy(() => import("./modules/rams/PublicRamsShareView"));

function PublicShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <RouteErrorBoundary>
        <Suspense fallback={<ViewFallback />}>{children}</Suspense>
      </RouteErrorBoundary>
    </div>
  );
}

export default function App() {
  const qs = new URLSearchParams(window.location.search);
  const portal = safeOpaqueToken(qs.get("portal"));
  const sub = safeOpaqueToken(qs.get("subcontractor"));
  const ramsShare = safeOpaqueToken(qs.get("ramsShare"));

  if (ramsShare) {
    return (
      <PublicShell>
        <PublicRamsShareView token={ramsShare} />
      </PublicShell>
    );
  }

  if (portal) {
    return (
      <PublicShell>
        <PublicClientPortalView token={portal} />
      </PublicShell>
    );
  }
  if (sub) {
    return (
      <PublicShell>
        <PublicSubcontractorView token={sub} />
      </PublicShell>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<ViewFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/au" element={<LandingPage marketId="au" />} />
          <Route path="/pl" element={<LandingPage marketId="pl" />} />
          <Route path="/de" element={<LandingPage marketId="de" />} />
          <Route path="/at" element={<LandingPage marketId="at" />} />
          <Route path="/ch" element={<LandingPage marketId="ch" />} />
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/blog/:slug" element={<BlogArticlePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/privacy" element={<LegalPage docKey="privacy" />} />
          <Route path="/terms" element={<LegalPage docKey="terms" />} />
          <Route path="/cookies" element={<LegalPage docKey="cookies" />} />
          <Route path="/dpa" element={<LegalPage docKey="dpa" />} />
          <Route path="/accessibility" element={<LegalPage docKey="accessibility" />} />
          <Route path="/au/privacy" element={<LegalPage docKey="privacy" marketId="au" />} />
          <Route path="/au/terms" element={<LegalPage docKey="terms" marketId="au" />} />
          <Route path="/au/cookies" element={<LegalPage docKey="cookies" marketId="au" />} />
          <Route path="/au/dpa" element={<LegalPage docKey="dpa" marketId="au" />} />
          <Route path="/au/accessibility" element={<LegalPage docKey="accessibility" marketId="au" />} />
          <Route path="/pl/privacy" element={<LegalPage docKey="privacy" marketId="pl" />} />
          <Route path="/pl/terms" element={<LegalPage docKey="terms" marketId="pl" />} />
          <Route path="/pl/cookies" element={<LegalPage docKey="cookies" marketId="pl" />} />
          <Route path="/pl/dpa" element={<LegalPage docKey="dpa" marketId="pl" />} />
          <Route path="/pl/accessibility" element={<LegalPage docKey="accessibility" marketId="pl" />} />
          <Route path="/de/privacy" element={<LegalPage docKey="privacy" marketId="de" />} />
          <Route path="/de/terms" element={<LegalPage docKey="terms" marketId="de" />} />
          <Route path="/de/cookies" element={<LegalPage docKey="cookies" marketId="de" />} />
          <Route path="/de/dpa" element={<LegalPage docKey="dpa" marketId="de" />} />
          <Route path="/de/accessibility" element={<LegalPage docKey="accessibility" marketId="de" />} />
          <Route path="/de/impressum" element={<LegalPage docKey="impressum" marketId="de" />} />
          <Route path="/at/privacy" element={<LegalPage docKey="privacy" marketId="at" />} />
          <Route path="/at/terms" element={<LegalPage docKey="terms" marketId="at" />} />
          <Route path="/at/cookies" element={<LegalPage docKey="cookies" marketId="at" />} />
          <Route path="/at/dpa" element={<LegalPage docKey="dpa" marketId="at" />} />
          <Route path="/at/accessibility" element={<LegalPage docKey="accessibility" marketId="at" />} />
          <Route path="/ch/privacy" element={<LegalPage docKey="privacy" marketId="ch" />} />
          <Route path="/ch/terms" element={<LegalPage docKey="terms" marketId="ch" />} />
          <Route path="/ch/cookies" element={<LegalPage docKey="cookies" marketId="ch" />} />
          <Route path="/ch/dpa" element={<LegalPage docKey="dpa" marketId="ch" />} />
          <Route path="/ch/accessibility" element={<LegalPage docKey="accessibility" marketId="ch" />} />
          <Route path="/docs" element={<DocsHubPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/security" element={<SecurityPosturePage />} />
          <Route
            path="/app"
            element={
              <ProtectedAppRoute>
                <MainAppLayout />
              </ProtectedAppRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
