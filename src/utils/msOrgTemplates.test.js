/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { getMsStepTemplate, saveMsStepTemplateOverride, resetMsStepTemplateOverride } from "./msOrgTemplates";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("msOrgTemplates", () => {
  beforeEach(() => {
    saveOrgSettingsRaw({});
  });

  it("returns built-in steps when no override", () => {
    const steps = getMsStepTemplate("mobilisation");
    expect(steps[0]).toMatch(/sign in/i);
    expect(steps.length).toBeGreaterThan(3);
  });

  it("uses org override when set", () => {
    saveMsStepTemplateOverride("height", "Custom step one.\nCustom step two.");
    const steps = getMsStepTemplate("height");
    expect(steps).toEqual(["Custom step one.", "Custom step two."]);
  });

  it("reset removes override", () => {
    saveMsStepTemplateOverride("electrical", "Org-only step.");
    resetMsStepTemplateOverride("electrical");
    const steps = getMsStepTemplate("electrical");
    expect(steps[0]).toMatch(/Isolate electrical/i);
  });
});
