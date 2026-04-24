import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import RouteErrorBoundary from "./components/RouteErrorBoundary";
import ProtectedAppRoute from "./components/ProtectedAppRoute";
import { ViewFallback } from "./components/ViewFallback";

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
  const portal = qs.get("portal");
  const sub = qs.get("subcontractor");
  const ramsShare = qs.get("ramsShare");

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
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/blog/:slug" element={<BlogArticlePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/privacy" element={<LegalPage docKey="privacy" />} />
          <Route path="/terms" element={<LegalPage docKey="terms" />} />
          <Route path="/cookies" element={<LegalPage docKey="cookies" />} />
          <Route path="/dpa" element={<LegalPage docKey="dpa" />} />
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
