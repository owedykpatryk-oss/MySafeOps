/**
 * Central guards — FESS-exclusive features must never run for other orgs.
 */
import { getOrgId, loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { loadOrgSettingsRaw, saveOrgSettingsRaw } from "./orgSettingsStorage";
import { isFessOrg } from "./fessOrg";
import { FESS_GROUP_PACK_ID } from "./fessWorkspaceProfile";
import { filterQuickPacksForOrg } from "../modules/rams/orgExclusiveQuickPacks";
import { saveRamsHazardPacks, RAMS_HAZARD_PACKS_KEY } from "./ramsHazardPacksStorage";

/** RAMS fields written only for FESS tenants. */
export const FESS_RAMS_FIELD_KEYS = [
  "fessJobStarterKey",
  "fessJobStarterLabel",
  "permitControllerName",
  "permitControllerSignDate",
];

/** MS fields written only for FESS tenants. */
export const FESS_MS_FIELD_KEYS = ["permitControllerName", "permitControllerSignDate", "briefingNotes"];

/** Project fields seeded for FESS client sites. */
export const FESS_PROJECT_FIELD_KEYS = ["fessSiteTemplateId", "fessSuggestedJobStarterKey"];

/** Client portal fields for FESS site presets. */
export const FESS_PORTAL_FIELD_KEYS = ["fessSiteTemplateId", "fessPortalPreset"];

/**
 * @param {string} [orgId]
 * @param {Record<string, unknown>} [settings]
 */
export function canUseFessExclusiveFeatures(orgId, settings) {
  return isFessOrg(orgId, settings);
}

/**
 * @param {string} playbookId
 */
export function isFessExclusivePlaybookId(playbookId) {
  const id = String(playbookId || "").trim();
  return id.startsWith("fess_");
}

/**
 * @param {object[]} playbooks
 * @param {string} [orgId]
 */
export function filterFessExclusivePlaybooks(playbooks, orgId) {
  if (isFessOrg(orgId)) return Array.isArray(playbooks) ? playbooks : [];
  return (Array.isArray(playbooks) ? playbooks : []).filter(
    (p) => !p?.orgExclusive && !isFessExclusivePlaybookId(p?.id)
  );
}

/**
 * @param {object} doc
 */
export function stripFessRamsFields(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const next = { ...doc };
  for (const key of FESS_RAMS_FIELD_KEYS) delete next[key];
  return next;
}

/**
 * @param {object} doc
 */
export function stripFessMsFields(doc) {
  if (!doc || typeof doc !== "object") return doc;
  const next = { ...doc };
  for (const key of FESS_MS_FIELD_KEYS) delete next[key];
  return next;
}

/**
 * @param {object} project
 */
export function stripFessProjectFields(project) {
  if (!project || typeof project !== "object") return project;
  const next = { ...project };
  for (const key of FESS_PROJECT_FIELD_KEYS) delete next[key];
  if (isFessExclusivePlaybookId(next.playbookId)) next.playbookId = "general";
  return next;
}

/**
 * @param {object} portal
 */
export function stripFessPortalFields(portal) {
  if (!portal || typeof portal !== "object") return portal;
  const next = { ...portal };
  for (const key of FESS_PORTAL_FIELD_KEYS) delete next[key];
  return next;
}

/**
 * @param {object} doc
 * @param {string} [orgId]
 */
export function sanitizeRamsDocForOrg(doc, orgId) {
  if (isFessOrg(orgId)) return doc;
  return stripFessRamsFields(doc);
}

/**
 * @param {object} doc
 * @param {string} [orgId]
 */
export function sanitizeMsDocForOrg(doc, orgId) {
  if (isFessOrg(orgId)) return doc;
  return stripFessMsFields(doc);
}

/**
 * @param {object} project
 * @param {string} [orgId]
 */
export function sanitizeProjectForOrg(project, orgId) {
  if (isFessOrg(orgId)) return project;
  return stripFessProjectFields(project);
}

const FESS_STORAGE_KEYS = {
  projects: "mysafeops_projects",
  rams: "rams_builder_docs",
  methodStatements: "method_statements",
  portals: "client_portals",
  briefings: "daily_briefings",
};

/**
 * Remove FESS-exclusive fields and packs from the active org storage when tenant is not FESS.
 * Call on org switch and app boot for defence in depth.
 * @param {string} [orgId]
 * @returns {{ scrubbed: boolean, changes: string[] }}
 */
export function scrubFessExclusiveOrgStorage(orgId = getOrgId()) {
  if (isFessOrg(orgId)) return { scrubbed: false, changes: [] };

  const changes = [];

  const raw = loadOrgSettingsRaw();
  if (raw.industryPackId === FESS_GROUP_PACK_ID) {
    saveOrgSettingsRaw({ ...raw, industryPackId: "generalContractor" });
    changes.push("industryPackId");
  }

  const projects = load(FESS_STORAGE_KEYS.projects, []);
  if (Array.isArray(projects) && projects.length) {
    const next = projects.map((p) => sanitizeProjectForOrg(p, orgId));
    if (JSON.stringify(next) !== JSON.stringify(projects)) {
      save(FESS_STORAGE_KEYS.projects, next);
      changes.push("projects");
    }
  }

  const rams = load(FESS_STORAGE_KEYS.rams, []);
  if (Array.isArray(rams) && rams.length) {
    const next = rams.map((d) => sanitizeRamsDocForOrg(d, orgId));
    if (JSON.stringify(next) !== JSON.stringify(rams)) {
      save(FESS_STORAGE_KEYS.rams, next);
      changes.push("rams");
    }
  }

  const ms = load(FESS_STORAGE_KEYS.methodStatements, []);
  if (Array.isArray(ms) && ms.length) {
    const next = ms.map((d) => sanitizeMsDocForOrg(d, orgId));
    if (JSON.stringify(next) !== JSON.stringify(ms)) {
      save(FESS_STORAGE_KEYS.methodStatements, next);
      changes.push("methodStatements");
    }
  }

  const packs = load(RAMS_HAZARD_PACKS_KEY, []);
  const filteredPacks = filterQuickPacksForOrg(packs, orgId);
  if (JSON.stringify(filteredPacks) !== JSON.stringify(packs)) {
    saveRamsHazardPacks(filteredPacks);
    changes.push("hazardPacks");
  }

  const portals = load(FESS_STORAGE_KEYS.portals, []);
  if (Array.isArray(portals) && portals.length) {
    const nextPortals = portals
      .filter((p) => !p?.fessPortalPreset && !p?.fessSiteTemplateId)
      .map((p) => stripFessPortalFields(p));
    if (JSON.stringify(nextPortals) !== JSON.stringify(portals)) {
      save(FESS_STORAGE_KEYS.portals, nextPortals);
      changes.push("portals");
    }
  }

  const briefings = load(FESS_STORAGE_KEYS.briefings, []);
  if (Array.isArray(briefings) && briefings.length) {
    const nextBriefings = briefings.filter((b) => !b?.fessBriefingPreset && !b?.fessSiteTemplateId);
    if (nextBriefings.length !== briefings.length) {
      save(FESS_STORAGE_KEYS.briefings, nextBriefings);
      changes.push("briefings");
    }
  }

  return { scrubbed: changes.length > 0, changes };
}

/** Hide FESS Excel hazard ids from RAMS library search for non-FESS tenants. */
export function filterHazardLibraryForOrg(library, orgId = getOrgId()) {
  const list = Array.isArray(library) ? library : [];
  if (isFessOrg(orgId)) return list;
  return list.filter((h) => !String(h?.id || "").startsWith("fess_"));
}
