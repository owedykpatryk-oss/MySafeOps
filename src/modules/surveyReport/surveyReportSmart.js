/**
 * Smart automation for survey reports — project prefill, weather mapping, templates, AI draft.
 */
import { fetchWeatherForDate } from "../../utils/weatherSummary";
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

const SURVEY_TYPE_TEMPLATES = {
  utility_mapping_survey: {
    scope:
      "Utility mapping survey of the agreed site extent to locate and chart buried services for design and construction planning. Deliverables as per client brief and PAS 128 classification where applicable.",
    methodology:
      "Desktop records review followed by site reconnaissance. Detection using EML/CAT and Genny in active and passive modes, supplemented by GPR where ground conditions allow. Survey control tied to OSGB36 / site grid as agreed. QA includes mark-up review and client handover briefing.",
    equipmentUsed: "RD8000 / cable locator, GPR (site-appropriate array), GNSS rover or total station, spray paint and site markers.",
  },
  gpr_survey: {
    scope: "Ground penetrating radar survey over the agreed extent to identify shallow anomalies, services and structural features.",
    methodology:
      "Grid or route-based GPR acquisition with calibrated depth scale. Data reviewed on-site for obvious anomalies; post-processing and interpretation aligned to client deliverable format.",
    equipmentUsed: "Multi-channel or single-frequency GPR, GNSS/total station for geo-referencing, processing software.",
  },
  eml_cat_survey: {
    scope: "Electromagnetic location (EML/CAT) survey to identify indicative buried services within the agreed extent.",
    methodology:
      "Systematic sweeps in Power, Radio and Genny modes where access permits. Findings marked on site and transferred to deliverable drawing; limitations of EML noted in report.",
    equipmentUsed: "CAT & Genny / RD8000 class locator, site drawing or GNSS pegging.",
  },
  topographical_survey: {
    scope: "Topographical survey of site features, levels and boundaries for design development.",
    methodology:
      "Establish control network; feature and level capture by total station or GNSS with independent checks on closed traverses or redundant observations where specified.",
    equipmentUsed: "Robotic total station, GNSS rover, data logger.",
  },
  general_site_survey: {
    scope: "General site survey and factual reporting of conditions and features within the agreed extent.",
    methodology: "Site visit, measurement and recording using methods appropriate to the brief and site constraints.",
    equipmentUsed: "As per method statement and site conditions.",
  },
  cctv_drainage_survey: {
    scope: "CCTV drainage survey of accessible drainage runs within the agreed extent to record condition, connectivity and defects.",
    methodology:
      "Access points identified on site; crawler deployed with full distance and direction logging. Footage reviewed on site for obvious defects; observations coded to client specification. Cleansing or jetting only where agreed in RAMS.",
    equipmentUsed: "CCTV crawler (mini/mainline as appropriate), winch, sonde/locator where applicable, recording unit.",
  },
  gnss_control: {
    scope: "GNSS control survey to establish or verify primary control for the project grid / OSGB36 as agreed.",
    methodology:
      "Static or RTK observations on agreed control points with redundancy checks. Post-processing against OS network or project datum; residuals recorded and issued with control schedule.",
    equipmentUsed: "Dual-frequency GNSS receiver, tribrach, control targets, processing software.",
  },
  laser_scanning: {
    scope: "Terrestrial laser scanning to capture point cloud data of the agreed extent for design, record or clash purposes.",
    methodology:
      "Scanner positions planned for coverage and overlap; targets or cloud-to-cloud registration as specified. Data registered, cleaned and issued in agreed format with survey report on accuracy and coverage gaps.",
    equipmentUsed: "Terrestrial laser scanner, targets, GNSS/total station for registration, point cloud software.",
  },
  uav_aerial: {
    scope: "UAV aerial survey / photogrammetry over the agreed site extent for orthoimagery, DSM or volumetric deliverables.",
    methodology:
      "Pre-flight checks, NOTAM/airspace review and RAMS brief. Ground control or RTK PPK as specified; flight lines and overlap per client spec. Processing QA on GCP residuals and coverage.",
    equipmentUsed: "UAV platform, RTK/PPK module, ground control targets, photogrammetry software.",
  },
  setting_out: {
    scope: "Engineering setting out of design elements from issued drawings within the agreed tolerance and hold points.",
    methodology:
      "Control verified from project grid; setting out from latest revision drawings with independent check on critical points. As-built dimensions recorded and issued on completion sheets.",
    equipmentUsed: "Robotic total station or GNSS rover, design drawings, setting-out record sheets.",
  },
};

/** Map Open-Meteo / OpenWeather description into survey weather checkboxes. */
export function mapWeatherSnapshotToFields({ description = "", tempC, windMph = 0 } = {}) {
  const desc = String(description).toLowerCase();
  const phenomena = new Set();
  let rainDuringSurvey = "unknown";
  let groundSurface = "unknown";
  const methodsAffected = new Set();

  if (desc.includes("drizzle")) {
    phenomena.add("drizzle");
    rainDuringSurvey = "light";
    groundSurface = "damp";
    methodsAffected.add("gpr");
    methodsAffected.add("eml");
  } else if (desc.includes("heavy rain")) {
    phenomena.add("heavy_rain");
    rainDuringSurvey = "heavy";
    groundSurface = "waterlogged";
    methodsAffected.add("gpr");
    methodsAffected.add("eml");
    methodsAffected.add("total_station");
  } else if (desc.includes("rain") || desc.includes("shower")) {
    phenomena.add("light_rain");
    rainDuringSurvey = "light";
    groundSurface = "damp";
    methodsAffected.add("gpr");
    methodsAffected.add("eml");
  } else if (desc.includes("clear") || desc.includes("mainly clear")) {
    phenomena.add("strong_sun");
    groundSurface = "dry";
  }

  if (desc.includes("overcast")) phenomena.add("overcast");
  if (desc.includes("fog") || desc.includes("mist")) {
    phenomena.add("fog");
    methodsAffected.add("gnss");
    methodsAffected.add("uav");
  }
  if (desc.includes("snow")) {
    phenomena.add("snow");
    groundSurface = "frozen";
    methodsAffected.add("gpr");
  }
  if (desc.includes("thunder")) {
    phenomena.add("heavy_rain");
    rainDuringSurvey = "heavy";
  }
  if (Number(windMph) >= 25) {
    phenomena.add("high_wind");
    methodsAffected.add("uav");
    methodsAffected.add("laser");
  }
  if (tempC != null && tempC <= 2) {
    phenomena.add("cold");
    phenomena.add("frost");
    if (groundSurface === "unknown") groundSurface = "frozen";
    methodsAffected.add("gpr");
  }

  return {
    groundSurface,
    rainDuringSurvey,
    phenomena: [...phenomena],
    methodsAffected: [...methodsAffected],
  };
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
  const base = SURVEY_TYPE_TEMPLATES[surveyType] || null;
  if (!base) return null;
  const qlLabel = PAS128_QUALITY_LEVELS.find((q) => q.key === pas128Ql)?.label;
  const scope = qlLabel ? `${base.scope}\n\nTarget quality level: ${qlLabel}.` : base.scope;
  return { ...base, scope };
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
  if (!report.cadImport?.summary?.length && report.surveyType === "utility_mapping_survey") {
    steps.push({ id: "cad", label: "Import utility mapping DXF", tab: "findings" });
  }
  if (!report.sections?.executiveSummary?.trim()) steps.push({ id: "summary", label: "Draft executive summary", tab: "details" });
  if (!report.documentControl?.checkedBy?.trim()) steps.push({ id: "doc-control", label: "Document control (checked / approved)", tab: "details" });
  if (!Object.values(report.qaChecklist || {}).some(Boolean)) steps.push({ id: "qa", label: "Complete QA checklist", tab: "professional" });
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
    }
  }

  r = applyDefaultRecordsPreset(r);

  if (project?.lat && project?.lng && r.surveyDate) {
    try {
      r = await fetchWeatherIntoReport(r, project);
    } catch {
      /* weather is best-effort in batch fill */
    }
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

  const keys = [...new Set([...suggestLimitationKeys(r), ...(r.limitationKeys || [])])];
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

  r.smartFillAt = new Date().toISOString();
  return r;
}

export function buildExecutiveSummaryDraft(report, { linkedRamsTitle = "" } = {}) {
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
  const recordsNarrative = buildUtilityRecordsNarrative(form.utilityRecords);
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

  const next = {
    ...report,
    projectId: project.id,
    projectName: project.name || report.projectName,
    client: project.client || report.client,
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
    next.linkedRamsId = ramsDoc.id;
    if (ramsDoc.surveyWorkType && !next.surveyType) next.surveyType = ramsDoc.surveyWorkType;
    if (ramsDoc.surveyDeliverables && !next.sections.scope?.trim()) next.sections.scope = ramsDoc.surveyDeliverables;
    if (ramsDoc.surveyMethodStatement && !next.sections.methodology?.trim()) {
      next.sections.methodology = ramsDoc.surveyMethodStatement;
    }
  }

  return prefillProfessionalFields(next, { project, ramsDoc });
}

/** Fetch live/historical weather for survey date and merge into report weather fields. */
export async function fetchWeatherIntoReport(report, project) {
  const lat = project?.lat;
  const lng = project?.lng;
  const date = report?.surveyDate;
  if (!lat || !lng || !date) throw new Error("Project coordinates and survey date are required.");

  const snap = await fetchWeatherForDate(lat, lng, date);
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
  if (surveyType === "utility_mapping_survey" || surveyType === "eml_cat_survey") {
    return [mk("RD8000 / cable locator"), mk("CAT & Genny"), mk("GNSS rover")];
  }
  if (surveyType === "gpr_survey") {
    return [mk("GPR system"), mk("GNSS / total station")];
  }
  if (surveyType === "topographical_survey" || surveyType === "setting_out") {
    return [mk("Robotic total station"), mk("GNSS rover")];
  }
  if (surveyType === "cctv_drainage_survey") {
    return [mk("CCTV crawler"), mk("Winch / sonde locator")];
  }
  return [mk("Primary survey instrument")];
}

/** Default deliverables rows by survey type. */
export function buildDefaultDeliverables(surveyType) {
  const common = [
    { id: `del_${Date.now()}_1`, format: "report_pdf", description: "Survey report (PDF)", crs: "OSGB36", status: "Issued with report" },
  ];
  if (surveyType === "utility_mapping_survey" || surveyType === "eml_cat_survey" || surveyType === "gpr_survey") {
    return [
      ...common,
      { id: `del_${Date.now()}_2`, format: "pdf_drawing", description: "Utility mark-up drawing", crs: "OSGB36", status: "Issued with report" },
      { id: `del_${Date.now()}_3`, format: "dwg", description: "CAD drawing (if in brief)", crs: "OSGB36", status: "On request" },
    ];
  }
  if (surveyType === "topographical_survey") {
    return [
      ...common,
      { id: `del_${Date.now()}_2`, format: "pdf_drawing", description: "Topographical survey drawing", crs: "OSGB36", status: "Issued with report" },
    ];
  }
  if (surveyType === "cctv_drainage_survey") {
    return [
      ...common,
      { id: `del_${Date.now()}_2`, format: "cctv_footage", description: "CCTV footage and log", crs: "—", status: "Issued with report" },
    ];
  }
  return common;
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
  if (!ctrl.controlSource?.trim() && (next.surveyType === "utility_mapping_survey" || next.surveyType === "topographical_survey")) {
    ctrl.controlSource = "GNSS rover / total station tied to project grid or OSGB36 as agreed.";
  }
  if (!ctrl.horizontalTolerance?.trim()) {
    ctrl.horizontalTolerance =
      next.surveyType === "utility_mapping_survey" ? "±0.05 m relative to survey control (indicative)." : "";
  }
  next.controlAccuracy = ctrl;

  if (!next.deliverables?.length && next.surveyType) {
    next.deliverables = buildDefaultDeliverables(next.surveyType);
  }

  if (!next.equipmentCalibration?.length && next.surveyType) {
    next.equipmentCalibration = buildDefaultEquipmentCalibration(next.surveyType);
  }

  if (!next.revisionHistory?.length) {
    next.revisionHistory = [
      {
        id: `rev_${Date.now()}`,
        date: dc.issueDate || next.surveyDate || new Date().toISOString().slice(0, 10),
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
