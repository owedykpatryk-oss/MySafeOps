/**
 * Specialist survey findings tables — CCTV (MSCC-style), UAV flights, laser scans.
 * Generic UK industry fields; not copied from proprietary templates.
 */

export const MSCC_PIPE_GRADES = [
  { key: "1", label: "Grade 1 — excellent condition" },
  { key: "2", label: "Grade 2 — good" },
  { key: "3", label: "Grade 3 — fair / monitor" },
  { key: "4", label: "Grade 4 — poor — remedial works" },
  { key: "5", label: "Grade 5 — collapsed / critical" },
];

export const UAV_WIND_BANDS = [
  { key: "within_limits", label: "Within operator limits" },
  { key: "marginal", label: "Marginal — reduced altitude" },
  { key: "aborted", label: "Flight aborted / rescheduled" },
];

export const LASER_REGISTRATION_STATUS = [
  { key: "pass", label: "Registration within tolerance" },
  { key: "review", label: "Review required" },
  { key: "fail", label: "Re-scan required" },
];

export const ACM_SAMPLE_RESULTS = [
  { key: "confirmed", label: "Confirmed asbestos (sampled)" },
  { key: "presumed", label: "Presumed asbestos (not sampled)" },
  { key: "no_asbestos_detected", label: "No asbestos detected" },
  { key: "not_sampled", label: "Not sampled — strongly presumed" },
];

export const ACM_RECOMMENDATIONS = [
  { key: "remove", label: "Remove" },
  { key: "encapsulate", label: "Encapsulate / seal" },
  { key: "manage_in_place", label: "Manage in place" },
  { key: "monitor", label: "Monitor (label & re-inspect)" },
  { key: "further_investigation", label: "Further investigation required" },
];

export const ACM_MATERIAL_RISK_SCORE = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

/** @typedef {{ tableKey: string, title: string, hint: string, columns: object[] }} SpecialistConfig */

/** @type {Record<string, SpecialistConfig>} */
export const SPECIALIST_FINDINGS_CONFIG = {
  cctv_drainage_survey: {
    tableKey: "cctvRunsTable",
    title: "CCTV run log",
    hint: "Log each drainage run — chainage, direction and MSCC-style structural grade for factual reporting.",
    columns: [
      { key: "runId", label: "Run ID", placeholder: "RUN-01" },
      { key: "upstreamMH", label: "Upstream MH", placeholder: "MH01" },
      { key: "downstreamMH", label: "Downstream MH", placeholder: "MH02" },
      { key: "pipeSize", label: "Pipe size", placeholder: "300 mm" },
      { key: "lengthM", label: "Length (m)", placeholder: "45" },
      { key: "direction", label: "Direction", placeholder: "Upstream → downstream" },
      { key: "msccGrade", label: "MSCC grade", options: MSCC_PIPE_GRADES },
      { key: "defectsNotes", label: "Defects / notes", placeholder: "Root intrusion @ 12 m" },
    ],
  },
  uav_aerial: {
    tableKey: "uavFlightsTable",
    title: "UAV flight log",
    hint: "Record each flight sortie — overlap, GCPs and wind band for photogrammetry QA.",
    columns: [
      { key: "flightId", label: "Flight ID", placeholder: "F01" },
      { key: "flightDate", label: "Date", type: "date" },
      { key: "durationMin", label: "Duration (min)", placeholder: "18" },
      { key: "altitudeM", label: "Altitude (m AGL)", placeholder: "120" },
      { key: "overlapPct", label: "Overlap %", placeholder: "80/70" },
      { key: "gcpCount", label: "GCPs used", placeholder: "6" },
      { key: "windBand", label: "Wind", options: UAV_WIND_BANDS },
      { key: "notes", label: "Notes", placeholder: "NOTAM filed, PPK" },
    ],
  },
  laser_scanning: {
    tableKey: "laserScansTable",
    title: "Laser scan session log",
    hint: "Terrestrial scan stations — registration RMSE and coverage notes for point cloud QA.",
    columns: [
      { key: "scanId", label: "Scan ID", placeholder: "SC01" },
      { key: "location", label: "Location", placeholder: "Grid A / facade north" },
      { key: "scannerModel", label: "Scanner", placeholder: "RTC360" },
      { key: "pointCount", label: "Points (approx.)", placeholder: "24M" },
      { key: "registrationRmse", label: "Reg. RMSE (mm)", placeholder: "2.1" },
      { key: "registrationStatus", label: "Status", options: LASER_REGISTRATION_STATUS },
      { key: "notes", label: "Notes", placeholder: "Target overlap 35%" },
    ],
  },
  asbestos_survey: {
    tableKey: "acmRegisterTable",
    title: "ACM register",
    hint: "Log each item / sample — material, product type, sample result and recommendation for the asbestos register.",
    columns: [
      { key: "sampleRef", label: "Sample / item ref", placeholder: "S01" },
      { key: "location", label: "Location", placeholder: "Room 12, ceiling void" },
      { key: "materialDescription", label: "Material description", placeholder: "Textured coating" },
      { key: "productType", label: "Product type", placeholder: "AIB / lagging / textured coating" },
      { key: "extentM2", label: "Extent (m² / m / no.)", placeholder: "12" },
      { key: "condition", label: "Condition", placeholder: "Good / damaged / friable" },
      { key: "riskScore", label: "Material risk", options: ACM_MATERIAL_RISK_SCORE },
      { key: "sampleResult", label: "Sample result", options: ACM_SAMPLE_RESULTS },
      { key: "recommendation", label: "Recommendation", options: ACM_RECOMMENDATIONS },
    ],
  },
};

export function getSpecialistFindingsConfig(surveyType) {
  const key = String(surveyType || "").trim();
  return key ? SPECIALIST_FINDINGS_CONFIG[key] || null : null;
}

export function blankSpecialistTablesState() {
  return {
    cctvRunsTable: [],
    uavFlightsTable: [],
    laserScansTable: [],
    acmRegisterTable: [],
  };
}

/** Merge specialist table arrays on normalize. */
export function mergeSpecialistTables(report, blank = blankSpecialistTablesState()) {
  return {
    cctvRunsTable: report?.cctvRunsTable || blank.cctvRunsTable,
    uavFlightsTable: report?.uavFlightsTable || blank.uavFlightsTable,
    laserScansTable: report?.laserScansTable || blank.laserScansTable,
    acmRegisterTable: report?.acmRegisterTable || blank.acmRegisterTable,
  };
}
