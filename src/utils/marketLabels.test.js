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
  it("returns IBWR labels for PL", () => {
    expect(getModuleLabelForMarket("rams", "pl")).toBe("IBWR");
    expect(getRamsShortLabel("pl")).toBe("IBWR");
  });

  it("returns GBU labels for DE", () => {
    expect(getModuleLabelForMarket("rams", "de")).toBe("GBU");
    expect(getRamsShortLabel("de")).toBe("GBU");
    expect(getModuleLabelForMarket("sige-plan", "de")).toBe("SiGe-Plan");
  });

  it("returns Evaluierung labels for AT", () => {
    expect(getModuleLabelForMarket("rams", "at")).toBe("Evaluierung");
    expect(getRamsShortLabel("at")).toBe("Evaluierung");
    expect(getModuleLabelForMarket("sige-plan", "at")).toBe("SiGe-Plan");
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
    expect(getPlanDisplayPriceLabel("team", "au")).toBe("A$249");
  });

  it("shows PLN labels for pl market", () => {
    expect(getPlanDisplayPriceLabel("starter", "pl")).toBe("79 zł");
    expect(getPlanDisplayPriceLabel("team", "pl")).toBe("439 zł");
  });

  it("shows EUR labels for de market", () => {
    expect(getPlanDisplayPriceLabel("starter", "de")).toBe("22 €");
    expect(getPlanDisplayPriceLabel("team", "de")).toBe("129 €");
  });

  it("shows EUR labels for at market", () => {
    expect(getPlanDisplayPriceLabel("starter", "at")).toBe("22 €");
    expect(getPlanDisplayPriceLabel("team", "at")).toBe("129 €");
  });
});
