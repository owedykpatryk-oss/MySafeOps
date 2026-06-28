import { applyHidePreset, clearAllHidden, HIDE_PRESETS } from "./hiddenModules";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";

/** Workspace profiles for any tenant — applies module visibility + optional sectors. */
export const INDUSTRY_PACKS = {
  generalContractor: {
    label: "General construction",
    hint: "Hide geodesy / PAS128 RAMS packs. Keeps core site HSE tools.",
    hidePreset: "hideSurveyingRams",
    industrySectors: ["construction"],
  },
  surveyingGeodesy: {
    label: "Surveying & geodesy",
    hint: "Focus on PAS128 / mapping — hides food/pharma registers and RAMS allergen block.",
    hidePreset: "surveyingFocus",
    industrySectors: ["construction"],
  },
  foodPharma: {
    label: "Food, beverage & pharma",
    hint: "Industrial hygiene registers — hides surveying RAMS packs.",
    hidePreset: "foodPharmaFocus",
    industrySectors: ["construction", "food_beverage", "pharma", "pet_food"],
  },
  showEverything: {
    label: "Show all modules",
    hint: "No hides — explore the full library and trim later in Settings.",
    hidePreset: null,
    industrySectors: null,
  },
};

/** @param {keyof typeof INDUSTRY_PACKS} packKey */
export function applyIndustryPack(packKey) {
  const pack = INDUSTRY_PACKS[packKey];
  if (!pack) return;
  if (packKey === "showEverything") {
    clearAllHidden();
  } else if (pack.hidePreset && HIDE_PRESETS[pack.hidePreset]) {
    applyHidePreset(pack.hidePreset);
  }
  const raw = loadOrgSettingsRaw();
  const next = {
    ...raw,
    industryPackId: packKey,
    hiddenModulesBootstrapped: true,
  };
  if (Array.isArray(pack.industrySectors) && pack.industrySectors.length) {
    next.industrySectors = pack.industrySectors;
  }
  saveOrgSettingsRaw(next);
}

export function getAppliedIndustryPackId() {
  const id = loadOrgSettingsRaw().industryPackId;
  return id && INDUSTRY_PACKS[id] ? id : null;
}
