import { describe, it, expect, beforeEach } from "vitest";
import {
  buildUtilitiesScheduleCsv,
  buildUndertakerResponsesCsv,
  buildHandoverReadme,
  handoverPackBaseName,
  buildCadLengthsCsv,
  buildCadSidecarJson,
  buildVerificationSheetHtml,
  buildGprAnomalyCardsCsv,
  buildDrawingRegisterCsv,
} from "./surveyHandoverPack.js";

describe("surveyHandoverPack", () => {
  beforeEach(() => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  });

  it("builds utilities CSV with header and escaped cells", () => {
    const csv = buildUtilitiesScheduleCsv({
      utilitiesTable: [
        {
          utilityType: "electricity",
          depth: "0.8m",
          method: "EML",
          pas128Ql: "D",
          confidence: "high",
          notes: 'Near "main" route',
        },
      ],
    });
    expect(csv.split("\n")[0]).toContain("Utility");
    expect(csv).toContain("0.8m");
    expect(csv).toContain('"Near ""main"" route"');
  });

  it("returns empty undertaker CSV when no rows", () => {
    expect(buildUndertakerResponsesCsv({ undertakerResponses: [] })).toBe("");
  });

  it("builds undertaker CSV with status labels", () => {
    const csv = buildUndertakerResponsesCsv({
      undertakerResponses: [
        { undertaker: "Acme Water", category: "water", status: "affected", responseDate: "2026-01-10", notes: "" },
      ],
    });
    expect(csv).toContain("Acme Water");
    expect(csv).toContain("Affected");
  });

  it("builds README with report metadata and verify sheet", () => {
    const readme = buildHandoverReadme({
      ref: "SR-001",
      title: "Site utility survey",
      pas128Ql: "B2",
      pas128Method: "M2",
      status: "final",
      utilitiesTable: [{ utilityType: "gas" }],
      deliverables: ["PDF report", "Utility schedule"],
    });
    expect(readme).toContain("SR-001");
    expect(readme).toContain("B2");
    expect(readme).toContain("report/report.pdf");
    expect(readme).toContain("verify/control-sheet.html");
    expect(readme).toContain("PDF report");
  });

  it("sanitizes handover pack base name", () => {
    expect(handoverPackBaseName({ ref: "SR 001/Rev A" })).toMatch(/SR/);
  });

  it("builds CAD sidecar and lengths CSV", () => {
    const report = {
      cadImport: {
        fileName: "site.dxf",
        summary: [{ label: "Gas", lengthM: 120, pas128Ql: "B2", isRecordsDerived: false, layer: "GAS" }],
        preview: { bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, paths: [{ pts: [[0, 0], [1, 1]] }] },
      },
    };
    expect(buildCadLengthsCsv(report)).toContain("Gas");
    expect(buildCadSidecarJson(report)).toContain("mysafeops.cad-sidecar.v1");
  });

  it("builds verification sheet with dig strip", () => {
    const html = buildVerificationSheetHtml(
      { ref: "UM26-1-WSP", title: "Test", status: "final", pas128Ql: "B2" },
      { shareUrl: "https://u-map.co.uk/?ref=UM26-1-WSP", digRisk: { band: "high", label: "High dig risk", score: 80 } }
    );
    expect(html).toContain("Document verification");
    expect(html).toContain("High dig risk");
    expect(html).toContain("Verification QR");
  });

  it("builds drawing and GPR CSVs", () => {
    expect(
      buildDrawingRegisterCsv({ drawingSheets: [{ sheetNo: "01", title: "Utilities", revision: "A" }] })
    ).toContain("Utilities");
    expect(
      buildGprAnomalyCardsCsv({
        gprAnomalyCards: [{ ref: "A-1", classKey: "linear", depthMinM: "0.8", interpretation: "duct" }],
      })
    ).toContain("A-1");
  });
});
