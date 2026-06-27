/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  getOrgSettings,
  loadOrgSettingsRaw,
  pickCloudBrandingPayload,
  saveOrgSettingsRaw,
} from "./orgSettingsStorage";

describe("orgSettingsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("loads and saves org-scoped settings", () => {
    saveOrgSettingsRaw({ name: "Acme Ltd", primaryColor: "#111111" });
    expect(loadOrgSettingsRaw().name).toBe("Acme Ltd");
    expect(getOrgSettings().primaryColor).toBe("#111111");
  });

  it("migrates legacy global key into org scope", () => {
    localStorage.setItem("mysafeops_org_settings", JSON.stringify({ name: "Legacy Co" }));
    expect(loadOrgSettingsRaw().name).toBe("Legacy Co");
    expect(localStorage.getItem("mysafeops_org_settings_test-org")).toBeTruthy();
  });

  it("pickCloudBrandingPayload omits empty customFields", () => {
    const payload = pickCloudBrandingPayload({ name: "X", primaryColor: "#0d9488", customFields: [] });
    expect(payload.name).toBe("X");
    expect(payload.customFields).toBeUndefined();
  });

  it("pickCloudBrandingPayload includes hidden module lists when set", () => {
    const payload = pickCloudBrandingPayload({
      name: "X",
      hiddenModules: ["snags"],
      hiddenFeatures: ["rams/surveying"],
    });
    expect(payload.hiddenModules).toEqual(["snags"]);
    expect(payload.hiddenFeatures).toEqual(["rams/surveying"]);
  });
});
