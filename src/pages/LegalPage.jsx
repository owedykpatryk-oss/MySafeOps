import { useEffect } from "react";
import { Link } from "react-router-dom";
import LandingFooter from "../components/landing/LandingFooter";
import { getSupportEmail } from "../config/supportContact";
import "../styles/landing.css";

const SUPPORT_EMAIL = getSupportEmail();

const DOCS = {
  privacy: {
    title: "Privacy policy",
    pageTitle: "Privacy Policy — MySafeOps",
    iframeSrc: "/legal/privacy-policy.html",
  },
  terms: {
    title: "Terms of service",
    pageTitle: "Terms of Service — MySafeOps",
    iframeSrc: "/legal/terms.html",
  },
  cookies: {
    title: "Cookie policy",
    pageTitle: "Cookie policy — MySafeOps",
    iframeSrc: "/legal/cookies.html",
  },
  dpa: {
    title: "Data processing",
    pageTitle: "Data processing — MySafeOps",
    iframeSrc: "/legal/dpa.html",
  },
};

/**
 * @param {{ docKey: keyof typeof DOCS }} props
 */
export default function LegalPage({ docKey }) {
  const meta = DOCS[docKey];

  useEffect(() => {
    if (!meta) return undefined;
    const prev = document.title;
    document.title = meta.pageTitle;
    return () => {
      document.title = prev;
    };
  }, [meta]);

  if (!meta) {
    return (
      <div className="landing-page blog-index-page">
        <main className="ctn" style={{ padding: "48px 0" }}>
          <p>Unknown document.</p>
          <Link to="/">Home</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="landing-page blog-index-page">
      <a href="#legal-main" className="landing-skip-link">
        Skip to main content
      </a>
      <header className="blog-index-header" role="banner">
        <div className="ctn blog-index-header-inner">
          <Link to="/" className="logo">
            <svg viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path
                d="M2 14C2 10.5 4 8.5 6 7.8L20 2C21.2 1.6 22.8 1.6 24 2L38 7.8C40 8.5 42 10.5 42 14V30C42 42 24 50 22 51C20 50 2 42 2 30V14Z"
                fill="#0d9488"
                fillOpacity="0.12"
                stroke="#0d9488"
                strokeWidth="2.5"
              />
              <path d="M13 26L19 32L31 20" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="lt">
              <span>My</span>
              <span>Safe</span>
              <span>Ops</span>
            </div>
          </Link>
          <nav className="blog-index-nav" aria-label="Legal">
            <Link to="/">Home</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>

      <main id="legal-main" tabIndex={-1} style={{ minHeight: "60vh" }}>
        <iframe
          title={meta.title}
          src={meta.iframeSrc}
          style={{
            display: "block",
            width: "100%",
            minHeight: "calc(100vh - 200px)",
            border: 0,
          }}
          loading="lazy"
        />
      </main>

      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </div>
  );
}
