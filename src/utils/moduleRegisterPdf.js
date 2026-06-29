import { getOrgSettings } from "../utils/orgSettingsStorage";
import { loadOrgScoped } from "./orgStorage";
import { sanitizePdfFileSegment } from "./pdfFileName";
import { MODULE_PDF_REGISTRY, canExportModulePdf } from "../navigation/moduleCatalogMeta";
import { MORE_SECTIONS, getMoreTabsForSection } from "../navigation/appModules";
import { prepareRegisterExport, renderDailyBriefingDetailPages, renderGeoPhotoDetailPages } from "./registerPdfAdapters";

let jsPDFPromise = null;
async function loadJsPDF() {
  if (!jsPDFPromise) jsPDFPromise = import("jspdf").then((m) => m.jsPDF);
  return jsPDFPromise;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const FOOTER_H = 10;
const HEADER_H = 26;

const HSE_SECTION_TITLE = "Health, safety & environment";

const COLUMN_PRIORITY = [
  "name",
  "title",
  "ref",
  "reference",
  "topic",
  "type",
  "substance",
  "activity",
  "status",
  "severity",
  "riskLevel",
  "location",
  "date",
  "occurredAt",
  "assessedDate",
  "createdAt",
  "updatedAt",
  "dueDate",
  "notes",
  "description",
];

function humanizeKey(key) {
  return String(key || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatCell(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ").slice(0, 160);
  if (typeof value === "object") return JSON.stringify(value).slice(0, 120);
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    try {
      return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return s.slice(0, 24);
    }
  }
  return s.slice(0, 160);
}

/** @param {Record<string, unknown>[]} rows */
export function inferRegisterColumns(rows, maxCols = 5) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [{ k: "_status", l: "Status" }];
  }
  const keys = new Set();
  rows.slice(0, 25).forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.keys(row).forEach((k) => {
      if (k === "id" || k.startsWith("_")) return;
      keys.add(k);
    });
  });
  const picked = COLUMN_PRIORITY.filter((k) => keys.has(k)).slice(0, maxCols);
  for (const k of keys) {
    if (picked.length >= maxCols) break;
    if (!picked.includes(k)) picked.push(k);
  }
  return picked.map((k) => ({ k, l: humanizeKey(k) }));
}

function loadRegisterRows(moduleId) {
  const cfg = MODULE_PDF_REGISTRY[moduleId];
  if (!cfg?.key) return { rows: [], cfg: null };
  const raw = loadOrgScoped(cfg.key, []);
  const rows = Array.isArray(raw) ? raw : [];
  return { rows, cfg };
}

function hexToRgb(hex) {
  const h = String(hex || "#0d9488").replace("#", "");
  if (h.length !== 6) return [13, 148, 136];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function getPdfTheme(org) {
  const raw = String(org.pdfTheme || "executive").toLowerCase();
  return raw === "classic" ? "classic" : "executive";
}

function logoImageFormat(dataUrl) {
  const s = String(dataUrl || "").toLowerCase();
  if (s.includes("image/png") || s.includes("png")) return "PNG";
  if (s.includes("image/jpeg") || s.includes("image/jpg") || s.includes("jpeg")) return "JPEG";
  if (s.includes("image/webp")) return "WEBP";
  return "PNG";
}

function tryAddLogo(pdf, org, x, y, maxW = 22, maxH = 12) {
  const logo = org.logo;
  if (!logo || !String(logo).startsWith("data:image")) return 0;
  try {
    pdf.addImage(String(logo), logoImageFormat(logo), x, y, maxW, maxH, undefined, "FAST");
    return maxW + 4;
  } catch {
    return 0;
  }
}

function drawWatermark(pdf, org) {
  const text = String(org.pdfWatermarkText || "").trim();
  if (!text) return;
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    try {
      if (typeof pdf.saveGraphicsState === "function") pdf.saveGraphicsState();
      pdf.setTextColor(220, 220, 220);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(42);
      pdf.text(text.toUpperCase(), PAGE_W / 2, PAGE_H / 2, {
        align: "center",
        angle: 35,
      });
      if (typeof pdf.restoreGraphicsState === "function") pdf.restoreGraphicsState();
    } catch {
      /* watermark optional */
    }
  }
}

/**
 * @param {import("jspdf").jsPDF} pdf
 * @param {{ org: ReturnType<typeof getOrgSettings>; title: string; subtitle?: string; rgb: number[]; theme: string }} meta
 * @param {number} yStart
 */
function drawPdfPageHeader(pdf, meta, yStart = MARGIN) {
  const { org, rgb, theme } = meta;
  const [r, g, b] = rgb;
  const barH = theme === "executive" ? 3 : 1.8;
  pdf.setFillColor(r, g, b);
  pdf.rect(MARGIN, yStart, PAGE_W - MARGIN * 2, barH, "F");

  let textX = MARGIN;
  const logoW = tryAddLogo(pdf, org, MARGIN, yStart + barH + 2, theme === "executive" ? 24 : 18, theme === "executive" ? 11 : 9);
  if (logoW > 0) textX = MARGIN + logoW;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(theme === "executive" ? 12 : 11);
  pdf.setTextColor(theme === "classic" ? 0 : 30, theme === "classic" ? 0 : 41, theme === "classic" ? 0 : 59);
  pdf.text(org.name || "MySafeOps", textX, yStart + barH + 9);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(meta.title, textX, yStart + barH + 14.5);
  if (meta.subtitle) {
    pdf.setFontSize(8);
    pdf.text(meta.subtitle, textX, yStart + barH + 18.5);
  }

  const stamp = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  pdf.setFontSize(8);
  pdf.text(stamp, PAGE_W - MARGIN, yStart + barH + 9, { align: "right" });
  if (org.pdfVersionPrefix) {
    pdf.text(String(org.pdfVersionPrefix), PAGE_W - MARGIN, yStart + barH + 14, { align: "right" });
  }

  return yStart + HEADER_H;
}

function drawPdfFooter(pdf, org, pageNum, pageTotal, theme) {
  const y = PAGE_H - FOOTER_H;
  const [r, g, b] = hexToRgb(org.primaryColor);
  if (theme === "executive") {
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.4);
  } else {
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
  }
  pdf.line(MARGIN, y - 2, PAGE_W - MARGIN, y - 2);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  const footer = org.pdfFooter || "Generated by MySafeOps — mysafeops.com";
  pdf.text(footer.slice(0, 95), MARGIN, y + 1.5);

  const compliance = String(org.pdfComplianceLine || "").trim();
  if (compliance) {
    pdf.setFontSize(6.5);
    pdf.text(compliance.slice(0, 110), MARGIN, y + 4.5);
  }

  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${pageNum} / ${pageTotal}`, PAGE_W - MARGIN, y + 1.5, { align: "right" });
}

function tableHeaderColors(theme, rgb) {
  if (theme === "executive") {
    return { fill: rgb, text: [255, 255, 255] };
  }
  return { fill: [241, 245, 249], text: [71, 85, 105] };
}

function renderRegisterTable(pdf, { rows, columns, sectionTitle, org, rgb, theme, startY }) {
  const usableW = PAGE_W - MARGIN * 2;
  const colW = usableW / columns.length;
  let y = startY;
  const headerColors = tableHeaderColors(theme, rgb);

  const drawTableHeaderRow = () => {
    pdf.setFillColor(...headerColors.fill);
    pdf.rect(MARGIN, y, usableW, 6.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...headerColors.text);
    columns.forEach((col, i) => {
      pdf.text(col.l, MARGIN + i * colW + 1.5, y + 4.4);
    });
    y += 8;
  };

  const ensureSpace = (need) => {
    if (y + need <= PAGE_H - FOOTER_H - 5) return;
    pdf.addPage();
    y = drawPdfPageHeader(pdf, {
      org,
      title: sectionTitle,
      subtitle: "Continued",
      rgb,
      theme,
    });
    y += 2;
    drawTableHeaderRow();
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(theme === "executive" ? 11 : 10);
  pdf.setTextColor(15, 23, 42);
  pdf.text(sectionTitle, MARGIN, y);
  y += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${rows.length} record(s)`, MARGIN, y);
  y += 6;

  if (rows.length === 0) {
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text("No records stored for this organisation yet.", MARGIN, y + 2);
    return y + 10;
  }

  drawTableHeaderRow();

  rows.forEach((row, idx) => {
    const cells = columns.map((col) => formatCell(row?.[col.k]));
    const lineSets = cells.map((text) => pdf.splitTextToSize(text, colW - 3));
    const rowH = Math.max(6, ...lineSets.map((ls) => ls.length * 3.6)) + 2;
    ensureSpace(rowH + 2);

    if (idx % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(MARGIN, y - 1, usableW, rowH, "F");
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(30, 41, 59);
    lineSets.forEach((lines, i) => {
      pdf.text(lines, MARGIN + i * colW + 1.5, y + 3);
    });
    y += rowH;
  });

  return y + 6;
}

function finalizePdf(pdf, org, theme) {
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    drawPdfFooter(pdf, org, p, pageCount, theme);
  }
  drawWatermark(pdf, org);
}

function buildFileName(org, slugPart) {
  const ts = new Date().toISOString().slice(0, 10);
  return `${sanitizePdfFileSegment(org.name, 20) || "MySafeOps"}-${slugPart}-${ts}.pdf`.replace(/--+/g, "-");
}

function renderModulesIntoPdf(pdf, { org, rgb, theme, bundleTitle, bundleSubtitle, modules }) {
  let y = drawPdfPageHeader(pdf, {
    org,
    title: bundleTitle,
    subtitle: bundleSubtitle || (org.pdfHeader ? String(org.pdfHeader).slice(0, 90) : undefined),
    rgb,
    theme,
  });
  y += 4;

  modules.forEach((mod, index) => {
    const { rows, cfg } = loadRegisterRows(mod.id);
    if (!cfg) return;
    const prepared = prepareRegisterExport(mod.id, rows, { summary: true });
    const tableRows = prepared.mode === "table" ? prepared.rows : rows;
    const columns =
      prepared.columns ||
      (Array.isArray(cfg.columns) && cfg.columns.length > 0 ? cfg.columns : inferRegisterColumns(tableRows));
    if (y > PAGE_H - 62 && index > 0) {
      pdf.addPage();
      y = drawPdfPageHeader(pdf, {
        org,
        title: bundleTitle,
        subtitle: "Continued",
        rgb,
        theme,
      });
      y += 2;
    }
    y = renderRegisterTable(pdf, {
      rows: tableRows,
      columns,
      sectionTitle: mod.label,
      org,
      rgb,
      theme,
      startY: y,
    });
    y += 4;
  });

  finalizePdf(pdf, org, theme);
}

/**
 * Export one module register to A4 PDF.
 * @param {string} moduleId
 * @param {{ label?: string; summary?: boolean; rowsOverride?: object[]; filterNote?: string | null }} [opts]
 */
export async function exportModuleRegisterPdf(moduleId, opts = {}) {
  const jsPDF = await loadJsPDF();
  const { rows: storedRows, cfg } = loadRegisterRows(moduleId);
  if (!cfg) {
    return { ok: false, error: "no_pdf_config" };
  }
  const rows = Array.isArray(opts.rowsOverride) ? opts.rowsOverride : storedRows;
  const org = getOrgSettings();
  const theme = getPdfTheme(org);
  const rgb = hexToRgb(org.primaryColor);
  const label = opts.label || humanizeKey(moduleId);
  const prepared = prepareRegisterExport(moduleId, rows, { summary: opts.summary === true });
  const filterSuffix = opts.filterNote ? ` · ${opts.filterNote}` : rows.length !== storedRows.length ? ` · ${rows.length} of ${storedRows.length} shown` : "";
  const baseSubtitle = org.pdfHeader ? String(org.pdfHeader).slice(0, 90) : "Register export";

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  if (prepared.mode === "detail" && moduleId === "daily-briefing") {
    renderDailyBriefingDetailPages(pdf, prepared.rows, {
      drawPdfPageHeader: (doc, meta) => drawPdfPageHeader(doc, meta),
      renderRegisterTable,
      org,
      rgb,
      theme,
      label,
    });
  } else if (prepared.mode === "detail" && moduleId === "geo-photos") {
    renderGeoPhotoDetailPages(pdf, prepared.rows, {
      drawPdfPageHeader: (doc, meta) => drawPdfPageHeader(doc, meta),
      renderRegisterTable,
      org,
      rgb,
      theme,
      label,
    });
  } else {
    const tableRows = prepared.mode === "table" ? prepared.rows : rows;
    const columns =
      prepared.columns ||
      (Array.isArray(cfg.columns) && cfg.columns.length > 0 ? cfg.columns : inferRegisterColumns(tableRows));
    const y = drawPdfPageHeader(pdf, {
      org,
      title: label,
      subtitle: `${baseSubtitle}${filterSuffix}`.slice(0, 120),
      rgb,
      theme,
    });
    renderRegisterTable(pdf, { rows: tableRows, columns, sectionTitle: label, org, rgb, theme, startY: y + 2 });
  }

  finalizePdf(pdf, org, theme);

  const slug = sanitizePdfFileSegment(label, 36) || sanitizePdfFileSegment(moduleId, 36) || "register";
  const fileName = buildFileName(org, slug);
  pdf.save(fileName);
  return { ok: true, fileName, rows: rows.length };
}

/**
 * Combined A4 PDF for all exportable modules in a More section.
 * @param {{ title: string; modules: { id: string; label: string }[] }} section
 */
export async function exportMoreSectionPdf(section) {
  const jsPDF = await loadJsPDF();
  const modules = (section.modules || []).filter((m) => canExportModulePdf(m.id));
  if (modules.length === 0) {
    return { ok: false, error: "nothing_to_export" };
  }

  const org = getOrgSettings();
  const theme = getPdfTheme(org);
  const rgb = hexToRgb(org.primaryColor);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  renderModulesIntoPdf(pdf, {
    org,
    rgb,
    theme,
    bundleTitle: section.title || "Modules",
    bundleSubtitle: `${modules.length} register export(s)`,
    modules,
  });

  const slug = sanitizePdfFileSegment(section.title, 32) || "section";
  const fileName = buildFileName(org, slug);
  pdf.save(fileName);
  return { ok: true, fileName, modules: modules.length };
}

/** All Health, safety & environment registers in one A4 PDF bundle. */
export async function exportAllHseRegistersPdf() {
  const hseSection = MORE_SECTIONS.find((s) => s.title === HSE_SECTION_TITLE);
  if (!hseSection) return { ok: false, error: "hse_section_missing" };
  const tabs = getMoreTabsForSection(hseSection);
  return exportMoreSectionPdf({
    title: "Health, safety & environment — full pack",
    modules: tabs.map((t) => ({ id: t.id, label: t.label })),
  });
}

/** Site operations registers bundle. */
export async function exportSiteOperationsRegistersPdf() {
  const section = MORE_SECTIONS.find((s) => s.title === "Site operations");
  if (!section) return { ok: false, error: "section_missing" };
  const tabs = getMoreTabsForSection(section);
  return exportMoreSectionPdf({
    title: "Site operations — register pack",
    modules: tabs.map((t) => ({ id: t.id, label: t.label })),
  });
}
