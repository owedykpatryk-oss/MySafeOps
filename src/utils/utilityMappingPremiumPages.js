/**
 * Utility Mapping premium print pages — executive summary, dig readiness,
 * deliverables, appendix dividers. Org-exclusive.
 */
import { escapeHtml, escapeAttr } from "./htmlEscape.js";
import { isUtilityMappingPrintTheme } from "./utilityMappingPrintTheme";
import { UTILITY_MAPPING_BRAND } from "./utilityMappingBranding";
import {
  renderUtilityMappingPageHeader,
  renderUtilityMappingComplianceRibbon,
  utilityMappingSignalSvg,
} from "./utilityMappingCovers.js";
import { getUtilityMappingClient, utilityMappingClientLogoUrl } from "./utilityMappingClients";
import { parseUtilityMappingRef } from "./utilityMappingDocRefs";
import { getActiveDocumentLocale } from "./countryWorkspaces";

function clip(text, max = 420) {
  const t = String(text || "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Auto dig-risk score for excavation readiness (0–100, higher = more caution).
 * @param {object} report
 * @returns {{ score: number, band: 'low'|'medium'|'high', label: string, reasons: string[] }}
 */
export function computeUtilityMappingDigRisk(report = {}, { ignoreTheme = false } = {}) {
  if (!ignoreTheme && !isUtilityMappingPrintTheme()) {
    return { score: 0, band: "low", label: "", reasons: [] };
  }
  let score = 35;
  const reasons = [];
  const utils = Array.isArray(report.utilitiesTable) ? report.utilitiesTable : [];
  const trials = Array.isArray(report.trialHolesTable) ? report.trialHolesTable : [];
  const ql = String(report.pas128Ql || "").toUpperCase();
  const method = String(report.pas128Method || "").toUpperCase();

  if (utils.length >= 12) {
    score += 22;
    reasons.push("High utility density in schedule");
  } else if (utils.length >= 5) {
    score += 12;
    reasons.push("Multiple utilities recorded");
  } else if (!utils.length) {
    score += 18;
    reasons.push("No utility schedule yet — treat as unknown");
  }

  if (ql.includes("D") || ql.includes("B4")) {
    score += 20;
    reasons.push("Records-derived / lower QL present");
  } else if (ql.includes("B3")) {
    score += 8;
    reasons.push("QL-B3 detection confidence");
  } else if (ql.includes("B1") || ql.includes("B2")) {
    score -= 6;
    reasons.push("Higher PAS128 quality level");
  }

  if (trials.length) {
    score -= 12;
    reasons.push(`${trials.length} trial hole / verification record(s)`);
  } else {
    score += 10;
    reasons.push("No trial holes logged — advise before mechanical dig");
  }

  if (method.includes("M1") || method.includes("M4")) {
    score += 6;
  }

  score = Math.max(5, Math.min(98, Math.round(score)));
  const band = score >= 65 ? "high" : score >= 40 ? "medium" : "low";
  const label =
    band === "high" ? "Elevated dig caution" : band === "medium" ? "Standard dig controls" : "Lower relative dig risk";
  return { score, band, label, reasons };
}

/**
 * Client logo HTML for covers / headers.
 * @param {string} clientCode
 * @param {string} [clientName]
 */
export function renderUtilityMappingClientLogo(clientCode, clientName = "") {
  if (!isUtilityMappingPrintTheme()) return "";
  const url = utilityMappingClientLogoUrl(clientCode);
  if (!url) return "";
  const label = getUtilityMappingClient(clientCode)?.name || clientName || clientCode;
  return `<div class="um-client-logo">
  <img src="${escapeAttr(url)}" alt="${escapeHtml(label)}" />
  <div class="um-client-logo__code">${escapeHtml(String(clientCode || "").toUpperCase())}</div>
</div>`;
}

/**
 * Executive brief page — Scope / Methods / Key findings.
 * @param {object} report
 * @param {{ logoSrc?: string }} [opts]
 */
export function renderUtilityMappingExecutivePage(report, opts = {}) {
  if (!isUtilityMappingPrintTheme() || !report) return "";
  const r = report;
  const scope = clip(r.sections?.scope || r.sections?.executiveSummary, 480);
  const methods = [
    r.pas128Method ? `PAS 128 ${String(r.pas128Method).toUpperCase()}` : "",
    r.pas128Ql ? `Quality level ${r.pas128Ql}` : "",
    "EML / CAT & Genny",
    "Ground Penetrating Radar",
    r.controlAccuracy?.coordinateSystem || "OSGB36",
  ]
    .filter(Boolean)
    .join(" · ");
  const findings = clip(
    r.sections?.executiveSummary || r.sections?.findings || r.sections?.recommendations,
    480
  );
  const code = r.umClientCode || parseUtilityMappingRef(r.ref)?.clientCode || "";
  const clientLogo = renderUtilityMappingClientLogo(code, r.client);

  return `<div class="um-exec-page">
  ${renderUtilityMappingPageHeader(opts.logoSrc, r.ref || "")}
  ${renderUtilityMappingComplianceRibbon("Executive brief — for client issue")}
  <div class="um-exec-top">
    <div>
      <div class="um-exec-kicker">Executive summary</div>
      <h1 class="um-exec-title">${escapeHtml(r.title || "PAS128 Utility Survey Report")}</h1>
      <div class="um-exec-meta">
        <span><strong>Ref</strong> ${escapeHtml(r.ref || "—")}</span>
        <span><strong>Client</strong> ${escapeHtml(r.client || getUtilityMappingClient(code)?.name || "—")}</span>
        <span><strong>Site</strong> ${escapeHtml(r.siteAddress || r.projectName || "—")}</span>
      </div>
    </div>
    ${clientLogo}
  </div>
  <div class="um-exec-grid">
    <div class="um-exec-card">
      <div class="um-exec-card__label">Scope</div>
      <p>${escapeHtml(scope || "Survey extent as agreed with the client and shown on the accompanying drawing.")}</p>
    </div>
    <div class="um-exec-card">
      <div class="um-exec-card__label">Methods used</div>
      <p>${escapeHtml(methods)}</p>
    </div>
    <div class="um-exec-card um-exec-card--wide">
      <div class="um-exec-card__label">Key findings / dig risk</div>
      <p>${escapeHtml(findings || "Refer to findings, QL coding and limitations in the body of this report before excavation.")}</p>
    </div>
  </div>
</div>`;
}

/**
 * Dig / excavation readiness panel.
 * @param {object} report
 */
export function renderUtilityMappingDigReadinessPage(report, opts = {}) {
  if (!isUtilityMappingPrintTheme() || !report) return "";
  const r = report;
  const risk = computeUtilityMappingDigRisk(r);
  const hasTrial = Array.isArray(r.trialHolesTable) && r.trialHolesTable.length > 0;
  const hasUtils = Array.isArray(r.utilitiesTable) && r.utilitiesTable.length > 0;
  const ql = String(r.pas128Ql || "").toUpperCase();
  const cards = [
    {
      tone: "ok",
      title: "Ready for design",
      body: hasUtils
        ? "Detected utilities tabulated with PAS 128 quality levels for design coordination."
        : "Complete utility schedule before relying on this report for detailed design.",
    },
    {
      tone: hasTrial ? "ok" : "warn",
      title: "Trial holes",
      body: hasTrial
        ? `${r.trialHolesTable.length} verification / trial hole record(s) included.`
        : "Trial holes / vacuum excavation advised before mechanical dig on congested or QL-D corridors.",
    },
    {
      tone: ql.includes("D") || ql.includes("B4") ? "warn" : "ok",
      title: "Records-only areas",
      body: "Treat TFR / AR / QL-D alignments as live until proven otherwise on site.",
    },
    {
      tone: "info",
      title: "Safe dig",
      body: "Use HSG47 practices, CAT & Genny before break-in, and refer to linked RAMS / PTW.",
    },
  ];

  return `<div class="um-dig-page">
  ${renderUtilityMappingPageHeader(opts.logoSrc, r.ref || "")}
  <div class="um-dig-kicker">${utilityMappingSignalSvg(UTILITY_MAPPING_BRAND.accentColor, 16)} Excavation readiness</div>
  <div class="um-dig-score-row">
    <h2 class="um-dig-title">Before you dig</h2>
    <div class="um-dig-score um-dig-score--${risk.band}" title="${escapeAttr(risk.reasons.join("; "))}">
      <div class="um-dig-score__n">${risk.score}</div>
      <div class="um-dig-score__l">${escapeHtml(risk.label)}</div>
    </div>
  </div>
  <p class="um-dig-lead">Decision panel for designers and site teams — not a substitute for on-site CAT scanning and permits.${
    risk.reasons.length ? ` Drivers: ${escapeHtml(risk.reasons.slice(0, 3).join(" · "))}.` : ""
  }</p>
  <div class="um-dig-grid">
    ${cards
      .map(
        (c) => `<div class="um-dig-card um-dig-card--${c.tone}">
      <div class="um-dig-card__title">${escapeHtml(c.title)}</div>
      <p>${escapeHtml(c.body)}</p>
    </div>`
      )
      .join("")}
  </div>
</div>`;
}

/**
 * Issued deliverables checklist page.
 * @param {object} report
 */
export function renderUtilityMappingDeliverablesPage(report, opts = {}) {
  if (!isUtilityMappingPrintTheme() || !report) return "";
  const r = report;
  const listed = Array.isArray(r.deliverables) ? r.deliverables.filter(Boolean) : [];
  const defaults = [
    { label: "PAS128 Utility Survey Report (PDF)", on: true },
    { label: "2D CAD drawing", on: listed.some((d) => /2d|cad|dwg|drawing/i.test(String(d))) || true },
    { label: "3D CAD / model extract", on: listed.some((d) => /3d/i.test(String(d))) },
    { label: "Geo-photo evidence pack", on: Array.isArray(r.photos) && r.photos.length > 0 },
    { label: "Utility schedule / findings table", on: Array.isArray(r.utilitiesTable) && r.utilitiesTable.length > 0 },
    { label: "Statutory records / undertaker log", on: Array.isArray(r.undertakerResponses) && r.undertakerResponses.length > 0 },
  ];
  const extra = listed
    .filter((d) => !defaults.some((x) => String(d).toLowerCase().includes(x.label.slice(0, 8).toLowerCase())))
    .map((d) => ({ label: String(d), on: true }));

  const rows = [...defaults, ...extra]
    .map(
      (d) => `<tr>
      <td class="um-del-check">${d.on ? "✓" : "○"}</td>
      <td>${escapeHtml(d.label)}</td>
      <td>${d.on ? "Issued / included" : "Not in this issue"}</td>
    </tr>`
    )
    .join("");

  return `<div class="um-del-page">
  ${renderUtilityMappingPageHeader(opts.logoSrc, r.ref || "")}
  <div class="um-del-kicker">Issued deliverables</div>
  <h2 class="um-del-title">What this package includes</h2>
  <table class="um-del-table">
    <thead><tr><th></th><th>Deliverable</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="um-del-note">Confirm the latest revision is in use. Drawing sheets and digital files are controlled separately where issued.</p>
</div>`;
}

/**
 * Build default CAD / drawing sheet register for a PAS128 package.
 * @param {object} report
 * @returns {Array<{ sheet: string, title: string, scale: string, status: string }>}
 */
export function buildUtilityMappingDrawingSheets(report = {}) {
  const ref = String(report.ref || "UM").replace(/-(RA|MS|PTW|GPR|SR)$/i, "");
  const rev = report.documentControl?.revision || "A";
  const listed = Array.isArray(report.deliverables) ? report.deliverables.map(String) : [];
  const has3d = listed.some((d) => /3d/i.test(d));
  const sheets = [
    { sheet: `${ref}-01`, title: "Utility survey — overall plan", scale: "As noted", status: `Rev ${rev}` },
    { sheet: `${ref}-02`, title: "PAS 128 quality level plan", scale: "As noted", status: `Rev ${rev}` },
  ];
  if (has3d || report.pas128Method) {
    sheets.push({
      sheet: `${ref}-03`,
      title: "Detail / congestion areas",
      scale: "As noted",
      status: `Rev ${rev}`,
    });
  }
  if (has3d) {
    sheets.push({
      sheet: `${ref}-04`,
      title: "3D / model extract sheet",
      scale: "N/A",
      status: `Rev ${rev}`,
    });
  }
  // Optional custom sheets from report.drawingSheets
  if (Array.isArray(report.drawingSheets) && report.drawingSheets.length) {
    return report.drawingSheets.map((s, i) => ({
      sheet: s.sheet || s.number || `${ref}-${String(i + 1).padStart(2, "0")}`,
      title: s.title || s.name || "Drawing",
      scale: s.scale || "As noted",
      status: s.status || `Rev ${rev}`,
    }));
  }
  return sheets;
}

/**
 * Issued drawings register page.
 * @param {object} report
 */
export function renderUtilityMappingDrawingsPage(report, opts = {}) {
  if (!isUtilityMappingPrintTheme() || !report) return "";
  const sheets = buildUtilityMappingDrawingSheets(report);
  const rows = sheets
    .map(
      (s) => `<tr>
      <td class="um-dwg-no">${escapeHtml(s.sheet)}</td>
      <td>${escapeHtml(s.title)}</td>
      <td>${escapeHtml(s.scale)}</td>
      <td>${escapeHtml(s.status)}</td>
    </tr>`
    )
    .join("");

  return `<div class="um-dwg-page">
  ${renderUtilityMappingPageHeader(opts.logoSrc, report.ref || "")}
  <div class="um-del-kicker">Drawing register</div>
  <h2 class="um-del-title">Issued drawings</h2>
  <p class="um-dig-lead">CAD sheets controlled with this report issue. Superseded sheets must be withdrawn from site use.</p>
  <table class="um-del-table um-dwg-table">
    <thead><tr><th>Sheet</th><th>Title</th><th>Scale</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="um-dwg-stamp">
    <div class="um-dwg-stamp__label">Authorised for issue</div>
    <div class="um-dwg-stamp__body">
      <div><strong>Ref</strong> ${escapeHtml(report.ref || "—")}</div>
      <div><strong>Rev</strong> ${escapeHtml(report.documentControl?.revision || "A")}</div>
      <div><strong>Date</strong> ${escapeHtml(
        report.documentControl?.issueDate
          ? new Date(report.documentControl.issueDate).toLocaleDateString(getActiveDocumentLocale())
          : "—"
      )}</div>
    </div>
  </div>
</div>`;
}

/**
 * Consultancy-style approval / sign-off block for end of report.
 * @param {object} report
 */
export function renderUtilityMappingApprovalBlock(report) {
  if (!isUtilityMappingPrintTheme() || !report) return "";
  const dc = report.documentControl || {};
  const sig = report.signatures || {};
  const prepared = dc.preparedBy || report.surveyor || sig.surveyorName || "—";
  const checked = dc.checkedBy || "—";
  const approved = dc.approvedBy || "—";
  const status = report.status === "final" ? "FINAL — authorised for issue" : "DRAFT — not for construction use";

  return `<div class="um-approval">
  <div class="um-approval__stamp um-approval__stamp--${report.status === "final" ? "final" : "draft"}">${escapeHtml(status)}</div>
  <div class="um-approval__grid">
    <div class="um-approval__card">
      <div class="um-approval__role">Prepared by</div>
      <div class="um-approval__name">${escapeHtml(prepared)}</div>
      <div class="um-approval__line"></div>
      <div class="um-approval__meta">Utility Surveyor · Date _______________</div>
    </div>
    <div class="um-approval__card">
      <div class="um-approval__role">Checked by</div>
      <div class="um-approval__name">${escapeHtml(checked)}</div>
      <div class="um-approval__line"></div>
      <div class="um-approval__meta">Technical Manager · Date _______________</div>
    </div>
    <div class="um-approval__card">
      <div class="um-approval__role">Authorised for issue</div>
      <div class="um-approval__name">${escapeHtml(approved)}</div>
      <div class="um-approval__line"></div>
      <div class="um-approval__meta">Approver · Date _______________</div>
    </div>
    <div class="um-approval__card um-approval__card--client">
      <div class="um-approval__role">Client acceptance</div>
      <div class="um-approval__name">${escapeHtml(sig.clientName || " ")}</div>
      <div class="um-approval__line"></div>
      <div class="um-approval__meta">Client · Date _______________</div>
    </div>
  </div>
</div>`;
}

/**
 * Full-bleed appendix divider.
 * @param {{ letter: string, title: string, subtitle?: string, logoSrc?: string, reportRef?: string }} opts
 */
export function renderUtilityMappingAppendixDivider(opts = {}) {
  if (!isUtilityMappingPrintTheme()) return "";
  const letter = String(opts.letter || "A").toUpperCase();
  const title = opts.title || "Appendix";
  return `<div class="um-appendix">
  <div class="um-appendix__rail" aria-hidden="true"></div>
  <div class="um-appendix__inner">
    <div class="um-appendix__label">Appendix ${escapeHtml(letter)}</div>
    <h2 class="um-appendix__title">${escapeHtml(title)}</h2>
    ${opts.subtitle ? `<p class="um-appendix__sub">${escapeHtml(opts.subtitle)}</p>` : ""}
    ${opts.reportRef ? `<div class="um-appendix__ref">${escapeHtml(opts.reportRef)}</div>` : ""}
  </div>
</div>`;
}

/** CSS for premium interior pages. */
export function utilityMappingPremiumPagesCss(
  primary = UTILITY_MAPPING_BRAND.primaryColor,
  accent = UTILITY_MAPPING_BRAND.accentColor
) {
  if (!isUtilityMappingPrintTheme()) return "";
  return `
  .um-client-logo {
    text-align: center;
    flex-shrink: 0;
  }
  .um-client-logo img {
    max-height: 52px;
    max-width: 140px;
    object-fit: contain;
    background: #fff;
    border-radius: 6px;
    padding: 4px 8px;
    border: 1px solid #e2e8f0;
  }
  .um-client-logo__code {
    margin-top: 4px;
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: ${accent};
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
    background: rgba(255,255,255,0.92);
    border-radius: 6px;
    padding: 4px 8px;
  }

  .um-exec-page, .um-dig-page, .um-del-page, .um-dwg-page {
    page-break-after: always;
    break-after: page;
    min-height: 240mm;
    padding: 2mm 0 16mm;
  }
  .um-exec-kicker, .um-dig-kicker, .um-del-kicker {
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${accent};
    margin-bottom: 6px;
  }
  .um-exec-title, .um-dig-title, .um-del-title {
    margin: 0 0 10px;
    color: ${primary};
    font-size: 16pt;
    font-weight: 800;
  }
  .um-exec-top {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .um-exec-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    font-size: 9pt;
    color: #475569;
  }
  .um-exec-meta strong { color: ${primary}; }
  .um-exec-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .um-exec-card {
    border: 1px solid ${accent}55;
    border-left: 4px solid ${accent};
    border-radius: 8px;
    padding: 12px 14px;
    background: linear-gradient(180deg, #fff 0%, ${accent}0a 100%);
  }
  .um-exec-card--wide { grid-column: 1 / -1; }
  .um-exec-card__label {
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${accent};
    margin-bottom: 6px;
  }
  .um-exec-card p { margin: 0; font-size: 10pt; line-height: 1.45; color: ${primary}; }

  .um-dig-lead { color: #64748b; font-size: 10pt; margin: 0 0 14px; }
  .um-dig-score-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 4px;
  }
  .um-dig-score {
    flex-shrink: 0;
    min-width: 110px;
    text-align: center;
    border-radius: 10px;
    padding: 10px 12px;
    border: 2px solid ${accent};
  }
  .um-dig-score__n {
    font-size: 22pt;
    font-weight: 800;
    line-height: 1;
    color: ${primary};
  }
  .um-dig-score__l {
    margin-top: 4px;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .um-dig-score--low { background: #ecfdf5; border-color: #34d399; }
  .um-dig-score--medium { background: #fffbeb; border-color: #fbbf24; }
  .um-dig-score--high { background: #fef2f2; border-color: #f87171; }
  .um-dig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .um-dig-card {
    border-radius: 8px;
    padding: 14px;
    border: 1px solid #e2e8f0;
    min-height: 88px;
  }
  .um-dig-card__title { font-weight: 800; color: ${primary}; margin-bottom: 6px; font-size: 11pt; }
  .um-dig-card p { margin: 0; font-size: 9.5pt; color: #334155; line-height: 1.4; }
  .um-dig-card--ok { background: #ecfdf5; border-color: #6ee7b7; }
  .um-dig-card--warn { background: #fffbeb; border-color: #fcd34d; }
  .um-dig-card--info { background: ${accent}12; border-color: ${accent}66; }

  .um-del-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .um-del-table th {
    background: ${primary};
    color: #fff;
    text-align: left;
    padding: 8px 10px;
    font-size: 9pt;
  }
  .um-del-table td {
    padding: 9px 10px;
    border: 1px solid #cbd5e1;
    font-size: 10pt;
  }
  .um-del-check {
    width: 36px;
    text-align: center;
    font-weight: 800;
    color: ${accent};
    font-size: 14pt;
  }
  .um-del-note { font-size: 8.5pt; color: #64748b; border-left: 3px solid ${accent}; padding-left: 10px; }

  .um-dwg-no {
    font-family: Consolas, "Courier New", monospace;
    font-weight: 700;
    color: ${primary};
    white-space: nowrap;
  }
  .um-dwg-stamp {
    margin-top: 18px;
    display: flex;
    align-items: stretch;
    border: 2px solid ${accent};
    border-radius: 8px;
    overflow: hidden;
  }
  .um-dwg-stamp__label {
    background: ${primary};
    color: #fff;
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    padding: 10px 6px;
    text-align: center;
  }
  .um-dwg-stamp__body {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 12px 14px;
    background: ${accent}0d;
    font-size: 9.5pt;
  }

  .um-approval { margin-top: 16px; }
  .um-approval__stamp {
    display: inline-block;
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 4px;
    margin-bottom: 12px;
  }
  .um-approval__stamp--final {
    background: ${accent};
    color: ${primary};
  }
  .um-approval__stamp--draft {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fcd34d;
  }
  .um-approval__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .um-approval__card {
    border: 1.5px solid ${accent}66;
    border-radius: 8px;
    padding: 12px;
    min-height: 100px;
    background: linear-gradient(180deg, #fff 0%, ${accent}08 100%);
  }
  .um-approval__card--client {
    border-color: ${primary}44;
    background: #f8fafc;
  }
  .um-approval__role {
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${accent};
    margin-bottom: 6px;
  }
  .um-approval__name {
    font-size: 11pt;
    font-weight: 700;
    color: ${primary};
    min-height: 22px;
  }
  .um-approval__line {
    border-bottom: 1px solid ${primary};
    margin: 18px 0 8px;
  }
  .um-approval__meta {
    font-size: 8pt;
    color: #64748b;
  }

  .um-appendix {
    position: relative;
    page-break-before: always;
    break-before: page;
    page-break-after: always;
    break-after: page;
    min-height: 260mm;
    margin: -8mm -6mm 0;
    background: linear-gradient(145deg, ${primary} 0%, #061428 55%, #0a2744 100%);
    color: #fff;
    overflow: hidden;
  }
  .um-appendix__rail {
    position: absolute;
    top: 0; right: 0; bottom: 0;
    width: 16mm;
    background: ${accent};
  }
  .um-appendix__inner {
    position: relative;
    z-index: 1;
    padding: 70mm 24mm 24mm 18mm;
  }
  .um-appendix__label {
    font-size: 11pt;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${accent};
    margin-bottom: 10px;
  }
  .um-appendix__title {
    margin: 0 0 10px;
    font-size: 28pt;
    font-weight: 800;
    line-height: 1.15;
  }
  .um-appendix__sub { margin: 0; font-size: 12pt; color: #cbd5e1; max-width: 420px; }
  .um-appendix__ref {
    margin-top: 28px;
    font-size: 10pt;
    color: ${accent};
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  @media print {
    .um-exec-card, .um-dig-card, .um-del-table th, .um-appendix, .um-appendix__rail, .um-client-logo img {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;
}
