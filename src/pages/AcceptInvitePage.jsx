import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { setPendingInviteToken } from "../lib/inviteToken";
import { ms } from "../utils/moduleStyles";
import InlineAlert from "../components/InlineAlert";
import { getSupportEmail } from "../config/supportContact";

const ss = ms;
const teal = "#0d9488";
const navy = "#0f172a";
const SUPPORT_EMAIL = getSupportEmail();

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get("invite") || "";
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const prev = document.title;
    document.title = "Accept invite — MySafeOps";
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    if (!invite) {
      setErr("Missing invite token.");
      return;
    }
    setPendingInviteToken(invite, email);
    if (!isSupabaseConfigured() || !supabase) {
      setErr("This deployment is not linked to Supabase.");
      return;
    }
    let cancelled = false;
    supabase
      .rpc("get_invite_preview", { p_token: invite })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setErr(error.message || "Invite not found or expired.");
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.org_name) {
          setErr("Invite not found or expired.");
          return;
        }
        setPreview(row);
      })
      .catch(() => {
        if (!cancelled) setErr("Could not load invite.");
      });
    return () => {
      cancelled = true;
    };
  }, [invite, email]);

  const loginHref = `/login?invite=${encodeURIComponent(invite)}${email ? `&email=${encodeURIComponent(email)}` : ""}`;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #E1F5EE 0%, #f8fafc 38%)", fontFamily: "DM Sans, system-ui, sans-serif", padding: "1.5rem 1rem 2rem" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: navy }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: teal, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <ShieldCheck size={26} strokeWidth={2} aria-hidden />
            </span>
            <span style={{ fontWeight: 700, fontSize: 20 }}>MySafeOps</span>
          </div>
        </div>

        <div style={{ ...ss.card, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: navy }}>You&apos;re invited</h1>
          {err ? (
            <InlineAlert type="error" text={err} style={{ marginTop: 0 }} />
          ) : preview ? (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                <strong>{preview.org_name}</strong> invited you to join their MySafeOps workspace
                {email ? (
                  <>
                    {" "}
                    as <strong>{preview.invite_email || email}</strong>
                  </>
                ) : null}
                .
              </p>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                Sign in or create an account with the same email to accept. Invite expires: {new Date(preview.expires_at).toLocaleString()}.
              </p>
            </>
          ) : (
            <div
              className="app-view-fallback"
              style={{ minHeight: 100, padding: "12px 0" }}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="app-route-spinner" aria-hidden />
              <span className="app-view-fallback-text">Loading invite…</span>
            </div>
          )}

          {invite && !err && (
            <Link
              to={loginHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 20px",
                borderRadius: 8,
                background: teal,
                color: "#f0fdfa",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                minHeight: 48,
                border: "1px solid #085041",
              }}
            >
              Continue to sign in
            </Link>
          )}

          <p style={{ marginTop: 16, fontSize: 13 }}>
            <Link to="/" style={{ color: teal, fontWeight: 500 }}>
              ← Back to home
            </Link>
          </p>
          <p style={{ marginTop: 14, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Need help?{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: teal, fontWeight: 500 }}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
