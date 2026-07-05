/**
 * UK safe-dig / PAS 128 guidance for excavation & ground disturbance permits.
 * Illustrative accuracy bands — site-specific survey report governs on site.
 */

export const DIG_PERMIT_TYPES = new Set(["excavation", "ground_disturbance"]);

export const PAS128_QUALITY_LEVELS = [
  {
    id: "QL-D",
    label: "QL-D — Desk / records",
    horizontalMm: 500,
    verticalMm: null,
    summary: "Utility records only. Highest uncertainty — do not rely for mechanical dig near services.",
    mechanicalDig: "no",
    handDigBufferM: 0.5,
  },
  {
    id: "QL-C",
    label: "QL-C — Site reconnaissance",
    horizontalMm: 300,
    verticalMm: null,
    summary: "Records correlated to visible surface features. Hand dig or trial pit before mechanisation.",
    mechanicalDig: "partial",
    handDigBufferM: 0.5,
  },
  {
    id: "QL-B",
    label: "QL-B — Detection survey",
    horizontalMm: 250,
    verticalMm: 250,
    summary: "CAT / GPR / EML detection. Typical target ±250 mm — use hand-dig buffer at marks.",
    mechanicalDig: "yes_with_buffer",
    handDigBufferM: 0.5,
  },
  {
    id: "QL-A",
    label: "QL-A — Verified (exposed)",
    horizontalMm: 50,
    verticalMm: 50,
    summary: "Service exposed (trial pit / vacuum excavation). ±50 mm — closest safe approach.",
    mechanicalDig: "yes_controlled",
    handDigBufferM: 0,
  },
];

/** PAS 128 survey delivery types — B1 = single geophysical technique (e.g. CAT & Genny only). */
export const PAS128_SURVEY_TYPES = [
  {
    id: "D",
    label: "Type D — Desktop",
    mapsToQl: "QL-D",
    methods: "Utility records, plans, DBYD / LSBUD",
    note: "No site detection — plan hand dig or commission Type B before breaking ground.",
  },
  {
    id: "C",
    label: "Type C — Reconnaissance",
    mapsToQl: "QL-C",
    methods: "Walk-over, valve boxes, pedestals, record correlation",
    note: "Confirms records on site — still not a detection survey.",
  },
  {
    id: "B1",
    label: "Type B1 — Single method",
    mapsToQl: "QL-B",
    methods: "One technique: CAT & Genny (EML), or GPR only",
    note: "Common on civils — rescans after first spoil. Hand dig 0.5 m each side of mark.",
  },
  {
    id: "B2",
    label: "Type B2 — Multiple methods",
    mapsToQl: "QL-B",
    methods: "EML + GPR (or equivalent dual technique)",
    note: "Better ambiguity reduction than B1 alone.",
  },
  {
    id: "B3",
    label: "Type B3 — Correlated detection",
    mapsToQl: "QL-B",
    methods: "Multiple methods with full correlation / reduction of ambiguity",
    note: "Strongest detection tier before physical verification.",
  },
  {
    id: "A",
    label: "Type A — Verification",
    mapsToQl: "QL-A",
    methods: "Vacuum excavation, hand exposure, sighting of service",
    note: "Required where tolerance is tight or services are critical.",
  },
];

export const DIG_EXTRA_FIELD_KEYS = [
  "catScanBy",
  "knownServices",
  "excavationDepth",
  "groundType",
  "disturbanceMethod",
  "maxDepth",
  "pas128QualityLevel",
  "pas128SurveyType",
  "surveyDrawingRef",
  "horizontalAccuracyMm",
  "mechanicalDigAllowed",
  "trialPitDone",
  "utilityStrikeContacts",
];

export function isDigPermitType(type) {
  return DIG_PERMIT_TYPES.has(String(type || "").trim());
}

export function pas128QualityMeta(qlId) {
  const id = String(qlId || "").trim().toUpperCase();
  return PAS128_QUALITY_LEVELS.find((q) => q.id === id) || null;
}

export function pas128SurveyMeta(surveyId) {
  const raw = String(surveyId || "").trim().toUpperCase();
  const id = raw === "B" ? "B1" : raw;
  return PAS128_SURVEY_TYPES.find((s) => s.id === id) || null;
}

export function mechanicalDigAssessment(extra = {}) {
  const ql = pas128QualityMeta(extra.pas128QualityLevel);
  const survey = pas128SurveyMeta(extra.pas128SurveyType);
  const stated = String(extra.mechanicalDigAllowed || "").trim().toLowerCase();
  const depth = Number(extra.excavationDepth || extra.maxDepth || 0);
  const trial = String(extra.trialPitDone || "").trim().toLowerCase();

  const warnings = [];
  const blockers = [];

  if (!ql) {
    warnings.push("Select PAS 128 quality level (QL-D to QL-A) before issue.");
  } else if (ql.id === "QL-D" || ql.id === "QL-C") {
    if (stated === "yes" || stated === "full") {
      blockers.push(`${ql.id} does not support unrestricted mechanical excavation near utilities.`);
    }
    warnings.push(`${ql.id}: hand dig / trial pit only in utility corridor unless upgraded to QL-B+.`);
  }

  if (!survey) {
    warnings.push("Record PAS 128 survey type (D / C / B1 / B2 / B3 / A).");
  } else if (survey.id === "D" && stated === "yes") {
    blockers.push("Type D desktop study alone — mechanical dig not permitted without Type B1+ survey.");
  }

  if (depth > 1.2 && !String(extra.surveyDrawingRef || "").trim()) {
    warnings.push("Depth > 1.2 m — confirm shoring / temporary works design reference on survey or permit.");
  }

  if ((ql?.id === "QL-B" || survey?.id?.startsWith("B")) && trial !== "yes") {
    warnings.push("Consider trial pit / vacuum verification at service crossings before full mechanisation.");
  }

  return {
    ql,
    survey,
    warnings,
    blockers,
    handDigBufferM: ql?.handDigBufferM ?? 0.5,
    allowed:
      blockers.length === 0 &&
      (ql?.mechanicalDig === "yes_with_buffer" ||
        ql?.mechanicalDig === "yes_controlled" ||
        stated === "partial" ||
        stated === "no"),
  };
}

/** Inline SVG — PAS 128 QL accuracy ladder */
export function renderPas128QlLadderSvg({ width = 520, highlightId = "" } = {}) {
  const h = 88;
  const items = PAS128_QUALITY_LEVELS;
  const cellW = width / items.length;
  const hi = String(highlightId || "").toUpperCase();
  const rects = items
    .map((q, i) => {
      const active = q.id === hi;
      const x = i * cellW + 4;
      const fill = active ? "#166534" : i === 0 ? "#fecaca" : i === 1 ? "#fde68a" : i === 2 ? "#bfdbfe" : "#bbf7d0";
      const stroke = active ? "#14532d" : "#64748b";
      const acc =
        q.verticalMm != null
          ? `±${q.horizontalMm} mm H / ±${q.verticalMm} mm V`
          : `≥±${q.horizontalMm} mm`;
      return `<g>
        <rect x="${x}" y="8" width="${cellW - 8}" height="${h - 16}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${active ? 2 : 1}"/>
        <text x="${x + (cellW - 8) / 2}" y="28" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">${q.id}</text>
        <text x="${x + (cellW - 8) / 2}" y="44" text-anchor="middle" font-size="9" fill="#334155">${acc}</text>
        <text x="${x + (cellW - 8) / 2}" y="58" text-anchor="middle" font-size="8" fill="#475569">${q.mechanicalDig.replace(/_/g, " ")}</text>
      </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${h}" width="100%" style="max-width:${width}px;height:auto" role="img" aria-label="PAS 128 quality levels">
    <text x="4" y="6" font-size="9" font-weight="700" fill="#0f172a">PAS 128 quality levels (indicative accuracy)</text>
    ${rects}
  </svg>`;
}

/** Inline SVG — survey type ladder D → C → B1 → B2 → B3 → A */
export function renderPas128SurveyTypeSvg({ width = 520, highlightId = "" } = {}) {
  const h = 72;
  const items = PAS128_SURVEY_TYPES;
  const cellW = width / items.length;
  const hi = String(highlightId || "").toUpperCase().replace(/^B$/, "B1");
  const rects = items
    .map((s, i) => {
      const active = s.id === hi;
      const x = i * cellW + 2;
      const fill = active ? "#0c4a6e" : "#f1f5f9";
      const textFill = active ? "#fff" : "#0f172a";
      return `<g>
        <rect x="${x}" y="10" width="${cellW - 4}" height="${h - 18}" rx="5" fill="${fill}" stroke="#94a3b8" stroke-width="${active ? 2 : 1}"/>
        <text x="${x + (cellW - 4) / 2}" y="30" text-anchor="middle" font-size="${s.id.length > 2 ? 8 : 10}" font-weight="700" fill="${textFill}">${s.id === "B1" ? "B1" : s.id}</text>
        <text x="${x + (cellW - 4) / 2}" y="46" text-anchor="middle" font-size="7" fill="${active ? "#e2e8f0" : "#64748b"}">${s.mapsToQl}</text>
      </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${h}" width="100%" style="max-width:${width}px;height:auto" role="img" aria-label="PAS 128 survey types">
    <text x="4" y="8" font-size="9" font-weight="700" fill="#0f172a">Survey delivery: D → C → B1 → B2 → B3 → A</text>
    ${rects}
  </svg>`;
}

/** Hand-dig buffer diagram (HSG47-style 0.5 m) */
export function renderHandDigBufferSvg({ bufferM = 0.5, width = 280, height = 100 } = {}) {
  const svcX = width * 0.5;
  const bufPx = width * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Hand dig buffer">
    <rect x="0" y="20" width="${width}" height="50" fill="#e2e8f0" stroke="#94a3b8"/>
    <rect x="${svcX - bufPx}" y="20" width="${bufPx * 2}" height="50" fill="#fef3c7" stroke="#d97706" stroke-dasharray="4 2"/>
    <line x1="${svcX}" y1="15" x2="${svcX}" y2="75" stroke="#dc2626" stroke-width="3"/>
    <text x="${svcX}" y="12" text-anchor="middle" font-size="8" fill="#dc2626">Marked service</text>
    <text x="${svcX - bufPx / 2}" y="48" text-anchor="middle" font-size="8" fill="#92400e">Hand dig</text>
    <text x="${svcX + bufPx / 2}" y="48" text-anchor="middle" font-size="8" fill="#92400e">Hand dig</text>
    <text x="12" y="48" font-size="8" fill="#475569">Mech. zone</text>
    <text x="${width - 12}" y="48" text-anchor="end" font-size="8" fill="#475569">Mech. zone</text>
    <text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">${bufferM} m hand-dig buffer each side (typical HSG47)</text>
  </svg>`;
}

/** Safe dig flow */
export function renderSafeDigFlowSvg({ width = 400, height = 56 } = {}) {
  const steps = ["Records", "CAT/Genny", "Mark-up", "Trial pit", "Hand dig", "Mechanical"];
  const stepW = width / steps.length;
  const arrows = steps
    .map((label, i) => {
      const x = i * stepW + 4;
      const fill = i < 3 ? "#dbeafe" : i < 5 ? "#fef3c7" : "#dcfce7";
      return `<rect x="${x}" y="14" width="${stepW - 6}" height="28" rx="4" fill="${fill}" stroke="#64748b"/>
        <text x="${x + (stepW - 6) / 2}" y="32" text-anchor="middle" font-size="8" font-weight="600" fill="#0f172a">${label}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Safe dig flow">
    <text x="4" y="10" font-size="9" font-weight="700" fill="#0f172a">Safe dig sequence — do not skip steps</text>
    ${arrows}
  </svg>`;
}

/** Utility strike STOP card */
export function renderUtilityStrikeSvg({ width = 320, height = 72 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Utility strike procedure">
    <rect x="0" y="0" width="${width}" height="${height}" rx="6" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>
    <text x="${width / 2}" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="#991b1b">UTILITY STRIKE — STOP</text>
    <text x="${width / 2}" y="34" text-anchor="middle" font-size="8" fill="#7f1d1d">Stop work · Evacuate · Do not backfill · Isolate if safe · Call utility owner</text>
    <text x="${width / 2}" y="50" text-anchor="middle" font-size="8" fill="#7f1d1d">Gas: 0800 111 999 · National Grid · Local DNO · Water undertaker</text>
    <text x="${width / 2}" y="64" text-anchor="middle" font-size="7" fill="#64748b">Record incident on permit / site register immediately</text>
  </svg>`;
}

export function buildPermitStatusDeepLink(permitId, origin = "") {
  const base = String(origin || "").replace(/\/$/, "") || "https://mysafeops.com";
  return `${base}/app?view=permits&permitId=${encodeURIComponent(String(permitId || ""))}`;
}

export function renderDigGuidancePrintHtml(permit, { primaryColor = "#0d9488" } = {}) {
  if (!isDigPermitType(permit?.type)) return "";
  const extra = permit?.extraFields || {};
  const ql = extra.pas128QualityLevel || "";
  const survey = extra.pas128SurveyType || "";
  const assessment = mechanicalDigAssessment(extra);
  const qlMeta = pas128QualityMeta(ql);
  const surveyMeta = pas128SurveyMeta(survey);

  const fieldsHtml = [
    ["PAS 128 QL", ql || "—"],
    ["Survey type", survey || "—"],
    ["Drawing / survey ref", extra.surveyDrawingRef || "—"],
    ["Horizontal accuracy (mm)", extra.horizontalAccuracyMm || (qlMeta ? `±${qlMeta.horizontalMm}` : "—")],
    ["Mechanical dig", extra.mechanicalDigAllowed || "—"],
    ["Trial pit / verify", extra.trialPitDone || "—"],
    ["CAT scan by", extra.catScanBy || "—"],
    ["Known services", extra.knownServices || "—"],
    ["Max depth (m)", extra.excavationDepth || extra.maxDepth || "—"],
    ["Strike contacts", extra.utilityStrikeContacts || "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;color:#666;width:38%">${k}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${String(v).replace(/</g, "&lt;")}</td></tr>`
    )
    .join("");

  const warnHtml =
    assessment.blockers.length || assessment.warnings.length
      ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:10px;color:#991b1b">${[...assessment.blockers, ...assessment.warnings]
          .map((w) => `<li>${String(w).replace(/</g, "&lt;")}</li>`)
          .join("")}</ul>`
      : `<p style="margin:6px 0 0;font-size:10px;color:#166534">Survey level consistent with stated dig method.</p>`;

  return `
  <h2 style="border-left-color:${primaryColor}">Safe dig &amp; PAS 128 guidance</h2>
  <p style="font-size:10px;color:#64748b;margin:0 0 8px">Indicative UK practice (PAS 128 / HSG47). Site survey report and utility owners govern on site.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>${renderPas128QlLadderSvg({ width: 360, highlightId: ql })}</div>
    <div>${renderPas128SurveyTypeSvg({ width: 360, highlightId: survey })}</div>
  </div>
  <div style="margin-bottom:8px">${renderSafeDigFlowSvg({ width: 480 })}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>${renderHandDigBufferSvg({ bufferM: assessment.handDigBufferM })}</div>
    <div>${renderUtilityStrikeSvg()}</div>
  </div>
  ${qlMeta ? `<p style="font-size:11px;margin:0 0 6px"><strong>${qlMeta.id}:</strong> ${qlMeta.summary}</p>` : ""}
  ${surveyMeta ? `<p style="font-size:11px;margin:0 0 6px"><strong>${surveyMeta.label}:</strong> ${surveyMeta.methods} — ${surveyMeta.note}</p>` : ""}
  <table style="margin-bottom:8px"><tbody>${fieldsHtml}</tbody></table>
  ${warnHtml}
  <p style="font-size:9px;color:#64748b;margin-top:8px">PAS 128:2014+ · HSG47 buried services · CDM pre-construction information</p>`;
}
