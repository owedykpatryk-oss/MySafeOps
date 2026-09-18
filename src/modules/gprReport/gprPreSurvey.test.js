import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  blankGprPreSurvey,
  normalizeGprPreSurvey,
  applyGprStartHereCapture,
  captureGprStartHere,
  buildGprPreSurveyPrintHtml,
  buildPreSurveyScopeLine,
  toggleListKey,
  formatPreSurveyCoord,
  isGprPreSurveyStarted,
} from "./gprPreSurvey.js";
import { blankGprReport } from "./gprReportConstants.js";

vi.mock("../../utils/geoPhotoUtils", () => ({
  requestDeviceLocation: vi.fn(),
}));
vi.mock("../../utils/weatherSummary", () => ({
  fetchWeatherSummary: vi.fn(),
  resolveSiteCoordinates: vi.fn(),
}));

import { requestDeviceLocation } from "../../utils/geoPhotoUtils";
import { fetchWeatherSummary } from "../../utils/weatherSummary";

describe("gprPreSurvey", () => {
  it("normalizes partial pre-survey payloads", () => {
    const n = normalizeGprPreSurvey({ objectives: ["voids"], surveyDates: ["2026-09-18", "bad"] });
    expect(n.objectives).toEqual(["voids"]);
    expect(n.surveyDates).toEqual(["2026-09-18"]);
    expect(n.siteChecks.ramsBriefed).toBe(false);
    expect(n.photos).toEqual([]);
  });

  it("toggles objective keys", () => {
    expect(toggleListKey(["voids"], "services")).toEqual(["voids", "services"]);
    expect(toggleListKey(["voids", "services"], "voids")).toEqual(["services"]);
  });

  it("applies start capture without wiping photos or objectives", () => {
    const report = blankGprReport({
      surveyDate: "",
      preSurvey: blankGprPreSurvey({
        objectives: ["foundations", "voids"],
        photos: [{ id: "p1", dataUrl: "data:image/jpeg;base64,xx", caption: "North elevation" }],
        notes: "Look for pile caps",
      }),
    });
    const next = applyGprStartHereCapture(report, {
      startedAt: "2026-09-18T08:05:00.000Z",
      startedBy: "Pat",
      lat: 51.5,
      lng: -0.1,
      gpsAccuracyM: 8,
      gpsSource: "device",
      weather: { description: "Overcast", tempC: 12, windMph: 9, fetchedAt: "2026-09-18T08:05:00.000Z", source: "open-meteo" },
      surveyDates: ["2026-09-18"],
    });
    expect(isGprPreSurveyStarted(next.preSurvey)).toBe(true);
    expect(next.preSurvey.objectives).toEqual(["foundations", "voids"]);
    expect(next.preSurvey.photos).toHaveLength(1);
    expect(next.preSurvey.notes).toBe("Look for pile caps");
    expect(next.environmental.description).toBe("Overcast");
    expect(next.environmental.moistureImpactOnGpr).toMatch(/Overcast|12/i);
    expect(next.surveyDate).toBe("2026-09-18");
  });

  it("builds a scope line from objectives", () => {
    const line = buildPreSurveyScopeLine({
      objectives: ["services", "voids"],
      objectiveNotes: "Focus on the east wing.",
    });
    expect(line).toMatch(/Buried services/);
    expect(line).toMatch(/Voids/);
    expect(line).toMatch(/east wing/);
  });

  it("formats GPS for the report", () => {
    expect(formatPreSurveyCoord(51.5074, -0.1278, 6.2)).toBe("51.50740, -0.12780 (±6 m)");
    expect(formatPreSurveyCoord(null, null)).toBe("");
  });

  it("renders print HTML with GPS, weather, days and objectives", () => {
    const html = buildGprPreSurveyPrintHtml({
      startedAt: "2026-09-18T08:05:00.000Z",
      startedBy: "Pat",
      lat: 51.5,
      lng: -0.12,
      gpsAccuracyM: 5,
      gpsSource: "device",
      weather: { description: "Rain", tempC: 11, windMph: 14 },
      surveyDates: ["2026-09-18", "2026-09-19"],
      surfaceKeys: ["asphalt", "concrete"],
      moisture: "damp",
      objectives: ["foundations", "services"],
      siteChecks: { ramsBriefed: true, recordsReviewed: true },
      notes: "Looking for pile caps under the slab.",
      photos: [{ dataUrl: "data:image/jpeg;base64,abc", caption: "General site" }],
    });
    expect(html).toContain("Start here");
    expect(html).toContain("51.50000");
    expect(html).toContain("Rain");
    expect(html).toContain("Foundations");
    expect(html).toContain("Asphalt");
    expect(html).toContain("Looking for pile caps");
    expect(html).toContain("data:image/jpeg;base64,abc");
    expect(html).toContain("RAMS");
  });

  it("returns empty print HTML when nothing was captured", () => {
    expect(buildGprPreSurveyPrintHtml(blankGprPreSurvey())).toBe("");
  });
});

describe("captureGprStartHere", () => {
  beforeEach(() => {
    vi.mocked(requestDeviceLocation).mockResolvedValue({
      latitude: 51.51,
      longitude: -0.13,
      accuracy: 4,
    });
    vi.mocked(fetchWeatherSummary).mockResolvedValue({
      description: "Clear",
      tempC: 15,
      windMph: 8,
      fetchedAt: "2026-09-18T08:00:00.000Z",
      source: "open-meteo",
      text: "Clear 15C",
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stamps device GPS and live weather", async () => {
    const capture = await captureGprStartHere({
      report: blankGprReport({ surveyor: "Alex", surveyDate: "2026-09-18" }),
      project: { lat: 51, lng: 0 },
    });
    expect(capture.gpsSource).toBe("device");
    expect(capture.lat).toBe(51.51);
    expect(capture.weather.description).toBe("Clear");
    expect(capture.weather.tempC).toBe(15);
    expect(capture.startedBy).toBe("Alex");
    expect(capture.surveyDates).toEqual(["2026-09-18"]);
    expect(fetchWeatherSummary).toHaveBeenCalled();
  });

  it("falls back to project pin when GPS fails", async () => {
    vi.mocked(requestDeviceLocation).mockRejectedValue(new Error("User denied geolocation"));
    const capture = await captureGprStartHere({
      report: blankGprReport(),
      project: { lat: 53.48, lng: -2.24 },
    });
    expect(capture.gpsSource).toBe("project_pin");
    expect(capture.lat).toBe(53.48);
    expect(capture.gpsError).toMatch(/denied/i);
  });
});
