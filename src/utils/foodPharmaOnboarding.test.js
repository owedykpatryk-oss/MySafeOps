/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { getFoodPharmaSetupStatus } from "./foodPharmaOnboarding";
import { saveOrgScoped } from "./orgStorage";

describe("food/pharma setup evidence", () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem("mysafeops_orgId", "setup-test"); });
  it("checks the actual COSHH register and ignores deleted assessments", () => {
    saveOrgScoped("coshh_items", [{ id: "c1", sdsUrl: "https://example.com/sds.pdf" }]);
    expect(getFoodPharmaSetupStatus().steps.find((step) => step.id === "coshh_sds").done).toBe(true);
    saveOrgScoped("coshh_items", [{ id: "c1", sdsUrl: "https://example.com/sds.pdf", deletedAt: "2026-10-05" }]);
    expect(getFoodPharmaSetupStatus().steps.find((step) => step.id === "coshh_sds").done).toBe(false);
  });
});
