/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  formatUtilityMappingRef,
  parseUtilityMappingRef,
  nextUtilityMappingJobNumber,
  formatUtilityMappingTypedRef,
  utilityMappingExportBaseName,
  nextUtilityMappingRamsDocNo,
} from "./utilityMappingDocRefs";
import {
  listUtilityMappingClients,
  utilityMappingClientLogoUrl,
  matchUtilityMappingClientCode,
  getUtilityMappingClient,
} from "./utilityMappingClients";
import {
  renderUtilityMappingExecutivePage,
  renderUtilityMappingDigReadinessPage,
  renderUtilityMappingDeliverablesPage,
  renderUtilityMappingAppendixDivider,
  computeUtilityMappingDigRisk,
} from "./utilityMappingPremiumPages";
import { nextSurveyRef } from "../modules/surveyReport/surveyReportHelpers";
import { buildSurveyReportHtml } from "../modules/surveyReport/surveyReportPrintHtml";
import { handoverPackBaseName } from "../modules/surveyReport/surveyHandoverPack";
import { nextGprRef } from "../modules/gprReport/gprReportHelpers";

describe("Utility Mapping UM26-job-CLIENT refs", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org" });
  });

  it("formats and parses UM26-1234-WSP", () => {
    expect(formatUtilityMappingRef({ yearYY: "26", jobNumber: "1234", clientCode: "wsp" })).toBe("UM26-1234-WSP");
    expect(parseUtilityMappingRef("UM26-1234-WSP")).toEqual({
      yearYY: "26",
      jobNumber: "1234",
      clientCode: "WSP",
    });
  });

  it("allocates next job number per year", () => {
    const existing = [{ ref: "UM26-10-WSP" }, { ref: "UM26-99-JAC" }, { ref: "UM25-500-WSP" }];
    expect(nextUtilityMappingJobNumber(existing, "26")).toBe("100");
  });

  it("nextSurveyRef uses UM format only for Utility Mapping org", () => {
    expect(nextSurveyRef([])).toMatch(/^SR-\d{4}-/);
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    expect(nextSurveyRef([], { umClientCode: "WSP" })).toMatch(/^UM\d{2}-\d+-WSP$/);
  });

  it("maps client catalogue + logos", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    expect(listUtilityMappingClients().length).toBeGreaterThan(40);
    expect(getUtilityMappingClient("WSP")?.name).toBe("WSP");
    expect(utilityMappingClientLogoUrl("WSP")).toContain("/branding/utility-mapping/clients/WSP.png");
    expect(matchUtilityMappingClientCode("Thames Water")).toBe("TWU");
  });

  it("hides client catalogue and logos for other orgs", () => {
    expect(listUtilityMappingClients()).toEqual([]);
    expect(getUtilityMappingClient("WSP")).toBeNull();
    expect(utilityMappingClientLogoUrl("WSP")).toBe("");
    expect(matchUtilityMappingClientCode("Thames Water")).toBe("");
  });

  it("formats typed refs and export base names", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    expect(formatUtilityMappingTypedRef("RA", { umJobNumber: "1234", umClientCode: "WSP" })).toBe("UM26-1234-WSP-RA");
    expect(parseUtilityMappingRef("UM26-1234-WSP-RA")).toMatchObject({
      yearYY: "26",
      jobNumber: "1234",
      clientCode: "WSP",
      docType: "RA",
    });
    expect(utilityMappingExportBaseName({ ref: "UM26-1234-WSP" }, "PAS128")).toBe("UM26-1234-WSP_PAS128");
    expect(nextUtilityMappingRamsDocNo([], { umJobNumber: "99", umClientCode: "JAC" })).toBe("UM26-99-JAC-RA");
    expect(handoverPackBaseName({ ref: "UM26-1234-WSP" })).toContain("UM26-1234-WSP");
  });

  it("hides typed refs / export names for other orgs", () => {
    expect(formatUtilityMappingTypedRef("RA", { umJobNumber: "1", umClientCode: "WSP" })).toBe("");
    expect(utilityMappingExportBaseName({ ref: "UM26-1-WSP" })).toBe("");
    expect(nextUtilityMappingRamsDocNo([], { umClientCode: "WSP" })).toBe("");
  });
});

describe("Utility Mapping premium print pages", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
  });

  it("renders executive / dig / deliverables / appendix only for UM", () => {
    const report = {
      title: "PAS128 M2",
      ref: "UM26-1234-WSP",
      umClientCode: "WSP",
      client: "WSP",
      pas128Method: "M2",
      sections: { scope: "Site A", executiveSummary: "Congested corridor." },
      utilitiesTable: [{ id: 1 }],
      photos: [],
    };
    expect(renderUtilityMappingExecutivePage(report)).toContain("um-exec-page");
    expect(renderUtilityMappingExecutivePage(report)).toContain("UM26-1234-WSP");
    expect(renderUtilityMappingDigReadinessPage(report)).toContain("um-dig-page");
    expect(renderUtilityMappingDigReadinessPage(report)).toContain("um-dig-score");
    const risk = computeUtilityMappingDigRisk(report);
    expect(risk.score).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(risk.band);
    expect(renderUtilityMappingDeliverablesPage(report)).toContain("um-del-page");
    expect(renderUtilityMappingAppendixDivider({ letter: "A", title: "Photos" })).toContain("um-appendix");

    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other" });
    expect(renderUtilityMappingExecutivePage(report)).toBe("");
  });

  it("injects premium pages into survey print HTML", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      primaryColor: "#0B1D3A",
      accentColor: "#00B4E4",
    });
    const html = buildSurveyReportHtml({
      title: "PAS128 M2 Report",
      ref: "UM26-1234-WSP",
      umClientCode: "WSP",
      client: "WSP",
      status: "draft",
      pas128Method: "M2",
      sections: { executiveSummary: "Key findings for dig risk.", scope: "Corridor survey." },
      utilitiesTable: [{ id: "u1" }],
      photos: [{ dataUrl: "data:image/png;base64,aaa", caption: "Mark-up" }],
      documentControl: { preparedBy: "Surveyor", checkedBy: "Checker" },
    });
    expect(html).toContain("um-exec-page");
    expect(html).toContain("um-dig-page");
    expect(html).toContain("um-del-page");
    expect(html).toContain("um-dwg-page");
    expect(html).toContain("um-approval");
    expect(html).toContain("um-appendix");
    expect(html).toContain("Authorised for issue");
    expect(html).toContain("UM26-1234-WSP");
    expect(html).toContain("/branding/utility-mapping/clients/WSP.png");
  });

  it("does not inject UM premium pages for other orgs", () => {
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org" });
    const html = buildSurveyReportHtml({
      title: "Survey",
      ref: "SR-2026-001",
      umClientCode: "WSP",
      client: "WSP",
      status: "draft",
      sections: { executiveSummary: "x", scope: "y" },
      photos: [{ dataUrl: "data:image/png;base64,aaa", caption: "p" }],
    });
    expect(html).not.toContain("um-exec-page");
    expect(html).not.toContain("um-dig-page");
    expect(html).not.toContain("um-del-page");
    expect(html).not.toContain("um-dwg-page");
    expect(html).not.toContain("um-approval");
    expect(html).not.toContain("um-appendix");
    expect(html).not.toContain("um-hero-cover");
    expect(html).not.toContain("/branding/utility-mapping/clients/");
  });

  it("uses UM26 typed refs for GPR when Utility Mapping", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    expect(nextGprRef([], { umJobNumber: "55", umClientCode: "WSP" })).toBe("UM26-55-WSP-GPR");
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other" });
    expect(nextGprRef([])).toMatch(/^GPR-\d{4}-/);
  });
});
