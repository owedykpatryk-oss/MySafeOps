import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { renderMySafeOpsMarkSvg } from "../../utils/pdfBranding.js";
import { buildStaticMapUrl } from "../../utils/staticMapUrl.js";
import {
  isUtilityMappingPrintTheme,
  utilityMappingGprCoverCss,
  utilityMappingCoverKitChips,
} from "../../utils/utilityMappingPrintTheme.js";
import {
  renderUtilityMappingHeroCover,
  renderUtilityMappingDocControlPage,
  utilityMappingCoverSystemCss,
  renderUtilityMappingPageHeader,
  renderUtilityMappingPageFooter,
  renderUtilityMappingComplianceRibbon,
  resolveUtilityMappingLogoSrc,
} from "../../utils/utilityMappingCovers.js";
import {
  anomalyConfidenceLabel,
  anomalyTypeLabel,
  buildAcquisitionNarrative,
  buildQaNarrative,
  buildVelocityNarrative,
  gprReportQuality,
  normalizeGprReport,
} from "./gprReportHelpers";
import { buildGprPreSurveyPrintHtml } from "./gprPreSurvey";
import { gprEvidenceStats } from "./gprReportPulse";
import { GPR_EQUIPMENT_PRESETS, GPR_LIMITATION_RULES, SCAN_MODES } from "./gprReportConstants";
// Shared confidence palette with the survey report's PAS128 visuals, so anomaly
// confidence reads the same way (colour + meaning) across document types.
import { CONFIDENCE_COLORS } from "../surveyReport/surveyPas128Visual.js";
import { safeImageSrc } from "../../utils/htmlEscape.js";
import { getUtilityMappingClient, utilityMappingClientLogoUrl } from "../../utils/utilityMappingClients.js";
import { resolveGprVisualTheme } from "./gprVisualTheme.js";
import { applyGprNarrativeAutomation } from "./gprNarrativeAutomation.js";
import {
  GPR_AI_ACTIONS,
  GPR_AI_CAVEATS,
  GPR_AI_MECHANISMS,
  GPR_AI_RELEVANCE,
  safeEvidenceImageSrc,
  sanitizeEvidenceAssessments,
  verifiedGprEvidence,
} from "./gprEvidence.js";
import { GPR_ANOMALY_FIGURE_ROLES } from "./gprReportConstants";
import {
  buildGprLineLengthSummary,
  buildGprSurveyLineComparison,
} from "./gprLineLengthSummary.js";
import { cadUtilityColor } from "../../utils/cadImportVisuals.js";
import { formatLengthM } from "../../utils/surveyDxfAnalyzer.js";
import { formatAreaM2 } from "../../utils/dxfHatchAnalyzer.js";
import {
  formatDocumentDate as formatOrgDate,
  formatDocumentDateTime as formatOrgDateTime,
} from "../../utils/orgLocale.js";
import { safeHttpUrl } from "../../utils/safeUrl.js";
import { escapeAttr } from "../../utils/htmlEscape.js";

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

function coverWaveSvg(primary, accent) {
  return `<svg viewBox="0 0 800 100" style="width:100%;height:72px;margin:16px 0" aria-hidden="true">
    <defs><linearGradient id="gprCv" x1="0" x2="1"><stop offset="0" stop-color="${primary}" stop-opacity="0.15"/><stop offset="1" stop-color="${accent}" stop-opacity="0.25"/></linearGradient></defs>
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

function styles(primary, accent, accentInk, accentSoft, primarySoft) {
  const umCss = isUtilityMappingPrintTheme()
    ? `${utilityMappingCoverSystemCss()}${utilityMappingGprCoverCss(primary, accent)}`
    : "";
  return `<style>
    /* Bottom @page margin reserves room for the fixed .gpr-print-footer on
       every printed page — a plain body/element bottom padding would only
       apply once, at the very end of the document, not per page. */
    @page { size: A4; margin: 14mm 12mm 20mm; }
    .gpr-doc { font-family: "DM Sans", system-ui, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.45; }
    .gpr-cover { page-break-after: always; min-height: 250mm; display: flex; flex-direction: column; background: radial-gradient(circle at 100% 0%, ${accentSoft} 0%, transparent 34%), linear-gradient(165deg, ${primarySoft} 0%, #fff 46%, ${accentSoft} 100%); padding: 8px 0; border: 1px solid ${accentSoft}; border-radius: 8px; }
    .gpr-cover-stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .gpr-cover-stat { font-size: 9pt; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: ${accentSoft}; color: ${primary}; border: 1px solid ${accent}; }
    .gpr-cover-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .gpr-cover-title { font-size: 22pt; font-weight: 700; color: ${primary}; margin: 16px 0; line-height: 1.2; }
    .gpr-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 9pt; font-weight: 600; background: ${accentSoft}; color: ${primary}; border-left: 3px solid ${accent}; margin-right: 8px; }
    .gpr-doc-status { display: grid; grid-template-columns: 1.25fr repeat(3, 1fr); gap: 1px; margin: 14px 0 4px; overflow: hidden; border: 1px solid ${accent}; border-radius: 6px; background: ${accent}; page-break-inside: avoid; }
    .gpr-doc-status > div { padding: 8px 10px; background: #fff; }
    .gpr-doc-status__state { color: #fff !important; background: ${primary} !important; }
    .gpr-doc-status small { display: block; margin-bottom: 2px; color: #64748b; font-size: 7pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .gpr-doc-status__state small { color: rgba(255,255,255,0.72); }
    .gpr-doc-status strong { display: block; font-size: 9pt; overflow-wrap: anywhere; }
    /* Sections can hold long anomaly/equipment tables that exceed one page —
       page-break-inside:avoid on the whole section would force the browser
       to either ignore it or leave a large blank gap on the previous page.
       Keep only the heading glued to what follows; protect table rows below. */
    .gpr-section { margin: 20px 0; }
    .gpr-section h2 { font-size: 12pt; color: ${primary}; border-bottom: 2px solid ${accent}; padding-bottom: 4px; margin: 0 0 10px; page-break-after: avoid; break-after: avoid-page; }
    .gpr-sec-num { color: ${accentInk}; font-weight: 700; margin-right: 6px; }
    .gpr-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 12px 0; }
    .gpr-meta-key { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #666; }
    .gpr-meta-val { font-size: 10pt; font-weight: 500; overflow-wrap: anywhere; word-break: break-word; }
    .gpr-data-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9pt; margin: 10px 0; }
    .gpr-data-table th, .gpr-data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; overflow-wrap: anywhere; word-break: break-word; }
    .gpr-data-table tr { page-break-inside: avoid; break-inside: avoid; }
    .gpr-data-table th { background: #f4f7fb; color: ${primary}; font-weight: 600; }
    .gpr-equipment-profile { display: grid; grid-template-columns: 38% 1fr; gap: 14px; margin: 0 0 14px; padding: 12px; border: 1px solid #99f6e4; border-radius: 8px; background: linear-gradient(135deg,#f0fdfa,#fff 55%,#eff6ff); page-break-inside: avoid; break-inside: avoid; }
    .gpr-equipment-profile img { display: block; width: 100%; height: 150px; object-fit: contain; border-radius: 6px; background: #fff; }
    .gpr-equipment-profile h3 { margin: 0 0 6px; color: ${primary}; font-size: 14pt; line-height: 1.2; }
    .gpr-equipment-profile p { margin: 3px 0; font-size: 9pt; overflow-wrap: anywhere; }
    .gpr-equipment-profile ul { margin: 7px 0; padding-left: 18px; font-size: 8.5pt; columns: 2; column-gap: 18px; }
    .gpr-equipment-profile a { color: ${primary}; font-size: 8pt; font-weight: 600; }
    .gpr-callout { background: #f8fafc; border-left: 4px solid ${accent}; padding: 10px 12px; margin: 10px 0; font-size: 9.5pt; }
    .gpr-map { width: 100%; max-height: 220px; object-fit: cover; border-radius: 4px; margin: 10px 0; }
    .gpr-footer-note { font-size: 8pt; color: #666; margin-top: 24px; border-top: 1px solid #eee; padding-top: 8px; }
    .gpr-radargram-fig { margin: 12px 0; page-break-inside: avoid; break-inside: avoid; }
    .gpr-radargram-fig img { display: block; width: 100%; max-width: 100%; max-height: 210mm; object-fit: contain; object-position: center; border-radius: 6px; background: #fff; }
    .gpr-finding-card { margin: 0 0 8px; padding: 8px 8px 6px; border: 1px solid #e2e8f0; border-radius: 6px; page-break-inside: avoid; break-inside: avoid; }
    .gpr-finding-card__head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .gpr-finding-card__head strong { color: ${primary}; font-size: 10.5pt; }
    .gpr-finding-card__meta { margin: 2px 0 4px; color: #475569; font-size: 8.5pt; }
    .gpr-finding-card__text { margin: 0 0 6px; font-size: 9pt; line-height: 1.35; }
    .gpr-finding-photos { display: grid; gap: 6px; }
    .gpr-finding-photos--1 { grid-template-columns: 1fr; }
    .gpr-finding-photos--2 { grid-template-columns: 1fr 1fr; }
    .gpr-finding-photos--3 { grid-template-columns: 1fr 1fr 1fr; }
    .gpr-finding-photos figure { margin: 0; min-width: 0; }
    .gpr-finding-photos img { display: block; width: 100%; height: 52mm; object-fit: contain; object-position: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
    .gpr-finding-photos--3 img { height: 40mm; }
    .gpr-finding-photos figcaption { margin-top: 2px; color: #64748b; font-size: 7.5pt; text-align: center; }
    .gpr-radargram-fig figcaption { font-size: 9pt; color: #555; margin-top: 4px; }
    .gpr-site-photo-page { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 4mm; margin: 0 0 4mm; page-break-inside: avoid; break-inside: avoid; }
    .gpr-site-photo-page figure { margin: 0; min-width: 0; }
    .gpr-site-photo-page img { display: block; width: 100%; height: 34mm; object-fit: contain; object-position: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; }
    .gpr-site-photo-page figcaption { margin-top: 1mm; color: #64748b; font-size: 7.5pt; text-align: center; }
    .gpr-acq-shots { margin: 8px 0 0; }
    .gpr-acq-shot { margin: 0 0 8px; page-break-inside: avoid; break-inside: avoid; }
    .gpr-acq-shot img { display: block; width: 100%; max-height: 95mm; object-fit: contain; object-position: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
    .gpr-acq-shot figcaption { margin-top: 2px; color: #64748b; font-size: 8pt; }
    .gpr-scan-panel { margin: 14px 0; padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; page-break-inside: avoid; }
    .gpr-scan-panel h3 { font-size: 10.5pt; margin: 0 0 8px; color: ${primary}; }
    .gpr-confidence-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 8.5pt; font-weight: 700; white-space: nowrap; }
    .gpr-bar-chart { margin: 8px 0 14px; }
    .gpr-bar-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .gpr-bar-label { font-size: 8.5pt; color: #475569; width: 150px; flex-shrink: 0; overflow-wrap: break-word; }
    .gpr-bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .gpr-bar-fill { height: 100%; background: linear-gradient(90deg, ${primary}, ${accent}); border-radius: 999px; }
    .gpr-bar-count { font-size: 8.5pt; font-weight: 700; color: ${primary}; width: 20px; text-align: right; flex-shrink: 0; }
    .gpr-acq-diagram { margin: 0 0 14px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: linear-gradient(180deg,#f8fafc,#fff); page-break-inside: avoid; display: inline-block; }
    .gpr-acq-diagram__label { font-size: 9pt; font-weight: 700; color: ${primary}; margin-bottom: 8px; }
    .gpr-acquisition-layout { display: grid; grid-template-columns: minmax(150px, 34%) 1fr; gap: 14px; align-items: start; page-break-inside: avoid; break-inside: avoid; }
    .gpr-ground-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin: 8px 0 12px; overflow: hidden; border: 1px solid ${accentSoft}; border-radius: 6px; background: ${accentSoft}; page-break-inside: avoid; break-inside: avoid; }
    .gpr-ground-summary > div { min-width: 0; padding: 9px; background: #fff; }
    .gpr-ground-summary small { display: block; margin-bottom: 3px; color: #64748b; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; }
    .gpr-ground-summary strong { color: ${primary}; font-size: 9pt; overflow-wrap: anywhere; }
    .gpr-evidence-print { margin: 0 0 12px; padding: 11px 12px; border: 1px solid ${accentSoft}; border-radius: 7px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
    .gpr-evidence-print h3 { margin: 0 0 6px; color: ${primary}; font-size: 11pt; }
    .gpr-evidence-print__image { margin: 8px 0; page-break-inside: avoid; }
    .gpr-evidence-print__image img { display: block; width: 100%; max-height: 145mm; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 5px; }
    .gpr-evidence-print__image figcaption { margin-top: 4px; color: #64748b; font-size: 8pt; }
    .gpr-small { color: #64748b; font-size: 8.5pt; }
    .gpr-anomaly-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin: 8px 0 12px; overflow: hidden; border: 1px solid ${accentSoft}; border-radius: 6px; background: ${accentSoft}; page-break-inside: avoid; break-inside: avoid; }
    .gpr-anomaly-summary > div { min-width: 0; padding: 9px; background: #fff; }
    .gpr-anomaly-summary span { display: block; margin-bottom: 3px; color: #64748b; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; }
    .gpr-anomaly-summary strong { display: block; color: ${primary}; font-size: 11pt; overflow-wrap: anywhere; }
    .gpr-chainage-chart { margin: 0 0 14px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fafcff; page-break-inside: avoid; }
    .gpr-chainage-chart__label { font-size: 9pt; font-weight: 700; color: ${primary}; margin-bottom: 6px; }
    .gpr-watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-size: 84px; font-weight: 800; letter-spacing: 0.14em; color: rgba(100,116,139,0.09); transform: rotate(-28deg); z-index: 0; text-transform: uppercase; }
    .gpr-print-footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 8pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding: 6px 12mm; display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #fff; z-index: 9998; }
    .gpr-running-header { display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8; border-bottom: 1px solid #e5e7eb; padding: 4px 0 8px; margin-bottom: 12px; }
    .gpr-toc { page-break-after: always; margin: 0 0 20px; display: flow-root; }
    .gpr-toc-heading { font-size: 14pt; color: ${primary}; margin: 0 0 12px; }
    .gpr-toc ol { margin: 0; padding: 0; list-style: none; }
    .gpr-toc li { margin: 6px 0; font-size: 10pt; }
    .gpr-toc a { color: inherit; text-decoration: none; display: flex; align-items: baseline; gap: 6px; }
    .gpr-toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; min-width: 24px; margin: 0 6px; }
    .gpr-doc-body { position: relative; z-index: 1; }
    @media print {
      .gpr-cover-stat, .gpr-badge, .gpr-confidence-pill, .gpr-bar-fill, .gpr-data-table th, .gpr-cover {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .gpr-doc-body { padding-bottom: 6mm; }
    }
    ${umCss}
  </style>`;
}

function equipmentBlock(equipment) {
  if (!equipment?.length) return "<p><em>No equipment recorded.</em></p>";
  const profiles = equipment
    .map((e) => {
      const preset = GPR_EQUIPMENT_PRESETS.find((item) => item.key === e.presetKey);
      if (!preset) return "";
      const facts = (preset.techHighlights?.length
        ? preset.techHighlights
        : [
            `${preset.antennaFrequencyMhz} MHz`,
            `${preset.channels} channel${preset.channels === 1 ? "" : "s"}`,
            preset.processingSoftware,
          ].filter(Boolean));
      const image = preset.imageUrl
        ? `<img src="${escapeAttr(preset.imageUrl)}" alt="${escapeAttr(`${preset.manufacturer} ${preset.model} product reference`)}"/>`
        : "";
      const source = safeHttpUrl(preset.sourceUrl)
        ? `<a href="${escapeAttr(safeHttpUrl(preset.sourceUrl))}">Official product information</a>`
        : "";
      return `<div class="gpr-equipment-profile">${image}<div><h3>${esc(preset.manufacturer)} ${esc(preset.model)}</h3><p><strong>${esc(preset.antennaFrequencyMhz)} MHz · ${esc(preset.channels)} channel${preset.channels === 1 ? "" : "s"}</strong></p><p>${esc(preset.configuration)}</p><ul>${facts.map((fact) => `<li>${esc(fact)}</li>`).join("")}</ul><p>${preset.processingSoftware ? `Processing: ${esc(preset.processingSoftware)}` : "Processing software recorded per mobilisation."}</p>${source}</div></div>`;
    })
    .join("");
  const table = dataTable(
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
  return `${profiles}${table}`;
}

function planFiguresBlock(figures) {
  if (!figures?.length) return "";
  return figures
    .filter((f) => f.dataUrl)
    .map(
      (f) =>
        `<figure class="gpr-radargram-fig"><img src="${esc(f.dataUrl)}" alt="${esc(f.label || "Plan figure")}"/><figcaption>${esc(f.label || "Plan layout")}${f.figureType ? ` · ${esc(f.figureType.replace(/_/g, " "))}` : ""}</figcaption></figure>`
    )
    .join("");
}

function radargramsBlock(radargrams) {
  if (!radargrams?.length) return "<p><em>No radargram images attached.</em></p>";
  return radargrams
    .filter((rg) => rg.dataUrl)
    .map(
      (rg) =>
        `<figure class="gpr-radargram-fig"><img src="${esc(rg.dataUrl)}" alt="${esc(rg.label || "Radargram")}"/><figcaption>${esc(rg.label || "")}${rg.lineRef ? ` · ${esc(rg.lineRef)}` : ""}${rg.notes ? ` — ${esc(rg.notes)}` : ""}</figcaption></figure>`
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

function anomalySummaryHtml(anomalies) {
  if (!anomalies?.length) return "";
  const confidence = anomalies.reduce(
    (counts, anomaly) => {
      const key = ["high", "medium", "low"].includes(anomaly?.confidence) ? anomaly.confidence : "unrated";
      counts[key] += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0, unrated: 0 }
  );
  const depths = anomalies
    .map((anomaly) => Number(anomaly?.depthM))
    .filter((depth) => Number.isFinite(depth) && depth >= 0);
  const missingDetail = anomalies.filter(
    (anomaly) => !String(anomaly?.ref || "").trim() || !String(anomaly?.interpretation || "").trim()
  ).length;
  const depthRange = depths.length
    ? `${Math.min(...depths).toFixed(2)}–${Math.max(...depths).toFixed(2)} m`
    : "Not recorded";
  const review = [];
  if (confidence.low) review.push(`${confidence.low} low-confidence response${confidence.low === 1 ? " requires" : "s require"} corroboration`);
  if (confidence.unrated) review.push(`${confidence.unrated} response${confidence.unrated === 1 ? " is" : "s are"} not rated`);
  if (depths.length < anomalies.length) review.push(`${anomalies.length - depths.length} depth value${anomalies.length - depths.length === 1 ? " is" : "s are"} missing`);
  if (missingDetail) review.push(`${missingDetail} row${missingDetail === 1 ? " is" : "s are"} incomplete`);

  return `<div class="gpr-anomaly-summary">
    <div><span>Total responses</span><strong>${anomalies.length}</strong></div>
    <div><span>High confidence</span><strong>${confidence.high}</strong></div>
    <div><span>Medium / low</span><strong>${confidence.medium} / ${confidence.low}</strong></div>
    <div><span>Recorded depth range</span><strong>${esc(depthRange)}</strong></div>
  </div>${review.length ? `<div class="gpr-callout" style="border-left-color:#f59e0b"><strong>Interpretation review:</strong> ${esc(review.join("; "))}.</div>` : ""}`;
}

function anomalyFigureCards(anomalies) {
  return (anomalies || []).map((anomaly, index) => {
    const figures = (anomaly.figures || [])
      .map((figure) => ({ ...figure, src: safeEvidenceImageSrc(figure.dataUrl) }))
      .filter((figure) => figure.src)
      .slice(0, 3);
    const count = figures.length;
    const photos = count
      ? `<div class="gpr-finding-photos gpr-finding-photos--${count}">${figures.map((figure) => {
          const role = GPR_ANOMALY_FIGURE_ROLES.find((item) => item.key === figure.role)?.label || "Figure";
          return `<figure><img src="${escapeAttr(figure.src)}" alt="${escapeAttr(role)}"/><figcaption>${esc(role)}</figcaption></figure>`;
        }).join("")}</div>`
      : "";
    const correlation = anomaly.archiveCorrelation === "correlates" || anomaly.archiveCorrelation === "does_not_correlate"
      ? ` ${anomaly.archiveCorrelation === "correlates" ? "Correlates with archive frame" : "Does not correlate with archive frame"}${anomaly.archiveFrameDate ? ` ${anomaly.archiveFrameDate}` : ""}.`
      : "";
    return `<article class="gpr-finding-card">
      <div class="gpr-finding-card__head"><strong>${esc(anomaly.ref || `A${index + 1}`)}</strong>${confidencePillHtml(anomaly.confidence)}</div>
      <p class="gpr-finding-card__meta">${esc(anomalyTypeLabel(anomaly.anomalyType))} · ${esc(anomaly.depthM ? `${anomaly.depthM} m` : "depth not recorded")}${anomaly.lineOrGrid ? ` · ${esc(anomaly.lineOrGrid)}` : ""}</p>
      <p class="gpr-finding-card__text">${esc(anomaly.interpretation || "No interpretation recorded.")}${esc(correlation)}</p>
      ${photos}
    </article>`;
  }).join("");
}

function anomaliesBlock(anomalies) {
  if (!anomalies?.length) return "<p><em>No anomalies logged.</em></p>";
  return `${anomalySummaryHtml(anomalies)}${anomalyTypeBarsHtml(anomalies)}${anomalyFigureCards(anomalies)}`;
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

const CHAINAGE_BAND_COLOURS = {
  excellent: "#0d9488",
  good: "#059669",
  fair: "#d97706",
  poor: "#ea580c",
  spent: "#dc2626",
};

const ACQ_MODE_SHAPES = {
  grid: { rows: 4, cols: 4, label: "Grid scan" },
  longitudinal: { rows: 1, cols: 6, label: "Longitudinal lines" },
  cross_section: { rows: 6, cols: 1, label: "Cross-section" },
  route: { rows: 2, cols: 5, label: "Route / corridor" },
  "3d_array": { rows: 3, cols: 3, label: "3D array" },
};

/** Print-ready acquisition pattern diagram (mirrors editor GprAcquisitionDiagram). */
function acquisitionDiagramSvg(scanMode, lineSpacingM) {
  const shape = ACQ_MODE_SHAPES[scanMode] || ACQ_MODE_SHAPES.grid;
  const cellW = 28;
  const cellH = 18;
  const gap = 4;
  const pad = 12;
  const w = pad * 2 + shape.cols * cellW + (shape.cols - 1) * gap;
  const h = pad * 2 + shape.rows * cellH + (shape.rows - 1) * gap + 18;
  const cells = [];
  for (let r = 0; r < shape.rows; r += 1) {
    for (let c = 0; c < shape.cols; c += 1) {
      const x = pad + c * (cellW + gap);
      const y = pad + r * (cellH + gap);
      cells.push(
        `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3" fill="#0c447c" fill-opacity="0.12" stroke="#0c447c" stroke-width="1.2"/>`
      );
    }
  }
  const spacing = lineSpacingM ? ` · line spacing ${esc(String(lineSpacingM))} m` : "";
  return `<div class="gpr-acq-diagram">
    <div class="gpr-acq-diagram__label">${esc(shape.label)}${spacing}</div>
    <svg viewBox="0 0 ${w} ${h}" width="${Math.min(w, 280)}" height="${Math.round((h / w) * Math.min(w, 280))}" role="img" aria-label="${esc(shape.label)}">${cells.join("")}</svg>
  </div>`;
}

function acquisitionParametersBlock(report, scanLabel) {
  const acq = report.acquisition || {};
  const eq = report.equipment?.[0] || {};
  const expected = Number(report.groundConditions?.expectedPenetrationM);
  const target = Number(acq.depthRangeM);
  const risk = Number.isFinite(expected) && Number.isFinite(target)
    ? target > expected
      ? `<div class="gpr-callout" style="border-left-color:#dc2626"><strong>Depth feasibility:</strong> Target depth ${esc(String(target))} m exceeds the BGS-informed indicative penetration of ~${esc(String(expected))} m. Confidence is expected to reduce with depth.</div>`
      : `<div class="gpr-callout"><strong>Depth feasibility:</strong> Target depth ${esc(String(target))} m is within the BGS-informed indicative penetration of ~${esc(String(expected))} m, subject to field signal quality.</div>`
    : `<div class="gpr-callout" style="border-left-color:#f59e0b"><strong>Depth feasibility:</strong> Complete target depth and ground enrichment to compare the requested range with indicative penetration.</div>`;

  const parameterTable = dataTable(
    ["Parameter", "Recorded value", "Technical relevance"],
    [
      ["Acquisition mode", scanLabel || "—", "Controls coverage geometry and interpretation continuity"],
      ["Antenna centre frequency", eq.antennaFrequencyMhz ? `${eq.antennaFrequencyMhz} MHz` : "—", "Higher frequency favours resolution; lower frequency generally favours depth"],
      ["Line spacing", acq.lineSpacingM ? `${acq.lineSpacingM} m` : "—", "Controls cross-line sampling and smallest resolvable lateral feature"],
      ["Trace spacing", acq.traceSpacingM ? `${acq.traceSpacingM} m` : "—", "Controls along-line sampling density"],
      ["Time window", acq.timeWindowNs ? `${acq.timeWindowNs} ns` : "—", "Maximum recorded two-way travel time"],
      ["Target depth", acq.depthRangeM ? `${acq.depthRangeM} m` : "—", "Stated investigation range, not guaranteed achieved penetration"],
      ["Coverage", acq.coveragePercent ? `${acq.coveragePercent}%` : "—", "Estimated accessible scope completed"],
      ["Scan direction", acq.scanDirection || "—", "Supports correlation with plans and orthogonal coverage checks"],
      ["Stacking passes", acq.stackingPasses || "—", "Repeated traces can improve signal-to-noise ratio"],
      ["Grid / route extent", acq.gridExtentM ? `${acq.gridExtentM} m` : "—", "Recorded acquisition extent"],
    ]
  );

  return [
    `<div class="gpr-acquisition-layout">${acquisitionDiagramSvg(acq.scanMode, acq.lineSpacingM)}<div><p>${esc(buildAcquisitionNarrative({ ...acq, scanMode: scanLabel }))}</p><p><strong>Positioning/configuration:</strong> ${esc(eq.configuration || "Record wheel/DMI, GPS or survey-control configuration in the equipment log.")}</p></div></div>`,
    risk,
    parameterTable,
    acquisitionScreenshotsHtml(acq),
  ].join("");
}

function acquisitionScreenshotsHtml(acq) {
  const figures = (acq?.screenshots || [])
    .map((shot) => {
      const src = safeEvidenceImageSrc(shot?.dataUrl);
      if (!src) return "";
      const caption = String(shot.caption || "Acquisition screenshot").slice(0, 160);
      return `<figure class="gpr-acq-shot"><img src="${esc(src)}" alt="${esc(caption)}"/><figcaption>${esc(caption)}</figcaption></figure>`;
    })
    .filter(Boolean);
  return figures.length ? `<div class="gpr-acq-shots">${figures.join("")}</div>` : "";
}

/** Print-ready chainage depth profile (mirrors editor GprChainageChart). */
function chainageChartSvg(segments = []) {
  const points = (segments || [])
    .map((s, i) => {
      const start = Number(s.chainageStartM);
      const end = Number(s.chainageEndM);
      const depth = Number(s.thicknessOrDepthM);
      const mid = Number.isFinite(start) && Number.isFinite(end) ? (start + end) / 2 : i;
      return {
        x: mid,
        y: Number.isFinite(depth) ? depth : null,
        band: s.conditionBand,
        label: [s.lineRef, s.swathRef].filter(Boolean).join(" · ") || `Seg ${i + 1}`,
      };
    })
    .filter((p) => p.y != null);
  if (points.length < 2) return "";

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys, 0.1);
  const pad = 28;
  const w = 520;
  const h = 150;
  const spanX = maxX - minX || 1;
  const coords = points.map((p) => ({
    ...p,
    sx: pad + ((p.x - minX) / spanX) * (w - pad * 2),
    sy: h - pad - (p.y / maxY) * (h - pad * 2),
  }));
  const pathD = coords.map((p, i) => `${i ? "L" : "M"}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");
  const dots = coords
    .map(
      (p) =>
        `<circle cx="${p.sx.toFixed(1)}" cy="${p.sy.toFixed(1)}" r="4.5" fill="${CHAINAGE_BAND_COLOURS[p.band] || "#0c447c"}" stroke="#fff" stroke-width="1.2"><title>${esc(p.label)}: ${p.y} m</title></circle>`
    )
    .join("");

  return `<div class="gpr-chainage-chart">
    <div class="gpr-chainage-chart__label">Chainage depth profile</div>
    <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:520px;height:auto" role="img" aria-label="Chainage depth profile">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#cbd5e1" stroke-width="1"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#cbd5e1" stroke-width="1"/>
      <text x="${pad - 4}" y="${pad + 4}" font-size="9" fill="#64748b" text-anchor="end">${maxY.toFixed(1)} m</text>
      <text x="${pad - 4}" y="${h - pad}" font-size="9" fill="#64748b" text-anchor="end">0</text>
      <path d="${pathD}" fill="none" stroke="#0c447c" stroke-width="2" opacity="0.55"/>
      ${dots}
      <text x="${w / 2}" y="${h - 6}" font-size="9" fill="#64748b" text-anchor="middle">Chainage (m)</text>
    </svg>
  </div>`;
}

function chainageBlock(segments) {
  if (!segments?.length) return "";
  const chart = chainageChartSvg(segments);
  const table = dataTable(
    ["Line / swath", "Chainage (m)", "Thickness / depth", "Condition band", "Notes"],
    segments.map((s) => [
      [s.lineRef, s.swathRef].filter(Boolean).join(" · ") || "—",
      [s.chainageStartM, s.chainageEndM]
        .filter((value) => value !== "" && value !== null && value !== undefined)
        .join(" – ") || "—",
      s.thicknessOrDepthM || "—",
      s.conditionBand || "—",
      s.profileNotes || "—",
    ])
  );
  return `${chart}${table}`;
}

/** CAD model-space GPR verification summary for print/PDF. */
function gprCadVerificationBlock(cad) {
  if (!cad?.fileName) return "";
  const g = cad.gprLayers || {};
  const b1 = cad.umgB1Upgrades || {};
  const a = cad.anomalies || {};
  const umg = cad.umgAll || {};

  let html = `<p class="gpr-callout"><strong>Model space only</strong>${
    cad.paperspaceSkipped
      ? ` — ${cad.paperspaceSkipped} paper-space / layout entit${cad.paperspaceSkipped === 1 ? "y" : "ies"} ignored`
      : ""
  }. File: ${esc(cad.fileName)}${cad.units ? ` · ${esc(cad.units)}` : ""}.</p>`;

  html += metaGrid([
    ["GPR-named layers", `${g.segmentCount || 0} seg. · ${formatLengthM(g.lengthM || 0)}`],
    ["UMG → QL-B1 upgrades", `${b1.segmentCount || 0} seg. · ${formatLengthM(b1.lengthM || 0)}`],
    ["GPR anomalies (report)", String(a.count || 0)],
    ["All UMG_* linework", `${umg.segmentCount || 0} seg. · ${formatLengthM(umg.lengthM || 0)}`],
  ]);

  if ((g.byLayer || []).length) {
    html += `<h3 style="font-size:11pt;margin:14px 0 8px">GPR-named layers</h3>`;
    html += dataTable(
      ["Layer", "Length", "Segments"],
      g.byLayer.slice(0, 12).map((lr) => [lr.layer, formatLengthM(lr.lengthM), String(lr.segments)])
    );
  }

  if ((b1.byUtility || []).length) {
    html += `<h3 style="font-size:11pt;margin:14px 0 8px">UMG upgraded to QL-B1 (GPR-verified)</h3>`;
    html += dataTable(
      ["Utility", "Length", "Segments"],
      b1.byUtility.map((row) => [row.utilityLabel, formatLengthM(row.lengthM), String(row.segments)])
    );
  }

  if ((umg.byQl || []).length) {
    html += `<h3 style="font-size:11pt;margin:14px 0 8px">UMG_* by PAS128 QL</h3>`;
    html += dataTable(
      ["QL", "Length", "Segments"],
      umg.byQl.map((q) => [q.qlKey, formatLengthM(q.lengthM), String(q.segments)])
    );
  }

  if ((a.byType || []).length) {
    html += `<h3 style="font-size:11pt;margin:14px 0 8px">Anomalies by type</h3>`;
    html += dataTable(
      ["Type", "Count"],
      a.byType.map((t) => [t.label, String(t.count)])
    );
  }

  const hatches = cad.hatches;
  if (hatches?.constraintHatchCount) {
    html += `<h3 style="font-size:11pt;margin:14px 0 8px">Unable to survey / no-access hatches</h3>`;
    html += `<p class="gpr-callout">Total constraint area <strong>${esc(formatAreaM2(hatches.totalConstraintAreaM2))}</strong> from ${hatches.constraintHatchCount} hatch${hatches.constraintHatchCount === 1 ? "" : "es"} (model space).</p>`;
    html += dataTable(
      ["Category", "Hatches", "Area", "Narrative"],
      (hatches.byCategory || []).map((c) => [
        c.label,
        String(c.hatchCount),
        formatAreaM2(c.areaM2),
        c.narrative,
      ])
    );
  }

  return html;
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
  const obs = gc.siteObservations || {};
  parts.push(`<div class="gpr-ground-summary">
    <div><small>Mapped ground class</small><strong>${esc((gc.materialClass || "not classified").replace(/_/g, " "))}</strong></div>
    <div><small>Expected attenuation</small><strong>${esc((gc.attenuationClass || "not assessed").replace(/_/g, " "))}</strong></div>
    <div><small>Indicative penetration</small><strong>${gc.expectedPenetrationM ? `~${esc(String(gc.expectedPenetrationM))} m` : "Not assessed"}</strong></div>
    <div><small>Recommended antenna</small><strong>${esc(gc.recommendedAntenna?.label || (gc.recommendedAntenna?.mhz ? `${gc.recommendedAntenna.mhz} MHz` : "Review target depth"))}</strong></div>
  </div>`);
  if (gc.accuracyWarning) {
    parts.push(`<div class="gpr-callout" style="border-left-color:#f59e0b"><strong>Accuracy:</strong> ${esc(gc.accuracyWarning)}</div>`);
  }
  if (gc.narrative) parts.push(`<div class="gpr-callout"><strong>GPR performance interpretation:</strong> ${esc(gc.narrative)}</div>`);
  if (gc.bedrock?.lexDescription || gc.superficial?.lexDescription || gc.artificial?.lexDescription) {
    parts.push(
      metaGrid([
        ["Artificial ground", gc.artificial?.lexDescription || "—"],
        ["Superficial", gc.superficial?.lexDescription || "—"],
        ["Bedrock", gc.bedrock?.lexDescription || "—"],
        ["Attenuation class", gc.attenuationClass || "—"],
        ["Expected penetration", gc.expectedPenetrationM ? `~${gc.expectedPenetrationM} m` : "—"],
        ["Dielectric range", gc.dielectricRange?.length ? `εr ${gc.dielectricRange.join("-")}` : "—"],
        ["BGS scale", gc.scale || "—"],
        ["Lookup", gc.coordSource || "—"],
        ["Data source", gc.source || "—"],
        ["Query point", gc.queryLat != null && gc.queryLng != null ? `${Number(gc.queryLat).toFixed(5)}, ${Number(gc.queryLng).toFixed(5)}` : "—"],
      ])
    );
  }
  const boreholes = Array.isArray(gc.nearbyBoreholes) ? gc.nearbyBoreholes : [];
  if (boreholes.length) {
    const rows = boreholes
      .slice(0, 5)
      .map((b) => {
        const href = safeHttpUrl(b.scanUrl);
        const ref = esc(b.reference || b.name || "—");
        const label = href
          ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${ref}</a>`
          : ref;
        return `<tr><td>${label}</td><td>${b.distanceM != null ? `${esc(String(b.distanceM))} m` : "—"}</td><td>${b.lengthM != null ? `${esc(String(b.lengthM))} m` : "—"}</td></tr>`;
      })
      .join("");
    parts.push(
      `<p><strong>Nearby BGS borehole index</strong> (click ref for scan when available)</p><table class="gpr-data-table"><thead><tr><th>Ref / scan</th><th>Distance</th><th>Length</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  }
  if (obs.notes || obs.surfaceType) {
    parts.push(
      `<p><strong>Site observations:</strong> Surface ${obs.surfaceType || "—"}, moisture ${obs.moisture || "—"}, reinforcement ${obs.reinforcement || "—"}.${obs.notes ? ` ${esc(obs.notes)}` : ""}</p>`
    );
  }
  parts.push(`<div class="gpr-callout" style="border-left-color:#64748b"><strong>Use of BGS data:</strong> ${esc(gc.disclaimer || "Mapped geology is regional desk-study context, not a site-specific ground investigation. Local fill, utilities, moisture and construction can differ from the mapped unit.")}</div>`);
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

function historicalEvidenceBlock(report) {
  const evidence = verifiedGprEvidence(report);
  if (!evidence.length) {
    return `<div class="gpr-callout" style="border-left-color:#64748b"><strong>No verified historic evidence.</strong> No claim about former buildings, structures, burials or previous land use has been included.</div>`;
  }
  const assessmentById = new Map(
    sanitizeEvidenceAssessments(report.evidenceReview?.assessments, evidence.map((item) => item.id))
      .map((item) => [item.evidenceId, item])
  );
  const cards = evidence.map((item) => {
    const assessment = assessmentById.get(item.id);
    const url = safeHttpUrl(item.sourceUrl);
    const imageSrc = safeEvidenceImageSrc(item.imageDataUrl);
    const sourceLabel = [item.sourceName, item.sourceDate].filter(Boolean).join(" · ") || "Verified source";
    const classification = assessment
      ? `<div class="gpr-callout"><strong>Controlled GPR relevance:</strong> ${esc(GPR_AI_RELEVANCE[assessment.relevance])}<br/>
          <strong>Possible response mechanisms (not site facts):</strong> ${esc((assessment.mechanisms || []).map((key) => GPR_AI_MECHANISMS[key]).filter(Boolean).join("; ") || "None assigned")}<br/>
          <strong>Follow-up:</strong> ${esc((assessment.recommendedActions || []).map((key) => GPR_AI_ACTIONS[key]).filter(Boolean).join("; ") || "None assigned")}<br/>
          <strong>Caveat:</strong> ${esc(GPR_AI_CAVEATS[assessment.caveat])}</div>`
      : `<p><em>Not classified by AI; retained as verified desk-study evidence.</em></p>`;
    return `<article class="gpr-evidence-print">
      <h3>${esc(item.title || sourceLabel)}</h3>
      <p><strong>Source:</strong> ${url ? `<a href="${escapeAttr(url)}">${esc(sourceLabel)}</a>` : esc(sourceLabel)}</p>
      <p><strong>Verified factual observation:</strong> ${esc(item.observedFact)}</p>
      ${item.coverageNotes ? `<p><strong>Coverage / alignment:</strong> ${esc(item.coverageNotes)}</p>` : ""}
      ${imageSrc ? `<figure class="gpr-evidence-print__image"><img src="${escapeAttr(imageSrc)}" alt="Historic evidence"/><figcaption>${esc(item.imageFileName || item.title || "Evidence image")}</figcaption></figure>` : ""}
      ${classification}
    </article>`;
  }).join("");
  const meta = report.evidenceReview?.reviewedAt
    ? `<p class="gpr-small"><strong>AI role:</strong> controlled classification only (${esc(report.evidenceReview.model || "OpenAI")}, ${esc(formatOrgDateTime(report.evidenceReview.reviewedAt))}). Facts above are copied from verified evidence, not generated by AI.</p>`
    : "";
  return `${cards}${meta}<div class="gpr-callout" style="border-left-color:#f59e0b"><strong>Interpretation boundary:</strong> Historic mapping or imagery can guide correlation, but spatial coincidence does not prove that a radar response is a former structure, service, void or burial. Confirm against survey geometry and, where required, an approved verification method.</div>`;
}

/**
 * @param {object} report
 * @param {{ projectLat?: number, projectLng?: number, linkedSurveyReport?: object }} [extras]
 */
export function buildGprReportHtml(report, extras = {}) {
  const r = normalizeGprReport(applyGprNarrativeAutomation(report));
  const org = getOrgSettings();
  const umTheme = isUtilityMappingPrintTheme();
  const organisationPrimary =
    umTheme && (!org.primaryColor || org.primaryColor === "#0d9488" || org.primaryColor === "#0C447C")
      ? "#0B1D3A"
      : org.primaryColor || "#0C447C";
  const organisationAccent =
    umTheme && (!org.accentColor || org.accentColor === "#f97316" || org.accentColor === "#E6F1FB")
      ? "#00B4E4"
      : org.accentColor || "#E6F1FB";
  const theme = resolveGprVisualTheme(r, {
    ...org,
    primaryColor: organisationPrimary,
    accentColor: organisationAccent,
  });
  const { primary, accent, accentInk, accentSoft, primarySoft } = theme;
  const quality = gprReportQuality(r);
  const scanLabel = SCAN_MODES.find((s) => s.key === r.acquisition?.scanMode)?.label || r.acquisition?.scanMode;
  const startLat = r.preSurvey?.lat ?? extras.projectLat;
  const startLng = r.preSurvey?.lng ?? extras.projectLng;
  const mapUrl = staticSiteMapUrl(startLat, startLng);
  const surveyDates = (r.preSurvey?.surveyDates || []).filter(Boolean);
  const surveyDateLabel =
    surveyDates.length > 1
      ? surveyDates.map((d) => formatOrgDate(d)).join(" · ")
      : r.surveyDate
        ? formatOrgDate(r.surveyDate)
        : "—";
  const finalIssue = r.status === "final";
  const documentStatusHtml = `<div class="gpr-doc-status">
    <div class="gpr-doc-status__state"><small>Issue status</small><strong>${finalIssue ? "FINAL ISSUE" : "DRAFT - NOT FOR RELIANCE"}</strong></div>
    <div><small>Revision</small><strong>${esc(r.revision || "P01")}</strong></div>
    <div><small>Purpose</small><strong>${esc(r.issuePurpose || (finalIssue ? "Final issue" : "For information"))}</strong></div>
    <div><small>Issued</small><strong>${finalIssue && r.finalisedAt ? esc(formatOrgDateTime(r.finalisedAt)) : "Not finalised"}</strong></div>
  </div>`;

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

  const umLogo = resolveUtilityMappingLogoSrc(org);
  const coverBranding = r.coverBranding || {};
  const brandMode = coverBranding.mode === "client" || coverBranding.mode === "both" ? coverBranding.mode : "own";
  const clientName = String(coverBranding.clientName || "").trim() || getUtilityMappingClient(coverBranding.clientCode)?.name || "";
  const clientLogo =
    safeImageSrc(coverBranding.clientLogoDataUrl) ||
    utilityMappingClientLogoUrl(coverBranding.clientCode) ||
    "";
  const sitePhoto = (r.preSurvey?.photos || [])
    .map((photo) => safeEvidenceImageSrc(photo?.dataUrl) || safeImageSrc(photo?.dataUrl))
    .find(Boolean) || "";
  const headerLogo = brandMode === "client" ? clientLogo : umLogo;
  const headerOpts = brandMode === "client"
    ? { hideWordmark: true, allowEmpty: true, alt: clientName || "Client" }
    : {};
  const coverHtml = umTheme
    ? renderUtilityMappingHeroCover({
        title: r.title || "Ground Penetrating Radar Report",
        subtitle: scanLabel ? `GPR · ${scanLabel}` : "GPR survey report",
        badge: r.status === "final" ? "Final GPR report" : "Draft GPR report",
        methodBadge: "GPR",
        kitChips: utilityMappingCoverKitChips({ surveyType: "gpr_survey", pas128Method: "GPR" }),
        orgName: org.name || "Utility Mapping",
        logoSrc: umLogo,
        brandMode,
        clientName,
        clientCode: coverBranding.clientCode || "",
        clientLogoSrc: clientLogo,
        sitePhotoSrc: sitePhoto,
        meta: [
          ["Report ref", r.ref || "—"],
          ["Survey date", surveyDateLabel],
          ["Client", r.client || "—"],
          ["Site", [r.siteAddress, r.postcode].filter(Boolean).join(", ") || r.projectName || "—"],
          ["Surveyor", r.surveyor || "Not recorded"],
          ...(r.gridRef || r.osgbEasting ? [["OSGB", r.gridRef || `${r.osgbEasting} E, ${r.osgbNorthing} N`]] : []),
          ...(r.what3words ? [["What3Words", r.what3words]] : []),
          ["Scan mode", scanLabel || "—"],
          [
            "Primary antenna",
            r.equipment?.[0]?.antennaFrequencyMhz ? `${r.equipment[0].antennaFrequencyMhz} MHz` : "—",
          ],
          ["Completeness", `${quality.score}%`],
        ],
        footerNote: org.pdfFooter || "Utility Mapping · u-map.co.uk · Part of IS GROUP",
      })
    : `<div class="gpr-cover">
      <div class="gpr-cover-top">
        <div>
          ${brandMode !== "client" && (umLogo || org.logo) ? `<img src="${esc(umLogo || org.logo)}" alt="" style="max-height:48px;margin-bottom:8px"/>` : ""}
          ${brandMode !== "own" && clientLogo ? `<img src="${esc(clientLogo)}" alt="${esc(clientName || "Client")}" style="max-height:48px;margin:0 8px 8px 0"/>` : ""}
          <div style="font-weight:600">${esc(brandMode === "client" ? (clientName || "Client") : org.name)}</div>
        </div>
        <div>${renderMySafeOpsMarkSvg(24)}</div>
      </div>
      <span class="gpr-badge">${r.status === "final" ? "Final GPR report" : "Draft GPR report"}</span>
      <span class="gpr-badge">Completeness ${quality.score}%</span>
      ${documentStatusHtml}
      <h1 class="gpr-cover-title">${esc(r.title || "Ground Penetrating Radar Report")}</h1>
      ${sitePhoto ? `<img src="${esc(sitePhoto)}" alt="Site photograph" style="display:block;max-height:42mm;max-width:78mm;object-fit:contain;margin:8px 0"/>` : ""}
      ${coverWaveSvg(primary, accent)}
      ${coverStatsRow(r)}
      ${metaGrid([
        ["Report ref", r.ref],
        ["Survey date", surveyDateLabel],
        ["Site", [r.siteAddress, r.postcode].filter(Boolean).join(", ") || r.projectName],
        ["Surveyor", r.surveyor || "Not recorded"],
        ["OSGB", r.gridRef || (r.osgbEasting ? `${r.osgbEasting} E, ${r.osgbNorthing} N` : "")],
        ["What3Words", r.what3words],
        ["Scan mode", scanLabel],
        ["Primary antenna", r.equipment?.[0]?.antennaFrequencyMhz ? `${r.equipment[0].antennaFrequencyMhz} MHz` : "—"],
      ])}
      ${mapUrl ? `<img class="gpr-map" src="${esc(mapUrl)}" alt="Site location"/>` : ""}
    </div>`;

  pushSection("Foreword", nl2p(r.sections.foreword), "foreword");
  pushSection("Executive summary", nl2p(r.sections.executiveSummary), "exec");
  pushSection("Scope", nl2p(r.sections.scope), "scope");
  const preSurveyHtml = buildGprPreSurveyPrintHtml(r.preSurvey);
  if (preSurveyHtml) {
    pushSection("Pre-survey start checks", preSurveyHtml, "presurvey");
  }
  pushSection("Methodology", nl2p(r.sections.methodology), "method");
  pushSection("Equipment", equipmentBlock(r.equipment), "equip");
  pushSection(
    "Acquisition parameters",
    acquisitionParametersBlock(r, scanLabel),
    "acq"
  );
  pushSection("Velocity model & calibration", `<p>${esc(buildVelocityNarrative(r.velocityModel))}</p>`, "vel");
  pushSection("Ground conditions & geology", groundConditionsBlock(r.groundConditions), "ground");
  pushSection("Historic evidence & previous land use", historicalEvidenceBlock(r), "history");
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
    "CAD model-space verification",
    gprCadVerificationBlock(r.gprCadImport) ||
      "<p><em>No CAD DXF imported — upload a model-space drawing on Findings to count GPR layers and UMG→B1 upgrades.</em></p>",
    "cad-verify"
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
  const umDocControl = umTheme
    ? renderUtilityMappingDocControlPage({
        client: r.client || r.projectName || "",
        title: r.title || "GPR report",
        reportRef: r.ref || "",
        logoSrc: headerLogo,
        authors: [
          {
            name: r.surveyor || r.signOff?.preparedBy || "—",
            title: "GPR Surveyor",
            date: r.surveyDate ? formatOrgDate(r.surveyDate) : "",
          },
        ],
        checkedBy: {
          name: r.signOff?.checkedBy || "—",
          title: "Technical Manager",
          date: r.surveyDate ? formatOrgDate(r.surveyDate) : "",
        },
      })
    : "";
  const runningHeader = umTheme
    ? renderUtilityMappingPageHeader(headerLogo, r.ref || "", headerOpts)
    : `<div class="gpr-running-header"><span>${esc(r.ref || "")}</span><span>${esc(r.title || "GPR Report")}</span></div>`;
  const umFooter = umTheme ? renderUtilityMappingPageFooter(brandMode === "client" ? clientLogo || umLogo : umLogo) : "";

  const body = [
    coverHtml,
    umDocControl,
    umTheme && tocHtml
      ? `<div class="um-toc-page">${renderUtilityMappingPageHeader(headerLogo, r.ref || "", headerOpts)}${renderUtilityMappingComplianceRibbon()}${tocHtml}</div>`
      : tocHtml,
    runningHeader,
    umTheme ? renderUtilityMappingComplianceRibbon() : "",
    ...sections,
    `<div class="gpr-footer-note">
      GPR interpretations are geophysical indications only. BGS geology via DigMap 50k (fallback 625k) and borehole index — desk study only, not SI.
      ${r.smartFillAt ? `Smart fill: ${formatOrgDateTime(r.smartFillAt)}.` : ""}
      Generated by MySafeOps.
    </div>`,
    umFooter,
  ].join("");

  // Draft/final watermark and running footer — same visual signalling as permits/RAMS,
  // so a GPR export can't be mistaken for a final report while still in draft.
  const watermarkText = r.status === "final" ? "FINAL" : (String(org.pdfWatermarkText || "").trim() || "DRAFT");
  const footerRef = esc(`${r.ref || "GPR report"}${r.revision ? ` · ${r.revision}` : ""} · ${finalIssue ? "FINAL" : "DRAFT"}`);
  const complianceLine = String(org.pdfComplianceLine || "").trim();

  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><title>${esc(r.ref || "GPR Report")}</title>${styles(primary, accent, accentInk, accentSoft, primarySoft)}</head><body>
    <div class="gpr-watermark">${esc(watermarkText)}</div>
    <div class="gpr-doc gpr-doc-body">${body}</div>
    <div class="gpr-print-footer">
      <span>${esc(org.pdfFooter || "Generated by MySafeOps")} · mysafeops.com${complianceLine ? ` · ${esc(complianceLine)}` : ""}</span>
      <span>${footerRef}</span>
    </div>
  </body></html>`;
}
