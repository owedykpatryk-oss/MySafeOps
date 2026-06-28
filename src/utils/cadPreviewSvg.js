import { cadQlStyle, cadUtilityColor } from "./cadImportVisuals.js";

/**
 * Build SVG preview of CAD linework for editor and print.
 * @param {{ bounds: object, paths: object[] }} preview
 * @param {{ width?: number, height?: number, title?: string }} [opts]
 */
export function buildCadPreviewSvg(preview, opts = {}) {
  if (!preview?.paths?.length || !preview.bounds) return "";

  const width = opts.width ?? 520;
  const height = opts.height ?? 220;
  const pad = 14;
  const { minX, maxX, minY, maxY } = preview.bounds;
  const rangeX = Math.max(maxX - minX, 0.001);
  const rangeY = Math.max(maxY - minY, 0.001);
  const scale = Math.min((width - pad * 2) / rangeX, (height - pad * 2) / rangeY);

  const tx = (x) => pad + (x - minX) * scale;
  const ty = (y) => height - pad - (y - minY) * scale;

  const pathEls = preview.paths
    .map((p) => {
      if (!p.pts?.length) return "";
      const d = p.pts
        .map((pt, i) => `${i === 0 ? "M" : "L"}${tx(pt[0]).toFixed(1)},${ty(pt[1]).toFixed(1)}`)
        .join(" ");
      const color = p.color || cadUtilityColor(p.utilityKey || "other");
      const dash = p.isRecordsDerived ? ' stroke-dasharray="4 3"' : "";
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"${dash}/>`;
    })
    .join("");

  const legend = buildLegendItems(preview.paths)
    .slice(0, 6)
    .map(
      (item) =>
        `<span class="sr-cad-map-key"><span class="sr-cad-map-dot" style="background:${item.color}"></span>${escapeXml(item.label)}</span>`
    )
    .join("");

  return `<figure class="sr-cad-map">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="CAD linework preview">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fafc" rx="6"/>
      <rect x="${pad - 2}" y="${pad - 2}" width="${width - pad * 2 + 4}" height="${height - pad * 2 + 4}" fill="#fff" stroke="#e5e7eb" rx="4"/>
      ${pathEls}
    </svg>
    ${legend ? `<figcaption class="sr-cad-map-legend">${legend}</figcaption>` : ""}
  </figure>`;
}

function buildLegendItems(paths) {
  const seen = new Map();
  paths.forEach((p) => {
    const key = p.utilityKey || p.layer || "other";
    if (seen.has(key)) return;
    seen.set(key, {
      label: p.utilityLabel || p.layer || "Linework",
      color: p.color || cadUtilityColor(p.utilityKey || "other"),
    });
  });
  return [...seen.values()];
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * SVG donut chart for PAS128 QL length share.
 * @param {{ key: string, lengthM: number, style?: object }[]} byQl
 * @param {number} totalM
 */
export function buildCadQlDonutSvg(byQl, totalM, opts = {}) {
  if (!byQl?.length || !totalM) return "";

  const size = opts.size ?? 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const ir = size * 0.24;
  let angle = -90;

  const arcs = byQl
    .filter((q) => q.lengthM > 0)
    .map((q) => {
      const sweep = (q.lengthM / totalM) * 360;
      const start = angle;
      angle += sweep;
      const end = angle;
      const color = q.style?.border || cadQlStyle(q.key).border;
      return donutArc(cx, cy, r, ir, start, end, color);
    })
    .join("");

  const legend = byQl
    .slice(0, 5)
    .map((q) => {
      const pct = Math.round((q.lengthM / totalM) * 100);
      const color = q.style?.border || cadQlStyle(q.key).border;
      return `<span class="sr-cad-donut-key"><span class="sr-cad-map-dot" style="background:${color}"></span>${escapeXml(q.key)} ${pct}%</span>`;
    })
    .join("");

  return `<div class="sr-cad-donut-wrap">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="PAS128 QL length share">
      ${arcs}
      <circle cx="${cx}" cy="${cy}" r="${ir - 1}" fill="#fff"/>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="9" font-weight="700" fill="#0f766e">QL</text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="8" fill="#6b7280">share</text>
    </svg>
    <div class="sr-cad-donut-legend">${legend}</div>
  </div>`;
}

function donutArc(cx, cy, r, ir, startDeg, endDeg, color) {
  if (endDeg - startDeg <= 0.01) return "";
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const startInner = polar(cx, cy, ir, endDeg);
  const endInner = polar(cx, cy, ir, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const d = [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${ir} ${ir} 0 ${large} 1 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
  return `<path d="${d}" fill="${color}" opacity="0.92"/>`;
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** React-friendly SVG path list (no HTML wrapper). */
export function cadPreviewPathElements(preview, width = 480, height = 200) {
  if (!preview?.paths?.length || !preview.bounds) return null;

  const pad = 12;
  const { minX, maxX, minY, maxY } = preview.bounds;
  const rangeX = Math.max(maxX - minX, 0.001);
  const rangeY = Math.max(maxY - minY, 0.001);
  const scale = Math.min((width - pad * 2) / rangeX, (height - pad * 2) / rangeY);
  const tx = (x) => pad + (x - minX) * scale;
  const ty = (y) => height - pad - (y - minY) * scale;

  return preview.paths.map((p, idx) => ({
    key: `p-${idx}`,
    d: p.pts.map((pt, i) => `${i === 0 ? "M" : "L"}${tx(pt[0]).toFixed(1)},${ty(pt[1]).toFixed(1)}`).join(" "),
    color: p.color || cadUtilityColor(p.utilityKey || "other"),
    dash: p.isRecordsDerived,
  }));
}

export function cadQlDonutSegments(byQl, totalM) {
  if (!byQl?.length || !totalM) return [];
  let angle = -90;
  return byQl
    .filter((q) => q.lengthM > 0)
    .map((q) => {
      const sweep = (q.lengthM / totalM) * 360;
      const seg = { ...q, startAngle: angle, sweepAngle: sweep, color: q.style?.border || cadQlStyle(q.key).border };
      angle += sweep;
      return seg;
    });
}
