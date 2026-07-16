/**
 * Project playbooks — one-click recipes for RAMS, survey, PTW, MS and checklists.
 * No AI: deterministic JSON recipes applied on project create or from project hub.
 */

import { PROJECT_DOC_KEYS } from "./projectDashboard";
import { isSurveyWorkflowEnabled } from "./surveyWorkflowGate";
import { loadOrgScoped as load, saveOrgScoped as save, asStorageArray } from "./orgStorage";
import { projectHasRams, docsForProject } from "./projectRamsPresence";
import { blankSurveyReport } from "../modules/surveyReport/surveyReportConstants";
import {
  prefillReportFromProject,
  applyDefaultRecordsPreset,
  buildDefaultEquipmentCalibration,
  buildDefaultDeliverables,
} from "../modules/surveyReport/surveyReportSmart";
import { nextSurveyRef } from "../modules/surveyReport/surveyReportHelpers";
import { blankGprReport } from "../modules/gprReport/gprReportConstants";
import { nextGprRef } from "../modules/gprReport/gprReportHelpers";
import { prefillGprFromProject } from "../modules/gprReport/gprReportSmart";
import { buildPermitDraftFromProject } from "../modules/permits/permitProjectDefaults";
import { getPlaybookSurveyPack, getSurveyPackMeta } from "./surveyContentCatalog";
import { applyPas128MethodToReport } from "../modules/surveyReport/pas128MethodPresets";
import { checklistStringsForType } from "../modules/permits/permitTypes";
import { createDefaultChecklistItems, normalizeChecklistState } from "../modules/permits/permitChecklistUtils";
import { getTemplateForType } from "../modules/permits/permitTemplateCatalog";
import { PERMIT_TYPES } from "../modules/permits/permitTypes";
import { getMsStepTemplate } from "./msOrgTemplates";
import { buildFessJobStarterFormPatch } from "./fessRamsWorkflow";
import { resolveFessStarterHazards } from "./fessJobStarters";
import { buildMsStepsFromRams } from "./fessMsWorkflow";
import { getFessPlaybook } from "./fessProjectPlaybooks";
import { isFessOrg } from "./fessOrg";
import { FESS_CLIENT_SITE_TEMPLATES } from "./fessClientSites";
import ALL from "../modules/rams/ramsAllHazards.js";

export { projectHasRams, docsForProject };

const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function generateRamsDocNo() {
  const year = new Date().getFullYear();
  const tail = String(Math.floor(Math.random() * 9000) + 1000);
  return `RAMS-${year}-${tail}`;
}

const today = () => new Date().toISOString().slice(0, 10);

/** @type {Array<{ id: string, label: string, description: string, industryStarter?: string, surveyType?: string, pas128Ql?: string, permitTypes: string[], msTemplate?: string, ramsSurveyKey?: string, checklistExtras?: string[] }>} */
export const PROJECT_PLAYBOOKS = [
  {
    id: "utility_mapping",
    label: "Utility mapping (PAS128)",
    description: "RAMS + PAS128 survey draft + excavation PTW + mobilisation MS",
    industryStarter: "infrastructure",
    surveyType: "utility_mapping_survey",
    pas128Ql: "B1",
    ramsSurveyKey: "utility_mapping_survey",
    gprPlaybook: true,
    permitTypes: ["excavation", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Confirm utility records received and reviewed",
      "Plan trial holes and safe dig zones",
      "Brief team on PAS128 quality level and deliverables",
      "Draft GPR report — BGS geology and weather enrichment",
      "Capture site entrance, access route and hazard geo-photos before mobilisation",
    ],
  },
  {
    id: "topo_plus_utility",
    label: "Topo + utility (combined PAS128)",
    description: "Combined topo and PAS128 RAMS + survey draft + excavation PTW",
    industryStarter: "infrastructure",
    surveyType: "topo_plus_utility_survey",
    pas128Ql: "B1",
    ramsSurveyKey: "topo_plus_utility_survey",
    permitTypes: ["excavation", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Control network plan agreed for combined deliverable",
      "Utility records and topo base context reviewed",
      "MH/IC lifting sequence and gas monitor checked",
      "Combined CAD QC hold point before issue",
    ],
  },
  {
    id: "drainage_connectivity",
    label: "Drainage connectivity (sonde)",
    description: "RAMS + drainage connectivity survey + confined space / excavation PTW",
    industryStarter: "infrastructure",
    surveyType: "drainage_connectivity_survey",
    ramsSurveyKey: "drainage_connectivity_survey",
    permitTypes: ["excavation", "confined_space", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Chamber access and barrier plan agreed",
      "Sonde / duct rod and EML locator checked",
      "Trace log template ready for each connection",
    ],
  },
  {
    id: "service_clearance_gi",
    label: "Service clearance (pre-GI)",
    description: "Utility clearance RAMS before boreholes / trial pits + GI survey draft",
    industryStarter: "infrastructure",
    surveyType: "service_clearance_survey",
    ramsSurveyKey: "service_clearance_survey",
    permitTypes: ["excavation", "ground_disturbance", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "GI intrusive locations marked on layout",
      "Clearance zones agreed per hole",
      "Handover briefing to GI contractor scheduled",
    ],
  },
  {
    id: "groundworks",
    label: "Groundworks / civils",
    description: "Civils RAMS + excavation & lifting PTW + mobilisation MS",
    industryStarter: "infrastructure",
    surveyType: "topographical_survey",
    ramsSurveyKey: "topographical_survey",
    permitTypes: ["excavation", "lifting", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Arrange utility scans and trial holes before breaking ground",
      "Define traffic and plant segregation",
      "Prepare adverse weather contingency",
    ],
  },
  {
    id: "site_investigation",
    label: "Site investigation & geotechnics",
    description: "GI RAMS + service clearance + window sampling / boreholes / DCP + excavation & ground disturbance PTW",
    industryStarter: "infrastructure",
    surveyType: "site_investigation_campaign",
    ramsSurveyKey: "site_investigation_campaign",
    permitTypes: ["excavation", "ground_disturbance", "confined_space", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Service clearance / utility scan completed for each intrusive location",
      "Desk study and contamination/gas assessment reviewed",
      "Utility search and permit-to-dig issued before intrusive works",
      "Sample chain-of-custody forms and lab instructions confirmed",
      "Borehole abandonment and trial pit reinstatement plan agreed",
      "Ground gas monitor calibrated if desk study flags risk",
    ],
  },
  {
    id: "electrical",
    label: "Electrical / M&E",
    description: "RAMS + electrical & hot-work PTW + method statement",
    industryStarter: "maintenance",
    permitTypes: ["electrical", "hot_work", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Confirm isolation, lock-off and proving dead before work",
      "Check test equipment calibration (PAT / insulation)",
      "Brief fire watch if hot work on or near combustibles",
    ],
  },
  {
    id: "refurb_build",
    label: "Building / refurbishment",
    description: "RAMS + general & hot-work PTW + method statement",
    industryStarter: "general",
    permitTypes: ["hot_work", "general", "lifting"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Confirm client / principal contractor site rules",
      "Segregate work areas from occupants or public",
      "Plan waste removal and dust control",
    ],
  },
  {
    id: "confined_space",
    label: "Confined space",
    description: "RAMS + confined space PTW + entry method statement",
    industryStarter: "maintenance",
    permitTypes: ["confined_space", "loto"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Review confined space risk assessment and rescue plan",
      "Confirm gas monitor calibration and stand-by person",
      "Brief team on entry/exit and communication procedure",
    ],
  },
  {
    id: "utilities_water",
    label: "Utilities — water & sewer",
    description: "Water/sewer civils RAMS + excavation & confined space PTW",
    industryStarter: "infrastructure",
    permitTypes: ["excavation", "confined_space", "general"],
    msTemplate: "mobilisation",
    ramsStarterKey: "utilities",
    checklistExtras: [
      "Obtain utility records and agree isolation points",
      "Chlorination / pressure test procedure agreed if applicable",
      "Confined space rescue plan for chamber entry",
    ],
  },
  {
    id: "utilities_street",
    label: "Utilities — streetworks (NRSWA)",
    description: "Road opening RAMS + excavation PTW + TM checklist",
    industryStarter: "infrastructure",
    permitTypes: ["excavation", "ground_disturbance", "general"],
    msTemplate: "mobilisation",
    ramsStarterKey: "highways",
    checklistExtras: [
      "NRSWA / streetworks notice submitted",
      "Chapter 8 TM plan approved",
      "CAT/Genny scan before breaking carriageway",
    ],
  },
  {
    id: "demolition",
    label: "Demolition & strip-out",
    description: "Demolition RAMS + hot work & general PTW",
    industryStarter: "maintenance",
    permitTypes: ["hot_work", "general", "lifting"],
    msTemplate: "mobilisation",
    ramsStarterKey: "demolition",
    checklistExtras: [
      "Asbestos / pre-demolition survey reviewed",
      "Services isolated and proven dead",
      "Exclusion zone and dust controls in place",
    ],
  },
  {
    id: "highways",
    label: "Highways & traffic management",
    description: "Streetworks RAMS + ground disturbance PTW",
    industryStarter: "infrastructure",
    permitTypes: ["ground_disturbance", "general", "night_works"],
    msTemplate: "mobilisation",
    ramsStarterKey: "highways",
    checklistExtras: [
      "NHSS12 / TM competence verified",
      "Signing and lighting checked after setup",
      "Live traffic interface briefed to all operatives",
    ],
  },
  {
    id: "interiors_fitout",
    label: "Interiors & fit-out",
    description: "Fit-out RAMS + hot work & general PTW in occupied buildings",
    industryStarter: "general",
    permitTypes: ["hot_work", "general", "work_at_height"],
    msTemplate: "mobilisation",
    ramsStarterKey: "interiors_fitout",
    checklistExtras: [
      "Client / occupier notification and segregation",
      "Dust and noise controls agreed",
      "Out-of-hours working approval if required",
    ],
  },
  {
    id: "food_factory_me",
    label: "Food factory M&E",
    description: "Food factory RAMS + line clearance & hot-work PTW + allergen/G&HP checklist",
    industryStarter: "maintenance",
    permitTypes: ["line_clearance", "hot_work", "loto", "general"],
    msTemplate: "mobilisation",
    ramsStarterKey: "utilities",
    checklistExtras: [
      "Allergen briefing and zone segregation confirmed",
      "G&HP register checked — no unregistered glass/hard plastic in zone",
      "Production line isolation sign-off before mechanical work",
      "COSHH substances on site have SDS in register",
      "Nearest A&E confirmed for site coordinates",
      "CIP / hygiene restart procedure agreed with production",
    ],
  },
  {
    id: "general",
    label: "General site pack",
    description: "Baseline RAMS + common PTW + method statement",
    industryStarter: "general",
    surveyType: "",
    permitTypes: ["hot_work", "excavation", "electrical"],
    msTemplate: "mobilisation",
    checklistExtras: [],
  },
];

export function getPlaybook(playbookId) {
  const fess = isFessOrg() ? getFessPlaybook(playbookId) : null;
  if (fess) return fess;
  return PROJECT_PLAYBOOKS.find((p) => p.id === playbookId) || PROJECT_PLAYBOOKS.find((p) => p.id === "general");
}

function buildRamsRowsFromHazards(hazards) {
  return (hazards || []).map((h) => ({
    id: genId("row"),
    sourceId: h.id,
    category: h.category || "General",
    activity: h.activity || "",
    hazard: h.hazard || "",
    initialRisk: h.initialRisk || { L: 3, S: 3, RF: 9 },
    revisedRisk: h.revisedRisk || { L: 2, S: 3, RF: 6 },
    controlMeasures: h.controlMeasures || [],
    ppeRequired: h.ppeRequired || [],
    regs: h.regs || [],
    rowSource: "hazard_pack",
  }));
}

export function createRamsDraftFromPlaybook(project, playbook) {
  const pack = playbook.ramsSurveyKey ? getPlaybookSurveyPack(playbook.ramsSurveyKey) : null;
  const location = String(project.address || project.site || project.name || "").trim();
  const base = {
    id: genId("rams"),
    title: `RAMS — ${project.name || "Site"}`,
    location,
    projectId: project.id,
    projectName: project.name || "",
    siteAddress: location,
    date: today(),
    issueDate: today(),
    revision: "1A",
    documentNo: generateRamsDocNo(),
    documentStatus: "draft",
    status: "draft",
    rows: [],
    surveyWorkType: playbook.surveyType || "",
    surveyWorkTypeLabel: pack?.label || "",
    surveyDeliverables: pack?.scope || "",
    surveyMethodStatement: pack?.method || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (playbook.fessJobStarterKey && isFessOrg()) {
    const patch = buildFessJobStarterFormPatch(playbook.fessJobStarterKey, project);
    const hazards = resolveFessStarterHazards(
      playbook.fessJobStarterKey,
      ALL,
      project.fessSiteTemplateId || ""
    );
    const siteTmpl = project.fessSiteTemplateId
      ? FESS_CLIENT_SITE_TEMPLATES.find((t) => t.id === project.fessSiteTemplateId)
      : null;
    return {
      ...base,
      ...patch,
      title: patch?.title || base.title,
      location: patch?.location || base.location,
      documentNo: patch?.jobRef || base.documentNo,
      permitControllerName: siteTmpl?.permitControllerContact || siteTmpl?.permitControllerHint || "",
      rows: buildRamsRowsFromHazards(hazards),
    };
  }

  return base;
}

export function createSurveyDraftFromPlaybook(project, playbook, existingReports = [], ramsDoc = null) {
  const ref = nextSurveyRef(existingReports);
  let base = blankSurveyReport({
    ref,
    title: playbook.surveyType
      ? `${getPlaybook(playbook.id).label} — ${project.name || ref}`
      : `Survey report — ${project.name || ref}`,
    projectId: project.id,
    surveyType: playbook.surveyType || "",
    pas128Ql: playbook.pas128Ql || "",
  });
  if (playbook.surveyType) {
    base.deliverables = buildDefaultDeliverables(playbook.surveyType);
    base.equipmentCalibration = buildDefaultEquipmentCalibration(playbook.surveyType);
  }
  let draft = prefillReportFromProject(base, project, ramsDoc);
  if (playbook.surveyType) {
    draft = applyDefaultRecordsPreset(draft);
    const meta = getSurveyPackMeta(playbook.surveyType);
    if (meta.defaultPas128Method && !draft.pas128Method) {
      draft = applyPas128MethodToReport(draft, meta.defaultPas128Method, { overwrite: false });
    }
  }
  draft.playbookId = playbook.id;
  draft.createdAt = new Date().toISOString();
  draft.updatedAt = draft.createdAt;
  return draft;
}

export function createGprDraftFromPlaybook(project, playbook, existingGpr = [], ramsDoc = null) {
  const ref = nextGprRef(existingGpr);
  let base = blankGprReport({
    ref,
    title: `GPR report — ${project.name || ref}`,
    projectId: project.id,
  });
  base = prefillGprFromProject(base, project);
  if (playbook.surveyType === "utility_mapping_survey" || playbook.gprPlaybook) {
    base.equipment = [
      {
        ...base.equipment[0],
        presetKey: "gssi_sir4000_400",
        manufacturer: "GSSI",
        model: "SIR 4000",
        antennaFrequencyMhz: 400,
      },
    ];
  }
  base.playbookId = playbook.id;
  base.createdAt = new Date().toISOString();
  base.updatedAt = base.createdAt;
  if (ramsDoc?.id) base.linkedSurveyReportId = "";
  return base;
}

export function createPermitDraftFromPlaybook(project, permitType, ramsDoc = null, { allPermits = [], surveys = [] } = {}) {
  const partial = buildPermitDraftFromProject(project, permitType, { allPermits, surveys });
  const type = partial.type || permitType || "general";
  const template = getTemplateForType(type, PERMIT_TYPES);
  const checklistStrings = checklistStringsForType(type);
  const checklistItems = createDefaultChecklistItems(type, checklistStrings);
  const location = String(project.address || project.site || project.name || "").trim();
  return {
    id: genId("ptw"),
    type,
    projectId: String(project.id || ""),
    location,
    description: `Draft ${PERMIT_TYPES[type]?.label || type} — ${project.name || "site"}`,
    status: "draft",
    linkedRamsId: ramsDoc?.id || "",
    issuedTo: "",
    issuedBy: "",
    startDateTime: new Date().toISOString(),
    endDateTime: new Date(Date.now() + 8 * 3600000).toISOString(),
    checklistItems,
    checklist: normalizeChecklistState({}, checklistItems),
    templateVersion: 1,
    matrixVersion: "uk-v2",
    templateId: template.templateId || `permit.${type}.default`,
    legalContentOwner: "HSE / Legal Reviewer",
    workflow: { state: "draft", history: [] },
    signatures: [],
    extraFields: { dynamic: {} },
    createdAt: new Date().toISOString(),
    notes: `(Created by project playbook)${ramsDoc?.jobRef ? ` · Job ref: ${ramsDoc.jobRef}` : ""}`,
  };
}

export function createMethodStatementFromPlaybook(project, playbook, ramsDoc = null) {
  const stepsPreset = getMsStepTemplate(playbook.msTemplate || "mobilisation");
  let steps = stepsPreset.map((desc, i) => ({
    id: genId("msstep"),
    seq: i + 1,
    title: desc.split(" ").slice(0, 5).join(" ") + "…",
    description: desc,
    responsible: "",
    duration: "",
  }));
  if (playbook.fessJobStarterKey && isFessOrg() && ramsDoc) {
    const fromRams = buildMsStepsFromRams(ramsDoc, () => genId("msstep"));
    if (fromRams.length) steps = fromRams;
  }
  const location = String(project.address || project.site || project.name || "").trim();
  const fessScope =
    playbook.fessJobStarterKey && isFessOrg()
      ? buildFessJobStarterFormPatch(playbook.fessJobStarterKey, project)?.scope
      : "";
  const siteTmpl =
    project.fessSiteTemplateId && isFessOrg()
      ? FESS_CLIENT_SITE_TEMPLATES.find((t) => t.id === project.fessSiteTemplateId)
      : null;
  const jobRef = ramsDoc?.jobRef || ramsDoc?.documentNo || project.jobRef || "";
  return {
    id: genId("ms"),
    title: `Method statement — ${project.name || "Site"}`,
    location,
    projectId: project.id,
    jobRef,
    client: project.client || project.site || "",
    date: today(),
    revision: "1A",
    scope: fessScope
      || (playbook.surveyType
        ? getPlaybookSurveyPack(playbook.ramsSurveyKey || playbook.surveyType)?.scope || ""
        : `Mobilisation and safe delivery of works at ${project.name || location}.`),
    steps,
    plant: [],
    materials: [],
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis vest"],
    operativeIds: [],
    relatedRamsId: ramsDoc?.id || "",
    permitControllerName: siteTmpl?.permitControllerContact || siteTmpl?.permitControllerHint || ramsDoc?.permitControllerName || "",
    briefingNotes: playbook.fessJobStarterKey
      ? "Operatives briefed on RAMS, method statement, line clearance / LOTO and emergency arrangements before work starts."
      : "",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Action-oriented checklist from missing linked documents. */
export function buildMissingDocChecklist(dash) {
  const items = [];
  const push = (text, actionType) => {
    items.push({
      id: genId("chk"),
      text,
      status: "todo",
      actionType,
    });
  };
  if (!dash?.rams?.length) push("Create RAMS for this site", "create_rams");
  if (isSurveyWorkflowEnabled() && !dash?.surveys?.length) push("Create survey report draft", "create_survey");
  if (isSurveyWorkflowEnabled() && !dash?.gprReports?.length) push("Create GPR report draft", "create_gpr");
  if (!dash?.permits?.length) push("Issue permit to work (PTW)", "create_permit");
  if (!dash?.methodStatements?.length) push("Create method statement", "create_ms");
  if (!dash?.plans?.length) push("Upload site plan / drawing", "upload_plan");
  if (!dash?.cdmPacks?.length) push("Create CDM compliance pack", "create_cdm");
  if (dash?.totals?.briefingToday === false) push("Record today's site briefing", "create_daily_briefing");
  if (isSurveyWorkflowEnabled() && !dash?.geoPhotos?.length) {
    push("Capture mobilisation geo-photos", "capture_geo_photos");
  }
  return items;
}

function mergeChecklist(existing = [], additions = []) {
  const seen = new Set((existing || []).map((x) => String(x.text || "").toLowerCase()));
  const merged = [...(existing || [])];
  for (const item of additions) {
    const key = String(item.text || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, 24);
}

function playbookChecklistItems(playbook) {
  return (playbook.checklistExtras || []).map((text) => ({
    id: genId("chk"),
    text,
    status: "todo",
  }));
}

/**
 * Apply a playbook to a project — creates missing docs only.
 * @returns {{ project, store, created, summary, applied: boolean }}
 */
export function applyProjectPlaybook(project, playbookId, existing = {}) {
  const playbook = getPlaybook(playbookId);
  if (!project?.id) {
    return { project, store: existing, created: {}, summary: [], applied: false };
  }

  const rams = [...(existing.rams || [])];
  const surveys = [...(existing.surveys || [])];
  const gprReports = [...(existing.gprReports || [])];
  const permits = [...(existing.permits || [])];
  const methodStatements = [...(existing.methodStatements || [])];

  const created = { rams: [], surveys: [], gprReports: [], permits: [], methodStatements: [] };
  const summary = [];

  let ramsDoc = docsForProject(project.id, rams)[0];
  if (!ramsDoc) {
    ramsDoc = createRamsDraftFromPlaybook(project, playbook);
    rams.unshift(ramsDoc);
    created.rams.push(ramsDoc);
    summary.push(`RAMS draft: ${ramsDoc.title}`);
  }

  if (playbook.surveyType && !docsForProject(project.id, surveys).length) {
    const survey = createSurveyDraftFromPlaybook(project, playbook, surveys, ramsDoc);
    surveys.unshift(survey);
    created.surveys.push(survey);
    summary.push(`Survey draft: ${survey.ref}`);
  }

  if (playbook.gprPlaybook && !docsForProject(project.id, gprReports).length) {
    const gpr = createGprDraftFromPlaybook(project, playbook, gprReports, ramsDoc);
    gprReports.unshift(gpr);
    created.gprReports.push(gpr);
    summary.push(`GPR draft: ${gpr.ref}`);
  }

  const existingPermitTypes = new Set(docsForProject(project.id, permits).map((p) => p.type));
  for (const permitType of playbook.permitTypes || []) {
    if (existingPermitTypes.has(permitType)) continue;
    const permit = createPermitDraftFromPlaybook(project, permitType, ramsDoc, { allPermits: permits, surveys });
    permits.unshift(permit);
    created.permits.push(permit);
    existingPermitTypes.add(permitType);
    summary.push(`PTW draft: ${PERMIT_TYPES[permitType]?.label || permitType}`);
  }

  if (!docsForProject(project.id, methodStatements).length && playbook.msTemplate) {
    const ms = createMethodStatementFromPlaybook(project, playbook, ramsDoc);
    methodStatements.unshift(ms);
    created.methodStatements.push(ms);
    summary.push(`Method statement: ${ms.title}`);
  }

  const dashLike = {
    rams: docsForProject(project.id, rams),
    surveys: docsForProject(project.id, surveys),
    gprReports: docsForProject(project.id, gprReports),
    permits: docsForProject(project.id, permits),
    methodStatements: docsForProject(project.id, methodStatements),
    plans: existing.plans || [],
  };

  const updatedProject = {
    ...project,
    playbookId: playbook.id,
    playbookAppliedAt: new Date().toISOString(),
    industryStarter: playbook.industryStarter || project.industryStarter,
    permitDefaults: {
      ...(project.permitDefaults || {}),
      requiredPermitTypes: playbook.permitTypes?.length
        ? playbook.permitTypes
        : project.permitDefaults?.requiredPermitTypes,
    },
    startupChecklist: mergeChecklist(project.startupChecklist?.length ? project.startupChecklist : [], [
      ...playbookChecklistItems(playbook),
      ...buildMissingDocChecklist(dashLike),
    ]),
  };

  const applied = summary.length > 0;

  return {
    project: updatedProject,
    store: { rams, surveys, gprReports, permits, methodStatements },
    created,
    summary,
    applied,
  };
}

/** Load org docs, apply playbook, persist new records. */
export function applyAndPersistProjectPlaybook(project, playbookId) {
  const existing = {
    rams: load(PROJECT_DOC_KEYS.rams, []),
    surveys: load(PROJECT_DOC_KEYS.surveys, []),
    gprReports: load(PROJECT_DOC_KEYS.gprReports, []),
    permits: load(PROJECT_DOC_KEYS.permits, []),
    methodStatements: load(PROJECT_DOC_KEYS.methodStatements, []),
    plans: [],
  };
  const result = applyProjectPlaybook(project, playbookId, existing);
  if (result.created.rams.length) save(PROJECT_DOC_KEYS.rams, result.store.rams);
  if (result.created.surveys.length) save(PROJECT_DOC_KEYS.surveys, result.store.surveys);
  if (result.created.gprReports.length) save(PROJECT_DOC_KEYS.gprReports, result.store.gprReports);
  if (result.created.permits.length) save(PROJECT_DOC_KEYS.permits, result.store.permits);
  if (result.created.methodStatements.length) save(PROJECT_DOC_KEYS.methodStatements, result.store.methodStatements);
  return result;
}
