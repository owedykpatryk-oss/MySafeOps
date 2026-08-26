import { describe, expect, it } from "vitest";
import { getMarketComplianceCopy } from "./marketComplianceCopy";

describe("marketComplianceCopy", () => {
  it.each(["pl", "de", "at", "ch", "au"])("keeps UK-only acronyms out of %s copy", (marketId) => {
    const copy = Object.values(getMarketComplianceCopy(marketId)).join(" ");
    expect(copy).not.toMatch(/\b(?:HSE|RIDDOR|CDM 2015|LOLER|BS 7121)\b/);
  });

  it("keeps the UK statutory references in the UK pack", () => {
    const copy = getMarketComplianceCopy("uk");
    expect(copy.statutoryReportingNote).toContain("RIDDOR");
    expect(copy.liftingBasis).toContain("LOLER");
  });
});
