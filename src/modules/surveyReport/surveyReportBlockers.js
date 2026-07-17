/**
 * Actionable blockers for survey editor — quality checks, gates, and smart-fill steps.
 */

import { evaluateSurveyExportGate, evaluateSurveyFinalGate } from "../../utils/surveyCompletenessGates";
import { smartFillNextSteps } from "./surveyReportSmart";
import { surveyReportQuality } from "./surveyReportHelpers";
import { getQaChecklistProgress, getNextIncompleteQaGroupLabel } from "./surveyQaPack";
import { listGprReportsForSurveyProject } from "./surveyGprBridge";
import { SURVEY_QUALITY_FIX, resolveGateFixTarget, resolveSurveyFixTarget } from "./surveyFixNav";

/**
 * @param {object} report
 * @param {object} [context]
 * @returns {{ blockers: Array<{ id: string, label: string, tab: string, anchor: string, severity: string }>, score: number }}
 */
export function buildSurveyBlockers(report, context = {}) {
  const quality = surveyReportQuality(report);
  const qa = getQaChecklistProgress(report?.qaChecklist, report?.surveyType);
  /** @type {Map<string, { id: string, label: string, tab: string, anchor: string, severity: string }>} */
  const seen = new Map();

  const push = (id, label, tab, severity = "warn", anchor = "") => {
    if (!label?.trim()) return;
    const resolved = resolveSurveyFixTarget({ tab, label, anchor });
    const key = `${resolved.tab}:${resolved.anchor}:${label}`;
    if (!seen.has(key)) {
      seen.set(key, {
        id,
        label,
        tab: resolved.tab,
        anchor: resolved.anchor,
        severity,
      });
    }
  };

  quality.checks
    .filter((c) => !c.ok)
    .forEach((c) => {
      const fix = SURVEY_QUALITY_FIX[c.label] || { tab: "details", anchor: "tab-details" };
      push(`quality_${c.label}`, c.label, fix.tab, "warn", fix.anchor);
    });

  if (qa.total > 0 && qa.pct < 40) {
    push("qa_low", `QA checklist ${qa.checked}/${qa.total} — aim for at least 40%`, "professional", "warn", "qa");
  } else if (qa.total > 0 && !qa.complete) {
    const nextGroup = getNextIncompleteQaGroupLabel(report?.qaChecklist, report?.surveyType);
    if (nextGroup) {
      push("qa_group", `QA — complete "${nextGroup}" checks`, "professional", "info", "qa");
    }
  }

  const finalGate = evaluateSurveyFinalGate(report);
  if (report?.status !== "final") {
    finalGate.missing.forEach((m, i) => {
      const fix = resolveGateFixTarget(m);
      push(`final_${i}`, m, fix.tab, "block", fix.anchor);
    });
  }

  const exportGate = evaluateSurveyExportGate(report);
  if (report?.status === "final" && !exportGate.allowed) {
    exportGate.missing.forEach((m, i) => {
      const fix = resolveGateFixTarget(m);
      push(`export_${i}`, m, fix.tab, "info", fix.anchor);
    });
  }

  smartFillNextSteps(report, context)
    .slice(0, 6)
    .forEach((step) => {
      const fix = resolveSurveyFixTarget({ tab: step.tab, label: step.label, id: step.id });
      // Prefer smart-fill tab when known; refine anchor from id
      const anchorById = {
        project: "project",
        type: "survey-type",
        surveyor: "surveyor",
        scope: "scope",
        weather: "weather",
        records: "records",
        plan: "findings",
        "plan-img": "findings",
        findings: "findings",
        "geo-photos": "photos",
        "utilities-geo": "utilities",
        "gi-geo": "gi-locations",
        cad: "cad-import",
        summary: "executive-summary",
        "doc-control": "document-control",
        qa: "qa",
        "qa-half": "qa",
        gpr: "gpr-cards",
        standards: "standards",
        deliverables: "deliverables",
        calibration: "calibration",
      };
      push(step.id, step.label, fix.tab, "info", anchorById[step.id] || fix.anchor);
    });

  const utilityTypes = new Set(["utility_mapping_survey", "eml_cat_survey", "gpr_survey"]);
  if (utilityTypes.has(report?.surveyType) && !(report?.dbydEnquiries || []).length) {
    push("dbyd_log", "Add LSBUD / DBYD enquiry log (Records tab)", "records", "info", "dbyd");
  }
  if (
    report?.surveyType === "utility_mapping_survey" &&
    report?.pas128Ql === "B0" &&
    !(report?.trialHolesTable || []).length
  ) {
    push("trial_holes", "PAS128 QL B0 — add trial hole / verification log", "findings", "warn", "trial-holes");
  }

  const specialistMissing = {
    cctv_drainage_survey: { table: "cctvRunsTable", label: "CCTV run log", tab: "findings", anchor: "specialist-table" },
    uav_aerial: { table: "uavFlightsTable", label: "UAV flight log", tab: "findings", anchor: "specialist-table" },
    laser_scanning: { table: "laserScansTable", label: "Laser scan log", tab: "findings", anchor: "specialist-table" },
  };
  const spec = specialistMissing[report?.surveyType];
  if (spec && !(report?.[spec.table] || []).length) {
    push(`specialist_${report.surveyType}`, `Add ${spec.label}`, spec.tab, "info", spec.anchor);
  }

  const gprTypes = new Set(["utility_mapping_survey", "gpr_survey", "eml_cat_survey"]);
  if (gprTypes.has(report?.surveyType) && !(report?.gprAnomalyCards || []).length) {
    const projectGpr = listGprReportsForSurveyProject(context.gprReports || [], report?.projectId);
    const withAnomalies = projectGpr.find((g) => (g.anomalies || []).length > 0);
    if (withAnomalies) {
      push(
        "gpr_import",
        `Import ${(withAnomalies.anomalies || []).length} GPR anomal${(withAnomalies.anomalies || []).length === 1 ? "y" : "ies"} into survey cards`,
        "findings",
        "info",
        "gpr-cards"
      );
    }
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
