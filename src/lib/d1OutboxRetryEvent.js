import { clearBillingWritePause } from "./d1BillingPause.js";
import { getOrgId } from "../utils/orgId.js";
import { getCachedActiveCountryWorkspace } from "../utils/countryWorkspaces.js";
/** @type {string} */
export const D1_OUTBOX_MANUAL_RETRY_EVENT = "mysafeops:d1-outbox-manual-retry";

/**
 * Ask every mounted `useD1OrgArraySync` to try flushing its IndexedDB outbox (no-op if empty).
 * Safe to call from UI (e.g. D1ModuleSyncBanner).
 */
export function requestD1OutboxManualRetry() {
  if (typeof window === "undefined") return;
  const org = getOrgId(),
    workspace = getCachedActiveCountryWorkspace(org);
  clearBillingWritePause(org, workspace?.id && !workspace.is_primary ? `country:${workspace.id}:main` : "main");
  window.dispatchEvent(new Event(D1_OUTBOX_MANUAL_RETRY_EVENT));
}
