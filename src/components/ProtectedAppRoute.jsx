import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { getRequiresMfaStep } from "../lib/mfaAal";
import MfaLoginChallenge from "./MfaLoginChallenge";
import { getSupportEmail } from "../config/supportContact";
import { isPasswordRecoveryPending } from "../lib/passwordRecovery";
import IdleSessionGuard from "./IdleSessionGuard";

/**
 * When Supabase env is set, /app requires a signed-in user.
 * If the account has MFA enrolled, AAL2 is required before the workspace loads
 * (login-page MFA alone is not enough — bookmarks/reloads must re-challenge).
 * Without Supabase, the workspace is always available (device-only mode).
 */
export default function ProtectedAppRoute({ children }) {
  const configured = isSupabaseConfigured();
  const { user, ready, supabase: client } = useSupabaseAuth();
  const [mfa, setMfa] = useState({ checking: false, needsMfa: false, probeFailed: false, error: "" });
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaTick, setMfaTick] = useState(0);

  useEffect(() => {
    if (!configured || !ready || !user || !client) {
      setMfa({ checking: false, needsMfa: false, probeFailed: false, error: "" });
      return undefined;
    }
    let cancelled = false;
    setMfa((prev) => ({ ...prev, checking: true, probeFailed: false, error: "" }));
    getRequiresMfaStep(client)
      .then(({ needsMfa, probeFailed, error }) => {
        if (!cancelled) {
          setMfa({
            checking: false,
            needsMfa: Boolean(needsMfa),
            probeFailed: Boolean(probeFailed),
            error: error || "",
          });
        }
      })
      .catch((e) => {
        // Fail closed: do not load /app until MFA status is confirmed.
        if (!cancelled) {
          setMfa({
            checking: false,
            needsMfa: false,
            probeFailed: true,
            error: e?.message || "MFA status check failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configured, ready, user, client, mfaTick]);

  if (!configured) {
    return children;
  }

  if (!ready || (user && mfa.checking)) {
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
          <span className="app-view-fallback-text">{mfa.checking ? "Confirming MFA…" : "Checking session…"}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=%2Fapp" replace />;
  }

  if (isPasswordRecoveryPending()) {
    return <Navigate to="/reset-password" replace />;
  }

  if (mfa.probeFailed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans, system-ui, sans-serif",
          padding: "1.5rem",
          background: "var(--color-background-tertiary, #f8fafc)",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Security check unavailable</h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 16px" }}>
            We could not confirm multi-factor authentication status. The workspace stays locked until this check succeeds.
          </p>
          {mfa.error ? (
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>{mfa.error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setMfaTick((n) => n + 1)}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry security check
          </button>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 16 }}>
            Need help?{" "}
            <a href={`mailto:${getSupportEmail()}`} style={{ color: "#0d9488" }}>
              {getSupportEmail()}
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (mfa.needsMfa && client) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans, system-ui, sans-serif",
          padding: "1.5rem",
          background: "var(--color-background-tertiary, #f8fafc)",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Authenticator required</h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 16px" }}>
            This account has MFA enabled. Enter your authenticator code to continue to the workspace.
          </p>
          <MfaLoginChallenge
            client={client}
            supportEmail={getSupportEmail()}
            setBusy={setMfaBusy}
            onSuccess={() => setMfaTick((n) => n + 1)}
          />
          {mfaBusy ? (
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 12 }} aria-live="polite">
              Verifying…
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return <IdleSessionGuard>{children}</IdleSessionGuard>;
}
