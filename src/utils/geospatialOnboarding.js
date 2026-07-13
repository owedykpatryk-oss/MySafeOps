/**
 * Geospatial / surveying onboarding — utility mapping, aerial, laser scan, marine, rail.
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack } from "./orgIndustryPacks";
import ALL from "../modules/rams/ramsAllHazards.js";
import { ensureBuiltInConstructionPacks } from "../modules/rams/constructionQuickPacks.js";
import { seedLegislationRegisterForMarket } from "./legislationLibrary";
import { getOrgMarketId } from "./orgMarket";
import { loadRamsHazardPacks, saveRamsHazardPacks } from "./ramsHazardPacksStorage";

const PROGRESS_KEY = "geospatial_onboarding_progress";
const LEGISLATION_KEY = "legislation_register";

/** @typedef {{ id: string, label: string, hint: string, viewId?: string, autoCheck?: () => boolean }} SetupStep */

/** @type {SetupStep[]} */
export const GEOSPATIAL_SETUP_STEPS = [
  {
    id: "workspace_profile",
    label: "Apply Surveying & geodesy workspace profile",
    hint: "Survey reports, PAS128/AS5488 packs, aerial and marine RAMS.",
    autoCheck: () => loadOrgSettingsRaw().industryPackId === "surveyingGeodesy",
  },
  {
    id: "geospatial_packs",
    label: "Seed surveying & GI RAMS quick packs",
    hint: "Utility mapping, geospatial, site investigation (DCP, boreholes, coring) and related packs.",
    viewId: "rams",
    autoCheck: () => {
      const packs = loadRamsHazardPacks([]);
      return (
        packs.some((p) => String(p.id || "").startsWith("builtin_geospatial_")) &&
        packs.some((p) => String(p.id || "").startsWith("builtin_site_investigation_"))
      );
    },
  },
  {
    id: "legislation",
    label: "Load UK legislation register",
    hint: "PAS 128, HSG47, Confined Spaces, CAA — review applicability.",
    viewId: "legislation",
    autoCheck: () => load(LEGISLATION_KEY, []).length >= 10,
  },
  {
    id: "first_project",
    label: "First survey project with site enrichment",
    hint: "Project hub — nearest A&E, client and corridor metadata for mobilisation MS.",
    viewId: "projects",
    autoCheck: () => {
      const projects = load("mysafeops_projects", []);
      return projects.some((p) => String(p.nearestHospital || "").trim().length > 2);
    },
  },
  {
    id: "utility_rams",
    label: "Utility or GI RAMS issued",
    hint: "RAMS Builder → PAS128/AS5488 pack or site investigation surveying pack (trial pit, DCP, borehole).",
    viewId: "rams",
    autoCheck: () => {
      const docs = load("rams_builder_docs", []);
      return docs.some((d) => d.status === "issued" || d.status === "approved" || d.signed);
    },
  },
  {
    id: "gi_project",
    label: "Site investigation project created",
    hint: "Project hub → Site investigation & geotechnics playbook (or utility mapping for PAS128).",
    viewId: "projects",
    autoCheck: () => {
      const projects = load("mysafeops_projects", []);
      return projects.some((p) => p.playbookId === "site_investigation" || p.playbookId === "utility_mapping");
    },
  },
  {
    id: "survey_deliverable",
    label: "First survey deliverable drafted",
    hint: "Survey report module — mobilisation MS, QA checklist and calibration log.",
    viewId: "survey-report",
    autoCheck: () => load("survey_reports", []).length > 0,
  },
  {
    id: "gpr_deliverable",
    label: "First GPR report drafted",
    hint: "GPR report — equipment preset, BGS geology and radargram evidence.",
    viewId: "gpr-report",
    autoCheck: () => load("gpr_reports", []).length > 0,
  },
  {
    id: "excavation_permit",
    label: "Permit-to-dig / field campaign permit issued",
    hint: "PTW → excavation, marine, aerial coordination or rail corridor as required.",
    viewId: "permits",
    autoCheck: () => {
      const permits = load("permits_v2", []);
      return permits.some(
        (p) =>
          (p.status === "active" || p.status === "issued") &&
          ["excavation", "marine_hydrographic", "aerial_survey_coordination", "rail_corridor_access"].includes(p.type)
      );
    },
  },
  {
    id: "geo_photos",
    label: "Geo photos / field evidence logged",
    hint: "Trial pit, borehole, DCP point, chamber, scan proof or mobilisation photos.",
    viewId: "geo-photos",
    autoCheck: () => load("geo_photos", []).length > 0,
  },
];

function loadProgress() {
  const raw = load(PROGRESS_KEY, {});
  return typeof raw === "object" && raw ? raw : {};
}

/** @returns {{ steps: Array<SetupStep & { done: boolean, manual: boolean }>, pct: number, complete: number, total: number }} */
export function getGeospatialSetupStatus() {
  const manual = loadProgress();
  const steps = GEOSPATIAL_SETUP_STEPS.map((step) => {
    const autoDone = step.autoCheck ? step.autoCheck() : false;
    const manualDone = !!manual[step.id];
    return { ...step, done: autoDone || manualDone, manual: manualDone && !autoDone };
  });
  const complete = steps.filter((s) => s.done).length;
  return { steps, pct: Math.round((complete / steps.length) * 100), complete, total: steps.length };
}

/** @param {string} stepId */
export function markGeospatialStepDone(stepId) {
  const next = { ...loadProgress(), [stepId]: new Date().toISOString() };
  save(PROGRESS_KEY, next);
  return next;
}

/** One-click actions for geospatial setup steps */
export function runGeospatialSetupAction(stepId) {
  switch (stepId) {
    case "workspace_profile":
      applyIndustryPack("surveyingGeodesy", { seedTemplates: true });
      markGeospatialStepDone(stepId);
      return { ok: true, message: "Surveying & geodesy profile applied." };
    case "geospatial_packs": {
      const existing = loadRamsHazardPacks([]);
      const merged = ensureBuiltInConstructionPacks(existing, ALL);
      saveRamsHazardPacks(merged);
      markGeospatialStepDone(stepId);
      return { ok: true, message: `Surveying & GI quick packs ready (${merged.length} total).` };
    }
    case "legislation": {
      const existing = load(LEGISLATION_KEY, []);
      if (existing.length === 0) {
        save(LEGISLATION_KEY, seedLegislationRegisterForMarket(getOrgMarketId()));
      }
      markGeospatialStepDone(stepId);
      return { ok: true, message: "Legislation register seeded." };
    }
    default:
      return { ok: false, message: "Open the linked module to complete this step." };
  }
}

export const GEOSPATIAL_PACK_IDS = new Set(["surveyingGeodesy", "contractorPlusSurveying"]);

export function isGeospatialPackActive() {
  const id = loadOrgSettingsRaw().industryPackId;
  return GEOSPATIAL_PACK_IDS.has(id);
}
