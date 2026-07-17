import { describe, expect, it } from "vitest";
import {
  buildGprGroundNarrative,
  buildGprWeatherImpactNarrative,
  classifyGeologyLayer,
  expectedPenetrationM,
  interpretGeologyForGpr,
  interpretGeologyForSurvey,
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

  it("interprets full BGS payload for GPR", () => {
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

  it("maps BGS payload to honest survey geology fields", () => {
    const mapped = interpretGeologyForSurvey(
      {
        lat: 51.5,
        lng: -0.12,
        fetchedAt: "2026-01-01T00:00:00Z",
        source: "bgs-ogcapi",
        scale: "1:625,000 (generalised)",
        disclaimer: "BGS 1:625,000 digital geology is a regional overview only — not a site investigation.",
        superficial: { lexDescription: "LONDON CLAY FORMATION", rockDescription: "CLAY AND SILT" },
        bedrock: { lexDescription: "LONDON CLAY FORMATION" },
      },
      { weather: { groundSurface: "damp" } }
    );
    expect(mapped.formation).toMatch(/LONDON CLAY/i);
    expect(mapped.materialClass).toBe("clay_silt");
    expect(mapped.implications).toMatch(/attenuation|GPR|EML/i);
    expect(mapped.disclaimer).toMatch(/not a site investigation/i);
    expect(mapped.notes).toMatch(/51\.5/);
    expect(mapped.implications).toMatch(/wet/i);
  });
});
