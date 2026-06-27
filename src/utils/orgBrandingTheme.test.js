/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  buildOrgBrandingCssVars,
  formatOrgDisplayName,
  normalizeHex,
  orgHasCustomBranding,
  shadeHex,
} from "./orgBrandingTheme";

describe("orgBrandingTheme", () => {
  it("normalizes hex colours", () => {
    expect(normalizeHex("#F97316")).toBe("#f97316");
    expect(normalizeHex("bad")).toBe("#0d9488");
  });

  it("builds CSS variables from org settings", () => {
    const vars = buildOrgBrandingCssVars({ primaryColor: "#f97316", accentColor: "#0f172a" });
    expect(vars["--color-accent"]).toBe("#f97316");
    expect(vars["--color-accent-hover"]).toMatch(/^#/);
  });

  it("formats display name for default vs custom org", () => {
    expect(formatOrgDisplayName("My Organisation")).toBe("MySafeOps");
    expect(formatOrgDisplayName("FESS Group")).toBe("FESS Group");
  });

  it("detects custom branding", () => {
    expect(orgHasCustomBranding({ name: "My Organisation" })).toBe(false);
    expect(orgHasCustomBranding({ name: "Acme Ltd", logo: null })).toBe(true);
  });

  it("shades hex colours", () => {
    expect(shadeHex("#808080", -0.5)).not.toBe("#808080");
  });
});
