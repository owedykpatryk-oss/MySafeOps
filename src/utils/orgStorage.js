/** Org-scoped localStorage helpers — keys are `${baseKey}_${orgId}` (mysafeops_orgId). */
import { isBillingWriteBlocked, notifyBillingWriteBlocked } from "./billingAccess";

export const ORG_ID_KEY = "mysafeops_orgId";
export const ORG_CHANGED_EVENT = "mysafeops-org-changed";
/** Fired after saveOrgScoped — detail.baseKey is the unscoped storage key. */
export const ORG_DATA_CHANGED_EVENT = "mysafeops-org-data-changed";

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

/** Coerce localStorage JSON to an array when the caller expects a list register. */
export function asStorageArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

export function loadOrgScoped(baseKey, fallback) {
  try {
    const raw = localStorage.getItem(orgScopedKey(baseKey));
    if (raw == null || raw === "") {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return asStorageArray(parsed, fallback);
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveOrgScoped(baseKey, value, options = {}) {
  if (!options.bypassBillingGuard && isBillingWriteBlocked()) {
    notifyBillingWriteBlocked({ baseKey });
    return false;
  }
  localStorage.setItem(orgScopedKey(baseKey), JSON.stringify(value));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ORG_DATA_CHANGED_EVENT, { detail: { baseKey } }));
  }
  return true;
}
