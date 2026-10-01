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
import { setPdfFont, ensurePdfUnicodeFont } from "../../utils/pdfUnicodeFont.js";
import { collectPdfSearchableWords, drawPdfSearchableText } from "../../utils/pdfSearchableText.js";

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 8;
const CAPTURE_TIMEOUT_MS = 45_000;
const MAX_SURVEY_CAPTURE_PX = 15_000;
const SURVEY_KEEP_TOGETHER_SELECTOR = [
  ".sr-meta-grid",
  ".sr-pas128-summary",
  ".sr-callout",
  ".sr-photo",
  ".sr-photo-group",
  ".sr-plan-figure",
  ".sr-section > p",
  ".sr-section > ul",
  ".sr-section > ol",
  ".sr-data-table tr",
  ".sr-section h2",
  ".sr-subhead",
  "h1, h2, h3, p, li, figure, table tr, img",
].join(",");

function collectSurveyPaginationHints(root) {
  if (!root) return { contentHeight: 0, keepTogether: [], forcedBreaks: [], repeatingHeaders: [], searchableWords: [] };
  const rootRect = root.getBoundingClientRect();
  const bounds = (element) => {
    const rect = element.getBoundingClientRect();
    return { top: Math.max(0, rect.top - rootRect.top), bottom: Math.max(0, rect.bottom - rootRect.top) };
  };
  const deepestBottom = (element) =>
    [...element.querySelectorAll("*")].reduce((bottom, child) => Math.max(bottom, bounds(child).bottom), bounds(element).bottom);
  const keepTogether = [...root.querySelectorAll(SURVEY_KEEP_TOGETHER_SELECTOR)].map(bounds);
  const repeatingHeaders = [];
  root.querySelectorAll("table").forEach((table) => {
    const head = table.querySelector("thead");
    const firstRow = table.querySelector("tbody tr");
    if (!head || !firstRow) return;
    const headerBounds = bounds(head);
    keepTogether.push({ top: headerBounds.top, bottom: bounds(firstRow).bottom });
    repeatingHeaders.push({
      tableTop: bounds(table).top,
      tableBottom: bounds(table).bottom,
      headerTop: headerBounds.top,
      headerBottom: headerBounds.bottom,
    });
  });
  root.querySelectorAll(".sr-section h2, .sr-section h3").forEach((heading) => {
    if (heading.nextElementSibling) {
      keepTogether.push({ top: bounds(heading).top, bottom: bounds(heading.nextElementSibling).bottom });
    }
  });
  const forcedBreaks = [...root.querySelectorAll(".sr-cover, .sr-toc, .um-doc-control-page, .um-toc-page")].map(deepestBottom);
  // Start the contents on its own slice even when the cover grows beyond its
  // nominal minimum height (for example when a long organisation name wraps).
  root.querySelectorAll(".sr-toc, .um-toc-page").forEach((toc) => forcedBreaks.push(bounds(toc).top));
  return {
    contentHeight: root.scrollHeight,
    keepTogether,
    forcedBreaks,
    repeatingHeaders,
    searchableWords: collectPdfSearchableWords(root),
  };
}

export function planSurveyPdfSlices({ contentHeight, pageHeight, keepTogether = [], forcedBreaks = [], repeatingHeaders = [] }) {
  const height = Math.max(0, Number(contentHeight) || 0);
  const page = Math.max(1, Number(pageHeight) || 1);
  if (!height) return [];
  const blocks = keepTogether
    .map(({ top, bottom }) => ({ top: Math.max(0, Number(top) || 0), bottom: Math.min(height, Number(bottom) || 0) }))
    .filter((block) => block.bottom > block.top)
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const forced = [...new Set(forcedBreaks.map((value) => Number(value)).filter((value) => value > 0 && value < height))].sort((a, b) => a - b);
  const headers = repeatingHeaders
    .map(({ tableTop, tableBottom, headerTop, headerBottom }) => ({
      tableTop: Math.max(0, Number(tableTop) || 0),
      tableBottom: Math.min(height, Number(tableBottom) || 0),
      headerTop: Math.max(0, Number(headerTop) || 0),
      headerBottom: Math.min(height, Number(headerBottom) || 0),
    }))
    .filter((item) => item.tableBottom > item.tableTop && item.headerBottom > item.headerTop);
  const slices = [];
  let start = 0;
  let guard = 0;
  while (start < height - 0.5 && guard++ < 1000) {
    const repeatHeader = headers.find((item) => start > item.headerBottom + 1 && start < item.tableBottom - 1) || null;
    const headerHeight = repeatHeader ? repeatHeader.headerBottom - repeatHeader.headerTop : 0;
    const availablePage = Math.max(page * 0.55, page - headerHeight);
    const idealEnd = Math.min(height, start + availablePage);
    if (idealEnd >= height - 0.5) {
      slices.push({ start, end: height, repeatHeader });
      break;
    }
    const forcedEnd = forced.find((value) => value > start + 1 && value <= idealEnd + 1);
    let end = forcedEnd || idealEnd;
    if (!forcedEnd) {
      const minEnd = start + availablePage * 0.38;
      const crossing = blocks.find(
        (block) => block.top < end - 1 && block.bottom > end + 1 && block.bottom - block.top < page * 0.94 && block.top >= minEnd
      );
      if (crossing) end = crossing.top;
    }
    if (end <= start + 1) end = Math.min(height, idealEnd);
    slices.push({ start, end, repeatHeader });
    start = end;
  }
  return slices;
}

export function getSurveyCaptureScale(contentHeight) {
  const height = Math.max(1, Number(contentHeight) || 1);
  return Math.min(2, Math.max(1, MAX_SURVEY_CAPTURE_PX / height));
}

function composeSurveyPageCanvas(source, pageSlice, pageHeight) {
  const height = Math.max(1, Math.ceil(pageHeight));
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const headerHeight = pageSlice.repeatHeader
    ? Math.max(1, Math.ceil(pageSlice.repeatHeader.headerBottom - pageSlice.repeatHeader.headerTop))
    : 0;
  const sourceStart = Math.ceil(pageSlice.start);
  const contentHeight = Math.min(
    Math.max(1, Math.floor(pageSlice.end - sourceStart)),
    Math.max(1, canvas.height - headerHeight)
  );
  context.drawImage(source, 0, sourceStart, source.width, contentHeight, 0, headerHeight, source.width, contentHeight);
  if (pageSlice.repeatHeader) {
    const headerY = Math.floor(pageSlice.repeatHeader.headerTop);
    context.drawImage(source, 0, headerY, source.width, headerHeight, 0, 0, source.width, headerHeight);
  } else if (pageSlice.start > 0) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, Math.min(8, canvas.height));
  }
  return canvas;
}

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

async function renderHtmlDocumentCanvas(html, notify, title = "PDF export", { includePagination = false } = {}) {
  notify("prepare");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
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
  if (doc.fonts?.ready) await Promise.race([doc.fonts.ready, wait(2000)]);
  await wait(400);

  const captureRoot = doc.body;
  const paginationHints = includePagination ? collectSurveyPaginationHints(captureRoot) : null;
  if (!captureRoot || !captureRoot.innerText?.trim()) {
    document.body.removeChild(iframe);
    throw new Error("PDF preview was empty — check content and try again.");
  }

  notify("capture");
  const { default: html2canvas } = await import("html2canvas");
  let canvas;
  try {
    canvas = await withTimeout(
      html2canvas(captureRoot, {
        scale: getSurveyCaptureScale(captureRoot.scrollHeight),
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
    throw new Error("PDF capture produced a blank page — try again.");
  }

  return includePagination ? { canvas, paginationHints } : canvas;
}

/**
 * Render arbitrary print HTML to a PDF blob (client pack, A3, etc.).
 * @param {string} html
 * @param {{ fileName?: string, title?: string, onProgress?: Function }} [opts]
 */
export async function generateHtmlDocumentPdfBlob(html, opts = {}) {
  const notify = (phase) => opts.onProgress?.(phase);
  const fileName = opts.fileName || "document.pdf";
  const safeHtml = sanitizePrintPreviewHtml(html);
  const { canvas, paginationHints } = await renderHtmlDocumentCanvas(safeHtml, notify, opts.title || "Document PDF", {
    includePagination: true,
  });
  notify("assemble");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  await ensurePdfUnicodeFont(pdf);
  pdf.setProperties({ title: opts.title || fileName, subject: "Survey deliverable", author: "MySafeOps" });
  const pageW = A4_W_MM;
  const pageH = A4_H_MM;
  const side = MARGIN_MM;
  const usableW = pageW - side * 2;
  const usableH = pageH - side * 2;
  const pixelsPerMm = canvas.width / usableW;
  const contentPageHeightPx = usableH * pixelsPerMm;
  const hintScale = paginationHints?.contentHeight ? canvas.height / paginationHints.contentHeight : 1;
  const slices = planSurveyPdfSlices({
    contentHeight: canvas.height,
    pageHeight: contentPageHeightPx,
    keepTogether: (paginationHints?.keepTogether || []).map(({ top, bottom }) => ({
      top: top * hintScale,
      bottom: bottom * hintScale,
    })),
    forcedBreaks: (paginationHints?.forcedBreaks || []).map((value) => value * hintScale),
    repeatingHeaders: (paginationHints?.repeatingHeaders || []).map((header) => ({
      tableTop: header.tableTop * hintScale,
      tableBottom: header.tableBottom * hintScale,
      headerTop: header.headerTop * hintScale,
      headerBottom: header.headerBottom * hintScale,
    })),
  });
  const totalPages = Math.max(1, slices.length);
  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage();
    const pageCanvas = composeSurveyPageCanvas(canvas, slice, contentPageHeightPx);
    const pageImage = pageCanvas.toDataURL("image/jpeg", 0.9);
    pdf.addImage(pageImage, "JPEG", side, side, usableW, usableH);
    const repeatedHeaderHeight = slice.repeatHeader
      ? Math.max(1, slice.repeatHeader.headerBottom - slice.repeatHeader.headerTop)
      : 0;
    drawPdfSearchableText(pdf, paginationHints?.searchableWords, {
      sourceStart: slice.start,
      sourceEnd: slice.end,
      pixelsPerMm,
      marginXmm: side,
      marginYmm: side,
      topOffsetPx: repeatedHeaderHeight,
      pageContentHeightPx: contentPageHeightPx,
      coordinateScale: hintScale,
    });
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`${index + 1} / ${totalPages}`, pageW - side, pageH - 4, { align: "right" });
  });
  notify("save");
  return { blob: pdf.output("blob"), fileName, pages: totalPages };
}

async function renderSurveyReportCanvas(report, extras, notify) {
  const html = sanitizePrintPreviewHtml(buildSurveyReportHtml(report, extras));
  return renderHtmlDocumentCanvas(html, notify, "Survey report PDF export", { includePagination: true });
}

async function assembleSurveyReportPdf(report, canvas, paginationHints) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  await ensurePdfUnicodeFont(pdf);
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
  const pixelsPerMm = canvas.width / usableW;
  const contentPageHeightPx = usableH * pixelsPerMm;
  const hintScale = paginationHints?.contentHeight ? canvas.height / paginationHints.contentHeight : 1;
  const slices = planSurveyPdfSlices({
    contentHeight: canvas.height,
    pageHeight: contentPageHeightPx,
    keepTogether: (paginationHints?.keepTogether || []).map(({ top, bottom }) => ({ top: top * hintScale, bottom: bottom * hintScale })),
    forcedBreaks: (paginationHints?.forcedBreaks || []).map((value) => value * hintScale),
    repeatingHeaders: (paginationHints?.repeatingHeaders || []).map((header) => ({
      tableTop: header.tableTop * hintScale,
      tableBottom: header.tableBottom * hintScale,
      headerTop: header.headerTop * hintScale,
      headerBottom: header.headerBottom * hintScale,
    })),
  });
  const totalPages = Math.max(1, slices.length);

  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage();
    const pageCanvas = composeSurveyPageCanvas(canvas, slice, contentPageHeightPx);
    const pageImage = pageCanvas.toDataURL("image/jpeg", 0.9);
    const pageHeightMm = Math.min(usableH, (pageCanvas.height / pixelsPerMm));
    pdf.addImage(pageImage, "JPEG", side, side, usableW, pageHeightMm);
    const repeatedHeaderHeight = slice.repeatHeader
      ? Math.max(1, slice.repeatHeader.headerBottom - slice.repeatHeader.headerTop)
      : 0;
    drawPdfSearchableText(pdf, paginationHints?.searchableWords, {
      sourceStart: slice.start,
      sourceEnd: slice.end,
      pixelsPerMm,
      marginXmm: side,
      marginYmm: side,
      topOffsetPx: repeatedHeaderHeight,
      pageContentHeightPx: contentPageHeightPx,
      coordinateScale: hintScale,
    });
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`${index + 1} / ${totalPages}`, pageW - side, pageH - 4, { align: "right" });
  });

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
  const { canvas, paginationHints } = await renderSurveyReportCanvas(report, extras, notify);
  notify("assemble");
  const { pdf, totalPages } = await assembleSurveyReportPdf(report, canvas, paginationHints);
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
  const { canvas, paginationHints } = await renderSurveyReportCanvas(report, extras, notify);
  notify("assemble");
  const { pdf, totalPages } = await assembleSurveyReportPdf(report, canvas, paginationHints);
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
