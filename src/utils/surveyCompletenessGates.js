/**
 * Hard completeness gates for survey finalisation and export packs.
 * Blocks mistakes — does not guess narrative text.
 */

import { normalizeSurveyReport } from "../modules/surveyReport/surveyReportHelpers";
import { isAutomationEnabled } from "./orgAutomationRules";

const PASS_THROUGH = { allowed: true, missing: [], message: "" };

export function evaluateSurveyFinalGate(report) {
  if (!isAutomationEnabled("surveyFinalGate")) return PASS_THROUGH;
  const r = normalizeSurveyReport(report);
  const missing = [];

  const qa = r.qaChecklist || {};
  if (!Object.values(qa).some(Boolean)) missing.push("QA checklist (at least one item ticked)");

  if (!(r.equipmentCalibration || []).length) missing.push("Equipment calibration records");

  const signed =
    Boolean(r.documentControl?.approvedBy?.trim()) ||
    Boolean(r.signatures?.surveyorSignedDate?.trim()) ||
    Boolean(r.documentControl?.checkedBy?.trim());
  if (!signed) missing.push("Sign-off (approved by or surveyor signed date)");

  if (!(r.photos || []).length) missing.push("At least one site photo");

  return {
    allowed: missing.length === 0,
    missing,
    message:
      missing.length > 0
        ? `Cannot mark final until complete: ${missing.join("; ")}.`
        : "",
  };
}

export function evaluateSurveyExportGate(report) {
  if (!isAutomationEnabled("surveyExportGate")) return PASS_THROUGH;
  const r = normalizeSurveyReport(report);
  const missing = [];

  if (r.status !== "final") {
    missing.push("Report must be marked final before export pack");
  } else {
    const finalGate = evaluateSurveyFinalGate(r);
    if (!finalGate.allowed) missing.push(...finalGate.missing);
  }

  if (r.surveyType === "utility_mapping_survey" || r.surveyType === "eml_cat_survey") {
    if (!String(r.pas128Ql || "").trim()) missing.push("PAS128 quality level (QL)");
    if (!(r.utilitiesTable || []).length) missing.push("Utility schedule (utilities table)");
  }

  const unique = [...new Set(missing)];

  return {
    allowed: unique.length === 0,
    missing: unique,
    message: unique.length > 0 ? `Export pack blocked: ${unique.join("; ")}.` : "",
  };
}
