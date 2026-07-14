import { describe, it, expect } from "vitest";
import { buildPermitStudioConfigBundle, parsePermitStudioConfigBundle } from "./permitStudioConfigBundle.js";

describe("permitStudioConfigBundle", () => {
  it("round-trips config bundle", () => {
    const bundle = buildPermitStudioConfigBundle({
      fieldOverrides: { _all: { location: { required: true } } },
      formDefaults: { defaultIssuedBy: "Test" },
      conflictMatrixOverrides: { "hot_work+loto": { outcome: "warn", reason: "r" } },
    });
    const parsed = parsePermitStudioConfigBundle(JSON.stringify(bundle));
    expect(parsed.fieldOverrides._all.location.required).toBe(true);
    expect(parsed.formDefaults.defaultIssuedBy).toBe("Test");
    expect(parsed.conflictMatrixOverrides["hot_work+loto"].outcome).toBe("warn");
  });
});
