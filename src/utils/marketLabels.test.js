import { describe, expect, it } from "vitest";
import { getModuleLabelForMarket, getRamsShortLabel, localizeIndustryTerminology } from "./marketLabels";
import { getPlanDisplayPriceLabel } from "../lib/billingPlans";

describe("marketLabels", () => {
  it("returns SWMS nav label for AU", () => {
    expect(getModuleLabelForMarket("rams", "au")).toBe("SWMS");
    expect(getRamsShortLabel("au")).toBe("SWMS");
  });

  it("returns null for UK overrides", () => {
    expect(getModuleLabelForMarket("rams", "uk")).toBeNull();
  });
  it("returns IOR labels for PL", () => {
    expect(getModuleLabelForMarket("rams", "pl")).toBe("IOR");
    expect(getRamsShortLabel("pl")).toBe("IOR");
  });

  it("localizeIndustryTerminology swaps RAMS/CDM for AU", () => {
    const out = localizeIndustryTerminology("CDM pack and RAMS builder with geospatial RAMS packs", "au");
    expect(out).toContain("WHS");
    expect(out).toContain("SWMS builder");
    expect(out).not.toMatch(/\bRAMS\b/);
  });
});

describe("billingPlans regional display", () => {
  it("shows AUD labels for au market", () => {
    expect(getPlanDisplayPriceLabel("starter", "au")).toBe("A$59");
    expect(getPlanDisplayPriceLabel("team", "au")).toBe("A$229");
  });

  it("shows PLN labels for pl market", () => {
    expect(getPlanDisplayPriceLabel("starter", "pl")).toBe("79 zł");
    expect(getPlanDisplayPriceLabel("team", "pl")).toBe("399 zł");
  });
});
