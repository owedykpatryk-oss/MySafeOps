/**
 * Lightweight industry pack label — safe for RAMS builder (no survey/GPR/permits graph).
 */
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { getIndustryPackPreviewId } from "./industryPackPreview";
import { INDUSTRY_PACKS, normalizeIndustryPackId } from "./industryPackCatalog";
import { isFessOrg } from "./fessOrg";
import { FESS_GROUP_PACK_ID, getFessGroupWorkspacePack, isFessExclusivePackId } from "./fessWorkspaceProfile";

function readAppliedIndustryPackId() {
  try {
    const id = normalizeIndustryPackId(loadOrgSettingsRaw()?.industryPackId);
    return id || null;
  } catch {
    return null;
  }
}

function resolvePackId(packId) {
  if (packId != null && String(packId).trim()) return normalizeIndustryPackId(packId) || String(packId).trim();
  return getIndustryPackPreviewId() || readAppliedIndustryPackId() || "generalContractor";
}

/** @param {string} [packId] */
export function getIndustryPackLabel(packId) {
  const id = resolvePackId(packId);
  if (isFessExclusivePackId(id) || id === FESS_GROUP_PACK_ID) {
    if (isFessOrg()) return getFessGroupWorkspacePack()?.label || "FESS Group";
  }
  return INDUSTRY_PACKS[id]?.label || INDUSTRY_PACKS.generalContractor.label;
}
