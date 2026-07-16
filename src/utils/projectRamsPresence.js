import { asStorageArray } from "./orgStorage";

/** True if project has at least one linked RAMS doc (empty projectId = skip gate). */
export function projectHasRams(projectId, ramsDocs = []) {
  if (!projectId) return true;
  return asStorageArray(ramsDocs).some((d) => String(d.projectId || "") === String(projectId));
}

export function docsForProject(projectId, rows = []) {
  if (!projectId) return [];
  return asStorageArray(rows).filter((r) => String(r.projectId || "") === String(projectId));
}
