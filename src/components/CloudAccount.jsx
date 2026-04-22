import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushAudit } from "../utils/auditLog";
import { signInWithGoogleOAuth } from "../lib/authRedirect";
import { isR2StorageConfigured } from "../lib/r2Storage";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import InlineAlert from "./InlineAlert";
import { useApp } from "../context/AppContext";
import { ensureUserOrgContext } from "../utils/orgMembership";
import { getRequiresMfaStep } from "../lib/mfaAal";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import MfaLoginChallenge from "./MfaLoginChallenge";
import { getSupportEmail } from "../config/supportContact";
import { getPasswordStrengthMeta } from "../utils/passwordStrength";
import { getInboxUrl } from "../utils/emailInbox";
import { MIN_PASSWORD_LENGTH_SIGNUP } from "../config/authPolicy";

const ss = ms;
const MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH_SIGNUP;
const RESEND_COOLDOWN_SECONDS = 45;
const LAST_AUTH_EMAIL_KEY = "mysafeops_last_auth_email";
const teal = "#0d9488";
const SUPPORT_EMAIL = getSupportEmail();
const SHOW_ADMIN_LOGIN_HINTS = showAdminLoginHints();

function mapAuthErrorMessage(error, fallback = "Authentication request failed") {
  const raw = String(error?.message || "").trim();
  const m = raw.toLowerCase();
  if (!raw) return fallback;
  if (m.includes("user already registered") || m.includes("already registered") || m.includes("already exists")) {
    return "An account with this email already exists. Try Sign in.";
  }
  if (m.includes("invalid login credentials")) return "Invalid email or password.";
  if (m.includes("invalid email")) return "Email address format is invalid.";
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) {
    return "Email not confirmed yet. Open the confirmation link from your inbox.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts right now. Please wait a moment and try again.";
  }
  return raw || fallback;
}

/**
 * TOTP MFA enrollment and status (requires MFA enabled in Supabase project settings).
 * @param {{ client: import("@supabase/supabase-js").SupabaseClient }} props
 */
function CloudTotpMfaPanel({ client }) {
  const [factors, setFactors] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [code, setCode] = useState("");

  const loadFactors = useCallback(async () => {
    const mfaApi = client?.auth?.mfa;
    if (!mfaApi?.listFactors) return;
    const { data, error } = await mfaApi.listFactors();
    if (error) {
      setFactors([]);
      return;
    }
    setFactors(Array.isArray(data?.all) ? data.all : []);
  }, [client]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const mfa = client?.auth?.mfa;
  if (!mfa?.enroll || !mfa?.listFactors) {
    return (
      <p style={{ fontSize: 12, margin: 0, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        Multi-factor authentication is not available in this client build.
      </p>
    );
  }

  const verifiedTotp = factors.filter((f) => f?.factor_type === "totp" && f?.status === "verified");

  const startEnroll = async () => {
    setMsg("");
    setBusy(true);
    try {
      const { data, error } = await mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
        issuer: "MySafeOps",
      });
      if (error) throw error;
      const id = data?.id;
      const qr = data?.totp?.qr_code;
      const secret = data?.totp?.secret;
      if (!id || !qr) {
        setMsg("Could not start authenticator setup. Check that MFA / TOTP is enabled for this project in Supabase.");
        return;
      }
      setPending({ id, qr, secret: secret || "" });
      setCode("");
    } catch (e) {
      setMsg(String(e?.message || "Authenticator setup failed."));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async () => {
    if (!pending?.id) return;
    const trimmed = code.replace(/\s/g, "");
    if (trimmed.length < 6) {
      setMsg("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setMsg("");
    setBusy(true);
    try {
      const ch = await mfa.challenge({ factorId: pending.id });
      if (ch.error) throw ch.error;
      const challengeId = ch.data?.id;
      if (!challengeId) throw new Error("Missing MFA challenge.");
      const v = await mfa.verify({ factorId: pending.id, challengeId, code: trimmed });
      if (v.error) throw v.error;
      setPending(null);
      setCode("");
      await loadFactors();
      setMsg("Authenticator app is now enabled for this account.");
    } catch (e) {
      setMsg(String(e?.message || "Could not verify code."));
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (factorId) => {
    setMsg("");
    setBusy(true);
    try {
      const { error } = await mfa.unenroll({ factorId });
      if (error) throw error;
      await loadFactors();
      setMsg("Authenticator factor removed.");
    } catch (e) {
      setMsg(String(e?.message || "Could not remove factor."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 12, margin: "0 0 10px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        Add a time-based one-time password (TOTP) as a second step after your password. Enable MFA under Supabase → Authentication → Multi-factor authentication.
      </p>
      {verifiedTotp.length > 0 ? (
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13 }}>
          {verifiedTotp.map((f) => (
            <li key={f.id} style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>{f.friendly_name || "Authenticator"}</span>{" "}
              <button type="button" style={{ ...ss.btn, marginLeft: 8, fontSize: 11, padding: "4px 10px" }} disabled={busy} onClick={() => removeFactor(f.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12, margin: "0 0 10px", color: "var(--color-text-secondary)" }}>No verified authenticator yet.</p>
      )}
      {!pending && verifiedTotp.length === 0 && (
        <button type="button" style={ss.btnP} disabled={busy} onClick={startEnroll}>
          Set up authenticator app
        </button>
      )}
      {pending && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 12, margin: "0 0 8px", fontWeight: 600 }}>Scan this QR in your app, then enter the code</p>
          <img src={pending.qr} alt="Authenticator QR code" style={{ width: 180, height: 180, display: "block", marginBottom: 8 }} />
          {pending.secret ? (
            <p style={{ fontSize: 11, wordBreak: "break-all", color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
              Or enter secret manually: <code>{pending.secret}</code>
            </p>
          ) : null}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ ...ss.inp, maxWidth: 200, marginBottom: 8 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" style={ss.btnP} disabled={busy} onClick={confirmEnroll}>
              Verify and enable
            </button>
            <button type="button" style={ss.btn} disabled={busy} onClick={() => { setPending(null); setCode(""); setMsg(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg ? (
        <p style={{ fontSize: 12, marginTop: 10, color: msg.toLowerCase().includes("fail") ? "#b91c1c" : "var(--color-text-secondary)" }}>{msg}</p>
      ) : null}
    </div>
  );
}

/**
 * Supabase email/password — enable Email provider in Dashboard → Authentication → Providers.
 */
export default function CloudAccount() {
  const navigate = useNavigate();
  const { supabase: client, user, loading, ready } = useSupabaseAuth();
  const { trialStatus, orgId } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [acceptLegalTerms, setAcceptLegalTerms] = useState(false);
  const [mfaForSession, setMfaForSession] = useState(false);
  const r2Enabled = isR2StorageConfigured();
  const passwordStrength = useMemo(() => getPasswordStrengthMeta(password, MIN_PASSWORD_LENGTH), [password]);

  useEffect(() => {
    if (!user || !client) {
      setMfaForSession(false);
      return;
    }
    let cancelled = false;
    getRequiresMfaStep(client).then(({ needsMfa }) => {
      if (!cancelled) setMfaForSession(Boolean(needsMfa));
    });
    return () => {
      cancelled = true;
    };
  }, [user, client]);

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
    if (resendCooldown <= 0) return undefined;
    const id = window.setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_AUTH_EMAIL_KEY);
      if (saved && !email) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, [email]);

  if (!isSupabaseConfigured() || !client) {
    return (
      <>
        <PageHero
          badgeText="☁"
          title="Cloud account"
          lead={
            r2Enabled
              ? "Supabase auth/backup is not configured here. Cloudflare R2 uploads are available in Documents."
              : "Cloud services are not configured for this environment."
          }
        />
        <div style={{ ...ss.card, marginBottom: 24, fontSize: 13, color: "var(--color-text-secondary)" }}>
          {r2Enabled ? (
            <>
              Cloudflare R2 storage is active for document uploads. To enable account sign-in and JSON cloud backup,
              configure Supabase credentials for this environment.
            </>
          ) : (
            <>
              Configure Supabase to enable sign-in and cloud backup. You can still use local data and local backup/export.
            </>
          )}
        </div>
      </>
    );
  }

  if (!ready || loading) {
    return (
      <>
        <PageHero
          badgeText="☁"
          title="Cloud account"
          lead={r2Enabled ? "Connecting to Supabase… (Cloudflare R2 uploads available in Documents)" : "Connecting to Supabase…"}
        />
        <div style={{ ...ss.card, marginBottom: 24, fontSize: 13, color: "var(--color-text-secondary)" }}>
          Connecting to cloud account…
        </div>
      </>
    );
  }

  const signIn = async () => {
    if (!email.trim()) {
      setMsg("Enter your email address first.");
      return;
    }
    if (!password) {
      setMsg("Enter your password first.");
      return;
    }
    setMsg("");
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      pushAudit({ action: "supabase_sign_in", entity: "auth", detail: email.trim() });
      rememberAuthEmail(email.trim());
      setPassword("");
    } catch (e) {
      const maybeEmail = email.trim().toLowerCase();
      const unconfirmed = String(e?.message || "").toLowerCase().includes("email not confirmed");
      if (unconfirmed && maybeEmail) setPendingConfirmationEmail(maybeEmail);
      setMsg(mapAuthErrorMessage(e, "Sign-in failed"));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setMsg("");
    setBusy(true);
    try {
      // OAuth must return to `/login` (add it to Supabase Redirect URLs). `/app` breaks PKCE if not allow-listed and can send users to the site URL (landing).
      const before = window.location.href;
      const { data, error } = await signInWithGoogleOAuth(client, "/login");
      if (error) throw error;
      if (data?.url && window.location.href === before) {
        window.location.assign(data.url);
      }
      window.setTimeout(() => {
        if (window.location.href === before) {
          setBusy(false);
          setMsg("Google sign-in did not open. Please allow pop-ups/redirects and try again.");
        }
      }, 2500);
    } catch (e) {
      setMsg(e.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  const signUp = async () => {
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
    try {
      const emailRedirectTo = new URL("/login", window.location.origin).href;
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      pushAudit({ action: "supabase_sign_up", entity: "auth", detail: email.trim() });
      if (data?.session) {
        setMsg("Account created and signed in.");
        rememberAuthEmail(email.trim());
        setPassword("");
        return;
      }
      setPendingConfirmationEmail(email.trim().toLowerCase());
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      rememberAuthEmail(email.trim());
      setMsg("Account created. Confirmation email sent — check inbox and spam, open the link, then sign in.");
      setPassword("");
    } catch (e) {
      setMsg(mapAuthErrorMessage(e, "Sign-up failed"));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmationEmail = async () => {
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
    try {
      const emailRedirectTo = new URL("/login", window.location.origin).href;
      const { error } = await client.auth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setPendingConfirmationEmail(targetEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      rememberAuthEmail(targetEmail);
      setMsg("Confirmation email re-sent. Check inbox and spam.");
    } catch (e) {
      setMsg(mapAuthErrorMessage(e, "Could not resend confirmation email"));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await client.auth.signOut();
      pushAudit({ action: "supabase_sign_out", entity: "auth", detail: "" });
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  if (user && mfaForSession) {
    return (
      <>
        <PageHero
          badgeText="☁"
          title="Cloud account"
          lead="Your account needs a second step (authenticator) before cloud backup is fully active."
        />
        <div style={{ ...ss.card, marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Two-step sign-in</div>
          {client ? (
            <MfaLoginChallenge
              client={client}
              supportEmail={SUPPORT_EMAIL}
              onSuccess={async () => {
                setMfaForSession(false);
                await ensureUserOrgContext(client);
              }}
            />
          ) : null}
        </div>
      </>
    );
  }

  if (user) {
    return (
      <>
        <PageHero
          badgeText="☁"
          title="Your cloud account"
          lead={
            r2Enabled
              ? "Signed in — use Backup for JSON cloud backup and restore. Document uploads use cloud storage when enabled."
              : "Signed in — use Backup for JSON cloud backup and restore."
          }
        />
        <div style={{ ...ss.card, marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Account & cloud backup</div>
          <p style={{ fontSize: 13, margin: "0 0 12px", color: "var(--color-text-secondary)" }}>
            Signed in as <strong>{user.email}</strong>
          </p>
          {trialStatus && (
            <p style={{ fontSize: 12, margin: "0 0 12px", color: "var(--color-text-secondary)" }}>
              Organisation: <strong>{orgId}</strong> · Trial{" "}
              {trialStatus.isActive ? `active (${trialStatus.remainingDays} day${trialStatus.remainingDays === 1 ? "" : "s"} left)` : "ended"}
            </p>
          )}
          <button type="button" style={ss.btn} onClick={signOut} disabled={busy}>
            Sign out
          </button>
        </div>
        <div style={{ ...ss.card, marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Two-step sign-in (TOTP)</div>
          <CloudTotpMfaPanel client={client} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        badgeText="☁"
        title="Your cloud account"
        lead={
          r2Enabled
            ? "Sign in to turn on cloud backup from the Backup screen. Document uploads can use cloud storage when your organisation has it enabled."
            : "Sign in to turn on cloud backup from the Backup screen. Your administrator sets up email or Google sign-in for your team."
        }
      />
    <div style={{ ...ss.card, marginBottom: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Account & cloud backup</div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
        After you sign in, open Backup to upload or restore a JSON backup to the cloud. Your site data still lives in this workspace unless you back it up.
      </p>
      {r2Enabled && (
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Cloud document storage is enabled for uploads in Documents.
        </p>
      )}
      {SHOW_ADMIN_LOGIN_HINTS && (
        <details style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.45 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Advanced: IT setup (Supabase)</summary>
          <p style={{ margin: "8px 0 0" }}>
            In Supabase → Authentication → Providers, enable Email and Google as needed. Add this site&apos;s origin plus <code style={{ fontSize: 10 }}>/login</code>{" "}
            to Redirect URLs.
          </p>
        </details>
      )}
      <label style={ss.lbl}>Email</label>
      <input type="email" autoComplete="email" style={ss.inp} value={email} onChange={(e) => setEmail(e.target.value)} />
      <label style={{ ...ss.lbl, marginTop: 10 }}>Password</label>
      <input
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        style={ss.inp}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyUp={(e) => setCapsLockOn(Boolean(e.getModifierState?.("CapsLock")))}
        onKeyDown={(e) => setCapsLockOn(Boolean(e.getModifierState?.("CapsLock")))}
      />
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
          aria-label="Show password"
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
        />
        <span>
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button type="button" style={ss.btnP} disabled={busy} onClick={signIn}>
          Sign in
        </button>
        <button type="button" style={ss.btn} disabled={busy || !acceptLegalTerms} onClick={signUp}>
          Create account
        </button>
      </div>
      {pendingConfirmationEmail && (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid #bfdbfe", background: "#eff6ff" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e3a8a", marginBottom: 6 }}>Check your email</div>
          <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.5 }}>
            We sent a confirmation link to <strong>{pendingConfirmationEmail}</strong>. Open the link, then sign in.
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
          </div>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          disabled={busy}
          onClick={signInWithGoogle}
          style={{
            ...ss.btn,
            width: "100%",
            maxWidth: 360,
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
      </div>
      <InlineAlert type={msg.toLowerCase().includes("failed") ? "error" : "info"} text={msg} />
    </div>
    </>
  );
}
