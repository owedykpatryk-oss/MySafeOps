/**
 * GPR chainage line refs (e.g. UMG_LV_B1) → PAS128 utility + QL length totals,
 * with optional comparison to a linked survey report CAD baseline.
 */
import { parseLayerSemantics, formatLengthM } from "../../utils/surveyDxfAnalyzer.js";
import {
  cadQlDisplayLabel,
  cadQlStyle,
  cadUtilityColor,
} from "../../utils/cadImportVisuals.js";

/** Length in metres from chainage start/end (absolute difference). */
export function chainageSegmentLengthM(start, end) {
  const a = Number(start);
  const b = Number(end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round(Math.abs(b - a) * 100) / 100;
}

/**
 * Parse a GPR line / layer ref using the same PAS128 naming rules as CAD import
 * (UMG_LV_B1 → LV cable + QL B1).
 * @param {string} lineRef
 */
export function parseGprLineRef(lineRef) {
  return parseLayerSemantics(String(lineRef || "").trim());
}

function groupKey(utilityKey, qlKey) {
  return `${utilityKey || "other"}|${qlKey || "—"}`;
}

function rollupSegments(rawSegments) {
  const grouped = new Map();
  for (const seg of rawSegments) {
    const k = groupKey(seg.utilityKey, seg.qlKey);
    const prev = grouped.get(k) || {
      utilityKey: seg.utilityKey || "other",
      utilityLabel: seg.utilityLabel || "Unclassified",
      qlKey: seg.qlKey || "—",
      qlLabel: seg.qlLabel || "",
      pas128Equivalent: seg.pas128Equivalent || seg.qlKey || "—",
      lengthM: 0,
      segments: 0,
      lineRefs: new Set(),
      isRecordsDerived: seg.isRecordsDerived,
    };
    prev.lengthM += seg.lengthM;
    prev.segments += 1;
    if (seg.lineRef) prev.lineRefs.add(seg.lineRef);
    grouped.set(k, prev);
  }
  return [...grouped.values()]
    .map((g) => ({
      ...g,
      lineRefs: [...g.lineRefs].sort(),
      lengthM: Math.round(g.lengthM * 100) / 100,
    }))
    .sort((a, b) => b.lengthM - a.lengthM);
}

/**
 * Build length summary from GPR chainage segments whose lineRef encodes utility + QL.
 * @param {object} report normalized or raw GPR report
 */
export function buildGprLineLengthSummary(report) {
  const segments = Array.isArray(report?.chainageSegments) ? report.chainageSegments : [];
  const parsed = [];

  for (const s of segments) {
    const lineRef = String(s.lineRef || "").trim();
    if (!lineRef) continue;
    const lengthM = chainageSegmentLengthM(s.chainageStartM, s.chainageEndM);
    if (lengthM <= 0) continue;
    const sem = parseGprLineRef(lineRef);
    parsed.push({
      lineRef,
      lengthM,
      ...sem,
      utilityLabel: sem.utilityLabel || (sem.matched ? "Utility" : "Unclassified"),
    });
  }

  const summary = rollupSegments(parsed);
  const totalM = Math.round(summary.reduce((s, r) => s + r.lengthM, 0) * 100) / 100;

  const byUtilityMap = new Map();
  summary.forEach((row) => {
    const key = row.utilityKey || "other";
    const prev = byUtilityMap.get(key) || {
      key,
      label: row.utilityLabel?.replace(/\s*\(.*\)/, "") || "Unclassified",
      lengthM: 0,
      segments: 0,
    };
    prev.lengthM += row.lengthM;
    prev.segments += row.segments;
    byUtilityMap.set(key, prev);
  });

  const byQlMap = new Map();
  summary.forEach((row) => {
    const key = row.qlKey || row.pas128Equivalent || "—";
    const prev = byQlMap.get(key) || { key, lengthM: 0, segments: 0, isRecordsDerived: row.isRecordsDerived };
    prev.lengthM += row.lengthM;
    prev.segments += row.segments;
    byQlMap.set(key, prev);
  });

  const maxUtilityM = Math.max(...[...byUtilityMap.values()].map((u) => u.lengthM), 1);

  return {
    totalM,
    segmentCount: parsed.length,
    unmatchedCount: parsed.filter((p) => !p.matched).length,
    summary,
    byUtility: [...byUtilityMap.values()]
      .map((u) => ({
        ...u,
        lengthM: Math.round(u.lengthM * 100) / 100,
        color: cadUtilityColor(u.key),
        pct: Math.round((u.lengthM / maxUtilityM) * 100),
      }))
      .sort((a, b) => b.lengthM - a.lengthM),
    byQl: [...byQlMap.values()]
      .map((q) => ({
        ...q,
        lengthM: Math.round(q.lengthM * 100) / 100,
        label: cadQlDisplayLabel(q.key),
        style: cadQlStyle(q.key),
      }))
      .sort((a, b) => b.lengthM - a.lengthM),
  };
}

/** Build PAS128-style line ref when CAD layer name is missing. */
function lineRefFromSummaryRow(row) {
  const layer = row.layers?.[0];
  if (layer && String(layer).trim()) return String(layer).trim();
  const utilToken = {
    hv_cable: "HV",
    lv_cable: "LV",
    gas: "GAS",
    foul: "FOUL",
    surface: "SW",
    water: "WAT",
    telecom: "TEL",
  };
  const u = utilToken[row.utilityKey] || "UTIL";
  const ql = row.qlKey || row.pas128Equivalent || "B4";
  return `UMG_${u}_${ql}`;
}

/**
 * Seed GPR chainage segments from a linked survey report's CAD length summary.
 * Each CAD utility+QL row becomes one corridor segment (0 → lengthM).
 * @param {object} surveyReport
 * @returns {import("./gprReportConstants.js").blankGprChainageSegment[]}
 */
export function chainageSegmentsFromSurveyCad(surveyReport) {
  const rows = surveyReport?.cadImport?.summary;
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows
    .filter((r) => (Number(r.lengthM) || 0) > 0 && (r.utilityKey || r.qlKey || r.layers?.length))
    .map((row, idx) => ({
    id: `ch_import_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
    lineRef: lineRefFromSummaryRow(row),
    swathRef: "",
    chainageStartM: "0",
    chainageEndM: String(row.lengthM),
    thicknessOrDepthM: "",
    conditionBand: row.isRecordsDerived ? "records" : "verified",
    profileNotes: row.isRecordsDerived
      ? "Imported from survey CAD (records-derived — update QL after GPR verification)"
      : "Imported from survey CAD — adjust chainage after GPR corridor walk",
  }));
}

/**
 * Merge survey CAD rows into GPR chainage (skip duplicates by lineRef).
 * @param {object} gprReport
 * @param {object} surveyReport
 * @param {{ replace?: boolean }} [opts]
 */
export function importChainageFromSurveyCad(gprReport, surveyReport, { replace = false } = {}) {
  const incoming = chainageSegmentsFromSurveyCad(surveyReport);
  if (!incoming.length) {
    throw new Error("Survey report has no CAD length summary — import a DXF/DWG on the survey first.");
  }
  const existing = replace ? [] : [...(gprReport.chainageSegments || [])];
  const seen = new Set(existing.map((s) => String(s.lineRef || "").trim().toUpperCase()).filter(Boolean));
  for (const seg of incoming) {
    const key = String(seg.lineRef || "").trim().toUpperCase();
    if (key && seen.has(key)) continue;
    existing.push(seg);
    if (key) seen.add(key);
  }
  return {
    ...gprReport,
    linkedSurveyReportId: surveyReport.id || gprReport.linkedSurveyReportId,
    chainageSegments: existing,
  };
}

/** One-paragraph narrative for executive summary / findings from line totals. */
export function buildGprLineLengthNarrative(report, surveyReport) {
  const visual = buildGprLineLengthSummary(report);
  if (!visual.totalM) return "";
  const cmp = buildGprSurveyLineComparison(visual, surveyReport);
  const lines = visual.summary
    .slice(0, 8)
    .map((r) => `${formatLengthM(r.lengthM)} ${r.utilityLabel} (QL ${r.qlKey})`)
    .join("; ");
  let text = `GPR corridor classification totals ${formatLengthM(visual.totalM)} across ${visual.segmentCount} chainage segment(s): ${lines}.`;
  if (cmp.narrative) text += ` ${cmp.narrative}`;
  return text;
}

/** Survey CAD baseline rows keyed utility|ql for delta tables. */
export function surveyCadBaselineRows(surveyReport) {
  const rows = surveyReport?.cadImport?.summary;
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows
    .filter((r) => (Number(r.lengthM) || 0) > 0)
    .map((r) => ({
      utilityKey: r.utilityKey || "other",
      utilityLabel: r.utilityLabel || "Unclassified",
      qlKey: r.qlKey || r.pas128Equivalent || "—",
      qlLabel: r.qlLabel || cadQlDisplayLabel(r.qlKey || r.pas128Equivalent),
      lengthM: Math.round(Number(r.lengthM) * 100) / 100,
      isRecordsDerived: r.isRecordsDerived,
      source: "survey_cad",
    }));
}

/**
 * Compare GPR-verified line lengths with linked survey CAD import.
 * Highlights QL upgrades (e.g. B4 records → B1 verified on GPR corridor).
 * @param {ReturnType<typeof buildGprLineLengthSummary>} gprVisual
 * @param {object} [surveyReport]
 */
export function buildGprSurveyLineComparison(gprVisual, surveyReport) {
  const baseline = surveyCadBaselineRows(surveyReport);
  if (!baseline.length || !gprVisual?.summary?.length) {
    return { rows: [], narrative: "", hasBaseline: baseline.length > 0, hasGpr: (gprVisual?.totalM || 0) > 0 };
  }

  const gprByKey = new Map(gprVisual.summary.map((r) => [groupKey(r.utilityKey, r.qlKey), r]));
  const surveyByKey = new Map(baseline.map((r) => [groupKey(r.utilityKey, r.qlKey), r]));
  const allKeys = new Set([...gprByKey.keys(), ...surveyByKey.keys()]);

  const qlRank = { B0: 0, B1: 1, B2: 2, B3: 3, B4: 4, TFR: 4, AR: 4, "—": 99 };

  const rows = [...allKeys].map((k) => {
    const gpr = gprByKey.get(k);
    const survey = surveyByKey.get(k);
    const utilityLabel = gpr?.utilityLabel || survey?.utilityLabel || "Unclassified";
    const qlKey = gpr?.qlKey || survey?.qlKey || "—";
    const surveyM = survey?.lengthM || 0;
    const gprM = gpr?.lengthM || 0;
    const deltaM = Math.round((gprM - surveyM) * 100) / 100;
    let changeNote = "";
    if (surveyM > 0 && gprM === 0) changeNote = "Not re-verified on GPR corridor";
    else if (surveyM === 0 && gprM > 0) changeNote = "New GPR-verified length";
    else if (deltaM !== 0) changeNote = deltaM > 0 ? "Longer after GPR" : "Shorter after GPR";
    else changeNote = "Confirmed";
    return {
      utilityKey: gpr?.utilityKey || survey?.utilityKey || "other",
      utilityLabel,
      qlKey,
      qlLabel: cadQlDisplayLabel(qlKey),
      surveyLengthM: surveyM,
      gprLengthM: gprM,
      deltaM,
      changeNote,
    };
  }).sort((a, b) => Math.max(b.gprLengthM, b.surveyLengthM) - Math.max(a.gprLengthM, a.surveyLengthM));

  // Utility-level QL shift narrative (survey had B4, GPR now shows B1 for same utility)
  const utilityShifts = [];
  const utilities = new Set(rows.map((r) => r.utilityKey));
  for (const uk of utilities) {
    const surveyRows = baseline.filter((b) => b.utilityKey === uk);
    const gprRows = gprVisual.summary.filter((g) => g.utilityKey === uk);
    if (!surveyRows.length || !gprRows.length) continue;
    const surveyBest = surveyRows.reduce((best, r) =>
      (qlRank[r.qlKey] ?? 99) < (qlRank[best.qlKey] ?? 99) ? r : best
    );
    const gprBest = gprRows.reduce((best, r) =>
      (qlRank[r.qlKey] ?? 99) < (qlRank[best.qlKey] ?? 99) ? r : best
    );
    if (surveyBest.qlKey !== gprBest.qlKey) {
      const totalGpr = gprRows.reduce((s, r) => s + r.lengthM, 0);
      utilityShifts.push(
        `${formatLengthM(totalGpr)} ${gprBest.utilityLabel} now at QL ${gprBest.qlKey} (survey CAD had QL ${surveyBest.qlKey})`
      );
    }
  }

  const confirmed = rows.filter((r) => r.gprLengthM > 0 && r.changeNote === "Confirmed");
  const parts = [];
  if (utilityShifts.length) parts.push(`After GPR verification: ${utilityShifts.join("; ")}.`);
  const newLines = rows.filter((r) => r.gprLengthM > 0 && r.surveyLengthM === 0);
  if (newLines.length) {
    parts.push(
      newLines
        .slice(0, 6)
        .map((r) => `${formatLengthM(r.gprLengthM)} ${r.utilityLabel} (QL ${r.qlKey})`)
        .join(", ") + (newLines.length > 6 ? "…" : "")
    );
  }
  if (confirmed.length && !utilityShifts.length && !newLines.length) {
    parts.push(
      confirmed
        .slice(0, 4)
        .map((r) => `${formatLengthM(r.gprLengthM)} ${r.utilityLabel} QL ${r.qlKey} confirmed`)
        .join("; ")
    );
  }

  return {
    rows,
    narrative: parts.join(" "),
    hasBaseline: true,
    hasGpr: gprVisual.totalM > 0,
  };
}
