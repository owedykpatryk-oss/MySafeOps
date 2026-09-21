/**
 * GPR-specific CAD (DXF) analysis — model space only.
 * Counts GPR-named layers, UMG_* upgraded to QL-B1 (verified by GPR), and anomalies.
 */

import {
  analyzeSurveyDxf,
  formatLengthM,
  parseLayerSemantics,
  readCadFile,
} from "../../utils/surveyDxfAnalyzer.js";
import { buildHatchConstraintNarrative } from "../../utils/dxfHatchAnalyzer.js";
import { anomalyTypeLabel } from "./gprReportHelpers.js";

/** Layer name contains "GPR" (scan corridor / GPR linework). */
export function isGprNamedLayer(layerName) {
  return /GPR/i.test(String(layerName || ""));
}

/** UMG / utility-mapping layer naming (UMG_LV_B1, UMG-GAS-B2, …). */
export function isUmgLayer(layerName) {
  const n = String(layerName || "").toUpperCase();
  return /(^|[^A-Z0-9])UMG([^A-Z0-9]|$)/.test(`_${n}_`) || n.startsWith("UMG");
}

/** QL-B1 token present (verified / upgraded quality). */
export function isB1Layer(layerName, semantics = null) {
  const sem = semantics || parseLayerSemantics(layerName);
  if (sem.qlKey === "B1") return true;
  return /(^|[^A-Z0-9])B1([^A-Z0-9]|$)/i.test(`_${String(layerName || "").toUpperCase()}_`);
}

/** UMG linework upgraded to B1 thanks to GPR verification. */
export function isUmgUpgradedToB1(layerName, semantics = null) {
  return isUmgLayer(layerName) && isB1Layer(layerName, semantics);
}

function rollupByLayer(rows) {
  const map = new Map();
  for (const r of rows) {
    const prev = map.get(r.layer) || {
      layer: r.layer,
      lengthM: 0,
      segments: 0,
      utilityKey: r.utilityKey || "",
      utilityLabel: r.utilityLabel || "",
      qlKey: r.qlKey || "",
    };
    prev.lengthM += Number(r.lengthM) || 0;
    prev.segments += Number(r.segments) || 1;
    map.set(r.layer, prev);
  }
  return [...map.values()]
    .map((r) => ({ ...r, lengthM: Math.round(r.lengthM * 100) / 100 }))
    .sort((a, b) => b.lengthM - a.lengthM);
}

function rollupByUtility(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.utilityKey || "other";
    const prev = map.get(key) || {
      utilityKey: key,
      utilityLabel: r.utilityLabel || "Unclassified",
      lengthM: 0,
      segments: 0,
    };
    prev.lengthM += Number(r.lengthM) || 0;
    prev.segments += Number(r.segments) || 1;
    map.set(key, prev);
  }
  return [...map.values()]
    .map((r) => ({ ...r, lengthM: Math.round(r.lengthM * 100) / 100 }))
    .sort((a, b) => b.lengthM - a.lengthM);
}

function rollupByQl(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.qlKey || r.pas128Equivalent || "—";
    const prev = map.get(key) || { qlKey: key, lengthM: 0, segments: 0 };
    prev.lengthM += Number(r.lengthM) || 0;
    prev.segments += Number(r.segments) || 1;
    map.set(key, prev);
  }
  return [...map.values()]
    .map((r) => ({ ...r, lengthM: Math.round(r.lengthM * 100) / 100 }))
    .sort((a, b) => b.lengthM - a.lengthM);
}

/**
 * Summarise anomalies on the GPR report at import time.
 * @param {object[]} anomalies
 */
export function summariseGprAnomalies(anomalies = []) {
  const list = Array.isArray(anomalies) ? anomalies : [];
  const byTypeMap = new Map();
  for (const a of list) {
    const key = a.anomalyType || "other";
    const prev = byTypeMap.get(key) || { key, label: anomalyTypeLabel(key), count: 0 };
    prev.count += 1;
    byTypeMap.set(key, prev);
  }
  return {
    count: list.length,
    byType: [...byTypeMap.values()].sort((a, b) => b.count - a.count),
    withDepth: list.filter((a) => String(a.depthM ?? "").trim()).length,
    highConfidence: list.filter((a) => a.confidence === "high").length,
  };
}

/**
 * Build GPR CAD verification report from a DXF analysis (model space).
 * @param {ReturnType<analyzeSurveyDxf>} analysis
 * @param {{ anomalies?: object[] }} [ctx]
 */
export function buildGprCadVerificationReport(analysis, ctx = {}) {
  const breakdown = analysis?.layerBreakdown || [];
  const paperspaceSkipped = analysis?.entityFilter?.paperspaceSkipped || 0;

  const gprRows = [];
  const umgB1Rows = [];
  const umgRows = [];

  for (const lr of breakdown) {
    const layer = lr.layer || "";
    const sem = lr.semantics || parseLayerSemantics(layer);
    const row = {
      layer,
      lengthM: Number(lr.lengthM) || 0,
      segments: Number(lr.segments) || 0,
      utilityKey: sem.utilityKey || lr.utilityKey || "",
      utilityLabel: sem.utilityLabel || lr.utilityLabel || "",
      qlKey: sem.qlKey || lr.qlKey || "",
      pas128Equivalent: sem.pas128Equivalent || "",
    };

    if (isGprNamedLayer(layer)) gprRows.push(row);
    if (isUmgLayer(layer)) umgRows.push(row);
    if (isUmgUpgradedToB1(layer, sem)) umgB1Rows.push(row);
  }

  const sum = (rows) => ({
    segmentCount: rows.reduce((s, r) => s + (Number(r.segments) || 0), 0),
    lengthM: Math.round(rows.reduce((s, r) => s + (Number(r.lengthM) || 0), 0) * 100) / 100,
    layerCount: rows.length,
    byLayer: rollupByLayer(rows),
    byUtility: rollupByUtility(rows),
  });

  const gprLayers = sum(gprRows);
  const umgB1Upgrades = {
    ...sum(umgB1Rows),
    byUtility: rollupByUtility(umgB1Rows),
  };
  const umgAll = {
    ...sum(umgRows),
    byQl: rollupByQl(umgRows),
  };

  const anomalies = summariseGprAnomalies(ctx.anomalies);
  const hatches = analysis?.hatchConstraints || null;

  const narrative = buildGprCadNarrative({
    fileName: analysis?.fileName,
    units: analysis?.units,
    paperspaceSkipped,
    totals: analysis?.totals,
    gprLayers,
    umgB1Upgrades,
    umgAll,
    anomalies,
    hatches,
  });

  return {
    fileName: analysis?.fileName || "",
    importedAt: analysis?.importedAt || new Date().toISOString(),
    units: analysis?.units || "",
    modelSpaceOnly: analysis?.modelSpaceOnly !== false,
    paperspaceSkipped,
    totals: analysis?.totals || { lengthM: 0, segments: 0, layerCount: 0 },
    gprLayers,
    umgB1Upgrades,
    umgAll,
    anomalies,
    hatches,
    narrative,
    // Keep PAS128 classified summary for optional PDF comparison
    summary: analysis?.summary || [],
  };
}

/**
 * Human-readable findings block for GPR CAD verification.
 */
export function buildGprCadNarrative(report) {
  const lines = [];
  lines.push(`=== GPR CAD verification (${report.fileName || "import.dxf"}) ===`);
  lines.push(
    `Model space only${report.paperspaceSkipped ? ` · ${report.paperspaceSkipped} paper-space / layout entit${report.paperspaceSkipped === 1 ? "y" : "ies"} ignored` : ""} · units: ${report.units || "m"}`
  );
  if (report.totals?.lengthM != null) {
    lines.push(
      `Total model-space linework: ${formatLengthM(report.totals.lengthM)} across ${report.totals.segments || 0} segment(s) on ${report.totals.layerCount || 0} layer(s).`
    );
  }
  lines.push("");

  const g = report.gprLayers || {};
  lines.push("GPR-named layers (layer name contains “GPR”):");
  if (g.segmentCount > 0) {
    lines.push(
      `• ${g.segmentCount} line segment(s) · ${formatLengthM(g.lengthM)} on ${g.layerCount} layer(s)`
    );
    (g.byLayer || []).slice(0, 8).forEach((lr) => {
      lines.push(`  – ${lr.layer}: ${formatLengthM(lr.lengthM)} (${lr.segments} seg.)`);
    });
  } else {
    lines.push("• None found — name scan corridor layers with GPR (e.g. GPR_SCAN, UMG_GPR_L1).");
  }
  lines.push("");

  const u = report.umgB1Upgrades || {};
  lines.push("UMG_* upgraded to QL-B1 (GPR-verified quality):");
  if (u.segmentCount > 0) {
    lines.push(
      `• ${u.segmentCount} segment(s) · ${formatLengthM(u.lengthM)} — PAS128 QL raised to B1 after GPR location (e.g. UMG_LV_B1).`
    );
    (u.byUtility || []).forEach((row) => {
      lines.push(`  – ${row.utilityLabel}: ${formatLengthM(row.lengthM)} (${row.segments} seg.)`);
    });
  } else {
    lines.push("• No UMG_* …_B1 layers found in model space.");
  }
  lines.push("");

  const umg = report.umgAll || {};
  if (umg.segmentCount > 0) {
    lines.push(`All UMG_* linework: ${formatLengthM(umg.lengthM)} (${umg.segmentCount} seg.)`);
    const b1Share =
      umg.lengthM > 0 && u.lengthM > 0 ? Math.round((u.lengthM / umg.lengthM) * 100) : 0;
    if (b1Share) lines.push(`• QL-B1 share of UMG linework: ${b1Share}%`);
    (umg.byQl || []).forEach((q) => {
      lines.push(`  – QL ${q.qlKey}: ${formatLengthM(q.lengthM)} (${q.segments} seg.)`);
    });
    lines.push("");
  }

  const a = report.anomalies || {};
  lines.push(`GPR anomalies logged in report: ${a.count || 0}`);
  if (a.count) {
    lines.push(
      `• With depth: ${a.withDepth || 0} · High confidence: ${a.highConfidence || 0}`
    );
    (a.byType || []).forEach((t) => {
      lines.push(`  – ${t.label}: ${t.count}`);
    });
  }

  const hatchBlock = buildHatchConstraintNarrative(report.hatches);
  if (hatchBlock) {
    lines.push("");
    lines.push(hatchBlock);
  } else {
    lines.push("");
    lines.push("Site access hatches: none classified (vegetation / obstruction / building / no-access).");
  }

  return lines.join("\n");
}

/**
 * Merge a DXF analysis into a GPR report as gprCadImport + findings narrative.
 * @param {object} gprReport
 * @param {object} analysis — from analyzeSurveyDxf / readCadFile
 */
export function mergeGprCadAnalysisIntoReport(gprReport, analysis) {
  const gprCadImport = buildGprCadVerificationReport(analysis, {
    anomalies: gprReport?.anomalies,
  });

  let findings = String(gprReport?.sections?.findings || "").trim();
  const marker = "=== GPR CAD verification";
  if (findings.includes(marker)) {
    findings = findings.replace(new RegExp(`${marker}[\\s\\S]*?(?=\\n===|$)`, "m"), gprCadImport.narrative).trim();
    if (!findings.includes(marker)) {
      findings = findings ? `${findings}\n\n${gprCadImport.narrative}` : gprCadImport.narrative;
    }
  } else {
    findings = findings ? `${findings}\n\n${gprCadImport.narrative}` : gprCadImport.narrative;
  }

  // Merge hatch-driven limitation keys (e.g. incomplete coverage / no access).
  const hatchKeys = gprCadImport.hatches?.limitationKeys || [];
  const limitationKeys = [...new Set([...(gprReport.limitationKeys || []), ...hatchKeys])];

  let limitations = String(gprReport?.sections?.limitations || "").trim();
  const hatchNarratives = gprCadImport.hatches?.narratives || [];
  if (hatchNarratives.length) {
    const limBlock = hatchNarratives.join("\n");
    if (!limitations.includes("Unable to survey") && !limitations.includes("No access")) {
      limitations = limitations ? `${limitations}\n\n${limBlock}` : limBlock;
    }
  }

  return {
    ...gprReport,
    gprCadImport,
    limitationKeys,
    sections: {
      ...(gprReport.sections || {}),
      findings,
      limitations: limitations || gprReport?.sections?.limitations || "",
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Upload helper — DXF file → merged GPR report. */
export async function importGprCadFile(gprReport, file) {
  const analysis = await readCadFile(file);
  return mergeGprCadAnalysisIntoReport(gprReport, analysis);
}

export { analyzeSurveyDxf, readCadFile };
