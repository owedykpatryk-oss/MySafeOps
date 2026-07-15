/** Simple 4-step survey editor navigation (plain English for site users). */

export const SURVEY_SIMPLE_STEPS = [
  { id: "mobilise", label: "Start", hint: "Job details & scope", tabs: ["details", "scope", "professional"] },
  { id: "site", label: "On site", hint: "Weather, records, limits", tabs: ["weather", "records", "limitations"] },
  { id: "findings", label: "Findings", hint: "Results & photos", tabs: ["findings", "photos"] },
  { id: "issue", label: "Print", hint: "Preview & finalise", tabs: ["preview"] },
];

/** Friendly sub-labels inside a step (one panel at a time). */
export const SURVEY_TAB_PLAIN_LABELS = {
  details: "Job details",
  scope: "Scope of work",
  professional: "Checks & sign-off",
  weather: "Weather",
  records: "Utility records",
  limitations: "Limitations",
  findings: "What we found",
  photos: "Photos",
  preview: "Print preview",
};

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
