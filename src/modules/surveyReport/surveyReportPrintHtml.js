import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { openPrintWindow, safeImageSrc, escapeAttr, sanitizePrintPreviewHtml, writePrintWindowDocument } from "../../utils/htmlEscape.js";
import { downloadBlob } from "../../utils/downloadBlob.js";
import { buildStaticMapUrl } from "../../utils/staticMapUrl.js";
import {
  isUtilityMappingPrintTheme,
  utilityMappingSurveyCoverCss,
  utilityMappingCoverKitChips,
} from "../../utils/utilityMappingPrintTheme.js";
import {
  renderUtilityMappingHeroCover,
  renderUtilityMappingDocControlPage,
  utilityMappingCoverSystemCss,
  utilityMappingPas128CoverBadges,
  renderUtilityMappingPageHeader,
  renderUtilityMappingPageFooter,
  renderUtilityMappingComplianceRibbon,
  resolveUtilityMappingLogoSrc,
} from "../../utils/utilityMappingCovers.js";
import {
  renderUtilityMappingExecutivePage,
  renderUtilityMappingDigReadinessPage,
  renderUtilityMappingDeliverablesPage,
  renderUtilityMappingDrawingsPage,
  renderUtilityMappingApprovalBlock,
  renderUtilityMappingAppendixDivider,
  utilityMappingPremiumPagesCss,
  computeUtilityMappingDigRisk,
} from "../../utils/utilityMappingPremiumPages.js";
import { utilityMappingClientLogoUrl, getUtilityMappingClient } from "../../utils/utilityMappingClients.js";
import { parseUtilityMappingRef } from "../../utils/utilityMappingDocRefs.js";
import { buildUtilityMappingQrSrc } from "../../utils/utilityMappingClientPack.js";
import { UTILITY_MAPPING_BRAND } from "../../utils/utilityMappingBranding.js";
import { buildOrgShareUrlWithRef } from "../../utils/safeOrgWebsite.js";
import {
  buildAccessLimitationsText,
  buildControlAccuracyNarrative,
  buildEquipmentCalibrationNarrative,
  buildLimitationsFromKeys,
  buildPas128SummaryStats,
  buildQaChecklistNarrative,
  buildStandardsCitedNarrative,
  buildSurveyProgrammeNarrative,
  buildUtilityRecordsNarrative,
  buildWeatherNarrative,
  deliverableFormatLabel,
  normalizeSurveyReport,
  recordRefStatusLabel,
  surveyTypeLabel,
  utilityConfidenceLabel,
  utilityTypeLabel,
  utilitySourceLabel,
  utilityDetectStatusLabel,
  surveyReportQuality,
} from "./surveyReportHelpers";
import {
  PAS128_QUALITY_LEVELS,
  DBYD_ENQUIRY_PROVIDERS,
  DBYD_ENQUIRY_STATUS,
  SURVEY_PHOTO_CATEGORIES,
  surveyPhotoCategoryLabel,
  UNDERTAKER_CATEGORIES,
  UNDERTAKER_RESPONSE_STATUS,
} from "./surveyReportConstants";
import {
  buildPas128LimitationsHtml,
  buildPas128WorkflowNarrative,
  includesPas128MethodLimitations,
  pas128MethodAppliesToSurveyType,
  pas128MethodLabel,
} from "./pas128MethodPresets";
import { buildPas128QlBarsHtml, buildPas128WorkflowSvg } from "./pas128WorkflowDiagram";
import { getSurveyReportDisclaimer } from "./pas128ReportBoilerplate";
import {
  buildEvidenceRowsHtml,
  buildExtentAreasHtml,
  buildWeatherThickboxHtml,
  buildEquipmentThickboxHtml,
  buildGeoPhotoGroupThickboxesHtml,
  buildCustomSectionsHtml,
  buildRecordsMatrixNarrative,
  buildRecordsScoreboardHtml,
  buildMethodLadderHtml,
  buildConstraintChipsHtml,
  buildTfrLegendStripHtml,
  buildUndertakerFindingsBlocksHtml,
  buildCoverInsightStripHtml,
  buildQaChecklistProse,
  buildGprAnomalyCardsHtml,
  buildSurveyAreasFlipbookHtml,
  SURVEY_EVIDENCE_PRINT_CSS,
} from "./surveyEvidencePack";
import {
  formatDualPas128Method,
  buildAocChainageRibbonHtml,
  buildEquipmentAppendixHtml,
  buildMhIcCardsHtml,
  buildGeologyBlockHtml,
  reorderSectionsForUmClassic,
  umClassicSectionTitle,
  SURVEY_PLAN_UPGRADE_CSS,
} from "./surveyPlanRemaining";
import { isUtilitySurveyType, pas128QlToleranceHtmlTable } from "../../utils/surveyContentCatalog";
import { getQaChecklistGroupsForSurveyType } from "./surveyQaPack";
import {
  MSCC_PIPE_GRADES,
  UAV_WIND_BANDS,
  LASER_REGISTRATION_STATUS,
  ACM_SAMPLE_RESULTS,
  ACM_RECOMMENDATIONS,
  ACM_MATERIAL_RISK_SCORE,
} from "./surveySpecialistFindings";
import { geoPhotoPreset, GEO_PHOTO_GROUP_ORDER } from "../../utils/geoPhotoPresets";
import { geoPhotosStaticMapUrl, geoPhotosStaticMapCaption } from "../../utils/geoPhotoIntegrations";
import { formatLengthM } from "../../utils/surveyDxfAnalyzer";
import {
  buildCadFieldComparison,
  buildCadVisualSummary,
  cadQlDisplayLabel,
  cadQlStyle,
  cadUtilityColor,
} from "../../utils/cadImportVisuals";
import { buildCadPreviewSvg, buildCadQlDonutSvg } from "../../utils/cadPreviewSvg";
import { renderMySafeOpsMarkSvg } from "../../utils/pdfBranding.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imgSrcAttr(raw) {
  const safe = safeImageSrc(raw);
  return safe ? escapeAttr(safe) : "";
}

function nl2p(text) {
  const t = String(text || "").trim();
  if (!t) return "<p><em>Not recorded.</em></p>";
  return t
    .split(/\n{2,}/)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function nl2list(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const lines = t.split(/\n/).filter(Boolean);
  if (lines.length <= 1) return nl2p(t);
  return `<ul class="sr-list">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

function section(title, body, id, num) {
  const label = num ? `<span class="sr-sec-num">${num}</span> ${esc(title)}` : esc(title);
  return `<section class="sr-section" id="${id || ""}"><h2>${label}</h2>${body}</section>`;
}

function pas128Label(key) {
  return PAS128_QUALITY_LEVELS.find((q) => q.key === key)?.label || key;
}

function pas128Short(key) {
  const full = pas128Label(key);
  const m = full.match(/QL (B\d)/);
  return m ? m[1] : key || "—";
}

function cellHtml(cell) {
  if (cell == null || cell === "") return "—";
  if (typeof cell === "object" && cell.__html != null) return cell.__html;
  return esc(cell);
}

function dataTable(headers, rows) {
  if (!rows?.length) return "";
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="sr-data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function metaGrid(pairs) {
  return `<div class="sr-meta-grid">${pairs
    .map(
      ([k, v]) =>
        `<div class="sr-meta-item"><div class="sr-meta-key">${esc(k)}</div><div class="sr-meta-val">${esc(v || "—")}</div></div>`
    )
    .join("")}</div>`;
}

function staticSiteMapUrl(lat, lng) {
  return buildStaticMapUrl(lat, lng, { width: 520, height: 220, zoom: 15, label: "Site location" });
}

function pas128SummaryBlock(report, primary = "#0d9488") {
  const stats = buildPas128SummaryStats(report);
  if (!stats) return "";
  const qlBars = buildPas128QlBarsHtml(stats.byQl, { total: stats.total });
  return `<div class="sr-pas128-summary">
    <div class="sr-pas128-summary-head">
      <div class="sr-pas128-stat"><span class="sr-pas128-num">${stats.total}</span><span>utilities logged</span></div>
      <div class="sr-pas128-stat"><span class="sr-pas128-num">${stats.withDepth}</span><span>with depth</span></div>
      <div class="sr-pas128-stat"><span class="sr-pas128-num">${stats.withGeoPhoto}</span><span>photo linked</span></div>
    </div>
    ${qlBars ? `<div class="sr-pas128-ql-wrap"><div class="sr-pas128-ql-title">Quality level mix</div>${qlBars}</div>` : ""}
  </div>`;
}

function undertakerCoverStrip(report) {
  const rows = report?.undertakerResponses || [];
  if (!rows.length) return "";
  const summary = { affected: 0, not_affected: 0, no_response: 0 };
  rows.forEach((r) => {
    if (summary[r.status] != null) summary[r.status] += 1;
  });
  return `<div class="sr-undertaker-cover">
    <div class="sr-undertaker-cover__title">Desktop search — undertaker responses</div>
    <div class="sr-undertaker-cover__stats">
      <span class="sr-undertaker-pill sr-undertaker-pill--affected">Affected ${summary.affected}</span>
      <span class="sr-undertaker-pill sr-undertaker-pill--clear">Not affected ${summary.not_affected}</span>
      <span class="sr-undertaker-pill sr-undertaker-pill--pending">No response ${summary.no_response}</span>
    </div>
  </div>`;
}

function equipmentCalibrationBlock(rows) {
  if (!rows?.length) return "";
  return dataTable(
    ["Instrument", "Serial no.", "Calibration due", "Status"],
    rows.map((r) => [
      r.instrument || "",
      r.serialNo || "",
      r.calibrationDue ? new Date(r.calibrationDue).toLocaleDateString("en-GB") : "",
      r.status === "in_date"
        ? "In date"
        : r.status === "due_soon"
          ? "Due soon"
          : r.status === "overdue"
            ? "Overdue"
            : r.status || "",
    ])
  );
}

function changesSinceBlock(changes) {
  if (!changes?.length) return "";
  return dataTable(
    ["Field", "Previous", "This issue"],
    changes.map((c) => [c.field, c.before || "—", c.after || "—"])
  );
}

function coverPage(report, org, primary, accent, extras) {
  const dc = report.documentControl || {};
  const logoSrc = resolveUtilityMappingLogoSrc(org) || imgSrcAttr(org.logo);
  const issueDate = dc.issueDate || report.surveyDate;
  const quality = surveyReportQuality(report);

  if (isUtilityMappingPrintTheme()) {
    const dualMethod = formatDualPas128Method(report.pas128Method, report.pas128MethodSecondary);
    const methodLabel = dualMethod
      ? `PAS128 ${dualMethod}`
      : report.pas128Ql
        ? `PAS 128 ${pas128Short(report.pas128Ql)}`
        : "Utility Survey Report";
    const { methodBadge, qlBadge } = utilityMappingPas128CoverBadges(
      dualMethod || report.pas128Method,
      report.pas128Ql ? pas128Short(report.pas128Ql) : ""
    );
    const clientCode =
      report.umClientCode || parseUtilityMappingRef(report.ref)?.clientCode || "";
    const clientLogoSrc = utilityMappingClientLogoUrl(clientCode);
    const shareUrl = report.ref
      ? buildOrgShareUrlWithRef(org, report.ref, UTILITY_MAPPING_BRAND.website || "https://u-map.co.uk/")
      : "";
    return renderUtilityMappingHeroCover({
      title: report.title || "PAS128 Utility Survey Report",
      subtitle: methodLabel,
      badge: report.status === "final" ? "Final report" : "Draft",
      methodBadge,
      qlBadge,
      kitChips: utilityMappingCoverKitChips(report),
      clientCode,
      clientName: report.client || getUtilityMappingClient(clientCode)?.name || "",
      clientLogoSrc,
      orgName: org.name || "Utility Mapping",
      logoSrc,
      qrSrc: shareUrl ? buildUtilityMappingQrSrc(shareUrl, 140) : "",
      qrLabel: report.ref || "",
      meta: [
        ["Report ref", report.ref || "—"],
        ["Client", report.client || getUtilityMappingClient(clientCode)?.name || "—"],
        ["Project", report.projectName || "—"],
        ["Site", report.siteAddress || "—"],
        ["Survey date", report.surveyDate ? new Date(report.surveyDate).toLocaleDateString("en-GB") : "—"],
        ["Issue date", issueDate ? new Date(issueDate).toLocaleDateString("en-GB") : "—"],
        ["Surveyor", report.surveyor || "—"],
        ["Completeness", `${quality.score}%`],
      ],
      footerNote: org.pdfFooter || "Utility Mapping · u-map.co.uk · Part of IS GROUP",
    });
  }

  const coverPhoto = imgSrcAttr(
    extras.coverPhotoUrl || report.photos?.[0]?.dataUrl || report.photos?.[0]?.url || ""
  );
  const mapUrl = staticSiteMapUrl(extras.projectLat, extras.projectLng);
  const qlBadge = report.pas128Ql
    ? `<span class="sr-ql-badge">PAS 128 ${esc(pas128Short(report.pas128Ql))}</span>`
    : "";
  const dualMethod = formatDualPas128Method(report.pas128Method, report.pas128MethodSecondary);
  const methodBadge = dualMethod
    ? `<span class="sr-ql-badge sr-ql-badge--method">${esc(dualMethod)}</span>`
    : "";
  const qualityColour = quality.score >= 80 ? primary : quality.score >= 50 ? "#f59e0b" : "#ea580c";
  const pas128Summary = pas128SummaryBlock(report, primary);
  const undertakerStrip = undertakerCoverStrip(report);

  return `<div class="sr-cover">
    <div class="sr-cover-top">
      <div class="sr-cover-top-left">
        ${logoSrc ? `<img src="${imgSrcAttr(logoSrc)}" alt="" class="sr-cover-logo"/>` : ""}
        <div class="sr-cover-org">
          <div class="sr-cover-org-name">${esc(org.name)}</div>
          ${org.pdfHeader ? `<div class="sr-cover-org-sub">${esc(org.pdfHeader)}</div>` : org.address ? `<div class="sr-cover-org-sub">${esc(org.address)}</div>` : ""}
        </div>
      </div>
      <div class="sr-cover-mso">
        ${renderMySafeOpsMarkSvg(28)}
        <div class="sr-cover-mso-label"><strong>MySafeOps</strong><span>mysafeops.com</span></div>
      </div>
    </div>
    <div class="sr-cover-main">
      <span class="sr-badge sr-badge--cover">${report.status === "final" ? "Final report" : "Draft"}</span>
      ${qlBadge}
      ${methodBadge}
      <div class="sr-quality-badge" style="border-color:${qualityColour};color:${qualityColour}">Report completeness: ${quality.score}%</div>
      <h1 class="sr-cover-title">${esc(report.title || "Survey Report")}</h1>
      <div class="sr-cover-meta">
        ${metaGrid([
          ["Report ref", report.ref || "—"],
          ["Issue", dc.issueNumber ? `${dc.issueNumber}${dc.revision ? ` Rev ${dc.revision}` : ""}` : "—"],
          ["Survey date", report.surveyDate ? new Date(report.surveyDate).toLocaleDateString("en-GB") : "—"],
          ["Issue date", issueDate ? new Date(issueDate).toLocaleDateString("en-GB") : "—"],
          ["Client", report.client || "—"],
          ["Project", report.projectName || "—"],
          ["Site", report.siteAddress || "—"],
          ["Survey type", surveyTypeLabel(report.surveyType) || "—"],
          ["Surveyor", report.surveyor || "—"],
        ])}
      </div>
      ${coverPhoto ? `<figure class="sr-cover-photo"><img src="${coverPhoto}" alt="Site"/><figcaption>Site overview</figcaption></figure>` : ""}
      ${mapUrl ? `<figure class="sr-cover-map"><img src="${escapeAttr(mapUrl)}" alt="Site location map"/><figcaption>Site location (${Number(extras.projectLat).toFixed(5)}, ${Number(extras.projectLng).toFixed(5)})</figcaption></figure>` : ""}
      ${report.cadImport?.summary?.length ? cadCoverStrip(report.cadImport) : ""}
      ${undertakerStrip}
      ${pas128Summary}
    </div>
    <div class="sr-cover-footer">${esc(org.pdfFooter || "Generated by MySafeOps")}</div>
  </div>`;
}

function tableOfContents(entries) {
  const items = entries
    .map((e) => `<li><a href="#${e.id}"><span>${esc(e.title)}</span><span class="sr-toc-dots"></span></a></li>`)
    .join("");
  return `<nav class="sr-toc" aria-label="Contents"><h2 class="sr-toc-heading">Contents</h2><ol>${items}</ol></nav>`;
}

function documentControlBlock(report) {
  const dc = report.documentControl || {};
  const rows = [
    ["Issue no.", dc.issueNumber || "1"],
    ["Revision", dc.revision || "A"],
    [
      "Issue date",
      (dc.issueDate || report.surveyDate)
        ? new Date(dc.issueDate || report.surveyDate).toLocaleDateString("en-GB")
        : "—",
    ],
    ["Prepared by", dc.preparedBy || report.surveyor || "—"],
    ["Checked by", dc.checkedBy || "—"],
    ["Approved by", dc.approvedBy || "—"],
    ["Status", report.status === "final" ? "Final" : "Draft"],
  ];
  if (report.finalisedAt) {
    rows.push(["Finalised", new Date(report.finalisedAt).toLocaleDateString("en-GB")]);
  }
  let body = dataTable(["Field", "Value"], rows);
  const history = report.revisionHistory || [];
  if (history.length) {
    body += `<h3 class="sr-subhead">Revision history</h3>${dataTable(
      ["Date", "Rev", "Author", "Description"],
      history.map((h) => [
        h.date ? new Date(h.date).toLocaleDateString("en-GB") : "",
        h.revision || "",
        h.author || "",
        h.description || "",
      ])
    )}`;
  }
  return body;
}

function qlBadgeHtml(qlKey) {
  const s = cadQlStyle(qlKey);
  return `<span class="sr-ql-pill" style="background:${s.bg};color:${s.color};border-color:${s.border}">${esc(cadQlDisplayLabel(qlKey))}</span>`;
}

function cadStatCardsHtml(visual) {
  if (!visual?.statCards?.length) return "";
  const cards = visual.statCards
    .map(
      (c) =>
        `<div class="sr-cad-stat${c.accent ? " sr-cad-stat--accent" : ""}"><div class="sr-cad-stat-label">${esc(c.label)}</div><div class="sr-cad-stat-val">${esc(c.value)}</div>${c.hint ? `<div class="sr-cad-stat-hint">${esc(c.hint)}</div>` : ""}</div>`
    )
    .join("");
  return `<div class="sr-cad-stats">${cards}</div>`;
}

function cadBarChartHtml(rows, { labelKey = "label", valueKey = "lengthM", colorKey = "color", suffix = " m" } = {}) {
  if (!rows?.length) return "";
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  const bars = rows
    .map((row) => {
      const val = Number(row[valueKey]) || 0;
      const pct = Math.round((val / max) * 1000) / 10;
      const color = row[colorKey] || "#0d9488";
      return `<div class="sr-cad-bar-row">
        <span class="sr-cad-bar-label">${esc(row[labelKey] || "")}</span>
        <div class="sr-cad-bar-track"><div class="sr-cad-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="sr-cad-bar-val">${esc(String(val))}${suffix}</span>
      </div>`;
    })
    .join("");
  return `<div class="sr-cad-bars">${bars}</div>`;
}

function cadCompositionHtml(composition, totalM) {
  if (!composition?.length || !totalM) return "";
  const segments = composition
    .map((seg) => {
      const pct = Math.round((seg.lengthM / totalM) * 1000) / 10;
      return `<div class="sr-cad-comp-seg" style="width:${pct}%;background:${seg.color}" title="${esc(seg.label)}: ${seg.lengthM} m"></div>`;
    })
    .join("");
  const legend = composition
    .map(
      (seg) =>
        `<span class="sr-cad-comp-key"><span class="sr-cad-comp-dot" style="background:${seg.color}"></span>${esc(seg.label)} · ${formatLengthM(seg.lengthM)}</span>`
    )
    .join("");
  return `<div class="sr-cad-comp"><div class="sr-cad-comp-bar">${segments}</div><div class="sr-cad-comp-legend">${legend}</div></div>`;
}

function cadCoverStrip(cad) {
  const visual = buildCadVisualSummary(cad);
  if (!visual) return "";
  const topUtils = visual.byUtility
    .slice(0, 3)
    .map((u) => `${formatLengthM(u.lengthM)} ${u.label}`)
    .join(" · ");
  const donut = buildCadQlDonutSvg(visual.byQl, visual.totalM, { size: 88 });
  return `<div class="sr-cad-cover-strip">
    <div class="sr-cad-cover-row">
      <div class="sr-cad-cover-main">
        <div class="sr-cad-cover-title">CAD linework summary</div>
        <div class="sr-cad-cover-line"><strong>${formatLengthM(visual.totalM)}</strong> total · ${cad.totals?.segments || 0} segments · ${cad.totals?.layerCount || 0} layers</div>
        ${topUtils ? `<div class="sr-cad-cover-line">${esc(topUtils)}</div>` : ""}
        ${visual.recordsM > 0 ? `<div class="sr-cad-cover-records">${formatLengthM(visual.recordsM)} records-derived (TFR / AR)</div>` : ""}
        ${visual.classifiedPct > 0 ? `<div class="sr-cad-cover-classified">${visual.classifiedPct}% auto-classified from layer names</div>` : ""}
      </div>
      ${donut ? `<div class="sr-cad-cover-donut">${donut}</div>` : ""}
    </div>
  </div>`;
}

function cadImportBlock(cad, utilitiesTable = []) {
  if (!cad?.summary?.length && !cad?.narrative) return "";
  const visual = buildCadVisualSummary(cad);
  let body = "";

  if (visual) {
    body += cadStatCardsHtml(visual);
    body += `<p class="sr-cad-note">${esc(cad.entityFilter?.includedNote || "LINE, LWPOLYLINE and POLYLINE (incl. 3D) only — blocks, text and other entities ignored.")}</p>`;
    if (cad.preview?.paths?.length) {
      body += buildCadPreviewSvg(cad.preview, { width: 520, height: 200 });
    }
    if (cad.importDiff) {
      const d = cad.importDiff;
      const sign = d.totalDeltaM > 0 ? "+" : "";
      body += `<div class="sr-callout sr-callout--diff"><div class="sr-callout-title">Re-import change vs ${esc(d.previousFileName || "previous file")}</div><p>Total ${sign}${d.totalDeltaM} m · ${d.segmentDelta >= 0 ? "+" : ""}${d.segmentDelta} segments · ${d.layerDelta >= 0 ? "+" : ""}${d.layerDelta} layers.</p></div>`;
    }
    body += `<h3 class="sr-subhead">Linework composition</h3>${cadCompositionHtml(visual.composition, visual.totalM)}`;
    body += `<div class="sr-cad-charts">
      <div class="sr-cad-chart-col"><h3 class="sr-subhead">By utility type</h3>${cadBarChartHtml(visual.byUtility)}</div>
      <div class="sr-cad-chart-col"><h3 class="sr-subhead">PAS128 QL share</h3>${buildCadQlDonutSvg(visual.byQl, visual.totalM)}</div>
    </div>`;
  }

  if (cad.summary?.length) {
    body += dataTable(
      ["Utility", "PAS128 QL", "Total length", "Share", "Segments", "CAD layer(s)"],
      cad.summary.map((g) => {
        const share = visual?.totalM > 0 ? `${Math.round((g.lengthM / visual.totalM) * 100)}%` : "—";
        const lengthCell = {
          __html: `<span class="sr-cad-length-cell"><span class="sr-cad-length-val">${esc(formatLengthM(g.lengthM))}</span><span class="sr-cad-length-bar" style="width:${visual && visual.totalM > 0 ? Math.round((g.lengthM / visual.totalM) * 100) : 0}%;background:${cadUtilityColor(g.utilityKey)}"></span></span>`,
        };
        return [
          g.utilityLabel || "—",
          { __html: qlBadgeHtml(g.qlKey || g.pas128Equivalent) },
          lengthCell,
          share,
          String(g.segments),
          (g.layers || []).join(", "),
        ];
      })
    );
    if (cad.totals) {
      body += `<p class="sr-cad-total"><strong>Total linework:</strong> ${formatLengthM(cad.totals.lengthM)} · ${cad.totals.segments} segment(s) · ${cad.totals.layerCount} layer(s) · file: ${esc(cad.fileName || "—")}</p>`;
    }
  }

  const comparison = buildCadFieldComparison(cad, utilitiesTable).filter((r) => r.cadLengthM > 0);
  if (comparison.length && utilitiesTable?.length) {
    body += `<h3 class="sr-subhead">CAD vs field utility schedule</h3>${dataTable(
      ["Utility", "CAD length", "Schedule rows", "Alignment"],
      comparison.map((r) => [
        r.utilityLabel,
        formatLengthM(r.cadLengthM),
        String(r.fieldCount),
        r.hasFieldMatch ? "Matched in schedule" : "CAD only — add field row if verified on site",
      ])
    )}`;
  }

  if (cad.entityFilter?.skippedEntities && Object.keys(cad.entityFilter.skippedEntities).length) {
    const chips = Object.entries(cad.entityFilter.skippedEntities)
      .map(([type, n]) => `<span class="sr-cad-skip-chip">${n}× ${esc(type)}</span>`)
      .join("");
    body += `<div class="sr-cad-skipped"><span class="sr-cad-skipped-label">Ignored entities:</span>${chips}</div>`;
  }

  if (cad.recordsDerivedM > 0) {
    body += `<div class="sr-callout sr-callout--records"><div class="sr-callout-title">Records-derived linework (TFR / AR / B4)</div><p>${formatLengthM(cad.recordsDerivedM)} shown from desktop or undertaker records without full geophysical verification — PAS128 QL B4 equivalent unless verified by trial hole or exposure.</p></div>`;
  }
  if (cad.unmatchedLayers?.length) {
    body += `<h3 class="sr-subhead">Layers not auto-classified</h3>${dataTable(
      ["Layer", "Length", "Segments"],
      cad.unmatchedLayers.slice(0, 15).map((l) => [l.layer, formatLengthM(l.lengthM), String(l.segments)])
    )}`;
  }
  if (cad.narrative) {
    body += `<div class="sr-narrative sr-cad-narrative">${nl2p(cad.narrative.replace(/^=== CAD utility length summary[^\n]*===\n?/m, ""))}</div>`;
  }
  return body;
}

function weatherBlock(report) {
  const w = report.weather || {};
  const rows = [];
  if (w.tempC != null || w.tempMinC != null) {
    const temp =
      w.tempMinC != null && w.tempC != null && w.tempMinC !== w.tempC
        ? `${w.tempMinC}–${w.tempC}°C`
        : w.tempC != null
          ? `${w.tempC}°C`
          : `${w.tempMinC}°C`;
    rows.push(["Temperature", temp]);
  }
  if (w.windMph != null && !Number.isNaN(Number(w.windMph))) {
    rows.push(["Wind", `Up to ~${Number(w.windMph).toFixed(1)} mph`]);
  }
  const narrative = buildWeatherNarrative(w);
  const tablePart = rows.length ? dataTable(["Parameter", "Value"], rows) : "";
  const textPart = narrative ? nl2p(narrative) : "";
  return `${tablePart}${textPart ? `<div class="sr-narrative">${textPart}</div>` : ""}`;
}

function utilitiesTableBlock(rows, photoIndexByGeoId = {}) {
  if (!rows?.length) return "";
  const rich = rows.some((r) => r.diameter || r.material || r.source || r.detectStatus);
  if (rich) {
    return dataTable(
      ["Utility", "Dia.", "Material", "Depth", "Source", "Status", "QL", "Figure", "Notes"],
      rows.map((r) => {
        const fig = r.geoPhotoId && photoIndexByGeoId[r.geoPhotoId] ? `Fig. ${photoIndexByGeoId[r.geoPhotoId]}` : "";
        return [
          utilityTypeLabel(r.utilityType) || r.utilityType || r.label || "",
          r.diameter || "",
          r.material || "",
          r.depth || "",
          utilitySourceLabel(r.source) || r.source || r.method || "",
          utilityDetectStatusLabel(r.detectStatus) || r.detectStatus || "",
          r.pas128Ql ? { __html: qlBadgeHtml(r.pas128Ql) } : "",
          fig,
          r.notes || "",
        ];
      })
    );
  }
  return dataTable(
    ["Utility", "Approx. depth", "Method", "PAS128 QL", "Confidence", "Figure", "Notes"],
    rows.map((r) => {
      const fig = r.geoPhotoId && photoIndexByGeoId[r.geoPhotoId] ? `Fig. ${photoIndexByGeoId[r.geoPhotoId]}` : "";
      return [
        utilityTypeLabel(r.utilityType) || r.utilityType || r.label || "",
        r.depth || "",
        r.method || "",
        r.pas128Ql ? { __html: qlBadgeHtml(r.pas128Ql) } : "",
        utilityConfidenceLabel(r.confidence) || r.confidence || "",
        fig,
        r.notes || "",
      ];
    })
  );
}

function giLocationsTableBlock(rows, photoIndexByGeoId = {}) {
  if (!rows?.length) return "";
  return dataTable(
    ["Location ID", "Method", "Depth", "Figure", "Notes"],
    rows.map((r) => {
      const fig = r.geoPhotoId && photoIndexByGeoId[r.geoPhotoId] ? `Fig. ${photoIndexByGeoId[r.geoPhotoId]}` : "";
      return [r.locationId || "", r.method || "", r.depth || "", fig, r.notes || ""];
    })
  );
}

function deliverablesBlock(rows) {
  if (!rows?.length) return "";
  return dataTable(
    ["Format", "Description", "CRS / grid", "Status"],
    rows.map((r) => [
      deliverableFormatLabel(r.format) || r.format || "",
      r.description || "",
      r.crs || "",
      r.status || "",
    ])
  );
}

function recordsReferencesBlock(rows) {
  if (!rows?.length) return "";
  return dataTable(
    ["Source", "Reference", "Received", "Status"],
    rows.map((r) => [
      r.source || "",
      r.reference || "",
      r.receivedDate ? new Date(r.receivedDate).toLocaleDateString("en-GB") : "",
      recordRefStatusLabel(r.status) || r.status || "",
    ])
  );
}

function dbydEnquiriesBlock(rows) {
  if (!rows?.length) return "";
  const prov = (k) => DBYD_ENQUIRY_PROVIDERS.find((o) => o.key === k)?.label || k;
  const stat = (k) => DBYD_ENQUIRY_STATUS.find((o) => o.key === k)?.label || k;
  return dataTable(
    ["Provider", "Reference", "Date", "Undertakers", "Status", "Notes"],
    rows.map((r) => [
      prov(r.provider),
      r.reference || "",
      r.enquiryDate ? new Date(r.enquiryDate).toLocaleDateString("en-GB") : "",
      r.undertakers || "",
      stat(r.status),
      r.notes || "",
    ])
  );
}

function undertakerResponsesBlock(rows) {
  if (!rows?.length) return "";
  const cat = (k) => UNDERTAKER_CATEGORIES.find((o) => o.key === k)?.label || k;
  const stat = (k) => UNDERTAKER_RESPONSE_STATUS.find((o) => o.key === k)?.label || k;
  const summary = { affected: 0, not_affected: 0, no_response: 0 };
  rows.forEach((r) => {
    if (summary[r.status] != null) summary[r.status] += 1;
  });
  const summaryHtml = `<div class="sr-callout sr-callout--records"><div class="sr-callout-title">Response summary</div><p>Affected: ${summary.affected} · Not affected: ${summary.not_affected} · No response: ${summary.no_response}</p></div>`;
  return `${summaryHtml}${dataTable(
    ["Undertaker", "Category", "Status", "Response date", "Notes"],
    rows.map((r) => [
      r.undertaker || "",
      cat(r.category),
      stat(r.status),
      r.responseDate ? new Date(r.responseDate).toLocaleDateString("en-GB") : "",
      r.notes || "",
    ])
  )}`;
}

function trialHolesBlock(rows) {
  if (!rows?.length) return "";
  return dataTable(
    ["ID", "Location", "Depth", "Utility", "PAS128 QL", "Result", "Notes"],
    rows.map((r) => [
      r.holeId || "",
      r.location || "",
      r.depth || "",
      utilityTypeLabel(r.utilityVerified),
      r.pas128Ql || "",
      r.result || "",
      r.notes || "",
    ])
  );
}

function cctvRunsBlock(rows) {
  if (!rows?.length) return "";
  const grade = (k) => MSCC_PIPE_GRADES.find((o) => o.key === k)?.label || k;
  return dataTable(
    ["Run", "Upstream", "Downstream", "Size", "Length", "Direction", "MSCC grade", "Notes"],
    rows.map((r) => [
      r.runId || "",
      r.upstreamMH || "",
      r.downstreamMH || "",
      r.pipeSize || "",
      r.lengthM || "",
      r.direction || "",
      grade(r.msccGrade),
      r.defectsNotes || "",
    ])
  );
}

function uavFlightsBlock(rows) {
  if (!rows?.length) return "";
  const wind = (k) => UAV_WIND_BANDS.find((o) => o.key === k)?.label || k;
  return dataTable(
    ["Flight", "Date", "Duration", "Altitude", "Overlap", "GCPs", "Wind", "Notes"],
    rows.map((r) => [
      r.flightId || "",
      r.flightDate ? new Date(r.flightDate).toLocaleDateString("en-GB") : "",
      r.durationMin || "",
      r.altitudeM || "",
      r.overlapPct || "",
      r.gcpCount || "",
      wind(r.windBand),
      r.notes || "",
    ])
  );
}

function laserScansBlock(rows) {
  if (!rows?.length) return "";
  const stat = (k) => LASER_REGISTRATION_STATUS.find((o) => o.key === k)?.label || k;
  return dataTable(
    ["Scan", "Location", "Scanner", "Points", "RMSE (mm)", "Status", "Notes"],
    rows.map((r) => [
      r.scanId || "",
      r.location || "",
      r.scannerModel || "",
      r.pointCount || "",
      r.registrationRmse || "",
      stat(r.registrationStatus),
      r.notes || "",
    ])
  );
}

function acmRegisterBlock(rows) {
  if (!rows?.length) return "";
  const risk = (k) => ACM_MATERIAL_RISK_SCORE.find((o) => o.key === k)?.label || k;
  const result = (k) => ACM_SAMPLE_RESULTS.find((o) => o.key === k)?.label || k;
  const rec = (k) => ACM_RECOMMENDATIONS.find((o) => o.key === k)?.label || k;
  return dataTable(
    ["Sample/item", "Location", "Material", "Product type", "Extent", "Condition", "Risk", "Sample result", "Recommendation"],
    rows.map((r) => [
      r.sampleRef || "",
      r.location || "",
      r.materialDescription || "",
      r.productType || "",
      r.extentM2 || "",
      r.condition || "",
      risk(r.riskScore),
      result(r.sampleResult),
      rec(r.recommendation),
    ])
  );
}

function qaChecklistBlock(qa, surveyType = "") {
  if (!qa) return "";
  const groups = getQaChecklistGroupsForSurveyType(surveyType);
  const rows = groups.flatMap((g) =>
    g.items.map(({ key, label }) => [`${g.label} — ${label}`, qa[key] ? "Yes" : "No"])
  );
  return dataTable(["Check", "Result"], rows);
}

function signaturesBlock(report) {
  if (isUtilityMappingPrintTheme()) {
    return renderUtilityMappingApprovalBlock(report);
  }
  const sig = report.signatures || {};
  const surveyor = sig.surveyorName || report.surveyor || report.documentControl?.preparedBy || "";
  return `<div class="sr-signatures">
    <div class="sr-sig-box">
      <div class="sr-sig-label">Surveyor / author</div>
      <div class="sr-sig-line">${esc(surveyor || " ")}</div>
      <div class="sr-sig-date">Date: ${sig.surveyorSignedDate ? new Date(sig.surveyorSignedDate).toLocaleDateString("en-GB") : "_______________"}</div>
    </div>
    <div class="sr-sig-box">
      <div class="sr-sig-label">Client acceptance (optional)</div>
      <div class="sr-sig-line">${esc(sig.clientName || " ")}</div>
      <div class="sr-sig-date">Date: ${sig.clientAcceptedDate ? new Date(sig.clientAcceptedDate).toLocaleDateString("en-GB") : "_______________"}</div>
    </div>
  </div>`;
}

function photoGrid(photos) {
  if (!photos?.length) return { html: "", indexByGeoId: {} };

  const indexByGeoId = {};
  photos.forEach((p, idx) => {
    if (p.geoPhotoId) indexByGeoId[p.geoPhotoId] = idx + 1;
  });

  const grouped = new Map();
  GEO_PHOTO_GROUP_ORDER.forEach((g) => grouped.set(g, []));
  SURVEY_PHOTO_CATEGORIES.forEach((c) => grouped.set(c.label, []));
  grouped.set("Other", []);

  photos.forEach((p, idx) => {
    const type = p.geoPhotoType || p.type;
    let group = type ? geoPhotoPreset(type).group : surveyPhotoCategoryLabel(p.category || "field_work");
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push({ ...p, figureNum: idx + 1 });
  });

  const renderPhoto = (p) => {
    const src = imgSrcAttr(p.dataUrl || p.url);
    if (!src) return "";
    const meta = [];
    if (p.geoPhotoId) meta.push("Geo-photo");
    if (p.latitude != null && p.longitude != null) {
      meta.push(`${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}`);
    }
    if (p.bearing != null && !Number.isNaN(Number(p.bearing))) meta.push(`${Math.round(Number(p.bearing))}°`);
    const cap = p.caption || "Site photo";
    const metaStr = meta.length ? ` (${meta.join(" · ")})` : "";
    return `<figure class="sr-photo"><div class="sr-fig-label">Figure ${p.figureNum}</div><img src="${src}" alt=""/><figcaption>${esc(cap)}${esc(metaStr)}</figcaption></figure>`;
  };

  const groupBlocks = [...grouped.entries()]
    .filter(([, items]) => items.length)
    .map(([group, items]) => {
      const cells = items.map(renderPhoto).join("");
      return `<div class="sr-photo-group"><h3 class="sr-subhead">${esc(group)}</h3><div class="sr-photo-grid">${cells}</div></div>`;
    })
    .join("");

  const geoPhotos = photos.filter((p) => p.geoPhotoId && p.latitude != null);
  const mapUrl = geoPhotos.length >= 2 ? geoPhotosStaticMapUrl(geoPhotos) : "";
  const mapNote = geoPhotosStaticMapCaption(geoPhotos);
  const mapBlock = mapUrl
    ? `<figure class="sr-cover-map sr-photo-map"><img src="${mapUrl}" alt="Geo-photo locations"/><figcaption>Geo-photo locations (${geoPhotos.length} points)${mapNote ? ` — ${esc(mapNote)}` : ""}</figcaption></figure>`
    : "";

  const html = `${mapBlock}${groupBlocks}`;

  return { html, indexByGeoId };
}

function keyFindingsCallout(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const snippet = t.length > 320 ? `${t.slice(0, 317)}…` : t;
  return `<div class="sr-callout"><div class="sr-callout-title">Key findings</div><p>${esc(snippet)}</p></div>`;
}

/**
 * Build full A4 print HTML for a survey report.
 * @param {object} report
 * @param {{ ramsTitle?: string, projectLat?: number, projectLng?: number, coverPhotoUrl?: string }} [extras]
 */
export function buildSurveyReportHtml(report, extras = {}) {
  const org = getOrgSettings();
  const umTheme = isUtilityMappingPrintTheme();
  const primary =
    umTheme && (!org.primaryColor || org.primaryColor === "#0d9488")
      ? "#0B1D3A"
      : org.primaryColor || "#0d9488";
  const accent =
    umTheme && (!org.accentColor || org.accentColor === "#f97316" || org.accentColor === "#0f766e")
      ? "#00B4E4"
      : org.accentColor || "#0f766e";
  const now = new Date();
  const r = normalizeSurveyReport(report);

  const limitations =
    r.limitationsText?.trim() || buildLimitationsFromKeys(r.limitationKeys);
  const recordsText = buildUtilityRecordsNarrative(r.utilityRecords);
  const accessText = buildAccessLimitationsText(r.accessLimitations, r.accessLimitationsNotes);
  const programmeText = buildSurveyProgrammeNarrative(r.surveyProgramme);
  const controlText = buildControlAccuracyNarrative(r.controlAccuracy);
  const qaText = buildQaChecklistNarrative(r.qaChecklist, r.surveyType);
  const qaProse = buildQaChecklistProse(r.qaChecklist, r.surveyType);
  const standardsText = buildStandardsCitedNarrative(r.standardsCited);

  const hseParts = [];
  if (extras.ramsTitle) hseParts.push(`Linked RAMS: ${extras.ramsTitle}.`);
  if (r.hseRefs?.permitRef?.trim()) hseParts.push(`Permit reference: ${r.hseRefs.permitRef.trim()}.`);
  if (r.hseRefs?.catScanRef?.trim()) hseParts.push(`CAT scan reference: ${r.hseRefs.catScanRef.trim()}.`);
  if (r.surveyType === "uav_aerial" && r.uavCompliance) {
    const uc = r.uavCompliance;
    const uavParts = [];
    if (uc.caaOperatorId?.trim()) uavParts.push(`CAA Operator ID ${uc.caaOperatorId.trim()}`);
    if (uc.flyerIds?.trim()) uavParts.push(`Flyer ID ${uc.flyerIds.trim()}`);
    if (uc.authorisationRef?.trim()) uavParts.push(`Authorisation ${uc.authorisationRef.trim()}`);
    if (uc.droneRegistration?.trim()) uavParts.push(`Aircraft reg. ${uc.droneRegistration.trim()}`);
    if (uc.insurancePolicyRef?.trim()) uavParts.push(`Insurance ${uc.insurancePolicyRef.trim()}`);
    if (uc.notamRef?.trim()) uavParts.push(`NOTAM ${uc.notamRef.trim()}`);
    if (uavParts.length) hseParts.push(`UAV compliance — ${uavParts.join("; ")}.`);
    if (uc.groundExclusionPlanRef?.trim()) hseParts.push(uc.groundExclusionPlanRef.trim());
  }
  if (r.hseRefs?.ramsExcerpt?.trim()) hseParts.push(r.hseRefs.ramsExcerpt.trim());

  const sections = [];
  const toc = [];
  let sectionCounter = 0;
  const umClassic = r.printOutline === "um_classic";
  const dualMethodKeys = formatDualPas128Method(r.pas128Method, r.pas128MethodSecondary);
  const dualMethodDisplay = formatDualPas128Method(
    r.pas128Method ? pas128MethodLabel(r.pas128Method) : "",
    r.pas128MethodSecondary ? pas128MethodLabel(r.pas128MethodSecondary) : ""
  );

  const nextNum = () => {
    sectionCounter += 1;
    return String(sectionCounter);
  };

  const pushSection = (title, id, body, includeInToc = true) => {
    if (!body?.trim()) return;
    const displayTitle = umClassic ? umClassicSectionTitle(id, title) : title;
    const num = nextNum();
    sections.push({ id, html: section(displayTitle, body, id, num) });
    if (includeInToc) toc.push({ num, title: displayTitle, id });
  };

  // UM uses branded page-2 document control after the hero cover — skip duplicate body section.
  if (!umTheme) {
    pushSection("Document control", "doc-control", documentControlBlock(r));
  }

  if ((r.changesSincePrevious || []).length) {
    pushSection("Changes since previous issue", "changes", changesSinceBlock(r.changesSincePrevious));
  }

  const infoBody = metaGrid([
    ["Report ref", r.ref || "—"],
    ["Survey date", r.surveyDate ? new Date(r.surveyDate).toLocaleDateString("en-GB") : "—"],
    ["Client", r.client || "—"],
    ["Project", r.projectName || "—"],
    ["Site", r.siteAddress || "—"],
    ["Survey type", surveyTypeLabel(r.surveyType) || "—"],
    ["PAS128 QL", r.pas128Ql ? pas128Label(r.pas128Ql) : "—"],
    ["PAS128 method", dualMethodDisplay || dualMethodKeys || "—"],
    ["Surveyor / author", r.surveyor || "—"],
    ["Linked RAMS", extras.ramsTitle || "—"],
  ]);
  pushSection("Report information", "info", infoBody);

  try {
    const digRisk = umTheme ? computeUtilityMappingDigRisk(r) : null;
    const insight = buildCoverInsightStripHtml(r, digRisk?.label ? digRisk : null);
    if (insight) {
      pushSection("Survey at a glance", "insight", insight);
    }
  } catch {
    /* dig-risk optional */
  }

  if (r.sections?.executiveSummary?.trim()) {
    pushSection("Executive summary", "exec", nl2p(r.sections.executiveSummary));
  }

  if (r.sections?.foreword?.trim()) {
    pushSection("Foreword", "foreword", nl2p(r.sections.foreword));
  }

  if (programmeText) {
    pushSection("Survey programme", "programme", nl2p(programmeText));
  }

  pushSection("Scope of works", "scope", nl2p(r.sections?.scope));
  const methodLadder = r.pas128Method ? buildMethodLadderHtml(r.pas128Method) : "";
  pushSection("Methodology", "method", `${methodLadder}${nl2p(r.sections?.methodology)}`);

  if (isUtilitySurveyType(r.surveyType)) {
    pushSection(
      "PAS 128 quality levels",
      "pas128-ql-tolerances",
      `<p class="sr-narrative">Quality levels assigned to detected utilities in this report:</p>${pas128QlToleranceHtmlTable()}`
    );
  }

  const workflowText = buildPas128WorkflowNarrative(r.pas128Method);
  const workflowSvg = r.pas128Method ? buildPas128WorkflowSvg(r.pas128Method, { primary, accent }) : "";
  if (workflowSvg || workflowText?.trim()) {
    pushSection("Survey workflow", "workflow", `${workflowSvg}${workflowText?.trim() && !workflowSvg ? nl2p(workflowText) : ""}`);
  }

  if (r.sections?.equipmentUsed?.trim() || (r.equipmentKit || []).length) {
    const kitHtml = buildEquipmentThickboxHtml(r.equipmentKit, "");
    const prose = r.sections?.equipmentUsed?.trim() ? nl2p(r.sections.equipmentUsed) : "";
    pushSection("Equipment used", "equipment", `${kitHtml}${prose ? `<div class="sr-narrative">${prose}</div>` : ""}`);
  }

  const equipCal = buildEquipmentCalibrationNarrative(r.equipmentCalibration);
  if (equipCal || (r.equipmentCalibration || []).length) {
    pushSection(
      "Equipment calibration",
      "equipment-cal",
      `${equipmentCalibrationBlock(r.equipmentCalibration)}${equipCal ? `<div class="sr-narrative">${nl2p(equipCal)}</div>` : ""}`
    );
  }

  const equipAppendix = buildEquipmentAppendixHtml(r.equipmentKit);
  if (equipAppendix) {
    pushSection("Equipment datasheets", "equipment-appendix", equipAppendix);
  }

  const geologyHtml = buildGeologyBlockHtml(r.geology);
  if (geologyHtml) {
    pushSection("Geological context", "geology", geologyHtml);
  }

  const extentPlates = buildExtentAreasHtml(r.extentAreas);
  const areasFlipbook = buildSurveyAreasFlipbookHtml(r.surveyAreas);
  const aocRibbon = buildAocChainageRibbonHtml(r.extentAreas, r.surveyAreas);
  if (r.sections?.surveyExtent?.trim() || extentPlates || areasFlipbook || aocRibbon) {
    pushSection(
      "Survey extent",
      "extent",
      `${aocRibbon}${extentPlates}${areasFlipbook}${r.sections?.surveyExtent?.trim() ? `<div class="sr-narrative">${nl2p(r.sections.surveyExtent)}</div>` : ""}`
    );
  }

  if (controlText) {
    pushSection("Control & accuracy", "control", nl2p(controlText));
  }

  const weatherThick = buildWeatherThickboxHtml(r.weather);
  const weatherBody = weatherThick || weatherBlock(r);
  if (String(weatherBody || "").trim()) {
    pushSection("Weather at site", "weather", weatherBody);
  }

  if (recordsText) {
    pushSection("Utility records & drawings review", "records", nl2p(recordsText));
  }

  const recordsRefs = recordsReferencesBlock(r.recordsReferences);
  if (recordsRefs) {
    pushSection("Records references", "records-refs", recordsRefs);
  }

  const dbydBlock = dbydEnquiriesBlock(r.dbydEnquiries);
  if (dbydBlock) {
    pushSection("LSBUD / DBYD enquiry log", "dbyd-log", dbydBlock);
  }

  const undertakerBlock = undertakerResponsesBlock(r.undertakerResponses);
  if (undertakerBlock) {
    pushSection("Undertaker response status", "undertaker-status", undertakerBlock);
  }

  const photoBundle = photoGrid(r.photos);
  const photoIndexByGeoId = photoBundle.indexByGeoId || {};

  let findingsBody = "";
  const constraintChips = buildConstraintChipsHtml(r);
  const tfrLegend = isUtilitySurveyType(r.surveyType) || (r.recordItems || []).length ? buildTfrLegendStripHtml() : "";
  const undertakerFindings = buildUndertakerFindingsBlocksHtml(r.recordItems, r.evidenceRows);
  const recordsMatrix =
    buildRecordsScoreboardHtml(r.recordItems) +
    (buildRecordsMatrixNarrative(r.recordItems, r.recordItemsNarrative)
      ? `<div class="sr-narrative">${nl2p(buildRecordsMatrixNarrative(r.recordItems, r.recordItemsNarrative))}</div>`
      : "");
  // Avoid duplicating evidence already shown under undertaker blocks
  const linkedUndertakers = new Set(
    (r.recordItems || []).map((x) => x.undertaker).filter(Boolean)
  );
  const orphanEvidence = (r.evidenceRows || []).filter(
    (e) => !e.undertaker || !linkedUndertakers.has(e.undertaker)
  );
  const evidenceHtml = buildEvidenceRowsHtml(orphanEvidence);
  if (constraintChips) findingsBody += constraintChips;
  if (tfrLegend) findingsBody += tfrLegend;
  if (recordsMatrix) findingsBody += recordsMatrix;
  if (undertakerFindings) findingsBody += undertakerFindings;
  if (evidenceHtml) findingsBody += evidenceHtml;
  const gprAnomalyHtml = buildGprAnomalyCardsHtml(r.gprAnomalyCards, r.gprConclusions);
  if (gprAnomalyHtml) findingsBody += gprAnomalyHtml;
  const mhIcHtml = buildMhIcCardsHtml(r.mhIcCards);
  if (mhIcHtml) findingsBody += mhIcHtml;
  if (r.cctvRunsTable?.length) findingsBody += cctvRunsBlock(r.cctvRunsTable);
  if (r.uavFlightsTable?.length) findingsBody += uavFlightsBlock(r.uavFlightsTable);
  if (r.laserScansTable?.length) findingsBody += laserScansBlock(r.laserScansTable);
  if (r.acmRegisterTable?.length) findingsBody += acmRegisterBlock(r.acmRegisterTable);
  if (r.trialHolesTable?.length) {
    findingsBody += trialHolesBlock(r.trialHolesTable);
  }
  if (r.giLocationsTable?.length) {
    findingsBody += giLocationsTableBlock(r.giLocationsTable, photoIndexByGeoId);
    findingsBody += `<div class="sr-narrative">${nl2p(r.sections?.findings)}</div>`;
  } else if (r.utilitiesTable?.length) {
    findingsBody += utilitiesTableBlock(r.utilitiesTable, photoIndexByGeoId);
    findingsBody += `<div class="sr-narrative">${nl2p(r.sections?.findings)}</div>`;
  } else if (r.sections?.findings?.trim()) {
    findingsBody += nl2p(r.sections?.findings);
  }
  if (
    r.sections?.findings?.trim() ||
    r.utilitiesTable?.length ||
    r.cctvRunsTable?.length ||
    r.uavFlightsTable?.length ||
    r.laserScansTable?.length ||
    r.acmRegisterTable?.length ||
    r.trialHolesTable?.length ||
    (r.evidenceRows || []).length ||
    (r.recordItems || []).length ||
    (r.gprAnomalyCards || []).length ||
    (r.mhIcCards || []).length ||
    String(r.gprConclusions || "").trim()
  ) {
    const callout = keyFindingsCallout(r.sections?.findings);
    pushSection("Findings & results", "findings", `${callout}${findingsBody}`);
  }

  const geoThick = buildGeoPhotoGroupThickboxesHtml(r.photos);
  if (geoThick) {
    pushSection("Site evidence by category", "geophoto-groups", geoThick);
  }

  const customHtml = buildCustomSectionsHtml(r.customSections);
  if (customHtml) {
    pushSection("Additional notes", "custom-sections", customHtml);
  }

  if (r.cadImport?.summary?.length || r.cadImport?.narrative) {
    pushSection("CAD utility length summary", "cad-import", cadImportBlock(r.cadImport, r.utilitiesTable));
  }

  if (r.sitePlanSummary?.trim()) {
    pushSection("Site plan reference", "site-plan", nl2p(r.sitePlanSummary));
  }
  if ((r.sitePlanSnapshots || []).length) {
    const planBody = `<div class="sr-plan-grid">${(r.sitePlanSnapshots || [])
      .map(
        (s) =>
          (() => {
            const src = imgSrcAttr(s.dataUrl);
            if (!src) return "";
            return `<figure class="sr-plan-figure"><img src="${src}" alt="${esc(s.name || "Site plan")}"/><figcaption>${esc(s.name || "Site plan")}</figcaption></figure>`;
          })()
      )
      .join("")}</div>`;
    pushSection("Site plan markup", "site-plan-images", planBody);
  }

  if (limitations) {
    pushSection("Limitations", "limitations", nl2p(limitations));
  }

  if (
    includesPas128MethodLimitations(r.pas128Method) &&
    pas128MethodAppliesToSurveyType(r.surveyType)
  ) {
    const methodLimits = buildPas128LimitationsHtml();
    pushSection("Limitations of EML", "limitations-eml", methodLimits.eml);
    pushSection("Limitations of GPR", "limitations-gpr", methodLimits.gpr);
  }

  if (accessText || buildConstraintChipsHtml(r)) {
    pushSection(
      "Site access limitations",
      "access",
      `${buildConstraintChipsHtml(r)}${accessText ? `<div class="sr-narrative">${nl2p(accessText)}</div>` : ""}`
    );
  }

  const deliverables = deliverablesBlock(r.deliverables);
  if (deliverables) {
    pushSection("Deliverables schedule", "deliverables", deliverables);
  }

  if (r.sections?.recommendations?.trim()) {
    pushSection("Recommendations", "recommendations", nl2p(r.sections.recommendations));
  }

  if (standardsText) {
    pushSection("Standards referenced", "standards", nl2p(standardsText));
  }

  if (qaText || qaProse) {
    pushSection(
      "QA & verification",
      "qa",
      `${qaProse ? `<div class="sr-narrative">${nl2p(qaProse)}</div>` : ""}${qaChecklistBlock(r.qaChecklist, r.surveyType)}`
    );
  }

  if (hseParts.length) {
    pushSection("Health & safety cross-reference", "hse", nl2p(hseParts.join("\n\n")));
  }

  if (photoBundle.html) {
    if (umTheme) {
      sections.push({
        id: "photos-divider",
        html: renderUtilityMappingAppendixDivider({
          letter: "A",
          title: "Photo appendix",
          subtitle: "Geo-photos and site evidence",
          reportRef: r.ref || "",
        }),
      });
    }
    pushSection("Photo appendix", "photos", photoBundle.html);
  }

  const sigBlock = signaturesBlock(r);
  pushSection("Sign-off", "signatures", sigBlock);

  const cover = coverPage(r, org, primary, accent, extras);
  const tocHtml = toc.length ? tableOfContents(toc) : "";
  const umLogo = resolveUtilityMappingLogoSrc(org);
  const umDocControl =
    umTheme
      ? renderUtilityMappingDocControlPage({
          client: r.client || "",
          title: r.title || r.projectName || "",
          reportRef: r.ref || "",
          logoSrc: umLogo,
          clientCode: r.umClientCode || parseUtilityMappingRef(r.ref)?.clientCode || "",
          clientLogoSrc: utilityMappingClientLogoUrl(
            r.umClientCode || parseUtilityMappingRef(r.ref)?.clientCode || ""
          ),
          authors: [
            {
              name: r.documentControl?.preparedBy || r.surveyor || "—",
              title: "Utility Surveyor",
              date: (r.documentControl?.issueDate || r.surveyDate)
                ? new Date(r.documentControl?.issueDate || r.surveyDate).toLocaleDateString("en-GB")
                : "",
            },
          ],
          checkedBy: {
            name: r.documentControl?.checkedBy || "—",
            title: "Technical Manager",
            date: r.documentControl?.issueDate
              ? new Date(r.documentControl.issueDate).toLocaleDateString("en-GB")
              : "",
          },
        })
      : "";
  const umExec = umTheme ? renderUtilityMappingExecutivePage(r, { logoSrc: umLogo }) : "";
  const umDig = umTheme ? renderUtilityMappingDigReadinessPage(r, { logoSrc: umLogo }) : "";
  const umDel = umTheme ? renderUtilityMappingDeliverablesPage(r, { logoSrc: umLogo }) : "";
  const umDwg = umTheme ? renderUtilityMappingDrawingsPage(r, { logoSrc: umLogo }) : "";
  const umTocBlock =
    umTheme && tocHtml
      ? `<div class="um-toc-page">${renderUtilityMappingPageHeader(umLogo, r.ref || "")}${renderUtilityMappingComplianceRibbon()}${tocHtml}</div>`
      : tocHtml;

  const dc = r.documentControl || {};
  const footerRef = [r.ref, dc.revision ? `Rev ${dc.revision}` : ""].filter(Boolean).join(" · ");

  const disclaimer = getSurveyReportDisclaimer(org);
  const draftNote = r.status !== "final" ? " <strong>Draft — not for construction use until marked final.</strong>" : "";
  // Same diagonal watermark convention as permits/RAMS/GPR so a printed survey
  // report can't be mistaken for final while still in draft.
  const watermarkText = umTheme
    ? r.status === "final"
      ? `CONTROLLED · ${r.ref || "UM"}`
      : `DRAFT · ${r.ref || "UM"}`
    : String(org.pdfWatermarkText || "").trim() || (r.status === "final" ? "FINAL" : "DRAFT");
  const umThemeCss = umTheme
    ? `${utilityMappingCoverSystemCss()}${utilityMappingSurveyCoverCss(primary, accent)}${utilityMappingPremiumPagesCss(primary, accent)}${SURVEY_EVIDENCE_PRINT_CSS}${SURVEY_PLAN_UPGRADE_CSS}`
    : `${SURVEY_EVIDENCE_PRINT_CSS}${SURVEY_PLAN_UPGRADE_CSS}`;
  const umHeader = umTheme ? renderUtilityMappingPageHeader(umLogo, r.ref || "") : "";
  const umFooter = umTheme ? renderUtilityMappingPageFooter(umLogo) : "";
  const umRibbon = umTheme ? renderUtilityMappingComplianceRibbon() : "";
  const sectionHtml = (umClassic ? reorderSectionsForUmClassic(sections) : sections)
    .map((s) => (typeof s === "string" ? s : s.html))
    .join("");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>${esc(r.title || r.ref || "Survey Report")}</title>
<style>
  @page {
    size: A4;
    margin: 16mm 14mm 28mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111827;
    margin: 0;
    padding: 0 0 24mm;
    counter-reset: sr-page;
  }
  .sr-cover {
    min-height: 255mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    padding: 8mm 2mm 12mm;
  }
  .sr-cover-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 3px solid ${primary};
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .sr-cover-top-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }
  .sr-cover-mso {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    max-width: 38%;
  }
  .sr-cover-mso-label {
    font-size: 8pt;
    color: #64748b;
    text-align: right;
    line-height: 1.3;
  }
  .sr-cover-mso-label strong { display: block; color: ${primary}; font-size: 9pt; }
  .sr-cover-logo { max-height: 56px; max-width: 150px; object-fit: contain; flex-shrink: 0; }
  .sr-cover-org { min-width: 0; }
  .sr-cover-org-name { font-weight: 700; font-size: 14pt; overflow-wrap: anywhere; }
  .sr-cover-org-sub { font-size: 9.5pt; color: #6b7280; margin-top: 4px; }
  .sr-cover-main { flex: 1; }
  .sr-cover-title {
    font-size: 22pt;
    color: ${accent};
    line-height: 1.15;
    margin: 14px 0 18px;
    overflow-wrap: anywhere;
  }
  .sr-cover-footer { font-size: 9pt; color: #9ca3af; margin-top: auto; }
  .sr-cover-photo, .sr-cover-map { margin: 16px 0 0; }
  .sr-cover-photo img, .sr-cover-map img {
    width: 100%;
    max-height: 160px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .sr-cover-map img { object-fit: contain; background: #f8fafc; max-height: 200px; }
  .sr-cover-photo figcaption, .sr-cover-map figcaption { font-size: 9pt; color: #6b7280; margin-top: 4px; }
  .sr-toc {
    page-break-after: always;
    padding: 4mm 2mm 12mm;
  }
  .sr-toc-heading {
    font-size: 14pt;
    color: ${primary};
    border-bottom: 2px solid ${primary};
    padding-bottom: 8px;
    margin: 0 0 14px;
  }
  .sr-toc ol { list-style: none; padding: 0; margin: 0; }
  .sr-toc li { margin: 0 0 8px; font-size: 10.5pt; }
  .sr-toc a {
    display: flex;
    align-items: baseline;
    gap: 8px;
    color: #111827;
    text-decoration: none;
  }
  .sr-toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; min-width: 24px; }
  .sr-body { padding: 0 2mm 22mm; }
  @media print {
    .sr-running-header {
      display: flex;
      justify-content: space-between;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      font-size: 8pt;
      color: #9ca3af;
      border-bottom: 1px solid #e5e7eb;
      padding: 4px 14mm;
      background: #fff;
      z-index: 9999;
    }
    .sr-body { padding-top: 14mm; padding-bottom: 26mm; }
    body { padding-bottom: 28mm; }
  }
  .sr-running-header { display: none; }
  .sr-header-mini {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid ${primary};
    padding-bottom: 8px;
    margin-bottom: 16px;
    font-size: 9pt;
    color: #6b7280;
  }
  .sr-header-mini strong { color: #111827; font-size: 10pt; }
  .sr-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: ${r.status === "final" ? primary : "#f59e0b"};
    color: #fff;
    margin-right: 8px;
  }
  .sr-badge--cover { margin-bottom: 10px; }
  .sr-ql-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 9pt;
    font-weight: 700;
    background: #ecfdf5;
    color: ${accent};
    border: 1px solid ${primary};
    margin-bottom: 10px;
    margin-right: 6px;
  }
  .sr-ql-badge--method {
    background: #f0fdfa;
    color: #0f766e;
    border-color: #99f6e4;
  }
  .sr-limit-list {
    margin: 0 0 8px;
    padding-left: 1.25rem;
    font-size: 10pt;
    line-height: 1.5;
  }
  .sr-limit-list li { margin-bottom: 6px; }
  .sr-quality-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 9pt;
    font-weight: 600;
    border: 1px solid;
    margin-bottom: 10px;
    margin-left: 8px;
  }
  .sr-pas128-summary {
    margin-top: 16px;
    padding: 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #f8fafc;
  }
  .sr-pas128-summary .sr-data-table { margin-top: 10px; margin-bottom: 0; }
  .sr-pas128-stat {
    display: inline-block;
    margin-right: 20px;
    font-size: 9pt;
    color: #6b7280;
  }
  .sr-pas128-num {
    display: block;
    font-size: 16pt;
    font-weight: 700;
    color: ${primary};
    line-height: 1.2;
  }
  .sr-pas128-summary-head { display: flex; flex-wrap: wrap; gap: 12px 20px; margin-bottom: 8px; }
  .sr-pas128-ql-wrap { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb; }
  .sr-pas128-ql-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 8px; }
  .sr-ql-bars { display: flex; flex-direction: column; gap: 6px; }
  .sr-ql-bar-row { display: grid; grid-template-columns: 36px 1fr 28px; gap: 8px; align-items: center; font-size: 9pt; }
  .sr-ql-bar-label { font-weight: 700; color: #374151; }
  .sr-ql-bar-track { height: 8px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
  .sr-ql-bar-fill { height: 100%; border-radius: 999px; min-width: 4px; }
  .sr-ql-bar-count { text-align: right; color: #6b7280; font-weight: 600; }
  .sr-workflow-diagram { margin: 0 0 12px; }
  .sr-workflow-caption { font-size: 8.5pt; color: #6b7280; margin-top: 6px; text-align: center; }
  .sr-undertaker-cover {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 8px;
    background: linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%);
    border: 1px solid #bfdbfe;
  }
  .sr-undertaker-cover__title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1d4ed8; margin-bottom: 8px; }
  .sr-undertaker-cover__stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .sr-undertaker-pill { font-size: 9pt; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
  .sr-undertaker-pill--affected { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .sr-undertaker-pill--clear { background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; }
  .sr-undertaker-pill--pending { background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; }
  .sr-section { margin-bottom: 16px; page-break-inside: auto; }
  .sr-section h2 {
    font-size: 11.5pt;
    color: ${primary};
    border-left: 4px solid ${primary};
    padding-left: 10px;
    margin: 0 0 8px;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .sr-sec-num { color: #6b7280; font-weight: 600; min-width: 1.5em; }
  .sr-subhead { font-size: 10pt; color: #374151; margin: 12px 0 6px; }
  .sr-section p { margin: 0 0 8px; }
  .sr-list { margin: 0 0 8px 18px; padding: 0; }
  .sr-list li { margin-bottom: 4px; }
  .sr-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .sr-meta-item {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px 10px;
    background: #fafafa;
  }
  .sr-meta-key { font-size: 8.5pt; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
  .sr-meta-val { font-size: 10pt; margin-top: 2px; overflow-wrap: anywhere; }
  .sr-data-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 10px;
  }
  .sr-data-table th, .sr-data-table td {
    border: 1px solid #d1d5db;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
    hyphens: auto;
  }
  .sr-data-table tr { page-break-inside: avoid; }
  .sr-data-table th { background: #f3f4f6; font-weight: 600; }
  .sr-data-table tr:nth-child(even) td { background: #fafafa; }
  .sr-narrative { margin-top: 10px; }
  .sr-callout {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-left: 4px solid #f59e0b;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 12px;
  }
  .sr-callout-title { font-weight: 700; font-size: 9.5pt; color: #92400e; margin-bottom: 4px; }
  .sr-callout p { margin: 0; font-size: 10pt; }
  .sr-callout--records { background: #f0fdfa; border-color: #99f6e4; border-left-color: #0d9488; }
  .sr-callout--records .sr-callout-title { color: #0f766e; }
  .sr-cad-total { font-size: 10pt; margin: 8px 0 0; }
  .sr-cad-note { font-size: 9pt; color: #6b7280; margin: 0 0 10px; }
  .sr-cad-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .sr-cad-stat {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px 12px;
    background: #fafafa;
  }
  .sr-cad-stat--accent { background: #f0fdfa; border-color: #99f6e4; }
  .sr-cad-stat-label {
    font-size: 7.5pt;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .sr-cad-stat-val { font-size: 14pt; font-weight: 700; color: ${primary}; line-height: 1.2; margin-top: 2px; }
  .sr-cad-stat--accent .sr-cad-stat-val { color: #1d4ed8; }
  .sr-cad-stat-hint { font-size: 8pt; color: #9ca3af; margin-top: 3px; }
  .sr-cad-comp { margin-bottom: 12px; }
  .sr-cad-comp-bar {
    display: flex;
    height: 12px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }
  .sr-cad-comp-seg { min-width: 2px; }
  .sr-cad-comp-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 6px; font-size: 8.5pt; color: #4b5563; }
  .sr-cad-comp-key { display: inline-flex; align-items: center; gap: 5px; }
  .sr-cad-comp-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
  .sr-cad-charts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 12px;
  }
  .sr-cad-chart-col { page-break-inside: avoid; }
  .sr-cad-bars { display: flex; flex-direction: column; gap: 5px; }
  .sr-cad-bar-row {
    display: grid;
    grid-template-columns: 72px 1fr 44px;
    gap: 6px;
    align-items: center;
    font-size: 8.5pt;
  }
  .sr-cad-bar-label { color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sr-cad-bar-track { height: 9px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
  .sr-cad-bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
  .sr-cad-bar-val { font-weight: 600; text-align: right; }
  .sr-ql-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 8pt;
    font-weight: 700;
    border: 1px solid;
    white-space: nowrap;
  }
  .sr-cad-length-cell { display: flex; flex-direction: column; gap: 3px; min-width: 56px; }
  .sr-cad-length-val { font-weight: 600; }
  .sr-cad-length-bar { display: block; height: 4px; border-radius: 999px; max-width: 100%; }
  .sr-cad-skipped { margin: 8px 0 12px; font-size: 8.5pt; }
  .sr-cad-skipped-label { color: #6b7280; margin-right: 6px; }
  .sr-cad-skip-chip {
    display: inline-block;
    padding: 2px 8px;
    margin: 2px 4px 2px 0;
    border-radius: 999px;
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #e5e7eb;
    font-size: 8pt;
  }
  .sr-cad-narrative-details { margin-top: 10px; font-size: 9.5pt; }
  .sr-cad-narrative-details summary { cursor: pointer; font-weight: 600; color: #374151; }
  .sr-cad-cover-strip {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid #99f6e4;
    background: linear-gradient(180deg, #f0fdfa, #fff);
  }
  .sr-cad-cover-row { display: flex; gap: 14px; align-items: center; justify-content: space-between; }
  .sr-cad-cover-main { flex: 1; min-width: 0; }
  .sr-cad-cover-donut { flex-shrink: 0; }
  .sr-cad-cover-donut .sr-cad-donut-wrap { display: flex; align-items: center; gap: 8px; }
  .sr-cad-cover-donut .sr-cad-donut-legend { display: none; }
  .sr-cad-cover-title { font-size: 9pt; font-weight: 700; color: ${primary}; text-transform: uppercase; letter-spacing: 0.04em; }
  .sr-cad-cover-line { font-size: 10pt; margin-top: 4px; color: #374151; }
  .sr-cad-cover-records { font-size: 9pt; color: #4338ca; margin-top: 4px; }
  .sr-cad-cover-classified { font-size: 9pt; color: #047857; margin-top: 4px; }
  .sr-cad-map { margin: 10px 0 12px; page-break-inside: avoid; }
  .sr-cad-map svg { display: block; border-radius: 6px; border: 1px solid #e5e7eb; }
  .sr-cad-map-legend { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 6px; font-size: 8pt; color: #6b7280; }
  .sr-cad-map-key { display: inline-flex; align-items: center; gap: 4px; }
  .sr-cad-map-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
  .sr-cad-donut-wrap { display: flex; align-items: flex-start; gap: 12px; }
  .sr-cad-donut-legend { display: flex; flex-direction: column; gap: 4px; font-size: 8.5pt; color: #4b5563; }
  .sr-cad-donut-key { display: inline-flex; align-items: center; gap: 5px; }
  .sr-callout--diff { background: #fffbeb; border-color: #fcd34d; border-left-color: #f59e0b; }
  .sr-callout--diff .sr-callout-title { color: #92400e; }
  .sr-photo-group { margin-bottom: 14px; page-break-inside: avoid; }
  .sr-photo-map { margin-bottom: 14px; }
  .sr-photo-map img { max-height: 180px; object-fit: contain; background: #f8fafc; }
  .sr-photo-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .sr-fig-label { font-size: 8.5pt; font-weight: 700; color: ${primary}; margin-bottom: 4px; }
  .sr-photo img {
    width: 100%;
    max-height: 170px;
    object-fit: cover;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }
  .sr-photo figcaption { font-size: 8.5pt; color: #6b7280; margin-top: 4px; }
  .sr-plan-grid { display: flex; flex-direction: column; gap: 14px; }
  .sr-plan-figure { margin: 0; page-break-inside: avoid; }
  .sr-plan-figure img {
    width: 100%;
    max-height: 300px;
    object-fit: contain;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #f8fafc;
  }
  .sr-plan-figure figcaption { font-size: 8.5pt; color: #6b7280; margin-top: 4px; }
  .sr-signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 8px;
  }
  .sr-sig-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; min-height: 90px; }
  .sr-sig-label { font-size: 9pt; font-weight: 600; color: #6b7280; margin-bottom: 24px; }
  .sr-sig-line { border-bottom: 1px solid #111827; min-height: 20px; font-size: 10pt; }
  .sr-sig-date { font-size: 9pt; color: #6b7280; margin-top: 10px; }
  .sr-disclaimer {
    font-size: 8.5pt;
    color: #6b7280;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 10px 12px;
    margin: 20px 2mm 0;
    page-break-inside: avoid;
  }
  .sr-print-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    font-size: 8pt;
    color: #9ca3af;
    border-top: 1px solid #e5e7eb;
    padding: 6px 14mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: #fff;
    z-index: 9998;
  }
  .sr-print-footer span { overflow-wrap: anywhere; max-width: 48%; }
  .sr-watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    font-size: 84px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: rgba(100, 116, 139, 0.09);
    transform: rotate(-28deg);
    z-index: 0;
    text-transform: uppercase;
  }
  @media print {
    .sr-cover, .sr-badge, .sr-ql-badge, .sr-ql-pill, .sr-cad-comp-seg, .sr-cad-bar-fill, .sr-cad-stat--accent, .sr-cad-cover-strip, .sr-section h2, .sr-callout, .sr-data-table th {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    a { color: inherit; text-decoration: none; }
  }
  ${umThemeCss}
</style>
</head>
<body>
  <div class="sr-watermark">${esc(watermarkText)}</div>
  ${cover}
  ${umDocControl}
  ${umExec}
  ${umDig}
  ${umDel}
  ${umDwg}
  ${umTocBlock}
  ${umTheme ? "" : `<div class="sr-running-header"><span>${esc(r.ref || "")}${dc.revision ? ` · Rev ${esc(dc.revision)}` : ""}</span><span>${esc(r.title || "Survey Report")}</span></div>`}
  <div class="sr-body">
    ${umHeader}
    ${umRibbon}
    ${umTheme ? "" : `<div class="sr-header-mini">
      <span><strong>${esc(r.title || "Survey Report")}</strong></span>
      <span>${esc(footerRef)} · Generated ${now.toLocaleDateString("en-GB")}</span>
    </div>`}
    ${sectionHtml}
    <div class="sr-disclaimer">
      ${esc(disclaimer)}${draftNote}
    </div>
  </div>
  ${
    umTheme
      ? umFooter
      : `<div class="sr-print-footer">
    <span>${esc(org.pdfFooter || "Generated by MySafeOps")} · mysafeops.com${org.pdfComplianceLine ? ` · ${esc(org.pdfComplianceLine)}` : ""}</span>
    <span>${esc(footerRef)}</span>
  </div>`
  }
</body>
</html>`;
}

export function openSurveyReportPrint(report, extras) {
  void (async () => {
    const html = buildSurveyReportHtml(report, extras);
    const win = openPrintWindow();
    if (!win) {
      window.alert("Pop-up blocked — allow pop-ups for MySafeOps to print / save PDF.");
      return;
    }
    await writePrintWindowDocument(win, html);
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        window.alert("Could not open the print dialog. Try Download PDF instead.");
      }
    }, 400);
  })();
  return true;
}

export function downloadSurveyReportHtml(report, extras) {
  const html = sanitizePrintPreviewHtml(buildSurveyReportHtml(report, extras));
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const name = `${(report.ref || report.id || "survey_report").replace(/\s+/g, "_")}.html`;
  if (!downloadBlob(blob, name)) {
    window.alert("Download blocked — allow downloads for this site and try again.");
  }
}
