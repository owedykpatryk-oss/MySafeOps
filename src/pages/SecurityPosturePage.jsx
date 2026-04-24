import { Link } from "react-router-dom";
import LandingFooter from "../components/landing/LandingFooter";
import { getSupportEmail } from "../config/supportContact";
import "../styles/landing.css";

const SUPPORT_EMAIL = getSupportEmail();

/**
 * Public trust page for procurement / Cyber Essentials evidence (high level).
 * Detailed maintainer notes live in SECURITY.md at the repository root.
 */
export default function SecurityPosturePage() {
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
          <nav className="blog-index-nav" aria-label="Security">
            <Link to="/">Home</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="ctn" style={{ padding: "32px 0 48px", maxWidth: 720 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Security &amp; trust</h1>
        <p style={{ color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6, marginBottom: 20 }}>
          High-level summary of how the production web app is built and operated. For sensitive reports, use the contact in{" "}
          <a href="/.well-known/security.txt" rel="noopener noreferrer">
            <code>/.well-known/security.txt</code>
          </a>
          .
        </p>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Transport &amp; headers</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: "var(--color-text-secondary, #64748b)" }}>
            <li>HTTPS for the marketing site and application (TLS terminated by the hosting / CDN provider).</li>
            <li>Security headers (including HSTS and frame protections) are defined in the repository for the static deployment (see <code>vercel.json</code> and <code>public/_headers</code> in the project).</li>
            <li>Content-Security-Policy is staged as report-only in <code>public/_headers</code> where applicable.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Authentication &amp; access</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: "var(--color-text-secondary, #64748b)" }}>
            <li>End-user sign-in is handled by <strong>Supabase Auth</strong> (email / OAuth as configured in your project).</li>
            <li>Organisation membership and roles (admin / supervisor / operative) are enforced in the app and backed by server-side checks where cloud features are used.</li>
            <li>Multi-factor authentication should be enabled for all operator accounts in the Supabase Dashboard; customer organisations can adopt MFA according to their own policy.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Secrets &amp; payments</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: "var(--color-text-secondary, #64748b)" }}>
            <li>Only public configuration values are embedded in the browser bundle (<code>VITE_*</code>). Service keys never ship to clients.</li>
            <li>Stripe billing uses <strong>Supabase Edge Functions</strong> so the Stripe secret key stays server-side.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Cloud data &amp; backups (optional modules)</h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, color: "var(--color-text-secondary, #64748b)" }}>
            <li>
              When enabled, organisation sync and audit features use <strong>Cloudflare Workers</strong> with <strong>D1</strong> storage. Access is checked with Supabase RPCs (including organisation isolation on KV and{" "}
              <strong>separate read rules</strong> for the server-side audit chain: typically admin and supervisor roles).
            </li>
            <li>Scheduled D1 snapshots can be written to <strong>Cloudflare R2</strong> by the <code>d1-backup</code> worker (see project documentation for operations).</li>
          </ul>
        </section>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Maintainers</h2>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--color-text-secondary, #64748b)" }}>
            The authoritative technical checklist for releases lives in <code>SECURITY.md</code> at the root of the source repository (version controlled). This page is a customer-facing summary and may lag slightly behind infrastructure changes.
          </p>
        </section>

        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p style={{ marginTop: 16 }}>
          <Link to="/docs" style={{ color: "#0d9488", fontWeight: 600 }}>
            ← Documentation &amp; help
          </Link>
        </p>
      </main>
      <LandingFooter supportEmail={SUPPORT_EMAIL} />
    </div>
  );
}
