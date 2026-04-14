/**
 * Single source for main nav + More menu labels and section grouping.
 */

export const NAV_TAB_IDS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "permits", label: "Permits" },
  { id: "rams", label: "RAMS" },
  { id: "workers", label: "Workers" },
  { id: "site-map", label: "Site map" },
  { id: "bin", label: "Bin" },
  { id: "more", label: "More" },
];

/** Bottom-bar destinations that open a module directly (excludes “More”). */
export const PRIMARY_BOTTOM_NAV_IDS = NAV_TAB_IDS.filter((t) => t.id !== "more").map((t) => t.id);

export const primaryBottomNavIdSet = new Set(PRIMARY_BOTTOM_NAV_IDS);

/**
 * Filter More-grid tabs by user query (label or id).
 * @param {{ id: string, label: string }[]} tabs
 * @param {string} rawQuery
 */
export function filterModuleTabsByQuery(tabs, rawQuery) {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return tabs;
  return tabs.filter(
    (t) => t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q.replace(/\s+/g, "-"))
  );
}

/** Flat list for More grid (order within sections below) */
export const MORE_TABS = [
  { id: "site-map", label: "Site map" },
  { id: "project-drawings", label: "Project drawings" },
  { id: "method-statement", label: "Method statement" },
  { id: "cdm", label: "CDM compliance" },
  { id: "daily-briefing", label: "Daily briefing" },
  { id: "induction", label: "QR induction" },
  { id: "signatures", label: "Signatures" },
  { id: "timesheets", label: "Timesheets" },
  { id: "snags", label: "Snags" },
  { id: "coshh", label: "COSHH" },
  { id: "inspections", label: "Inspections" },
  { id: "incidents", label: "Incidents" },
  { id: "incident-actions", label: "Incident actions" },
  { id: "incident-map", label: "Incident map" },
  { id: "riddor", label: "RIDDOR" },
  { id: "emergency", label: "Emergency" },
  { id: "ppe", label: "PPE" },
  { id: "plant", label: "Plant" },
  { id: "fire", label: "Fire safety" },
  { id: "hot-work", label: "Hot work" },
  { id: "training", label: "Training" },
  { id: "visitors", label: "Visitors" },
  { id: "toolbox-reg", label: "Toolbox log" },
  { id: "first-aid", label: "First aid" },
  { id: "lone-working", label: "Lone working" },
  { id: "environmental", label: "Environmental" },
  { id: "observations", label: "Observations" },
  { id: "ladders", label: "Ladders" },
  { id: "mewp", label: "MEWP" },
  { id: "gate", label: "Gate book" },
  { id: "asbestos", label: "Asbestos" },
  { id: "confined-space", label: "Confined space" },
  { id: "loto", label: "LOTO" },
  { id: "electrical-pat", label: "Electrical" },
  { id: "lifting", label: "Lifting" },
  { id: "dsear", label: "DSEAR" },
  { id: "noise", label: "Noise & vibration" },
  { id: "scaffold", label: "Scaffold" },
  { id: "excavation", label: "Excavations" },
  { id: "temp-works", label: "Temporary works" },
  { id: "welfare", label: "Welfare checks" },
  { id: "water-hygiene", label: "Water hygiene" },
  { id: "analytics", label: "Analytics" },
  { id: "monthly-report", label: "Monthly report" },
  { id: "waste", label: "Waste register" },
  { id: "templates", label: "Templates" },
  { id: "ai-rams", label: "AI RAMS" },
  { id: "ai-toolbox", label: "AI toolbox" },
  { id: "ai-photo", label: "AI photo hazard" },
  { id: "client-portal", label: "Client portal" },
  { id: "client-acquisition", label: "Client acquisition" },
  { id: "sales-enablement", label: "Sales enablement" },
  { id: "enterprise-readiness", label: "Enterprise readiness" },
  { id: "subcontractor", label: "Subcontractor" },
  { id: "documents", label: "Documents" },
  { id: "backup", label: "Backup" },
  { id: "audit", label: "Audit log" },
  { id: "superadmin", label: "Superadmin" },
  { id: "help", label: "Help" },
  { id: "settings", label: "Settings" },
];

const MORE_BY_ID = Object.fromEntries(MORE_TABS.map((t) => [t.id, t]));

const NAV_LABEL_BY_ID = Object.fromEntries(NAV_TAB_IDS.map((t) => [t.id, t.label]));
const MORE_LABEL_BY_ID = Object.fromEntries(MORE_TABS.map((t) => [t.id, t.label]));

/** Human-readable screen title for the workspace top bar */
export function getWorkspaceTitle(viewId, navTab) {
  const label = NAV_LABEL_BY_ID[viewId] || MORE_LABEL_BY_ID[viewId];
  if (label) return label;
  if (navTab === "more") return "More modules";
  return "Workspace";
}

/** Grouped sections for the More screen (easier to scan on mobile) */
export const MORE_SECTIONS = [
  {
    title: "Site operations",
    ids: [
      "site-map",
      "project-drawings",
      "method-statement",
      "cdm",
      "daily-briefing",
      "induction",
      "signatures",
      "timesheets",
      "snags",
      "documents",
      "client-portal",
      "client-acquisition",
      "sales-enablement",
      "subcontractor",
    ],
  },
  {
    title: "Health, safety & environment",
    ids: [
      "coshh",
      "inspections",
      "incidents",
      "incident-actions",
      "incident-map",
      "riddor",
      "emergency",
      "ppe",
      "plant",
      "fire",
      "hot-work",
      "training",
      "visitors",
      "toolbox-reg",
      "first-aid",
      "lone-working",
      "environmental",
      "observations",
      "ladders",
      "mewp",
      "gate",
      "asbestos",
      "confined-space",
      "loto",
      "electrical-pat",
      "lifting",
      "dsear",
      "noise",
      "scaffold",
      "excavation",
      "temp-works",
      "welfare",
      "water-hygiene",
      "waste",
    ],
  },
  {
    title: "Insights & AI",
    ids: ["analytics", "monthly-report", "templates", "ai-rams", "ai-toolbox", "ai-photo"],
  },
  {
    title: "Data & app",
    ids: ["enterprise-readiness", "backup", "audit", "superadmin", "help", "settings"],
  },
];

export function getMoreTabsForSection(section) {
  return section.ids.map((id) => MORE_BY_ID[id]).filter(Boolean);
}
