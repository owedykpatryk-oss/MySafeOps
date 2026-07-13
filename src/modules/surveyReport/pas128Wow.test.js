import { describe, expect, it } from "vitest";
import { blankSurveyReport } from "./surveyReportConstants.js";
import { buildFindingsDraft, buildFindingsFromUtilitiesTable } from "./pas128FindingsBuilder.js";
import { buildPas128WorkflowSvg, buildPas128QlBarsHtml } from "./pas128WorkflowDiagram.js";
import { getPas128WorkflowSteps } from "./pas128MethodPresets.js";

describe("pas128FindingsBuilder", () => {
  it("groups utilities by type", () => {
    const text = buildFindingsFromUtilitiesTable({
      utilitiesTable: [
        { utilityType: "gas", depth: "0.8 m", pas128Ql: "B2", method: "EML", notes: "Marked on site" },
        { utilityType: "gas", depth: "1.1 m", pas128Ql: "B1", method: "GPR" },
        { utilityType: "lv_cable", depth: "0.5 m", pas128Ql: "B2", confidence: "medium" },
      ],
    });
    expect(text).toMatch(/Gas/i);
    expect(text).toMatch(/LV cable/i);
    expect(text).toMatch(/2 features/);
  });

  it("buildFindingsDraft merges undertaker and utility tables", () => {
    const report = blankSurveyReport({
      pas128Method: "M1",
      undertakerResponses: [{ undertaker: "DNO", status: "affected", notes: "" }],
      utilitiesTable: [{ utilityType: "water", depth: "1 m", pas128Ql: "B4" }],
    });
    const text = buildFindingsDraft(report, { overwrite: true });
    expect(text).toMatch(/Affected: 1/i);
    expect(text).toMatch(/Water/i);
  });
});

describe("pas128WorkflowDiagram", () => {
  it("returns workflow steps for M4P", () => {
    expect(getPas128WorkflowSteps("M4P").length).toBeGreaterThan(4);
  });

  it("renders SVG pipeline", () => {
    const svg = buildPas128WorkflowSvg("M2P", { primary: "#0d9488" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("EML");
  });

  it("renders QL bar html", () => {
    const html = buildPas128QlBarsHtml({ B1: 3, B2: 2, B4: 1 }, { total: 6 });
    expect(html).toContain("sr-ql-bar-row");
    expect(html).toContain("B1");
  });
});
