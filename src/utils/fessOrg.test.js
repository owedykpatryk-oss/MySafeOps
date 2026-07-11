/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { isFessOrg, FESS_ORG_SLUGS } from "./fessOrg";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("fessOrg", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Test Org" });
  });

  it("detects canonical FESS slugs", () => {
    for (const slug of FESS_ORG_SLUGS) {
      setOrgId(slug);
      expect(isFessOrg()).toBe(true);
    }
  });

  it("detects FESS by organisation display name", () => {
    setOrgId("some-uuid-org");
    saveOrgSettingsRaw({ name: "FESS Group" });
    expect(isFessOrg()).toBe(true);
  });

  it("returns false for unrelated orgs", () => {
    setOrgId("acme-contractors");
    saveOrgSettingsRaw({ name: "Acme Contractors Ltd" });
    expect(isFessOrg()).toBe(false);
  });
});
