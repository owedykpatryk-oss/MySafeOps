import { applyHidePreset, clearAllHidden, getHiddenModuleIds, HIDE_PRESETS } from "./hiddenModules";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { clearIndustryPackPreview } from "./industryPackPreview";
import { seedRegistersForIndustryPack } from "./industryPackSeeds";
import { PACK_DEFAULT_PERMIT_TYPES, normalizeEnabledPermitTypeIds } from "../modules/permits/permitOrgPrefs";
import {
  getCustomWorkspaceProfile,
  isCustomWorkspacePackId,
  resolveWorkspacePack,
} from "./customWorkspaceProfiles";
import { isFessOrg } from "./fessOrg";
import {
  FESS_GROUP_PACK_ID,
  getFessGroupWorkspacePack,
  isFessExclusivePackId,
} from "./fessWorkspaceProfile";

/** Built-in workspace profiles — any tenant can use; custom profiles are org-private. */
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
    industrySectors: ["construction"],
    ramsStarterKey: "geospatial_intelligence",
    surveyWorkflow: true,
  },
  contractorPlusSurveying: {
    label: "Contractor + surveying",
    hint: "Mostly construction with occasional PAS128 / survey jobs — survey module without full geodesy layout.",
    hidePreset: "hideSurveyingRams",
    showModules: ["survey-report", "gpr-report"],
    industrySectors: ["construction"],
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
export function isValidIndustryPackId(packKey) {
  const id = normalizeIndustryPackId(packKey);
  if (!id) return false;
  if (isFessExclusivePackId(id)) return isFessOrg();
  return Object.prototype.hasOwnProperty.call(INDUSTRY_PACKS, id) || isCustomWorkspacePackId(id);
}

/** @param {string} packKey */
export function getWorkspacePack(packKey) {
  const id = normalizeIndustryPackId(packKey);
  if (!id) return null;
  if (isFessExclusivePackId(id)) {
    return isFessOrg() ? getFessGroupWorkspacePack() : null;
  }
  return resolveWorkspacePack(id);
}

/** @param {string} [packKey] */
export function getWorkspacePackLabel(packKey) {
  const pack = getWorkspacePack(packKey);
  return pack?.label || "General construction";
}

/** @param {string} packKey @param {{ seedTemplates?: boolean }} [options] */
export function applyIndustryPack(packKey, options = {}) {
  const id = normalizeIndustryPackId(packKey);
  if (!id || !isValidIndustryPackId(id)) return { seeded: [] };
  const pack = getWorkspacePack(id);
  if (!pack) return { seeded: [] };

  if (id === "showEverything") {
    clearAllHidden();
  } else if (pack.hidePreset && HIDE_PRESETS[pack.hidePreset]) {
    applyHidePreset(pack.hidePreset);
  }

  let hiddenModules = id === "showEverything" ? [] : [...getHiddenModuleIds()];
  if (Array.isArray(pack.hiddenModules) && pack.hiddenModules.length) {
    hiddenModules = [...new Set([...hiddenModules, ...pack.hiddenModules])];
  }
  if (Array.isArray(pack.showModules) && pack.showModules.length) {
    hiddenModules = hiddenModules.filter((mid) => !pack.showModules.includes(mid));
  }

  const raw = loadOrgSettingsRaw();
  const packPermitDefaults = PACK_DEFAULT_PERMIT_TYPES[id];
  const next = {
    ...raw,
    industryPackId: id,
    hiddenModulesBootstrapped: true,
    hiddenModules,
    ramsStarterKey: pack.ramsStarterKey ?? raw.ramsStarterKey ?? null,
  };
  if (id === "showEverything") {
    next.enabledPermitTypes = [];
  } else if (Array.isArray(packPermitDefaults) && packPermitDefaults.length) {
    next.enabledPermitTypes = normalizeEnabledPermitTypeIds(packPermitDefaults);
  }
  if (Array.isArray(pack.industrySectors) && pack.industrySectors.length) {
    next.industrySectors = pack.industrySectors;
  }
  saveOrgSettingsRaw(next);
  clearIndustryPackPreview();

  let seeded = [];
  if (options.seedTemplates) {
    const seedKey =
      id === FESS_GROUP_PACK_ID ? FESS_GROUP_PACK_ID : pack.custom && pack.basedOn ? pack.basedOn : id;
    seeded = seedRegistersForIndustryPack(seedKey).seeded;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mysafeops-hidden-modules-updated", { detail: { orgId: raw.orgId } })
    );
  }
  return { seeded };
}

export function getAppliedIndustryPackId() {
  const id = normalizeIndustryPackId(loadOrgSettingsRaw().industryPackId);
  return isValidIndustryPackId(id) ? id : null;
}
