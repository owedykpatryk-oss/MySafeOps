const ALLOWED_ACTIONS = new Set(["required", "optional", "show", "hide", "block"]);
const ALLOWED_WHEN_FIELDS = new Set(["permitType", "status", "projectId"]);
const ALLOWED_WHEN_OPERATORS = new Set(["and", "or"]);
const genRuleId = () => `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function normalizeText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function normalizeFieldId(value) {
  return normalizeText(value, 64);
}

function normalizeCondition(raw = {}) {
  return {
    permitType: normalizeText(raw.permitType, 64).toLowerCase(),
    status: normalizeText(raw.status, 64).toLowerCase(),
    projectId: normalizeText(raw.projectId, 80),
  };
}

function normalizeClause(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const field = ALLOWED_WHEN_FIELDS.has(String(src.field || "")) ? String(src.field) : "permitType";
  const value = field === "projectId" ? normalizeText(src.value, 80) : normalizeText(src.value, 64).toLowerCase();
  return { field, value };
}

function normalizeRule(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const action = normalizeText(src.action || "required", 24).toLowerCase();
  const normalizedAction = ALLOWED_ACTIONS.has(action) ? action : "required";
  const legacy = normalizeCondition(src.when || {});
  const explicitClauses = Array.isArray(src.whenClauses) ? src.whenClauses.map(normalizeClause).filter((c) => c.value) : [];
  const legacyClauses = [
    legacy.permitType ? { field: "permitType", value: legacy.permitType } : null,
    legacy.status ? { field: "status", value: legacy.status } : null,
    legacy.projectId ? { field: "projectId", value: legacy.projectId } : null,
  ].filter(Boolean);
  const whenClauses = (explicitClauses.length > 0 ? explicitClauses : legacyClauses).slice(0, 12);
  const whenOperator = ALLOWED_WHEN_OPERATORS.has(String(src.whenOperator || "").toLowerCase())
    ? String(src.whenOperator || "").toLowerCase()
    : "and";
  return {
    id: normalizeText(src.id, 80) || genRuleId(),
    enabled: src.enabled !== false,
    when: normalizeCondition(src.when || {}),
    whenOperator,
    whenClauses,
    thenField: normalizeFieldId(src.thenField || src.fieldId || ""),
    action: normalizedAction,
    message: normalizeText(src.message, 220),
  };
}

export function normalizePermitConditionalRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => normalizeRule(row))
    .filter((row) => row.thenField);
}

function matchesCondition(condition, context = {}) {
  if (!condition) return true;
  const permitTypeMatch = !condition.permitType || condition.permitType === String(context.permitType || "").toLowerCase();
  const statusMatch = !condition.status || condition.status === String(context.status || "").toLowerCase();
  const projectMatch = !condition.projectId || condition.projectId === String(context.projectId || "");
  return permitTypeMatch && statusMatch && projectMatch;
}

function matchesClause(clause, context = {}) {
  if (!clause || !clause.field) return true;
  const expected = String(clause.value || "");
  if (!expected) return true;
  if (clause.field === "projectId") return expected === String(context.projectId || "");
  if (clause.field === "status") return expected === String(context.status || "").toLowerCase();
  if (clause.field === "permitType") return expected === String(context.permitType || "").toLowerCase();
  return true;
}

export function evaluatePermitConditionalRules(context, rules) {
  const normalized = normalizePermitConditionalRules(rules);
  const required = {};
  const visible = {};
  const blockers = [];
  const matchedRules = [];
  normalized.forEach((rule) => {
    if (!rule.enabled) return;
    const clauses = Array.isArray(rule.whenClauses) ? rule.whenClauses.filter((c) => c?.value) : [];
    const matchesViaClauses =
      clauses.length === 0
        ? matchesCondition(rule.when, context)
        : rule.whenOperator === "or"
          ? clauses.some((clause) => matchesClause(clause, context))
          : clauses.every((clause) => matchesClause(clause, context));
    if (!matchesViaClauses) return;
    matchedRules.push(rule);
    if (rule.action === "required") required[rule.thenField] = true;
    if (rule.action === "optional") required[rule.thenField] = false;
    if (rule.action === "show") visible[rule.thenField] = true;
    if (rule.action === "hide") visible[rule.thenField] = false;
    if (rule.action === "block") {
      blockers.push({
        id: rule.id,
        fieldId: rule.thenField,
        message: rule.message || "This project rule blocks issuing until condition is resolved.",
      });
    }
  });
  return { required, visible, blockers, matchedRules };
}

