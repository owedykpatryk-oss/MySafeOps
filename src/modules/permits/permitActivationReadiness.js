/**
 * Activation readiness 0–100 for permit list cards (approved / review states).
 */
import { buildPermitActivationGaps } from "./permitActivationGaps.js";

export function computePermitActivationReadiness({
  derivedStatus = "",
  activateGate = null,
  approveGate = null,
  checkedCount = 0,
  totalChecks = 0,
  briefingPending = false,
  ramsMissing = false,
  handoverState = null,
} = {}) {
  const derived = String(derivedStatus || "").toLowerCase();
  const gaps = buildPermitActivationGaps({
    derivedStatus: derived,
    approveGate,
    activateGate,
    checkedCount,
    totalChecks,
    briefingPending,
    ramsMissing,
    handoverState,
  });

  if (derived === "active") {
    return { score: 100, label: "Live", tone: "ok", show: true, gaps: gaps.filter((g) => !g.done) };
  }
  if (["closed", "expired", "cancelled"].includes(derived)) {
    return { score: 0, label: "", tone: "muted", show: false, gaps: [] };
  }
  if (activateGate?.allowed) {
    return { score: 100, label: "Ready", tone: "ok", show: true, gaps: [] };
  }
  const checklistPct = totalChecks > 0 ? (checkedCount / totalChecks) * 35 : 15;
  const penalty = activateGate?.allowed === false ? 25 : 0;
  const gapPenalty = Math.min(20, gaps.length * 4);
  const score = Math.max(12, Math.min(92, Math.round(45 + checklistPct - penalty - gapPenalty)));
  return {
    score,
    label: gaps.length ? `${gaps.length} to fix` : "Gaps",
    tone: "warn",
    show: ["approved", "pending_review", "draft"].includes(derived),
    gaps,
  };
}
