/** Org-scoped localStorage helpers — keys are `${baseKey}_${orgId}` (mysafeops_orgId). */
import { isBillingWriteBlocked, notifyBillingWriteBlocked } from "./billingAccess";
import { orgScopedKey } from "./orgId";
import { getCachedActiveCountryWorkspace } from "./countryWorkspaces";

export { ORG_ID_KEY, ORG_CHANGED_EVENT, getOrgId, setOrgId, orgScopedKey } from "./orgId";

/** Fired after saveOrgScoped — detail.baseKey is the unscoped storage key. */
export const ORG_DATA_CHANGED_EVENT = "mysafeops-org-data-changed";

/** Fired when localStorage quota / private mode blocks a write. */
export const STORAGE_QUOTA_EVENT = "mysafeops-storage-quota";

const ORG_SHARED_STORAGE_KEYS = new Set(["mysafeops_org_settings"]);

/** Coerce localStorage JSON to an array when the caller expects a list register. */
export function asStorageArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

/**
 * Preserve every legacy key for the primary country. Secondary paid countries
 * receive an isolated operational data key, so existing customers migrate with
 * no copy step and UK/PL/AU records cannot bleed into one another.
 */
export function countryOperationalStorageKey(baseKey) {
  const workspace = getCachedActiveCountryWorkspace();
  const base = orgScopedKey(baseKey);
  if (ORG_SHARED_STORAGE_KEYS.has(baseKey) || !workspace?.id || workspace.is_primary) return base;
  return `${base}__country_${workspace.id}`;
}

export function loadOrgScoped(baseKey, fallback) {
  try {
    const raw = localStorage.getItem(countryOperationalStorageKey(baseKey));
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

function isQuotaError(err) {
  if (!err) return false;
  if (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  const code = err.code;
  // Legacy WebKit / IE codes
  return code === 22 || code === 1014;
}

export function notifyStorageQuota(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORAGE_QUOTA_EVENT, { detail }));
}

export function saveOrgScoped(baseKey, value, options = {}) {
  if (!options.bypassBillingGuard && isBillingWriteBlocked()) {
    notifyBillingWriteBlocked({ baseKey });
    return false;
  }
  try {
    localStorage.setItem(countryOperationalStorageKey(baseKey), JSON.stringify(value));
  } catch (err) {
    if (isQuotaError(err)) {
      notifyStorageQuota({ baseKey, error: err?.name || "QuotaExceededError" });
      return false;
    }
    console.warn("saveOrgScoped failed", baseKey, err);
    return false;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ORG_DATA_CHANGED_EVENT, { detail: { baseKey } }));
  }
  return true;
}
