/** Export / import org PTW configuration bundle (JSON). */

export const PTW_CONFIG_BUNDLE_VERSION = 1;

export function buildPermitStudioConfigBundle({
  fieldOverrides = {},
  formDefaults = {},
  conflictMatrixOverrides = {},
  permitTypeOverrides = {},
  workflowPolicyOverrides = {},
  workflowRolePolicyOverrides = {},
  dependencyRuleOverrides = {},
  conditionalRuleOverrides = [],
  shiftBoundaryHours = [],
} = {}) {
  return {
    version: PTW_CONFIG_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    fieldOverrides,
    formDefaults,
    conflictMatrixOverrides,
    permitTypeOverrides,
    workflowPolicyOverrides,
    workflowRolePolicyOverrides,
    dependencyRuleOverrides,
    conditionalRuleOverrides,
    shiftBoundaryHours,
  };
}

export function parsePermitStudioConfigBundle(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Config bundle must be a JSON object.");
  }
  if (Number(data.version) > PTW_CONFIG_BUNDLE_VERSION) {
    throw new Error("Config bundle version is newer than this app supports.");
  }
  return {
    fieldOverrides: data.fieldOverrides || {},
    formDefaults: data.formDefaults || {},
    conflictMatrixOverrides: data.conflictMatrixOverrides || {},
    permitTypeOverrides: data.permitTypeOverrides || {},
    workflowPolicyOverrides: data.workflowPolicyOverrides || {},
    workflowRolePolicyOverrides: data.workflowRolePolicyOverrides || {},
    dependencyRuleOverrides: data.dependencyRuleOverrides || {},
    conditionalRuleOverrides: Array.isArray(data.conditionalRuleOverrides) ? data.conditionalRuleOverrides : [],
    shiftBoundaryHours: Array.isArray(data.shiftBoundaryHours) ? data.shiftBoundaryHours : [],
  };
}

export function downloadPermitStudioConfigBundle(bundle, filename = "ptw-config-bundle.json") {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
