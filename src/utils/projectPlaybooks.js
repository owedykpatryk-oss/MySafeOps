/**
 * Project playbooks — one-click recipes for RAMS, survey, PTW, MS and checklists.
 * No AI: deterministic JSON recipes applied on project create or from project hub.
 */

import { PROJECT_DOC_KEYS } from "./projectDashboard";
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { blankSurveyReport } from "../modules/surveyReport/surveyReportConstants";
import {
  prefillReportFromProject,
  applyDefaultRecordsPreset,
  buildDefaultEquipmentCalibration,
  buildDefaultDeliverables,
} from "../modules/surveyReport/surveyReportSmart";
import { nextSurveyRef } from "../modules/surveyReport/surveyReportHelpers";
import { buildPermitDraftFromProject } from "../modules/permits/permitProjectDefaults";
import { checklistStringsForType } from "../modules/permits/permitTypes";
import {
  createDefaultChecklistItems,
  normalizeChecklistState,
} from "../modules/permits/permitChecklistUtils";
import { getTemplateForType } from "../modules/permits/permitTemplateCatalog";
import { PERMIT_TYPES } from "../modules/permits/permitTypes";
import { getMsStepTemplate } from "./msOrgTemplates";

const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function generateRamsDocNo() {
  const year = new Date().getFullYear();
  const tail = String(Math.floor(Math.random() * 9000) + 1000);
  return `RAMS-${year}-${tail}`;
}

const today = () => new Date().toISOString().slice(0, 10);

const SURVEY_PACK = {
  utility_mapping_survey: {
    label: "PAS128 utility mapping survey",
    scope:
      "PAS128 QLB utility mapping survey to locate and record underground utility apparatus, reduce strike risk, and issue marked outputs for safe delivery.",
    method:
      "1. Pre-start briefing and permit checks before entering survey area.\n\n2. Confirm utility records, walkover hazards, and exclusion zones.\n\n3. Detect utilities using EML and GPR methods with competent operators.\n\n4. Mark detected services and maintain safe dig rules near marked lines.\n\n5. Record survey control and quality checks before issue.\n\n6. Communicate residual risk and handover notes to site management.",
  },
  topographical_survey: {
    label: "Topographical land survey",
    scope: "Topographical survey to capture levels, boundaries, structures and site features with agreed survey control and QA checks.",
    method:
      "1. Set control points and verify datum/benchmark before data capture.\n\n2. Establish safe working routes around plant movement and public interfaces.\n\n3. Capture topo features with calibrated survey equipment.\n\n4. Perform repeat checks and closure checks to validate accuracy.\n\n5. Securely store field data and produce checked outputs for issue.",
  },
};

/** @type {Array<{ id: string, label: string, description: string, industryStarter?: string, surveyType?: string, pas128Ql?: string, permitTypes: string[], msTemplate?: string, ramsSurveyKey?: string, checklistExtras?: string[] }>} */
export const PROJECT_PLAYBOOKS = [
  {
    id: "utility_mapping",
    label: "Utility mapping (PAS128)",
    description: "RAMS + PAS128 survey draft + excavation PTW + mobilisation MS",
    industryStarter: "infrastructure",
    surveyType: "utility_mapping_survey",
    pas128Ql: "QLB",
    ramsSurveyKey: "utility_mapping_survey",
    permitTypes: ["excavation", "general"],
    msTemplate: "mobilisation",
    checklistExtras: [
      "Confirm utility records received and reviewed",
      "Plan trial holes and safe dig zones",
      "Brief team on PAS128 quality level and deliverables",
    ],
  },
  {
    id: "groundworks",
    label: "Groundworks / civils",
    description: "General civils RAMS + topo survey + excavation & lifting PTW",
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
    id: "general",
    label: "General site pack",
    description: "Baseline RAMS + optional survey + common permit flow",
    industryStarter: "general",
    surveyType: "",
    permitTypes: ["hot_work", "excavation", "electrical"],
    msTemplate: "mobilisation",
    checklistExtras: [],
  },
];

export function getPlaybook(playbookId) {
  return PROJECT_PLAYBOOKS.find((p) => p.id === playbookId) || PROJECT_PLAYBOOKS.find((p) => p.id === "general");
}

export function projectHasRams(projectId, ramsDocs = []) {
  if (!projectId) return true;
  return (ramsDocs || []).some((d) => String(d.projectId || "") === String(projectId));
}

export function docsForProject(projectId, rows = []) {
  if (!projectId) return [];
  return (rows || []).filter((r) => String(r.projectId || "") === String(projectId));
}

export function createRamsDraftFromPlaybook(project, playbook) {
  const pack = playbook.ramsSurveyKey ? SURVEY_PACK[playbook.ramsSurveyKey] : null;
  const location = String(project.address || project.site || project.name || "").trim();
  return {
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
  if (playbook.surveyType) draft = applyDefaultRecordsPreset(draft);
  draft.playbookId = playbook.id;
  draft.createdAt = new Date().toISOString();
  draft.updatedAt = draft.createdAt;
  return draft;
}

export function createPermitDraftFromPlaybook(project, permitType, ramsDoc = null, { allPermits = [] } = {}) {
  const partial = buildPermitDraftFromProject(project, permitType, { allPermits });
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
    notes: `(Created by project playbook)`,
  };
}

export function createMethodStatementFromPlaybook(project, playbook, ramsDoc = null) {
  const stepsPreset = getMsStepTemplate(playbook.msTemplate || "mobilisation");
  const steps = stepsPreset.map((desc, i) => ({
    id: genId("msstep"),
    seq: i + 1,
    title: desc.split(" ").slice(0, 5).join(" ") + "…",
    description: desc,
    responsible: "",
    duration: "",
  }));
  const location = String(project.address || project.site || project.name || "").trim();
  return {
    id: genId("ms"),
    title: `Method statement — ${project.name || "Site"}`,
    location,
    projectId: project.id,
    jobRef: project.jobRef || "",
    client: project.client || project.site || "",
    date: today(),
    revision: "1A",
    scope: playbook.surveyType
      ? SURVEY_PACK[playbook.ramsSurveyKey || playbook.surveyType]?.scope || ""
      : `Mobilisation and safe delivery of works at ${project.name || location}.`,
    steps,
    plant: [],
    materials: [],
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis vest"],
    operativeIds: [],
    relatedRamsId: ramsDoc?.id || "",
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
  if (!dash?.surveys?.length) push("Create survey report draft", "create_survey");
  if (!dash?.permits?.length) push("Issue permit to work (PTW)", "create_permit");
  if (!dash?.methodStatements?.length) push("Create method statement", "create_ms");
  if (!dash?.plans?.length) push("Upload site plan / drawing", "upload_plan");
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
  const permits = [...(existing.permits || [])];
  const methodStatements = [...(existing.methodStatements || [])];

  const created = { rams: [], surveys: [], permits: [], methodStatements: [] };
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

  const existingPermitTypes = new Set(docsForProject(project.id, permits).map((p) => p.type));
  for (const permitType of playbook.permitTypes || []) {
    if (existingPermitTypes.has(permitType)) continue;
    const permit = createPermitDraftFromPlaybook(project, permitType, ramsDoc, { allPermits: permits });
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
    startupChecklist: mergeChecklist(
      project.startupChecklist?.length ? project.startupChecklist : [],
      [...playbookChecklistItems(playbook), ...buildMissingDocChecklist(dashLike)]
    ),
  };

  const applied = summary.length > 0;

  return {
    project: updatedProject,
    store: { rams, surveys, permits, methodStatements },
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
    permits: load(PROJECT_DOC_KEYS.permits, []),
    methodStatements: load(PROJECT_DOC_KEYS.methodStatements, []),
    plans: [],
  };
  const result = applyProjectPlaybook(project, playbookId, existing);
  if (result.created.rams.length) save(PROJECT_DOC_KEYS.rams, result.store.rams);
  if (result.created.surveys.length) save(PROJECT_DOC_KEYS.surveys, result.store.surveys);
  if (result.created.permits.length) save(PROJECT_DOC_KEYS.permits, result.store.permits);
  if (result.created.methodStatements.length) save(PROJECT_DOC_KEYS.methodStatements, result.store.methodStatements);
  return result;
}
