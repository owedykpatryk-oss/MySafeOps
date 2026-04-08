/** Org-scoped localStorage helpers — keys are `${baseKey}_${orgId}` (mysafeops_orgId). */

export function getOrgId() {
  return localStorage.getItem("mysafeops_orgId") || "default";
}

export function orgScopedKey(baseKey) {
  return `${baseKey}_${getOrgId()}`;
}

export function loadOrgScoped(baseKey, fallback) {
  try {
    const raw = localStorage.getItem(orgScopedKey(baseKey));
    if (raw == null || raw === "") {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveOrgScoped(baseKey, value) {
  localStorage.setItem(orgScopedKey(baseKey), JSON.stringify(value));
}
