/**
 * PAS128 utility mapping — DXF layer analysis (lengths by utility type & QL).
 */
import DxfParser from "dxf-parser";

/** Drawing units (AutoCAD $INSUNITS) → metres multiplier. */
const INSUNITS_TO_METRES = {
  0: 1,
  1: 0.0254,
  2: 0.3048,
  3: 1609.344,
  4: 0.001,
  5: 0.01,
  6: 1,
  7: 1000,
  8: 0.000001,
  9: 0.001,
  10: 0.01,
  11: 0.001,
  12: 0.001,
  13: 0.0254,
  14: 0.0254 / 12,
};

export const CAD_UTILITY_TOKENS = [
  { re: /\bHV\b|\bEHV\b|\bHIGHVOLT/i, key: "hv_cable", label: "HV cable" },
  { re: /\bLV\b|\bLVC\b|\bLOWVOLT/i, key: "lv_cable", label: "LV cable" },
  { re: /\bGAS\b|\bGASMAIN/i, key: "gas", label: "Gas" },
  { re: /\bFOUL\b|\bFWS\b|\bSEWER\b|\bDRAIN\b/i, key: "foul", label: "Foul sewer" },
  { re: /\bSW\b|\bSTORM\b|\bSURF\b|\bSUDS\b/i, key: "surface", label: "Surface water" },
  { re: /\bWAT\b|\bWATER\b|\bH2O\b/i, key: "water", label: "Water" },
  { re: /\bTEL\b|\bTCOM\b|\bTELECOM\b|\bFIB\b|\bFIBRE\b|\bFIBER\b/i, key: "telecom", label: "Telecom / fibre" },
  { re: /\bOIL\b|\bFUEL\b|\bPETROL\b/i, key: "other", label: "Fuel / oil" },
  { re: /\bCABLE\b|\bELEC\b|\bPOWER\b|\bUTIL\b/i, key: "other", label: "Utility (unspecified)" },
];

export const CAD_QL_TOKENS = [
  { re: /\bB0\b/i, key: "B0", label: "QL B0", pas128Equivalent: "B0" },
  { re: /\bB1\b/i, key: "B1", label: "QL B1", pas128Equivalent: "B1" },
  { re: /\bB2\b/i, key: "B2", label: "QL B2", pas128Equivalent: "B2" },
  { re: /\bB3\b/i, key: "B3", label: "QL B3", pas128Equivalent: "B3" },
  { re: /\bB4\b/i, key: "B4", label: "QL B4", pas128Equivalent: "B4" },
  { re: /\bTFR\b|\bTAKENFROMRECORDS\b|\bFROMRECORDS\b/i, key: "TFR", label: "TFR (taken from records)", pas128Equivalent: "B4" },
  { re: /\bAR\b|\bASRECORDED\b|\bASREC\b/i, key: "AR", label: "AR (as recorded)", pas128Equivalent: "B4" },
];

const DWG_MAGIC = ["AC10", "AC10", "AC1."];

/** Only these DXF entity types contribute to length totals. */
export const CAD_LENGTH_ENTITY_TYPES = ["LINE", "LWPOLYLINE", "POLYLINE"];

function dist2d(a, b) {
  const dx = (b.x ?? 0) - (a.x ?? 0);
  const dy = (b.y ?? 0) - (a.y ?? 0);
  return Math.hypot(dx, dy);
}

function entityPoints(entity, scale) {
  const verts = entity.vertices || [];
  return verts.map((v) => [(v.x ?? 0) * scale, (v.y ?? 0) * scale]);
}

function entityLengthMetres(entity, scale) {
  const verts = entity.vertices || [];
  if (verts.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < verts.length; i += 1) {
    len += dist2d(verts[i - 1], verts[i]);
  }
  const closed = entity.shape || entity.closed;
  if (closed && verts.length > 2) {
    len += dist2d(verts[verts.length - 1], verts[0]);
  }
  return len * scale;
}

function normalizeEntityType(entity) {
  if (entity.type === "POLYLINE" && entity.is3dPolyline) return "POLYLINE3D";
  return entity.type;
}

export function isLikelyDwgBuffer(buffer) {
  if (!buffer || buffer.byteLength < 6) return false;
  const head = String.fromCharCode(...new Uint8Array(buffer.slice(0, 6)));
  return head.startsWith("AC10") || head.startsWith("AC1.");
}

export function parseLayerSemantics(layerName) {
  const raw = String(layerName || "").trim();
  const norm = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const parts = norm.split("_").filter(Boolean);
  const joined = parts.join("_");

  let qlKey = "";
  let qlLabel = "";
  let pas128Equivalent = "";
  for (const q of CAD_QL_TOKENS) {
    const partHit = parts.some((p) => q.re.test(p) || p === q.key);
    const delimHit = new RegExp(`(^|_)${q.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(_|$)`).test(`_${joined}_`);
    if (partHit || delimHit || q.re.test(joined)) {
      qlKey = q.key;
      qlLabel = q.label;
      pas128Equivalent = q.pas128Equivalent;
      break;
    }
  }

  let utilityKey = "";
  let utilityLabel = "";
  for (const u of CAD_UTILITY_TOKENS) {
    const partHit = parts.some((p) => u.re.test(p));
    if (partHit || u.re.test(joined)) {
      utilityKey = u.key;
      utilityLabel = u.label;
      break;
    }
  }

  const matched = Boolean(qlKey || utilityKey);
  return {
    layer: raw,
    utilityKey: utilityKey || "",
    utilityLabel: utilityLabel || "",
    qlKey: qlKey || "",
    qlLabel: qlLabel || "",
    pas128Equivalent: pas128Equivalent || qlKey || "",
    matched,
    isRecordsDerived: qlKey === "TFR" || qlKey === "AR" || qlKey === "B4",
  };
}

const UTILITY_LABEL_BY_KEY = Object.fromEntries(CAD_UTILITY_TOKENS.map((u) => [u.key, u.label]));

export function semanticsFromLayerMapping(layerName, mapping) {
  const qlKey = mapping.qlKey || "";
  const utilityKey = mapping.utilityKey || "";
  const qlToken = CAD_QL_TOKENS.find((q) => q.key === qlKey);
  const utilToken = CAD_UTILITY_TOKENS.find((u) => u.key === utilityKey);
  return {
    layer: layerName,
    utilityKey,
    utilityLabel: utilToken?.label || UTILITY_LABEL_BY_KEY[utilityKey] || "",
    qlKey,
    qlLabel: qlToken?.label || "",
    pas128Equivalent: qlToken?.pas128Equivalent || qlKey || "",
    matched: Boolean(qlKey || utilityKey),
    isRecordsDerived: qlKey === "TFR" || qlKey === "AR" || qlKey === "B4",
  };
}

export function layerSemantics(layerName, layerMappings = {}) {
  const override = layerMappings[layerName];
  if (override?.utilityKey || override?.qlKey) {
    return semanticsFromLayerMapping(layerName, override);
  }
  return parseLayerSemantics(layerName);
}

function groupSegmentsToSummary(segments) {
  const groupKey = (s) => `${s.utilityKey || "other"}|${s.qlKey || s.pas128Equivalent || "—"}`;
  const grouped = new Map();
  segments.forEach((s) => {
    const k = groupKey(s);
    const g = grouped.get(k) || {
      utilityKey: s.utilityKey || "other",
      utilityLabel: s.utilityLabel || "Unclassified linework",
      qlKey: s.qlKey,
      qlLabel: s.qlLabel,
      pas128Equivalent: s.pas128Equivalent,
      isRecordsDerived: s.isRecordsDerived,
      lengthM: 0,
      segments: 0,
      layers: new Set(),
    };
    g.lengthM += s.lengthM;
    g.segments += s.segments ?? 1;
    g.layers.add(s.layer);
    grouped.set(k, g);
  });

  return [...grouped.values()]
    .map((g) => ({
      ...g,
      layers: [...g.layers].sort(),
      lengthM: Math.round(g.lengthM * 100) / 100,
    }))
    .sort((a, b) => b.lengthM - a.lengthM);
}

function buildPreviewFromLinework(linework, segmentsMeta, scale, maxPaths = 350) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const paths = [];
  let metaIdx = 0;

  linework.forEach((entity) => {
    const pts = entityPoints(entity, scale);
    if (pts.length < 2) return;
    pts.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    if (paths.length >= maxPaths) {
      metaIdx += 1;
      return;
    }
    const meta = segmentsMeta[metaIdx];
    metaIdx += 1;
    paths.push({
      layer: entity.layer || "0",
      utilityKey: meta?.utilityKey || "",
      utilityLabel: meta?.utilityLabel || "",
      isRecordsDerived: meta?.isRecordsDerived,
      pts,
    });
  });

  if (!Number.isFinite(minX)) {
    return { bounds: null, paths: [] };
  }

  const padX = Math.max((maxX - minX) * 0.04, 0.5);
  const padY = Math.max((maxY - minY) * 0.04, 0.5);
  return {
    bounds: {
      minX: minX - padX,
      minY: minY - padY,
      maxX: maxX + padX,
      maxY: maxY + padY,
    },
    paths,
  };
}

/**
 * Rebuild summary / unmatched from layer breakdown + manual mappings.
 */
export function rebuildCadFromLayerBreakdown(layerBreakdown = [], layerMappings = {}) {
  const segments = layerBreakdown.map((lr) => {
    const sem = layerSemantics(lr.layer, layerMappings);
    return {
      layer: lr.layer,
      lengthM: lr.lengthM,
      segments: lr.segments,
      ...sem,
    };
  });

  const summary = groupSegmentsToSummary(segments);
  const matchedLayers = new Set(segments.filter((s) => s.matched).map((s) => s.layer));
  const unmatchedLayers = layerBreakdown
    .filter((lr) => !matchedLayers.has(lr.layer))
    .map((lr) => ({ ...lr, lengthM: Math.round(lr.lengthM * 100) / 100 }))
    .sort((a, b) => b.lengthM - a.lengthM);

  const totals = {
    lengthM: Math.round(segments.reduce((s, x) => s + x.lengthM, 0) * 100) / 100,
    segments: segments.reduce((s, x) => s + (x.segments || 0), 0),
    layerCount: layerBreakdown.length,
  };

  const recordsDerivedM = Math.round(
    summary.filter((g) => g.isRecordsDerived).reduce((s, g) => s + g.lengthM, 0) * 100
  ) / 100;

  return { summary, unmatchedLayers, totals, recordsDerivedM, hasRecordsLinework: recordsDerivedM > 0 };
}

/** Compare two CAD imports (snapshot vs new analysis). */
export function compareCadImports(before, after) {
  if (!before?.totals || !after?.totals) return null;

  const key = (s) => `${s.utilityKey || "other"}|${s.qlKey || s.pas128Equivalent || "—"}`;
  const beforeMap = new Map((before.summary || []).map((s) => [key(s), s]));
  const afterMap = new Map((after.summary || []).map((s) => [key(s), s]));
  const changes = [];

  afterMap.forEach((row, k) => {
    const prev = beforeMap.get(k);
    const delta = Math.round(((row.lengthM || 0) - (prev?.lengthM || 0)) * 100) / 100;
    if (!prev) {
      changes.push({ type: "added", label: `${row.utilityLabel} ${row.qlKey || ""}`.trim(), lengthM: row.lengthM, deltaM: row.lengthM });
    } else if (Math.abs(delta) >= 0.05) {
      changes.push({ type: "changed", label: `${row.utilityLabel} ${row.qlKey || ""}`.trim(), lengthM: row.lengthM, deltaM: delta });
    }
  });

  beforeMap.forEach((row, k) => {
    if (!afterMap.has(k)) {
      changes.push({ type: "removed", label: `${row.utilityLabel} ${row.qlKey || ""}`.trim(), lengthM: 0, deltaM: -row.lengthM });
    }
  });

  return {
    previousFileName: before.fileName,
    previousImportedAt: before.importedAt,
    totalDeltaM: Math.round((after.totals.lengthM - before.totals.lengthM) * 100) / 100,
    segmentDelta: (after.totals.segments || 0) - (before.totals.segments || 0),
    layerDelta: (after.totals.layerCount || 0) - (before.totals.layerCount || 0),
    changes: changes.sort((a, b) => Math.abs(b.deltaM) - Math.abs(a.deltaM)),
  };
}

/** Apply manual layer mappings and rebuild derived CAD fields. */
export function applyCadLayerMappings(cadImport, layerMappings, ctx = {}) {
  if (!cadImport?.layerBreakdown?.length) return cadImport;
  const rebuilt = rebuildCadFromLayerBreakdown(cadImport.layerBreakdown, layerMappings);
  const preview = cadImport.preview?.paths?.length
    ? {
        ...cadImport.preview,
        paths: cadImport.preview.paths.map((p) => {
          const sem = layerSemantics(p.layer, layerMappings);
          return { ...p, utilityKey: sem.utilityKey, utilityLabel: sem.utilityLabel, isRecordsDerived: sem.isRecordsDerived };
        }),
      }
    : cadImport.preview;

  const merged = { ...cadImport, ...rebuilt, layerMappings, preview };
  return {
    ...merged,
    narrative: buildCadImportNarrative(merged, {
      whatWasNotFound: ctx.whatWasNotFound ?? cadImport._ctxWhatWasNotFound,
      recordsGaps: ctx.recordsGaps ?? cadImport._ctxRecordsGaps,
    }),
  };
}

function collectLineworkEntities(dxf) {
  const included = [];
  const skipped = {};

  (dxf?.entities || []).forEach((e) => {
    const type = e?.type || "UNKNOWN";
    if (CAD_LENGTH_ENTITY_TYPES.includes(type)) {
      included.push(e);
      return;
    }
    skipped[type] = (skipped[type] || 0) + 1;
  });

  return { included, skipped };
}

/**
 * @param {string} text DXF file contents
 * @param {{ fileName?: string, layerMappings?: Record<string, object> }} [opts]
 */
export function analyzeSurveyDxf(text, opts = {}) {
  const fileName = opts.fileName || "import.dxf";
  const layerMappings = opts.layerMappings || {};
  const parser = new DxfParser();
  let dxf;
  try {
    dxf = parser.parseSync(String(text));
  } catch (e) {
    throw new Error(`Could not parse DXF: ${e?.message || "invalid file"}`);
  }

  const insunits = Number(dxf?.header?.$INSUNITS ?? dxf?.header?.["$INSUNITS"] ?? 0);
  const scale = INSUNITS_TO_METRES[insunits] ?? 1;
  const unitLabel =
    insunits === 6 ? "metres" : insunits === 4 ? "millimetres (converted to m)" : insunits === 1 ? "inches (converted to m)" : "drawing units (assumed m)";

  const segments = [];
  const segmentsMeta = [];
  const layerRaw = new Map();
  const { included: linework, skipped: skippedEntities } = collectLineworkEntities(dxf);

  linework.forEach((entity, idx) => {
    const layer = entity.layer || "0";
    const lengthM = entityLengthMetres(entity, scale);
    if (lengthM <= 0) return;

    const sem = layerSemantics(layer, layerMappings);
    segmentsMeta.push(sem);
    segments.push({
      id: `seg_${idx}`,
      layer,
      entityType: normalizeEntityType(entity),
      lengthM,
      ...sem,
    });

    const lr = layerRaw.get(layer) || { layer, lengthM: 0, segments: 0 };
    lr.lengthM += lengthM;
    lr.segments += 1;
    layerRaw.set(layer, lr);
  });

  const layerBreakdown = [...layerRaw.values()].map((lr) => ({
    ...lr,
    lengthM: Math.round(lr.lengthM * 100) / 100,
    semantics: layerSemantics(lr.layer, layerMappings),
  }));

  const rebuilt = rebuildCadFromLayerBreakdown(layerBreakdown, layerMappings);
  const preview = buildPreviewFromLinework(linework, segmentsMeta, scale);

  return {
    fileName,
    fileType: "dxf",
    importedAt: new Date().toISOString(),
    units: unitLabel,
    insunits,
    layerMappings,
    entityFilter: {
      includedTypes: [...CAD_LENGTH_ENTITY_TYPES],
      includedNote: "LINE, LWPOLYLINE and POLYLINE (incl. 3D) only — blocks, text and other entities ignored.",
      skippedEntities,
      lineworkCount: linework.length,
    },
    preview,
    summary: rebuilt.summary,
    unmatchedLayers: rebuilt.unmatchedLayers,
    layerBreakdown,
    totals: rebuilt.totals,
    recordsDerivedM: rebuilt.recordsDerivedM,
    hasRecordsLinework: rebuilt.hasRecordsLinework,
  };
}

export function formatLengthM(m) {
  const n = Number(m);
  if (!Number.isFinite(n) || n <= 0) return "0 m";
  if (n < 10) return `${n.toFixed(1)} m`;
  return `${Math.round(n)} m`;
}

/** Short line for findings e.g. "34 m LV B1 (12 segments)". */
export function formatSummaryLine(row) {
  const util = row.utilityLabel?.replace(/\s*\(.*\)/, "") || "Utility";
  const ql = row.qlKey || row.pas128Equivalent || "—";
  const qlDisplay = ql === "TFR" ? "TFR (records)" : ql === "AR" ? "AR (as recorded)" : ql;
  return `${formatLengthM(row.lengthM)} ${util} ${qlDisplay} (${row.segments} segment${row.segments === 1 ? "" : "s"})`;
}

/**
 * Build narrative block for findings / PDF from CAD analysis.
 * @param {ReturnType<analyzeSurveyDxf>} analysis
 * @param {{ recordsGaps?: string[]; whatWasNotFound?: string }} [ctx]
 */
export function buildCadImportNarrative(analysis, ctx = {}) {
  if (!analysis?.summary?.length) {
    const skipped = analysis?.entityFilter?.skippedEntities || {};
    const skipNote = Object.keys(skipped).length
      ? ` Other entities in file were ignored (${Object.entries(skipped).map(([k, n]) => `${n}× ${k}`).join(", ")}).`
      : "";
    return `CAD import completed but no measurable linework was found. Only LINE, LWPOLYLINE and POLYLINE (including 3D) are measured; blocks, text, dimensions and inserts are not counted.${skipNote}`;
  }

  const lines = [];
  lines.push(`=== CAD utility length summary (${analysis.fileName}) ===`);
  lines.push(
    `Imported ${new Date(analysis.importedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · units: ${analysis.units}`
  );
  lines.push("Measured entity types: LINE, LWPOLYLINE, POLYLINE / 3D POLYLINE only (plan length). Blocks, text and other objects excluded.");

  const detected = analysis.summary.filter((g) => g.utilityKey && g.utilityKey !== "other");
  if (detected.length) {
    lines.push("Detected PAS128-classified linework:");
    detected.forEach((row) => lines.push(`• ${formatSummaryLine(row)}`));
    lines.push("");
  }

  const byQl = {};
  analysis.summary.forEach((row) => {
    const ql = row.qlKey || row.pas128Equivalent || "Unclassified";
    const short = row.utilityLabel?.split(" ")[0] || "Util";
    const key = `${short} ${ql}`;
    byQl[key] = (byQl[key] || 0) + row.lengthM;
  });
  const compact = Object.entries(byQl)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${formatLengthM(v)} ${k}`)
    .join(", ");
  if (compact) {
    lines.push(`Summary: ${compact}.`);
    lines.push("");
  }

  lines.push(
    `Total utility linework: ${formatLengthM(analysis.totals.lengthM)} across ${analysis.totals.segments} segment(s) on ${analysis.totals.layerCount} layer(s).`
  );

  if (analysis.hasRecordsLinework) {
    lines.push("");
    lines.push(
      `Records-derived linework (TFR / AR / QL B4): ${formatLengthM(analysis.recordsDerivedM)} shown from desktop or undertaker records without full geophysical verification on site — treat as PAS128 QL B4 equivalent unless trial holes or exposure confirm position and depth.`
    );
  }

  const gaps = ctx.recordsGaps || [];
  const notFound = String(ctx.whatWasNotFound || "").trim();
  if (gaps.length || notFound) {
    lines.push("");
    lines.push("Records review note:");
    if (gaps.length) lines.push(`• Information gaps on records review: ${gaps.join("; ")}.`);
    if (notFound) lines.push(`• Not found in available records: ${notFound}`);
    lines.push(
      "Additional services may exist in statutory undertaker records that were not digitised on the CAD drawing supplied; the above lengths reflect only linework present in the imported file."
    );
  } else if (analysis.unmatchedLayers?.length) {
    lines.push("");
    lines.push(
      "Some layers could not be auto-classified to PAS128 utility types — review layer naming or add manual findings."
    );
  }

  if (analysis.unmatchedLayers?.length) {
    lines.push("");
    lines.push("Layers not matched (manual review):");
    analysis.unmatchedLayers.slice(0, 12).forEach((lr) => {
      lines.push(`• ${lr.layer}: ${formatLengthM(lr.lengthM)} (${lr.segments} segment${lr.segments === 1 ? "" : "s"})`);
    });
    if (analysis.unmatchedLayers.length > 12) {
      lines.push(`• …and ${analysis.unmatchedLayers.length - 12} more layer(s).`);
    }
  }

  return lines.join("\n");
}

/** Read File as text (DXF) or reject DWG. */
export async function readCadFile(file) {
  const name = file?.name || "upload";
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "dwg") {
    const buf = await file.arrayBuffer();
    if (isLikelyDwgBuffer(buf)) {
      throw new Error(
        "DWG is not parsed in-browser. Export the drawing as DXF (R2000/LT recommended) from AutoCAD, BricsCAD or QGIS, then upload the .dxf file."
      );
    }
  }
  const text = await file.text();
  if (text.trimStart().startsWith("AC10") || text.includes("AutoCAD Binary")) {
    throw new Error("This appears to be a binary DWG file. Save or export as DXF and upload again.");
  }
  return analyzeSurveyDxf(text, { fileName: name });
}

/** Merge CAD analysis into survey report. */
export function mergeCadAnalysisIntoReport(report, analysis, ctx = {}) {
  const gapLabels = ctx.recordsGapLabels || [];
  const layerMappings = report.cadImport?.layerMappings || {};
  let analysisWithMappings = analysis;
  if (Object.keys(layerMappings).length > 0) {
    const rebuilt = rebuildCadFromLayerBreakdown(analysis.layerBreakdown, layerMappings);
    analysisWithMappings = {
      ...analysis,
      ...rebuilt,
      layerMappings,
      preview: analysis.preview?.paths?.length
        ? {
            ...analysis.preview,
            paths: analysis.preview.paths.map((p) => {
              const sem = layerSemantics(p.layer, layerMappings);
              return {
                ...p,
                utilityKey: sem.utilityKey,
                utilityLabel: sem.utilityLabel,
                isRecordsDerived: sem.isRecordsDerived,
              };
            }),
          }
        : analysis.preview,
    };
  }

  const previousSnapshot = report.cadImport?.summary?.length
    ? {
        fileName: report.cadImport.fileName,
        importedAt: report.cadImport.importedAt,
        totals: report.cadImport.totals,
        summary: report.cadImport.summary,
      }
    : null;
  const importDiff = previousSnapshot ? compareCadImports(previousSnapshot, analysisWithMappings) : null;

  const narrative = buildCadImportNarrative(analysisWithMappings, {
    whatWasNotFound: ctx.whatWasNotFound ?? report.utilityRecords?.whatWasNotFound,
    recordsGaps: gapLabels,
  });

  let findings = String(report.sections?.findings || "").trim();
  const marker = "=== CAD utility length summary";
  if (findings.includes(marker)) {
    findings = findings.replace(new RegExp(`${marker}[\\s\\S]*?(?=\\n===|$)`, "m"), narrative).trim();
    if (!findings.includes(marker)) findings = findings ? `${findings}\n\n${narrative}` : narrative;
  } else {
    findings = findings ? `${findings}\n\n${narrative}` : narrative;
  }

  const utilitiesFromCad = analysisWithMappings.summary
    .filter((g) => g.utilityKey && g.lengthM > 0)
    .map((g, i) => ({
      id: `ut_cad_${Date.now()}_${i}`,
      utilityType: g.utilityKey,
      depth: "",
      method: g.isRecordsDerived ? "Desktop / records (CAD TFR/AR)" : "Utility mapping (CAD)",
      pas128Ql: g.pas128Equivalent || g.qlKey || "",
      confidence: g.isRecordsDerived ? "indicative" : "medium",
      notes: `CAD layer(s): ${g.layers.join(", ")} · ${formatLengthM(g.lengthM)} total linework`,
    }));

  const existing = report.utilitiesTable || [];
  const mergedUtils = [...existing];
  utilitiesFromCad.forEach((row) => {
    const dupe = mergedUtils.find(
      (u) => u.utilityType === row.utilityType && u.pas128Ql === row.pas128Ql && u.notes?.includes("CAD layer")
    );
    if (!dupe) mergedUtils.push(row);
  });

  return {
    ...report,
    cadImport: {
      fileName: analysisWithMappings.fileName,
      fileType: analysisWithMappings.fileType,
      importedAt: analysisWithMappings.importedAt,
      units: analysisWithMappings.units,
      entityFilter: analysisWithMappings.entityFilter,
      preview: analysisWithMappings.preview,
      layerMappings,
      summary: analysisWithMappings.summary,
      unmatchedLayers: analysisWithMappings.unmatchedLayers,
      layerBreakdown: analysisWithMappings.layerBreakdown,
      totals: analysisWithMappings.totals,
      recordsDerivedM: analysisWithMappings.recordsDerivedM,
      importDiff,
      previousImport: previousSnapshot,
      narrative,
      _ctxWhatWasNotFound: ctx.whatWasNotFound ?? report.utilityRecords?.whatWasNotFound,
      _ctxRecordsGaps: gapLabels,
    },
    utilitiesTable: mergedUtils,
    sections: { ...report.sections, findings },
  };
}
