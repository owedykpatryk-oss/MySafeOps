import {
  buildWeatherNarrative,
  normalizeSurveyReport,
  surveyReportQuality,
  surveyTypeLabel,
} from "./surveyReportHelpers";
import {
  SURVEY_EDITOR_GROUPS,
  SURVEY_EDITOR_TABS,
  surveyEditorGroupForTab,
} from "./surveyReportEditorNav";

/** Per-tab completeness for step navigation badges. */
export function surveyTabIsComplete(report, tabId) {
  const r = normalizeSurveyReport(report);
  switch (tabId) {
    case "details":
      return !!(
        r.title?.trim() &&
        r.surveyDate &&
        r.surveyor?.trim() &&
        r.surveyType &&
        (r.siteAddress?.trim() || r.projectId)
      );
    case "scope":
      return !!(r.sections?.scope?.trim() && r.sections?.methodology?.trim());
    case "professional":
      return (
        Object.values(r.qaChecklist || {}).some(Boolean) &&
        !!(r.documentControl?.preparedBy?.trim() || r.surveyor?.trim())
      );
    case "weather":
      return (
        buildWeatherNarrative(r.weather).length > 0 || !!r.weather?.conditionsNarrative?.trim()
      );
    case "records":
      return (r.utilityRecords?.sourcesConsulted?.length || 0) > 0;
    case "limitations":
      return (r.limitationKeys?.length || 0) > 0 || !!r.limitationsText?.trim();
    case "findings":
      return !!(r.sections?.findings?.trim()) || (r.utilitiesTable?.length || 0) > 0;
    case "photos":
      return (r.photos?.length || 0) > 0 || !!r.geoPhotoImportAt;
    case "preview":
      return surveyReportQuality(r).score >= 70;
    default:
      return false;
  }
}

export function surveyGroupCompletion(report, groupId) {
  const tabs = SURVEY_EDITOR_TABS.filter((t) => t.group === groupId);
  const done = tabs.filter((t) => surveyTabIsComplete(report, t.id)).length;
  return { done, total: tabs.length, complete: done === tabs.length };
}

export function filterSurveyReportsSearch(rows = [], query = "") {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    const blob = [
      r.title,
      r.ref,
      r.projectName,
      r.surveyor,
      r.siteAddress,
      r.client,
      surveyTypeLabel(r.surveyType),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

export function sortSurveyReports(rows = [], sortKey = "newest") {
  const sorted = [...rows];
  const ts = (r) => new Date(r.updatedAt || r.createdAt || 0).getTime();
  if (sortKey === "newest") return sorted.sort((a, b) => ts(b) - ts(a));
  if (sortKey === "oldest") return sorted.sort((a, b) => ts(a) - ts(b));
  if (sortKey === "complete") {
    return sorted.sort(
      (a, b) => surveyReportQuality(b).score - surveyReportQuality(a).score
    );
  }
  if (sortKey === "incomplete") {
    return sorted.sort(
      (a, b) => surveyReportQuality(a).score - surveyReportQuality(b).score
    );
  }
  if (sortKey === "project") {
    return sorted.sort((a, b) =>
      (a.projectName || "").localeCompare(b.projectName || "", undefined, { sensitivity: "base" })
    );
  }
  return sorted;
}

export function summarizeSurveyReportList(reports = []) {
  const drafts = reports.filter((r) => r.status !== "final").length;
  const finals = reports.filter((r) => r.status === "final").length;
  const scores = reports.map((r) => surveyReportQuality(r).score);
  const avgComplete = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const needsWork = reports.filter((r) => surveyReportQuality(r).score < 50 && r.status !== "final").length;
  return { total: reports.length, drafts, finals, avgComplete, needsWork };
}

export function surveyGroupProgressLabel(report, groupId) {
  const { done, total } = surveyGroupCompletion(report, groupId);
  return `${done}/${total}`;
}

export function firstIncompleteSurveyTab(report) {
  return SURVEY_EDITOR_TABS.find((t) => !surveyTabIsComplete(report, t.id))?.id || null;
}

export { SURVEY_EDITOR_GROUPS, surveyEditorGroupForTab };
