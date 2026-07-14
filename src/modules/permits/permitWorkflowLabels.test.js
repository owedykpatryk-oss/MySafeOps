import { describe, expect, it } from "vitest";
import { labelWorkflowState, PERMIT_WORKFLOW_STATES } from "./permitWorkflowLabels";

describe("permitWorkflowLabels", () => {
  it("labels known workflow states in UK-friendly copy", () => {
    expect(labelWorkflowState("issued")).toBe("Active on site");
    expect(labelWorkflowState("ready_for_review")).toBe("In review");
  });

  it("falls back for unknown states", () => {
    expect(labelWorkflowState("custom_state")).toBe("custom state");
  });

  it("exports stable state order", () => {
    expect(PERMIT_WORKFLOW_STATES).toContain("draft");
    expect(PERMIT_WORKFLOW_STATES).toContain("closed");
  });
});
