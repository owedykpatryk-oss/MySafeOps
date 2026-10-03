/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { drawEmptyRegisterState, drawRegisterHeroBlock, tryAddLogo } from "./pdfBranding";

describe("PDF branding layout", () => {
  it("fits organisation logos inside the header without distorting their aspect ratio", () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    vi.spyOn(pdf, "getImageProperties").mockReturnValue({ width: 4, height: 1 });
    const addImage = vi.spyOn(pdf, "addImage").mockImplementation(() => pdf);

    expect(tryAddLogo(pdf, { logo: "data:image/png;base64,AA==" }, 12, 20, 20, 10)).toBe(24);
    expect(addImage.mock.calls[0].slice(2, 6)).toEqual([12, 22.5, 20, 5]);
  });

  it("keeps a long quick-start label within its visible pill", () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const roundedRect = vi.spyOn(pdf, "roundedRect");
    const originalText = pdf.text.bind(pdf);
    let textWidthAtDraw = 0;
    const text = vi.spyOn(pdf, "text").mockImplementation((value, ...args) => {
      if (typeof value === "string" && value.startsWith("Quick start:")) textWidthAtDraw = pdf.getTextWidth(value);
      return originalText(value, ...args);
    });
    drawEmptyRegisterState(pdf, {
      org: {},
      moduleLabel: "Test register",
      rgb: [15, 23, 42],
      accentRgb: [37, 99, 235],
      prebuildLabel: "Very long quick-start suggestion ".repeat(16),
      yStart: 40,
    });

    const labelCall = text.mock.calls.find(([value]) => typeof value === "string" && value.startsWith("Quick start:"));
    const buttonRect = roundedRect.mock.calls.find(([, y]) => y === 68);
    expect(labelCall?.[0]).toMatch(/…$/);
    expect(buttonRect).toBeDefined();
    expect(textWidthAtDraw).toBeLessThanOrEqual(buttonRect[2] - 10 + 0.01);
  });

  it("keeps long status chips inside the page and truncates them to their slots", () => {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const roundedRect = vi.spyOn(pdf, "roundedRect");
    const longStatus = "awaiting-additional-review-and-client-approval-".repeat(4);
    drawRegisterHeroBlock(pdf, {
      org: { name: "Flow Test" },
      moduleLabel: "Test register",
      rows: [longStatus, "another long status", "third status", "fourth status"].map((status) => ({ status })),
      rgb: [20, 40, 100],
      accentRgb: [240, 248, 255],
      theme: "executive",
      smartText: "A useful register tip.",
      yStart: 40,
    });

    const chips = roundedRect.mock.calls.slice(1);
    expect(chips).toHaveLength(4);
    expect(chips.every(([x, , width]) => x + width <= 198.01)).toBe(true);
  });
});
