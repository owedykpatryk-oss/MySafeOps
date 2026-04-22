import { Link } from "react-router-dom";
import LandingFooter from "../components/landing/LandingFooter";
import { getSupportEmail } from "../config/supportContact";
import { getPublicStatusPath } from "../config/publicLinks";
import "../styles/landing.css";

const SUPPORT_EMAIL = getSupportEmail();

export default function DocsHubPage() {
  const statusUrl = getPublicStatusPath();
  const statusIsExternal = /^https?:\/\//i.test(statusUrl);

  return (
    <div className="landing-page blog-index-page">
      <a href="#docs-main" className="landing-skip-link">
        Skip to main content
      </a>
      <header className="blog-index-header" role="banner">
        <div className="ctn blog-index-header-inner">
          <Link to="/" className="logo">
            <div className="lt">
              <span>My</span>
              <span>Safe</span>
              <span>Ops</span>
            </div>
          </Link>
          <nav className="blog-index-nav" aria-label="Documentation">
            <Link to="/">Home</Link>
            <Link to="/blog">Blog</Link>
            <span className="blog-index-nav-current" aria-current="page">
              Docs
            </span>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>
      <main id="docs-main" tabIndex={-1} className="ctn" style={{ padding: "32px 0 48px", maxWidth: 720 }}>
        <h1 className="blog-article-toc-title" style={{ fontSize: 28, marginBottom: 8 }}>
          Documentation & help
        </h1>
        <p style={{ color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6, marginBottom: 24 }}>
          Quick links for product help. See the project <code>README</code> in the repository for full setup, Supabase, and deployment
          checklists.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          <li>
            <Link to="/blog" style={{ fontWeight: 600, color: "#0d9488" }}>
              Blog — UK construction safety guides
            </Link>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", marginTop: 4 }}>Practical H&S content and compliance notes.</div>
          </li>
          <li>
            {statusIsExternal ? (
              <a href={statusUrl} style={{ fontWeight: 600, color: "#0d9488" }} rel="noopener noreferrer">
                Service status
              </a>
            ) : (
              <Link to={statusUrl} style={{ fontWeight: 600, color: "#0d9488" }}>
                Service status
              </Link>
            )}
            <div style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", marginTop: 4 }}>
              {statusIsExternal
                ? "Set VITE_PUBLIC_STATUS_URL to your public status or incident page."
                : "Internal status page for quick checks."}
            </div>
          </li>
        </ul>
        <h2 className="blog-article-toc-title" style={{ fontSize: 18, marginTop: 32, marginBottom: 10 }}>
          Legal
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          <Link to="/privacy">Privacy policy</Link>
          {" · "}
          <Link to="/terms">Terms of service</Link>
          {" · "}
          <Link to="/cookies">Cookie policy</Link>
        </p>
        <h2 className="blog-article-toc-title" style={{ fontSize: 18, marginTop: 24, marginBottom: 10 }}>
          Support
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </main>
      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </div>
  );
}
