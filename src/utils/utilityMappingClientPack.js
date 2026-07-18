/**
 * Utility Mapping client pack — executive HTML for client share + mailto.
 * Org-exclusive.
 */
import { escapeHtml, escapeAttr } from "./htmlEscape.js";
import { isUtilityMappingPrintTheme, utilityMappingBodyPrintCss } from "./utilityMappingPrintTheme";
import { utilityMappingCoverSystemCss, renderUtilityMappingHeroCover, resolveUtilityMappingLogoSrc } from "./utilityMappingCovers.js";
import {
  renderUtilityMappingExecutivePage,
  renderUtilityMappingDigReadinessPage,
  renderUtilityMappingDeliverablesPage,
  renderUtilityMappingDrawingsPage,
  utilityMappingPremiumPagesCss,
} from "./utilityMappingPremiumPages.js";
import { utilityMappingClientLogoUrl, getUtilityMappingClient } from "./utilityMappingClients";
import { parseUtilityMappingRef, utilityMappingExportBaseName } from "./utilityMappingDocRefs";
import { UTILITY_MAPPING_BRAND } from "./utilityMappingBranding";
import { downloadBlob } from "./downloadBlob.js";
import { sanitizePdfFileSegment } from "./pdfFileName";
import { computeUtilityMappingDigRisk } from "./utilityMappingPremiumPages.js";

function buildQrSrc(text, size = 120) {
  const t = encodeURIComponent(String(text || "").slice(0, 800));
  return `https://quickchart.io/qr?size=${size}&text=${t}`;
}

/**
 * Suggested mailto for client issue.
 * @param {object} report
 * @param {{ to?: string }} [opts]
 */
export function buildUtilityMappingClientMailto(report, opts = {}) {
  if (!isUtilityMappingPrintTheme() || !report) return "";
  const subject = utilityMappingExportBaseName(report, "PAS128") || report.ref || "PAS128 Survey Report";
  const body = [
    `Please find the PAS 128 utility survey package for ${report.siteAddress || report.projectName || "the site"}.`,
    "",
    `Reference: ${report.ref || "—"}`,
    `Client: ${report.client || "—"}`,
    "",
    "Controlled document — ensure the latest approved revision is in use.",
    "",
    UTILITY_MAPPING_BRAND.pdfFooter || "Utility Mapping · u-map.co.uk",
  ].join("\n");
  const to = String(opts.to || "").trim();
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Lightweight client-facing HTML pack (no full technical body).
 * @param {object} report
 * @param {{ org?: object, shareUrl?: string }} [extras]
 */
export function buildUtilityMappingClientPackHtml(report, extras = {}) {
  if (!isUtilityMappingPrintTheme() || !report) return "";
  const org = extras.org || {};
  const logoSrc = resolveUtilityMappingLogoSrc(org);
  const clientCode = report.umClientCode || parseUtilityMappingRef(report.ref)?.clientCode || "";
  const clientLogoSrc = utilityMappingClientLogoUrl(clientCode);
  const primary = UTILITY_MAPPING_BRAND.primaryColor;
  const accent = UTILITY_MAPPING_BRAND.accentColor;
  const shareUrl = String(extras.shareUrl || "").trim();
  const qr = shareUrl
    ? `<div class="um-client-pack__qr"><img src="${escapeAttr(buildQrSrc(shareUrl, 140))}" alt="QR"/><div>Scan for live pack</div></div>`
    : "";

  const cover = renderUtilityMappingHeroCover({
    title: report.title || "PAS128 Utility Survey Report",
    subtitle: "Client issue pack",
    badge: report.status === "final" ? "Issued" : "Draft pack",
    methodBadge: report.pas128Method || "",
    kitChips: ["PAS 128:2014", "Client pack"],
    clientCode,
    clientName: report.client || getUtilityMappingClient(clientCode)?.name || "",
    clientLogoSrc,
    orgName: org.name || UTILITY_MAPPING_BRAND.name,
    logoSrc,
    meta: [
      ["Report ref", report.ref || "—"],
      ["Client", report.client || "—"],
      ["Site", report.siteAddress || report.projectName || "—"],
      ["Survey date", report.surveyDate ? new Date(report.surveyDate).toLocaleDateString("en-GB") : "—"],
    ],
    footerNote: "Client pack — executive brief, dig readiness and drawing register.",
  });

  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/>
<title>${escapeHtml(report.ref || "Client pack")}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 20mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 0 0 16mm; }
  .um-client-pack__qr { text-align: center; margin: 12px 0 20px; font-size: 8pt; color: #64748b; }
  .um-client-pack__qr img { width: 120px; height: 120px; }
  .sr-watermark {
    position: fixed; inset: 20% 10%; font-size: 42pt; font-weight: 800; color: rgba(11,29,58,0.06);
    transform: rotate(-28deg); pointer-events: none; z-index: 0; text-align: center;
  }
  ${utilityMappingCoverSystemCss()}
  ${utilityMappingBodyPrintCss(primary, accent)}
  ${utilityMappingPremiumPagesCss(primary, accent)}
</style></head><body>
  <div class="sr-watermark">CONTROLLED · ${escapeHtml(report.ref || "UM")}</div>
  ${cover}
  ${qr}
  ${renderUtilityMappingExecutivePage(report, { logoSrc })}
  ${renderUtilityMappingDigReadinessPage(report, { logoSrc })}
  ${renderUtilityMappingDeliverablesPage(report, { logoSrc })}
  ${renderUtilityMappingDrawingsPage(report, { logoSrc })}
</body></html>`;
}

/**
 * Download client pack HTML file.
 * @param {object} report
 * @param {{ org?: object, shareUrl?: string }} [extras]
 */
export function downloadUtilityMappingClientPack(report, extras = {}) {
  const html = buildUtilityMappingClientPackHtml(report, extras);
  if (!html) return false;
  const base = utilityMappingExportBaseName(report, "ClientPack") || report.ref || "UM-ClientPack";
  const name = `${sanitizePdfFileSegment(base, 48)}.html`;
  return downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), name);
}

/**
 * Download client pack as PDF (html2canvas).
 * @param {object} report
 * @param {{ org?: object, shareUrl?: string, onProgress?: Function }} [extras]
 */
export async function downloadUtilityMappingClientPackPdf(report, extras = {}) {
  const html = buildUtilityMappingClientPackHtml(report, extras);
  if (!html) return false;
  const base = utilityMappingExportBaseName(report, "ClientPack") || report.ref || "UM-ClientPack";
  const fileName = `${sanitizePdfFileSegment(base, 48)}.pdf`;
  const { generateHtmlDocumentPdfBlob } = await import("../modules/surveyReport/surveyReportPdf.js");
  const { blob } = await generateHtmlDocumentPdfBlob(html, {
    fileName,
    title: report.title || report.ref || "Client pack",
    onProgress: extras.onProgress,
  });
  return downloadBlob(blob, fileName);
}

/**
 * A3 landscape board pack — meeting sheet (map / dig risk / top TFR).
 * Dynamic-import surveyEvidencePack so utility-mapping-print ↛ survey-report (Vite TDZ).
 * @param {object} report
 * @param {{ org?: object }} [extras]
 */
export async function downloadUtilityMappingA3BoardPack(report, extras = {}) {
  if (!isUtilityMappingPrintTheme() || !report) return false;
  const digRisk = computeUtilityMappingDigRisk(report);
  const { buildA3BoardPackHtml } = await import("../modules/surveyReport/surveyEvidencePack.js");
  const html = buildA3BoardPackHtml(report, {
    digRisk: digRisk?.label ? digRisk : { band: "medium", label: "Review dig readiness", score: digRisk?.score ?? "—" },
    orgName: extras.org?.name || UTILITY_MAPPING_BRAND.name,
  });
  if (!html) return false;
  const base = utilityMappingExportBaseName(report, "A3Board") || report.ref || "UM-A3Board";
  const name = `${sanitizePdfFileSegment(base, 48)}.html`;
  return downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), name);
}

export { buildQrSrc as buildUtilityMappingQrSrc };
