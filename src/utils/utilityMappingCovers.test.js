/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  getUtilityMappingCoverAssets,
  renderUtilityMappingHeroCover,
  renderUtilityMappingDocControlPage,
  renderUtilityMappingPageHeader,
  renderUtilityMappingComplianceRibbon,
  utilityMappingPas128CoverBadges,
  resolveUtilityMappingLogoSrc,
  utilityMappingCoverSystemCss,
} from "./utilityMappingCovers";
import {
  utilityMappingBodyPrintCss,
  utilityMappingCoverKitChips,
} from "./utilityMappingPrintTheme";
import { buildGprReportHtml } from "../modules/gprReport/gprReportPrintHtml";
import { generatePrintHTML } from "../modules/rams/ramsPrintHtml";
import { buildSurveyReportHtml } from "../modules/surveyReport/surveyReportPrintHtml";

describe("Utility Mapping cover assets exclusivity", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org" });
  });

  it("returns no cover assets for other orgs", () => {
    expect(getUtilityMappingCoverAssets()).toBeNull();
    expect(renderUtilityMappingHeroCover({ title: "Test" })).toBe("");
    expect(renderUtilityMappingDocControlPage({ client: "X" })).toBe("");
    expect(utilityMappingBodyPrintCss()).toBe("");
    expect(utilityMappingCoverSystemCss()).toBe("");
    expect(renderUtilityMappingComplianceRibbon()).toBe("");
  });

  it("renders hero cover with logo, kit strip and PAS128 artwork for Utility Mapping only", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    const assets = getUtilityMappingCoverAssets();
    expect(assets?.hero).toContain("cover-hero.jpg");
    expect(assets?.letterhead).toContain("letterhead.jpg");
    expect(assets?.logo).toContain("utility-mapping-logo.png");
    const html = renderUtilityMappingHeroCover({
      title: "PAS128 M2 Utility Survey Report",
      badge: "Draft",
      methodBadge: "M2",
      qlBadge: "QL-B",
      kitChips: ["PAS 128:2014", "EML", "GPR"],
      meta: [["Client", "Grid IQ"]],
    });
    expect(html).toContain("um-hero-cover");
    expect(html).toContain("cover-hero.jpg");
    expect(html).toContain("um-wordmark");
    expect(html).toContain("um-signal");
    expect(html).toContain("MAPPING");
    expect(html).toContain("um-hero-cover__chip");
    expect(html).toContain("um-kit-chip");
    expect(html).toContain("PAS 128:2014");
    expect(html).toContain("M2");
    expect(html).toContain("QL-B");
    expect(html).toContain("um-hero-cover__glow");
    expect(resolveUtilityMappingLogoSrc({})).toContain("utility-mapping-logo.png");
  });

  it("renders letterhead header and PAS128 compliance ribbon", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    const header = renderUtilityMappingPageHeader(undefined, "UM26-001");
    expect(header).toContain("um-page-header");
    expect(header).toContain("letterhead.jpg");
    expect(header).toContain("UM26-001");
    const ribbon = renderUtilityMappingComplianceRibbon();
    expect(ribbon).toContain("um-compliance-ribbon");
    expect(ribbon).toContain("PAS 128");
  });

  it("renders document-control page 2 with Author / Checked / Client Acceptance", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    const html = renderUtilityMappingDocControlPage({
      client: "National Grid",
      title: "Rugby PAS128 M2",
      reportRef: "UM26-001",
      authors: [{ name: "Patryk", title: "Utility Surveyor", date: "16/07/2026" }],
      checkedBy: { name: "TM", title: "Technical Manager", date: "16/07/2026" },
    });
    expect(html).toContain("um-doc-control");
    expect(html).toContain("Author");
    expect(html).toContain("Checked By");
    expect(html).toContain("Client Acceptance");
    expect(html).toContain("National Grid");
    expect(html).toContain("Patryk");
  });

  it("normalises PAS128 method chips and kit defaults", () => {
    expect(utilityMappingPas128CoverBadges("m2p", "B2")).toEqual({
      methodBadge: "M2P",
      qlBadge: "QL-B2",
    });
    const kit = utilityMappingCoverKitChips({ pas128Method: "M2P" });
    expect(kit).toContain("PAS 128:2014");
    expect(kit).toContain("EML");
    expect(kit).toContain("GPR");
    expect(kit).toContain("Post-process");
  });

  it("injects body theme CSS for UM only", () => {
    expect(utilityMappingBodyPrintCss()).toBe("");
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({ name: "Utility Mapping", website: "https://u-map.co.uk/" });
    const css = utilityMappingBodyPrintCss();
    expect(css).toContain(".sr-toc");
    expect(css).toContain(".sr-section h2");
    expect(css).toContain(".sr-callout");
    expect(css).toContain(".sr-sig-box");
    expect(css).toContain(".sr-disclaimer");
  });

  it("applies UM cover + doc control + body wow to survey / GPR / RAMS print", () => {
    setOrgId("utility-mapping");
    saveOrgSettingsRaw({
      name: "Utility Mapping",
      website: "https://u-map.co.uk/",
      primaryColor: "#0B1D3A",
      accentColor: "#00B4E4",
    });
    const survey = buildSurveyReportHtml({
      title: "PAS128 M2 Report",
      ref: "UM26-100",
      status: "draft",
      client: "Test Client",
      pas128Method: "M2",
      pas128Ql: "B2",
      surveyor: "Surveyor",
      documentControl: { preparedBy: "Surveyor", checkedBy: "Checker" },
      sections: { executiveSummary: "Summary for TOC." },
    });
    expect(survey).toContain("um-hero-cover");
    expect(survey).toContain("um-doc-control");
    expect(survey).toContain("Client Acceptance");
    expect(survey).toContain("M2");
    expect(survey).toContain("um-kit-chip");
    expect(survey).toContain("um-compliance-ribbon");
    expect(survey).toContain("letterhead.jpg");
    expect(survey).toContain(".sr-section h2");

    const gpr = buildGprReportHtml({
      title: "GPR Report",
      ref: "GPR-1",
      status: "draft",
      sections: {},
    });
    expect(gpr).toContain("um-hero-cover");
    expect(gpr).toContain("um-doc-control");
    expect(gpr).toContain("cover-hero.jpg");
    expect(gpr).toContain("um-compliance-ribbon");

    const rams = generatePrintHTML(
      { title: "PAS128 field RAMS", documentNo: "UM-RA-1", documentStatus: "draft", location: "Rugby" },
      [],
      [],
      {},
      {},
      null,
      []
    );
    expect(rams).toContain("um-hero-cover");
    expect(rams).toContain("um-doc-control");
    expect(rams).toContain("utility-mapping-logo.png");
    expect(rams).toContain(".rams-content h1");
  });

  it("does not put UM cover on GPR/RAMS for other orgs", () => {
    const gpr = buildGprReportHtml({ title: "GPR", ref: "G1", status: "draft", sections: {} });
    expect(gpr).not.toContain("um-hero-cover");
    expect(gpr).not.toContain("um-doc-control");
    expect(gpr).not.toContain("um-compliance-ribbon");
    const rams = generatePrintHTML({ title: "RAMS", documentStatus: "draft" }, [], [], {}, {}, null, []);
    expect(rams).not.toContain("um-hero-cover");
    expect(rams).not.toContain("um-doc-control");
  });
});
