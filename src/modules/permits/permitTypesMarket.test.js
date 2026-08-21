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

  it("replaces UK CAT/PAS 128 excavation checks with CPD wording for Poland", () => {
    const pl = getPermitTypesForMarket("pl");
    expect(pl.excavation.checklist.join(" ")).toMatch(/CPD|geodeta/i);
    expect(pl.excavation.checklist.join(" ")).not.toMatch(/CAT scan/i);
    expect(pl.excavation.checklist.join(" ")).not.toMatch(/PAS 128/i);
  });
});
