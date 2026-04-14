import { describe, it, expect } from "vitest";
import {
  normalizeConflictPair,
  resolvePermitConflictRule,
  evaluatePermitTypeConflicts,
  isWarnConflictOverrideValid,
} from "./permitConflictMatrix";

describe("permitConflictMatrix", () => {
  it("normalizes pair keys independent of order", () => {
    expect(normalizeConflictPair("hot_work", "confined_space")).toBe(
      normalizeConflictPair("confined_space", "hot_work")
    );
  });

  it("resolves known block rule", () => {
    const rule = resolvePermitConflictRule("hot_work", "confined_space");
    expect(rule.outcome).toBe("block");
  });

  it("returns allow when pair not configured", () => {
    const rule = resolvePermitConflictRule("general", "visitor_access");
    expect(rule.outcome).toBe("allow");
  });

  it("uses caller-provided matrix overrides", () => {
    const custom = {
      [normalizeConflictPair("general", "visitor_access")]: {
        outcome: "warn",
        reason: "Custom rule",
      },
    };
    const rule = resolvePermitConflictRule("general", "visitor_access", custom);
    expect(rule.outcome).toBe("warn");
  });

  it("evaluates overlapping permits into top-level outcome", () => {
    const result = evaluatePermitTypeConflicts(
      { id: "ptw_a", type: "hot_work" },
      [
        { id: "ptw_b", type: "loto" },
        { id: "ptw_c", type: "confined_space" },
      ]
    );
    expect(result.outcome).toBe("block");
    expect(result.warningConflicts.length).toBeGreaterThan(0);
    expect(result.blockingConflicts.length).toBeGreaterThan(0);
  });

  it("validates warn conflict override payload", () => {
    expect(isWarnConflictOverrideValid({ reason: "too short", approvedBy: "A" })).toBe(false);
    expect(
      isWarnConflictOverrideValid({
        reason: "Sequenced and isolated by controlled permit windows.",
        approvedBy: "Area Authority",
      })
    ).toBe(true);
  });
});
