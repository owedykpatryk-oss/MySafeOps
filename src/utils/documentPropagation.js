/**
 * Cross-module document propagation — survey summaries into RAMS, project cloning.
 */

import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { PROJECT_DOC_KEYS } from "./projectDocKeys";
import { pickRamsForProject } from "../modules/surveyReport/surveyReportSmart";
import { mergeRamsWithSurveyReport } from "../modules/surveyReport/surveyRamsSync";
import { surveyTypeLabel } from "../modules/surveyReport/surveyReportHelpers";
import { getSurveyPackMeta } from "./surveyContentCatalog";
import { buildRamsCloneForProject } from "./ramsDocumentClone";
import { commitRamsDocument, ramsDocumentStorageScope } from "../modules/rams/ramsDocumentSave";
import { getCachedAuthorshipActor } from "./documentAuthorship";

import { todayLocalISO } from "./localDate";
export { duplicateRamsToProject, batchDuplicateRamsToProject } from "./ramsDocumentClone";

const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export function buildSurveyAppendixText(report) {
  if (!report) return "";
  const lines = [];
  const ref = report.ref || report.id || "Survey";
  const title = report.title || ref;
  lines.push(`${ref} — ${title}`);
  if (report.surveyDate) lines.push(`Survey date: ${report.surveyDate}`);
  if (report.surveyType) lines.push(`Type: ${surveyTypeLabel(report.surveyType)}`);
  if (report.pas128Ql) lines.push(`PAS128 QL: ${report.pas128Ql}`);
  if (report.pas128Method) lines.push(`PAS128 method: ${report.pas128Method}`);
  if (report.status) lines.push(`Status: ${report.status}`);
  const meta = report.surveyType ? getSurveyPackMeta(report.surveyType) : null;
  if (meta?.holdPoints?.length) lines.push(`Hold points: ${meta.holdPoints.join("; ")}`);
  if (report.sections?.executiveSummary?.trim()) {
    lines.push(`Executive summary: ${report.sections.executiveSummary.trim().slice(0, 600)}`);
  }
  if (report.sections?.findings?.trim()) {
    lines.push(`Findings: ${report.sections.findings.trim().slice(0, 900)}`);
  }
  if ((report.utilitiesTable || []).length) {
    lines.push(`Utility schedule: ${report.utilitiesTable.length} recorded line(s).`);
  }
  if (report.sections?.recommendations?.trim()) {
    lines.push(`Recommendations: ${report.sections.recommendations.trim().slice(0, 400)}`);
  }
  return lines.join("\n");
}

/** @returns {{ rams: object, appended: boolean, reason?: string }} */
export function appendSurveySummaryToRams(ramsDoc, report) {
  if (!ramsDoc?.id) return { rams: ramsDoc, appended: false, reason: "No RAMS document" };
  if (!report?.id) return { rams: ramsDoc, appended: false, reason: "No survey report" };

  const appendices = Array.isArray(ramsDoc.surveyAppendices) ? [...ramsDoc.surveyAppendices] : [];
  const existingIdx = appendices.findIndex((a) => a.surveyId === report.id);
  const previousAppendix = appendices[existingIdx];
  const block = buildSurveyAppendixText(report);
  const entry = {
    surveyId: report.id,
    ref: report.ref || "",
    title: report.title || "",
    status: report.status || "",
    appendedAt: new Date().toISOString(),
    summary: block,
  };

  if (existingIdx >= 0) appendices[existingIdx] = entry;
  else appendices.unshift(entry);

  const stamp = todayLocalISO();
  const marker = `--- Survey appendix (${stamp}: ${report.ref || report.id}) ---`;
  let handoverNotes = String(ramsDoc.handoverNotes || "").trim();
  if (previousAppendix?.summary) {
    const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Replace only the text we generated previously, retaining notes added by the user.
    const oldRef = previousAppendix.ref || previousAppendix.surveyId;
    const sectionRe = new RegExp(`(?:^|\\n)--- Survey appendix \\([^\\n]*: ${escape(oldRef)}\\) ---\\n${escape(previousAppendix.summary)}(?=\\n|$)`);
    handoverNotes = handoverNotes.replace(sectionRe, "").trim();
  }
  handoverNotes = handoverNotes ? `${handoverNotes}\n\n${marker}\n${block}` : `${marker}\n${block}`;

  return {
    rams: {
      ...ramsDoc,
      handoverNotes,
      surveyAppendices: appendices,
      linkedSurveyIds: [...new Set([...(ramsDoc.linkedSurveyIds || []), report.id])],
      updatedAt: new Date().toISOString(),
    },
    appended: true,
  };
}

export function resolveRamsForSurvey(report, ramsDocs = []) {
  const live = (ramsDocs || []).filter((doc) => doc?.id && !doc.deletedAt);
  if (report?.linkedRamsId) {
    return live.find((doc) => doc.id === report.linkedRamsId &&
      (!report.projectId || !doc.projectId || doc.projectId === report.projectId)) || null;
  }
  return pickRamsForProject(live, report?.projectId);
}

const PROPAGATION_ERRORS = {
  no_rams: "No matching RAMS on this project — create or link a current RAMS draft first.",
  rams_locked: "This RAMS is approved, issued or signed. Create and link an unsigned draft before applying survey changes.",
  document_changed: "This RAMS changed or was removed. Reload it and review the current version before retrying.",
  workspace_changed: "The workspace changed. Reopen the survey in its original workspace before retrying.",
  storage_failed: "The RAMS changes could not be saved on this device. Check storage or workspace access and retry.",
  invalid_survey: "A current survey report is required before updating RAMS.",
};

function propagationError(code) {
  return Object.assign(new Error(PROPAGATION_ERRORS[code] || "Could not update RAMS."), { code });
}

function hasRamsApprovalEvidence(doc) {
  const locked = ["approved", "issued", "signed", "archived", "superseded"];
  return [doc.status, doc.documentStatus].some((status) => locked.includes(String(status || "").toLowerCase()))
    || Boolean(doc.signed || doc.signedAt || doc.clientApproval?.at || (doc.approvedBy && doc.approvalDate))
    || Object.values(doc.operativeSignatures || {}).some(Boolean)
    || (doc.signatureEvents || []).some((event) => ["approval_signed", "issue_released", "operative_ink_sign"].includes(event?.action));
}

/** Guard each write; localStorage comparison is not an atomic cross-tab transaction. */
function persistSurveyRamsChange(report, ramsDocs, transform, expectedScope = ramsDocumentStorageScope()) {
  if (expectedScope !== ramsDocumentStorageScope()) throw propagationError("workspace_changed");
  if (!report?.id || report.deletedAt) throw propagationError("invalid_survey");
  const rams = resolveRamsForSurvey(report, ramsDocs);
  if (!rams) throw propagationError("no_rams");
  if (hasRamsApprovalEvidence(rams)) throw propagationError("rams_locked");
  const actor = getCachedAuthorshipActor();
  const next = {
    ...transform(rams), contentHash: undefined,
    updatedBy: actor?.name, updatedByEmail: actor?.email, updatedById: actor?.id,
  };
  const committed = commitRamsDocument({ document: next, editingDocument: rams, expectedScope });
  if (!committed.ok) throw propagationError(committed.reason);
  return next;
}

/** Push survey pack metadata onto linked (or project) RAMS. */
export function persistRamsSyncFromSurvey(report, ramsDocs) {
  if (!report?.surveyType) throw new Error("Select a survey type before pushing to RAMS.");
  return persistSurveyRamsChange(report, ramsDocs, (rams) => mergeRamsWithSurveyReport(rams, report));
}

/** Persist survey appendix onto linked (or project) RAMS. */
export function persistSurveyAppendixToRams(report, ramsDocs, expectedScope = ramsDocumentStorageScope()) {
  return persistSurveyRamsChange(report, ramsDocs, (rams) => {
    const { rams: next, appended } = appendSurveySummaryToRams(rams, report);
    if (!appended) throw propagationError("invalid_survey");
    return next;
  }, expectedScope);
}

/** Batch append final surveys that have a RAMS target. */
export function batchAppendFinalSurveysToRams(reports = [], ramsDocs = []) {
  const finals = (reports || []).filter((r) => r.status === "final" && !r.deletedAt);
  const expectedScope = ramsDocumentStorageScope();
  let ramsList = [...(ramsDocs || [])];
  const results = [];

  for (const report of finals) {
    try {
      const next = persistSurveyAppendixToRams(report, ramsList, expectedScope);
      // Advance only our own target snapshot; do not hide concurrent changes to other targets.
      ramsList = ramsList.map((doc) => doc.id === next.id ? next : doc);
      results.push({ reportId: report.id, ok: true, ramsId: next.id });
    } catch (e) {
      results.push({ reportId: report.id, ok: false, reason: e?.code || "failed", message: e?.message || "Could not update RAMS." });
    }
  }

  return { results, ramsList: expectedScope === ramsDocumentStorageScope() ? load(PROJECT_DOC_KEYS.rams, []) : ramsList };
}

export function batchAssignSurveysToProject(reportIds = [], projectId, reports = []) {
  const pid = String(projectId || "").trim();
  if (!pid) throw new Error("Select a project.");
  const idSet = new Set(reportIds);
  return (reports || []).map((r) =>
    idSet.has(r.id) ? { ...r, projectId: pid, updatedAt: new Date().toISOString() } : r
  );
}

export function cloneProjectDocuments(sourceProjectId, targetProjectId, options = {}) {
  const src = String(sourceProjectId || "").trim();
  const dst = String(targetProjectId || "").trim();
  if (!src || !dst || src === dst) throw new Error("Choose distinct source and target projects.");

  const {
    includeRams = true,
    includeSurveys = true,
    includePermits = false,
    includeMethodStatements = true,
    includeGeoPhotos = false,
  } = options;

  const summary = { rams: 0, surveys: 0, permits: 0, methodStatements: 0, geoPhotos: 0 };
  const projects = load("mysafeops_projects", []);
  const targetProject = projects.find((project) => project.id === dst && !project.deletedAt);
  const clonedRamsIds = new Map();
  const savedLabels = { rams: "RAMS", surveys: "surveys", permits: "permits", methodStatements: "method statements", geoPhotos: "geo-photos" };
  const persistClones = (key, clones, existing, label) => {
    if (!clones.length) return false;
    if (save(key, [...clones, ...existing]) !== true) {
      const saved = Object.entries(summary)
        .filter(([, count]) => count > 0)
        .map(([kind, count]) => `${count} ${savedLabels[kind] || kind}`);
      const partial = saved.length ? ` Already saved: ${saved.join(", ")}. Review the target project before retrying to avoid duplicate copies.` : " Check storage or workspace access and retry.";
      const error = new Error(`The ${label} copies could not be saved on this device.${partial}`);
      error.partialSummary = { ...summary };
      throw error;
    }
    return true;
  };

  if (includeRams) {
    const rams = load(PROJECT_DOC_KEYS.rams, []);
    const clones = rams
      .filter((d) => d.projectId === src && !d.deletedAt)
      .map((d) => {
        const clone = { ...buildRamsCloneForProject(d, dst, projects), title: `${d.title || "RAMS"} (copy)` };
        clonedRamsIds.set(d.id, clone.id);
        return clone;
      });
    if (persistClones(PROJECT_DOC_KEYS.rams, clones, rams, "RAMS")) summary.rams = clones.length;
  }

  if (includeSurveys) {
    const surveys = load(PROJECT_DOC_KEYS.surveys, []);
    const clones = surveys
      .filter((d) => d.projectId === src && !d.deletedAt)
      .map((d) => {
        const { id: _id, ref: _ref, ...rest } = d;
        return {
          ...rest,
          id: genId("survey"),
          projectId: dst,
          projectName: targetProject?.name || "",
          linkedRamsId: clonedRamsIds.get(d.linkedRamsId) || "",
          linkedGprReportId: "",
          hseRefs: { ...(d.hseRefs || {}), linkedPermitId: "" },
          ref: `${d.ref || "SR"}-CPY`,
          title: `${d.title || "Survey"} (copy)`,
          status: "draft",
          signed: false,
          signedAt: null,
          signedBy: "",
          signatureEvents: [],
          clientApproval: null,
          signatures: { surveyorName: "", surveyorSignedDate: "", clientName: "", clientAcceptedDate: "" },
          finalisedAt: null,
          parentReportId: "",
          parentRevision: "",
          deletedAt: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clonedFromProjectId: src,
        };
      });
    if (persistClones(PROJECT_DOC_KEYS.surveys, clones, surveys, "survey")) summary.surveys = clones.length;
  }

  if (includePermits) {
    const permits = load(PROJECT_DOC_KEYS.permits, []);
    const clones = permits
      .filter((d) => d.projectId === src && !d.deletedAt)
      .map((d) => {
        const { id: _id, ...rest } = d;
        return {
          ...rest,
          id: genId("ptw"),
          projectId: dst,
          linkedRamsId: clonedRamsIds.get(d.linkedRamsId) || "",
          location: targetProject?.address || targetProject?.site || "",
          status: "draft",
          signatures: [],
          workflow: { state: "draft", history: [] },
          deletedAt: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clonedFromProjectId: src,
        };
      });
    if (persistClones(PROJECT_DOC_KEYS.permits, clones, permits, "permit")) summary.permits = clones.length;
  }

  if (includeMethodStatements) {
    const ms = load(PROJECT_DOC_KEYS.methodStatements, []);
    const clones = ms
      .filter((d) => d.projectId === src && !d.deletedAt)
      .map((d) => {
        const { id: _id, ...rest } = d;
        return {
          ...rest,
          id: genId("ms"),
          projectId: dst,
          relatedRamsId: clonedRamsIds.get(d.relatedRamsId) || "",
          location: targetProject?.address || targetProject?.site || "",
          title: `${d.title || "Method"} (copy)`,
          status: "draft",
          signatures: [],
          operativeSignatures: {},
          approvedBy: "",
          permitControllerSignDate: "",
          revision: "1A",
          deletedAt: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clonedFromProjectId: src,
        };
      });
    if (persistClones(PROJECT_DOC_KEYS.methodStatements, clones, ms, "method statement")) summary.methodStatements = clones.length;
  }

  if (includeGeoPhotos) {
    const photos = load(PROJECT_DOC_KEYS.geoPhotos, []);
    const clones = photos
      .filter((p) => p.projectId === src && !p.deletedAt)
      .map((p) => {
        const { id: _id, ...rest } = p;
        return {
          ...rest,
          id: genId("geo"),
          projectId: dst,
          clonedFromProjectId: src,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: undefined,
        };
      });
    if (persistClones(PROJECT_DOC_KEYS.geoPhotos, clones, photos, "geo-photo")) summary.geoPhotos = clones.length;
  }

  return summary;
}
