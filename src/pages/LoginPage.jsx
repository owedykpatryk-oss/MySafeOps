import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushAudit } from "../utils/auditLog";
import { signInWithGoogleOAuth } from "../lib/authRedirect";
import { clearAuthFailures, formatLockoutRemaining, getAuthLockoutState, recordAuthFailure } from "../lib/authLockout";
import { trackAuthError, trackAuthEvent } from "../lib/authTelemetry";
import { setPendingInviteToken } from "../lib/inviteToken";
import { ensureUserOrgContext } from "../utils/orgMembership";
import { ms } from "../utils/moduleStyles";
import InlineAlert from "../components/InlineAlert";
import { getPasswordStrengthMeta } from "../utils/passwordStrength";
import { getInboxUrl } from "../utils/emailInbox";
import { MIN_PASSWORD_LENGTH_SIGNUP } from "../config/authPolicy";
import { getSupportEmail } from "../config/supportContact";
import { getRequiresMfaStep } from "../lib/mfaAal";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import { safeInternalPath } from "../utils/safeUrl";
import MfaLoginChallenge from "../components/MfaLoginChallenge";

const ss = ms;
const teal = "#0d9488";
const navy = "#0f172a";
const SUPPORT_EMAIL = getSupportEmail();
const SHOW_ADMIN_LOGIN_HINTS = showAdminLoginHints();
const MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH_SIGNUP;
const RESEND_COOLDOWN_SECONDS = 45;
const LAST_AUTH_EMAIL_KEY = "mysafeops_last_auth_email";

function mapAuthErrorMessage(error, fallback = "Authentication request failed") {
  const raw = String(error?.message || "").trim();
  const m = raw.toLowerCase();
  if (!raw) return fallback;
  if (m.includes("user already registered") || m.includes("already registered") || m.includes("already exists")) {
    return "An account with this email already exists. Try Sign in or Forgot password.";
  }
  if (m.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (m.includes("invalid email")) {
    return "Email address format is invalid.";
  }
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) {
    return "Email not confirmed yet. Use 'Resend confirmation email', then open the link from your inbox.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts right now. Please wait a moment and try again.";
  }
  if (m.includes("password")) {
    return raw;
  }
  return raw || fallback;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const emailInputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const { supabase: client, user, loading, ready } = useSupabaseAuth();
  const cloud = isSupabaseConfigured() && client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptLegalTerms, setAcceptLegalTerms] = useState(false);
  const [, setTick] = useState(0);
  const inviteToken = searchParams.get("invite") || "";
  const inviteEmail = (searchParams.get("email") || "").trim().toLowerCase();
  const oauthError = searchParams.get("error_description") || searchParams.get("error") || "";
  const nextParam = searchParams.get("next") || "/app";
  const safeNextPath = useMemo(() => safeInternalPath(nextParam, "/app"), [nextParam]);
  const normalizedEmail = email.trim().toLowerCase();
  const lockout = getAuthLockoutState(normalizedEmail, Date.now());
  const passwordStrength = useMemo(() => getPasswordStrengthMeta(password, MIN_PASSWORD_LENGTH), [password]);

  const rememberAuthEmail = (value) => {
    const v = String(value || "").trim().toLowerCase();
    if (!v) return;
    try {
      localStorage.setItem(LAST_AUTH_EMAIL_KEY, v);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_AUTH_EMAIL_KEY);
      if (saved && !email) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, [email]);

  useEffect(() => {
    if (!inviteToken) return;
    setPendingInviteToken(inviteToken, inviteEmail);
    if (inviteEmail && !email) setEmail(inviteEmail);
    if (inviteEmail) rememberAuthEmail(inviteEmail);
  }, [inviteToken, inviteEmail, email]);

  useEffect(() => {
    if (!oauthError) return;
    const friendly = oauthError.replace(/\+/g, " ").replace(/OAuth/i, "Google sign-in");
    setMsg(`Authentication issue: ${friendly}`);
  }, [oauthError]);

  useEffect(() => {
    if (!lockout.isLocked) return undefined;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [lockout.isLocked]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const id = window.setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  const [aalState, setAalState] = useState("idle");
  const mfaGateActiveRef = useRef(false);

  useEffect(() => {
    if (!user || !ready || !client) {
      if (!user) {
        mfaGateActiveRef.current = false;
        setAalState("idle");
      }
      return;
    }
    if (mfaGateActiveRef.current) return;
    let cancelled = false;
    setAalState("unknown");
    (async () => {
      const { needsMfa, error } = await getRequiresMfaStep(client);
      if (cancelled) return;
      if (error) {
        setMsg((m) => (m ? m : `Sign-in check: ${error}`));
        setAalState("form_error");
        return;
      }
      if (needsMfa) {
        mfaGateActiveRef.current = true;
        setAalState("mfa");
        return;
      }
      try {
        await ensureUserOrgContext(client);
        const ue = (user.email || "").trim();
        if (ue) {
          trackAuthEvent("sign_in_success", { email: ue.toLowerCase() });
          rememberAuthEmail(ue);
        }
        setPassword("");
        navigate(safeNextPath, { replace: true });
      } catch (e) {
        setMsg(e?.message || "Could not prepare workspace");
        setAalState("form_error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, ready, client, safeNextPath, navigate]);

  const signIn = async () => {
    if (!client) return;
    if (!email.trim()) {
      setMsg("Enter your email address first.");
      return;
    }
    if (!password) {
      setMsg("Enter your password first.");
      return;
    }
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
      rememberAuthEmail(email.trim());
      setPassword("");
    } catch (e) {
      const rawMessage = String(e?.message || "");
      const unconfirmed =
        rawMessage.toLowerCase().includes("email not confirmed") ||
        rawMessage.toLowerCase().includes("email_not_confirmed");
      if (unconfirmed) {
        trackAuthEvent("sign_in_unconfirmed", { email: normalizedEmail });
        setPendingConfirmationEmail(normalizedEmail);
        setMsg("Email not confirmed yet. Use 'Resend confirmation email', then open the link from your inbox and sign in again.");
        return;
      }
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
      const loginRedirectPath = `/login${safeNextPath !== "/app" ? `?next=${encodeURIComponent(safeNextPath)}` : ""}`;
      const before = window.location.href;
      const { data, error } = await signInWithGoogleOAuth(client, loginRedirectPath);
      if (error) throw error;
      // Fallback: if auto-redirect didn't kick in, force navigation.
      if (data?.url && window.location.href === before) {
        window.location.assign(data.url);
      }
      // Safety net: prevent permanently disabled auth buttons if redirect is blocked.
      window.setTimeout(() => {
        if (window.location.href === before) {
          setBusy(false);
          setMsg("Google sign-in did not open. Please allow pop-ups/redirects and try again.");
        }
      }, 2500);
    } catch (e) {
      trackAuthError("google_sign_in_failed", e);
      setMsg(e.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  const signUp = async () => {
    if (!client) return;
    if (!email.trim()) {
      setMsg("Enter your email address first.");
      return;
    }
    if (!acceptLegalTerms) {
      setMsg("Please confirm you have read the terms of service and privacy policy.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMsg(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setMsg("");
    setBusy(true);
    trackAuthEvent("sign_up_attempt", { email: normalizedEmail });
    try {
      const emailRedirectTo = new URL("/login", window.location.origin).href;
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      pushAudit({ action: "supabase_sign_up", entity: "auth", detail: email.trim() });
      trackAuthEvent("sign_up_success", { email: normalizedEmail });
      // If email confirmation is disabled in Supabase, a session may be returned immediately.
      if (data?.session) {
        setMsg("Account created. Finishing sign-in…");
        rememberAuthEmail(email.trim());
        setPassword("");
        return;
      }
      setPendingConfirmationEmail(normalizedEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      rememberAuthEmail(normalizedEmail);
      setMsg("Account created. Confirmation email sent — check inbox and spam, open the link, then sign in.");
      setPassword("");
    } catch (e) {
      trackAuthError("sign_up_failed", e, { email: normalizedEmail });
      setMsg(mapAuthErrorMessage(e, "Sign-up failed"));
    } finally {
      setBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!client) return;
    if (!email.trim()) {
      setMsg("Enter your email address first.");
      return;
    }
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
      setMsg(mapAuthErrorMessage(e, "Could not send reset email"));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (!client) return;
    const targetEmail = (pendingConfirmationEmail || email.trim()).toLowerCase();
    if (!targetEmail) {
      setMsg("Enter your email address first.");
      return;
    }
    if (resendCooldown > 0) {
      setMsg(`Please wait ${resendCooldown}s before sending another confirmation email.`);
      return;
    }
    setMsg("");
    setBusy(true);
    trackAuthEvent("resend_confirmation_attempt", { email: targetEmail });
    try {
      const emailRedirectTo = new URL("/login", window.location.origin).href;
      const { error } = await client.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      trackAuthEvent("resend_confirmation_success", { email: targetEmail });
      setPendingConfirmationEmail(targetEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      rememberAuthEmail(targetEmail);
      setMsg("Confirmation email re-sent. Check inbox and spam.");
    } catch (e) {
      trackAuthError("resend_confirmation_failed", e, { email: targetEmail });
      setMsg(mapAuthErrorMessage(e, "Could not resend confirmation email"));
    } finally {
      setBusy(false);
    }
  };

  if (cloud && (!ready || loading)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans, sans-serif",
          padding: "1rem",
          background: "var(--color-background-tertiary, #f8fafc)",
        }}
      >
        <div className="app-view-fallback" role="status" aria-live="polite" aria-busy="true">
          <div className="app-route-spinner" aria-hidden />
          <span className="app-view-fallback-text">Loading…</span>
        </div>
      </div>
    );
  }

  if (cloud && ready && user) {
    if (aalState === "unknown" || aalState === "idle") {
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
            background:
              "radial-gradient(130% 70% at 50% -8%, rgba(20,184,166,0.16), transparent 55%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #f8fafc 100%)",
          }}
        >
          <div className="app-view-fallback" style={{ textAlign: "center" }} role="status" aria-live="polite" aria-busy="true">
            <div className="app-route-spinner" aria-hidden />
            <span className="app-view-fallback-text">Checking your session…</span>
          </div>
        </div>
      );
    }
    if (aalState === "mfa" && client) {
      return (
        <div
          style={{
            minHeight: "100vh",
            fontFamily: "DM Sans, system-ui, sans-serif",
            padding: "1.5rem 1rem 2rem",
            background:
              "radial-gradient(130% 70% at 50% -8%, rgba(20,184,166,0.16), transparent 55%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #f8fafc 100%)",
          }}
        >
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 20, color: navy, display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 44, height: 44, borderRadius: 10, background: teal, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <ShieldCheck size={26} strokeWidth={2} aria-hidden />
                </span>
                MySafeOps
              </span>
            </div>
            <div
              style={{
                ...ss.card,
                border: "1px solid rgba(203,213,225,0.8)",
                boxShadow: "0 12px 34px rgba(15,23,42,0.09)",
                backdropFilter: "blur(3px)",
              }}
            >
              <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: navy }}>Verify it&apos;s you</h1>
              <MfaLoginChallenge
                client={client}
                setBusy={setBusy}
                onSuccess={async () => {
                  mfaGateActiveRef.current = false;
                  const em = (user?.email || email || "").trim();
                  if (!em) return;
                  try {
                    await ensureUserOrgContext(client);
                    trackAuthEvent("sign_in_success", { email: em.toLowerCase() });
                    clearAuthFailures(em.toLowerCase());
                    rememberAuthEmail(em);
                    setPassword("");
                    navigate(safeNextPath, { replace: true });
                  } catch (e) {
                    setMsg(e?.message || "Could not prepare workspace");
                    setAalState("form_error");
                  }
                }}
                supportEmail={SUPPORT_EMAIL}
              />
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
    if (aalState === "form_error" && client) {
      return (
        <div
          style={{
            minHeight: "100vh",
            fontFamily: "DM Sans, system-ui, sans-serif",
            padding: "1.5rem 1rem 2rem",
            background:
              "radial-gradient(130% 70% at 50% -8%, rgba(20,184,166,0.16), transparent 55%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #f8fafc 100%)",
          }}
        >
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <span style={{ fontWeight: 700, fontSize: 20, color: navy, display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: teal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <ShieldCheck size={26} strokeWidth={2} aria-hidden />
                </span>
                MySafeOps
              </span>
            </div>
            <div
              className="app-surface-card"
              style={{
                ...ss.card,
                border: "1px solid rgba(203,213,225,0.8)",
                boxShadow: "0 12px 34px rgba(15,23,42,0.09)",
                backdropFilter: "blur(3px)",
              }}
            >
              <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: navy }}>Session check</h1>
              {msg ? (
                <p id="login-session-check-msg" role="alert" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                  {msg}
                </p>
              ) : null}
              <button
                type="button"
                style={{ ...ss.btn, marginTop: 12, width: "100%" }}
                onClick={async () => {
                  mfaGateActiveRef.current = false;
                  setAalState("idle");
                  await client.auth.signOut();
                }}
              >
                Start over
              </button>
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
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "DM Sans, system-ui, sans-serif",
        padding: "1.5rem 1rem 2rem",
        background:
          "radial-gradient(130% 70% at 50% -8%, rgba(20,184,166,0.16), transparent 55%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 42%, #f8fafc 100%)",
      }}
    >
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Link to="/" style={{ textDecoration: "none", color: navy, display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: teal, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <ShieldCheck size={26} strokeWidth={2} aria-hidden />
            </span>
            <span style={{ fontWeight: 700, fontSize: 20 }}>MySafeOps</span>
          </Link>
        </div>

        <div
          data-login-next={safeNextPath}
          style={{
            ...ss.card,
            border: "1px solid rgba(203,213,225,0.8)",
            boxShadow: "0 12px 34px rgba(15,23,42,0.09)",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 9px",
              borderRadius: 999,
              background: "rgba(13,148,136,0.08)",
              border: "1px solid rgba(13,148,136,0.24)",
              color: "#0f766e",
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            <Sparkles size={13} aria-hidden />
            Site safety workspace
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: navy }}>Welcome back to MySafeOps</h1>
          {cloud ? (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px", lineHeight: 1.55 }}>
                Sign in to manage your site safety. Use your work email and password (or Google, if your organisation enabled it). Cloud backup is available from
                Backup after you sign in.
              </p>
              <label htmlFor="login-email" style={ss.lbl}>
                Email
              </label>
              <div
                style={{
                  ...ss.inp,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <Mail size={15} color="#64748b" aria-hidden />
                <input
                  id="login-email"
                  ref={emailInputRef}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 14,
                    background: "transparent",
                    color: "var(--color-text-primary)",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              {inviteToken && (
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  Invite detected{inviteEmail ? ` for ${inviteEmail}` : ""}. Sign in or create account with this email to join your organisation.
                </p>
              )}
              <label htmlFor="login-password" style={{ ...ss.lbl, marginTop: 10 }}>
                Password
              </label>
              <div
                style={{
                  ...ss.inp,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <LockKeyhole size={15} color="#64748b" aria-hidden />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsLockOn(Boolean(e.getModifierState?.("CapsLock")))}
                  onKeyDown={(e) => setCapsLockOn(Boolean(e.getModifierState?.("CapsLock")))}
                  placeholder="Your password"
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 14,
                    background: "transparent",
                    color: "var(--color-text-primary)",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  aria-label="Toggle password visibility"
                />
                Show password
              </label>
              {capsLockOn && <div style={{ marginTop: 6, fontSize: 12, color: "#b45309" }}>Caps Lock is on.</div>}
              {password.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--color-border-tertiary,#e2e8f0)",
                    background: "var(--color-background-secondary,#f8fafc)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Password strength</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: passwordStrength.color }}>{passwordStrength.label}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ width: `${passwordStrength.percent}%`, height: "100%", background: passwordStrength.color, transition: "width .2s ease" }} />
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {passwordStrength.checks.map((c) => (
                      <div key={c.id} style={{ fontSize: 11, color: c.ok ? "#166534" : "var(--color-text-secondary)" }}>
                        {c.ok ? "✓" : "○"} {c.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginTop: 14,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptLegalTerms}
                  onChange={(e) => setAcceptLegalTerms(e.target.checked)}
                  style={{ marginTop: 2 }}
                  aria-label="I agree to the Terms of service and Privacy policy"
                  aria-describedby="login-legal-hint"
                />
                <span id="login-legal-hint">
                  I have read and agree to the{" "}
                  <Link to="/terms" style={{ color: teal, fontWeight: 600 }}>
                    Terms of service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" style={{ color: teal, fontWeight: 600 }}>
                    Privacy policy
                  </Link>
                  .
                </span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 14 }}>
                <button type="button" style={{ ...ss.btnP, width: "100%" }} disabled={busy || lockout.isLocked} onClick={signIn}>
                  Sign in
                </button>
                <button type="button" style={{ ...ss.btn, width: "100%" }} disabled={busy || !acceptLegalTerms} onClick={signUp}>
                  Create account
                </button>
              </div>
              {pendingConfirmationEmail && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e3a8a", marginBottom: 6 }}>Check your email</div>
                  <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.5 }}>
                    We sent a confirmation link to <strong>{pendingConfirmationEmail}</strong>. Open the link, then return here to sign in.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    <a
                      href={getInboxUrl(pendingConfirmationEmail)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ ...ss.btn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                    >
                      Open inbox
                    </a>
                    <button type="button" style={ss.btn} onClick={resendConfirmationEmail} disabled={busy || resendCooldown > 0}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
                    </button>
                    <button
                      type="button"
                      style={ss.btn}
                      onClick={() => {
                        setPendingConfirmationEmail("");
                        setResendCooldown(0);
                        setMsg("");
                        emailInputRef.current?.focus();
                      }}
                      disabled={busy}
                    >
                      Change email
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="button" style={ss.btn} disabled={busy} onClick={sendPasswordReset}>
                  Forgot password
                </button>
                <button type="button" style={ss.btn} disabled={busy} onClick={resendConfirmationEmail}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 2 }}>
                <div style={{ height: 1, flex: 1, background: "var(--color-border-tertiary)" }} />
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>or</span>
                <div style={{ height: 1, flex: 1, background: "var(--color-border-tertiary)" }} />
              </div>
              {lockout.isLocked && (
                <InlineAlert type="error" text={`Temporary lockout active: ${formatLockoutRemaining(lockout.remainingMs)} remaining.`} style={{ fontSize: 12 }} />
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
                {SHOW_ADMIN_LOGIN_HINTS && (
                  <details style={{ marginTop: 10, fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600, color: navy }}>
                      Advanced: IT setup (Supabase)
                    </summary>
                    <div style={{ marginTop: 8, paddingLeft: 2 }}>
                      <p style={{ margin: "0 0 8px" }}>
                        Enable Google under Supabase → Authentication → Providers, and add this site&apos;s origin plus{" "}
                        <code style={{ fontSize: 10 }}>/login</code> to Redirect URLs.
                      </p>
                      <p style={{ margin: 0 }}>
                        Password reset emails should use redirect URL <code style={{ fontSize: 10 }}>/reset-password</code>.
                      </p>
                    </div>
                  </details>
                )}
              </div>
              <InlineAlert
                type={
                  msg.toLowerCase().includes("failed") ||
                  msg.toLowerCase().includes("issue") ||
                  msg.toLowerCase().includes("could not") ||
                  msg.toLowerCase().includes("lockout")
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
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--color-border-tertiary,#e2e8f0)" }}>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  You need an account to open your organisation workspace and trial.
                </p>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 16px", lineHeight: 1.55 }}>
                Cloud sign-in isn&apos;t set up on this device yet. You can still open the workspace — your data stays in this browser until your team enables cloud
                backup.
              </p>
              {SHOW_ADMIN_LOGIN_HINTS && (
                <details style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 16px", lineHeight: 1.5 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, color: navy }}>Advanced: enable cloud sign-in (.env)</summary>
                  <p style={{ margin: "8px 0 0" }}>
                    Add <code style={{ fontSize: 11 }}>VITE_SUPABASE_URL</code> and <code style={{ fontSize: 11 }}>VITE_SUPABASE_ANON_KEY</code> in{" "}
                    <code style={{ fontSize: 11 }}>.env.local</code> (see project README), then reload.
                  </p>
                </details>
              )}
              <button type="button" style={ss.btnP} onClick={() => navigate("/app", { replace: true })}>
                Open workspace
              </button>
            </>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 14,
            marginBottom: 0,
            fontSize: 11,
            color: "var(--color-text-secondary)",
            lineHeight: 1.45,
            maxWidth: 420,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          MySafeOps uses essential cookies only to keep you signed in. No third-party ads.{" "}
          <Link to="/cookies" style={{ color: teal, fontWeight: 600 }}>
            Cookie policy
          </Link>
        </p>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
          <Link to="/" style={{ color: teal, fontWeight: 500 }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
