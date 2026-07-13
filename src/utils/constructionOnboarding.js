/**
 * Construction "Setup in an afternoon" onboarding — CDM/WHS, RAMS/SWMS, PTW, briefing, client portal.
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack } from "./orgIndustryPacks";
import ALL from "../modules/rams/ramsAllHazards.js";
import { ensureBuiltInConstructionPacks } from "../modules/rams/constructionQuickPacks.js";
import { seedLegislationRegisterForMarket } from "./legislationLibrary";
import { loadPublishedPortalTokens } from "./clientPortalPublished";
import { loadRamsHazardPacks, saveRamsHazardPacks } from "./ramsHazardPacksStorage";
import { getOrgMarketId } from "./orgMarket";
import { getAppUiCopy } from "../data/appUiCopy";
import { getCompliancePackContent } from "../config/compliancePackContent";
import {
  getCdmStepHint,
  getCdmStepLabel,
  getEmergencyServicesLabel,
  getFirstRamsStepHint,
  getFirstRamsStepLabel,
  getHazardPacksStepLabel,
  getLegislationSeedHint,
  getLegislationSeedLabel,
  getPermitStepLabel,
  getPermitStepHint,
  getBriefingStepLabel,
  getBriefingStepHint,
} from "./marketLabels";

const PROGRESS_KEY = "construction_onboarding_progress";
const LEGISLATION_KEY = "legislation_register";

/** @typedef {{ id: string, label: string, hint: string, viewId?: string, autoCheck?: () => boolean }} SetupStep */

/** @param {import("../config/markets").MarketId} [marketId] */
export function buildConstructionSetupSteps(marketId = getOrgMarketId()) {
  const edLabel = getEmergencyServicesLabel(marketId);
  const ui = getAppUiCopy(marketId);
  const steps = ui.constructionSteps;
  return [
    {
      id: "workspace_profile",
      label: steps.workspaceProfile || "Apply General contractor workspace profile",
      hint: steps.workspaceProfileHint || "Shows daily briefing, inspections, snags and hides food/pharma modules.",
      autoCheck: () => {
        const id = loadOrgSettingsRaw().industryPackId;
        return id === "generalContractor" || id === "buildingTrades";
      },
    },
    {
      id: "hazard_packs",
      label: getHazardPacksStepLabel(marketId),
      hint: steps.hazardPacksHint || "Hot works, height, excavation, electrical — ready in RAMS Builder.",
      viewId: "rams",
      autoCheck: () => {
        const packs = loadRamsHazardPacks([]);
        return packs.some((p) => String(p.id || "").startsWith("builtin_"));
      },
    },
    {
      id: "legislation",
      label: getLegislationSeedLabel(marketId),
      hint: getLegislationSeedHint(marketId),
      viewId: "legislation",
      autoCheck: () => load(LEGISLATION_KEY, []).length >= 10,
    },
    {
      id: "first_project",
      label: typeof steps.firstProject === "function" ? steps.firstProject(edLabel) : `First project with ${edLabel}`,
      hint: steps.firstProjectHint || `Enrich site on project — blocks RAMS/SWMS issue without emergency hospital details.`,
      viewId: "projects",
      autoCheck: () => {
        const projects = load("mysafeops_projects", []);
        return projects.some((p) => String(p.nearestHospital || "").trim().length > 2);
      },
    },
    {
      id: "cdm_pack",
      label: getCdmStepLabel(marketId),
      hint: getCdmStepHint(marketId),
      viewId: getCompliancePackContent(marketId).moduleId,
      autoCheck: () => load("cdm_packs", []).length > 0,
    },
    {
      id: "first_rams",
      label: getFirstRamsStepLabel(marketId),
      hint: getFirstRamsStepHint(marketId),
      viewId: "rams",
      autoCheck: () => {
        const docs = load("rams_builder_docs", []);
        return docs.some((d) => d.status === "issued" || d.status === "approved" || d.signed);
      },
    },
    {
      id: "daily_briefing",
      label: getBriefingStepLabel(marketId),
      hint: getBriefingStepHint(marketId),
      viewId: "daily-briefing",
      autoCheck: () => load("daily_briefings", []).length > 0,
    },
    {
      id: "first_permit",
      label: getPermitStepLabel(marketId),
      hint: getPermitStepHint(marketId),
      viewId: "permits",
      autoCheck: () => {
        const permits = load("permits_v2", []);
        return permits.some((p) => p.status === "active" || p.status === "issued");
      },
    },
    {
      id: "client_portal",
      label: steps.clientPortal || "Client portal published",
      hint: steps.clientPortalHint || "Share read-only compliance view — publish cloud for any device.",
      viewId: "client-portal",
      autoCheck: () => loadPublishedPortalTokens().size > 0 || load("client_portals", []).length > 0,
    },
    {
      id: "inspections",
      label: steps.inspections || "Equipment inspection register started",
      hint: marketId === "pl" ? "UDT, rusztowania lub kontrole przed użyciem na budowie." : marketId === "au" ? "Plant, scaffold or pre-use checks on site." : "LOLER, scaffold or plant pre-use checks on site.",
      viewId: "inspections",
      autoCheck: () => load("inspection_records", []).length > 0,
    },
  ];
}

/** @deprecated use buildConstructionSetupSteps() */
export const CONSTRUCTION_SETUP_STEPS = buildConstructionSetupSteps("uk");

function loadProgress() {
  const raw = load(PROGRESS_KEY, {});
  return typeof raw === "object" && raw ? raw : {};
}

/** @param {import("../config/markets").MarketId} [marketId] */
export function getConstructionSetupStatus(marketId = getOrgMarketId()) {
  const manual = loadProgress();
  const steps = buildConstructionSetupSteps(marketId).map((step) => {
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
  const marketId = getOrgMarketId();
  const actions = getAppUiCopy(marketId).constructionActions;
  switch (stepId) {
    case "workspace_profile":
      applyIndustryPack("generalContractor", { seedTemplates: true });
      markConstructionStepDone(stepId);
      return { ok: true, message: actions.workspaceProfile || "General contractor profile applied with register seeds." };
    case "hazard_packs": {
      const existing = loadRamsHazardPacks([]);
      const merged = ensureBuiltInConstructionPacks(existing, ALL, marketId);
      saveRamsHazardPacks(merged);
      markConstructionStepDone(stepId);
      const msg = typeof actions.hazardPacks === "function" ? actions.hazardPacks(merged.length) : `Construction quick packs ready (${merged.length} total).`;
      return { ok: true, message: msg };
    }
    case "legislation": {
      const existing = load(LEGISLATION_KEY, []);
      if (existing.length === 0) {
        save(LEGISLATION_KEY, seedLegislationRegisterForMarket(marketId));
      }
      markConstructionStepDone(stepId);
      return { ok: true, message: actions.legislation || "Legislation register seeded." };
    }
    default:
      return { ok: false, message: actions.default || "Open the linked module to complete this step." };
  }
}

/** Show construction setup banner for these packs. */
export const CONSTRUCTION_PACK_IDS = new Set(["generalContractor", "buildingTrades"]);

export function isConstructionPackActive() {
  const id = loadOrgSettingsRaw().industryPackId;
  return CONSTRUCTION_PACK_IDS.has(id);
}
