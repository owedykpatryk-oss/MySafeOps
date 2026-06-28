/**
 * Temporary workspace profile preview (session only — module layout changes on Apply).
 */

import { isValidIndustryPackId } from "./orgIndustryPacks";

const PREVIEW_KEY = "mysafeops_industry_pack_preview";
export const INDUSTRY_PREVIEW_UPDATED_EVENT = "mysafeops-industry-preview-updated";

export function getIndustryPackPreviewId() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const id = sessionStorage.getItem(PREVIEW_KEY);
    return isValidIndustryPackId(id) ? id : null;
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
    } else if (isValidIndustryPackId(packId)) {
      sessionStorage.setItem(PREVIEW_KEY, packId);
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
