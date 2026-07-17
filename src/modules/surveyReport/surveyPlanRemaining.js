/**
 * Remaining PAS128 survey plan upgrades — ribbon, MH/IC, geology, appendices, dual method, classic outline.
 */
import { escapeHtml, escapeAttr, safeImageSrc } from "../../utils/htmlEscape.js";
import { PAS128_METHODS } from "./surveyReportConstants";
import { blankEvidenceRow, blankExtentArea, blankRecordItem, blankSurveyArea } from "./surveyEvidencePack";
import { boreholeScanLinkHtml, buildGeologySamplePointsHtml } from "./surveyGeologyUpgrades";

const esc = escapeHtml;

function uid(prefix = "row") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Cover / title string for primary + optional secondary method. */
export function formatDualPas128Method(primary, secondary) {
  const a = String(primary || "").trim();
  const b = String(secondary || "").trim();
  if (a && b && a !== b) return `${a} + ${b}`;
  return a || b || "";
}

export function pas128MethodOptionLabel(key) {
  return PAS128_METHODS.find((m) => m.key === key)?.label || key || "";
}

export function blankMhIcCard(overrides = {}) {
  return {
    id: uid("mh"),
    ref: "",
    coverLevel: "",
    invertLevel: "",
    pipesIn: "",
    pipesOut: "",
    photoUrl: "",
    notes: "",
    ...overrides,
  };
}

/** Indian Queens-style AOC chainage ribbon. */
export function buildAocChainageRibbonHtml(extentAreas = [], surveyAreas = []) {
  const list = [
    ...(extentAreas || []).map((a) => ({ label: a.label, chainage: a.chainage })),
    ...(surveyAreas || []).map((a) => ({ label: a.label, chainage: a.chainage })),
  ].filter((a) => a && (a.label || a.chainage));
  if (list.length < 2 && !list.some((a) => a.chainage)) return "";

  const cells = list
    .map(
      (a, i) =>
        `<div class="sr-aoc-ribbon__node">
  <span class="sr-aoc-ribbon__pin">${i + 1}</span>
  <strong>${esc(a.label || `AOC ${i + 1}`)}</strong>
  ${a.chainage ? `<span class="sr-aoc-ribbon__ch">${esc(a.chainage)}</span>` : ""}
</div>`
    )
    .join('<span class="sr-aoc-ribbon__rail" aria-hidden="true"></span>');

  return `<div class="sr-aoc-ribbon" aria-label="Survey extent chainage">${cells}</div>`;
}

/** Equipment Appendix 1–N datasheet pages. */
export function buildEquipmentAppendixHtml(kit = []) {
  const list = (kit || []).filter((k) => k && (k.tradeName || k.technique || k.photoUrl || k.appendixRef));
  if (!list.length) return "";
  return list
    .map((k, i) => {
      const n = i + 1;
      const src = safeImageSrc(k.photoUrl);
      const title = k.appendixRef || `Appendix ${n}`;
      return `<div class="sr-equip-appendix">
  <div class="sr-equip-appendix__head">${esc(title)} — ${esc(k.technique || k.tradeName || "Equipment")}</div>
  <div class="sr-equip-appendix__grid">
    <div class="sr-equip-appendix__media">${src ? `<img src="${escapeAttr(src)}" alt=""/>` : `<div class="sr-equip-appendix__ph">Datasheet</div>`}</div>
    <div class="sr-equip-appendix__meta">
      <p><strong>Technique:</strong> ${esc(k.technique || "—")}</p>
      <p><strong>Trade name:</strong> ${esc(k.tradeName || "—")}</p>
      <p><strong>Manufacturer:</strong> ${esc(k.manufacturer || "—")}</p>
      <p><strong>Calibration due:</strong> ${esc(k.calibrationDue || "—")}</p>
    </div>
  </div>
</div>`;
    })
    .join("");
}

/** MH/IC survey cards (M4 / M4P). */
export function buildMhIcCardsHtml(cards = []) {
  const list = (cards || []).filter((c) => c && (c.ref || c.coverLevel || c.photoUrl || c.notes));
  if (!list.length) return "";
  const grid = list
    .map((c) => {
      const src = safeImageSrc(c.photoUrl);
      return `<article class="sr-mh-card">
  <div class="sr-mh-card__media">${src ? `<img src="${escapeAttr(src)}" alt=""/>` : `<div class="sr-mh-card__ph">MH/IC</div>`}</div>
  <div class="sr-mh-card__body">
    <div class="sr-mh-card__ref">${esc(c.ref || "Chamber")}</div>
    <div class="sr-mh-card__meta">Cover ${esc(c.coverLevel || "—")} · Invert ${esc(c.invertLevel || "—")}</div>
    <p>In: ${esc(c.pipesIn || "—")} · Out: ${esc(c.pipesOut || "—")}</p>
    ${c.notes?.trim() ? `<p>${esc(c.notes.trim())}</p>` : ""}
  </div>
</article>`;
    })
    .join("");
  return `<div class="sr-mh-section"><div class="sr-thickbox__title">Manhole / IC survey cards</div><div class="sr-mh-grid">${grid}</div></div>`;
}

/** Optional BGS / geology callout — 50k preferred; not SI soils. */
export function buildGeologyBlockHtml(geology = {}) {
  const formation = String(geology.formation || "").trim();
  const implications = String(geology.implications || "").trim();
  const notes = String(geology.notes || "").trim();
  const disclaimer = String(geology.disclaimer || "").trim();
  const accuracyWarning = String(geology.accuracyWarning || "").trim();
  const boreholes = Array.isArray(geology.nearbyBoreholes) ? geology.nearbyBoreholes : [];
  const samples = Array.isArray(geology.samplePoints) ? geology.samplePoints : [];
  if (!formation && !implications && !notes && !disclaimer && !boreholes.length && samples.length < 2) return "";
  const meta = [];
  if (geology.scale) meta.push(esc(geology.scale));
  if (geology.resolution) meta.push(esc(String(geology.resolution)));
  if (geology.coordSource) meta.push(esc(geology.coordSource));
  if (geology.materialClass) meta.push(`class: ${esc(String(geology.materialClass).replace(/_/g, " "))}`);
  if (geology.attenuationClass) meta.push(`attenuation: ${esc(String(geology.attenuationClass).replace(/_/g, " "))}`);
  if (geology.queryLat != null && geology.queryLng != null) {
    meta.push(`point ${Number(geology.queryLat).toFixed(5)}, ${Number(geology.queryLng).toFixed(5)}`);
  }
  if (geology.expectedPenetrationM != null) {
    meta.push(`indicative GPR ~${esc(String(geology.expectedPenetrationM))} m @ 400 MHz`);
  }
  if (geology.artificialLabel) meta.push(`artificial: ${esc(geology.artificialLabel)}`);
  const bhRows = boreholes.slice(0, 5).map((b) => {
    const link = boreholeScanLinkHtml(b);
    return `<tr><td>${link}</td><td>${b.distanceM != null ? `${esc(String(b.distanceM))} m` : "—"}</td><td>${b.lengthM != null ? `${esc(String(b.lengthM))} m` : "—"}</td><td>${esc(b.precision || "—")}</td></tr>`;
  });
  const bhTable = bhRows.length
    ? `<div class="sr-geology__bh"><div class="sr-thickbox__title" style="font-size:10pt;margin-top:8px">Nearby BGS borehole index</div>
<table class="sr-data-table"><thead><tr><th>Reference / scan</th><th>Distance</th><th>Length</th><th>Precision</th></tr></thead><tbody>${bhRows.join("")}</tbody></table></div>`
    : "";
  const samplesHtml = buildGeologySamplePointsHtml(samples);
  return `<div class="sr-geology">
  <div class="sr-thickbox__title">Geological context (BGS desk study)</div>
  ${accuracyWarning ? `<p class="sr-geology__warn"><strong>Accuracy:</strong> ${esc(accuracyWarning)}</p>` : ""}
  ${meta.length ? `<p class="sr-geology__meta">${meta.join(" · ")}</p>` : ""}
  ${formation ? `<p><strong>Mapped units:</strong> ${esc(formation)}</p>` : ""}
  ${implications ? `<p><strong>Implications for EML / GPR:</strong> ${esc(implications)}</p>` : ""}
  ${notes ? `<p>${esc(notes)}</p>` : ""}
  ${samplesHtml}
  ${bhTable}
  ${disclaimer ? `<p class="sr-geology__disclaimer"><em>${esc(disclaimer)}</em></p>` : ""}
</div>`;
}

/**
 * Reorder printed sections for UM classic TOC (1–5 + limitations).
 * @param {Array<{ id?: string, html?: string }>} sections
 */
export function reorderSectionsForUmClassic(sections = []) {
  const preferred = [
    "doc-control",
    "changes",
    "rev-records-diff",
    "info",
    "insight",
    "exec",
    "foreword",
    "scope",
    "programme",
    "extent",
    "deliverables",
    "findings",
    "geophoto-groups",
    "custom-sections",
    "records",
    "records-refs",
    "dbyd-log",
    "undertaker-status",
    "method",
    "workflow",
    "equipment",
    "equipment-cal",
    "equipment-appendix",
    "geology",
    "mh-ic",
    "weather",
    "control",
    "cad-import",
    "site-plan",
    "site-plan-images",
    "limitations",
    "limitations-eml",
    "limitations-gpr",
    "recommendations",
    "standards",
    "qa",
    "photos",
    "rev-verify",
    "signatures",
  ];
  const byId = new Map();
  const rest = [];
  for (const s of sections) {
    if (s?.id && !byId.has(s.id)) byId.set(s.id, s);
    else rest.push(s);
  }
  const ordered = [];
  for (const id of preferred) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      byId.delete(id);
    }
  }
  for (const s of byId.values()) ordered.push(s);
  return [...ordered, ...rest];
}

/** UM classic section title overrides. */
export function umClassicSectionTitle(id, fallback) {
  const map = {
    foreword: "1. Foreword",
    scope: "2. Project requirements",
    extent: "3. Survey extent",
    deliverables: "4. Deliverables",
    findings: "5. Survey results",
    limitations: "Limitations",
    "limitations-eml": "Limitations of EML",
    "limitations-gpr": "Limitations of GPR",
  };
  return map[id] || fallback;
}

/**
 * Smart-fill v2 — seed premium stubs from method, photos, and empty structures.
 * @param {object} report
 * @param {{ geoPhotos?: object[] }} [ctx]
 */
export function seedSmartFillPremiumV2(report, ctx = {}) {
  let next = { ...report };
  const method = next.pas128Method || "M2";

  // Lazy import path avoided — caller may already have seeded kit
  if (!Array.isArray(next.evidenceRows)) next.evidenceRows = [];
  if (!Array.isArray(next.extentAreas)) next.extentAreas = [];
  if (!Array.isArray(next.recordItems)) next.recordItems = [];
  if (!Array.isArray(next.customSections)) next.customSections = [];
  if (!Array.isArray(next.gprAnomalyCards)) next.gprAnomalyCards = [];
  if (!Array.isArray(next.surveyAreas)) next.surveyAreas = [];
  if (!Array.isArray(next.mhIcCards)) next.mhIcCards = [];

  if (!next.extentAreas.length && next.siteAddress) {
    next.extentAreas = [blankExtentArea({ label: "AOC1", notes: "Survey extent — add chainage and plan image." })];
  }

  if (!next.recordItems.length && ["utility_mapping_survey", "eml_cat_survey", "gpr_survey"].includes(next.surveyType)) {
    next.recordItems = [
      blankRecordItem({ undertaker: "Electricity DNO", serviceType: "electric", status: "not_located" }),
      blankRecordItem({ undertaker: "Gas undertaker", serviceType: "gas", status: "tfr" }),
      blankRecordItem({ undertaker: "Water company", serviceType: "water", status: "not_located" }),
      blankRecordItem({ undertaker: "Telecoms", serviceType: "telecoms", status: "partial" }),
    ];
  }

  if (!next.evidenceRows.length && next.extentAreas.length) {
    next.evidenceRows = next.extentAreas.slice(0, 3).map((a) =>
      blankEvidenceRow({
        title: `${a.label || "AOC"} — site evidence`,
        undertaker: "",
        aocId: a.id,
        body: "Add CAD crop, site photo and explanation (located / TFR / constraint).",
      })
    );
  }

  const photos = (ctx.geoPhotos || []).filter((p) => p && (!next.projectId || p.projectId === next.projectId));
  const mhPhotos = photos.filter((p) => p.type === "manhole_chamber");
  if (!next.mhIcCards.length && mhPhotos.length && (method === "M4" || method === "M4P")) {
    next.mhIcCards = mhPhotos.slice(0, 8).map((p, i) =>
      blankMhIcCard({
        ref: p.label || `MH${String(i + 1).padStart(2, "0")}`,
        photoUrl: p.dataUrl || p.url || "",
        notes: "Imported from geo-photo — complete cover/invert levels.",
      })
    );
  }

  if (!next.geology?.formation && !next.geology?.implications && (next.surveyType === "gpr_survey" || method.startsWith("M3") || method.startsWith("M4"))) {
    next.geology = {
      ...(next.geology || {}),
      formation: next.geology?.formation || "",
      implications:
        next.geology?.implications ||
        "Confirm local BGS superficial geology — attenuation and depth of investigation may vary.",
      notes: next.geology?.notes || "",
    };
  }

  if (!next.surveyAreas?.length && next.extentAreas?.length > 1) {
    next.surveyAreas = next.extentAreas.map((e) =>
      blankSurveyArea({
        label: e.label,
        chainage: e.chainage,
        planImageUrl: e.planImageUrl,
        photoUrls: [...(e.photoUrls || [])],
        notes: e.notes,
      })
    );
  }

  return next;
}

export const SURVEY_PLAN_UPGRADE_CSS = `
.sr-aoc-ribbon { display: flex; flex-wrap: wrap; align-items: center; gap: 0; margin: 12px 0 16px; padding: 10px 12px; background: linear-gradient(90deg, #0B1D3A 0%, #0f2744 100%); border-radius: 12px; color: #fff; }
.sr-aoc-ribbon__node { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 4px 10px; min-width: 88px; }
.sr-aoc-ribbon__pin { width: 22px; height: 22px; border-radius: 999px; background: #00B4E4; color: #0B1D3A; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.sr-aoc-ribbon__ch { font-size: 8.5pt; opacity: 0.85; color: #7dd3fc; }
.sr-aoc-ribbon__rail { flex: 1; min-width: 24px; height: 2px; background: rgba(0,180,228,0.45); margin: 0 4px; align-self: center; }
.sr-equip-appendix { border: 1px solid #cbd5e1; border-radius: 12px; margin: 14px 0; page-break-inside: avoid; overflow: hidden; background: #fff; }
.sr-equip-appendix__head { background: #0B1D3A; color: #fff; padding: 8px 12px; font-weight: 700; font-size: 11pt; }
.sr-equip-appendix__grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 0; }
.sr-equip-appendix__media img, .sr-equip-appendix__ph { width: 100%; min-height: 160px; max-height: 220px; object-fit: cover; background: #0B1D3A; color: #00B4E4; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.sr-equip-appendix__meta { padding: 12px 14px; font-size: 9.5pt; }
.sr-equip-appendix__meta p { margin: 0 0 6px; }
.sr-mh-section { margin: 14px 0; }
.sr-mh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sr-mh-card { display: grid; grid-template-columns: 96px 1fr; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; page-break-inside: avoid; background: #fff; }
.sr-mh-card__media img, .sr-mh-card__ph { width: 100%; height: 100%; min-height: 90px; object-fit: cover; background: #0B1D3A; color: #00B4E4; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 9pt; }
.sr-mh-card__body { padding: 8px 10px; font-size: 9pt; }
.sr-mh-card__ref { font-weight: 700; color: #0B1D3A; }
.sr-mh-card__meta { font-size: 8pt; color: #64748b; margin-bottom: 4px; }
.sr-geology { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin: 12px 0; background: linear-gradient(180deg, #f0f9ff 0%, #fff 50%); page-break-inside: avoid; font-size: 9.5pt; }
.sr-geology__meta { font-size: 8.5pt; color: #64748b; margin: 0 0 8px; }
.sr-geology__warn { font-size: 9pt; color: #92400e; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 8px 10px; margin: 0 0 8px; }
.sr-geology__disclaimer { font-size: 8.5pt; color: #475569; margin: 8px 0 0; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
.sr-geology__bh { margin-top: 6px; }
@media print {
  .sr-mh-grid, .sr-equip-appendix__grid { grid-template-columns: 1fr 1fr; }
}
`;
