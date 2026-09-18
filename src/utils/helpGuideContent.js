/** User-facing Help copy — UK English, plain language. */

export const GUIDED_HELP_TASKS = [
  {
    id: "new-project",
    category: "Set up",
    icon: "building",
    title: "Create and prepare a project",
    summary: "Add the client, site, dates and team, then use Project Hub to see what is still missing.",
    time: "3–5 min",
    roles: "Admin · Supervisor",
    target: { viewId: "projects", label: "Open Projects" },
    steps: [
      { title: "Open Projects", body: "Select Add project. Start with a clear job name and client so every record can be linked correctly." },
      { title: "Add the site", body: "Enter the address or postcode, project dates and the work type. Accurate dates feed the planner and management overview." },
      { title: "Assign the team", body: "Choose the people responsible for the work and select the permit types that may be required." },
      { title: "Check Project Hub", body: "Save the project and open its Hub. Follow the highlighted next action until the readiness ring is complete." },
    ],
  },
  {
    id: "first-rams",
    category: "Prepare work",
    icon: "shield",
    title: "Build and issue RAMS",
    summary: "Start from a Quick pack, adapt the controls, complete competent review and export the final document.",
    time: "5–10 min",
    roles: "Admin · Supervisor",
    target: { viewId: "rams", label: "Open RAMS" },
    steps: [
      { title: "Start a RAMS record", body: "Open RAMS, select Start new and choose the closest Quick pack for the planned work." },
      { title: "Link the job", body: "Select the project, work location, responsible people and planned dates." },
      { title: "Review hazards and controls", body: "Remove anything irrelevant and add site-specific hazards, controls, PPE and permits." },
      { title: "Review and issue", body: "Complete competent review, preview the PDF, then issue and brief the workforce before work starts." },
    ],
  },
  {
    id: "issue-permit",
    category: "Prepare work",
    icon: "clipboard",
    title: "Issue and close a permit",
    summary: "Create a permit with the correct scope, people, timing and evidence, then manage it through to close-out.",
    time: "4–8 min",
    roles: "Supervisor · Authorised person",
    target: { viewId: "permits", label: "Open Permits" },
    steps: [
      { title: "Choose the permit type", body: "Open Permits and select the permit that matches the high-risk activity." },
      { title: "Define the safe scope", body: "Link the project and RAMS, then record the exact work area, task, issuer, receiver and validity window." },
      { title: "Resolve readiness checks", body: "Complete isolations, controls, evidence and any SIMOPS conflicts shown by MySafeOps." },
      { title: "Activate, monitor and close", body: "Authorise before work begins. At completion, confirm the area is safe and record close-out evidence." },
    ],
  },
  {
    id: "add-people",
    category: "Set up",
    icon: "users",
    title: "Add people and competencies",
    summary: "Create team records, add certificates and make expiry gaps visible before allocation to work.",
    time: "3 min",
    roles: "Admin · Supervisor",
    target: { viewId: "people", label: "Open People" },
    steps: [
      { title: "Add a person", body: "Open People and add their name, role and contact details." },
      { title: "Record competencies", body: "Add cards, training and certificates with accurate issue and expiry dates." },
      { title: "Check gaps", body: "Use the training and expiry views before assigning the person to a project or permit." },
    ],
  },
  {
    id: "daily-site",
    category: "Run the site",
    icon: "hard-hat",
    title: "Run the daily site briefing",
    summary: "Record today’s hazards, work areas and attendance so the live site picture stays current.",
    time: "3–5 min",
    roles: "Supervisor · Operative",
    target: { viewId: "daily-briefing", label: "Open Daily Briefing" },
    steps: [
      { title: "Select the project and shift", body: "Open Daily Briefing and confirm the site, date and person leading the briefing." },
      { title: "Record today’s controls", body: "Add planned work, changing conditions, interfaces, weather and emergency information." },
      { title: "Confirm attendance", body: "Record everyone briefed and collect acknowledgement or signatures where required." },
      { title: "Use the live record", body: "Export the briefing when needed and apply attendance to the Site map presence view." },
    ],
  },
  {
    id: "survey-report",
    category: "Report",
    icon: "map",
    title: "Create a survey report",
    summary: "Build a structured survey deliverable with findings, plans, geo-evidence and a client-ready PDF.",
    time: "10–20 min",
    roles: "Surveyor · Reviewer",
    target: { viewId: "survey-report", label: "Open Survey Reports" },
    steps: [
      { title: "Create the report", body: "Select New report, link the project and choose the survey type or relevant preset." },
      { title: "Complete scope and methodology", body: "Record survey limits, equipment, standards, conditions and site-specific limitations." },
      { title: "Add findings and evidence", body: "Add utilities, anomalies, plans and geo-photos. Use Smart fill only as a draft aid and verify every result." },
      { title: "Run QA and export", body: "Resolve the completeness checks, preview every PDF page, then mark the revision final." },
    ],
  },
  {
    id: "management-review",
    category: "Manage",
    icon: "chart",
    title: "Run a management review",
    summary: "Review the 90-day programme, readiness, capacity and actions, then export the Board Pack.",
    time: "10 min",
    roles: "Admin · Management only",
    target: { viewId: "management-overview", label: "Open Management Overview" },
    steps: [
      { title: "Check the priority queue", body: "Start with jobs requiring attention and open each record to resolve missing dates, team or documents." },
      { title: "Review the programme", body: "Use the 90-day planner and capacity view to identify overload, gaps and suitable pipeline work." },
      { title: "Record decisions", body: "Open Meeting mode, assign each action to an owner and add a realistic due date." },
      { title: "Share the controlled record", body: "Export the Management Board Pack and retain it with the meeting record." },
    ],
  },
  {
    id: "invite-team",
    category: "Set up",
    icon: "mail",
    title: "Invite colleagues and set roles",
    summary: "Invite users into the correct organisation and give them only the access they need.",
    time: "2 min",
    roles: "Admin",
    target: { settingsTab: "invites", label: "Open Invites" },
    steps: [
      { title: "Open Invites", body: "Go to Settings, select Invites and enter the colleague’s work email." },
      { title: "Choose the correct role", body: "Admin manages the organisation; Supervisor runs operations; Operative uses day-to-day records." },
      { title: "Send and verify", body: "Send the invitation and confirm the person appears under Members after accepting it." },
    ],
  },
  {
    id: "backup-data",
    category: "Protect data",
    icon: "database",
    title: "Back up and recover records",
    summary: "Download a controlled backup and understand the difference between merge and replace before importing.",
    time: "2–5 min",
    roles: "Admin",
    target: { viewId: "backup", label: "Open Backup" },
    steps: [
      { title: "Export first", body: "Open Backup and download a JSON copy before a major import, configuration change or device move." },
      { title: "Store it securely", body: "Keep the file in your organisation’s controlled storage. It may contain personal and project information." },
      { title: "Choose recovery mode carefully", body: "Merge adds and updates records; replace overwrites the current workspace. Read the confirmation summary before proceeding." },
    ],
  },
];

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
  "fess-setup": "FESS Group onboarding — standard site RA baseline, LOTO and food factory method steps (FESS org only).",
  "fess-sites": "FESS client & sites — one-click RAMS, method statement and permits per food factory site (FESS org only).",
  "construction-setup": "Construction onboarding wizard — CDM-oriented starter checklist.",
  "site-map": "Legacy label — use Drawings and Project Hub map tools.",
};
