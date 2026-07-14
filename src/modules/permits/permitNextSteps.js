/**
 * Role-aware "what to do next" steps for the PTW module header.
 */
export function isPermitStudioConfigured({
  fieldOverrides = {},
  workflowOverrides = {},
  conflictOverrides = {},
  conditionalRules = {},
} = {}) {
  const fieldCount = Object.values(fieldOverrides || {}).reduce(
    (n, block) => n + Object.keys(block || {}).length,
    0
  );
  return (
    fieldCount > 0
    || Object.keys(workflowOverrides || {}).length > 0
    || Object.keys(conflictOverrides || {}).length > 0
    || (Array.isArray(conditionalRules) ? conditionalRules.length > 0 : Object.keys(conditionalRules || {}).length > 0)
  );
}

export function buildPermitNextSteps({
  supervisorMode = false,
  isAdmin = false,
  guideComplete = true,
  studioConfigured = false,
  commandCounts = {},
  totalPermits = 0,
} = {}) {
  const steps = [];
  const cc = commandCounts || {};

  if (!guideComplete) {
    steps.push({
      id: "guide",
      title: "Take the 2-minute PTW tour",
      detail: "See Quick issue, approvals, and TV wall for your role.",
      action: "guide",
      tone: "accent",
    });
  }

  if (totalPermits === 0) {
    steps.push({
      id: "first_permit",
      title: "Issue your first permit",
      detail: supervisorMode
        ? "Open Quick issue and raise a permit for work starting today."
        : "Start with Quick issue — pick hot work or general, then submit for review.",
      action: "issue",
      tone: "accent",
    });
  }

  if (supervisorMode) {
    if (cc.review > 0) {
      steps.push({
        id: "review_queue",
        title: `${cc.review} permit${cc.review === 1 ? "" : "s"} awaiting approval`,
        detail: "Open the list, check scope and signatures, then approve.",
        action: "filter_review",
        tone: "warn",
      });
    }
    if (cc.approved > 0) {
      steps.push({
        id: "activate_queue",
        title: `${cc.approved} approved — ready to activate`,
        detail: "Activate before work starts on site.",
        action: "filter_approved",
        tone: "ok",
      });
    }
    if (cc.handoverDue > 0) {
      steps.push({
        id: "handover",
        title: `${cc.handoverDue} handover${cc.handoverDue === 1 ? "" : "s"} due`,
        detail: "Record outgoing and incoming supervisor acknowledgement.",
        action: "filter_handover",
        tone: "warn",
      });
    }
    if (cc.expired > 0) {
      steps.push({
        id: "expired",
        title: `${cc.expired} expired permit${cc.expired === 1 ? "" : "s"}`,
        detail: "Close or revalidate before new work starts.",
        action: "filter_expired",
        tone: "critical",
      });
    }
  } else if (isAdmin) {
    if (!studioConfigured) {
      steps.push({
        id: "studio",
        title: "Configure PTW for your site",
        detail: "Set permit types, workflow, and conflict rules in Configuration studio.",
        action: "studio",
        tone: "accent",
      });
    }
    if (cc.review > 0) {
      steps.push({
        id: "review_queue",
        title: `${cc.review} in review`,
        detail: "Approve or send back with comments.",
        action: "filter_review",
        tone: "warn",
      });
    }
    if (cc.blockedNow > 0) {
      steps.push({
        id: "blocked",
        title: `${cc.blockedNow} blocked on site now`,
        detail: "Resolve SIMOPS conflicts or missing dependencies.",
        action: "filter_blocked",
        tone: "critical",
      });
    }
  } else {
    if (cc.active > 0) {
      steps.push({
        id: "active",
        title: `${cc.active} active on site`,
        detail: "Confirm briefings and check expiry times.",
        action: "filter_active",
        tone: "ok",
      });
    }
    steps.push({
      id: "quick_issue",
      title: "Raise a new permit",
      detail: "Use Quick issue — fastest path for operatives on mobile.",
      action: "issue",
      tone: "accent",
    });
  }

  const seen = new Set();
  return steps.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).slice(0, 3);
}
