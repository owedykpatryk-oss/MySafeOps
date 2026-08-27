import { describe, expect, it } from "vitest";
import { getPermitTypesForMarket } from "./permitTypesMarket";

describe("permitTypesMarket", () => {
  it("returns UK types unchanged", () => {
    const uk = getPermitTypesForMarket("uk");
    expect(uk.electrical.checklist.some((x) => /GS38/i.test(x))).toBe(true);
    expect(uk.excavation.checklist.some((x) => /PAS 128/i.test(x))).toBe(true);
    expect(uk.excavation.checklist.some((x) => /CAT scan/i.test(x))).toBe(true);
    expect(uk.excavation.checklist.join(" ")).not.toMatch(/Dial Before You Dig/i);
  });

  it("returns AU electrical checklist with AS/NZS reference", () => {
    const au = getPermitTypesForMarket("au");
    expect(au.electrical.checklist.some((x) => /AS\/NZS 3012/i.test(x))).toBe(true);
    expect(au.excavation.checklist.some((x) => /Dial Before You Dig/i.test(x))).toBe(true);
  });

  it("drops UK PAS 128 extra-field labels on Australia excavation and ground disturbance", () => {
    const au = getPermitTypesForMarket("au");
    const excavationLabels = (au.excavation.extraFields || []).map((f) => f.label).join(" ");
    const groundLabels = (au.ground_disturbance.extraFields || []).map((f) => f.label).join(" ");
    expect(excavationLabels).toMatch(/DBYD|utility locate/i);
    expect(excavationLabels).not.toMatch(/PAS 128/i);
    expect(excavationLabels).not.toMatch(/CAT scan/i);
    expect(groundLabels).toMatch(/DBYD/i);
    expect(groundLabels).not.toMatch(/PAS 128/i);
    expect(groundLabels).not.toMatch(/CAT scan/i);
    expect((au.excavation.extraFields || []).some((f) => f.key === "pas128QualityLevel")).toBe(false);
    expect((au.ground_disturbance.extraFields || []).some((f) => f.key === "pas128QualityLevel")).toBe(false);
    expect((au.ground_disturbance.extraFields || []).some((f) => f.key === "pas128SurveyType")).toBe(false);
  });

  it("replaces UK CAT/PAS 128 excavation checks with CPD wording for Poland", () => {
    const pl = getPermitTypesForMarket("pl");
    expect(pl.excavation.checklist.join(" ")).toMatch(/CPD|geodeta/i);
    expect(pl.excavation.checklist.join(" ")).not.toMatch(/CAT scan/i);
    expect(pl.excavation.checklist.join(" ")).not.toMatch(/PAS 128/i);
  });

  it("drops UK CAT/PAS 128 extra-field labels on Poland excavation and ground disturbance", () => {
    const pl = getPermitTypesForMarket("pl");
    const excavationLabels = (pl.excavation.extraFields || []).map((f) => f.label).join(" ");
    const groundLabels = (pl.ground_disturbance.extraFields || []).map((f) => f.label).join(" ");
    expect(excavationLabels).toMatch(/uzbrojenia/i);
    expect(excavationLabels).not.toMatch(/CAT scan/i);
    expect(excavationLabels).not.toMatch(/PAS 128/i);
    expect(groundLabels).not.toMatch(/CAT scan/i);
    expect(groundLabels).not.toMatch(/PAS 128/i);
    expect((pl.excavation.extraFields || []).some((f) => f.key === "pas128QualityLevel")).toBe(false);
    expect((pl.excavation.extraFields || []).some((f) => f.key === "pas128SurveyType")).toBe(false);
  });

  it("replaces UK CAT/PAS 128 ground-disturbance checks with CPD wording for Poland", () => {
    const pl = getPermitTypesForMarket("pl");
    const checks = pl.ground_disturbance.checklist.join(" ");
    expect(checks).toMatch(/CPD|geodeta/i);
    expect(checks).not.toMatch(/CAT scan/i);
    expect(checks).not.toMatch(/PAS 128/i);
    expect(getPermitTypesForMarket("uk").ground_disturbance.checklist.join(" ")).toMatch(/PAS 128/i);
  });
});
