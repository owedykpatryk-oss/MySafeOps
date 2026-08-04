/**
 * Merge org-scoped arrays from local cache and D1 without dropping newer local rows.
 * Soft-deletes use `deletedAt` tombstones so deletions survive multi-device sync.
 */

/** @param {{ id?: string, updatedAt?: string, createdAt?: string, deletedAt?: string }} row */
export function rowStamp(row) {
  const t = Date.parse(String(row?.deletedAt || row?.updatedAt || row?.createdAt || ""));
  return Number.isFinite(t) ? t : 0;
}

/** @param {{ deletedAt?: string } | null | undefined} row */
export function isTombstone(row) {
  return Boolean(row?.deletedAt);
}

/** Live rows only (hide soft-deleted tombstones from UI / exports). */
export function liveOrgArrayRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row?.id && !row.deletedAt);
}

/**
 * Replace a live row with a deletion tombstone (keeps id in the synced array).
 * @param {Array<{ id?: string }>} list
 * @param {string} id
 */
export function replaceWithTombstone(list, id, at = new Date().toISOString()) {
  const arr = Array.isArray(list) ? list : [];
  const rest = arr.filter((row) => row?.id !== id);
  return [...rest, { id, deletedAt: at, updatedAt: at }];
}

/**
 * @param {Array<{ id?: string, updatedAt?: string, createdAt?: string, deletedAt?: string }>} local
 * @param {Array<{ id?: string, updatedAt?: string, createdAt?: string, deletedAt?: string }>} server
 */
export function mergeOrgArrays(local = [], server = []) {
  const localArr = Array.isArray(local) ? local : [];
  const serverArr = Array.isArray(server) ? server : [];

  const byId = new Map();
  for (const row of serverArr) {
    if (row && row.id) byId.set(row.id, row);
  }
  for (const row of localArr) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev) {
      byId.set(row.id, row);
      continue;
    }
    if (rowStamp(row) >= rowStamp(prev)) byId.set(row.id, row);
  }

  const merged = [...byId.values()];
  const orderIndex = new Map();
  localArr.forEach((row, idx) => {
    if (row?.id) orderIndex.set(row.id, idx);
  });
  serverArr.forEach((row, idx) => {
    if (row?.id && !orderIndex.has(row.id)) orderIndex.set(row.id, localArr.length + idx);
  });

  merged.sort((a, b) => {
    const ai = orderIndex.get(a.id) ?? 0;
    const bi = orderIndex.get(b.id) ?? 0;
    if (ai !== bi) return ai - bi;
    return rowStamp(b) - rowStamp(a);
  });

  return merged;
}
