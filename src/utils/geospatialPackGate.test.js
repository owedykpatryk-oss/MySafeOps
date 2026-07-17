/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { isGeospatialPackActive, GEOSPATIAL_PACK_IDS } from "./geospatialPackGate";
import { safeOrgWebsiteBase, buildOrgShareUrlWithRef } from "./safeOrgWebsite";

describe("geospatialPackGate", () => {
  it("recognises surveying pack ids without loading hazard library", () => {
    expect(GEOSPATIAL_PACK_IDS.has("surveyingGeodesy")).toBe(true);
    expect(isGeospatialPackActive({ industryPackId: "surveyingGeodesy" })).toBe(true);
    expect(isGeospatialPackActive({ industryPackId: "generalContractor" })).toBe(false);
  });
});

describe("safeOrgWebsite", () => {
  it("blocks javascript: websites and falls back", () => {
    expect(safeOrgWebsiteBase({ website: "javascript:alert(1)" })).toBe("https://u-map.co.uk");
    expect(buildOrgShareUrlWithRef({ website: "https://evil.example/path/" }, "UM26-1")).toBe(
      "https://evil.example/path?ref=UM26-1"
    );
    expect(buildOrgShareUrlWithRef({ website: "https://u-map.co.uk" }, "UM26-1", undefined, "B")).toBe(
      "https://u-map.co.uk?ref=UM26-1&rev=B"
    );
  });
});
