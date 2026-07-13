import { describe, expect, it } from "vitest";
import { getPermitTypesForMarket } from "./permitTypesMarket";

describe("permitTypesMarket", () => {
  it("returns UK types unchanged", () => {
    const uk = getPermitTypesForMarket("uk");
    expect(uk.electrical.checklist.some((x) => /GS38/i.test(x))).toBe(true);
  });

  it("returns AU electrical checklist with AS/NZS reference", () => {
    const au = getPermitTypesForMarket("au");
    expect(au.electrical.checklist.some((x) => /AS\/NZS 3012/i.test(x))).toBe(true);
    expect(au.excavation.checklist.some((x) => /Dial Before You Dig/i.test(x))).toBe(true);
  });
});
