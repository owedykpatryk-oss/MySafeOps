/**
 * Generic PAS 128 survey method presets (M1 desktop, M2–M4P).
 * Structure follows common UK utility survey report layouts; no org-, client- or site-specific prose.
 * PAS 128:2022 — Survey Type D (M1) and Type B onsite methods (M2/M2P/M3P/M4P).
 */

import { PAS128_METHODS } from "./surveyReportConstants";
import { applyPas128BoilerplateToReport } from "./pas128ReportBoilerplate";
import { seedPremiumFieldsFromMethod } from "./surveyEvidencePack";

export { PAS128_METHODS };

export const PAS128_EML_LIMITATIONS = [
  "The signal from a cable in a duct will be from wherever the cable sits in the duct; a trace wire (if fitted) may be offset vertically or horizontally from the pipe.",
  "Signals can jump from asset to asset due to poor continuity — breaks, joints or repairs.",
  "Accessible open non-metallic pipes and ducts may be traced with a flexitrace, cobra or sonde; non-metallic clean water and gas pipes cannot be detected unless they carry a detection strip.",
  "Plastic sections or repairs interrupt the transmitted signal.",
  "HV/EHV cables can be so well balanced that they are hard to detect passively; continuous trace over distance by induction may be difficult.",
  "For metallic pipes and cables, the location is given as the centre of the pipe or cable.",
];

export const PAS128_GPR_LIMITATIONS = [
  "Reinforcement bars, high groundwater and made-up ground can limit penetration depth.",
  "Minimum detectable asset size diminishes with depth (approximate 10% rule — e.g. a 50–60 mm target may not be detectable below 0.5–0.6 m depth).",
  "GPR detects the top surface of an asset whereas EML typically locates the centre (average propagated signal position).",
  "Acquisition is blind — unlike most EML modes with a positive connection, GPR gives no indication of target identity at the time of scan.",
  "GPR may detect trench lines rather than individual assets.",
  "Data quality depends on local ground conditions; penetration may vary from ~1 m to several metres.",
];

const ONSITE_WORK_METHOD = `EML survey results were marked on the ground using UV-degradable paint. Paint marks indicate horizontal position; depth, material and diameter were recorded where available. Initial quality levels: QL-B4 (from records only), QL-B3 (horizontal position from one technique), QL-B2 (horizontal and vertical position from one technique).

Where utilities were detected by both EML and GPR within PAS 128 tolerance, quality level was upgraded to QL-B1 (horizontal and vertical position from both techniques).

Topographical survey recorded geospatial positions and metadata from both techniques. Data were processed off site; CAD drawing was QC'd against utility records before issue. CAD metadata includes quality/confidence level (PAS 128 Section 5), pipe size and material where known, and service depth.`;

const PRESETS = {
  M1: {
    label: "M1 — Desktop utility search (Survey Type D)",
    defaultPas128Ql: "B4",
    defaultLimitationKeys: ["desktop_only", "records_not_available"],
    methodology: `Desktop utility records search undertaken in accordance with PAS 128:2022 Survey Type D.

Enquiries and a site location plan were submitted to known utility companies operating within or near the agreed boundary. Each undertaker was requested to supply relevant asset records or confirm no apparatus in the search area. Enquiry routes vary (written enquiry, online application or direct plan access).

Responses are classed as Affected (apparatus present), Not Affected (no apparatus in area) or No Response Received. Original undertaker responses are retained as appendix material where supplied.

Desktop records are historical; positional accuracy is not guaranteed and underground utilities must be verified by onsite detection before breaking ground. This report supports CDM 2015 and HSG47 responsibilities for avoiding danger from underground services.`,
    workflow: "",
    workflowSteps: ["Desktop records search", "Undertaker enquiries", "Status report", "Issue report"],
    equipmentUsed:
      "Desktop search via statutory undertaker portals, LSBUD / Linesearch Before U dig and client-supplied records. No geophysical equipment deployed.",
    includeEmlGprLimitations: false,
  },
  M2: {
    label: "M2 — EML + GPR (real-time on site)",
    gprGrid: "Real-time interpretation on site (no post-processing)",
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "gpr_depth_limit", "services_live"],
    methodology: `Onsite utility survey to PAS 128 Type B requirements. Detection methods: Electromagnetic Location (EML) and Ground Penetrating Radar (GPR) with real-time on-site interpretation (no GPR post-processing).

${ONSITE_WORK_METHOD}`,
    workflow:
      "MH/IC surveys and cards → EML survey → GPR survey (real-time) → detected utilities digitisation (topographical) → CAD → QC against utility records → final CAD drawing.",
    workflowSteps: ["MH/IC", "EML", "GPR (real-time)", "Topo digitise", "CAD", "QC", "Issue"],
    equipmentUsed:
      "Electromagnetic location (EML/CAT) with signal generator where required.\nGround penetrating radar (GPR) — single-channel or dual-frequency array.\nControl and digitisation: GNSS rover and robotic total station tied to the agreed project grid.",
    includeEmlGprLimitations: true,
  },
  M2P: {
    label: "M2P — EML + GPR (2 m grid, post-processed)",
    gprGrid: "2 m survey grid; GPR post-processed off site",
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "gpr_depth_limit", "services_live"],
    methodology: `Onsite utility survey to PAS 128 Type B requirements at method M2P. Detection methods: EML and GPR with a 2 m survey grid; GPR data post-processed off site and correlated with EML results.

${ONSITE_WORK_METHOD}`,
    workflow:
      "GPR survey and data acquisition → EML survey → detected utilities digitisation (topographical) → post-process GPR data → CAD → assign quality levels & QC against utility records → issue CAD and report.",
    workflowSteps: ["GPR acquire", "EML", "Topo digitise", "Post-process", "CAD + QL", "QC", "Issue"],
    equipmentUsed:
      "Electromagnetic location (EML/CAT) with signal generator where required.\nGround penetrating radar (GPR) — site-appropriate array with position integration.\nControl and digitisation: GNSS rover and robotic total station.",
    includeEmlGprLimitations: true,
  },
  M3: {
    label: "M3 — EML + HD GPR (1 m grid, real-time)",
    gprGrid: "1 m survey grid; high-density array; real-time on-site interpretation",
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "gpr_depth_limit", "services_live"],
    methodology: `Onsite utility survey to PAS 128 Type B requirements at method M3. Detection methods: EML and high-density array GPR on a 1 m grid with real-time on-site interpretation (no GPR post-processing).

${ONSITE_WORK_METHOD}`,
    workflow:
      "MH/IC surveys → high-density array GPR (real-time) → EML survey → detected utilities digitisation (topographical) → CAD → assign quality levels & QC against utility records → issue CAD and report.",
    workflowSteps: ["MH/IC", "HD GPR (real-time)", "EML", "Topo digitise", "CAD + QL", "QC", "Issue"],
    equipmentUsed:
      "Electromagnetic location (EML/CAT) with signal generator where required.\nGround penetrating radar (GPR) — high-density multi-channel array (real-time).\nControl and digitisation: GNSS rover and robotic total station.",
    includeEmlGprLimitations: true,
  },
  M3P: {
    label: "M3P — EML + HD GPR (1 m grid, post-processed)",
    gprGrid: "1 m survey grid; high-density array; GPR post-processed off site",
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "gpr_depth_limit", "services_live"],
    methodology: `Onsite utility survey to PAS 128 Type B requirements at method M3P. Detection methods: EML and high-density array GPR on a 1 m grid; GPR post-processed off site.

${ONSITE_WORK_METHOD}`,
    workflow:
      "MH/IC surveys → high-density array GPR survey → EML survey → detected utilities digitisation (topographical) → post-process GPR data → CAD → assign quality levels & QC against utility records → issue CAD and report.",
    workflowSteps: ["MH/IC", "HD GPR", "EML", "Topo digitise", "Post-process", "CAD + QL", "Issue"],
    equipmentUsed:
      "Electromagnetic location (EML/CAT) with signal generator where required.\nGround penetrating radar (GPR) — high-density multi-channel array.\nControl and digitisation: GNSS rover and robotic total station with GPR position integration.",
    includeEmlGprLimitations: true,
  },
  M4: {
    label: "M4 — Full survey incl. MH/IC (1 m grid, real-time)",
    gprGrid: "1 m survey grid; MH/IC; high-density array; real-time on-site interpretation",
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "gpr_depth_limit", "services_live"],
    methodology: `Onsite utility survey to PAS 128 Type B requirements at method M4 — full utility mapping including manhole and inspection chamber (MH/IC) surveys, EML and high-density GPR on a 1 m grid with real-time on-site interpretation.

${ONSITE_WORK_METHOD}`,
    workflow:
      "MH/IC surveys and cards → high-density array GPR (real-time) → EML survey → detected utilities digitisation (topographical) → CAD → assign quality levels & QC against utility records → issue CAD and report.",
    workflowSteps: ["MH/IC cards", "HD GPR (real-time)", "EML", "Topo digitise", "CAD + QL", "QC", "Issue"],
    equipmentUsed:
      "Electromagnetic location (EML/CAT) with signal generator where required.\nGround penetrating radar (GPR) — high-density multi-channel array (real-time).\nControl and digitisation: GNSS rover and robotic total station with GPR position integration.",
    includeEmlGprLimitations: true,
  },
  M4P: {
    label: "M4P — Full survey incl. MH/IC (1 m grid, post-processed)",
    gprGrid: "1 m survey grid; MH/IC; high-density array; GPR post-processed off site",
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "gpr_depth_limit", "services_live"],
    methodology: `Onsite utility survey to PAS 128 Type B requirements at method M4P — full utility mapping including manhole and inspection chamber (MH/IC) surveys, EML and high-density GPR on a 1 m grid with off-site post-processing.

${ONSITE_WORK_METHOD}`,
    workflow:
      "MH/IC surveys and cards → high-density array GPR survey → EML survey → detected utilities digitisation (topographical) → post-process GPR data → CAD → assign quality levels & QC against utility records → issue CAD and report.",
    workflowSteps: ["MH/IC cards", "HD GPR", "EML", "Topo digitise", "Post-process", "CAD + QL", "Issue"],
    equipmentUsed:
      "Electromagnetic location (EML/CAT) with signal generator where required.\nGround penetrating radar (GPR) — high-density multi-channel array.\nControl and digitisation: GNSS rover and robotic total station with GPR position integration.",
    includeEmlGprLimitations: true,
  },
};

export function pas128MethodLabel(key) {
  if (!key) return "";
  return PAS128_METHODS.find((m) => m.key === key)?.label || PRESETS[key]?.label || key;
}

export function getPas128MethodPreset(key) {
  return PRESETS[key] || null;
}

/** Onsite methods (M2+) that carry standard EML/GPR limitation appendices. */
export function includesPas128MethodLimitations(methodKey) {
  const preset = PRESETS[methodKey];
  return Boolean(preset?.includeEmlGprLimitations);
}

export function pas128MethodAppliesToSurveyType(surveyType) {
  return ["utility_mapping_survey", "topo_plus_utility_survey", "gpr_survey", "eml_cat_survey", "service_clearance_survey"].includes(
    String(surveyType || "")
  );
}

export function getPas128WorkflowSteps(methodKey) {
  const steps = PRESETS[methodKey]?.workflowSteps;
  return Array.isArray(steps) ? [...steps] : [];
}

export function defaultPas128MethodForSurveyType(surveyType) {
  const t = String(surveyType || "");
  if (t === "utility_mapping_survey" || t === "topo_plus_utility_survey") return "M2P";
  if (t === "gpr_survey") return "M3P";
  if (t === "eml_cat_survey") return "M2";
  if (t === "service_clearance_survey") return "M2";
  return "";
}

export function buildPas128WorkflowNarrative(methodKey) {
  const preset = PRESETS[methodKey];
  if (!preset?.workflow?.trim()) return "";
  return `Survey workflow: ${preset.workflow}`;
}

export function buildPas128MethodologyText(methodKey) {
  return PRESETS[methodKey]?.methodology?.trim() || "";
}

/** Merge PAS 128 method boilerplate into a survey report (non-destructive by default). */
export function applyPas128MethodToReport(report, methodKey, { overwrite = false } = {}) {
  if (!methodKey || !PRESETS[methodKey]) return report;
  const preset = PRESETS[methodKey];
  const next = {
    ...report,
    pas128Method: methodKey,
    sections: { ...(report.sections || {}) },
    limitationKeys: [...(report.limitationKeys || [])],
  };

  if (!next.pas128Ql?.trim() || overwrite) {
    next.pas128Ql = preset.defaultPas128Ql || next.pas128Ql;
  }

  (preset.defaultLimitationKeys || []).forEach((k) => {
    if (!next.limitationKeys.includes(k)) next.limitationKeys.push(k);
  });

  const methodology = buildPas128MethodologyText(methodKey);
  if (methodology && (overwrite || !next.sections.methodology?.trim())) {
    next.sections.methodology = methodology;
  }

  if (preset.equipmentUsed && (overwrite || !next.sections.equipmentUsed?.trim())) {
    next.sections.equipmentUsed = preset.equipmentUsed;
  }

  const withBoilerplate = applyPas128BoilerplateToReport(next, methodKey, { overwrite });
  return seedPremiumFieldsFromMethod(withBoilerplate, methodKey);
}

export function buildPas128LimitationsHtml() {
  const li = (items) => items.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  return {
    eml: `<ul class="sr-limit-list">${li(PAS128_EML_LIMITATIONS)}</ul>`,
    gpr: `<ul class="sr-limit-list">${li(PAS128_GPR_LIMITATIONS)}</ul>`,
  };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
