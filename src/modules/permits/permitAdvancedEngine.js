import { isWarnConflictOverrideValid } from "./permitConflictMatrix";

const DYNAMIC_FIELD_LIBRARY = {
  hot_work: [
    { key: "hotWorkFireWatchMins", label: "Fire watch (minutes)", type: "number", required: true },
    { key: "hotWorkExtinguisherType", label: "Extinguisher type", type: "text", required: true },
    { key: "hotWorkCombustibleRemoved", label: "Combustibles removed", type: "checkbox", required: true },
  ],
  loto: [
    { key: "lotoIsolationPoint", label: "Isolation point ID", type: "text", required: true },
    { key: "lotoLockCount", label: "Lock count", type: "number", required: true },
    { key: "lotoTryTestDone", label: "Try-test completed", type: "checkbox", required: true },
  ],
  confined_space: [
    { key: "csPermitSupervisor", label: "Confined space supervisor", type: "text", required: true },
    { key: "csRescuePlanRef", label: "Rescue plan reference", type: "text", required: true },
    { key: "csGasTester", label: "Gas tester name", type: "text", required: true },
    { key: "csGasResult", label: "Gas test result", type: "select", required: true, options: ["pass", "fail"] },
    {
      key: "csGasFailAction",
      label: "Gas fail action",
      type: "text",
      required: true,
      when: { key: "csGasResult", equals: "fail" },
    },
  ],
};

const SIGNATURE_ROLES = {
  default: ["issuer", "receiver"],
  hot_work: ["issuer", "receiver", "area_authority"],
  loto: ["issuer", "receiver", "area_authority"],
  confined_space: ["issuer", "receiver", "area_authority", "safety_approver"],
};

const WORKFLOW_STEPS = {
  draft: ["ready_for_review", "issued", "closed"],
  ready_for_review: ["approved", "draft", "closed"],
  approved: ["issued", "suspended", "closed"],
  issued: ["suspended", "closed"],
  suspended: ["issued", "closed"],
  closed: ["issued"],
};

function cleanText(v) {
  return String(v || "").trim();
}

export function getDynamicFieldSpec(type) {
  return DYNAMIC_FIELD_LIBRARY[type] || [];
}

export function getRequiredSignatureRoles(type) {
  return SIGNATURE_ROLES[type] || SIGNATURE_ROLES.default;
}

export function initSignatureChain(type, existing = []) {
  const existingByRole = Object.fromEntries((existing || []).map((s) => [s.role, s]));
  return getRequiredSignatureRoles(type).map((role) => ({
    role,
    signedBy: existingByRole[role]?.signedBy || "",
    signedByWorkerId: existingByRole[role]?.signedByWorkerId || "",
    signedAt: existingByRole[role]?.signedAt || "",
    note: existingByRole[role]?.note || "",
    signatureImageDataUrl: existingByRole[role]?.signatureImageDataUrl || "",
  }));
}

export function signPermitRole(draft, role, signedBy, note = "", signatureImageDataUrl = "", signedByWorkerId = "") {
  const now = new Date().toISOString();
  const nextSignatures = initSignatureChain(draft.type, draft.signatures).map((s) =>
    s.role === role
      ? {
          ...s,
          signedBy: cleanText(signedBy),
          signedByWorkerId: cleanText(signedByWorkerId),
          signedAt: now,
          note: cleanText(note),
          signatureImageDataUrl: String(signatureImageDataUrl || s.signatureImageDataUrl || ""),
        }
      : s
  );
  return { ...draft, signatures: nextSignatures };
}

export function normalizeAdvancedPermit(draft, type) {
  const permitType = type || draft?.type || "hot_work";
  const extra = draft?.extraFields || {};
  const dynamic = extra.dynamic && typeof extra.dynamic === "object" ? extra.dynamic : {};
  const existingOverride = draft?.conflictWarnOverride;
  const conflictWarnOverride =
    existingOverride && typeof existingOverride === "object"
      ? {
          reason: cleanText(existingOverride.reason),
          approvedBy: cleanText(existingOverride.approvedBy),
          approvedAt: cleanText(existingOverride.approvedAt),
        }
      : null;
  return {
    ...draft,
    type: permitType,
    extraFields: { ...extra, dynamic },
    workflow: {
      state: draft?.workflow?.state || draft?.status || "draft",
      history: Array.isArray(draft?.workflow?.history) ? draft.workflow.history : [],
    },
    signatures: initSignatureChain(permitType, draft?.signatures),
    templateHistory: Array.isArray(draft?.templateHistory) ? draft.templateHistory : [],
    revalidationLog: Array.isArray(draft?.revalidationLog) ? draft.revalidationLog : [],
    integrationQueue: Array.isArray(draft?.integrationQueue) ? draft.integrationQueue : [],
    tags: Array.isArray(draft?.tags) ? draft.tags : [],
    handoverLog: Array.isArray(draft?.handoverLog) ? draft.handoverLog : [],
    conflictWarnOverride,
  };
}

export function evaluateDynamicRequirements(draft, type) {
  const spec = getDynamicFieldSpec(type || draft?.type);
  const answers = draft?.extraFields?.dynamic || {};
  const missingRequired = [];
  spec.forEach((f) => {
    if (!f.required) return;
    if (f.when) {
      const source = answers[f.when.key];
      if (String(source) !== String(f.when.equals)) return;
    }
    const v = answers[f.key];
    const empty = f.type === "checkbox" ? v !== true : cleanText(v) === "";
    if (empty) missingRequired.push(f.label);
  });
  return { missingRequired, total: spec.length };
}

export function evaluatePermitRules(draft, type) {
  const hardStops = [];
  const warnings = [];
  const dynamic = draft?.extraFields?.dynamic || {};
  if ((type || draft?.type) === "confined_space" && String(dynamic.csGasResult || "") === "fail") {
    hardStops.push("Confined space gas test failed - cannot issue until corrected.");
  }
  if (cleanText(draft?.description).length < 20) {
    warnings.push("Description is short; add clearer scope to improve traceability.");
  }
  if (!cleanText(draft?.linkedRamsId)) {
    warnings.push("No linked RAMS document.");
  }
  return { hardStops, warnings };
}

export function computePermitRiskScore(draft, { simopsHits = [], compliance = null } = {}) {
  let score = 30;
  const reasons = [];
  if (!cleanText(draft?.location)) {
    score += 12;
    reasons.push("Missing precise location.");
  }
  if (!cleanText(draft?.issuedBy) || !cleanText(draft?.issuedTo)) {
    score += 10;
    reasons.push("Issuer/receiver details incomplete.");
  }
  if (Array.isArray(simopsHits) && simopsHits.length > 0) {
    score += Math.min(20, simopsHits.length * 5);
    reasons.push(`SIMOPS overlap: ${simopsHits.length}.`);
  }
  if (compliance && Array.isArray(compliance.hardStops) && compliance.hardStops.length > 0) {
    score += Math.min(30, compliance.hardStops.length * 10);
    reasons.push("Compliance hard-stops detected.");
  }
  const normalized = Math.max(0, Math.min(100, score));
  return { score: normalized, level: normalized >= 75 ? "high" : normalized >= 50 ? "medium" : "low", reasons };
}

export function summarizePermitQuality({
  canIssueBase,
  dynamicMissing = [],
  ruleHardStops = [],
  qualityFailed = [],
  signatureMissing = [],
}) {
  const blockers = [
    ...dynamicMissing.map((x) => `Dynamic field required: ${x}`),
    ...ruleHardStops,
    ...qualityFailed.map((x) => x.message || x),
    ...signatureMissing.map((x) => `Missing signature: ${x}`),
  ];
  const progressMax = Math.max(1, blockers.length + 6);
  const progressDone = Math.max(0, 6 - blockers.length);
  return {
    blockers,
    canIssue: Boolean(canIssueBase && blockers.length === 0),
    progress: Math.round((progressDone / progressMax) * 100),
  };
}

export function transitionPermitWorkflow(permit, targetState, note = "") {
  const from = permit?.workflow?.state || permit?.status || "draft";
  const allowed = WORKFLOW_STEPS[from] || [];
  if (!allowed.includes(targetState)) {
    throw new Error(`Workflow transition ${from} -> ${targetState} is not allowed.`);
  }
  const event = { from, to: targetState, at: new Date().toISOString(), note: cleanText(note) };
  return {
    ...permit,
    status: targetState,
    workflow: {
      state: targetState,
      history: [event, ...(permit?.workflow?.history || [])].slice(0, 120),
    },
  };
}

export function buildRevalidationSnapshot(permit) {
  return {
    at: new Date().toISOString(),
    location: cleanText(permit?.location),
    description: cleanText(permit?.description),
    startDateTime: permit?.startDateTime || "",
    endDateTime: permit?.endDateTime || permit?.expiryDate || "",
    checklistCount: Array.isArray(permit?.checklistItems) ? permit.checklistItems.length : 0,
  };
}

export function diffRevalidationSnapshot(base, next) {
  if (!base) return { changed: ["initial_snapshot"], changedCount: 1 };
  const keys = ["location", "description", "startDateTime", "endDateTime", "checklistCount"];
  const changed = keys.filter((k) => String(base[k] || "") !== String(next[k] || ""));
  return { changed, changedCount: changed.length };
}

/** Snapshot at first activation — local-first, for drift detection vs later edits. */
export function buildIssueSnapshot(permit) {
  const checklist = permit?.checklist && typeof permit.checklist === "object" ? permit.checklist : {};
  const checklistKeys = Object.keys(checklist)
    .filter((k) => checklist[k])
    .map(String)
    .sort();
  return {
    at: new Date().toISOString(),
    location: cleanText(permit?.location),
    description: cleanText(permit?.description).slice(0, 800),
    startDateTime: permit?.startDateTime || "",
    endDateTime: permit?.endDateTime || permit?.expiryDate || "",
    checklistKeys,
  };
}

export function diffPermitVsIssueSnapshot(permit) {
  const snap = permit?.issueSnapshot;
  if (!snap || typeof snap !== "object") {
    return { hasSnapshot: false, drift: false, changedFields: [] };
  }
  const changed = [];
  if (cleanText(permit?.location) !== cleanText(snap.location)) changed.push("location");
  if (cleanText(permit?.description).slice(0, 800) !== cleanText(snap.description)) changed.push("description");
  if (String(permit?.startDateTime || "") !== String(snap.startDateTime || "")) changed.push("startDateTime");
  if (String(permit?.endDateTime || permit?.expiryDate || "") !== String(snap.endDateTime || "")) {
    changed.push("endDateTime");
  }
  const cur = permit?.checklist && typeof permit.checklist === "object" ? permit.checklist : {};
  const curKeys = Object.keys(cur)
    .filter((k) => cur[k])
    .map(String)
    .sort()
    .join("|");
  const snapKeys = Array.isArray(snap.checklistKeys) ? snap.checklistKeys.join("|") : "";
  if (curKeys !== snapKeys) changed.push("checklist");
  return {
    hasSnapshot: true,
    drift: changed.length > 0,
    changedFields: changed,
  };
}

function unsignedSignatureRoles(permit) {
  const chain = initSignatureChain(permit?.type, permit?.signatures);
  return chain.filter((s) => !cleanText(s.signedAt)).map((s) => s.role);
}

function formatRoles(roles) {
  return roles.map((r) => r.replace(/_/g, " ")).join(", ");
}

/**
 * Gate list/board actions so approvals and activation respect signatures (and compliance on activate).
 * @param {"approve"|"activate"} action
 * @param {{
 *   complianceResult?: { legalReady?: boolean, hardStops?: string[] },
 *   conflictResult?: { outcome?: "allow"|"warn"|"block", blockingConflicts?: any[], warningConflicts?: any[] },
 *   warnConflictOverride?: { reason?: string, approvedBy?: string, approvedAt?: string },
 *   allowUnsignedSignatures?: boolean,
 *   handoverRequirement?: { required?: boolean, missing?: boolean, reason?: string },
 *   dependencyResult?: { required?: boolean, missing?: Array<{ requiresActiveType?: string, reason?: string }> }
 * }} options
 */
export function evaluatePermitActionGate(permit, action, options = {}) {
  if (action === "approve") {
    const chain = initSignatureChain(permit?.type, permit?.signatures);
    const issuer = chain.find((s) => s.role === "issuer");
    if (!issuer || !cleanText(issuer.signedAt)) {
      return {
        allowed: false,
        code: "issuer_signature",
        message: "Issuer (authorised person) must sign the permit before it can be approved.",
        unsignedRoles: ["issuer"],
      };
    }
    return { allowed: true };
  }
  if (action === "activate") {
    const unsigned = unsignedSignatureRoles(permit);
    if (unsigned.length && options.allowUnsignedSignatures !== true) {
      return {
        allowed: false,
        code: "signatures",
        message: `All required signatures must be collected before activation: ${formatRoles(unsigned)}.`,
        unsignedRoles: unsigned,
      };
    }
    const cr = options.complianceResult;
    if (cr && cr.legalReady === false) {
      const hs = Array.isArray(cr.hardStops) ? cr.hardStops.filter(Boolean) : [];
      return {
        allowed: false,
        code: "compliance",
        message: hs[0] || "Compliance checks must pass before activation.",
        hardStops: hs,
      };
    }
    const handover = options.handoverRequirement;
    if (handover && handover.required === true && handover.missing === true) {
      return {
        allowed: false,
        code: "handover_required",
        message: cleanText(handover.reason) || "Shift handover is required before activation.",
      };
    }
    const deps = options.dependencyResult;
    if (deps && deps.required === true && Array.isArray(deps.missing) && deps.missing.length > 0) {
      const first = deps.missing[0];
      const depType = cleanText(first?.requiresActiveType).replace(/_/g, " ");
      return {
        allowed: false,
        code: "permit_dependency_required",
        message: cleanText(first?.reason) || (depType ? `Activation requires active dependency permit: ${depType}.` : "Activation requires active dependency permit."),
        missingDependencies: deps.missing,
      };
    }
    const conflict = options.conflictResult;
    if (conflict && String(conflict.outcome || "allow") === "block") {
      const refs = (Array.isArray(conflict.blockingConflicts) ? conflict.blockingConflicts : [])
        .map((x) => x?.permitId)
        .filter(Boolean)
        .slice(0, 4);
      return {
        allowed: false,
        code: "permit_conflict_block",
        message:
          refs.length > 0
            ? `Activation blocked by incompatible permit overlap (${refs.join(", ")}).`
            : "Activation blocked by incompatible permit overlap.",
        conflicts: Array.isArray(conflict.blockingConflicts) ? conflict.blockingConflicts : [],
      };
    }
    if (conflict && String(conflict.outcome || "allow") === "warn") {
      const override = options.warnConflictOverride;
      if (!isWarnConflictOverrideValid(override)) {
        const refs = (Array.isArray(conflict.warningConflicts) ? conflict.warningConflicts : [])
          .map((x) => x?.permitId)
          .filter(Boolean)
          .slice(0, 4);
        return {
          allowed: false,
          code: "permit_conflict_warn",
          message:
            refs.length > 0
              ? `Permit overlap requires override reason and approver before activation (${refs.join(", ")}).`
              : "Permit overlap requires override reason and approver before activation.",
          conflicts: Array.isArray(conflict.warningConflicts) ? conflict.warningConflicts : [],
        };
      }
    }
    return { allowed: true };
  }
  return { allowed: true };
}

export function buildPermitNextActorHint(permit, complianceResult, conflictOptions = {}) {
  const status = String(permit?.status || permit?.workflow?.state || "draft");
  if (status === "pending_review" || status === "ready_for_review") {
    const gate = evaluatePermitActionGate(permit, "approve", {});
    if (!gate.allowed) return "Who acts next: issuer (authorised person) signs the permit.";
    return "Who acts next: reviewer can approve this permit.";
  }
  if (status === "approved" || status === "closed") {
    const gate = evaluatePermitActionGate(permit, "activate", {
      complianceResult,
      conflictResult: conflictOptions?.conflictResult,
      warnConflictOverride: conflictOptions?.warnConflictOverride,
      handoverRequirement: conflictOptions?.handoverRequirement,
      dependencyResult: conflictOptions?.dependencyResult,
    });
    if (!gate.allowed && gate.code === "signatures" && Array.isArray(gate.unsignedRoles) && gate.unsignedRoles.length) {
      return `Who acts next: collect signature from ${gate.unsignedRoles[0].replace(/_/g, " ")}.`;
    }
    if (!gate.allowed && gate.code === "compliance") {
      return "Who acts next: complete compliance evidence and legal controls.";
    }
    if (!gate.allowed && gate.code === "handover_required") {
      return "Who acts next: complete shift handover and dual supervisor acknowledgement.";
    }
    if (!gate.allowed && gate.code === "permit_dependency_required") {
      return "Who acts next: activate required dependency permit before continuing.";
    }
    if (!gate.allowed && gate.code === "permit_conflict_block") {
      return "Who acts next: resolve conflicting permit activity before activation.";
    }
    if (!gate.allowed && gate.code === "permit_conflict_warn") {
      return "Who acts next: provide conflict override reason and approver.";
    }
    return "Who acts next: duty holder can activate permit.";
  }
  if (status === "draft") {
    return "Who acts next: issuer completes checks and submits for review.";
  }
  return "";
}

export function buildTemplateRollbackSnapshot(draft) {
  return {
    at: new Date().toISOString(),
    checklistItems: Array.isArray(draft?.checklistItems) ? draft.checklistItems : [],
    templateVersion: Number(draft?.templateVersion || 1),
  };
}

