/** Org custom fields — labels/values on PDF and print exports. */

export const CUSTOM_FIELD_PRESETS = [
  { label: "Principal contractor", value: "", hint: "CDM principal contractor name" },
  { label: "Contract number", value: "", hint: "Client or framework reference" },
  { label: "Client contact", value: "", hint: "Named client representative" },
  { label: "Site manager", value: "", hint: "Day-to-day site lead" },
  { label: "Framework / lot", value: "", hint: "Framework ID or lot reference" },
  { label: "Insurance policy ref", value: "", hint: "PL / EL policy number" },
];

/** @param {unknown} raw */
export function normalizeCustomFields(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => ({
      id: f?.id ?? Date.now(),
      label: String(f?.label || "").trim(),
      value: String(f?.value || "").trim(),
      hint: String(f?.hint || "").trim(),
    }))
    .filter((f) => f.label);
}

/** Fields with a value — shown on exports. */
export function customFieldsForExport(raw) {
  return normalizeCustomFields(raw).filter((f) => f.value);
}

/** @param {unknown} raw @param {number} [max] */
export function formatCustomFieldsLine(raw, max = 4) {
  const parts = customFieldsForExport(raw).slice(0, max).map((f) => `${f.label}: ${f.value}`);
  return parts.join(" · ");
}

/** @param {unknown} raw */
export function renderCustomFieldsHtml(raw) {
  const fields = customFieldsForExport(raw);
  if (!fields.length) return "";
  const rows = fields
    .map(
      (f) =>
        `<div style="display:flex;gap:8px;font-size:11px;padding:3px 0;border-bottom:1px solid #f1f5f9"><span style="color:#64748b;min-width:120px">${escapeAttr(f.label)}</span><span style="font-weight:600;color:#0f172a">${escapeAttr(f.value)}</span></div>`
    )
    .join("");
  return `<div class="print-custom-fields" style="margin:10px 0 0;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">${rows}</div>`;
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
