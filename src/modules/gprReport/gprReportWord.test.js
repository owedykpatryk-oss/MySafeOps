/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { blankGprReport } from "./gprReportConstants.js";
import { buildGprReportWord, extractGprWordBlocks } from "./gprReportWord.js";
import { buildGprReportHtml } from "./gprReportPrintHtml.js";
import { saveOrgSettingsRaw } from "../../utils/orgSettingsStorage.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP88OUHAwMDEwMYAAAicgLgWFApXwAAAABJRU5ErkJggg==";

function readBlobBytes(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe("GPR editable Word export", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it("keeps editable report text, tables and every included image in DOCX", async () => {
    const report = blankGprReport({
      ref: "GPR/TEST-1",
      title: "Airport corridor GPR",
      client: "Example client",
      includeHistoricalEvidence: true,
      sections: { findings: "Distinctive editable finding." },
      preSurvey: { photos: [{ dataUrl: PNG, caption: "Site overview" }] },
      radargrams: [{ dataUrl: PNG, label: "Radargram line A" }],
      planFigures: [{ dataUrl: PNG, label: "Plan layout A" }],
      photos: [{ dataUrl: PNG, caption: "Extra report photo" }],
      anomalies: [{ ref: "A1", interpretation: "Possible service", figures: [{ role: "gpr", dataUrl: PNG, annotations: [{ type: "pin", number: 1, text: "Pin note in editable Word" }] }] }],
      historicalEvidence: [{ id: "map", verified: true, sourceUrl: "https://example.org/map", sourceName: "Archive", observedFact: "A former building is depicted.", imageDataUrl: PNG }],
    });
    const html = buildGprReportHtml(report);
    const blocks = extractGprWordBlocks(html);
    const imageCount = blocks.filter((block) => block.type === "image").length;
    expect(imageCount).toBeGreaterThanOrEqual(4);
    expect(blocks.some((block) => block.type === "table")).toBe(true);

    const result = await buildGprReportWord(report);
    expect(result.fileName).toBe("GPR-TEST-1.docx");
    expect(result.imageCount).toBe(imageCount + 1);
    const zip = unzipSync(await readBlobBytes(result.blob));
    const word = strFromU8(zip["word/document.xml"]);
    expect(word).toContain("Airport corridor GPR");
    expect(word).toContain("Distinctive editable finding.");
    expect(word).toContain("A former building is depicted.");
    expect(word).toContain("Radargram line A");
    expect(word).toContain("<w:tbl>");
    expect(word).toContain("Extra report photo");
    expect(word).toContain("Pin note in editable Word");
    expect((word.match(/<w:drawing>/g) || []).length).toBe(result.imageCount);
    expect(word).toContain('name="Site overview"');
    expect(word).toContain('w:pageBreakBefore');
    expect(Object.keys(zip).filter((name) => name.startsWith("word/media/") && !name.endsWith("/"))).toHaveLength(1);
  });

  it("respects optional desk-study switches in the Word content", async () => {
    const report = blankGprReport({
      includeGeology: false,
      includeHistoricalEvidence: false,
      groundConditions: { narrative: "Saved mapped clay." },
      historicalEvidence: [{ id: "map", verified: true, sourceUrl: "https://example.org/map", observedFact: "Saved historic evidence.", imageDataUrl: PNG }],
    });
    const { blob, imageCount } = await buildGprReportWord(report);
    const zip = unzipSync(await readBlobBytes(blob));
    const word = strFromU8(zip["word/document.xml"]);
    expect(word).not.toContain("Saved mapped clay.");
    expect(word).not.toContain("Saved historic evidence.");
    expect(imageCount).toBe(0);
  });
});
