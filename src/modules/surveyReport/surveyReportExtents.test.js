import { describe, expect, it, beforeEach } from "vitest";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml.js";
import { blankSurveyReport } from "./surveyReportConstants.js";

/** A ~1 ha ring traced round overgrown ground, and a smaller one round an obstruction. */
const OVERGROWN = [
  [51.5, -0.1],
  [51.5009, -0.1],
  [51.5009, -0.09855],
  [51.5, -0.09855],
];
const BLOCKED = [
  [51.502, -0.1],
  [51.5023, -0.1],
  [51.5023, -0.0995],
  [51.502, -0.0995],
];

function reportWithExtents() {
  return blankSurveyReport({
    title: "Field survey",
    photos: [
      {
        id: "sr_gp_1",
        geoPhotoId: "g1",
        geoPhotoType: "vegetation",
        dataUrl: "data:image/jpeg;base64,abc",
        caption: "Scrub across the verge",
        latitude: 51.5,
        longitude: -0.1,
        area: { points: OVERGROWN },
      },
      {
        id: "sr_gp_2",
        geoPhotoId: "g2",
        geoPhotoType: "obstruction",
        dataUrl: "data:image/jpeg;base64,def",
        caption: "Stored material",
        latitude: 51.502,
        longitude: -0.1,
        area: { points: BLOCKED },
      },
    ],
  });
}

describe("survey report — ground extents", () => {
  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
  });

  it("schedules the traced ground with a total, largest first", () => {
    const html = buildSurveyReportHtml(reportWithExtents(), {});

    expect(html).toContain("Ground extents recorded on site");
    expect(html).toContain("1.00 ha");
    expect(html).toContain("<strong>Total</strong>");
    // Vegetation is the bigger of the two, so it heads the schedule.
    expect(html.indexOf("Vegetation")).toBeLessThan(html.indexOf("Obstruction"));
  });

  it("plots the photo locations as a site plan with the extents shaded", () => {
    const html = buildSurveyReportHtml(reportWithExtents(), {});

    expect(html).toContain("numbers match the figures below");
    expect(html).toContain("2 extents shaded");
    // The plan travels inside the HTML, so print and PDF never wait on a tile host.
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain("%3Cpolygon");
  });

  it("says nothing about extents when nobody traced any", () => {
    const bare = blankSurveyReport({
      title: "Field survey",
      photos: [{ id: "p1", dataUrl: "data:image/jpeg;base64,abc", caption: "Site" }],
    });
    const html = buildSurveyReportHtml(bare, {});

    expect(html).not.toContain("Ground extents recorded on site");
  });
});
