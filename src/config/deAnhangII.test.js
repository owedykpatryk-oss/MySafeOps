import { describe, expect, it } from "vitest";
import { DE_ANHANG_II_WORKS, anhangIIItemsForPermit, deAnhangIIChecklistLabels } from "./deAnhangII";

describe("deAnhangII", () => {
  it("lists particularly dangerous works with permit links", () => {
    expect(DE_ANHANG_II_WORKS.length).toBeGreaterThanOrEqual(8);
    expect(anhangIIItemsForPermit("work_at_height").some((i) => i.id === "fall")).toBe(true);
    expect(anhangIIItemsForPermit("excavation").some((i) => i.id === "burial")).toBe(true);
  });

  it("exposes checklist labels for SiGe-Plan prompts", () => {
    const labels = deAnhangIIChecklistLabels();
    expect(labels.some((l) => /Absturz/i.test(l))).toBe(true);
  });
});
