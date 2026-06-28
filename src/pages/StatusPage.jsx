import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LandingFooter from "../components/landing/LandingFooter";
import { getSupportEmail } from "../config/supportContact";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import "../styles/landing.css";

const SUPPORT_EMAIL = getSupportEmail();

function formatCheckedAt(date) {
  if (!date) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StatusPage() {
  const ext = (import.meta.env.VITE_PUBLIC_STATUS_URL || "").trim();
  const showAdminHints = showAdminLoginHints();
  const [health, setHealth] = useState({ state: "checking", checkedAt: null });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("unhealthy");
        const json = await res.json();
        if (!json?.ok) throw new Error("unhealthy");
        if (!cancelled) setHealth({ state: "ok", checkedAt: new Date() });
      })
      .catch(() => {
        if (!cancelled) setHealth({ state: "unknown", checkedAt: new Date() });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusStyles =
    health.state === "ok"
      ? { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d" }
      : health.state === "checking"
        ? { border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155" }
        : { border: "1px solid #fde68a", background: "#fffbeb", color: "#78350f" };

  const statusLabel =
    health.state === "ok"
      ? "Application API responding"
      : health.state === "checking"
        ? "Checking service…"
        : "Status check unavailable (informational only)";

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
              Detailed status:{" "}
              <a href={ext} rel="noopener noreferrer">
                {ext}
              </a>
            </>
          ) : (
            "Quick operational signal for customers. For urgent issues, contact support below."
          )}
        </p>
        {showAdminHints && !ext ? (
          <p style={{ fontSize: 12, color: "var(--color-text-tertiary, #94a3b8)", marginBottom: 20 }}>
            Admin: set <code>VITE_PUBLIC_STATUS_URL</code> to link a third-party status page.
          </p>
        ) : null}
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 8,
            ...statusStyles,
          }}
        >
          {statusLabel}
        </div>
        {health.checkedAt ? (
          <p style={{ fontSize: 12, color: "var(--color-text-tertiary, #94a3b8)", marginBottom: 16 }}>
            Last checked {formatCheckedAt(health.checkedAt)}
          </p>
        ) : null}
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-secondary, #64748b)" }}>
          This page does not replace your own incident process or full monitoring. For issues, contact{" "}
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
