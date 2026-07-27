/**
 * Shared premium print/PDF branding — org logo, MySafeOps mark, meta strips, footers.
 */
import { hexToRgb as hexToRgbBase, shadeHex } from "./orgBrandingTheme";
import { formatCustomFieldsLine, renderCustomFieldsHtml } from "./orgCustomFields.js";
import { escapeHtml, escapeAttr, safeCssColor, safeImageSrc } from "./htmlEscape.js";
import { setPdfFont } from "./pdfUnicodeFont.js";

import { todayLocalISO } from "./localDate";
export { setPdfFont, ensurePdfUnicodeFont, PDF_FONT_FAMILY } from "./pdfUnicodeFont.js";

export const PDF_PAGE = {
  W: 210,
  H: 297,
  MARGIN: 12,
  FOOTER_H: 16,
  HEADER_H: 50,
  META_STRIP_H: 20,
  RIGHT_COL_W: 46,
  CONTENT_BOTTOM: 297 - 16 - 10,
};

export function hexToRgb(hex) {
  return hexToRgbBase(hex);
}

export function getPdfTheme(org) {
  const raw = String(org?.pdfTheme || "executive").toLowerCase();
  return raw === "classic" ? "classic" : "executive";
}

export function logoImageFormat(dataUrl) {
  const s = String(dataUrl || "").toLowerCase();
  if (s.includes("image/png") || s.includes("png")) return "PNG";
  if (s.includes("image/jpeg") || s.includes("image/jpg") || s.includes("jpeg")) return "JPEG";
  if (s.includes("image/webp")) return "WEBP";
  return "PNG";
}

/** @param {import("jspdf").jsPDF} pdf */
export function tryAddLogo(pdf, org, x, y, maxW = 22, maxH = 12) {
  const logo = org?.logo;
  if (!logo || !String(logo).startsWith("data:image")) return 0;
  try {
    pdf.addImage(String(logo), logoImageFormat(logo), x, y, maxW, maxH, undefined, "FAST");
    return maxW + 4;
  } catch {
    return 0;
  }
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawBrandGradientBar(pdf, y, rgb, accentRgb, width, height = 3.5) {
  const [r, g, b] = rgb;
  const [ar, ag, ab] = accentRgb;
  const half = width / 2;
  pdf.setFillColor(r, g, b);
  pdf.rect(PDF_PAGE.MARGIN, y, half, height, "F");
  pdf.setFillColor(ar, ag, ab);
  pdf.rect(PDF_PAGE.MARGIN + half, y, half, height, "F");
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawMySafeOpsBadgeJsPdf(pdf, rightX, topY, rgb, accentRgb) {
  const w = 36;
  const h = 11;
  const x = rightX - w;
  const [r, g, b] = rgb;
  const [ar] = accentRgb;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(0.35);
  pdf.roundedRect(x, topY, w, h, 2, 2, "FD");
  pdf.setFillColor(r, g, b);
  pdf.roundedRect(x + 2, topY + 2.2, 4.2, 4.2, 0.9, 0.9, "F");
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.55);
  pdf.line(x + 3.1, topY + 4.8, x + 4.4, topY + 6.1);
  pdf.line(x + 4.4, topY + 6.1, x + 6.2, topY + 3.8);
  setPdfFont(pdf, "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(r, g, b);
  pdf.text("MySafeOps", x + 8, topY + 5.8);
  setPdfFont(pdf, "normal");
  pdf.setFontSize(5.2);
  pdf.setTextColor(ar ?? 100, accentRgb[1] ?? 116, accentRgb[2] ?? 139);
  pdf.text("mysafeops.com", x + 8, topY + 8.6);
  return { x, y: topY, w, h };
}

export function formatPdfTimestamp(date = new Date()) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildDocReference(org, moduleLabel) {
  const prefix = String(org?.pdfVersionPrefix || "MSO").trim() || "MSO";
  const slug = String(moduleLabel || "DOC")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 8)
    .toUpperCase();
  const stamp = todayLocalISO().replace(/-/g, "");
  return `${prefix}-${slug}-${stamp}`;
}

/** @param {Record<string, unknown>[]} rows */
export function summarizeRegisterStats(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byStatus = {};
  list.forEach((row) => {
    const s = String(row?.status || row?.result || "record").toLowerCase();
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  return { total: list.length, byStatus };
}

/** @param {import("jspdf").jsPDF} pdf */
export function pdfTextBlock(pdf, text, x, y, maxW, lineH = 4) {
  const lines = pdf.splitTextToSize(String(text || ""), maxW);
  pdf.text(lines, x, y);
  return y + lines.length * lineH;
}

/**
 * Premium jsPDF page header — org logo, MySafeOps badge, doc meta.
 * @param {import("jspdf").jsPDF} pdf
 */
export function drawPremiumPdfHeader(pdf, meta, yStart = PDF_PAGE.MARGIN) {
  const { org, rgb, accentRgb, theme } = meta;
  const [r, g, b] = rgb;
  const pageW = PDF_PAGE.W;
  const margin = PDF_PAGE.MARGIN;
  const contentW = pageW - margin * 2;
  const rightColW = PDF_PAGE.RIGHT_COL_W;
  const leftMaxW = contentW - rightColW - 2;

  drawBrandGradientBar(pdf, yStart, rgb, accentRgb, contentW, theme === "executive" ? 4 : 2.5);
  const barH = theme === "executive" ? 4 : 2.5;
  const bodyY = yStart + barH + 3;

  let textX = margin;
  const logoW = tryAddLogo(
    pdf,
    org,
    margin,
    bodyY,
    theme === "executive" ? 24 : 20,
    theme === "executive" ? 12 : 10
  );
  if (logoW > 0) textX = margin + logoW;

  const rightX = pageW - margin;
  drawMySafeOpsBadgeJsPdf(pdf, rightX, bodyY, rgb, accentRgb);

  const stamp = formatPdfTimestamp();
  const docRef = meta.docRef || buildDocReference(org, meta.title);
  setPdfFont(pdf, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text(stamp, rightX, bodyY + 13, { align: "right" });
  setPdfFont(pdf, "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(r, g, b);
  pdf.text(docRef, rightX, bodyY + 17, { align: "right" });

  let y = bodyY + 5.5;
  setPdfFont(pdf, "bold");
  pdf.setFontSize(theme === "executive" ? 12.5 : 11);
  pdf.setTextColor(theme === "classic" ? 0 : 15, theme === "classic" ? 0 : 23, theme === "classic" ? 0 : 42);
  y = pdfTextBlock(pdf, String(org?.name || "MySafeOps").slice(0, 56), textX, y, leftMaxW, 4.2);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  const headerLine = org?.pdfHeader ? String(org.pdfHeader).slice(0, 90) : "UK construction & site safety workspace";
  y = pdfTextBlock(pdf, headerLine, textX, y + 1, leftMaxW, 3.8);

  const customLine = formatCustomFieldsLine(org?.customFields, 3);
  if (customLine) {
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    y = pdfTextBlock(pdf, customLine.slice(0, 120), textX, y + 1, leftMaxW, 3.2);
  }

  setPdfFont(pdf, "bold");
  pdf.setFontSize(theme === "executive" ? 10 : 9.5);
  pdf.setTextColor(r, g, b);
  y = pdfTextBlock(pdf, String(meta.title || "Document").slice(0, 72), textX, y + 1, leftMaxW, 4);

  let endY = y;
  if (meta.subtitle) {
    setPdfFont(pdf, "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    endY = pdfTextBlock(pdf, String(meta.subtitle).slice(0, 100), textX, y + 0.5, leftMaxW, 3.6);
  }

  return Math.max(yStart + PDF_PAGE.HEADER_H, bodyY + 22, endY + 4);
}

/**
 * Grey meta strip under header — org contact + document facts.
 * @param {import("jspdf").jsPDF} pdf
 */
export function drawPdfMetaStrip(pdf, org, docMeta, rgb, yStart) {
  const margin = PDF_PAGE.MARGIN;
  const w = PDF_PAGE.W - margin * 2;
  const h = PDF_PAGE.META_STRIP_H;
  const [r, g, b] = rgb;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(margin, yStart, w, h, 2, 2, "FD");

  pdf.setFillColor(r, g, b);
  pdf.rect(margin, yStart, 1.2, h, "F");

  const colW = w / 3;
  const rows = [
    {
      label: "Organisation",
      value: [org?.address, org?.email, org?.phone].filter(Boolean).join(" · ") || org?.name || "—",
    },
    {
      label: "Document",
      value: [docMeta?.moduleLabel, docMeta?.recordNote].filter(Boolean).join(" · ") || "Controlled register export",
    },
    {
      label: "Generated",
      value: `${formatPdfTimestamp()} · ${docMeta?.docRef || buildDocReference(org, docMeta?.moduleLabel)}`,
    },
  ];

  rows.forEach((col, i) => {
    const x = margin + 4 + i * colW;
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6);
    pdf.setTextColor(r, g, b);
    pdf.text(col.label.toUpperCase(), x, yStart + 4.5);
    setPdfFont(pdf, "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(51, 65, 85);
    const lines = pdf.splitTextToSize(String(col.value).slice(0, 140), colW - 8);
    pdf.text(lines.slice(0, 3), x, yStart + 8.5);
  });

  return yStart + h + 5;
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawRegisterHeroBlock(pdf, opts) {
  const { org, moduleLabel, rows, rgb, accentRgb, theme, smartText, yStart } = opts;
  const margin = PDF_PAGE.MARGIN;
  const w = PDF_PAGE.W - margin * 2;
  const stats = summarizeRegisterStats(rows);
  const [r, g, b] = rgb;
  const tipLines = smartText ? pdf.splitTextToSize(String(smartText).slice(0, 180), w - 14) : [];
  const blockH = theme === "executive" ? 24 + Math.min(tipLines.length, 2) * 3.5 : 22 + Math.min(tipLines.length, 2) * 3.5;
  let y = yStart;

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(0.45);
  pdf.roundedRect(margin, y, w, blockH, 3, 3, "S");
  pdf.setFillColor(r, g, b);
  pdf.rect(margin, y, 2.5, blockH, "F");

  setPdfFont(pdf, "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(String(moduleLabel || "Register"), margin + 6, y + 7);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`${stats.total} record(s) in ${String(org?.name || "organisation").slice(0, 40)}`, margin + 6, y + 12);

  if (smartText && tipLines.length) {
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(tipLines.slice(0, 2), margin + 6, y + 17);
  }

  const statusEntries = Object.entries(stats.byStatus).slice(0, 4);
  let chipX = margin + 6;
  const chipY = y + blockH - 4.5;
  statusEntries.forEach(([status, count], idx) => {
    const label = `${status} ${count}`;
    const chipW = pdf.getTextWidth(label) + 6;
    const fill = idx % 2 === 0 ? [r, g, b] : accentRgb;
    pdf.setFillColor(...fill);
    pdf.roundedRect(chipX, chipY - 3.5, chipW, 5, 1.2, 1.2, "F");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(6);
    pdf.setTextColor(255, 255, 255);
    pdf.text(label, chipX + 3, chipY);
    chipX += chipW + 3;
  });

  return y + blockH + 5;
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawEmptyRegisterState(pdf, opts) {
  const { org, moduleLabel, rgb, accentRgb, prebuildLabel, yStart } = opts;
  const margin = PDF_PAGE.MARGIN;
  const w = PDF_PAGE.W - margin * 2;
  const h = 42;
  const [r, g, b] = rgb;
  let y = yStart;

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, w, h, 4, 4, "FD");

  pdf.setFillColor(r, g, b);
  pdf.circle(margin + 10, y + 12, 5, "F");
  setPdfFont(pdf, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text("0", margin + 10, y + 13.2, { align: "center" });

  setPdfFont(pdf, "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`No ${String(moduleLabel || "register").toLowerCase()} records yet`, margin + 20, y + 10);

  setPdfFont(pdf, "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(71, 85, 105);
  const msg = pdf.splitTextToSize(
    "This export was generated from your organisation workspace. Add entries in MySafeOps, then export again for a full audit-ready register.",
    w - 28
  );
  pdf.text(msg, margin + 20, y + 16);

  if (prebuildLabel) {
    pdf.setFillColor(...accentRgb);
    pdf.roundedRect(margin + 20, y + 28, Math.min(w - 24, pdf.getTextWidth(prebuildLabel) + 10), 6, 1.5, 1.5, "F");
    setPdfFont(pdf, "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Quick start: ${prebuildLabel}`.slice(0, 70), margin + 25, y + 32);
  }

  setPdfFont(pdf, "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  const contact = [org?.email, org?.website].filter(Boolean).join(" · ");
  if (contact) pdf.text(contact.slice(0, 90), margin + 20, y + 38);

  return y + h + 6;
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawPremiumPdfFooter(pdf, org, pageNum, pageTotal, theme, rgb, accentRgb) {
  const y = PDF_PAGE.H - PDF_PAGE.FOOTER_H;
  const margin = PDF_PAGE.MARGIN;
  const contentW = PDF_PAGE.W - margin * 2;
  const [r, g, b] = rgb;

  if (theme === "executive") {
    drawBrandGradientBar(pdf, y - 2.5, rgb, accentRgb, contentW, 0.7);
  } else {
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y - 2, PDF_PAGE.W - margin, y - 2);
  }

  setPdfFont(pdf, "normal");
  pdf.setFontSize(6.8);
  pdf.setTextColor(71, 85, 105);
  const footer = org?.pdfFooter || "Generated by MySafeOps — mysafeops.com";
  const footerLines = pdf.splitTextToSize(String(footer).slice(0, 120), contentW - 28);
  pdf.text(footerLines.slice(0, 2), margin, y + 2);

  const compliance = String(org?.pdfComplianceLine || "").trim();
  if (compliance) {
    pdf.setFontSize(6.2);
    pdf.setTextColor(148, 163, 184);
    const compLines = pdf.splitTextToSize(compliance.slice(0, 120), contentW - 28);
    pdf.text(compLines.slice(0, 1), margin, y + 2 + footerLines.length * 3.2);
  }

  setPdfFont(pdf, "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(r, g, b);
  pdf.text("MySafeOps", PDF_PAGE.W - margin, y + 2, { align: "right" });
  setPdfFont(pdf, "normal");
  pdf.setFontSize(6.2);
  pdf.setTextColor(148, 163, 184);
  pdf.text("mysafeops.com", PDF_PAGE.W - margin, y + 5.5, { align: "right" });
  setPdfFont(pdf, "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(r, g, b);
  pdf.text(`Page ${pageNum} of ${pageTotal}`, PDF_PAGE.W - margin, y + 10.5, { align: "right" });
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawWatermark(pdf, org) {
  const text = String(org?.pdfWatermarkText || "").trim();
  if (!text) return;
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    try {
      if (typeof pdf.saveGraphicsState === "function") pdf.saveGraphicsState();
      pdf.setTextColor(220, 220, 220);
      setPdfFont(pdf, "bold");
      pdf.setFontSize(42);
      pdf.text(text.toUpperCase(), PDF_PAGE.W / 2, PDF_PAGE.H / 2, {
        align: "center",
        angle: 35,
      });
      if (typeof pdf.restoreGraphicsState === "function") pdf.restoreGraphicsState();
    } catch {
      /* optional */
    }
  }
}

// ─── HTML print branding (permits, RAMS, briefings, etc.) ─────────────────────

export function renderMySafeOpsMarkSvg(size = 26) {
  const h = Math.round(size * (50 / 44));
  return `<svg width="${size}" height="${h}" viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink:0">
    <path d="M2 14C2 10.5 4 8.5 6 7.8L20 2C21.2 1.6 22.8 1.6 24 2L38 7.8C40 8.5 42 10.5 42 14V30C42 42 24 50 22 51C20 50 2 42 2 30V14Z" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="2.5"/>
    <path d="M13 26L19 32L31 20" stroke="#f97316" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function printDocTheme(org) {
  const primary = safeCssColor(org?.primaryColor, "#0d9488");
  const accent = safeCssColor(org?.accentColor, "#f97316");
  const theme = getPdfTheme(org);
  return { primary, accent, theme, primaryDark: shadeHex(primary, -0.12) };
}

export function printDocBaseCss(org) {
  const { primary, accent, theme } = printDocTheme(org);
  return `
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #0f172a;
      margin: 0;
      padding: 16px 16px 28px;
      background: #fff;
    }
    .print-brand-stripe {
      height: 5px;
      border-radius: 999px;
      background: linear-gradient(90deg, ${primary} 0%, ${accent} 100%);
      margin: 0 0 12px;
    }
    .print-doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      flex-wrap: wrap;
      padding-bottom: 12px;
      margin-bottom: 14px;
      border-bottom: 2px solid ${primary};
    }
    .print-doc-header__brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .print-doc-header__org img {
      height: 46px;
      max-width: 130px;
      object-fit: contain;
    }
    .print-doc-header__org-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .print-doc-header__org-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .print-doc-header__title {
      font-size: 13px;
      font-weight: 800;
      color: ${primary};
      margin-top: 6px;
    }
    .print-doc-header__meta {
      text-align: right;
      font-size: 10px;
      color: #64748b;
      min-width: 140px;
    }
    .print-doc-header__badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 5px 8px;
      background: #f8fafc;
      margin-bottom: 6px;
    }
    .print-doc-header__badge strong {
      font-size: 10px;
      color: ${primary};
      letter-spacing: 0.02em;
    }
    .print-doc-header__badge span {
      font-size: 9px;
      color: #94a3b8;
      display: block;
    }
    .print-meta-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin: 0 0 16px;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid ${primary};
      border-radius: 8px;
    }
    .print-meta-strip__label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: ${primary};
      margin-bottom: 3px;
    }
    .print-meta-strip__value {
      font-size: 10px;
      color: #334155;
      line-height: 1.4;
    }
    .print-doc-footer {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 10px;
      color: #64748b;
    }
    .print-doc-footer__compliance {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 4px;
      max-width: 70%;
    }
    .print-section-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      margin: 14px 0 8px;
    }
    .print-doc-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid ${primary};
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 10px;
      color: ${primary};
      font-weight: 700;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
    }
    @media print {
      body { padding: 0 0 12mm; }
      .print-brand-stripe, .print-doc-header, .print-meta-strip, .print-doc-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    ${theme === "classic" ? ".print-doc-header { border-bottom-width: 1px; }" : ""}
  `;
}

/**
 * HTML header block for browser print exports.
 * @param {ReturnType<import("./orgSettingsStorage").getOrgSettings>} org
 */
export function renderPrintDocHeader(org, opts = {}) {
  const { primary } = printDocTheme(org);
  const logoSrc = safeImageSrc(org?.logo);
  const orgName = escapeHtml(org?.name || "MySafeOps");
  const headerLine = escapeHtml(org?.pdfHeader || "UK construction & site safety workspace");
  const docTitle = escapeHtml(opts.docTitle || "Document");
  const docSubtitle = opts.docSubtitle ? escapeHtml(opts.docSubtitle) : "";
  const docRef = escapeHtml(opts.docRef || buildDocReference(org, opts.docTitle));
  const stamp = escapeHtml(formatPdfTimestamp());
  const badge = opts.docBadge ? `<div class="print-doc-badge">${escapeHtml(opts.docBadge)}</div>` : "";
  const customFieldsHtml = renderCustomFieldsHtml(org?.customFields);

  return `${badge}
  <div class="print-brand-stripe"></div>
  <header class="print-doc-header">
    <div class="print-doc-header__brand">
      ${logoSrc ? `<div class="print-doc-header__org"><img src="${escapeAttr(logoSrc)}" alt=""/></div>` : ""}
      <div>
        <div class="print-doc-header__org-name">${orgName}</div>
        <div class="print-doc-header__org-sub">${headerLine}</div>
        <div class="print-doc-header__title">${docTitle}</div>
        ${docSubtitle ? `<div class="print-doc-header__org-sub">${docSubtitle}</div>` : ""}
      </div>
    </div>
    <div class="print-doc-header__meta">
      <div class="print-doc-header__badge">
        ${renderMySafeOpsMarkSvg(22)}
        <div><strong>MySafeOps</strong><span>mysafeops.com</span></div>
      </div>
      <div>${stamp}</div>
      <div style="font-weight:700;color:${primary};margin-top:4px">${docRef}</div>
    </div>
  </header>${customFieldsHtml}`;
}

export function renderPrintMetaStrip(org, fields = {}) {
  const orgBits = [org?.address, org?.email, org?.phone].filter(Boolean).map(escapeHtml).join(" · ");
  const docBits = [fields.moduleLabel, fields.recordNote, fields.extra]
    .filter(Boolean)
    .map((x) => escapeHtml(String(x)))
    .join(" · ");
  const docRef = escapeHtml(fields.docRef || buildDocReference(org, fields.moduleLabel));
  return `<div class="print-meta-strip">
    <div><div class="print-meta-strip__label">Organisation</div><div class="print-meta-strip__value">${orgBits || escapeHtml(org?.name || "—")}</div></div>
    <div><div class="print-meta-strip__label">Document</div><div class="print-meta-strip__value">${docBits || "Controlled site document"}</div></div>
    <div><div class="print-meta-strip__label">Reference</div><div class="print-meta-strip__value">${escapeHtml(formatPdfTimestamp())} · ${docRef}</div></div>
  </div>`;
}

export function renderPrintDocFooter(org, opts = {}) {
  const footer = escapeHtml(org?.pdfFooter || "Generated by MySafeOps — mysafeops.com");
  const compliance = escapeHtml(String(org?.pdfComplianceLine || "").trim());
  const extra = opts.extra ? escapeHtml(String(opts.extra)) : "";
  return `<footer class="print-doc-footer">
    <div>
      <div>${footer}${extra ? ` · ${extra}` : ""}</div>
      ${compliance ? `<div class="print-doc-footer__compliance">${compliance}</div>` : ""}
    </div>
    <div class="print-doc-header__badge">${renderMySafeOpsMarkSvg(20)}<div><strong>MySafeOps</strong><span>Powered export</span></div></div>
  </footer>`;
}

export function wrapPrintHtmlDocument(org, { pageTitle, bodyHtml, extraCss = "", headerOpts = {}, metaFields = {}, footerExtra = "" }) {
  const title = escapeHtml(pageTitle || "MySafeOps document");
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/>
  <title>${title}</title>
  <style>${printDocBaseCss(org)}${extraCss || ""}</style></head><body>
  ${renderPrintDocHeader(org, headerOpts)}
  ${renderPrintMetaStrip(org, { moduleLabel: headerOpts.docTitle, ...metaFields })}
  ${bodyHtml || ""}
  ${renderPrintDocFooter(org, { extra: footerExtra })}
  </body></html>`;
}
