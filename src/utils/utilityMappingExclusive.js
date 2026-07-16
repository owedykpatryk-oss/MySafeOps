/**
 * Central guards — Utility Mapping exclusives must never run for other orgs.
 */
import { getOrgId, loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";
import { filterQuickPacksForOrg } from "../modules/rams/orgExclusiveQuickPacks";
import { saveRamsHazardPacks, RAMS_HAZARD_PACKS_KEY } from "./ramsHazardPacksStorage";

/**
 * @param {string} [orgId]
 * @param {Record<string, unknown>} [settings]
 */
export function canUseUtilityMappingExclusiveFeatures(orgId, settings) {
  return isUtilityMappingOrg(orgId, settings);
}

/** @param {string} playbookId */
export function isUtilityMappingExclusivePlaybookId(playbookId) {
  const id = String(playbookId || "").trim();
  return id.startsWith("um_");
}

/**
 * @param {object[]} playbooks
 * @param {string} [orgId]
 */
export function filterUtilityMappingExclusivePlaybooks(playbooks, orgId) {
  if (isUtilityMappingOrg(orgId)) return Array.isArray(playbooks) ? playbooks : [];
  return (Array.isArray(playbooks) ? playbooks : []).filter(
    (p) => !p?.orgExclusive || !isUtilityMappingExclusivePlaybookId(p?.id)
  );
}

/**
 * Remove Utility Mapping exclusive packs / pack id when leaving the tenant.
 * @param {string} [orgId]
 * @returns {string[]} changed keys
 */
export function scrubUtilityMappingExclusiveOrgStorage(orgId = getOrgId()) {
  const changes = [];
  if (isUtilityMappingOrg(orgId)) return changes;

  const packs = load(RAMS_HAZARD_PACKS_KEY, []);
  const filteredPacks = filterQuickPacksForOrg(packs, orgId);
  if (JSON.stringify(filteredPacks) !== JSON.stringify(packs)) {
    saveRamsHazardPacks(filteredPacks);
    changes.push("hazardPacks");
  }

  const raw = loadOrgSettingsRaw(orgId);
  if (raw?.industryPackId === UTILITY_MAPPING_PACK_ID) {
    saveOrgSettingsRaw({ ...raw, industryPackId: "surveyingGeodesy" }, orgId);
    changes.push("industryPackId");
  }

  if (raw?.surveyTypeTemplates && typeof raw.surveyTypeTemplates === "object") {
    const umKeys = ["utility_mapping_survey", "gpr_survey", "service_clearance_survey"];
    let changed = false;
    const nextTemplates = { ...raw.surveyTypeTemplates };
    for (const key of umKeys) {
      const t = nextTemplates[key];
      if (t && typeof t.methodology === "string" && t.methodology.includes("Utility Mapping PAS128")) {
        delete nextTemplates[key];
        changed = true;
      }
    }
    if (changed) {
      saveOrgSettingsRaw({ ...loadOrgSettingsRaw(orgId), surveyTypeTemplates: nextTemplates }, orgId);
      changes.push("surveyTypeTemplates");
    }
  }

  const projects = load("mysafeops_projects", []);
  if (Array.isArray(projects) && projects.length) {
    const next = projects.map((p) => {
      if (!p || !isUtilityMappingExclusivePlaybookId(p.playbookId)) return p;
      return { ...p, playbookId: "utility_mapping" };
    });
    if (JSON.stringify(next) !== JSON.stringify(projects)) {
      save("mysafeops_projects", next);
      changes.push("projects");
    }
  }

  return changes;
}
