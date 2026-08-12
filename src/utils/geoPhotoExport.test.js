import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildGeoPhotosKml,
  buildGeoPhotosDxf,
  buildGeoPhotosGpx,
  buildGeoPhotosPlanOverlayDxf,
  buildZipStore,
  latLngToSiteMetres,
  bearingToCadRotation,
  exportOriginForPhotos,
  filterGeoPhotosWithCoords,
  prepareGeoPhotoExport,
} from "./geoPhotoExport.js";
import { solvePlanAffineFromControlPoints } from "../modules/permits/projectDrawingAffine.js";

const samplePhotos = [
  {
    id: "gp_1",
    type: "borehole_location",
    latitude: 51.501,
    longitude: -0.1,
    bearing: 45,
    notes: "BH01 depth 12m",
    locationId: "BH01",
    depthM: 12,
    photoDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
    timestampUtc: "2026-06-01T10:00:00Z",
  },
  {
    id: "gp_2",
    type: "trial_pit",
    latitude: 51.502,
    longitude: -0.101,
    bearing: 180,
    notes: "Trial pit north",
    photoDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
  },
  {
    id: "gp_3",
    type: "hazard",
    notes: "No GPS on this one",
    photoDataUrl: "data:image/jpeg;base64,/9j/4AAQ",
  },
];

describe("geoPhotoExport", () => {
  it("builds KML with folders, look-at and view arrows", () => {
    const kml = buildGeoPhotosKml(samplePhotos, { name: "Test site" });
    expect(kml).toContain('<?xml version="1.0"');
    expect(kml).toContain("<name>Test site</name>");
    expect(kml).toContain("BH01");
    expect(kml).toContain("view direction");
    expect(kml).toContain("<heading>45</heading>");
    expect(kml).toContain("<Folder>");
    expect(kml).toContain("Ground investigation");
    expect(kml).toContain("<LookAt>");
    expect(kml).toContain("Location ID");
  });

  it("builds KMZ-style KML with ground overlays when enabled", () => {
    const kml = buildGeoPhotosKml(samplePhotos, { groundOverlays: true });
    expect(kml).toContain("<GroundOverlay>");
    expect(kml).toContain("images/gp_1.jpg");
  });

  it("builds DXF with GEO_PHOTO block, attributes and INSERT entities", () => {
    const dxf = buildGeoPhotosDxf(samplePhotos);
    expect(dxf).toContain("GEO_PHOTO");
    expect(dxf).toContain("INSERT");
    expect(dxf).toContain("ATTDEF");
    expect(dxf).toContain("ATTRIB");
    expect(dxf).toContain("LOC_ID");
    expect(dxf).toContain("GEO_VIEW_ARROWS");
    expect(dxf).toContain("AC1015");
    expect(dxf).toContain("\\H\\");
  });

  it("builds GPX waypoints with metadata", () => {
    const gpx = buildGeoPhotosGpx(samplePhotos, { name: "Site A" });
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("<wpt");
    expect(gpx).toContain("BH01");
    expect(gpx).toContain("View bearing 45°");
    expect(gpx).not.toContain("gp_3");
  });

  it("carries National Grid coordinates into KML for UK sites", () => {
    const kml = buildGeoPhotosKml(samplePhotos);
    expect(kml).toContain('<Data name="gridRef"><value>TQ ');
    expect(kml).toContain('<Data name="easting">');
    expect(kml).toContain('<Data name="northing">');
    expect(kml).toContain("OSGB36 / British National Grid (EPSG:27700)");
    expect(kml).toContain("OS grid ref");
  });

  it("omits National Grid data for photos outside Great Britain", () => {
    const kml = buildGeoPhotosKml([{ ...samplePhotos[0], latitude: 48.8584, longitude: 2.2945 }]);
    expect(kml).not.toContain("gridRef");
    expect(kml).not.toContain("EPSG:27700");
  });

  it("records survey provenance and elevation in KML", () => {
    const kml = buildGeoPhotosKml([
      { ...samplePhotos[0], gpsAccuracyMeters: 42, altitudeMeters: 31.4, locationSource: "photo_exif" },
    ]);
    expect(kml).toContain('<Data name="gpsAccuracyMeters"><value>42</value></Data>');
    expect(kml).toContain('<Data name="locationSource"><value>photo_exif</value></Data>');
    expect(kml).toContain("±42 m (approximate)");
    expect(kml).toContain("Photo metadata (EXIF)");
    expect(kml).toContain("<altitudeMode>absolute</altitudeMode>");
    expect(kml).toContain(",31.4</coordinates>");
  });

  it("keeps a plain sea-level point when no elevation was captured", () => {
    const kml = buildGeoPhotosKml([samplePhotos[0]]);
    expect(kml).not.toContain("altitudeMode");
    expect(kml).toContain(",0</coordinates>");
  });

  it("filters photos with and without GPS", () => {
    const { withCoords, withoutCoords } = filterGeoPhotosWithCoords(samplePhotos);
    expect(withCoords).toHaveLength(2);
    expect(withoutCoords).toHaveLength(1);
    expect(withoutCoords[0].id).toBe("gp_3");
  });

  it("converts lat/lng to local metres and bearing to CAD rotation", () => {
    const origin = exportOriginForPhotos(samplePhotos);
    const centre = latLngToSiteMetres(origin.lat, origin.lng, origin.lat, origin.lng);
    const north = latLngToSiteMetres(51.502, origin.lng, origin.lat, origin.lng);
    const east = latLngToSiteMetres(origin.lat, -0.1, origin.lat, origin.lng);
    expect(centre.x).toBe(0);
    expect(centre.y).toBe(0);
    expect(north.y).toBeGreaterThan(0);
    expect(east.x).toBeGreaterThan(0);
    expect(bearingToCadRotation(0)).toBe(90);
    expect(bearingToCadRotation(90)).toBe(0);
  });

  it("builds plan-overlay DXF when affine is provided", () => {
    const aff = solvePlanAffineFromControlPoints([
      { px: 0, py: 0, lat: 51.5, lng: -0.1 },
      { px: 100, py: 0, lat: 51.5, lng: -0.08 },
      { px: 0, py: 100, lat: 51.52, lng: -0.1 },
    ]);
    const dxf = buildGeoPhotosPlanOverlayDxf(samplePhotos, { affine: aff, planId: "plan_a" });
    expect(dxf).toContain("GEO_PHOTO");
    expect(dxf).toContain("site plan overlay");
  });

  it("builds a valid ZIP store archive", () => {
    const zip = buildZipStore([
      { name: "doc.kml", data: new TextEncoder().encode("<kml/>") },
      { name: "images/a.jpg", data: new Uint8Array([1, 2, 3]) },
    ]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip.length).toBeGreaterThan(100);
  });

  describe("prepareGeoPhotoExport", () => {
    beforeEach(() => {
      vi.stubGlobal("confirm", vi.fn(() => true));
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns GPS-tagged photos when user confirms skip", () => {
      const result = prepareGeoPhotoExport(samplePhotos);
      expect(result?.exported).toBe(2);
      expect(result?.skipped).toBe(1);
    });

    it("returns null when user cancels skip dialog", () => {
      vi.stubGlobal("confirm", vi.fn(() => false));
      const result = prepareGeoPhotoExport(samplePhotos);
      expect(result).toBeNull();
    });
  });
});
