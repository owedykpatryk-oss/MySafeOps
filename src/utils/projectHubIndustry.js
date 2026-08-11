/**
 * Industry-aware project hub — survey workflow only for geodesy / PAS128 orgs.
 */

import { getWorkspacePack } from "./orgIndustryPacks";
import { resolveProfileBehaviorPackId } from "./customWorkspaceProfiles";
import { PROJECT_PLAYBOOKS } from "./projectPlaybooks";
import { isFessOrg } from "./fessOrg";
import { FESS_PROJECT_PLAYBOOKS } from "./fessProjectPlaybooks";
import { filterFessExclusivePlaybooks } from "./fessExclusive";
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { UM_PROJECT_PLAYBOOKS } from "./utilityMappingProjectPlaybooks";
import { filterUtilityMappingExclusivePlaybooks } from "./utilityMappingExclusive";
import { filterPlaybooksForUtilityMappingFocus } from "./utilityMappingFocus";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";
import {
  getOrgIndustryPackId,
  isSurveyWorkflowEnabled,
} from "./surveyWorkflowGate";

export { getOrgIndustryPackId, isSurveyWorkflowEnabled, isSurveyingOrg } from "./surveyWorkflowGate";

function packHasSurveyWorkflow(packId) {
  const pack = getWorkspacePack(packId);
  return Boolean(pack?.surveyWorkflow);
}

/** Playbooks shown in project create / hub — no PAS128 packs for pure contractors. */
export function getPlaybooksForOrg() {
  const pack = getOrgIndustryPackId();
  let list;
  if (packHasSurveyWorkflow(pack) || pack === "contractorPlusSurveying" || pack === "showEverything") {
    list = PROJECT_PLAYBOOKS;
  } else {
    list = PROJECT_PLAYBOOKS.filter((pb) => !pb.surveyType);
  }
  if (isFessOrg()) {
    list = [...list, ...FESS_PROJECT_PLAYBOOKS];
  }
  if (isUtilityMappingOrg()) {
    list = [...UM_PROJECT_PLAYBOOKS, ...list];
    list = filterPlaybooksForUtilityMappingFocus(list);
  }
  list = filterFessExclusivePlaybooks(list);
  return filterUtilityMappingExclusivePlaybooks(list);
}

const FEATURED_BY_PACK = {
  generalContractor: ["general", "refurb_build", "confined_space", "electrical"],
  electricalContractor: ["electrical", "general", "confined_space"],
  buildingTrades: ["refurb_build", "general", "groundworks", "confined_space"],
  surveyingGeodesy: ["utility_mapping", "topo", "topo_plus_utility", "site_investigation"],
  contractorPlusSurveying: ["general", "utility_mapping", "topo", "refurb_build"],
  facilitiesMaintenance: ["general", "electrical", "confined_space"],
  demolitionStripout: ["demolition", "groundworks", "general", "confined_space"],
  foodPharma: ["general", "confined_space"],
  fessGroup: ["fess_dolav_meyn", "fess_machine_install", "fess_pipe_changeover", "general"],
  utilityMapping: ["um_pas128_m2", "um_pas128_m2p", "um_topo_plus_utility", "um_gpr_corridor"],
  showEverything: ["general", "electrical", "utility_mapping", "site_investigation", "groundworks"],
};

/** Top playbooks for hub alerts and project wizard. */
export function getFeaturedPlaybooksForOrg(limit = 3) {
  const allPlaybooks = getPlaybooksForOrg();
  const allowed = new Set(allPlaybooks.map((p) => p.id));
  const packId = getOrgIndustryPackId();
  const order =
    (packId === UTILITY_MAPPING_PACK_ID ? FEATURED_BY_PACK.utilityMapping : null) ||
    FEATURED_BY_PACK[packId] ||
    FEATURED_BY_PACK[resolveProfileBehaviorPackId(packId)] ||
    FEATURED_BY_PACK.generalContractor;
  const picked = [];
  for (const id of order) {
    if (!allowed.has(id)) continue;
    const pb = allPlaybooks.find((p) => p.id === id);
    if (pb) picked.push(pb);
    if (picked.length >= limit) break;
  }
  if (picked.length < limit) {
    for (const pb of allPlaybooks) {
      if (picked.some((x) => x.id === pb.id)) continue;
      picked.push(pb);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

/** Final pipeline step — survey for geodesy, inspections for everyone else. */
export function getProjectHubTailStep(dash) {
  if (isSurveyWorkflowEnabled()) {
    return {
      key: "survey",
      icon: "📐",
      label: "Survey",
      hint: dash?.surveys?.length ? `${dash.surveys.length} report(s)` : "Client deliverable",
      status: dash?.surveys?.length ? "done" : "todo",
      viewId: "survey-report",
      action: dash?.surveys?.length ? undefined : "createReport",
    };
  }
  const inspectionHint = dash?.inspections?.length
    ? `${dash.inspections.length} logged`
    : "Log first inspection";
  return {
    key: "inspections",
    icon: "✅",
    label: "Inspections",
    hint: inspectionHint,
    status: (dash?.inspections?.length || 0) > 0 ? "done" : "todo",
    viewId: "inspections",
  };
}
