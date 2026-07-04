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

  it("upserts utility rows when geo-photo metadata changes", async () => {
    const { geoPhotosToUtilitiesTable } = await import("./geoPhotoIntegrations.js");
    const photo = {
      id: "g4",
      projectId: "p1",
      type: "utility_locator",
      includeInReport: true,
      notes: "old",
      depthM: 1.0,
      latitude: 51.503,
      longitude: -0.103,
    };
    const first = geoPhotosToUtilitiesTable([photo], "p1");
    expect(first).toHaveLength(1);
    const updatedPhoto = { ...photo, depthM: 2.5, notes: "revised depth" };
    const second = geoPhotosToUtilitiesTable([updatedPhoto], "p1", { existingRows: first });
    expect(second).toHaveLength(1);
    expect(second[0].depth).toBe("2.5 m");
    expect(second[0].notes).toContain("revised depth");
  });

  it("builds GI location rows from ground investigation geo-photos", async () => {
    const {
      geoPhotoToGiLocationRow,
      geoPhotosToGiLocationsTable,
      parseLocationIdFromNotes,
    } = await import("./geoPhotoIntegrations.js");
    expect(parseLocationIdFromNotes("BH01 made ground to 2m")).toBe("BH01");

    const bhPhoto = {
      id: "g5",
      projectId: "p1",
      type: "borehole_location",
      includeInReport: true,
      locationId: "BH02",
      depthM: 12.5,
      notes: "Made ground",
      latitude: 51.504,
      longitude: -0.104,
    };
    const row = geoPhotoToGiLocationRow(bhPhoto);
    expect(row.locationId).toBe("BH02");
    expect(row.depth).toBe("12.5 m");
    expect(row.method).toContain("Borehole");

    const giReport = {
      projectId: "p1",
      surveyType: "site_investigation_campaign",
      sections: { findings: "" },
      photos: [],
      giLocationsTable: [],
    };
    const next = importGeoPhotosIntoReport(giReport, [...photos, bhPhoto]);
    expect(next.giLocationsTable.length).toBe(1);
    expect(next.giLocationsTable[0].geoPhotoId).toBe("g5");

    const table = geoPhotosToGiLocationsTable([bhPhoto], "p1");
    expect(table.length).toBe(1);
  });

  it("links geo-photo to permit evidence", async () => {
    const { linkGeoPhotoToPermit, persistPermitEvidenceFromGeoPhoto } = await import("./geoPhotoIntegrations.js");
    const photo = {
      id: "gp_ev1",
      type: "trial_pit",
      notes: "TP01 exposed gas main",
      photoDataUrl: "data:image/jpeg;base64,abc",
      linkedPermitId: "perm_1",
    };
    const permit = linkGeoPhotoToPermit({ id: "perm_1", evidenceNotes: "" }, photo);
    expect(permit.evidenceGeoPhotoId).toBe("gp_ev1");
    expect(permit.evidencePhotoUrl).toContain("data:image");

    const store = { permits: [{ id: "perm_1", evidenceNotes: "" }] };
    const ok = persistPermitEvidenceFromGeoPhoto(photo, {
      load: (k) => (k === "permits_v2" ? store.permits : []),
      save: (k, v) => {
        if (k === "permits_v2") store.permits = v;
      },
    });
    expect(ok).toBe(true);
    expect(store.permits[0].evidenceGeoPhotoId).toBe("gp_ev1");
  });
});
