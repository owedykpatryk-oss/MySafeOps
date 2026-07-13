/**
 * Cross-module document propagation — survey summaries into RAMS, project cloning.
 */

import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { PROJECT_DOC_KEYS } from "./projectDashboard";
import { pickRamsForProject } from "../modules/surveyReport/surveyReportSmart";
import { mergeRamsWithSurveyReport } from "../modules/surveyReport/surveyRamsSync";
import { surveyTypeLabel } from "../modules/surveyReport/surveyReportHelpers";
import { getSurveyPackMeta } from "./surveyContentCatalog";

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

  const stamp = new Date().toISOString().slice(0, 10);
  const marker = `--- Survey appendix (${stamp}: ${report.ref || report.id}) ---`;
  let handoverNotes = String(ramsDoc.handoverNotes || "").trim();
  const refToken = report.ref || report.id;
  const sectionRe = new RegExp(`--- Survey appendix \\([^)]*${refToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^)]*\\) ---[\\s\\S]*?(?=\\n--- Survey appendix|$)`, "i");
  if (sectionRe.test(handoverNotes)) {
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
  const linked = (ramsDocs || []).find((d) => d.id === report?.linkedRamsId);
  if (linked) return linked;
  return pickRamsForProject(ramsDocs, report?.projectId);
}

/** Push survey pack metadata onto linked (or project) RAMS. */
export function persistRamsSyncFromSurvey(report, ramsDocs) {
  const rams = resolveRamsForSurvey(report, ramsDocs);
  if (!rams) throw new Error("No RAMS on this project — create or link RAMS first.");
  if (!report?.surveyType) throw new Error("Select a survey type before pushing to RAMS.");
  const next = mergeRamsWithSurveyReport(rams, report);
  const list = load(PROJECT_DOC_KEYS.rams, []);
  const idx = list.findIndex((d) => d.id === next.id);
  const updated = idx >= 0 ? list.map((d, i) => (i === idx ? next : d)) : [next, ...list];
  save(PROJECT_DOC_KEYS.rams, updated);
  return next;
}

/** Persist survey appendix onto linked (or project) RAMS. */
export function persistSurveyAppendixToRams(report, ramsDocs) {
  const rams = resolveRamsForSurvey(report, ramsDocs);
  if (!rams) throw new Error("No RAMS on this project — create or link RAMS first.");
  const { rams: next, appended } = appendSurveySummaryToRams(rams, report);
  if (!appended) throw new Error("Could not append survey summary.");
  const list = load(PROJECT_DOC_KEYS.rams, []);
  const idx = list.findIndex((d) => d.id === next.id);
  const updated = idx >= 0 ? list.map((d, i) => (i === idx ? next : d)) : [next, ...list];
  save(PROJECT_DOC_KEYS.rams, updated);
  return next;
}

/** Batch append final surveys that have a RAMS target. */
export function batchAppendFinalSurveysToRams(reports = [], ramsDocs = []) {
  const finals = (reports || []).filter((r) => r.status === "final");
  let ramsList = [...(ramsDocs || [])];
  const results = [];

  for (const report of finals) {
    try {
      const rams = resolveRamsForSurvey(report, ramsList);
      if (!rams) {
        results.push({ reportId: report.id, ok: false, reason: "no_rams" });
        continue;
      }
      const { rams: next } = appendSurveySummaryToRams(rams, report);
      ramsList = ramsList.some((d) => d.id === next.id)
        ? ramsList.map((d) => (d.id === next.id ? next : d))
        : [next, ...ramsList];
      results.push({ reportId: report.id, ok: true, ramsId: next.id });
    } catch (e) {
      results.push({ reportId: report.id, ok: false, reason: e?.message || "failed" });
    }
  }

  if (results.some((r) => r.ok)) save(PROJECT_DOC_KEYS.rams, ramsList);
  return { results, ramsList };
}

export function duplicateRamsToProject(ramsDoc, targetProjectId, projects = []) {
  if (!ramsDoc?.id) throw new Error("No RAMS document.");
  const pid = String(targetProjectId || "").trim();
  if (!pid) throw new Error("Select a target project.");
  if (!projects.some((p) => p.id === pid)) throw new Error("Target project not found.");

  const newDoc = buildRamsCloneForProject(ramsDoc, pid, projects);

  const list = load(PROJECT_DOC_KEYS.rams, []);
  save(PROJECT_DOC_KEYS.rams, [newDoc, ...list]);
  return newDoc;
}

function buildRamsCloneForProject(ramsDoc, targetProjectId, projects = []) {
  const pid = String(targetProjectId || "").trim();
  const project = projects.find((p) => p.id === pid);
  const { shareToken: _st, contentHash: _ch, id: _oid, rows: srcRows, ...rest } = ramsDoc;
  return {
    ...rest,
    id: genId("rams"),
    projectId: pid,
    title: `${ramsDoc.title || "RAMS"} — ${project?.name || "site"}`,
    documentNo: ramsDoc.documentNo ? `${ramsDoc.documentNo}-CPY` : undefined,
    location: project?.address || project?.site || ramsDoc.location || "",
    rows: JSON.parse(JSON.stringify(srcRows || [])),
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shareToken: undefined,
    contentHash: undefined,
    clonedFromRamsId: ramsDoc.id,
    clonedFromProjectId: ramsDoc.projectId || "",
  };
}

export function batchDuplicateRamsToProject(docs = [], targetProjectId, projects = []) {
  const pid = String(targetProjectId || "").trim();
  if (!pid) throw new Error("Select a target project.");
  if (!projects.some((p) => p.id === pid)) throw new Error("Target project not found.");
  const sourceDocs = (docs || []).filter((d) => d?.id);
  if (!sourceDocs.length) throw new Error("Select at least one RAMS document.");

  const list = load(PROJECT_DOC_KEYS.rams, []);
  const clones = sourceDocs.map((d) => buildRamsCloneForProject(d, pid, projects));
  save(PROJECT_DOC_KEYS.rams, [...clones, ...list]);
  return clones;
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

  if (includeRams) {
    const rams = load(PROJECT_DOC_KEYS.rams, []);
    const clones = rams
      .filter((d) => d.projectId === src)
      .map((d) => {
        const { id: _id, ...rest } = d;
        return {
          ...rest,
          id: genId("rams"),
          projectId: dst,
          title: `${d.title || "RAMS"} (copy)`,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clonedFromProjectId: src,
        };
      });
    if (clones.length) {
      save(PROJECT_DOC_KEYS.rams, [...clones, ...rams]);
      summary.rams = clones.length;
    }
  }

  if (includeSurveys) {
    const surveys = load(PROJECT_DOC_KEYS.surveys, []);
    const clones = surveys
      .filter((d) => d.projectId === src)
      .map((d) => {
        const { id: _id, ref: _ref, ...rest } = d;
        return {
          ...rest,
          id: genId("survey"),
          projectId: dst,
          ref: `${d.ref || "SR"}-CPY`,
          title: `${d.title || "Survey"} (copy)`,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clonedFromProjectId: src,
        };
      });
    if (clones.length) {
      save(PROJECT_DOC_KEYS.surveys, [...clones, ...surveys]);
      summary.surveys = clones.length;
    }
  }

  if (includePermits) {
    const permits = load(PROJECT_DOC_KEYS.permits, []);
    const clones = permits
      .filter((d) => d.projectId === src)
      .map((d) => {
        const { id: _id, ...rest } = d;
        return {
          ...rest,
          id: genId("ptw"),
          projectId: dst,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clonedFromProjectId: src,
        };
      });
    if (clones.length) {
      save(PROJECT_DOC_KEYS.permits, [...clones, ...permits]);
      summary.permits = clones.length;
    }
  }

  if (includeMethodStatements) {
    const ms = load(PROJECT_DOC_KEYS.methodStatements, []);
    const clones = ms
      .filter((d) => d.projectId === src)
      .map((d) => {
        const { id: _id, ...rest } = d;
        return {
          ...rest,
          id: genId("ms"),
          projectId: dst,
          title: `${d.title || "Method"} (copy)`,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clonedFromProjectId: src,
        };
      });
    if (clones.length) {
      save(PROJECT_DOC_KEYS.methodStatements, [...clones, ...ms]);
      summary.methodStatements = clones.length;
    }
  }

  if (includeGeoPhotos) {
    const photos = load(PROJECT_DOC_KEYS.geoPhotos, []);
    const clones = photos
      .filter((p) => p.projectId === src)
      .map((p) => {
        const { id: _id, ...rest } = p;
        return {
          ...rest,
          id: genId("geo"),
          projectId: dst,
          clonedFromProjectId: src,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    if (clones.length) {
      save(PROJECT_DOC_KEYS.geoPhotos, [...clones, ...photos]);
      summary.geoPhotos = clones.length;
    }
  }

  return summary;
}
