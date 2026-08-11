/**
 * Built-in workspace profile catalogue and ID helpers.
 * Kept separate from orgIndustryPacks/customWorkspaceProfiles to avoid cycles.
 */

export const INDUSTRY_PACKS = {
  generalContractor: {
    label: "General construction & trades",
    hint: "Builders, subcontractors, civils — RAMS, PTW, CDM, briefings. No PAS128 survey module.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report", "gpr-report"],
    showModules: ["construction-setup"],
    industrySectors: ["construction"],
    ramsStarterKey: "general",
  },
  electricalContractor: {
    label: "Electrical & M&E",
    hint: "Electrical PTW, hot work, RAMS and inspections — hides geodesy / survey deliverables.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report", "gpr-report"],
    industrySectors: ["construction", "facilities"],
    ramsStarterKey: "electrical",
  },
  buildingTrades: {
    label: "Building & refurbishment",
    hint: "Refurb, fit-out, snagging — core site HSE without surveying reports.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report", "gpr-report"],
    showModules: ["construction-setup"],
    industrySectors: ["construction"],
    ramsStarterKey: "refurb_build",
  },
  surveyingGeodesy: {
    label: "Surveying & geodesy",
    hint:
      "PAS128 / AS5488 utility mapping, aerial LiDAR, laser scan, hydrographic and rail corridor — survey reports and geospatial RAMS packs.",
    hidePreset: "surveyingFocus",
    showModules: ["survey-report", "gpr-report", "construction-setup"],
    industrySectors: [
      "construction",
      "surveying_pas128",
      "surveying_topo",
      "surveying_geospatial",
      "surveying_gpr",
    ],
    ramsStarterKey: "geospatial_intelligence",
    surveyWorkflow: true,
  },
  contractorPlusSurveying: {
    label: "Contractor + surveying",
    hint: "Mostly construction with occasional PAS128 / survey jobs — survey module without full geodesy layout.",
    hidePreset: "hideSurveyingRams",
    showModules: ["survey-report", "gpr-report"],
    industrySectors: ["construction", "surveying_pas128"],
    ramsStarterKey: "general",
    surveyWorkflow: true,
  },
  facilitiesMaintenance: {
    label: "Facilities & maintenance",
    hint: "PPM inspections, PAT and plant — less survey/CDM emphasis for FM teams.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report", "gpr-report"],
    showModules: ["electrical-pat", "plant", "inspections", "construction-setup"],
    industrySectors: ["construction", "facilities"],
    ramsStarterKey: "healthcare_fm",
  },
  demolitionStripout: {
    label: "Demolition & strip-out",
    hint: "Excavation, temp works, gate book and asbestos — civils and demolition HSE.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report", "gpr-report"],
    showModules: ["excavation", "temp-works", "gate", "asbestos", "construction-setup"],
    industrySectors: ["construction", "demolition"],
    ramsStarterKey: "demolition",
  },
  civilEarthworks: {
    label: "Civil & earthworks",
    hint: "Utilities, groundworks and civils — SWMS, PTW, excavation and temporary works registers.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report", "gpr-report"],
    showModules: ["excavation", "temp-works", "construction-setup"],
    industrySectors: ["construction"],
    ramsStarterKey: "groundworks",
  },
  foodPharma: {
    label: "Food, beverage & pharma",
    hint: "Industrial hygiene registers — hides surveying RAMS packs and survey reports.",
    hidePreset: "foodPharmaFocus",
    hiddenModules: ["survey-report", "gpr-report"],
    showModules: [
      "allergen-changeovers",
      "gmp-deviations",
      "high-care-access",
      "cip-signoff",
      "ghp-register",
      "dynamic-ra",
      "legislation",
      "hygiene-setup",
    ],
    industrySectors: ["construction", "food_beverage", "pharma", "pet_food"],
    ramsStarterKey: "general",
  },
  showEverything: {
    label: "Show all modules",
    hint: "Full library including survey reports — trim later in Settings.",
    hidePreset: null,
    showModules: ["survey-report", "gpr-report"],
    industrySectors: ["construction"],
    ramsStarterKey: null,
    surveyWorkflow: true,
  },
};

const LEGACY_PACK_ALIASES = {
  geospatialIntelligence: "surveyingGeodesy",
  "fess-setup": "hygiene-setup",
};

/** @param {unknown} packKey */
export function normalizeIndustryPackId(packKey) {
  if (typeof packKey !== "string" || !packKey) return null;
  if (LEGACY_PACK_ALIASES[packKey]) return LEGACY_PACK_ALIASES[packKey];
  return packKey;
}

/** @param {unknown} packKey */
export function isBuiltInIndustryPackId(packKey) {
  const id = normalizeIndustryPackId(packKey);
  return Boolean(id && Object.prototype.hasOwnProperty.call(INDUSTRY_PACKS, id));
}
