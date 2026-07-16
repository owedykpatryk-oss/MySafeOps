/**
 * Survey report → A4 PDF download (html2canvas + jsPDF).
 */
import { jsPDF } from "jspdf";
import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { sanitizePdfFileSegment } from "../../utils/pdfFileName";
import { downloadBlob } from "../../utils/downloadBlob";
import { buildSurveyReportHtml } from "./surveyReportPrintHtml";
import { sanitizePrintPreviewHtml } from "../../utils/htmlEscape.js";
import { normalizeSurveyReport } from "./surveyReportHelpers";
import { isUtilityMappingOrg } from "../../utils/utilityMappingOrg";
import { utilityMappingExportBaseName } from "../../utils/utilityMappingDocRefs";

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 8;
const CAPTURE_TIMEOUT_MS = 45_000;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function waitForImages(root) {
  const imgs = [...(root?.querySelectorAll("img") || [])];
  if (!imgs.length) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 4000);
        })
    )
  );
}

function buildFileName(report) {
  const r = normalizeSurveyReport(report);
  const umBase = isUtilityMappingOrg() ? utilityMappingExportBaseName(r, "PAS128") : "";
  if (umBase) {
    const rev = r.documentControl?.revision ? `-Rev${sanitizePdfFileSegment(r.documentControl.revision, 4)}` : "";
    return `${sanitizePdfFileSegment(umBase, 48)}${rev}.pdf`.replace(/--+/g, "-");
  }
  const org = getOrgSettings();
  const ref = sanitizePdfFileSegment(r.ref || r.id || "survey-report", 32);
  const rev = r.documentControl?.revision ? `-Rev${sanitizePdfFileSegment(r.documentControl.revision, 4)}` : "";
  const orgBit = sanitizePdfFileSegment(org.name, 18) || "MySafeOps";
  return `${orgBit}-${ref}${rev}.pdf`.replace(/--+/g, "-");
}

async function renderSurveyReportCanvas(report, extras, notify) {
  // Regex sanitize keeps <style>; DOMPurify whole-document config applied when available.
  const html = sanitizePrintPreviewHtml(buildSurveyReportHtml(report, extras));

  notify("prepare");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Survey report PDF export");
  // Keep visible to the compositor (opacity:0) — visibility:hidden often yields a blank html2canvas capture.
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Could not create print frame for PDF export.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  notify("images");
  await waitForImages(doc.body);
  await wait(400);

  const captureRoot = doc.body;
  if (!captureRoot || !captureRoot.innerText?.trim()) {
    document.body.removeChild(iframe);
    throw new Error("Survey report preview was empty — try Print preview first, then Download PDF again.");
  }

  notify("capture");
  const { default: html2canvas } = await import("html2canvas");
  let canvas;
  try {
    canvas = await withTimeout(
      html2canvas(captureRoot, {
        scale: 1.5,
        logging: false,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        windowWidth: 794,
        width: 794,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 10000,
        onclone: (clonedDoc) => {
          const b = clonedDoc.body;
          if (b) {
            b.style.background = "#fff";
            b.style.opacity = "1";
            b.style.visibility = "visible";
          }
        },
      }),
      CAPTURE_TIMEOUT_MS,
      "PDF capture"
    );
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }

  if (!canvas || canvas.width < 8 || canvas.height < 8) {
    throw new Error("PDF capture produced a blank page — check the report has content, then try again.");
  }

  return canvas;
}

function assembleSurveyReportPdf(report, canvas) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const r = normalizeSurveyReport(report);
  pdf.setProperties({
    title: r.title || r.ref || "Survey Report",
    subject: "Survey report",
    author: r.surveyor || r.documentControl?.preparedBy || "MySafeOps",
  });

  const pageW = A4_W_MM;
  const pageH = A4_H_MM;
  const side = MARGIN_MM;
  const usableW = pageW - side * 2;
  const usableH = pageH - side * 2;
  const imgData = canvas.toDataURL("image/jpeg", 0.9);
  const imgProps = pdf.getImageProperties(imgData);
  const imgHeightMm = (imgProps.height * usableW) / imgProps.width;

  let heightLeft = imgHeightMm;
  let pageNum = 0;
  const totalPages = Math.max(1, Math.ceil(imgHeightMm / usableH));

  pdf.addImage(imgData, "JPEG", side, side, usableW, imgHeightMm);
  pageNum = 1;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(140, 140, 140);
  pdf.text(`${pageNum} / ${totalPages}`, pageW - side, pageH - 4, { align: "right" });
  heightLeft -= usableH;

  while (heightLeft > 0.5) {
    pdf.addPage();
    pageNum += 1;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`${pageNum} / ${totalPages}`, pageW - side, pageH - 4, { align: "right" });
    const y = side - (imgHeightMm - heightLeft);
    pdf.addImage(imgData, "JPEG", side, y, usableW, imgHeightMm);
    heightLeft -= usableH;
  }

  return { pdf, totalPages };
}

/**
 * Render survey report HTML off-screen and return PDF blob (for ZIP packs).
 * @param {object} report
 * @param {object} [extras] — passed to buildSurveyReportHtml
 * @param {{ onProgress?: (phase: string) => void }} [opts]
 * @returns {Promise<{ blob: Blob, fileName: string, pages: number }>}
 */
export async function generateSurveyReportPdfBlob(report, extras = {}, opts = {}) {
  const notify = (phase) => opts.onProgress?.(phase);
  const fileName = buildFileName(report);
  const canvas = await renderSurveyReportCanvas(report, extras, notify);
  notify("assemble");
  const { pdf, totalPages } = assembleSurveyReportPdf(report, canvas);
  notify("save");
  const blob = pdf.output("blob");
  return { blob, fileName, pages: totalPages };
}

/**
 * Render survey report HTML off-screen and save as multi-page A4 PDF.
 * @param {object} report
 * @param {object} [extras] — passed to buildSurveyReportHtml
 * @param {{ onProgress?: (phase: string) => void }} [opts]
 */
export async function downloadSurveyReportPdf(report, extras = {}, opts = {}) {
  const notify = (phase) => opts.onProgress?.(phase);
  const fileName = buildFileName(report);
  const canvas = await renderSurveyReportCanvas(report, extras, notify);
  notify("assemble");
  const { pdf, totalPages } = assembleSurveyReportPdf(report, canvas);
  notify("save");

  // jsPDF.save is the most reliable path in Chromium; fall back to blob download.
  try {
    pdf.save(fileName);
  } catch {
    const blob = pdf.output("blob");
    const ok = downloadBlob(blob, fileName);
    if (!ok) throw new Error("Browser blocked the PDF download — allow downloads for this site and try again.");
  }

  return { ok: true, fileName, pages: totalPages };
}
