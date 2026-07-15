/**
 * Site map thumbnails / print maps without flaky third-party staticmap hosts.
 * Returns a self-contained SVG data URL (no network) so consoles stay clean.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{ width?: number, height?: number, zoom?: number, label?: string }} [opts]
 * @returns {string} data:image/svg+xml URL, or "" if coords invalid
 */
export function buildStaticMapUrl(lat, lng, opts = {}) {
  if (lat == null || lng == null || lat === "" || lng === "") return "";
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "";

  const width = clamp(Math.round(Number(opts.width) || 520), 48, 1280);
  const height = clamp(Math.round(Number(opts.height) || 220), 48, 1280);
  const zoom = clamp(Math.round(Number(opts.zoom) || 15), 1, 19);
  const label = String(opts.label || "Site").slice(0, 40);
  const coord = `${la.toFixed(5)}, ${lo.toFixed(5)}`;
  const osm = `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=${zoom}/${la}/${lo}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ecfdf5"/>
      <stop offset="55%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <g opacity="0.35" stroke="#94a3b8" stroke-width="1">
    ${Array.from({ length: 6 }, (_, i) => {
      const x = Math.round(((i + 1) * width) / 7);
      return `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
    }).join("")}
    ${Array.from({ length: 4 }, (_, i) => {
      const y = Math.round(((i + 1) * height) / 5);
      return `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
    }).join("")}
  </g>
  <circle cx="${width / 2}" cy="${height / 2 - 8}" r="10" fill="#dc2626" stroke="#fff" stroke-width="2"/>
  <path d="M${width / 2} ${height / 2 + 4} L${width / 2 - 7} ${height / 2 - 4} L${width / 2 + 7} ${height / 2 - 4} Z" fill="#dc2626"/>
  <text x="${width / 2}" y="${height - 28}" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="${Math.max(10, Math.min(13, width / 28))}" font-weight="700" fill="#0f766e">${escapeXml(label)}</text>
  <text x="${width / 2}" y="${height - 12}" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="${Math.max(9, Math.min(11, width / 36))}" fill="#64748b">${escapeXml(coord)}</text>
</svg>`;

  // OSM link kept for callers that want an href alongside the map image
  buildStaticMapUrl.lastOsmUrl = osm;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** OpenStreetMap browser link for the last buildStaticMapUrl call (or recompute). */
export function buildOpenStreetMapLink(lat, lng, zoom = 15) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "";
  const z = clamp(Math.round(Number(zoom) || 15), 1, 19);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=${z}/${la}/${lo}`;
}
