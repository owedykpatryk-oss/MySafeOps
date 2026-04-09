function normLoc(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Active-ish statuses that imply work is planned or ongoing at a location. */
function isSimopsRelevantStatus(status) {
  const s = String(status || "");
  return s === "active" || s === "pending_review" || s === "approved";
}

/**
 * Returns permits that overlap in time with `candidate` at the same normalised location.
 * Ignores drafts, closed permits, and the permit with `ignoreId` (e.g. current edit).
 */
/** Map permit id → overlapping permits at same location/time (for board/list badges). */
export function buildSimopsConflictMap(permits = []) {
  const map = new Map();
  for (const p of permits) {
    const conflicts = findSimopsConflicts(
      { ...p, status: p.status },
      permits,
      { ignoreId: p.id }
    );
    if (conflicts.length) map.set(p.id, conflicts);
  }
  return map;
}

export function findSimopsConflicts(candidate, permits = [], { ignoreId } = {}) {
  const loc = normLoc(candidate?.location);
  if (!loc) return [];
  const start = new Date(candidate?.startDateTime || 0).getTime();
  const end = new Date(candidate?.endDateTime || candidate?.expiryDate || 0).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  return permits.filter((p) => {
    if (ignoreId && p.id === ignoreId) return false;
    if (candidate?.id && p.id === candidate.id) return false;
    if (!isSimopsRelevantStatus(p.status)) return false;
    if (normLoc(p.location) !== loc) return false;
    const ps = new Date(p.startDateTime || 0).getTime();
    const pe = new Date(p.endDateTime || p.expiryDate || 0).getTime();
    if (!Number.isFinite(ps) || !Number.isFinite(pe)) return false;
    return start < pe && end > ps;
  });
}
