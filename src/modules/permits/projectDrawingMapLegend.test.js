import { describe, expect, it } from "vitest";
import { buildMapLegendItems } from "../ProjectDrawingMapLegend.jsx";

describe("buildMapLegendItems", () => {
  it("includes boundary, markers, routes and hospital when enabled", () => {
    const items = buildMapLegendItems({
      markerTypes: [{ id: "master_point", label: "Muster", color: "#7E22CE", shape: "star" }],
      typeCounts: { master_point: 2 },
      hasBoundary: true,
      showBoundary: true,
      escapeRouteCount: 1,
      showEscapeRoutes: true,
      showHospitalRoute: true,
      showHospitalLayer: true,
    });
    expect(items.map((i) => i.label)).toEqual([
      "Site boundary",
      "Muster (2)",
      "Escape route (1)",
      "Nearest A&E route",
    ]);
  });

  it("respects layer toggles", () => {
    const items = buildMapLegendItems({
      markerTypes: [{ id: "parking", label: "Parking", color: "#475569", shape: "square" }],
      typeCounts: { parking: 1 },
      hasBoundary: true,
      showBoundary: false,
      escapeRouteCount: 2,
      showEscapeRoutes: false,
      showHospitalRoute: true,
      showHospitalLayer: false,
    });
    expect(items).toEqual([{ color: "#475569", label: "Parking (1)", kind: "square" }]);
  });
});
