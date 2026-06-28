import { surveyReportQuality, surveyStaticMapThumbUrl } from "./surveyReportHelpers";

/** Precompute list row display data in one pass (avoids repeated quality scans per render). */
export function enrichSurveyListRows(reports = [], projects = []) {
  const projectById = new Map((projects || []).map((p) => [p.id, p]));
  return (reports || []).map((report) => {
    const quality = surveyReportQuality(report);
    const project = projectById.get(report.projectId);
    return {
      report,
      quality,
      score: quality.score,
      mapThumb: surveyStaticMapThumbUrl(project?.lat, project?.lng),
      ready: quality.score >= 80 && report.status !== "final",
      isFinal: report.status === "final",
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
