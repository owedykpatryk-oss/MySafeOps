/**
 * UK Work at Height Regulations 2005 — hierarchy of control (illustrative).
 */

export const WAH_PERMIT_TYPES = new Set(["work_at_height", "roof_access"]);

export const WAH_EXTRA_FIELD_KEYS = [
  "accessEquipment",
  "maxHeight",
  "rescuePlan",
  "wahControlLevel",
  "exclusionZoneConfirmed",
  "ipafVerified",
  "scaffoldTagCurrent",
  "harnessInspected",
];

export function isWahPermitType(type) {
  return WAH_PERMIT_TYPES.has(String(type || "").trim());
}

export function wahAssessment(extra = {}) {
  const warnings = [];
  const blockers = [];
  const height = Number(extra.maxHeight || 0);
  const equipment = String(extra.accessEquipment || "").trim().toLowerCase();
  const control = String(extra.wahControlLevel || "").trim();
  const exclusion = String(extra.exclusionZoneConfirmed || "").toLowerCase();

  if (height >= 2 && !control) {
    warnings.push("Record hierarchy control level (Avoid / Prevent / Mitigate) for work above 2 m.");
  }
  if (equipment.includes("ladder") && height > 3) {
    warnings.push("Ladder selected above ~3 m — confirm short-duration access only; consider MEWP or scaffold.");
  }
  if ((equipment.includes("mewp") || equipment.includes("cherry")) && String(extra.ipafVerified || "").toLowerCase() !== "yes") {
    warnings.push("MEWP operation — confirm IPAF card and daily pre-use check.");
  }
  if (equipment.includes("scaffold") && String(extra.scaffoldTagCurrent || "").toLowerCase() !== "yes") {
    warnings.push("Scaffold — confirm current handover / inspection tag (ScaffTag / SG4).");
  }
  if (exclusion !== "yes") warnings.push("Establish exclusion zone below work area.");
  if ((equipment.includes("mewp") || equipment.includes("rope")) && !String(extra.rescuePlan || "").trim()) {
    warnings.push("MEWP / rope access — rescue plan reference required.");
  }

  return { warnings, blockers, height };
}

/** WAH hierarchy: Avoid → Prevent (collective) → Mitigate (PPE). */
export function renderWahHierarchySvg({ highlight = "", width = 400, height = 100 } = {}) {
  const steps = [
    { id: "avoid", label: "Avoid", sub: "Do work at ground level", fill: "#dcfce7", stroke: "#16a34a" },
    { id: "prevent", label: "Prevent", sub: "Collective — guardrails, nets", fill: "#dbeafe", stroke: "#2563eb" },
    { id: "mitigate", label: "Mitigate", sub: "PPE — harness, lanyard", fill: "#fef3c7", stroke: "#d97706" },
  ];
  const hi = String(highlight || "").toLowerCase();
  const cellW = width / steps.length;
  const rects = steps
    .map((s, i) => {
      const active = s.id === hi;
      const x = i * cellW + 6;
      return `<g>
        <rect x="${x}" y="18" width="${cellW - 12}" height="68" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${active ? 3 : 1}"/>
        <text x="${x + (cellW - 12) / 2}" y="40" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${s.label}</text>
        <text x="${x + (cellW - 12) / 2}" y="56" text-anchor="middle" font-size="8" fill="#475569">${s.sub}</text>
      </g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Work at height hierarchy">
    <text x="8" y="12" font-size="10" font-weight="700" fill="#854F0B">WAH hierarchy — Work at Height Regulations 2005</text>
    ${rects}
  </svg>`;
}

/** Ladder vs MEWP vs scaffold decision strip. */
export function renderWahAccessChoiceSvg({ equipment = "", width = 420, height = 64 } = {}) {
  const eq = String(equipment || "").toLowerCase();
  const pick = (token) => (eq.includes(token) ? "#166534" : "#64748b");
  const fill = (token) => (eq.includes(token) ? "#dcfce7" : "#f1f5f9");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Access equipment choice">
    <text x="8" y="12" font-size="9" font-weight="700" fill="#0f172a">Access method — ladder only for short duration</text>
    <rect x="8" y="20" width="120" height="36" rx="5" fill="${fill("ladder")}" stroke="${pick("ladder")}"/>
    <text x="68" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">Ladder</text>
    <text x="68" y="48" text-anchor="middle" font-size="7" fill="#64748b">Brief access</text>
    <rect x="150" y="20" width="120" height="36" rx="5" fill="${fill("mewp")}" stroke="${pick("mewp")}"/>
    <text x="210" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">MEWP</text>
    <text x="210" y="48" text-anchor="middle" font-size="7" fill="#64748b">IPAF + rescue</text>
    <rect x="292" y="20" width="120" height="36" rx="5" fill="${fill("scaffold")}" stroke="${pick("scaffold")}"/>
    <text x="352" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">Scaffold</text>
    <text x="352" y="48" text-anchor="middle" font-size="7" fill="#64748b">Tag / handover</text>
  </svg>`;
}

/** Exclusion zone under work area. */
export function renderWahExclusionZoneSvg({ width = 280, height = 100 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Exclusion zone">
    <rect x="0" y="0" width="${width}" height="45" fill="#fef3c7" stroke="#d97706" stroke-dasharray="4 2"/>
    <text x="${width / 2}" y="18" text-anchor="middle" font-size="9" font-weight="700" fill="#92400e">WORK AT HEIGHT</text>
    <text x="${width / 2}" y="32" text-anchor="middle" font-size="8" fill="#78350f">Harness / edge protection</text>
    <rect x="20" y="50" width="${width - 40}" height="40" fill="#fee2e2" stroke="#dc2626"/>
    <text x="${width / 2}" y="68" text-anchor="middle" font-size="9" font-weight="700" fill="#991b1b">EXCLUSION ZONE</text>
    <text x="${width / 2}" y="82" text-anchor="middle" font-size="8" fill="#7f1d1d">No access — falling object risk</text>
  </svg>`;
}

export function renderWahPrintHtml(permit, { primaryColor = "#854F0B" } = {}) {
  if (!isWahPermitType(permit?.type)) return "";
  const extra = permit?.extraFields || {};
  const assessment = wahAssessment(extra);
  const control = String(extra.wahControlLevel || "").toLowerCase();

  const fieldsHtml = [
    ["Access equipment", extra.accessEquipment || "—"],
    ["Max height (m)", extra.maxHeight || "—"],
    ["Control level", extra.wahControlLevel || "—"],
    ["Exclusion zone", extra.exclusionZoneConfirmed || "—"],
    ["IPAF verified", extra.ipafVerified || "—"],
    ["Scaffold tag current", extra.scaffoldTagCurrent || "—"],
    ["Harness inspected", extra.harnessInspected || "—"],
    ["Rescue plan ref", extra.rescuePlan || "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;color:#666;width:40%">${k}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${String(v).replace(/</g, "&lt;")}</td></tr>`
    )
    .join("");

  const warnHtml =
    assessment.warnings.length > 0
      ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:10px;color:#92400e">${assessment.warnings.map((w) => `<li>${String(w).replace(/</g, "&lt;")}</li>`).join("")}</ul>`
      : `<p style="margin:6px 0 0;font-size:10px;color:#166534">WAH controls recorded.</p>`;

  return `
  <h2 style="border-left-color:${primaryColor}">Work at height guidance</h2>
  <p style="font-size:10px;color:#64748b;margin:0 0 8px">Work at Height Regulations 2005 — hierarchy of control. Site RAMS governs.</p>
  <div style="margin-bottom:8px">${renderWahHierarchySvg({ highlight: control, width: 460 })}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>${renderWahAccessChoiceSvg({ equipment: extra.accessEquipment, width: 340 })}</div>
    <div>${renderWahExclusionZoneSvg({ width: 280 })}</div>
  </div>
  <table style="margin-bottom:8px"><tbody>${fieldsHtml}</tbody></table>
  ${warnHtml}
  <p style="font-size:9px;color:#64748b;margin-top:8px">WAH Regs 2005 · HSE work at height · site rescue plan</p>`;
}
