/**
 * Actionable blockers for GPR editor — quality + evidence gates.
 */

import { gprReportQuality } from "./gprReportHelpers.js";
import { buildGprLineLengthSummary, buildGprSurveyLineComparison } from "./gprLineLengthSummary.js";
import { isGprPreSurveyStarted } from "./gprPreSurvey.js";
import { findDuplicateGprNarrativeSections } from "./gprNarrativeAutomation.js";

/**
 * @param {object} report
 * @param {{ linkedSurveyReport?: object, project?: object }} [context]
 */
export function buildGprIssueChecklist(report = {}) {
  const items = [];
  const mode = report.coverBranding?.mode;
  const hasClientLogo = Boolean(
    String(report.coverBranding?.clientLogoDataUrl || "").trim() || String(report.coverBranding?.clientCode || "").trim()
  );
  if ((mode === "client" || mode === "both") && !hasClientLogo) {
    items.push("Client logo is missing from the cover.");
  }
  if (!(report.radargrams || []).length && !(report.scanPanels || []).length) {
    items.push("No radargram or scan panel is attached.");
  }
  const unverified = (report.includeHistoricalEvidence ? report.historicalEvidence || [] : []).filter(
    (item) => item && item.verified !== true && (item.imageDataUrl || item.observedFact || item.dataUrl)
  );
  if (unverified.length) {
    items.push(
      `${unverified.length} archive photo${unverified.length === 1 ? " is" : "s are"} still unverified and will not be stated as fact.`
    );
  }
  const expected = Number(report.groundConditions?.expectedPenetrationM);
  const panels = report.scanPanels || [];
  if (Number.isFinite(expected) && expected > 0 && panels.length && !panels.some((panel) => Number(panel.readableDepthM) > 0)) {
    items.push("Scan panels have no readable depth, so a shallow-signal note cannot be written.");
  }
  return items;
}

export function buildGprBlockers(report, context = {}) {
  const quality = gprReportQuality(report);
  /** @type {Array<{ id: string, label: string, tab: string, anchor: string, severity: string }>} */
  const blockers = [];

  const push = (id, label, tab, severity = "warn", anchor = "") => {
    blockers.push({ id, label, tab, anchor, severity });
  };

  quality.missing.forEach((label, i) => {
    const tabMap = {
      "Report ref": "setup",
      "Survey date": "setup",
      Equipment: "equipment",
      Acquisition: "equipment",
      "BGS ground data": "ground",
      Methodology: "narrative",
      Findings: "findings",
      Limitations: "narrative",
      "Velocity model": "equipment",
    };
    push(`q_${i}`, label, tabMap[label] || "setup", "warn", "");
  });

  const hasCoordinatePair = (lat, lng) => {
    const latText = String(lat ?? "").trim();
    const lngText = String(lng ?? "").trim();
    if (!latText || !lngText) return false;
    const latitude = Number(latText);
    const longitude = Number(lngText);
    return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  };
  const hasSiteLocation = Boolean(
    String(report?.siteAddress || report?.postcode || context.project?.address || context.project?.postcode || "").trim() ||
      hasCoordinatePair(report?.siteLat, report?.siteLng) ||
      hasCoordinatePair(report?.preSurvey?.lat, report?.preSurvey?.lng) ||
      hasCoordinatePair(context.project?.lat ?? context.project?.siteLat, context.project?.lng ?? context.project?.siteLng)
  );
  if (!hasSiteLocation) {
    push("site_location_missing", "Add a site address, postcode or valid coordinates", "setup", "block", "site-location");
  }

  const coverage = Number(report?.acquisition?.coveragePercent);
  if (String(report?.acquisition?.coveragePercent ?? "").trim() && (!Number.isFinite(coverage) || coverage <= 0 || coverage > 100)) {
    push("coverage_invalid", "Coverage must be between 1% and 100%", "equipment", "block", "acquisition");
  } else if (Number.isFinite(coverage) && coverage > 0 && coverage < 90) {
    push("coverage_low", `Coverage ${coverage}% — note incomplete areas in limitations`, "equipment", "warn", "acquisition");
  }

  const anomalies = report?.anomalies || [];
  const refs = anomalies.map((a) => String(a?.ref || "").trim().toLowerCase()).filter(Boolean);
  const duplicateRefs = [...new Set(refs.filter((ref, index) => refs.indexOf(ref) !== index))];
  if (duplicateRefs.length) {
    push(
      "duplicate_anomaly_refs",
      `Duplicate anomaly reference${duplicateRefs.length === 1 ? "" : "s"}: ${duplicateRefs.join(", ").toUpperCase()}`,
      "findings",
      "block",
      "anomalies"
    );
  }
  const incompleteAnomalies = anomalies.filter(
    (a) => !String(a?.ref || "").trim() || !String(a?.interpretation || "").trim() || !String(a?.confidence || "").trim()
  );
  if (incompleteAnomalies.length) {
    push(
      "incomplete_anomalies",
      `${incompleteAnomalies.length} anomaly row${incompleteAnomalies.length === 1 ? " is" : "s are"} missing ref, interpretation or confidence`,
      "findings",
      "block",
      "anomalies"
    );
  }

  const duplicateNarratives = findDuplicateGprNarrativeSections(report);
  if (duplicateNarratives.length) {
    push(
      "duplicate_narratives",
      `${duplicateNarratives.length} narrative section pair${duplicateNarratives.length === 1 ? " repeats" : "s repeat"} the same text — run smart narratives`,
      "narrative",
      "warn",
      "narrative"
    );
  }

  const targetDepth = Number(report?.acquisition?.depthRangeM);
  const expectedDepth = Number(report?.groundConditions?.expectedPenetrationM);
  if (report?.includeGeology && Number.isFinite(targetDepth) && Number.isFinite(expectedDepth) && expectedDepth > 0 && targetDepth > expectedDepth * 1.1) {
    push(
      "penetration_exceeded",
      `Target ${targetDepth} m exceeds indicative penetration ~${expectedDepth} m — document supplementary verification`,
      "ground",
      "warn",
      "penetration"
    );
  }

  if (!String(report?.signOff?.checkerName || "").trim()) {
    push("checker_missing", "Add an independent technical checker before final issue", "qa", "warn", "signoff");
  }

  if (!(report?.radargrams || []).length && !(report?.scanPanels || []).length) {
    push("no_radargrams", "Add at least one radargram or scan panel for client evidence", "findings", "warn", "radargrams");
  }

  if (!anomalies.length) {
    push("no_anomalies", "Log anomalies or use quick templates on Findings", "findings", "info", "anomalies");
  }

  const hasSurveyCad =
    Array.isArray(context.linkedSurveyReport?.cadImport?.summary) &&
    context.linkedSurveyReport.cadImport.summary.some((r) => (Number(r.lengthM) || 0) > 0);
  if (hasSurveyCad && !(report?.chainageSegments || []).length) {
    push("chainage_from_cad", "Import chainage from linked survey CAD", "findings", "info", "chainage");
  }

  if (context.linkedSurveyReport && (report?.chainageSegments || []).length) {
    const visual = buildGprLineLengthSummary(report);
    const cmp = buildGprSurveyLineComparison(visual, context.linkedSurveyReport);
    const unverified = cmp.rows?.filter((r) => r.surveyLengthM > 0 && r.gprLengthM === 0) || [];
    if (unverified.length) {
      push(
        "unverified_cad",
        `${unverified.length} survey CAD utility line(s) not yet on GPR corridor`,
        "findings",
        "warn",
        "chainage"
      );
    }
  }

  if (!isGprPreSurveyStarted(report?.preSurvey)) {
    push("no_start", "Tap Start here on Setup to stamp GPS and pre-survey checks", "setup", "info", "gpr-start-here");
  }

  if (report?.status !== "final" && quality.score < 70) {
    push("score_low", `Completeness ${quality.score}% — aim for 70%+ before final`, "qa", "block", "qa");
  }

  const score = quality.score;
  return { blockers, score };
}
