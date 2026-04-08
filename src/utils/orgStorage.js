/** Org-scoped localStorage helpers — keys are `${baseKey}_${orgId}` (mysafeops_orgId). */
export const ORG_ID_KEY = "mysafeops_orgId";
export const ORG_CHANGED_EVENT = "mysafeops-org-changed";

export function getOrgId() {
  return localStorage.getItem(ORG_ID_KEY) || "default";
}

export function setOrgId(orgId) {
  const next = String(orgId || "").trim() || "default";
  localStorage.setItem(ORG_ID_KEY, next);
  window.dispatchEvent(new CustomEvent(ORG_CHANGED_EVENT, { detail: { orgId: next } }));
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
