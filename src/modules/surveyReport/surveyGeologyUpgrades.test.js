import { describe, expect, it } from "vitest";
import {
  collectGeologySamplePoints,
  applyTrialHolesToUtilities,
  seedTfrCadNotesFromRecords,
  boreholeScanLinkHtml,
  buildGeologySamplePointsHtml,
} from "./surveyGeologyUpgrades.js";
import { blankSurveyReport } from "./surveyReportConstants.js";
import { buildGeologyBlockHtml } from "./surveyPlanRemaining.js";

describe("surveyGeologyUpgrades", () => {
  it("collects primary + AOC sample points up to 3", () => {
    const pts = collectGeologySamplePoints(
      {
        extentAreas: [
          { id: "a1", label: "AOC1", lat: "51.51", lng: "-0.11" },
          { id: "a2", label: "AOC2", lat: "51.52", lng: "-0.10" },
          { id: "a3", label: "AOC3", lat: "51.53", lng: "-0.09" },
        ],
      },
      { lat: 51.5, lng: -0.12, label: "Project pin" }
    );
    expect(pts).toHaveLength(3);
    expect(pts[0].label).toBe("Project pin");
    expect(pts[1].label).toBe("AOC1");
  });

  it("applies trial holes to utilities as QL-B0", () => {
    const next = applyTrialHolesToUtilities(
      blankSurveyReport({
        utilitiesTable: [{ utilityType: "gas", depth: "0.9 m", pas128Ql: "B2", notes: "" }],
        trialHolesTable: [
          { holeId: "TH01", utilityVerified: "gas", depth: "0.95 m", result: "Confirmed PE", pas128Ql: "B0" },
        ],
      })
    );
    expect(next.utilitiesTable[0].pas128Ql).toBe("B0");
    expect(next.utilitiesTable[0].notes).toMatch(/TH01/);
    expect(next._trialHoleApply.updated).toBe(1);
  });

  it("seeds TFR CAD notes from record matrix", () => {
    const next = seedTfrCadNotesFromRecords(
      blankSurveyReport({
        recordItems: [{ undertaker: "SGN", serviceType: "gas", status: "tfr", notes: "No context on records" }],
        sitePlanSummary: "Existing plan note.",
      })
    );
    expect(next.sitePlanSummary).toMatch(/TFR — SGN/);
    expect(next.sitePlanSummary).toMatch(/Existing plan note/);
  });

  it("builds safe borehole scan links", () => {
    const html = boreholeScanLinkHtml({
      reference: "TQ37NW1",
      scanUrl: "https://api.bgs.ac.uk/sobi-scans/v1/borehole/scans/items/1",
    });
    expect(html).toMatch(/href="https:\/\/api\.bgs\.ac\.uk/);
    expect(html).toMatch(/TQ37NW1/);
    expect(boreholeScanLinkHtml({ reference: "X", scanUrl: "javascript:alert(1)" })).toBe("X");
  });

  it("print geology block includes scan links and multi-sample table", () => {
    const html = buildGeologyBlockHtml({
      formation: "Alluvium",
      implications: "Test",
      disclaimer: "Desk study",
      nearbyBoreholes: [
        {
          reference: "TQ37NW1",
          distanceM: 40,
          lengthM: 9,
          scanUrl: "https://api.bgs.ac.uk/sobi-scans/v1/borehole/scans/items/1",
        },
      ],
      samplePoints: [
        { label: "Pin", lat: 51.5, lng: -0.12, materialClass: "clay_silt", superficialLabel: "Alluvium" },
        { label: "AOC2", lat: 51.51, lng: -0.11, materialClass: "sand_gravel", superficialLabel: "River terrace" },
      ],
    });
    expect(html).toMatch(/TQ37NW1/);
    expect(html).toMatch(/href=/);
    expect(html).toMatch(/Multi-point BGS samples/);
    expect(buildGeologySamplePointsHtml([{ label: "Only one" }])).toBe("");
  });
});
