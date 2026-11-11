/** Simple 4-step GPR editor navigation (plain English for site users). */

export const GPR_SIMPLE_STEPS = [
  { id: "start", label: "Start", hint: "Job & site details", tabs: ["setup"] },
  { id: "kit", label: "Kit", hint: "Equipment & ground", tabs: ["equipment", "ground"] },
  { id: "findings", label: "Findings", hint: "Results & photos", tabs: ["findings"] },
  { id: "issue", label: "Print", hint: "Narrative, QA & PDF", tabs: ["narrative", "qa"] },
];

export const GPR_TAB_PLAIN_LABELS = {
  setup: "Job details",
  equipment: "Equipment",
  ground: "Ground & weather",
  findings: "What we found",
  narrative: "Method & limits",
  qa: "Review & print",
};

export function gprSimpleStepForTab(tabId) {
  const id = String(tabId || "").trim();
  return GPR_SIMPLE_STEPS.find((s) => s.tabs.includes(id)) || GPR_SIMPLE_STEPS[0];
}

export function firstTabOfGprSimpleStep(stepId) {
  const step = GPR_SIMPLE_STEPS.find((s) => s.id === stepId);
  return step?.tabs?.[0] || "setup";
}

export function adjacentGprSimpleStep(stepId, direction = "next") {
  const idx = GPR_SIMPLE_STEPS.findIndex((s) => s.id === stepId);
  if (idx < 0) return null;
  const next = idx + (direction === "next" ? 1 : -1);
  if (next < 0 || next >= GPR_SIMPLE_STEPS.length) return null;
  return GPR_SIMPLE_STEPS[next];
}

const GPR_SIMPLE_PREF_KEY = "mysafeops_gpr_simple_pref";

/** Session override — Simple mode on by default for less clutter. */
export function getGprSimpleModePref() {
  try {
    const raw = sessionStorage.getItem(GPR_SIMPLE_PREF_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function setGprSimpleModePref(enabled) {
  try {
    sessionStorage.setItem(GPR_SIMPLE_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
