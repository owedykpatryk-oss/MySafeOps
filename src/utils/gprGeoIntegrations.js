/**
 * Geo-photo → GPR report (radargram lines, scan setup photos).
 */
import { geoPhotoDisplayUrl } from "./geoPhotoMedia";
import { projectGeoPhotosForReport } from "./geoPhotoIntegrations";

const GPR_GEO_TYPES = new Set(["gpr_setup", "utility", "trial_pit", "chamber"]);

export function geoPhotosForGprReport(geoPhotos, projectId) {
  if (!projectId) return [];
  return (geoPhotos || [])
    .filter((p) => p.projectId === projectId && (p.includeInReport || GPR_GEO_TYPES.has(p.type)))
    .sort((a, b) => new Date(a.timestampUtc || a.createdAt) - new Date(b.timestampUtc || b.createdAt));
}

export function blankRadargramFromGeoPhoto(photo, index = 0) {
  const url = geoPhotoDisplayUrl(photo);
  const isGpr = photo.type === "gpr_setup";
  return {
    id: `rg_${photo.id || Date.now()}_${index}`,
    label: isGpr ? `Line / setup ${index + 1}` : `Field photo ${index + 1}`,
    lineRef: photo.giLocationId || photo.sampleRef || "",
    dataUrl: url,
    fileName: photo.fileName || "",
    capturedAt: photo.timestampUtc || photo.createdAt || null,
    notes: [photo.notes, photo.type].filter(Boolean).join(" · "),
    sourceGeoPhotoId: photo.id,
  };
}

/** Merge geo-photos into report.radargrams (dedupe by source id). */
export function importGeoPhotosIntoGprReport(report, geoPhotos, { replace = false } = {}) {
  const hits = geoPhotosForGprReport(geoPhotos, report.projectId);
  if (!hits.length) throw new Error("No GPR-related geo-photos for this project.");

  const existing = replace ? [] : [...(report.radargrams || [])];
  const seen = new Set(existing.map((r) => r.sourceGeoPhotoId).filter(Boolean));

  hits.forEach((photo, i) => {
    if (seen.has(photo.id)) return;
    existing.push(blankRadargramFromGeoPhoto(photo, existing.length + i));
    seen.add(photo.id);
  });

  return { ...report, radargrams: existing };
}

export function countGprGeoPhotos(geoPhotos, projectId) {
  return geoPhotosForGprReport(geoPhotos, projectId).length;
}
