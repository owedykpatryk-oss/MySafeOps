import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushAudit } from "../utils/auditLog";
import { signInWithGoogleOAuth } from "../lib/authRedirect";
import { clearAuthFailures, formatLockoutRemaining, getAuthLockoutState, recordAuthFailure } from "../lib/authLockout";
import { trackAuthError, trackAuthEvent } from "../lib/authTelemetry";
import { setPendingInviteToken } from "../lib/inviteToken";
import { ensureUserOrgContext } from "../utils/orgMembership";
import { ms } from "../utils/moduleStyles";

const ss = ms;
const teal = "#0d9488";
const navy = "#0f172a";
const SUPPORT_EMAIL = "mysafeops@gmail.com";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { supabase: client, user, loading, ready } = useSupabaseAuth();
  const cloud = isSupabaseConfigured() && client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const inviteToken = searchParams.get("invite") || "";
  const inviteEmail = (searchParams.get("email") || "").trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const lockout = getAuthLockoutState(normalizedEmail, Date.now());

  useEffect(() => {
    if (!inviteToken) return;
    setPendingInviteToken(inviteToken, inviteEmail);
    if (inviteEmail && !email) setEmail(inviteEmail);
  }, [inviteToken, inviteEmail, email]);

  useEffect(() => {
    if (!lockout.isLocked) return undefined;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [lockout.isLocked]);

  if (cloud && ready && user) {
    return <Navigate to="/app" replace />;
  }

  const signIn = async () => {
    if (!client) return;
    if (lockout.isLocked) {
      setMsg(`Too many failed attempts. Try again in ${formatLockoutRemaining(lockout.remainingMs)}.`);
      return;
    }
    setMsg("");
    setBusy(true);
    trackAuthEvent("sign_in_attempt", { email: normalizedEmail });
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      pushAudit({ action: "supabase_sign_in", entity: "auth", detail: email.trim() });
      clearAuthFailures(normalizedEmail);
      await ensureUserOrgContext(client);
      trackAuthEvent("sign_in_success", { email: normalizedEmail });
      setPassword("");
      navigate("/app", { replace: true });
    } catch (e) {
      const state = recordAuthFailure(normalizedEmail, Date.now());
      trackAuthError("sign_in_failed", e, { email: normalizedEmail, failures: state.failures });
      if (state.isLocked) {
        setMsg(`Too many failed attempts. Try again in ${formatLockoutRemaining(state.remainingMs)}.`);
      } else {
        setMsg(`${e.message || "Sign-in failed"} (${state.attemptsLeft} attempts left before temporary lockout).`);
      }
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!client) return;
    setMsg("");
    setBusy(true);
    trackAuthEvent("google_sign_in_start");
    try {
      const { error } = await signInWithGoogleOAuth(client, "/login");
      if (error) throw error;
    } catch (e) {
      trackAuthError("google_sign_in_failed", e);
      setMsg(e.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  const signUp = async () => {
    if (!client) return;
    setMsg("");
    setBusy(true);
    trackAuthEvent("sign_up_attempt", { email: normalizedEmail });
    try {
      const { error } = await client.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      pushAudit({ action: "supabase_sign_up", entity: "auth", detail: email.trim() });
      trackAuthEvent("sign_up_success", { email: normalizedEmail });
      setMsg("Account created. Check your inbox (and spam) to confirm your email before first sign-in.");
      setPassword("");
    } catch (e) {
      trackAuthError("sign_up_failed", e, { email: normalizedEmail });
      setMsg(e.message || "Sign-up failed");
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!client || !email.trim()) return;
    setMsg("");
    setBusy(true);
    trackAuthEvent("password_reset_email_request", { email: normalizedEmail });
    try {
      const redirectTo = new URL("/reset-password", window.location.origin).href;
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      pushAudit({ action: "supabase_reset_password_requested", entity: "auth", detail: email.trim() });
      setMsg("Password reset email sent. Open the link in that email to set a new password.");
    } catch (e) {
      trackAuthError("password_reset_email_failed", e, { email: normalizedEmail });
      setMsg(e.message || "Could not send reset email");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (!client || !email.trim()) return;
    setMsg("");
    setBusy(true);
    trackAuthEvent("resend_confirmation_attempt", { email: normalizedEmail });
    try {
      const emailRedirectTo = new URL("/login", window.location.origin).href;
      const { error } = await client.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo },
      });
      if (error) throw error;
      trackAuthEvent("resend_confirmation_success", { email: normalizedEmail });
      setMsg("Confirmation email re-sent. Check inbox and spam.");
    } catch (e) {
      trackAuthError("resend_confirmation_failed", e, { email: normalizedEmail });
      setMsg(e.message || "Could not resend confirmation email");
    } finally {
      setBusy(false);
    }
  };

  if (cloud && (!ready || loading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "DM Sans, sans-serif" }}>
        <div className="app-route-spinner" aria-hidden />
        <span style={{ marginLeft: 12, color: "var(--color-text-secondary)" }}>Loading…</span>
      </div>
    );
  }

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
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: navy }}>Workspace access</h1>
          {cloud ? (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px", lineHeight: 1.55 }}>
                Sign in with your Supabase account to use cloud backup (Backup module). Your organisation data still lives in this browser unless you upload a
                backup.
              </p>
              <label style={ss.lbl}>Email</label>
              <input type="email" autoComplete="email" style={ss.inp} value={email} onChange={(e) => setEmail(e.target.value)} />
              {inviteToken && (
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  Invite detected{inviteEmail ? ` for ${inviteEmail}` : ""}. Sign in or create account with this email to join your organisation.
                </p>
              )}
              <label style={{ ...ss.lbl, marginTop: 10 }}>Password</label>
              <input type="password" autoComplete="current-password" style={ss.inp} value={password} onChange={(e) => setPassword(e.target.value)} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <button type="button" style={ss.btnP} disabled={busy || lockout.isLocked || !email.trim() || !password} onClick={signIn}>
                  Sign in
                </button>
                <button type="button" style={ss.btn} disabled={busy || !email.trim() || password.length < 6} onClick={signUp}>
                  Create account
                </button>
              </div>
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="button" style={ss.btn} disabled={busy || !email.trim()} onClick={sendPasswordReset}>
                  Forgot password
                </button>
                <button type="button" style={ss.btn} disabled={busy || !email.trim()} onClick={resendConfirmationEmail}>
                  Resend confirmation email
                </button>
              </div>
              {lockout.isLocked && (
                <p style={{ marginTop: 12, fontSize: 12, color: "#b91c1c" }}>
                  Temporary lockout active: {formatLockoutRemaining(lockout.remainingMs)} remaining.
                </p>
              )}
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={signInWithGoogle}
                  style={{
                    ...ss.btn,
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    border: "1px solid var(--color-border-secondary,#cbd5e1)",
                    background: "#fff",
                    color: "#1e293b",
                    fontWeight: 500,
                  }}
                  aria-label="Continue with Google"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                  </svg>
                  Continue with Google
                </button>
                <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "8px 0 0", lineHeight: 1.45 }}>
                  Enable Google under Supabase → Authentication → Providers, and add this site&apos;s URL + <code style={{ fontSize: 10 }}>/login</code> to Redirect URLs.
                </p>
                <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "6px 0 0", lineHeight: 1.45 }}>
                  Password reset links should redirect to <code style={{ fontSize: 10 }}>/reset-password</code>.
                </p>
              </div>
              {msg && <p style={{ marginTop: 14, fontSize: 13 }}>{msg}</p>}
              <p style={{ marginTop: 12, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                Need help? Contact support:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: teal, fontWeight: 500 }}>
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--color-border-tertiary,#e2e8f0)" }}>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  Account required. Sign in or create an account to access workspace data and your organisation trial.
                </p>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px", lineHeight: 1.55 }}>
                Cloud authentication is not configured. Open the workspace to use MySafeOps with data stored in this browser. Add <code style={{ fontSize: 12 }}>VITE_SUPABASE_URL</code> and{" "}
                <code style={{ fontSize: 12 }}>VITE_SUPABASE_ANON_KEY</code> in <code style={{ fontSize: 12 }}>.env.local</code> to enable sign-in and backup.
              </p>
              <button type="button" style={ss.btnP} onClick={() => navigate("/app", { replace: true })}>
                Open workspace
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
          <Link to="/" style={{ color: teal, fontWeight: 500 }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
