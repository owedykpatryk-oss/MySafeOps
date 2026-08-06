import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { buildInviteLoginPath, setPendingInviteToken } from "../lib/inviteToken";
import { ms } from "../utils/moduleStyles";
import InlineAlert from "../components/InlineAlert";
import { getSupportEmail } from "../config/supportContact";

const ss = ms;
const teal = "#0d9488";
const navy = "#0f172a";
const SUPPORT_EMAIL = getSupportEmail();

function safeBrandLogo(value) {
  const url = String(value || "").trim();
  if (url.startsWith("/")) return url;
  if (url.startsWith("https://")) return url;
  return "";
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const invite = searchParams.get("invite") || "";
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");
  const [understoodSwitch, setUnderstoodSwitch] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = preview?.org_name
      ? `Join ${preview.org_name} — MySafeOps`
      : "Accept invite — MySafeOps";
    return () => {
      document.title = prev;
    };
  }, [preview?.org_name]);

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
          setErr(
            "Invite could not be verified. It may be expired or replaced; ask your organisation admin to resend it."
          );
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.org_name) {
          setErr(
            "Invite not found, expired, or replaced. Ask your organisation admin to resend it."
          );
          return;
        }
        setPreview(row);
        if (row.email || row.invite_email) {
          setPendingInviteToken(invite, row.email || row.invite_email);
        }
      })
      .catch(() => {
        if (!cancelled) setErr("Could not load invite.");
      });
    return () => {
      cancelled = true;
    };
  }, [invite, email]);

  const loginEmail = (preview?.email || preview?.invite_email || email || "").trim().toLowerCase();
  const loginHref = buildInviteLoginPath({ token: invite, email: loginEmail });
  // Reusable join links reject users already in another org server-side; only
  // legacy one-time email invites still switch membership.
  const isReusableJoin = Boolean(preview?.reusable);
  const canContinue = Boolean(preview && invite && !err && (isReusableJoin || understoodSwitch));
  const primary = preview?.primary_color || teal;
  const accent = preview?.accent_color || "#E1F5EE";
  const companyLogo = safeBrandLogo(preview?.logo_url);

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${accent}22 0%, #f8fafc 38%)`, fontFamily: "DM Sans, system-ui, sans-serif", padding: "1.5rem 1rem 2rem" }}>
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
              {companyLogo ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "12px 16px 18px",
                    marginBottom: 16,
                    borderBottom: `1px solid ${accent}55`,
                  }}
                >
                  <img
                    src={companyLogo}
                    alt={`${preview.org_name} logo`}
                    style={{ display: "block", maxWidth: "100%", width: 300, maxHeight: 110, objectFit: "contain" }}
                  />
                </div>
              ) : null}
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                <strong>{preview.org_name}</strong> invited you to join their MySafeOps workspace
                {loginEmail ? (
                  <>
                    {" "}
                    as <strong>{loginEmail}</strong>
                  </>
                ) : null}
                .
              </p>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {preview.allowed_email_domain
                  ? `Sign in or create an account with a verified @${preview.allowed_email_domain} email to accept.`
                  : "Sign in or create an account with the same email to accept."}{" "}
                Link expires:{" "}
                {new Date(preview.expires_at).toLocaleString()}.
              </p>
              {isReusableJoin ? (
                <InlineAlert
                  type="info"
                  text={`This company join link only works for accounts that are not already in another organisation. One login can only belong to one organisation.`}
                  style={{ marginBottom: 14 }}
                />
              ) : (
                <>
                  <InlineAlert
                    type="warn"
                    text={`Joining ${preview.org_name} switches this login to that organisation. If you already have your own MySafeOps workspace, you will lose access to it from this account (data stays on that org; you need a new invite to return). One login can only belong to one organisation.`}
                    style={{ marginBottom: 14 }}
                  />
                  <label
                    htmlFor="invite-org-switch-ack"
                    style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45, marginBottom: 16, cursor: "pointer" }}
                  >
                    <input
                      id="invite-org-switch-ack"
                      type="checkbox"
                      checked={understoodSwitch}
                      onChange={(e) => setUnderstoodSwitch(e.target.checked)}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span>
                      I understand that accepting this invite will disconnect this account from any existing organisation I
                      own or belong to.
                    </span>
                  </label>
                </>
              )}
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
            canContinue ? (
              <Link
                to={loginHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  borderRadius: 8,
                  background: primary,
                  color: "#f0fdfa",
                  textDecoration: "none",
                  fontSize: 15,
                  fontWeight: 600,
                  minHeight: 48,
                  border: `1px solid ${primary}`,
                }}
              >
                Continue to sign in
              </Link>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  borderRadius: 8,
                  background: "#94a3b8",
                  color: "#f8fafc",
                  fontSize: 15,
                  fontWeight: 600,
                  minHeight: 48,
                  border: "1px solid #64748b",
                  opacity: 0.85,
                  cursor: "not-allowed",
                }}
              >
                Continue to sign in
              </button>
            )
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
