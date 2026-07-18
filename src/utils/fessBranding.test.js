/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw, loadOrgSettingsRaw, getOrgSettings } from "./orgSettingsStorage";
import {
  ensureFessBranding,
  mergeFessBrandingDefaults,
  getFessBrandLogoSrc,
  FESS_BRAND,
} from "./fessBranding";
import { FESS_GROUP_PACK_ID } from "./fessWorkspaceProfile";

describe("FESS branding ensure", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
  });

  it("merge sets orange/navy + logo for PWA chrome", () => {
    const merged = mergeFessBrandingDefaults({
      name: "My Organisation",
      primaryColor: "#0d9488",
      accentColor: "#0f766e",
    });
    expect(merged.primaryColor).toBe(FESS_BRAND.primaryColor);
    expect(merged.accentColor).toBe(FESS_BRAND.accentColor);
    expect(merged.logoUrl).toBe("/branding/fess-group-logo.png");
    expect(merged.logo).toBe("/branding/fess-group-logo.png");
    expect(merged.pdfVersionPrefix).toBe("FESS");
  });

  it("getOrgSettings falls back logoUrl when logo empty", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({
      name: "FESS Group",
      logoUrl: "/branding/fess-group-logo.png",
      primaryColor: "#f97316",
    });
    const org = getOrgSettings();
    expect(org.logo).toBe("/branding/fess-group-logo.png");
    expect(getFessBrandLogoSrc(org)).toBe("/branding/fess-group-logo.png");
  });

  it("ensure writes FESS branding for fess-group without wizard", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({
      name: "My Organisation",
      primaryColor: "#0d9488",
      accentColor: "#0f766e",
    });
    expect(ensureFessBranding("fess-group")).toBe(true);
    const raw = loadOrgSettingsRaw();
    expect(raw.primaryColor).toBe("#f97316");
    expect(raw.accentColor).toBe("#0f172a");
    expect(raw.logo).toBe("/branding/fess-group-logo.png");
    expect(raw.industryPackId).toBe(FESS_GROUP_PACK_ID);
    expect(ensureFessBranding("fess-group")).toBe(false);
  });

  it("force ensure works for @fessgroup.co.uk tenant before gate fields sync", () => {
    setOrgId("jack-workspace");
    saveOrgSettingsRaw({
      name: "Jack Workspace",
      primaryColor: "#0d9488",
      accentColor: "#f97316",
    });
    expect(ensureFessBranding("jack-workspace")).toBe(false);
    expect(ensureFessBranding("jack-workspace", { force: true })).toBe(true);
    expect(loadOrgSettingsRaw().name).toBe("FESS Group");
    expect(loadOrgSettingsRaw().primaryColor).toBe("#f97316");
  });

  it("ensure is a no-op for other orgs", () => {
    setOrgId("acme-ltd");
    saveOrgSettingsRaw({ name: "Acme Ltd", primaryColor: "#0d9488" });
    expect(ensureFessBranding("acme-ltd")).toBe(false);
    expect(loadOrgSettingsRaw().primaryColor).toBe("#0d9488");
  });
});
