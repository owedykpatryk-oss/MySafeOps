function normalizeType(type) {
  return String(type || "general").trim().toLowerCase();
}

export function normalizeConflictPair(typeA, typeB) {
  const a = normalizeType(typeA);
  const b = normalizeType(typeB);
  return [a, b].sort().join("+");
}

export const PERMIT_CONFLICT_MATRIX = {
  [normalizeConflictPair("hot_work", "confined_space")]: {
    outcome: "block",
    reason: "Hot works cannot run concurrently with confined-space entry at the same location.",
  },
  [normalizeConflictPair("hot_work", "line_break")]: {
    outcome: "block",
    reason: "Hot works conflict with line break due to ignition and release risk.",
  },
  [normalizeConflictPair("hot_work", "loto")]: {
    outcome: "warn",
    reason: "Hot works with LOTO needs explicit coordination and supervision.",
  },
  [normalizeConflictPair("lifting", "work_at_height")]: {
    outcome: "warn",
    reason: "Concurrent lifting and work-at-height requires controlled sequencing.",
  },
  [normalizeConflictPair("excavation", "ground_disturbance")]: {
    outcome: "warn",
    reason: "Parallel excavation and ground disturbance needs utility and stability controls.",
  },
};

export function resolvePermitConflictRule(typeA, typeB, matrix = PERMIT_CONFLICT_MATRIX) {
  const key = normalizeConflictPair(typeA, typeB);
  const rule = matrix[key];
  if (!rule) return { key, outcome: "allow", reason: "" };
  return {
    key,
    outcome: String(rule.outcome || "allow").toLowerCase(),
    reason: String(rule.reason || ""),
  };
}

function typeLabel(type, permitTypesMap) {
  const key = normalizeType(type);
  const fromMap = permitTypesMap?.[key]?.label;
  return fromMap ? String(fromMap) : key.replace(/_/g, " ");
}

export function evaluatePermitTypeConflicts(candidate, overlappingPermits = [], options = {}) {
  const matrix = options.matrix || PERMIT_CONFLICT_MATRIX;
  const permitTypesMap = options.permitTypes || {};
  const conflicts = (Array.isArray(overlappingPermits) ? overlappingPermits : []).map((other) => {
    const rule = resolvePermitConflictRule(candidate?.type, other?.type, matrix);
    return {
      permitId: String(other?.id || ""),
      otherType: normalizeType(other?.type),
      otherTypeLabel: typeLabel(other?.type, permitTypesMap),
      outcome: rule.outcome,
      reason: rule.reason,
      pairKey: rule.key,
    };
  });
  const blockingConflicts = conflicts.filter((c) => c.outcome === "block");
  const warningConflicts = conflicts.filter((c) => c.outcome === "warn");
  const topOutcome = blockingConflicts.length > 0 ? "block" : warningConflicts.length > 0 ? "warn" : "allow";
  return {
    outcome: topOutcome,
    conflicts,
    blockingConflicts,
    warningConflicts,
  };
}

export function isWarnConflictOverrideValid(override) {
  if (!override || typeof override !== "object") return false;
  const reason = String(override.reason || "").trim();
  const approvedBy = String(override.approvedBy || "").trim();
  return reason.length >= 8 && approvedBy.length >= 2;
}
