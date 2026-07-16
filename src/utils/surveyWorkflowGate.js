/**
 * Survey workflow visibility — split from projectHubIndustry to avoid a circular import with projectPlaybooks.
 */
import { getAppliedIndustryPackId, getWorkspacePack } from "./orgIndustryPacks";
import { getIndustryPackPreviewId } from "./industryPackPreview";
import { isModuleVisible } from "./hiddenModules";

function packHasSurveyWorkflow(packId) {
  const pack = getWorkspacePack(packId);
  return Boolean(pack?.surveyWorkflow);
}

/** Effective pack — preview (session) overrides saved profile for hub UI only. */
export function getOrgIndustryPackId() {
  return getIndustryPackPreviewId() || getAppliedIndustryPackId() || "generalContractor";
}

/** Survey deliverables (PAS128 reports) — surveying & hybrid orgs only. */
export function isSurveyWorkflowEnabled() {
  if (typeof window === "undefined") return false;
  if (!isModuleVisible("survey-report")) return false;
  const pack = getOrgIndustryPackId();
  return packHasSurveyWorkflow(pack) || pack === "showEverything";
}

export function isSurveyingOrg() {
  const pack = getOrgIndustryPackId();
  return pack === "surveyingGeodesy" || pack === "contractorPlusSurveying" || packHasSurveyWorkflow(pack);
}
