import { describe, expect, it } from "vitest";
import {
  geoPhotoDetailRows,
  geoPhotoDetailSummary,
  geoPhotoTypeFields,
  geoPhotoTypePrompt,
  normaliseGeoPhotoDetails,
} from "./geoPhotoTypeFields.js";
import { GEO_PHOTO_PRESETS } from "./geoPhotoPresets.js";

describe("geoPhotoTypeFields", () => {
  it("asks group questions, type questions and the universal one", () => {
    const keys = geoPhotoTypeFields("manhole_chamber").map((f) => f.key);
    expect(keys).toContain("service"); // Survey & utilities group
    expect(keys).toContain("coverCondition"); // manhole specific
    expect(keys).toContain("actionRequired"); // universal
    expect(keys[keys.length - 1]).toBe("actionRequired");
  });

  it("asks a trial pit about both the service it exposed and the ground it sits in", () => {
    const keys = geoPhotoTypeFields("trial_pit").map((f) => f.key);
    expect(keys).toContain("serviceFound"); // utility side
    expect(keys).toContain("serviceMaterial");
    expect(keys).toContain("groundType"); // ground investigation side
    expect(keys).toContain("waterStrikeDepthM");
    expect(keys.filter((k) => k === "reinstatement")).toHaveLength(1);
  });

  it("lets a type override a group question without duplicating it", () => {
    const keys = geoPhotoTypeFields("gpr_setup").map((f) => f.key);
    expect(keys.filter((k) => k === "surface")).toHaveLength(1);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every preset a usable form", () => {
    for (const preset of GEO_PHOTO_PRESETS) {
      const fields = geoPhotoTypeFields(preset.id);
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) {
        expect(field.label).toBeTruthy();
        expect(["select", "toggle", "number", "text"]).toContain(field.kind);
        if (field.kind === "select") expect(field.options.length).toBeGreaterThan(1);
      }
    }
  });

  it("prompts the field user on how to frame the shot", () => {
    expect(geoPhotoTypePrompt("manhole_chamber")).toContain("cover");
    expect(geoPhotoTypePrompt("nonsense_type")).toBe("");
  });

  describe("normaliseGeoPhotoDetails", () => {
    it("keeps valid answers and coerces numbers", () => {
      const out = normaliseGeoPhotoDetails("manhole_chamber", {
        coverCondition: "Cracked",
        depthToInvertM: "1.8",
        coverLifted: true,
      });
      expect(out).toEqual({ coverCondition: "Cracked", depthToInvertM: 1.8, coverLifted: true });
    });

    it("drops answers that do not belong to the type", () => {
      const out = normaliseGeoPhotoDetails("hazard", { coverCondition: "Cracked", severity: "High" });
      expect(out).toEqual({ severity: "High" });
    });

    it("drops unticked boxes, blanks, bad numbers and off-list options", () => {
      const out = normaliseGeoPhotoDetails("manhole_chamber", {
        coverLifted: false,
        coverSize: "   ",
        depthToInvertM: "deep",
        coverCondition: "Slightly bent",
      });
      expect(out).toEqual({});
    });

    it("survives junk input", () => {
      expect(normaliseGeoPhotoDetails("hazard", null)).toEqual({});
      expect(normaliseGeoPhotoDetails("hazard", "nope")).toEqual({});
      expect(normaliseGeoPhotoDetails(undefined, { severity: "Low" })).toEqual({});
    });
  });

  describe("reading answers back", () => {
    const photo = {
      type: "manhole_chamber",
      details: { service: "Foul sewer", coverCondition: "Cracked", depthToInvertM: 1.8, coverLifted: true },
    };

    it("labels answers with their units for reports and exports", () => {
      expect(geoPhotoDetailRows(photo)).toEqual([
        ["Service", "Foul sewer"],
        ["Cover condition", "Cracked"],
        ["Depth to invert", "1.8 m"],
        ["Cover lifted", "Yes"],
      ]);
    });

    it("summarises answers in one line, using the label for ticked boxes", () => {
      expect(geoPhotoDetailSummary(photo)).toBe("Foul sewer · Cracked · 1.8 m · Cover lifted");
    });

    it("returns nothing when the photo has no answers", () => {
      expect(geoPhotoDetailRows({ type: "hazard" })).toEqual([]);
      expect(geoPhotoDetailSummary({ type: "hazard", details: {} })).toBe("");
    });
  });
});
