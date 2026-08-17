import { describe, it, expect } from "vitest";
import {
  isGiGeoPhotoType,
  resolvedGiLocationId,
  resolvedGiDepth,
  buildStructuredGeoPhotoNotes,
  suggestedGeoPhotoPresetForPermit,
  permitHasSiteEvidence,
  parseLocationIdFromNotes,
  stripStructuredGeoPhotoNotes,
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

  describe("stripStructuredGeoPhotoNotes", () => {
    const fields = { locationId: "BH01", depthM: 12, sampleRef: "S-9", capturePhase: "before" };

    it("gives back the prose the user typed", () => {
      const merged = buildStructuredGeoPhotoNotes({ ...fields, notes: "Made ground" });
      expect(stripStructuredGeoPhotoNotes(merged, fields)).toBe("Made ground");
    });

    it("editing and saving repeatedly does not grow the notes", () => {
      let stored = "Made ground";
      for (let i = 0; i < 5; i += 1) {
        const editing = stripStructuredGeoPhotoNotes(stored, fields);
        stored = buildStructuredGeoPhotoNotes({ ...fields, notes: editing });
      }
      expect(stored).toBe(buildStructuredGeoPhotoNotes({ ...fields, notes: "Made ground" }));
    });

    it("cleans up notes already doubled by earlier saves", () => {
      const suffix = buildStructuredGeoPhotoNotes({ ...fields, notes: "" });
      expect(stripStructuredGeoPhotoNotes(`Made ground · ${suffix} · ${suffix}`, fields)).toBe("Made ground");
    });

    it("leaves notes alone when there is nothing appended", () => {
      expect(stripStructuredGeoPhotoNotes("Cover cracked", {})).toBe("Cover cracked");
      expect(stripStructuredGeoPhotoNotes("Cover cracked", fields)).toBe("Cover cracked");
      expect(stripStructuredGeoPhotoNotes("", fields)).toBe("");
    });

    it("returns empty when the note was only structured tokens", () => {
      const suffix = buildStructuredGeoPhotoNotes({ ...fields, notes: "" });
      expect(stripStructuredGeoPhotoNotes(suffix, fields)).toBe("");
    });
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
