/**
 * Clone RAMS documents between projects — leaf module (no survey/GPR imports).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { PROJECT_DOC_KEYS } from "./projectDocKeys";
import { stampDocumentAuthorship } from "./documentAuthorship";

const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export function buildRamsCloneForProject(ramsDoc, targetProjectId, projects = []) {
  const pid = String(targetProjectId || "").trim();
  const project = projects.find((p) => p.id === pid);
  const { shareToken: _st, contentHash: _ch, id: _oid, rows: srcRows, ...rest } = JSON.parse(JSON.stringify(ramsDoc));
  return stampDocumentAuthorship({
    ...rest,
    id: genId("rams"),
    projectId: pid,
    projectName: project?.name || "",
    title: `${ramsDoc.title || "RAMS"} — ${project?.name || "site"}`,
    documentNo: ramsDoc.documentNo ? `${ramsDoc.documentNo}-CPY` : undefined,
    location: project?.address || project?.site || ramsDoc.location || "",
    rows: JSON.parse(JSON.stringify(srcRows || [])),
    status: "draft",
    documentStatus: "draft",
    revision: "1A",
    revisionSummary: "",
    approvedBy: "",
    approvalDate: "",
    issueDate: "",
    signatureEvents: [],
    operativeSignatures: {},
    clientApproval: null,
    linkedSurveyIds: [],
    surveyAppendices: [],
    signed: false,
    signedAt: null,
    signedBy: "",
    competentReviewAck: false,
    competentReviewAcknowledgedAt: null,
    competentReviewAcknowledgedBy: "",
    deletedAt: undefined,
    versionHistory: [],
    createdBy: undefined,
    createdByEmail: undefined,
    createdById: undefined,
    updatedBy: undefined,
    updatedByEmail: undefined,
    updatedById: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shareToken: undefined,
    contentHash: undefined,
    clonedFromRamsId: ramsDoc.id,
    clonedFromProjectId: ramsDoc.projectId || "",
  }, { isCreate: true });
}

export function duplicateRamsToProject(ramsDoc, targetProjectId, projects = []) {
  if (!ramsDoc?.id) throw new Error("No RAMS document.");
  const pid = String(targetProjectId || "").trim();
  if (!pid) throw new Error("Select a target project.");
  if (!projects.some((p) => p.id === pid)) throw new Error("Target project not found.");

  const newDoc = buildRamsCloneForProject(ramsDoc, pid, projects);
  const list = load(PROJECT_DOC_KEYS.rams, []);
  if (save(PROJECT_DOC_KEYS.rams, [newDoc, ...list]) !== true) throw new Error("The RAMS copy could not be saved on this device. Check storage or workspace access and retry.");
  return newDoc;
}

export function batchDuplicateRamsToProject(docs = [], targetProjectId, projects = []) {
  const pid = String(targetProjectId || "").trim();
  if (!pid) throw new Error("Select a target project.");
  if (!projects.some((p) => p.id === pid)) throw new Error("Target project not found.");
  const sourceDocs = (docs || []).filter((d) => d?.id);
  if (!sourceDocs.length) throw new Error("Select at least one RAMS document.");

  const list = load(PROJECT_DOC_KEYS.rams, []);
  const clones = sourceDocs.map((d) => buildRamsCloneForProject(d, pid, projects));
  if (save(PROJECT_DOC_KEYS.rams, [...clones, ...list]) !== true) throw new Error("The RAMS copies could not be saved on this device. Check storage or workspace access and retry.");
  return clones;
}
