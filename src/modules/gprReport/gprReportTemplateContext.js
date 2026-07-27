/**
 * Generic GPR report template context — derived from typical UK deliverable structure
 * (narrative PDF + processing log + grid/chainage panels + CAD figure slots).
 * No client, site, or third-party branding.
 */

import { blankGprScanPanel, GPR_DELIVERABLES, PROCESSING_FILTER_CATALOG } from "./gprReportConstants";

export const GENERIC_GPR_FOREWORD = [
  "This report presents the findings of a ground penetrating radar (GPR) survey undertaken at the subject location.",
  "",
  "GPR is a non-destructive geophysical method. Electromagnetic pulses are transmitted into the ground or structure and reflections from material boundaries are recorded. Processed radargrams, depth slices and plan layouts support interpretation of subsurface features.",
  "",
  "All interpretations are geophysical indications only unless stated otherwise. Intrusive verification is recommended before mechanical excavation or structural intervention.",
].join("\n");

export const GENERIC_GPR_SCOPE = [
  "Objectives:",
  "• Map indicative subsurface features within the surveyed extent using GPR.",
  "• Document acquisition equipment, processing workflow and ground/environmental constraints.",
  "• Provide radargram evidence, interpreted anomalies and supporting plan figures where attached.",
  "",
  "Survey extent is defined by the acquisition grid, corridor swaths or structural scan panels recorded on site and referenced in the Findings section.",
].join("\n");

export const GENERIC_GPR_WORKFLOW = [
  "Mobilisation & setup — site walkover, control establishment and instrument configuration.",
  "Data acquisition — systematic grid, corridor or panel scans with positioning tied to project control.",
  "Data transfer — raw data backed up and transferred for office processing.",
  "Processing — dewow, time-zero, background removal, gain, band-pass filtering, migration and depth conversion as appropriate.",
  "Interpretation — review of radargrams, depth/time slices and amplitude maps; anomalies logged with confidence.",
  "Drafting — plan layouts and chainage/profile figures exported where required.",
  "Reporting — structured PDF with methodology, limitations and QA record.",
].join("\n");

export const GENERIC_GPR_DATA_PROCESSING = [
  "Raw GPR traces were processed using industry-standard time-domain workflows comparable to GeoLitix / IQMaps / Reflexw-style pipelines:",
  "",
  "• Velocity analysis for depth conversion.",
  "• Time-zero alignment to normalise trace start.",
  "• Dewow / DC drift removal.",
  "• Background subtraction to suppress horizontal banding.",
  "• Band-pass filtering to target frequency band of the deployed antenna.",
  "• Time-varying gain (SEC/TVG) or manual gain curves for weak reflectors.",
  "• Time window trimming to focus on target depth range.",
  "• Migration (e.g. FK) where hyperbola collapse improves lateral positioning.",
  "• Hilbert envelope or amplitude analysis for time-slice products.",
  "",
  "Processing parameters applied on this survey are tabulated in the Processing log section.",
].join("\n");

export const GENERIC_GPR_INTERPRETATION = [
  "Interpretation follows amplitude, continuity and hyperbola geometry on processed radargrams and depth slices.",
  "",
  "High confidence — feature resolvable on multiple lines/panels with consistent depth and lateral extent.",
  "Medium confidence — single-line or moderate SNR response; indicative position only.",
  "Low / indicative — weak amplitude, clutter-dominated zone or attenuating ground — verification required.",
  "",
  "Depths use the documented velocity model. Local moisture or material changes may introduce ±10–15% depth error.",
  "Non-metallic targets often produce weaker responses than metallic equivalents.",
].join("\n");

export const GENERIC_GPR_DELIVERABLES_NARRATIVE = [
  "Typical deliverables for this type of survey may include:",
  "• PDF technical report (this document).",
  "• Processed radargram figures and scan panel summaries.",
  "• 2D plan layout / CAD export aligned to survey control (when attached).",
  "• Chainage or profile plots for corridor / linear acquisitions.",
  "• Depth-slice or time-slice images where 3D processing was undertaken.",
].join("\n");

/** Default processing filter rows (Geolitix/IQMaps-style log — generic labels). */
export function defaultProcessingFilters() {
  return PROCESSING_FILTER_CATALOG.map((f) => ({
    key: f.key,
    label: f.label,
    parameter: f.defaultParameter,
    notes: f.defaultNotes,
    applied: f.defaultApplied,
  }));
}

/** Seed deliverable checklist — all unchecked by default. */
export function defaultDeliverableChecklist() {
  return Object.fromEntries(GPR_DELIVERABLES.map((d) => [d.key, false]));
}

/**
 * Apply generic industry template narratives and optional structure to a draft report.
 * Does not insert client, site or supplier branding.
 * @param {object} report
 * @param {{ includeSamplePanel?: boolean }} [opts]
 */
export function applyIndustryGprTemplate(report, opts = {}) {
  const sections = { ...(report.sections || {}) };

  if (!sections.foreword?.trim()) sections.foreword = GENERIC_GPR_FOREWORD;
  if (!sections.scope?.trim()) sections.scope = GENERIC_GPR_SCOPE;
  if (!sections.methodology?.trim()) {
    sections.methodology = [
      "Ground penetrating radar survey undertaken in accordance with general UK geophysical good practice.",
      "",
      GENERIC_GPR_WORKFLOW,
    ].join("\n\n");
  }
  if (!sections.dataProcessing?.trim()) sections.dataProcessing = GENERIC_GPR_DATA_PROCESSING;
  if (!sections.interpretationCriteria?.trim()) sections.interpretationCriteria = GENERIC_GPR_INTERPRETATION;
  if (!sections.recommendations?.trim()) {
    sections.recommendations = [
      "Treat all GPR anomalies as indicative until verified by appropriate intrusive or secondary survey methods.",
      "Maintain safe working and isolation controls before breaking ground or removing structural fabric.",
      "Re-process or re-scan zones with disturbed signal, incomplete coverage or high clutter before relying on interpretations.",
    ].join("\n");
  }

  const processing = { ...(report.processing || {}) };
  if (!processing.software?.trim()) processing.software = "";
  if (!Array.isArray(processing.filters) || !processing.filters.length) {
    processing.filters = defaultProcessingFilters();
  }
  if (!processing.notes?.trim()) {
    processing.notes = "Standard time-domain filter chain applied; parameters recorded in processing log table.";
  }

  const deliverables =
    report.deliverables && Object.values(report.deliverables).some(Boolean)
      ? report.deliverables
      : { ...defaultDeliverableChecklist(), pdf_report: true };

  const scanPanels =
    report.scanPanels?.length || !opts.includeSamplePanel
      ? report.scanPanels || []
      : [
          blankGprScanPanel({
            panelRef: "Panel 1",
            gridSizeW: "",
            gridSizeH: "",
            scanSpacingH: "0.10",
            scanSpacingV: "0.10",
            targetDepthM: "",
            primaryInterpretation: "",
            signalQuality: "good",
            comments: "Example panel — replace with site scan metadata and link radargram screenshot.",
          }),
        ];

  const signOff = {
    authorName: report.signOff?.authorName || report.surveyor || "",
    authorRole: report.signOff?.authorRole || "Surveyor",
    processorName: report.signOff?.processorName || "",
    processorRole: report.signOff?.processorRole || "Data processor",
    checkerName: report.signOff?.checkerName || "",
    checkerRole: report.signOff?.checkerRole || "Technical reviewer",
    checkedDate: report.signOff?.checkedDate || "",
    ...report.signOff,
  };

  return {
    ...report,
    sections,
    processing,
    deliverables,
    scanPanels,
    chainageSegments: report.chainageSegments || [],
    signOff,
    templateAppliedAt: new Date().toISOString(),
  };
}
