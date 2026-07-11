/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { FESS_MC_PDF_FILES, getMcPdfCoverage, getStarterKeyForMcPdf } from "./fessMcPdfIndex";

describe("fessMcPdfIndex", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
  });

  it("lists 22 canonical MC PDF files", () => {
    expect(FESS_MC_PDF_FILES).toHaveLength(22);
  });

  it("maps all MC PDFs to job starters for FESS org", () => {
    const coverage = getMcPdfCoverage();
    expect(coverage.total).toBe(22);
    expect(coverage.complete).toBe(true);
    expect(coverage.missing).toEqual([]);
  });

  it("resolves starter key for known PDF", () => {
    expect(getStarterKeyForMcPdf("2SFG SCUNTHORPE FP1 WORKS ON SITE.pdf")).toBe("fp1_works");
    expect(getStarterKeyForMcPdf("BUTTERNUT BOX INSTALLATION 251125.pdf")).toBe("butternut_install");
  });
});
