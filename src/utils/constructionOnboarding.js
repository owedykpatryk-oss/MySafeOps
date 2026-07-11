/**
 * Construction "Setup in an afternoon" onboarding — CDM, RAMS, PTW, briefing, client portal.
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack } from "./orgIndustryPacks";
import ALL from "../modules/rams/ramsAllHazards.js";
import { ensureBuiltInConstructionPacks } from "../modules/rams/constructionQuickPacks.js";
import { seedLegislationRegister } from "./ukLegislationLibrary";
import { loadPublishedPortalTokens } from "./clientPortalPublished";
import { loadRamsHazardPacks, saveRamsHazardPacks } from "./ramsHazardPacksStorage";

const PROGRESS_KEY = "construction_onboarding_progress";
const LEGISLATION_KEY = "legislation_register";

/** @typedef {{ id: string, label: string, hint: string, viewId?: string, autoCheck?: () => boolean }} SetupStep */

/** @type {SetupStep[]} */
export const CONSTRUCTION_SETUP_STEPS = [
  {
    id: "workspace_profile",
    label: "Apply General contractor workspace profile",
    hint: "Shows daily briefing, inspections, snags and hides food/pharma modules.",
    autoCheck: () => {
      const id = loadOrgSettingsRaw().industryPackId;
      return id === "generalContractor" || id === "buildingTrades";
    },
  },
  {
    id: "hazard_packs",
    label: "Seed construction RAMS quick packs",
    hint: "Hot works, height, excavation, electrical — ready in RAMS Builder.",
    viewId: "rams",
    autoCheck: () => {
      const packs = loadRamsHazardPacks([]);
      return packs.some((p) => String(p.id || "").startsWith("builtin_"));
    },
  },
  {
    id: "legislation",
    label: "Load UK legislation register",
    hint: "CDM 2015, HASAWA, PUWER, COSHH — review applicability.",
    viewId: "legislation",
    autoCheck: () => load(LEGISLATION_KEY, []).length >= 10,
  },
  {
    id: "first_project",
    label: "First project with nearest A&E",
    hint: "Enrich site on project — blocks RAMS issue without hospital details.",
    viewId: "projects",
    autoCheck: () => {
      const projects = load("mysafeops_projects", []);
      return projects.some((p) => String(p.nearestHospital || "").trim().length > 2);
    },
  },
  {
    id: "cdm_pack",
    label: "CDM compliance pack started",
    hint: "CDM module → create CPP / pre-construction pack for your project.",
    viewId: "cdm",
    autoCheck: () => load("cdm_packs", []).length > 0,
  },
  {
    id: "first_rams",
    label: "First site RAMS issued",
    hint: "RAMS Builder → apply construction quick pack and issue to site.",
    viewId: "rams",
    autoCheck: () => {
      const docs = load("rams_builder_docs", []);
      return docs.some((d) => d.status === "issued" || d.status === "approved" || d.signed);
    },
  },
  {
    id: "daily_briefing",
    label: "Daily briefing recorded",
    hint: "Capture weather, scope and signed attendance before work starts.",
    viewId: "daily-briefing",
    autoCheck: () => load("daily_briefings", []).length > 0,
  },
  {
    id: "first_permit",
    label: "First permit to work issued",
    hint: "Permits → hot work, height or excavation — link to project RAMS.",
    viewId: "permits",
    autoCheck: () => {
      const permits = load("permits_v2", []);
      return permits.some((p) => p.status === "active" || p.status === "issued");
    },
  },
  {
    id: "client_portal",
    label: "Client portal published",
    hint: "Share read-only compliance view — publish cloud for any device.",
    viewId: "client-portal",
    autoCheck: () => loadPublishedPortalTokens().size > 0 || load("client_portals", []).length > 0,
  },
  {
    id: "inspections",
    label: "Equipment inspection register started",
    hint: "LOLER, scaffold or plant pre-use checks on site.",
    viewId: "inspections",
    autoCheck: () => load("inspection_records", []).length > 0,
  },
];

function loadProgress() {
  const raw = load(PROGRESS_KEY, {});
  return typeof raw === "object" && raw ? raw : {};
}

/** @returns {{ steps: Array<SetupStep & { done: boolean, manual: boolean }>, pct: number, complete: number, total: number }} */
export function getConstructionSetupStatus() {
  const manual = loadProgress();
  const steps = CONSTRUCTION_SETUP_STEPS.map((step) => {
    const autoDone = step.autoCheck ? step.autoCheck() : false;
    const manualDone = !!manual[step.id];
    return { ...step, done: autoDone || manualDone, manual: manualDone && !autoDone };
  });
  const complete = steps.filter((s) => s.done).length;
  return { steps, pct: Math.round((complete / steps.length) * 100), complete, total: steps.length };
}

/** @param {string} stepId */
export function markConstructionStepDone(stepId) {
  const next = { ...loadProgress(), [stepId]: new Date().toISOString() };
  save(PROGRESS_KEY, next);
  return next;
}

/** One-click actions for setup steps */
export function runConstructionSetupAction(stepId) {
  switch (stepId) {
    case "workspace_profile":
      applyIndustryPack("generalContractor", { seedTemplates: true });
      markConstructionStepDone(stepId);
      return { ok: true, message: "General contractor profile applied with register seeds." };
    case "hazard_packs": {
      const existing = loadRamsHazardPacks([]);
      const merged = ensureBuiltInConstructionPacks(existing, ALL);
      saveRamsHazardPacks(merged);
      markConstructionStepDone(stepId);
      return { ok: true, message: `Construction quick packs ready (${merged.length} total).` };
    }
    case "legislation": {
      const existing = load(LEGISLATION_KEY, []);
      if (existing.length === 0) {
        save(LEGISLATION_KEY, seedLegislationRegister());
      }
      markConstructionStepDone(stepId);
      return { ok: true, message: "Legislation register seeded." };
    }
    default:
      return { ok: false, message: "Open the linked module to complete this step." };
  }
}

/** Show construction setup banner for these packs. */
export const CONSTRUCTION_PACK_IDS = new Set(["generalContractor", "buildingTrades"]);

export function isConstructionPackActive() {
  const id = loadOrgSettingsRaw().industryPackId;
  return CONSTRUCTION_PACK_IDS.has(id);
}
