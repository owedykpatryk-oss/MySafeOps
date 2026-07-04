/**
 * Food & pharma "Setup in an afternoon" onboarding — progress tracking and one-click setup actions.
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack } from "./orgIndustryPacks";
import ALL from "../modules/rams/ramsAllHazards.js";
import { ensureBuiltInConstructionPacks } from "../modules/rams/constructionQuickPacks.js";
import { seedLegislationRegister } from "./ukLegislationLibrary";

const PROGRESS_KEY = "food_pharma_onboarding_progress";
const LEGACY_PROGRESS_KEY = "fess_onboarding_progress";
const QUICK_PACKS_KEY = "rams_quick_packs";
const LEGISLATION_KEY = "legislation_register";

/** @typedef {{ id: string, label: string, hint: string, viewId?: string, autoCheck?: () => boolean }} SetupStep */

/** @type {SetupStep[]} */
export const FOOD_PHARMA_SETUP_STEPS = [
  {
    id: "workspace_profile",
    label: "Apply Food & pharma workspace profile",
    hint: "Shows G&HP, allergen, high-care and hides survey modules.",
    autoCheck: () => loadOrgSettingsRaw().industryPackId === "foodPharma",
  },
  {
    id: "hazard_packs",
    label: "Seed food & pharma hazard quick packs in RAMS Builder",
    hint: "Food factory M&E, lifting, production line and hygiene packs.",
    viewId: "rams",
    autoCheck: () => {
      const packs = load(QUICK_PACKS_KEY, []);
      return packs.some((p) => {
        const id = String(p.id || "");
        return id.startsWith("builtin_food_") || id.startsWith("builtin_fess_");
      });
    },
  },
  {
    id: "legislation",
    label: "Load UK legislation register",
    hint: "HASAWA, PUWER, COSHH, Food Hygiene — review applicability.",
    viewId: "legislation",
    autoCheck: () => load(LEGISLATION_KEY, []).length >= 10,
  },
  {
    id: "coshh_sds",
    label: "COSHH register — substances with SDS URLs",
    hint: "Add sealants, lubricants, cleaning chemicals used on food sites.",
    viewId: "coshh",
    autoCheck: () => {
      const items = load("coshh_register", []);
      return items.length > 0 && items.some((i) => String(i.sdsUrl || "").trim());
    },
  },
  {
    id: "ghp_register",
    label: "Glass & hard plastic (G&HP) register ready",
    hint: "Required for tools/parts brought into production zones.",
    viewId: "ghp-register",
    autoCheck: () => load("ghp_register", []).length > 0,
  },
  {
    id: "project_ae",
    label: "First project with nearest A&E set",
    hint: "Use Enrich site on project — blocks RAMS issue without hospital.",
    viewId: "projects",
    autoCheck: () => {
      const projects = load("mysafeops_projects", []);
      return projects.some((p) => String(p.nearestHospital || "").trim().length > 2);
    },
  },
  {
    id: "food_rams",
    label: "First food factory RAMS using hygiene pack",
    hint: "RAMS Builder → apply Food factory M&E quick pack.",
    viewId: "rams",
    autoCheck: () => {
      const docs = load("rams_builder_docs", []);
      return docs.some((d) => (d.rows || []).some((r) => String(r.templateId || r.id || "").startsWith("fess_")));
    },
  },
  {
    id: "line_clearance_ptw",
    label: "Line clearance permit template issued once",
    hint: "Permits → Line clearance / product isolation.",
    viewId: "permits",
    autoCheck: () => {
      const permits = load("permits_v2", []);
      return permits.some((p) => p.permitType === "line_clearance" || p.type === "line_clearance");
    },
  },
  {
    id: "client_portal",
    label: "Client portal with RAMS approval enabled",
    hint: "Share read-only link — client can approve RAMS.",
    viewId: "client-portal",
    autoCheck: () => load("client_portals", []).length > 0,
  },
  {
    id: "dynamic_ra",
    label: "Dynamic RA process understood",
    hint: "Field DRA register for conditions not in pre-written RAMS.",
    viewId: "dynamic-ra",
    autoCheck: () => load("dynamic_risk_assessments", []).length > 0,
  },
];

function loadProgress() {
  let raw = load(PROGRESS_KEY, null);
  if (!raw || typeof raw !== "object") {
    raw = load(LEGACY_PROGRESS_KEY, {});
  }
  return typeof raw === "object" && raw ? raw : {};
}

/** @returns {{ steps: Array<SetupStep & { done: boolean, manual: boolean }>, pct: number, complete: number, total: number }} */
export function getFoodPharmaSetupStatus() {
  const manual = loadProgress();
  const steps = FOOD_PHARMA_SETUP_STEPS.map((step) => {
    const autoDone = step.autoCheck ? step.autoCheck() : false;
    const manualDone = !!manual[step.id];
    return { ...step, done: autoDone || manualDone, manual: manualDone && !autoDone };
  });
  const complete = steps.filter((s) => s.done).length;
  return { steps, pct: Math.round((complete / steps.length) * 100), complete, total: steps.length };
}

/** @param {string} stepId */
export function markFoodPharmaStepDone(stepId) {
  const next = { ...loadProgress(), [stepId]: new Date().toISOString() };
  save(PROGRESS_KEY, next);
  return next;
}

/** One-click actions for setup steps */
export function runFoodPharmaSetupAction(stepId) {
  switch (stepId) {
    case "workspace_profile":
      applyIndustryPack("foodPharma", { seedTemplates: true });
      markFoodPharmaStepDone(stepId);
      return { ok: true, message: "Food & pharma profile applied with register seeds." };
    case "hazard_packs": {
      const existing = load(QUICK_PACKS_KEY, []);
      const merged = ensureBuiltInConstructionPacks(existing, ALL);
      save(QUICK_PACKS_KEY, merged);
      markFoodPharmaStepDone(stepId);
      return { ok: true, message: `Quick packs ready (${merged.length} total).` };
    }
    case "legislation": {
      const existing = load(LEGISLATION_KEY, []);
      if (existing.length === 0) {
        save(LEGISLATION_KEY, seedLegislationRegister());
      }
      markFoodPharmaStepDone(stepId);
      return { ok: true, message: "Legislation register seeded." };
    }
    default:
      return { ok: false, message: "Open the linked module to complete this step." };
  }
}

export const FOOD_PHARMA_PACK_IDS = new Set(["foodPharma"]);

export function isFoodPharmaPackActive() {
  const id = loadOrgSettingsRaw().industryPackId;
  return FOOD_PHARMA_PACK_IDS.has(id);
}
