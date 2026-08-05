/**
 * One-click prep before mark-final / client handover.
 * Smart fill + autofixes + CAD→utilities seed (does not mark final itself).
 */

import { seedUtilitiesTableFromCad } from "../../utils/surveyDxfAnalyzer.js";
import { applySurveyAutofix, suggestSurveyAutofixes } from "./surveyAutofix.js";
import { runSmartFillAll } from "./surveyReportSmart.js";
import { importGprReportIntoSurvey, listGprReportsForSurveyProject } from "./surveyGprBridge.js";
import { buildSurveyBlockers } from "./surveyReportBlockers.js";
import { evaluateSurveyFinalGate } from "../../utils/surveyCompletenessGates.js";

/**
 * Apply all suggested one-click autofixes (including CAD→schedule).
 * @param {object} report
 */
export function applyAllSurveyAutofixes(report) {
  let next = report;
  const ids = suggestSurveyAutofixes(next);
  for (const id of ids) {
    const patched = applySurveyAutofix(id, next);
    if (patched) next = patched;
  }
  return next;
}

/**
 * Sync linked / best-match GPR anomalies into the survey (merge, no replace).
 * @param {object} report
 * @param {object[]} gprReports
 */
export function syncLinkedGprIntoSurvey(report, gprReports = []) {
  if (!report?.projectId) return report;
  const list = listGprReportsForSurveyProject(gprReports, report.projectId);
  const gpr =
    (report.linkedGprReportId && list.find((g) => g.id === report.linkedGprReportId)) ||
    list.find((g) => (g.anomalies || []).length > 0) ||
    list[0];
  if (!gpr) return report;
  return importGprReportIntoSurvey(report, gpr, { merge: true });
}

/**
 * Prepare a report for issue: smart fill → autofixes → CAD seed → GPR sync.
 * Does not set status to final.
 *
 * @param {object} report
 * @param {object} ctx — same shape as runSmartFillAll + gprReports
 * @returns {Promise<{ report: object, summary: object }>}
 */
export async function runSurveyIssuePackPrep(report, ctx = {}) {
  const beforeUtils = (report.utilitiesTable || []).length;
  const beforeCards = (report.gprAnomalyCards || []).length;

  let next = await runSmartFillAll(report, { ...ctx, useAi: Boolean(ctx.useAi) });
  next = applyAllSurveyAutofixes(next);

  if (next.cadImport?.summary?.length) {
    const seeded = seedUtilitiesTableFromCad(next, { replaceCadRows: true });
    if (seeded) next = seeded;
  }

  if (Array.isArray(ctx.gprReports) && ctx.gprReports.length) {
    next = syncLinkedGprIntoSurvey(next, ctx.gprReports);
  }

  next = {
    ...next,
    issuePackAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const finalGate = evaluateSurveyFinalGate(next);
  const { blockers, score } = buildSurveyBlockers(next, {
    project: ctx.project,
    projectPlans: ctx.projectPlans,
    geoPhotos: ctx.geoPhotos,
    gprReports: ctx.gprReports,
  });
  const critical = blockers.filter((b) => b.severity === "block").length;

  return {
    report: next,
    summary: {
      qualityScore: score,
      utilitiesAdded: Math.max(0, (next.utilitiesTable || []).length - beforeUtils),
      gprCardsAdded: Math.max(0, (next.gprAnomalyCards || []).length - beforeCards),
      canMarkFinal: finalGate.allowed,
      blockersRemaining: blockers.length,
      criticalBlockers: critical,
      autofixesApplied: suggestSurveyAutofixes(report).length,
    },
  };
}
