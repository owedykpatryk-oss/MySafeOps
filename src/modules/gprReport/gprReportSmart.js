/**
 * Smart automation for GPR reports — geology API, weather, limitation suggestions, prebuilt narratives.
 */
import { fetchWeatherForDate, resolveSiteCoordinates } from "../../utils/weatherSummary";
import { mapWeatherSnapshotToFields } from "../../utils/weatherFieldMap";
import {
  buildGprWeatherImpactNarrative,
  interpretGeologyForGpr,
} from "../../utils/gprGroundConditions";
import {
  buildLimitationsFromKeys,
  primaryAntennaMhz,
  buildProcessingStepsNarrative,
  recalcGroundPenetration,
  buildAnomaliesSummaryTable,
  buildAcquisitionNarrative,
  buildVelocityNarrative,
} from "./gprReportHelpers";
import { blankGprReport, GPR_LIMITATION_RULES, ANOMALY_QUICK_TEMPLATES, blankGprAnomaly } from "./gprReportConstants";
import { applyIndustryGprTemplate } from "./gprReportTemplateContext";
import {
  buildGprLineLengthNarrative,
  buildGprLineLengthSummary,
  buildGprSurveyLineComparison,
  importChainageFromSurveyCad,
} from "./gprLineLengthSummary.js";

const GEOLOGY_PROXY = "/api/geology";

async function fetchGeologyAtPoint(lat, lng) {
  const u = new URL(GEOLOGY_PROXY, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lng", String(lng));
  const r = await fetch(u.toString(), { credentials: "same-origin" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "Geology lookup failed");
  }
  return r.json();
}

export async function fetchGeologyIntoReport(report, project) {
  const coords = await resolveSiteCoordinates(
    project?.lat ?? project?.siteLat,
    project?.lng ?? project?.siteLng,
    project?.postcode || report?.siteAddress,
  );
  if (!coords) throw new Error("Could not resolve site coordinates for geology lookup");

  const bgs = await fetchGeologyAtPoint(coords.lat, coords.lng);
  const antennaMhz = primaryAntennaMhz(report);
  const interpreted = interpretGeologyForGpr(bgs, {
    antennaMhz,
    siteObservations: report.groundConditions?.siteObservations,
  });

  return {
    ...report,
    groundConditions: {
      ...report.groundConditions,
      ...interpreted,
    },
    smartFillAt: new Date().toISOString(),
  };
}

export async function fetchEnvironmentalIntoReport(report, project) {
  const coords = await resolveSiteCoordinates(
    project?.lat ?? project?.siteLat,
    project?.lng ?? project?.siteLng,
    project?.postcode || report?.siteAddress,
  );
  if (!coords) throw new Error("Could not resolve coordinates for weather");

  const date = report.surveyDate || new Date().toISOString().slice(0, 10);
  const snap = await fetchWeatherForDate(coords.lat, coords.lng, date, {
    postcode: project?.postcode,
  });
  const mapped = mapWeatherSnapshotToFields({
    description: snap.description,
    tempC: snap.tempC,
    windMph: snap.windMph ?? 0,
  });

  const environmental = {
    description: snap.description,
    groundSurface: mapped.groundSurface,
    rainDuringSurvey: mapped.rainDuringSurvey,
    phenomena: mapped.phenomena,
    tempC: snap.tempC,
    tempMinC: snap.tempMinC,
    windMph: snap.windMph,
    fetchedAt: snap.fetchedAt,
    source: snap.source,
    moistureImpactOnGpr: "",
    surfaceCouplingNotes: "",
  };
  environmental.moistureImpactOnGpr = buildGprWeatherImpactNarrative(environmental);

  return {
    ...report,
    environmental,
    smartFillAt: new Date().toISOString(),
  };
}

/** Rule-based limitation keys from ground, weather and acquisition. */
export function suggestGprLimitationKeys(report) {
  const keys = new Set(report?.limitationKeys || []);
  const gc = report?.groundConditions || {};
  const env = report?.environmental || {};
  const obs = gc.siteObservations || {};

  if (gc.attenuationClass === "high" || gc.attenuationClass === "very_high" || gc.materialClass === "clay_silt") {
    keys.add("attenuation_clay");
  }
  if (gc.materialClass === "made_ground" || obs.madeGround) keys.add("made_ground");
  if (obs.reinforcement === "present" || obs.reinforcement === "extensive") keys.add("reinforcement_clutter");
  if (
    env.rainDuringSurvey === "light" ||
    env.rainDuringSurvey === "heavy" ||
    obs.moisture === "wet" ||
    obs.moisture === "waterlogged"
  ) {
    keys.add("weather_moisture");
  }
  keys.add("frequency_resolution");
  keys.add("velocity_uncertainty");
  keys.add("no_verification");

  const coverage = Number(report?.acquisition?.coveragePercent);
  if (Number.isFinite(coverage) && coverage < 90) keys.add("access_coverage");

  return [...keys];
}

export function buildDefaultMethodology(report) {
  const eq = report?.equipment?.[0] || {};
  const freq = eq.antennaFrequencyMhz || 400;
  const scan = report?.acquisition?.scanMode || "grid";
  return [
    "Ground penetrating radar (GPR) survey undertaken in accordance with general UK geophysical good practice.",
    "",
    `Equipment: ${[eq.manufacturer, eq.model].filter(Boolean).join(" ") || "GPR system"} with ${freq} MHz centre frequency${eq.channels > 1 ? ` (${eq.channels}-channel array)` : ""}.`,
    `Acquisition: ${scan.replace(/_/g, " ")} pattern with calibrated time window and wheel encoder / GPS positioning as configured on site.`,
    "",
    "Data were reviewed on site for coverage gaps. Post-processing included dewow, background removal and time-varying gain; velocity analysis applied for depth conversion.",
    "",
    "Interpretation criteria: hyperbolic reflections with consistent phase and lateral extent classified as potential buried features; diffraction patterns and amplitude anomalies flagged for verification.",
  ].join("\n");
}

export function buildDefaultInterpretationCriteria() {
  return [
    "High confidence: hyperbola apex resolvable, consistent on multiple parallel lines, depth consistent with records or site context.",
    "Medium confidence: single-line hyperbola or linear reflector with moderate SNR — indicative position only.",
    "Low / indicative: weak amplitude, clutter-dominated zone, or made-ground context — requires verification before dig.",
    "",
    "Depths converted using site velocity model; local material changes may introduce ±10–15% depth error.",
    "Non-metallic services (PE, PVC, fibre) may produce weaker responses than metallic equivalents.",
  ].join("\n");
}

export function buildExecutiveSummaryDraft(report) {
  const site = report.siteAddress || report.projectName || "the survey area";
  const date = report.surveyDate
    ? new Date(report.surveyDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "the survey date";
  const eq = report.equipment?.[0] || {};
  const freq = eq.antennaFrequencyMhz || 400;
  const nAnomalies = report.anomalies?.length || 0;
  const pen = report.groundConditions?.expectedPenetrationM;

  return [
    `GPR survey at ${site} on ${date}.`,
    `${[eq.manufacturer, eq.model].filter(Boolean).join(" ") || "GPR equipment"} deployed at ${freq} MHz.`,
    pen ? `Indicative penetration ~${pen} m based on BGS geology and antenna frequency.` : "",
    nAnomalies ? `${nAnomalies} anomaly/anomalies logged — see Findings.` : "Findings documented in attached sections.",
    "Interpretations are geophysical only; intrusive verification recommended before mechanical excavation.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildRecommendationsDraft(report) {
  const lines = [
    "Treat all GPR anomalies as indicative until verified by hand dig, vacuum excavation or secondary detection.",
    "Maintain safe dig practices and permit-to-dig controls regardless of GPR coverage.",
  ];
  if (report.groundConditions?.materialClass === "clay_silt") {
    lines.push("Consider supplementary EML/CAT in clay-rich zones where GPR penetration was limited.");
  }
  if (report.groundConditions?.materialClass === "made_ground") {
    lines.push("Prioritise verification in made-ground areas where velocity model uncertainty is elevated.");
  }
  return lines.join("\n");
}

export function applyGprSmartNarratives(report) {
  const r = { ...report };
  const sections = { ...r.sections };

  if (!sections.methodology?.trim()) sections.methodology = buildDefaultMethodology(r);
  if (!sections.interpretationCriteria?.trim()) sections.interpretationCriteria = buildDefaultInterpretationCriteria();
  if (!sections.executiveSummary?.trim()) sections.executiveSummary = buildExecutiveSummaryDraft(r);
  if (!sections.recommendations?.trim()) sections.recommendations = buildRecommendationsDraft(r);

  const withTemplate = applyIndustryGprTemplate({ ...r, sections }, { includeSamplePanel: false });
  sections.foreword = sections.foreword?.trim() ? sections.foreword : withTemplate.sections.foreword;
  if (!sections.dataProcessing?.trim()) sections.dataProcessing = withTemplate.sections.dataProcessing;
  if (!r.processing?.filters?.length && withTemplate.processing?.filters?.length) {
    r.processing = { ...r.processing, filters: withTemplate.processing.filters };
  }

  const limitationKeys = suggestGprLimitationKeys(r);
  const autoLimitations = buildLimitationsFromKeys(limitationKeys);
  if (!sections.limitations?.trim() && autoLimitations) sections.limitations = autoLimitations;

  if (!sections.findings?.trim() && r.anomalies?.length) {
    sections.findings = r.anomalies
      .map((a, i) => {
        const ref = a.ref || `A${i + 1}`;
        return `${ref}: ${a.interpretation || "Anomaly"} — depth ${a.depthM || "—"} m (${a.confidence || "medium"} confidence).`;
      })
      .join("\n");
  }

  if (r.groundConditions?.narrative && !sections.scope?.includes("BGS")) {
    sections.scope =
      (sections.scope ? `${sections.scope}\n\n` : "") +
      "Ground context (BGS 1:625k):\n" +
      r.groundConditions.narrative;
  }

  return {
    ...r,
    sections,
    limitationKeys,
    limitationsText: r.limitationsText || autoLimitations,
  };
}

/** One-click prebuilt pack: industry template + BGS + weather + rule-based narratives. */
export async function applyPrebuiltGprPack(report, project) {
  let r = applyIndustryGprTemplate(report, { includeSamplePanel: false });
  return runGprSmartFill(r, project);
}

export async function runGprSmartFill(report, project) {
  let r = normalizeGprReportLocal(report);
  try {
    r = await fetchGeologyIntoReport(r, project);
  } catch {
    /* geology optional if coords missing */
  }
  try {
    r = await fetchEnvironmentalIntoReport(r, project);
  } catch {
    /* weather optional */
  }
  r = applyGprSmartNarratives(r);
  r.smartFillAt = new Date().toISOString();
  return r;
}

export function prefillGprFromProject(report, project) {
  if (!project) return report;
  return {
    ...report,
    projectId: project.id || report.projectId,
    projectName: project.name || report.projectName,
    siteAddress: project.address || project.postcode || report.siteAddress,
    title: report.title || `GPR report — ${project.name || report.ref || "site"}`,
  };
}

function normalizeGprReportLocal(raw) {
  return blankGprReport({ ...raw, equipment: raw?.equipment, anomalies: raw?.anomalies });
}

export { GPR_LIMITATION_RULES, ANOMALY_QUICK_TEMPLATES };

/** Actionable tips for the editor banner. */
export function gprSmartTips(report, project, linkedSurveyReport = null) {
  const tips = [];
  if (!project?.lat && !project?.postcode && !report?.siteAddress) {
    tips.push({ level: "warn", text: "Link a project with postcode or coordinates to enable BGS geology lookup." });
  }
  if (!report.groundConditions?.fetchedAt) {
    tips.push({ level: "info", text: "Fetch BGS geology to auto-estimate penetration and limitations." });
  }
  if (!report.environmental?.fetchedAt) {
    tips.push({ level: "info", text: "Fetch weather for survey date — moisture impact text is generated automatically." });
  }
  const pen = report.groundConditions?.expectedPenetrationM;
  const target = Number(report.acquisition?.depthRangeM);
  if (pen && Number.isFinite(target) && target > pen * 1.05) {
    tips.push({
      level: "risk",
      text: `Target depth ${target} m may exceed indicative penetration ~${pen} m — review antenna frequency.`,
    });
  }
  if (!report.anomalies?.length) {
    tips.push({ level: "info", text: "Log anomalies or use quick templates on the Findings tab." });
  }
  if (!report.sections?.dataProcessing?.trim() && (report.processing?.stepsApplied || []).length) {
    tips.push({ level: "info", text: "Sync processing narrative from checked workflow steps." });
  }

  const surveyCadRows = linkedSurveyReport?.cadImport?.summary;
  const hasSurveyCad = Array.isArray(surveyCadRows) && surveyCadRows.some((r) => (Number(r.lengthM) || 0) > 0);
  const chainageEmpty = !(report.chainageSegments || []).length;
  if (hasSurveyCad && chainageEmpty) {
    tips.push({
      level: "info",
      text: "Linked survey has CAD line lengths — use “Import from survey CAD” on the Chainage tab to seed corridor segments.",
    });
  }
  if (hasSurveyCad && !report.linkedSurveyReportId) {
    tips.push({
      level: "info",
      text: "Link a survey report on Setup so GPR corridor totals compare against the CAD baseline in PDF export.",
    });
  }
  if (linkedSurveyReport && (report.chainageSegments || []).length) {
    const visual = buildGprLineLengthSummary(report);
    const cmp = buildGprSurveyLineComparison(visual, linkedSurveyReport);
    if (cmp.narrative?.includes("After GPR verification")) {
      tips.push({ level: "info", text: cmp.narrative.slice(0, 220) + (cmp.narrative.length > 220 ? "…" : "") });
    }
    const unverified = cmp.rows?.filter((r) => r.surveyLengthM > 0 && r.gprLengthM === 0) || [];
    if (unverified.length) {
      tips.push({
        level: "warn",
        text: `${unverified.length} utility line(s) on survey CAD not yet walked on GPR corridor — add chainage segments or note as out of scope.`,
      });
    }
  }

  return tips;
}

export function syncProcessingNarrative(report) {
  const narrative = buildProcessingStepsNarrative(report.processing);
  if (!narrative) return report;
  return {
    ...report,
    sections: { ...report.sections, dataProcessing: narrative },
  };
}

export function syncGroundOnEquipmentChange(report) {
  return recalcGroundPenetration(report);
}

export function addAnomalyFromTemplate(report, templateKey) {
  const tpl = ANOMALY_QUICK_TEMPLATES.find((t) => t.key === templateKey);
  if (!tpl) return report;
  const n = (report.anomalies || []).length + 1;
  const anomaly = blankGprAnomaly({
    ref: `A${n}`,
    anomalyType: tpl.anomalyType,
    interpretation: tpl.interpretation,
    confidence: tpl.confidence,
  });
  return { ...report, anomalies: [...(report.anomalies || []), anomaly] };
}

export function importFromSurveyReport(gprReport, surveyReport) {
  if (!surveyReport) return gprReport;
  let next = { ...gprReport };
  if (surveyReport.surveyType === "gpr_survey" || surveyReport.surveyType) {
    next.linkedSurveyReportId = surveyReport.id;
  }
  if (surveyReport.sections?.findings && !next.sections.findings) {
    next.sections = { ...next.sections, findings: surveyReport.sections.findings };
  }
  if (surveyReport.sections?.methodology && !next.sections.methodology) {
    next.sections = { ...next.sections, methodology: surveyReport.sections.methodology };
  }
  if (surveyReport.weather && !next.environmental?.fetchedAt) {
    next.environmental = {
      ...next.environmental,
      description: surveyReport.weather.conditionsNarrative || next.environmental.description,
      groundSurface: surveyReport.weather.groundSurface || next.environmental.groundSurface,
      rainDuringSurvey: surveyReport.weather.rainDuringSurvey || next.environmental.rainDuringSurvey,
    };
  }
  if (surveyReport.limitationKeys?.length && !next.limitationKeys?.length) {
    next.limitationKeys = [...surveyReport.limitationKeys];
  }

  const hasCad = Array.isArray(surveyReport?.cadImport?.summary)
    && surveyReport.cadImport.summary.some((r) => (Number(r.lengthM) || 0) > 0);
  if (hasCad && !(next.chainageSegments || []).length) {
    try {
      next = importChainageFromSurveyCad(next, surveyReport);
    } catch {
      /* CAD import optional during survey pull */
    }
  }

  const narrative = buildGprLineLengthNarrative(next, surveyReport);
  if (narrative) {
    const existing = String(next.sections?.findings || "").trim();
    const snippet = narrative.slice(0, 48);
    if (!existing.includes(snippet)) {
      next.sections = {
        ...next.sections,
        findings: existing ? `${existing}\n\n${narrative}` : narrative,
      };
    }
  }

  return normalizeGprReportLocal(next);
}

export { importChainageFromSurveyCad, buildGprLineLengthNarrative };
