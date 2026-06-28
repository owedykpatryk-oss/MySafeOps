import { FileText } from "lucide-react";

/** Visual tone per More section (CSS modifier). */
export const SECTION_TONE_BY_TITLE = {
  "Site operations": "site",
  "Health, safety & environment": "hse",
  "Insights & reports": "insights",
  "Data & app": "data",
};

export function getSectionTone(sectionTitle) {
  return SECTION_TONE_BY_TITLE[sectionTitle] || "data";
}

/** @type {Record<string, import("lucide-react").LucideIcon> | null} */
let moduleIcons = null;
/** @type {Promise<Record<string, import("lucide-react").LucideIcon>> | null} */
let moduleIconsPromise = null;

/** Lazy-load ~60 module icons (separate chunk — not on initial workspace shell). */
export function preloadModuleIcons() {
  if (moduleIcons) return Promise.resolve(moduleIcons);
  if (!moduleIconsPromise) {
    moduleIconsPromise = import("./moduleCatalogIcons.js").then((m) => {
      moduleIcons = m.MODULE_ICONS;
      return moduleIcons;
    });
  }
  return moduleIconsPromise;
}

export function getModuleIcon(moduleId) {
  if (moduleIcons) return moduleIcons[moduleId] || moduleIcons.settings || FileText;
  return FileText;
}

/**
 * Org-scoped storage keys for register PDF export (array data in localStorage/D1 cache).
 * @type {Record<string, { key: string; columns?: { k: string; l: string }[] }>}
 */
export const MODULE_PDF_REGISTRY = {
  snags: { key: "snags", columns: [{ k: "ref", l: "Ref" }, { k: "title", l: "Title" }, { k: "status", l: "Status" }, { k: "priority", l: "Priority" }, { k: "dueDate", l: "Due" }] },
  timesheets: { key: "mysafeops_timesheets" },
  "daily-briefing": { key: "daily_briefings" },
  "method-statement": { key: "method_statements", columns: [{ k: "title", l: "Title" }, { k: "status", l: "Status" }, { k: "updatedAt", l: "Updated" }] },
  cdm: { key: "cdm_packs", columns: [{ k: "projectTitle", l: "Project" }, { k: "clientName", l: "Client" }, { k: "status", l: "Status" }] },
  coshh: { key: "coshh_items", columns: [{ k: "name", l: "Substance" }, { k: "riskLevel", l: "Risk" }, { k: "manufacturer", l: "Manufacturer" }, { k: "assessedDate", l: "Assessed" }] },
  inspections: { key: "inspection_records", columns: [{ k: "type", l: "Type" }, { k: "status", l: "Status" }, { k: "inspectedAt", l: "Date" }, { k: "inspector", l: "Inspector" }] },
  incidents: { key: "mysafeops_incidents", columns: [{ k: "ref", l: "Ref" }, { k: "type", l: "Type" }, { k: "severity", l: "Severity" }, { k: "occurredAt", l: "Date" }, { k: "status", l: "Status" }] },
  "incident-actions": { key: "incident_actions_v1", columns: [{ k: "title", l: "Action" }, { k: "status", l: "Status" }, { k: "dueDate", l: "Due" }, { k: "owner", l: "Owner" }] },
  "incident-map": { key: "mysafeops_incidents" },
  riddor: { key: "riddor_reports", columns: [{ k: "incidentType", l: "Type" }, { k: "status", l: "Status" }, { k: "deadline", l: "Deadline" }] },
  emergency: { key: "emergency_contacts", columns: [{ k: "label", l: "Contact" }, { k: "phone", l: "Phone" }, { k: "notes", l: "Notes" }] },
  ppe: { key: "ppe_register", columns: [{ k: "itemType", l: "PPE" }, { k: "workerName", l: "Worker" }, { k: "issuedDate", l: "Issued" }, { k: "status", l: "Status" }] },
  plant: { key: "plant_register", columns: [{ k: "name", l: "Plant" }, { k: "assetTag", l: "Tag" }, { k: "status", l: "Status" }, { k: "nextInspection", l: "Next check" }] },
  fire: { key: "fire_safety_log", columns: [{ k: "type", l: "Type" }, { k: "location", l: "Location" }, { k: "checkedAt", l: "Checked" }, { k: "result", l: "Result" }] },
  "hot-work": { key: "hot_work_register", columns: [{ k: "ref", l: "Ref" }, { k: "location", l: "Location" }, { k: "status", l: "Status" }, { k: "startDate", l: "Start" }] },
  training: { key: "training_matrix", columns: [{ k: "workerName", l: "Worker" }, { k: "course", l: "Course" }, { k: "expiryDate", l: "Expiry" }, { k: "status", l: "Status" }] },
  visitors: { key: "visitor_log", columns: [{ k: "name", l: "Visitor" }, { k: "company", l: "Company" }, { k: "signedInAt", l: "Sign-in" }, { k: "signedOutAt", l: "Sign-out" }] },
  "toolbox-reg": { key: "toolbox_talks", columns: [{ k: "topic", l: "Topic" }, { k: "talkDate", l: "Date" }, { k: "presenter", l: "Presenter" }] },
  "first-aid": { key: "first_aid_register", columns: [{ k: "name", l: "Name" }, { k: "role", l: "Role" }, { k: "certExpiry", l: "Cert expiry" }] },
  "lone-working": { key: "lone_working_log", columns: [{ k: "workerName", l: "Worker" }, { k: "checkInAt", l: "Check-in" }, { k: "status", l: "Status" }] },
  environmental: { key: "environmental_log", columns: [{ k: "type", l: "Type" }, { k: "reading", l: "Reading" }, { k: "recordedAt", l: "Date" }] },
  observations: { key: "safety_observations", columns: [{ k: "type", l: "Type" }, { k: "description", l: "Observation" }, { k: "status", l: "Status" }, { k: "reportedAt", l: "Date" }] },
  ladders: { key: "ladder_inspections", columns: [{ k: "tagId", l: "Tag" }, { k: "result", l: "Result" }, { k: "inspectedAt", l: "Date" }] },
  mewp: { key: "mewp_log", columns: [{ k: "equipmentId", l: "MEWP" }, { k: "operator", l: "Operator" }, { k: "inspectionDate", l: "Inspection" }] },
  gate: { key: "gate_book", columns: [{ k: "vehicleReg", l: "Vehicle" }, { k: "driver", l: "Driver" }, { k: "timeIn", l: "In" }, { k: "timeOut", l: "Out" }] },
  asbestos: { key: "asbestos_register", columns: [{ k: "location", l: "Location" }, { k: "material", l: "Material" }, { k: "condition", l: "Condition" }] },
  "confined-space": { key: "confined_space_log", columns: [{ k: "location", l: "Location" }, { k: "permitRef", l: "Permit" }, { k: "entryAt", l: "Entry" }] },
  loto: { key: "loto_register", columns: [{ k: "equipmentId", l: "Equipment" }, { k: "status", l: "Status" }, { k: "appliedAt", l: "Applied" }] },
  "electrical-pat": { key: "electrical_pat_log", columns: [{ k: "assetId", l: "Asset" }, { k: "result", l: "Result" }, { k: "testDate", l: "Test date" }] },
  lifting: { key: "lifting_plan_register", columns: [{ k: "title", l: "Plan" }, { k: "status", l: "Status" }, { k: "reviewDate", l: "Review" }] },
  dsear: { key: "dsear_register", columns: [{ k: "area", l: "Area" }, { k: "substance", l: "Substance" }, { k: "riskLevel", l: "Risk" }] },
  noise: { key: "noise_vibration_log", columns: [{ k: "location", l: "Location" }, { k: "levelDb", l: "dB" }, { k: "measuredAt", l: "Date" }] },
  scaffold: { key: "scaffold_register", columns: [{ k: "tag", l: "Tag" }, { k: "location", l: "Location" }, { k: "inspectionDate", l: "Inspection" }] },
  excavation: { key: "excavation_log", columns: [{ k: "location", l: "Location" }, { k: "depth", l: "Depth" }, { k: "permitRef", l: "Permit" }] },
  "temp-works": { key: "temporary_works_register", columns: [{ k: "title", l: "Title" }, { k: "designCategory", l: "Category" }, { k: "status", l: "Status" }] },
  welfare: { key: "welfare_check_log", columns: [{ k: "location", l: "Location" }, { k: "checkedAt", l: "Checked" }, { k: "notes", l: "Notes" }] },
  "water-hygiene": { key: "water_hygiene_log", columns: [{ k: "outlet", l: "Outlet" }, { k: "temperature", l: "Temp" }, { k: "testedAt", l: "Tested" }] },
  waste: { key: "waste_register", columns: [{ k: "wasteType", l: "Type" }, { k: "quantity", l: "Qty" }, { k: "disposedAt", l: "Disposed" }] },
  "high-care-access": { key: "high_care_access_register", columns: [{ k: "workerName", l: "Worker" }, { k: "area", l: "Area" }, { k: "validUntil", l: "Valid until" }] },
  "cip-signoff": { key: "cip_signoff_register", columns: [{ k: "line", l: "Line" }, { k: "signedOffAt", l: "Sign-off" }, { k: "status", l: "Status" }] },
  "allergen-changeovers": { key: "allergen_changeover_windows", columns: [{ k: "label", l: "Window" }, { k: "fromAllergen", l: "From" }, { k: "toAllergen", l: "To" }, { k: "startAt", l: "Start" }] },
  "gmp-deviations": { key: "gmp_deviation_log", columns: [{ k: "ref", l: "Ref" }, { k: "title", l: "Title" }, { k: "status", l: "Status" }, { k: "openedAt", l: "Opened" }] },
  audit: { key: "mysafeops_audit", columns: [{ k: "at", l: "When" }, { k: "action", l: "Action" }, { k: "entity", l: "Entity" }, { k: "detail", l: "Detail" }] },
  "survey-report": {
    key: "survey_reports",
    columns: [
      { k: "ref", l: "Ref" },
      { k: "title", l: "Title" },
      { k: "status", l: "Status" },
      { k: "surveyDate", l: "Date" },
      { k: "surveyor", l: "Surveyor" },
    ],
  },
};

export function canExportModulePdf(moduleId) {
  return Boolean(MODULE_PDF_REGISTRY[moduleId]);
}
