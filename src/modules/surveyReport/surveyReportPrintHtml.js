import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { openPrintWindow } from "../../utils/htmlEscape.js";
import {
  buildAccessLimitationsText,
  buildLimitationsFromKeys,
  buildUtilityRecordsNarrative,
  buildWeatherNarrative,
  surveyTypeLabel,
} from "./surveyReportHelpers";
import {
  PAS128_QUALITY_LEVELS,
} from "./surveyReportConstants";

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

function section(title, body, id) {
  return `<section class="sr-section" id="${id || ""}"><h2>${esc(title)}</h2>${body}</section>`;
}

function pas128Label(key) {
  return PAS128_QUALITY_LEVELS.find((q) => q.key === key)?.label || key;
}

function photoGrid(photos) {
  if (!photos?.length) return "";
  const cells = photos
    .map((p) => {
      const meta = [];
      if (p.geoPhotoId) meta.push("Geo-photo");
      if (p.latitude != null && p.longitude != null) {
        meta.push(`${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`);
      }
      if (p.bearing != null && !Number.isNaN(Number(p.bearing))) meta.push(`${Math.round(Number(p.bearing))}°`);
      const cap = [p.caption || "Site photo", meta.length ? `(${meta.join(" · ")})` : ""].filter(Boolean).join(" ");
      return `<figure class="sr-photo"><img src="${p.dataUrl || p.url || ""}" alt=""/><figcaption>${esc(cap)}</figcaption></figure>`;
    })
    .join("");
  return section("Photo appendix", `<div class="sr-photo-grid">${cells}</div>`, "photos");
}

/**
 * Build full A4 print HTML for a survey report.
 * @param {object} report
 * @param {{ ramsTitle?: string }} [extras]
 */
export function buildSurveyReportHtml(report, extras = {}) {
  const org = getOrgSettings();
  const primary = org.primaryColor || "#0d9488";
  const accent = org.accentColor || "#0f766e";
  const now = new Date();

  const limitations =
    report.limitationsText?.trim() ||
    buildLimitationsFromKeys(report.limitationKeys);
  const weatherText = buildWeatherNarrative(report.weather);
  const recordsText = buildUtilityRecordsNarrative(report.utilityRecords);
  const accessText = buildAccessLimitationsText(
    report.accessLimitations,
    report.accessLimitationsNotes
  );

  const sitePlanBlock = report.sitePlanSummary?.trim()
    ? section("Site plan reference", nl2p(report.sitePlanSummary), "site-plan")
    : "";

  const sitePlanImages = (report.sitePlanSnapshots || []).length
    ? section(
        "Site plan markup",
        `<div class="sr-plan-grid">${(report.sitePlanSnapshots || [])
          .map(
            (s) =>
              `<figure class="sr-plan-figure"><img src="${s.dataUrl || ""}" alt="${esc(s.name || "Site plan")}"/><figcaption>${esc(s.name || "Site plan")}</figcaption></figure>`
          )
          .join("")}</div>`,
        "site-plan-images"
      )
    : "";

  const metaRows = [
    ["Report ref", report.ref || "—"],
    ["Survey date", report.surveyDate ? new Date(report.surveyDate).toLocaleDateString("en-GB") : "—"],
    ["Client", report.client || "—"],
    ["Project", report.projectName || "—"],
    ["Site", report.siteAddress || "—"],
    ["Survey type", surveyTypeLabel(report.surveyType) || "—"],
    ["PAS128 QL", report.pas128Ql ? pas128Label(report.pas128Ql) : "—"],
    ["Surveyor / author", report.surveyor || "—"],
    ["Status", report.status === "final" ? "Final" : "Draft"],
  ];
  if (extras.ramsTitle) metaRows.push(["Linked RAMS", extras.ramsTitle]);

  const metaTable = `<table class="sr-meta">${metaRows
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("")}</table>`;

  const body = [
    section("Report information", metaTable, "info"),
    report.sections?.executiveSummary?.trim()
      ? section("Executive summary", nl2p(report.sections.executiveSummary), "exec")
      : "",
    section("Scope of works", nl2p(report.sections?.scope), "scope"),
    section("Methodology", nl2p(report.sections?.methodology), "method"),
    report.sections?.equipmentUsed?.trim()
      ? section("Equipment used", nl2p(report.sections.equipmentUsed), "equipment")
      : "",
    report.sections?.surveyExtent?.trim()
      ? section("Survey extent", nl2p(report.sections.surveyExtent), "extent")
      : "",
    weatherText
      ? section("Weather at site", nl2p(weatherText), "weather")
      : "",
    recordsText
      ? section("Utility records & drawings review", nl2p(recordsText), "records")
      : "",
    section("Findings & results", nl2p(report.sections?.findings), "findings"),
    sitePlanBlock,
    sitePlanImages,
    limitations
      ? section("Limitations", nl2p(limitations), "limitations")
      : "",
    accessText
      ? section("Site access limitations", nl2p(accessText), "access")
      : "",
    report.sections?.recommendations?.trim()
      ? section("Recommendations", nl2p(report.sections.recommendations), "recommendations")
      : "",
    photoGrid(report.photos),
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>${esc(report.title || report.ref || "Survey Report")}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 22mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #111827;
    margin: 0;
    padding: 0 0 24px;
  }
  .sr-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 3px solid ${primary};
    padding-bottom: 12px;
    margin-bottom: 18px;
    flex-wrap: wrap;
  }
  .sr-header img { max-height: 52px; max-width: 140px; object-fit: contain; }
  .sr-org { font-size: 10pt; color: #4b5563; margin-top: 4px; }
  .sr-title-block h1 {
    margin: 0 0 4px;
    font-size: 20pt;
    color: ${accent};
    line-height: 1.2;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .sr-title-block .sr-sub { font-size: 10pt; color: #6b7280; }
  .sr-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: ${report.status === "final" ? primary : "#f59e0b"};
    color: #fff;
  }
  .sr-section { margin-bottom: 18px; page-break-inside: avoid; }
  .sr-section h2 {
    font-size: 12pt;
    color: ${primary};
    border-left: 4px solid ${primary};
    padding-left: 10px;
    margin: 0 0 8px;
  }
  .sr-section p { margin: 0 0 8px; }
  .sr-meta { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .sr-meta th, .sr-meta td {
    border: 1px solid #d1d5db;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  .sr-meta th { width: 34%; background: #f3f4f6; font-weight: 600; }
  .sr-photo-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .sr-photo { margin: 0; page-break-inside: avoid; }
  .sr-photo img {
    width: 100%;
    max-height: 180px;
    object-fit: cover;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }
  .sr-photo figcaption { font-size: 9pt; color: #6b7280; margin-top: 4px; }
  .sr-plan-grid { display: flex; flex-direction: column; gap: 14px; }
  .sr-plan-figure { margin: 0; page-break-inside: avoid; }
  .sr-plan-figure img {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #f8fafc;
  }
  .sr-plan-figure figcaption { font-size: 9pt; color: #6b7280; margin-top: 4px; }
  .sr-footer {
    margin-top: 24px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    font-size: 9pt;
    color: #9ca3af;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .sr-disclaimer {
    font-size: 9pt;
    color: #6b7280;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px 12px;
    margin-top: 20px;
  }
  @media print {
    body { padding: 0; }
    .sr-header, .sr-badge, .sr-section h2 { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <header class="sr-header">
    <div>
      ${org.logo ? `<img src="${org.logo}" alt=""/>` : ""}
      <div style="font-weight:700;font-size:13pt;margin-top:${org.logo ? "8px" : "0"}">${esc(org.name)}</div>
      ${org.pdfHeader ? `<div class="sr-org">${esc(org.pdfHeader)}</div>` : org.address ? `<div class="sr-org">${esc(org.address)}</div>` : ""}
    </div>
    <div class="sr-title-block" style="text-align:right">
      <span class="sr-badge">${report.status === "final" ? "Final report" : "Draft"}</span>
      <h1>${esc(report.title || "Survey Report")}</h1>
      <div class="sr-sub">Generated ${now.toLocaleString("en-GB")}</div>
    </div>
  </header>
  ${body}
  <div class="sr-disclaimer">
    This report is issued for the agreed survey scope only. Detected utilities and subsurface features are indicative unless verified by trial excavation or statutory undertaker confirmation. The client remains responsible for safe digging practices and permit-to-dig procedures on site.
  </div>
  <footer class="sr-footer">
    <span>${esc(org.pdfFooter || "Generated by MySafeOps")}</span>
    <span>${esc(report.ref || "")}</span>
  </footer>
</body>
</html>`;
}

export function openSurveyReportPrint(report, extras) {
  const html = buildSurveyReportHtml(report, extras);
  const win = openPrintWindow();
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  return true;
}

export function downloadSurveyReportHtml(report, extras) {
  const html = buildSurveyReportHtml(report, extras);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(report.ref || report.id || "survey_report").replace(/\s+/g, "_")}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}
