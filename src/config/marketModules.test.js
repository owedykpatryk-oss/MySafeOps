import { describe, expect, it } from "vitest";
import {
  AU_ONLY_MODULE_IDS,
  isFeatureAllowedForMarket,
  isModuleAllowedForMarket,
  UK_ONLY_MODULE_IDS,
} from "../config/marketModules";

describe("marketModules", () => {
  it("blocks UK-only modules for AU orgs", () => {
    for (const id of UK_ONLY_MODULE_IDS) {
      expect(isModuleAllowedForMarket(id, "uk")).toBe(true);
      expect(isModuleAllowedForMarket(id, "au")).toBe(false);
    }
  });

  it("allows shared modules in both markets", () => {
    expect(isModuleAllowedForMarket("permits", "uk")).toBe(true);
    expect(isModuleAllowedForMarket("permits", "au")).toBe(true);
    expect(isModuleAllowedForMarket("incidents", "au")).toBe(true);
  });

  it("blocks PAS128 surveying RAMS feature for AU", () => {
    expect(isFeatureAllowedForMarket("rams/surveying", "uk")).toBe(true);
    expect(isFeatureAllowedForMarket("rams/surveying", "au")).toBe(false);
  });

  it("blocks AU-only modules for UK orgs", () => {
    expect(isModuleAllowedForMarket("whs-plan", "au")).toBe(true);
    expect(isModuleAllowedForMarket("whs-plan", "uk")).toBe(false);
    expect(isModuleAllowedForMarket("notifiable-incidents", "au")).toBe(true);
    expect(isModuleAllowedForMarket("notifiable-incidents", "uk")).toBe(false);
  });

  it("blocks UK-only modules for PL orgs", () => {
    for (const id of UK_ONLY_MODULE_IDS) {
      expect(isModuleAllowedForMarket(id, "pl")).toBe(false);
    }
  });

  it("blocks PL-only modules for UK orgs", () => {
    expect(isModuleAllowedForMarket("bhp-plan", "pl")).toBe(true);
    expect(isModuleAllowedForMarket("bhp-plan", "uk")).toBe(false);
    expect(isModuleAllowedForMarket("whs-plan", "pl")).toBe(false);
    expect(isModuleAllowedForMarket("notifiable-incidents", "pl")).toBe(true);
  });

  it("reserves AU-only ids when added", () => {
    expect(AU_ONLY_MODULE_IDS).toContain("whs-plan");
    expect(AU_ONLY_MODULE_IDS).toContain("notifiable-incidents");
  });
});
