/**
 * Org-exclusive print theme for Utility Mapping survey / GPR / RAMS / MS / PTW.
 * Navy + cyan body chrome so interior pages match the PAS128 branded covers.
 * Never applied for other organisations.
 */
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { UTILITY_MAPPING_BRAND } from "./utilityMappingBranding";

export function isUtilityMappingPrintTheme() {
  return isUtilityMappingOrg();
}

/**
 * Interior-page body theme — TOC, H2 rails, callouts, tables, signatures, disclaimer.
 * Shared across survey / GPR / RAMS / MS / permits when UM is active.
 */
export function utilityMappingBodyPrintCss(
  primary = UTILITY_MAPPING_BRAND.primaryColor,
  accent = UTILITY_MAPPING_BRAND.accentColor
) {
  if (!isUtilityMappingPrintTheme()) return "";
  return `
  /* —— Contents —— */
  .sr-toc, .gpr-toc, .um-toc-page .sr-toc {
    page-break-after: always;
    break-after: page;
    padding: 8px 0 12px;
    border: none;
  }
  .sr-toc-heading, .gpr-toc h2, .um-toc-page h2 {
    color: ${primary};
    font-size: 14pt;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-bottom: 3px solid ${accent};
    padding-bottom: 8px;
    margin: 0 0 16px;
  }
  .sr-toc a, .gpr-toc a {
    color: ${primary};
    font-weight: 600;
  }
  .sr-toc-dots { border-bottom-color: ${accent}66 !important; }
  .sr-toc li::before, .gpr-toc li::marker {
    color: ${accent};
    font-weight: 800;
  }

  /* —— Section headings —— */
  .sr-section h2, .gpr-section h2, .gpr-sec h2 {
    color: ${primary};
    border-bottom: none;
    border-left: 4px solid ${accent};
    padding: 4px 0 4px 12px;
    margin: 18px 0 10px;
    font-size: 12pt;
    font-weight: 800;
    letter-spacing: 0.02em;
    background: linear-gradient(90deg, ${accent}14 0%, transparent 70%);
  }
  .print-section-title {
    color: ${primary} !important;
    border-bottom: 2px solid ${accent} !important;
    font-weight: 800 !important;
    letter-spacing: 0.03em;
    padding-bottom: 4px !important;
  }

  /* —— Tables —— */
  .sr-data-table th, .gpr-data-table th,
  table.fess-ms th, table.signatures th,
  .um-ms-body table thead th,
  .rams-content h1 {
    background: ${primary} !important;
    color: #fff !important;
    border-color: ${primary} !important;
  }
  .sr-data-table td, .gpr-data-table td {
    border-color: #cbd5e1;
  }
  .sr-data-table tr:nth-child(even) td, .gpr-data-table tr:nth-child(even) td {
    background: ${accent}0d;
  }

  /* —— Callouts —— */
  .sr-callout, .gpr-callout {
    background: ${accent}12 !important;
    border: 1px solid ${accent}55 !important;
    border-left: 4px solid ${accent} !important;
    border-radius: 6px;
  }
  .sr-callout-title, .gpr-callout-title {
    color: ${primary} !important;
  }
  .sr-callout--records {
    background: #f0f9ff !important;
    border-color: ${accent}66 !important;
    border-left-color: ${accent} !important;
  }
  .sr-callout--records .sr-callout-title { color: ${primary} !important; }
  .sr-callout--diff {
    background: #f8fafc !important;
    border-color: ${primary}33 !important;
    border-left-color: ${primary} !important;
  }
  .sr-callout--diff .sr-callout-title { color: ${primary} !important; }

  /* —— Signatures —— */
  .sr-signatures, .um-sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 12px;
  }
  .sr-sig-box, .um-sig-box {
    border: 1.5px solid ${accent} !important;
    border-radius: 8px !important;
    padding: 12px !important;
    min-height: 96px;
    background: linear-gradient(180deg, #fff 0%, ${accent}0a 100%);
  }
  .sr-sig-label, .um-sig-label {
    color: ${accent} !important;
    font-weight: 800 !important;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 8pt !important;
  }
  .sr-sig-line {
    border-bottom-color: ${primary} !important;
  }
  table.signatures th { background: ${primary}; color: #fff; }
  table.signatures td.um-dc-sign,
  .um-sig-hatch {
    background: repeating-linear-gradient(
      -45deg, #f8fafc, #f8fafc 6px, #f1f5f9 6px, #f1f5f9 12px
    );
    min-height: 40px;
  }

  /* —— Disclaimer / end matter —— */
  .sr-disclaimer, .gpr-footer-note {
    border-left: 4px solid ${accent} !important;
    background: ${primary}08 !important;
    color: #334155 !important;
    padding: 10px 12px !important;
    border-radius: 0 6px 6px 0;
    font-size: 8.5pt !important;
  }

  /* —— Meta cells (MS / generic) —— */
  .um-ms-body .hcell, .hcell.um-branded {
    border-color: ${accent}44 !important;
    border-left: 3px solid ${accent} !important;
  }
  .um-ms-body .hcell .l, .hcell.um-branded .l {
    color: ${accent} !important;
  }

  /* —— RAMS body —— */
  .rams-content table.header-table {
    border: 1px solid ${accent}55;
    border-radius: 8px;
    overflow: hidden;
  }
  .rams-content table.header-table td {
    border-color: ${accent}33;
  }
  .rams-content table.header-table .lbl {
    color: ${accent};
    font-weight: 700;
  }
  .rams-content h1 {
    border-radius: 6px;
    padding: 8px 12px !important;
  }

  /* —— QL / method pills in body —— */
  .sr-ql-badge, .sr-ql-pill, .gpr-badge {
    border-color: ${accent} !important;
    color: ${primary} !important;
  }

  @media print {
    .sr-section h2, .sr-callout, .sr-data-table th, .sr-sig-box,
    .gpr-section h2, .gpr-data-table th, .print-section-title,
    .rams-content h1, table.signatures th {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;
}

/** Extra CSS injected into survey report print HTML when Utility Mapping is active. */
export function utilityMappingSurveyCoverCss(primary = UTILITY_MAPPING_BRAND.primaryColor, accent = UTILITY_MAPPING_BRAND.accentColor) {
  return `
  .sr-cover.sr-cover--um {
    background: linear-gradient(160deg, ${primary} 0%, #061428 48%, #0a2744 100%);
    color: #f8fafc;
    border: none;
    padding: 28px 32px;
    position: relative;
    overflow: hidden;
  }
  .sr-cover.sr-cover--um::before {
    content: "";
    position: absolute;
    inset: auto -20% -30% 40%;
    height: 70%;
    background: radial-gradient(ellipse at center, ${accent}33 0%, transparent 70%);
    pointer-events: none;
  }
  .sr-cover.sr-cover--um .sr-cover-org-name { color: #fff; font-size: 16pt; letter-spacing: 0.02em; }
  .sr-cover.sr-cover--um .sr-cover-org-sub { color: ${accent}; }
  .sr-cover.sr-cover--um .sr-cover-title { color: #fff; border-left: 4px solid ${accent}; padding-left: 14px; }
  .sr-cover.sr-cover--um .sr-cover-footer { color: #94a3b8; border-top: 1px solid ${accent}55; padding-top: 10px; }
  .sr-cover.sr-cover--um .sr-meta-key { color: ${accent}; }
  .sr-cover.sr-cover--um .sr-meta-val { color: #e2e8f0; }
  .sr-cover.sr-cover--um .sr-badge--cover {
    background: ${accent};
    color: ${primary};
    border: none;
  }
  .sr-cover.sr-cover--um .sr-ql-badge {
    background: transparent;
    color: ${accent};
    border: 1px solid ${accent};
  }
  .sr-cover.sr-cover--um .sr-quality-badge {
    background: rgba(255,255,255,0.06);
  }
  .sr-cover.sr-cover--um .sr-cover-mso-label strong { color: ${accent}; }
  .sr-cover.sr-cover--um .sr-cover-mso-label span { color: #94a3b8; }
  .sr-cover.sr-cover--um .sr-cover-photo figcaption,
  .sr-cover.sr-cover--um .sr-cover-map figcaption { color: #94a3b8; }
  ${utilityMappingBodyPrintCss(primary, accent)}
`;
}

/** Extra CSS for GPR report print HTML when Utility Mapping is active. */
export function utilityMappingGprCoverCss(primary = UTILITY_MAPPING_BRAND.primaryColor, accent = UTILITY_MAPPING_BRAND.accentColor) {
  return `
  .gpr-cover.gpr-cover--um {
    background: linear-gradient(160deg, ${primary} 0%, #061428 48%, #0a2744 100%);
    color: #f8fafc;
    padding: 28px 32px;
  }
  .gpr-cover.gpr-cover--um .gpr-cover-title { color: #fff; border-left: 4px solid ${accent}; padding-left: 14px; }
  .gpr-cover.gpr-cover--um .gpr-cover-stat {
    background: ${accent};
    color: ${primary};
  }
  .gpr-cover.gpr-cover--um .gpr-meta-key { color: ${accent}; }
  .gpr-cover.gpr-cover--um .gpr-meta-val { color: #e2e8f0; }
  .gpr-cover.gpr-cover--um .gpr-badge {
    background: transparent;
    color: ${accent};
    border: 1px solid ${accent};
  }
  ${utilityMappingBodyPrintCss(primary, accent)}
`;
}

/** Combined CSS bundle for RAMS / MS / PTW print shells. */
export function utilityMappingPrintBundleCss(
  primary = UTILITY_MAPPING_BRAND.primaryColor,
  accent = UTILITY_MAPPING_BRAND.accentColor
) {
  if (!isUtilityMappingPrintTheme()) return "";
  // Cover system is imported by callers; this is body-only for when covers CSS is separate.
  return utilityMappingBodyPrintCss(primary, accent);
}

/**
 * Kit chips for the cover strip (detection methods / standards).
 * @param {{ pas128Method?: string, surveyType?: string, kitChips?: string[] }} reportOrOpts
 * @returns {string[]}
 */
export function utilityMappingCoverKitChips(reportOrOpts = {}) {
  if (Array.isArray(reportOrOpts.kitChips) && reportOrOpts.kitChips.length) {
    return reportOrOpts.kitChips.map((c) => String(c).trim()).filter(Boolean).slice(0, 8);
  }
  const method = String(reportOrOpts.pas128Method || "").toUpperCase();
  const type = String(reportOrOpts.surveyType || "").toLowerCase();
  const chips = ["PAS 128:2014"];
  if (type.includes("gpr") || method.includes("GPR")) {
    chips.push("GPR");
  } else if (type.includes("eml") || type.includes("cat")) {
    chips.push("EML / CAT");
  } else if (type.includes("topo")) {
    chips.push("Topographical", "EML", "GPR");
  } else {
    chips.push("EML", "GPR");
  }
  if (method.includes("M2P") || method.includes("M4P")) chips.push("Post-process");
  if (method.includes("M4") || method.includes("M3")) chips.push("Verification");
  chips.push("OSGB36");
  return [...new Set(chips)].slice(0, 7);
}
