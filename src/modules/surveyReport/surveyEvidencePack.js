/**
 * Survey report premium pack — evidence rows, records matrix, thickboxes, custom sections.
 * Checkbox-simple in the editor → prose / visual layouts in print.
 */
import { escapeHtml, escapeAttr, safeImageSrc } from "../../utils/htmlEscape.js";
import { geoPhotoPreset, presetsByGroup } from "../../utils/geoPhotoPresets";
import {
  RECORD_STATUS_OPTIONS,
  RECORD_SERVICE_TYPES,
  GEO_PHOTO_GROUP_MEANINGS,
  ACCESS_LIMITATION_TYPES,
  LIMITATION_RULES,
} from "./surveyReportConstants";
import { buildWeatherNarrative } from "./surveyReportHelpers";
import { getQaChecklistItemsForSurveyType } from "./surveyQaPack";
import { getActiveDocumentLocale } from "../../utils/countryWorkspaces";

const esc = escapeHtml;

function uid(prefix = "row") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function blankEvidenceRow(overrides = {}) {
  return {
    id: uid("ev"),
    title: "",
    body: "",
    undertaker: "",
    aocId: "",
    cadImageUrl: "",
    photoUrls: [],
    tfr: false,
    status: "",
    ...overrides,
  };
}

export function blankExtentArea(overrides = {}) {
  return {
    id: uid("aoc"),
    label: "",
    chainage: "",
    lat: "",
    lng: "",
    photoUrls: [],
    planImageUrl: "",
    notes: "",
    ...overrides,
  };
}

export function blankRecordItem(overrides = {}) {
  return {
    id: uid("rec"),
    undertaker: "",
    serviceType: "other",
    status: "not_located",
    notes: "",
    tfr: false,
    ...overrides,
  };
}

export function blankCustomSection(overrides = {}) {
  return {
    id: uid("sec"),
    title: "",
    body: "",
    afterSectionId: "findings",
    ...overrides,
  };
}

export function blankEquipmentKitItem(overrides = {}) {
  return {
    id: uid("kit"),
    technique: "",
    tradeName: "",
    manufacturer: "",
    appendixRef: "",
    photoUrl: "",
    calibrationDue: "",
    ...overrides,
  };
}

/** Default kit lines for common PAS128 methods (UM-style equipment table). */
export function defaultEquipmentKitForMethod(methodKey) {
  const base = [
    {
      technique: "Electromagnetic Location (Radio Detection)",
      tradeName: "Radiodetection RD8200 / Tx10",
      manufacturer: "Radiodetection",
      appendixRef: "Appendix 1",
    },
    {
      technique: "Ground Penetrating Radar",
      tradeName: methodKey?.includes("M3") || methodKey?.includes("M4") ? "IDS Stream C / Leica DS4000" : "Leica DS2000",
      manufacturer: methodKey?.includes("M3") || methodKey?.includes("M4") ? "IDS / Leica" : "Leica",
      appendixRef: "Appendix 2",
    },
    {
      technique: "Geographical positioning & digitisation",
      tradeName: "Trimble R12i / Leica GS14",
      manufacturer: "Trimble / Leica",
      appendixRef: "Appendix 3",
    },
    {
      technique: "Digitisation of detected utilities",
      tradeName: "Leica TS16 Total Station",
      manufacturer: "Leica",
      appendixRef: "Appendix 4",
    },
  ];
  if (methodKey === "M1") {
    return [
      blankEquipmentKitItem({
        technique: "Desktop records search",
        tradeName: "LSBUD / undertaker portals",
        manufacturer: "—",
        appendixRef: "—",
      }),
    ];
  }
  return base.map((row) => blankEquipmentKitItem(row));
}

export function recordStatusLabel(key) {
  return RECORD_STATUS_OPTIONS.find((o) => o.key === key)?.label || key || "";
}

export function recordServiceLabel(key) {
  return RECORD_SERVICE_TYPES.find((o) => o.key === key)?.label || key || "";
}

/** Checkbox-simple records → UK English paragraph (overrideable via extraText). */
export function buildRecordsMatrixNarrative(items = [], extraText = "") {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length && !String(extraText || "").trim()) return "";
  const byStatus = {};
  for (const r of rows) {
    const st = r.status || "not_located";
    if (!byStatus[st]) byStatus[st] = [];
    const svc = recordServiceLabel(r.serviceType);
    const who = String(r.undertaker || "").trim() || "Undertaker";
    byStatus[st].push(`${who} (${svc})${r.notes?.trim() ? `: ${r.notes.trim()}` : ""}`);
  }
  const parts = [];
  const order = ["located", "partial", "tfr", "not_located", "no_response", "cps"];
  for (const st of order) {
    if (!byStatus[st]?.length) continue;
    parts.push(`${recordStatusLabel(st)}: ${byStatus[st].join("; ")}.`);
  }
  const base = parts.join(" ");
  const extra = String(extraText || "").trim();
  if (base && extra) return `${base} ${extra}`;
  return base || extra;
}

export function buildRecordsScoreboardHtml(items = []) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return "";
  const counts = {};
  for (const r of rows) {
    const st = r.status || "not_located";
    counts[st] = (counts[st] || 0) + 1;
  }
  const pills = Object.entries(counts)
    .map(
      ([st, n]) =>
        `<span class="sr-record-pill sr-record-pill--${esc(st)}">${esc(recordStatusLabel(st))} ${n}</span>`
    )
    .join("");
  return `<div class="sr-records-scoreboard">${pills}</div>`;
}

function imgCell(url, caption) {
  const src = safeImageSrc(url);
  if (!src) return `<div class="sr-evidence-cell sr-evidence-cell--empty"><span>${esc(caption || "No image")}</span></div>`;
  return `<div class="sr-evidence-cell"><img src="${escapeAttr(src)}" alt=""/><div class="sr-evidence-cap">${esc(caption || "")}</div></div>`;
}

/** CAD | Photo | Notes evidence row (print thickbox). */
export function buildEvidenceRowHtml(row = {}) {
  const title = String(row.title || "").trim() || "Survey evidence";
  const body = String(row.body || "").trim();
  const photo = Array.isArray(row.photoUrls) ? row.photoUrls[0] : "";
  const statusChip = row.tfr
    ? `<span class="sr-evidence-chip sr-evidence-chip--tfr">TFR</span>`
    : row.status
      ? `<span class="sr-evidence-chip">${esc(recordStatusLabel(row.status))}</span>`
      : "";
  const undertaker = row.undertaker ? `<span class="sr-evidence-meta">${esc(row.undertaker)}</span>` : "";
  return `<article class="sr-evidence-row">
  <header class="sr-evidence-row__head"><strong>${esc(title)}</strong>${statusChip}${undertaker}</header>
  <div class="sr-evidence-row__grid">
    ${imgCell(row.cadImageUrl, "CAD / plan")}
    ${imgCell(photo, "Site photo")}
    <div class="sr-evidence-cell sr-evidence-cell--notes"><p>${esc(body) || "—"}</p></div>
  </div>
</article>`;
}

export function buildEvidenceRowsHtml(rows = []) {
  const list = (rows || []).filter((r) => r && (r.title || r.body || r.cadImageUrl || r.photoUrls?.length));
  if (!list.length) return "";
  return `<div class="sr-evidence-rows">${list.map(buildEvidenceRowHtml).join("")}</div>`;
}

export function buildExtentAreasHtml(areas = []) {
  const list = (areas || []).filter((a) => a && (a.label || a.planImageUrl || a.photoUrls?.length));
  if (!list.length) return "";
  return list
    .map((a) => {
      const imgs = [a.planImageUrl, ...(a.photoUrls || [])].filter(Boolean).slice(0, 4);
      const gallery = imgs
        .map((u) => {
          const src = safeImageSrc(u);
          return src ? `<img src="${escapeAttr(src)}" alt=""/>` : "";
        })
        .join("");
      const head = [a.label, a.chainage].filter(Boolean).join(" — ");
      const strip = buildExtentFilmstripHtml(a.photoUrls || []);
      return `<div class="sr-extent-plate">
  <div class="sr-extent-plate__label">${esc(head || "Survey extent")}</div>
  ${gallery ? `<div class="sr-extent-plate__gallery">${gallery}</div>` : ""}
  ${strip}
  ${a.notes?.trim() ? `<p class="sr-extent-plate__notes">${esc(a.notes.trim())}</p>` : ""}
</div>`;
    })
    .join("");
}

export function buildWeatherThickboxHtml(weather = {}) {
  const narrative = buildWeatherNarrative(weather);
  if (!narrative && weather.tempC == null && !weather.groundSurface) return "";
  const chips = [];
  if (weather.tempC != null) chips.push(`${weather.tempC}°C`);
  if (weather.rainDuringSurvey && weather.rainDuringSurvey !== "unknown") {
    chips.push(String(weather.rainDuringSurvey).replace(/_/g, " "));
  }
  if (weather.groundSurface && weather.groundSurface !== "unknown") {
    chips.push(String(weather.groundSurface).replace(/_/g, " "));
  }
  const chipHtml = chips.map((c) => `<span class="sr-wx-chip">${esc(c)}</span>`).join("");
  return `<div class="sr-thickbox sr-thickbox--weather">
  <div class="sr-thickbox__title">Weather during survey</div>
  <div class="sr-thickbox__chips">${chipHtml}</div>
  <p>${esc(narrative)}</p>
</div>`;
}

export function buildEquipmentThickboxHtml(kit = [], fallbackText = "") {
  const rows = Array.isArray(kit) ? kit.filter((k) => k?.tradeName || k?.technique) : [];
  if (!rows.length && !String(fallbackText || "").trim()) return "";
  if (!rows.length) {
    return `<div class="sr-thickbox sr-thickbox--equipment"><div class="sr-thickbox__title">Equipment used</div><p>${esc(fallbackText)}</p></div>`;
  }
  const cards = rows
    .map((k) => {
      const src = safeImageSrc(k.photoUrl);
      return `<div class="sr-kit-card">
      ${src ? `<img src="${escapeAttr(src)}" alt=""/>` : `<div class="sr-kit-card__ph">Kit</div>`}
      <div class="sr-kit-card__body">
        <div class="sr-kit-card__tech">${esc(k.technique || "Equipment")}</div>
        <div class="sr-kit-card__name">${esc(k.tradeName || "—")}</div>
        <div class="sr-kit-card__meta">${esc([k.manufacturer, k.appendixRef].filter(Boolean).join(" · "))}</div>
      </div>
    </div>`;
    })
    .join("");
  return `<div class="sr-thickbox sr-thickbox--equipment">
  <div class="sr-thickbox__title">Equipment used</div>
  <div class="sr-kit-grid">${cards}</div>
</div>`;
}

/**
 * Geo-photo group thickboxes for print.
 * @param {Array} photos — report.photos or linked geo photos with { type, dataUrl|url, caption }
 */
export function buildGeoPhotoGroupThickboxesHtml(photos = []) {
  const list = Array.isArray(photos) ? photos : [];
  if (!list.length) return "";
  const byGroup = new Map();
  for (const p of list) {
    const preset = geoPhotoPreset(p.type || p.category || "general_site_condition");
    const group = preset?.group || "General";
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(p);
  }
  const order = presetsByGroup().map((g) => g.group);
  const blocks = [];
  for (const group of order) {
    const items = byGroup.get(group);
    if (!items?.length) continue;
    const meaning = GEO_PHOTO_GROUP_MEANINGS[group] || "";
    const figs = items
      .slice(0, 6)
      .map((p) => {
        const src = safeImageSrc(p.dataUrl || p.url || p.photoUrl);
        if (!src) return "";
        const cap = p.caption || p.label || geoPhotoPreset(p.type)?.label || "";
        return `<figure><img src="${escapeAttr(src)}" alt=""/><figcaption>${esc(cap)}</figcaption></figure>`;
      })
      .filter(Boolean)
      .join("");
    if (!figs) continue;
    blocks.push(`<div class="sr-thickbox sr-thickbox--geophoto">
  <div class="sr-thickbox__title">${esc(group)}</div>
  ${meaning ? `<p class="sr-thickbox__meaning">${esc(meaning)}</p>` : ""}
  <div class="sr-geophoto-grid">${figs}</div>
</div>`);
  }
  return blocks.join("");
}

export function buildCustomSectionsHtml(sections = []) {
  return (sections || [])
    .filter((s) => s?.title?.trim() || s?.body?.trim())
    .map(
      (s) =>
        `<section class="sr-custom-section"><h3>${esc(s.title || "Additional notes")}</h3><div class="sr-narrative">${esc(s.body || "")
          .split(/\n+/)
          .map((p) => `<p>${p}</p>`)
          .join("")}</div></section>`
    )
    .join("");
}

/** Mini photo filmstrip under an extent plate. */
export function buildExtentFilmstripHtml(photoUrls = []) {
  const urls = (photoUrls || []).filter(Boolean).slice(0, 8);
  if (!urls.length) return "";
  const imgs = urls
    .map((u) => {
      const src = safeImageSrc(u);
      return src ? `<img src="${escapeAttr(src)}" alt=""/>` : "";
    })
    .filter(Boolean)
    .join("");
  if (!imgs) return "";
  return `<div class="sr-extent-filmstrip">${imgs}</div>`;
}

/** Constraint chips from access ticks + limitation keys + geo-photo types. */
export function buildConstraintChipsHtml(report = {}) {
  const chips = [];
  const seen = new Set();
  const push = (label, tone = "warn") => {
    const key = String(label || "").toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    chips.push({ label, tone });
  };

  for (const k of report.accessLimitations || []) {
    const lab = ACCESS_LIMITATION_TYPES.find((o) => o.key === k)?.label;
    if (lab) push(lab, "access");
  }
  for (const k of report.limitationKeys || []) {
    if (["vegetation_obstruction", "parked_vehicles", "traffic_interface", "site_access_restricted", "hard_surface"].includes(k)) {
      const lab = LIMITATION_RULES.find((o) => o.key === k)?.label;
      if (lab) push(lab, "limit");
    }
  }
  for (const p of report.photos || []) {
    const id = p.type || "";
    if (["no_access", "locked_gate", "hazard", "buried_services_warning", "traffic_management", "obstruction"].includes(id)) {
      push(geoPhotoPreset(id).label, "photo");
    }
  }
  for (const r of report.recordItems || []) {
    if (r.status === "tfr" || r.tfr) push("TFR on drawing", "tfr");
    if (r.status === "not_located") push("Services not located", "miss");
  }

  if (!chips.length) return "";
  return `<div class="sr-constraint-chips">${chips
    .map((c) => `<span class="sr-chip sr-chip--${esc(c.tone)}">${esc(c.label)}</span>`)
    .join("")}</div>`;
}

/** Always-on legend for detected vs TFR vs unknown. */
export function buildTfrLegendStripHtml() {
  return `<div class="sr-tfr-legend" aria-label="Drawing legend">
  <span class="sr-tfr-legend__item"><i class="sr-tfr-swatch sr-tfr-swatch--detected"></i> Detected (EML / GPR)</span>
  <span class="sr-tfr-legend__item"><i class="sr-tfr-swatch sr-tfr-swatch--tfr"></i> TFR — taken from records</span>
  <span class="sr-tfr-legend__item"><i class="sr-tfr-swatch sr-tfr-swatch--unknown"></i> Unknown / not verified</span>
</div>`;
}

/** Group record items into undertaker §5.1 style blocks (Gas — SGN, …). */
export function buildUndertakerFindingsBlocksHtml(items = [], evidenceRows = []) {
  const rows = Array.isArray(items) ? items.filter((r) => r && (r.undertaker || r.serviceType || r.notes)) : [];
  if (!rows.length) return "";
  const byService = new Map();
  for (const r of rows) {
    const svc = r.serviceType || "other";
    if (!byService.has(svc)) byService.set(svc, []);
    byService.get(svc).push(r);
  }
  const blocks = [];
  for (const [svc, list] of byService) {
    const title = recordServiceLabel(svc);
    const body = list
      .map((r) => {
        const who = String(r.undertaker || "").trim() || "Records";
        const st = recordStatusLabel(r.status);
        const note = String(r.notes || "").trim();
        return `<li><strong>${esc(who)}</strong> — ${esc(st)}${note ? `. ${esc(note)}` : "."}</li>`;
      })
      .join("");
    const linked = (evidenceRows || []).filter(
      (e) => e && list.some((r) => r.undertaker && e.undertaker && e.undertaker === r.undertaker)
    );
    const ev = linked.length ? buildEvidenceRowsHtml(linked) : "";
    blocks.push(`<div class="sr-undertaker-block">
  <h4 class="sr-undertaker-block__title">${esc(title)}</h4>
  <ul class="sr-undertaker-block__list">${body}</ul>
  ${ev}
</div>`);
  }
  return `<div class="sr-undertaker-findings"><div class="sr-undertaker-findings__head">Surveyor findings by service</div>${blocks.join("")}</div>`;
}

/**
 * Dig-risk / QL cover strip.
 * @param {object} report
 * @param {{ score?: number, band?: string, label?: string } | null} [digRisk]
 */
export function buildCoverInsightStripHtml(report = {}, digRisk = null) {
  const parts = [];
  {
    const methodBits = [report.pas128Method, report.pas128MethodSecondary].filter(Boolean);
    const methodStr = methodBits.length > 1 && methodBits[0] !== methodBits[1]
      ? methodBits.join(" + ")
      : methodBits[0] || "";
    if (methodStr) {
      parts.push(`<span class="sr-insight-pill sr-insight-pill--method">PAS128 ${esc(methodStr)}</span>`);
    }
  }
  if (report.pas128Ql) {
    parts.push(`<span class="sr-insight-pill sr-insight-pill--ql">QL ${esc(String(report.pas128Ql).replace(/^QL-?/i, ""))}</span>`);
  }
  const tfrCount = (report.recordItems || []).filter((r) => r.status === "tfr" || r.tfr).length;
  const located = (report.recordItems || []).filter((r) => r.status === "located").length;
  if (tfrCount || located) {
    parts.push(`<span class="sr-insight-pill">Records: ${located} located · ${tfrCount} TFR</span>`);
  }
  if (digRisk && digRisk.label) {
    const band = digRisk.band || "medium";
    parts.push(
      `<span class="sr-insight-pill sr-insight-pill--dig sr-insight-pill--dig-${esc(band)}">${esc(digRisk.label)} (${digRisk.score})</span>`
    );
  }
  if (!parts.length) return "";
  return `<div class="sr-cover-insight">${parts.join("")}${buildMethodLadderHtml(report.pas128Method || "")}</div>`;
}

/** QA ticks → readable prose paragraphs (not Yes/No lines). */
export function buildQaChecklistProse(qa, surveyType = "", extraText = "") {
  if (!qa) return String(extraText || "").trim();
  const items = getQaChecklistItemsForSurveyType(surveyType);
  const done = items.filter(({ key }) => Boolean(qa[key])).map(({ label }) => label);
  const missing = items.filter(({ key }) => !qa[key]).map(({ label }) => label);
  const parts = [];
  if (done.length) {
    parts.push(`QA checks completed: ${done.join("; ")}.`);
  }
  if (missing.length && missing.length <= 8) {
    parts.push(`Outstanding or not applicable at issue: ${missing.join("; ")}.`);
  } else if (missing.length > 8) {
    parts.push(`${missing.length} QA checklist items remain unchecked or not applicable.`);
  }
  const extra = String(extraText || "").trim();
  if (extra) parts.push(extra);
  return parts.join(" ");
}

/** Method ladder HTML for cover / exec strip. */
export function buildMethodLadderHtml(activeKey = "") {
  const keys = ["M1", "M2", "M2P", "M3", "M3P", "M4", "M4P"];
  const cells = keys
    .map((k) => {
      const on = k === activeKey;
      return `<span class="sr-method-step${on ? " sr-method-step--on" : ""}">${esc(k)}</span>`;
    })
    .join('<span class="sr-method-step__sep">→</span>');
  return `<div class="sr-method-ladder" aria-label="PAS128 method">${cells}</div>`;
}

export const GPR_ANOMALY_CLASSES = [
  { key: "linear", label: "Linear / utility-like" },
  { key: "disturbance", label: "Ground disturbance" },
  { key: "unknown", label: "Unknown anomaly" },
  { key: "void", label: "Possible void / contrast" },
];

export function blankGprAnomalyCard(overrides = {}) {
  return {
    id: uid("gpr"),
    ref: "",
    classKey: "unknown",
    depthMinM: "",
    depthMaxM: "",
    interpretation: "",
    screenshotUrl: "",
    ...overrides,
  };
}

export function blankSurveyArea(overrides = {}) {
  return {
    id: uid("area"),
    label: "",
    chainage: "",
    planImageUrl: "",
    photoUrls: [],
    notes: "",
    findingsNote: "",
    ...overrides,
  };
}

/** Copy extent AOC rows into multi-area flipbook when empty. */
export function seedSurveyAreasFromExtent(report = {}) {
  if ((report.surveyAreas || []).length) return report;
  const extent = report.extentAreas || [];
  if (!extent.length) return report;
  return {
    ...report,
    surveyAreas: extent.map((e) =>
      blankSurveyArea({
        label: e.label || "Area",
        chainage: e.chainage || "",
        planImageUrl: e.planImageUrl || "",
        photoUrls: [...(e.photoUrls || [])],
        notes: e.notes || "",
      })
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function gprAnomalyClassLabel(key) {
  return GPR_ANOMALY_CLASSES.find((o) => o.key === key)?.label || key || "Anomaly";
}

/** Mid depth (m BGL) from min/max fields. */
export function gprAnomalyMidDepthM(card) {
  const a = parseFloat(card?.depthMinM);
  const b = parseFloat(card?.depthMaxM);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return (a + b) / 2;
  if (!Number.isNaN(a)) return a;
  if (!Number.isNaN(b)) return b;
  return null;
}

/**
 * Gallions-style depth histogram (0–0.5 / 0.5–1 / 1–1.5 / 1.5+ m BGL).
 * @param {object[]} cards
 */
export function buildGprDepthHistogramHtml(cards = []) {
  const depths = (cards || []).map(gprAnomalyMidDepthM).filter((n) => n != null && n >= 0);
  if (depths.length < 2) return "";
  const bins = [
    { key: "0-0.5", label: "0–0.5 m", max: 0.5 },
    { key: "0.5-1", label: "0.5–1 m", max: 1 },
    { key: "1-1.5", label: "1–1.5 m", max: 1.5 },
    { key: "1.5+", label: "1.5 m+", max: Infinity },
  ];
  const counts = bins.map(() => 0);
  for (const d of depths) {
    const i = bins.findIndex((b) => d < b.max || b.max === Infinity);
    const idx = i >= 0 ? i : bins.length - 1;
    counts[idx] += 1;
  }
  const maxC = Math.max(...counts, 1);
  const bars = bins
    .map((b, i) => {
      const h = Math.max(4, Math.round((counts[i] / maxC) * 72));
      return `<div class="sr-gpr-hist__col">
  <div class="sr-gpr-hist__bar" style="height:${h}px" title="${esc(String(counts[i]))}"></div>
  <div class="sr-gpr-hist__n">${counts[i]}</div>
  <div class="sr-gpr-hist__lbl">${esc(b.label)}</div>
</div>`;
    })
    .join("");
  return `<div class="sr-gpr-hist" aria-label="Anomaly depth distribution">
  <div class="sr-gpr-hist__title">Anomaly depth distribution (m BGL)</div>
  <div class="sr-gpr-hist__chart">${bars}</div>
</div>`;
}

/**
 * Cover collage — plan / site photo / CAD evidence (when ≥2 images available).
 * @param {object} report
 * @param {{ coverPhotoUrl?: string }} [extras]
 */
export function buildCoverHeroCollageHtml(report = {}, extras = {}) {
  const slots = [];
  const push = (url, caption) => {
    const src = safeImageSrc(url);
    if (!src || slots.some((s) => s.src === src)) return;
    slots.push({ src, caption });
  };
  const extent = (report.extentAreas || [])[0] || (report.surveyAreas || [])[0];
  push(extent?.planImageUrl, "Extent / plan");
  push(extras.coverPhotoUrl || report.photos?.[0]?.dataUrl || report.photos?.[0]?.url, "Site");
  const ev = (report.evidenceRows || []).find((e) => e.cadImageUrl || (e.photoUrls || [])[0]);
  push(ev?.cadImageUrl || ev?.photoUrls?.[0], "Evidence");
  push((extent?.photoUrls || [])[0], "AOC photo");
  push(report.photos?.[1]?.dataUrl || report.photos?.[1]?.url, "Site");
  const three = slots.slice(0, 3);
  if (three.length < 2) return "";
  return `<div class="sr-cover-collage" aria-label="Cover visual strip">
  ${three
    .map(
      (s) =>
        `<figure class="sr-cover-collage__cell"><img src="${escapeAttr(s.src)}" alt=""/><figcaption>${esc(s.caption)}</figcaption></figure>`
    )
    .join("")}
</div>`;
}

/**
 * Footer / signatures strip — revision verify QR (not dig-focused).
 * @param {object} report
 * @param {string} qrSrc
 * @param {string} verifyUrl
 */
export function buildRevisionVerifyBlockHtml(report = {}, qrSrc = "", verifyUrl = "") {
  const dc = report.documentControl || {};
  const rev = String(dc.revision || "A").trim();
  const ref = String(report.ref || "").trim();
  const status = report.status === "final" ? "Controlled / issued" : "Draft — not controlled";
  if (!qrSrc && !ref) return "";
  return `<div class="sr-rev-verify">
  ${qrSrc ? `<img class="sr-rev-verify__qr" src="${escapeAttr(qrSrc)}" alt="Revision QR"/>` : ""}
  <div class="sr-rev-verify__meta">
    <div class="sr-rev-verify__title">Verify this revision</div>
    <div>${esc(ref || "—")}${rev ? ` · Rev ${esc(rev)}` : ""} · ${esc(status)}</div>
    ${verifyUrl ? `<div class="sr-rev-verify__url">${esc(verifyUrl)}</div>` : ""}
  </div>
</div>`;
}

/** Survey records scoreboard for A3 board (replaces dig-first framing). */
export function buildRecordsStatusBoardHtml(report = {}) {
  const items = report.recordItems || [];
  const located = items.filter((r) => r.status === "located").length;
  const tfr = items.filter((r) => r.status === "tfr" || r.tfr).length;
  const notFound = items.filter((r) => r.status === "not_located").length;
  const partial = items.filter((r) => r.status === "partial" || r.status === "no_response").length;
  return `<div class="a3-records">
  <div class="a3-records__pill"><strong>${located}</strong><span>Located</span></div>
  <div class="a3-records__pill a3-records__pill--tfr"><strong>${tfr}</strong><span>TFR</span></div>
  <div class="a3-records__pill"><strong>${notFound}</strong><span>Not located</span></div>
  <div class="a3-records__pill"><strong>${partial}</strong><span>Partial / NR</span></div>
</div>`;
}

/** Gallions-style anomaly cards + conclusions dashboard. */
export function buildGprAnomalyCardsHtml(cards = [], conclusionsText = "") {
  const list = (cards || []).filter((c) => c && (c.ref || c.interpretation || c.screenshotUrl));
  if (!list.length && !String(conclusionsText || "").trim()) return "";

  const byClass = {};
  for (const c of list) {
    const k = c.classKey || "unknown";
    byClass[k] = (byClass[k] || 0) + 1;
  }
  const depths = list.map(gprAnomalyMidDepthM).filter((n) => n != null);
  const depthNote =
    depths.length > 0
      ? `Typical depths ~${Math.min(...depths).toFixed(1)}–${Math.max(...depths).toFixed(1)} m BGL.`
      : "";
  const hist = buildGprDepthHistogramHtml(list);

  const dash = `<div class="sr-gpr-dash">
  <div class="sr-gpr-dash__stat"><strong>${list.length}</strong><span>Anomalies</span></div>
  <div class="sr-gpr-dash__stat"><strong>${byClass.linear || 0}</strong><span>Linear</span></div>
  <div class="sr-gpr-dash__stat"><strong>${byClass.disturbance || 0}</strong><span>Disturbance</span></div>
  <div class="sr-gpr-dash__stat"><strong>${byClass.unknown || 0}</strong><span>Unknown</span></div>
</div>
${depthNote ? `<p class="sr-gpr-dash__note">${esc(depthNote)}</p>` : ""}
${hist}
${conclusionsText?.trim() ? `<div class="sr-narrative"><p>${esc(conclusionsText.trim())}</p></div>` : ""}`;

  const cardsHtml = list
    .map((c) => {
      const src = safeImageSrc(c.screenshotUrl);
      const depth =
        c.depthMinM || c.depthMaxM
          ? `${c.depthMinM || "?"}${c.depthMaxM ? `–${c.depthMaxM}` : ""} m`
          : "—";
      return `<article class="sr-gpr-card">
  <div class="sr-gpr-card__media">${src ? `<img src="${escapeAttr(src)}" alt=""/>` : `<div class="sr-gpr-card__ph">Radargram</div>`}</div>
  <div class="sr-gpr-card__body">
    <div class="sr-gpr-card__ref">${esc(c.ref || "Anomaly")}</div>
    <div class="sr-gpr-card__meta">${esc(gprAnomalyClassLabel(c.classKey))} · ${esc(depth)}</div>
    <p>${esc(c.interpretation || "—")}</p>
  </div>
</article>`;
    })
    .join("");

  return `<div class="sr-gpr-section">
  <div class="sr-thickbox__title">GPR anomalies & conclusions</div>
  ${dash}
  <div class="sr-gpr-cards">${cardsHtml}</div>
</div>`;
}

/** Multi-area flipbook — District Heating style extent → findings per area. */
export function buildSurveyAreasFlipbookHtml(areas = []) {
  const list = (areas || []).filter((a) => a && (a.label || a.planImageUrl || a.findingsNote));
  if (!list.length) return "";
  const index = `<div class="sr-area-index">${list
    .map((a, i) => `<span class="sr-area-index__pill">${esc(a.label || `Area ${i + 1}`)}${a.chainage ? ` · ${esc(a.chainage)}` : ""}</span>`)
    .join("")}</div>`;

  const pages = list
    .map((a, i) => {
      const src = safeImageSrc(a.planImageUrl);
      const photos = buildExtentFilmstripHtml(a.photoUrls || []);
      return `<div class="sr-area-page">
  <div class="sr-area-page__kicker">Area ${i + 1} of ${list.length}</div>
  <h3 class="sr-area-page__title">${esc(a.label || `Survey area ${i + 1}`)}${a.chainage ? ` — ${esc(a.chainage)}` : ""}</h3>
  ${src ? `<img class="sr-area-page__plan" src="${escapeAttr(src)}" alt=""/>` : ""}
  ${photos}
  ${a.notes?.trim() ? `<p class="sr-extent-plate__notes">${esc(a.notes.trim())}</p>` : ""}
  ${a.findingsNote?.trim() ? `<div class="sr-area-page__findings"><strong>Findings</strong><p>${esc(a.findingsNote.trim())}</p></div>` : ""}
</div>`;
    })
    .join("");

  return `<div class="sr-area-flipbook"><div class="sr-thickbox__title">Survey areas</div>${index}${pages}</div>`;
}

/**
 * A3 landscape board pack — client meeting sheet (records / extent, not dig-first).
 * @param {object} report
 * @param {{ digRisk?: object, orgName?: string }} [opts]
 */
export function buildA3BoardPackHtml(report = {}, opts = {}) {
  const r = report;
  const tfr = (r.recordItems || []).filter((x) => x.status === "tfr" || x.tfr).slice(0, 5);
  const tfrList = tfr.length
    ? `<ul>${tfr.map((x) => `<li><strong>${esc(x.undertaker || recordServiceLabel(x.serviceType))}</strong> — ${esc(x.notes || recordStatusLabel(x.status))}</li>`).join("")}</ul>`
    : `<p>No TFR rows logged.</p>`;
  const extent = (r.extentAreas || [])[0] || (r.surveyAreas || [])[0];
  const planSrc = safeImageSrc(extent?.planImageUrl || r.photos?.[0]?.dataUrl || r.photos?.[0]?.url);
  const recordsBoard = buildRecordsStatusBoardHtml(r);

  return `<!DOCTYPE html>
<html lang="${getActiveDocumentLocale()}"><head><meta charset="utf-8"/>
<title>${esc(r.ref || "Board pack")} — A3</title>
<style>
  @page { size: A3 landscape; margin: 12mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; color: #0f172a; background: #fff; }
  .a3 { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; min-height: 250mm; }
  .a3-left, .a3-right { display: flex; flex-direction: column; gap: 12px; }
  .a3-hero { background: #0B1D3A; color: #fff; border-radius: 12px; padding: 16px 18px; }
  .a3-hero h1 { margin: 0 0 6px; font-size: 18pt; }
  .a3-hero .meta { opacity: 0.85; font-size: 10pt; }
  .a3-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; background: #f8fafc; }
  .a3-card h2 { margin: 0 0 8px; font-size: 12pt; color: #0B1D3A; }
  .a3-plan { width: 100%; max-height: 160mm; object-fit: contain; border-radius: 8px; background: #e2e8f0; }
  .a3-records { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .a3-records__pill { background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; text-align: center; }
  .a3-records__pill strong { display: block; font-size: 16pt; color: #0B1D3A; }
  .a3-records__pill span { font-size: 8pt; color: #64748b; }
  .a3-records__pill--tfr { border-color: #f59e0b; background: #fffbeb; }
  ul { margin: 0; padding-left: 18px; font-size: 10pt; }
  .foot { font-size: 8pt; color: #64748b; margin-top: auto; }
</style></head><body>
<div class="a3">
  <div class="a3-left">
    <div class="a3-hero">
      <h1>${esc(r.title || "PAS128 Utility Survey")}</h1>
      <div class="meta">${esc(r.ref || "—")} · ${esc(r.client || "—")} · ${esc(r.siteAddress || r.projectName || "—")}</div>
      <div class="meta" style="margin-top:6px">${esc(r.pas128Method ? `PAS128 ${r.pas128Method}` : "")}${r.pas128Ql ? ` · QL ${esc(r.pas128Ql)}` : ""}</div>
    </div>
    <div class="a3-card">
      <h2>Extent / plan</h2>
      ${planSrc ? `<img class="a3-plan" src="${escapeAttr(planSrc)}" alt="Extent"/>` : `<p>Attach an extent AOC or site plan image for the board pack.</p>`}
    </div>
  </div>
  <div class="a3-right">
    <div class="a3-card">
      <h2>Records status</h2>
      ${recordsBoard}
      <p style="font-size:9.5pt;margin:10px 0 0">Survey deliverable — TFR alignments are records-derived until verified on site.</p>
    </div>
    <div class="a3-card">
      <h2>Top TFR / records notes</h2>
      ${tfrList}
    </div>
    <div class="a3-card">
      <h2>Key message</h2>
      <p style="font-size:10pt">${esc(String(r.sections?.executiveSummary || r.sections?.recommendations || r.sections?.findings || "See full survey report for methodology, limitations and drawings.").slice(0, 480))}</p>
    </div>
    <div class="foot">${esc(opts.orgName || "Utility Mapping")} · Controlled board pack · ${esc(r.ref || "")}${r.documentControl?.revision ? ` · Rev ${esc(r.documentControl.revision)}` : ""}</div>
  </div>
</div>
</body></html>`;
}

/** Seed kit + empty extent/evidence stubs from method (smart-fill helper). */
export function seedPremiumFieldsFromMethod(report, methodKey) {
  const next = { ...report };
  if (!methodKey) return next;
  if (!next.equipmentKit?.length) {
    next.equipmentKit = defaultEquipmentKitForMethod(methodKey);
  }
  if (!Array.isArray(next.evidenceRows)) next.evidenceRows = [];
  if (!Array.isArray(next.extentAreas)) next.extentAreas = [];
  if (!Array.isArray(next.recordItems)) next.recordItems = [];
  if (!Array.isArray(next.customSections)) next.customSections = [];
  if (!Array.isArray(next.gprAnomalyCards)) next.gprAnomalyCards = [];
  if (!Array.isArray(next.surveyAreas)) next.surveyAreas = [];
  return next;
}

/** CSS shared by evidence / thickbox print layouts. */
export const SURVEY_EVIDENCE_PRINT_CSS = `
.sr-evidence-rows { display: flex; flex-direction: column; gap: 14px; margin: 12px 0; }
.sr-evidence-row { border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; page-break-inside: avoid; background: #fff; }
.sr-evidence-row__head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; background: #0B1D3A; color: #fff; font-size: 10pt; }
.sr-evidence-chip { font-size: 8pt; padding: 2px 8px; border-radius: 999px; background: #00B4E4; color: #0B1D3A; font-weight: 700; }
.sr-evidence-chip--tfr { background: #fbbf24; color: #78350f; }
.sr-evidence-meta { opacity: 0.85; font-size: 9pt; margin-left: auto; }
.sr-evidence-row__grid { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 0; min-height: 120px; }
.sr-evidence-cell { border-right: 1px solid #e2e8f0; padding: 8px; font-size: 9pt; }
.sr-evidence-cell:last-child { border-right: none; }
.sr-evidence-cell img { width: 100%; max-height: 160px; object-fit: cover; border-radius: 6px; display: block; }
.sr-evidence-cell--empty { display: flex; align-items: center; justify-content: center; color: #94a3b8; background: #f8fafc; min-height: 100px; }
.sr-evidence-cap { font-size: 8pt; color: #64748b; margin-top: 4px; }
.sr-evidence-cell--notes p { margin: 0; white-space: pre-wrap; }
.sr-extent-plate { margin: 12px 0; page-break-inside: avoid; }
.sr-extent-plate__label { font-weight: 700; color: #0B1D3A; margin-bottom: 8px; font-size: 11pt; }
.sr-extent-plate__gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
.sr-extent-plate__gallery img { width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
.sr-extent-plate__notes { font-size: 9pt; color: #475569; margin-top: 6px; }
.sr-thickbox { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin: 12px 0; page-break-inside: avoid; background: linear-gradient(180deg, #f8fafc 0%, #fff 40%); }
.sr-thickbox__title { font-weight: 700; color: #0B1D3A; font-size: 11pt; margin-bottom: 6px; }
.sr-thickbox__meaning { font-size: 9pt; color: #64748b; margin: 0 0 8px; font-style: italic; }
.sr-thickbox__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.sr-wx-chip { font-size: 8pt; padding: 3px 10px; border-radius: 999px; background: #e0f2fe; color: #075985; font-weight: 600; }
.sr-kit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.sr-kit-card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; }
.sr-kit-card img, .sr-kit-card__ph { width: 100%; height: 72px; object-fit: cover; background: #0B1D3A; color: #00B4E4; display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 700; }
.sr-kit-card__body { padding: 8px; }
.sr-kit-card__tech { font-size: 8pt; color: #64748b; }
.sr-kit-card__name { font-size: 9.5pt; font-weight: 700; color: #0f172a; }
.sr-kit-card__meta { font-size: 8pt; color: #94a3b8; margin-top: 2px; }
.sr-geophoto-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
.sr-geophoto-grid figure { margin: 0; }
.sr-geophoto-grid img { width: 100%; height: 100px; object-fit: cover; border-radius: 6px; }
.sr-geophoto-grid figcaption { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
.sr-records-scoreboard { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; }
.sr-record-pill { font-size: 8.5pt; padding: 4px 10px; border-radius: 999px; font-weight: 700; background: #e2e8f0; color: #334155; }
.sr-record-pill--located { background: #bbf7d0; color: #14532d; }
.sr-record-pill--tfr { background: #fde68a; color: #78350f; }
.sr-record-pill--not_located { background: #fecaca; color: #7f1d1d; }
.sr-record-pill--partial { background: #fed7aa; color: #9a3412; }
.sr-method-ladder { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 8px 0; font-size: 8.5pt; }
.sr-method-step { padding: 3px 8px; border-radius: 6px; background: #e2e8f0; color: #64748b; font-weight: 600; }
.sr-method-step--on { background: #00B4E4; color: #0B1D3A; }
.sr-method-step__sep { color: #94a3b8; }
.sr-custom-section { margin: 14px 0; }
.sr-custom-section h3 { color: #0B1D3A; font-size: 12pt; margin: 0 0 6px; }
.sr-constraint-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
.sr-chip { font-size: 8pt; padding: 4px 10px; border-radius: 999px; font-weight: 700; background: #e2e8f0; color: #334155; }
.sr-chip--access { background: #ffedd5; color: #9a3412; }
.sr-chip--limit { background: #e0e7ff; color: #3730a3; }
.sr-chip--photo { background: #fce7f3; color: #9d174d; }
.sr-chip--tfr { background: #fef3c7; color: #92400e; }
.sr-chip--miss { background: #fee2e2; color: #991b1b; }
.sr-tfr-legend { display: flex; flex-wrap: wrap; gap: 14px; padding: 8px 12px; margin: 10px 0; border: 1px dashed #94a3b8; border-radius: 8px; background: #f8fafc; font-size: 8.5pt; }
.sr-tfr-legend__item { display: inline-flex; align-items: center; gap: 6px; color: #334155; }
.sr-tfr-swatch { width: 18px; height: 4px; border-radius: 2px; display: inline-block; }
.sr-tfr-swatch--detected { background: #0B1D3A; }
.sr-tfr-swatch--tfr { background: repeating-linear-gradient(90deg, #f59e0b 0 4px, transparent 4px 7px); height: 3px; border-bottom: 2px dashed #d97706; background: transparent; width: 22px; }
.sr-tfr-swatch--unknown { background: #94a3b8; opacity: 0.7; }
.sr-undertaker-findings { margin: 12px 0; }
.sr-undertaker-findings__head { font-weight: 700; color: #0B1D3A; font-size: 11pt; margin-bottom: 8px; }
.sr-undertaker-block { border-left: 3px solid #00B4E4; padding: 6px 0 8px 12px; margin-bottom: 10px; page-break-inside: avoid; }
.sr-undertaker-block__title { margin: 0 0 4px; font-size: 10.5pt; color: #0B1D3A; }
.sr-undertaker-block__list { margin: 0; padding-left: 18px; font-size: 9.5pt; }
.sr-cover-insight { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0 14px; }
.sr-insight-pill { font-size: 8.5pt; padding: 4px 10px; border-radius: 999px; font-weight: 700; background: #e2e8f0; color: #1e293b; }
.sr-insight-pill--method { background: #0B1D3A; color: #fff; }
.sr-insight-pill--ql { background: #00B4E4; color: #0B1D3A; }
.sr-insight-pill--dig-low { background: #bbf7d0; color: #14532d; }
.sr-insight-pill--dig-medium { background: #fde68a; color: #78350f; }
.sr-insight-pill--dig-high { background: #fecaca; color: #7f1d1d; }
.sr-extent-filmstrip { display: flex; gap: 6px; overflow: hidden; margin-top: 8px; }
.sr-extent-filmstrip img { height: 56px; width: 72px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; flex-shrink: 0; }
.sr-gpr-section { margin: 14px 0; }
.sr-gpr-dash { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
.sr-gpr-dash__stat { background: #0B1D3A; color: #fff; border-radius: 10px; padding: 10px; text-align: center; }
.sr-gpr-dash__stat strong { display: block; font-size: 16pt; color: #00B4E4; }
.sr-gpr-dash__stat span { font-size: 8pt; opacity: 0.85; }
.sr-gpr-dash__note { font-size: 9pt; color: #64748b; }
.sr-gpr-hist { margin: 10px 0 14px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
.sr-gpr-hist__title { font-size: 9pt; font-weight: 700; color: #0B1D3A; margin-bottom: 8px; }
.sr-gpr-hist__chart { display: flex; align-items: flex-end; gap: 10px; min-height: 96px; }
.sr-gpr-hist__col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
.sr-gpr-hist__bar { width: 100%; max-width: 48px; background: linear-gradient(180deg, #00B4E4, #0B1D3A); border-radius: 6px 6px 2px 2px; }
.sr-gpr-hist__n { font-size: 9pt; font-weight: 700; color: #0B1D3A; }
.sr-gpr-hist__lbl { font-size: 7.5pt; color: #64748b; text-align: center; }
.sr-cover-collage { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 4px; page-break-inside: avoid; }
.sr-cover-collage__cell { margin: 0; border-radius: 10px; overflow: hidden; border: 1px solid #cbd5e1; background: #0B1D3A; }
.sr-cover-collage__cell img { width: 100%; height: 88px; object-fit: cover; display: block; }
.sr-cover-collage__cell figcaption { font-size: 7.5pt; padding: 4px 6px; color: #e2e8f0; background: #0B1D3A; }
.sr-rev-verify { display: flex; align-items: center; gap: 14px; margin: 16px 0; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; page-break-inside: avoid; }
.sr-rev-verify__qr { width: 88px; height: 88px; border-radius: 8px; background: #fff; }
.sr-rev-verify__title { font-weight: 800; color: #0B1D3A; font-size: 10.5pt; margin-bottom: 4px; }
.sr-rev-verify__url { font-size: 8pt; color: #64748b; word-break: break-all; margin-top: 4px; }
.sr-gpr-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sr-gpr-card { display: grid; grid-template-columns: 100px 1fr; gap: 8px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; page-break-inside: avoid; background: #fff; }
.sr-gpr-card__media img, .sr-gpr-card__ph { width: 100%; height: 100%; min-height: 90px; object-fit: cover; background: #0B1D3A; color: #00B4E4; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.sr-gpr-card__body { padding: 8px 10px 10px; font-size: 9pt; }
.sr-gpr-card__ref { font-weight: 700; color: #0B1D3A; }
.sr-gpr-card__meta { font-size: 8pt; color: #64748b; margin-bottom: 4px; }
.sr-area-flipbook { margin: 14px 0; }
.sr-area-index { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.sr-area-index__pill { font-size: 8pt; padding: 4px 10px; border-radius: 999px; background: #e0f2fe; color: #075985; font-weight: 700; }
.sr-area-page { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
.sr-area-page__kicker { font-size: 8pt; color: #00B4E4; font-weight: 700; text-transform: uppercase; }
.sr-area-page__title { margin: 4px 0 10px; color: #0B1D3A; font-size: 12pt; }
.sr-area-page__plan { width: 100%; max-height: 240px; object-fit: contain; border-radius: 8px; background: #f1f5f9; }
.sr-area-page__findings { margin-top: 8px; font-size: 9.5pt; background: #f8fafc; border-radius: 8px; padding: 8px 10px; }
@media print {
  .sr-evidence-row__grid { grid-template-columns: 1fr 1fr 1.1fr; }
  .sr-gpr-cards { grid-template-columns: 1fr 1fr; }
}
`;
