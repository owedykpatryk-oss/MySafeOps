import { describe, expect, it } from "vitest";
import {
  buildGeoPhotosFindingsBlock,
  findNearestProject,
  GEO_PHOTOS_FINDINGS_MARKER,
  importGeoPhotosIntoReport,
  projectGeoPhotosForReport,
  snagDraftFromGeoPhoto,
} from "./geoPhotoIntegrations.js";

describe("geoPhotoIntegrations", () => {
  const projects = [
    { id: "p1", name: "Alpha", lat: 51.5, lng: -0.1 },
    { id: "p2", name: "Beta", lat: 53.0, lng: -1.0, closed: true },
  ];

  const photos = [
    {
      id: "g1",
      projectId: "p1",
      type: "access_route",
      includeInReport: true,
      reportOrder: 2,
      notes: "North gate",
      latitude: 51.501,
      longitude: -0.101,
      bearing: 90,
      photoDataUrl: "data:image/jpeg;base64,abc",
      timestampUtc: "2026-06-01T10:00:00Z",
    },
    {
      id: "g2",
      projectId: "p1",
      type: "hazard",
      includeInReport: true,
      reportOrder: 1,
      notes: "Trip hazard",
      latitude: 51.502,
      longitude: -0.102,
      bearing: 180,
      photoDataUrl: "data:image/jpeg;base64,def",
      timestampUtc: "2026-06-01T11:00:00Z",
    },
    {
      id: "g3",
      projectId: "p1",
      type: "general_site_condition",
      includeInReport: false,
      photoDataUrl: "data:image/jpeg;base64,ghi",
    },
  ];

  it("finds nearest project within range", () => {
    const hit = findNearestProject(51.5005, -0.1005, projects);
    expect(hit?.project.id).toBe("p1");
    expect(hit?.distanceMeters).toBeLessThan(200);
  });

  it("orders report photos by reportOrder", () => {
    const ordered = projectGeoPhotosForReport(photos, "p1");
    expect(ordered.map((p) => p.id)).toEqual(["g2", "g1"]);
  });

  it("builds findings block with marker", () => {
    const block = buildGeoPhotosFindingsBlock(projectGeoPhotosForReport(photos, "p1"));
    expect(block).toContain(GEO_PHOTOS_FINDINGS_MARKER);
    expect(block).toContain("Trip hazard");
  });

  it("imports geo-photos into survey report", () => {
    const report = { projectId: "p1", sections: { findings: "Existing." }, photos: [], accessLimitationsNotes: "" };
    const next = importGeoPhotosIntoReport(report, photos);
    expect(next.photos.length).toBe(2);
    expect(next.sections.findings).toContain(GEO_PHOTOS_FINDINGS_MARKER);
    expect(next.accessLimitationsNotes).toContain("Geo-photo access");
    expect(next.geoPhotoImportCount).toBe(2);
  });

  it("creates snag draft from hazard geo-photo", () => {
    const snag = snagDraftFromGeoPhoto(photos[1]);
    expect(snag.priority).toBe("high");
    expect(snag.photos.length).toBe(1);
    expect(snag.sourceGeoPhotoId).toBe("g2");
  });

  it("builds utility rows from survey geo-photos", async () => {
    const { geoPhotoToUtilityRow, geoPhotosToUtilitiesTable, parseDepthFromNotes } = await import("./geoPhotoIntegrations.js");
    expect(parseDepthFromNotes("Approx depth 0.8m near MH")).toBe("0.8 m");

    const utilityPhoto = {
      id: "g4",
      projectId: "p1",
      type: "utility_locator",
      includeInReport: true,
      notes: "HV cable depth 1.1m",
      latitude: 51.503,
      longitude: -0.103,
    };
    const row = geoPhotoToUtilityRow(utilityPhoto, { pas128Ql: "B1" });
    expect(row.method).toContain("EML");
    expect(row.depth).toBe("1.1 m");
    expect(row.geoPhotoId).toBe("g4");

    const table = geoPhotosToUtilitiesTable([...photos, utilityPhoto], "p1", { pas128Ql: "B1" });
    expect(table.some((r) => r.geoPhotoId === "g4")).toBe(true);
  });

  it("merges utilities table when importing geo-photos", () => {
    const utilityPhoto = {
      id: "g4",
      projectId: "p1",
      type: "trial_pit",
      includeInReport: true,
      notes: "Gas main exposed",
      photoDataUrl: "data:image/jpeg;base64,xyz",
    };
    const report = { projectId: "p1", sections: { findings: "" }, photos: [], utilitiesTable: [] };
    const next = importGeoPhotosIntoReport(report, [...photos, utilityPhoto]);
    expect(next.utilitiesTable.length).toBe(1);
    expect(next.utilitiesTable[0].method).toContain("Trial pit");
  });
});
