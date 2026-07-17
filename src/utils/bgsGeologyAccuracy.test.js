import { describe, expect, it } from "vitest";
import { normalizeGeologyLayerProps, BGS_50K_DISCLAIMER, BGS_POSTCODE_ACCURACY_WARNING } from "../../shared/bgsGeologyFetch.mjs";
import { interpretGeologyForSurvey, projectHasMapPin, interpretGeologyForGpr } from "./gprGroundConditions.js";

describe("bgsGeologyFetch helpers", () => {
  it("normalises WMS 50k property names", () => {
    const layer = normalizeGeologyLayerProps(
      {
        LEX: "ALV",
        LEX_D: "Alluvium",
        RCS_D: "Clay, silt, sand and peat",
        BROAD_D: "variable sediment",
        NOM_SCALE: "50000",
      },
      { scaleHint: "50000" }
    );
    expect(layer.lexDescription).toBe("Alluvium");
    expect(layer.rockDescription).toMatch(/Clay/i);
    expect(layer.scale).toBe("50000");
  });

  it("exports 50k disclaimer and postcode warning", () => {
    expect(BGS_50K_DISCLAIMER).toMatch(/1:50,000|50k/i);
    expect(BGS_POSTCODE_ACCURACY_WARNING).toMatch(/map pin/i);
  });
});

describe("geology accuracy mapping", () => {
  it("detects project map pin", () => {
    expect(projectHasMapPin({ lat: 51.5, lng: -0.12 })).toBe(true);
    expect(projectHasMapPin({ postcode: "SW1A 1AA" })).toBe(false);
  });

  it("surfaces artificial ground and boreholes in survey mapping", () => {
    const mapped = interpretGeologyForSurvey(
      {
        lat: 51.5,
        lng: -0.12,
        scale: "1:50,000 (DigMapGB)",
        resolution: "50k",
        disclaimer: BGS_50K_DISCLAIMER,
        superficial: { lexDescription: "Alluvium", rockDescription: "Clay, silt, sand and peat" },
        bedrock: { lexDescription: "London Clay Formation", rockDescription: "Clay and silt" },
        artificial: { lexDescription: "Made Ground", rockDescription: "Artificial deposit" },
        nearbyBoreholes: [{ reference: "TQ37NW1", distanceM: 120, lengthM: 9 }],
      },
      { accuracyWarning: BGS_POSTCODE_ACCURACY_WARNING, coordSource: "postcode centroid" }
    );
    expect(mapped.formation).toMatch(/Made Ground/i);
    expect(mapped.materialClass).toBe("made_ground");
    expect(mapped.implications).toMatch(/TQ37NW1/);
    expect(mapped.accuracyWarning).toMatch(/map pin/i);
    expect(mapped.notes).toMatch(/postcode centroid|Lookup point/i);
  });

  it("GPR narrative mentions boreholes when present", () => {
    const gpr = interpretGeologyForGpr({
      superficial: { lexDescription: "Alluvium", rockDescription: "SAND AND GRAVEL" },
      nearbyBoreholes: [{ reference: "TQ37NW1", distanceM: 80, lengthM: 12 }],
    });
    expect(gpr.narrative).toMatch(/TQ37NW1/);
  });
});
