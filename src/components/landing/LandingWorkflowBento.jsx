import { Link } from "react-router-dom";
import { loginLinkPrefetchProps } from "../../utils/routePrefetch";

const STEPS = [
  {
    id: "profile",
    emoji: "🎯",
    title: "Pick your workspace profile",
    copy: "Construction, surveying, food/pharma or demolition — modules and RAMS libraries match your trade from day one.",
    accent: "rgba(139,92,246,.14)",
    border: "rgba(139,92,246,.35)",
    span: "wide",
  },
  {
    id: "rams",
    emoji: "⚠️",
    title: "Seed RAMS in one click",
    copy: "Built-in quick packs with hazards, controls, PPE and permit links — not empty Word templates.",
    accent: "rgba(13,148,136,.12)",
    border: "rgba(13,148,136,.35)",
    span: "normal",
  },
  {
    id: "ptw",
    emoji: "🔥",
    title: "Issue & track permits live",
    copy: "Hot work, height, confined space, electrical — expiry, SIMOPS and quality gates visible on the dashboard.",
    accent: "rgba(249,115,22,.12)",
    border: "rgba(249,115,22,.35)",
    span: "normal",
  },
  {
    id: "export",
    emoji: "🖨️",
    title: "Export audit-ready PDFs",
    copy: "RAMS matrix, survey reports, permit boards — print or share without rebuilding spreadsheets.",
    accent: "rgba(59,130,246,.12)",
    border: "rgba(59,130,246,.35)",
    span: "wide",
  },
];

export default function LandingWorkflowBento() {
  return (
    <section className="landing-bento" id="workflow">
      <div className="ctn">
        <div className="sh fu">
          <div className="badge" style={{ background: "rgba(249,115,22,.12)", color: "var(--org-d)" }}>
            How teams actually use it
          </div>
          <h2>From profile to signed-off site records</h2>
          <p>One flow — not five disconnected tools. Offline on site, optional cloud sync when you need backup and invites.</p>
        </div>

        <div className="landing-bento-grid fu">
          {STEPS.map((step, i) => (
            <article
              key={step.id}
              className={`landing-bento-card landing-bento-card--${step.span}`}
              style={{
                "--bento-accent": step.accent,
                "--bento-border": step.border,
                "--bento-delay": `${i * 80}ms`,
              }}
            >
              <span className="landing-bento-card__step">{String(i + 1).padStart(2, "0")}</span>
              <span className="landing-bento-card__emoji" aria-hidden>
                {step.emoji}
              </span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>

        <div className="landing-bento-cta fu">
          <Link to="/login" className="btn btn-p landing-btn-glow" {...loginLinkPrefetchProps}>
            Start 14-day evaluation →
          </Link>
          <a href="#profiles" className="btn btn-o">
            Explore profiles &amp; RAMS
          </a>
        </div>
      </div>
    </section>
  );
}
