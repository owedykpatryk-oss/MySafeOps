import { describe, expect, it } from "vitest";
import {
  classifyWaterTags,
  distanceToGeometryM,
  mergeWaterImpact,
  summariseWaterElements,
  waterImpactSentence,
} from "./gprWaterProximity.js";

describe("GPR water proximity", () => {
  const origin = { lat: 52.48, lng: -1.9 };

  it("keeps a river within 100 m and drops one further away", () => {
    const near = summariseWaterElements(origin.lat, origin.lng, [
      { tags: { waterway: "river", name: "Rea" }, geometry: [{ lat: 52.4803, lon: -1.9 }, { lat: 52.4806, lon: -1.9 }] },
      { tags: { waterway: "canal", name: "Far canal" }, geometry: [{ lat: 52.49, lon: -1.9 }] },
    ]);
    expect(near.fresh.name).toBe("Rea");
    expect(near.fresh.distanceM).toBeLessThanOrEqual(100);
    expect(near.salt).toBeNull();
    expect(waterImpactSentence(near, "2026-09-25T12:00:00.000Z")).toContain("Rea");
    expect(waterImpactSentence(near, "2026-09-25T12:00:00.000Z")).not.toContain("Far canal");
    expect(waterImpactSentence(near, "2026-09-25T12:00:00.000Z")).not.toContain("saline");
  });

  it("mentions tidal water inside 300 m without calling the ground saline", () => {
    const coast = summariseWaterElements(origin.lat, origin.lng, [
      { tags: { natural: "coastline" }, geometry: [{ lat: 52.482, lon: -1.9 }] },
    ]);
    expect(coast.fresh).toBeNull();
    expect(coast.salt.kind).toBe("coastline");
    expect(coast.salt.distanceM).toBeLessThanOrEqual(300);
    const sentence = waterImpactSentence(coast, "2026-09-25T12:00:00.000Z");
    expect(sentence).toContain("not proof that the surveyed ground is saline");
    expect(sentence).toContain("OpenStreetMap");
  });

  it("classifies a tidal river as salt and ignores water beyond both limits", () => {
    expect(classifyWaterTags({ waterway: "river", tidal: "yes" })).toBe("salt");
    const none = summariseWaterElements(origin.lat, origin.lng, [
      { tags: { natural: "coastline" }, geometry: [{ lat: 52.5, lon: -1.9 }] },
    ]);
    expect(none.salt).toBeNull();
    expect(waterImpactSentence(none)).toBe("");
    expect(mergeWaterImpact("Dry and clear.", none, "")).toBe("Dry and clear.");
  });

  it("measures distance to a segment, not only the nodes", () => {
    const distance = distanceToGeometryM(52.48, -1.9, [
      { lat: 52.481, lon: -1.91 },
      { lat: 52.481, lon: -1.89 },
    ]);
    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(140);
  });
});
