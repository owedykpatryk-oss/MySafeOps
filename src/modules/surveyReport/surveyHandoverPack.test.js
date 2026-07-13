import { describe, it, expect } from "vitest";
import {
  buildUtilitiesScheduleCsv,
  buildUndertakerResponsesCsv,
  buildHandoverReadme,
  handoverPackBaseName,
} from "./surveyHandoverPack.js";

describe("surveyHandoverPack", () => {
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

  it("builds README with report metadata", () => {
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
    expect(readme).toContain("PDF report");
  });

  it("sanitizes handover pack base name", () => {
    expect(handoverPackBaseName({ ref: "SR 001/Rev A" })).toMatch(/SR/);
  });
});
