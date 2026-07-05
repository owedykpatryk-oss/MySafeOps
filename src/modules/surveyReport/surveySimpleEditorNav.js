/** Simple 4-step survey editor navigation (site supervisor style). */

export const SURVEY_SIMPLE_STEPS = [
  { id: "mobilise", label: "Mobilise", hint: "Details, scope, sign-off", tabs: ["details", "scope", "professional"] },
  { id: "site", label: "Site", hint: "Weather, records, limits", tabs: ["weather", "records", "limitations"] },
  { id: "findings", label: "Findings", hint: "Results & photos", tabs: ["findings", "photos"] },
  { id: "issue", label: "Issue", hint: "Print preview", tabs: ["preview"] },
];

export function simpleStepForTab(tabId) {
  const id = String(tabId || "").trim();
  return SURVEY_SIMPLE_STEPS.find((s) => s.tabs.includes(id)) || SURVEY_SIMPLE_STEPS[0];
}

export function firstTabOfSimpleStep(stepId) {
  const step = SURVEY_SIMPLE_STEPS.find((s) => s.id === stepId);
  return step?.tabs?.[0] || "details";
}

export function adjacentSimpleStep(stepId, direction = "next") {
  const idx = SURVEY_SIMPLE_STEPS.findIndex((s) => s.id === stepId);
  if (idx < 0) return null;
  const next = idx + (direction === "next" ? 1 : -1);
  if (next < 0 || next >= SURVEY_SIMPLE_STEPS.length) return null;
  return SURVEY_SIMPLE_STEPS[next];
}

export function tabsForSimpleStep(stepId) {
  return SURVEY_SIMPLE_STEPS.find((s) => s.id === stepId)?.tabs || [];
}
