import { describe, expect, it } from "vitest";
import { planGprPdfSlices } from "./gprPdfPagination.js";

describe("planGprPdfSlices", () => {
  it("moves a page cut above a table row or figure that would be split", () => {
    const slices = planGprPdfSlices({
      contentHeight: 2300,
      pageHeight: 1000,
      keepTogether: [{ top: 920, bottom: 1120 }],
    });
    expect(slices[0]).toMatchObject({ start: 0, end: 920, repeatHeader: null });
    expect(slices[1].start).toBe(920);
  });

  it("prefers an outer card over a nested paragraph at the same boundary", () => {
    const slices = planGprPdfSlices({
      contentHeight: 2200,
      pageHeight: 1000,
      keepTogether: [
        { top: 760, bottom: 1160 },
        { top: 910, bottom: 1100 },
      ],
    });
    expect(slices[0].end).toBe(760);
  });

  it("honours forced cover and contents page boundaries", () => {
    const slices = planGprPdfSlices({
      contentHeight: 2600,
      pageHeight: 1000,
      forcedBreaks: [860, 1500],
    });
    expect(slices.slice(0, 2)).toMatchObject([
      { start: 0, end: 860, repeatHeader: null },
      { start: 860, end: 1500, repeatHeader: null },
    ]);
  });

  it("allows an over-height block to flow across pages", () => {
    const slices = planGprPdfSlices({
      contentHeight: 2500,
      pageHeight: 1000,
      keepTogether: [{ top: 400, bottom: 1800 }],
    });
    expect(slices[0]).toMatchObject({ start: 0, end: 1000, repeatHeader: null });
    expect(slices.at(-1).end).toBe(2500);
  });

  it("reserves space and repeats a table header on continuation pages", () => {
    const slices = planGprPdfSlices({
      contentHeight: 2500,
      pageHeight: 1000,
      repeatingHeaders: [{ tableTop: 400, tableBottom: 2300, headerTop: 400, headerBottom: 470 }],
    });
    expect(slices[0].repeatHeader).toBeNull();
    expect(slices[1]).toMatchObject({
      start: 1000,
      end: 1930,
      repeatHeader: { headerTop: 400, headerBottom: 470 },
    });
    expect(slices[2].repeatHeader).toMatchObject({ headerTop: 400, headerBottom: 470 });
  });

  it("leaves a safety gutter at natural raster boundaries without dropping content", () => {
    const slices = planGprPdfSlices({
      contentHeight: 2400,
      pageHeight: 1000,
      boundarySafety: 16,
    });
    expect(slices[0]).toMatchObject({ start: 0, end: 984 });
    expect(slices[1].start).toBe(984);
    expect(slices.at(-1).end).toBe(2400);
  });
});
