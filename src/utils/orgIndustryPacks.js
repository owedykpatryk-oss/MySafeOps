import { applyHidePreset, clearAllHidden, getHiddenModuleIds, HIDE_PRESETS } from "./hiddenModules";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { clearIndustryPackPreview } from "./industryPackPreview";
import { seedRegistersForIndustryPack } from "./industryPackSeeds";

/** Workspace profiles for any tenant — applies module visibility + optional sectors. */
export const INDUSTRY_PACKS = {
  generalContractor: {
    label: "General construction & trades",
    hint: "Builders, subcontractors, civils — RAMS, PTW, CDM, briefings. No PAS128 survey module.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report"],
    industrySectors: ["construction"],
    ramsStarterKey: "general",
  },
  electricalContractor: {
    label: "Electrical & M&E",
    hint: "Electrical PTW, hot work, RAMS and inspections — hides geodesy / survey deliverables.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report"],
    industrySectors: ["construction", "maintenance"],
    ramsStarterKey: "electrical",
  },
  buildingTrades: {
    label: "Building & refurbishment",
    hint: "Refurb, fit-out, snagging — core site HSE without surveying reports.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report"],
    industrySectors: ["construction"],
    ramsStarterKey: "refurb_build",
  },
  surveyingGeodesy: {
    label: "Surveying & geodesy",
    hint: "PAS128 / utility mapping — full survey report workflow and RAMS surveying packs.",
    hidePreset: "surveyingFocus",
    showModules: ["survey-report"],
    industrySectors: ["construction"],
    ramsStarterKey: "utility_mapping_survey",
    surveyWorkflow: true,
  },
  contractorPlusSurveying: {
    label: "Contractor + surveying",
    hint: "Mostly construction with occasional PAS128 / survey jobs — survey module without full geodesy layout.",
    hidePreset: "hideSurveyingRams",
    showModules: ["survey-report"],
    industrySectors: ["construction"],
    ramsStarterKey: "general",
    surveyWorkflow: true,
  },
  facilitiesMaintenance: {
    label: "Facilities & maintenance",
    hint: "PPM inspections, PAT and plant — less survey/CDM emphasis for FM teams.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report"],
    showModules: ["electrical-pat", "plant", "inspections"],
    industrySectors: ["construction", "maintenance"],
    ramsStarterKey: "general",
  },
  demolitionStripout: {
    label: "Demolition & strip-out",
    hint: "Excavation, temp works, gate book and asbestos — civils and demolition HSE.",
    hidePreset: "hideSurveyingRams",
    hiddenModules: ["survey-report"],
    showModules: ["excavation", "temp-works", "gate", "asbestos"],
    industrySectors: ["construction"],
    ramsStarterKey: "groundworks",
  },
  foodPharma: {
    label: "Food, beverage & pharma",
    hint: "Industrial hygiene registers — hides surveying RAMS packs and survey reports.",
    hidePreset: "foodPharmaFocus",
    hiddenModules: ["survey-report"],
    showModules: ["allergen-changeovers", "gmp-deviations", "high-care-access", "cip-signoff"],
    industrySectors: ["construction", "food_beverage", "pharma", "pet_food"],
    ramsStarterKey: "general",
  },
  showEverything: {
    label: "Show all modules",
    hint: "Full library including survey reports — trim later in Settings.",
    hidePreset: null,
    showModules: ["survey-report"],
    industrySectors: null,
    ramsStarterKey: null,
    surveyWorkflow: true,
  },
};

/** @param {unknown} packKey */
export function isValidIndustryPackId(packKey) {
  return typeof packKey === "string" && Object.prototype.hasOwnProperty.call(INDUSTRY_PACKS, packKey);
}

/** @param {keyof typeof INDUSTRY_PACKS} packKey @param {{ seedTemplates?: boolean }} [options] */
export function applyIndustryPack(packKey, options = {}) {
  if (!isValidIndustryPackId(packKey)) return { seeded: [] };
  const pack = INDUSTRY_PACKS[packKey];

  if (packKey === "showEverything") {
    clearAllHidden();
  } else if (pack.hidePreset && HIDE_PRESETS[pack.hidePreset]) {
    applyHidePreset(pack.hidePreset);
  }

  let hiddenModules = packKey === "showEverything" ? [] : [...getHiddenModuleIds()];
  if (Array.isArray(pack.hiddenModules) && pack.hiddenModules.length) {
    hiddenModules = [...new Set([...hiddenModules, ...pack.hiddenModules])];
  }
  if (Array.isArray(pack.showModules) && pack.showModules.length) {
    hiddenModules = hiddenModules.filter((id) => !pack.showModules.includes(id));
  }

  const raw = loadOrgSettingsRaw();
  const next = {
    ...raw,
    industryPackId: packKey,
    hiddenModulesBootstrapped: true,
    hiddenModules,
    ramsStarterKey: pack.ramsStarterKey ?? raw.ramsStarterKey ?? null,
  };
  if (Array.isArray(pack.industrySectors) && pack.industrySectors.length) {
    next.industrySectors = pack.industrySectors;
  }
  saveOrgSettingsRaw(next);
  clearIndustryPackPreview();

  let seeded = [];
  if (options.seedTemplates) {
    seeded = seedRegistersForIndustryPack(packKey).seeded;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mysafeops-hidden-modules-updated", { detail: { orgId: raw.orgId } })
    );
  }
  return { seeded };
}

export function getAppliedIndustryPackId() {
  const id = loadOrgSettingsRaw().industryPackId;
  return isValidIndustryPackId(id) ? id : null;
}
