import { Link } from "react-router-dom";
import LandingFooter from "../components/landing/LandingFooter";
import { getSupportEmail } from "../config/supportContact";
import "../styles/landing.css";

const SUPPORT_EMAIL = getSupportEmail();

export default function StatusPage() {
  const ext = (import.meta.env.VITE_PUBLIC_STATUS_URL || "").trim();
  return (
    <div className="landing-page blog-index-page">
      <header className="blog-index-header" role="banner">
        <div className="ctn blog-index-header-inner">
          <Link to="/" className="logo">
            <div className="lt">
              <span>My</span>
              <span>Safe</span>
              <span>Ops</span>
            </div>
          </Link>
          <nav className="blog-index-nav" aria-label="Status">
            <Link to="/">Home</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="ctn" style={{ padding: "32px 0 48px", maxWidth: 640 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Service status</h1>
        <p style={{ color: "var(--color-text-secondary, #64748b)", marginBottom: 20 }}>
          {ext ? (
            <>
              A detailed status page may be available at:{" "}
              <a href={ext} rel="noopener noreferrer">
                {ext}
              </a>
            </>
          ) : (
            "No external status URL is configured (set VITE_PUBLIC_STATUS_URL in the host environment if you use a third-party status page)."
          )}
        </p>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#14532d",
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          All systems operational (informational)
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-secondary, #64748b)" }}>
          This page is a lightweight signal for customers. It does not replace monitoring or your own incident process. For issues, contact{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link to="/docs" style={{ color: "#0d9488", fontWeight: 600 }}>
            ← Documentation & help
          </Link>
        </p>
      </main>
      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </div>
  );
}
