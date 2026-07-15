import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { renderMySafeOpsMarkSvg } from "../../utils/pdfBranding.js";
import { buildStaticMapUrl } from "../../utils/staticMapUrl.js";
import {
  anomalyConfidenceLabel,
  anomalyTypeLabel,
  buildAcquisitionNarrative,
  buildQaNarrative,
  buildVelocityNarrative,
  gprReportQuality,
  normalizeGprReport,
} from "./gprReportHelpers";
import { gprEvidenceStats } from "./gprReportPulse";
import { GPR_LIMITATION_RULES, SCAN_MODES } from "./gprReportConstants";
// Shared confidence palette with the survey report's PAS128 visuals, so anomaly
// confidence reads the same way (colour + meaning) across document types.
import { CONFIDENCE_COLORS } from "../surveyReport/surveyPas128Visual.js";
import {
  buildGprLineLengthSummary,
  buildGprSurveyLineComparison,
} from "./gprLineLengthSummary.js";
import { cadUtilityColor } from "../../utils/cadImportVisuals.js";
import { formatLengthM } from "../../utils/surveyDxfAnalyzer.js";
import { formatOrgDate, formatOrgDateTime } from "../../utils/orgLocale.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2p(text) {
  const t = String(text || "").trim();
  if (!t) return "<p><em>Not recorded.</em></p>";
  return t
    .split(/\n{2,}/)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function section(title, body, id, num) {
  const label = num ? `<span class="gpr-sec-num">${num}</span> ${esc(title)}` : esc(title);
  return `<section class="gpr-section" id="${id || ""}"><h2>${label}</h2>${body}</section>`;
}

function dataTable(headers, rows) {
  if (!rows?.length) return "";
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell ?? "—")}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="gpr-data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function metaGrid(pairs) {
  return `<div class="gpr-meta-grid">${pairs
    .map(
      ([k, v]) =>
        `<div class="gpr-meta-item"><div class="gpr-meta-key">${esc(k)}</div><div class="gpr-meta-val">${esc(v || "—")}</div></div>`
    )
    .join("")}</div>`;
}

function coverWaveSvg(primary) {
  return `<svg viewBox="0 0 800 100" style="width:100%;height:72px;margin:16px 0" aria-hidden="true">
    <defs><linearGradient id="gprCv" x1="0" x2="1"><stop offset="0" stop-color="${primary}" stop-opacity="0.15"/><stop offset="1" stop-color="#0d9488" stop-opacity="0.25"/></linearGradient></defs>
    <path d="M0,50 Q200,10 400,45 T800,40 L800,100 L0,100 Z" fill="url(#gprCv)"/>
    <path d="M0,65 Q250,35 500,58 T800,55" fill="none" stroke="${primary}" stroke-width="1.5" opacity="0.35"/>
  </svg>`;
}

function coverStatsRow(r) {
  const stats = gprEvidenceStats(r);
  const pills = [
    stats.radargrams ? `${stats.radargrams} radargram${stats.radargrams > 1 ? "s" : ""}` : null,
    stats.panels ? `${stats.panels} panel${stats.panels > 1 ? "s" : ""}` : null,
    stats.anomalies ? `${stats.anomalies} anomal${stats.anomalies > 1 ? "ies" : "y"}` : null,
    stats.chainage ? `${stats.chainage} chainage seg.` : null,
    stats.planFigures ? `${stats.planFigures} plan figure${stats.planFigures > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  if (!pills.length) return "";
  return `<div class="gpr-cover-stats">${pills.map((p) => `<span class="gpr-cover-stat">${esc(p)}</span>`).join("")}</div>`;
}

function staticSiteMapUrl(lat, lng) {
  return buildStaticMapUrl(lat, lng, { width: 520, height: 220, zoom: 15, label: "Site location" });
}

function styles(primary, accent) {
  return `<style>
    /* Bottom @page margin reserves room for the fixed .gpr-print-footer on
       every printed page — a plain body/element bottom padding would only
       apply once, at the very end of the document, not per page. */
    @page { size: A4; margin: 14mm 12mm 20mm; }
    .gpr-doc { font-family: "DM Sans", system-ui, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.45; }
    .gpr-cover { page-break-after: always; min-height: 250mm; display: flex; flex-direction: column; background: linear-gradient(165deg, #f8fafc 0%, #fff 45%, #f0f9ff 100%); padding: 8px 0; }
    .gpr-cover-stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .gpr-cover-stat { font-size: 9pt; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: ${accent}; color: ${primary}; }
    .gpr-cover-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .gpr-cover-title { font-size: 22pt; font-weight: 700; color: ${primary}; margin: 16px 0; line-height: 1.2; }
    .gpr-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 9pt; font-weight: 600; background: ${accent}; color: ${primary}; margin-right: 8px; }
    /* Sections can hold long anomaly/equipment tables that exceed one page —
       page-break-inside:avoid on the whole section would force the browser
       to either ignore it or leave a large blank gap on the previous page.
       Keep only the heading glued to what follows; protect table rows below. */
    .gpr-section { margin: 20px 0; }
    .gpr-section h2 { font-size: 12pt; color: ${primary}; border-bottom: 2px solid ${accent}; padding-bottom: 4px; margin: 0 0 10px; page-break-after: avoid; break-after: avoid-page; }
    .gpr-sec-num { color: ${accent}; font-weight: 700; margin-right: 6px; }
    .gpr-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 12px 0; }
    .gpr-meta-key { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .gpr-meta-val { font-size: 10pt; font-weight: 500; overflow-wrap: anywhere; word-break: break-word; }
    .gpr-data-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9pt; margin: 10px 0; }
    .gpr-data-table th, .gpr-data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    .gpr-data-table tr { page-break-inside: avoid; break-inside: avoid; }
    .gpr-data-table th { background: #f4f7fb; color: ${primary}; font-weight: 600; }
    .gpr-callout { background: #f8fafc; border-left: 4px solid ${accent}; padding: 10px 12px; margin: 10px 0; font-size: 9.5pt; }
    .gpr-map { width: 100%; max-height: 220px; object-fit: cover; border-radius: 4px; margin: 10px 0; }
    .gpr-footer-note { font-size: 8pt; color: #666; margin-top: 24px; border-top: 1px solid #eee; padding-top: 8px; }
    .gpr-radargram-fig { margin: 12px 0; page-break-inside: avoid; }
    .gpr-radargram-fig figcaption { font-size: 9pt; color: #555; margin-top: 4px; }
    .gpr-scan-panel { margin: 14px 0; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; page-break-inside: avoid; }
    .gpr-scan-panel h3 { font-size: 10.5pt; margin: 0 0 8px; color: ${primary}; }
    .gpr-confidence-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 8.5pt; font-weight: 700; white-space: nowrap; }
    .gpr-bar-chart { margin: 8px 0 14px; }
    .gpr-bar-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .gpr-bar-label { font-size: 8.5pt; color: #475569; width: 150px; flex-shrink: 0; overflow-wrap: break-word; }
    .gpr-bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .gpr-bar-fill { height: 100%; background: linear-gradient(90deg, ${primary}, ${accent}); border-radius: 999px; }
    .gpr-bar-count { font-size: 8.5pt; font-weight: 700; color: ${primary}; width: 20px; text-align: right; flex-shrink: 0; }
    .gpr-watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 84px; font-weight: 800; letter-spacing: 0.14em; color: rgba(100,116,139,0.09); transform: rotate(-28deg); z-index: 0; text-transform: uppercase; }
    .gpr-print-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding: 6px 12mm; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #fff; z-index: 9998; }
    .gpr-running-header { display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8; border-bottom: 1px solid #e5e7eb; padding: 4px 0 8px; margin-bottom: 12px; }
    .gpr-toc { page-break-after: always; margin: 0 0 20px; }
    .gpr-toc-heading { font-size: 14pt; color: ${primary}; margin: 0 0 12px; }
    .gpr-toc ol { margin: 0; padding: 0; list-style: none; }
    .gpr-toc li { margin: 6px 0; font-size: 10pt; }
    .gpr-toc a { color: inherit; text-decoration: none; display: flex; align-items: baseline; gap: 6px; }
    .gpr-toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; min-width: 24px; margin: 0 6px; }
    .gpr-doc-body { position: relative; z-index: 1; }
    @media print {
      .gpr-cover-stat, .gpr-badge, .gpr-confidence-pill, .gpr-bar-fill, .gpr-data-table th {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .gpr-doc-body { padding-bottom: 6mm; }
    }
  </style>`;
}

function equipmentBlock(equipment) {
  if (!equipment?.length) return "<p><em>No equipment recorded.</em></p>";
  return dataTable(
    ["Manufacturer", "Model", "Antenna (MHz)", "Channels", "Serial", "Processing SW"],
    equipment.map((e) => [
      e.manufacturer,
      e.model,
      e.antennaFrequencyMhz,
      e.channels,
      e.serialNo,
      e.processingSoftware,
    ])
  );
}

function planFiguresBlock(figures) {
  if (!figures?.length) return "";
  return figures
    .filter((f) => f.dataUrl)
    .map(
      (f) =>
        `<figure class="gpr-radargram-fig"><img src="${esc(f.dataUrl)}" alt="${esc(f.label || "Plan figure")}" style="max-width:100%;border-radius:6px"/><figcaption>${esc(f.label || "Plan layout")}${f.figureType ? ` · ${esc(f.figureType.replace(/_/g, " "))}` : ""}</figcaption></figure>`
    )
    .join("");
}

function radargramsBlock(radargrams) {
  if (!radargrams?.length) return "<p><em>No radargram images attached.</em></p>";
  return radargrams
    .filter((rg) => rg.dataUrl)
    .map(
      (rg) =>
        `<figure class="gpr-radargram-fig"><img src="${esc(rg.dataUrl)}" alt="${esc(rg.label || "Radargram")}" style="max-width:100%;border-radius:6px"/><figcaption>${esc(rg.label || "")}${rg.lineRef ? ` · ${esc(rg.lineRef)}` : ""}${rg.notes ? ` — ${esc(rg.notes)}` : ""}</figcaption></figure>`
    )
    .join("");
}

function confidencePillHtml(key) {
  const color = CONFIDENCE_COLORS[key] || "#64748b";
  return `<span class="gpr-confidence-pill" style="background:${color}1A;color:${color};border:1px solid ${color}55">${esc(anomalyConfidenceLabel(key))}</span>`;
}

/** Compact horizontal bar chart of anomaly counts by type — same visual language as
 * the survey report's PAS128 bar charts, adapted for GPR anomaly types. */
function anomalyTypeBarsHtml(anomalies) {
  if (!anomalies?.length) return "";
  const byType = {};
  anomalies.forEach((a) => {
    const t = a.anomalyType || "other";
    byType[t] = (byType[t] || 0) + 1;
  });
  const total = anomalies.length;
  const rows = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const pct = Math.max(4, Math.round((count / total) * 100));
      return `<div class="gpr-bar-row">
        <span class="gpr-bar-label">${esc(anomalyTypeLabel(type))}</span>
        <div class="gpr-bar-track"><div class="gpr-bar-fill" style="width:${pct}%"></div></div>
        <span class="gpr-bar-count">${count}</span>
      </div>`;
    })
    .join("");
  return `<div class="gpr-bar-chart">${rows}</div>`;
}

function anomaliesBlock(anomalies) {
  if (!anomalies?.length) return "<p><em>No anomalies logged.</em></p>";
  const rows = anomalies
    .map(
      (a, i) => `<tr>
        <td>${esc(a.ref || `A${i + 1}`)}</td>
        <td>${esc(anomalyTypeLabel(a.anomalyType))}</td>
        <td>${esc(a.depthM ?? "—")}</td>
        <td>${esc(a.lineOrGrid ?? "—")}</td>
        <td>${esc(a.interpretation ?? "—")}</td>
        <td>${confidencePillHtml(a.confidence)}</td>
      </tr>`
    )
    .join("");
  return `${anomalyTypeBarsHtml(anomalies)}<table class="gpr-data-table"><thead><tr><th>Ref</th><th>Type</th><th>Depth (m)</th><th>Line/grid</th><th>Interpretation</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function processingFiltersBlock(filters) {
  const rows = (filters || []).filter((f) => f.applied);
  if (!rows.length) return "";
  return dataTable(
    ["Filter", "Parameter", "Notes"],
    rows.map((f) => [f.label, f.parameter, f.notes])
  );
}

function scanPanelsBlock(panels, radargrams = []) {
  if (!panels?.length) return "";
  const rgById = Object.fromEntries((radargrams || []).map((rg) => [rg.id, rg]));
  return panels
    .map((p) => {
      const grid =
        p.gridSizeW || p.gridSizeH
          ? `${p.gridSizeW || "—"} m × ${p.gridSizeH || "—"} m`
          : "—";
      const spacing =
        p.scanSpacingH || p.scanSpacingV
          ? `H ${p.scanSpacingH || "—"} m / V ${p.scanSpacingV || "—"} m`
          : "—";
      const rg = p.radargramId ? rgById[p.radargramId] : null;
      return `<div class="gpr-scan-panel">
        <h3>${esc(p.panelRef || "Scan panel")}</h3>
        ${dataTable(
          ["Grid size", "Scan spacing", "Target depth", "Signal quality", "Primary interpretation"],
          [[grid, spacing, p.targetDepthM ? `${p.targetDepthM} m` : "—", p.signalQuality || "—", p.primaryInterpretation || "—"]]
        )}
        ${p.detailNotes ? `<p><strong>Detail:</strong> ${esc(p.detailNotes)}</p>` : ""}
        ${p.comments ? `<p><strong>Comments:</strong> ${esc(p.comments)}</p>` : ""}
        ${rg?.dataUrl ? `<figure class="gpr-radargram-fig"><img src="${esc(rg.dataUrl)}" alt="" style="max-width:100%;max-height:180px;border-radius:6px"/><figcaption>${esc(rg.label || p.panelRef || "")}</figcaption></figure>` : ""}
      </div>`;
    })
    .join("");
}

function chainageBlock(segments) {
  if (!segments?.length) return "";
  return dataTable(
    ["Line / swath", "Chainage (m)", "Thickness / depth", "Condition band", "Notes"],
    segments.map((s) => [
      [s.lineRef, s.swathRef].filter(Boolean).join(" · ") || "—",
      [s.chainageStartM, s.chainageEndM].filter(Boolean).join(" – ") || "—",
      s.thicknessOrDepthM || "—",
      s.conditionBand || "—",
      s.profileNotes || "—",
    ])
  );
}

/** Horizontal bar chart — same visual language as anomaly type bars and survey CAD charts. */
function gprUtilityBarsHtml(byUtility, primary, accent) {
  if (!byUtility?.length) return "";
  const rows = byUtility
    .map((u) => {
      const pct = Math.max(4, u.pct || 0);
      const color = u.color || cadUtilityColor(u.key);
      return `<div class="gpr-bar-row">
        <span class="gpr-bar-label">${esc(u.label)}</span>
        <div class="gpr-bar-track"><div class="gpr-bar-fill" style="width:${pct}%;background:linear-gradient(90deg, ${color}, ${accent})"></div></div>
        <span class="gpr-bar-count">${esc(formatLengthM(u.lengthM))}</span>
      </div>`;
    })
    .join("");
  return `<div class="gpr-bar-chart">${rows}</div>`;
}

function gprLineLengthSummaryBlock(report, linkedSurveyReport) {
  const visual = buildGprLineLengthSummary(report);
  if (!visual.totalM) {
    return "<p><em>Add chainage segments with PAS128-style line refs (e.g. UMG_LV_B1) and chainage from/to in metres.</em></p>";
  }

  let html = `<p class="gpr-callout"><strong>${esc(formatLengthM(visual.totalM))}</strong> GPR corridor length classified from ${visual.segmentCount} chainage segment(s) using PAS128 line naming (utility + QL token in line ref).</p>`;
  html += gprUtilityBarsHtml(visual.byUtility, null, null);

  if (visual.summary.length) {
    html += dataTable(
      ["Utility", "PAS128 QL", "Length", "Segments", "Line ref(s)"],
      visual.summary.map((r) => [
        r.utilityLabel,
        r.qlKey || "—",
        formatLengthM(r.lengthM),
        String(r.segments),
        (r.lineRefs || []).slice(0, 2).join(", ") + ((r.lineRefs?.length || 0) > 2 ? "…" : ""),
      ])
    );
  }

  const cmp = buildGprSurveyLineComparison(visual, linkedSurveyReport);
  if (cmp.hasBaseline && cmp.rows.length) {
    html += `<h3 style="font-size:11pt;color:inherit;margin:16px 0 8px">Survey CAD baseline vs GPR verification</h3>`;
    if (cmp.narrative) html += `<div class="gpr-callout">${esc(cmp.narrative)}</div>`;
    html += dataTable(
      ["Utility", "QL", "Survey CAD", "GPR verified", "Change"],
      cmp.rows
        .filter((r) => r.surveyLengthM > 0 || r.gprLengthM > 0)
        .map((r) => [
          r.utilityLabel,
          r.qlKey,
          r.surveyLengthM > 0 ? formatLengthM(r.surveyLengthM) : "—",
          r.gprLengthM > 0 ? formatLengthM(r.gprLengthM) : "—",
          r.changeNote,
        ])
    );
  } else if (linkedSurveyReport?.cadImport?.summary?.length) {
    html += `<p><em>Linked survey has CAD lengths but no matching GPR chainage yet — add line refs and chainage ranges.</em></p>`;
  }

  return html;
}

function deliverablesBlock(deliverables, notes) {
  const keys = Object.entries(deliverables || {}).filter(([, v]) => v).map(([k]) => k);
  if (!keys.length && !notes?.trim()) return "<p><em>Deliverables not listed.</em></p>";
  const labels = keys.map((k) => k.replace(/_/g, " "));
  return [
    labels.length ? `<ul>${labels.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "",
    notes?.trim() ? nl2p(notes) : "",
  ].join("");
}

function signOffBlock(signOff, surveyor, surveyDate) {
  const s = signOff || {};
  return dataTable(
    ["Role", "Name", "Date"],
    [
      [s.authorRole || "Author", s.authorName || surveyor || "—", surveyDate ? formatOrgDate(surveyDate) : "—"],
      [s.processorRole || "Data processor", s.processorName || "—", "—"],
      [s.checkerRole || "Checked by", s.checkerName || "—", s.checkedDate ? formatOrgDate(s.checkedDate) : "—"],
    ]
  );
}

function gprTableOfContents(entries) {
  if (!entries.length) return "";
  const items = entries
    .map(
      (e) =>
        `<li><a href="#${esc(e.id)}"><span>${e.num ? `<span class="gpr-sec-num">${e.num}</span> ` : ""}${esc(e.title)}</span><span class="gpr-toc-dots"></span></a></li>`
    )
    .join("");
  return `<nav class="gpr-toc" aria-label="Contents"><h2 class="gpr-toc-heading">Contents</h2><ol>${items}</ol></nav>`;
}

function groundConditionsBlock(gc) {
  const parts = [];
  if (gc.narrative) parts.push(`<div class="gpr-callout">${esc(gc.narrative)}</div>`);
  if (gc.bedrock?.lexDescription || gc.superficial?.lexDescription) {
    parts.push(
      metaGrid([
        ["Superficial", gc.superficial?.lexDescription || "—"],
        ["Bedrock", gc.bedrock?.lexDescription || "—"],
        ["Attenuation class", gc.attenuationClass || "—"],
        ["Expected penetration", gc.expectedPenetrationM ? `~${gc.expectedPenetrationM} m` : "—"],
        ["BGS scale", gc.scale || "—"],
        ["Data source", gc.source || "—"],
      ])
    );
  }
  const obs = gc.siteObservations || {};
  if (obs.notes || obs.surfaceType) {
    parts.push(
      `<p><strong>Site observations:</strong> Surface ${obs.surfaceType || "—"}, moisture ${obs.moisture || "—"}, reinforcement ${obs.reinforcement || "—"}.${obs.notes ? ` ${esc(obs.notes)}` : ""}</p>`
    );
  }
  return parts.join("") || "<p><em>Ground conditions not fetched — run site enrichment.</em></p>";
}

function environmentalBlock(env) {
  if (!env?.description && !env?.moistureImpactOnGpr) return "<p><em>Environmental conditions not recorded.</em></p>";
  return [
    env.description ? `<p><strong>Weather:</strong> ${esc(env.description)}</p>` : "",
    env.moistureImpactOnGpr
      ? `<div class="gpr-callout"><strong>GPR impact:</strong> ${esc(env.moistureImpactOnGpr)}</div>`
      : "",
    metaGrid([
      ["Ground surface", env.groundSurface || "—"],
      ["Rain during survey", env.rainDuringSurvey || "—"],
      ["Temperature", env.tempC != null ? `${env.tempMinC != null ? `${env.tempMinC}–` : ""}${env.tempC}°C` : "—"],
      ["Wind", env.windMph != null ? `~${env.windMph} mph` : "—"],
    ]),
  ].join("");
}

/**
 * @param {object} report
 * @param {{ projectLat?: number, projectLng?: number, linkedSurveyReport?: object }} [extras]
 */
export function buildGprReportHtml(report, extras = {}) {
  const r = normalizeGprReport(report);
  const org = getOrgSettings();
  const primary = org.primaryColor || "#0C447C";
  const accent = org.accentColor || "#E6F1FB";
  const quality = gprReportQuality(r);
  const scanLabel = SCAN_MODES.find((s) => s.key === r.acquisition?.scanMode)?.label || r.acquisition?.scanMode;
  const mapUrl = staticSiteMapUrl(extras.projectLat, extras.projectLng);

  const limitationText =
    r.sections?.limitations ||
    r.limitationsText ||
    GPR_LIMITATION_RULES.filter((x) => (r.limitationKeys || []).includes(x.key))
      .map((x) => x.text)
      .join("\n\n");

  let sec = 0;
  const toc = [];
  const sections = [];
  const pushSection = (title, contentHtml, id) => {
    const num = ++sec;
    toc.push({ id, title, num });
    sections.push(section(title, contentHtml, id, num));
  };

  const coverHtml = `<div class="gpr-cover">
      <div class="gpr-cover-top">
        <div>
          ${org.logo ? `<img src="${esc(org.logo)}" alt="" style="max-height:48px;margin-bottom:8px"/>` : ""}
          <div style="font-weight:600">${esc(org.name)}</div>
        </div>
        <div>${renderMySafeOpsMarkSvg(24)}</div>
      </div>
      <span class="gpr-badge">${r.status === "final" ? "Final GPR report" : "Draft GPR report"}</span>
      <span class="gpr-badge">Completeness ${quality.score}%</span>
      <h1 class="gpr-cover-title">${esc(r.title || "Ground Penetrating Radar Report")}</h1>
      ${coverWaveSvg(primary)}
      ${coverStatsRow(r)}
      ${metaGrid([
        ["Report ref", r.ref],
        ["Survey date", r.surveyDate ? formatOrgDate(r.surveyDate) : "—"],
        ["Site", r.siteAddress || r.projectName],
        ["Surveyor", r.surveyor],
        ["Scan mode", scanLabel],
        ["Primary antenna", r.equipment?.[0]?.antennaFrequencyMhz ? `${r.equipment[0].antennaFrequencyMhz} MHz` : "—"],
      ])}
      ${mapUrl ? `<img class="gpr-map" src="${esc(mapUrl)}" alt="Site location"/>` : ""}
    </div>`;

  pushSection("Foreword", nl2p(r.sections.foreword), "foreword");
  pushSection("Executive summary", nl2p(r.sections.executiveSummary), "exec");
  pushSection("Scope", nl2p(r.sections.scope), "scope");
  pushSection("Methodology", nl2p(r.sections.methodology), "method");
  pushSection("Equipment", equipmentBlock(r.equipment), "equip");
  pushSection(
    "Acquisition parameters",
    `<p>${esc(buildAcquisitionNarrative({ ...r.acquisition, scanMode: scanLabel }))}</p>`,
    "acq"
  );
  pushSection("Velocity model & calibration", `<p>${esc(buildVelocityNarrative(r.velocityModel))}</p>`, "vel");
  pushSection("Ground conditions & geology", groundConditionsBlock(r.groundConditions), "ground");
  pushSection("Environmental conditions & GPR impact", environmentalBlock(r.environmental), "env");
  pushSection(
    "Data processing",
    processingFiltersBlock(r.processing?.filters) + nl2p(r.sections.dataProcessing || r.processing?.notes),
    "proc"
  );
  pushSection("Interpretation criteria", nl2p(r.sections.interpretationCriteria), "interp");
  pushSection(
    "Deliverables",
    deliverablesBlock(r.deliverables, r.sections.deliverablesNotes),
    "deliv"
  );
  pushSection(
    "Scan panels / grid results",
    scanPanelsBlock(r.scanPanels, r.radargrams) || "<p><em>No scan panels recorded.</em></p>",
    "panels"
  );
  pushSection(
    "Plan layouts & CAD figures",
    planFiguresBlock(r.planFigures) || "<p><em>No plan layout figures attached.</em></p>",
    "plans"
  );
  pushSection(
    "PAS128 line lengths (GPR corridor)",
    gprLineLengthSummaryBlock(r, extras.linkedSurveyReport),
    "line-lengths"
  );
  pushSection(
    "Chainage / profile segments",
    chainageBlock(r.chainageSegments) || "<p><em>No chainage profiles recorded.</em></p>",
    "chain"
  );
  pushSection("Radargrams & scan images", radargramsBlock(r.radargrams), "radar");
  pushSection("Findings & anomalies", anomaliesBlock(r.anomalies) + nl2p(r.sections.findings), "find");
  pushSection("Limitations", nl2p(limitationText), "lim");
  pushSection("Recommendations", nl2p(r.sections.recommendations), "rec");
  pushSection("QA checklist", `<p>${esc(buildQaNarrative(r.qaChecklist))}</p>`, "qa");
  pushSection("Report sign-off", signOffBlock(r.signOff, r.surveyor, r.surveyDate), "signoff");

  const tocHtml = gprTableOfContents(toc);
  const runningHeader = `<div class="gpr-running-header"><span>${esc(r.ref || "")}</span><span>${esc(r.title || "GPR Report")}</span></div>`;

  const body = [
    coverHtml,
    tocHtml,
    runningHeader,
    ...sections,
    `<div class="gpr-footer-note">
      GPR interpretations are geophysical indications only. BGS geology via Open Government Licence (1:625k generalised).
      ${r.smartFillAt ? `Smart fill: ${formatOrgDateTime(r.smartFillAt)}.` : ""}
      Generated by MySafeOps.
    </div>`,
  ].join("");

  // Draft/final watermark and running footer — same visual signalling as permits/RAMS,
  // so a GPR export can't be mistaken for a final report while still in draft.
  const watermarkText = String(org.pdfWatermarkText || "").trim() || (r.status === "final" ? "FINAL" : "DRAFT");
  const footerRef = esc(r.ref || "GPR report");
  const complianceLine = String(org.pdfComplianceLine || "").trim();

  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><title>${esc(r.ref || "GPR Report")}</title>${styles(primary, accent)}</head><body>
    <div class="gpr-watermark">${esc(watermarkText)}</div>
    <div class="gpr-doc gpr-doc-body">${body}</div>
    <div class="gpr-print-footer">
      <span>${esc(org.pdfFooter || "Generated by MySafeOps")} · mysafeops.com${complianceLine ? ` · ${esc(complianceLine)}` : ""}</span>
      <span>${footerRef}</span>
    </div>
  </body></html>`;
}
