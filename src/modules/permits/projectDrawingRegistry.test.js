import { describe, expect, it } from "vitest";
import {
  PROJECT_DRAWING_OBJECT_TYPES,
  buildProjectDrawingObject,
  drawingObjectCategories,
  drawingObjectTypeMeta,
} from "./projectDrawingRegistry";
import { isPolygonDrawingObject } from "./projectDrawingAreas";

describe("projectDrawingRegistry", () => {
  it("includes safety and logistics point types", () => {
    const ids = PROJECT_DRAWING_OBJECT_TYPES.map((t) => t.id);
    expect(ids).toContain("fire_extinguisher");
    expect(ids).toContain("parking");
    expect(ids).toContain("master_point");
    expect(drawingObjectTypeMeta("master_point").label).toMatch(/muster/i);
  });

  it("stores polygon site areas", () => {
    const row = buildProjectDrawingObject({
      projectId: "p1",
      type: "site_area",
      geometry: "polygon",
      placement: "map",
      ring: [
        { geoLat: 51.5, geoLng: -0.1 },
        { geoLat: 51.51, geoLng: -0.1 },
        { geoLat: 51.51, geoLng: -0.09 },
      ],
      meta: { areaKind: "parking" },
    });
    expect(isPolygonDrawingObject(row)).toBe(true);
    expect(row.ring).toHaveLength(3);
    expect(row.meta.areaKind).toBe("parking");
  });

  it("groups categories for UI", () => {
    const cats = drawingObjectCategories();
    expect(cats.some((c) => c.id === "safety")).toBe(true);
    expect(cats.some((c) => c.id === "logistics")).toBe(true);
  });
});
