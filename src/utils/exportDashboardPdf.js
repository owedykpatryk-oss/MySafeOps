import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** @typedef {"draft" | "email" | "print"} DashboardPdfPreset */

/**
 * Presets: quick draft, email-friendly JPEG, lossless print PNG.
 * Optional `summaryMaxRowsPerSection` caps KPI rows for that preset.
 */
export const DASHBOARD_PDF_PRESETS = {
  draft: {
    scale: 1.12,
    imageFormat: "jpeg",
    jpegQuality: 0.76,
    summaryMaxRowsPerSection: 55,
    waitForFonts: false,
    stabilizeLayout: false,
  },
  email: {
    scale: 1.5,
    imageFormat: "jpeg",
    jpegQuality: 0.85,
  },
  print: {
    scale: 2.25,
    imageFormat: "png",
  },
};

/**
 * @typedef {Object} PdfSummarySection
 * @property {string} title
 * @property {{ label: string; value: string }[]} items
 */

const MM = {
  side: 8,
  header: 16,
  footer: 7,
};

const DEFAULT_SUMMARY_ROWS_PER_SECTION = 85;

/** Safe segment for filenames (Windows-friendly). */
export function sanitizePdfFileSegment(s, maxLen = 44) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}

/**
 * @param {{ title?: string; items: { label: string; value: string }[] }[]} sections
 * @param {number} capPerSection
 */
function trimSummarySections(sections, capPerSection) {
  return sections.map((sec) => {
    const items = sec.items || [];
    if (items.length <= capPerSection) return sec;
    const rest = items.length - capPerSection;
    return {
      ...sec,
      items: [
        ...items.slice(0, capPerSection),
        {
          label: "…",
          value: `${rest} further row(s) omitted in this PDF (row cap ${capPerSection}).`,
        },
      ],
    };
  });
}

/**
 * @param {import("jspdf").jsPDF} pdf
 * @param {{ title?: string; subtitle?: string; presetLabel?: string | null }} meta
 */
function applyPdfMetadata(pdf, meta) {
  try {
    const title = String(meta.title || "MySafeOps dashboard").slice(0, 200);
    const preset = meta.presetLabel ? ` (${meta.presetLabel})` : "";
    const now = new Date();
    pdf.setProperties({
      title,
      subject: `HSE dashboard export${preset}`,
      author: "MySafeOps",
      keywords: "HSE, safety, construction, MySafeOps, dashboard",
      creator: "MySafeOps",
      creationDate: now,
    });
  } catch {
    /* older jsPDF or restricted context */
  }
}

/**
 * @param {number} imgHeightMm
 * @param {number} viewportHmm
 */
function countRasterPages(imgHeightMm, viewportHmm) {
  if (imgHeightMm <= 0) return 1;
  let rem = imgHeightMm;
  let n = 1;
  rem -= viewportHmm;
  while (rem > 0.5) {
    n += 1;
    rem -= viewportHmm;
  }
  return n;
}

/** @returns {"PNG" | "JPEG" | null} */
function detectImageFormat(src) {
  const s = String(src || "").toLowerCase();
  if (s.startsWith("data:image/png")) return "PNG";
  if (s.startsWith("data:image/jpeg") || s.startsWith("data:image/jpg")) return "JPEG";
  return null;
}

/**
 * @param {import("jspdf").jsPDF} pdf
 * @param {{ pageNum: number; totalPages: number; title?: string; subtitle?: string; pageWidth: number; pageHeight: number; imgStartY: number; footerLeft?: string }} p
 */
function drawRasterHeaderFooter(pdf, p) {
  const side = MM.side;
  const { pageNum, totalPages, title, subtitle, pageWidth, pageHeight, imgStartY, footerLeft } = p;

  pdf.setDrawColor(210, 214, 220);
  pdf.setLineWidth(0.25);
  pdf.line(side, imgStartY - 1.5, pageWidth - side, imgStartY - 1.5);

  let textY = side + 4;
  const maxW = pageWidth - side * 2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  if (title) {
    const lines = pdf.splitTextToSize(String(title), maxW);
    pdf.text(lines, side, textY);
    textY += lines.length * 4.25 + 1;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  if (subtitle) {
    const subLines = pdf.splitTextToSize(String(subtitle), maxW);
    pdf.text(subLines, side, textY);
  }

  if (footerLeft) {
    pdf.setFontSize(6.5);
    pdf.setTextColor(160, 163, 175);
    const leftLines = pdf.splitTextToSize(String(footerLeft), (pageWidth - side * 2) * 0.58).slice(0, 2);
    pdf.text(leftLines, side, pageHeight - 4.5);
  }

  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`MySafeOps · HSE dashboard export · Page ${pageNum} / ${totalPages}`, pageWidth - side, pageHeight - 4, {
    align: "right",
  });
}

/**
 * @param {import("jspdf").jsPDF} pdf
 * @param {{ title?: string; subtitle?: string; tagline?: string; coverLogoSrc?: string; coverExtraLines?: string[]; pageNum: number; totalPages: number }} o
 */
function drawCoverPage(pdf, o) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const side = MM.side;
  const maxW = pageWidth - side * 2;

  pdf.setFillColor(13, 148, 136);
  pdf.rect(0, 0, pageWidth, 3, "F");

  let y = 18;
  if (o.coverLogoSrc) {
    try {
      const fmt = detectImageFormat(o.coverLogoSrc);
      if (fmt) {
        const props = pdf.getImageProperties(o.coverLogoSrc);
        const logoW = 32;
        const logoH = (props.height * logoW) / props.width;
        pdf.addImage(o.coverLogoSrc, fmt, (pageWidth - logoW) / 2, y, logoW, Math.min(logoH, 28));
        y += Math.min(logoH, 28) + 8;
      }
    } catch {
      y += 4;
    }
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(15, 23, 42);
  if (o.title) {
    const lines = pdf.splitTextToSize(String(o.title), maxW);
    pdf.text(lines, side, y);
    y += lines.length * 7.5 + 4;
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(71, 85, 105);
  if (o.subtitle) {
    const sub = pdf.splitTextToSize(String(o.subtitle), maxW);
    pdf.text(sub, side, y);
    y += sub.length * 5 + 6;
  }

  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  const tag = o.tagline || "Dashboard summary — prepared for HSE / site review (visual export follows).";
  const tagLines = pdf.splitTextToSize(tag, maxW);
  pdf.text(tagLines, side, y);
  y += tagLines.length * 4.8 + 4;

  if (Array.isArray(o.coverExtraLines) && o.coverExtraLines.length) {
    pdf.setFontSize(8.5);
    pdf.setTextColor(120, 124, 138);
    for (const ln of o.coverExtraLines) {
      if (!ln || y > pageHeight - 30) break;
      const wrapped = pdf.splitTextToSize(String(ln), maxW);
      pdf.text(wrapped, side, y);
      y += wrapped.length * 3.9 + 2;
    }
  }

  y = pageHeight - 14;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(side, y - 4, pageWidth - side, y - 4);
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`MySafeOps · Cover · Page ${o.pageNum} / ${o.totalPages}`, side, y);
}

/**
 * Same vertical rules as drawing; used to get correct total page count before writing cover.
 * @param {{ title?: string; items: { label: string; value: string }[] }[]} sections
 * @param {{ noteMm?: number }} [countOpts]
 */
function countSummaryPages(sections, countOpts = {}) {
  const noteMm = typeof countOpts.noteMm === "number" ? countOpts.noteMm : 0;
  const measure = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageHeight = measure.internal.pageSize.getHeight();
  const pageWidth = measure.internal.pageSize.getWidth();
  const side = MM.side;
  const maxW = pageWidth - side * 2;
  const yMax = pageHeight - 8;
  const lineStep = 4.6;
  let pages = 1;
  let y = 14 + 10 + noteMm;

  const needNew = (blockH) => y + blockH > yMax;

  for (const sec of sections) {
    if (!sec?.items?.length) continue;
    if (needNew(6)) {
      pages += 1;
      y = 14 + 7;
    }
    y += 6;

    for (const row of sec.items) {
      const line = `${String(row.label)}: ${String(row.value)}`;
      const wrapped = measure.splitTextToSize(line, maxW);
      const blockH = wrapped.length * lineStep + 2;
      if (needNew(blockH)) {
        pages += 1;
        /* Match drawSummaryPages: new sheet + section “(cont.)” + this row */
        y = 14 + 7 + 6 + blockH;
      } else {
        y += blockH;
      }
    }
    y += 4;
  }
  return Math.max(1, pages);
}

/**
 * @param {import("jspdf").jsPDF} pdf
 * @param {{ sections: { title?: string; items: { label: string; value: string }[] }[]; startPageNum: number; totalPages: number; summaryHeaderNote?: string }} o
 * @returns {number} number of physical pages written
 */
function drawSummaryPages(pdf, o) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const side = MM.side;
  const maxW = pageWidth - side * 2;
  const yMax = pageHeight - 8;
  const lineStep = 4.6;
  let pagesDrawn = 0;
  let docPage = o.startPageNum;
  let y = 14;
  let firstSummaryPage = true;

  const drawFooter = () => {
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`MySafeOps · Summary · Page ${docPage} / ${o.totalPages}`, side, pageHeight - 6);
  };

  const startSummarySheet = () => {
    if (pagesDrawn > 0) pdf.addPage();
    pagesDrawn += 1;
    y = 14;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(firstSummaryPage ? 14 : 11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(firstSummaryPage ? "Key figures (selectable text)" : "Key figures (continued)", side, y);
    y += firstSummaryPage ? 10 : 7;
    firstSummaryPage = false;
  };

  startSummarySheet();

  if (o.summaryHeaderNote && pagesDrawn === 1) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    const hLines = pdf.splitTextToSize(String(o.summaryHeaderNote), maxW).slice(0, 2);
    pdf.text(hLines, side, y);
    y += hLines.length * 3.85 + 2;
    pdf.setFont("helvetica", "normal");
  }

  const needNew = (blockH) => y + blockH > yMax;

  for (const sec of o.sections || []) {
    if (!sec?.items?.length) continue;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(13, 148, 136);
    const secTitle = String(sec.title || "Section");
    if (needNew(6)) {
      drawFooter();
      docPage += 1;
      startSummarySheet();
    }
    pdf.text(secTitle, side, y);
    y += 6;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(30, 41, 59);
    for (const row of sec.items) {
      const line = `${String(row.label)}: ${String(row.value)}`;
      const wrapped = pdf.splitTextToSize(line, maxW);
      const blockH = wrapped.length * lineStep + 2;
      if (needNew(blockH)) {
        drawFooter();
        docPage += 1;
        startSummarySheet();
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(13, 148, 136);
        pdf.text(`${secTitle} (cont.)`, side, y);
        y += 6;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.setTextColor(30, 41, 59);
      }
      pdf.text(wrapped, side, y);
      y += blockH;
    }
    y += 4;
  }

  drawFooter();
  return pagesDrawn;
}

async function waitForFonts() {
  try {
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    /* ignore */
  }
}

async function stabilizeLayoutForCapture() {
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve(undefined));
    });
  });
}

/**
 * @param {HTMLElement} element
 * @param {Record<string, unknown>} [opts]
 * @returns {Promise<{ fileName: string; pages: number; format: string; preset?: string; summaryPages?: number; rasterPages?: number }>}
 */
export async function exportDashboardToPdf(element, opts = {}) {
  if (!element || typeof document === "undefined") {
    return { fileName: "", pages: 0, format: opts.imageFormat || "jpeg", rasterPages: 0 };
  }

  const presetName =
    opts.preset === "print" ? "print" : opts.preset === "email" ? "email" : opts.preset === "draft" ? "draft" : null;
  const preset = presetName ? DASHBOARD_PDF_PRESETS[presetName] : {};
  const tsSafe = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const prefix = sanitizePdfFileSegment(opts.fileNamePrefix != null ? String(opts.fileNamePrefix) : "", 44);
  const baseName = `mysafeops-hse-dashboard${presetName ? `-${presetName}` : ""}-${tsSafe}.pdf`;
  const defaultFileName = prefix ? `${prefix}-${baseName}` : baseName;

  const notifyPhase = (phase) => {
    try {
      if (typeof opts.onPhase === "function") opts.onPhase(phase);
    } catch {
      /* ignore */
    }
  };
  notifyPhase("init");
  try {
  let scale = typeof opts.scale === "number" && opts.scale > 0 ? opts.scale : 2;
  let imageFormat = opts.imageFormat === "png" ? "png" : "jpeg";
  let jpegQuality =
    typeof opts.jpegQuality === "number" ? Math.min(1, Math.max(0.5, opts.jpegQuality)) : 0.92;

  if (presetName) {
    if (typeof preset.scale === "number") scale = Math.min(3, Math.max(1, preset.scale));
    if (preset.imageFormat === "png" || preset.imageFormat === "jpeg") imageFormat = preset.imageFormat;
    if (typeof preset.jpegQuality === "number") jpegQuality = preset.jpegQuality;
  }

  let summaryMaxFromPreset =
    preset && typeof preset.summaryMaxRowsPerSection === "number"
      ? Math.max(8, Math.min(250, preset.summaryMaxRowsPerSection))
      : null;
  if (typeof opts.scale === "number" && opts.scale > 0) scale = Math.min(3, Math.max(1, opts.scale));
  if (opts.imageFormat === "png" || opts.imageFormat === "jpeg") imageFormat = opts.imageFormat;
  if (typeof opts.jpegQuality === "number") jpegQuality = Math.min(1, Math.max(0.5, opts.jpegQuality));

  scale = Math.min(3, Math.max(1, scale));
  const hideSelector = opts.hideSelector ?? "[data-no-dashboard-pdf]";
  const flattenChrome = opts.flattenChrome !== false;
  const includeCover = opts.includeCover !== false;
  const rawSections = Array.isArray(opts.summarySections)
    ? opts.summarySections.filter((s) => s && Array.isArray(s.items) && s.items.length > 0)
    : [];
  const summaryRowCap =
    typeof opts.summaryMaxRowsPerSection === "number"
      ? Math.max(8, Math.min(250, opts.summaryMaxRowsPerSection))
      : summaryMaxFromPreset != null
        ? summaryMaxFromPreset
        : DEFAULT_SUMMARY_ROWS_PER_SECTION;
  const sections = trimSummarySections(rawSections, summaryRowCap);
  const includeSummary = sections.length > 0;
  const summaryHeaderNote =
    opts.summaryHeaderNote === ""
      ? undefined
      : typeof opts.summaryHeaderNote === "string"
        ? opts.summaryHeaderNote
        : presetName
          ? `Export preset: ${presetName}`
          : undefined;
  const summaryPageCount = includeSummary ? countSummaryPages(sections, { noteMm: summaryHeaderNote ? 8.5 : 0 }) : 0;
  const fileName = opts.fileName || defaultFileName;
  const waitForFontsFlag =
    typeof opts.waitForFonts === "boolean" ? opts.waitForFonts : preset.waitForFonts !== false;
  const foreignObjectRendering = opts.foreignObjectRendering === true;
  const stabilizeLayout =
    typeof opts.stabilizeLayout === "boolean" ? opts.stabilizeLayout : preset.stabilizeLayout !== false;

  if (waitForFontsFlag) {
    notifyPhase("fonts");
    await waitForFonts();
  }
  if (stabilizeLayout) {
    notifyPhase("layout");
    await stabilizeLayoutForCapture();
  }
  notifyPhase("capture");

  let canvas;
  try {
    canvas = await html2canvas(element, {
      scale,
      logging: false,
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering,
      imageTimeout: typeof opts.imageTimeout === "number" ? opts.imageTimeout : 15_000,
      backgroundColor: "#ffffff",
      windowWidth: element.scrollWidth,
      scrollX: 0,
      scrollY: -window.scrollY,
      letterRendering: true,
      onclone(documentClone) {
        try {
          documentClone.querySelectorAll(hideSelector).forEach((el) => {
            el.style.setProperty("display", "none", "important");
          });
        } catch {
          /* ignore */
        }
        if (flattenChrome) {
          const st = documentClone.createElement("style");
          st.setAttribute("data-pdf-export-style", "1");
          st.textContent = `${hideSelector}{display:none!important} * { box-shadow:none !important; text-shadow:none !important; }`;
          documentClone.documentElement.appendChild(st);
        }
      },
    });
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (/timeout|timed out/i.test(msg)) {
      throw new Error(
        "Timed out while capturing the dashboard (often images or remote fonts). Try the Draft preset, or temporarily remove a slow-loading logo."
      );
    }
    throw e instanceof Error ? e : new Error(msg || "Could not capture the dashboard for PDF.");
  }

  notifyPhase("encode");
  const imgData =
    imageFormat === "png"
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", jpegQuality);

  notifyPhase("assemble");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  applyPdfMetadata(pdf, {
    title: opts.title,
    subtitle: opts.subtitle,
    presetLabel: presetName,
  });

  const exportStamp = new Date().toISOString().slice(0, 19);
  const rasterFooterLeft =
    opts.rasterFooterLeft != null && String(opts.rasterFooterLeft).trim() !== ""
      ? String(opts.rasterFooterLeft).trim()
      : `Capture ${exportStamp} (UTC) · ${presetName || "custom"} · image pages are not searchable`;

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const side = MM.side;
  const imgStartY = side + MM.header;
  const usableW = pageWidth - side * 2;
  const usableH = pageHeight - imgStartY - MM.footer;

  const imgProps = pdf.getImageProperties(imgData);
  const imgHeightMm = (imgProps.height * usableW) / imgProps.width;
  const rasterPageCount = countRasterPages(imgHeightMm, usableH);

  const totalDocumentPages = (includeCover ? 1 : 0) + summaryPageCount + rasterPageCount;

  let pageNum = 0;

  if (includeCover) {
    pageNum += 1;
    drawCoverPage(pdf, {
      title: opts.title,
      subtitle: opts.subtitle,
      tagline: opts.coverTagline,
      coverLogoSrc: opts.coverLogoSrc,
      coverExtraLines: Array.isArray(opts.coverExtraLines) ? opts.coverExtraLines : undefined,
      pageNum,
      totalPages: totalDocumentPages,
    });
    if (summaryPageCount > 0 || rasterPageCount > 0) pdf.addPage();
  }

  if (includeSummary) {
    const startSummary = pageNum + 1;
    const written = drawSummaryPages(pdf, {
      sections,
      startPageNum: startSummary,
      totalPages: totalDocumentPages,
      summaryHeaderNote,
    });
    pageNum = startSummary + written - 1;
    if (rasterPageCount > 0) pdf.addPage();
  }

  let heightLeft = imgHeightMm;
  pageNum += 1;

  drawRasterHeaderFooter(pdf, {
    pageNum,
    totalPages: totalDocumentPages,
    title: opts.title,
    subtitle: opts.subtitle,
    pageWidth,
    pageHeight,
    imgStartY,
    footerLeft: rasterFooterLeft,
  });
  pdf.addImage(imgData, imageFormat === "png" ? "PNG" : "JPEG", side, imgStartY, usableW, imgHeightMm);
  heightLeft -= usableH;

  while (heightLeft > 0.5) {
    pageNum += 1;
    pdf.addPage();
    drawRasterHeaderFooter(pdf, {
      pageNum,
      totalPages: totalDocumentPages,
      title: opts.title,
      subtitle: opts.subtitle,
      pageWidth,
      pageHeight,
      imgStartY,
      footerLeft: rasterFooterLeft,
    });
    const y = imgStartY - (imgHeightMm - heightLeft);
    pdf.addImage(imgData, imageFormat === "png" ? "PNG" : "JPEG", side, y, usableW, imgHeightMm);
    heightLeft -= usableH;
  }

  notifyPhase("save");
  pdf.save(fileName);
  return {
    fileName,
    pages: totalDocumentPages,
    format: imageFormat,
    preset: presetName || undefined,
    summaryPages: summaryPageCount || undefined,
    rasterPages: rasterPageCount,
  };
  } finally {
    notifyPhase("complete");
  }
}
