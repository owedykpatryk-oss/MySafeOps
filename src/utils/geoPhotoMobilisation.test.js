import { describe, expect, it } from "vitest";
import {
  buildGeoPhotoMobilisationChecklist,
  geoPhotoGroupCoverage,
  MOBILISATION_MIN_REPORT_PHOTOS,
} from "./geoPhotoMobilisation.js";

describe("geoPhotoMobilisation", () => {
  const photos = [
    { id: "1", projectId: "p1", type: "site_entrance", includeInReport: true },
    { id: "2", projectId: "p1", type: "hazard", includeInReport: true },
    { id: "3", projectId: "p1", type: "general_site_condition", includeInReport: false },
    { id: "4", projectId: "p2", type: "access_route", includeInReport: true },
  ];

  it("builds checklist for project with partial coverage", () => {
    const result = buildGeoPhotoMobilisationChecklist(photos, "p1", { surveyPack: false });
    expect(result.checks.find((c) => c.id === "access")?.done).toBe(true);
    expect(result.checks.find((c) => c.id === "hazards")?.done).toBe(true);
    expect(result.checks.find((c) => c.id === "utilities")).toBeUndefined();
    expect(result.checks.find((c) => c.id === "report_pack")?.done).toBe(false);
    expect(result.doneCount).toBeLessThan(result.total);
  });

  it("includes utilities check when survey pack enabled", () => {
    const withUtility = [
      ...photos,
      { id: "5", projectId: "p1", type: "gpr_setup", includeInReport: true },
    ];
    const result = buildGeoPhotoMobilisationChecklist(withUtility, "p1", { surveyPack: true });
    expect(result.checks.find((c) => c.id === "utilities")?.done).toBe(true);
  });

  it("marks report pack done when enough photos in report", () => {
    const many = Array.from({ length: MOBILISATION_MIN_REPORT_PHOTOS }, (_, i) => ({
      id: `r${i}`,
      projectId: "p1",
      type: "general_site_condition",
      includeInReport: true,
    }));
    const result = buildGeoPhotoMobilisationChecklist(many, "p1");
    expect(result.checks.find((c) => c.id === "report_pack")?.done).toBe(true);
    expect(result.pct).toBeGreaterThan(0);
  });

  it("includes GI checks when giPack enabled", () => {
    const giPhotos = [
      { id: "g1", projectId: "p1", type: "utility_locator", includeInReport: true },
      { id: "g2", projectId: "p1", type: "borehole_location", includeInReport: true },
      { id: "g3", projectId: "p1", type: "borehole_cap", includeInReport: true },
    ];
    const result = buildGeoPhotoMobilisationChecklist(giPhotos, "p1", { giPack: true });
    expect(result.checks.find((c) => c.id === "gi_clearance")?.done).toBe(true);
    expect(result.checks.find((c) => c.id === "gi_point")?.done).toBe(true);
    expect(result.checks.find((c) => c.id === "gi_reinstatement")?.done).toBe(true);
  });
});
