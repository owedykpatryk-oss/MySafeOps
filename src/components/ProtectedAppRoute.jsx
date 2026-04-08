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
          gap: 12,
          color: "var(--color-text-secondary)",
        }}
      >
        <div className="app-route-spinner" aria-hidden />
        <span style={{ fontSize: 14 }}>Checking session…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=%2Fapp" replace />;
  }

  return children;
}
