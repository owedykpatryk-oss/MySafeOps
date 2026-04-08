import { Link } from "react-router-dom";
import { ShieldCheck, ClipboardList, Users, Cloud } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";

const teal = "#0d9488";
const navy = "#0f172a";

const feature = {
  wrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
    gap: 16,
    marginTop: 28,
  },
  card: {
    background: "#fff",
    border: "1px solid var(--color-border-tertiary,#e2e8f0)",
    borderRadius: 12,
    padding: "1.25rem",
  },
  h3: { margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: navy },
  p: { margin: 0, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55 },
};

export default function LandingPage() {
  const cloud = isSupabaseConfigured();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #E1F5EE 0%, #f8fafc 38%)", fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <header
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "1rem 1.25rem 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: teal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
            aria-hidden
          >
            <ShieldCheck size={24} strokeWidth={2} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: navy }}>MySafeOps</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            to="/login"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: `1px solid ${teal}`,
              color: teal,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Sign in
          </Link>
          <Link
            to={cloud ? "/login" : "/app"}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: teal,
              color: "#E1F5EE",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              border: `1px solid #085041`,
            }}
          >
            {cloud ? "Get started" : "Open workspace"}
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem 3rem" }}>
        <h1 style={{ fontSize: "clamp(1.65rem, 4vw, 2.25rem)", fontWeight: 700, color: navy, lineHeight: 1.2, margin: "0 0 12px", maxWidth: 640 }}>
          Construction safety and compliance, organised for UK sites
        </h1>
        <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)", color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0, maxWidth: 580 }}>
          RAMS, permits, registers, CDM, inductions, and dozens of HSE modules — in one fast web app. Your data stays in this browser unless you enable optional
          cloud backup.
        </p>

        <div style={feature.wrap}>
          <div style={feature.card}>
            <ClipboardList size={28} color={teal} strokeWidth={1.75} aria-hidden style={{ marginBottom: 10 }} />
            <h3 style={feature.h3}>Permits & RAMS</h3>
            <p style={feature.p}>Live permit types, RAMS builder with hazard libraries, method statements, and daily briefings.</p>
          </div>
          <div style={feature.card}>
            <Users size={28} color={teal} strokeWidth={1.75} aria-hidden style={{ marginBottom: 10 }} />
            <h3 style={feature.h3}>People & site</h3>
            <p style={feature.p}>Workers, training matrix, inductions, visitors, toolbox talks, and subcontractor links.</p>
          </div>
          <div style={feature.card}>
            <Cloud size={28} color={teal} strokeWidth={1.75} aria-hidden style={{ marginBottom: 10 }} />
            <h3 style={feature.h3}>Optional cloud</h3>
            <p style={feature.p}>
              {cloud
                ? "This project is linked to Supabase — sign in after “Get started” to use cloud backup from the Backup screen."
                : "Add Supabase in .env.local for sign-in and JSON backup, or keep everything local."}
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: 36,
            padding: "1.5rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--color-border-tertiary,#e2e8f0)",
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 16px", fontSize: 14, color: navy, fontWeight: 500 }}>Ready to open your workspace?</p>
          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 24px",
              borderRadius: 8,
              background: teal,
              color: "#E1F5EE",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 600,
              minHeight: 48,
              border: `1px solid #085041`,
            }}
          >
            {cloud ? "Sign in or continue" : "Continue to workspace"}
          </Link>
        </div>
      </main>

      <footer style={{ padding: "1.5rem 1.25rem", textAlign: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>
        UK-focused tooling — not a substitute for legal advice or HSE reporting requirements.
      </footer>
    </div>
  );
}
