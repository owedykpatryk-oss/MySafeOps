import { describe, it, expect } from "vitest";
import { evaluatePermitConditionalRules, normalizePermitConditionalRules } from "./permitConditionalRules";

describe("permitConditionalRules", () => {
  it("normalizes and removes invalid rows", () => {
    const rules = normalizePermitConditionalRules([
      { thenField: "description", action: "required" },
      { thenField: "", action: "required" },
      null,
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].thenField).toBe("description");
  });

  it("applies required/show/block for matching context", () => {
    const result = evaluatePermitConditionalRules(
      { permitType: "confined_space", status: "draft", projectId: "p1" },
      [
        { when: { permitType: "confined_space" }, thenField: "evidenceNotes", action: "required" },
        { when: { status: "draft" }, thenField: "notes", action: "show" },
        { when: { projectId: "p1" }, thenField: "issuedBy", action: "block", message: "Issuer needs AP approval." },
      ]
    );
    expect(result.required.evidenceNotes).toBe(true);
    expect(result.visible.notes).toBe(true);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].message).toContain("AP approval");
  });

  it("ignores non-matching rules", () => {
    const result = evaluatePermitConditionalRules(
      { permitType: "hot_work", status: "approved", projectId: "a" },
      [{ when: { permitType: "confined_space" }, thenField: "description", action: "required" }]
    );
    expect(result.matchedRules).toHaveLength(0);
    expect(result.required.description).toBeUndefined();
  });
});

