import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushAudit } from "../utils/auditLog";
import { trackAuthError, trackAuthEvent } from "../lib/authTelemetry";
import { ms } from "../utils/moduleStyles";
import InlineAlert from "../components/InlineAlert";
import { MIN_PASSWORD_LENGTH_RESET } from "../config/authPolicy";
import { getSupportEmail } from "../config/supportContact";

const ss = ms;
const teal = "#0d9488";
const navy = "#0f172a";
const SUPPORT_EMAIL = getSupportEmail();

export default function ResetPasswordPage() {
  const { supabase: client, user, ready, loading } = useSupabaseAuth();
  const cloud = isSupabaseConfigured() && client;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const completeReset = async () => {
    if (!client) return;
    if (!user) {
      setMsg("Open the reset link from your email first, then return here to set your new password.");
      return;
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH_RESET) {
      setMsg(`New password must be at least ${MIN_PASSWORD_LENGTH_RESET} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      return;
    }
    setMsg("");
    setBusy(true);
    trackAuthEvent("password_reset_submit");
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      pushAudit({ action: "supabase_password_reset_completed", entity: "auth", detail: user?.email || "" });
      trackAuthEvent("password_reset_success", { hasUser: Boolean(user) });
      setPassword("");
      setConfirmPassword("");
      setMsg("Password updated. You can sign in now.");
    } catch (e) {
      trackAuthError("password_reset_failed", e, { hasUser: Boolean(user) });
      setMsg(e.message || "Could not update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "DM Sans, system-ui, sans-serif", padding: "1.5rem 1rem 2rem" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Link to="/" style={{ textDecoration: "none", color: navy, display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: teal, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <ShieldCheck size={26} strokeWidth={2} aria-hidden />
            </span>
            <span style={{ fontWeight: 700, fontSize: 20 }}>MySafeOps</span>
          </Link>
        </div>

        <div style={{ ...ss.card, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: navy }}>Set a new password</h1>

          {!cloud ? (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.55 }}>
              Cloud authentication is not configured in this environment.
            </p>
          ) : !ready || loading ? (
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.55 }}>Checking reset session…</p>
          ) : !user ? (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.55 }}>
                Use the password-reset link from your email first. That link creates a temporary recovery session for this page.
              </p>
              <Link to="/login" style={{ color: teal, fontWeight: 500, textDecoration: "none" }}>
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px", lineHeight: 1.55 }}>
                Updating password for <strong>{user.email}</strong>.
              </p>
              <label style={ss.lbl}>New password</label>
              <input type="password" autoComplete="new-password" style={ss.inp} value={password} onChange={(e) => setPassword(e.target.value)} />
              <label style={{ ...ss.lbl, marginTop: 10 }}>Confirm new password</label>
              <input type="password" autoComplete="new-password" style={ss.inp} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <div style={{ marginTop: 14 }}>
                <button type="button" style={ss.btnP} disabled={busy || !password || !confirmPassword} onClick={completeReset}>
                  Save new password
                </button>
              </div>
            </>
          )}

          <InlineAlert
            type={
              msg.toLowerCase().includes("updated")
                ? "success"
                : msg.toLowerCase().includes("must") || msg.toLowerCase().includes("match") || msg.toLowerCase().includes("could not")
                  ? "error"
                  : "info"
            }
            text={msg}
            style={{ marginTop: 14 }}
          />
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Need help? Contact support:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: teal, fontWeight: 500 }}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

