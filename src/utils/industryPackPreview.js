/**
 * Temporary workspace profile preview (session only — module layout changes on Apply).
 */

import { isCustomWorkspacePackId } from "./customWorkspaceProfilesCloud";
import { FESS_GROUP_PACK_ID } from "./fessWorkspaceProfile";
import { isBuiltInIndustryPackId, normalizeIndustryPackId } from "./industryPackCatalog";

const PREVIEW_KEY = "mysafeops_industry_pack_preview";
export const INDUSTRY_PREVIEW_UPDATED_EVENT = "mysafeops-industry-preview-updated";

function isPreviewableIndustryPackId(packKey) {
  const id = normalizeIndustryPackId(packKey);
  return Boolean(id && (isBuiltInIndustryPackId(id) || isCustomWorkspacePackId(id) || id === FESS_GROUP_PACK_ID));
}

export function getIndustryPackPreviewId() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const id = sessionStorage.getItem(PREVIEW_KEY);
    return isPreviewableIndustryPackId(id) ? normalizeIndustryPackId(id) : null;
  } catch {
    return null;
  }
}

/** @param {string | null} packId */
export function setIndustryPackPreview(packId) {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!packId) {
      sessionStorage.removeItem(PREVIEW_KEY);
    } else if (isPreviewableIndustryPackId(packId)) {
      sessionStorage.setItem(PREVIEW_KEY, normalizeIndustryPackId(packId));
    }
    window.dispatchEvent(new CustomEvent(INDUSTRY_PREVIEW_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function clearIndustryPackPreview() {
  setIndustryPackPreview(null);
}

export function isIndustryPackPreviewActive() {
  return Boolean(getIndustryPackPreviewId());
}
