function cleanType(v) {
  return String(v || "").trim().toLowerCase();
}

function cleanText(v) {
  return String(v || "").trim();
}

export const DEFAULT_PERMIT_DEPENDENCY_RULES = {
  confined_space: [{ requiresActiveType: "loto", reason: "Confined space entry requires active LOTOTO isolation permit." }],
};

export function normalizeDependencyRules(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([candidateType, rows]) => {
    const key = cleanType(candidateType);
    if (!key || !Array.isArray(rows)) return;
    const normalized = rows
      .map((row) => ({
        requiresActiveType: cleanType(row?.requiresActiveType),
        reason: cleanText(row?.reason),
      }))
      .filter((row) => row.requiresActiveType);
    if (normalized.length > 0) out[key] = normalized;
  });
  return out;
}

export function mergeDependencyRules(overrides) {
  return {
    ...DEFAULT_PERMIT_DEPENDENCY_RULES,
    ...normalizeDependencyRules(overrides),
  };
}

export function evaluatePermitDependencies(candidatePermit, allPermits = [], rules = DEFAULT_PERMIT_DEPENDENCY_RULES, options = {}) {
  const candidateType = cleanType(candidatePermit?.type);
  const deps = Array.isArray(rules?.[candidateType]) ? rules[candidateType] : [];
  if (!candidateType || deps.length === 0) return { required: false, missing: [] };
  const now = options.now instanceof Date ? options.now : new Date();
  const ignoreId = String(candidatePermit?.id || "");
  const missing = deps.filter((dep) => {
    return !allPermits.some((p) => {
      if (!p || String(p.id || "") === ignoreId) return false;
      const pType = cleanType(p.type);
      if (pType !== dep.requiresActiveType) return false;
      const status = String(p.status || "").toLowerCase();
      const endIso = p.endDateTime || p.expiryDate || "";
      const endOk = !endIso || new Date(endIso) >= now;
      return status === "active" && endOk;
    });
  });
  return { required: deps.length > 0, missing };
}
