import { Link } from "react-router-dom";
import { ShieldCheck, ClipboardList, Users, Cloud, ArrowRight, CheckCircle2 } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { BILLING_PLANS, formatBytes } from "../lib/billingPlans";

const teal = "#0d9488";
const navy = "#0f172a";
const SUPPORT_EMAIL = "mysafeops@gmail.com";
const ROLE_CARDS = [
  {
    title: "Admins",
    desc: "Set organisation defaults, manage settings, backup data, and keep audit-ready records.",
  },
  {
    title: "Supervisors",
    desc: "Run permits, RAMS, briefings, inspections, and daily site controls from one workspace.",
  },
  {
    title: "Workers",
    desc: "Complete inductions, signatures, toolbox talks, and register activity quickly on site.",
  },
];
const MODULE_HIGHLIGHTS = [
  "Permits, RAMS builder, method statements, and daily briefings",
  "Workers, inductions, signatures, visitors, and training matrix",
  "HSE registers: incidents, RIDDOR, COSHH, fire, PPE, plant, welfare, and more",
  "Documents, templates, audit log, monthly reporting, and search",
];
const COMPLIANCE_POINTS = [
  "UK-focused terminology and workflows for construction teams",
  "Supports record-keeping for HSE operations and site evidence",
  "Built for browser-first use on desktop and mobile",
];
const ONBOARDING_STEPS = [
  { title: "Create account", desc: "Email or Google sign-in. Your org is created on first successful login." },
  { title: "Start 14-day trial", desc: "No card needed. Your team gets full access to key safety modules immediately." },
  { title: "Invite your team", desc: "Send invite links, assign roles, and work in one shared organisation space." },
];
const SOCIAL_PROOF = [
  "Used by UK site teams running permits, RAMS, and briefings daily.",
  "Built to reduce spreadsheet sprawl and keep audit evidence easy to find.",
];

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
    borderRadius: 14,
    padding: "1.25rem",
    boxShadow: "var(--shadow-card)",
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

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1.25rem 3rem" }}>
        <div
          style={{
            border: "1px solid rgba(148,163,184,0.32)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, #ffffff 100%)",
            borderRadius: 16,
            boxShadow: "var(--shadow-md)",
            padding: "1.5rem",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--color-accent-muted)",
              color: "var(--color-accent-hover)",
              marginBottom: 10,
            }}
          >
            Built for UK construction teams
          </span>
          <h1 style={{ fontSize: "clamp(1.65rem, 4vw, 2.35rem)", fontWeight: 700, color: navy, lineHeight: 1.2, margin: "0 0 12px", maxWidth: 720 }}>
          Construction safety and compliance, organised for UK sites
          </h1>
          <p style={{ fontSize: "clamp(0.98rem, 2.5vw, 1.08rem)", color: "var(--color-text-secondary)", lineHeight: 1.65, margin: 0, maxWidth: 680 }}>
            RAMS, permits, registers, CDM, inductions, and HSE workflows in one fast web app. Start quickly with your team and keep records audit-ready without
            spreadsheet sprawl.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <Link
              to="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 18px",
                borderRadius: 10,
                background: teal,
                color: "#f0fdfa",
                textDecoration: "none",
                border: "1px solid #085041",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Start free trial <ArrowRight size={16} aria-hidden />
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "11px 18px",
                borderRadius: 10,
                border: "1px solid var(--color-border-secondary)",
                color: navy,
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
                background: "#fff",
              }}
            >
              Talk to support
            </a>
          </div>
        </div>

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

        <section
          style={{
            marginTop: 24,
            padding: "1.25rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--color-border-tertiary,#e2e8f0)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: navy }}>Built for UK site teams</h2>
          <p style={{ margin: "0 0 14px", color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.55 }}>
            Site safety, simplified. One app for admins, supervisors, and workers.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12 }}>
            {ROLE_CARDS.map((role) => (
              <div key={role.title} style={{ border: "1px solid var(--color-border-tertiary,#e2e8f0)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                <div style={{ color: navy, fontWeight: 600, marginBottom: 6 }}>{role.title}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>{role.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: "1.25rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--color-border-tertiary,#e2e8f0)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: navy }}>What you get today</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
            {MODULE_HIGHLIGHTS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
            Start local by default. Enable optional Supabase auth/backup and optional R2 uploads when needed.
          </p>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: "1.25rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--color-border-tertiary,#e2e8f0)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: navy }}>Compliance-ready foundation</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
            {COMPLIANCE_POINTS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 16, padding: "1.25rem", borderRadius: 12, background: "#fff", border: "1px solid var(--color-border-tertiary,#e2e8f0)" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: navy }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 10 }}>
            {ONBOARDING_STEPS.map((step, idx) => (
              <div key={step.title} style={{ border: "1px solid var(--color-border-tertiary,#e2e8f0)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                <div style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 999, background: "var(--color-accent-muted)", color: teal, alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  {idx + 1}
                </div>
                <div style={{ color: navy, fontWeight: 600, marginBottom: 4 }}>{step.title}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            padding: "1.25rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid var(--color-border-tertiary,#e2e8f0)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: navy }}>Pricing & limits</h2>
          <p style={{ margin: "0 0 12px", color: "var(--color-text-secondary)", fontSize: 14, lineHeight: 1.55 }}>
            Transparent plans: you can always see usage vs limits in Settings → Billing & limits.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: 10 }}>
            {Object.values(BILLING_PLANS).map((plan) => {
              const featured = plan.id === "starter";
              return (
              <div
                key={plan.id}
                style={{
                  border: featured ? "1px solid #0d9488" : "1px solid var(--color-border-tertiary,#e2e8f0)",
                  borderRadius: 10,
                  padding: "0.9rem 1rem",
                  background: featured ? "linear-gradient(180deg, rgba(240,253,250,0.8) 0%, #fff 70%)" : "#fff",
                }}
              >
                {featured && (
                  <span style={{ display: "inline-flex", fontSize: 11, fontWeight: 700, color: "#115e59", background: "#ccfbf1", borderRadius: 999, padding: "4px 8px", marginBottom: 8 }}>
                    Most popular
                  </span>
                )}
                <div style={{ color: navy, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>{plan.priceLabel}/{plan.interval}</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--color-text-secondary)", fontSize: 12, lineHeight: 1.6 }}>
                  <li>{plan.limits.workers} workers</li>
                  <li>{plan.limits.projects} projects</li>
                  <li>{formatBytes(plan.limits.cloudBytes)} cloud backup</li>
                </ul>
              </div>
            );
            })}
          </div>
        </section>

        <section style={{ marginTop: 16, padding: "1.25rem", borderRadius: 12, background: "#fff", border: "1px solid var(--color-border-tertiary,#e2e8f0)" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: navy }}>Why teams choose MySafeOps</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {SOCIAL_PROOF.map((quote) => (
              <div
                key={quote}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "0.85rem 0.95rem",
                  borderRadius: 10,
                  border: "1px solid var(--color-border-tertiary,#e2e8f0)",
                  background: "var(--color-background-secondary,#f8fafc)",
                }}
              >
                <CheckCircle2 size={18} color={teal} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: navy, lineHeight: 1.55 }}>{quote}</span>
              </div>
            ))}
          </div>
        </section>

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
        <br />
        Help & contact:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: teal, fontWeight: 500 }}>
          {SUPPORT_EMAIL}
        </a>
      </footer>
    </div>
  );
}
