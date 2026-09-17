/**
 * Work-at-height hierarchy of control (illustrative).
 * UK copy cites WAHR 2005 / IPAF / ScaffTag; PL/AU keep the widgets with local statute names.
 */

import { getOrgMarketId } from "../../../utils/orgMarket";

export const WAH_PERMIT_TYPES = new Set(["work_at_height", "roof_access"]);

const WAH_EN_FIELDS = {
  panelTitle: "Work at height",
  roofPanelTitle: "Roof access / WAH",
  accessWidgetTitle: "Access method",
  exclusionWidgetTitle: "Exclusion zone",
  accessEquipmentLabel: "Access equipment type / ref",
  accessEquipmentPlaceholder: "Ladder / MEWP / scaffold tag",
  hierarchyLevelLabel: "Hierarchy control level",
  selectLabel: "Select…",
  yesLabel: "Yes",
  noLabel: "No",
  avoidOption: "Avoid — ground level",
  preventOption: "Prevent — collective (guardrails)",
  mitigateOption: "Mitigate — harness / PPE",
  maxHeightLabel: "Maximum working height (m)",
  exclusionLabel: "Exclusion zone below work",
  harnessLabel: "Harness / lanyard inspected",
  rescuePlanLabel: "Rescue plan reference",
  readyCopy: "WAH controls recorded — site RAMS governs method selection.",
  printHeading: "Work at height guidance",
  printAccessEquipment: "Access equipment",
  printMaxHeight: "Max height (m)",
  printControlLevel: "Control level",
  printExclusion: "Exclusion zone",
  printHarness: "Harness inspected",
  printRescue: "Rescue plan ref",
  printReady: "WAH controls recorded.",
  heightWarning: "Record hierarchy control level (Avoid / Prevent / Mitigate) for work above 2 m.",
  ladderWarning: "Ladder selected above ~3 m — confirm short-duration access only; consider MEWP or scaffold.",
  exclusionWarning: "Establish exclusion zone below work area.",
  rescueWarning: "MEWP / rope access — rescue plan reference required.",
  hierarchyAvoid: "Avoid",
  hierarchyAvoidSub: "Do work at ground level",
  hierarchyPrevent: "Prevent",
  hierarchyPreventSub: "Collective — guardrails, nets",
  hierarchyMitigate: "Mitigate",
  hierarchyMitigateSub: "PPE — harness, lanyard",
  hierarchyAria: "Work at height hierarchy",
  accessSvgTitle: "Access method — ladder only for short duration",
  ladderLabel: "Ladder",
  ladderSub: "Brief access",
  mewpLabel: "MEWP",
  scaffoldShort: "Scaffold",
  scaffoldSub: "Tag / handover",
  zoneWorkTitle: "WORK AT HEIGHT",
  zoneWorkSub: "Harness / edge protection",
  zoneExclusionTitle: "EXCLUSION ZONE",
  zoneExclusionSub: "No access — falling object risk",
};

const WAH_PL_FIELDS = {
  panelTitle: "Praca na wysokości",
  roofPanelTitle: "Wejście na dach / praca na wysokości",
  accessWidgetTitle: "Metoda dostępu",
  exclusionWidgetTitle: "Strefa wyłączona",
  accessEquipmentLabel: "Sprzęt dostępu / nr",
  accessEquipmentPlaceholder: "Drabina / podest / tabliczka rusztowania",
  hierarchyLevelLabel: "Poziom hierarchii BHP",
  selectLabel: "Wybierz…",
  yesLabel: "Tak",
  noLabel: "Nie",
  avoidOption: "Unikaj — poziom gruntu",
  preventOption: "Zapobiegaj — zbiorowe (barierki)",
  mitigateOption: "Ograniczaj — szelki / ŚOI",
  maxHeightLabel: "Maksymalna wysokość pracy (m)",
  exclusionLabel: "Strefa wyłączona pod robotami",
  harnessLabel: "Szelki / linka sprawdzone",
  rescuePlanLabel: "Numer planu ratowniczego",
  readyCopy: "Zapisano zabezpieczenia pracy na wysokości — IOR stanowiskowy jest wiążący.",
  printHeading: "Wytyczne pracy na wysokości",
  printAccessEquipment: "Sprzęt dostępu",
  printMaxHeight: "Maks. wysokość (m)",
  printControlLevel: "Poziom zabezpieczeń",
  printExclusion: "Strefa wyłączona",
  printHarness: "Szelki sprawdzone",
  printRescue: "Plan ratowniczy",
  printReady: "Zapisano zabezpieczenia pracy na wysokości.",
  heightWarning: "Zapisz poziom hierarchii (Unikaj / Zapobiegaj / Ograniczaj) dla pracy powyżej 2 m.",
  ladderWarning: "Drabina powyżej ~3 m — potwierdź krótki dostęp; rozważ podest lub rusztowanie.",
  exclusionWarning: "Wyznacz strefę wyłączoną pod stanowiskiem.",
  rescueWarning: "Podest / dostęp linowy — wymagany numer planu ratowniczego.",
  hierarchyAvoid: "Unikaj",
  hierarchyAvoidSub: "Praca na poziomie gruntu",
  hierarchyPrevent: "Zapobiegaj",
  hierarchyPreventSub: "Zbiorowe — barierki, siatki",
  hierarchyMitigate: "Ograniczaj",
  hierarchyMitigateSub: "ŚOI — szelki, linka",
  hierarchyAria: "Hierarchia pracy na wysokości",
  accessSvgTitle: "Metoda dostępu — drabina tylko na krótko",
  ladderLabel: "Drabina",
  ladderSub: "Krótki dostęp",
  mewpLabel: "Podest",
  scaffoldShort: "Rusztowanie",
  scaffoldSub: "Tabliczka / odbiór",
  zoneWorkTitle: "NA WYSOKOŚCI",
  zoneWorkSub: "Szelki / ochrona krawędzi",
  zoneExclusionTitle: "STREFA WYŁĄCZONA",
  zoneExclusionSub: "Zakaz wstępu — spadające przedmioty",
};

/** Field keys stay shared; ticket, statute names and field labels follow the active country workspace. */
export function wahGuidanceCopy(marketId = getOrgMarketId()) {
  if (marketId === "pl") {
    return {
      ...WAH_PL_FIELDS,
      hierarchyTitle: "Hierarchia — praca na wysokości (BHP)",
      hierarchyWidgetTitle: "Hierarchia BHP",
      mewpTicketShort: "UDT + ratownictwo",
      mewpWarning: "Podest ruchomy — potwierdź uprawnienia UDT i codzienną kontrolę przed użyciem.",
      scaffoldWarning: "Rusztowanie — potwierdź aktualny odbiór / tabliczkę dopuszczenia.",
      ipafLabel: "UDT / podest zweryfikowany",
      scaffoldLabel: "Tabliczka rusztowania aktualna",
      printIntro: "Wymagania BHP dotyczące pracy na wysokości. RAMS stanowiskowy jest wiążący.",
      printFooter: "BHP · praca na wysokości · plan ratowniczy",
      panelSubtitle: "BHP — Unikaj → Zapobiegaj → Ograniczaj skutki.",
      refHref: "https://www.pip.gov.pl/",
      refLabel: "PIP — praca na wysokości",
    };
  }
  if (marketId === "au") {
    return {
      ...WAH_EN_FIELDS,
      hierarchyTitle: "Hierarchy of control — WHS work at height",
      hierarchyWidgetTitle: "WHS hierarchy",
      mewpTicketShort: "EWPA + rescue",
      mewpWarning: "MEWP operation — confirm EWPA or HRWL ticket and daily pre-use check.",
      scaffoldWarning: "Scaffold — confirm current handover / inspection tag.",
      ipafLabel: "EWPA / HRWL verified",
      scaffoldLabel: "Scaffold tag current",
      printIntro: "WHS — managing the risk of falls. Site SWMS governs.",
      printFooter: "WHS · work at height · site rescue plan",
      panelSubtitle: "WHS — Avoid → Prevent → Mitigate.",
      refHref: "https://www.safeworkaustralia.gov.au/safety-topic/hazards/working-heights",
      refLabel: "Safe Work Australia — working at heights",
    };
  }
  return {
    ...WAH_EN_FIELDS,
    hierarchyTitle: "WAH hierarchy — Work at Height Regulations 2005",
    hierarchyWidgetTitle: "WAH hierarchy",
    mewpTicketShort: "IPAF + rescue",
    mewpWarning: "MEWP operation — confirm IPAF card and daily pre-use check.",
    scaffoldWarning: "Scaffold — confirm current handover / inspection tag (ScaffTag / SG4).",
    ipafLabel: "IPAF / MEWP verified",
    scaffoldLabel: "Scaffold tag current",
    printIntro: "Work at Height Regulations 2005 — hierarchy of control. Site RAMS governs.",
    printFooter: "WAH Regs 2005 · HSE work at height · site rescue plan",
    panelSubtitle: "WAH Regulations 2005 — Avoid → Prevent → Mitigate.",
    refHref: "https://www.hse.gov.uk/work-at-height/",
    refLabel: "HSE work at height",
  };
}

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

export function wahAssessment(extra = {}, marketId = getOrgMarketId()) {
  const warnings = [];
  const blockers = [];
  const copy = wahGuidanceCopy(marketId);
  const height = Number(extra.maxHeight || 0);
  const equipment = String(extra.accessEquipment || "").trim().toLowerCase();
  const control = String(extra.wahControlLevel || "").trim();
  const exclusion = String(extra.exclusionZoneConfirmed || "").toLowerCase();

  if (height >= 2 && !control) {
    warnings.push(copy.heightWarning);
  }
  if (equipment.includes("ladder") && height > 3) {
    warnings.push(copy.ladderWarning);
  }
  if ((equipment.includes("mewp") || equipment.includes("cherry")) && String(extra.ipafVerified || "").toLowerCase() !== "yes") {
    warnings.push(copy.mewpWarning);
  }
  if (equipment.includes("scaffold") && String(extra.scaffoldTagCurrent || "").toLowerCase() !== "yes") {
    warnings.push(copy.scaffoldWarning);
  }
  if (exclusion !== "yes") warnings.push(copy.exclusionWarning);
  if ((equipment.includes("mewp") || equipment.includes("rope")) && !String(extra.rescuePlan || "").trim()) {
    warnings.push(copy.rescueWarning);
  }

  return { warnings, blockers, height };
}

/** WAH hierarchy: Avoid → Prevent (collective) → Mitigate (PPE). */
export function renderWahHierarchySvg({ highlight = "", width = 400, height = 100, marketId } = {}) {
  const copy = wahGuidanceCopy(marketId);
  const steps = [
    { id: "avoid", label: copy.hierarchyAvoid, sub: copy.hierarchyAvoidSub, fill: "#dcfce7", stroke: "#16a34a" },
    { id: "prevent", label: copy.hierarchyPrevent, sub: copy.hierarchyPreventSub, fill: "#dbeafe", stroke: "#2563eb" },
    { id: "mitigate", label: copy.hierarchyMitigate, sub: copy.hierarchyMitigateSub, fill: "#fef3c7", stroke: "#d97706" },
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="${copy.hierarchyAria}">
    <text x="8" y="12" font-size="10" font-weight="700" fill="#854F0B">${copy.hierarchyTitle}</text>
    ${rects}
  </svg>`;
}

/** Ladder vs MEWP vs scaffold decision strip. */
export function renderWahAccessChoiceSvg({ equipment = "", width = 420, height = 64, marketId } = {}) {
  const eq = String(equipment || "").toLowerCase();
  const copy = wahGuidanceCopy(marketId);
  const pick = (token) => (eq.includes(token) ? "#166534" : "#64748b");
  const fill = (token) => (eq.includes(token) ? "#dcfce7" : "#f1f5f9");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="${copy.accessWidgetTitle}">
    <text x="8" y="12" font-size="9" font-weight="700" fill="#0f172a">${copy.accessSvgTitle}</text>
    <rect x="8" y="20" width="120" height="36" rx="5" fill="${fill("ladder")}" stroke="${pick("ladder")}"/>
    <text x="68" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">${copy.ladderLabel}</text>
    <text x="68" y="48" text-anchor="middle" font-size="7" fill="#64748b">${copy.ladderSub}</text>
    <rect x="150" y="20" width="120" height="36" rx="5" fill="${fill("mewp")}" stroke="${pick("mewp")}"/>
    <text x="210" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">${copy.mewpLabel}</text>
    <text x="210" y="48" text-anchor="middle" font-size="7" fill="#64748b">${copy.mewpTicketShort}</text>
    <rect x="292" y="20" width="120" height="36" rx="5" fill="${fill("scaffold")}" stroke="${pick("scaffold")}"/>
    <text x="352" y="36" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">${copy.scaffoldShort}</text>
    <text x="352" y="48" text-anchor="middle" font-size="7" fill="#64748b">${copy.scaffoldSub}</text>
  </svg>`;
}

/** Exclusion zone under work area. */
export function renderWahExclusionZoneSvg({ width = 280, height = 100, marketId } = {}) {
  const copy = wahGuidanceCopy(marketId);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="${copy.exclusionWidgetTitle}">
    <rect x="0" y="0" width="${width}" height="45" fill="#fef3c7" stroke="#d97706" stroke-dasharray="4 2"/>
    <text x="${width / 2}" y="18" text-anchor="middle" font-size="9" font-weight="700" fill="#92400e">${copy.zoneWorkTitle}</text>
    <text x="${width / 2}" y="32" text-anchor="middle" font-size="8" fill="#78350f">${copy.zoneWorkSub}</text>
    <rect x="20" y="50" width="${width - 40}" height="40" fill="#fee2e2" stroke="#dc2626"/>
    <text x="${width / 2}" y="68" text-anchor="middle" font-size="9" font-weight="700" fill="#991b1b">${copy.zoneExclusionTitle}</text>
    <text x="${width / 2}" y="82" text-anchor="middle" font-size="8" fill="#7f1d1d">${copy.zoneExclusionSub}</text>
  </svg>`;
}

export function renderWahPrintHtml(permit, { primaryColor = "#854F0B", marketId } = {}) {
  if (!isWahPermitType(permit?.type)) return "";
  const extra = permit?.extraFields || {};
  const market = marketId || getOrgMarketId();
  const copy = wahGuidanceCopy(market);
  const assessment = wahAssessment(extra, market);
  const control = String(extra.wahControlLevel || "").toLowerCase();

  const fieldsHtml = [
    [copy.printAccessEquipment, extra.accessEquipment || "—"],
    [copy.printMaxHeight, extra.maxHeight || "—"],
    [copy.printControlLevel, extra.wahControlLevel || "—"],
    [copy.printExclusion, extra.exclusionZoneConfirmed || "—"],
    [copy.ipafLabel, extra.ipafVerified || "—"],
    [copy.scaffoldLabel, extra.scaffoldTagCurrent || "—"],
    [copy.printHarness, extra.harnessInspected || "—"],
    [copy.printRescue, extra.rescuePlan || "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;color:#666;width:40%">${k}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${String(v).replace(/</g, "&lt;")}</td></tr>`
    )
    .join("");

  const warnHtml =
    assessment.warnings.length > 0
      ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:10px;color:#92400e">${assessment.warnings.map((w) => `<li>${String(w).replace(/</g, "&lt;")}</li>`).join("")}</ul>`
      : `<p style="margin:6px 0 0;font-size:10px;color:#166534">${copy.printReady}</p>`;

  return `
  <h2 style="border-left-color:${primaryColor}">${copy.printHeading}</h2>
  <p style="font-size:10px;color:#64748b;margin:0 0 8px">${copy.printIntro}</p>
  <div style="margin-bottom:8px">${renderWahHierarchySvg({ highlight: control, width: 460, marketId: market })}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>${renderWahAccessChoiceSvg({ equipment: extra.accessEquipment, width: 340, marketId: market })}</div>
    <div>${renderWahExclusionZoneSvg({ width: 280, marketId: market })}</div>
  </div>
  <table style="margin-bottom:8px"><tbody>${fieldsHtml}</tbody></table>
  ${warnHtml}
  <p style="font-size:9px;color:#64748b;margin-top:8px">${copy.printFooter}</p>`;
}
