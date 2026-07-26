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
import { setPdfFont, ensurePdfUnicodeFont } from "../../utils/pdfUnicodeFont.js";

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 8;

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
  await wait(350);

  notify("capture");
  const { default: html2canvas } = await import("html2canvas");
  let canvas;
  try {
    canvas = await html2canvas(doc.body, {
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      windowWidth: 794,
      width: 794,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
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

  const pageW = A4_W_MM;
  const pageH = A4_H_MM;
  const side = MARGIN_MM;
  const usableW = pageW - side * 2;
  const usableH = pageH - side * 2;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const imgProps = pdf.getImageProperties(imgData);
  const imgHeightMm = (imgProps.height * usableW) / imgProps.width;

  let heightLeft = imgHeightMm;
  let pageNum = 0;
  const totalPages = Math.max(1, Math.ceil(imgHeightMm / usableH));

  pdf.addImage(imgData, "JPEG", side, side, usableW, imgHeightMm);
  pageNum = 1;
  setPdfFont(pdf, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(140, 140, 140);
  pdf.text(`${pageNum} / ${totalPages}`, pageW - side, pageH - 4, { align: "right" });
  heightLeft -= usableH;

  while (heightLeft > 0.5) {
    pdf.addPage();
    pageNum += 1;
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`${pageNum} / ${totalPages}`, pageW - side, pageH - 4, { align: "right" });
    const y = side - (imgHeightMm - heightLeft);
    pdf.addImage(imgData, "JPEG", side, y, usableW, imgHeightMm);
    heightLeft -= usableH;
  }

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
