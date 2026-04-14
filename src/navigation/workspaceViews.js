import { lazy } from "react";

/**
 * Single map: workspace route id → dynamic import.
 * Used by lazy route components and by `viewPrefetch.js` (`prefetchView`).
 */
export const workspaceViewLoaders = {
  dashboard: () => import("../components/AnalyticsDashboard"),
  permits: () => import("../modules/permits/PermitSystem"),
  rams: () => import("../modules/rams/RAMSTemplateBuilder"),
  workers: () => import("../modules/Workers"),
  bin: () => import("../modules/RecycleBin"),
  "site-map": () => import("../modules/SitePresenceMap"),
  "method-statement": () => import("../modules/MethodStatement"),
  cdm: () => import("../modules/CDMCompliance"),
  "daily-briefing": () => import("../modules/DailyBriefing"),
  induction: () => import("../modules/QRInduction"),
  signatures: () => import("../modules/DigitalSignature"),
  timesheets: () => import("../modules/Timesheet"),
  snags: () => import("../modules/SnagRegister"),
  coshh: () => import("../modules/COSHHRegister"),
  inspections: () => import("../modules/InspectionTracker"),
  incidents: () => import("../modules/IncidentNearMiss"),
  "incident-actions": () => import("../modules/IncidentActionTracker"),
  "incident-map": () => import("../modules/IncidentHotspotMap"),
  riddor: () => import("../modules/RIDDORWizard"),
  emergency: () => import("../modules/EmergencyContacts"),
  ppe: () => import("../modules/PPERegister"),
  plant: () => import("../modules/PlantEquipmentRegister"),
  fire: () => import("../modules/FireSafetyLog"),
  "hot-work": () => import("../modules/HotWorkRegister"),
  training: () => import("../modules/TrainingMatrix"),
  visitors: () => import("../modules/VisitorLog"),
  "toolbox-reg": () => import("../modules/ToolboxTalkRegister"),
  "first-aid": () => import("../modules/FirstAidRegister"),
  "lone-working": () => import("../modules/LoneWorkingLog"),
  environmental: () => import("../modules/EnvironmentalLog"),
  observations: () => import("../modules/SafetyObservations"),
  ladders: () => import("../modules/LadderInspection"),
  mewp: () => import("../modules/MEWPLog"),
  gate: () => import("../modules/GateBook"),
  asbestos: () => import("../modules/AsbestosRegister"),
  "confined-space": () => import("../modules/ConfinedSpaceLog"),
  loto: () => import("../modules/LOTORegister"),
  "electrical-pat": () => import("../modules/ElectricalPATLog"),
  lifting: () => import("../modules/LiftingPlanRegister"),
  dsear: () => import("../modules/DSEARLog"),
  noise: () => import("../modules/NoiseVibrationLog"),
  scaffold: () => import("../modules/ScaffoldRegister"),
  excavation: () => import("../modules/ExcavationLog"),
  "temp-works": () => import("../modules/TemporaryWorksRegister"),
  welfare: () => import("../modules/WelfareCheckLog"),
  "water-hygiene": () => import("../modules/WaterHygieneLog"),
  analytics: () => import("../components/AnalyticsDashboard"),
  "monthly-report": () => import("../modules/MonthlyReport"),
  waste: () => import("../modules/WasteRegister"),
  templates: () => import("../modules/DocumentTemplates"),
  "ai-rams": () => import("../modules/AIRamsGenerator"),
  "ai-toolbox": () => import("../modules/ToolboxTalkAI"),
  "ai-photo": () => import("../modules/PhotoHazardAI"),
  "client-portal": () => import("../components/ClientPortal"),
  "client-acquisition": () => import("../components/ClientAcquisitionPlaybook"),
  "sales-enablement": () => import("../components/SalesEnablementHub"),
  "enterprise-readiness": () => import("../components/EnterpriseReadinessHub"),
  subcontractor: () => import("../modules/SubcontractorPortal"),
  documents: () => import("../modules/DocumentLibrary"),
  backup: () => import("../modules/BackupExport"),
  audit: () => import("../modules/AuditLogViewer"),
  superadmin: () => import("../modules/SuperAdminPanel"),
  help: () => import("../components/HelpAbout"),
};

/** Lazy React components for each workspace view id (settings handled separately in layout). */
export const workspaceViewComponents = Object.fromEntries(
  Object.entries(workspaceViewLoaders).map(([id, loader]) => [id, lazy(loader)])
);

export const DEFAULT_WORKSPACE_VIEW_ID = "dashboard";
