/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { applyIndustryPack } from "./orgIndustryPacks";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { loadOrgScoped } from "./orgStorage";
import { seedRegistersForIndustryPack, SEED_MODULES_BY_PACK } from "./industryPackSeeds";

describe("industryPackSeeds", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("seeds electrical registers when empty", () => {
    applyIndustryPack("electricalContractor");
    const { seeded } = seedRegistersForIndustryPack("electricalContractor");
    expect(seeded).toContain("electrical-pat");
    expect(loadOrgScoped("electrical_pat_log", [])).toHaveLength(1);
  });

  it("applyIndustryPack with seedTemplates option", () => {
    const { seeded } = applyIndustryPack("foodPharma", { seedTemplates: true });
    expect(seeded.length).toBeGreaterThan(0);
    expect(SEED_MODULES_BY_PACK.foodPharma).toContain("allergen-changeovers");
  });

  it("skips non-empty registers", () => {
    localStorage.setItem(
      "electrical_pat_log_test-org",
      JSON.stringify([{ id: "existing" }])
    );
    const { seeded, skipped } = seedRegistersForIndustryPack("electricalContractor");
    expect(seeded).not.toContain("electrical-pat");
    expect(skipped.some((s) => s.moduleId === "electrical-pat")).toBe(true);
  });
});
