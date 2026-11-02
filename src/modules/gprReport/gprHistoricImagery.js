/**
 * Dated Esri World Imagery (Wayback) frames for a survey coordinate.
 * A frame is an archive mosaic release, not a claimed capture of a building or land use.
 */

import { appApiUrl } from "../../utils/appApiUrl.js";

const WAYBACK_CONFIG_URL = "https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json";
const TILE_SIZE = 256;
const ZOOM = 17;
const SAMPLE_COUNT = 8;
const RING_METRES = 50;

export function gprSitePoint(report, project) {
  const candidates = [
    [report?.preSurvey?.lat, report?.preSurvey?.lng],
    [report?.siteLat, report?.siteLng],
    [project?.lat, project?.lng],
    [project?.siteLat, project?.siteLng],
    [report?.groundConditions?.queryLat, report?.groundConditions?.queryLng],
  ];
  for (const [lat, lng] of candidates) {
    const la = Number(lat);
    const ln = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180 && !(la === 0 && ln === 0)) {
      return { lat: la, lng: ln };
    }
  }
  return null;
}

export function parseWaybackConfig(config) {
  if (!config || typeof config !== "object") return [];
  return Object.entries(config).map(([release, item]) => {
    const title = String(item?.itemTitle || "");
    const date = title.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || "";
    const tileTemplate = String(item?.itemURL || "");
    return {
      release: String(release),
      date,
      title,
      itemId: String(item?.itemID || ""),
      tileTemplate,
    };
  }).filter((item) => item.date && item.tileTemplate.includes("{level}"));
}

export function selectReleaseSpread(releases, max = SAMPLE_COUNT) {
  const sorted = [...releases].sort((a, b) => a.date.localeCompare(b.date) || a.release.localeCompare(b.release));
  if (sorted.length <= max) return sorted;
  const seen = new Set();
  const picked = [];
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i * (sorted.length - 1)) / (max - 1));
    const item = sorted[idx];
    if (!item || seen.has(item.release)) continue;
    seen.add(item.release);
    picked.push(item);
  }
  return picked;
}

export function globalPixel(lat, lng, zoom = ZOOM, tileSize = TILE_SIZE) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n * tileSize;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * tileSize;
  return { x, y };
}

export function tileIndex(lat, lng, zoom = ZOOM) {
  const pixel = globalPixel(lat, lng, zoom);
  return {
    zoom,
    col: Math.floor(pixel.x / TILE_SIZE),
    row: Math.floor(pixel.y / TILE_SIZE),
  };
}

export function markerPixel(lat, lng, zoom, originCol, originRow) {
  const pixel = globalPixel(lat, lng, zoom);
  return {
    x: pixel.x - originCol * TILE_SIZE,
    y: pixel.y - originRow * TILE_SIZE,
  };
}

export function metersToPixels(lat, zoom, metres, tileSize = TILE_SIZE) {
  const resolution = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / (2 ** zoom);
  return (metres / resolution) * (tileSize / 256);
}

export function waybackTileUrl(template, zoom, row, col) {
  return String(template)
    .split("{level}").join(String(zoom))
    .split("{row}").join(String(row))
    .split("{col}").join(String(col));
}

export function dedupeFrames(frames) {
  const bySignature = new Map();
  for (const frame of frames) {
    if (!frame?.signature) continue;
    const existing = bySignature.get(frame.signature);
    if (!existing) {
      bySignature.set(frame.signature, { ...frame, releaseDates: [frame.date] });
    } else if (!existing.releaseDates.includes(frame.date)) {
      existing.releaseDates.push(frame.date);
    }
  }
  return [...bySignature.values()]
    .map((frame) => ({ ...frame, releaseDates: [...frame.releaseDates].sort() }))
    .sort((a, b) => a.releaseDates[0].localeCompare(b.releaseDates[0]));
}

export function archiveFrameFact(frame, point) {
  const dates = frame.releaseDates?.length ? frame.releaseDates : [frame.date];
  const when = dates.length > 1
    ? `the same mosaic pixels were published in the sampled releases ${dates.join(", ")}`
    : `Wayback release dated ${dates[0]}`;
  if (frame.kind === "historic_map") {
    return `National Library of Scotland georeferenced sheet “${frame.title || frame.date}”, centred on survey coordinate ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}. The date is the map series title, not a claim about structures on the site. The crosshair marks the survey coordinate. The ring is a ${RING_METRES} m guide, not a legal boundary.`;
  }
  return `Esri World Imagery ${when}. The crosshair marks survey coordinate ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}. The ring is a ${RING_METRES} m guide around that coordinate, not a legal boundary. No structure, burial or previous land use has been interpreted from this image.`;
}

export function archiveFrameDraft(frame, point, imageDataUrl) {
  const dates = frame.releaseDates?.length ? frame.releaseDates : [frame.date];
  return {
    kind: frame.kind === "historic_map" ? "historic_map" : "satellite",
    title: frame.title || `World Imagery ${dates[0]}`,
    sourceName: frame.sourceName || "Esri World Imagery (Wayback)",
    sourceUrl: frame.sourceUrl || (frame.itemId ? `https://www.arcgis.com/home/item.html?id=${encodeURIComponent(frame.itemId)}` : ""),
    sourceDate: dates[0],
    observedFact: archiveFrameFact(frame, point),
    coverageNotes: `Archive mosaic centred on the survey coordinate. Release dates sampled: ${dates.join(", ")}. Confirm what is actually visible before treating any feature as a fact.`,
    imageDataUrl,
    imageFileName: `wayback-${dates[0]}.jpg`,
    verified: false,
    verifiedBy: "",
    verifiedAt: "",
  };
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function loadArchiveFrames(point, { fetchImpl = fetch, maxFrames = 6 } = {}) {
  const response = await fetchImpl(WAYBACK_CONFIG_URL);
  if (!response.ok) throw new Error("Wayback catalogue unavailable");
  const releases = selectReleaseSpread(parseWaybackConfig(await response.json()));
  const { col, row, zoom } = tileIndex(point.lat, point.lng, ZOOM);
  const loaded = [];
  for (const release of releases) {
    const url = waybackTileUrl(release.tileTemplate, zoom, row, col);
    try {
      const tile = await fetchImpl(url);
      if (!tile.ok) continue;
      const bytes = await tile.arrayBuffer();
      if (!bytes.byteLength) continue;
      loaded.push({
        ...release,
        signature: await sha256Hex(bytes),
        zoom,
        col,
        row,
        tileUrl: url,
        marker: markerPixel(point.lat, point.lng, zoom, col, row),
        ringPx: metersToPixels(point.lat, zoom, RING_METRES),
      });
    } catch {
      // A missing year is omitted; it is not filled with another date.
    }
  }
  return dedupeFrames(loaded).slice(0, maxFrames);
}

export const NLS_SERIES = [
  { id: "os_6_inch_1888_1913", title: "OS six-inch series 1888–1913", date: "1888–1913" },
  { id: "os_25_inch_1892_1914", title: "OS 25-inch series 1892–1914", date: "1892–1914" },
];

export function nlsTileRequest(seriesId, zoom, col, row) {
  const series = NLS_SERIES.find((item) => item.id === seriesId);
  const z = Number(zoom);
  const x = Number(col);
  const y = Number(row);
  if (!series || !Number.isInteger(z) || z < 10 || z > 18) return null;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return null;
  return {
    series,
    upstream: `https://nls.tileserver.com/${series.id}/${z}/${x}/${y}.png`,
    proxyPath: appApiUrl(`/api/gpr-archive-tile?series=${encodeURIComponent(series.id)}&z=${z}&x=${x}&y=${y}`),
  };
}

export async function loadNlsFrames(point, { fetchImpl = fetch } = {}) {
  const { col, row, zoom } = tileIndex(point.lat, point.lng, ZOOM);
  const frames = [];
  for (const series of NLS_SERIES) {
    const request = nlsTileRequest(series.id, zoom, col, row);
    if (!request) continue;
    try {
      const tile = await fetchImpl(request.proxyPath);
      if (!tile.ok) continue;
      const bytes = await tile.arrayBuffer();
      if (bytes.byteLength < 800) continue;
      frames.push({
        release: series.id,
        date: series.date,
        releaseDates: [series.date],
        title: series.title,
        itemId: "",
        sourceUrl: `https://maps.nls.uk/geo/explore/#zoom=17.0&lat=${point.lat.toFixed(6)}&lon=${point.lng.toFixed(6)}`,
        kind: "historic_map",
        sourceName: "National Library of Scotland",
        signature: series.id,
        zoom,
        col,
        row,
        tileUrl: request.proxyPath,
        marker: markerPixel(point.lat, point.lng, zoom, col, row),
        ringPx: metersToPixels(point.lat, zoom, RING_METRES),
      });
    } catch {
      // A missing sheet is omitted.
    }
  }
  return frames;
}

export const ARCHIVE_ZOOM = ZOOM;
export const ARCHIVE_RING_METRES = RING_METRES;
