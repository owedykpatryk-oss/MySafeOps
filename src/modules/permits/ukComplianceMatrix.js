export const UK_COMPLIANCE_MATRIX_VERSION = "uk-v2";

/** Short rationale + HSE starting points for inline “why” tooltips (not legal advice). */
export const UK_TYPE_COMPLIANCE_META = {
  hot_work: {
    hseUrl: "https://www.hse.gov.uk/fireandexplosion/hot-work.htm",
    rationale: "Hot work is a leading cause of industrial fires; baseline controls mirror HSE hot-work expectations.",
  },
  electrical: {
    hseUrl: "https://www.hse.gov.uk/electricity/",
    rationale: "Isolation and dead proving follow HSE electricity at work guidance (e.g. GS38 for test equipment).",
  },
  work_at_height: {
    hseUrl: "https://www.hse.gov.uk/work-at-height/",
    rationale: "Falls from height remain a top fatal risk; controls reflect WAHR hierarchy and industry good practice.",
  },
  confined_space: {
    hseUrl: "https://www.hse.gov.uk/confinedspace/",
    rationale: "Confined spaces require atmospheric control, rescue readiness, and standby — aligned to HSE ACOP themes.",
  },
  excavation: {
    hseUrl: "https://www.hse.gov.uk/construction/safetytopics/buriedservices.htm",
    rationale: "Utility strikes and trench collapse drive HSE focus on locating services and safe digging.",
  },
  lifting: {
    hseUrl: "https://www.hse.gov.uk/work-equipment-machinery/lifting-equipment.htm",
    rationale: "LOLER requires planning, competent persons, and equipment within examination — reflected in checklist items.",
  },
  cold_work: {
    hseUrl: "https://www.hse.gov.uk/electricity/htm",
    rationale: "Mechanical / LOTO isolation prevents unexpected energisation during maintenance.",
  },
  line_break: {
    hseUrl: "https://www.hse.gov.uk/pubns/priced/hsg253.pdf",
    rationale: "Line breaking needs positive isolation, knowledge of contents, and controlled first-break.",
  },
  roof_access: {
    hseUrl: "https://www.hse.gov.uk/work-at-height/information.htm",
    rationale: "Fragile roofs and rooflights are a common fatal risk; access must be planned and edge-protected.",
  },
  night_works: {
    hseUrl: "https://www.hse.gov.uk/construction/safetytopics/outofhours.htm",
    rationale: "Out-of-hours work needs lighting, emergency cover, and agreed client/site controls.",
  },
  valve_isolation: {
    hseUrl: "https://www.hse.gov.uk/safetytopics/pipework.htm",
    rationale: "Process valve operations require P&ID verification and communication to affected workers.",
  },
  visitor_access: {
    hseUrl: "https://www.hse.gov.uk/construction/safetytopics/visitors.htm",
    rationale: "Visitors need induction, escort, and emergency briefing — typical site rules and CDM themes.",
  },
  radiography: {
    hseUrl: "https://www.hse.gov.uk/radiation/ionising/",
    rationale: "Ionising radiation work follows IRR and RPA/RPS roles; controlled areas and monitoring are mandatory themes.",
  },
  ground_disturbance: {
    hseUrl: "https://www.hse.gov.uk/construction/safetytopics/buriedservices.htm",
    rationale: "Deeper disturbance adds geotechnical, UXO, and vibration risks beyond standard utility scanning.",
  },
  general: {
    hseUrl: "https://www.hse.gov.uk/construction/safetytopics/permits.htm",
    rationale: "General PTW should still define scope, hazards, and emergency arrangements before work starts.",
  },
};

export const UK_COMPLIANCE_MATRIX = {
  hot_work: {
    legalRequiredChecklistIds: ["hot_work_1", "hot_work_2", "hot_work_6", "hot_work_10"],
    requiredEvidenceFields: ["fireWatcher", "postInspectionTime"],
  },
  confined_space: {
    legalRequiredChecklistIds: ["confined_space_2", "confined_space_5", "confined_space_6", "confined_space_7", "confined_space_8"],
    requiredEvidenceFields: ["standByPerson", "atmosphericReadings", "spaceDescription"],
  },
  electrical: {
    legalRequiredChecklistIds: ["electrical_1", "electrical_3", "electrical_6", "electrical_7"],
    requiredEvidenceFields: ["circuitRef", "lockoutRef", "authorisedPerson"],
  },
  work_at_height: {
    legalRequiredChecklistIds: ["work_at_height_1", "work_at_height_4", "work_at_height_7", "work_at_height_8"],
    requiredEvidenceFields: ["accessEquipment", "maxHeight", "rescuePlan"],
  },
  lifting: {
    legalRequiredChecklistIds: ["lifting_1", "lifting_2", "lifting_3", "lifting_5"],
    requiredEvidenceFields: ["liftingEquipment", "swl", "appointedPerson"],
  },
  excavation: {
    legalRequiredChecklistIds: ["excavation_1", "excavation_2", "excavation_5", "excavation_8"],
    requiredEvidenceFields: ["catScanBy", "knownServices", "excavationDepth"],
  },
  cold_work: {
    legalRequiredChecklistIds: ["cold_work_1", "cold_work_2", "cold_work_5", "cold_work_6"],
    requiredEvidenceFields: ["equipmentTag", "isolationPoints", "lotoKeyHolder"],
  },
  line_break: {
    legalRequiredChecklistIds: ["line_break_1", "line_break_2", "line_break_4", "line_break_7"],
    requiredEvidenceFields: ["pipeContents", "workingPressure"],
  },
  roof_access: {
    legalRequiredChecklistIds: ["roof_access_2", "roof_access_3", "roof_access_7", "roof_access_10"],
    requiredEvidenceFields: ["roofType", "accessMethod", "maxPersons"],
  },
  night_works: {
    legalRequiredChecklistIds: ["night_works_1", "night_works_5", "night_works_6", "night_works_7"],
    requiredEvidenceFields: ["siteContact", "securityCode"],
  },
  valve_isolation: {
    legalRequiredChecklistIds: ["valve_isolation_1", "valve_isolation_2", "valve_isolation_4", "valve_isolation_7"],
    requiredEvidenceFields: ["valveTag", "authorisedOperator", "systemContents"],
  },
  visitor_access: {
    legalRequiredChecklistIds: ["visitor_access_1", "visitor_access_2", "visitor_access_3", "visitor_access_6"],
    requiredEvidenceFields: ["escortName", "purposeOfVisit"],
  },
  radiography: {
    legalRequiredChecklistIds: ["radiography_1", "radiography_3", "radiography_4", "radiography_7"],
    requiredEvidenceFields: ["rps", "sourceType", "controlledAreaRadius"],
  },
  ground_disturbance: {
    legalRequiredChecklistIds: ["ground_disturbance_1", "ground_disturbance_2", "ground_disturbance_5", "ground_disturbance_6"],
    requiredEvidenceFields: ["disturbanceMethod", "maxDepth", "groundType"],
  },
  general: {
    legalRequiredChecklistIds: ["general_1", "general_2", "general_4", "general_6"],
    requiredEvidenceFields: [],
  },
};

export function getComplianceProfile(permitType) {
  return UK_COMPLIANCE_MATRIX[permitType] || { legalRequiredChecklistIds: [], requiredEvidenceFields: [] };
}

export function getTypeComplianceMeta(permitType) {
  return UK_TYPE_COMPLIANCE_META[permitType] || UK_TYPE_COMPLIANCE_META.general;
}
