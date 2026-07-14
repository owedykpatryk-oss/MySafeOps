import { labelWorkflowState } from "./permitWorkflowLabels";

export const PERMIT_RULE_ACTION_LABELS = {
  required: "Require field",
  optional: "Make optional",
  show: "Show field",
  hide: "Hide field",
  block: "Block issue",
};

const FIELD_LABEL_FALLBACK = {
  permitType: "Permit type",
  status: "Status",
  projectId: "Project",
};

export function labelRuleAction(action) {
  const key = String(action || "").trim().toLowerCase();
  return PERMIT_RULE_ACTION_LABELS[key] || key;
}

export function formatConditionalClause(clause, catalogs = {}) {
  const field = String(clause?.field || "permitType");
  const value = String(clause?.value || "").trim();
  const fieldLabel = FIELD_LABEL_FALLBACK[field] || field;

  if (!value) return `Any ${fieldLabel.toLowerCase()}`;

  if (field === "permitType") {
    const types = catalogs.permitTypes || {};
    return `${fieldLabel} is ${types[value]?.label || value}`;
  }
  if (field === "status") {
    return `${fieldLabel} is ${labelWorkflowState(value)}`;
  }
  if (field === "projectId") {
    const projects = catalogs.projects || [];
    const match = projects.find((p) => String(p.id) === value);
    return `${fieldLabel} is ${match?.name || value}`;
  }
  return `${fieldLabel} is ${value}`;
}

export function summarizeConditionalRule(rule, catalogs = {}) {
  if (!rule) return "Empty rule";

  const clauses = Array.isArray(rule.whenClauses) ? rule.whenClauses.filter((c) => c?.value) : [];
  const joiner = rule.whenOperator === "or" ? " OR " : " AND ";
  const whenPart =
    clauses.length > 0
      ? clauses.map((c) => formatConditionalClause(c, catalogs)).join(joiner)
      : "Always (no IF clauses)";

  const fieldCatalog = catalogs.fieldCatalog || [];
  const fieldMatch = fieldCatalog.find((f) => f.id === rule.thenField);
  const fieldLabel = fieldMatch?.label || rule.thenField || "field";
  const actionLabel = labelRuleAction(rule.action);

  return `IF ${whenPart} → ${actionLabel}: ${fieldLabel}`;
}
