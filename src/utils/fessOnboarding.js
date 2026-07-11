/**
 * FESS Group onboarding — org-exclusive setup checklist and one-click actions.
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadRamsHazardPacks, saveRamsHazardPacks } from "./ramsHazardPacksStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { applyIndustryPack } from "./orgIndustryPacks";
import { FESS_GROUP_PACK_ID } from "./fessWorkspaceProfile";
import { isFessOrg } from "./fessOrg";
import ALL from "../modules/rams/ramsAllHazards.js";
import { ensureBuiltInConstructionPacks } from "../modules/rams/constructionQuickPacks.js";
import { ensureOrgExclusiveQuickPacks } from "../modules/rams/orgExclusiveQuickPacks.js";
import { seedLegislationRegister } from "./ukLegislationLibrary";
import { saveMsStepTemplateOverride } from "./msOrgTemplates";
import { seedFessClientSiteProjects } from "./fessClientSites";
import { seedFessCoshhRegister } from "./fessCoshhDefaults";
import { seedFessSitePortals } from "./fessPortalPreset";
import { seedFessSiteBriefing } from "./fessBriefingRecord";
import { seedFessSiteContacts } from "./fessSiteContacts";
import { seedFessGhpRegister } from "./fessGhpDefaults";
import { seedFessLotoRegister } from "./fessLotoDefaults";
import { getFessPortalPublishStatus } from "./fessPortalPublish";

const PROGRESS_KEY = "fess_onboarding_progress";
const LEGISLATION_KEY = "legislation_register";

const FOOD_FACTORY_MOBILISATION_STEPS = [
  "Arrive on site, sign in, wash hands and sanitise",
  "Change into site-required PPE and complete hygiene checks",
  "Review RAMS and method statement; confirm permit issued and work area shown",
  "Secure the work area and prevent unauthorised access or vehicle movements",
  "Carry out works within the controlled or high-care zone under supervisor control",
  "Complete close-out checks, sign off permit, and hand back to site management",
];

/** @typedef {{ id: string, label: string, hint: string, viewId?: string, autoCheck?: () => boolean }} SetupStep */

/** @type {SetupStep[]} */
export const FESS_SETUP_STEPS = [
  {
    id: "workspace_profile",
    label: "Apply FESS workspace profile",
    hint: "Food factory M&E layout — hygiene registers, LOTO, method statements; survey modules hidden.",
    autoCheck: () => loadOrgSettingsRaw().industryPackId === FESS_GROUP_PACK_ID,
  },
  {
    id: "hazard_packs",
    label: "Seed RAMS quick packs (baseline + food & pharma)",
    hint: "Standard site RA baseline (~21 rows) plus factory M&E, line clearance and CIP packs.",
    viewId: "rams",
    autoCheck: () => {
      const packs = loadRamsHazardPacks([]);
      return (
        packs.some((p) => p.id === "orgexclusive_fess_me_site_baseline") &&
        packs.some((p) => p.id === "orgexclusive_fess_excel_baseline")
      );
    },
  },
  {
    id: "ms_mobilisation",
    label: "Load food factory mobilisation method steps",
    hint: "Pre-start sequence for method statements — sign-in, hygiene, permit, controlled zone.",
    viewId: "method-statement",
    autoCheck: () => {
      const steps = loadOrgSettingsRaw().msStepTemplates?.foodFactoryMobilisation;
      return Array.isArray(steps) && steps.length >= 4;
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
    hint: "Sealants, lubricants, cleaning chemicals used on food sites.",
    viewId: "coshh",
    autoCheck: () => {
      const items = load("coshh_register", []);
      return items.length > 0 && items.some((i) => String(i.sdsUrl || "").trim());
    },
  },
  {
    id: "ghp_register",
    label: "Glass & hard plastic (G&HP) register ready",
    hint: "Tools and parts brought into production zones.",
    viewId: "ghp-register",
    autoCheck: () => load("ghp_register", []).length > 0,
  },
  {
    id: "loto_register",
    label: "LOTO register — site isolation templates",
    hint: "Starter isolation points per FESS client site — update before live lock-on.",
    viewId: "loto",
    autoCheck: () => load("loto_register", []).length > 0,
  },
  {
    id: "client_sites",
    label: "Seed FESS client site projects",
    hint: "2SFG Scunthorpe/Flixton, Cranswick Lazenby, Quorn, Butternut Box, Dovecoat Park — with A&E and permit defaults.",
    viewId: "fess-sites",
    autoCheck: () => {
      const projects = load("mysafeops_projects", []);
      return projects.filter((p) => p.fessSiteTemplateId).length >= 3;
    },
  },
  {
    id: "project_ae",
    label: "First project with nearest A&E set",
    hint: "Project Enrich — blocks RAMS issue without hospital details.",
    viewId: "projects",
    autoCheck: () => {
      const projects = load("mysafeops_projects", []);
      return projects.some((p) => String(p.nearestHospital || "").trim().length > 2);
    },
  },
  {
    id: "job_starters",
    label: "Use a FESS job starter in RAMS Builder",
    hint: "Step 2 → 19 job types covering all 22 MC reference PDFs (DOLAV, FP1, pipe changeover, machine install, and similar).",
    viewId: "rams",
    autoCheck: () => {
      const docs = load("rams_builder_docs", []);
      return docs.some((d) => String(d.fessJobStarterKey || "").trim());
    },
  },
  {
    id: "baseline_rams",
    label: "First RAMS using Standard site RA baseline pack",
    hint: "RAMS Builder → apply Standard site RA baseline, then add job-specific rows.",
    viewId: "rams",
    autoCheck: () => {
      const docs = load("rams_builder_docs", []);
      return docs.some((d) =>
        (d.rows || []).some((r) => String(r.templateId || r.id || "").match(/^(gen_|elec_|drill_|wah_|mech_|mach_|food_)/))
      );
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
    id: "site_briefing",
    label: "Today's FESS site briefing recorded",
    hint: "Food factory mobilisation topics — line clearance, hygiene, LOTO and RAMS scope.",
    viewId: "daily-briefing",
    autoCheck: () => {
      const today = new Date().toISOString().slice(0, 10);
      const briefings = load("daily_briefings", []);
      return briefings.some(
        (b) => b.fessBriefingPreset && String(b.date || "").slice(0, 10) === today
      );
    },
  },
  {
    id: "site_contacts",
    label: "Site permit controller & A&E contacts seeded",
    hint: "Emergency contacts — one entry per FESS client site (permit controller + nearest hospital).",
    viewId: "emergency-contacts",
    autoCheck: () => {
      const contacts = load("emergency_contacts", []);
      return contacts.filter((c) => c.fessSiteTemplateId).length >= 3;
    },
  },
  {
    id: "portal_cloud",
    label: "Publish FESS site portals to cloud",
    hint: "Sign in, then publish all site portals so permit controllers can open RAMS approval on any device.",
    viewId: "client-portal",
    autoCheck: () => {
      const status = getFessPortalPublishStatus();
      return status.total > 0 && status.unpublished === 0;
    },
  },
  {
    id: "client_portal",
    label: "Client portal with RAMS approval enabled",
    hint: "One portal per food factory site — site permit controller can approve RAMS.",
    viewId: "client-portal",
    autoCheck: () => {
      const portals = load("client_portals", []);
      return portals.some((p) => p.allowRamsApproval !== false && (p.fessPortalPreset || p.sections?.includes("rams")));
    },
  },
];

function loadProgress() {
  const raw = load(PROGRESS_KEY, {});
  return typeof raw === "object" && raw ? raw : {};
}

export function isFessSetupActive() {
  return isFessOrg();
}

/** @returns {{ steps: Array<SetupStep & { done: boolean, manual: boolean }>, pct: number, complete: number, total: number }} */
export function getFessSetupStatus() {
  if (!isFessOrg()) {
    return { steps: [], pct: 0, complete: 0, total: 0 };
  }
  const manual = loadProgress();
  const steps = FESS_SETUP_STEPS.map((step) => {
    const autoDone = step.autoCheck ? step.autoCheck() : false;
    const manualDone = !!manual[step.id];
    return { ...step, done: autoDone || manualDone, manual: manualDone && !autoDone };
  });
  const complete = steps.filter((s) => s.done).length;
  return { steps, pct: Math.round((complete / steps.length) * 100), complete, total: steps.length };
}

/** @param {string} stepId */
export function markFessStepDone(stepId) {
  const next = { ...loadProgress(), [stepId]: new Date().toISOString() };
  save(PROGRESS_KEY, next);
  return next;
}

/** @param {string} stepId */
export function runFessSetupAction(stepId) {
  if (!isFessOrg()) {
    return { ok: false, message: "FESS setup is only available for FESS Group workspace." };
  }
  switch (stepId) {
    case "workspace_profile":
      applyIndustryPack(FESS_GROUP_PACK_ID, { seedTemplates: true });
      markFessStepDone(stepId);
      return { ok: true, message: "FESS workspace profile applied with register seeds." };
    case "hazard_packs": {
      const existing = loadRamsHazardPacks([]);
      const withBuiltIn = ensureBuiltInConstructionPacks(existing, ALL);
      const merged = ensureOrgExclusiveQuickPacks(withBuiltIn, ALL);
      saveRamsHazardPacks(merged);
      markFessStepDone(stepId);
      return { ok: true, message: `Quick packs ready (${merged.length} total, including Standard site RA baseline).` };
    }
    case "ms_mobilisation":
      saveMsStepTemplateOverride("foodFactoryMobilisation", FOOD_FACTORY_MOBILISATION_STEPS.join("\n"));
      markFessStepDone(stepId);
      return { ok: true, message: "Food factory mobilisation steps loaded in Method Statement editor." };
    case "legislation": {
      const existing = load(LEGISLATION_KEY, []);
      if (existing.length === 0) {
        save(LEGISLATION_KEY, seedLegislationRegister());
      }
      markFessStepDone(stepId);
      return { ok: true, message: "Legislation register seeded." };
    }
    case "client_sites": {
      const result = seedFessClientSiteProjects();
      const contacts = seedFessSiteContacts();
      const ghp = seedFessGhpRegister();
      const loto = seedFessLotoRegister();
      if (result.created > 0) markFessStepDone(stepId);
      return {
        ok: true,
        message:
          result.created > 0
            ? `Created ${result.created} client site project(s): ${result.names.join(", ")}.` +
              (contacts.created ? ` · ${contacts.created} site contact(s)` : "") +
              (ghp.created ? ` · ${ghp.created} G&HP` : "") +
              (loto.created ? ` · ${loto.created} LOTO` : "")
            : `All FESS client site projects already exist.${contacts.created ? ` Added ${contacts.created} site contact(s).` : ""}${ghp.created ? ` · ${ghp.created} G&HP` : ""}${loto.created ? ` · ${loto.created} LOTO` : ""}`,
      };
    }
    case "site_contacts": {
      const result = seedFessSiteContacts();
      if (result.created > 0) markFessStepDone(stepId);
      return {
        ok: true,
        message:
          result.created > 0
            ? `Added ${result.created} site contact(s) — permit controller and A&E per food factory site.`
            : "All FESS site contacts already exist.",
      };
    }
    case "coshh_sds": {
      const result = seedFessCoshhRegister();
      if (result.created > 0) markFessStepDone(stepId);
      return {
        ok: true,
        message:
          result.created > 0
            ? `Added ${result.created} starter COSHH substance(s) — attach SDS URLs before issue.`
            : "COSHH register already has starter substances.",
      };
    }
    case "ghp_register": {
      const result = seedFessGhpRegister();
      if (result.created > 0) markFessStepDone(stepId);
      return {
        ok: true,
        message:
          result.created > 0
            ? `Added ${result.created} G&HP item(s) across FESS client sites.`
            : "G&HP register already seeded for FESS sites.",
      };
    }
    case "loto_register": {
      const result = seedFessLotoRegister();
      if (result.created > 0) markFessStepDone(stepId);
      return {
        ok: true,
        message:
          result.created > 0
            ? `Added ${result.created} LOTO template(s) across FESS client sites.`
            : "LOTO register already seeded for FESS sites.",
      };
    }
    case "portal_cloud":
      return {
        ok: true,
        message: "Open Client & sites → Publish portals, or use Client portal module after signing in.",
      };
    case "client_portal": {
      const result = seedFessSitePortals();
      if (result.created > 0) markFessStepDone(stepId);
      return {
        ok: true,
        message:
          result.created > 0
            ? `Created ${result.created} site portal(s) with RAMS approval: ${result.names.join(", ")}. Publish to cloud when ready.`
            : "All FESS site portals already exist — open Client portal to publish links.",
      };
    }
    case "site_briefing": {
      seedFessClientSiteProjects();
      const templates = ["fess_site_2sfg_scunthorpe", "fess_site_cranswick_lazenby", "fess_site_quorn"];
      let created = 0;
      for (const id of templates) {
        const r = seedFessSiteBriefing(id);
        if (r.created) created += 1;
      }
      if (created > 0) markFessStepDone(stepId);
      return {
        ok: true,
        message:
          created > 0
            ? `Created ${created} today's site briefing(s) — open Daily briefing to collect signatures.`
            : "Today's FESS site briefings already exist.",
      };
    }
    default:
      return { ok: false, message: "Open the linked module to complete this step." };
  }
}

export { FOOD_FACTORY_MOBILISATION_STEPS };
