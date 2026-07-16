/**
 * Utility Mapping print covers — real PAS128 template artwork (org-exclusive).
 * Hero + letterhead assets under /branding/utility-mapping/ — never used for other orgs.
 */
import { escapeHtml, escapeAttr, safeImageSrc } from "./htmlEscape.js";
import { isUtilityMappingPrintTheme } from "./utilityMappingPrintTheme";
import { UTILITY_MAPPING_BRAND } from "./utilityMappingBranding";

export const UM_COVER_HERO_URL = "/branding/utility-mapping/cover-hero.jpg";
export const UM_LETTERHEAD_URL = "/branding/utility-mapping/letterhead.jpg";
export const UM_LOGO_URL = "/branding/utility-mapping-logo.png";

/** Brand signal mark (three arcs under the U) — matches Utility Mapping identity. */
export function utilityMappingSignalSvg(accent = UTILITY_MAPPING_BRAND.accentColor, size = 14) {
  return `<svg class="um-signal" width="${size}" height="${Math.round(size * 0.7)}" viewBox="0 0 20 14" aria-hidden="true" focusable="false">
  <path d="M2 3.5c4.2 3.2 11.8 3.2 16 0" fill="none" stroke="${escapeAttr(accent)}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M4.5 7c3.2 2.2 7.8 2.2 11 0" fill="none" stroke="${escapeAttr(accent)}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M7 10.5c1.8 1.1 4.2 1.1 6 0" fill="none" stroke="${escapeAttr(accent)}" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
}

function umWordmarkHtml(accent = UTILITY_MAPPING_BRAND.accentColor) {
  return `<div class="um-wordmark">
  <span class="um-wordmark__utility">U<span class="um-wordmark__signal">${utilityMappingSignalSvg(accent, 12)}</span>tility</span>
  <span class="um-wordmark__mapping">MAPPING</span>
</div>`;
}

/** @returns {{ hero: string, letterhead: string, logo: string } | null} */
export function getUtilityMappingCoverAssets() {
  if (!isUtilityMappingPrintTheme()) return null;
  return {
    hero: UM_COVER_HERO_URL,
    letterhead: UM_LETTERHEAD_URL,
    logo: UM_LOGO_URL,
  };
}

/**
 * Resolve logo for print — prefer org.logo data URL, else UM public asset when exclusive.
 * @param {Record<string, unknown>} [org]
 */
export function resolveUtilityMappingLogoSrc(org = {}) {
  if (!isUtilityMappingPrintTheme()) return safeImageSrc(org?.logo) || "";
  return safeImageSrc(org?.logo) || UM_LOGO_URL;
}

function metaCells(pairs) {
  return (pairs || [])
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<div class="um-cover-meta-item"><div class="um-cover-meta-key">${escapeHtml(k)}</div><div class="um-cover-meta-val">${escapeHtml(v)}</div></div>`
    )
    .join("");
}

/**
 * Full-bleed page-1 cover matching Utility Mapping PAS128 Word/PDF templates.
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   badge?: string,
 *   methodBadge?: string,
 *   qlBadge?: string,
 *   kitChips?: string[],
 *   clientCode?: string,
 *   clientName?: string,
 *   orgName?: string,
 *   logoSrc?: string,
 *   qrSrc?: string,
 *   qrLabel?: string,
 *   meta?: Array<[string, string]>,
 *   footerNote?: string,
 * }} opts
 */
export function renderUtilityMappingHeroCover(opts = {}) {
  const assets = getUtilityMappingCoverAssets();
  if (!assets) return "";
  const logoSrc = opts.logoSrc || assets.logo;
  const primary = UTILITY_MAPPING_BRAND.primaryColor;
  const accent = UTILITY_MAPPING_BRAND.accentColor;
  const title = opts.title || "Document";
  const subtitle = opts.subtitle || "";
  const badge = opts.badge || "";
  const methodBadge = opts.methodBadge || "";
  const qlBadge = opts.qlBadge || "";
  const orgName = opts.orgName || UTILITY_MAPPING_BRAND.name;
  const chips = [methodBadge, qlBadge].filter(Boolean);
  const kit = (opts.kitChips || []).filter(Boolean).slice(0, 8);
  const kitHtml = kit.length
    ? `<div class="um-hero-cover__kit" aria-label="Survey kit">${kit
        .map((c) => `<span class="um-kit-chip">${escapeHtml(c)}</span>`)
        .join("")}</div>`
    : "";
  const clientCode = String(opts.clientCode || "").trim().toUpperCase();
  const clientLogoHtml = opts.clientLogoSrc
    ? `<div class="um-hero-cover__client"><img src="${escapeAttr(opts.clientLogoSrc)}" alt="${escapeHtml(opts.clientName || clientCode || "Client")}"/></div>`
    : "";
  const qrHtml = opts.qrSrc
    ? `<div class="um-hero-cover__qr"><img src="${escapeAttr(opts.qrSrc)}" alt="QR code"/><div>${escapeHtml(opts.qrLabel || "Scan to verify")}</div></div>`
    : "";

  return `<div class="um-hero-cover" style="--um-navy:${escapeAttr(primary)};--um-cyan:${escapeAttr(accent)}">
  <div class="um-hero-cover__photo" style="background-image:url('${escapeAttr(assets.hero)}')"></div>
  <div class="um-hero-cover__shade"></div>
  <div class="um-hero-cover__glow" aria-hidden="true"></div>
  <div class="um-hero-cover__rail" aria-hidden="true"></div>
  ${clientLogoHtml}
  <div class="um-hero-cover__top">
    <div class="um-hero-cover__brand">
      <img src="${escapeAttr(logoSrc)}" alt="${escapeAttr(orgName)}" class="um-hero-cover__logo"/>
      <div>
        <div class="um-hero-cover__org">${escapeHtml(orgName)}</div>
        <div class="um-hero-cover__org-sub">u-map.co.uk · IS GROUP</div>
      </div>
    </div>
    <div class="um-hero-cover__chips">
      ${badge ? `<span class="um-hero-cover__badge">${escapeHtml(badge)}</span>` : ""}
      ${chips.map((c) => `<span class="um-hero-cover__chip">${escapeHtml(c)}</span>`).join("")}
    </div>
  </div>
  <div class="um-hero-cover__bottom">
    ${umWordmarkHtml(accent)}
    <div class="um-hero-cover__accent-bar" aria-hidden="true"></div>
    <h1 class="um-hero-cover__title">${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="um-hero-cover__sub">${escapeHtml(subtitle)}</p>` : ""}
    ${kitHtml}
    ${opts.meta?.length ? `<div class="um-hero-cover__meta">${metaCells(opts.meta)}</div>` : ""}
    ${opts.footerNote ? `<div class="um-hero-cover__note">${escapeHtml(opts.footerNote)}</div>` : ""}
    ${qrHtml}
  </div>
</div>`;
}

/**
 * Page 2 — document control / acceptance (matches Utility Mapping PAS128 Word layout).
 * @param {{
 *   client?: string,
 *   address?: string,
 *   authors?: Array<{ name?: string, title?: string, date?: string }>,
 *   checkedBy?: { name?: string, title?: string, date?: string },
 *   logoSrc?: string,
 *   clientLogoSrc?: string,
 *   clientCode?: string,
 *   reportRef?: string,
 *   title?: string,
 * }} opts
 */
export function renderUtilityMappingDocControlPage(opts = {}) {
  if (!isUtilityMappingPrintTheme()) return "";
  const logoSrc = opts.logoSrc || UM_LOGO_URL;
  const authors = Array.isArray(opts.authors) && opts.authors.length
    ? opts.authors
    : [{ name: "—", title: "Utility Surveyor", date: "" }];
  const checked = opts.checkedBy || { name: "—", title: "Technical Manager", date: "" };
  const authorRows = authors
    .map(
      (a) => `<tr>
      <td>${escapeHtml(a.name || "—")}</td>
      <td>${escapeHtml(a.title || "Utility Surveyor")}</td>
      <td>${escapeHtml(a.date || "—")}</td>
      <td class="um-dc-sign"></td>
    </tr>`
    )
    .join("");
  const clientLogo = opts.clientLogoSrc
    ? `<div class="um-dc-client-logo"><img src="${escapeAttr(opts.clientLogoSrc)}" alt="${escapeHtml(opts.client || opts.clientCode || "Client")}"/></div>`
    : "";

  return `<div class="um-doc-control">
  ${renderUtilityMappingPageHeader(logoSrc, opts.reportRef || "")}
  <div class="um-doc-control__address">${escapeHtml(UTILITY_MAPPING_BRAND.address)}</div>
  <div class="um-doc-control__client-row">
    <div class="um-doc-control__client">
      <div class="um-doc-control__label">Client</div>
      <div class="um-doc-control__client-name">${escapeHtml(opts.client || "—")}</div>
      ${opts.title ? `<div class="um-doc-control__job">${escapeHtml(opts.title)}</div>` : ""}
      ${opts.clientCode ? `<div class="um-doc-control__code">${escapeHtml(String(opts.clientCode).toUpperCase())}</div>` : ""}
    </div>
    ${clientLogo}
  </div>
  <table class="um-dc-table">
    <thead>
      <tr><th>Name</th><th>Title</th><th>Date</th><th>Signature</th></tr>
    </thead>
    <tbody>
      <tr class="um-dc-section"><td colspan="4">Author</td></tr>
      ${authorRows}
      <tr class="um-dc-section"><td colspan="4">Checked By</td></tr>
      <tr>
        <td>${escapeHtml(checked.name || "—")}</td>
        <td>${escapeHtml(checked.title || "Technical Manager")}</td>
        <td>${escapeHtml(checked.date || "—")}</td>
        <td class="um-dc-sign"></td>
      </tr>
      <tr class="um-dc-section"><td colspan="4">Authorised for issue</td></tr>
      <tr>
        <td></td>
        <td>Approver</td>
        <td></td>
        <td class="um-dc-sign"></td>
      </tr>
      <tr class="um-dc-section"><td colspan="4">Client Acceptance</td></tr>
      <tr>
        <td></td>
        <td></td>
        <td></td>
        <td class="um-dc-sign"></td>
      </tr>
    </tbody>
  </table>
  <div class="um-doc-control__hint">Sign to confirm receipt and acceptance of this deliverable. Retain with project records.</div>
</div>`;
}

/**
 * Normalise PAS128 method / QL chips for cover (e.g. M2, M2P, QL-B).
 * @param {string} [method]
 * @param {string} [ql]
 * @returns {{ methodBadge: string, qlBadge: string }}
 */
export function utilityMappingPas128CoverBadges(method, ql) {
  const methodBadge = String(method || "")
    .trim()
    .toUpperCase()
    .replace(/^PAS\s*128\s*/i, "");
  let qlBadge = String(ql || "").trim();
  if (qlBadge && !/^QL/i.test(qlBadge) && !/^PAS/i.test(qlBadge)) {
    qlBadge = qlBadge.length <= 4 ? `QL-${qlBadge.toUpperCase()}` : qlBadge;
  }
  return { methodBadge, qlBadge };
}

/** CSS for hero cover + doc-control page + letterhead chrome (UM only). */
export function utilityMappingCoverSystemCss() {
  if (!isUtilityMappingPrintTheme()) return "";
  const primary = UTILITY_MAPPING_BRAND.primaryColor;
  const accent = UTILITY_MAPPING_BRAND.accentColor;
  return `
  .um-hero-cover {
    position: relative;
    page-break-after: always;
    break-after: page;
    min-height: 270mm;
    margin: -8mm -6mm 0;
    overflow: hidden;
    color: #fff;
    background: ${primary};
  }
  .um-hero-cover__photo {
    position: absolute;
    inset: 0 18mm 72mm 0;
    background-size: cover;
    background-position: center 30%;
    background-repeat: no-repeat;
  }
  .um-hero-cover__shade {
    position: absolute;
    inset: 0 18mm 72mm 0;
    background: linear-gradient(180deg, rgba(11,29,58,0.42) 0%, rgba(11,29,58,0.12) 38%, rgba(11,29,58,0.62) 100%);
  }
  .um-hero-cover__glow {
    position: absolute;
    right: 18mm;
    top: 18%;
    width: 55%;
    height: 42%;
    background: radial-gradient(ellipse at center, ${accent}55 0%, transparent 68%);
    pointer-events: none;
    z-index: 1;
  }
  .um-hero-cover__rail {
    position: absolute;
    top: 0; right: 0; bottom: 72mm;
    width: 18mm;
    background: linear-gradient(180deg, ${accent} 0%, #0090c0 100%);
    box-shadow: -4px 0 18px rgba(0,180,228,0.35);
  }
  .um-hero-cover__rail::after {
    content: "U";
    position: absolute;
    top: 10mm;
    left: 50%;
    transform: translateX(-50%);
    width: 12mm;
    height: 12mm;
    background: ${primary};
    color: #fff;
    border-radius: 3px;
    font-weight: 800;
    font-size: 14pt;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 12mm;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  .um-hero-cover__top {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 14mm 24mm 0 12mm;
  }
  .um-hero-cover__brand { display: flex; align-items: center; gap: 10px; }
  .um-hero-cover__logo {
    height: 44px;
    max-width: 168px;
    object-fit: contain;
    background: ${primary};
    border-radius: 4px;
    padding: 4px 6px;
    border: 1px solid rgba(255,255,255,0.12);
  }
  .um-hero-cover__org {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-shadow: 0 1px 3px rgba(0,0,0,0.45);
  }
  .um-hero-cover__org-sub {
    font-size: 7.5pt;
    color: ${accent};
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-top: 2px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.35);
  }
  .um-hero-cover__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
    max-width: 46%;
  }
  .um-hero-cover__client {
    position: absolute;
    top: 14mm;
    right: 26mm;
    z-index: 3;
  }
  .um-hero-cover__client img {
    max-height: 48px;
    max-width: 130px;
    object-fit: contain;
    background: rgba(255,255,255,0.94);
    border-radius: 6px;
    padding: 4px 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
  }
  .um-hero-cover__qr {
    position: absolute;
    right: 16px;
    bottom: 14px;
    z-index: 3;
    text-align: center;
    font-size: 7pt;
    font-weight: 600;
    color: #64748b;
    line-height: 1.2;
  }
  .um-hero-cover__qr img {
    width: 68px;
    height: 68px;
    display: block;
    margin: 0 auto 4px;
    background: #fff;
    border-radius: 4px;
    padding: 3px;
    box-shadow: 0 1px 6px rgba(11,29,58,0.12);
  }
  .um-hero-cover__badge {
    background: ${accent};
    color: ${primary};
    font-size: 8.5pt;
    font-weight: 800;
    padding: 5px 12px;
    border-radius: 999px;
    box-shadow: 0 2px 10px rgba(0,180,228,0.45);
  }
  .um-hero-cover__chip {
    background: rgba(11,29,58,0.72);
    color: #fff;
    border: 1.5px solid ${accent};
    font-size: 8.5pt;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 4px 10px;
    border-radius: 999px;
    backdrop-filter: blur(4px);
  }
  .um-hero-cover__bottom {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    z-index: 2;
    background: linear-gradient(180deg, #ffffff 0%, #f4f9fc 100%);
    color: ${primary};
    padding: 14px 18px 18px;
    min-height: 72mm;
    box-sizing: border-box;
    border-top: 3px solid ${accent};
  }
  .um-wordmark {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 18pt;
    font-weight: 800;
    letter-spacing: 0.02em;
    margin: 0 0 4px;
  }
  .um-wordmark__utility { color: ${primary}; position: relative; }
  .um-wordmark__signal {
    position: absolute;
    left: 0.5px;
    top: 72%;
    display: block;
    line-height: 0;
  }
  .um-wordmark__mapping { color: ${accent}; }
  .um-hero-cover__accent-bar {
    height: 4px;
    width: 56px;
    background: linear-gradient(90deg, ${accent}, ${primary});
    border-radius: 2px;
    margin: 0 0 10px;
  }
  .um-hero-cover__title {
    font-size: 17pt;
    font-weight: 800;
    color: ${primary};
    margin: 0 0 4px;
    line-height: 1.22;
    letter-spacing: -0.01em;
  }
  .um-hero-cover__sub {
    margin: 0 0 10px;
    font-size: 10pt;
    color: #475569;
  }
  .um-hero-cover__kit {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 10px;
  }
  .um-kit-chip {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${primary};
    background: ${accent}1a;
    border: 1px solid ${accent};
    border-radius: 4px;
    padding: 3px 8px;
  }
  .um-hero-cover__meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 14px;
    margin-top: 8px;
  }
  .um-cover-meta-key {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${accent};
    font-weight: 700;
  }
  .um-cover-meta-val {
    font-size: 9.5pt;
    color: ${primary};
    font-weight: 600;
  }
  .um-hero-cover__note {
    margin-top: 10px;
    font-size: 8pt;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
  }

  /* Page 2 — document control */
  .um-doc-control {
    page-break-after: always;
    break-after: page;
    min-height: 240mm;
    padding: 4mm 0 18mm;
  }
  .um-doc-control__address {
    font-size: 9pt;
    color: #475569;
    margin: -6px 0 18px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
  }
  .um-doc-control__client { margin: 0 0 18px; }
  .um-doc-control__client-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin: 0 0 18px;
  }
  .um-doc-control__client-row .um-doc-control__client { margin: 0; }
  .um-dc-client-logo img {
    max-height: 56px;
    max-width: 150px;
    object-fit: contain;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 6px 10px;
  }
  .um-doc-control__code {
    margin-top: 6px;
    display: inline-block;
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: ${accent};
    border: 1px solid ${accent};
    border-radius: 4px;
    padding: 2px 8px;
  }
  .um-doc-control__label {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${accent};
    margin-bottom: 4px;
  }
  .um-doc-control__client-name {
    font-size: 14pt;
    font-weight: 800;
    color: ${primary};
    line-height: 1.25;
  }
  .um-doc-control__job {
    margin-top: 4px;
    font-size: 10pt;
    color: #64748b;
  }
  table.um-dc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 14px;
    table-layout: fixed;
  }
  table.um-dc-table th {
    background: ${primary};
    color: #fff;
    font-size: 9pt;
    font-weight: 700;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid ${primary};
  }
  table.um-dc-table td {
    padding: 10px;
    border: 1px solid #cbd5e1;
    font-size: 10pt;
    vertical-align: middle;
    min-height: 36px;
  }
  table.um-dc-table tr.um-dc-section td {
    background: ${accent}22;
    color: ${primary};
    font-weight: 800;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 7px 10px;
    border-color: ${accent}66;
  }
  table.um-dc-table td.um-dc-sign {
    height: 44px;
    background: repeating-linear-gradient(
      -45deg,
      #f8fafc,
      #f8fafc 6px,
      #f1f5f9 6px,
      #f1f5f9 12px
    );
  }
  .um-doc-control__hint {
    font-size: 8.5pt;
    color: #64748b;
    border-left: 3px solid ${accent};
    padding: 6px 0 6px 10px;
  }

  /* Subsequent pages — letterhead chrome */
  .um-page-header {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid ${accent};
    padding: 0 0 8px;
    margin: 0 0 14px;
    overflow: hidden;
  }
  .um-page-header__lh {
    position: absolute;
    right: 0;
    top: -4px;
    width: 42%;
    height: 48px;
    background-size: cover;
    background-position: right center;
    opacity: 0.22;
    pointer-events: none;
    mask-image: linear-gradient(90deg, transparent 0%, #000 40%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 40%);
  }
  .um-page-header .um-wordmark { font-size: 11pt; margin: 0; position: relative; z-index: 1; }
  .um-page-header__logo {
    height: 28px;
    max-width: 120px;
    object-fit: contain;
    position: relative;
    z-index: 1;
  }
  .um-page-header__right {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
    z-index: 1;
  }
  .um-compliance-ribbon {
    margin: 0 0 14px;
    padding: 7px 12px;
    background: linear-gradient(90deg, ${primary} 0%, #0a2744 100%);
    color: #fff;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.03em;
    border-radius: 4px;
    border-left: 4px solid ${accent};
  }
  .um-compliance-ribbon strong { color: ${accent}; font-weight: 800; }
  .um-page-footer {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    background: ${accent};
    color: #fff;
    font-size: 7.5pt;
    padding: 6px 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    z-index: 9998;
  }
  .um-page-footer a { color: #fff; text-decoration: none; }
  .um-page-footer__logo {
    height: 28px;
    width: 28px;
    object-fit: contain;
    background: ${primary};
    border-radius: 4px;
    padding: 2px;
  }
  @media print {
    .um-hero-cover, .um-hero-cover__rail, .um-hero-cover__badge, .um-hero-cover__chip,
    .um-kit-chip, .um-page-footer, .um-page-header, .um-page-header__lh, .um-compliance-ribbon,
    .um-doc-control, table.um-dc-table th, table.um-dc-table tr.um-dc-section td {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;
}

/**
 * Running header for body pages — wordmark + faint letterhead artwork.
 * @param {string} [logoSrc]
 * @param {string} [rightLabel]
 */
export function renderUtilityMappingPageHeader(logoSrc, rightLabel = "") {
  if (!isUtilityMappingPrintTheme()) return "";
  const logo = logoSrc || UM_LOGO_URL;
  const accent = UTILITY_MAPPING_BRAND.accentColor;
  const lh = UM_LETTERHEAD_URL;
  return `<div class="um-page-header">
  <div class="um-page-header__lh" style="background-image:url('${escapeAttr(lh)}')" aria-hidden="true"></div>
  ${umWordmarkHtml(accent)}
  <div class="um-page-header__right">
    ${rightLabel ? `<span style="font-size:8pt;color:#64748b">${escapeHtml(rightLabel)}</span>` : ""}
    <img class="um-page-header__logo" src="${escapeAttr(logo)}" alt="Utility Mapping"/>
  </div>
</div>`;
}

/** Slim PAS128 controlled-document ribbon for body / TOC pages. */
export function renderUtilityMappingComplianceRibbon(text) {
  if (!isUtilityMappingPrintTheme()) return "";
  const line = text || UTILITY_MAPPING_BRAND.pdfComplianceLine || "Controlled document.";
  return `<div class="um-compliance-ribbon"><strong>PAS 128</strong> · ${escapeHtml(line)}</div>`;
}

/** Fixed footer bar matching PAS128 letterhead. */
export function renderUtilityMappingPageFooter(logoSrc) {
  if (!isUtilityMappingPrintTheme()) return "";
  const logo = logoSrc || UM_LOGO_URL;
  const b = UTILITY_MAPPING_BRAND;
  return `<div class="um-page-footer">
  <div>
    <div>${escapeHtml(b.phone || "0800 024 UMAP")} &nbsp;|&nbsp; ${escapeHtml(b.address)}</div>
    <div>${escapeHtml(b.email)} &nbsp;|&nbsp; ${escapeHtml(b.website?.replace(/^https?:\/\//, "") || "u-map.co.uk")}</div>
    <div>AUSTRALIA &nbsp;|&nbsp; UNITED KINGDOM &nbsp;|&nbsp; SINGAPORE &nbsp;|&nbsp; NEW ZEALAND</div>
  </div>
  <img class="um-page-footer__logo" src="${escapeAttr(logo)}" alt=""/>
</div>`;
}
