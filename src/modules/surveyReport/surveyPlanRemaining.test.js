import { describe, expect, it } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants";
import { normalizeSurveyReport } from "./surveyReportHelpers";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml";
import {
  formatDualPas128Method,
  buildAocChainageRibbonHtml,
  buildEquipmentAppendixHtml,
  buildMhIcCardsHtml,
  buildGeologyBlockHtml,
  reorderSectionsForUmClassic,
  umClassicSectionTitle,
  seedSmartFillPremiumV2,
  blankMhIcCard,
} from "./surveyPlanRemaining";

describe("surveyPlanRemaining", () => {
  it("formats dual PAS128 methods for cover", () => {
    expect(formatDualPas128Method("M2", "M4P")).toBe("M2 + M4P");
    expect(formatDualPas128Method("M2", "M2")).toBe("M2");
    expect(formatDualPas128Method("", "M3")).toBe("M3");
  });

  it("builds AOC chainage ribbon when chainages present", () => {
    const html = buildAocChainageRibbonHtml([
      { label: "AOC1", chainage: "CH 1100m" },
      { label: "AOC2", chainage: "CH 1400m" },
    ]);
    expect(html).toContain("sr-aoc-ribbon");
    expect(html).toContain("CH 1100m");
    expect(html).toContain("AOC2");
  });

  it("builds equipment appendix and MH/IC / geology blocks", () => {
    expect(
      buildEquipmentAppendixHtml([
        { tradeName: "RD8000", technique: "EML", appendixRef: "Appendix 1", manufacturer: "Radiodetection" },
      ])
    ).toMatch(/Appendix 1/);
    expect(buildMhIcCardsHtml([blankMhIcCard({ ref: "MH01", coverLevel: "12.45" })])).toContain("MH01");
    expect(buildGeologyBlockHtml({ formation: "Thanet Formation", implications: "Attenuation" })).toContain("Thanet");
  });

  it("reorders sections for UM classic outline", () => {
    const ordered = reorderSectionsForUmClassic([
      { id: "qa", html: "qa" },
      { id: "foreword", html: "fw" },
      { id: "findings", html: "f" },
      { id: "scope", html: "sc" },
    ]);
    expect(ordered.map((s) => s.id)).toEqual(["foreword", "scope", "findings", "qa"]);
    expect(umClassicSectionTitle("scope", "Scope")).toBe("2. Project requirements");
  });

  it("smart-fill v2 seeds extent, records and geology stubs", () => {
    const seeded = seedSmartFillPremiumV2(
      blankSurveyReport({
        surveyType: "utility_mapping_survey",
        siteAddress: "Test Site",
        pas128Method: "M3",
      })
    );
    expect(seeded.extentAreas.length).toBeGreaterThan(0);
    expect(seeded.recordItems.length).toBeGreaterThan(0);
    expect(seeded.geology?.implications).toMatch(/BGS/i);
  });

  it("print html includes ribbon, dual method, appendix and classic title", () => {
    const report = normalizeSurveyReport(
      blankSurveyReport({
        title: "Plan upgrade smoke",
        surveyType: "utility_mapping_survey",
        pas128Method: "M2",
        pas128MethodSecondary: "M4P",
        printOutline: "um_classic",
        siteAddress: "Site Rd",
        sections: {
          scope: "Scope text",
          surveyExtent: "Extent notes",
          findings: "Findings text",
          methodology: "Method text",
        },
        extentAreas: [
          { id: "a1", label: "AOC1", chainage: "CH 100" },
          { id: "a2", label: "AOC2", chainage: "CH 200" },
        ],
        equipmentKit: [{ id: "k1", tradeName: "RD8000", technique: "EML", appendixRef: "Appendix 1" }],
        mhIcCards: [blankMhIcCard({ ref: "IC02", coverLevel: "10.1", invertLevel: "8.2" })],
        geology: {
          formation: "London Clay",
          implications: "Shallow GPR only",
          notes: "",
          disclaimer: "BGS 1:625,000 digital geology is a regional overview only — not a site investigation.",
          scale: "1:625,000 (generalised)",
          queryLat: 51.5,
          queryLng: -0.12,
          materialClass: "clay_silt",
        },
        utilitiesTable: [
          {
            utilityType: "gas",
            diameter: "125 mm",
            material: "PE",
            depth: "0.9 m",
            source: "eml",
            detectStatus: "detected",
            pas128Ql: "B2",
          },
        ],
      })
    );
    const html = buildSurveyReportHtml(report);
    expect(html).toContain("M2 + M4P");
    expect(html).toContain("sr-aoc-ribbon");
    expect(html).toContain("Appendix 1");
    expect(html).toContain("IC02");
    expect(html).toContain("London Clay");
    expect(html).toMatch(/not a site investigation/i);
    expect(html).toContain("2. Project requirements");
    expect(html).toMatch(/125 mm/);
    expect(html).toMatch(/PE/);
  });

  it("prints ground and water strike columns once the field recorded them", () => {
    const report = normalizeSurveyReport(
      blankSurveyReport({
        surveyType: "site_investigation_campaign",
        giLocationsTable: [
          {
            id: "gi1",
            locationId: "TP03",
            method: "Hand dig",
            depth: "2.4 m",
            ground: "Made ground",
            waterStrike: "1.8 m bgl",
            reinstatement: "Permanent",
          },
        ],
      })
    );
    const html = buildSurveyReportHtml(report);
    expect(html).toContain("Water strike");
    expect(html).toContain("1.8 m bgl");
    expect(html).toContain("Made ground");
  });

  it("keeps the narrow GI table when only location, method and depth were recorded", () => {
    const report = normalizeSurveyReport(
      blankSurveyReport({
        surveyType: "site_investigation_campaign",
        giLocationsTable: [{ id: "gi1", locationId: "BH01", method: "Borehole", depth: "12.5 m" }],
      })
    );
    const html = buildSurveyReportHtml(report);
    expect(html).toContain("BH01");
    expect(html).not.toContain("Water strike");
  });
});
