import { useState } from "react";
import { Link } from "react-router-dom";
import PageHero from "./PageHero";
import { getSupportEmail } from "../config/supportContact";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";
import { getDisplayAppVersion } from "../utils/appBuildInfo";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import { getAppliedIndustryPackId } from "../utils/orgIndustryPacks";
import { isIndustryPackPreviewActive } from "../utils/industryPackPreview";
import {
  WORKSPACE_PROFILE_OVERVIEW,
  getActiveProfileGuideSummary,
  listProfileGuideCatalogue,
} from "../utils/workspaceProfileGuide";
import { MORE_SECTIONS, getMoreTabsForSection, NAV_TAB_IDS } from "../navigation/appModules";
import { WORKSPACE_SETTINGS_TABS } from "../config/workspaceSettingsTabs";

const DISPLAY_APP_VERSION = getDisplayAppVersion();
const SHOW_DEV_HINTS = showAdminLoginHints();

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
  linkBtn: {
    background: "none",
    border: "none",
    padding: 0,
    font: "inherit",
    color: "#0d9488",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  },
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
  moduleLi: { marginBottom: 6 },
};

const SUPPORT_EMAIL = getSupportEmail();

/** One-line purpose for every workspace screen (used in the full module index). */
const MODULE_BLURBS = {
  dashboard: "Site today snapshot, onboarding checklist, KPIs, and quick actions.",
  permits: "Permit-to-work, board and timeline views, plan overlay, linked incidents.",
  rams: "RAMS builder, hazard library, PDF export, evidence packs, JSON import.",
  workers: "Legacy route — use Projects and People.",
  projects: "Sites and jobs — 5-step wizard, playbooks, project hub.",
  people: "Team members, certifications, CSV export.",
  bin: "Recently deleted register rows — restore or remove permanently.",
  "site-map": "Map of project sites, who is on site, boundaries, escape routes.",
  "project-drawings": "Upload plans; click to mark escape routes, zones, and emergency assets.",
  "method-statement": "Standalone method statements linked to projects.",
  cdm: "CDM duty-holder checklist and project compliance records.",
  "daily-briefing": "Daily site briefing, attendance, hazards — feeds site map presence.",
  induction: "QR-based site induction and sign-on records.",
  signatures: "Capture digital signatures on documents.",
  timesheets: "Worker hours by project.",
  snags: "Snag list with photos, status, and project link.",
  "geo-photos": "GPS-tagged site photos for surveys and utility records.",
  coshh: "COSHH / substance register and assessments.",
  inspections: "Scheduled and ad-hoc inspection tracker.",
  incidents: "Incidents and near-miss log.",
  "incident-actions": "Corrective and preventive actions from incidents.",
  "incident-map": "Heatmap of incident locations on site boundaries.",
  riddor: "RIDDOR decision support and record keeping (HSE reporting is your responsibility).",
  emergency: "Emergency contact list for sites and projects.",
  ppe: "PPE issue and inspection register.",
  plant: "Plant and equipment register with checks.",
  fire: "Fire safety inspections, drills, and equipment log.",
  "hot-work": "Hot work permit register and QC sign-off.",
  training: "Training matrix — who holds which competencies.",
  visitors: "Visitor sign-in log.",
  "toolbox-reg": "Toolbox talk attendance register.",
  "first-aid": "First aiders and kit locations.",
  "lone-working": "Lone working log and check-ins.",
  environmental: "Environmental incidents and controls log.",
  observations: "Safety observations and close-out.",
  ladders: "Ladder inspection register.",
  mewp: "MEWP inspection and use log.",
  gate: "Gate book — deliveries and site traffic.",
  asbestos: "Asbestos register and survey references.",
  "confined-space": "Confined space entry log.",
  loto: "Lock-out tag-out register.",
  "electrical-pat": "Electrical equipment and PAT records.",
  lifting: "Lifting plans and equipment register.",
  dsear: "DSEAR / ATEX hazardous area register.",
  "high-care-access": "High-care / hygiene area access log (food manufacturing).",
  "cip-signoff": "CIP cleaning sign-off register.",
  "allergen-changeovers": "Allergen changeover records between production runs.",
  "gmp-deviations": "GMP deviation log.",
  noise: "Noise and hand-arm vibration exposure records.",
  scaffold: "Scaffold inspection register.",
  excavation: "Excavation and permit-to-dig log.",
  "temp-works": "Temporary works design and checks register.",
  welfare: "Welfare facility checks on site.",
  "water-hygiene": "Water hygiene / Legionella-style outlet log.",
  analytics: "Charts and compliance metrics across modules.",
  "monthly-report": "Monthly H&S summary report builder.",
  "survey-report": "Professional survey reports — scope, findings, plans, geo-photos, PDF export.",
  waste: "Waste transfer and consignment notes register.",
  templates: "Reusable document templates for exports.",
  "client-portal": "Generate read-only client portal links.",
  "client-acquisition": "Sales playbook for winning new construction clients.",
  "sales-enablement": "Collateral and talk tracks for demos.",
  "enterprise-readiness": "Checklist for larger multi-site rollouts.",
  subcontractor: "Subcontractor portal tokens and scoped access.",
  documents: "Local folder browser; optional cloud file upload.",
  backup: "JSON export, import, and cloud backup.",
  audit: "Who changed what — local log plus optional cloud copy.",
  superadmin: "Platform owner dashboard (restricted).",
  help: "This page.",
  "ai-rams": "AI-assisted RAMS draft generator (when enabled).",
  "ai-toolbox": "AI toolbox talk drafts (when enabled).",
  "ai-photo": "AI hazard hints from site photos (when enabled).",
};

const BOTTOM_NAV_IDS = NAV_TAB_IDS.filter((t) => t.id !== "more").map((t) => t.id);

function ModuleLink({ viewId, label }) {
  if (viewId === "help") return <strong>{label}</strong>;
  if (viewId === "settings") {
    return (
      <button type="button" style={ss.linkBtn} onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
        {label}
      </button>
    );
  }
  return (
    <button type="button" style={ss.linkBtn} onClick={() => openWorkspaceView({ viewId })}>
      {label}
    </button>
  );
}

function ModuleIndexList({ tabs }) {
  return (
    <ul style={ss.ul}>
      {tabs.map((t) => (
        <li key={t.id} style={ss.moduleLi}>
          <ModuleLink viewId={t.id} label={t.label} />
          {MODULE_BLURBS[t.id] ? (
            <span style={{ color: "var(--color-text-secondary)" }}> — {MODULE_BLURBS[t.id]}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ProfileGuideCatalogue({ activePackId }) {
  const [openId, setOpenId] = useState(activePackId || null);
  const catalogue = listProfileGuideCatalogue();

  return (
    <div className="app-help-profile-catalogue">
      {catalogue.map((entry) => {
        const isActive = entry.id === activePackId;
        const isOpen = openId === entry.id;
        return (
          <article
            key={entry.id}
            className={`app-help-profile-card${isActive ? " app-help-profile-card--active" : ""}`}
          >
            <button
              type="button"
              className="app-help-profile-card__head"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : entry.id)}
            >
              <span className="app-help-profile-card__title">{entry.label}</span>
              {isActive ? <span className="app-help-profile-card__badge">Your profile</span> : null}
              <span className="app-help-profile-card__hint">{entry.hint}</span>
            </button>
            {isOpen ? (
              <div className="app-help-profile-card__body">
                <p>{entry.tagline}</p>
                <p>
                  <strong>Best for:</strong> {entry.whoFor}
                </p>
                <p>
                  <strong>What it adjusts</strong>
                </p>
                <ul>
                  {entry.adjusts.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p>
                  <strong>Site pack export:</strong> {entry.hubFocus}
                </p>
                <p>
                  <strong>RAMS builder:</strong> {entry.ramsNote}
                </p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export default function HelpAbout() {
  const activePackId = getAppliedIndustryPackId() || "generalContractor";
  const profileSummary = getActiveProfileGuideSummary();
  const bottomNavTabs = BOTTOM_NAV_IDS.map((id) => {
    const nav = NAV_TAB_IDS.find((t) => t.id === id);
    return nav || { id, label: id };
  });

  return (
    <div style={{ fontFamily: "DM Sans,system-ui,sans-serif", padding: "1.25rem 0", fontSize: 14, maxWidth: 800, color: "var(--color-text-primary)" }}>
      <PageHero
        badgeText="?"
        title="Help & about"
        lead="UK construction safety and compliance workspace. Profiles tailor modules and Project Hub to your trade — everything below is in plain English. Use Search (Ctrl+K) or the module index to find any screen."
      />

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Find anything fast
        </h2>
        <ul style={ss.ul}>
          <li>
            <strong>Search</strong> — top bar, <kbd style={ss.kbd}>Ctrl</kbd>+<kbd style={ss.kbd}>K</kbd>, or <kbd style={ss.kbd}>/</kbd> — jump to a module or find workers, projects, RAMS, permits, snags.
          </li>
          <li>
            <strong>More</strong> — filter the module grid; pin tiles for shortcuts.
          </li>
          <li>
            <strong>Module index</strong> — complete list with one-line descriptions further down this page; names are clickable.
          </li>
          <li>
            <strong>Help</strong> — press <kbd style={ss.kbd}>?</kbd> from anywhere (when not typing in a field).
          </li>
        </ul>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Quick links
        </h2>
        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
            Organisation
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "projects" })}>
            Projects
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "people" })}>
            People
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "permits" })}>
            Permits
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "rams" })}>
            RAMS
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "dashboard" })}>
            Dashboard
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "backup" })}>
            Backup
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceSettings({ tab: "notifications" })}>
            Notifications
          </button>
        </div>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Get started
        </h2>
        <ol style={{ ...ss.ol, listStyle: "decimal" }}>
          <li style={{ marginBottom: 10 }}>
            <strong>Workspace profile</strong> — pick your trade under Settings → Organisation (modules, Project Hub, RAMS starter). See the{" "}
            <button type="button" style={ss.linkBtn} onClick={() => document.getElementById("workspace-profiles")?.scrollIntoView({ behavior: "smooth" })}>
              profile guide
            </button>{" "}
            below.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Organisation details</strong> — logo, company name, brand colours, PDF footer lines.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>At least one project</strong> — site or job record (5-step wizard on Projects).
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>People</strong> — team members for briefings, RAMS, training, registers.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>First RAMS or permit</strong> — document work before it starts on site.
          </li>
          <li style={{ marginBottom: 10 }}>
            <strong>Team access</strong> — Settings → Invites / Members when your plan includes seats.
          </li>
        </ol>
        {SHOW_DEV_HINTS ? (
          <p style={{ ...ss.p, marginBottom: 0, fontSize: 12 }}>
            Deep links: <code style={{ fontSize: 11 }}>/app?view=permits</code>, <code style={{ fontSize: 11 }}>?settingsTab=billing</code>, etc.
          </p>
        ) : null}
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Settings centre
        </h2>
        <p style={ss.p}>
          <strong>More → Settings</strong>. Tabs:
        </p>
        <ul style={ss.ul}>
          {WORKSPACE_SETTINGS_TABS.filter((t) => t.id !== "developer" || SHOW_DEV_HINTS).map((t) => (
            <li key={t.id} style={ss.moduleLi}>
              <button type="button" style={ss.linkBtn} onClick={() => openWorkspaceSettings({ tab: t.id })}>
                {t.label}
              </button>
              {" — "}
              {t.id === "cloud" && "Sign in, switch organisation, link cloud account."}
              {t.id === "billing" && "Subscription plan, usage limits, Stripe checkout."}
              {t.id === "invites" && "Send email invites for colleagues to join."}
              {t.id === "members" && "Review roles: admin, supervisor, operative."}
              {t.id === "organisation" && "Branding, workspace profile, modules, PDF defaults."}
              {t.id === "automation" && "Gates for surveys, PTW, project links, and stale-draft reminders."}
              {t.id === "notifications" && "Browser reminders for expiring certs, permits, RAMS reviews."}
              {t.id === "developer" && "API keys and integration hooks (IT only)."}
            </li>
          ))}
        </ul>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          About this app
        </h2>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          Version <strong>{DISPLAY_APP_VERSION}</strong>.
          {SHOW_DEV_HINTS ? <> CI / monitoring: <code style={{ fontSize: 12 }}>.env.example</code>.</> : null}
        </p>
      </div>

      <div className="app-surface-card" style={ss.card} id="workspace-profiles">
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          {WORKSPACE_PROFILE_OVERVIEW.title}
        </h2>
        <p style={ss.p}>{WORKSPACE_PROFILE_OVERVIEW.lead}</p>

        <div className="app-help-profile-active">
          <p className="app-help-profile-active__label">Your active profile</p>
          <p className="app-help-profile-active__title">
            {profileSummary.label}
            {isIndustryPackPreviewActive() ? " · preview mode" : ""}
          </p>
          <p className="app-help-profile-active__tagline">{profileSummary.tagline}</p>
          <ul className="app-help-profile-meta">
            <li>Site pack: {profileSummary.sitePackTitle}</li>
            {profileSummary.ramsStarter ? <li>RAMS starter: {profileSummary.ramsStarter}</li> : null}
          </ul>
        </div>

        <p style={ss.p}>{profileSummary.summary}</p>
        <p style={{ ...ss.p, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Typical workflow for your profile</p>
        <ol style={ss.ol}>
          {profileSummary.steps.map((step) => (
            <li key={step} style={{ marginBottom: 6 }}>
              {step}
            </li>
          ))}
        </ol>

        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceSettings({ tab: "organisation" })}>
            Change profile
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "projects" })}>
            Open Project Hub
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "rams" })}>
            RAMS builder
          </button>
        </div>

        <h3 style={ss.h3}>What a profile changes</h3>
        <ul style={ss.ul}>
          {WORKSPACE_PROFILE_OVERVIEW.whatItDoes.map((line) => (
            <li key={line} style={ss.moduleLi}>
              {line}
            </li>
          ))}
        </ul>
        <p style={ss.note}>{WORKSPACE_PROFILE_OVERVIEW.whatItDoesNot}</p>

        <h3 style={ss.h3}>{WORKSPACE_PROFILE_OVERVIEW.previewTitle}</h3>
        <p style={{ ...ss.p, marginBottom: 8 }}>{WORKSPACE_PROFILE_OVERVIEW.previewBody}</p>

        <h3 style={ss.h3}>How to change profile</h3>
        <ol style={ss.ol}>
          {WORKSPACE_PROFILE_OVERVIEW.changeSteps.map((step) => (
            <li key={step} style={{ marginBottom: 6 }}>
              {step}
            </li>
          ))}
        </ol>

        <h3 style={ss.h3}>Profile catalogue</h3>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          Tap a profile to read who it is for, what it adjusts, and which RAMS starter it suggests. Your data is never deleted when you switch.
        </p>
        <ProfileGuideCatalogue activePackId={activePackId} />
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Project Hub &amp; readiness
        </h2>
        <p style={ss.p}>
          Each project has a <strong>Project Hub</strong> card driven by your workspace profile. The readiness ring scores CDM, RAMS, briefings, and profile-specific gates (e.g. PAT for electrical, survey QA for geodesy, allergen windows for food).
        </p>
        <ul style={ss.ul}>
          <li>
            <strong>Next action</strong> — one suggested step on the hub card (issue PTW, close snag, complete survey checklist, etc.).
          </li>
          <li>
            <strong>Playbooks</strong> — pre-built project templates in the new-project wizard; filtered by profile.
          </li>
          <li>
            <strong>Site pack PDF</strong> — export focused on your trade (contractor, electrical, survey, food, demolition, etc.).
          </li>
          <li>
            <strong>More command centre</strong> — industry-aware pulse on open registers relevant to your profile.
          </li>
        </ul>
        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceView({ viewId: "projects" })}>
            Projects
          </button>
        </div>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          New project wizard (5 steps)
        </h2>
        <p style={ss.p}>
          <strong>Projects → Add project</strong>
        </p>
        <ol style={{ ...ss.ol, listStyle: "decimal" }}>
          <li style={{ marginBottom: 8 }}><strong>Name &amp; client</strong></li>
          <li style={{ marginBottom: 8 }}><strong>Team &amp; industry</strong> — starter preset and site roles.</li>
          <li style={{ marginBottom: 8 }}>
            <strong>Location</strong> — postcode → <strong>Lookup coordinates</strong> → map; <strong>Weather + nearest A&amp;E</strong>; optional KML boundary and plan markup.
          </li>
          <li style={{ marginBottom: 8 }}><strong>Timeline &amp; risks</strong> — dates and start-date weather forecast.</li>
          <li style={{ marginBottom: 8 }}><strong>Permits &amp; go-live</strong> — required PTW types, health score, startup checklist.</li>
        </ol>
        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceView({ viewId: "projects" })}>
            Open wizard
          </button>
        </div>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Key workflows
        </h2>

        <h3 style={ss.h3First}>Permits</h3>
        <p style={ss.p}>
          List, board, and timeline views; live wall for the gate; conflict checks between permit types; evidence photos; handover between shifts.
          Upload a site plan under <strong>Project plan overlay &amp; safety map</strong> — click escape routes and emergency assets (same tools as Project drawings).
          <strong> Report incident</strong> on a permit card links to the incident register.
        </p>

        <h3 style={ss.h3}>RAMS</h3>
        <p style={ss.p}>
          Pick hazards from the library or add custom rows; link operatives and project; print branded PDFs; export JSON; import JSON with operative matching; optional evidence pack for audits.
          Your workspace profile suggests a <strong>hazard starter</strong> in Step 2 — electrical, refurb, groundworks, general, or PAS128 surveying packs — to pre-fill scope and filter the library. Surveying firms also get PAS128 pack dropdowns when the survey module is visible.
        </p>

        <h3 style={ss.h3}>Daily briefing → Site map</h3>
        <p style={ss.p}>
          Record who attended the briefing and which project they are on. Site map can <strong>Apply from today&apos;s briefing</strong> to show presence pins.
        </p>

        <h3 style={ss.h3}>Incidents</h3>
        <p style={ss.p}>
          Log in <strong>Incidents</strong> → track actions in <strong>Incident actions</strong> → view clusters on <strong>Incident map</strong> → use <strong>RIDDOR</strong> wizard for reportability decisions (you still submit to HSE where required).
        </p>

        <h3 style={ss.h3}>Survey report</h3>
        <p style={ss.p}>
          Structured survey / dilapidation reports: scope, weather, records review, findings, geo-photos, utility DXF import, plan snapshots, QA checklist, PDF export.
          Visible for <strong>Surveying &amp; geodesy</strong>, <strong>Contractor + surveying</strong>, and <strong>Show all modules</strong> profiles — hidden for pure contractor profiles to keep the menu focused.
        </p>

        <h3 style={ss.h3}>Geo-photos</h3>
        <p style={ss.p}>
          Capture or import photos with GPS coordinates — pull into survey reports or utility mapping workflows.
        </p>

        <h3 style={ss.h3}>HSE registers</h3>
        <p style={ss.p}>
          COSHH, ladders, MEWP, hot work, confined space, LOTO, scaffold, excavations, and the rest follow the same pattern: add rows, attach to projects where asked, export or print from each module.
        </p>

        <h3 style={ss.h3}>Food &amp; pharma (optional)</h3>
        <p style={ss.p}>
          High-care access, CIP sign-off, allergen changeovers, and GMP deviations — for hygiene-critical manufacturing sites.
        </p>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Roles &amp; permissions
        </h2>
        <ul style={ss.ul}>
          <li><strong>Admin</strong> — full access, backup import, billing, invites, organisation settings.</li>
          <li><strong>Supervisor</strong> — operational access; can read cloud audit log when enabled.</li>
          <li><strong>Operative</strong> — day-to-day registers and permits; no backup restore or admin settings.</li>
        </ul>
        <p style={ss.note}>Roles are set per organisation under Settings → Members.</p>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Backup, bin &amp; audit
        </h2>
        <ul style={ss.ul}>
          <li><strong>Backup</strong> — download JSON; replace or merge; optional cloud upload when signed in.</li>
          <li><strong>Bin</strong> — bottom bar; restore recently deleted register rows before they are purged.</li>
          <li><strong>Audit log</strong> — local history of changes; cloud copy for admins/supervisors when enabled.</li>
        </ul>
        <div style={ss.btnRow}>
          <button type="button" style={ss.btn} onClick={() => openWorkspaceView({ viewId: "backup" })}>
            Backup
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "bin" })}>
            Bin
          </button>
          <button type="button" style={ss.btnGhost} onClick={() => openWorkspaceView({ viewId: "audit" })}>
            Audit log
          </button>
        </div>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Client &amp; subcontractor portals
        </h2>
        <p style={ss.p}>
          <strong>Client portal</strong> — read-only compliance snapshot for a client (permits, RAMS status, open snags). Create tokens in that module.
          <strong> Subcontractor portal</strong> — scoped access for supply chain partners.
        </p>
        {SHOW_DEV_HINTS ? (
          <p style={{ ...ss.p, marginBottom: 0, fontSize: 12 }}>
            URL: <code style={{ fontSize: 11 }}>?portal=TOKEN</code> or <code style={{ fontSize: 11 }}>?subcontractor=TOKEN</code>
          </p>
        ) : null}
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Keyboard shortcuts
        </h2>
        <ul style={ss.ul}>
          <li><kbd style={ss.kbd}>Ctrl</kbd>+<kbd style={ss.kbd}>K</kbd> / <kbd style={ss.kbd}>Cmd</kbd>+<kbd style={ss.kbd}>K</kbd> — Search</li>
          <li><kbd style={ss.kbd}>/</kbd> — Search (when not in an input)</li>
          <li><kbd style={ss.kbd}>?</kbd> — Open Help</li>
        </ul>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          What&apos;s new
        </h2>
        <ul style={ss.ul}>
          <li><strong>Workspace profiles</strong> — nine trade presets; Project Hub, modules, RAMS starters, site pack PDFs.</li>
          <li><strong>Project wizard</strong> — postcode, weather, A&amp;E, KML, permit readiness score.</li>
          <li><strong>Plan markup</strong> — click escape routes on site drawings.</li>
          <li><strong>Survey report</strong> — professional report builder with plans and geo-photos.</li>
          <li><strong>Pinned &amp; recent</strong> modules in Search and More.</li>
        </ul>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Complete module index
        </h2>
        <p style={ss.p}>Synced with the More menu. Click a name to open that screen.</p>

        <h3 style={ss.h3First}>Bottom navigation</h3>
        <ModuleIndexList tabs={bottomNavTabs} />

        {MORE_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginTop: 16 }}>
            <h3 style={ss.h3}>{section.title}</h3>
            <ModuleIndexList tabs={getMoreTabsForSection(section)} />
          </div>
        ))}

        {SHOW_DEV_HINTS ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={ss.h3}>AI tools (when configured)</h3>
            <ModuleIndexList
              tabs={[
                { id: "ai-rams", label: "AI RAMS generator" },
                { id: "ai-toolbox", label: "AI toolbox talk" },
                { id: "ai-photo", label: "AI photo hazard" },
              ]}
            />
          </div>
        ) : null}
      </div>

      {SHOW_DEV_HINTS ? (
        <>
          <div className="app-surface-card" style={ss.card}>
            <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
              Production hardening (Vercel)
            </h2>
            <p style={{ ...ss.p, marginBottom: 0 }}>
              CSP and cache in <code style={{ fontSize: 12 }}>vercel.json</code>; Anthropic proxy at <code style={{ fontSize: 12 }}>/api/anthropic-messages</code>; see <code style={{ fontSize: 12 }}>.env.example</code>.
            </p>
          </div>
          <div className="app-surface-card" style={ss.card}>
            <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
              Developer setup
            </h2>
            <p style={{ ...ss.p, marginBottom: 0 }}>
              README.md, <code style={{ fontSize: 12 }}>.env.local</code>, DOCS/architecture-current.md, DOCS/PRODUCT_SCOPE.md.
            </p>
          </div>
        </>
      ) : null}

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Help &amp; contact
        </h2>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={ss.a}>
            {SUPPORT_EMAIL}
          </a>
          {" · "}
          <Link to="/privacy" style={ss.a}>
            Privacy policy
          </Link>
          {" · "}
          <Link to="/docs" style={ss.a}>
            Docs hub
          </Link>
          {" · "}
          <Link to="/" style={ss.a}>
            Home page
          </Link>
        </p>
      </div>

      <div className="app-surface-card" style={ss.card}>
        <h2 className="app-section-label" style={{ ...ss.h2, textTransform: "none", letterSpacing: "normal" }}>
          Disclaimer
        </h2>
        <p style={{ ...ss.p, marginBottom: 0 }}>
          Record-keeping support only — not legal advice. Verify RIDDOR, CDM, and site-specific requirements with competent persons and official guidance.
        </p>
      </div>
    </div>
  );
}
