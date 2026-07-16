/** Org-scoped localStorage helpers — keys are `${baseKey}_${orgId}` (mysafeops_orgId). */
import { isBillingWriteBlocked, notifyBillingWriteBlocked } from "./billingAccess";
import {
  ORG_ID_KEY,
  ORG_CHANGED_EVENT,
  getOrgId,
  setOrgId,
  orgScopedKey,
} from "./orgId";

export { ORG_ID_KEY, ORG_CHANGED_EVENT, getOrgId, setOrgId, orgScopedKey } from "./orgId";

/** Fired after saveOrgScoped — detail.baseKey is the unscoped storage key. */
export const ORG_DATA_CHANGED_EVENT = "mysafeops-org-data-changed";

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
