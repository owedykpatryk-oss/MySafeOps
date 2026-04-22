import { Navigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";

/**
 * When Supabase env is set, /app requires a signed-in user.
 * Without Supabase, the workspace is always available.
 */
export default function ProtectedAppRoute({ children }) {
  const configured = isSupabaseConfigured();
  const { user, ready } = useSupabaseAuth();

  if (!configured) {
    return children;
  }

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans, system-ui, sans-serif",
          padding: "1rem",
          background: "var(--color-background-tertiary, #f8fafc)",
        }}
      >
        <div className="app-view-fallback" role="status" aria-live="polite" aria-busy="true">
          <div className="app-route-spinner" aria-hidden />
          <span className="app-view-fallback-text">Checking session…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=%2Fapp" replace />;
  }

  return children;
}
