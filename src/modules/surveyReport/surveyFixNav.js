/**
 * Navigate survey editor Fix actions to the right tab + field anchor.
 */

import { SURVEY_EDITOR_TABS } from "./surveyReportEditorNav";

/** Quality / nudge labels → tab + data-survey-anchor. */
export const SURVEY_QUALITY_FIX = {
  "Report title": { tab: "details", anchor: "title" },
  "Survey date": { tab: "details", anchor: "survey-date" },
  "Surveyor / author": { tab: "details", anchor: "surveyor" },
  "Site / project": { tab: "details", anchor: "project" },
  "Survey type": { tab: "details", anchor: "survey-type" },
  "Scope of works": { tab: "scope", anchor: "scope" },
  Methodology: { tab: "scope", anchor: "methodology" },
  "Findings / results": { tab: "findings", anchor: "findings" },
  "Executive summary": { tab: "details", anchor: "executive-summary" },
  Recommendations: { tab: "findings", anchor: "recommendations" },
  "Records review": { tab: "records", anchor: "records" },
  Limitations: { tab: "limitations", anchor: "limitations" },
  "Weather at site": { tab: "weather", anchor: "weather" },
  "Document control": { tab: "details", anchor: "document-control" },
  "Utility schedule or findings": { tab: "findings", anchor: "utilities" },
  "GI location schedule or findings": { tab: "findings", anchor: "gi-locations" },
  "CAD length summary": { tab: "findings", anchor: "cad-import" },
  "QA checklist": { tab: "professional", anchor: "qa" },
  "QA checklist (50%+)": { tab: "professional", anchor: "qa" },
  "Standards referenced": { tab: "professional", anchor: "standards" },
  "Equipment calibration": { tab: "professional", anchor: "calibration" },
  "GPR anomaly cards": { tab: "findings", anchor: "gpr-cards" },
};

const VALID_TABS = new Set(SURVEY_EDITOR_TABS.map((t) => t.id));

/**
 * Map final / export gate free-text messages to tab + anchor.
 * @param {string} message
 * @returns {{ tab: string, anchor: string }}
 */
export function resolveGateFixTarget(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("photo")) return { tab: "photos", anchor: "photos" };
  if (m.includes("sign-off") || m.includes("approved by") || m.includes("signed")) {
    return { tab: "details", anchor: "document-control" };
  }
  if (m.includes("calibration")) return { tab: "professional", anchor: "calibration" };
  if (m.includes("qa checklist") || m.includes("qa confirmation")) return { tab: "professional", anchor: "qa" };
  if (m.includes("standards")) return { tab: "professional", anchor: "standards" };
  if (m.includes("utility schedule") || m.includes("utilities table")) return { tab: "findings", anchor: "utilities" };
  if (m.includes("pas128 ql on each") || m.includes("ql on each utility")) return { tab: "findings", anchor: "utilities" };
  if (m.includes("pas128 quality level") || m.includes("pas128 ql")) return { tab: "details", anchor: "pas128" };
  if (m.includes("cctv")) return { tab: "findings", anchor: "specialist-table" };
  if (m.includes("uav") || m.includes("flight")) return { tab: "findings", anchor: "specialist-table" };
  if (m.includes("laser")) return { tab: "findings", anchor: "specialist-table" };
  if (m.includes("acm")) return { tab: "findings", anchor: "specialist-table" };
  if (m.includes("gi location") || m.includes("findings narrative")) return { tab: "findings", anchor: "gi-locations" };
  if (m.includes("trial hole")) return { tab: "findings", anchor: "trial-holes" };
  if (m.includes("marked final") || m.includes("export pack")) return { tab: "preview", anchor: "tab-preview" };
  return { tab: "professional", anchor: "qa" };
}

const ANCHOR_BY_STEP_ID = {
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
  gpr: "gpr-cards",
  "qa-half": "qa",
  standards: "standards",
  deliverables: "deliverables",
  calibration: "calibration",
};

/**
 * @param {{ tab?: string, label?: string, id?: string, anchor?: string }} target
 * @returns {{ tab: string, anchor: string }}
 */
export function resolveSurveyFixTarget(target = {}) {
  const fromQuality = target.label ? SURVEY_QUALITY_FIX[target.label] : null;
  let tab = target.tab || fromQuality?.tab || "details";
  let anchor =
    target.anchor ||
    (target.id && ANCHOR_BY_STEP_ID[target.id]) ||
    fromQuality?.anchor ||
    "";

  if (!anchor && target.label) {
    const gate = resolveGateFixTarget(target.label);
    if (!target.tab) tab = gate.tab;
    anchor = gate.anchor;
  }

  if (!VALID_TABS.has(tab)) tab = "details";
  if (!anchor) anchor = `tab-${tab}`;
  return { tab, anchor };
}

/**
 * Scroll / highlight a [data-survey-anchor] inside the survey editor panel.
 * @param {string} anchor
 * @param {{ root?: ParentNode | null }} [opts]
 */
export function scrollToSurveyAnchor(anchor, opts = {}) {
  if (typeof document === "undefined" || !anchor) return false;
  const root = opts.root || document;
  const safe =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(anchor)
      : String(anchor).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const el =
    root.querySelector?.(`[data-survey-anchor="${safe}"]`) ||
    document.querySelector(`[data-survey-anchor="${safe}"]`);
  if (!el) return false;

  el.classList.add("app-survey-fix-target");
  el.scrollIntoView({ behavior: "smooth", block: "center" });

  const focusable = el.querySelector?.(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
  );
  if (focusable && typeof focusable.focus === "function") {
    try {
      focusable.focus({ preventScroll: true });
    } catch {
      focusable.focus();
    }
  }

  window.setTimeout(() => el.classList.remove("app-survey-fix-target"), 2200);
  return true;
}

/**
 * After setState(tab), wait a tick then scroll to the field.
 * @param {string} anchor
 * @param {{ root?: ParentNode | null, attempts?: number }} [opts]
 */
export function scheduleSurveyFixScroll(anchor, opts = {}) {
  const attempts = opts.attempts ?? 8;
  let left = attempts;
  const tick = () => {
    if (scrollToSurveyAnchor(anchor, opts)) return;
    left -= 1;
    if (left > 0) window.setTimeout(tick, 40);
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(tick));
  } else {
    window.setTimeout(tick, 0);
  }
}
