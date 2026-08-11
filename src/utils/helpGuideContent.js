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
      { title: "Start a RAMS record", body: "Open RAMS, select Start new and choose the closest Quick pack for the planned work (or a playbook from Project Hub)." },
      { title: "Link the job", body: "Select the project, work location, responsible people and planned dates so the Hub readiness ring updates." },
      { title: "Review hazards and controls", body: "Remove anything irrelevant and add site-specific hazards, controls, PPE and linked permit types." },
      { title: "Competent review", body: "Confirm a competent person has reviewed the document. Do not skip this before issue on live sites." },
      { title: "Issue and brief", body: "Preview the PDF, issue the RAMS, then brief the workforce (Daily briefing or toolbox) before work starts." },
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
      { title: "Choose the permit type", body: "Open Permits and select the permit that matches the high-risk activity (hot work, excavation, confined space, WAH, etc.). Use the first-run guide if shown." },
      { title: "Define the safe scope", body: "Link the project and RAMS, then record the exact work area, task, issuer, receiver and validity window. Attach drawing zones when available." },
      { title: "Resolve readiness checks", body: "Complete isolations, controls, evidence and any SIMOPS conflicts shown by MySafeOps. Excavation PTW should reference survey / CAT / GPR where relevant." },
      { title: "Activate, monitor and close", body: "Authorise before work begins. At shift change use handover if required. At completion, confirm the area is safe and record close-out evidence." },
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
    id: "workspace-profile-trades",
    category: "Set up",
    icon: "workflow",
    title: "Profile, your trades and playbooks",
    summary: "Understand Modules & RAMS vs Your trades, then unlock the right project playbooks for construction or surveying firms.",
    time: "3–5 min",
    roles: "Admin",
    target: { settingsTab: "organisation", label: "Open Organisation" },
    steps: [
      {
        title: "Pick a workspace profile (Modules & RAMS)",
        body: "Settings → Organisation → Modules & RAMS. This decides which modules and project playbooks you see. Surveying firms choose Surveying & geodesy; builders stay on General construction.",
      },
      {
        title: "Tick Your trades",
        body: "Organisation → Your trades. Mark food, ATEX, PAS128, topo, etc. Trades drive banners and register emphasis — they do not replace the workspace profile.",
      },
      {
        title: "Surveying company path",
        body: "Tick Surveying & geospatial trades, then Apply Surveying & geodesy (or select that profile under Modules & RAMS). New projects then offer Utility mapping, Topographical survey, Topo + utility and GI playbooks.",
      },
      {
        title: "Create a project with a playbook",
        body: "Projects → Add project → choose a playbook on the last step. On save, MySafeOps drafts RAMS, survey (when applicable), PTW and method statement for that site type.",
      },
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
    category: "Survey",
    icon: "map",
    title: "Create a survey report",
    summary: "Link a project, choose the survey type, complete scope and findings, then issue a client-ready PDF.",
    time: "10–20 min",
    roles: "Surveyor · Reviewer",
    target: { viewId: "survey-report", label: "Open Survey Reports" },
    steps: [
      { title: "Create and link the job", body: "Select New report, pick the project, set the survey date and surveyor, and choose the survey type (e.g. PAS128 utility mapping, topo, GPR, CCTV). Job number and client pull from the project when linked." },
      { title: "Use Simple mode on site", body: "Toggle Simple mode for four steps: Start → On site → Findings → Print. Switch to Full editor only when you need every PAS128 / premium table (trial holes, QL summary, dig readiness)." },
      { title: "Fill scope and methodology", body: "Record survey limits, equipment, standards and site conditions. Apply a PAS128 method pack when the job is utility mapping. Note weather and access constraints early — they feed limitations text." },
      { title: "Import CAD if you have a drawing", body: "Findings → CAD utility mapping: upload DXF, map layers, Seed utilities table. See the guided task Import CAD into a survey report." },
      { title: "Add findings and evidence", body: "Complete the utilities schedule, trial holes, plans and geo-photos. Use Smart assist / Fill what I can as a draft only — verify every line before Mark final." },
      { title: "Link GPR when used", body: "If a GPR report exists on the same project, save either report so anomalies sync. Or run Prepare issue pack to merge GPR into the survey." },
      { title: "QA, preview and mark final", body: "Clear blockers in the quality panel, open live preview, then Mark final. Download the handover ZIP for the client pack (PDF, CSV, verification sheet)." },
    ],
  },
  {
    id: "survey-issue-pack",
    category: "Survey",
    icon: "sparkles",
    title: "Prepare a survey issue pack",
    summary: "One-click prep: Smart fill, autofixes, CAD→utilities, GPR sync — then Mark final and handover ZIP.",
    time: "5–10 min",
    roles: "Surveyor · Reviewer",
    target: { viewId: "survey-report", label: "Open Survey Reports" },
    steps: [
      { title: "Open a draft report", body: "Link the project and survey type first so Smart fill knows which templates and weather/geology to pull. Upload CAD beforehand if you want utilities seeded in the same run." },
      { title: "Run Prepare issue pack", body: "In Smart assist, select Prepare issue pack. This runs Smart fill, applies quick autofixes, seeds utilities from CAD when present, and merges linked GPR anomalies." },
      { title: "Review what changed", body: "Scan the utilities schedule, limitations and anomaly cards. Smart fill is a draft — correct depths, QL and client wording before issue." },
      { title: "Clear remaining blockers", body: "Use the blockers panel Fix → links. Critical items must be clear before Mark final is allowed." },
      { title: "Mark final and download pack", body: "Mark final, then use the handover modal for PDF + ZIP (CSV, verification sheet, CAD sidecar where available)." },
    ],
  },
  {
    id: "survey-cad-import",
    category: "Survey",
    icon: "layers",
    title: "Import CAD into a survey report",
    summary: "Upload a DXF (model space), map layers to utility + PAS128 QL, and seed the utilities schedule.",
    time: "5–8 min",
    roles: "Surveyor",
    target: { viewId: "survey-report", label: "Open Survey Reports" },
    steps: [
      { title: "Export DXF from CAD", body: "From AutoCAD / BricsCAD / QGIS export R2000+ DXF. DWG is not parsed in-browser — always use DXF. Prefer model-space linework only." },
      { title: "Upload on Findings", body: "Open the report → Findings → CAD utility mapping. Only model-space LINE / LWPOLYLINE / POLYLINE are measured; paper layouts are ignored." },
      { title: "Name layers for auto-classify", body: "Use names like UMG_LV_B1 or PAS128-HV-B2. Map unmatched layers with the utility + QL dropdowns. Re-map after a new upload if layer names changed." },
      { title: "Seed the utilities table", body: "Select Seed utilities table from CAD (or let Prepare issue pack do it). Lengths and QL appear in the schedule and PDF." },
      { title: "Merge vs replace", body: "If the schedule already has field rows, prefer merge so CAD lengths update without wiping hand-entered trial-hole notes. Check the panel summary after seeding." },
    ],
  },
  {
    id: "gpr-report",
    category: "Survey",
    icon: "radar",
    title: "Create a GPR report",
    summary: "Equipment, BGS ground, weather impact, anomalies, radargrams and a branded GPR PDF.",
    time: "10–25 min",
    roles: "Surveyor · Geophysicist",
    target: { viewId: "gpr-report", label: "Open GPR Reports" },
    steps: [
      { title: "Create and link the project", body: "New GPR report → select the project (map pin preferred for BGS DigMap). Prefill pulls site address and job refs. Keep the same project as the utility survey for sync." },
      { title: "Set equipment and velocity", body: "Choose a manufacturer preset (GSSI, IDS, MALÅ…). Set assumed or measured velocity (cm/ns) and scan mode / line spacing. Wrong velocity skews depth estimates in the PDF." },
      { title: "Fetch geology and weather", body: "On Ground & env, fetch BGS geology (50k) and weather for the survey date. Review penetration vs target depth and note clay / saturated ground limitations." },
      { title: "Import CAD verification (optional)", body: "Findings → CAD model-space verification for GPR corridor lengths, UMG→B1 upgrades and no-access hatches. See Import CAD into a GPR report." },
      { title: "Log anomalies and radargrams", body: "Add anomalies (or quick templates), attach radargram images / geo-photos, and complete chainage segments with PAS128-style line refs (e.g. UMG_LV_B1)." },
      { title: "Clear blockers and export", body: "Use the GPR blockers / quick fixes panel, review live preview (acquisition diagram + chainage chart), then Mark final and export PDF. Save once so linked survey reports pick up anomalies." },
    ],
  },
  {
    id: "gpr-cad-import",
    category: "Survey",
    icon: "layers",
    title: "Import CAD into a GPR report",
    summary: "Model-space DXF: count GPR layers, UMG→B1 upgrades, vegetation/obstruction hatches, and sync anomalies.",
    time: "5–10 min",
    roles: "Surveyor",
    target: { viewId: "gpr-report", label: "Open GPR Reports" },
    steps: [
      { title: "Prepare layer names", body: "Scan corridors: layers containing GPR (e.g. GPR_SCAN_L1). Upgraded utilities: UMG_LV_B1, UMG_GAS_B1. Hatches: VEGETATION, FOLIAGE, OBSTRUCTION, BUILDING, NO_ACCESS." },
      { title: "Upload DXF on Findings", body: "GPR report → Findings → CAD model-space verification. Paper-space / layout entities are skipped automatically." },
      { title: "Read the verification card", body: "Check counts and lengths for GPR layers, UMG→B1 segments, anomaly totals, and no-access hatch area (m²). Zero hatch area usually means hatches lived on a layout — re-export from model space." },
      { title: "Review unable-to-survey text", body: "Hatches auto-add limitation keys and narrative (e.g. no access due to vegetation). Edit if the site story differs." },
      { title: "Save to sync survey", body: "Save the GPR report so anomalies and CAD-derived limitations push into a linked survey on the same project. Re-run Prepare issue pack on the survey if you need a full client pack refresh." },
    ],
  },
  {
    id: "geo-photos",
    category: "Survey",
    icon: "camera",
    title: "Capture and use geo-photos",
    summary: "GPS-tagged site photos as evidence for survey, GPR, permits and Project Hub.",
    time: "5–10 min",
    roles: "Surveyor · Supervisor · Operative",
    target: { viewId: "geo-photos", label: "Open Geo-photos" },
    steps: [
      { title: "Allow location", body: "Open Geo-photos on a phone or tablet and allow browser location when prompted. Accuracy is better outdoors with a clear sky view." },
      { title: "Capture against a project", body: "Select the project, choose a photo type/preset (utility mark-up, trial pit, radargram, general), then take or upload the photo." },
      { title: "Pull into Survey or GPR", body: "In Survey Smart assist or GPR Findings, import geo-photos for that project. Utility / trial-pit types can seed schedule rows; radargram types fill GPR image slots." },
      { title: "Use on permits and Hub", body: "The same library feeds Project Hub evidence and can support permit close-out photos — keep captions short and factual." },
      { title: "Keep evidence tidy", body: "Delete or recycle bad shots, and avoid mixing projects — wrong projectId breaks automatic import." },
    ],
  },
  {
    id: "survey-gpr-dig",
    category: "Survey",
    icon: "workflow",
    title: "Survey → GPR → dig-ready permit",
    summary: "End-to-end utility workflow: map services, verify with GPR, then link residual risk into a permit to dig.",
    time: "15–30 min",
    roles: "Surveyor · Supervisor",
    target: { viewId: "survey-report", label: "Open Survey Reports" },
    steps: [
      { title: "Issue the survey report", body: "Complete PAS128 utility mapping (CAD + field schedule), run Prepare issue pack, Mark final." },
      { title: "Add or link a GPR report", body: "Same project → GPR report. Import CAD for GPR/UMG-B1/hatches, log anomalies, save so survey anomaly cards sync." },
      { title: "Check dig readiness", body: "On utility-mapping orgs, review dig-readiness / executive pages in print preview. Note unmarked or records-only (TFR) lines and no-access hatch zones." },
      { title: "Brief residual risk", body: "Highlight QL-B4/TFR corridors, vegetation no-access and unverified crossings for the dig team — do not treat the PDF as a dig-safe certificate." },
      { title: "Link into Permit to dig", body: "Open Permits → excavation / ground disturbance. Link the survey (and CAT/GPR refs). Carry residual risk and no-access zones into the permit scope before activation." },
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

/** Side-nav / deep-link section ids (must match HelpAbout HELP_NAV anchors). */
export const HELP_TOC = [
  { id: "help-start", label: "Start here" },
  { id: "help-guides", label: "Guided tasks" },
  { id: "help-first-week", label: "Your first week" },
  { id: "help-workspace", label: "Your workspace" },
  { id: "help-detail", label: "Workflows, roles & portals" },
  { id: "help-settings", label: "Settings" },
  { id: "help-questions", label: "Questions & glossary" },
  { id: "help-modules", label: "Module finder" },
];

/** Longer explainers rendered under Help → Workflows, roles & portals. */
export const HELP_DETAIL_SECTIONS = [
  {
    id: "profile-vs-trades",
    title: "Workspace profile vs Your trades vs playbooks",
    body: "Three layers: (1) Workspace profile under Modules & RAMS — which modules and RAMS starters you see (e.g. Surveying & geodesy unlocks survey report, GPR and PAS128 playbooks). (2) Your trades — optional ticks for food, petrochem, surveying cues; banners and register emphasis only. (3) Project playbook — chosen per job on create/save to draft RAMS, survey, PTW and method statement. Surveying firms: profile first, then tick surveying trades, then use Utility mapping / Topo playbooks on each project.",
  },
  {
    id: "project-hub",
    title: "Project Hub & readiness",
    body: "Open any project card to see the readiness ring, suggested next action, playbooks and trade checklist for that site. Completing Hub items (RAMS, permits, drawings, survey) raises readiness and clears management overview alerts. Survey / GPR completion feeds dig-readiness cues on utility-mapping profiles.",
  },
  {
    id: "workflows",
    title: "Key workflows",
    body: "Typical paths: (1) Project → RAMS → Permit → Daily briefing. (2) Project → Survey / GPR → handover pack → Permit to dig. (3) Project → Drawings → mark zones → link from PTW. Use Guided tasks for step-by-step versions. Contextual Help buttons on Survey, GPR and Geo-photos jump straight to the matching guide.",
  },
  {
    id: "survey-gpr-detail",
    title: "Survey & GPR deliverables",
    body: "Survey Reports hold PAS128 schedules, CAD lengths, trial holes and the client PDF/ZIP. GPR Reports hold equipment, BGS/weather, anomalies, radargrams and CAD verification (GPR layers, UMG→B1, no-access hatches). Keep both on the same project so save/sync and Prepare issue pack can merge anomalies. Smart fill and autofix are drafts — competent review before Mark final remains your duty.",
  },
  {
    id: "cad-dxf-detail",
    title: "CAD / DXF rules of thumb",
    body: "Always DXF (not DWG), R2000+. Model space only — layouts/title blocks are ignored. Layer names drive classification (UMG_*, PAS128-*, GPR*, VEGETATION…). Survey seeds the utilities table; GPR builds a verification card + hatch narratives. Re-upload after CAD edits; re-seed or rematch layers if names changed.",
  },
  {
    id: "roles",
    title: "Roles & permissions",
    body: "Admin — organisation, billing, invites, module visibility. Supervisor — day-to-day RAMS, permits, people, briefings. Operative — registers, briefings, capture evidence; limited organisation settings. Client / subcontractor portals are separate scoped views, not full roles.",
  },
  {
    id: "portals",
    title: "Client & subcontractor portals",
    body: "Client portal: read-only compliance snapshot for a client. Subcontractor portal: scoped access for supply-chain partners. Create from More → Client portal / Subcontractor; never share admin credentials.",
  },
  {
    id: "backup-audit",
    title: "Backup, bin & audit",
    body: "Backup exports a JSON workspace copy — export before major imports. Recycle bin restores recently deleted register rows. Audit shows who changed what. Cloud sync (when linked) does not replace your own controlled backups for critical sites.",
  },
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
    body: "Settings → Organisation → Modules & RAMS → workspace profile. This tunes which modules and project playbooks you get (contractor, surveying, food, etc.). Then open Your trades and tick the environments you work in.",
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
    title: "Survey / GPR (if you map utilities)",
    body: "For surveying or utility-mapping profiles: create a Survey report, optionally a GPR report, upload DXF on Findings, then Prepare issue pack. See Guided tasks → Survey.",
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
    "Logo, company details, Modules & RAMS (workspace profile), Your trades (banners/registers), module visibility, PDF defaults, custom fields.",
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
  { term: "Workspace profile", def: "Trade preset under Modules & RAMS (e.g. general contractor, surveying) — changes visible modules, RAMS starters and which project playbooks appear." },
  { term: "Your trades", def: "Optional ticks (construction, food, pharma, PAS128, topo…) — banners and register emphasis only; separate from workspace profile. Formerly called industry sectors." },
  { term: "Industry sectors", def: "Legacy name for Your trades — optional ticks for banners and packs; separate from workspace profile." },
  { term: "Project playbook", def: "Per-project recipe on create/save — drafts RAMS, survey (when profile allows), PTW and method statement for a site type (e.g. Electrical, Utility mapping, Topo)." },
  { term: "Project Hub", def: "Per-project dashboard card with readiness score and suggested next step." },
  { term: "Competent review", def: "Checkbox or confirm step before issuing RAMS or activating permits — records that a competent person reviewed." },
  { term: "PAS 128", def: "BSI specification for underground utility detection, verification and location — quality levels and detection methods used in UK utility surveys." },
  { term: "QL-B0 to B4", def: "PAS 128 quality levels for detected utilities. B0 = verified (e.g. trial hole); B1–B3 = detection with increasing uncertainty; B4 / TFR = taken from records." },
  { term: "TFR / AR", def: "Taken from records / as recorded — CAD or schedule linework derived from statutory records, not site detection." },
  { term: "UMG layer", def: "Utility Mapping CAD layer naming (e.g. UMG_LV_B1) encoding utility type and PAS128 QL for length analysis." },
  { term: "GPR", def: "Ground Penetrating Radar — geophysical method; MySafeOps GPR report records equipment, processing, anomalies and radargrams for the deliverable." },
  { term: "NDD", def: "Non-destructive digging (e.g. vacuum excavation) — often used to verify QL-B0 after detection." },
  { term: "Smart fill", def: "One-click draft aid that pulls project, weather, geology, templates and narratives into Survey or GPR — always verify before issue." },
  { term: "Issue pack", def: "Survey Prepare issue pack: Smart fill + autofixes + CAD utilities + GPR sync, then Mark final and client handover ZIP." },
  { term: "Model space", def: "CAD construction space. MySafeOps DXF import measures model space only and ignores paper-space / layout sheets." },
  { term: "No-access hatch", def: "CAD HATCH on layers such as VEGETATION, OBSTRUCTION or BUILDING — area is measured and written as unable-to-survey / limited coverage narrative." },
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
    q: "What's the difference between workspace profile and Your trades?",
    a: "Profile (Modules & RAMS) = which modules and project playbooks you see day to day. Your trades = optional banners and register emphasis (food, ATEX, surveying cues) — tick only what you actually work in. They are independent.",
  },
  {
    q: "We're a surveying company — why no topo / PAS128 playbooks?",
    a: "Those playbooks appear only with a surveying workspace profile. Settings → Organisation → Modules & RAMS → Surveying & geodesy (or Contractor + surveying). Optionally tick Surveying & geospatial under Your trades and use Apply Surveying & geodesy. Then new projects offer Utility mapping, Topographical survey, Topo + utility and related packs.",
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
    q: "CAD / DXF will not import — what now?",
    a: "Use DXF (not DWG). Export from AutoCAD/BricsCAD/QGIS as R2000+ ASCII DXF. Import reads model space only — title blocks on layouts are ignored. For Survey, open Findings → CAD utility mapping; for GPR, Findings → CAD model-space verification.",
  },
  {
    q: "Why can't I Mark final on a survey report?",
    a: "The blockers panel lists critical gaps (title, surveyor, findings, QA, etc.). Use Fix → to jump to each field, or Prepare issue pack then clear what remains. Mark final stays disabled until the final gate passes.",
  },
  {
    q: "My geo-photos have no GPS / wrong place",
    a: "Allow location in the browser, capture outdoors, and confirm the correct project is selected before taking the photo. Desktop uploads without EXIF GPS stay untagged — re-capture on a phone if coordinates are required.",
  },
  {
    q: "Hatch area is 0 m² or missing in GPR CAD",
    a: "Hatches need a closed boundary in the DXF and a layer name containing vegetation, foliage, obstruction, building, no_access, etc. Layout hatches are skipped. Re-export model-space hatches if the CAD only drew them on a paper layout.",
  },
  {
    q: "What does UMG → B1 mean on the GPR CAD card?",
    a: "Linework on layers like UMG_LV_B1 is treated as PAS128 QL-B1 — typically upgraded after GPR verification versus records-only (B4/TFR). Counts and lengths appear in the verification card and PDF.",
  },
  {
    q: "How do Survey and GPR stay in sync?",
    a: "Use the same project on both reports. Saving a GPR report pushes anomalies into the linked survey; Survey Prepare issue pack also merges GPR. If cards look stale, save GPR again or re-run Prepare issue pack.",
  },
  {
    q: "Where is live Help for Survey / GPR?",
    a: "More → Help & about, or the Help button on Survey / GPR editor heroes, CAD import panels and Geo-photos. Those open the matching guided task (guideId deep-link).",
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
  "survey-report": "PAS128 / topo / specialist survey deliverables — Smart fill, CAD lengths, QA gates, issue pack and handover ZIP.",
  "gpr-report": "GPR technical report — BGS/weather, anomalies, radargrams, model-space CAD verification and PDF.",
  "geo-photos": "GPS-tagged photos for survey, GPR, permits and Project Hub evidence packs.",
};

