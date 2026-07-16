/**
 * Client handover ZIP — PDF, HTML, CSV schedules, README manifest.
 */
import { buildZipStore } from "../../utils/geoPhotoExport";
import { exportGeoPhotosGeoJson, projectGeoPhotosForReport } from "../../utils/geoPhotoIntegrations";
import { filterGeoPhotosWithCoords } from "../../utils/geoPhotoExport";
import { sanitizePdfFileSegment } from "../../utils/pdfFileName";
import { sanitizePrintPreviewHtml } from "../../utils/htmlEscape.js";
import { downloadBlob } from "../../utils/downloadBlob.js";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml";
import { generateSurveyReportPdfBlob } from "./surveyReportPdf";
import { normalizeSurveyReport, utilityTypeLabel, utilityConfidenceLabel } from "./surveyReportHelpers";
import { pas128MethodLabel } from "./pas128MethodPresets";
import { UNDERTAKER_RESPONSE_STATUS } from "./surveyReportConstants";
import { isUtilityMappingOrg } from "../../utils/utilityMappingOrg";
import { utilityMappingExportBaseName } from "../../utils/utilityMappingDocRefs";

function csvCell(value) {
  const s = String(value ?? "").replace(/"/g, '""');
  return /[",\n\r]/.test(s) ? `"${s}"` : s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

export function handoverPackBaseName(report) {
  const um = isUtilityMappingOrg() ? utilityMappingExportBaseName(report, "Handover") : "";
  if (um) return sanitizePdfFileSegment(um, 48);
  return sanitizePdfFileSegment(report?.ref || report?.id || "survey_report", 40);
}

function undertakerStatusLabel(key) {
  return UNDERTAKER_RESPONSE_STATUS.find((o) => o.key === key)?.label || key || "";
}

/** CSV export of the utility schedule table. */
export function buildUtilitiesScheduleCsv(report) {
  const rows = report?.utilitiesTable || [];
  const header = csvRow([
    "Utility",
    "Depth",
    "Method",
    "PAS128_QL",
    "Confidence",
    "Notes",
  ]);
  if (!rows.length) return `${header}\n`;

  const body = rows.map((r) =>
    csvRow([
      utilityTypeLabel(r.utilityType) || r.label || r.utilityType || "",
      r.depth || "",
      r.method || "",
      r.pas128Ql || "",
      utilityConfidenceLabel(r.confidence) || r.confidence || "",
      r.notes || "",
    ])
  );
  return [header, ...body].join("\n");
}

/** CSV export of M1 undertaker response log. */
export function buildUndertakerResponsesCsv(report) {
  const rows = report?.undertakerResponses || [];
  const header = csvRow(["Undertaker", "Category", "Status", "ResponseDate", "Notes"]);
  if (!rows.length) return "";

  const body = rows.map((r) =>
    csvRow([
      r.undertaker || "",
      r.category || "",
      undertakerStatusLabel(r.status),
      r.responseDate || "",
      r.notes || "",
    ])
  );
  return [header, ...body].join("\n");
}

/** Plain-text README for the handover folder. */
export function buildHandoverReadme(report, opts = {}) {
  const r = normalizeSurveyReport(report);
  const issued = r.issueDate || r.documentControl?.issueDate || new Date().toISOString().slice(0, 10);
  const method = r.pas128Method ? pas128MethodLabel(r.pas128Method) : "Not specified";
  const ql = r.pas128Ql || "—";
  const utilCount = (r.utilitiesTable || []).length;
  const undertakerCount = (r.undertakerResponses || []).length;
  const deliverables = (r.deliverables || []).filter(Boolean);
  const geoIncluded = Boolean(opts.geoPhotoCount);

  const lines = [
    "SURVEY REPORT — CLIENT HANDOVER PACK",
    "====================================",
    "",
    `Reference:     ${r.ref || r.id || "—"}`,
    `Title:         ${r.title || "—"}`,
    `Issue date:    ${issued}`,
    `PAS 128 QL:    ${ql}`,
    `PAS 128 method:${method}`,
    `Status:        ${r.status || "draft"}`,
  ];

  if (isUtilityMappingOrg()) {
    const emailSubject = utilityMappingExportBaseName(r, "PAS128") || r.ref || "PAS128 Survey Report";
    lines.push(
      "",
      "EMAIL (suggested)",
      "-----------------",
      `Subject: ${emailSubject} — ${r.client || "Client"}`,
      `Body:    Please find attached the PAS 128 utility survey package for ${r.siteAddress || r.projectName || "the site"}.`,
      `         Ref ${r.ref || "—"}. Controlled document — ensure latest revision is in use.`
    );
  }

  lines.push(
    "",
    "CONTENTS",
    "--------",
    "  report/report.pdf       — printable survey report (A4)",
    "  report/report.html      — offline HTML copy",
    "  data/utilities-schedule.csv",
  );

  if (undertakerCount) lines.push("  data/undertaker-responses.csv");
  if (geoIncluded) lines.push("  data/geo-photos.geojson   — geo-tagged field photos");
  lines.push("  manifest.txt            — deliverables checklist");

  lines.push(
    "",
    "SUMMARY",
    "-------",
    `Utilities in schedule: ${utilCount}`,
  );
  if (undertakerCount) lines.push(`Undertaker responses:  ${undertakerCount}`);
  if (geoIncluded) lines.push(`Geo-tagged photos:     ${opts.geoPhotoCount}`);

  if (deliverables.length) {
    lines.push("", "DELIVERABLES (from report)", "-------------------------");
    deliverables.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`));
  }

  lines.push(
    "",
    "NOTES",
    "-----",
    "This pack is generated from MySafeOps survey report data.",
    "Verify coordinates and utility positions on site before breaking ground.",
    "Desktop records and detection surveys have limitations — see report limitations section.",
    "",
    `Generated: ${new Date().toISOString()}`,
  );

  return lines.join("\r\n");
}

function buildDeliverablesManifest(report) {
  const r = normalizeSurveyReport(report);
  const deliverables = (r.deliverables || []).filter(Boolean);
  const lines = [
    "DELIVERABLES MANIFEST",
    "=====================",
    "",
    `Report: ${r.ref || r.id || "—"}`,
    "",
  ];
  if (!deliverables.length) {
    lines.push("(No deliverables listed in report — add via editor Deliverables section.)");
  } else {
    deliverables.forEach((d, i) => lines.push(`[${i + 1}] ${d}`));
  }
  return lines.join("\r\n");
}

function triggerDownload(blob, fileName) {
  if (!downloadBlob(blob, fileName)) {
    throw new Error("Browser blocked the download — allow downloads for this site and try again.");
  }
}

function encodeText(text) {
  return new TextEncoder().encode(text);
}

/**
 * Build handover ZIP bytes (browser-only — PDF render uses DOM).
 * @returns {Promise<{ zip: Uint8Array, fileName: string, files: string[] }>}
 */
export async function buildSurveyHandoverZip(report, extras = {}, geoPhotos = [], opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const r = normalizeSurveyReport(report);
  const base = handoverPackBaseName(r);
  const files = [];

  onProgress("HTML");
  const html = sanitizePrintPreviewHtml(buildSurveyReportHtml(r, extras));
  files.push({ name: "report/report.html", data: encodeText(html) });

  onProgress("CSV");
  files.push({ name: "data/utilities-schedule.csv", data: encodeText(buildUtilitiesScheduleCsv(r)) });

  const undertakerCsv = buildUndertakerResponsesCsv(r);
  if (undertakerCsv) {
    files.push({ name: "data/undertaker-responses.csv", data: encodeText(undertakerCsv) });
  }

  let geoPhotoCount = 0;
  if (opts.includeGeoJson !== false && r.projectId) {
    try {
      const photos = projectGeoPhotosForReport(geoPhotos, r.projectId);
      const { withCoords } = filterGeoPhotosWithCoords(photos);
      if (withCoords.length) {
        onProgress("GeoJSON");
        const geo = exportGeoPhotosGeoJson(withCoords, r.ref || r.title || "survey-report");
        files.push({
          name: "data/geo-photos.geojson",
          data: encodeText(JSON.stringify(geo, null, 2)),
        });
        geoPhotoCount = withCoords.length;
      }
    } catch {
      /* optional */
    }
  }

  files.push({ name: "manifest.txt", data: encodeText(buildDeliverablesManifest(r)) });

  onProgress("PDF");
  const { blob: pdfBlob, fileName: pdfName, pages: pdfPages } = await generateSurveyReportPdfBlob(r, extras, {
    onProgress: (p) => onProgress(`PDF: ${p}`),
  });
  const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
  files.push({ name: `report/${pdfName.replace(/^.*[\\/]/, "")}`, data: pdfBytes });

  onProgress("README");
  files.push({
    name: "README-HANDOVER.txt",
    data: encodeText(buildHandoverReadme(r, { geoPhotoCount })),
  });

  onProgress("ZIP");
  const zip = buildZipStore(files);
  return {
    zip,
    fileName: `${base}-handover-pack.zip`,
    files: files.map((f) => f.name),
    pdfPages,
  };
}

/** Download single client handover ZIP. */
export async function downloadSurveyHandoverZip(report, extras = {}, geoPhotos = [], opts = {}) {
  const { zip, fileName } = await buildSurveyHandoverZip(report, extras, geoPhotos, opts);
  triggerDownload(new Blob([zip], { type: "application/zip" }), fileName);
  return { ok: true, fileName };
}
