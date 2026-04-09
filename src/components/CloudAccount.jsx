import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushAudit } from "../utils/auditLog";
import { signInWithGoogleOAuth } from "../lib/authRedirect";
import { isR2StorageConfigured } from "../lib/r2Storage";
import { ms } from "../utils/moduleStyles";
import PageHero from "./PageHero";
import InlineAlert from "./InlineAlert";
import { useApp } from "../context/AppContext";

const ss = ms;
const MIN_PASSWORD_LENGTH = 6;

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
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const r2Enabled = isR2StorageConfigured();

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
      setPassword("");
    } catch (e) {
      setMsg(e.message || "Sign-in failed");
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
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMsg(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setMsg("");
    setBusy(true);
    try {
      const { error } = await client.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      pushAudit({ action: "supabase_sign_up", entity: "auth", detail: email.trim() });
      setMsg("Check your email — confirmation may be required on your Supabase project.");
      setPassword("");
    } catch (e) {
      setMsg(e.message || "Sign-up failed");
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

  if (user) {
    return (
      <>
        <PageHero
          badgeText="☁"
          title="Cloud account"
          lead={
            r2Enabled
              ? "Signed in to Supabase — use Backup for JSON cloud backup/restore. Cloudflare R2 uploads are available in Documents."
              : "Signed in to Supabase — use Backup for JSON cloud backup/restore."
          }
        />
        <div style={{ ...ss.card, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Supabase account (auth & backup)</div>
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
      </>
    );
  }

  return (
    <>
      <PageHero
        badgeText="☁"
        title="Cloud account"
        lead={
          r2Enabled
            ? "Sign in to use Supabase cloud backup from the Backup screen. Cloudflare R2 uploads are available in Documents."
            : "Sign in to use cloud backup from the Backup screen. Enable Email and Google in Supabase Authentication."
        }
      />
    <div style={{ ...ss.card, marginBottom: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Supabase account (auth & backup)</div>
      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Sign in to use cloud backup (Backup screen → upload). Enable Email and Google under Authentication → Providers; add redirect URL for <code style={{ fontSize: 11 }}>/login</code>.
      </p>
      {r2Enabled && (
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Cloudflare R2 storage is configured for document uploads in Documents.
        </p>
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button type="button" style={ss.btnP} disabled={busy} onClick={signIn}>
          Sign in
        </button>
        <button type="button" style={ss.btn} disabled={busy} onClick={signUp}>
          Create account
        </button>
      </div>
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
