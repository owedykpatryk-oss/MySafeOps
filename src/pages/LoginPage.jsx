import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { pushAudit } from "../utils/auditLog";
import { setLocalWorkspaceOnly } from "../lib/authPrefs";
import { signInWithGoogleOAuth } from "../lib/authRedirect";
import { ms } from "../utils/moduleStyles";

const ss = ms;
const teal = "#0d9488";
const navy = "#0f172a";

export default function LoginPage() {
  const navigate = useNavigate();
  const { supabase: client, user, loading, ready } = useSupabaseAuth();
  const cloud = isSupabaseConfigured() && client;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cloud && user) {
      setLocalWorkspaceOnly(false);
    }
  }, [cloud, user]);

  if (cloud && ready && user) {
    return <Navigate to="/app" replace />;
  }

  const signIn = async () => {
    if (!client) return;
    setMsg("");
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      pushAudit({ action: "supabase_sign_in", entity: "auth", detail: email.trim() });
      setLocalWorkspaceOnly(false);
      setPassword("");
      navigate("/app", { replace: true });
    } catch (e) {
      setMsg(e.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!client) return;
    setMsg("");
    setBusy(true);
    try {
      const { error } = await signInWithGoogleOAuth(client, "/login");
      if (error) throw error;
      setLocalWorkspaceOnly(false);
    } catch (e) {
      setMsg(e.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  const signUp = async () => {
    if (!client) return;
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

  const continueLocal = () => {
    setLocalWorkspaceOnly(true);
    navigate("/app", { replace: true });
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
              <label style={{ ...ss.lbl, marginTop: 10 }}>Password</label>
              <input type="password" autoComplete="current-password" style={ss.inp} value={password} onChange={(e) => setPassword(e.target.value)} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <button type="button" style={ss.btnP} disabled={busy || !email.trim() || !password} onClick={signIn}>
                  Sign in
                </button>
                <button type="button" style={ss.btn} disabled={busy || !email.trim() || password.length < 6} onClick={signUp}>
                  Create account
                </button>
              </div>
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
              </div>
              {msg && <p style={{ marginTop: 14, fontSize: 13 }}>{msg}</p>}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--color-border-tertiary,#e2e8f0)" }}>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Prefer not to use cloud sign-in? You can still use the full app with local data only (no Supabase backup until you sign in later in Settings).
                </p>
                <button type="button" style={ss.btn} onClick={continueLocal}>
                  Continue without cloud sign-in
                </button>
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
