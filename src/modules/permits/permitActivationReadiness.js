/**
 * Activation readiness 0–100 for permit list cards (approved / review states).
 */
export function computePermitActivationReadiness({
  derivedStatus = "",
  activateGate = null,
  checkedCount = 0,
  totalChecks = 0,
} = {}) {
  const derived = String(derivedStatus || "").toLowerCase();
  if (derived === "active") {
    return { score: 100, label: "Live", tone: "ok", show: true };
  }
  if (["closed", "expired", "cancelled"].includes(derived)) {
    return { score: 0, label: "", tone: "muted", show: false };
  }
  if (activateGate?.allowed) {
    return { score: 100, label: "Ready", tone: "ok", show: true };
  }
  const checklistPct = totalChecks > 0 ? (checkedCount / totalChecks) * 35 : 15;
  const penalty = activateGate?.allowed === false ? 25 : 0;
  const score = Math.max(12, Math.min(92, Math.round(45 + checklistPct - penalty)));
  return { score, label: "Gaps", tone: "warn", show: ["approved", "pending_review", "draft"].includes(derived) };
}
