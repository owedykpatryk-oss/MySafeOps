/**
 * FESS Group workspace profile — visible and applicable only when isFessOrg() is true.
 */
export const FESS_GROUP_PACK_ID = "fessGroup";

/** Canonical Supabase / provision slugs for FESS Group. */
export const FESS_ORG_SLUGS = new Set(["fess-group", "fess_group"]);

/** Lightweight FESS tenant check for profile lists (no fessOrg/orgStorage cycle). */
export function isFessOrgForWorkspaceList(orgId, settingsName = "") {
  const slug = String(orgId || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (FESS_ORG_SLUGS.has(slug)) return true;
  const name = String(settingsName || "")
    .trim()
    .toLowerCase();
  return name.includes("fess group") || name === "fess";
}

/** @returns {boolean} */
export function isFessExclusivePackId(packId) {
  return String(packId || "").trim() === FESS_GROUP_PACK_ID;
}

/**
 * Modules FESS keeps visible even when other slim presets hide them.
 * Field ops still need photos (induction / incidents / site instructions),
 * scaffold / asbestos / noise around machine installs, and monthly reporting.
 */
export const FESS_KEEP_VISIBLE_MODULES = [
  "fess-setup",
  "fess-sites",
  "geo-photos",
  "scaffold",
  "asbestos",
  "noise",
  "monthly-report",
  "allergen-changeovers",
  "gmp-deviations",
  "high-care-access",
  "cip-signoff",
  "ghp-register",
  "dynamic-ra",
  "legislation",
  "loto",
  "method-statement",
  "hot-work",
  "client-portal",
  "coshh",
  "induction",
  "daily-briefing",
  "projects",
  "people",
  "permits",
  "rams",
  "documents",
  "snags",
];

/**
 * Extra hides for a food-factory M&E workspace (on top of foodPharmaFocus).
 * Does not hide geo-photos, scaffold, asbestos, noise, or monthly-report.
 */
export const FESS_FOCUS_HIDDEN_MODULES = [
  "survey-report",
  "gpr-report",
  "hygiene-setup",
  "construction-setup",
  "sales-enablement",
  "client-acquisition",
  "enterprise-readiness",
  "templates",
  "timesheets",
  "excavation",
  "temp-works",
  "water-hygiene",
  "welfare",
];

/** @returns {object} FESS Group workspace profile (org-exclusive). */
export function getFessGroupWorkspacePack() {
  return {
    label: "FESS Group — food factory M&E",
    hint: "M&E on live food sites — standard site RA baseline, hygiene registers, LOTO, line clearance and method statements.",
    hidePreset: "foodPharmaFocus",
    hiddenModules: [...FESS_FOCUS_HIDDEN_MODULES],
    showModules: [...FESS_KEEP_VISIBLE_MODULES],
    industrySectors: ["construction", "food_beverage", "pharma", "pet_food"],
    ramsStarterKey: "general",
    surveyWorkflow: false,
    orgExclusive: true,
  };
}
