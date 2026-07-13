/**
 * Generic UK surveying QA pack for Survey Report — public-standard aligned, no third-party forms.
 * Grouped checklists and type-specific extras; not sourced from proprietary company templates.
 */

/** @typedef {{ key: string, label: string, group: string }} QaItem */

/** QA groups shown in the editor and PDF. */
export const SURVEY_QA_GROUPS = [
  { id: "mobilisation", label: "Mobilisation & H&S" },
  { id: "site", label: "On site" },
  { id: "control", label: "Control & verification" },
  { id: "office", label: "Office & deliverables" },
  { id: "deliverable", label: "Deliverable processing" },
  { id: "equipment", label: "Equipment" },
];

/** Core QA items — keys stable for saved reports. */
export const SURVEY_QA_ITEMS = [
  { key: "ramsBriefingComplete", label: "Pre-start briefing and RAMS reviewed with team", group: "mobilisation" },
  { key: "ppeAdequate", label: "PPE correct and in good condition", group: "mobilisation" },
  { key: "tmAndBarriersInPlace", label: "Traffic management / barriers in place where required", group: "mobilisation" },
  { key: "welfareFacilitiesChecked", label: "Adequate welfare facilities on site", group: "mobilisation" },
  { key: "catScanBeforeWork", label: "CAT scan / utility search before intrusive works", group: "site" },
  { key: "safeDigRulesCommunicated", label: "Safe dig / hand-dig rules communicated to site", group: "site" },
  { key: "markupReviewedOnSite", label: "Mark-up reviewed on site before demobilisation", group: "site" },
  { key: "clientWalkthrough", label: "Client / site walkthrough completed", group: "site" },
  { key: "controlVerified", label: "Survey control verified against project grid / OS", group: "control" },
  { key: "independentCheck", label: "Independent check on critical dimensions / control", group: "control" },
  { key: "trialHoles", label: "Trial holes / verification undertaken (if in scope)", group: "control" },
  { key: "recordsReviewComplete", label: "Utility / desk records review completed and logged", group: "control" },
  { key: "cadCrsChecked", label: "CAD layers, CRS and drawing scale checked against brief", group: "office" },
  { key: "deliverablesCrossChecked", label: "Deliverables cross-checked before issue", group: "office" },
  { key: "documentControlComplete", label: "Document control block complete (prepared / checked / approved)", group: "office" },
  { key: "calibrationInDate", label: "Survey instruments within calibration period", group: "equipment" },
  { key: "dailyEquipmentCheck", label: "Daily equipment / vehicle check completed", group: "equipment" },
  { key: "mobilisationKitComplete", label: "Mobilisation kit / vehicle equipment check completed", group: "equipment" },
];

/** Generic deliverable / CAD processing checks (no client layer names). */
export const DELIVERABLE_QA_ITEMS = [
  { key: "drawingNorthOriented", label: "Drawing orientated to north / project grid", group: "deliverable" },
  { key: "zValuesChecked", label: "3D Z-values / depths checked against surface features", group: "deliverable" },
  { key: "titleBlockComplete", label: "Title block, revision and issue block complete", group: "deliverable" },
  { key: "drawingIssuedInAgreedFormat", label: "Drawing issued in agreed CRS, scale and format", group: "deliverable" },
];

/** PAS128 utility mapping extras. */
export const UTILITY_MAPPING_QA_ITEMS = [
  { key: "pas128QlRecorded", label: "PAS 128 quality level recorded for each utility", group: "control" },
  { key: "limitationKeysReviewed", label: "Limitations and residual uncertainty reviewed", group: "office" },
  { key: "mhIcPhotoCards", label: "Manhole / IC photo cards completed (where lifted)", group: "site" },
  { key: "emlPassiveSweep", label: "Passive EML Power/Radio sweep completed", group: "control" },
];

/** Drainage connectivity extras (sonde tracing). */
export const DRAINAGE_QA_ITEMS = [
  { key: "sondeTraceLogged", label: "Sonde trace log complete for each connection", group: "control" },
  { key: "drainageChamberDetails", label: "Chamber extents, inverts and pipe sizes recorded", group: "site" },
];

/** Topographical / setting-out extras. */
export const TOPO_QA_ITEMS = [
  { key: "topoClosureChecked", label: "Traverse / level closure within agreed tolerance", group: "control" },
];

/** GPR acquisition extras — generic, not client-specific. */
export const GPR_QA_ITEMS = [
  { key: "gprCalibratedOnSite", label: "GPR calibrated on site before acquisition", group: "site" },
  { key: "gprGridAsPerBrief", label: "Scan grid / line spacing as per method statement", group: "site" },
  { key: "gprDepthScaleVerified", label: "Depth scale verified against known feature or test", group: "control" },
];

/** CCTV drainage extras. */
export const CCTV_QA_ITEMS = [
  { key: "cctvChambersAccessed", label: "Chambers opened safely and access controlled", group: "site" },
  { key: "cctvGasBoundaryChecked", label: "Confined-space / gas monitor boundary respected", group: "mobilisation" },
  { key: "cctvFootageChainLogged", label: "CCTV footage and chainage log complete", group: "control" },
  { key: "cctvChambersReinstated", label: "Chambers reinstated and secured after survey", group: "site" },
];

/** UAV / aerial extras. */
export const UAV_QA_ITEMS = [
  { key: "uavAirspaceChecked", label: "Airspace / NOTAM / permissions checked before flight", group: "mobilisation" },
  { key: "uavPreflightComplete", label: "Pre-flight checks and site brief completed", group: "site" },
  { key: "uavGcpResidualsReviewed", label: "GCP / PPK residuals reviewed after processing", group: "control" },
];

/** Laser scanning extras. */
export const LASER_QA_ITEMS = [
  { key: "laserOverlapVerified", label: "Scan overlap and target coverage verified", group: "site" },
  { key: "laserRegistrationOk", label: "Point cloud registration within agreed tolerance", group: "control" },
  { key: "laserCoverageGapsLogged", label: "Coverage gaps and occlusions documented", group: "office" },
];

/** GNSS / control survey extras. */
export const GNSS_QA_ITEMS = [
  { key: "gnssRedundantObservations", label: "Redundant observations on control network", group: "control" },
  { key: "gnssResidualsWithinTol", label: "Post-process residuals within agreed tolerance", group: "control" },
  { key: "gnssDatumIssued", label: "Datum / transformation issued with control schedule", group: "office" },
];

/** Setting-out extras. */
export const SETTING_OUT_QA_ITEMS = [
  { key: "settingOutLatestRevision", label: "Setting out from latest issued drawing revision", group: "site" },
  { key: "settingOutHoldPointsChecked", label: "Hold points independently checked", group: "control" },
  { key: "settingOutAsBuiltRecorded", label: "As-built dimensions recorded on completion sheets", group: "office" },
];

/** Asbestos survey extras (management / refurbishment / demolition). */
export const ASBESTOS_QA_ITEMS = [
  { key: "asbestosSurveyTypeAgreed", label: "Survey type (management / refurbishment / demolition) agreed with client", group: "mobilisation" },
  { key: "asbestosExistingRegisterReviewed", label: "Existing asbestos register / previous survey reviewed", group: "mobilisation" },
  { key: "asbestosSamplesLabelled", label: "Samples double-bagged, labelled and chain-of-custody completed", group: "site" },
  { key: "asbestosUkasLabUsed", label: "Samples submitted to UKAS-accredited laboratory", group: "control" },
  { key: "asbestosRiskAssessed", label: "HSG264 material and priority risk assessment applied to each item", group: "control" },
  { key: "asbestosRegisterIssued", label: "Draft asbestos register QA'd before client issue", group: "office" },
];

/** Site investigation & geotechnics extras. */
export const GI_QA_CHECKLIST_ITEMS = [
  { key: "utilityClearanceGi", label: "Utility search / permit-to-dig before intrusive GI", group: "site" },
  { key: "chainOfCustody", label: "Sample chain of custody completed on site", group: "site" },
  { key: "gasMonitoringGi", label: "Ground gas monitoring undertaken (if required by desk study)", group: "site" },
  { key: "boreholeAbandoned", label: "Boreholes capped / abandoned per specification", group: "site" },
  { key: "pitReinstated", label: "Trial pits backfilled and surface reinstated", group: "site" },
];

const ALL_QA_DEFINITIONS = [
  SURVEY_QA_ITEMS,
  DELIVERABLE_QA_ITEMS,
  UTILITY_MAPPING_QA_ITEMS,
  TOPO_QA_ITEMS,
  GPR_QA_ITEMS,
  CCTV_QA_ITEMS,
  DRAINAGE_QA_ITEMS,
  UAV_QA_ITEMS,
  LASER_QA_ITEMS,
  GNSS_QA_ITEMS,
  SETTING_OUT_QA_ITEMS,
  GI_QA_CHECKLIST_ITEMS,
  ASBESTOS_QA_ITEMS,
];

/** Survey types that show CAD / drawing QA items. */
const CAD_QA_SURVEY_TYPES = new Set([
  "utility_mapping_survey",
  "topo_plus_utility_survey",
  "topographical_survey",
  "gpr_survey",
  "eml_cat_survey",
  "drainage_connectivity_survey",
  "service_clearance_survey",
  "setting_out",
  "gnss_control",
]);

const UTILITY_SURVEY_TYPES = new Set([
  "utility_mapping_survey",
  "topo_plus_utility_survey",
  "gpr_survey",
  "eml_cat_survey",
  "service_clearance_survey",
]);

const TOPO_SURVEY_TYPES = new Set(["topographical_survey", "topo_plus_utility_survey", "setting_out", "gnss_control"]);

const DRAINAGE_SURVEY_TYPES = new Set(["cctv_drainage_survey", "drainage_connectivity_survey"]);

/** Public UK standards — reference only; user cites applicability in report prose. */
export const SURVEY_PUBLIC_STANDARDS = [
  { key: "pas128", label: "PAS 128 — utility detection, verification and classification" },
  { key: "hsg47", label: "HSG47 — avoiding danger from underground services" },
  { key: "rics_measured", label: "RICS — measured surveys of land, buildings and utilities" },
  { key: "tsa_guidance", label: "TSA — utility survey guidance notes (industry practice)" },
  { key: "mscc5", label: "MSCC5 — drainage condition coding (CCTV)" },
  { key: "cap1686", label: "CAP1686 — UK drone / UAS operations (where applicable)" },
  { key: "hsg264", label: "HSG264 — asbestos survey guidance (Control of Asbestos Regulations 2012)" },
];

/** Default false map for all QA keys — merge in blankSurveyReport. */
export function blankQaChecklistState() {
  const all = ALL_QA_DEFINITIONS.flat();
  return Object.fromEntries(all.map(({ key }) => [key, false]));
}

/**
 * QA items applicable to a survey type (ordered, deduped by key).
 * @param {string} surveyType
 * @returns {QaItem[]}
 */
export function getQaChecklistItemsForSurveyType(surveyType = "") {
  const type = String(surveyType || "").trim();
  /** @type {QaItem[]} */
  let items = [...SURVEY_QA_ITEMS];

  if (!CAD_QA_SURVEY_TYPES.has(type)) {
    items = items.filter((i) => i.key !== "cadCrsChecked");
  }
  if (CAD_QA_SURVEY_TYPES.has(type)) {
    items = [...items, ...DELIVERABLE_QA_ITEMS];
  }
  if (UTILITY_SURVEY_TYPES.has(type)) {
    items = [...items, ...UTILITY_MAPPING_QA_ITEMS];
  }
  if (type === "gpr_survey") {
    items = [...items, ...GPR_QA_ITEMS];
  }
  if (TOPO_SURVEY_TYPES.has(type)) {
    items = [...items, ...TOPO_QA_ITEMS];
  }
  if (type === "gnss_control") {
    items = [...items, ...GNSS_QA_ITEMS];
  }
  if (type === "setting_out") {
    items = [...items, ...SETTING_OUT_QA_ITEMS];
  }
  if (type === "cctv_drainage_survey") {
    items = [...items, ...CCTV_QA_ITEMS];
  }
  if (type === "uav_aerial") {
    items = [...items, ...UAV_QA_ITEMS];
  }
  if (type === "laser_scanning") {
    items = [...items, ...LASER_QA_ITEMS];
  }
  if (type === "site_investigation_campaign") {
    items = [...items, ...GI_QA_CHECKLIST_ITEMS];
  }
  if (type === "asbestos_survey") {
    items = [...items, ...ASBESTOS_QA_ITEMS];
  }
  if (DRAINAGE_SURVEY_TYPES.has(type)) {
    items = [...items, ...DRAINAGE_QA_ITEMS];
    if (type === "drainage_connectivity_survey") {
      items = [...items, ...CCTV_QA_ITEMS.filter((i) => i.key !== "cctvFootageChainLogged")];
    }
  }

  const seen = new Set();
  return items.filter((i) => {
    if (seen.has(i.key)) return false;
    seen.add(i.key);
    return true;
  });
}

/** Group QA items for UI sections. */
export function getQaChecklistGroupsForSurveyType(surveyType = "") {
  const items = getQaChecklistItemsForSurveyType(surveyType);
  return SURVEY_QA_GROUPS.map((g) => ({
    ...g,
    items: items.filter((i) => i.group === g.id),
  })).filter((g) => g.items.length > 0);
}

/** Per-group progress for badges and quick actions. */
export function getQaGroupProgress(qa, surveyType = "") {
  return getQaChecklistGroupsForSurveyType(surveyType).map((g) => {
    const checked = g.items.filter((i) => Boolean(qa?.[i.key])).length;
    const total = g.items.length;
    return {
      id: g.id,
      label: g.label,
      checked,
      total,
      pct: total ? Math.round((checked / total) * 100) : 0,
      complete: total > 0 && checked === total,
    };
  });
}

/** Checked vs applicable QA items for progress meters. */
export function getQaChecklistProgress(qa, surveyType = "") {
  const items = getQaChecklistItemsForSurveyType(surveyType);
  const checked = items.filter((i) => Boolean(qa?.[i.key])).length;
  const total = items.length;
  return {
    checked,
    total,
    pct: total ? Math.round((checked / total) * 100) : 0,
    complete: total > 0 && checked === total,
  };
}

/** Toggle all items in a QA group on or off. */
export function patchQaGroup(qa, groupId, surveyType, checked) {
  const items = getQaChecklistItemsForSurveyType(surveyType).filter((i) => i.group === groupId);
  const next = { ...(qa || {}) };
  items.forEach((i) => {
    next[i.key] = Boolean(checked);
  });
  return next;
}

/** First incomplete group label — for blockers / smart-fill hints. */
export function getNextIncompleteQaGroupLabel(qa, surveyType = "") {
  const groups = getQaGroupProgress(qa, surveyType);
  const next = groups.find((g) => !g.complete);
  return next ? next.label : null;
}

/** Suggested UK standards to cite per survey type (generic — user can untick). */
export function suggestStandardsCitedForSurveyType(surveyType = "") {
  const type = String(surveyType || "").trim();
  /** @type {Record<string, string[]>} */
  const map = {
    utility_mapping_survey: ["pas128", "hsg47", "tsa_guidance"],
    eml_cat_survey: ["hsg47", "tsa_guidance"],
    gpr_survey: ["pas128", "hsg47"],
    topographical_survey: ["rics_measured"],
    setting_out: ["rics_measured"],
    gnss_control: ["rics_measured"],
    cctv_drainage_survey: ["mscc5", "hsg47"],
    uav_aerial: ["cap1686", "rics_measured"],
    laser_scanning: ["rics_measured"],
    site_investigation_campaign: ["hsg47"],
    general_site_survey: ["rics_measured"],
    asbestos_survey: ["hsg264"],
  };
  return map[type] || [];
}

/** Merge suggested standards without removing user selections. */
export function mergeStandardsCited(existing = [], surveyType = "") {
  const suggested = suggestStandardsCitedForSurveyType(surveyType);
  return [...new Set([...(existing || []), ...suggested])];
}

/** Typical mobilisation QA keys to prefill on smart fill / type switch. */
export const MOBILISATION_QA_PREFILL_KEYS = [
  "ramsBriefingComplete",
  "ppeAdequate",
  "calibrationInDate",
  "dailyEquipmentCheck",
  "mobilisationKitComplete",
];

/** Apply mobilisation defaults when checklist is still empty. */
export function applyMobilisationQaPrefill(qa, surveyType = "", { force = false } = {}) {
  const current = qa || {};
  const hasAny = Object.values(current).some(Boolean);
  if (hasAny && !force) return current;
  const applicable = new Set(getQaChecklistItemsForSurveyType(surveyType).map((i) => i.key));
  const next = { ...current };
  MOBILISATION_QA_PREFILL_KEYS.forEach((key) => {
    if (applicable.has(key)) next[key] = true;
  });
  return next;
}

/** @deprecated Use getQaChecklistItemsForSurveyType — flat list for print/helpers. */
export const QA_CHECKLIST_ITEMS = SURVEY_QA_ITEMS.map(({ key, label }) => ({ key, label }));
