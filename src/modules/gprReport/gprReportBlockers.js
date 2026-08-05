/**
 * Actionable blockers for GPR editor — quality + evidence gates.
 */

import { gprReportQuality } from "./gprReportHelpers.js";
import { buildGprLineLengthSummary, buildGprSurveyLineComparison } from "./gprLineLengthSummary.js";

/**
 * @param {object} report
 * @param {{ linkedSurveyReport?: object, project?: object }} [context]
 */
export function buildGprBlockers(report, context = {}) {
  const quality = gprReportQuality(report);
  /** @type {Array<{ id: string, label: string, tab: string, anchor: string, severity: string }>} */
  const blockers = [];

  const push = (id, label, tab, severity = "warn", anchor = "") => {
    blockers.push({ id, label, tab, anchor, severity });
  };

  quality.missing.forEach((label, i) => {
    const tabMap = {
      "Report ref": "setup",
      "Survey date": "setup",
      Surveyor: "setup",
      Equipment: "equipment",
      Acquisition: "equipment",
      "BGS ground data": "ground",
      "Weather / environment": "ground",
      Methodology: "narrative",
      Findings: "findings",
      Limitations: "narrative",
      "Velocity model": "equipment",
    };
    push(`q_${i}`, label, tabMap[label] || "setup", "warn", "");
  });

  const coverage = Number(report?.acquisition?.coveragePercent);
  if (Number.isFinite(coverage) && coverage > 0 && coverage < 90) {
    push("coverage_low", `Coverage ${coverage}% — note incomplete areas in limitations`, "equipment", "warn", "acquisition");
  }

  if (!(report?.radargrams || []).length && !(report?.scanPanels || []).length) {
    push("no_radargrams", "Add at least one radargram or scan panel for client evidence", "findings", "warn", "radargrams");
  }

  if (!(report?.anomalies || []).length) {
    push("no_anomalies", "Log anomalies or use quick templates on Findings", "findings", "info", "anomalies");
  }

  const hasSurveyCad =
    Array.isArray(context.linkedSurveyReport?.cadImport?.summary) &&
    context.linkedSurveyReport.cadImport.summary.some((r) => (Number(r.lengthM) || 0) > 0);
  if (hasSurveyCad && !(report?.chainageSegments || []).length) {
    push("chainage_from_cad", "Import chainage from linked survey CAD", "findings", "info", "chainage");
  }

  if (context.linkedSurveyReport && (report?.chainageSegments || []).length) {
    const visual = buildGprLineLengthSummary(report);
    const cmp = buildGprSurveyLineComparison(visual, context.linkedSurveyReport);
    const unverified = cmp.rows?.filter((r) => r.surveyLengthM > 0 && r.gprLengthM === 0) || [];
    if (unverified.length) {
      push(
        "unverified_cad",
        `${unverified.length} survey CAD utility line(s) not yet on GPR corridor`,
        "findings",
        "warn",
        "chainage"
      );
    }
  }

  if (report?.status !== "final" && quality.score < 70) {
    push("score_low", `Completeness ${quality.score}% — aim for 70%+ before final`, "qa", "block", "qa");
  }

  const score = quality.score;
  return { blockers, score };
}
