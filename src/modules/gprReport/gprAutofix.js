/**
 * One-click fixes for GPR report blockers (parity with survey autofix).
 */

import { suggestGprLimitationKeys, syncProcessingNarrative } from "./gprReportSmart.js";

export const GPR_AUTOFIX_ACTIONS = [
  { id: "limitations_suggest", label: "Suggest limitations from ground/weather", tab: "narrative", anchor: "limitations" },
  { id: "velocity_default", label: "Set assumed velocity 10 cm/ns", tab: "equipment", anchor: "velocity" },
  { id: "processing_narrative", label: "Sync processing narrative", tab: "narrative", anchor: "processing" },
];

/**
 * @param {string} fixId
 * @param {object} report
 * @returns {object|null}
 */
export function applyGprAutofix(fixId, report) {
  if (!report || !fixId) return null;
  const now = new Date().toISOString();

  if (fixId === "limitations_suggest") {
    const keys = suggestGprLimitationKeys(report);
    if (!keys.length) return null;
    const merged = [...new Set([...(report.limitationKeys || []), ...keys])];
    return { ...report, limitationKeys: merged, updatedAt: now };
  }

  if (fixId === "velocity_default") {
    const vm = report.velocityModel || {};
    if (vm.measuredVelocityCmNs || vm.assumedVelocityCmNs) return null;
    return {
      ...report,
      velocityModel: { ...vm, assumedVelocityCmNs: 10, calibrationNotes: vm.calibrationNotes || "Assumed dry sand/gravel typical — confirm with hyperbola fit if available." },
      updatedAt: now,
    };
  }

  if (fixId === "processing_narrative") {
    if (!(report.processing?.stepsApplied || []).length && !(report.processing?.filters || []).some((f) => f.applied)) {
      return null;
    }
    if (String(report.sections?.dataProcessing || "").trim()) return null;
    return { ...syncProcessingNarrative(report), updatedAt: now };
  }

  return null;
}

/** Suggest autofix buttons based on report state. */
export function suggestGprAutofixes(report) {
  const out = [];
  if (!(report?.limitationKeys || []).length) out.push("limitations_suggest");
  const vm = report?.velocityModel || {};
  if (!vm.measuredVelocityCmNs && !vm.assumedVelocityCmNs) out.push("velocity_default");
  const hasSteps =
    (report?.processing?.stepsApplied || []).length > 0 ||
    (report?.processing?.filters || []).some((f) => f.applied);
  if (hasSteps && !String(report?.sections?.dataProcessing || "").trim()) out.push("processing_narrative");
  return out;
}
