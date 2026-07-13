/** PAS128 QL colours for charts and chips — UK surveying palette. */

export const PAS128_QL_ORDER = ["B4", "B3", "B2", "B1", "B0", "—"];

export const PAS128_QL_COLORS = {
  B4: "#94a3b8",
  B3: "#3b82f6",
  B2: "#f59e0b",
  B1: "#14b8a6",
  B0: "#059669",
  "—": "#cbd5e1",
};

export const CONFIDENCE_COLORS = {
  high: "#059669",
  medium: "#d97706",
  low: "#dc2626",
  indicative: "#64748b",
};

/** Build donut segments from buildPas128SummaryStats().byQl */
export function pas128DonutSegments(byQl = {}) {
  const total = Object.values(byQl).reduce((a, b) => a + b, 0) || 0;
  if (!total) return [];

  const ordered = PAS128_QL_ORDER.filter((k) => byQl[k] > 0);
  const extras = Object.keys(byQl).filter((k) => !PAS128_QL_ORDER.includes(k) && byQl[k] > 0);
  const keys = [...ordered, ...extras];

  let cursor = 0;
  return keys.map((ql) => {
    const count = byQl[ql];
    const pct = (count / total) * 100;
    const seg = { ql, count, pct, color: PAS128_QL_COLORS[ql] || "#64748b", offset: cursor };
    cursor += pct;
    return seg;
  });
}

export function confidenceLabel(key) {
  const map = {
    high: "High",
    medium: "Medium",
    low: "Low",
    indicative: "Indicative",
  };
  return map[key] || key;
}
