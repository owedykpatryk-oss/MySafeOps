import { Link } from "react-router-dom";
import packageJson from "../../package.json";
import PageHero from "./PageHero";

const ss = {
  card: {
    background: "var(--color-background-primary,#fff)",
    border: "0.5px solid var(--color-border-tertiary,#e5e5e5)",
    borderRadius: 12,
    padding: "1.25rem",
    marginBottom: 16,
  },
  h2: { margin: "0 0 8px", fontSize: 20, fontWeight: 500 },
  p: { fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55, margin: "0 0 12px" },
  ul: { fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.6, paddingLeft: 20, margin: 0 },
  a: { color: "#0d9488" },
};
const SUPPORT_EMAIL = "mysafeops@gmail.com";

const MODULE_GROUPS = [
  {
    title: "Core",
    items: ["Dashboard", "Permits", "RAMS", "Workers", "Site map", "Method statement", "CDM", "Daily briefing"],
  },
  {
    title: "People & site",
    items: ["QR induction", "Signatures", "Timesheets", "Snags", "Visitor log", "Training matrix", "Subcontractor portal", "Client portal"],
  },
  {
    title: "Health, safety & environment",
    items: [
      "COSHH",
      "Inspections",
      "Incidents & near miss",
      "RIDDOR",
      "Emergency contacts",
      "PPE register",
      "Plant & equipment",
      "Fire safety log",
      "Hot work register",
      "First aid",
      "Lone working",
      "Environmental log",
      "Waste register",
      "Safety observations",
      "Ladder inspections",
      "MEWP log",
      "Gate book",
      "Asbestos register",
      "Confined space log",
      "LOTO register",
      "Electrical / PAT",
      "Lifting operations",
      "DSEAR register",
      "Noise & vibration (noise + HAV)",
      "Scaffold inspections",
      "Excavations / permit to dig",
      "Temporary works register",
      "Welfare checks",
      "Water hygiene (Legionella-style outlets)",
    ],
  },
  {
    title: "AI & documents",
    items: ["AI RAMS", "AI toolbox", "AI photo hazard", "Templates", "Documents", "Monthly report"],
  },
  {
    title: "Data & settings",
    items: ["Analytics", "Toolbox talks register", "Backup", "Audit log", "Settings (org, roles, notifications, Supabase)", "Documents → optional R2 cloud upload"],
  },
];

export default function HelpAbout() {
  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, maxWidth: 720, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="?"
        title="Help & about"
        lead="UK-oriented construction safety and compliance workspace. Data stays in this browser unless you use optional Supabase backup (Settings) or R2 uploads from Documents."
      />
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          What&apos;s new
        </h2>
        <p style={ss.p}>Recent additions worth knowing about:</p>
        <ul style={ss.ul}>
          <li>
            <strong>Search</strong> — Top bar <strong>Search</strong> or <kbd>Ctrl+K</kbd> / <kbd>Cmd+K</kbd>: jump to any screen and find workers, projects, RAMS, permits, snags (local data).
          </li>
          <li>
            <strong>Site map</strong> — Leaflet map of project sites, who is where, and geocoding with a 30-day local cache.{" "}
            <strong>Apply from today&apos;s briefing</strong> fills presence from the latest same-day briefing (signed + present workers, project on the briefing).
          </li>
          <li>
            <strong>Backup</strong> — JSON import validates structure; very large cloud uploads prompt before sending; cloud restore checks payload shape.
          </li>
          <li>
            <strong>Google sign-in</strong> — Optional OAuth (PKCE) with Supabase when configured; see README and Settings.
          </li>
          <li>
            <strong>RAMS import</strong> — JSON import with operative matching by ID, email, exact name, or multi-word name (with export metadata when present).
          </li>
          <li>
            <strong>RAMS share link</strong> — Read-only view in the same browser profile; full cross-device sharing needs sync (see product docs).
          </li>
        </ul>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          <strong>Version</strong> {packageJson.version}
          {" · "}
          <Link to="/" style={ss.a}>
            Home / marketing page
          </Link>
        </p>
      </div>
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Module index
        </h2>
        <p style={ss.p}>Everything below is available from the bottom navigation or the More grid.</p>
        {MODULE_GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: 16 }}>
            <div className="app-section-label" style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, textTransform: "none", letterSpacing: "normal" }}>
              {g.title}
            </div>
            <ul style={ss.ul}>
              {g.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Developer setup
        </h2>
        <p style={ss.p}>
          Running from source? See <strong>README.md</strong> in the project root for <code style={{ fontSize: 12 }}>npm install</code>,{" "}
          <code style={{ fontSize: 12 }}>.env.local</code>, optional Supabase migration, and security notes on <code style={{ fontSize: 12 }}>VITE_*</code> variables.
        </p>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          Architecture overview: <strong>DOCS/architecture-current.md</strong>. Prototype vs shipped features: <strong>DOCS/PRODUCT_SCOPE.md</strong>.
        </p>
      </div>
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Public links
        </h2>
        <p style={ss.p}>
          Client read-only view: append <code style={{ fontSize: 12 }}>?portal=TOKEN</code> to the app URL. Subcontractor view:{" "}
          <code style={{ fontSize: 12 }}>?subcontractor=TOKEN</code>. Configure tokens in the respective modules.
        </p>
      </div>
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Help & contact
        </h2>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          For support, onboarding, or sales questions email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={ss.a}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Disclaimer
        </h2>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          This app supports record-keeping and does not replace legal advice, competent person judgement, or official reporting (e.g. RIDDOR to HSE). Always verify
          requirements for your project and jurisdiction.
        </p>
      </div>
    </div>
  );
}
