import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import RouteErrorBoundary from "./components/RouteErrorBoundary";
import ProtectedAppRoute from "./components/ProtectedAppRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MainAppLayout, { ViewFallback } from "./layout/MainAppLayout";

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
        <Suspense fallback={<ViewFallback />}>
          <PublicRamsShareView token={ramsShare} />
        </Suspense>
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
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
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
    </BrowserRouter>
  );
}
