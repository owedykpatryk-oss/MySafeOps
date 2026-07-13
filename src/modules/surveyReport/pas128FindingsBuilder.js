/**
 * Auto-draft findings narrative from structured tables — generic PAS 128 prose.
 */

import { UNDERTAKER_RESPONSE_STATUS } from "./surveyReportConstants";
import { utilityTypeLabel, utilityConfidenceLabel } from "./surveyReportHelpers";

function statusLabel(key) {
  return UNDERTAKER_RESPONSE_STATUS.find((o) => o.key === key)?.label || key || "—";
}

function formatUtilityRow(r) {
  const parts = [];
  if (r.depth?.trim()) parts.push(`depth ${r.depth.trim()}`);
  if (r.method?.trim()) parts.push(`detected via ${r.method.trim()}`);
  if (r.pas128Ql?.trim()) parts.push(`QL ${r.pas128Ql.trim()}`);
  if (r.confidence?.trim()) parts.push(`${utilityConfidenceLabel(r.confidence) || r.confidence} confidence`);
  const detail = parts.length ? ` (${parts.join("; ")})` : "";
  const note = r.notes?.trim() ? `. ${r.notes.trim()}` : "";
  return `One utility feature logged${detail}${note}`;
}

/** Group utility schedule into findings paragraphs by utility type. */
export function buildFindingsFromUtilitiesTable(report) {
  const rows = report?.utilitiesTable || [];
  if (!rows.length) return "";

  const byType = new Map();
  rows.forEach((r) => {
    const label = utilityTypeLabel(r.utilityType) || r.label || r.utilityType || "Other / unknown";
    if (!byType.has(label)) byType.set(label, []);
    byType.get(label).push(r);
  });

  const blocks = [];
  byType.forEach((items, typeLabel) => {
    if (items.length === 1) {
      blocks.push(`${typeLabel}\n${formatUtilityRow(items[0])}`);
    } else {
      const lines = items.map((r, i) => {
        const parts = [];
        if (r.depth?.trim()) parts.push(`depth ${r.depth.trim()}`);
        if (r.pas128Ql?.trim()) parts.push(`QL ${r.pas128Ql.trim()}`);
        const detail = parts.length ? ` — ${parts.join(", ")}` : "";
        const note = r.notes?.trim() ? `. ${r.notes.trim()}` : "";
        return `• Feature ${i + 1}${detail}${note}`;
      });
      blocks.push(`${typeLabel}\n${items.length} features recorded in the utility schedule:\n${lines.join("\n")}`);
    }
  });

  return blocks.join("\n\n");
}

/** M1 desktop — draft from undertaker response table. */
export function buildFindingsFromUndertakerResponses(report) {
  const rows = report?.undertakerResponses || [];
  if (!rows.length) return "";

  const summary = { affected: 0, not_affected: 0, no_response: 0 };
  rows.forEach((r) => {
    if (summary[r.status] != null) summary[r.status] += 1;
  });

  const lines = [
    "Desktop utility records search — undertaker responses:",
    `Affected: ${summary.affected} · Not affected: ${summary.not_affected} · No response: ${summary.no_response}`,
    "",
  ];

  rows.forEach((r) => {
    const name = r.undertaker?.trim() || "Undertaker";
    lines.push(`• ${name}: ${statusLabel(r.status)}${r.notes?.trim() ? `. ${r.notes.trim()}` : ""}`);
  });

  lines.push(
    "",
    "Positional information from desktop records alone is not guaranteed. Onsite detection and verification are required before breaking ground."
  );

  return lines.join("\n");
}

/** Best-effort findings draft from tables already on the report. */
export function buildFindingsDraft(report, { overwrite = false } = {}) {
  const existing = String(report?.sections?.findings || "").trim();
  if (existing && !overwrite) return existing;

  const parts = [];
  if (report?.pas128Method === "M1" || (report?.undertakerResponses || []).length) {
    const desktop = buildFindingsFromUndertakerResponses(report);
    if (desktop) parts.push(desktop);
  }
  const utilities = buildFindingsFromUtilitiesTable(report);
  if (utilities) parts.push(utilities);

  return parts.join("\n\n").trim();
}
