import { blankQaChecklistState, GI_QA_CHECKLIST_ITEMS, QA_CHECKLIST_ITEMS } from "./surveyQaPack";
import { blankSpecialistTablesState } from "./surveySpecialistFindings";

export { QA_CHECKLIST_ITEMS, GI_QA_CHECKLIST_ITEMS };

/** Site photo evidence categories — audit-friendly grouping in editor and PDF. */
export const SURVEY_PHOTO_CATEGORIES = [
  { key: "pre_start", label: "Pre-start / mobilisation" },
  { key: "field_work", label: "Field work / mark-up" },
  { key: "control", label: "Control / verification" },
  { key: "findings", label: "Findings / anomalies" },
  { key: "handover", label: "Client handover" },
  { key: "other", label: "General" },
];

export function surveyPhotoCategoryLabel(key) {
  return SURVEY_PHOTO_CATEGORIES.find((c) => c.key === key)?.label || "General";
}

/** Survey report types — aligned with RAMS surveying packs (manhole-specific types omitted). */
export const SURVEY_TYPES = [
  { key: "utility_mapping_survey", label: "PAS128 utility mapping survey" },
  { key: "topographical_survey", label: "Topographical land survey" },
  { key: "topo_plus_utility_survey", label: "Topographical + PAS128 utility survey" },
  { key: "gpr_survey", label: "GPR / multi-array survey" },
  { key: "cctv_drainage_survey", label: "CCTV drainage survey" },
  { key: "drainage_connectivity_survey", label: "Drainage connectivity survey" },
  { key: "service_clearance_survey", label: "Service clearance (pre-GI / intrusive)" },
  { key: "eml_cat_survey", label: "EML / CAT & Genny survey" },
  { key: "gnss_control", label: "GNSS / control survey" },
  { key: "laser_scanning", label: "Laser scanning / point cloud" },
  { key: "uav_aerial", label: "UAV / aerial survey" },
  { key: "setting_out", label: "Setting out / engineering survey" },
  { key: "general_site_survey", label: "General site survey" },
  { key: "site_investigation_campaign", label: "Site investigation & geotechnics" },
  { key: "asbestos_survey", label: "Asbestos survey (management / refurbishment / demolition)" },
];

export const PAS128_QUALITY_LEVELS = [
  { key: "B4", label: "QL B4 — Desktop utility records search" },
  { key: "B3", label: "QL B3 — Site reconnaissance & records" },
  { key: "B2", label: "QL B2 — Single geophysical technique" },
  { key: "B1", label: "QL B1 — Multi-technique detection" },
  { key: "B0", label: "QL B0 — Verification / trial holes" },
];

/** PAS 128 survey method (M-series) — distinct from QL B0–B4. */
export const PAS128_METHODS = [
  { key: "M1", label: "M1 — Desktop utility search (Survey Type D)" },
  { key: "M2", label: "M2 — EML + GPR (real-time on site)" },
  { key: "M2P", label: "M2P — EML + GPR (2 m grid, post-processed)" },
  { key: "M3P", label: "M3P — EML + HD GPR (1 m grid, post-processed)" },
  { key: "M4P", label: "M4P — Full survey incl. MH/IC (1 m grid, post-processed)" },
];

/** Limitation rule keys → generated prose (checkbox → paragraph engine). */
export const LIMITATION_RULES = [
  {
    key: "vegetation_obstruction",
    label: "Vegetation / overgrowth",
    text: "Vegetation and overgrowth restricted access to some survey areas and may have obscured surface features.",
  },
  {
    key: "parked_vehicles",
    label: "Parked vehicles / obstructions",
    text: "Parked vehicles or temporary obstructions prevented survey coverage in affected areas.",
  },
  {
    key: "hard_surface",
    label: "Hard surface / reinstatement",
    text: "Hardstanding, reinstatement or sealed surfaces limited the application of certain detection methods.",
  },
  {
    key: "gpr_depth_limit",
    label: "GPR depth / signal limitation",
    text: "GPR signal attenuation or site conditions limited detection depth and confidence in some areas.",
  },
  {
    key: "eml_confidence",
    label: "EML / locator confidence",
    text: "EML/CAT detection is subject to signal coupling and may not identify all buried services; findings should be treated as indicative until verified.",
  },
  {
    key: "site_access_restricted",
    label: "Restricted site access",
    text: "Access to parts of the survey extent was restricted by site operations, security or client instruction.",
  },
  {
    key: "records_not_available",
    label: "Records not available",
    text: "Utility records or drawings were not available for the full survey area, limiting cross-checking of findings.",
  },
  {
    key: "weather_impact",
    label: "Weather impact on methods",
    text: "Weather conditions during the survey affected certain methods; see Weather at Site section for detail.",
  },
  {
    key: "traffic_interface",
    label: "Live traffic / public interface",
    text: "Live traffic or public interface restricted survey methodology and coverage adjacent to carriageways.",
  },
  {
    key: "services_live",
    label: "Live services assumed",
    text: "All detected services are assumed live unless confirmed otherwise by the client or statutory undertaker.",
  },
  {
    key: "desktop_only",
    label: "Desktop / records only",
    text: "This deliverable is based on desktop records review only; no intrusive or geophysical verification was undertaken.",
  },
  {
    key: "client_scope_excluded",
    label: "Outside agreed scope",
    text: "Areas outside the agreed survey scope were not surveyed and are excluded from this report.",
  },
  {
    key: "asbestos_concealed_areas",
    label: "Concealed / inaccessible areas (asbestos)",
    text: "Concealed voids, wall/floor cavities and other inaccessible areas were not opened up during this survey. Materials within them are presumed to contain asbestos unless confirmed otherwise by a further intrusive (refurbishment/demolition) survey.",
  },
];

export const WEATHER_PHENOMENA = [
  { key: "drizzle", label: "Drizzle" },
  { key: "light_rain", label: "Light rain" },
  { key: "heavy_rain", label: "Heavy rain" },
  { key: "overcast", label: "Overcast" },
  { key: "fog", label: "Fog / mist" },
  { key: "frost", label: "Frost / ice on surfaces" },
  { key: "snow", label: "Snow" },
  { key: "high_wind", label: "High wind" },
  { key: "strong_sun", label: "Strong sun / glare" },
  { key: "cold", label: "Cold conditions" },
];

export const METHODS_AFFECTED = [
  { key: "gpr", label: "GPR / shallow geophysics" },
  { key: "eml", label: "EML / CAT / cable avoidance" },
  { key: "cctv", label: "CCTV / crawler" },
  { key: "gnss", label: "GNSS / GPS" },
  { key: "total_station", label: "Total station" },
  { key: "uav", label: "UAV / drone" },
  { key: "laser", label: "Laser / scanner" },
  { key: "other", label: "Other (describe in text)" },
];

export const GROUND_SURFACE_OPTIONS = [
  { key: "dry", label: "Dry" },
  { key: "damp", label: "Damp / soft ground" },
  { key: "waterlogged", label: "Waterlogged" },
  { key: "frozen", label: "Frozen / icy" },
  { key: "unknown", label: "Not recorded" },
];

export const RAIN_DURING_SURVEY = [
  { key: "none", label: "No rain during survey" },
  { key: "light", label: "Light rain during survey" },
  { key: "heavy", label: "Heavy rain during survey" },
  { key: "unknown", label: "Not recorded" },
];

export const UTILITY_RECORDS_SOURCES = [
  { key: "statutory_undertaker", label: "Statutory undertaker records" },
  { key: "client_drawings", label: "Client drawings / as-builts" },
  { key: "historic_mapping", label: "Historic mapping / topo" },
  { key: "desktop_search", label: "Desktop search only" },
  { key: "no_records", label: "No records supplied" },
];

export const UTILITY_RECORDS_OUTCOMES = [
  { key: "consistent", label: "Findings broadly consistent with available records" },
  { key: "new_utility", label: "New or previously unrecorded utility encountered" },
  { key: "incomplete", label: "Records incomplete for survey area" },
  { key: "no_cross_check", label: "Could not cross-check (insufficient records)" },
];

export const UTILITY_RECORDS_GAPS = [
  { key: "client_not_supplied", label: "Client not yet supplied" },
  { key: "archive_only", label: "Archive / historic only" },
  { key: "limited_access", label: "Limited site access" },
  { key: "out_of_date", label: "Records out of date or unreliable" },
  { key: "scope_excluded", label: "Outside agreed scope for records review" },
  { key: "other", label: "Other (explain below)" },
];

/** LSBUD / DBYD desktop enquiry log (Records tab). */
export const DBYD_ENQUIRY_PROVIDERS = [
  { key: "lsbud", label: "LSBUD" },
  { key: "dbyd", label: "DBYD (National Grid / regional)" },
  { key: "statutory", label: "Direct statutory undertaker" },
  { key: "client", label: "Client-supplied records pack" },
  { key: "other", label: "Other" },
];

export const DBYD_ENQUIRY_STATUS = [
  { key: "requested", label: "Requested" },
  { key: "received", label: "Received" },
  { key: "partial", label: "Partial response" },
  { key: "not_requested", label: "Not requested" },
  { key: "not_available", label: "Not available" },
];

/** M1 desktop search — per-undertaker response status (generic PAS 128 Type D). */
export const UNDERTAKER_CATEGORIES = [
  { key: "electricity", label: "Electricity" },
  { key: "gas", label: "Gas" },
  { key: "water", label: "Water supply" },
  { key: "sewerage", label: "Water / sewerage" },
  { key: "telecom", label: "Telecoms" },
  { key: "fibre", label: "Fibre / data" },
  { key: "highways", label: "Highways / local authority" },
  { key: "rail", label: "Rail" },
  { key: "other", label: "Other" },
];

export const UNDERTAKER_RESPONSE_STATUS = [
  { key: "affected", label: "Affected — apparatus present" },
  { key: "not_affected", label: "Not affected — no apparatus in area" },
  { key: "no_response", label: "No response received" },
];

export const ACCESS_LIMITATION_TYPES = [
  { key: "access_restricted", label: "General access restricted" },
  { key: "locked_gate", label: "Locked gate / barrier" },
  { key: "reinforced_surface", label: "Reinforced / sealed surface" },
  { key: "live_plant", label: "Live plant / operations" },
  { key: "security", label: "Security / permit restriction" },
  { key: "third_party", label: "Third-party land / interface" },
  { key: "depth_limit", label: "Depth / excavation limit" },
];

export const UTILITY_CONFIDENCE_LEVELS = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "indicative", label: "Indicative only" },
];

export const UTILITY_TYPE_OPTIONS = [
  { key: "hv_cable", label: "HV cable" },
  { key: "lv_cable", label: "LV cable" },
  { key: "gas", label: "Gas main / service" },
  { key: "water", label: "Water main / service" },
  { key: "foul", label: "Foul sewer" },
  { key: "surface", label: "Surface water" },
  { key: "telecom", label: "Telecom / fibre" },
  { key: "other", label: "Other / unknown" },
];

export const DELIVERABLE_FORMAT_OPTIONS = [
  { key: "pdf_drawing", label: "PDF drawing" },
  { key: "dwg", label: "DWG / CAD" },
  { key: "dxf", label: "DXF" },
  { key: "lcm", label: "LCM / CSV" },
  { key: "report_pdf", label: "Report PDF" },
  { key: "cctv_footage", label: "CCTV footage" },
  { key: "point_cloud", label: "Point cloud" },
  { key: "other", label: "Other" },
];

export const RECORD_REF_STATUS_OPTIONS = [
  { key: "received", label: "Received" },
  { key: "pending", label: "Pending" },
  { key: "not_requested", label: "Not requested" },
  { key: "not_supplied", label: "Not supplied" },
];

export const EQUIPMENT_CALIBRATION_STATUS = [
  { key: "in_date", label: "In date" },
  { key: "due_soon", label: "Due within 30 days" },
  { key: "overdue", label: "Overdue" },
  { key: "not_applicable", label: "N/A" },
];

export const GI_METHOD_OPTIONS = [
  { key: "trial_pit", label: "Trial pit" },
  { key: "window_sampling", label: "Window sampling" },
  { key: "borehole", label: "Borehole" },
  { key: "dcp", label: "DCP / dynamic probe" },
  { key: "hand_auger", label: "Hand auger" },
  { key: "cpt", label: "CPT" },
  { key: "piezometer", label: "Piezometer / standpipe" },
  { key: "sample_recovery", label: "Sample recovery" },
  { key: "other", label: "Other" },
];

export const UTILITY_RECORDS_PRESETS = {
  pas128_typical: {
    label: "PAS128 typical pack",
    sources: ["statutory_undertaker", "client_drawings"],
    outcomes: ["consistent"],
    gaps: [],
  },
  no_records: {
    label: "No records supplied",
    sources: ["no_records"],
    outcomes: ["no_cross_check"],
    gaps: ["client_not_supplied"],
  },
  awaiting_client: {
    label: "Awaiting client records",
    sources: ["desktop_search"],
    outcomes: ["incomplete"],
    gaps: ["client_not_supplied"],
  },
  gi_typical: {
    label: "GI desk study typical",
    sources: ["desktop_search", "client_drawings", "statutory_undertaker"],
    outcomes: ["consistent"],
    gaps: [],
  },
};

export function blankSurveyReport(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ref: "",
    status: "draft",
    title: "",
    projectId: "",
    projectName: "",
    client: "",
    siteAddress: "",
    surveyDate: new Date().toISOString().slice(0, 10),
    surveyor: "",
    surveyType: "",
    pas128Ql: "",
    pas128Method: "",
    limitationKeys: [],
    limitationsText: "",
    weather: {
      groundSurface: "unknown",
      rainDuringSurvey: "unknown",
      phenomena: [],
      methodsAffected: [],
      conditionsNarrative: "",
      equipmentMethodImpact: "",
      tempC: null,
      tempMinC: null,
      windMph: null,
      fetchedAt: null,
    },
    documentControl: {
      issueNumber: "1",
      revision: "A",
      issueDate: "",
      preparedBy: "",
      checkedBy: "",
      approvedBy: "",
    },
    revisionHistory: [],
    surveyProgramme: {
      startTime: "",
      endTime: "",
      hoursOnSite: "",
      personnel: "",
      siteAccessNotes: "",
    },
    controlAccuracy: {
      coordinateSystem: "OSGB36 / British National Grid",
      controlSource: "",
      horizontalTolerance: "",
      verticalTolerance: "",
      traverseClosure: "",
      levelClosure: "",
      controlPointsNotes: "",
    },
    deliverables: [],
    recordsReferences: [],
    dbydEnquiries: [],
    undertakerResponses: [],
    trialHolesTable: [],
    ...blankSpecialistTablesState(),
    utilitiesTable: [],
    giLocationsTable: [],
    qaChecklist: blankQaChecklistState(),
    standardsCited: [],
    hseRefs: {
      permitRef: "",
      linkedPermitId: "",
      catScanRef: "",
      ramsExcerpt: "",
    },
    // UAV / aerial survey compliance — CAA authorisation and flight-safety references.
    // Only shown/used for surveyType === "uav_aerial"; harmless no-op for other types.
    uavCompliance: {
      caaOperatorId: "",
      flyerIds: "",
      authorisationRef: "",
      droneRegistration: "",
      insurancePolicyRef: "",
      notamRef: "",
      groundExclusionPlanRef: "",
    },
    signatures: {
      surveyorName: "",
      surveyorSignedDate: "",
      clientName: "",
      clientAcceptedDate: "",
    },
    equipmentCalibration: [],
    parentReportId: "",
    parentRevision: "",
    changesSincePrevious: [],
    utilityRecords: {
      sourcesConsulted: [],
      outcomes: [],
      informationGaps: [],
      whatWasFound: "",
      whatWasNotFound: "",
      gapExplanation: "",
    },
    accessLimitations: [],
    accessLimitationsNotes: "",
    sections: {
      foreword: "",
      executiveSummary: "",
      scope: "",
      methodology: "",
      equipmentUsed: "",
      surveyExtent: "",
      findings: "",
      recommendations: "",
    },
    photos: [],
    linkedRamsId: "",
    sitePlanSummary: "",
    sitePlanSnapshots: [],
    cadImport: null,
    smartFillAt: null,
    createdAt: now,
    updatedAt: now,
    finalisedAt: null,
    ...overrides,
  };
}
