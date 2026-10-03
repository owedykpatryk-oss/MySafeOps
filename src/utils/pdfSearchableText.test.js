/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { drawPdfSearchableText } from "./pdfSearchableText";

describe("PDF searchable text layer", () => {
  it("places page words invisibly inside their matching page slice", () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const text = vi.spyOn(pdf, "text");
    const drawn = drawPdfSearchableText(
      pdf,
      [
        { text: "continued", left: 20, top: 110, fontSize: 12, bold: true },
        { text: "outside", left: 20, top: 210, fontSize: 12, bold: false },
      ],
      { sourceStart: 100, sourceEnd: 200, pixelsPerMm: 5, marginXmm: 10, marginYmm: 12, pageContentHeightPx: 100 }
    );

    expect(drawn).toBe(1);
    expect(text).toHaveBeenCalledWith(
      "continued",
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ renderingMode: "invisible" })
    );
    expect(pdf.output()).toContain("3 Tr");
  });
});
