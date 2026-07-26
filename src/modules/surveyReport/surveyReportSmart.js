/**
 * Smart automation for survey reports — project prefill, weather mapping, templates, AI draft.
 */
import { fetchWeatherForDate, resolveSiteCoordinates } from "../../utils/weatherSummary";
import { mapWeatherSnapshotToFields } from "../../utils/weatherFieldMap";
import { fetchGeologyAtPoint, BGS_POSTCODE_ACCURACY_WARNING } from "../../utils/bgsGeologyClient";
import { interpretGeologyForSurvey, projectHasMapPin } from "../../utils/gprGroundConditions";
import { enrichGeologyWithSamplePoints } from "./surveyGeologyUpgrades";
import { resolveUkPostcodeInput } from "../../utils/postcodeLookup";
import { anthropicMessages, isAnthropicConfigured } from "../../utils/anthropicClient";
import {
  buildAccessLimitationsText,
  buildLimitationsFromKeys,
  buildUtilityRecordsNarrative,
  buildWeatherNarrative,
  nextSurveyRef,
  surveyTypeLabel,
} from "./surveyReportHelpers";
import { PAS128_QUALITY_LEVELS, UTILITY_RECORDS_PRESETS, blankSurveyReport } from "./surveyReportConstants";
import { buildPlanLegend, zoneKindLabel, assetKindLabel } from "../../utils/planMarkupMeta";
import { capturePlanSnapshots } from "../../utils/planSnapshot";
import {
  countGeoPhotosForReport,
  importGeoPhotosIntoReport,
  projectGeoPhotosForReport,
} from "../../utils/geoPhotoIntegrations.js";
import { getSurveyTypeTemplate } from "../../utils/surveyOrgTemplates";
import {
  catalogDefaultDeliverables,
  enrichMethodologyWithPas128,
  getSurveyCatalogEntry,
  getSurveyPackMeta,
  isUtilitySurveyType,
} from "../../utils/surveyContentCatalog";
import { buildPas128Foreword } from "./pas128ReportBoilerplate";
import { applyPas128MethodToReport, defaultPas128MethodForSurveyType, pas128MethodAppliesToSurveyType } from "./pas128MethodPresets";
import { buildFindingsDraft } from "./pas128FindingsBuilder";
import {
  applyMobilisationQaPrefill,
  getQaChecklistProgress,
  mergeStandardsCited,
} from "./surveyQaPack";
import { syncSurveyReportFromRams } from "./surveyRamsSync";
import { applyUtilityMappingProjectJobToDoc } from "../../utils/utilityMappingProjectJob";
import { inheritSiteContextOntoDoc } from "../../utils/inheritSiteContext";

import { todayLocalISO } from "../../utils/localDate";
export { mapWeatherSnapshotToFields } from "../../utils/weatherFieldMap";

export { syncSurveyReportFromRams, buildRamsPatchFromSurveyReport, mergeRamsWithSurveyReport } from "./surveyRamsSync";

function applySurveyTemplatePlaceholders(template, report) {
  if (!template?.trim()) return "";
  const site = report?.siteAddress || report?.projectName || "the agreed site";
  const date = report?.surveyDate
    ? new Date(report.surveyDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "the survey date";
  return template.replace(/\{site\}/gi, site).replace(/\{date\}/gi, date);
}

export function buildSurveyExtentFromProject(project) {
  if (!project) return "";
  const parts = [];
  if (project.boundaryName) parts.push(`Extent aligned to imported boundary: ${project.boundaryName}.`);
  const pts = project.boundaryPoints?.length;
  if (pts >= 3) parts.push(`Site boundary polygon (${pts} vertices) defines the survey limit unless otherwise stated in the client brief.`);
  if (project.postcode) parts.push(`Postcode reference: ${project.postcode}.`);
  if (project.address && !parts.length) parts.push(`Site: ${project.address}.`);
  return parts.join(" ");
}

export function pickRamsForProject(ramsDocs, projectId) {
  if (!projectId) return null;
  const matches = (ramsDocs || []).filter((d) => d.projectId === projectId);
  if (!matches.length) return null;
  return matches.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];
}

export function buildSurveyTypeDefaults(surveyType, pas128Ql = "") {
  const base = getSurveyTypeTemplate(surveyType);
  if (!base) return null;
  const entry = getSurveyCatalogEntry(surveyType);
  const ql = pas128Ql || entry?.defaultPas128Ql || "";
  const qlLabel = PAS128_QUALITY_LEVELS.find((q) => q.key === ql)?.label;
  const scope = qlLabel ? `${base.scope}\n\nTarget quality level: ${qlLabel}.` : base.scope;
  const methodology = enrichMethodologyWithPas128(surveyType, base.methodology);
  const meta = getSurveyPackMeta(surveyType);
  return {
    ...base,
    scope,
    methodology,
    defaultPas128Ql: ql,
    defaultPas128Method: meta.defaultPas128Method || "",
  };
}

/** Rule-based limitation keys from weather, records and access notes. */
export function suggestLimitationKeys(report) {
  const keys = new Set(report?.limitationKeys || []);
  const w = report?.weather || {};
  const rec = report?.utilityRecords || {};

  if (
    w.rainDuringSurvey === "light" ||
    w.rainDuringSurvey === "heavy" ||
    (w.phenomena || []).some((p) => ["drizzle", "light_rain", "heavy_rain"].includes(p))
  ) {
    keys.add("weather_impact");
  }
  if ((w.methodsAffected || []).includes("gpr") && w.rainDuringSurvey !== "none" && w.rainDuringSurvey !== "unknown") {
    keys.add("gpr_depth_limit");
  }
  if ((w.methodsAffected || []).includes("eml")) keys.add("eml_confidence");
  if ((rec.informationGaps || []).includes("client_not_supplied") || (rec.sourcesConsulted || []).includes("no_records")) {
    keys.add("records_not_available");
  }
  if ((rec.outcomes || []).includes("no_cross_check")) keys.add("records_not_available");
  if ((report.accessLimitations || []).length) keys.add("site_access_restricted");
  if ((w.phenomena || []).includes("frost") || w.groundSurface === "frozen") keys.add("hard_surface");

  return [...keys];
}

const ZONE_ACCESS_MAP = {
  exclusion: ["access_restricted", "security"],
  hazard: ["access_restricted", "live_plant"],
  fire_lane: ["access_restricted", "third_party"],
  work: ["live_plant"],
};

const ZONE_LIMITATION_MAP = {
  exclusion: ["site_access_restricted", "client_scope_excluded"],
  hazard: ["site_access_restricted", "services_live"],
  fire_lane: ["traffic_interface"],
};

/** Narrative block from project site plan markup (zones, routes, assets). */
export function buildSitePlanSummaryText(plans) {
  if (!plans?.length) return "";
  const blocks = [];

  plans.forEach((plan) => {
    const legend = buildPlanLegend(plan);
    const { counts } = legend;
    if (!counts?.routes && !counts?.zones && !counts?.assets) return;

    const lines = [
      `Plan "${plan.name || "Untitled"}": ${counts.routes || 0} escape route(s), ${counts.zones || 0} zone(s), ${counts.assets || 0} asset marker(s).`,
    ];

    (plan.escapeRoutes || []).forEach((r, i) => {
      lines.push(`  • Route: ${r.label || `Escape route ${i + 1}`} (${(r.points || []).length || 2} points).`);
    });
    (plan.zoneBlocks || []).forEach((z, i) => {
      lines.push(`  • Zone: ${z.label || zoneKindLabel(z.kind) || `Zone ${i + 1}`} — ${zoneKindLabel(z.kind)}.`);
    });
    (plan.emergencyAssets || []).forEach((a, i) => {
      lines.push(`  • Asset: ${a.label || assetKindLabel(a.kind) || `Marker ${i + 1}`} — ${assetKindLabel(a.kind)}.`);
    });

    blocks.push(lines.join("\n"));
  });

  return blocks.join("\n\n");
}

export function suggestAccessLimitationsFromPlans(plans) {
  const keys = new Set();
  (plans || []).forEach((plan) => {
    (plan.zoneBlocks || []).forEach((z) => {
      (ZONE_ACCESS_MAP[z.kind] || []).forEach((k) => keys.add(k));
    });
  });
  return [...keys];
}

export function suggestLimitationKeysFromPlans(plans) {
  const keys = new Set();
  (plans || []).forEach((plan) => {
    (plan.zoneBlocks || []).forEach((z) => {
      (ZONE_LIMITATION_MAP[z.kind] || []).forEach((k) => keys.add(k));
    });
  });
  return [...keys];
}

/** Merge site plan markup into findings, access notes and limitations. */
export function mergeSitePlanIntoReport(report, plans) {
  if (!plans?.length) throw new Error("No site plans with markup found for this project.");

  const summary = buildSitePlanSummaryText(plans);
  if (!summary) throw new Error("Site plans exist but have no routes, zones or assets marked yet.");

  const access = suggestAccessLimitationsFromPlans(plans);
  const planLimitations = suggestLimitationKeysFromPlans(plans);
  const limitationKeys = [...new Set([...(report.limitationKeys || []), ...planLimitations])];

  let findings = report.sections?.findings || "";
  const marker = "Site plan context";
  if (!findings.includes(marker)) {
    const block = `${marker} (from project site plans):\n${summary}`;
    findings = findings.trim() ? `${findings.trim()}\n\n${block}` : block;
  }

  let accessNotes = report.accessLimitationsNotes || "";
  if (access.length && !accessNotes.includes("site plan")) {
    const note = "Marked exclusion/hazard/work zones on the project site plan may have constrained survey coverage — see findings.";
    accessNotes = accessNotes.trim() ? `${accessNotes.trim()} ${note}` : note;
  }

  return {
    ...report,
    sitePlanSummary: summary,
    accessLimitations: [...new Set([...(report.accessLimitations || []), ...access])],
    accessLimitationsNotes: accessNotes,
    limitationKeys,
    limitationsText: buildLimitationsFromKeys(limitationKeys, report.limitationsText),
    sections: { ...report.sections, findings },
  };
}

/** Attach JPEG snapshots of marked site plans for PDF print (browser). */
export async function attachSitePlanSnapshots(report, plans, { maxPlans = 2 } = {}) {
  const withMarkup = (plans || []).filter((p) => {
    const c = buildPlanLegend(p).counts;
    return c?.routes || c?.zones || c?.assets;
  });
  if (!withMarkup.length) return report;

  const snapshots = await capturePlanSnapshots(withMarkup, { maxPlans });
  if (!snapshots.length) return report;

  return { ...report, sitePlanSnapshots: snapshots };
}

/** Standard recommendations paragraph by survey type. */
export function buildRecommendationsDraft(report) {
  const template = getSurveyTypeTemplate(report?.surveyType);
  if (template?.recommendationsTemplate?.trim()) {
    return applySurveyTemplatePlaceholders(template.recommendationsTemplate, report);
  }

  const type = report?.surveyType;
  const ql = report?.pas128Ql;

  if (type === "utility_mapping_survey" || type === "eml_cat_survey" || type === "gpr_survey") {
    const verify =
      ql === "B0" || ql === "B1"
        ? "Trial holes or vacuum excavation are recommended to verify critical services before design or breaking ground."
        : "Indicative detections should be verified by trial holes or vacuum excavation before breaking ground where tolerance is critical.";
    return `${verify} Client should issue this report to designers and contractors with the limitation statements herein. Statutory undertaker records should be refreshed if works are delayed.`;
  }
  if (type === "cctv_drainage_survey") {
    return "Recommend cleansing and re-survey of any runs that could not be accessed. Defects coded as structural should be assessed by a drainage engineer before adoption or connection works.";
  }
  if (type === "topographical_survey" || type === "setting_out") {
    return "Control and level datums should be protected on site; re-establishment survey may be required if control is disturbed. Use latest revision drawings for any follow-on setting out.";
  }
  if (type === "uav_aerial") {
    return "Orthophoto/DSM accuracy is subject to GCP placement and processing QA noted in deliverables. Re-flight may be required after significant site change or if weather invalidated capture.";
  }
  return "Findings are valid for the survey date and conditions recorded. Client should confirm scope and limitations before relying on this report for design or construction decisions.";
}

/** Apply PAS128-style default records preset when empty. */
export function applyDefaultRecordsPreset(report) {
  const rec = report.utilityRecords || {};
  if (rec.sourcesConsulted?.length) return report;

  const presetKey =
    report.surveyType === "utility_mapping_survey" || report.surveyType === "eml_cat_survey" || report.surveyType === "gpr_survey"
      ? "pas128_typical"
      : report.surveyType === "site_investigation_campaign"
        ? "gi_typical"
        : null;
  if (!presetKey) return report;

  const p = UTILITY_RECORDS_PRESETS[presetKey];
  return {
    ...report,
    utilityRecords: {
      ...rec,
      sourcesConsulted: [...p.sources],
      outcomes: [...p.outcomes],
      informationGaps: [...p.gaps],
    },
  };
}

/** Ordered next actions for the quality bar / smart panel. */
export function smartFillNextSteps(report, { project, projectPlans = [], geoPhotos = [] } = {}) {
  const steps = [];
  if (!report.projectId) steps.push({ id: "project", label: "Select a project", tab: "details" });
  if (!report.surveyType) steps.push({ id: "type", label: "Choose survey type", tab: "details" });
  if (!report.surveyor?.trim()) steps.push({ id: "surveyor", label: "Add surveyor / author", tab: "details" });
  if (!report.sections?.scope?.trim()) steps.push({ id: "scope", label: "Complete scope (Smart fill can draft this)", tab: "scope" });
  if (project?.lat && report.surveyDate && report.weather?.conditionsNarrative === "" && report.weather?.groundSurface === "unknown") {
    steps.push({ id: "weather", label: "Fetch weather for survey date", tab: "weather" });
  }
  if (
    !projectHasMapPin(project) &&
    (project?.postcode || report.siteAddress) &&
    !report.geology?.formation?.trim() &&
    ["utility_mapping_survey", "eml_cat_survey", "gpr_survey", "topo_plus_utility_survey"].includes(report.surveyType)
  ) {
    steps.push({
      id: "geology-pin",
      label: "Set project map pin for accurate BGS geology",
      tab: "details",
    });
  } else if (
    (projectHasMapPin(project) || project?.postcode) &&
    !report.geology?.formation?.trim() &&
    ["utility_mapping_survey", "eml_cat_survey", "gpr_survey", "topo_plus_utility_survey"].includes(report.surveyType)
  ) {
    steps.push({ id: "geology", label: "Fetch BGS geology (50k + boreholes)", tab: "findings" });
  }
  if (!report.utilityRecords?.sourcesConsulted?.length) {
    steps.push({ id: "records", label: "Records review checklist", tab: "records" });
  }
  if (projectPlans.length && !report.sitePlanSummary) {
    steps.push({ id: "plan", label: "Import site plan markup", tab: "findings" });
  }
  if (projectPlans.length && !report.sitePlanSnapshots?.length) {
    steps.push({ id: "plan-img", label: "Capture plan images for PDF", tab: "findings" });
  }
  if (!report.sections?.findings?.trim()) steps.push({ id: "findings", label: "Add survey findings", tab: "findings" });
  if (report.projectId && countGeoPhotosForReport(geoPhotos, report.projectId) > 0 && !report.geoPhotoImportAt) {
    steps.push({ id: "geo-photos", label: "Import geo-photos into report", tab: "photos" });
  }
  const utilityGeoCount = projectGeoPhotosForReport(geoPhotos, report.projectId).filter((p) =>
    ["utility_locator", "trial_pit", "manhole_chamber", "buried_services_warning", "gpr_setup"].includes(p.type)
  ).length;
  if (utilityGeoCount > 0 && !(report.utilitiesTable || []).some((r) => r.geoPhotoId)) {
    steps.push({ id: "utilities-geo", label: "Import utilities from geo-photos", tab: "findings" });
  }
  const giGeoCount = projectGeoPhotosForReport(geoPhotos, report.projectId).filter((p) =>
    ["trial_pit", "borehole_location", "window_sampling", "dcp_probe", "hand_auger_point", "sample_custody", "borehole_cap", "piezometer_install"].includes(
      p.type
    )
  ).length;
  if (
    report.surveyType === "site_investigation_campaign" &&
    giGeoCount > 0 &&
    !(report.giLocationsTable || []).some((r) => r.geoPhotoId)
  ) {
    steps.push({ id: "gi-geo", label: "Import GI locations from geo-photos", tab: "findings" });
  }
  if (!report.cadImport?.summary?.length && report.surveyType === "utility_mapping_survey") {
    steps.push({ id: "cad", label: "Import utility mapping DXF", tab: "findings" });
  }
  if (
    ["utility_mapping_survey", "gpr_survey"].includes(report.surveyType) &&
    !(report.gprAnomalyCards || []).length
  ) {
    steps.push({ id: "gpr", label: "Add or import GPR anomaly cards", tab: "findings" });
  }
  if (!report.sections?.executiveSummary?.trim()) steps.push({ id: "summary", label: "Draft executive summary", tab: "details" });
  if (!report.documentControl?.checkedBy?.trim()) steps.push({ id: "doc-control", label: "Document control (checked / approved)", tab: "details" });
  if (!Object.values(report.qaChecklist || {}).some(Boolean)) steps.push({ id: "qa", label: "Complete QA checklist", tab: "professional" });
  else {
    const qa = getQaChecklistProgress(report.qaChecklist, report.surveyType);
    if (qa.total >= 8 && qa.pct < 50) steps.push({ id: "qa-half", label: `QA checklist ${qa.checked}/${qa.total} — reach 50%`, tab: "professional" });
  }
  if (report.surveyType && !(report.standardsCited || []).length) {
    steps.push({ id: "standards", label: "Cite applicable UK standards", tab: "professional" });
  }
  if (!report.deliverables?.length) steps.push({ id: "deliverables", label: "Add deliverables schedule", tab: "scope" });
  if (!report.equipmentCalibration?.length) steps.push({ id: "calibration", label: "Equipment calibration records", tab: "professional" });
  return steps;
}

/** Projects that have no survey report yet. */
export function projectsMissingReports(projects, reports) {
  const covered = new Set((reports || []).map((r) => r.projectId).filter(Boolean));
  return (projects || []).filter((p) => p?.id && !covered.has(p.id));
}

/** Create blank draft reports for projects without one (sync prefill only). */
export function batchCreateDraftReports(projects, reports, ramsDocs = []) {
  const missing = projectsMissingReports(projects, reports);
  if (!missing.length) return { created: [], reports };

  const next = [...reports];
  const created = [];

  missing.forEach((project) => {
    const ref = nextSurveyRef(next);
    const base = blankSurveyReport({
      ref,
      title: `Survey report — ${project.name || ref}`,
      projectId: project.id,
    });
    const ramsDoc = pickRamsForProject(ramsDocs, project.id);
    const draft = prefillReportFromProject(base, project, ramsDoc);
    next.unshift(draft);
    created.push(draft);
  });

  return { created, reports: next };
}

/**
 * One-click pipeline: project/RAMS prefill → template → weather → site plan → records preset →
 * limitations → narratives → executive summary → recommendations → optional AI.
 */
export async function runSmartFillAll(report, ctx = {}) {
  const { project, ramsDocs = [], projectPlans = [], linkedRams, useAi = false, geoPhotos = [], permits = [] } = ctx;
  let r = { ...report, sections: { ...report.sections } };
  const rams = pickRamsForProject(ramsDocs, r.projectId) || linkedRams;

  if (project) r = prefillReportFromProject(r, project, rams);

  if (r.surveyType) {
    const defaults = buildSurveyTypeDefaults(r.surveyType, r.pas128Ql);
    if (defaults) {
      if (!r.sections.scope?.trim()) r.sections.scope = defaults.scope;
      if (!r.sections.methodology?.trim()) r.sections.methodology = defaults.methodology;
      if (!r.sections.equipmentUsed?.trim()) r.sections.equipmentUsed = defaults.equipmentUsed;
      if (!r.pas128Ql?.trim() && defaults.defaultPas128Ql) r.pas128Ql = defaults.defaultPas128Ql;
      if (!r.pas128Method?.trim() && defaults.defaultPas128Method) r.pas128Method = defaults.defaultPas128Method;
    }
    if (isUtilitySurveyType(r.surveyType) && !r.sections.foreword?.trim()) {
      r.sections.foreword = buildPas128Foreword(r);
    }
  }

  if (r.pas128Method) {
    r = applyPas128MethodToReport(r, r.pas128Method, { overwrite: false });
  }

  try {
    if (r.pas128Method) {
      const { seedPremiumFieldsFromMethod, buildRecordsMatrixNarrative } = await import("./surveyEvidencePack");
      r = seedPremiumFieldsFromMethod(r, r.pas128Method);
      if (!r.recordItemsNarrative?.trim() && (r.recordItems || []).length) {
        r.recordItemsNarrative = buildRecordsMatrixNarrative(r.recordItems, "");
      }
    }
    const { seedSmartFillPremiumV2 } = await import("./surveyPlanRemaining");
    r = seedSmartFillPremiumV2(r, { geoPhotos });
  } catch {
    /* optional premium pack */
  }

  r = applyDefaultRecordsPreset(r);

  if (project?.lat && project?.lng && r.surveyDate) {
    try {
      r = await fetchWeatherIntoReport(r, project);
    } catch {
      /* weather is best-effort in batch fill */
    }
  }

  try {
    if (!r.geology?.formation?.trim() && (project?.lat || project?.postcode || r.siteAddress)) {
      r = await fetchGeologyIntoSurveyReport(r, project, { overwrite: false });
    }
  } catch {
    /* geology is best-effort — BGS may be offline */
  }

  const plansWithMarkup = (projectPlans || []).filter((p) => {
    const c = buildPlanLegend(p).counts;
    return c?.routes || c?.zones || c?.assets;
  });
  if (plansWithMarkup.length) {
    try {
      r = mergeSitePlanIntoReport(r, plansWithMarkup);
      r = await attachSitePlanSnapshots(r, plansWithMarkup);
    } catch {
      /* skip if no markup */
    }
  }

  const keys = [
    ...new Set([
      ...suggestLimitationKeys(r),
      ...(r.limitationKeys || []),
      ...(getSurveyTypeTemplate(r.surveyType)?.defaultLimitationKeys || []),
    ]),
  ];
  r.limitationKeys = keys;
  r.limitationsText = buildLimitationsFromKeys(keys, r.limitationsText);

  r = applyGeneratedNarratives(r);

  if (geoPhotos.length && r.projectId && countGeoPhotosForReport(geoPhotos, r.projectId) > 0) {
    r = importGeoPhotosIntoReport(r, geoPhotos);
  }

  const exec = buildExecutiveSummaryDraft(r, { linkedRamsTitle: rams?.title || rams?.documentTitle || "" });
  if (exec && !r.sections.executiveSummary?.trim()) r.sections.executiveSummary = exec;

  const recs = buildRecommendationsDraft(r);
  if (recs && !r.sections.recommendations?.trim()) r.sections.recommendations = recs;

  if (useAi && isAnthropicConfigured()) {
    const draft = await generateAiSurveyDraft(r);
    r.sections = {
      ...r.sections,
      executiveSummary: draft.executiveSummary || r.sections.executiveSummary,
      scope: draft.scope || r.sections.scope,
      findings: draft.findings || r.sections.findings,
      recommendations: draft.recommendations || r.sections.recommendations,
    };
  }

  r = prefillProfessionalFields(r, { project, ramsDoc: rams, permits });

  if (r.surveyType) {
    r.standardsCited = mergeStandardsCited(r.standardsCited, r.surveyType);
    r.qaChecklist = applyMobilisationQaPrefill(r.qaChecklist, r.surveyType);
  }

  r.smartFillAt = new Date().toISOString();
  return r;
}

/**
 * One-click PAS 128 pack: default method → smart fill → auto findings from tables.
 */
export async function applyPas128CompletePack(report, ctx = {}) {
  let r = { ...report, sections: { ...(report.sections || {}) } };
  if (pas128MethodAppliesToSurveyType(r.surveyType)) {
    const method = r.pas128Method || defaultPas128MethodForSurveyType(r.surveyType);
    if (method) {
      r = applyPas128MethodToReport(r, method, { overwrite: false });
    }
  }
  r = await runSmartFillAll(r, ctx);
  const findings = buildFindingsDraft(r, { overwrite: Boolean(ctx.overwriteFindings) });
  if (findings && (ctx.overwriteFindings || !r.sections.findings?.trim())) {
    r.sections = { ...r.sections, findings };
  }
  return r;
}

export function buildExecutiveSummaryDraft(report, { linkedRamsTitle = "" } = {}) {
  const template = getSurveyTypeTemplate(report?.surveyType);
  if (template?.executiveSummaryTemplate?.trim()) {
    const base = applySurveyTemplatePlaceholders(template.executiveSummaryTemplate, report);
    return linkedRamsTitle ? `${base} Works were conducted under RAMS reference: ${linkedRamsTitle}.` : base;
  }

  const type = surveyTypeLabel(report?.surveyType) || "Site survey";
  const site = report?.siteAddress || report?.projectName || "the agreed site";
  const date = report?.surveyDate
    ? new Date(report.surveyDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "the survey date";
  const ql = report?.pas128Ql ? ` (${report.pas128Ql})` : "";
  const findings = String(report?.sections?.findings || "").trim();
  const findingsLead = findings ? findings.split(/\n/)[0].slice(0, 220) : "";

  const parts = [
    `${type}${ql} was undertaken at ${site} on ${date}.`,
    linkedRamsTitle ? `Works were conducted under RAMS reference: ${linkedRamsTitle}.` : null,
    findingsLead ? `Key outcomes: ${findingsLead}${findings.length > findingsLead.length ? "…" : ""}` : "Findings and deliverables are detailed in the sections below.",
    buildWeatherNarrative(report?.weather) ? "Weather at site is summarised in the Weather section." : null,
    buildUtilityRecordsNarrative(report?.utilityRecords) ? "Utility records review is documented in this report." : null,
  ].filter(Boolean);

  return parts.join(" ");
}

export function applyGeneratedNarratives(form) {
  const limitationsText = buildLimitationsFromKeys(form.limitationKeys, form.limitationsText);
  const weatherNarrative = buildWeatherNarrative(form.weather);
  let recordsNarrative = buildUtilityRecordsNarrative(form.utilityRecords);
  if (!recordsNarrative?.trim()) {
    const boilerplate = getSurveyTypeTemplate(form.surveyType)?.recordsBoilerplate;
    if (boilerplate?.trim()) recordsNarrative = boilerplate.trim();
  }
  const accessText = buildAccessLimitationsText(form.accessLimitations, form.accessLimitationsNotes);

  const nextWeather = { ...form.weather };
  if (weatherNarrative && !nextWeather.conditionsNarrative?.trim()) {
    nextWeather.conditionsNarrative = weatherNarrative;
  }

  let findings = form.sections?.findings || "";
  if (recordsNarrative && !findings.includes(recordsNarrative.slice(0, 40))) {
    findings = findings.trim() ? `${findings.trim()}\n\n${recordsNarrative}` : recordsNarrative;
  }
  if (accessText && !findings.includes(accessText.slice(0, 30))) {
    findings = findings.trim() ? `${findings.trim()}\n\n${accessText}` : accessText;
  }

  return {
    ...form,
    limitationsText,
    weather: nextWeather,
    sections: { ...form.sections, findings },
  };
}

/** Merge project + optional RAMS into a report draft (sync). */
export function prefillReportFromProject(report, project, ramsDoc = null) {
  if (!project) return report;
  const defaults = report.surveyType ? buildSurveyTypeDefaults(report.surveyType, report.pas128Ql) : null;
  const extent = buildSurveyExtentFromProject(project);

  let next = {
    ...report,
    projectId: project.id,
    projectName: project.name || report.projectName,
    client: project.client || project.site || report.client,
    siteAddress: project.address || report.siteAddress,
    sections: { ...report.sections },
  };

  if (extent && !next.sections.surveyExtent?.trim()) next.sections.surveyExtent = extent;
  if (defaults) {
    if (!next.sections.scope?.trim()) next.sections.scope = defaults.scope;
    if (!next.sections.methodology?.trim()) next.sections.methodology = defaults.methodology;
    if (!next.sections.equipmentUsed?.trim()) next.sections.equipmentUsed = defaults.equipmentUsed;
  }

  if (project.weatherSnapshot && !next.weather?.conditionsNarrative?.trim()) {
    next.weather = {
      ...next.weather,
      conditionsNarrative: project.weatherSnapshot,
    };
  }

  if (ramsDoc) {
    const synced = syncSurveyReportFromRams(next, ramsDoc, { overwrite: false });
    Object.assign(next, synced);
    if (synced.sections) next.sections = synced.sections;
    if (synced.hseRefs) next.hseRefs = synced.hseRefs;
  }

  next = prefillProfessionalFields(next, { project, ramsDoc });
  next = inheritSiteContextOntoDoc(next, project, ramsDoc);
  return applyUtilityMappingProjectJobToDoc(next, project, "SR");
}

/** Apply catalog template when user changes survey type (fills empty fields only). */
export function applySurveyTypeChange(report, surveyType) {
  const key = String(surveyType || "").trim();
  if (!key) return { ...report, surveyType: "" };

  const defaults = buildSurveyTypeDefaults(key, report.pas128Ql);
  let next = {
    ...report,
    surveyType: key,
    sections: { ...(report.sections || {}) },
  };

  if (defaults) {
    if (!next.sections.scope?.trim()) next.sections.scope = defaults.scope;
    if (!next.sections.methodology?.trim()) next.sections.methodology = defaults.methodology;
    if (!next.sections.equipmentUsed?.trim()) next.sections.equipmentUsed = defaults.equipmentUsed;
    if (!next.pas128Ql?.trim() && defaults.defaultPas128Ql) next.pas128Ql = defaults.defaultPas128Ql;
    if (!next.pas128Method?.trim() && defaults.defaultPas128Method) {
      next.pas128Method = defaults.defaultPas128Method;
    }
  }

  if (isUtilitySurveyType(key) && !next.sections.foreword?.trim()) {
    next.sections.foreword = buildPas128Foreword(next);
  }

  if (next.pas128Method) {
    next = applyPas128MethodToReport(next, next.pas128Method, { overwrite: false });
  }

  if (!next.deliverables?.length) next.deliverables = buildDefaultDeliverables(key);
  if (!next.equipmentCalibration?.length) next.equipmentCalibration = buildDefaultEquipmentCalibration(key);

  const standards = new Set(next.standardsCited || []);
  if (isUtilitySurveyType(key)) {
    standards.add("pas128");
    standards.add("hsg47");
  }
  next.standardsCited = [...standards];

  return next;
}

/** One-click pull scope, method and HSE excerpt from linked RAMS (explicit, undoable via save). */
export function pullScopeFromRams(report, ramsDoc) {
  return syncSurveyReportFromRams(report, ramsDoc, { overwrite: true });
}

/** Fetch live/historical weather for survey date and merge into report weather fields. */
export async function fetchWeatherIntoReport(report, project) {
  const date = report?.surveyDate;
  if (!date) throw new Error("Survey date is required.");

  const pcHint = resolveUkPostcodeInput(project?.postcode, project?.address, project?.site);
  const coords = await resolveSiteCoordinates(project?.lat, project?.lng, pcHint);
  if (!coords) throw new Error("Project coordinates or UK postcode are required.");

  const snap = await fetchWeatherForDate(coords.lat, coords.lng, date, { postcode: pcHint || undefined });
  const mapped = mapWeatherSnapshotToFields({
    description: snap.description,
    tempC: snap.tempC,
    windMph: snap.text?.match(/wind[^~]*~([\d.]+)/i)?.[1] || 0,
  });

  const narrative = snap.text;
  const impact =
    mapped.methodsAffected.length > 0
      ? `Automated note: ${mapped.methodsAffected.join(", ")} may be affected — confirm on site and adjust method if needed.`
      : "";

  return {
    ...report,
    weather: {
      ...report.weather,
      ...mapped,
      tempC: snap.tempC ?? report.weather?.tempC ?? null,
      tempMinC: snap.tempMinC ?? report.weather?.tempMinC ?? null,
      windMph: parseWindFromSnap(snap) ?? report.weather?.windMph ?? null,
      fetchedAt: snap.fetchedAt || new Date().toISOString(),
      conditionsNarrative: report.weather?.conditionsNarrative?.trim() || narrative,
      equipmentMethodImpact: report.weather?.equipmentMethodImpact?.trim() || impact,
    },
  };
}

/**
 * Fetch BGS geology (50k preferred, 625k fallback + nearby boreholes) into survey fields.
 * Prefer project map pin — postcode centroid is allowed but flagged as lower accuracy.
 * @param {object} report
 * @param {object} [project]
 * @param {{ overwrite?: boolean }} [opts]
 */
export async function fetchGeologyIntoSurveyReport(report, project, opts = {}) {
  const overwrite = Boolean(opts.overwrite);
  const hasPin = projectHasMapPin(project);
  const pcHint = resolveUkPostcodeInput(
    project?.postcode,
    project?.address,
    project?.site,
    report?.siteAddress
  );
  const coords = await resolveSiteCoordinates(
    project?.lat ?? project?.siteLat,
    project?.lng ?? project?.siteLng,
    pcHint || report?.siteAddress
  );
  if (!coords) {
    throw new Error("Set a project map pin (lat/lng) or UK postcode for geology lookup.");
  }

  const coordSource = hasPin ? "project map pin" : coords.postcode ? "postcode centroid" : "geocoded address";
  const accuracyWarning = hasPin ? "" : BGS_POSTCODE_ACCURACY_WARNING;

  const bgs = await fetchGeologyAtPoint(coords.lat, coords.lng);
  const mapped = interpretGeologyForSurvey(bgs, {
    weather: report?.weather,
    accuracyWarning,
    coordSource,
  });
  const prev = report?.geology || {};

  let geology = {
    ...prev,
    ...mapped,
    formation: overwrite || !prev.formation?.trim() ? mapped.formation : prev.formation,
    implications: overwrite || !prev.implications?.trim() ? mapped.implications : prev.implications,
    notes: overwrite || !prev.notes?.trim() ? mapped.notes : prev.notes,
    fetchedAt: mapped.fetchedAt,
    source: mapped.source,
    scale: mapped.scale,
    resolution: mapped.resolution,
    queryLat: mapped.queryLat ?? coords.lat,
    queryLng: mapped.queryLng ?? coords.lng,
    materialClass: mapped.materialClass,
    attenuationClass: mapped.attenuationClass,
    expectedPenetrationM: mapped.expectedPenetrationM,
    superficialLabel: mapped.superficialLabel,
    bedrockLabel: mapped.bedrockLabel,
    artificialLabel: mapped.artificialLabel,
    nearbyBoreholes: mapped.nearbyBoreholes || [],
    accuracyWarning: mapped.accuracyWarning,
    coordSource: mapped.coordSource,
    disclaimer: mapped.disclaimer,
  };

  try {
    geology = await enrichGeologyWithSamplePoints(
      { ...report, geology },
      project,
      {
        primaryPayload: bgs,
        primaryCoords: coords,
        accuracyWarning,
        coordSource,
      }
    );
  } catch {
    /* multi-point is best-effort */
  }

  return {
    ...report,
    geology,
  };
}

function parseWindFromSnap(snap) {
  if (snap?.windMph != null && Number.isFinite(Number(snap.windMph))) return Number(snap.windMph);
  const m = snap?.text?.match(/wind[^~]*~([\d.]+)/i);
  return m ? parseFloat(m[1]) : null;
}

/** Default calibration rows by survey type. */
export function buildDefaultEquipmentCalibration(surveyType) {
  const mk = (instrument, status = "in_date") => ({
    id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    instrument,
    serialNo: "",
    calibrationDue: "",
    status,
  });
  if (surveyType === "utility_mapping_survey" || surveyType === "topo_plus_utility_survey" || surveyType === "eml_cat_survey") {
    return [mk("RD8000 / cable locator"), mk("CAT & Genny"), mk("GNSS rover")];
  }
  if (surveyType === "gpr_survey") {
    return [mk("GPR system"), mk("GNSS / total station")];
  }
  if (surveyType === "topographical_survey" || surveyType === "topo_plus_utility_survey" || surveyType === "setting_out") {
    return [mk("Robotic total station"), mk("GNSS rover")];
  }
  if (surveyType === "cctv_drainage_survey") {
    return [mk("CCTV crawler"), mk("Winch / sonde locator")];
  }
  if (surveyType === "drainage_connectivity_survey") {
    return [mk("Sonde / duct rods"), mk("EML locator"), mk("GNSS / total station")];
  }
  if (surveyType === "service_clearance_survey") {
    return [mk("RD8000 / cable locator"), mk("GPR system"), mk("GNSS / total station")];
  }
  if (surveyType === "uav_aerial") {
    return [mk("UAV platform"), mk("RTK / PPK module"), mk("Ground control targets")];
  }
  if (surveyType === "laser_scanning") {
    return [mk("Terrestrial laser scanner"), mk("GNSS / total station")];
  }
  if (surveyType === "site_investigation_campaign") {
    return [
      mk("CAT & Genny / utility locator"),
      mk("Gas monitor (as required)"),
      mk("DCP / dynamic probe kit"),
      mk("Drilling rig / window sampler (as required)"),
    ];
  }
  if (surveyType === "asbestos_survey") {
    return [mk("Sampling kit (bagging, water spray)"), mk("FFP3 respirator"), mk("Camera / borescope")];
  }
  return [mk("Primary survey instrument")];
}

/** Default deliverables rows by survey type. */
export function buildDefaultDeliverables(surveyType) {
  const template = getSurveyTypeTemplate(surveyType);
  const rows =
    template?.defaultDeliverables?.length > 0
      ? template.defaultDeliverables
      : catalogDefaultDeliverables(surveyType);
  if (rows?.length) {
    const ts = Date.now();
    return rows.map((row, i) => ({
      ...row,
      id: row.id || `del_${ts}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    }));
  }
  return [
    {
      id: `del_${Date.now()}_1`,
      format: "report_pdf",
      description: "Survey report (PDF)",
      crs: "OSGB36",
      status: "Issued with report",
    },
  ];
}

/** Pick first active permit ref for a project. */
export function pickPermitRefForProject(permits, projectId) {
  if (!projectId || !permits?.length) return "";
  const active = permits.find(
    (p) => p.projectId === projectId && (p.status === "active" || p.status === "issued" || p.status === "open")
  );
  if (active) return active.permitNo || active.ref || active.id || "";
  const any = permits.find((p) => p.projectId === projectId);
  return any?.permitNo || any?.ref || any?.id || "";
}

const SURVEY_PERMIT_TYPES = new Set(["excavation", "ground_disturbance", "utility", "general"]);

/** Permits on the same project — dig / ground disturbance first. */
export function listPermitsForSurveyProject(permits, projectId) {
  if (!projectId || !permits?.length) return [];
  return permits
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => {
      const digA = SURVEY_PERMIT_TYPES.has(a.type) ? 0 : 1;
      const digB = SURVEY_PERMIT_TYPES.has(b.type) ? 0 : 1;
      if (digA !== digB) return digA - digB;
      return String(a.permitNo || a.ref || "").localeCompare(String(b.permitNo || b.ref || ""), undefined, {
        sensitivity: "base",
      });
    });
}

function permitExtraField(permit, key) {
  const ef = permit?.extraFields || {};
  return ef[key] || ef.dynamic?.[key] || "";
}

/** Link PTW and pull DBYD / CAT refs where stored on the permit. */
export function applyLinkedPermitToReport(report, permit) {
  if (!permit) return report;
  const dbyd = permitExtraField(permit, "dbydRef");
  const cat = permitExtraField(permit, "catScanRef");
  return {
    ...report,
    hseRefs: {
      ...(report.hseRefs || {}),
      linkedPermitId: permit.id,
      permitRef: permit.permitNo || permit.ref || permit.id || "",
      catScanRef: cat || report.hseRefs?.catScanRef || "",
    },
    ...(dbyd && !(report.dbydEnquiries || []).some((r) => r.reference === dbyd)
      ? {
          dbydEnquiries: [
            ...(report.dbydEnquiries || []),
            {
              id: `dbyd_${Date.now()}`,
              provider: "dbyd",
              reference: dbyd,
              enquiryDate: report.surveyDate || "",
              undertakers: "",
              status: "received",
              notes: `Imported from linked permit ${permit.permitNo || permit.ref || ""}`,
            },
          ],
        }
      : {}),
  };
}

/** Prefill document control, deliverables, HSE and control fields. */
export function prefillProfessionalFields(report, { project, ramsDoc, permits = [] } = {}) {
  const next = { ...report };
  const dc = { ...(next.documentControl || {}) };
  if (!dc.preparedBy?.trim() && next.surveyor?.trim()) dc.preparedBy = next.surveyor;
  if (!dc.issueDate?.trim() && next.surveyDate) dc.issueDate = next.surveyDate;
  if (!dc.issueNumber?.trim()) dc.issueNumber = "1";
  if (!dc.revision?.trim()) dc.revision = "A";
  next.documentControl = dc;

  const sig = { ...(next.signatures || {}) };
  if (!sig.surveyorName?.trim() && next.surveyor?.trim()) sig.surveyorName = next.surveyor;
  if (!sig.surveyorSignedDate?.trim() && next.surveyDate) sig.surveyorSignedDate = next.surveyDate;
  next.signatures = sig;

  const hse = { ...(next.hseRefs || {}) };
  if (!hse.permitRef?.trim() && next.projectId) {
    hse.permitRef = pickPermitRefForProject(permits, next.projectId);
  }
  if (!hse.ramsExcerpt?.trim() && ramsDoc?.surveyMethodStatement?.trim()) {
    const excerpt = ramsDoc.surveyMethodStatement.trim().slice(0, 480);
    hse.ramsExcerpt = excerpt.length < ramsDoc.surveyMethodStatement.trim().length ? `${excerpt}…` : excerpt;
  }
  next.hseRefs = hse;

  const ctrl = { ...(next.controlAccuracy || {}) };
  if (!ctrl.controlSource?.trim() && (next.surveyType === "utility_mapping_survey" || next.surveyType === "topographical_survey" || next.surveyType === "topo_plus_utility_survey")) {
    ctrl.controlSource = "GNSS rover / total station tied to project grid or OSGB36 as agreed.";
  }
  if (!ctrl.controlSource?.trim() && next.surveyType === "site_investigation_campaign") {
    ctrl.controlSource = "GI locations referenced to site grid / OSGB36 or client coordinate system as agreed.";
  }
  if (!ctrl.horizontalTolerance?.trim()) {
    ctrl.horizontalTolerance =
      next.surveyType === "utility_mapping_survey" || next.surveyType === "topo_plus_utility_survey"
        ? "±0.05 m relative to survey control (indicative)."
        : "";
  }
  next.controlAccuracy = ctrl;

  if (!next.deliverables?.length && next.surveyType) {
    next.deliverables = buildDefaultDeliverables(next.surveyType);
  }

  if (!next.equipmentCalibration?.length && next.surveyType) {
    next.equipmentCalibration = buildDefaultEquipmentCalibration(next.surveyType);
  }

  if (next.surveyType) {
    next.standardsCited = mergeStandardsCited(next.standardsCited, next.surveyType);
    next.qaChecklist = applyMobilisationQaPrefill(next.qaChecklist, next.surveyType);
  }

  if (!next.revisionHistory?.length) {
    next.revisionHistory = [
      {
        id: `rev_${Date.now()}`,
        date: dc.issueDate || next.surveyDate || todayLocalISO(),
        revision: dc.revision || "A",
        author: dc.preparedBy || next.surveyor || "",
        description: "Initial issue",
      },
    ];
  }

  if (project?.lat && project?.lng && !next.surveyProgramme?.siteAccessNotes?.trim() && project.accessNotes) {
    next.surveyProgramme = {
      ...(next.surveyProgramme || {}),
      siteAccessNotes: project.accessNotes,
    };
  }

  return next;
}

export async function generateAiSurveyDraft(report) {
  if (!isAnthropicConfigured()) throw new Error("AI not configured — add Anthropic key or proxy in settings.");

  const payload = {
    title: report.title,
    surveyType: surveyTypeLabel(report.surveyType),
    pas128: report.pas128Ql,
    site: report.siteAddress || report.projectName,
    date: report.surveyDate,
    scope: report.sections?.scope,
    methodology: report.sections?.methodology,
    weather: buildWeatherNarrative(report.weather),
    records: buildUtilityRecordsNarrative(report.utilityRecords),
    limitations: buildLimitationsFromKeys(report.limitationKeys, report.limitationsText),
    findings: report.sections?.findings,
  };

  const text = await anthropicMessages({
    system: `You draft UK construction/surveying report prose for MySafeOps. Write in professional British English, PAS128-aware where relevant. No markdown headings. Return exactly four labelled paragraphs:
EXECUTIVE SUMMARY:
SCOPE NOTE:
FINDINGS DRAFT:
RECOMMENDATIONS:`,
    messages: [{ role: "user", content: `Improve and complete these survey report sections from structured field data:\n${JSON.stringify(payload, null, 2)}` }],
    maxTokens: 1800,
  });

  const pick = (label) => {
    const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z ]+:|$)`, "i");
    const m = text.match(re);
    return m?.[1]?.trim() || "";
  };

  return {
    executiveSummary: pick("EXECUTIVE SUMMARY"),
    scope: pick("SCOPE NOTE"),
    findings: pick("FINDINGS DRAFT"),
    recommendations: pick("RECOMMENDATIONS"),
    raw: text,
  };
}
