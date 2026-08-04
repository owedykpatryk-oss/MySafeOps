import { getOrgSettings } from "../utils/orgSettingsStorage";
import { loadOrgScoped } from "./orgStorage";
import { sanitizePdfFileSegment } from "./pdfFileName";
import { canExportModulePdf, getModulePdfConfig } from "../navigation/moduleCatalogMeta";
import { getModuleTilePresentation } from "./moduleTileIntelligence";
import { getActiveDocumentLocale } from "./countryWorkspaces";
import { documentText } from "./documentCountryPack";
import { MORE_SECTIONS, getMoreTabsForSection } from "../navigation/appModules";
import { prepareRegisterExport, renderDailyBriefingDetailPages, renderGeoPhotoDetailPages } from "./registerPdfAdapters";
import {
  PDF_PAGE,
  hexToRgb,
  getPdfTheme,
  drawPremiumPdfHeader,
  drawPdfMetaStrip,
  drawRegisterHeroBlock,
  drawEmptyRegisterState,
  drawPremiumPdfFooter,
  drawWatermark,
  buildDocReference,
  setPdfFont,
  ensurePdfUnicodeFont,
} from "./pdfBranding.js";

import { todayLocalISO } from "./localDate";
let jsPDFPromise = null;
async function loadJsPDF() {
  if (!jsPDFPromise) jsPDFPromise = import("jspdf").then((m) => m.jsPDF);
  return jsPDFPromise;
}

async function savePdf(pdf, fileName) {
  try {
    pdf.save(fileName);
  } catch (e) {
    const { downloadBlob } = await import("./downloadBlob.js");
    const blob = pdf.output("blob");
    if (!downloadBlob(blob, fileName)) {
      throw e instanceof Error ? e : new Error("PDF download was blocked by the browser.");
    }
  }
}

const PAGE_W = PDF_PAGE.W;
const PAGE_H = PDF_PAGE.H;
const MARGIN = PDF_PAGE.MARGIN;
const FOOTER_H = PDF_PAGE.FOOTER_H;

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
      return new Date(s).toLocaleDateString(getActiveDocumentLocale(), { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return s.slice(0, 24);
    }
  }
  return s.slice(0, 160);
}

/** @param {Record<string, unknown>[]} rows */
export function inferRegisterColumns(rows, maxCols = 5) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [{ k: "_status", l: documentText("Status") }];
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
  const cfg = getModulePdfConfig(moduleId);
  if (!cfg) return { rows: [], cfg: null };
  if (cfg.overview || !cfg.key) return { rows: [], cfg: { ...cfg, overview: true } };
  const raw = loadOrgScoped(cfg.key, []);
  const rows = Array.isArray(raw) ? raw : [];
  return { rows, cfg };
}

function pdfBrandingContext(org) {
  const theme = getPdfTheme(org);
  const rgb = hexToRgb(org.primaryColor);
  const accentRgb = hexToRgb(org.accentColor);
  return { theme, rgb, accentRgb };
}

function drawPdfPageHeader(pdf, meta, yStart = MARGIN) {
  return drawPremiumPdfHeader(pdf, meta, yStart);
}

function renderModuleOverviewPage(pdf, moduleId, label, org, rgb, accentRgb, theme) {
  const pres = getModuleTilePresentation(moduleId, { count: 0, status: "empty" });
  const docRef = buildDocReference(org, label);
  let y = drawPdfPageHeader(pdf, {
    org,
    title: label,
    subtitle: "Premium module guide · audit-ready export",
    rgb,
    accentRgb,
    theme,
    docRef,
  });
  y = drawPdfMetaStrip(pdf, org, { moduleLabel: label, docRef, recordNote: "Overview export" }, rgb, y);
  y = drawRegisterHeroBlock(pdf, {
    org,
    moduleLabel: label,
    rows: [],
    rgb,
    accentRgb,
    theme,
    smartText: pres.smartText,
    yStart: y,
  });
  y += 4;

  setPdfFont(pdf, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...rgb);
  pdf.text("Smart suggestion", MARGIN, y);
  y += 5;
  setPdfFont(pdf, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(51, 65, 85);
  const smartLines = pdf.splitTextToSize(
    pres.smartText || "Open this module in MySafeOps to capture live compliance evidence on site.",
    PAGE_W - MARGIN * 2
  );
  pdf.text(smartLines, MARGIN, y);
  y += smartLines.length * 4.2 + 8;

  setPdfFont(pdf, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...rgb);
  pdf.text("Pre-built quick start", MARGIN, y);
  y += 5;
  setPdfFont(pdf, "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(String(pres.prebuild?.label || "Use Quick start on the More tile."), MARGIN, y);
  y += 10;

  pdf.setDrawColor(...rgb);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 28, 3, 3, "S");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text("Exported from your organisation workspace. For live registers with records,", MARGIN + 4, y + 8);
  pdf.text("use Premium PDF on the module tile after adding entries.", MARGIN + 4, y + 13);
  pdf.text(`${documentText("Generated")} ${new Date().toLocaleString(getActiveDocumentLocale())}`, MARGIN + 4, y + 22);
  return y + 36;
}

function tableHeaderColors(theme, rgb) {
  if (theme === "executive") {
    return { fill: rgb, text: [255, 255, 255] };
  }
  return { fill: [241, 245, 249], text: [71, 85, 105] };
}

function renderRegisterTable(pdf, { rows, columns, sectionTitle, org, rgb, accentRgb, theme, startY, prebuildLabel = null }) {
  const usableW = PAGE_W - MARGIN * 2;
  const colW = usableW / columns.length;
  let y = startY;
  const headerColors = tableHeaderColors(theme, rgb);

  const drawTableHeaderRow = () => {
    const headerLineSets = columns.map((col) => pdf.splitTextToSize(String(col.l || ""), colW - 3).slice(0, 2));
    const headerH = Math.max(6.5, ...headerLineSets.map((ls) => ls.length * 3.6)) + 2;
    pdf.setFillColor(...headerColors.fill);
    pdf.rect(MARGIN, y, usableW, headerH, "F");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...headerColors.text);
    headerLineSets.forEach((lines, i) => {
      pdf.text(lines, MARGIN + i * colW + 1.5, y + 4);
    });
    y += headerH + 1.5;
  };

  const ensureSpace = (need) => {
    if (y + need <= PAGE_H - FOOTER_H - 8) return;
    pdf.addPage();
    y = drawPdfPageHeader(pdf, {
      org,
      title: sectionTitle,
      subtitle: "Continued",
      rgb,
      accentRgb,
      theme,
    });
    y = drawPdfMetaStrip(pdf, org, { moduleLabel: sectionTitle, recordNote: "Continued" }, rgb, y);
    y += 2;
    drawTableHeaderRow();
  };

  setPdfFont(pdf, "bold");
  pdf.setFontSize(theme === "executive" ? 11 : 10);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Register data", MARGIN, y);
  y += 5;
  setPdfFont(pdf, "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${rows.length} record(s) · controlled export`, MARGIN, y);
  y += 6;

  if (rows.length === 0) {
    return drawEmptyRegisterState(pdf, {
      org,
      moduleLabel: sectionTitle,
      rgb,
      accentRgb,
      prebuildLabel,
      yStart: y,
    });
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

    setPdfFont(pdf, "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(30, 41, 59);
    lineSets.forEach((lines, i) => {
      pdf.text(lines, MARGIN + i * colW + 1.5, y + 3);
    });
    y += rowH;
  });

  return y + 6;
}

function finalizePdf(pdf, org, theme, rgb, accentRgb) {
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    drawPremiumPdfFooter(pdf, org, p, pageCount, theme, rgb, accentRgb);
  }
  drawWatermark(pdf, org);
}

function buildFileName(org, slugPart) {
  const ts = todayLocalISO();
  return `${sanitizePdfFileSegment(org.name, 20) || "MySafeOps"}-${slugPart}-${ts}.pdf`.replace(/--+/g, "-");
}

function renderModulesIntoPdf(pdf, { org, rgb, accentRgb, theme, bundleTitle, bundleSubtitle, modules }) {
  const docRef = buildDocReference(org, bundleTitle);
  let y = drawPdfPageHeader(pdf, {
    org,
    title: bundleTitle,
    subtitle: bundleSubtitle || (org.pdfHeader ? String(org.pdfHeader).slice(0, 90) : undefined),
    rgb,
    accentRgb,
    theme,
    docRef,
  });
  y = drawPdfMetaStrip(pdf, org, { moduleLabel: bundleTitle, docRef, recordNote: `${modules.length} modules` }, rgb, y);
  y += 2;

  modules.forEach((mod, index) => {
    const { rows, cfg } = loadRegisterRows(mod.id);
    if (!cfg) return;
    const prepared = prepareRegisterExport(mod.id, rows, { summary: true });
    const tableRows = prepared.mode === "table" ? prepared.rows : rows;
    const columns =
      prepared.columns ||
      (Array.isArray(cfg.columns) && cfg.columns.length > 0 ? cfg.columns : inferRegisterColumns(tableRows));
    if (y > PAGE_H - 72 && index > 0) {
      pdf.addPage();
      y = drawPdfPageHeader(pdf, {
        org,
        title: bundleTitle,
        subtitle: "Continued",
        rgb,
        accentRgb,
        theme,
        docRef,
      });
      y = drawPdfMetaStrip(pdf, org, { moduleLabel: bundleTitle, recordNote: "Continued" }, rgb, y);
      y += 2;
    }
    const pres = getModuleTilePresentation(mod.id, { count: tableRows.length });
    y = drawRegisterHeroBlock(pdf, {
      org,
      moduleLabel: mod.label,
      rows: tableRows,
      rgb,
      accentRgb,
      theme,
      smartText: pres.smartText,
      yStart: y,
    });
    y = renderRegisterTable(pdf, {
      rows: tableRows,
      columns,
      sectionTitle: mod.label,
      org,
      rgb,
      accentRgb,
      theme,
      startY: y,
    });
    y += 4;
  });

  finalizePdf(pdf, org, theme, rgb, accentRgb);
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
  const { theme, rgb, accentRgb } = pdfBrandingContext(org);
  const label = opts.label || humanizeKey(moduleId);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  await ensurePdfUnicodeFont(pdf);
  const docRef = buildDocReference(org, label);

  if (cfg.overview && rows.length === 0) {
    renderModuleOverviewPage(pdf, moduleId, label, org, rgb, accentRgb, theme);
    finalizePdf(pdf, org, theme, rgb, accentRgb);
    const slug = sanitizePdfFileSegment(label, 36) || sanitizePdfFileSegment(moduleId, 36) || "module";
    const fileName = buildFileName(org, slug);
    try {
      await savePdf(pdf, fileName);
    } catch {
      return { ok: false, error: "download_blocked" };
    }
    return { ok: true, fileName, rows: 0, overview: true };
  }

  const prepared = prepareRegisterExport(moduleId, rows, { summary: opts.summary === true });
  const filterSuffix = opts.filterNote ? ` · ${opts.filterNote}` : rows.length !== storedRows.length ? ` · ${rows.length} of ${storedRows.length} shown` : "";
  const baseSubtitle = org.pdfHeader ? String(org.pdfHeader).slice(0, 90) : "Register export · audit-ready";

  const headerMeta = {
    org,
    title: label,
    subtitle: `${baseSubtitle}${filterSuffix}`.slice(0, 120),
    rgb,
    accentRgb,
    theme,
    docRef,
  };

  if (prepared.mode === "detail" && moduleId === "daily-briefing") {
    renderDailyBriefingDetailPages(pdf, prepared.rows, {
      drawPdfPageHeader: (doc, meta) => drawPdfPageHeader(doc, { ...meta, accentRgb, docRef }),
      renderRegisterTable,
      org,
      rgb,
      accentRgb,
      theme,
      label,
    });
  } else if (prepared.mode === "detail" && moduleId === "geo-photos") {
    renderGeoPhotoDetailPages(pdf, prepared.rows, {
      drawPdfPageHeader: (doc, meta) => drawPdfPageHeader(doc, { ...meta, accentRgb, docRef }),
      renderRegisterTable,
      org,
      rgb,
      accentRgb,
      theme,
      label,
    });
  } else {
    const tableRows = prepared.mode === "table" ? prepared.rows : rows;
    const columns =
      prepared.columns ||
      (Array.isArray(cfg.columns) && cfg.columns.length > 0 ? cfg.columns : inferRegisterColumns(tableRows));
    const pres = getModuleTilePresentation(moduleId, { count: tableRows.length });
    let y = drawPdfPageHeader(pdf, headerMeta);
    y = drawPdfMetaStrip(
      pdf,
      org,
      {
        moduleLabel: label,
        docRef,
        recordNote: `${tableRows.length} record(s)`,
      },
      rgb,
      y
    );
    y = drawRegisterHeroBlock(pdf, {
      org,
      moduleLabel: label,
      rows: tableRows,
      rgb,
      accentRgb,
      theme,
      smartText: pres.smartText,
      yStart: y,
    });
    renderRegisterTable(pdf, {
      rows: tableRows,
      columns,
      sectionTitle: label,
      org,
      rgb,
      accentRgb,
      theme,
      startY: y,
      prebuildLabel: pres.prebuild?.shortLabel || pres.prebuild?.label,
    });
  }

  finalizePdf(pdf, org, theme, rgb, accentRgb);

  const slug = sanitizePdfFileSegment(label, 36) || sanitizePdfFileSegment(moduleId, 36) || "register";
  const fileName = buildFileName(org, slug);
  await savePdf(pdf, fileName);
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
  const { theme, rgb, accentRgb } = pdfBrandingContext(org);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  await ensurePdfUnicodeFont(pdf);

  renderModulesIntoPdf(pdf, {
    org,
    rgb,
    accentRgb,
    theme,
    bundleTitle: section.title || "Modules",
    bundleSubtitle: `${modules.length} register export(s) · full compliance pack`,
    modules,
  });

  const slug = sanitizePdfFileSegment(section.title, 32) || "section";
  const fileName = buildFileName(org, slug);
  await savePdf(pdf, fileName);
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
