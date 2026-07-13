import {
  MORE_TABS,
  MORE_SECTIONS,
  NAV_TAB_IDS,
} from "../navigation/appModules";
import {
  CONSTRUCTION_SLIM_HIDDEN,
  isFeatureAllowedForMarket,
  isModuleAllowedForMarket,
  MARKET_PACK_HINTS,
} from "../config/marketModules";
import { isPaidSubscriptionActive } from "./billingAccess";
import { getTrialStatus, isTrialUnlockActive } from "./orgMembership";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { RAMS_FEATURES } from "./ramsFeatureIds";
import { getModuleLabelForMarket } from "./marketLabels";
import { getOrgMarketId } from "./orgMarket";
import { isFessOrg } from "./fessOrg";
import { applyMarketModuleDefaults } from "./marketModuleSync";

export { RAMS_FEATURES, CONSTRUCTION_SLIM_HIDDEN, MARKET_PACK_HINTS };

export const HIDDEN_MODULES_UPDATED_EVENT = "mysafeops-hidden-modules-updated";

// Computed lazily (not at module top level): this module sits in a long import cycle
// (appModules → orgMarket → orgStorage → billingAccess → orgMembership →
// orgBrandingCloudSync → orgIndustryPacks → hiddenModules → appModules), so MORE_TABS
// can still be mid-initialization the first time this module is evaluated.
let _validModuleIds = null;
function getValidModuleIds() {
  if (!_validModuleIds) {
    _validModuleIds = new Set([
      ...MORE_TABS.map((t) => t.id),
      ...NAV_TAB_IDS.filter((t) => t.id !== "more").map((t) => t.id),
    ]);
  }
  return _validModuleIds;
}

const VALID_FEATURE_IDS = new Set(Object.values(RAMS_FEATURES));

/** Always reachable so admins can unhide from Settings. */
export const MODULE_ALWAYS_VISIBLE = new Set(["settings", "help", "more"]);

let _moduleLabelById = null;
function getModuleLabelById() {
  if (!_moduleLabelById) {
    _moduleLabelById = Object.fromEntries([
      ...MORE_TABS.map((t) => [t.id, t.label]),
      ...NAV_TAB_IDS.map((t) => [t.id, t.label]),
    ]);
  }
  return _moduleLabelById;
}

const FEATURE_LABELS = {
  [RAMS_FEATURES.SURVEYING]: "RAMS — Surveying / PAS128 packs (UK)",
  [RAMS_FEATURES.ALLERGEN]: "RAMS — Allergen & food-production section",
};

function parseHiddenModules(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id) => typeof id === "string" && getValidModuleIds().has(id)))];
}

function parseHiddenFeatures(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id) => typeof id === "string" && VALID_FEATURE_IDS.has(id)))];
}

/** Hidden until Assist ships — routes kept for deep links only. */
export const DEFERRED_MODULE_IDS = new Set(["ai-rams", "ai-toolbox", "ai-photo"]);

/** Slim More menu for typical UK construction / surveying (bootstrap on first load) — re-exported above. */

function bootstrapHiddenModulesIfNeeded() {
  if (typeof window === "undefined") return;
  const raw = loadOrgSettingsRaw();
  const marketId = getOrgMarketId();
  if (!raw.hiddenModulesBootstrapped || raw.marketModulePackApplied !== marketId) {
    applyMarketModuleDefaults(marketId);
    return;
  }
  if (raw.hiddenModulesBootstrapped) return;
  const merged =
    raw.hiddenModules !== undefined
      ? parseHiddenModules(raw.hiddenModules)
      : [...new Set(CONSTRUCTION_SLIM_HIDDEN)];
  saveOrgSettingsRaw({
    ...raw,
    hiddenModules: merged,
    hiddenModulesBootstrapped: true,
    marketModulePackApplied: marketId,
  });
}

export function getHiddenModuleIds() {
  if (typeof window !== "undefined") bootstrapHiddenModulesIfNeeded();
  return parseHiddenModules(loadOrgSettingsRaw().hiddenModules);
}

export function getHiddenFeatureIds() {
  if (typeof window === "undefined") return [];
  return parseHiddenFeatures(loadOrgSettingsRaw().hiddenFeatures);
}

export function getModuleLabel(moduleId) {
  const marketLabel = getModuleLabelForMarket(moduleId, getOrgMarketId());
  if (marketLabel) return marketLabel;
  return getModuleLabelById()[moduleId] || moduleId;
}

export function getFeatureLabel(featureId) {
  return FEATURE_LABELS[featureId] || featureId;
}

/** Trial, any paid plan, or offline local workspace (no cloud trial date). */
export function hasFullModuleEntitlement() {
  if (isTrialUnlockActive()) return true;
  if (isPaidSubscriptionActive()) return true;
  if (!getTrialStatus()) return true;
  return false;
}

/** Modules shown only for matching org tenants. */
const ORG_GATED_MODULE_VISIBILITY = {
  "fess-setup": () => isFessOrg(),
  "fess-sites": () => isFessOrg(),
};

export function isModuleVisible(moduleId, { hiddenModules = getHiddenModuleIds(), marketId = getOrgMarketId() } = {}) {
  const id = String(moduleId || "");
  if (!id || MODULE_ALWAYS_VISIBLE.has(id)) return true;
  if (DEFERRED_MODULE_IDS.has(id)) return false;
  if (!isModuleAllowedForMarket(id, marketId)) return false;
  if (ORG_GATED_MODULE_VISIBILITY[id] && !ORG_GATED_MODULE_VISIBILITY[id]()) return false;
  if (id === "hygiene-setup" && isFessOrg()) return false;
  if (hasFullModuleEntitlement()) return true;
  return !hiddenModules.includes(id);
}

export function isFeatureVisible(featureId, { hiddenFeatures = getHiddenFeatureIds(), marketId = getOrgMarketId() } = {}) {
  if (!isFeatureAllowedForMarket(featureId, marketId)) return false;
  if (hasFullModuleEntitlement()) return true;
  return !hiddenFeatures.includes(featureId);
}

export function filterVisibleModuleIds(ids, opts) {
  return ids.filter((id) => isModuleVisible(id, opts));
}

export function filterVisibleModuleTabs(tabs, opts) {
  return (tabs || []).filter((t) => t && isModuleVisible(t.id, opts));
}

/** @param {string} moduleId */
export function hideModule(moduleId) {
  if (!getValidModuleIds().has(moduleId) || MODULE_ALWAYS_VISIBLE.has(moduleId)) {
    return getHiddenModuleIds();
  }
  const hiddenModules = [...getHiddenModuleIds()];
  if (!hiddenModules.includes(moduleId)) hiddenModules.push(moduleId);
  persistHidden({ hiddenModules });
  const raw = loadOrgSettingsRaw();
  if (raw.bottomNavModuleId === moduleId) {
    saveOrgSettingsRaw({ ...loadOrgSettingsRaw(), bottomNavModuleId: null });
  }
  return hiddenModules;
}

/** @param {string} moduleId */
export function unhideModule(moduleId) {
  const hiddenModules = getHiddenModuleIds().filter((id) => id !== moduleId);
  persistHidden({ hiddenModules });
  return hiddenModules;
}

/** @param {string} featureId */
export function hideFeature(featureId) {
  if (!VALID_FEATURE_IDS.has(featureId)) return getHiddenFeatureIds();
  const hiddenFeatures = [...getHiddenFeatureIds()];
  if (!hiddenFeatures.includes(featureId)) hiddenFeatures.push(featureId);
  persistHidden({ hiddenFeatures });
  return hiddenFeatures;
}

/** @param {string} featureId */
export function unhideFeature(featureId) {
  const hiddenFeatures = getHiddenFeatureIds().filter((id) => id !== featureId);
  persistHidden({ hiddenFeatures });
  return hiddenFeatures;
}

export function clearAllHidden() {
  persistHidden({ hiddenModules: [], hiddenFeatures: [] });
}

function persistHidden(partial) {
  const next = {
    ...loadOrgSettingsRaw(),
    hiddenModules: partial.hiddenModules ?? getHiddenModuleIds(),
    hiddenFeatures: partial.hiddenFeatures ?? getHiddenFeatureIds(),
  };
  saveOrgSettingsRaw(next);
  window.dispatchEvent(new CustomEvent(HIDDEN_MODULES_UPDATED_EVENT, { detail: { orgId: next.orgId } }));
}

/** Quick presets for common org profiles (merge — does not remove existing hides). */
export const HIDE_PRESETS = {
  constructionSlim: {
    label: "Slim More menu (construction)",
    hint: "Hide site map, sales playbooks, food/pharma registers and duplicate analytics.",
    hiddenFeatures: [],
    hiddenModules: CONSTRUCTION_SLIM_HIDDEN,
  },
  hideSurveyingRams: {
    label: "Hide RAMS surveying packs",
    hint: "For contractors not doing PAS128 / geodesy work.",
    hiddenFeatures: [RAMS_FEATURES.SURVEYING],
    hiddenModules: [],
  },
  surveyingFocus: {
    label: "Surveying / geodesy focus",
    hint: "Hide food/pharma industrial registers and RAMS allergen block.",
    hiddenFeatures: [RAMS_FEATURES.ALLERGEN],
    hiddenModules: [
      "allergen-changeovers",
      "gmp-deviations",
      "high-care-access",
      "cip-signoff",
    ],
  },
  foodPharmaFocus: {
    label: "Food / pharma focus",
    hint: "Hide surveying RAMS packs.",
    hiddenFeatures: [RAMS_FEATURES.SURVEYING],
    hiddenModules: [],
  },
};

/** @param {keyof typeof HIDE_PRESETS} presetKey */
export function applyHidePreset(presetKey) {
  const preset = HIDE_PRESETS[presetKey];
  if (!preset) return;
  const hiddenModules = [...new Set([...getHiddenModuleIds(), ...(preset.hiddenModules || [])])];
  const hiddenFeatures = [...new Set([...getHiddenFeatureIds(), ...(preset.hiddenFeatures || [])])];
  persistHidden({ hiddenModules, hiddenFeatures });
}

export function getModuleCatalogSections() {
  const marketId = getOrgMarketId();
  const primaryIds = NAV_TAB_IDS.filter((t) => t.id !== "more").map((t) => t.id);
  const filterIds = (ids) => ids.filter((id) => isModuleAllowedForMarket(id, marketId));
  const features = Object.entries(FEATURE_LABELS)
    .filter(([id]) => isFeatureAllowedForMarket(id, marketId))
    .map(([id, label]) => ({ id, label }));
  return [
    { title: "Main navigation", ids: filterIds(primaryIds) },
    ...MORE_SECTIONS.map((s) => ({ title: s.title, ids: filterIds(s.ids) })),
    {
      title: getOrgMarketId() === "au" ? "SWMS builder sections" : "RAMS builder sections",
      ids: [],
      features,
    },
  ];
}
