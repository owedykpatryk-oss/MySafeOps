/**
 * Default PTW type sets per workspace profile — data only (no orgIndustryPacks import).
 */
import { PERMIT_TYPES } from "./permitTypes";

/** Default enabled PTW types when applying a workspace profile (3–8 typical). */
export const PACK_DEFAULT_PERMIT_TYPES = {
  generalContractor: ["hot_work", "excavation", "electrical", "work_at_height", "confined_space", "lifting", "general"],
  electricalContractor: ["hot_work", "electrical", "cold_work", "work_at_height", "general"],
  buildingTrades: ["hot_work", "excavation", "work_at_height", "roof_access", "general"],
  facilitiesMaintenance: ["cold_work", "electrical", "hot_work", "work_at_height", "visitor_access", "general"],
  demolitionStripout: ["excavation", "hot_work", "ground_disturbance", "confined_space", "general"],
  civilEarthworks: ["excavation", "ground_disturbance", "hot_work", "work_at_height", "lifting", "general"],
  surveyingGeodesy: ["excavation", "ground_disturbance", "aerial_survey_coordination", "marine_hydrographic", "visitor_access", "general"],
  contractorPlusSurveying: ["hot_work", "excavation", "electrical", "work_at_height", "aerial_survey_coordination", "general"],
  foodPharma: ["hot_work", "line_clearance", "cold_work", "confined_space", "visitor_access", "general"],
  fessGroup: ["hot_work", "line_clearance", "cold_work", "confined_space", "visitor_access", "loto", "general"],
  utilityMapping: ["excavation", "ground_disturbance", "visitor_access", "general"],
  showEverything: [],
};

export function allPermitTypeIds() {
  return Object.keys(PERMIT_TYPES);
}

export function normalizeEnabledPermitTypeIds(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(allPermitTypeIds());
  return [...new Set(raw.map((t) => String(t || "").trim()).filter((t) => valid.has(t)))].slice(0, 15);
}
