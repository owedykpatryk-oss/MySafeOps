import {
  ANOMALY_CONFIDENCE,
  ANOMALY_TYPES,
  blankGprReport,
  GPR_LIMITATION_RULES,
  GPR_QA_ITEMS,
  PROCESSING_STEPS,
} from "./gprReportConstants";
import {
  recommendAntennaMhz,
  interpretGeologyForGpr,
} from "../../utils/gprGroundConditions";
import { buildStaticMapUrl } from "../../utils/staticMapUrl.js";
import { isUtilityMappingOrg } from "../../utils/utilityMappingOrg";
import { formatUtilityMappingTypedRef, nextUtilityMappingJobNumber, utilityMappingJobYearYY } from "../../utils/utilityMappingDocRefs";
import { matchUtilityMappingClientCode } from "../../utils/utilityMappingClients";

export function normalizeGprReport(raw) {
  const base = blankGprReport();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    equipment: Array.isArray(raw.equipment) && raw.equipment.length ? raw.equipment : base.equipment,
    acquisition: { ...base.acquisition, ...(raw.acquisition || {}) },
    velocityModel: { ...base.velocityModel, ...(raw.velocityModel || {}) },
    groundConditions: {
      ...base.groundConditions,
      ...(raw.groundConditions || {}),
      siteObservations: {
        ...base.groundConditions.siteObservations,
        ...(raw.groundConditions?.siteObservations || {}),
      },
    },
    environmental: { ...base.environmental, ...(raw.environmental || {}) },
    processing: { ...base.processing, ...(raw.processing || {}), filters: Array.isArray(raw.processing?.filters) ? raw.processing.filters : base.processing.filters },
    qaChecklist: { ...base.qaChecklist, ...(raw.qaChecklist || {}) },
    sections: { ...base.sections, ...(raw.sections || {}) },
    anomalies: Array.isArray(raw.anomalies) ? raw.anomalies : [],
    limitationKeys: Array.isArray(raw.limitationKeys) ? raw.limitationKeys : [],
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    radargrams: Array.isArray(raw.radargrams) ? raw.radargrams : [],
    planFigures: Array.isArray(raw.planFigures) ? raw.planFigures : [],
    scanPanels: Array.isArray(raw.scanPanels) ? raw.scanPanels : [],
    chainageSegments: Array.isArray(raw.chainageSegments) ? raw.chainageSegments : [],
    deliverables: { ...base.deliverables, ...(raw.deliverables || {}) },
    signOff: { ...base.signOff, ...(raw.signOff || {}) },
  };
}

export function nextGprRef(reports = [], seed = {}) {
  if (isUtilityMappingOrg()) {
    const yy = utilityMappingJobYearYY(seed.surveyDate);
    const existing = (reports || []).map((r) => ({
      ref: String(r.ref || "").replace(/-(RA|MS|PTW|GPR|SR)$/i, ""),
    }));
    const code =
      String(seed.umClientCode || seed.clientCode || "").trim().toUpperCase() ||
      matchUtilityMappingClientCode(seed.client) ||
      "XXX";
    const job = String(seed.umJobNumber || "").replace(/\D/g, "") || nextUtilityMappingJobNumber(existing, yy);
    return formatUtilityMappingTypedRef("GPR", {
      umJobNumber: job,
      umClientCode: code,
      surveyDate: seed.surveyDate,
    });
  }
  const year = new Date().getFullYear();
  const prefix = `GPR-${year}-`;
  const nums = reports
    .map((r) => r.ref || "")
    .filter((ref) => ref.startsWith(prefix))
    .map((ref) => parseInt(ref.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function buildLimitationsFromKeys(keys = []) {
  const set = new Set(keys);
  return GPR_LIMITATION_RULES.filter((r) => set.has(r.key))
    .map((r) => r.text)
    .join("\n\n");
}

export function anomalyTypeLabel(key) {
  return ANOMALY_TYPES.find((a) => a.key === key)?.label || key || "—";
}

export function anomalyConfidenceLabel(key) {
  return ANOMALY_CONFIDENCE.find((a) => a.key === key)?.label || key || "—";
}

export function buildQaNarrative(qa = {}) {
  const done = GPR_QA_ITEMS.filter((i) => qa[i.key]).map((i) => i.label);
  if (!done.length) return "QA checklist not completed.";
  return `Completed checks: ${done.join("; ")}.`;
}

export function gprStaticMapUrl(lat, lng) {
  return buildStaticMapUrl(lat, lng, { width: 120, height: 80, zoom: 15, label: "Site" });
}

const QUALITY_LABELS = [
  { key: "ref", label: "Report ref" },
  { key: "surveyDate", label: "Survey date" },
  { key: "surveyor", label: "Surveyor" },
  { key: "equipment", label: "Equipment" },
  { key: "acquisition", label: "Acquisition" },
  { key: "ground", label: "BGS ground data" },
  { key: "environment", label: "Weather / environment" },
  { key: "methodology", label: "Methodology" },
  { key: "findings", label: "Findings" },
  { key: "limitations", label: "Limitations" },
  { key: "velocity", label: "Velocity model" },
];

export function gprReportQuality(report) {
  const r = normalizeGprReport(report);
  const passed = {
    ref: Boolean(r.ref),
    surveyDate: Boolean(r.surveyDate),
    surveyor: Boolean(r.surveyor),
    equipment: Boolean(r.equipment?.[0]?.manufacturer || r.equipment?.[0]?.model),
    acquisition: Boolean(r.acquisition?.scanMode),
    ground: Boolean(r.groundConditions?.narrative || r.groundConditions?.fetchedAt),
    environment: Boolean(r.environmental?.description || r.environmental?.fetchedAt),
    methodology: Boolean(r.sections?.methodology?.trim()),
    findings: Boolean(r.sections?.findings?.trim() || r.anomalies?.length),
    limitations: Boolean(r.sections?.limitations?.trim() || r.limitationKeys?.length),
    velocity: Boolean(r.velocityModel?.measuredVelocityCmNs || r.velocityModel?.assumedVelocityCmNs),
  };
  const keys = Object.keys(passed);
  const score = Math.round((keys.filter((k) => passed[k]).length / keys.length) * 100);
  const missing = QUALITY_LABELS.filter((q) => !passed[q.key]).map((q) => q.label);
  return { score, missing, passed, checks: keys.length };
}

/** Evidence counts for hero chips and list rows. */
export function gprEvidenceStats(report) {
  const radargrams = report?.radargrams?.length || 0;
  const panels = report?.scanPanels?.length || 0;
  const chainage = report?.chainageSegments?.length || 0;
  const planFigures = report?.planFigures?.length || 0;
  const anomalies = report?.anomalies?.length || 0;
  const filtersApplied = (report?.processing?.filters || []).filter((f) => f.applied).length;
  return {
    radargrams,
    panels,
    chainage,
    planFigures,
    anomalies,
    filtersApplied,
    totalEvidence: radargrams + panels + chainage + planFigures,
  };
}

export function primaryAntennaMhz(report) {
  const eq = report?.equipment?.[0];
  return Number(eq?.antennaFrequencyMhz) || 400;
}

export function buildAcquisitionNarrative(acq = {}) {
  const parts = [];
  if (acq.scanMode) parts.push(`Scan mode: ${acq.scanMode.replace(/_/g, " ")}.`);
  if (acq.lineSpacingM) parts.push(`Line spacing: ${acq.lineSpacingM} m.`);
  if (acq.traceSpacingM) parts.push(`Trace spacing: ${acq.traceSpacingM} m.`);
  if (acq.depthRangeM) parts.push(`Target depth range: ${acq.depthRangeM} m.`);
  if (acq.timeWindowNs) parts.push(`Time window: ${acq.timeWindowNs} ns.`);
  if (acq.coveragePercent) parts.push(`Estimated coverage: ${acq.coveragePercent}%.`);
  if (acq.notes) parts.push(acq.notes);
  return parts.join(" ") || "Acquisition parameters not recorded.";
}

export function buildVelocityNarrative(vm = {}) {
  const parts = [];
  if (vm.calibrationMethod) parts.push(`Calibration: ${vm.calibrationMethod.replace(/_/g, " ")}.`);
  if (vm.measuredVelocityCmNs) {
    parts.push(`Measured velocity: ${vm.measuredVelocityCmNs} cm/ns.`);
  } else if (vm.assumedVelocityCmNs) {
    parts.push(`Assumed velocity: ${vm.assumedVelocityCmNs} cm/ns (site default).`);
  }
  if (vm.calibrationTarget) parts.push(`Calibration target: ${vm.calibrationTarget}.`);
  if (vm.calibrationNotes) parts.push(vm.calibrationNotes);
  return parts.join(" ") || "Velocity model not documented.";
}

export function buildAnomaliesSummaryTable(anomalies = []) {
  if (!anomalies.length) return "";
  return anomalies
    .map((a, i) => {
      const ref = a.ref || `#${i + 1}`;
      const depth = a.depthM ? `${a.depthM} m` : "—";
      return `${ref}: ${anomalyTypeLabel(a.anomalyType)} at ${depth} — ${a.interpretation || "Uninterpreted"} (${anomalyConfidenceLabel(a.confidence)}).`;
    })
    .join("\n");
}

/** Compare target depth vs BGS-indicative penetration. */
export function gprPenetrationRisk(report) {
  const r = normalizeGprReport(report);
  const expected = Number(r.groundConditions?.expectedPenetrationM);
  const target = Number(r.acquisition?.depthRangeM);
  if (!Number.isFinite(expected) || !Number.isFinite(target)) return { level: "unknown" };
  const ratio = target / expected;
  if (ratio <= 0.85) return { level: "ok", expected, target, message: "Target depth within indicative penetration." };
  if (ratio <= 1.1) return { level: "caution", expected, target, message: "Target depth near penetration limit — monitor SNR on site." };
  return {
    level: "risk",
    expected,
    target,
    message: `Target ${target} m exceeds indicative penetration ~${expected} m — consider lower MHz or supplementary technique.`,
  };
}

export function gprAntennaAdvice(report) {
  const r = normalizeGprReport(report);
  const target = Number(r.acquisition?.depthRangeM) || 2;
  const att = r.groundConditions?.attenuationClass || "moderate";
  const current = primaryAntennaMhz(r);
  const rec = recommendAntennaMhz(target, att);
  const match = Math.abs(current - rec.mhz) <= 150;
  return { ...rec, currentMhz: current, match };
}

export function summarizeGprReportList(reports = []) {
  const list = reports.map(normalizeGprReport);
  const finals = list.filter((r) => r.status === "final").length;
  const drafts = list.length - finals;
  const scores = list.map((r) => gprReportQuality(r).score);
  const avgComplete = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const needsWork = list.filter((r) => gprReportQuality(r).score < 70 && r.status !== "final").length;
  const withGeology = list.filter((r) => r.groundConditions?.fetchedAt).length;
  return { total: list.length, finals, drafts, avgComplete, needsWork, withGeology };
}

export function enrichGprListRow(report, project) {
  const r = normalizeGprReport(report);
  const q = gprReportQuality(r);
  const freq = r.equipment?.[0]?.antennaFrequencyMhz;
  const evidence = gprEvidenceStats(r);
  const parts = [];
  if (evidence.radargrams) parts.push(`${evidence.radargrams} radargram${evidence.radargrams !== 1 ? "s" : ""}`);
  if (evidence.panels) parts.push(`${evidence.panels} panel${evidence.panels !== 1 ? "s" : ""}`);
  if (evidence.planFigures) parts.push(`${evidence.planFigures} plan figure${evidence.planFigures !== 1 ? "s" : ""}`);
  return {
    report: r,
    score: q.score,
    ready: q.score >= 80 && r.status !== "final",
    isFinal: r.status === "final",
    mapThumb: gprStaticMapUrl(project?.lat, project?.lng),
    radargramThumb: r.radargrams?.find((rg) => rg.dataUrl)?.dataUrl || null,
    freqLabel: freq ? `${freq} MHz` : null,
    penLabel: r.groundConditions?.expectedPenetrationM ? `~${r.groundConditions.expectedPenetrationM} m` : null,
    anomalyCount: r.anomalies?.length || 0,
    evidenceLabel: parts.length ? parts.join(" · ") : null,
  };
}

/** Depth (m) from two-way time and velocity. */
export function depthFromTwoWayTime(timeNs, velocityCmNs) {
  const t = Number(timeNs);
  const v = Number(velocityCmNs);
  if (!Number.isFinite(t) || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(((t * v) / 200) * 100) / 100;
}

export function recalcGroundPenetration(report) {
  const r = normalizeGprReport(report);
  const gc = r.groundConditions;
  if (!gc?.bedrock && !gc?.superficial && !gc?.fetchedAt) return r;
  const interpreted = interpretGeologyForGpr(
    {
      fetchedAt: gc.fetchedAt,
      source: gc.source,
      scale: gc.scale,
      bedrock: gc.bedrock,
      superficial: gc.superficial,
    },
    { antennaMhz: primaryAntennaMhz(r), siteObservations: gc.siteObservations }
  );
  return {
    ...r,
    groundConditions: { ...gc, ...interpreted },
  };
}

export function buildAnomaliesGeoJson(report) {
  const r = normalizeGprReport(report);
  return {
    type: "FeatureCollection",
    features: (r.anomalies || []).map((a, i) => ({
      type: "Feature",
      properties: {
        ref: a.ref || `A${i + 1}`,
        anomalyType: a.anomalyType,
        depthM: a.depthM,
        confidence: a.confidence,
        interpretation: a.interpretation,
      },
      geometry: null,
    })),
    metadata: {
      reportRef: r.ref,
      surveyDate: r.surveyDate,
      site: r.siteAddress || r.projectName,
    },
  };
}

export function buildDuplicateGprPayload(report) {
  const r = normalizeGprReport(report);
  const now = new Date().toISOString();
  return normalizeGprReport({
    ...r,
    id: `gpr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ref: "",
    status: "draft",
    title: r.title ? `${r.title} (copy)` : "",
    finalisedAt: null,
    smartFillAt: null,
    createdAt: now,
    updatedAt: now,
    anomalies: (r.anomalies || []).map((a) => ({
      ...a,
      id: `an_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    })),
    radargrams: (r.radargrams || []).map((rg) => ({
      ...rg,
      id: `rg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    })),
  });
}

export function autoNumberAnomalies(report) {
  const r = normalizeGprReport(report);
  return {
    ...r,
    anomalies: (r.anomalies || []).map((a, i) => ({
      ...a,
      ref: a.ref?.trim() ? a.ref : `A${i + 1}`,
    })),
  };
}

export function buildProcessingStepsNarrative(processing = {}) {
  const steps = processing.stepsApplied || [];
  const filterRows = (processing.filters || []).filter((f) => f.applied);
  const parts = [];
  if (steps.length) {
    const labels = PROCESSING_STEPS.filter((s) => steps.includes(s.key)).map((s) => s.label);
    parts.push(`Processing workflow: ${labels.join(" → ")}.`);
  }
  if (filterRows.length) {
    parts.push(
      `Filters applied: ${filterRows.map((f) => `${f.label}${f.parameter ? ` (${f.parameter})` : ""}`).join("; ")}.`
    );
  }
  if (processing.software) parts.push(`Software: ${processing.software}.`);
  if (processing.filterSettings) parts.push(`Legacy filter notes: ${processing.filterSettings}.`);
  if (processing.notes) parts.push(processing.notes);
  return parts.join(" ");
}
