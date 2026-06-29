import { getOrgSettings } from "../../utils/orgSettingsStorage";
import { openPrintWindow, safeImageSrc, escapeAttr, sanitizePrintPreviewHtml } from "../../utils/htmlEscape.js";
import {
  buildAccessLimitationsText,
  buildControlAccuracyNarrative,
  buildEquipmentCalibrationNarrative,
  buildLimitationsFromKeys,
  buildPas128SummaryStats,
  buildQaChecklistNarrative,
  buildSurveyProgrammeNarrative,
  buildUtilityRecordsNarrative,
  buildWeatherNarrative,
  deliverableFormatLabel,
  normalizeSurveyReport,
  recordRefStatusLabel,
  surveyTypeLabel,
  utilityConfidenceLabel,
  utilityTypeLabel,
  surveyReportQuality,
} from "./surveyReportHelpers";
import { PAS128_QUALITY_LEVELS, QA_CHECKLIST_ITEMS } from "./surveyReportConstants";
import { geoPhotoPreset, GEO_PHOTO_GROUP_ORDER } from "../../utils/geoPhotoPresets";
import { geoPhotosStaticMapUrl } from "../../utils/geoPhotoIntegrations";
import { formatLengthM } from "../../utils/surveyDxfAnalyzer";
import {
  buildCadFieldComparison,
  buildCadVisualSummary,
  cadQlDisplayLabel,
  cadQlStyle,
  cadUtilityColor,
} from "../../utils/cadImportVisuals";
import { buildCadPreviewSvg, buildCadQlDonutSvg } from "../../utils/cadPreviewSvg";

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
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "";
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${la},${lo}&zoom=15&size=520x220&markers=${la},${lo},red-pushpin`;
}

function pas128SummaryBlock(report) {
  const stats = buildPas128SummaryStats(report);
  if (!stats) return "";
  const qlRows = Object.entries(stats.byQl).map(([ql, n]) => [pas128Short(ql), String(n)]);
  return `<div class="sr-pas128-summary">
    <div class="sr-pas128-stat"><span class="sr-pas128-num">${stats.total}</span><span>utilities logged</span></div>
    <div class="sr-pas128-stat"><span class="sr-pas128-num">${stats.withDepth}</span><span>with depth</span></div>
    <div class="sr-pas128-stat"><span class="sr-pas128-num">${stats.withGeoPhoto}</span><span>photo linked</span></div>
    ${qlRows.length ? dataTable(["PAS128 QL", "Count"], qlRows) : ""}
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
  const coverPhoto = imgSrcAttr(
    extras.coverPhotoUrl || report.photos?.[0]?.dataUrl || report.photos?.[0]?.url || ""
  );
  const mapUrl = staticSiteMapUrl(extras.projectLat, extras.projectLng);
  const issueDate = dc.issueDate || report.surveyDate;
  const qlBadge = report.pas128Ql
    ? `<span class="sr-ql-badge">PAS 128 ${esc(pas128Short(report.pas128Ql))}</span>`
    : "";
  const quality = surveyReportQuality(report);
  const qualityColour = quality.score >= 80 ? primary : quality.score >= 50 ? "#f59e0b" : "#ea580c";
  const pas128Summary = pas128SummaryBlock(report);

  return `<div class="sr-cover">
    <div class="sr-cover-top">
      ${org.logo ? `<img src="${imgSrcAttr(org.logo)}" alt="" class="sr-cover-logo"/>` : ""}
      <div class="sr-cover-org">
        <div class="sr-cover-org-name">${esc(org.name)}</div>
        ${org.pdfHeader ? `<div class="sr-cover-org-sub">${esc(org.pdfHeader)}</div>` : org.address ? `<div class="sr-cover-org-sub">${esc(org.address)}</div>` : ""}
      </div>
    </div>
    <div class="sr-cover-main">
      <span class="sr-badge sr-badge--cover">${report.status === "final" ? "Final report" : "Draft"}</span>
      ${qlBadge}
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

function qaChecklistBlock(qa) {
  if (!qa) return "";
  const rows = QA_CHECKLIST_ITEMS.map(({ key, label }) => [label, qa[key] ? "Yes" : "No"]);
  return dataTable(["Check", "Result"], rows);
}

function signaturesBlock(report) {
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
  grouped.set("Other", []);

  photos.forEach((p, idx) => {
    const type = p.geoPhotoType || p.type;
    const group = type ? geoPhotoPreset(type).group : "Other";
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
  const mapBlock = mapUrl
    ? `<figure class="sr-cover-map sr-photo-map"><img src="${mapUrl}" alt="Geo-photo locations"/><figcaption>Geo-photo locations (${geoPhotos.length} points)</figcaption></figure>`
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
  const primary = org.primaryColor || "#0d9488";
  const accent = org.accentColor || "#0f766e";
  const now = new Date();
  const r = normalizeSurveyReport(report);

  const limitations =
    r.limitationsText?.trim() || buildLimitationsFromKeys(r.limitationKeys);
  const recordsText = buildUtilityRecordsNarrative(r.utilityRecords);
  const accessText = buildAccessLimitationsText(r.accessLimitations, r.accessLimitationsNotes);
  const programmeText = buildSurveyProgrammeNarrative(r.surveyProgramme);
  const controlText = buildControlAccuracyNarrative(r.controlAccuracy);
  const qaText = buildQaChecklistNarrative(r.qaChecklist);

  const hseParts = [];
  if (extras.ramsTitle) hseParts.push(`Linked RAMS: ${extras.ramsTitle}.`);
  if (r.hseRefs?.permitRef?.trim()) hseParts.push(`Permit reference: ${r.hseRefs.permitRef.trim()}.`);
  if (r.hseRefs?.catScanRef?.trim()) hseParts.push(`CAT scan reference: ${r.hseRefs.catScanRef.trim()}.`);
  if (r.hseRefs?.ramsExcerpt?.trim()) hseParts.push(r.hseRefs.ramsExcerpt.trim());

  const sections = [];
  const toc = [];
  let sectionCounter = 0;

  const nextNum = () => {
    sectionCounter += 1;
    return String(sectionCounter);
  };

  const pushSection = (title, id, body, includeInToc = true) => {
    if (!body?.trim()) return;
    const num = nextNum();
    sections.push(section(title, body, id, num));
    if (includeInToc) toc.push({ num, title, id });
  };

  pushSection("Document control", "doc-control", documentControlBlock(r));

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
    ["Surveyor / author", r.surveyor || "—"],
    ["Linked RAMS", extras.ramsTitle || "—"],
  ]);
  pushSection("Report information", "info", infoBody);

  if (r.sections?.executiveSummary?.trim()) {
    pushSection("Executive summary", "exec", nl2p(r.sections.executiveSummary));
  }

  if (programmeText) {
    pushSection("Survey programme", "programme", nl2p(programmeText));
  }

  pushSection("Scope of works", "scope", nl2p(r.sections?.scope));
  pushSection("Methodology", "method", nl2p(r.sections?.methodology));

  if (r.sections?.equipmentUsed?.trim()) {
    pushSection("Equipment used", "equipment", nl2p(r.sections.equipmentUsed));
  }

  const equipCal = buildEquipmentCalibrationNarrative(r.equipmentCalibration);
  if (equipCal || (r.equipmentCalibration || []).length) {
    pushSection(
      "Equipment calibration",
      "equipment-cal",
      `${equipmentCalibrationBlock(r.equipmentCalibration)}${equipCal ? `<div class="sr-narrative">${nl2p(equipCal)}</div>` : ""}`
    );
  }

  if (r.sections?.surveyExtent?.trim()) {
    pushSection("Survey extent", "extent", nl2p(r.sections.surveyExtent));
  }

  if (controlText) {
    pushSection("Control & accuracy", "control", nl2p(controlText));
  }

  const weatherBody = weatherBlock(r);
  if (weatherBody.trim()) {
    pushSection("Weather at site", "weather", weatherBody);
  }

  if (recordsText) {
    pushSection("Utility records & drawings review", "records", nl2p(recordsText));
  }

  const recordsRefs = recordsReferencesBlock(r.recordsReferences);
  if (recordsRefs) {
    const num = nextNum();
    sections.push(section("Records references", recordsRefs, "records-refs", num));
    toc.push({ num, title: "Records references", id: "records-refs" });
  }

  const photoBundle = photoGrid(r.photos);
  const photoIndexByGeoId = photoBundle.indexByGeoId || {};

  let findingsBody = "";
  if (r.utilitiesTable?.length) {
    findingsBody += utilitiesTableBlock(r.utilitiesTable, photoIndexByGeoId);
    findingsBody += `<div class="sr-narrative">${nl2p(r.sections?.findings)}</div>`;
  } else {
    findingsBody = nl2p(r.sections?.findings);
  }
  if (r.sections?.findings?.trim() || r.utilitiesTable?.length) {
    const callout = keyFindingsCallout(r.sections?.findings);
    pushSection("Findings & results", "findings", `${callout}${findingsBody}`);
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

  if (accessText) {
    pushSection("Site access limitations", "access", nl2p(accessText));
  }

  const deliverables = deliverablesBlock(r.deliverables);
  if (deliverables) {
    pushSection("Deliverables schedule", "deliverables", deliverables);
  }

  if (r.sections?.recommendations?.trim()) {
    pushSection("Recommendations", "recommendations", nl2p(r.sections.recommendations));
  }

  if (qaText) {
    pushSection("QA & verification", "qa", qaChecklistBlock(r.qaChecklist));
  }

  if (hseParts.length) {
    pushSection("Health & safety cross-reference", "hse", nl2p(hseParts.join("\n\n")));
  }

  if (photoBundle.html) {
    pushSection("Photo appendix", "photos", photoBundle.html);
  }

  const sigBlock = signaturesBlock(r);
  pushSection("Sign-off", "signatures", sigBlock);

  const cover = coverPage(r, org, primary, accent, extras);
  const tocHtml = toc.length ? tableOfContents(toc) : "";

  const dc = r.documentControl || {};
  const footerRef = [r.ref, dc.revision ? `Rev ${dc.revision}` : ""].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>${esc(r.title || r.ref || "Survey Report")}</title>
<style>
  @page {
    size: A4;
    margin: 16mm 14mm 22mm;
    @bottom-right {
      content: "Page " counter(page);
      font-size: 8pt;
      color: #9ca3af;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111827;
    margin: 0;
    padding: 0;
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
    align-items: center;
    gap: 16px;
    border-bottom: 3px solid ${primary};
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .sr-cover-logo { max-height: 56px; max-width: 150px; object-fit: contain; }
  .sr-cover-org-name { font-weight: 700; font-size: 14pt; }
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
  .sr-body { padding: 0 2mm 16mm; }
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
    .sr-body { padding-top: 14mm; }
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
  }
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
  .sr-section { margin-bottom: 16px; page-break-inside: avoid; }
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
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 10px;
  }
  .sr-data-table th, .sr-data-table td {
    border: 1px solid #d1d5db;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
  }
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
  .sr-callout--records { background: #eff6ff; border-color: #93c5fd; border-left-color: #3b82f6; }
  .sr-callout--records .sr-callout-title { color: #1e40af; }
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
  .sr-cad-stat--accent { background: #eff6ff; border-color: #93c5fd; }
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
    background: #fff;
  }
  @media print {
    .sr-cover, .sr-badge, .sr-ql-badge, .sr-ql-pill, .sr-cad-comp-seg, .sr-cad-bar-fill, .sr-cad-stat--accent, .sr-cad-cover-strip, .sr-section h2, .sr-callout, .sr-data-table th {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  ${cover}
  ${tocHtml}
  <div class="sr-running-header"><span>${esc(r.ref || "")}${dc.revision ? ` · Rev ${esc(dc.revision)}` : ""}</span><span>${esc(r.title || "Survey Report")}</span></div>
  <div class="sr-body">
    <div class="sr-header-mini">
      <span><strong>${esc(r.title || "Survey Report")}</strong></span>
      <span>${esc(footerRef)} · Generated ${now.toLocaleDateString("en-GB")}</span>
    </div>
    ${sections.join("")}
    <div class="sr-disclaimer">
      This report is issued for the agreed survey scope only. Detected utilities and subsurface features are indicative unless verified by trial excavation or statutory undertaker confirmation. The client remains responsible for safe digging practices and permit-to-dig procedures on site.
      ${r.status !== "final" ? " <strong>Draft — not for construction use until marked final.</strong>" : ""}
    </div>
  </div>
  <div class="sr-print-footer">
    <span>${esc(org.pdfFooter || "Generated by MySafeOps")}</span>
    <span>${esc(footerRef)}</span>
  </div>
</body>
</html>`;
}

export function openSurveyReportPrint(report, extras) {
  const html = sanitizePrintPreviewHtml(buildSurveyReportHtml(report, extras));
  const win = openPrintWindow();
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  return true;
}

export function downloadSurveyReportHtml(report, extras) {
  const html = sanitizePrintPreviewHtml(buildSurveyReportHtml(report, extras));
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(report.ref || report.id || "survey_report").replace(/\s+/g, "_")}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}
