import { describe, expect, it } from "vitest";
import {
  AU_CERT_LIBRARY,
  certLabel,
  getCertLibraryForMarket,
  getPermitCertRequirementsForMarket,
} from "./certifications";

describe("certifications market", () => {
  it("returns AU cert library for au market", () => {
    const lib = getCertLibraryForMarket("au");
    expect(lib).toBe(AU_CERT_LIBRARY);
    expect(lib.some((c) => c.code === "white_card")).toBe(true);
    expect(lib.some((c) => c.code === "cscs")).toBe(false);
  });

  it("requires White Card for general AU permits", () => {
    expect(getPermitCertRequirementsForMarket("general", "au")).toContain("white_card");
    expect(getPermitCertRequirementsForMarket("general", "uk")).toContain("cscs");
  });

  it("labels AU tickets", () => {
    expect(certLabel("white_card", "au")).toMatch(/White Card/i);
    expect(certLabel("hrwl", "au")).toMatch(/HRWL/i);
  });
});
