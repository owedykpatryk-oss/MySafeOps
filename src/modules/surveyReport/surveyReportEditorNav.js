/** Grouped editor navigation for survey reports. */
export const SURVEY_EDITOR_GROUPS = [
  { id: "setup", label: "Setup", hint: "Details, scope, QA" },
  { id: "site", label: "Site conditions", hint: "Weather, records, limits" },
  { id: "findings", label: "Findings", hint: "Results, CAD, photos" },
  { id: "deliver", label: "Deliverables", hint: "Print preview" },
];

export const SURVEY_EDITOR_TABS = [
  { id: "details", label: "Details", group: "setup" },
  { id: "scope", label: "Scope & method", group: "setup" },
  { id: "professional", label: "Professional", group: "setup" },
  { id: "weather", label: "Weather", group: "site" },
  { id: "records", label: "Records review", group: "site" },
  { id: "limitations", label: "Limitations", group: "site" },
  { id: "findings", label: "Findings", group: "findings" },
  { id: "photos", label: "Photos", group: "findings" },
  { id: "preview", label: "Print preview", group: "deliver" },
];

export const SURVEY_TAB_ORDER = SURVEY_EDITOR_TABS.map((t) => t.id);

export function surveyEditorGroupForTab(tabId) {
  return SURVEY_EDITOR_TABS.find((t) => t.id === tabId)?.group || SURVEY_EDITOR_GROUPS[0].id;
}

export function surveyEditorTabsForGroup(groupId) {
  return SURVEY_EDITOR_TABS.filter((t) => t.group === groupId);
}

export function adjacentSurveyTab(tabId, direction = "next") {
  const idx = SURVEY_TAB_ORDER.indexOf(tabId);
  if (idx < 0) return null;
  const next = idx + (direction === "next" ? 1 : -1);
  if (next < 0 || next >= SURVEY_TAB_ORDER.length) return null;
  return SURVEY_TAB_ORDER[next];
}

/** @param {object} report */
export function groupSurveyReportsByProject(reports = [], projects = []) {
  const projectMap = Object.fromEntries((projects || []).map((p) => [p.id, p.name || "Untitled"]));
  const groups = new Map();

  (reports || []).forEach((r) => {
    const key = r.projectId || "__none__";
    const label = key === "__none__" ? "No project" : projectMap[key] || r.projectName || "Project";
    if (!groups.has(key)) groups.set(key, { projectId: key === "__none__" ? "" : key, label, reports: [] });
    groups.get(key).reports.push(r);
  });

  return [...groups.values()].sort((a, b) => {
    if (a.projectId && !b.projectId) return -1;
    if (!a.projectId && b.projectId) return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}
