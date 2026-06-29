import { describe, expect, it } from "vitest";
import {
  flattenGeoPhotoRow,
  flattenObservationRow,
  flattenRiddorRow,
  prepareRegisterExport,
} from "./registerPdfAdapters";

describe("registerPdfAdapters", () => {
  it("flattens riddor rows with human-readable type", () => {
    const row = flattenRiddorRow({ riddorType: "over7day", incidentDate: "2026-01-15", status: "draft" });
    expect(row.type).toContain("Over-7-day");
    expect(row.incidentDate).toBe("2026-01-15");
  });

  it("flattens safety observations", () => {
    const row = flattenObservationRow({
      obsDate: "2026-02-01",
      polarity: "positive",
      projectName: "Site A",
      detail: "Good housekeeping",
      observer: "SM",
    });
    expect(row.polarity).toBe("Positive");
    expect(row.project).toBe("Site A");
  });

  it("flattens geo-photo rows with coordinates", () => {
    const row = flattenGeoPhotoRow({
      type: "access_route",
      projectName: "Demo",
      latitude: 51.501,
      longitude: -0.142,
      bearing: 90,
      includeInReport: true,
      timestampUtc: "2026-03-01T10:00:00.000Z",
    });
    expect(row.project).toBe("Demo");
    expect(row.coordinates).toContain("51.50100");
    expect(row.bearing).toBe("90°");
    expect(row.inReport).toBe("Yes");
  });

  it("uses detail export mode for geo-photos", () => {
    const prepared = prepareRegisterExport("geo-photos", [{ id: "gp1" }], { summary: false });
    expect(prepared.mode).toBe("detail");
  });
});
