/**
 * A sketch plan of where the geo-photos actually are, drawn as a self-contained SVG.
 *
 * The report used to show one pin on a decorative grid however many photos were taken, which
 * told a reader nothing about how the site was laid out. This plots the points in their true
 * relative positions with the ground each one covers, so the plan can be read against the
 * photographs. Everything is inline SVG: print and PDF export must not depend on a tile host.
 *
 * Positions come from a phone GPS, so the plan is indicative and says so — it is a locator,
 * not a survey drawing. Anyone needing coordinates has the KML, DXF and GeoJSON exports.
 */
import { geoPhotoPreset } from "./geoPhotoPresets";
import { formatAreaSqm, geoPhotoAreaOf } from "./geoPhotoArea";
import { normalizeBearing } from "./geoPhotoUtils";

const EARTH_RADIUS_M = 6371008.8;
/** Bar lengths that read as measurements rather than arithmetic. */
const SCALE_STEPS_M = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const isNum = (value) => Number.isFinite(Number(value));

/** Local metres east/north of the origin — flat earth is exact enough across one site. */
function projectMetres(lat, lng, originLat, originLng) {
  const rad = Math.PI / 180;
  return {
    x: (Number(lng) - originLng) * rad * EARTH_RADIUS_M * Math.cos(originLat * rad),
    y: (Number(lat) - originLat) * rad * EARTH_RADIUS_M,
  };
}

function scaleBarFor(metresPerPx, maxPx) {
  for (let i = SCALE_STEPS_M.length - 1; i >= 0; i -= 1) {
    const px = SCALE_STEPS_M[i] / metresPerPx;
    if (px <= maxPx) return { metres: SCALE_STEPS_M[i], px };
  }
  return { metres: SCALE_STEPS_M[0], px: SCALE_STEPS_M[0] / metresPerPx };
}

/**
 * @param {object[]} photos geo-photos, or survey photos carrying latitude/longitude/area
 * @param {{ width?: number, height?: number, maxMarkers?: number }} [opts]
 * @returns {string} SVG markup, or "" when nothing can be plotted
 */
export function buildGeoPhotoSitePlanSvg(photos, opts = {}) {
  const width = Math.round(Number(opts.width) || 520);
  const height = Math.round(Number(opts.height) || 260);
  const maxMarkers = Number(opts.maxMarkers) || 25;

  const plotted = (photos || []).filter((p) => isNum(p?.latitude) && isNum(p?.longitude)).slice(0, maxMarkers);
  if (!plotted.length) return "";

  const originLat = plotted.reduce((sum, p) => sum + Number(p.latitude), 0) / plotted.length;
  const originLng = plotted.reduce((sum, p) => sum + Number(p.longitude), 0) / plotted.length;

  const items = plotted.map((photo, index) => {
    const area = geoPhotoAreaOf(photo);
    return {
      photo,
      label: String(photo.figureNum ?? index + 1),
      colour: geoPhotoPreset(photo.type || photo.geoPhotoType).color || "#2563eb",
      point: projectMetres(photo.latitude, photo.longitude, originLat, originLng),
      ring: area ? area.points.map(([lat, lng]) => projectMetres(lat, lng, originLat, originLng)) : null,
      area,
    };
  });

  const everyPoint = items.flatMap((item) => [item.point, ...(item.ring || [])]);
  const xs = everyPoint.map((p) => p.x);
  const ys = everyPoint.map((p) => p.y);
  // A single photo has no spread of its own, so give it a plot 50 m across to sit in.
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 25);
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 25);

  const padX = 16;
  const padTop = 16;
  const padBottom = 34;
  const scale = Math.min((width - padX * 2) / spanX, (height - padTop - padBottom) / spanY);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const toPx = (p) => ({
    x: width / 2 + (p.x - midX) * scale,
    // SVG y grows downwards; north has to stay up or the plan lies about the site.
    y: (height - padBottom + padTop) / 2 - (p.y - midY) * scale,
  });

  const extents = items
    .filter((item) => item.ring)
    .map((item) => {
      const points = item.ring.map(toPx).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      return `<polygon points="${points}" fill="${item.colour}" fill-opacity="0.22" stroke="${item.colour}" stroke-width="1.5"/>`;
    })
    .join("");

  const markers = items
    .map((item) => {
      const at = toPx(item.point);
      const bearing = normalizeBearing(item.photo.bearing);
      const arrow =
        bearing == null
          ? ""
          : (() => {
              const rad = (bearing * Math.PI) / 180;
              const x2 = at.x + Math.sin(rad) * 16;
              const y2 = at.y - Math.cos(rad) * 16;
              return `<line x1="${at.x.toFixed(1)}" y1="${at.y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(
                1
              )}" stroke="${item.colour}" stroke-width="2" stroke-linecap="round"/>`;
            })();
      return `${arrow}<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="7" fill="${
        item.colour
      }" stroke="#fff" stroke-width="2"/><text x="${at.x.toFixed(1)}" y="${(at.y + 3.2).toFixed(
        1
      )}" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="8" font-weight="700" fill="#fff">${escapeXml(
        item.label
      )}</text>`;
    })
    .join("");

  const bar = scaleBarFor(1 / scale, Math.min(140, width / 3));
  const barY = height - 13;
  const barX = 16;
  const traced = items.filter((item) => item.area);
  const tracedNote = traced.length
    ? ` · ${traced.length} extent${traced.length === 1 ? "" : "s"} shaded (${formatAreaSqm(
        traced.reduce((sum, item) => sum + item.area.sqm, 0)
      )})`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  ${extents}
  ${markers}
  <g transform="translate(${width - 26} 22)">
    <path d="M0 -12 L5 6 L0 2 L-5 6 Z" fill="#0f172a"/>
    <text x="0" y="18" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="9" font-weight="700" fill="#0f172a">N</text>
  </g>
  <g stroke="#0f172a" stroke-width="2">
    <line x1="${barX}" y1="${barY}" x2="${(barX + bar.px).toFixed(1)}" y2="${barY}"/>
    <line x1="${barX}" y1="${barY - 3}" x2="${barX}" y2="${barY + 3}"/>
    <line x1="${(barX + bar.px).toFixed(1)}" y1="${barY - 3}" x2="${(barX + bar.px).toFixed(1)}" y2="${barY + 3}"/>
  </g>
  <text x="${(barX + bar.px + 6).toFixed(1)}" y="${barY + 3.5}" font-family="Segoe UI,system-ui,sans-serif" font-size="9" fill="#0f172a">${
    bar.metres
  } m</text>
  <text x="${width - 12}" y="${barY + 3.5}" text-anchor="end" font-family="Segoe UI,system-ui,sans-serif" font-size="8.5" fill="#64748b">Indicative — GPS positions${escapeXml(
    tracedNote
  )}</text>
</svg>`;
}

/** The plan as a data URL, safe to drop straight into an &lt;img&gt; in print HTML. */
export function geoPhotoSitePlanUrl(photos, opts = {}) {
  const svg = buildGeoPhotoSitePlanSvg(photos, opts);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";
}
