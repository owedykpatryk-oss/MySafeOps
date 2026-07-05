/**
 * Industrial / food–pharma sector flags for org-scoped features (FESS-style sites + generic contractors).
 * Stored on org-scoped `mysafeops_org_settings` as `industrySectors: string[]`.
 */
import { isTrialUnlockActive } from "./orgMembership";
import { getOrgSettings } from "./orgSettingsStorage";

/** @typedef {{ id: string, label: string, hint: string, tags?: string[] }} IndustrySectorOption */
/** @typedef {{ id: string, label: string, description?: string, options: IndustrySectorOption[] }} IndustrySectorGroup */

export const INDUSTRY_SECTOR_GROUPS = [
  {
    id: "construction",
    label: "Construction & site works",
    description: "Core CDM, RAMS, permits and site registers.",
    options: [
      { id: "construction", label: "General construction", hint: "Default — new build, refurb, multi-trade sites", tags: ["CDM", "RAMS", "PTW"] },
      { id: "demolition", label: "Demolition & strip-out", hint: "Structural dismantling, asbestos, waste streams", tags: ["Demolition", "Asbestos"] },
      { id: "infrastructure", label: "Highways & civils", hint: "NRSWA, traffic management, deep excavations", tags: ["NRSWA", "TM"] },
      { id: "utilities", label: "Utilities & streetworks", hint: "Water, gas, electric, telecoms in carriageway", tags: ["Permit-to-dig"] },
      { id: "fitout", label: "Commercial fit-out", hint: "Occupied buildings, out-of-hours, fire alarm isolations", tags: ["Hot work", "Occupied"] },
      { id: "housing", label: "Housing & residential", hint: "Housebuilding, apartments, resident interface", tags: ["Residents"] },
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing & hygiene-critical",
    description: "Food, pharma, allergen and GMP-controlled environments.",
    options: [
      { id: "food_beverage", label: "Food & beverage", hint: "HACCP, allergen changeovers, hygiene registers", tags: ["Allergen", "G&HP"] },
      { id: "dairy", label: "Dairy", hint: "CIP, high-care, temperature-controlled process", tags: ["CIP", "High-care"] },
      { id: "brewing", label: "Brewing & distilling", hint: "Fermentation, CO₂, confined vessels", tags: ["CO₂", "Vessels"] },
      { id: "pet_food", label: "Pet food", hint: "Cross-contamination, allergen segregation", tags: ["Allergen"] },
      { id: "pharma", label: "Pharmaceuticals", hint: "GMP deviation log, batch control, QA sign-off", tags: ["GMP", "QA"] },
      { id: "medical_devices", label: "Medical devices & cleanrooms", hint: "ISO 14644, validated environments, line clearance", tags: ["Cleanroom", "GMP"] },
      { id: "cosmetics", label: "Cosmetics & personal care", hint: "Batch traceability, allergen, high-care zones", tags: ["Batch", "Hygiene"] },
    ],
  },
  {
    id: "energy",
    label: "Energy, process & heavy industry",
    description: "ATEX, DSEAR, LOTO and process safety emphasis.",
    options: [
      { id: "petrochem", label: "Petrochemical & oil & gas", hint: "ATEX zones, hot work controls, SIMOPS", tags: ["ATEX", "DSEAR"] },
      { id: "power_energy", label: "Power generation & energy", hint: "Isolation, confined spaces, high voltage", tags: ["LOTO", "HV"] },
      { id: "renewables", label: "Renewables (wind / solar)", hint: "Work at height, lifting, remote sites", tags: ["WAH", "LOLER"] },
      { id: "mining", label: "Mining & quarrying", hint: "Ground instability, dust, heavy plant", tags: ["Quarry", "Dust"] },
      { id: "steel_process", label: "Steel & heavy process", hint: "Molten metal, cranes, process isolation", tags: ["Hot work", "LOTO"] },
    ],
  },
  {
    id: "facilities",
    label: "Facilities, logistics & maintenance",
    description: "M&E, shutdowns and critical infrastructure.",
    options: [
      { id: "facilities", label: "Facilities & M&E maintenance", hint: "Shutdowns, permit escalation, resident liaison", tags: ["LOTO", "Shutdown"] },
      { id: "warehousing", label: "Warehousing & logistics", hint: "FLT, racking, loading bays, traffic routes", tags: ["FLT", "Traffic"] },
      { id: "data_centres", label: "Data centres & critical facilities", hint: "Live environments, method statements, access control", tags: ["Live services"] },
    ],
  },
];

/** Flat list — backward compatible */
export const INDUSTRY_SECTOR_OPTIONS = INDUSTRY_SECTOR_GROUPS.flatMap((g) =>
  g.options.map((o) => ({ ...o, groupId: g.id, groupLabel: g.label }))
);

const FOODISH = new Set(["food_beverage", "pet_food", "dairy", "brewing", "cosmetics"]);
const PHARMAISH = new Set(["pharma", "medical_devices"]);
const PROCESS_HEAVY = new Set(["petrochem", "power_energy", "renewables", "mining", "steel_process"]);

const OPTION_BY_ID = Object.fromEntries(INDUSTRY_SECTOR_OPTIONS.map((o) => [o.id, o]));

/** Legacy sector ids → current ids */
const SECTOR_ALIASES = { maintenance: "facilities" };

/** @returns {string[]} Saved sector ids only (never trial override). */
export function getSelectedIndustrySectors() {
  const s = getOrgSettings().industrySectors;
  const raw = Array.isArray(s) && s.length ? s : ["construction"];
  return [...new Set(raw.map((id) => SECTOR_ALIASES[id] || id))];
}

/** @deprecated alias */
export function readIndustrySectorsFromStorage() {
  return getSelectedIndustrySectors();
}

export function getIndustrySectorLabel(id) {
  return OPTION_BY_ID[id]?.label || id;
}

export function orgSectorSelected(id) {
  return getSelectedIndustrySectors().includes(id);
}

/** Module/feature unlock — trial OR sector ticked. */
export function orgSectorFeatureEnabled(id) {
  if (isTrialUnlockActive()) return true;
  return orgSectorSelected(id);
}

export function orgHasFoodIndustrialPack() {
  if (isTrialUnlockActive()) return true;
  const s = getSelectedIndustrySectors();
  return s.some((id) => FOODISH.has(id) || id === "petrochem");
}

export function orgHasPharmaPack() {
  if (isTrialUnlockActive()) return true;
  const s = getSelectedIndustrySectors();
  return s.some((id) => PHARMAISH.has(id));
}

/** Workspace banners — follow saved ticks only (not trial unlock). */
export function orgFoodSectorBannerActive() {
  const s = getSelectedIndustrySectors();
  return s.some((id) => FOODISH.has(id));
}

export function orgPharmaSectorBannerActive() {
  const s = getSelectedIndustrySectors();
  return s.some((id) => PHARMAISH.has(id));
}

export function orgProcessSectorBannerActive() {
  const s = getSelectedIndustrySectors();
  return s.some((id) => PROCESS_HEAVY.has(id));
}

export function orgShowsIndustrialMoreModules() {
  const s = getSelectedIndustrySectors();
  return s.some((id) => id !== "construction");
}

/** Human-readable registers/features highlighted when sectors are ticked. */
const SECTOR_REGISTER_HINTS = {
  food_beverage: ["Allergen changeovers", "G&HP register", "Hygiene setup"],
  dairy: ["CIP sign-off", "High-care access", "G&HP register"],
  brewing: ["Confined vessels", "CO₂ controls"],
  pet_food: ["Allergen segregation", "G&HP register"],
  pharma: ["GMP deviation log", "High-care access", "Batch traceability"],
  medical_devices: ["Cleanroom / line clearance", "GMP deviation log"],
  cosmetics: ["Batch traceability", "Hygiene registers"],
  petrochem: ["ATEX / DSEAR log", "Hot work ↔ LOTO links"],
  power_energy: ["LOTO register", "Electrical PAT"],
  renewables: ["Work at height", "Lifting plans"],
  demolition: ["Asbestos register", "Excavation log", "Temp works"],
  infrastructure: ["NRSWA / streetworks", "Traffic management"],
  utilities: ["Permit-to-dig", "Utility mapping surveys"],
  facilities: ["PPM inspections", "Plant register"],
  warehousing: ["FLT / traffic routes", "Gate book"],
  data_centres: ["Live services PTW", "Access control"],
};

/** @param {string[]} [sectorIds] */
export function getSectorRegisterHints(sectorIds = getSelectedIndustrySectors()) {
  const hints = new Set();
  for (const id of sectorIds) {
    for (const h of SECTOR_REGISTER_HINTS[id] || []) hints.add(h);
  }
  return [...hints];
}

/**
 * Active allergen changeover windows for banner display.
 * @param {Array<{ startAt: string, endAt: string, siteLabel?: string, fromAllergen?: string, toAllergen?: string, label?: string }>} windows
 * @param {number} nowMs
 */
export function activeAllergenWindows(windows, nowMs = Date.now()) {
  if (!Array.isArray(windows)) return [];
  return windows.filter((w) => {
    const a = Date.parse(w.startAt);
    const b = Date.parse(w.endAt);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return nowMs >= a && nowMs <= b;
  });
}
