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
 * Column keys must match live register row fields — see register CSV exports in each module.
 * @type {Record<string, { key: string; columns?: { k: string; l: string }[] }>}
 */
export const MODULE_PDF_REGISTRY = {
  snags: {
    key: "snags",
    columns: [
      { k: "ref", l: "Ref" },
      { k: "title", l: "Title" },
      { k: "status", l: "Status" },
      { k: "priority", l: "Priority" },
      { k: "dueDate", l: "Due" },
    ],
  },
  timesheets: { key: "mysafeops_timesheets" },
  "daily-briefing": { key: "daily_briefings" },
  "method-statement": {
    key: "method_statements",
    columns: [
      { k: "title", l: "Title" },
      { k: "status", l: "Status" },
      { k: "updatedAt", l: "Updated" },
    ],
  },
  cdm: { key: "cdm_packs" },
  "whs-plan": { key: "cdm_packs" },
  "bhp-plan": { key: "cdm_packs" },
  coshh: {
    key: "coshh_items",
    columns: [
      { k: "name", l: "Substance" },
      { k: "riskLevel", l: "Risk" },
      { k: "manufacturer", l: "Manufacturer" },
      { k: "assessedDate", l: "Assessed" },
    ],
  },
  inspections: {
    key: "inspection_records",
    columns: [
      { k: "type", l: "Type" },
      { k: "name", l: "Asset" },
      { k: "result", l: "Result" },
      { k: "lastInspectionDate", l: "Last inspection" },
      { k: "nextInspectionDate", l: "Next due" },
    ],
  },
  incidents: {
    key: "mysafeops_incidents",
    columns: [
      { k: "ref", l: "Ref" },
      { k: "type", l: "Type" },
      { k: "severity", l: "Severity" },
      { k: "occurredAt", l: "Date" },
      { k: "status", l: "Status" },
    ],
  },
  "incident-actions": {
    key: "incident_actions_v1",
    columns: [
      { k: "title", l: "Action" },
      { k: "status", l: "Status" },
      { k: "dueDate", l: "Due" },
      { k: "owner", l: "Owner" },
    ],
  },
  "incident-map": { key: "mysafeops_incidents" },
  riddor: { key: "riddor_reports" },
  "notifiable-incidents": { key: "riddor_reports" },
  emergency: {
    key: "emergency_contacts",
    columns: [
      { k: "label", l: "Contact" },
      { k: "phone", l: "Phone" },
      { k: "notes", l: "Notes" },
    ],
  },
  ppe: {
    key: "ppe_register",
    columns: [
      { k: "item", l: "PPE" },
      { k: "workerName", l: "Worker" },
      { k: "issuedDate", l: "Issued" },
      { k: "conditionOk", l: "OK" },
    ],
  },
  plant: {
    key: "plant_register",
    columns: [
      { k: "assetRef", l: "Asset ref" },
      { k: "description", l: "Description" },
      { k: "inspectedDate", l: "Inspected" },
      { k: "nextDue", l: "Next due" },
      { k: "result", l: "Result" },
    ],
  },
  fire: {
    key: "fire_safety_log",
    columns: [
      { k: "checkType", l: "Type" },
      { k: "location", l: "Location" },
      { k: "checkDate", l: "Date" },
      { k: "satisfactory", l: "Satisfactory" },
      { k: "checkedBy", l: "Checked by" },
    ],
  },
  "hot-work": {
    key: "hot_work_register",
    columns: [
      { k: "permitRef", l: "Ref" },
      { k: "location", l: "Location" },
      { k: "workDate", l: "Date" },
      { k: "status", l: "Status" },
    ],
  },
  training: {
    key: "training_matrix",
    columns: [
      { k: "workerName", l: "Worker" },
      { k: "courseName", l: "Course" },
      { k: "expiryDate", l: "Expiry" },
      { k: "provider", l: "Provider" },
    ],
  },
  visitors: {
    key: "visitor_log",
    columns: [
      { k: "visitorName", l: "Visitor" },
      { k: "company", l: "Company" },
      { k: "visitDate", l: "Visit date" },
      { k: "timeIn", l: "In" },
      { k: "timeOut", l: "Out" },
    ],
  },
  "toolbox-reg": { key: "toolbox_talks" },
  "first-aid": {
    key: "first_aid_register",
    columns: [
      { k: "name", l: "Name" },
      { k: "qualification", l: "Qualification" },
      { k: "certExpiry", l: "Cert expiry" },
    ],
  },
  "lone-working": {
    key: "lone_working_log",
    columns: [
      { k: "workDate", l: "Date" },
      { k: "workerName", l: "Worker" },
      { k: "task", l: "Task" },
      { k: "location", l: "Location" },
      { k: "signedOff", l: "Signed off" },
    ],
  },
  environmental: {
    key: "environmental_log",
    columns: [
      { k: "eventDate", l: "Date" },
      { k: "category", l: "Category" },
      { k: "description", l: "Description" },
      { k: "closedOut", l: "Closed" },
    ],
  },
  observations: { key: "safety_observations" },
  ladders: {
    key: "ladder_inspections",
    columns: [
      { k: "ladderRef", l: "Ref" },
      { k: "location", l: "Location" },
      { k: "inspectionDate", l: "Date" },
      { k: "result", l: "Result" },
    ],
  },
  mewp: {
    key: "mewp_log",
    columns: [
      { k: "equipmentRef", l: "Equipment" },
      { k: "operatorName", l: "Operator" },
      { k: "checkDate", l: "Check date" },
      { k: "mewpType", l: "Type" },
    ],
  },
  gate: {
    key: "gate_book",
    columns: [
      { k: "visitDate", l: "Date" },
      { k: "vehicleReg", l: "Vehicle" },
      { k: "driverName", l: "Driver" },
      { k: "timeIn", l: "In" },
      { k: "timeOut", l: "Out" },
    ],
  },
  asbestos: {
    key: "asbestos_register",
    columns: [
      { k: "location", l: "Location" },
      { k: "materialDescription", l: "Material" },
      { k: "asbestosType", l: "Type" },
      { k: "lastReviewDate", l: "Last review" },
    ],
  },
  "confined-space": {
    key: "confined_space_log",
    columns: [
      { k: "permitRef", l: "Permit" },
      { k: "entryDate", l: "Entry date" },
      { k: "spaceDescription", l: "Space" },
      { k: "timeStart", l: "Start" },
    ],
  },
  loto: {
    key: "loto_register",
    columns: [
      { k: "equipmentName", l: "Equipment" },
      { k: "equipmentTag", l: "Tag" },
      { k: "phase", l: "Phase" },
      { k: "zeroEnergyVerified", l: "Zero energy" },
    ],
  },
  "electrical-pat": {
    key: "electrical_pat_log",
    columns: [
      { k: "assetTag", l: "Asset" },
      { k: "testDate", l: "Test date" },
      { k: "result", l: "Result" },
      { k: "testedBy", l: "Tested by" },
    ],
  },
  lifting: {
    key: "lifting_plan_register",
    columns: [
      { k: "liftRef", l: "Ref" },
      { k: "liftDate", l: "Date" },
      { k: "loadDescription", l: "Load" },
      { k: "appointedPerson", l: "AP" },
    ],
  },
  dsear: {
    key: "dsear_register",
    columns: [
      { k: "substanceOrArea", l: "Substance / area" },
      { k: "hazardClass", l: "Hazard class" },
      { k: "reviewDate", l: "Review" },
      { k: "nextReviewDate", l: "Next review" },
    ],
  },
  noise: {
    key: "noise_vibration_log",
    columns: [
      { k: "recordType", l: "Type" },
      { k: "logDate", l: "Date" },
      { k: "activityOrTool", l: "Activity" },
      { k: "location", l: "Location" },
    ],
  },
  scaffold: {
    key: "scaffold_register",
    columns: [
      { k: "tagRef", l: "Tag" },
      { k: "location", l: "Location" },
      { k: "inspectionDate", l: "Inspection" },
      { k: "result", l: "Result" },
    ],
  },
  excavation: {
    key: "excavation_log",
    columns: [
      { k: "permitRef", l: "Permit" },
      { k: "workDate", l: "Date" },
      { k: "location", l: "Location" },
      { k: "maxDepth", l: "Max depth" },
    ],
  },
  "temp-works": {
    key: "temporary_works_register",
    columns: [
      { k: "twRef", l: "Ref" },
      { k: "category", l: "Category" },
      { k: "status", l: "Status" },
      { k: "nextCheckDue", l: "Next check" },
    ],
  },
  welfare: {
    key: "welfare_check_log",
    columns: [
      { k: "checkDate", l: "Date" },
      { k: "projectName", l: "Project" },
      { k: "checkedBy", l: "Checked by" },
      { k: "issues", l: "Issues" },
    ],
  },
  "water-hygiene": {
    key: "water_hygiene_log",
    columns: [
      { k: "outletId", l: "Outlet" },
      { k: "checkDate", l: "Date" },
      { k: "temperatureC", l: "Temp °C" },
      { k: "location", l: "Location" },
    ],
  },
  waste: {
    key: "waste_register",
    columns: [
      { k: "wtnRef", l: "WTN ref" },
      { k: "transferDate", l: "Date" },
      { k: "description", l: "Description" },
      { k: "ewcCode", l: "EWC" },
    ],
  },
  "high-care-access": {
    key: "high_care_access_register",
    columns: [
      { k: "zoneName", l: "Zone" },
      { k: "visitorName", l: "Visitor" },
      { k: "visitorCompany", l: "Company" },
      { k: "zoneClass", l: "Class" },
    ],
  },
  "cip-signoff": {
    key: "cip_signoff_register",
    columns: [
      { k: "equipmentId", l: "Equipment" },
      { k: "cipProgram", l: "CIP program" },
      { k: "signedOffBy", l: "Signed off by" },
      { k: "workOrderRef", l: "Work order" },
    ],
  },
  "allergen-changeovers": {
    key: "allergen_changeover_windows",
    columns: [
      { k: "label", l: "Window" },
      { k: "fromAllergen", l: "From" },
      { k: "toAllergen", l: "To" },
      { k: "startAt", l: "Start" },
    ],
  },
  "gmp-deviations": {
    key: "gmp_deviation_log",
    columns: [
      { k: "batchRef", l: "Batch" },
      { k: "deviationType", l: "Type" },
      { k: "siteLabel", l: "Site" },
      { k: "closedAt", l: "Closed" },
    ],
  },
  audit: {
    key: "mysafeops_audit",
    columns: [
      { k: "at", l: "When" },
      { k: "action", l: "Action" },
      { k: "entity", l: "Entity" },
      { k: "detail", l: "Detail" },
    ],
  },
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
  "gpr-report": {
    key: "gpr_reports",
    columns: [
      { k: "ref", l: "Ref" },
      { k: "title", l: "Title" },
      { k: "status", l: "Status" },
      { k: "surveyDate", l: "Date" },
      { k: "surveyor", l: "Surveyor" },
    ],
  },
  "geo-photos": { key: "geo_photos" },
  "ghp-register": {
    key: "ghp_register",
    columns: [
      { k: "itemDescription", l: "Item" },
      { k: "zone", l: "Zone" },
      { k: "broughtBy", l: "By" },
      { k: "dateIn", l: "Date in" },
    ],
  },
  "dynamic-ra": {
    key: "dynamic_risk_assessments",
    columns: [
      { k: "location", l: "Location" },
      { k: "authorName", l: "Author" },
      { k: "assessedAt", l: "Assessed" },
      { k: "newHazards", l: "Hazards" },
    ],
  },
  legislation: {
    key: "legislation_register",
    columns: [
      { k: "shortName", l: "Regulation" },
      { k: "applicable", l: "Applicable" },
      { k: "nextReview", l: "Review" },
    ],
  },
  induction: { key: "induction_entries" },
  signatures: { key: "signatures" },
  documents: { key: "mysafeops_r2_uploads" },
  "project-drawings": { key: "project_drawing_objects_v1" },
  "client-portal": { key: "client_portals" },
  templates: { key: "document_templates" },
  "monthly-report": { key: "monthly_reports" },
  backup: { key: "backup_exports" },
};

const PDF_EXPORT_BLOCKLIST = new Set(["help", "settings", "superadmin"]);

export function canExportModulePdf(moduleId) {
  if (PDF_EXPORT_BLOCKLIST.has(moduleId)) return false;
  return true;
}

/** @returns {{ key: string, columns?: object[], overview?: boolean } | null} */
export function getModulePdfConfig(moduleId) {
  if (PDF_EXPORT_BLOCKLIST.has(moduleId)) return null;
  const cfg = MODULE_PDF_REGISTRY[moduleId];
  if (cfg) return cfg;
  return { key: "", overview: true };
}
