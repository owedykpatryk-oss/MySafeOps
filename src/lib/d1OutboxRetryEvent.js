/** @type {string} */
export const D1_OUTBOX_MANUAL_RETRY_EVENT = "mysafeops:d1-outbox-manual-retry";

/**
 * Ask every mounted `useD1OrgArraySync` to try flushing its IndexedDB outbox (no-op if empty).
 * Safe to call from UI (e.g. D1ModuleSyncBanner).
 */
export function requestD1OutboxManualRetry() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(D1_OUTBOX_MANUAL_RETRY_EVENT));
}
