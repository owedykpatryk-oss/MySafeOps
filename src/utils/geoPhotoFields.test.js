import { describe, it, expect } from "vitest";
import {
  isGiGeoPhotoType,
  resolvedGiLocationId,
  resolvedGiDepth,
  buildStructuredGeoPhotoNotes,
  suggestedGeoPhotoPresetForPermit,
  permitHasSiteEvidence,
  parseLocationIdFromNotes,
} from "./geoPhotoFields.js";

describe("geoPhotoFields", () => {
  it("detects GI photo types", () => {
    expect(isGiGeoPhotoType("borehole_location")).toBe(true);
    expect(isGiGeoPhotoType("hazard")).toBe(false);
  });

  it("resolves structured location and depth over notes", () => {
    const photo = { locationId: "bh03", depthM: 8.5, notes: "old note" };
    expect(resolvedGiLocationId(photo)).toBe("BH03");
    expect(resolvedGiDepth(photo)).toBe("8.5 m");
  });

  it("parses location id from notes fallback", () => {
    expect(parseLocationIdFromNotes("Trial at TP02 depth 1.2m")).toBe("TP02");
  });

  it("builds structured notes line", () => {
    const line = buildStructuredGeoPhotoNotes({
      notes: "Made ground",
      locationId: "BH01",
      depthM: 12,
      sampleRef: "S-9",
      capturePhase: "before",
    });
    expect(line).toContain("BH01");
    expect(line).toContain("depth 12 m");
    expect(line).toContain("sample S-9");
  });

  it("suggests permit presets", () => {
    expect(suggestedGeoPhotoPresetForPermit("excavation")).toBe("trial_pit");
    expect(suggestedGeoPhotoPresetForPermit("ground_disturbance")).toBe("buried_services_warning");
  });

  it("permitHasSiteEvidence includes geo-photo link", () => {
    expect(permitHasSiteEvidence({ evidenceGeoPhotoId: "gp_1" })).toBe(true);
    expect(permitHasSiteEvidence({})).toBe(false);
  });
});
