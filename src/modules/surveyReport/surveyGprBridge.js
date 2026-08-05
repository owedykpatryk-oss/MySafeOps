/**
 * Bridge GPR reports → PAS128 survey anomaly cards (Gallions-style).
 */
import { blankGprAnomalyCard } from "./surveyEvidencePack";

const TYPE_TO_CLASS = {
  utility: "linear",
  void: "void",
  reinforcement: "disturbance",
  bedrock: "unknown",
  other: "unknown",
  disturbance: "disturbance",
};

/**
 * Best-effort match of a radargram image to an anomaly (line/grid ref).
 * @param {object} anomaly
 * @param {object[]} radargrams
 */
export function matchRadargramForAnomaly(anomaly, radargrams = []) {
  const list = radargrams || [];
  if (!list.length) return null;
  const line = String(anomaly.lineOrGrid || "").trim().toLowerCase();
  if (line) {
    const hit = list.find((rg) => {
      const ref = String(rg.lineRef || "").trim().toLowerCase();
      const label = String(rg.label || "").trim().toLowerCase();
      return (ref && (line.includes(ref) || ref.includes(line))) || (label && label.includes(line));
    });
    if (hit?.dataUrl) return hit;
  }
  return list.find((rg) => rg.dataUrl) || null;
}

/**
 * @param {object} anomaly — GPR anomaly row
 * @param {object[]} [radargrams]
 */
export function mapGprAnomalyToSurveyCard(anomaly = {}, radargrams = []) {
  const depth = String(anomaly.depthM ?? "").trim();
  const rg = matchRadargramForAnomaly(anomaly, radargrams);
  const bits = [
    anomaly.interpretation,
    anomaly.confidence ? `Confidence: ${anomaly.confidence}` : "",
    anomaly.lineOrGrid ? `Line/grid: ${anomaly.lineOrGrid}` : "",
    anomaly.notes,
  ].filter((s) => String(s || "").trim());

  return blankGprAnomalyCard({
    ref: anomaly.ref || "",
    classKey: TYPE_TO_CLASS[anomaly.anomalyType] || "unknown",
    depthMinM: depth,
    depthMaxM: depth,
    interpretation: bits.join(" — "),
    screenshotUrl: rg?.dataUrl || "",
    sourceGprAnomalyId: anomaly.id || "",
  });
}

/**
 * Import anomalies (+ optional conclusions) from a GPR report into a survey report.
 * @param {object} survey
 * @param {object} gprReport
 * @param {{ merge?: boolean, replace?: boolean }} [opts]
 */
export function importGprReportIntoSurvey(survey, gprReport, opts = {}) {
  if (!survey || !gprReport) return survey;
  const merge = opts.replace ? false : opts.merge !== false;
  const incoming = (gprReport.anomalies || []).map((a) => mapGprAnomalyToSurveyCard(a, gprReport.radargrams));
  if (!incoming.length && !String(gprReport.sections?.findings || "").trim()) {
    return {
      ...survey,
      linkedGprReportId: gprReport.id || survey.linkedGprReportId || "",
      updatedAt: new Date().toISOString(),
    };
  }

  let cards = [...(survey.gprAnomalyCards || [])];
  if (opts.replace || !merge) {
    cards = incoming;
  } else {
    const bySource = new Set(cards.map((c) => c.sourceGprAnomalyId).filter(Boolean));
    const byRef = new Set(cards.map((c) => String(c.ref || "").toLowerCase()).filter(Boolean));
    for (const card of incoming) {
      const src = card.sourceGprAnomalyId;
      const refKey = String(card.ref || "").toLowerCase();
      if (src && bySource.has(src)) continue;
      if (refKey && byRef.has(refKey)) continue;
      cards.push(card);
      if (src) bySource.add(src);
      if (refKey) byRef.add(refKey);
    }
  }

  const gprFindings = String(gprReport.sections?.findings || "").trim();
  const conclusions =
    String(survey.gprConclusions || "").trim() ||
    (gprFindings
      ? gprFindings
      : incoming.length
        ? `${incoming.length} GPR anomal${incoming.length === 1 ? "y" : "ies"} imported from ${gprReport.ref || gprReport.title || "linked GPR report"}. Treat as indicative until verified.`
        : "");

  return {
    ...survey,
    linkedGprReportId: gprReport.id || "",
    gprAnomalyCards: cards,
    gprConclusions: conclusions,
    updatedAt: new Date().toISOString(),
  };
}

/** GPR reports for the same project (prefer those with anomalies). */
export function listGprReportsForSurveyProject(gprReports = [], projectId = "") {
  if (!projectId) return [];
  return (gprReports || [])
    .filter((g) => g && g.projectId === projectId)
    .sort((a, b) => {
      const an = (b.anomalies || []).length - (a.anomalies || []).length;
      if (an) return an;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
}

/**
 * Auto-merge GPR anomalies into a survey when a link (or same-project match) exists.
 * Skips if survey already has cards sourced from every GPR anomaly.
 */
export function autoSyncGprIntoSurvey(survey, gprReports = []) {
  if (!survey?.projectId) return survey;
  const list = listGprReportsForSurveyProject(gprReports, survey.projectId);
  const gpr =
    (survey.linkedGprReportId && list.find((g) => g.id === survey.linkedGprReportId)) ||
    list.find((g) => (g.anomalies || []).length > 0) ||
    null;
  if (!gpr || !(gpr.anomalies || []).length) return survey;

  const existingSources = new Set((survey.gprAnomalyCards || []).map((c) => c.sourceGprAnomalyId).filter(Boolean));
  const missing = (gpr.anomalies || []).some((a) => a.id && !existingSources.has(a.id));
  if (!missing && survey.linkedGprReportId === gpr.id) return survey;

  return importGprReportIntoSurvey(survey, gpr, { merge: true });
}

/**
 * Push GPR anomalies into a linked survey report row (for GPR→Survey save sync).
 * @param {object} gprReport
 * @param {object[]} surveyReports
 * @returns {{ reports: object[], updated: object|null }}
 */
export function pushGprIntoLinkedSurvey(gprReport, surveyReports = []) {
  if (!gprReport?.id) return { reports: surveyReports, updated: null };
  const target =
    (gprReport.linkedSurveyReportId &&
      surveyReports.find((s) => s.id === gprReport.linkedSurveyReportId)) ||
    surveyReports.find(
      (s) => s.projectId === gprReport.projectId && (s.linkedGprReportId === gprReport.id || s.surveyType === "gpr_survey")
    ) ||
    surveyReports.find((s) => s.projectId === gprReport.projectId && ["utility_mapping_survey", "eml_cat_survey", "gpr_survey"].includes(s.surveyType));

  if (!target) return { reports: surveyReports, updated: null };

  const updated = importGprReportIntoSurvey(target, gprReport, { merge: true });
  if (updated === target) return { reports: surveyReports, updated: null };

  return {
    reports: surveyReports.map((s) => (s.id === updated.id ? updated : s)),
    updated,
  };
}
