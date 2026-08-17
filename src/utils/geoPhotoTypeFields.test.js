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
  it("asks group questions, type questions and the universal ones", () => {
    const keys = geoPhotoTypeFields("manhole_chamber").map((f) => f.key);
    expect(keys).toContain("service"); // asked on the chamber, not on every survey preset
    expect(keys).toContain("coverCondition"); // manhole specific
    // The universal tickboxes close every type, safety first then the commercial pair.
    expect(keys.slice(-3)).toEqual(["actionRequired", "claimEvidence", "thirdPartyResponsible"]);
  });

  it("asks a trial pit about both the service it exposed and the ground it sits in", () => {
    const keys = geoPhotoTypeFields("trial_pit").map((f) => f.key);
    expect(keys).toContain("serviceFound"); // utility side
    expect(keys).not.toContain("service"); // one service question, labelled as what was found
    expect(keys).toContain("serviceMaterial");
    expect(keys).toContain("groundType"); // ground investigation side
    expect(keys).toContain("waterStrikeDepthM");
    expect(keys.filter((k) => k === "reinstatement")).toHaveLength(1);
  });

  it("does not ask a survey control mark which buried service it is", () => {
    const keys = geoPhotoTypeFields("benchmark_control").map((f) => f.key);
    expect(keys).toContain("controlType");
    expect(keys).not.toContain("service");
    expect(keys).not.toContain("serviceFound");
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

  describe("trades beyond survey", () => {
    it("asks a scaffold about its tag, and a works photo whether it was allowed to happen", () => {
      const keys = geoPhotoTypeFields("scaffold").map((f) => f.key);
      expect(keys).toContain("scaffoldTagStatus");
      expect(keys).toContain("tiesChecked");
      expect(keys).toContain("permitInPlace"); // Construction & works group
      expect(keys).toContain("ramsBriefed");
      expect(keys).not.toContain("pas128Ql"); // survey questions stay with survey types
    });

    it("asks a suspected ACM what it is, how bad it is and how much there is", () => {
      const keys = geoPhotoTypeFields("suspected_acm").map((f) => f.key);
      expect(keys).toContain("acmType");
      expect(keys).toContain("acmCondition");
      expect(keys).toContain("quantityM2");
      expect(keys).toContain("licensedContractor"); // Demolition & asbestos group
    });

    it("asks a maintenance defect for its asset and its priority", () => {
      const keys = geoPhotoTypeFields("maintenance_defect").map((f) => f.key);
      expect(keys).toContain("assetRef");
      expect(keys).toContain("faultPriority");
      expect(keys).toContain("madeSafe");
    });

    it("asks a spill where it went and whether the regulator needs telling", () => {
      const keys = geoPhotoTypeFields("pollution_incident").map((f) => f.key);
      expect(keys).toContain("substance");
      expect(keys).toContain("volumeLitres");
      expect(keys).toContain("receptor"); // Environment & neighbours group
      expect(keys).toContain("regulatorReportable");
    });

    it("asks an allergen changeover which allergen and whether the clean was verified", () => {
      const keys = geoPhotoTypeFields("allergen_changeover").map((f) => f.key);
      expect(keys).toContain("allergen");
      expect(keys).toContain("cleanDownVerified");
      expect(keys).toContain("batchRef"); // Food & pharma hygiene group
    });

    it("keeps a stockpile's height, so the traced footprint becomes a volume", () => {
      expect(geoPhotoTypeFields("stockpile").map((f) => f.key)).toContain("heapHeightM");
      expect(geoPhotoTypePrompt("stockpile")).toMatch(/volume/i);
    });

    it("puts the commercial tickboxes on every type, whatever the trade", () => {
      for (const type of ["scaffold", "pest_activity", "manhole_chamber", "protected_tree"]) {
        const keys = geoPhotoTypeFields(type).map((f) => f.key);
        expect(keys).toContain("claimEvidence");
        expect(keys).toContain("thirdPartyResponsible");
      }
    });
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

    it("leads with an extent traced on the map, because it is the hardest number on the photo", () => {
      const overgrown = {
        type: "vegetation",
        details: { vegetationType: "Scrub", clearanceNeeded: true },
        area: {
          points: [
            [51.5, -0.1],
            [51.5009, -0.1],
            [51.5009, -0.09855],
            [51.5, -0.09855],
          ],
        },
      };
      expect(geoPhotoDetailRows(overgrown)[0][0]).toBe("Extent");
      expect(geoPhotoDetailRows(overgrown)[0][1]).toMatch(/ha · \d+ m perimeter$/);
      expect(geoPhotoDetailSummary(overgrown)).toMatch(/^1\.00 ha .* · Scrub · Clearance needed$/);
      expect(geoPhotoDetailRows(overgrown, { exclude: ["area"] })).toEqual([
        ["Vegetation", "Scrub"],
        ["Clearance needed", "Yes"],
      ]);
    });

    it("returns nothing when the photo has no answers", () => {
      expect(geoPhotoDetailRows({ type: "hazard" })).toEqual([]);
      expect(geoPhotoDetailSummary({ type: "hazard", details: {} })).toBe("");
    });
  });
});
