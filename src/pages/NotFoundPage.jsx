import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { ms } from "../utils/moduleStyles";
import { getSupportEmail } from "../config/supportContact";

const ss = ms;
const teal = "#0d9488";
const navy = "#0f172a";
const SUPPORT_EMAIL = getSupportEmail();

export default function NotFoundPage() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Page not found — MySafeOps";
    return () => {
      document.title = prev;
    };
  }, []);

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
            <span style={{ fontWeight: 700, fontSize: 20 }}>MySafeOps</span>
          </Link>
        </div>

        <div
          className="app-surface-card"
          style={{
            ...ss.card,
            border: "1px solid rgba(203,213,225,0.8)",
            boxShadow: "0 12px 34px rgba(15,23,42,0.09)",
            backdropFilter: "blur(3px)",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: navy }}>Page not found</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55, margin: "0 0 16px" }}>
            This URL does not match a page on this site. Check the address or return to the home page.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
            <Link to="/" style={{ ...ss.btnP, textAlign: "center", textDecoration: "none", display: "block" }}>
              Home
            </Link>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", fontSize: 13 }}>
              <Link to="/blog" style={{ color: teal, fontWeight: 500 }}>
                Blog
              </Link>
              <span style={{ color: "var(--color-text-tertiary)", userSelect: "none" }} aria-hidden>
                ·
              </span>
              <Link to="/docs" style={{ color: teal, fontWeight: 500 }}>
                Docs
              </Link>
              <span style={{ color: "var(--color-text-tertiary)", userSelect: "none" }} aria-hidden>
                ·
              </span>
              <Link to="/login" style={{ color: teal, fontWeight: 500 }}>
                Sign in
              </Link>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, margin: "14px 0 0" }}>
              Need help?{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: teal, fontWeight: 600 }}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
