import { describe, it, expect } from "vitest";
import {
  planPercentToLatLng,
  getObjectLatLng,
  escapeXml,
  DEFAULT_GEO_ANCHOR,
  buildDrawingObjectsKml,
  buildDrawingObjectsGpx,
} from "./projectDrawingGeo";

describe("projectDrawingGeo", () => {
  it("getObjectLatLng uses geo for map placement", () => {
    const row = { placement: "map", geoLat: 52.1, geoLng: -1.2, x: 50, y: 50 };
    const p = getObjectLatLng(row, DEFAULT_GEO_ANCHOR);
    expect(p.lat).toBe(52.1);
    expect(p.lng).toBe(-1.2);
  });

  it("getObjectLatLng falls back to plan % for plan placement", () => {
    const row = { placement: "plan", x: 50, y: 50 };
    const p = getObjectLatLng(row, DEFAULT_GEO_ANCHOR);
    const q = planPercentToLatLng(50, 50, DEFAULT_GEO_ANCHOR);
    expect(p.lat).toBeCloseTo(q.lat, 6);
    expect(p.lng).toBeCloseTo(q.lng, 6);
  });

  it("getObjectLatLng uses affine when provided", () => {
    const row = { placement: "plan", x: 0, y: 0 };
    const affine = { a: 0, b: 0, c: 52, d: 0, e: 0, f: -1 };
    const p = getObjectLatLng(row, DEFAULT_GEO_ANCHOR, affine);
    expect(p.lat).toBeCloseTo(52, 6);
    expect(p.lng).toBeCloseTo(-1, 6);
  });

  it("planPercentToLatLng centers at 50,50", () => {
    const a = { ...DEFAULT_GEO_ANCHOR, spanLat: 0.02, spanLng: 0.04 };
    const c = planPercentToLatLng(50, 50, a);
    expect(c.lat).toBeCloseTo(a.lat, 6);
    expect(c.lng).toBeCloseTo(a.lng, 6);
  });

  it("escapeXml escapes special chars", () => {
    expect(escapeXml("a")).toBe("a");
    expect(escapeXml("<tag>&\"")).toBe("&lt;tag&gt;&amp;&quot;");
  });

  it("buildDrawingObjectsKml is valid-looking XML", () => {
    const kml = buildDrawingObjectsKml({
      projectId: "p1",
      planName: "Floor 1",
      objects: [
        { id: "o1", projectId: "p1", planId: "pl1", type: "zone", label: "A", x: 10, y: 90 },
      ],
      anchor: DEFAULT_GEO_ANCHOR,
    });
    expect(kml).toContain('<?xml version="1.0"');
    expect(kml).toContain("<kml ");
    expect(kml).toContain("<Placemark>");
    expect(kml).toContain("<coordinates>");
  });

  it("buildDrawingObjectsGpx contains waypoints", () => {
    const gpx = buildDrawingObjectsGpx({
      projectId: "p1",
      planName: "Plan A",
      objects: [{ id: "o1", projectId: "p1", planId: "pl1", type: "zone", label: "A", x: 50, y: 50 }],
      anchor: DEFAULT_GEO_ANCHOR,
    });
    expect(gpx).toContain("<gpx ");
    expect(gpx).toContain("<wpt ");
    expect(gpx).toContain('lat="');
  });
});
