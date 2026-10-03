/**
 * GPR report → A4 PDF download (html2canvas + jsPDF).
 */
import { jsPDF } from "jspdf";
import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { sanitizePdfFileSegment } from "../../utils/pdfFileName";
import { downloadBlob } from "../../utils/downloadBlob";
import { buildGprReportHtml } from "./gprReportPrintHtml";
import { sanitizePrintPreviewHtml } from "../../utils/htmlEscape.js";
import { normalizeGprReport } from "./gprReportHelpers";
import { planGprPdfSlices } from "./gprPdfPagination.js";
import { collectPdfSearchableWords, drawPdfSearchableText } from "../../utils/pdfSearchableText.js";
import { ensurePdfUnicodeFont } from "../../utils/pdfUnicodeFont.js";

const A4_W_MM = 210;
const A4_H_MM = 297;
const SIDE_MARGIN_MM = 10;
const TOP_MARGIN_MM = 12;
const BOTTOM_MARGIN_MM = 14;

const KEEP_TOGETHER_SELECTOR = [
  ".gpr-equipment-profile",
  ".gpr-meta-grid",
  ".gpr-callout",
  ".gpr-radargram-fig",
  ".gpr-scan-panel",
  ".gpr-acq-diagram",
  ".gpr-chainage-chart",
  ".gpr-bar-row",
  ".gpr-section > p",
  ".gpr-section > ul",
  ".gpr-section > ol",
  ".gpr-data-table tr",
  ".gpr-section h2",
  ".gpr-section h3",
].join(",");

function collectPaginationHints(doc) {
  const root = doc?.body;
  if (!root) return { contentHeight: 0, keepTogether: [], forcedBreaks: [], repeatingHeaders: [], searchableWords: [] };
  const rootRect = root.getBoundingClientRect();
  const relativeBounds = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: Math.max(0, rect.top - rootRect.top),
      bottom: Math.max(0, rect.bottom - rootRect.top),
    };
  };
  const relativeBottomIncludingDescendants = (element) => {
    const own = relativeBounds(element).bottom;
    return [...element.querySelectorAll("*")].reduce(
      (bottom, descendant) => Math.max(bottom, relativeBounds(descendant).bottom),
      own
    );
  };
  const keepTogether = [...root.querySelectorAll(KEEP_TOGETHER_SELECTOR)].map(relativeBounds);
  const repeatingHeaders = [];
  root.querySelectorAll(".gpr-section h2, .gpr-section h3").forEach((heading) => {
    const next = heading.nextElementSibling;
    if (!next) return;
    const headingBounds = relativeBounds(heading);
    const nextBounds = relativeBounds(next);
    keepTogether.push({ top: headingBounds.top, bottom: nextBounds.bottom });
  });
  root.querySelectorAll(".gpr-data-table").forEach((table) => {
    const head = table.querySelector("thead");
    const firstRow = table.querySelector("tbody tr");
    if (!head || !firstRow) return;
    const tableBounds = relativeBounds(table);
    const headerBounds = relativeBounds(head);
    keepTogether.push({
      top: headerBounds.top,
      bottom: relativeBounds(firstRow).bottom,
    });
    repeatingHeaders.push({
      tableTop: tableBounds.top,
      tableBottom: tableBounds.bottom,
      headerTop: headerBounds.top,
      headerBottom: headerBounds.bottom,
    });
  });
  const forcedElements = [...root.querySelectorAll(".gpr-cover, .gpr-toc, .um-doc-control-page, .um-toc-page")]
    .filter((element) => !element.classList.contains("gpr-toc") || !element.closest(".um-toc-page"));
  const forcedBreaks = forcedElements
    // Descendant margins can visually extend beyond a container's own box
    // (notably the final contents row). Include the deepest painted child so
    // a forced page boundary never bisects that final line.
    .map((element) => relativeBottomIncludingDescendants(element))
    .filter(Boolean);
  return {
    contentHeight: root.scrollHeight,
    keepTogether,
    forcedBreaks,
    repeatingHeaders,
    searchableWords: collectPdfSearchableWords(root),
  };
}

function scalePaginationHints(hints, scale) {
  const mapBounds = ({ top, bottom }) => ({ top: top * scale, bottom: bottom * scale });
  const mapHeader = ({ tableTop, tableBottom, headerTop, headerBottom }) => ({
    tableTop: tableTop * scale,
    tableBottom: tableBottom * scale,
    headerTop: headerTop * scale,
    headerBottom: headerBottom * scale,
  });
  return {
    keepTogether: hints.keepTogether.map(mapBounds),
    forcedBreaks: hints.forcedBreaks.map((value) => value * scale),
    repeatingHeaders: (hints.repeatingHeaders || []).map(mapHeader),
    searchableWords: (hints.searchableWords || []).map((word) => ({
      ...word,
      left: word.left * scale,
      top: word.top * scale,
      fontSize: word.fontSize * scale,
    })),
  };
}

function composePageCanvas(source, slice, pageHeight) {
  const height = Math.max(1, Math.ceil(pageHeight));
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = height;
  const context = output.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  const headerHeight = slice.repeatHeader
    ? Math.max(1, Math.ceil(slice.repeatHeader.headerBottom - slice.repeatHeader.headerTop))
    : 0;
  const outputY = headerHeight;
  // Start on the first whole pixel after the planned boundary. Flooring a
  // fractional forced break can pull a one-pixel anti-aliased fragment from
  // the previous page (usually the final TOC line) into the next page.
  const sourceStart = Math.ceil(slice.start);
  const contentHeight = Math.min(
    Math.max(1, Math.floor(slice.end - sourceStart)),
    Math.max(1, output.height - outputY)
  );
  context.drawImage(
    source,
    0,
    sourceStart,
    source.width,
    contentHeight,
    0,
    outputY,
    source.width,
    contentHeight
  );
  if (slice.repeatHeader) {
    // Paint the repeated heading last so a large source-slice draw cannot
    // overwrite it on memory-constrained browser canvases.
    const headerY = Math.floor(slice.repeatHeader.headerTop);
    context.drawImage(source, 0, headerY, source.width, headerHeight, 0, 0, source.width, headerHeight);
  }
  if (slice.start > 0 && !slice.repeatHeader) {
    // Forced page boundaries can still contain a few anti-aliased pixels from
    // the previous block. Mask only the tiny boundary gutter; real content is
    // protected by the pagination keep-together gap.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, Math.min(8, output.height));
  }
  return output;
}

function padContentCanvasToA4(content, watermarkText, { pageNum, totalPages, report }) {
  const pixelsPerMm = content.width / (A4_W_MM - SIDE_MARGIN_MM * 2);
  const page = document.createElement("canvas");
  page.width = Math.max(1, Math.ceil(A4_W_MM * pixelsPerMm));
  page.height = Math.max(1, Math.ceil(A4_H_MM * pixelsPerMm));
  const context = page.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, page.width, page.height);
  context.drawImage(
    content,
    Math.round(SIDE_MARGIN_MM * pixelsPerMm),
    Math.round(TOP_MARGIN_MM * pixelsPerMm)
  );
  if (watermarkText) {
    context.save();
    context.globalAlpha = 0.08;
    context.fillStyle = "#64748b";
    context.font = `700 ${Math.max(42, Math.round(page.width * 0.085))}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(watermarkText).slice(0, 18).toUpperCase(), page.width / 2, page.height / 2);
    context.restore();
  }
  const marginX = SIDE_MARGIN_MM * pixelsPerMm;
  const rightX = page.width - marginX;
  context.save();
  context.fillStyle = "#788496";
  context.strokeStyle = "#dce2ea";
  context.lineWidth = Math.max(1, pixelsPerMm * 0.15);
  context.font = `400 ${Math.max(10, Math.round(pixelsPerMm * 2.45))}px Arial, sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText(String(report.ref || "GPR report").slice(0, 40), marginX, 6.5 * pixelsPerMm);
  context.textAlign = "right";
  context.fillText(String(report.title || "GPR Report").slice(0, 72), rightX, 6.5 * pixelsPerMm);
  context.beginPath();
  context.moveTo(marginX, 8 * pixelsPerMm);
  context.lineTo(rightX, 8 * pixelsPerMm);
  context.moveTo(marginX, (A4_H_MM - 9) * pixelsPerMm);
  context.lineTo(rightX, (A4_H_MM - 9) * pixelsPerMm);
  context.stroke();
  context.textAlign = "left";
  context.fillText("Generated by MySafeOps", marginX, (A4_H_MM - 5) * pixelsPerMm);
  context.textAlign = "right";
  context.fillText(`${pageNum} / ${totalPages}`, rightX, (A4_H_MM - 5) * pixelsPerMm);
  context.restore();
  return page;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
          setTimeout(done, 8000);
        })
    )
  );
}

function buildFileName(report) {
  const r = normalizeGprReport(report);
  const org = getOrgSettings();
  const ref = sanitizePdfFileSegment(r.ref || r.id || "gpr-report", 32);
  const orgBit = sanitizePdfFileSegment(org.name, 18) || "MySafeOps";
  return `${orgBit}-${ref}.pdf`.replace(/--+/g, "-");
}

/** @param {object} report @param {object} [extras] @param {{ onProgress?: (p: string) => void }} [opts] */
export async function downloadGprReportPdf(report, extras = {}, opts = {}) {
  const notify = (phase) => opts.onProgress?.(phase);
  const html = sanitizePrintPreviewHtml(buildGprReportHtml(report, extras));
  const fileName = buildFileName(report);

  notify("prepare");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "GPR report PDF export");
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
  await wait(350);

  notify("capture");
  const { default: html2canvas } = await import("html2canvas");
  let canvas;
  let paginationHints;
  try {
    // jsPDF adds a crisp native header to every page. The single HTML running
    // header is useful for browser print/HTML export, but keeping it in the
    // raster source creates a duplicate (and occasionally clipped) header on
    // the first content page.
    doc.querySelectorAll(".gpr-running-header, .gpr-print-footer, .gpr-watermark").forEach((element) => element.remove());
    paginationHints = collectPaginationHints(doc);
    // Chromium canvas operations become unreliable once a very tall capture
    // exceeds the common 16,384 px texture limit. Cap the raster height while
    // preserving up to 2× resolution so late report pages and copied table
    // headers are never partially blank or clipped.
    const captureScale = Math.min(2, Math.max(1, 15000 / Math.max(1, paginationHints.contentHeight)));
    canvas = await html2canvas(doc.body, {
      scale: captureScale,
      logging: false,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
      width: 794,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll(".gpr-print-footer, .gpr-watermark").forEach((element) => {
          element.style.display = "none";
        });
      },
    });
  } finally {
    document.body.removeChild(iframe);
  }

  notify("assemble");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  await ensurePdfUnicodeFont(pdf);
  const r = normalizeGprReport(report);
  pdf.setProperties({
    title: r.title || r.ref || "GPR Report",
    subject: "GPR report",
    author: r.surveyor || "MySafeOps",
  });

  const usableW = A4_W_MM - SIDE_MARGIN_MM * 2;
  const usableH = A4_H_MM - TOP_MARGIN_MM - BOTTOM_MARGIN_MM;
  const pageHeightPx = (canvas.width * usableH) / usableW;
  const hintScale = paginationHints?.contentHeight ? canvas.height / paginationHints.contentHeight : 1;
  const scaledHints = scalePaginationHints(
    paginationHints || { keepTogether: [], forcedBreaks: [], repeatingHeaders: [] },
    hintScale
  );
  const slices = planGprPdfSlices({
    contentHeight: canvas.height,
    pageHeight: pageHeightPx,
    // Keep a small raster gutter at natural page cuts. Text antialiasing may
    // paint a few pixels outside DOM bounds; without this gutter the top of a
    // following line can appear at the foot of the previous A4 page.
    boundarySafety: Math.max(12, Math.round(canvas.width * 0.01)),
    ...scaledHints,
  });
  const totalPages = Math.max(1, slices.length);
  const watermarkText = r.status === "final"
    ? "FINAL"
    : (String(getOrgSettings().pdfWatermarkText || "").trim() || "DRAFT");

  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage();
    const contentCanvas = composePageCanvas(canvas, slice, pageHeightPx);
    // Bake the page margins into the raster. This avoids renderer-specific
    // image-matrix drift across long documents and guarantees that repeated
    // table headers always begin below the native running header.
    const pageCanvas = padContentCanvasToA4(contentCanvas, watermarkText, {
      pageNum: index + 1,
      totalPages,
      report: r,
    });
    pdf.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      A4_W_MM,
      A4_H_MM,
      `gpr-page-${index + 1}`,
      "NONE"
    );
    drawPdfSearchableText(pdf, scaledHints.searchableWords, {
      sourceStart: slice.start,
      sourceEnd: slice.end,
      pixelsPerMm: canvas.width / usableW,
      marginXmm: SIDE_MARGIN_MM,
      marginYmm: TOP_MARGIN_MM,
      topOffsetPx: slice.repeatHeader
        ? Math.max(1, slice.repeatHeader.headerBottom - slice.repeatHeader.headerTop)
        : 0,
      pageContentHeightPx: pageHeightPx,
    });
  });

  notify("save");
  try {
    pdf.save(fileName);
  } catch {
    if (!downloadBlob(pdf.output("blob"), fileName)) {
      throw new Error("Browser blocked the PDF download — allow downloads for this site and try again.");
    }
  }
  return { ok: true, fileName, pages: totalPages };
}

export { buildGprReportHtml };
