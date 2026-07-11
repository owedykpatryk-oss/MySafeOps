/**
 * FESS RAMS completeness score — expected baseline + job hazards before issue.
 */
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { getFessBaselineHazardIds, getFessStarterHazardIds } from "./fessJobStarters";
import { getRiskLevel } from "../modules/rams/ramsRiskLevel.js";

/** @param {object} row */
export function resolveRowHazardId(row) {
  if (!row || typeof row !== "object") return "";
  return String(row.sourceId || row.templateId || row.hazardId || row.id || "").trim();
}

/**
 * @param {object} form
 * @param {object[]} rows
 * @param {{ siteTemplateId?: string, library?: object[] }} [options]
 */
export function computeFessRamsCompleteness(form, rows, options = {}) {
  if (!canUseFessExclusiveFeatures()) return null;

  const safeForm = form && typeof form === "object" ? form : {};
  const rowList = Array.isArray(rows) ? rows : [];
  const siteTemplateId = String(options.siteTemplateId || safeForm.fessSiteTemplateId || "").trim();
  const starterKey = String(safeForm.fessJobStarterKey || "").trim();

  const expectedIds = starterKey
    ? getFessStarterHazardIds(starterKey, siteTemplateId)
    : getFessBaselineHazardIds(siteTemplateId);

  const presentIds = new Set(rowList.map(resolveRowHazardId).filter(Boolean));
  const missingIds = expectedIds.filter((id) => !presentIds.has(id));

  const library = Array.isArray(options.library) ? options.library : [];
  const libById = new Map(library.map((h) => [h.id, h]));
  const missing = missingIds.map((id) => ({
    id,
    activity: libById.get(id)?.activity || id,
    hazard: libById.get(id)?.hazard || "Missing from RAMS",
  }));

  const hazardScore = expectedIds.length
    ? Math.round(((expectedIds.length - missingIds.length) / expectedIds.length) * 100)
    : rowList.length > 0
      ? 100
      : 0;

  const issues = [];
  if (!String(safeForm.title || "").trim()) issues.push("Title missing");
  if (!String(safeForm.scope || "").trim()) issues.push("Scope missing");
  if (!String(safeForm.surveyMethodStatement || "").trim()) issues.push("Method statement missing");
  if (!String(safeForm.jobRef || "").trim()) issues.push("Job reference missing");
  if (!String(safeForm.client || "").trim()) issues.push("Client missing");
  if (!String(safeForm.location || "").trim()) issues.push("Location missing");
  if (rowList.length < 10) issues.push(`Only ${rowList.length} hazard rows (expect ≥10 for food factory jobs)`);
  if (missingIds.length > 0) issues.push(`${missingIds.length} expected hazard row(s) not added`);

  const highResidual = rowList.filter((r) => getRiskLevel(r.revisedRisk || {}) === "high").length;
  if (highResidual > 0) issues.push(`${highResidual} residual HIGH risk row(s) — review before issue`);

  const fieldChecks = 6;
  const fieldPass =
    (safeForm.title ? 1 : 0) +
    (safeForm.scope ? 1 : 0) +
    (safeForm.surveyMethodStatement ? 1 : 0) +
    (safeForm.jobRef ? 1 : 0) +
    (safeForm.client ? 1 : 0) +
    (safeForm.location ? 1 : 0);
  const fieldScore = Math.round((fieldPass / fieldChecks) * 100);
  const score = Math.round(hazardScore * 0.7 + fieldScore * 0.3);

  return {
    score,
    hazardScore,
    fieldScore,
    expectedCount: expectedIds.length,
    presentCount: expectedIds.length - missingIds.length,
    rowCount: rowList.length,
    missingIds,
    missing,
    issues,
    starterKey,
    siteTemplateId,
    ready: score >= 85 && missingIds.length === 0 && highResidual === 0,
    band:
      score >= 85 && missingIds.length === 0
        ? "ready"
        : score >= 60
          ? "review"
          : "incomplete",
  };
}

/**
 * @param {ReturnType<typeof computeFessRamsCompleteness>} result
 */
export function fessCompletenessBandStyle(result) {
  if (!result) return { bg: "#f1f5f9", color: "#64748b", label: "—" };
  if (result.band === "ready") return { bg: "#d1fae5", color: "#065f46", label: "Ready to issue" };
  if (result.band === "review") return { bg: "#fef3c7", color: "#92400e", label: "Review before issue" };
  return { bg: "#fee2e2", color: "#991b1b", label: "Incomplete" };
}
