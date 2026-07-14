import { describe, it, expect } from "vitest";
import { buildPermitNextSteps, isPermitStudioConfigured } from "./permitNextSteps.js";

describe("permitNextSteps", () => {
  it("prompts guide when incomplete", () => {
    const steps = buildPermitNextSteps({ guideComplete: false, totalPermits: 2 });
    expect(steps[0]?.action).toBe("guide");
  });

  it("supervisor sees review queue", () => {
    const steps = buildPermitNextSteps({
      supervisorMode: true,
      guideComplete: true,
      totalPermits: 5,
      commandCounts: { review: 3 },
    });
    expect(steps.some((s) => s.action === "filter_review")).toBe(true);
  });

  it("admin sees studio when not configured", () => {
    const steps = buildPermitNextSteps({
      isAdmin: true,
      guideComplete: true,
      studioConfigured: false,
      totalPermits: 1,
    });
    expect(steps.some((s) => s.action === "studio")).toBe(true);
  });

  it("detects studio configuration", () => {
    expect(isPermitStudioConfigured({ fieldOverrides: { general: { location: { required: true } } } })).toBe(true);
    expect(isPermitStudioConfigured({})).toBe(false);
  });
});
