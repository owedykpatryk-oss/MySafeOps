/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { getSurveyCaptureScale, planSurveyPdfSlices } from "./surveyReportPdf";

describe("survey report PDF pagination", () => {
  it("keeps long captures within browser canvas limits while improving short-report resolution", () => {
    expect(getSurveyCaptureScale(4000)).toBe(2);
    expect(getSurveyCaptureScale(10000)).toBe(1.5);
    expect(getSurveyCaptureScale(20000)).toBe(1);
  });

  it("starts a new page at a forced break and reserves room for continued table headers", () => {
    const slices = planSurveyPdfSlices({
      contentHeight: 3200,
      pageHeight: 1000,
      forcedBreaks: [600],
      keepTogether: [{ top: 900, bottom: 1100 }],
      repeatingHeaders: [{ tableTop: 800, tableBottom: 2700, headerTop: 800, headerBottom: 880 }],
    });

    expect(slices[0].end).toBe(600);
    const continuedTableSlice = slices.find((slice) => slice.repeatHeader);
    expect(continuedTableSlice?.repeatHeader).toMatchObject({ headerTop: 800, headerBottom: 880 });
    expect(continuedTableSlice.end - continuedTableSlice.start).toBeLessThanOrEqual(920);
    expect(slices.at(-1).end).toBe(3200);
  });
});
