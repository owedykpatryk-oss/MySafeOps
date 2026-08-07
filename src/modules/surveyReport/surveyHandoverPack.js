/**
 * Client handover ZIP — PDF, HTML, CSV schedules, CAD sidecar, verify sheet, README.
 */
import { buildZipStore } from "../../utils/geoPhotoExport";
import { exportGeoPhotosGeoJson, projectGeoPhotosForReport } from "../../utils/geoPhotoIntegrations";
import { filterGeoPhotosWithCoords } from "../../utils/geoPhotoExport";
import { sanitizePdfFileSegment } from "../../utils/pdfFileName";
import { sanitizePrintPreviewHtml, escapeHtml, escapeAttr } from "../../utils/htmlEscape.js";
import { downloadBlob } from "../../utils/downloadBlob.js";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml";
import { generateSurveyReportPdfBlob, generateHtmlDocumentPdfBlob } from "./surveyReportPdf";
import { normalizeSurveyReport, utilityTypeLabel, utilityConfidenceLabel } from "./surveyReportHelpers";
import { pas128MethodLabel } from "./pas128MethodPresets";
import { UNDERTAKER_RESPONSE_STATUS } from "./surveyReportConstants";
import { isUtilityMappingOrg } from "../../utils/utilityMappingOrg";
import { utilityMappingExportBaseName } from "../../utils/utilityMappingDocRefs";
import { buildCadPreviewSvg } from "../../utils/cadPreviewSvg.js";
import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { getActiveDocumentLocale } from "../../utils/countryWorkspaces";
import {
  buildUtilityMappingClientPackHtml,
  buildUtilityMappingQrSrc,
} from "../../utils/utilityMappingClientPack";
import { buildA3BoardPackHtml } from "./surveyEvidencePack";
import { buildHandoverChecklistHtml } from "./surveyFieldUpgrades";
import { computeUtilityMappingDigRisk } from "../../utils/utilityMappingPremiumPages";
import { UTILITY_MAPPING_BRAND } from "../../utils/utilityMappingBranding";

import { todayLocalISO } from "../../utils/localDate";
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

function shareUrlForReport(report, org) {
  const ref = report?.ref;
  if (!ref) return "";
  const base = String(org?.website || (isUtilityMappingOrg() ? "https://u-map.co.uk/" : "")).replace(/\/$/, "");
  if (!base) return "";
  return `${base}?ref=${encodeURIComponent(ref)}`;
}

/** Extract inner <svg>...</svg> from cad preview figure HTML. */
export function extractCadPreviewSvgMarkup(preview) {
  const html = buildCadPreviewSvg(preview, { width: 800, height: 480 });
  if (!html) return "";
  const match = html.match(/<svg[\s\S]*?<\/svg>/i);
  return match ? match[0] : "";
}

/** CSV export of the utility schedule table. */
export function buildUtilitiesScheduleCsv(report) {
  const rows = report?.utilitiesTable || [];
  const header = csvRow(["Utility", "Depth", "Method", "PAS128_QL", "Confidence", "Notes"]);
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

/** CAD length summary CSV (from DXF import) — sidecar until binary DWG is attached. */
export function buildCadLengthsCsv(report) {
  const rows = report?.cadImport?.summary || [];
  if (!rows.length) return "";
  const header = csvRow(["Utility", "Length_m", "QL", "RecordsDerived", "Layer"]);
  const body = rows.map((r) =>
    csvRow([
      r.label || r.utilityKey || "",
      r.lengthM ?? r.length ?? "",
      r.pas128Ql || r.ql || "",
      (r.recordsDerived || r.isRecordsDerived) ? "yes" : "no",
      r.layer || "",
    ])
  );
  return [header, ...body].join("\n");
}

/** Compact CAD sidecar JSON for GIS / CAD teams (not a binary DWG). */
export function buildCadSidecarJson(report) {
  const cad = report?.cadImport;
  if (!cad?.summary?.length && !cad?.preview?.paths?.length) return "";
  return JSON.stringify(
    {
      schema: "mysafeops.cad-sidecar.v1",
      note: "Derived from DXF import — attach issued DWG separately if required by client brief.",
      fileName: cad.fileName || "",
      importedAt: cad.importedAt || "",
      units: cad.units || "",
      totals: cad.totals || null,
      recordsDerivedM: cad.recordsDerivedM ?? null,
      summary: cad.summary || [],
      unmatchedLayers: cad.unmatchedLayers || [],
      bounds: cad.preview?.bounds || null,
      pathCount: cad.preview?.paths?.length || 0,
    },
    null,
    2
  );
}

export function buildDrawingRegisterCsv(report) {
  const rows = report?.drawingSheets || [];
  if (!rows.length) return "";
  const header = csvRow(["Sheet", "Title", "Revision", "Status", "Notes"]);
  const body = rows.map((r) =>
    csvRow([r.sheetNo || r.number || "", r.title || "", r.revision || "", r.status || "", r.notes || ""])
  );
  return [header, ...body].join("\n");
}

export function buildGprAnomalyCardsCsv(report) {
  const rows = report?.gprAnomalyCards || [];
  if (!rows.length) return "";
  const header = csvRow(["Ref", "Class", "DepthMin_m", "DepthMax_m", "Interpretation"]);
  const body = rows.map((r) =>
    csvRow([r.ref || "", r.classKey || "", r.depthMinM || "", r.depthMaxM || "", r.interpretation || ""])
  );
  return [header, ...body].join("\n");
}

/**
 * Offline verification / control sheet — QR + dig-risk + issue metadata.
 * @param {object} report
 * @param {{ shareUrl?: string, orgName?: string, digRisk?: object }} [opts]
 */
export function buildVerificationSheetHtml(report = {}, opts = {}) {
  const r = normalizeSurveyReport(report);
  const dig = opts.digRisk || (isUtilityMappingOrg() ? computeUtilityMappingDigRisk(r) : {});
  const shareUrl = String(opts.shareUrl || "").trim();
  const qr = shareUrl
    ? `<img class="v-qr" src="${escapeAttr(buildUtilityMappingQrSrc(shareUrl, 160))}" alt="Verification QR"/>`
    : "";
  const band = dig.band || "medium";
  const digLabel = dig.label || "Review dig readiness on site";
  const digScore = dig.score != null ? dig.score : "—";
  const orgName = opts.orgName || (isUtilityMappingOrg() ? UTILITY_MAPPING_BRAND.name : "MySafeOps");

  return `<!DOCTYPE html>
<html lang="${getActiveDocumentLocale()}"><head><meta charset="utf-8"/>
<title>Verify ${escapeHtml(r.ref || "survey")}</title>
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 24px; color: #0f172a; max-width: 720px; }
  .hero { background: #0B1D3A; color: #fff; border-radius: 12px; padding: 18px 20px; display: flex; gap: 16px; align-items: center; justify-content: space-between; }
  .hero h1 { margin: 0 0 6px; font-size: 16pt; }
  .meta { opacity: 0.85; font-size: 10pt; }
  .v-qr { width: 120px; height: 120px; background: #fff; border-radius: 8px; padding: 6px; }
  .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px 16px; margin-top: 14px; background: #f8fafc; }
  .dig { display: inline-block; font-weight: 800; padding: 8px 12px; border-radius: 8px; }
  .dig-low { background: #bbf7d0; color: #14532d; }
  .dig-medium { background: #fde68a; color: #78350f; }
  .dig-high { background: #fecaca; color: #7f1d1d; }
  .foot { margin-top: 18px; font-size: 9pt; color: #64748b; }
</style></head><body>
  <div class="hero">
    <div>
      <h1>Document verification</h1>
      <div class="meta">${escapeHtml(r.ref || "—")} · ${escapeHtml(r.status || "draft")}</div>
      <div class="meta">${escapeHtml(r.title || "PAS128 Utility Survey")}</div>
      <div class="meta">${escapeHtml(r.client || "—")} · ${escapeHtml(r.siteAddress || r.projectName || "—")}</div>
    </div>
    ${qr}
  </div>
  <div class="card">
    <strong>Dig readiness</strong>
    <div style="margin-top:8px"><span class="dig dig-${escapeHtml(band)}">${escapeHtml(digLabel)} (${escapeHtml(String(digScore))})</span></div>
    <p style="font-size:10pt;margin:10px 0 0">Treat TFR alignments as live until proven otherwise. Follow HSG47 / permit to dig.</p>
  </div>
  <div class="card">
    <strong>Issue control</strong>
    <p style="font-size:10pt;margin:8px 0 0">
      Method: ${escapeHtml(r.pas128Method ? pas128MethodLabel(r.pas128Method) : "—")}<br/>
      PAS128 QL: ${escapeHtml(r.pas128Ql || "—")}<br/>
      Survey date: ${escapeHtml(r.surveyDate || "—")}<br/>
      Prepared: ${escapeHtml(r.documentControl?.preparedBy || r.surveyor || "—")}
    </p>
  </div>
  <p class="foot">${escapeHtml(orgName)} · Controlled verification sheet · Scan QR for live pack when online · ${escapeHtml(r.ref || "")}</p>
</body></html>`;
}

/** Plain-text README for the handover folder. */
export function buildHandoverReadme(report, opts = {}) {
  const r = normalizeSurveyReport(report);
  const issued = r.issueDate || r.documentControl?.issueDate || todayLocalISO();
  const method = r.pas128Method ? pas128MethodLabel(r.pas128Method) : "Not specified";
  const ql = r.pas128Ql || "—";
  const utilCount = (r.utilitiesTable || []).length;
  const undertakerCount = (r.undertakerResponses || []).length;
  const deliverables = (r.deliverables || []).filter(Boolean);
  const geoIncluded = Boolean(opts.geoPhotoCount);
  const extraFiles = opts.extraFiles || [];

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
    "  verify/control-sheet.html — QR verification / dig-risk sheet",
    "  data/utilities-schedule.csv",
  );

  if (undertakerCount) lines.push("  data/undertaker-responses.csv");
  if (geoIncluded) lines.push("  data/geo-photos.geojson   — geo-tagged field photos");
  extraFiles.forEach((f) => lines.push(`  ${f}`));
  lines.push("  manifest.txt            — deliverables checklist");

  lines.push("", "SUMMARY", "-------", `Utilities in schedule: ${utilCount}`);
  if (undertakerCount) lines.push(`Undertaker responses:  ${undertakerCount}`);
  if (geoIncluded) lines.push(`Geo-tagged photos:     ${opts.geoPhotoCount}`);

  if (deliverables.length) {
    lines.push("", "DELIVERABLES (from report)", "-------------------------");
    deliverables.forEach((d, i) => {
      const label = typeof d === "string" ? d : d.description || d.format || JSON.stringify(d);
      lines.push(`  ${i + 1}. ${label}`);
    });
  }

  lines.push(
    "",
    "NOTES",
    "-----",
    "This pack is generated from MySafeOps survey report data.",
    "CAD sidecar (if present) is derived from DXF import — attach issued DWG separately if the client brief requires native CAD.",
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
  const lines = ["DELIVERABLES MANIFEST", "=====================", "", `Report: ${r.ref || r.id || "—"}`, ""];
  if (!deliverables.length) {
    lines.push("(No deliverables listed in report — add via editor Deliverables section.)");
  } else {
    deliverables.forEach((d, i) => {
      const label = typeof d === "string" ? d : d.description || d.format || JSON.stringify(d);
      lines.push(`[${i + 1}] ${label}`);
    });
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
  const extraReadmeFiles = [];
  const org = extras.org || (typeof getOrgSettings === "function" ? getOrgSettings() : {}) || {};
  const shareUrl = extras.shareUrl || shareUrlForReport(r, org);

  onProgress("HTML");
  const html = sanitizePrintPreviewHtml(buildSurveyReportHtml(r, extras));
  files.push({ name: "report/report.html", data: encodeText(html) });

  onProgress("Verify sheet");
  const digRisk = isUtilityMappingOrg() ? computeUtilityMappingDigRisk(r) : {};
  files.push({
    name: "verify/control-sheet.html",
    data: encodeText(
      buildVerificationSheetHtml(r, {
        shareUrl,
        orgName: org.name || (isUtilityMappingOrg() ? UTILITY_MAPPING_BRAND.name : "MySafeOps"),
        digRisk,
      })
    ),
  });
  extraReadmeFiles.push("verify/control-sheet.html");

  onProgress("CSV");
  files.push({ name: "data/utilities-schedule.csv", data: encodeText(buildUtilitiesScheduleCsv(r)) });

  const undertakerCsv = buildUndertakerResponsesCsv(r);
  if (undertakerCsv) {
    files.push({ name: "data/undertaker-responses.csv", data: encodeText(undertakerCsv) });
  }

  const cadCsv = buildCadLengthsCsv(r);
  if (cadCsv) {
    files.push({ name: "cad/cad-lengths.csv", data: encodeText(cadCsv) });
    extraReadmeFiles.push("cad/cad-lengths.csv");
  }
  const cadJson = buildCadSidecarJson(r);
  if (cadJson) {
    files.push({ name: "cad/cad-sidecar.json", data: encodeText(cadJson) });
    extraReadmeFiles.push("cad/cad-sidecar.json");
  }
  const cadSvg = r.cadImport?.preview ? extractCadPreviewSvgMarkup(r.cadImport.preview) : "";
  if (cadSvg) {
    files.push({
      name: "cad/cad-preview.svg",
      data: encodeText(`<?xml version="1.0" encoding="UTF-8"?>\n${cadSvg}`),
    });
    extraReadmeFiles.push("cad/cad-preview.svg");
  }

  const drawingsCsv = buildDrawingRegisterCsv(r);
  if (drawingsCsv) {
    files.push({ name: "data/drawing-register.csv", data: encodeText(drawingsCsv) });
    extraReadmeFiles.push("data/drawing-register.csv");
  }
  const gprCsv = buildGprAnomalyCardsCsv(r);
  if (gprCsv) {
    files.push({ name: "data/gpr-anomaly-cards.csv", data: encodeText(gprCsv) });
    extraReadmeFiles.push("data/gpr-anomaly-cards.csv");
  }

  if (isUtilityMappingOrg()) {
    onProgress("Client packs");
    const clientHtml = buildUtilityMappingClientPackHtml(r, { org, shareUrl });
    if (clientHtml) {
      files.push({ name: "client/client-pack.html", data: encodeText(clientHtml) });
      extraReadmeFiles.push("client/client-pack.html");
      try {
        onProgress("Client pack PDF");
        const { blob: clientPdf } = await generateHtmlDocumentPdfBlob(clientHtml, {
          fileName: "client-pack.pdf",
          title: r.title || r.ref || "Client pack",
        });
        files.push({ name: "client/client-pack.pdf", data: new Uint8Array(await clientPdf.arrayBuffer()) });
        extraReadmeFiles.push("client/client-pack.pdf");
      } catch {
        /* PDF optional if capture fails */
      }
    }
    const a3 = buildA3BoardPackHtml(r, {
      digRisk: digRisk?.label ? digRisk : { band: "medium", label: "Review dig readiness", score: digRisk?.score ?? "—" },
      orgName: org.name || UTILITY_MAPPING_BRAND.name,
    });
    if (a3) {
      files.push({ name: "client/a3-board.html", data: encodeText(a3) });
      extraReadmeFiles.push("client/a3-board.html");
    }
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

  const checklistNames = files.map((f) => f.name);
  files.push({
    name: "CHECKLIST.html",
    data: encodeText(buildHandoverChecklistHtml(checklistNames, r)),
  });
  extraReadmeFiles.push("CHECKLIST.html");

  onProgress("README");
  files.push({
    name: "README-HANDOVER.txt",
    data: encodeText(buildHandoverReadme(r, { geoPhotoCount, extraFiles: extraReadmeFiles })),
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
