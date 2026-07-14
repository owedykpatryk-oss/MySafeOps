/**
 * Actionable activation/review gaps for permit cards — plain labels, max 5.
 */
export function buildPermitActivationGaps({
  derivedStatus = "",
  approveGate = null,
  activateGate = null,
  checkedCount = 0,
  totalChecks = 0,
  briefingPending = false,
  ramsMissing = false,
  handoverState = null,
} = {}) {
  const gaps = [];
  const derived = String(derivedStatus || "").toLowerCase();

  const push = (gap) => {
    if (!gap?.id || gaps.some((g) => g.id === gap.id)) return;
    gaps.push({ done: false, ...gap });
  };

  if (derived === "pending_review" && approveGate && !approveGate.allowed) {
    if (approveGate.code === "issuer_signature") {
      push({ id: "issuer_sign", label: "Issuer signature" });
    } else if (approveGate.code === "project_rams_required") {
      push({ id: "project_rams", label: "Project RAMS" });
    } else {
      push({ id: "approve_block", label: "Review blocker" });
    }
  }

  if (activateGate && !activateGate.allowed) {
    switch (activateGate.code) {
      case "project_rams_required":
        push({ id: "project_rams", label: "Project RAMS" });
        break;
      case "signatures":
        push({
          id: "signatures",
          label:
            Array.isArray(activateGate.unsignedRoles) && activateGate.unsignedRoles.length
              ? `Signatures (${activateGate.unsignedRoles.length})`
              : "Signatures",
        });
        break;
      case "compliance":
        push({ id: "compliance", label: "Compliance checks" });
        break;
      case "handover_required":
        push({ id: "handover", label: "Shift handover" });
        break;
      case "permit_dependency_required":
        push({ id: "dependency", label: "Dependency permit" });
        break;
      case "permit_conflict_block":
        push({ id: "conflict_block", label: "SIMOPS conflict" });
        break;
      case "permit_conflict_warn":
        push({ id: "conflict_warn", label: "Conflict override" });
        break;
      default:
        push({ id: "activate_block", label: "Activation blocker" });
        break;
    }
  }

  if (totalChecks > 0 && checkedCount < totalChecks) {
    push({
      id: "checklist",
      label: `Checklist ${checkedCount}/${totalChecks}`,
      done: false,
    });
  }

  if (briefingPending) {
    push({ id: "briefing", label: "Site briefing" });
  }

  if (ramsMissing) {
    push({ id: "linked_rams", label: "Link RAMS" });
  }

  if (handoverState?.required && handoverState?.missing) {
    push({ id: "handover_live", label: "Handover due" });
  }

  return gaps.slice(0, 5);
}
