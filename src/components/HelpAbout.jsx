import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Command,
  DatabaseBackup,
  FileText,
  HardHat,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MapPinned,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { getSupportEmail } from "../config/supportContact";
import { WORKSPACE_SETTINGS_TABS } from "../config/workspaceSettingsTabs";
import { showAdminLoginHints } from "../lib/showAdminLoginHints";
import { getDisplayAppVersion } from "../utils/appBuildInfo";
import {
  APP_LAYOUT,
  BILLING_TRIAL_GUIDE,
  FIRST_WEEK_STEPS,
  GLOSSARY,
  GUIDED_HELP_TASKS,
  HELP_FAQ,
  MODULE_BLURBS_EXTRA,
  SETTINGS_TAB_HELP,
} from "../utils/helpGuideContent";
import { getAppliedIndustryPackId } from "../utils/orgIndustryPacks";
import { isIndustryPackPreviewActive } from "../utils/industryPackPreview";
import { getOrgMarketId } from "../utils/orgMarket";
import { getRamsShortLabel } from "../utils/marketLabels";
import {
  getActiveProfileGuideSummary,
  listProfileGuideCatalogue,
} from "../utils/workspaceProfileGuide";
import { MORE_SECTIONS, getMoreTabsForSection, NAV_TAB_IDS } from "../navigation/appModules";
import { openWorkspaceSettings, openWorkspaceView } from "../utils/workspaceNavContext";
import "../styles/help-centre.css";

const SUPPORT_EMAIL = getSupportEmail();
const DISPLAY_APP_VERSION = getDisplayAppVersion();
const SHOW_DEV_HINTS = showAdminLoginHints();

const GUIDE_ICONS = {
  building: Building2,
  shield: ShieldCheck,
  clipboard: ClipboardCheck,
  users: Users,
  "hard-hat": HardHat,
  map: MapPinned,
  chart: BarChart3,
  mail: Mail,
  database: DatabaseBackup,
};

const MODULE_BLURBS = {
  dashboard: "See today’s risks, readiness, KPIs and next actions.",
  projects: "Create jobs and use Project Hub to prepare every site.",
  people: "Manage people, roles, competencies and expiry dates.",
  permits: "Issue, monitor, hand over and close permits to work.",
  rams: "Build, review, issue and export RAMS documents.",
  bin: "Restore recently deleted register records.",
  "management-overview": "Private 90-day planning, capacity and management actions.",
  "project-drawings": "Upload plans and mark work zones, routes and emergency assets.",
  "daily-briefing": "Record daily hazards, controls and attendance.",
  induction: "Create and record site inductions and sign-on.",
  signatures: "Collect digital signatures for controlled documents.",
  timesheets: "Record worker hours against projects.",
  snags: "Track defects, photos, owners and close-out.",
  "geo-photos": "Capture GPS-tagged photos for site and survey evidence.",
  coshh: "Maintain substances and COSHH assessments.",
  inspections: "Schedule and complete site inspections.",
  incidents: "Record incidents and near misses with evidence.",
  "incident-actions": "Assign and close corrective actions.",
  riddor: "Support RIDDOR decisions and retain the record.",
  emergency: "Maintain project emergency contacts and arrangements.",
  ppe: "Record PPE issue, checks and replacement.",
  plant: "Track plant, equipment and inspection dates.",
  fire: "Record fire checks, drills and equipment.",
  training: "See competency and training gaps across the team.",
  visitors: "Maintain the visitor sign-in record.",
  "toolbox-reg": "Record toolbox talks and attendance.",
  "first-aid": "Track first aiders, kits and checks.",
  observations: "Capture safety observations and close-out.",
  ladders: "Maintain the ladder inspection register.",
  mewp: "Record MEWP inspections and use.",
  asbestos: "Maintain asbestos information and survey references.",
  "confined-space": "Manage confined-space entry records.",
  loto: "Record isolations and lock-out tag-out controls.",
  lifting: "Manage lifting plans and equipment records.",
  excavation: "Track excavation controls and permits to dig.",
  "temp-works": "Manage temporary works designs and checks.",
  analytics: "Review compliance trends and module performance.",
  "monthly-report": "Build a monthly H&S management summary.",
  "survey-report": "Create professional survey reports and PDFs.",
  "gpr-report": "Create detailed GPR reports and anomaly records.",
  templates: "Maintain reusable document templates.",
  "client-portal": "Create read-only client compliance views.",
  subcontractor: "Create scoped access for supply-chain partners.",
  documents: "Browse local files and optional cloud uploads.",
  backup: "Export, import and protect workspace data.",
  audit: "Review who changed what and when.",
  settings: "Manage organisation, users, billing and preferences.",
  help: "Step-by-step guidance for MySafeOps.",
  ...MODULE_BLURBS_EXTRA,
};

const START_ACTIONS = [
  { icon: Settings2, title: "Set up the organisation", detail: "Profile, branding and modules", action: () => openWorkspaceSettings({ tab: "organisation" }) },
  { icon: Building2, title: "Create a project", detail: "Client, site, dates and team", action: () => openWorkspaceView({ viewId: "projects" }) },
  { icon: ShieldCheck, title: "Prepare RAMS", detail: "Hazards, controls and review", action: () => openWorkspaceView({ viewId: "rams" }) },
  { icon: ClipboardCheck, title: "Issue a permit", detail: "Authorise high-risk work", action: () => openWorkspaceView({ viewId: "permits" }) },
];

const HELP_NAV = [
  ["help-start", "Start here"],
  ["help-guides", "Guided tasks"],
  ["help-first-week", "First week"],
  ["help-workspace", "Your workspace"],
  ["help-settings", "Settings"],
  ["help-questions", "Questions"],
  ["help-modules", "Module finder"],
];

function openTarget(target) {
  if (target?.settingsTab) openWorkspaceSettings({ tab: target.settingsTab });
  else if (target?.viewId) openWorkspaceView({ viewId: target.viewId });
}

function ProfileCatalogue({ activePackId }) {
  const [openId, setOpenId] = useState(activePackId || null);
  const catalogue = listProfileGuideCatalogue(getOrgMarketId());

  return (
    <div className="help-profile-catalogue">
      {catalogue.map((entry) => {
        const active = entry.id === activePackId;
        const open = entry.id === openId;
        return (
          <article key={entry.id} className={`help-profile-card${active ? " is-active" : ""}`}>
            <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : entry.id)}>
              <span><strong>{entry.label}</strong><small>{entry.hint}</small></span>
              {active ? <em>Your profile</em> : null}
              <ChevronRight size={16} />
            </button>
            {open ? (
              <div>
                <p>{entry.tagline}</p>
                <p><strong>Best for:</strong> {entry.whoFor}</p>
                <ul>{entry.adjusts.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function GuideCard({ guide, selected, onSelect }) {
  const Icon = GUIDE_ICONS[guide.icon] || BookOpen;
  return (
    <button type="button" className={`help-guide-card${selected ? " is-selected" : ""}`} onClick={onSelect}>
      <span className="help-guide-card__icon"><Icon size={19} /></span>
      <span className="help-guide-card__copy">
        <small>{guide.category}</small>
        <strong>{guide.title}</strong>
        <span>{guide.summary}</span>
        <em><Clock3 size={12} />{guide.time}<i />{guide.roles}</em>
      </span>
      <ChevronRight className="help-guide-card__arrow" size={17} />
    </button>
  );
}

export default function HelpAbout() {
  const [query, setQuery] = useState("");
  const [selectedGuideId, setSelectedGuideId] = useState(GUIDED_HELP_TASKS[0].id);
  const [completedSteps, setCompletedSteps] = useState(() => new Set());
  const [showAllModules, setShowAllModules] = useState(false);
  const marketId = getOrgMarketId();
  const ramsLabel = getRamsShortLabel(marketId);
  const activePackId = getAppliedIndustryPackId() || "generalContractor";
  const profileSummary = getActiveProfileGuideSummary(marketId);
  const selectedGuide = GUIDED_HELP_TASKS.find((guide) => guide.id === selectedGuideId) || GUIDED_HELP_TASKS[0];
  const normalisedQuery = query.trim().toLowerCase();

  const moduleItems = useMemo(() => {
    const items = new Map();
    NAV_TAB_IDS.filter((item) => item.id !== "more").forEach((item) => items.set(item.id, item));
    MORE_SECTIONS.forEach((section) => getMoreTabsForSection(section).forEach((item) => items.set(item.id, item)));
    return [...items.values()];
  }, []);

  const visibleGuides = GUIDED_HELP_TASKS.filter((guide) => {
    if (!normalisedQuery) return true;
    return `${guide.title} ${guide.summary} ${guide.category} ${guide.roles} ${guide.steps.map((step) => `${step.title} ${step.body}`).join(" ")}`.toLowerCase().includes(normalisedQuery);
  });
  const matchingFaq = normalisedQuery
    ? HELP_FAQ.filter((item) => `${item.q} ${item.a}`.toLowerCase().includes(normalisedQuery))
    : [];
  const matchingModules = moduleItems.filter((item) => {
    if (!normalisedQuery) return true;
    return `${item.label} ${MODULE_BLURBS[item.id] || ""}`.toLowerCase().includes(normalisedQuery);
  });
  const guideCompleted = selectedGuide.steps.filter((_, index) => completedSteps.has(`${selectedGuide.id}:${index}`)).length;

  const selectGuide = (guideId) => {
    setSelectedGuideId(guideId);
    window.requestAnimationFrame(() => document.getElementById("help-guide-viewer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const toggleStep = (index) => {
    const key = `${selectedGuide.id}:${index}`;
    setCompletedSteps((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="help-centre">
      <section className="help-hero" id="help-start">
        <div className="help-hero__glow help-hero__glow--one" />
        <div className="help-hero__glow help-hero__glow--two" />
        <div className="help-hero__content">
          <span className="help-eyebrow"><Sparkles size={13} /> MySafeOps guide</span>
          <h1>What do you need to do?</h1>
          <p>Choose a task and follow the steps. Every guide uses plain UK English and opens the right place in MySafeOps.</p>
          <label className="help-search">
            <Search size={20} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search: create RAMS, invite someone, export PDF…" aria-label="Search help" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear help search"><X size={16} /></button> : <kbd>?</kbd>}
          </label>
          <div className="help-hero__promises">
            <span><CheckCircle2 size={14} />Step by step</span>
            <span><Command size={14} />Direct links</span>
            <span><ShieldCheck size={14} />Role-aware guidance</span>
          </div>
        </div>
        <div className="help-hero__visual" aria-hidden>
          <div className="help-orbit help-orbit--one"><span>1</span><strong>Choose</strong></div>
          <div className="help-orbit help-orbit--two"><span>2</span><strong>Follow</strong></div>
          <div className="help-orbit help-orbit--three"><span>3</span><strong>Complete</strong></div>
          <div className="help-orbit__core"><BookOpen size={27} /><small>Clear guidance</small></div>
        </div>
      </section>

      <div className="help-layout">
        <aside className="help-side-nav" aria-label="Help sections">
          <span>Guide contents</span>
          {HELP_NAV.map(([id, label], index) => <a key={id} href={`#${id}`}><b>{String(index + 1).padStart(2, "0")}</b>{label}</a>)}
          <div className="help-side-nav__support"><LifeBuoy size={18} /><strong>Still stuck?</strong><a href={`mailto:${SUPPORT_EMAIL}`}>Email support</a></div>
        </aside>

        <main className="help-main">
          {normalisedQuery ? (
            <section className="help-search-summary" aria-live="polite">
              <div><span className="help-section-kicker">Search results</span><h2>Results for “{query.trim()}”</h2></div>
              <span>{visibleGuides.length + matchingFaq.length + matchingModules.length} matches</span>
              {!visibleGuides.length && !matchingFaq.length && !matchingModules.length ? (
                <div className="help-no-results"><CircleHelp size={24} /><strong>No exact match</strong><p>Try a module name such as “RAMS”, “Permits”, “People” or “Backup”.</p></div>
              ) : null}
              {matchingFaq.map((item) => <article key={item.q} className="help-search-answer"><strong>{item.q}</strong><p>{item.a}</p></article>)}
              {matchingModules.length ? <div className="help-search-links">{matchingModules.slice(0, 6).map((item) => <button type="button" key={item.id} onClick={() => openWorkspaceView({ viewId: item.id })}><FileText size={14} /><span><strong>{item.label}</strong><small>{MODULE_BLURBS[item.id] || "Open this MySafeOps module."}</small></span><ArrowRight size={13} /></button>)}</div> : null}
            </section>
          ) : null}

          <section className="help-section help-quick-start">
            <div className="help-section__head"><div><span className="help-section-kicker">Quick start</span><h2>Go straight to the job</h2><p>The four most common starting points.</p></div></div>
            <div className="help-start-grid">
              {START_ACTIONS.map(({ icon: Icon, title, detail, action }) => (
                <button type="button" key={title} onClick={action}><span><Icon size={19} /></span><strong>{title}</strong><small>{detail}</small><ArrowRight size={15} /></button>
              ))}
            </div>
          </section>

          <section className="help-section" id="help-guides">
            <div className="help-section__head"><div><span className="help-section-kicker">Guided tasks</span><h2>Choose what you want to achieve</h2><p>Select a guide to see exactly what to do and in which order.</p></div><span className="help-count">{visibleGuides.length} guides</span></div>
            <div className="help-guide-grid">
              {visibleGuides.map((guide) => <GuideCard key={guide.id} guide={guide} selected={guide.id === selectedGuide.id} onSelect={() => selectGuide(guide.id)} />)}
            </div>
          </section>

          <section className="help-guide-viewer" id="help-guide-viewer" aria-labelledby="help-guide-title">
            <header>
              <div>
                <span className="help-section-kicker">Step-by-step guide · {selectedGuide.time}</span>
                <h2 id="help-guide-title">{selectedGuide.title}</h2>
                <p>{selectedGuide.summary}</p>
              </div>
              <span className="help-guide-viewer__role">{selectedGuide.roles}</span>
            </header>
            <div className="help-guide-progress"><span style={{ width: `${(guideCompleted / selectedGuide.steps.length) * 100}%` }} /><small>{guideCompleted} of {selectedGuide.steps.length} checked</small></div>
            <ol className="help-steps">
              {selectedGuide.steps.map((step, index) => {
                const complete = completedSteps.has(`${selectedGuide.id}:${index}`);
                return (
                  <li key={step.title} className={complete ? "is-complete" : ""}>
                    <button type="button" onClick={() => toggleStep(index)} aria-label={`${complete ? "Mark incomplete" : "Mark complete"}: ${step.title}`}><span>{complete ? <Check size={16} /> : index + 1}</span></button>
                    <div><strong>{step.title}</strong><p>{step.body}</p></div>
                  </li>
                );
              })}
            </ol>
            <footer><span><ShieldCheck size={15} />MySafeOps supports the record; competent people remain responsible for site decisions.</span><button type="button" onClick={() => openTarget(selectedGuide.target)}>{selectedGuide.target.label}<ArrowRight size={15} /></button></footer>
          </section>

          <section className="help-section" id="help-first-week">
            <div className="help-section__head"><div><span className="help-section-kicker">Recommended order</span><h2>Your first week with MySafeOps</h2><p>Complete these once to create a useful, controlled workspace.</p></div></div>
            <div className="help-week-path">
              {FIRST_WEEK_STEPS.map((step, index) => <article key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.body}</p></div></article>)}
            </div>
          </section>

          <section className="help-section" id="help-workspace">
            <div className="help-section__head"><div><span className="help-section-kicker">Your workspace</span><h2>{profileSummary.label}{isIndustryPackPreviewActive() ? " · preview" : ""}</h2><p>{profileSummary.tagline}</p></div><button type="button" className="help-secondary-btn" onClick={() => openWorkspaceSettings({ tab: "organisation" })}>Change profile<Settings2 size={14} /></button></div>
            <div className="help-workspace-card">
              <div className="help-workspace-card__summary"><span><LayoutGrid size={20} /></span><div><small>Active workflow</small><strong>{profileSummary.sitePackTitle}</strong><p>{profileSummary.summary}</p></div></div>
              <ol>{profileSummary.steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
              <div className="help-workspace-card__actions"><button type="button" onClick={() => openWorkspaceView({ viewId: "projects" })}>Open Project Hub</button><button type="button" onClick={() => openWorkspaceView({ viewId: "rams" })}>Open {ramsLabel}</button></div>
            </div>
            <details className="help-profile-details"><summary>Compare all workspace profiles<ChevronRight size={15} /></summary><ProfileCatalogue activePackId={activePackId} /></details>
            <div className="help-app-map">
              <div><span className="help-section-kicker">How the app fits together</span><h3>{APP_LAYOUT.title}</h3><p>{APP_LAYOUT.lead}</p></div>
              <ol>{APP_LAYOUT.layers.map((layer, index) => <li key={layer.name}><span>{index + 1}</span><div><strong>{layer.name}</strong><p>{layer.body}</p></div></li>)}</ol>
            </div>
          </section>

          <section className="help-section" id="help-settings">
            <div className="help-section__head"><div><span className="help-section-kicker">Settings explained</span><h2>What each settings area controls</h2><p>Settings affect the organisation, not just one project.</p></div></div>
            <div className="help-settings-grid">
              {WORKSPACE_SETTINGS_TABS.filter((tab) => SETTINGS_TAB_HELP[tab.id] && (tab.id !== "developer" || SHOW_DEV_HINTS)).map((tab) => <button type="button" key={tab.id} onClick={() => openWorkspaceSettings({ tab: tab.id })}><span><Settings2 size={16} /></span><strong>{tab.label}</strong><p>{SETTINGS_TAB_HELP[tab.id]}</p><ArrowRight size={14} /></button>)}
            </div>
            <details className="help-info-details"><summary>{BILLING_TRIAL_GUIDE.title}<ChevronRight size={15} /></summary><ul>{BILLING_TRIAL_GUIDE.points.map((point) => <li key={point}>{point}</li>)}</ul><button type="button" onClick={() => openWorkspaceSettings({ tab: "billing" })}>Open Billing</button></details>
          </section>

          <section className="help-section" id="help-questions">
            <div className="help-section__head"><div><span className="help-section-kicker">Troubleshooting</span><h2>Common questions</h2><p>Short answers to the issues people hit most often.</p></div></div>
            <div className="help-faq-list">
              {HELP_FAQ.map((item, index) => <details key={item.q} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span>{item.q}<ChevronRight size={16} /></summary><p>{item.a}</p></details>)}
            </div>
            <details className="help-info-details"><summary>Plain-English glossary<ChevronRight size={15} /></summary><dl className="help-glossary">{GLOSSARY.map((entry) => <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.def}</dd></div>)}</dl></details>
          </section>

          <section className="help-section" id="help-modules">
            <div className="help-section__head"><div><span className="help-section-kicker">Module finder</span><h2>Every tool, explained</h2><p>Use the search above or select a module to open it.</p></div><span className="help-count">{matchingModules.length} modules</span></div>
            <div className="help-module-grid">
              {matchingModules.slice(0, showAllModules || normalisedQuery ? matchingModules.length : 18).map((item) => <button type="button" key={item.id} onClick={() => openWorkspaceView({ viewId: item.id })}><span><FileText size={15} /></span><div><strong>{item.label}</strong><small>{MODULE_BLURBS[item.id] || "Open this MySafeOps module."}</small></div><ChevronRight size={14} /></button>)}
            </div>
            {!normalisedQuery && matchingModules.length > 18 ? <button type="button" className="help-show-all" onClick={() => setShowAllModules((value) => !value)}>{showAllModules ? "Show fewer modules" : `Show all ${matchingModules.length} modules`}<ChevronRight size={14} /></button> : null}
          </section>

          <section className="help-contact">
            <div><span><LifeBuoy size={21} /></span><div><small>Need a human?</small><h2>We’ll help you find the right workflow.</h2><p>Include the module name, project and what you expected to happen. Never email passwords or API keys.</p></div></div>
            <a href={`mailto:${SUPPORT_EMAIL}`}>Email {SUPPORT_EMAIL}<Mail size={15} /></a>
          </section>

          <footer className="help-footer">
            <span>MySafeOps {DISPLAY_APP_VERSION}</span>
            <Link to="/docs">Docs hub</Link><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link>
            <p>Record-keeping support only — not legal, HSE, engineering or insurance advice. Verify site-specific requirements with competent advisers and official guidance.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
