import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import RouteErrorBoundary from "./components/RouteErrorBoundary";
import ProtectedAppRoute from "./components/ProtectedAppRoute";
import { ViewFallback } from "./components/ViewFallback";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage"));
const BlogArticlePage = lazy(() => import("./pages/BlogArticlePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
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
          <Route path="/blog/:slug" element={<BlogArticlePage />} />
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route
            path="/app"
            element={
              <ProtectedAppRoute>
                <MainAppLayout />
              </ProtectedAppRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
