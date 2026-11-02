import { describe, expect, it } from "vitest";
import { resolveSitePostcodeCandidatesForMarket } from "./siteAddressLookup.js";

describe("resolveSitePostcodeCandidatesForMarket", () => {
  it("falls back to a different UK postcode embedded in the address", () => {
    expect(
      resolveSitePostcodeCandidatesForMarket(
        "PA3 2SW",
        "uk",
        "Glasgow Airport Limited, Paisley, Renfrewshire, Scotland, PA3 2ST"
      )
    ).toEqual(["PA3 2SW", "PA3 2ST"]);
  });

  it("does not duplicate the same normalised postcode", () => {
    expect(
      resolveSitePostcodeCandidatesForMarket("PA32ST", "uk", "Glasgow Airport, PA3 2ST")
    ).toEqual(["PA3 2ST"]);
  });
});
