/**
 * Project-level permit defaults — required types vs issued permits.
 */

import { asStorageArray } from "../../utils/orgStorage";

export function requiredPermitTypesForProject(project) {
  const fromProject = project?.permitDefaults?.requiredPermitTypes;
  if (Array.isArray(fromProject) && fromProject.length) {
    return fromProject.map((t) => String(t || "").trim()).filter(Boolean);
  }
  return [];
}

export function permitsForProject(projectId, permits = []) {
  if (!projectId) return [];
  return asStorageArray(permits).filter((p) => String(p.projectId || "") === String(projectId));
}

export function issuedPermitTypesForProject(projectId, permits = []) {
  const types = new Set();
  for (const p of permitsForProject(projectId, permits)) {
    if (p.status === "draft" && !p.location && !p.description) continue;
    const t = String(p.type || "").trim();
    if (t) types.add(t);
  }
  return types;
}

export function missingRequiredPermits(project, permits = []) {
  const required = requiredPermitTypesForProject(project);
  if (!required.length || !project?.id) return [];
  const issued = issuedPermitTypesForProject(project.id, permits);
  return required.filter((t) => !issued.has(t));
}

export function permitReadinessForProject(project, permits = []) {
  const required = requiredPermitTypesForProject(project);
  if (!required.length) return { required: 0, issued: 0, missing: [], complete: true };
  const missing = missingRequiredPermits(project, permits);
  return {
    required: required.length,
    issued: required.length - missing.length,
    missing,
    complete: missing.length === 0,
  };
}

export function buildPermitDraftFromProject(project, permitType, { allPermits = [] } = {}) {
  const type =
    permitType ||
    missingRequiredPermits(project, allPermits)[0] ||
    requiredPermitTypesForProject(project)[0] ||
    "hot_work";
  const location = String(project?.location || project?.site || project?.address || "").trim();
  return {
    type,
    projectId: String(project?.id || ""),
    location,
    status: "draft",
  };
}
