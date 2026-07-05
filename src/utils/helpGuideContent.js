/** User-facing Help copy — UK English, plain language. */

export const HELP_TOC = [
  { id: "start-here", label: "Start here — how the app is laid out" },
  { id: "first-week", label: "Your first week" },
  { id: "settings-guide", label: "Settings — what each tab does" },
  { id: "billing-trial", label: "Trial, billing & limits" },
  { id: "glossary", label: "Glossary (RAMS, PTW, CDM…)" },
  { id: "faq", label: "Common questions" },
  { id: "workspace-profiles", label: "Workspace profiles" },
  { id: "project-hub", label: "Project Hub & readiness" },
  { id: "workflows", label: "Key workflows" },
  { id: "roles", label: "Roles & permissions" },
  { id: "backup-audit", label: "Backup, bin & audit" },
  { id: "portals", label: "Client & subcontractor portals" },
  { id: "module-index", label: "Complete module index" },
];

export const APP_LAYOUT = {
  title: "How the workspace is organised",
  lead: "Think of MySafeOps in four layers — you rarely need every module on day one.",
  layers: [
    {
      name: "Bottom bar",
      body: "Dashboard, Projects, Permits, RAMS, People, More. Pin a favourite module to the sixth slot (long-press a tile in More).",
    },
    {
      name: "More menu",
      body: "Every register and tool (COSHH, inspections, survey report, backup…). Use Search (Ctrl+K) if you know the name.",
    },
    {
      name: "Settings",
      body: "Organisation-wide: branding, profile, billing, invites, automation, notifications. Not tied to one project.",
    },
    {
      name: "Project Hub",
      body: "Open any project card → readiness ring, next action, playbooks, and trade-specific checklist for that site.",
    },
  ],
};

export const FIRST_WEEK_STEPS = [
  {
    title: "Sign in & cloud account",
    body: "More → Settings → Cloud account. Link your organisation so backups, invites, and billing work across devices.",
  },
  {
    title: "Pick workspace profile",
    body: "Settings → Organisation → Workspace profile. This tunes which modules appear and which RAMS starter you get (contractor, electrical, survey, food, etc.).",
  },
  {
    title: "Company branding",
    body: "Same tab: logo, colours, PDF footer — exports look like your firm, not a generic template.",
  },
  {
    title: "Create a project",
    body: "Projects → Add project. Five-step wizard: client, location (postcode + map), timeline, permit types.",
  },
  {
    title: "Add people",
    body: "People → add team members. Needed for RAMS sign-off, training matrix, briefings, and permits.",
  },
  {
    title: "First RAMS or permit",
    body: "RAMS or Permits from the bottom bar. Link to the project, review hazards, issue before work starts.",
  },
  {
    title: "Invite colleagues",
    body: "Settings → Invites (admin). Supervisors run day-to-day; admins handle billing and organisation.",
  },
];

export const SETTINGS_TAB_HELP = {
  cloud: "Sign in with email, switch organisation, link Supabase cloud sync and MFA.",
  billing: "Current plan, worker/project/storage usage, Subscribe (Stripe), billing portal, and plan comparison table.",
  invites: "Email invites for new users — they join your organisation workspace.",
  members: "Change roles: admin (full control), supervisor (operations), operative (registers & permits).",
  organisation:
    "Logo, company details, workspace profile, industry sectors (food/pharma packs), module visibility, PDF defaults, custom fields.",
  automation:
    "Rules that nudge completeness — survey QA gates, PTW conflict checks, stale RAMS reminders, presets like Survey firm.",
  notifications: "Browser reminders for expiring certs, permits, RAMS review dates (enable when prompted).",
  developer: "Integration hooks and API notes for IT — not needed for normal site use.",
};

export const BILLING_TRIAL_GUIDE = {
  title: "Trial, billing & limits",
  points: [
    "New organisations get a 14-day evaluation with full modules. Admins may request one +14 day extension in Billing.",
    "After trial without a paid plan, the workspace can become read-only for creating/editing records — you can still view, export, and change organisation settings.",
    "Plans are flat monthly prices per organisation (Solo, Team, Business, Enterprise) — not per worker seat. Limits are on workers, projects, and cloud storage.",
    "Yellow banners show trial days left; orange banners warn when you are near worker/project caps (80%+).",
    "Only organisation admins can subscribe or open the Stripe billing portal.",
    "Published list prices may be reviewed once a year (up to 10% at renewal, with notice). See Terms §7.5.",
  ],
};

export const GLOSSARY = [
  { term: "RAMS", def: "Risk Assessment and Method Statement — describes hazards, controls, and how work will be done safely." },
  { term: "PTW / Permit", def: "Permit to Work — formal authorisation for high-risk tasks (hot work, confined space, lifting, etc.)." },
  { term: "CDM", def: "Construction (Design and Management) Regulations 2015 — roles, F10 notification, and H&S file duties on notifiable projects." },
  { term: "F10", def: "HSE notification for notifiable construction projects — the app can flag criteria; you must submit officially." },
  { term: "H&S file", def: "Health and safety information passed to the client — CDM module helps assemble inventory; you remain responsible for content." },
  { term: "RIDDOR", def: "Reporting of Injuries, Diseases and Dangerous Occurrences — wizard helps decision-making; HSE submission is your duty." },
  { term: "COSHH", def: "Control of Substances Hazardous to Health — substance register and assessments." },
  { term: "LOTO", def: "Lock-out tag-out — isolation before maintenance on plant or electrical systems." },
  { term: "SIMOPS", def: "Simultaneous operations — permits checked against each other for clashes on the same site." },
  { term: "Workspace profile", def: "Trade preset (e.g. general contractor, surveying) — changes visible modules and RAMS starters." },
  { term: "Industry sectors", def: "Optional ticks (construction, food, pharma…) — unlock sector banners and packs; separate from workspace profile." },
  { term: "Project Hub", def: "Per-project dashboard card with readiness score and suggested next step." },
  { term: "Competent review", def: "Checkbox or confirm step before issuing RAMS or activating permits — records that a competent person reviewed." },
];

export const HELP_FAQ = [
  {
    q: "Where do I change company logo and PDF footer?",
    a: "More → Settings → Organisation → Branding & PDF. Changes apply to new exports.",
  },
  {
    q: "Why can't I edit RAMS / permits / projects?",
    a: "Trial may have ended without subscription, or your role is read-only. Admins: Settings → Billing to subscribe. Organisation settings stay editable.",
  },
  {
    q: "What's the difference between workspace profile and industry sectors?",
    a: "Profile = which modules and starters you see day to day. Sectors = optional packs (e.g. pharma hygiene registers) and banners — tick only what you actually work in.",
  },
  {
    q: "How do I hide modules we don't use?",
    a: "Settings → Organisation → Module visibility. Hidden modules disappear from More; you can restore them anytime.",
  },
  {
    q: "How do permits link to drawings?",
    a: "Upload plans under Drawings or Permits → plan overlay. Mark zones, escape routes, and assets; permits can reference the same project map.",
  },
  {
    q: "Can I work offline?",
    a: "Many screens work offline in the browser; sync when back online if cloud is configured. Export backups regularly for critical sites.",
  },
  {
    q: "Who can see billing and invites?",
    a: "Organisation admins only. Supervisors and operatives use operational modules.",
  },
  {
    q: "Is this legal or HSE advice?",
    a: "No — record-keeping software only. You must verify compliance with competent advisers and official guidance.",
  },
];

/** Extra module blurbs not in the main map (keep in sync with appModules). */
export const MODULE_BLURBS_EXTRA = {
  "project-drawings": "Upload site plans; mark escape routes, zones, and emergency assets for permits and briefings.",
  "ghp-register": "Glass and hard plastic register — breakage and inspection log (food/pharma).",
  "dynamic-ra": "Dynamic risk assessments for changing site conditions.",
  legislation: "Track applicable legislation and review dates for your organisation.",
  "hygiene-setup": "Food & pharma onboarding wizard — hygiene zones and starter registers.",
  "construction-setup": "Construction onboarding wizard — CDM-oriented starter checklist.",
  "site-map": "Legacy label — use Drawings and Project Hub map tools.",
};
