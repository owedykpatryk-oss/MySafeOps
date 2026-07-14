/**
 * Merge org-scoped arrays from local cache and D1 without dropping newer local rows.
 * @param {Array<{ id?: string, updatedAt?: string, createdAt?: string }>} local
 * @param {Array<{ id?: string, updatedAt?: string, createdAt?: string }>} server
 */
export function mergeOrgArrays(local = [], server = []) {
  const localArr = Array.isArray(local) ? local : [];
  const serverArr = Array.isArray(server) ? server : [];
  const stamp = (row) => {
    const t = Date.parse(String(row?.updatedAt || row?.createdAt || ""));
    return Number.isFinite(t) ? t : 0;
  };

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
    if (stamp(row) >= stamp(prev)) byId.set(row.id, row);
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
    return stamp(b) - stamp(a);
  });

  return merged;
}
