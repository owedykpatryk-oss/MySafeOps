import { describe, it, expect } from "vitest";
import {
  cycleConflictOutcome,
  mergeConflictMatrix,
  effectiveConflictOutcome,
  normalizeConflictPair,
  PERMIT_CONFLICT_MATRIX,
} from "./permitConflictMatrix.js";

describe("permitConflictMatrix helpers", () => {
  it("merges overrides over baseline", () => {
    const merged = mergeConflictMatrix(PERMIT_CONFLICT_MATRIX, {
      "hot_work+confined_space": { outcome: "warn", reason: "org" },
    });
    expect(merged["hot_work+confined_space"].outcome).toBe("warn");
  });

  it("cycles conflict outcomes", () => {
    expect(cycleConflictOutcome("allow")).toBe("warn");
    expect(cycleConflictOutcome("warn")).toBe("block");
    expect(cycleConflictOutcome("block")).toBe("allow");
  });

  it("reads effective outcome with overrides", () => {
    const key = normalizeConflictPair("hot_work", "confined_space");
    const eff = effectiveConflictOutcome("hot_work", "confined_space", {
      [key]: { outcome: "warn", reason: "x" },
    });
    expect(eff.outcome).toBe("warn");
  });
});
