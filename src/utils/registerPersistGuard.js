import { saveOrgScoped } from "./orgStorage";
import { OPS_TOAST_EVENT_NAME } from "./clientOpsMonitor";

/**
 * @param {Record<string, unknown>} form
 * @param {string[]} requiredKeys - keys that must be non-empty strings (after trim)
 * @param {Record<string, string>} [labels]
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateRequiredFields(form, requiredKeys, labels = {}) {
  for (const key of requiredKeys) {
    const v = form?.[key];
    if (v == null || String(v).trim() === "") {
      const label = labels[key] || key;
      return { ok: false, message: `${label} is required.` };
    }
  }
  return { ok: true };
}

/** Keep the editor open unless the complete update is durable on this device. */
export function persistRegisterRows(storageKey, rows) {
  if (saveOrgScoped(storageKey, rows)) return true;
  window.dispatchEvent(new CustomEvent(OPS_TOAST_EVENT_NAME, { detail: {
    type: "warn",
    message: "Could not save this record. Your changes are still in the form. Check device storage or workspace access, then retry.",
  } }));
  return false;
}
