import { formatLengthM } from "./surveyDxfAnalyzer.js";

/** PAS128 QL / records styling for badges and chart segments. */
export const CAD_QL_STYLES = {
  B0: { bg: "#f1f5f9", color: "#334155", border: "#94a3b8", label: "B0" },
  B1: { bg: "#ecfdf5", color: "#047857", border: "#10b981", label: "B1" },
  B2: { bg: "#eff6ff", color: "#1d4ed8", border: "#3b82f6", label: "B2" },
  B3: { bg: "#f5f3ff", color: "#6d28d9", border: "#8b5cf6", label: "B3" },
  B4: { bg: "#fffbeb", color: "#b45309", border: "#f59e0b", label: "B4" },
  TFR: { bg: "#eef2ff", color: "#4338ca", border: "#6366f1", label: "TFR" },
  AR: { bg: "#fdf2f8", color: "#be185d", border: "#ec4899", label: "AR" },
  "—": { bg: "#f9fafb", color: "#6b7280", border: "#d1d5db", label: "—" },
};

export const CAD_UTILITY_COLORS = {
  hv_cable: "#dc2626",
  lv_cable: "#ca8a04",
  gas: "#ea580c",
  foul: "#7c3aed",
  surface: "#0284c7",
  water: "#0ea5e9",
  telecom: "#6366f1",
  other: "#64748b",
};

export function cadQlStyle(qlKey) {
  const key = qlKey || "—";
  return CAD_QL_STYLES[key] || CAD_QL_STYLES["—"];
}

export function cadQlDisplayLabel(qlKey) {
  if (qlKey === "TFR") return "TFR (records / B4 eq.)";
  if (qlKey === "AR") return "AR (as recorded)";
  return qlKey || "—";
}

export function cadUtilityColor(utilityKey) {
  return CAD_UTILITY_COLORS[utilityKey] || CAD_UTILITY_COLORS.other;
}

/**
 * Aggregate CAD import data for charts, stat cards and comparison tables.
 * @param {object} cad report.cadImport
 */
export function buildCadVisualSummary(cad) {
  if (!cad?.summary?.length) return null;

  const totalM = Number(cad.totals?.lengthM) || 0;
  const recordsM = Number(cad.recordsDerivedM) || 0;
  const unmatchedM = (cad.unmatchedLayers || []).reduce((s, l) => s + (Number(l.lengthM) || 0), 0);
  const classifiedM = cad.summary
    .filter((g) => g.utilityKey || g.qlKey)
    .reduce((s, g) => s + (Number(g.lengthM) || 0), 0);
  const siteMappedM = Math.max(0, totalM - recordsM);

  const byUtilityMap = new Map();
  cad.summary.forEach((row) => {
    const key = row.utilityKey || "other";
    const label = row.utilityLabel?.replace(/\s*\(.*\)/, "") || "Unclassified";
    const prev = byUtilityMap.get(key) || { key, label, lengthM: 0, segments: 0 };
    prev.lengthM += Number(row.lengthM) || 0;
    prev.segments += Number(row.segments) || 0;
    byUtilityMap.set(key, prev);
  });

  const byQlMap = new Map();
  cad.summary.forEach((row) => {
    const key = row.qlKey || row.pas128Equivalent || "—";
    const prev = byQlMap.get(key) || { key, lengthM: 0, segments: 0, isRecordsDerived: row.isRecordsDerived };
    prev.lengthM += Number(row.lengthM) || 0;
    prev.segments += Number(row.segments) || 0;
    prev.isRecordsDerived = prev.isRecordsDerived || row.isRecordsDerived;
    byQlMap.set(key, prev);
  });

  const maxUtilityM = Math.max(...[...byUtilityMap.values()].map((u) => u.lengthM), 1);

  const byUtility = [...byUtilityMap.values()]
    .map((u) => ({
      ...u,
      lengthM: Math.round(u.lengthM * 100) / 100,
      color: cadUtilityColor(u.key),
      pct: totalM > 0 ? Math.round((u.lengthM / totalM) * 1000) / 10 : 0,
      barPct: Math.round((u.lengthM / maxUtilityM) * 1000) / 10,
    }))
    .sort((a, b) => b.lengthM - a.lengthM);

  const byQl = [...byQlMap.values()]
    .map((q) => ({
      ...q,
      lengthM: Math.round(q.lengthM * 100) / 100,
      style: cadQlStyle(q.key),
      pct: totalM > 0 ? Math.round((q.lengthM / totalM) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.lengthM - a.lengthM);

  const composition = [
    { key: "site", label: "Site-mapped linework", lengthM: Math.round(siteMappedM * 100) / 100, color: "#0d9488" },
    { key: "records", label: "Records-derived (TFR / AR)", lengthM: Math.round(recordsM * 100) / 100, color: "#6366f1" },
    { key: "unmatched", label: "Unclassified layers", lengthM: Math.round(unmatchedM * 100) / 100, color: "#94a3b8" },
  ].filter((c) => c.lengthM > 0);

  return {
    totalM,
    statCards: [
      { label: "Total linework", value: formatLengthM(totalM), hint: "plan length (LINE / polyline)" },
      { label: "Segments", value: String(cad.totals?.segments ?? "—"), hint: "CAD entities measured" },
      { label: "Layers", value: String(cad.totals?.layerCount ?? "—"), hint: "distinct layer names" },
      {
        label: "Records-derived",
        value: recordsM > 0 ? formatLengthM(recordsM) : "—",
        hint: "TFR / AR / B4 equivalent",
        accent: recordsM > 0,
      },
    ],
    byUtility,
    byQl,
    composition,
    classifiedM: Math.round(classifiedM * 100) / 100,
    recordsM: Math.round(recordsM * 100) / 100,
    unmatchedM: Math.round(unmatchedM * 100) / 100,
    classifiedPct: totalM > 0 ? Math.round((classifiedM / totalM) * 100) : 0,
  };
}

/**
 * Compare CAD totals with field utility schedule rows (by utility type).
 * @param {object} cad
 * @param {object[]} utilitiesTable
 */
export function buildCadFieldComparison(cad, utilitiesTable = []) {
  const visual = buildCadVisualSummary(cad);
  if (!visual) return [];

  const fieldByType = new Map();
  utilitiesTable.forEach((row) => {
    const key = row.utilityType || "other";
    fieldByType.set(key, (fieldByType.get(key) || 0) + 1);
  });

  return visual.byUtility.map((u) => ({
    utilityKey: u.key,
    utilityLabel: u.label,
    cadLengthM: u.lengthM,
    cadSegments: u.segments,
    fieldCount: fieldByType.get(u.key) || 0,
    color: u.color,
    hasFieldMatch: (fieldByType.get(u.key) || 0) > 0,
  }));
}
