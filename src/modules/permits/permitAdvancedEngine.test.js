import { describe, it, expect } from "vitest";
import {
  evaluatePermitActionGate,
  buildIssueSnapshot,
  diffPermitVsIssueSnapshot,
  buildPermitNextActorHint,
} from "./permitAdvancedEngine";

describe("evaluatePermitActionGate", () => {
  const signedPermit = (type = "general") => ({
    type,
    status: "approved",
    signatures: [
      { role: "issuer", signedBy: "A", signedAt: "2026-04-01T10:00:00.000Z", note: "" },
      { role: "receiver", signedBy: "B", signedAt: "2026-04-01T10:05:00.000Z", note: "" },
    ],
    checklist: { general_1: true },
  });

  it("blocks approve without issuer signature", () => {
    const p = {
      type: "general",
      status: "pending_review",
      signatures: [{ role: "issuer", signedBy: "", signedAt: "", note: "" }],
    };
    const g = evaluatePermitActionGate(p, "approve", {});
    expect(g.allowed).toBe(false);
    expect(g.code).toBe("issuer_signature");
  });

  it("allows approve when issuer has signed", () => {
    const p = {
      type: "general",
      status: "pending_review",
      signatures: [{ role: "issuer", signedBy: "AP", signedAt: "2026-04-01T10:00:00.000Z", note: "" }],
    };
    expect(evaluatePermitActionGate(p, "approve", {}).allowed).toBe(true);
  });

  it("blocks activate when any required signature missing", () => {
    const p = {
      type: "general",
      status: "approved",
      signatures: [{ role: "issuer", signedBy: "A", signedAt: "2026-04-01T10:00:00.000Z", note: "" }],
    };
    const g = evaluatePermitActionGate(p, "activate", {});
    expect(g.allowed).toBe(false);
    expect(g.code).toBe("signatures");
  });

  it("blocks activate when compliance not legalReady", () => {
    const p = signedPermit();
    const g = evaluatePermitActionGate(p, "activate", {
      complianceResult: { legalReady: false, hardStops: ["Missing mandatory checklist controls."] },
    });
    expect(g.allowed).toBe(false);
    expect(g.code).toBe("compliance");
  });

  it("blocks activate when conflict matrix returns block", () => {
    const p = signedPermit();
    const g = evaluatePermitActionGate(p, "activate", {
      complianceResult: { legalReady: true, hardStops: [] },
      conflictResult: {
        outcome: "block",
        blockingConflicts: [{ permitId: "ptw_other_1" }],
      },
    });
    expect(g.allowed).toBe(false);
    expect(g.code).toBe("permit_conflict_block");
  });

  it("requires override for warn conflicts", () => {
    const p = signedPermit();
    const blocked = evaluatePermitActionGate(p, "activate", {
      complianceResult: { legalReady: true, hardStops: [] },
      conflictResult: {
        outcome: "warn",
        warningConflicts: [{ permitId: "ptw_other_2" }],
      },
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("permit_conflict_warn");
    const allowed = evaluatePermitActionGate(p, "activate", {
      complianceResult: { legalReady: true, hardStops: [] },
      conflictResult: {
        outcome: "warn",
        warningConflicts: [{ permitId: "ptw_other_2" }],
      },
      warnConflictOverride: {
        reason: "Sequenced to avoid simultaneous exposure.",
        approvedBy: "Duty holder",
      },
    });
    expect(allowed.allowed).toBe(true);
  });

  it("blocks activate when shift handover is required and missing", () => {
    const p = signedPermit();
    const g = evaluatePermitActionGate(p, "activate", {
      complianceResult: { legalReady: true, hardStops: [] },
      handoverRequirement: {
        required: true,
        missing: true,
        reason: "Shift boundary passed without full handover acknowledgements.",
      },
    });
    expect(g.allowed).toBe(false);
    expect(g.code).toBe("handover_required");
  });

  it("blocks activate when dependency permit is required", () => {
    const p = {
      type: "confined_space",
      status: "approved",
      signatures: [
        { role: "issuer", signedBy: "A", signedAt: "2026-04-01T10:00:00.000Z", note: "" },
        { role: "receiver", signedBy: "B", signedAt: "2026-04-01T10:05:00.000Z", note: "" },
        { role: "area_authority", signedBy: "C", signedAt: "2026-04-01T10:06:00.000Z", note: "" },
        { role: "safety_approver", signedBy: "D", signedAt: "2026-04-01T10:07:00.000Z", note: "" },
      ],
      checklist: { general_1: true },
    };
    const g = evaluatePermitActionGate(p, "activate", {
      complianceResult: { legalReady: true, hardStops: [] },
      dependencyResult: {
        required: true,
        missing: [{ requiresActiveType: "loto", reason: "Confined space entry requires active LOTOTO isolation permit." }],
      },
    });
    expect(g.allowed).toBe(false);
    expect(g.code).toBe("permit_dependency_required");
  });
});

describe("buildIssueSnapshot / diffPermitVsIssueSnapshot", () => {
  it("detects location drift after snapshot", () => {
    const snap = buildIssueSnapshot({
      location: "Gate A",
      description: "Work",
      startDateTime: "2026-04-10T08:00:00.000Z",
      endDateTime: "2026-04-10T16:00:00.000Z",
      checklist: { x: true },
    });
    const permit = {
      issueSnapshot: snap,
      location: "Gate B",
      description: "Work",
      startDateTime: "2026-04-10T08:00:00.000Z",
      endDateTime: "2026-04-10T16:00:00.000Z",
      checklist: { x: true },
    };
    const d = diffPermitVsIssueSnapshot(permit);
    expect(d.hasSnapshot).toBe(true);
    expect(d.drift).toBe(true);
    expect(d.changedFields).toContain("location");
  });

  it("returns no snapshot when absent", () => {
    expect(diffPermitVsIssueSnapshot({ location: "X" }).hasSnapshot).toBe(false);
  });
});

describe("buildPermitNextActorHint", () => {
  it("points to issuer when review gate is blocked", () => {
    const hint = buildPermitNextActorHint(
      {
        type: "general",
        status: "pending_review",
        signatures: [{ role: "issuer", signedBy: "", signedAt: "", note: "" }],
      },
      null
    );
    expect(hint.toLowerCase()).toContain("issuer");
  });

  it("points to missing signer for activation", () => {
    const hint = buildPermitNextActorHint(
      {
        type: "general",
        status: "approved",
        signatures: [{ role: "issuer", signedBy: "A", signedAt: "2026-04-01T10:00:00.000Z", note: "" }],
      },
      { legalReady: true, hardStops: [] }
    );
    expect(hint.toLowerCase()).toContain("receiver");
  });

  it("points to conflict override actor when warn conflict blocks activation", () => {
    const hint = buildPermitNextActorHint(
      {
        type: "general",
        status: "approved",
        signatures: [
          { role: "issuer", signedBy: "A", signedAt: "2026-04-01T10:00:00.000Z", note: "" },
          { role: "receiver", signedBy: "B", signedAt: "2026-04-01T10:05:00.000Z", note: "" },
        ],
      },
      { legalReady: true, hardStops: [] },
      {
        conflictResult: {
          outcome: "warn",
          warningConflicts: [{ permitId: "x" }],
        },
      }
    );
    expect(hint.toLowerCase()).toContain("override");
  });

  it("points to handover actor when handover gate blocks activation", () => {
    const hint = buildPermitNextActorHint(
      {
        type: "general",
        status: "approved",
        signatures: [
          { role: "issuer", signedBy: "A", signedAt: "2026-04-01T10:00:00.000Z", note: "" },
          { role: "receiver", signedBy: "B", signedAt: "2026-04-01T10:05:00.000Z", note: "" },
        ],
      },
      { legalReady: true, hardStops: [] },
      {
        handoverRequirement: { required: true, missing: true, reason: "handover missing" },
      }
    );
    expect(hint.toLowerCase()).toContain("handover");
  });

  it("points to dependency actor when dependency gate blocks activation", () => {
    const hint = buildPermitNextActorHint(
      {
        type: "confined_space",
        status: "approved",
        signatures: [
          { role: "issuer", signedBy: "A", signedAt: "2026-04-01T10:00:00.000Z", note: "" },
          { role: "receiver", signedBy: "B", signedAt: "2026-04-01T10:05:00.000Z", note: "" },
          { role: "area_authority", signedBy: "C", signedAt: "2026-04-01T10:06:00.000Z", note: "" },
          { role: "safety_approver", signedBy: "D", signedAt: "2026-04-01T10:07:00.000Z", note: "" },
        ],
      },
      { legalReady: true, hardStops: [] },
      {
        dependencyResult: { required: true, missing: [{ requiresActiveType: "loto" }] },
      }
    );
    expect(hint.toLowerCase()).toContain("dependency");
  });
});
