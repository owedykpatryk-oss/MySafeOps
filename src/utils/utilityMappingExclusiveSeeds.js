/**
 * Seed Utility Mapping exclusive content (no applyIndustryPack — avoids import cycles).
 */
import { canUseUtilityMappingExclusiveFeatures } from "./utilityMappingExclusive";
import { seedUtilityMappingSurveyTemplates } from "./utilityMappingSurveyDefaults";
import { saveMsStepTemplateOverride } from "./msOrgTemplates";
import { MS_STEP_TEMPLATES } from "../modules/msStepTemplates";
import ALL from "../modules/rams/ramsAllHazards.js";
import { ensureBuiltInConstructionPacks } from "../modules/rams/constructionQuickPacks.js";
import { ensureOrgExclusiveQuickPacks } from "../modules/rams/orgExclusiveQuickPacks.js";
import { loadRamsHazardPacks, saveRamsHazardPacks } from "./ramsHazardPacksStorage";

/** Seed packs / MS / survey defaults after Utility Mapping pack is applied. */
export function seedUtilityMappingExclusiveContent() {
  if (!canUseUtilityMappingExclusiveFeatures()) return { ok: false };
  const existing = loadRamsHazardPacks([]);
  const withBuiltIn = ensureBuiltInConstructionPacks(existing, ALL);
  saveRamsHazardPacks(ensureOrgExclusiveQuickPacks(withBuiltIn, ALL));
  saveMsStepTemplateOverride("pas128Mobilisation", MS_STEP_TEMPLATES.pas128Mobilisation.join("\n"));
  seedUtilityMappingSurveyTemplates();
  return { ok: true };
}
