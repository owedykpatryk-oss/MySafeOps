/**
 * Seed empty registers when applying a workspace profile.
 */

import { seedEmptyRegisters } from "./registerSeedTemplates";
import { resolveProfileBehaviorPackId } from "./customWorkspaceProfiles";

/** Starter rows for key modules per workspace profile (empty registers only). */
export const SEED_MODULES_BY_PACK = {
  generalContractor: ["daily-briefing", "inspections", "snags", "coshh", "toolbox-reg"],
  electricalContractor: ["electrical-pat", "hot-work", "loto", "inspections", "daily-briefing"],
  buildingTrades: ["snags", "inspections", "daily-briefing", "toolbox-reg"],
  surveyingGeodesy: ["inspections", "daily-briefing"],
  foodPharma: ["allergen-changeovers", "gmp-deviations", "ghp-register", "dynamic-ra", "legislation", "daily-briefing", "coshh"],
  facilitiesMaintenance: ["inspections", "electrical-pat", "plant", "daily-briefing"],
  demolitionStripout: ["excavation", "temp-works", "gate", "asbestos", "daily-briefing"],
  contractorPlusSurveying: ["daily-briefing", "inspections", "snags", "coshh"],
  showEverything: ["daily-briefing", "inspections"],
};

/** @param {string} packId */
export function seedRegistersForIndustryPack(packId) {
  const seedKey = resolveProfileBehaviorPackId(packId);
  const moduleIds = SEED_MODULES_BY_PACK[seedKey] || SEED_MODULES_BY_PACK.generalContractor;
  return seedEmptyRegisters(moduleIds);
}

/** @param {string} packId */
export function getSeedModulesPreviewForPack(packId) {
  const seedKey = resolveProfileBehaviorPackId(packId);
  return SEED_MODULES_BY_PACK[seedKey] || SEED_MODULES_BY_PACK.generalContractor;
}
