import { applyHidePreset, clearAllHidden, getHiddenModuleIds, HIDE_PRESETS } from "./hiddenModules";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { clearIndustryPackPreview } from "./industryPackPreview";
import { seedRegistersForIndustryPack } from "./industryPackSeeds";
import {
  INDUSTRY_PACKS,
  normalizeIndustryPackId,
} from "./industryPackCatalog";
import { PACK_DEFAULT_PERMIT_TYPES, normalizeEnabledPermitTypeIds } from "../modules/permits/permitPackDefaults";
import {
  isCustomWorkspacePackId,
  resolveWorkspacePack,
} from "./customWorkspaceProfiles";
import { isFessOrg } from "./fessOrg";
import {
  FESS_GROUP_PACK_ID,
  getFessGroupWorkspacePack,
  isFessExclusivePackId,
} from "./fessWorkspaceProfile";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import {
  getUtilityMappingWorkspacePack,
  isUtilityMappingExclusivePackId,
} from "./utilityMappingWorkspaceProfile";
import { mergeUtilityMappingBrandingDefaults } from "./utilityMappingBranding";
import { mergeFessBrandingDefaults } from "./fessBranding";

export { INDUSTRY_PACKS, normalizeIndustryPackId } from "./industryPackCatalog";

/** @param {unknown} packKey */
export function isValidIndustryPackId(packKey) {
  const id = normalizeIndustryPackId(packKey);
  if (!id) return false;
  if (isFessExclusivePackId(id)) return isFessOrg();
  if (isUtilityMappingExclusivePackId(id)) return isUtilityMappingOrg();
  return Object.prototype.hasOwnProperty.call(INDUSTRY_PACKS, id) || isCustomWorkspacePackId(id);
}

/** @param {string} packKey */
export function getWorkspacePack(packKey) {
  const id = normalizeIndustryPackId(packKey);
  if (!id) return null;
  if (isFessExclusivePackId(id)) {
    return isFessOrg() ? getFessGroupWorkspacePack() : null;
  }
  if (isUtilityMappingExclusivePackId(id)) {
    return isUtilityMappingOrg() ? getUtilityMappingWorkspacePack() : null;
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
  let next = {
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
  if (isUtilityMappingExclusivePackId(id)) {
    next = mergeUtilityMappingBrandingDefaults(next);
  }
  if (isFessExclusivePackId(id)) {
    next = mergeFessBrandingDefaults(next);
  }
  saveOrgSettingsRaw(next);
  clearIndustryPackPreview();

  let seeded = [];
  if (options.seedTemplates) {
    const seedKey =
      id === FESS_GROUP_PACK_ID ? FESS_GROUP_PACK_ID : pack.custom && pack.basedOn ? pack.basedOn : id;
    seeded = seedRegistersForIndustryPack(seedKey).seeded;
  }

  let seedPromise = Promise.resolve({ ok: false });
  if (isUtilityMappingExclusivePackId(id)) {
    // Dynamic import keeps RAMS/MS/survey seed graphs out of the orgIndustryPacks sync chunk
    // (avoids permits-lib ↔ survey-report circular Vite chunks).
    seedPromise = import("./utilityMappingExclusiveSeeds")
      .then((m) => m.seedUtilityMappingExclusiveContent())
      .catch(() => ({ ok: false }));
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("mysafeops-hidden-modules-updated", { detail: { orgId: raw.orgId } })
    );
  }
  return { seeded, seedPromise };
}

export function getAppliedIndustryPackId() {
  const id = normalizeIndustryPackId(loadOrgSettingsRaw().industryPackId);
  return isValidIndustryPackId(id) ? id : null;
}
