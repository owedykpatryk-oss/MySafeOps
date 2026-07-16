/**
 * UK confined spaces — Confined Spaces Regulations 1997 / HSE L101 (illustrative thresholds).
 */

import { escapeHtml } from "../../../utils/htmlEscape.js";

export const CONFINED_PERMIT_TYPES = new Set(["confined_space"]);

export const CONFINED_EXTRA_FIELD_KEYS = [
  "gasTester",
  "o2Reading",
  "coReading",
  "h2sReading",
  "lelReading",
  "entrantName",
  "standbyName",
  "supervisorName",
  "rescueTeamRef",
  "ventilationActive",
  "lotoComplete",
  "commsTested",
  "entrySequenceComplete",
];

export const GAS_THRESHOLDS = {
  o2: { min: 19.5, max: 23.5, unit: "%", label: "O₂" },
  co: { max: 20, unit: "ppm", label: "CO" },
  h2s: { max: 1, unit: "ppm", label: "H₂S" },
  lel: { max: 10, unit: "%", label: "LEL" },
};

export function isConfinedPermitType(type) {
  return CONFINED_PERMIT_TYPES.has(String(type || "").trim());
}

function parseReading(value) {
  const n = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function confinedSpaceAssessment(extra = {}) {
  const warnings = [];
  const blockers = [];

  const o2 = parseReading(extra.o2Reading);
  const co = parseReading(extra.coReading);
  const h2s = parseReading(extra.h2sReading);
  const lel = parseReading(extra.lelReading);

  if (o2 == null) warnings.push("Record O₂ reading (safe band 19.5–23.5%).");
  else if (o2 < GAS_THRESHOLDS.o2.min || o2 > GAS_THRESHOLDS.o2.max) {
    blockers.push(`O₂ ${o2}% outside safe band (${GAS_THRESHOLDS.o2.min}–${GAS_THRESHOLDS.o2.max}%).`);
  }
  if (co == null) warnings.push("Record CO reading (<20 ppm typical).");
  else if (co >= GAS_THRESHOLDS.co.max) blockers.push(`CO ${co} ppm at or above ${GAS_THRESHOLDS.co.max} ppm limit.`);
  if (h2s == null) warnings.push("Record H₂S reading (<1 ppm typical).");
  else if (h2s >= GAS_THRESHOLDS.h2s.max) blockers.push(`H₂S ${h2s} ppm at or above ${GAS_THRESHOLDS.h2s.max} ppm limit.`);
  if (lel == null) warnings.push("Record LEL reading (<10% typical).");
  else if (lel >= GAS_THRESHOLDS.lel.max) blockers.push(`LEL ${lel}% at or above ${GAS_THRESHOLDS.lel.max}% limit.`);

  if (!String(extra.entrantName || "").trim()) warnings.push("Name confined space entrant.");
  if (!String(extra.standbyName || "").trim()) warnings.push("Standby person must be at entrance — no entry solo.");
  if (!String(extra.supervisorName || "").trim()) warnings.push("Confined space supervisor nominated.");
  if (String(extra.lotoComplete || "").toLowerCase() !== "yes") warnings.push("LOTO / isolation complete before entry.");
  if (String(extra.commsTested || "").toLowerCase() !== "yes") warnings.push("Comms tested between entrant and standby.");
  if (String(extra.ventilationActive || "").toLowerCase() !== "yes") warnings.push("Mechanical ventilation confirmed operational.");

  return { warnings, blockers, readings: { o2, co, h2s, lel } };
}

/** Atmospheric gauge panel with threshold bands. */
export function renderConfinedGaugeSvg(extra = {}, { width = 400, height = 110 } = {}) {
  const gauges = [
    { key: "o2Reading", ...GAS_THRESHOLDS.o2, band: "19.5–23.5%" },
    { key: "coReading", ...GAS_THRESHOLDS.co, band: "<20" },
    { key: "h2sReading", ...GAS_THRESHOLDS.h2s, band: "<1" },
    { key: "lelReading", ...GAS_THRESHOLDS.lel, band: "<10%" },
  ];
  const cellW = width / gauges.length;
  const rects = gauges
    .map((g, i) => {
      const val = parseReading(extra[g.key]);
      let ok = val != null;
      if (g.key === "o2Reading" && val != null) ok = val >= g.min && val <= g.max;
      else if (val != null && g.max != null) ok = val < g.max;
      const fill = val == null ? "#f1f5f9" : ok ? "#dcfce7" : "#fecaca";
      const stroke = val == null ? "#94a3b8" : ok ? "#16a34a" : "#dc2626";
      const x = i * cellW + 4;
      const display = val != null ? `${val}${g.unit}` : "—";
      return `<g>
        <rect x="${x}" y="22" width="${cellW - 8}" height="72" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <text x="${x + (cellW - 8) / 2}" y="40" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${g.label}</text>
        <text x="${x + (cellW - 8) / 2}" y="58" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${display}</text>
        <text x="${x + (cellW - 8) / 2}" y="72" text-anchor="middle" font-size="7" fill="#64748b">${g.band} ${g.unit}</text>
      </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Confined space gas readings">
    <text x="8" y="14" font-size="10" font-weight="700" fill="#791F1F">Atmospheric tests — before &amp; during entry</text>
    ${rects}
  </svg>`;
}

/** Role diagram: entrant / standby / supervisor / rescue. */
export function renderConfinedRolesSvg(extra = {}, { width = 420, height = 88 } = {}) {
  const roles = [
    { label: "Entrant", name: extra.entrantName, x: 50 },
    { label: "Standby", name: extra.standbyName, x: 150 },
    { label: "Supervisor", name: extra.supervisorName, x: 270 },
    { label: "Rescue", name: extra.rescueTeamRef, x: 370 },
  ];
  const nodes = roles
    .map((r) => {
      const filled = String(r.name || "").trim();
      const fill = filled ? "#dbeafe" : "#f8fafc";
      const safeName = escapeHtml(filled ? filled.slice(0, 12) : "Assign");
      return `<g>
        <rect x="${r.x - 40}" y="28" width="80" height="44" rx="6" fill="${fill}" stroke="#64748b"/>
        <text x="${r.x}" y="44" text-anchor="middle" font-size="8" font-weight="700" fill="#0f172a">${escapeHtml(r.label)}</text>
        <text x="${r.x}" y="58" text-anchor="middle" font-size="7" fill="#475569">${safeName}</text>
      </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Confined space roles">
    <text x="8" y="14" font-size="10" font-weight="700" fill="#791F1F">Roles — never enter without standby at entrance</text>
    <rect x="180" y="52" width="60" height="36" rx="4" fill="#fee2e2" stroke="#dc2626"/>
    <text x="210" y="68" text-anchor="middle" font-size="8" font-weight="700" fill="#991b1b">SPACE</text>
    ${nodes}
  </svg>`;
}

/** Entry sequence flow. */
export function renderConfinedEntrySequenceSvg({ width = 460, height = 56 } = {}) {
  const steps = ["Test gas", "Ventilate", "LOTO", "Comms", "Entry"];
  const stepW = width / steps.length;
  const rects = steps
    .map((label, i) => {
      const x = i * stepW + 4;
      const fill = i < 3 ? "#dbeafe" : "#dcfce7";
      return `<rect x="${x}" y="16" width="${stepW - 8}" height="30" rx="4" fill="${fill}" stroke="#64748b"/>
        <text x="${x + (stepW - 8) / 2}" y="34" text-anchor="middle" font-size="8" font-weight="600" fill="#0f172a">${label}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Confined space entry sequence">
    <text x="8" y="10" font-size="9" font-weight="700" fill="#0f172a">Entry sequence — do not skip steps</text>
    ${rects}
  </svg>`;
}

export function renderConfinedPrintHtml(permit, { primaryColor = "#791F1F" } = {}) {
  if (!isConfinedPermitType(permit?.type)) return "";
  const extra = permit?.extraFields || {};
  const assessment = confinedSpaceAssessment(extra);

  const fieldsHtml = [
    ["Gas tester", extra.gasTester || "—"],
    ["O₂ %", extra.o2Reading || "—"],
    ["CO ppm", extra.coReading || "—"],
    ["H₂S ppm", extra.h2sReading || "—"],
    ["LEL %", extra.lelReading || "—"],
    ["Entrant", extra.entrantName || "—"],
    ["Standby", extra.standbyName || "—"],
    ["Supervisor", extra.supervisorName || "—"],
    ["Rescue team", extra.rescueTeamRef || "—"],
    ["Ventilation", extra.ventilationActive || "—"],
    ["LOTO complete", extra.lotoComplete || "—"],
    ["Comms tested", extra.commsTested || "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;color:#666;width:38%">${k}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${String(v).replace(/</g, "&lt;")}</td></tr>`
    )
    .join("");

  const warnHtml =
    assessment.blockers.length || assessment.warnings.length
      ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:10px;color:#991b1b">${[...assessment.blockers, ...assessment.warnings]
          .map((w) => `<li>${String(w).replace(/</g, "&lt;")}</li>`)
          .join("")}</ul>`
      : `<p style="margin:6px 0 0;font-size:10px;color:#166534">Atmospheric readings within typical safe bands — maintain continuous monitoring.</p>`;

  return `
  <h2 style="border-left-color:${primaryColor}">Confined space guidance</h2>
  <p style="font-size:10px;color:#64748b;margin:0 0 8px">Confined Spaces Regulations 1997 · HSE L101. Site-specific risk assessment governs.</p>
  <div style="margin-bottom:8px">${renderConfinedGaugeSvg(extra, { width: 460 })}</div>
  <div style="margin-bottom:8px">${renderConfinedRolesSvg(extra, { width: 460 })}</div>
  <div style="margin-bottom:10px">${renderConfinedEntrySequenceSvg({ width: 480 })}</div>
  <table style="margin-bottom:8px"><tbody>${fieldsHtml}</tbody></table>
  ${warnHtml}
  <p style="font-size:9px;color:#64748b;margin-top:8px">Confined Spaces Regs 1997 · HSE L101 · continuous gas monitoring</p>`;
}
