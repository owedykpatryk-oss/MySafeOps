import { describe, expect, it } from "vitest";
import {
  buildGprGroundNarrative,
  buildGprWeatherImpactNarrative,
  classifyGeologyLayer,
  expectedPenetrationM,
  interpretGeologyForGpr,
} from "./gprGroundConditions.js";

describe("gprGroundConditions", () => {
  it("classifies clay-rich superficial as high attenuation", () => {
    const c = classifyGeologyLayer({
      lexDescription: "ALLUVIUM",
      rockDescription: "CLAY, SILT AND SAND",
    });
    expect(c.materialClass).toBe("clay_silt");
    expect(c.attenuation).toBe("high");
  });

  it("estimates lower penetration for high attenuation at 400 MHz", () => {
    const dry = expectedPenetrationM(400, "low");
    const clay = expectedPenetrationM(400, "high");
    expect(clay).toBeLessThan(dry);
  });

  it("builds ground narrative with BGS labels", () => {
    const text = buildGprGroundNarrative({
      superficial: { lexDescription: "ALLUVIUM", rockDescription: "CLAY, SILT AND SAND" },
      antennaMhz: 400,
    });
    expect(text).toMatch(/ALLUVIUM/);
    expect(text).toMatch(/400 MHz/);
  });

  it("describes rain impact on GPR", () => {
    const text = buildGprWeatherImpactNarrative({
      description: "Heavy rain",
      rainDuringSurvey: "heavy",
      groundSurface: "waterlogged",
    });
    expect(text).toMatch(/moisture|rain/i);
  });

  it("interprets full BGS payload", () => {
    const result = interpretGeologyForGpr(
      {
        fetchedAt: "2026-01-01T00:00:00Z",
        source: "bgs-ogcapi",
        superficial: { lexDescription: "SAND AND GRAVEL" },
        bedrock: null,
      },
      { antennaMhz: 250 }
    );
    expect(result.expectedPenetrationM).toBeGreaterThan(0);
    expect(result.narrative).toBeTruthy();
  });
});
