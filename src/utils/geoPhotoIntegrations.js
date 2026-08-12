/**
 * Geo-photo integrations — survey report, exports, project matching, snags.
 */
import { geoPhotoPreset, geoPhotoPresetLabel } from "./geoPhotoPresets";
import { geoPhotoDisplayUrl } from "./geoPhotoMedia";
import {
  GEO_PHOTO_GI_TYPES,
  resolvedGiDepth,
  resolvedGiLocationId,
  permitHasSiteEvidence,
} from "./geoPhotoFields";
import { buildStaticMapUrl } from "./staticMapUrl.js";
import { wgs84ToBritishNationalGrid } from "./britishNationalGrid";

import { todayLocalISO } from "./localDate";
export const GEO_PHOTOS_FINDINGS_MARKER = "=== Geo-photos (field capture) ===";

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const a1 = (Number(lat1) * Math.PI) / 180;
  const a2 = (Number(lat2) * Math.PI) / 180;
  const dLat = a2 - a1;
  const dLng = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Pick closest active project with coordinates within maxDistanceM (default 3 km). */
export function findNearestProject(latitude, longitude, projects, maxDistanceM = 3000) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let best = null;
  let bestDist = Infinity;

  (projects || []).forEach((p) => {
    if (p?.closed) return;
    const plat = Number(p.lat);
    const plng = Number(p.lng);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
    const d = haversineMeters(lat, lng, plat, plng);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  });

  if (!best || bestDist > maxDistanceM) return null;
  return { project: best, distanceMeters: Math.round(bestDist) };
}

/** Photos marked for report for a project, ordered for PDF appendix. */
export function projectGeoPhotosForReport(geoPhotos, projectId) {
  if (!projectId) return [];
  return (geoPhotos || [])
    .filter((p) => p.projectId === projectId && p.includeInReport)
    .sort((a, b) => {
      const oa = a.reportOrder ?? 9999;
      const ob = b.reportOrder ?? 9999;
      if (oa !== ob) return oa - ob;
      return new Date(a.timestampUtc || a.createdAt).getTime() - new Date(b.timestampUtc || b.createdAt).getTime();
    });
}

export function countGeoPhotosForReport(geoPhotos, projectId) {
  return projectGeoPhotosForReport(geoPhotos, projectId).length;
}

export function geoPhotoCaption(photo) {
  const preset = geoPhotoPreset(photo.type);
  const parts = [preset.label];
  const loc = resolvedGiLocationId(photo);
  if (loc) parts.push(loc);
  const depth = resolvedGiDepth(photo);
  if (depth) parts.push(depth);
  const sample = String(photo.sampleRef || "").trim();
  if (sample) parts.push(`sample ${sample}`);
  if (photo.notes?.trim()) parts.push(photo.notes.trim());
  const lat = Number(photo.latitude);
  const lng = Number(photo.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    parts.push(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }
  if (photo.bearing != null && !Number.isNaN(Number(photo.bearing))) {
    parts.push(`bearing ${Math.round(Number(photo.bearing))}°`);
  }
  if (photo.capturedBy?.trim()) parts.push(photo.capturedBy.trim());
  return parts.join(" · ");
}

export function geoPhotosToSurveyPhotos(geoPhotos) {
  return (geoPhotos || [])
    .filter((p) => geoPhotoDisplayUrl(p))
    .map((p) => ({
      id: `sr_gp_${p.id}`,
      geoPhotoId: p.id,
      dataUrl: geoPhotoDisplayUrl(p),
      caption: geoPhotoCaption(p),
      latitude: p.latitude,
      longitude: p.longitude,
      bearing: p.bearing,
      geoPhotoType: p.type,
    }));
}

export function buildGeoPhotosFindingsBlock(geoPhotoList) {
  const list = [...(geoPhotoList || [])].sort((a, b) => {
    const oa = a.reportOrder ?? 9999;
    const ob = b.reportOrder ?? 9999;
    if (oa !== ob) return oa - ob;
    return new Date(a.timestampUtc || a.createdAt).getTime() - new Date(b.timestampUtc || b.createdAt).getTime();
  });

  if (!list.length) return "";

  const lines = list.map((p, i) => {
    const preset = geoPhotoPreset(p.type);
    const loc = resolvedGiLocationId(p);
    const depth = resolvedGiDepth(p);
    const giBits = [loc, depth].filter(Boolean).join(", ");
    const coords =
      Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
        ? ` (${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}` +
          (p.bearing != null ? `, ${Math.round(Number(p.bearing))}°` : "") +
          ")"
        : "";
    const note = p.notes?.trim() ? `: ${p.notes.trim()}` : "";
    const prefix = giBits ? `${preset.label} [${giBits}]` : preset.label;
    return `${i + 1}. ${prefix}${note}${coords}`;
  });

  return `${GEO_PHOTOS_FINDINGS_MARKER}\n${lines.join("\n")}`;
}

/**
 * Merge geo-photos into survey report (photos appendix + findings block).
 * @param {object} report
 * @param {object[]} allGeoPhotos
 * @param {{ replaceFindingsBlock?: boolean, mergeUtilitiesTable?: boolean }} [opts]
 */
export function importGeoPhotosIntoReport(report, allGeoPhotos, opts = {}) {
  const projectId = report?.projectId;
  if (!projectId) return { ...report, geoPhotoImportSkipped: "no_project" };

  const forReport = projectGeoPhotosForReport(allGeoPhotos, projectId);
  if (!forReport.length) return { ...report, geoPhotoImportSkipped: "none_marked" };

  const incoming = geoPhotosToSurveyPhotos(forReport);
  const existing = Array.isArray(report.photos) ? report.photos : [];
  const existingGeoIds = new Set(existing.map((p) => p.geoPhotoId).filter(Boolean));
  const mergedPhotos = [...existing.filter((p) => !p.geoPhotoId || forReport.some((g) => g.id === p.geoPhotoId))];
  incoming.forEach((ph) => {
    if (existingGeoIds.has(ph.geoPhotoId)) {
      const idx = mergedPhotos.findIndex((x) => x.geoPhotoId === ph.geoPhotoId);
      if (idx >= 0) mergedPhotos[idx] = ph;
    } else {
      mergedPhotos.push(ph);
    }
  });

  const block = buildGeoPhotosFindingsBlock(forReport);
  let findings = String(report.sections?.findings || "");
  if (findings.includes(GEO_PHOTOS_FINDINGS_MARKER)) {
    if (opts.replaceFindingsBlock) {
      findings = findings.replace(new RegExp(`${GEO_PHOTOS_FINDINGS_MARKER}[\\s\\S]*?(?=\\n===|$)`, "m"), block).trim();
      if (!findings.includes(GEO_PHOTOS_FINDINGS_MARKER)) findings = findings ? `${findings}\n\n${block}` : block;
    }
  } else {
    findings = findings.trim() ? `${findings.trim()}\n\n${block}` : block;
  }

  const accessTypes = new Set(["access_route", "site_entrance", "traffic_management", "locked_gate", "no_access"]);
  const accessPhotos = forReport.filter((p) => accessTypes.has(p.type));
  let accessLimitationsNotes = report.accessLimitationsNotes || "";
  if (accessPhotos.length && !accessLimitationsNotes.includes("Geo-photo access")) {
    const summary = accessPhotos
      .map((p) => geoPhotoPresetLabel(p.type) + (p.notes?.trim() ? `: ${p.notes.trim()}` : ""))
      .join("; ");
    accessLimitationsNotes = accessLimitationsNotes.trim()
      ? `${accessLimitationsNotes.trim()}\n\nGeo-photo access notes: ${summary}`
      : `Geo-photo access notes: ${summary}`;
  }

  let utilitiesTable = report.utilitiesTable || [];
  if (opts.mergeUtilitiesTable !== false) {
    utilitiesTable = geoPhotosToUtilitiesTable(allGeoPhotos, projectId, {
      existingRows: utilitiesTable,
      pas128Ql: report.pas128Ql,
    });
  }

  let giLocationsTable = report.giLocationsTable || [];
  if (opts.mergeGiLocationsTable !== false && report.surveyType === "site_investigation_campaign") {
    giLocationsTable = geoPhotosToGiLocationsTable(allGeoPhotos, projectId, {
      existingRows: giLocationsTable,
    });
  }

  return {
    ...report,
    photos: mergedPhotos,
    utilitiesTable,
    giLocationsTable,
    accessLimitationsNotes,
    sections: { ...report.sections, findings },
    geoPhotoImportAt: new Date().toISOString(),
    geoPhotoImportCount: forReport.length,
  };
}

/** Next reportOrder for new photo on project. */
export function nextGeoPhotoReportOrder(geoPhotos, projectId) {
  const orders = (geoPhotos || [])
    .filter((p) => p.projectId === projectId && p.includeInReport)
    .map((p) => Number(p.reportOrder))
    .filter((n) => Number.isFinite(n));
  return orders.length ? Math.max(...orders) + 1 : 1;
}

export function reorderGeoPhotoReport(photos, photoId, direction) {
  const list = projectGeoPhotosForReport(photos, photos.find((p) => p.id === photoId)?.projectId);
  const idx = list.findIndex((p) => p.id === photoId);
  if (idx < 0) return photos;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return photos;

  const ordered = list.map((p, i) => ({ ...p, reportOrder: i + 1 }));
  const a = ordered[idx];
  const b = ordered[swapIdx];
  ordered[idx] = { ...b, reportOrder: idx + 1 };
  ordered[swapIdx] = { ...a, reportOrder: swapIdx + 1 };

  const orderMap = Object.fromEntries(ordered.map((p) => [p.id, p.reportOrder]));
  return photos.map((p) => (orderMap[p.id] != null ? { ...p, reportOrder: orderMap[p.id] } : p));
}

export function normalizeGeoPhotoReportOrders(photos, projectId) {
  const ordered = projectGeoPhotosForReport(photos, projectId);
  const orderMap = Object.fromEntries(ordered.map((p, i) => [p.id, i + 1]));
  return photos.map((p) =>
    p.projectId === projectId && p.includeInReport && orderMap[p.id] != null ? { ...p, reportOrder: orderMap[p.id] } : p
  );
}

export function exportGeoPhotosGeoJson(photos, name = "geo-photos") {
  const features = (photos || [])
    .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
    .map((p) => {
      const grid = wgs84ToBritishNationalGrid(p.latitude, p.longitude);
      const elevation = Number(p.altitudeMeters);
      const accuracy = Number(p.gpsAccuracyMeters);
      const coordinates = [Number(p.longitude), Number(p.latitude)];
      if (Number.isFinite(elevation)) coordinates.push(elevation);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties: {
          id: p.id,
          type: p.type,
          label: geoPhotoPresetLabel(p.type),
          bearing: p.bearing,
          notes: p.notes,
          includeInReport: Boolean(p.includeInReport),
          projectId: p.projectId,
          projectName: p.projectName,
          capturedBy: p.capturedBy,
          timestampUtc: p.timestampUtc,
          gpsAccuracyMeters: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
          altitudeMeters: Number.isFinite(elevation) ? elevation : null,
          locationSource: p.locationSource || null,
          easting: grid ? grid.easting : null,
          northing: grid ? grid.northing : null,
          gridRef: grid ? grid.gridRef : null,
          coordinateSystem: grid ? "OSGB36 / British National Grid (EPSG:27700)" : null,
        },
      };
    });

  return {
    type: "FeatureCollection",
    name,
    features,
  };
}

export function downloadGeoJson(photos, fileName) {
  const geo = exportGeoPhotosGeoJson(photos);
  const blob = new Blob([JSON.stringify(geo, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `geo-photos-${todayLocalISO()}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build snag draft from geo-photo (hazard / obstruction types → high priority). */
export function snagDraftFromGeoPhoto(photo) {
  const preset = geoPhotoPreset(photo.type);
  const hazardTypes = new Set(["hazard", "obstruction", "no_access", "locked_gate", "overhead_obstruction"]);
  const priority = hazardTypes.has(photo.type) ? "high" : "medium";
  const category = photo.type.includes("electrical") || photo.type.includes("utility") ? "Electrical" : "Safety";

  return {
    id: `snag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: `${preset.label}${photo.notes?.trim() ? `: ${photo.notes.trim().slice(0, 60)}` : ""}`,
    description: [
      `Created from geo-photo (${preset.label}).`,
      photo.notes?.trim() || "",
      Number.isFinite(Number(photo.latitude))
        ? `Location: ${Number(photo.latitude).toFixed(6)}, ${Number(photo.longitude).toFixed(6)}`
        : "",
      photo.bearing != null ? `Camera bearing: ${Math.round(Number(photo.bearing))}°` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    category,
    priority,
    status: "open",
    projectId: photo.projectId || "",
    location: photo.notes?.trim() || preset.label,
    assignedTo: "",
    dueDate: "",
    photos: photo.photoDataUrl
      ? [{ id: `ph_${Date.now()}`, dataUrl: photo.photoDataUrl, name: "geo-photo.jpg", ts: photo.timestampUtc }]
      : [],
    createdAt: new Date().toISOString(),
    ref: "",
    sourceGeoPhotoId: photo.id,
  };
}

export { GEO_PHOTO_GI_TYPES, permitHasSiteEvidence };

/** Geo-photo types that map to utility schedule rows in survey reports. */
export const GEO_PHOTO_UTILITY_TYPES = new Set([
  "utility_locator",
  "trial_pit",
  "manhole_chamber",
  "buried_services_warning",
  "gpr_setup",
]);

const GEO_PHOTO_UTILITY_DEFAULTS = {
  utility_locator: { utilityType: "other", method: "EML / CAT locate", confidence: "medium" },
  trial_pit: { utilityType: "other", method: "Trial pit / exposure", confidence: "high" },
  manhole_chamber: { utilityType: "foul", method: "Chamber inspection", confidence: "high" },
  buried_services_warning: {
    utilityType: "other",
    method: "Surface evidence / warning marker",
    confidence: "indicative",
  },
  gpr_setup: { utilityType: "other", method: "GPR", confidence: "medium" },
};

/** Try to pull depth from geo-photo notes (e.g. "0.8m", "depth 1.2 m"). */
export function parseDepthFromNotes(notes) {
  const t = String(notes || "");
  const m =
    t.match(/(?:depth|approx\.?\s*depth|@)\s*[:.]?\s*(\d+(?:\.\d+)?)\s*m\b/i) ||
    t.match(/\b(\d+(?:\.\d+)?)\s*m\b(?:\s*(?:deep|depth|bgl))?/i);
  return m ? `${m[1]} m` : "";
}

/**
 * Build one utility schedule row from a geo-photo (survey & utilities types only).
 * @param {object} photo
 * @param {{ pas128Ql?: string }} [opts]
 */
export function geoPhotoToUtilityRow(photo, opts = {}) {
  if (!photo?.type || !GEO_PHOTO_UTILITY_TYPES.has(photo.type)) return null;
  const defaults = GEO_PHOTO_UTILITY_DEFAULTS[photo.type] || {};
  const preset = geoPhotoPreset(photo.type);
  const depth = resolvedGiDepth(photo) || parseDepthFromNotes(photo.notes);
  const loc = resolvedGiLocationId(photo);
  const coords =
    Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude))
      ? `${Number(photo.latitude).toFixed(5)}, ${Number(photo.longitude).toFixed(5)}`
      : "";

  return {
    id: `ut_gp_${photo.id}`,
    geoPhotoId: photo.id,
    utilityType: defaults.utilityType || "other",
    depth,
    method: defaults.method || preset.label,
    pas128Ql: opts.pas128Ql || "",
    confidence: defaults.confidence || "medium",
    notes: [loc ? `ID: ${loc}` : "", photo.notes?.trim(), coords ? `Location: ${coords}` : "", `Source: geo-photo (${preset.label})`]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Replace geo-photo-derived rows; keep manual rows without geoPhotoId. */
export function upsertGeoPhotoDerivedRows(existingRows = [], incomingRows = []) {
  const manual = (existingRows || []).filter((r) => !r.geoPhotoId);
  return [...manual, ...(incomingRows || [])];
}

/**
 * Build utility table rows from geo-photos marked for report (upsert by geoPhotoId).
 */
export function geoPhotosToUtilitiesTable(allGeoPhotos, projectId, { existingRows = [], pas128Ql = "" } = {}) {
  const forReport = projectGeoPhotosForReport(allGeoPhotos, projectId);
  const incoming = forReport
    .map((p) => geoPhotoToUtilityRow(p, { pas128Ql }))
    .filter(Boolean);

  return upsertGeoPhotoDerivedRows(existingRows, incoming);
}

const GEO_PHOTO_GI_DEFAULTS = {
  trial_pit: { method: "Trial pit", locationIdPrefix: "TP" },
  borehole_location: { method: "Borehole", locationIdPrefix: "BH" },
  window_sampling: { method: "Window sampling", locationIdPrefix: "WS" },
  dcp_probe: { method: "DCP / dynamic probe", locationIdPrefix: "DCP" },
  hand_auger_point: { method: "Hand auger", locationIdPrefix: "HA" },
  sample_custody: { method: "Sample recovery", locationIdPrefix: "S" },
  borehole_cap: { method: "Borehole abandonment", locationIdPrefix: "BH" },
  piezometer_install: { method: "Piezometer / standpipe", locationIdPrefix: "PZ" },
};

export { parseLocationIdFromNotes } from "./geoPhotoFields";

/**
 * Build one GI location row from a geo-photo (ground investigation types only).
 * @param {object} photo
 */
export function geoPhotoToGiLocationRow(photo) {
  if (!photo?.type || !GEO_PHOTO_GI_TYPES.has(photo.type)) return null;
  const defaults = GEO_PHOTO_GI_DEFAULTS[photo.type] || {};
  const preset = geoPhotoPreset(photo.type);
  const depth = resolvedGiDepth(photo);
  const locationId =
    resolvedGiLocationId(photo) ||
    `${defaults.locationIdPrefix || "GI"}-${String(photo.id || "").slice(-4).toUpperCase()}`;
  const coords =
    Number.isFinite(Number(photo.latitude)) && Number.isFinite(Number(photo.longitude))
      ? `${Number(photo.latitude).toFixed(5)}, ${Number(photo.longitude).toFixed(5)}`
      : "";

  return {
    id: `gi_gp_${photo.id}`,
    geoPhotoId: photo.id,
    locationId,
    method: defaults.method || preset.label,
    depth,
    notes: [photo.notes?.trim(), coords ? `Location: ${coords}` : "", `Source: geo-photo (${preset.label})`]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Build GI location table rows from geo-photos marked for report (upsert by geoPhotoId). */
export function geoPhotosToGiLocationsTable(allGeoPhotos, projectId, { existingRows = [] } = {}) {
  const forReport = projectGeoPhotosForReport(allGeoPhotos, projectId);
  const incoming = forReport
    .map((p) => geoPhotoToGiLocationRow(p))
    .filter(Boolean);

  return upsertGeoPhotoDerivedRows(existingRows, incoming);
}

/** Static map URL for geo-photo GPS cluster (offline SVG — no third-party staticmap host). */
export function geoPhotosStaticMapUrl(photos, { width = 520, height = 220, maxMarkers = 25 } = {}) {
  const pts = (photos || [])
    .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)));
  const capped = pts.slice(0, maxMarkers);
  if (!capped.length) return "";
  const lat = capped.reduce((s, p) => s + Number(p.latitude), 0) / capped.length;
  const lng = capped.reduce((s, p) => s + Number(p.longitude), 0) / capped.length;
  const zoom = capped.length === 1 ? 16 : pts.length > 8 ? 14 : 15;
  return buildStaticMapUrl(lat, lng, {
    width,
    height,
    zoom,
    label: capped.length === 1 ? "Geo-photo" : `${capped.length} geo-photos`,
  });
}

export function geoPhotosStaticMapCaption(photos, maxMarkers = 25) {
  const total = (photos || []).filter(
    (p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
  ).length;
  if (total <= maxMarkers) return "";
  return `Map shows ${maxMarkers} of ${total} GPS-tagged geo-photos.`;
}

/** Build permit evidence patch from a geo-photo. */
export function applyGeoPhotoToPermitEvidence(photo) {
  const url = geoPhotoDisplayUrl(photo);
  if (!url) return null;
  const caption = geoPhotoCaption(photo);
  return {
    evidencePhotoUrl: url,
    evidencePhotoStoragePath: "",
    evidenceGeoPhotoId: photo.id,
    evidenceNotesAppend: `Geo-photo evidence: ${caption}`,
  };
}

/** Merge geo-photo into permit record (immutable). */
export function linkGeoPhotoToPermit(permit, photo) {
  const patch = applyGeoPhotoToPermitEvidence(photo);
  if (!patch) return permit;
  const notes = String(permit?.evidenceNotes || "").trim();
  const append = patch.evidenceNotesAppend;
  return {
    ...permit,
    evidencePhotoUrl: patch.evidencePhotoUrl,
    evidencePhotoStoragePath: "",
    evidenceGeoPhotoId: photo.id,
    evidenceNotes: notes ? `${notes}\n${append}` : append,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Persist permit evidence link after geo-photo save (org-scoped storage).
 * @param {object} photo — must include linkedPermitId when captured from PTW
 * @param {{ load?: Function, save?: Function }} [storage]
 */
export function persistPermitEvidenceFromGeoPhoto(photo, storage = {}) {
  const permitId = photo?.linkedPermitId;
  if (!permitId) return false;
  const loadFn = storage.load;
  const saveFn = storage.save;
  if (typeof loadFn !== "function" || typeof saveFn !== "function") return false;
  const permits = loadFn("permits_v2", []);
  const idx = permits.findIndex((p) => p.id === permitId);
  if (idx < 0) return false;
  const next = [...permits];
  next[idx] = linkGeoPhotoToPermit(next[idx], photo);
  saveFn("permits_v2", next);
  return true;
}

/** Set linkedPermitId on geo-photo when picked as permit evidence. */
export function persistGeoPhotoLinkedPermit(photoId, permitId, storage = {}) {
  const loadFn = storage.load;
  const saveFn = storage.save;
  if (!photoId || !permitId || typeof loadFn !== "function" || typeof saveFn !== "function") return false;
  const photos = loadFn("geo_photos", []);
  const idx = photos.findIndex((p) => p.id === photoId);
  if (idx < 0) return false;
  const next = [...photos];
  next[idx] = { ...next[idx], linkedPermitId: permitId, updatedAt: new Date().toISOString() };
  saveFn("geo_photos", next);
  return true;
}

/** Pick geo-photo as permit evidence — updates permit form state and persists photo link. */
export function pickGeoPhotoAsPermitEvidence(permit, photo, storage = {}) {
  if (permit?.id && photo?.id) persistGeoPhotoLinkedPermit(photo.id, permit.id, storage);
  return linkGeoPhotoToPermit(permit, photo);
}

/** Clear permit evidence when geo-photo with active link is deleted. */
export function clearPermitEvidenceForGeoPhoto(photo, storage = {}) {
  const permitId = photo?.linkedPermitId;
  if (!permitId) return false;
  const loadFn = storage.load;
  const saveFn = storage.save;
  if (typeof loadFn !== "function" || typeof saveFn !== "function") return false;
  const permits = loadFn("permits_v2", []);
  const idx = permits.findIndex((p) => p.id === permitId && p.evidenceGeoPhotoId === photo.id);
  if (idx < 0) return false;
  const next = [...permits];
  next[idx] = {
    ...next[idx],
    evidenceGeoPhotoId: "",
    evidencePhotoUrl: "",
    evidencePhotoStoragePath: "",
    updatedAt: new Date().toISOString(),
  };
  saveFn("permits_v2", next);
  return true;
}
