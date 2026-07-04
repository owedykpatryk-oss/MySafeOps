/** Landing-only showcase data — kept free of heavy RAMS hazard libraries in the initial bundle. */

const PROFILE_ICONS = {
  generalContractor: "🏗️",
  electricalContractor: "⚡",
  buildingTrades: "🔨",
  surveyingGeodesy: "📐",
  contractorPlusSurveying: "🏗️📐",
  facilitiesMaintenance: "🔧",
  demolitionStripout: "🧱",
  foodPharma: "🧪",
  showEverything: "✨",
};

/** Workspace profiles for landing — mirrors built-in orgIndustryPacks (display fields only). */
export const LANDING_WORKSPACE_PROFILES = [
  {
    id: "generalContractor",
    icon: PROFILE_ICONS.generalContractor,
    label: "General construction & trades",
    hint: "Builders, subcontractors, civils — RAMS, PTW, CDM, briefings. No PAS128 survey module.",
    survey: false,
    food: false,
  },
  {
    id: "electricalContractor",
    icon: PROFILE_ICONS.electricalContractor,
    label: "Electrical & M&E",
    hint: "Electrical PTW, hot work, RAMS and inspections — hides geodesy / survey deliverables.",
    survey: false,
    food: false,
  },
  {
    id: "buildingTrades",
    icon: PROFILE_ICONS.buildingTrades,
    label: "Building & refurbishment",
    hint: "Refurb, fit-out, snagging — core site HSE without surveying reports.",
    survey: false,
    food: false,
  },
  {
    id: "surveyingGeodesy",
    icon: PROFILE_ICONS.surveyingGeodesy,
    label: "Surveying & geodesy",
    hint:
      "PAS128 / AS5488 utility mapping, aerial LiDAR, laser scan, hydrographic and rail corridor — survey reports and geospatial RAMS packs.",
    survey: true,
    food: false,
  },
  {
    id: "contractorPlusSurveying",
    icon: PROFILE_ICONS.contractorPlusSurveying,
    label: "Contractor + surveying",
    hint: "Mostly construction with occasional PAS128 / survey jobs — survey module without full geodesy layout.",
    survey: true,
    food: false,
  },
  {
    id: "facilitiesMaintenance",
    icon: PROFILE_ICONS.facilitiesMaintenance,
    label: "Facilities & maintenance",
    hint: "PPM inspections, PAT and plant — less survey/CDM emphasis for FM teams.",
    survey: false,
    food: false,
  },
  {
    id: "demolitionStripout",
    icon: PROFILE_ICONS.demolitionStripout,
    label: "Demolition & strip-out",
    hint: "Excavation, temp works, gate book and asbestos — civils and demolition HSE.",
    survey: false,
    food: false,
  },
  {
    id: "foodPharma",
    icon: PROFILE_ICONS.foodPharma,
    label: "Food, beverage & pharma",
    hint: "Industrial hygiene registers — hides surveying RAMS packs and survey reports.",
    survey: false,
    food: true,
  },
  {
    id: "showEverything",
    icon: PROFILE_ICONS.showEverything,
    label: "Show all modules",
    hint: "Full library including survey reports — trim later in Settings.",
    survey: true,
    food: false,
  },
];

/** Profile focus bullets for landing detail panel (subset of industryPackProfile INDUSTRY_SITE_PACKS). */
export const LANDING_PROFILE_SITE_FOCUS = {
  electricalContractor: ["PAT / electrical", "Hot work register", "LOTO / isolation", "Inspections", "RAMS", "Permits (PTW)"],
  generalContractor: ["Daily briefing", "CDM pack", "RAMS", "Open snags", "Timesheets", "Permits (PTW)"],
  buildingTrades: ["Daily briefing", "RAMS", "Snag register", "Inspections", "Method statements", "PTW"],
  surveyingGeodesy: [
    "Survey reports",
    "PAS128 / AS5488 deliverables",
    "Aerial LiDAR & laser scan",
    "Method statements",
    "RAMS (surveying)",
    "Geo photos",
  ],
  foodPharma: ["Allergen changeovers", "GMP deviations", "High-care access", "RAMS", "Daily briefing", "PTW"],
  showEverything: ["CDM", "RAMS", "PTW", "Briefings", "Inspections or survey", "Linked documents"],
  contractorPlusSurveying: ["Daily briefing", "RAMS", "Survey reports", "PAS128 deliverables", "Inspections or survey", "PTW"],
  facilitiesMaintenance: ["Inspections", "PAT / electrical", "Plant register", "Daily briefing", "RAMS", "PTW"],
  demolitionStripout: ["Excavation log", "Temporary works", "Gate book", "Asbestos register", "RAMS", "PTW"],
};

/** Total built-in quick packs — keep in sync with constructionQuickPacks.js exports. */
export const LANDING_RAMS_PACK_COUNT = 39;

/** Sector tabs for interactive RAMS pack browser on landing. */
export const LANDING_RAMS_SECTOR_TABS = [
  { id: "construction", label: "Construction & civils", match: (p) => p.sector === "construction" },
  { id: "utilities", label: "Utilities", match: (p) => p.sector === "utilities" || p.sector === "highways" || p.sector === "rail" },
  { id: "surveying", label: "Survey & geospatial", match: (p) => p.sector === "surveying" },
  {
    id: "industrial",
    label: "Industrial & energy",
    match: (p) => ["industrial", "energy", "environmental", "maintenance", "me"].includes(p.sector),
  },
  { id: "food_pharma", label: "Food & pharma", match: (p) => p.sector === "food_pharma" },
];

/** @typedef {{ id: string, name: string, sector: string, pinned?: boolean, description?: string, hazardCount: number }} LandingRamsPack */

let catalogPromise = null;

/** Lazy-load RAMS pack metadata (defers constructionQuickPacks chunk until showcase mounts). */
export function loadLandingRamsPackCatalog() {
  if (!catalogPromise) {
    catalogPromise = import("../../modules/rams/constructionQuickPacks").then((m) => {
      const defs = [
        ...m.BUILTIN_CONSTRUCTION_PACK_DEFS,
        ...m.BUILTIN_GEOSPATIAL_PACK_DEFS,
        ...m.BUILTIN_SITE_INVESTIGATION_PACK_DEFS,
        ...m.BUILTIN_FOOD_PHARMA_PACK_DEFS,
      ];
      return defs.map(({ id, name, sector, pinned, description, hazardIds }) => ({
        id,
        name,
        sector,
        pinned,
        description,
        hazardCount: Array.isArray(hazardIds) ? hazardIds.length : 0,
      }));
    });
  }
  return catalogPromise;
}

/** @param {string} tabId @param {LandingRamsPack[]} catalog */
export function getLandingRamsPacksForTab(tabId, catalog) {
  const tab = LANDING_RAMS_SECTOR_TABS.find((t) => t.id === tabId) || LANDING_RAMS_SECTOR_TABS[0];
  return catalog.filter(tab.match).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
}
