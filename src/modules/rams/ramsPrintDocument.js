/**
 * RAMS print document shell (HTML wrapper + shared A4 CSS).
 * Kept separate from ramsPrintHtml to avoid a circular import with fessRamsPrintHtml.
 */
import { safeCssColor } from "../../utils/htmlEscape.js";
import { renderMySafeOpsMarkSvg, printDocTheme } from "../../utils/pdfBranding.js";
import { getActiveDocumentLocale } from "../../utils/countryWorkspaces.js";

function escHtml(s) {
  if (s == null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ramsPrintTheme(themeOrPrimary) {
  if (themeOrPrimary && typeof themeOrPrimary === "object") {
    const orgLike = themeOrPrimary.org || themeOrPrimary;
    const themed = orgLike.primaryColor || orgLike.accentColor ? printDocTheme(orgLike) : null;
    return {
      primary: safeCssColor(themed?.primary ?? themeOrPrimary.primaryColor, "#0C447C"),
      accent: safeCssColor(themed?.accent ?? themeOrPrimary.accentColor, "#f97316"),
      complianceLine: String(
        themeOrPrimary.complianceLine ??
          orgLike.pdfComplianceLine ??
          ""
      ).trim(),
    };
  }
  return {
    primary: safeCssColor(themeOrPrimary, "#0C447C"),
    accent: "#f97316",
    complianceLine: "",
  };
}

function ramsDocumentCss(themeOrPrimary = "#0C447C") {
  const { primary } = ramsPrintTheme(themeOrPrimary);
  return `
    /* Bottom @page margin reserves room for the fixed .page-footer on every
       printed page — body padding only affects the very last page since the
       body is one continuous flow, so it cannot clear a repeating footer. */
    @page { size: A4; margin: 12mm 12mm 20mm; }
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",Arial,sans-serif;font-size:12px;line-height:1.45;color:#0f172a;margin:0;padding:16px 16px 52px;position:relative}
    p,li,span,td,th{overflow-wrap:anywhere;word-break:break-word}
    img,svg{max-width:100%;height:auto}
    a{word-break:break-all}
    h1{font-size:16px;font-weight:bold;text-align:center;background:${primary};color:#fff;padding:10px;margin:0 0 16px}
    .header-table{width:100%;border-collapse:collapse;margin-bottom:16px}
    .header-table td{padding:4px 8px;font-size:11px;border:0.5px solid #ccc}
    .header-table .lbl{color:${primary};font-weight:bold}
    table{table-layout:fixed}
    table.ra{width:100%;border-collapse:collapse;margin-bottom:20px}
    table.ra th{background:${primary};color:#fff;padding:8px;font-size:11px;text-align:left;border:1px solid ${primary}}
    table.ra tr,table.fess-rams-ra tr{break-inside:avoid-page;page-break-inside:avoid}
    .rams-watermark{
      position:fixed;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      pointer-events:none;
      font-size:84px;
      font-weight:800;
      letter-spacing:0.14em;
      color:rgba(100,116,139,0.10);
      transform:rotate(-28deg);
      z-index:0;
      text-transform:uppercase;
    }
    .rams-content{position:relative;z-index:1;padding-bottom:28px}
    .cover-page{
      position:relative;
      border:1px solid #dbe2ea;
      border-radius:14px;
      padding:22px 22px 20px;
      background:linear-gradient(180deg,#f8fbff 0%,#ffffff 62%);
      margin-bottom:12px;
    }
    .cover-meta{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
      margin-top:14px;
    }
    .cover-kpi{
      border:1px solid #e5e7eb;
      border-radius:8px;
      padding:6px 8px;
      background:#fff;
      font-size:11px;
      break-inside:avoid-page;
      page-break-inside:avoid;
    }
    .pack-site-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
    .page-footer{
      position:fixed;
      left:0;
      right:0;
      bottom:0;
      padding:6px 16px 8px;
      font-size:10px;
      color:#64748b;
      border-top:2px solid ${primary};
      background:#fff;
      display:flex;
      justify-content:space-between;
      align-items:center;
      z-index:9998;
    }
    /* The footer deliberately carries no page number. CSS page counters only resolve
       inside @page margin boxes, which Chrome does not implement for HTML content, so
       the previous counter printed "Page 0" on every page of every RAMS pack. A wrong
       page number on a controlled safety document is worse than none; the browser's
       own print footer supplies real numbering. */
    h1,h2,h3{break-after:avoid-page;page-break-after:avoid}
    .header-table,.cover-page,.pack-site-summary{break-inside:avoid-page;page-break-inside:avoid}
    @media print{
      body{padding:0}
      .rams-content{padding-bottom:6mm}
      .cover-page{min-height:248mm;page-break-after:always}
      .cover-page,.cover-page div[style*="linear-gradient"]{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .pack-rams{page-break-after:always}
      .pack-permit-wrap{page-break-before:always}
      .pack-site-summary-grid{grid-template-columns:1fr}
      h1,h2,.header,.ptw-type{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  `;
}

export function wrapRamsPrintDocument(pageTitle, bodyInner, extraHeadCss = "", footerMeta = "", themeOrPrimary = "#0C447C") {
  const theme = ramsPrintTheme(themeOrPrimary);
  const complianceHtml = theme.complianceLine
    ? `<div style="font-size:9px;color:#94a3b8;margin-top:2px;max-width:72vw">${escHtml(theme.complianceLine)}</div>`
    : "";
  return `<!DOCTYPE html><html lang="${getActiveDocumentLocale()}"><head><meta charset="utf-8"/><title>${escHtml(pageTitle)}</title>
  <style>${ramsDocumentCss(themeOrPrimary)}${extraHeadCss || ""}</style></head><body>${bodyInner}
  <div class="page-footer"><span>${escHtml(footerMeta)}${complianceHtml}</span><span style="display:inline-flex;align-items:center;gap:5px">${renderMySafeOpsMarkSvg(16)}</span></div>
  </body></html>`;
}
