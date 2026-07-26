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
