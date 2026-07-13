/**
 * Horizontal PAS 128 workflow pipeline — SVG for print and editor preview.
 */

import { getPas128WorkflowSteps } from "./pas128MethodPresets";

const QL_COLORS = {
  B0: "#059669",
  B1: "#0d9488",
  B2: "#0891b2",
  B3: "#6366f1",
  B4: "#9333ea",
};

function escXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(label, max = 14) {
  const t = String(label || "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * @param {string} methodKey
 * @param {{ primary?: string, accent?: string, width?: number, height?: number }} [opts]
 */
export function buildPas128WorkflowSvg(methodKey, opts = {}) {
  const steps = getPas128WorkflowSteps(methodKey);
  if (!steps.length) return "";

  const primary = opts.primary || "#0d9488";
  const accent = opts.accent || "#0f766e";
  const width = opts.width ?? 560;
  const height = opts.height ?? 72;
  const n = steps.length;
  const padX = 8;
  const gap = 6;
  const arrowW = 14;
  const boxW = Math.max(48, (width - padX * 2 - arrowW * (n - 1) - gap * (n - 1)) / n);
  const boxH = 36;
  const y = (height - boxH) / 2;

  let x = padX;
  const parts = [];

  steps.forEach((step, i) => {
    const fill = i === 0 ? primary : i === n - 1 ? accent : "#ecfdf5";
    const stroke = i === 0 || i === n - 1 ? primary : "#99f6e4";
    const textColor = i === 0 || i === n - 1 ? "#fff" : "#115e59";
    parts.push(
      `<rect x="${x.toFixed(1)}" y="${y}" width="${boxW.toFixed(1)}" height="${boxH}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
      `<text x="${(x + boxW / 2).toFixed(1)}" y="${(y + boxH / 2 + 4).toFixed(1)}" text-anchor="middle" font-size="8.5" font-family="Segoe UI, Arial, sans-serif" font-weight="600" fill="${textColor}">${escXml(truncate(step))}</text>`
    );
    x += boxW;
    if (i < n - 1) {
      const ax = x + gap / 2;
      parts.push(
        `<path d="M${ax} ${y + boxH / 2} h${arrowW - 4} l4-4 m-4 4 l4 4" fill="none" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
      );
      x += arrowW + gap;
    }
  });

  return `<figure class="sr-workflow-diagram" aria-label="Survey workflow">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img">
      <rect width="${width}" height="${height}" fill="#f8fafc" rx="8"/>
      ${parts.join("")}
    </svg>
    <figcaption class="sr-workflow-caption">PAS 128 method ${escXml(methodKey)} — survey workflow</figcaption>
  </figure>`;
}

/** Coloured QL breakdown bars for cover / editor (HTML). */
export function buildPas128QlBarsHtml(byQl, { total } = {}) {
  const entries = Object.entries(byQl || {}).filter(([, n]) => n > 0);
  if (!entries.length) return "";
  const sum = total ?? entries.reduce((s, [, n]) => s + n, 0);
  if (!sum) return "";

  const bars = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ql, n]) => {
      const pct = Math.round((n / sum) * 100);
      const color = QL_COLORS[ql.replace(/^QL\s*/i, "")] || QL_COLORS[ql] || "#64748b";
      return `<div class="sr-ql-bar-row"><span class="sr-ql-bar-label">${escXml(ql)}</span><div class="sr-ql-bar-track"><div class="sr-ql-bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="sr-ql-bar-count">${n}</span></div>`;
    })
    .join("");

  return `<div class="sr-ql-bars">${bars}</div>`;
}

export { QL_COLORS };
