import { Link } from "react-router-dom";
import PageHero from "./PageHero";
import { getSupportEmail } from "../config/supportContact";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";
import { getDisplayAppVersion } from "../utils/appBuildInfo";

const DISPLAY_APP_VERSION = getDisplayAppVersion();

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
  btn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #0d9488",
    background: "var(--color-accent-muted,#ccfbf1)",
    color: "#0f766e",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    marginTop: 4,
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--color-border-secondary,#cbd5e1)",
    background: "var(--color-background-primary,#fff)",
    color: "var(--color-text-primary)",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    marginTop: 4,
  },
  h3: {
    margin: "20px 0 8px",
    fontSize: 15,
    fontWeight: 600,
    color: "var(--color-text-primary)",
    letterSpacing: "-0.01em",
  },
  h3First: {
    margin: "0 0 8px",
    fontSize: 15,
    fontWeight: 600,
    color: "var(--color-text-primary)",
    letterSpacing: "-0.01em",
  },
  note: {
    fontSize: 12,
    color: "var(--color-text-tertiary,#64748b)",
    lineHeight: 1.5,
    margin: "0 0 12px",
    padding: "10px 12px",
    background: "var(--color-background-secondary,#f8fafc)",
    borderRadius: 8,
    border: "0.5px solid var(--color-border-tertiary,#e2e8f0)",
  },
  ol: { fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.65, paddingLeft: 22, margin: "0 0 12px" },
  kbd: {
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 4,
    border: "1px solid var(--color-border-tertiary,#e2e8f0)",
    background: "var(--color-background-secondary,#f1f5f9)",
    fontFamily: "ui-monospace, monospace",
  },
  btnRow: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" },
};

const SUPPORT_EMAIL = getSupportEmail();

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
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, maxWidth: 800, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="?"
        title="Help & about"
        lead="UK-oriented construction safety and compliance workspace. Data stays in this browser unless you use optional Supabase backup (Settings) or R2 uploads from Documents."
      />
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Get started — overview
        </h2>
        <p style={ss.p}>
          Work through these in order. The app keeps most data in <strong>this browser</strong> (per organisation) unless you enable optional cloud backup in Settings.
        </p>
        <ol style={{ ...ss.ol, listStyle: "decimal" }}>
          <li style={{ marginBottom: 10 }}>
            <strong>Organisation profile</strong> — logo, legal name, contact details, brand colours, PDF footer/compliance lines so exports look like your company.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>At least one project</strong> — a site or job record used when you pick “project” in RAMS, permits, CDM, timesheets, site map, client portal, and more.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Workers</strong> — people you attach to briefings, RAMS, training, and registers (see Workers module).
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>First RAMS or permit</strong> — use the <strong>RAMS</strong> or <strong>Permits</strong> tab when you are ready to document work.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Team access</strong> — optional: <strong>Settings → Invites</strong> or <strong>Members</strong> for colleagues (when your plan supports it).
          </li>
        </ol>
        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
            Open Organisation settings
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "workers" })}>
            Open Workers &amp; projects
          </button>
        </div>
        <p style={{ ...ss.p, marginBottom: 0, marginTop: 14, fontSize: 12 }}>
          <strong>Deep links (UK English UI)</strong> — signed-in workspace: <code style={{ fontSize: 11 }}>/app?view=permits</code>,{" "}
          <code style={{ fontSize: 11 }}>/app?view=workers</code>, <code style={{ fontSize: 11 }}>/app?view=settings</code>. Optional permit focus:{" "}
          <code style={{ fontSize: 11 }}>/app?view=permits&amp;permitId=…</code>. Settings tab: <code style={{ fontSize: 11 }}>?settingsTab=organisation</code> or{" "}
          <code style={{ fontSize: 11 }}>?settingsTab=invites</code> (any tab id). The address bar updates as you move around so you can bookmark or share a link.
        </p>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Release status
        </h2>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          The open-source tree runs automated <strong>tests and production builds in CI</strong> (GitHub Actions) on each push. Optional error monitoring (e.g. Sentry) can be wired via
          environment variables documented in <code style={{ fontSize: 12 }}>.env.example</code>. The <strong>Dashboard</strong> includes a &quot;Site today&quot; snapshot and onboarding checklist
          for a quick sense of permits, RAMS, workers, and site sign-ins in this browser.
        </p>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Organisation profile (Settings)
        </h2>
        <p style={ss.p}>
          Path: bottom bar <strong>More</strong> → <strong>Settings</strong> → <strong>Organisation</strong>. Inside Organisation, use the sub-tabs along the top of the form:
        </p>
        <ul style={ss.ul}>
          <li>
            <strong>Branding &amp; logo</strong> — upload a logo (keep under the stated size limit). Set <strong>primary</strong> and <strong>accent</strong> colours used across the UI and many PDFs.
          </li>
          <li>
            <strong>Company info</strong> — trading or legal name, address, phone, email, website, company / VAT numbers where you need them on documents.
          </li>
          <li>
            <strong>PDF defaults</strong> — footer line, optional header, watermark text, theme, version prefix, and compliance line (e.g. “controlled document” wording).
          </li>
          <li>
            <strong>Custom fields</strong> — extra key/value lines that can surface on exports where the module supports them.
          </li>
          <li>
            <strong>Access</strong> — who may edit organisation settings (administrators).
          </li>
          <li>
            <strong>Preview</strong> — sanity-check how branding and PDF options read before you print or share.
          </li>
        </ul>
        <p style={ss.p}>
          Also fill <strong>locale</strong> (date formats), <strong>default lead engineer</strong>, <strong>safety policy</strong>, and <strong>emergency contact</strong> where shown — permits and site-facing screens can reuse them.
        </p>
        <p style={ss.note}>
          Save changes with the save control on the Organisation screen. Only users with organisation-settings permission can edit.
        </p>
        <button type="button" style={ss.btn} onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
          Open Organisation settings
        </button>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Create a project (step by step)
        </h2>
        <p style={ss.p}>
          In MySafeOps, a <strong>project</strong> is a site, contract, or job record. It is <strong>not</strong> created inside Settings — it lives on the <strong>Workers &amp; projects</strong> screen.
        </p>
        <h3 style={ss.h3First}>1. Open Workers &amp; projects</h3>
        <p style={ss.p}>
          Tap <strong>Workers</strong> in the bottom navigation (people icon). The page title is <strong>Workers &amp; projects</strong>. You will see a list of workers and a separate list of projects below (scroll if needed).
        </p>
        <h3 style={ss.h3}>2. Start the project form</h3>
        <p style={ss.p}>
          Use the orange <strong>Add project</strong> button in the page header (next to <strong>Add worker</strong>). A modal opens titled <strong>New project</strong> (or <strong>Edit project</strong> when changing an existing one).
        </p>
        <h3 style={ss.h3}>3. Fill in every field</h3>
        <ul style={ss.ul}>
          <li>
            <strong>Project name</strong> — short label you will see in dropdowns (e.g. “Warehouse fit-out — Acme Ltd”).
          </li>
          <li>
            <strong>Site / client</strong> — optional but useful for distinguishing jobs (client name or site nickname).
          </li>
          <li>
            <strong>Address</strong> — full site address. Used for geocoding and for modules that show location text.
          </li>
          <li>
            <strong>Latitude / Longitude</strong> — optional decimal degrees. If empty, use <strong>Fill lat/lng from address</strong> to query OpenStreetMap Nominatim from the address or site line. Coordinates power the <strong>Site map</strong> module (pins and presence).
          </li>
        </ul>
        <h3 style={ss.h3}>4. Save</h3>
        <p style={ss.p}>
          Tap <strong>Save</strong> in the modal. The project is stored with your organisation&apos;s data in the browser. You can edit or remove a project later from the same list.
        </p>
        <h3 style={ss.h3}>Where projects are used</h3>
        <p style={ss.p}>
          After you have at least one project, you can attach it in places such as: <strong>RAMS</strong> (job selection), <strong>Permits</strong>, <strong>CDM compliance</strong> (link to MySafeOps project), <strong>timesheets</strong>, <strong>daily briefing</strong>, <strong>site map</strong>, <strong>client portal</strong> scope, <strong>snags</strong>, and other registers that ask for a project — always pick the same record for consistency.
        </p>
        <p style={ss.note}>
          If you need many sites, create one project per site or per major phase; name them so your team recognises them in dropdowns.
        </p>
        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceView({ viewId: "workers" })}>
            Open Workers &amp; projects
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "site-map" })}>
            Open Site map
          </button>
        </div>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Workers, RAMS, permits, and team
        </h2>
        <h3 style={ss.h3First}>Workers</h3>
        <p style={ss.p}>
          On the same <strong>Workers &amp; projects</strong> screen, use <strong>Add worker</strong> to capture name, role, contact details, and certifications. Workers appear in induction, RAMS operative lists, training matrix, and exports. Use <strong>Export CSV</strong> if you need a spreadsheet snapshot.
        </p>
        <h3 style={ss.h3}>RAMS and permits</h3>
        <p style={ss.p}>
          Open <strong>RAMS</strong> from the bottom bar to build or import method statements and packs; choose the <strong>project</strong> and link <strong>workers</strong> where the builder asks for them. Open <strong>Permits</strong> to raise permits to work, isolation certificates, and related records — again, select the same project for traceability.
        </p>
        <h3 style={ss.h3}>Invites and members</h3>
        <p style={ss.p}>
          Go to <strong>More</strong> → <strong>Settings</strong> → <strong>Invites</strong> to send join links, or <strong>Members</strong> to review who belongs to the organisation. Availability depends on your subscription and Supabase configuration.
        </p>
        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceView({ viewId: "workers" })}>
            Workers &amp; projects
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "rams" })}>
            RAMS
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "permits" })}>
            Permits
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceSettings({ tab: "invites" })}>
            Invites
          </button>
        </div>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          Navigation and search
        </h2>
        <ul style={ss.ul}>
          <li>
            <strong>Bottom bar</strong> — <strong>Dashboard</strong>, <strong>Permits</strong>, <strong>RAMS</strong>, <strong>Workers</strong>, <strong>Site map</strong>, and <strong>More</strong> for every other module.
          </li>
          <li>
            <strong>More</strong> — grouped grid; use the filter box to find a module by name. Use the <strong>pin</strong> on a tile to save <strong>pinned shortcuts</strong> at the top of More and in Search when the box is empty. <strong>Settings</strong> and <strong>Help</strong> live here too.
          </li>
          <li>
            <strong>Search</strong> — top bar, or <kbd style={ss.kbd}>Ctrl</kbd>+<kbd style={ss.kbd}>K</kbd> / <kbd style={ss.kbd}>Cmd</kbd>+<kbd style={ss.kbd}>K</kbd> (works everywhere), or <kbd style={ss.kbd}>/</kbd> when not typing in a field — jump to a screen or search workers, projects, RAMS, permits, snags (local data). Empty search lists <strong>pinned</strong> shortcuts, then <strong>recently opened</strong> modules (last five).
          </li>
          <li>
            <strong>Help</strong> — press <kbd style={ss.kbd}>?</kbd> when a text field is not focused to open this page from anywhere in the app.
          </li>
        </ul>
      </div>
      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, display: "flex", alignItems: "center", textTransform: "none", letterSpacing: "normal" }}>
          What&apos;s new
        </h2>
        <p style={ss.p}>Recent additions worth knowing about:</p>
        <ul style={ss.ul}>
          <li>
            <strong>Pinned &amp; recent</strong> — Pin modules from <strong>More</strong>; they appear at the top of More and first in <strong>Search</strong> when you open it without typing. The same list then shows your <strong>last five opened</strong> screens (excluding duplicates already pinned).
          </li>
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
          <strong>Version</strong> {DISPLAY_APP_VERSION}
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
          Production hardening (Vercel)
        </h2>
        <p style={ss.p}>
          Deployed builds can use a <strong>Content-Security-Policy</strong> and short HTML cache (see <code style={{ fontSize: 12 }}>vercel.json</code>
          ). Anthropic calls can go through <code style={{ fontSize: 12 }}>/api/anthropic-messages</code> with <code style={{ fontSize: 12 }}>ANTHROPIC_API_KEY</code> on the server — set{" "}
          <code style={{ fontSize: 12 }}>VITE_ANTHROPIC_PROXY_URL</code> in the client env. Optional <code style={{ fontSize: 12 }}>VITE_WEB_VITALS_URL</code> (default{" "}
          <code style={{ fontSize: 12 }}>/api/web-vitals</code>) posts Core Web Vitals for server logs. Details: <code style={{ fontSize: 12 }}>.env.example</code>.
        </p>
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
