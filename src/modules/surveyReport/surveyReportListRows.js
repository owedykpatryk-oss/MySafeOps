import { surveyReportQuality, surveyStaticMapThumbUrl } from "./surveyReportHelpers";
import { getQaChecklistProgress } from "./surveyQaPack";
import { evaluateSurveyExportGate } from "../../utils/surveyCompletenessGates";

/** Precompute list row display data in one pass (avoids repeated quality scans per render). */
export function enrichSurveyListRows(reports = [], projects = []) {
  const projectById = new Map((projects || []).map((p) => [p.id, p]));
  return (reports || []).map((report) => {
    const quality = surveyReportQuality(report);
    const qa = getQaChecklistProgress(report.qaChecklist, report.surveyType);
    const project = projectById.get(report.projectId);
    const exportGate = report.status === "final" ? evaluateSurveyExportGate(report) : null;
    return {
      report,
      quality,
      score: quality.score,
      qaPct: qa.pct,
      qaComplete: qa.complete,
      qaLabel: qa.total ? `${qa.checked}/${qa.total}` : "",
      mapThumb: surveyStaticMapThumbUrl(project?.lat, project?.lng),
      ready: quality.score >= 80 && qa.pct >= 50 && report.status !== "final",
      isFinal: report.status === "final",
      exportPackReady: exportGate?.allowed === true,
      exportBlocked: exportGate?.allowed === false,
    };
  });
}

/** Map project group key → { label, count } for list headers. */
export function surveyListGroupMeta(groupedReports = []) {
  const meta = new Map();
  (groupedReports || []).forEach((g) => {
    const key = g.projectId || "__none__";
    meta.set(key, { label: g.label || "No project", count: g.reports?.length || 0 });
  });
  return meta;
}
