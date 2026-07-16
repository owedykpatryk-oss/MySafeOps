/**
 * Utility Mapping onboarding — apply exclusive pack, RAMS packs, PAS128 MS, survey defaults.
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack } from "./orgIndustryPacks";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";
import { canUseUtilityMappingExclusiveFeatures } from "./utilityMappingExclusive";
import { seedUtilityMappingSurveyTemplates } from "./utilityMappingSurveyDefaults";
import { saveMsStepTemplateOverride } from "./msOrgTemplates";
import { MS_STEP_TEMPLATES } from "../modules/msStepTemplates";
import ALL from "../modules/rams/ramsAllHazards.js";
import { ensureBuiltInConstructionPacks } from "../modules/rams/constructionQuickPacks.js";
import { ensureOrgExclusiveQuickPacks } from "../modules/rams/orgExclusiveQuickPacks.js";
import { loadRamsHazardPacks, saveRamsHazardPacks } from "./ramsHazardPacksStorage";
import { seedLegislationRegisterForMarket } from "./legislationLibrary";
import { getOrgMarketId } from "./orgMarket";
import { UM_PAS128_BASELINE_PACK_DEF, UM_GPR_DAY_PACK_DEF } from "./utilityMappingQuickPacks";

const PROGRESS_KEY = "utility_mapping_onboarding_progress";
const LEGISLATION_KEY = "legislation_register";

/** @typedef {{ id: string, label: string, hint: string, viewId?: string, autoCheck?: () => boolean }} SetupStep */

/** @type {SetupStep[]} */
export const UTILITY_MAPPING_SETUP_STEPS = [
  {
    id: "workspace_profile",
    label: "Apply Utility Mapping workspace profile",
    hint: "PAS128 survey, GPR, geo-photos, geospatial RAMS and permit to dig — navy/cyan covers.",
    autoCheck: () => loadOrgSettingsRaw().industryPackId === UTILITY_MAPPING_PACK_ID,
  },
  {
    id: "um_rams_packs",
    label: "Seed UM PAS128 / GPR RAMS quick packs",
    hint: "Org-exclusive baseline, GPR day, EML, chamber and service-clearance packs.",
    viewId: "rams",
    autoCheck: () => {
      const packs = loadRamsHazardPacks([]);
      return (
        packs.some((p) => p.id === UM_PAS128_BASELINE_PACK_DEF.id) &&
        packs.some((p) => p.id === UM_GPR_DAY_PACK_DEF.id)
      );
    },
  },
  {
    id: "pas128_ms",
    label: "Load PAS128 mobilisation method steps",
    hint: "Records → EML → GPR → topo capture → geo-photos → demob (from UM Word workflow).",
    viewId: "method-statement",
    autoCheck: () => {
      const steps = loadOrgSettingsRaw().msStepTemplates?.pas128Mobilisation;
      return Array.isArray(steps) && steps.length >= 6;
    },
  },
  {
    id: "survey_templates",
    label: "Seed PAS128 survey report defaults",
    hint: "Scope, methodology, equipment and deliverables aligned to Utility Mapping templates.",
    viewId: "survey-report",
    autoCheck: () => {
      const t = loadOrgSettingsRaw().surveyTypeTemplates?.utility_mapping_survey;
      return Boolean(t?.methodology && String(t.methodology).includes("Utility Mapping PAS128"));
    },
  },
  {
    id: "legislation",
    label: "Load UK legislation register",
    hint: "PAS 128, HSG47, Confined Spaces — review applicability.",
    viewId: "legislation",
    autoCheck: () => load(LEGISLATION_KEY, []).length >= 10,
  },
  {
    id: "first_project",
    label: "First PAS128 project created",
    hint: "Project hub → UM PAS128 M2 / M2P / M4P or service clearance playbook.",
    viewId: "projects",
    autoCheck: () => {
      const projects = load("mysafeops_projects", []);
      return projects.some(
        (p) =>
          String(p.playbookId || "").startsWith("um_") ||
          p.playbookId === "utility_mapping" ||
          p.playbookId === "topo_plus_utility"
      );
    },
  },
  {
    id: "survey_deliverable",
    label: "First survey report drafted",
    hint: "Survey report — PAS128 M-series cover with Utility Mapping branding.",
    viewId: "survey-report",
    autoCheck: () => load("survey_reports", []).length > 0,
  },
  {
    id: "gpr_deliverable",
    label: "First GPR report drafted",
    hint: "GPR report module — equipment and anomaly evidence.",
    viewId: "gpr-report",
    autoCheck: () => load("gpr_reports", []).length > 0,
  },
  {
    id: "geo_photos",
    label: "Geo-photos captured on a job",
    hint: "Entrance, buried-services warning, CAT locate, GPR setup, manhole.",
    viewId: "geo-photos",
    autoCheck: () => load("geo_photos", []).length > 0,
  },
  {
    id: "excavation_permit",
    label: "Permit to dig issued",
    hint: "PTW → excavation / ground disturbance with PAS128 dig guidance.",
    viewId: "permits",
    autoCheck: () => {
      const permits = load("permits_v2", []);
      return permits.some(
        (p) =>
          (p.status === "active" || p.status === "issued") &&
          ["excavation", "ground_disturbance"].includes(p.type)
      );
    },
  },
];

export function isUtilityMappingSetupActive() {
  return canUseUtilityMappingExclusiveFeatures();
}

export function getUtilityMappingSetupProgress() {
  return load(PROGRESS_KEY, {});
}

export function markUtilityMappingStepDone(stepId) {
  const progress = { ...getUtilityMappingSetupProgress(), [stepId]: true };
  save(PROGRESS_KEY, progress);
  return progress;
}

export function getUtilityMappingSetupStatus() {
  if (!isUtilityMappingSetupActive()) {
    return { steps: [], complete: 0, total: 0, pct: 0 };
  }
  const progress = getUtilityMappingSetupProgress();
  const steps = UTILITY_MAPPING_SETUP_STEPS.map((step) => {
    const auto = typeof step.autoCheck === "function" ? Boolean(step.autoCheck()) : false;
    const done = auto || Boolean(progress[step.id]);
    return { ...step, done, auto };
  });
  const complete = steps.filter((s) => s.done).length;
  const total = steps.length;
  return {
    steps,
    complete,
    total,
    pct: total ? Math.round((complete / total) * 100) : 0,
  };
}

/** @param {string} stepId */
export function runUtilityMappingSetupAction(stepId) {
  if (!isUtilityMappingSetupActive()) {
    return { ok: false, message: "Utility Mapping setup is only available for that organisation." };
  }

  switch (stepId) {
    case "workspace_profile": {
      applyIndustryPack(UTILITY_MAPPING_PACK_ID, { seedTemplates: true });
      markUtilityMappingStepDone(stepId);
      return { ok: true, message: "Utility Mapping profile applied — branding, modules and permits set." };
    }
    case "um_rams_packs": {
      const existing = loadRamsHazardPacks([]);
      const withBuiltIn = ensureBuiltInConstructionPacks(existing, ALL);
      const merged = ensureOrgExclusiveQuickPacks(withBuiltIn, ALL);
      saveRamsHazardPacks(merged);
      markUtilityMappingStepDone(stepId);
      return { ok: true, message: "UM PAS128 / GPR quick packs seeded in RAMS." };
    }
    case "pas128_ms": {
      const steps = MS_STEP_TEMPLATES.pas128Mobilisation;
      saveMsStepTemplateOverride("pas128Mobilisation", steps.join("\n"));
      markUtilityMappingStepDone(stepId);
      return { ok: true, message: "PAS128 mobilisation method steps loaded." };
    }
    case "survey_templates": {
      const result = seedUtilityMappingSurveyTemplates();
      markUtilityMappingStepDone(stepId);
      return {
        ok: result.ok,
        message: result.ok
          ? `Survey defaults seeded (${result.seeded.join(", ")}).`
          : "Could not seed survey templates.",
      };
    }
    case "legislation": {
      seedLegislationRegisterForMarket(getOrgMarketId());
      markUtilityMappingStepDone(stepId);
      return { ok: true, message: "Legislation register seeded." };
    }
    default:
      return { ok: false, message: "Open the linked module to complete this step." };
  }
}
