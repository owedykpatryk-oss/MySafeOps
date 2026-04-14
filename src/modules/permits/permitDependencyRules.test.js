import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMIT_DEPENDENCY_RULES,
  evaluatePermitDependencies,
  mergeDependencyRules,
  normalizeDependencyRules,
} from "./permitDependencyRules";

describe("permitDependencyRules", () => {
  it("normalizes overrides", () => {
    const out = normalizeDependencyRules({
      confined_space: [{ requiresActiveType: " LOTO ", reason: "x" }, { requiresActiveType: "" }],
    });
    expect(out.confined_space).toHaveLength(1);
    expect(out.confined_space[0].requiresActiveType).toBe("loto");
  });

  it("merges overrides over defaults", () => {
    const merged = mergeDependencyRules({
      confined_space: [{ requiresActiveType: "hot_work", reason: "test" }],
    });
    expect(merged.confined_space[0].requiresActiveType).toBe("hot_work");
  });

  it("flags missing dependency for confined space", () => {
    const result = evaluatePermitDependencies(
      { id: "p1", type: "confined_space" },
      [{ id: "p2", type: "hot_work", status: "active", endDateTime: "2099-01-01T00:00:00.000Z" }],
      DEFAULT_PERMIT_DEPENDENCY_RULES
    );
    expect(result.required).toBe(true);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("passes when required active dependency exists", () => {
    const result = evaluatePermitDependencies(
      { id: "p1", type: "confined_space" },
      [{ id: "p2", type: "loto", status: "active", endDateTime: "2099-01-01T00:00:00.000Z" }],
      DEFAULT_PERMIT_DEPENDENCY_RULES
    );
    expect(result.required).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
