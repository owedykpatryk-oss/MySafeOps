/**
 * Persist FESS workspace focus on boot — pack id, menu hides, keep field-ops modules visible.
 * Mirrors Utility Mapping branding ensure: non-blocking, idempotent.
 */
import { getOrgId } from "./orgId";
import { isFessOrg } from "./fessOrg";
import {
  FESS_GROUP_PACK_ID,
  getFessGroupWorkspacePack,
} from "./fessWorkspaceProfile";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { RAMS_FEATURES } from "./ramsFeatureIds";
import { HIDDEN_MODULES_UPDATED_EVENT } from "./hiddenModules";

/**
 * @param {string} [orgId]
 * @param {{ force?: boolean }} [opts]
 * @returns {boolean} true when settings were written
 */
export function ensureFessWorkspaceFocus(orgId = getOrgId(), opts = {}) {
  const raw = loadOrgSettingsRaw(orgId);
  if (!opts.force && !isFessOrg(orgId, raw)) return false;

  const pack = getFessGroupWorkspacePack();
  const next = { ...raw };
  let changed = false;

  const packId = String(next.industryPackId || "").trim();
  if (!packId || packId === "generalContractor" || packId === "foodPharma" || packId === "surveyingGeodesy") {
    next.industryPackId = FESS_GROUP_PACK_ID;
    changed = true;
  } else if (packId !== FESS_GROUP_PACK_ID && isFessOrg(orgId, raw)) {
    // FESS tenant should stay on the exclusive pack unless they built a custom profile.
    if (!String(packId).startsWith("custom_")) {
      next.industryPackId = FESS_GROUP_PACK_ID;
      changed = true;
    }
  }

  let hiddenModules = Array.isArray(next.hiddenModules)
    ? [...next.hiddenModules]
    : [];
  const beforeModules = hiddenModules.join("\0");
  for (const id of pack.hiddenModules || []) {
    if (!hiddenModules.includes(id)) hiddenModules.push(id);
  }
  if (Array.isArray(pack.showModules) && pack.showModules.length) {
    const keep = new Set(pack.showModules);
    hiddenModules = hiddenModules.filter((id) => !keep.has(id));
  }
  if (hiddenModules.join("\0") !== beforeModules) {
    next.hiddenModules = hiddenModules;
    next.hiddenModulesBootstrapped = true;
    changed = true;
  }

  let hiddenFeatures = Array.isArray(next.hiddenFeatures)
    ? [...next.hiddenFeatures]
    : [];
  if (!hiddenFeatures.includes(RAMS_FEATURES.SURVEYING)) {
    hiddenFeatures.push(RAMS_FEATURES.SURVEYING);
    next.hiddenFeatures = hiddenFeatures;
    changed = true;
  }

  if (Array.isArray(pack.industrySectors) && pack.industrySectors.length) {
    const cur = Array.isArray(next.industrySectors) ? next.industrySectors.join(",") : "";
    const want = pack.industrySectors.join(",");
    if (cur !== want) {
      next.industrySectors = [...pack.industrySectors];
      changed = true;
    }
  }

  if (!changed) return false;
  saveOrgSettingsRaw(next, orgId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(HIDDEN_MODULES_UPDATED_EVENT, { detail: { orgId: next.orgId || orgId } })
    );
  }
  return true;
}
