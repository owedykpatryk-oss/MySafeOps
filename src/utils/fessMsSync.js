/**
 * FESS Group — keep method statements in sync with RAMS (org-exclusive).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { isFessOrg } from "./fessOrg";
import { buildMsStepsFromRams } from "./fessMsWorkflow";
import { getMsStepTemplate } from "./msOrgTemplates";

const MS_KEY = "method_statements";
const genStepId = () => `msstep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const genMsId = () => `ms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function defaultFoodFactorySteps(genId) {
  return getMsStepTemplate("foodFactoryMobilisation").map((desc, i) => ({
    id: genId(),
    seq: i + 1,
    title: `${desc.split(" ").slice(0, 5).join(" ")}…`,
    description: desc,
    responsible: "",
    duration: "",
  }));
}

/**
 * Create or update linked MS from RAMS fields (scope, method, job ref).
 * @param {object} ramsDoc
 * @param {{ createIfMissing?: boolean, project?: object }} [options]
 */
export function syncFessMsFromRams(ramsDoc, options = {}) {
  if (!isFessOrg() || !ramsDoc?.projectId) {
    return { ok: false, reason: "not_fess", ms: null, created: false };
  }

  const list = Array.isArray(load(MS_KEY, [])) ? [...load(MS_KEY, [])] : [];
  let ms =
    list.find((m) => m.relatedRamsId === ramsDoc.id) ||
    list.find((m) => m.projectId === ramsDoc.projectId && !m.relatedRamsId) ||
    null;

  if (!ms && options.createIfMissing === false) {
    return { ok: false, reason: "no_ms", ms: null, created: false };
  }

  const fromRams = buildMsStepsFromRams(ramsDoc, genStepId);
  const steps = fromRams.length ? fromRams : defaultFoodFactorySteps(genStepId);
  const now = new Date().toISOString();
  const project = options.project || null;
  const location = String(
    ramsDoc.location || project?.address || project?.site || project?.name || ""
  ).trim();

  const patch = {
    relatedRamsId: ramsDoc.id,
    projectId: ramsDoc.projectId,
    jobRef: ramsDoc.jobRef || ramsDoc.documentNo || "",
    scope: ramsDoc.scope || "",
    location,
    client: ramsDoc.client || project?.client || "",
    title: ramsDoc.title ? `Method statement — ${ramsDoc.title.replace(/^RAMS\s*[—-]\s*/i, "")}` : "Method statement — FESS job",
    steps,
    permitControllerName: ramsDoc.permitControllerName || "",
    briefingNotes:
      ramsDoc.handoverNotes ||
      "Operatives briefed on RAMS, method statement, line clearance / LOTO and emergency arrangements before work starts.",
    updatedAt: now,
  };

  let created = false;
  if (ms) {
    const idx = list.findIndex((m) => m.id === ms.id);
    list[idx] = { ...ms, ...patch };
    ms = list[idx];
  } else {
    created = true;
    ms = {
      id: genMsId(),
      ...patch,
      revision: "1A",
      date: now.slice(0, 10),
      plant: [],
      materials: [],
      ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis vest"],
      operativeIds: [],
      status: "draft",
      createdAt: now,
    };
    list.unshift(ms);
  }

  save(MS_KEY, list);
  return { ok: true, ms, created };
}

/**
 * @param {string} ramsId
 */
export function findMsLinkedToRams(ramsId) {
  if (!isFessOrg() || !ramsId) return null;
  const list = load(MS_KEY, []);
  return (Array.isArray(list) ? list : []).find((m) => m.relatedRamsId === ramsId) || null;
}
