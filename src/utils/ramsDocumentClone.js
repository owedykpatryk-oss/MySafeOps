/**
 * Clone RAMS documents between projects — leaf module (no survey/GPR imports).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { PROJECT_DOC_KEYS } from "./projectDocKeys";

const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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
