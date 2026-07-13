/**
 * Actionable blockers for survey editor — quality checks, gates, and smart-fill steps.
 */

import { evaluateSurveyExportGate, evaluateSurveyFinalGate } from "../../utils/surveyCompletenessGates";
import { smartFillNextSteps } from "./surveyReportSmart";
import { surveyReportQuality } from "./surveyReportHelpers";
import { getQaChecklistProgress, getNextIncompleteQaGroupLabel } from "./surveyQaPack";

/** Map quality missing labels → editor tab ids. */
const QUALITY_LABEL_TAB = {
  "Report title": "details",
  "Survey date": "details",
  "Surveyor / author": "details",
  "Site / project": "details",
  "Survey type": "details",
  "Scope of works": "scope",
  Methodology: "scope",
  "Findings / results": "findings",
  "Executive summary": "details",
  Recommendations: "details",
  "Records review": "records",
  Limitations: "limitations",
  "Weather at site": "weather",
  "Document control": "professional",
  "Utility schedule or findings": "findings",
  "GI location schedule or findings": "findings",
  "CAD length summary": "findings",
  "QA checklist": "professional",
  "QA checklist (50%+)": "professional",
  "Standards referenced": "professional",
  "Equipment calibration": "professional",
};

/**
 * @param {object} report
 * @param {object} [context]
 * @returns {{ blockers: Array<{ id: string, label: string, tab: string, severity: string }>, score: number }}
 */
export function buildSurveyBlockers(report, context = {}) {
  const quality = surveyReportQuality(report);
  const qa = getQaChecklistProgress(report?.qaChecklist, report?.surveyType);
  /** @type {Map<string, { id: string, label: string, tab: string, severity: string }>} */
  const seen = new Map();

  const push = (id, label, tab, severity = "warn") => {
    if (!label?.trim()) return;
    const key = `${tab}:${label}`;
    if (!seen.has(key)) seen.set(key, { id, label, tab: tab || "details", severity });
  };

  quality.checks
    .filter((c) => !c.ok)
    .forEach((c) => push(`quality_${c.label}`, c.label, QUALITY_LABEL_TAB[c.label] || "details", "warn"));

  if (qa.total > 0 && qa.pct < 40) {
    push("qa_low", `QA checklist ${qa.checked}/${qa.total} — aim for at least 40%`, "professional", "warn");
  } else if (qa.total > 0 && !qa.complete) {
    const nextGroup = getNextIncompleteQaGroupLabel(report?.qaChecklist, report?.surveyType);
    if (nextGroup) {
      push("qa_group", `QA — complete "${nextGroup}" checks`, "professional", "info");
    }
  }

  const finalGate = evaluateSurveyFinalGate(report);
  if (report?.status !== "final") {
    finalGate.missing.forEach((m, i) => push(`final_${i}`, m, "professional", "block"));
  }

  const exportGate = evaluateSurveyExportGate(report);
  if (report?.status === "final" && !exportGate.allowed) {
    exportGate.missing.forEach((m, i) => push(`export_${i}`, m, "findings", "info"));
  }

  smartFillNextSteps(report, context)
    .slice(0, 6)
    .forEach((step) => push(step.id, step.label, step.tab || "details", "info"));

  const utilityTypes = new Set(["utility_mapping_survey", "eml_cat_survey", "gpr_survey"]);
  if (utilityTypes.has(report?.surveyType) && !(report?.dbydEnquiries || []).length) {
    push("dbyd_log", "Add LSBUD / DBYD enquiry log (Records tab)", "records", "info");
  }
  if (
    report?.surveyType === "utility_mapping_survey" &&
    report?.pas128Ql === "B0" &&
    !(report?.trialHolesTable || []).length
  ) {
    push("trial_holes", "PAS128 QL B0 — add trial hole / verification log", "findings", "warn");
  }

  const specialistMissing = {
    cctv_drainage_survey: { table: "cctvRunsTable", label: "CCTV run log", tab: "findings" },
    uav_aerial: { table: "uavFlightsTable", label: "UAV flight log", tab: "findings" },
    laser_scanning: { table: "laserScansTable", label: "Laser scan log", tab: "findings" },
  };
  const spec = specialistMissing[report?.surveyType];
  if (spec && !(report?.[spec.table] || []).length) {
    push(`specialist_${report.surveyType}`, `Add ${spec.label}`, spec.tab, "info");
  }

  return {
    score: quality.score,
    blockers: [...seen.values()],
  };
}

export function surveyBlockersTone(report) {
  const { blockers, score } = buildSurveyBlockers(report);
  const critical = blockers.some((b) => b.severity === "block");
  if (report?.status === "final") return { tone: "ok", blockers, score };
  if (critical) return { tone: "critical", blockers, score };
  if (score < 50 || blockers.some((b) => b.severity === "warn")) return { tone: "warn", blockers, score };
  return { tone: "ok", blockers, score };
}
