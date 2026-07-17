/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw, loadOrgSettingsRaw, getOrgSettings } from "./orgSettingsStorage";
import {
  ensureUtilityMappingBranding,
  mergeUtilityMappingBrandingDefaults,
  UTILITY_MAPPING_BRAND,
} from "./utilityMappingBranding";
import { UTILITY_MAPPING_PACK_ID } from "./utilityMappingWorkspaceProfile";

describe("Utility Mapping branding ensure", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
  });

  it("merge sets logo from logoUrl for PWA chrome", () => {
    const merged = mergeUtilityMappingBrandingDefaults({
      name: "My Organisation",
      primaryColor: "#0d9488",
      accentColor: "#f97316",
    });
    expect(merged.primaryColor).toBe(UTILITY_MAPPING_BRAND.primaryColor);
    expect(merged.accentColor).toBe(UTILITY_MAPPING_BRAND.accentColor);
    expect(merged.logoUrl).toBe("/branding/utility-mapping-logo.png");
    expect(merged.logo).toBe("/branding/utility-mapping-logo.png");
  });

  it("getOrgSettings falls back logoUrl when logo empty", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      logoUrl: "/branding/utility-mapping-logo.png",
      primaryColor: "#0B1D3A",
    });
    const org = getOrgSettings();
    expect(org.logo).toBe("/branding/utility-mapping-logo.png");
  });

  it("ensure writes navy/cyan branding for Utility Mapping slug without wizard", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "My Organisation",
      primaryColor: "#0d9488",
      accentColor: "#f97316",
    });
    expect(ensureUtilityMappingBranding("utility-mapping")).toBe(true);
    const raw = loadOrgSettingsRaw();
    expect(raw.primaryColor).toBe("#0B1D3A");
    expect(raw.accentColor).toBe("#00B4E4");
    expect(raw.logo).toBe("/branding/utility-mapping-logo.png");
    expect(raw.industryPackId).toBe(UTILITY_MAPPING_PACK_ID);
    expect(ensureUtilityMappingBranding("utility-mapping")).toBe(false);
  });

  it("force ensure works for @u-map.co.uk tenant before gate fields sync", () => {
    setOrgId("patryk-44bdf196");
    saveOrgSettingsRaw({
      name: "Patryk Workspace",
      primaryColor: "#0d9488",
      accentColor: "#f97316",
    });
    expect(ensureUtilityMappingBranding("patryk-44bdf196")).toBe(false);
    expect(ensureUtilityMappingBranding("patryk-44bdf196", { force: true })).toBe(true);
    expect(loadOrgSettingsRaw().name).toBe("Utility Mapping");
    expect(loadOrgSettingsRaw().primaryColor).toBe("#0B1D3A");
  });

  it("ensure is a no-op for other orgs", () => {
    setOrgId("acme-ltd");
    saveOrgSettingsRaw({ name: "Acme Ltd", primaryColor: "#0d9488" });
    expect(ensureUtilityMappingBranding("acme-ltd")).toBe(false);
    expect(loadOrgSettingsRaw().primaryColor).toBe("#0d9488");
  });
});
