/**
 * Hot work permit guidance — fire watch and 10 m zone (illustrative).
 * UK copy cites HSE / Fire Safety Order; PL/AU keep the widgets with local statute names.
 */

import { getOrgMarketId } from "../../../utils/orgMarket";

export const HOT_WORK_PERMIT_TYPES = new Set(["hot_work"]);

const HOT_WORK_EN_FIELDS = {
  panelTitle: "Hot work controls",
  zoneTitle: "10 m zone",
  goTitle: "GO / NO-GO",
  timelineTitle: "Fire watch timeline",
  printHeading: "Hot work guidance",
  equipmentLabel: "Equipment to be used",
  equipmentPlaceholder: "Welder, grinder, torch…",
  fireWatcherLabel: "Fire watcher name",
  fireWatchDurationLabel: "Fire watch duration (min)",
  postInspectionLabel: "Post-work inspection time",
  combustiblesLabel: "10 m combustibles cleared",
  openingsLabel: "Openings / ducts sealed",
  extinguishersLabel: "2 × extinguishers in place",
  fireBlanketLabel: "Fire blanket in place",
  alarmLabel: "Fire alarm isolated",
  ventilationLabel: "Ventilation confirmed",
  postWatchLabel: "Post-watch signed off",
  selectLabel: "Select…",
  yesLabel: "Yes",
  noLabel: "No",
  naLabel: "N/A",
  nominateWatcher: "Nominate a fire watch person before issue.",
  combustiblesWarning: "Confirm combustible materials cleared within 10 m of hot work.",
  openingsWarning: "Confirm drains, ducts and openings sealed against spark entry.",
  extinguishersWarning: "Confirm 2 × fire extinguishers in position.",
  blanketWarning: "Confirm fire blanket available at work face.",
  alarmWarning: "Confirm fire alarm isolation authorised (or N/A with justification).",
  closureSignOffWarning: "Post-work fire watch sign-off not recorded on closure.",
  printControlsRecorded: "Hot work controls recorded — maintain fire watch after work stops.",
  qualityRecFireWatch: "Hot work: confirm fire watch details and post-work inspection.",
  qualityRecFireControls: "Hot work: add extinguisher/fire blanket controls in notes.",
  qualityAutofixFireControls: "Fire controls: 2x extinguishers and fire blanket in place.",
  fireControlNeedles: ["extinguisher", "fire blanket"],
  checklistFireWatchNeedles: ["fire watch"],
  zoneSvgTitle: "10 m hot work zone — clear combustibles & seal openings",
  zoneSvgAria: "Hot work 10 metre zone",
  zoneHotWorkMark: "HOT WORK",
  zoneCombustibles: "Combustibles out",
  zoneOpenings: "Openings sealed",
  timelineHotWork: "Hot work",
  timelineSparks: "Sparks / heat",
  timelineWatch: "Fire watch",
  timelineAfterWork: (mins) => `Min ${mins} min after work`,
  timelineSignOff: "Sign-off",
  timelineIssuer: "Issuer / fire watch",
  timelineStay: "Do not leave site until watch period complete",
  goReadyTitle: "GO — controls in place",
  goBlockedTitle: "NO-GO — complete checklist",
  goCombustibles: "10 m combustibles clear",
  goOpenings: "Openings sealed",
  goExtinguishers: "2 × extinguishers",
  goBlanket: "Fire blanket",
  goAlarm: "Alarm isolated / N/A",
  goVentilation: "Ventilation OK",
  durationHoursWarning: (hours, cap) =>
    `Permit duration ${hours} h exceeds typical ${cap} h hot work limit — split shift or re-authorise.`,
  maxHoursWarning: (maxHours, cap) =>
    `Stated max permit hours (${maxHours}) exceeds typical ${cap} h client cap.`,
};

const HOT_WORK_PL_FIELDS = {
  panelTitle: "Zabezpieczenia prac gorących",
  zoneTitle: "Strefa 10 m",
  goTitle: "GO / NO-GO",
  timelineTitle: "Oś czasu dyżuru pożarowego",
  printHeading: "Wytyczne prac gorących",
  equipmentLabel: "Sprzęt do użycia",
  equipmentPlaceholder: "Spawarka, szlifierka, palnik…",
  fireWatcherLabel: "Osoba na dyżurze pożarowym",
  fireWatchDurationLabel: "Czas dyżuru pożarowego (min)",
  postInspectionLabel: "Czas inspekcji po pracy",
  combustiblesLabel: "Materiały palne usunięte w promieniu 10 m",
  openingsLabel: "Otwory / kanały uszczelnione",
  extinguishersLabel: "2 × gaśnice na stanowisku",
  fireBlanketLabel: "Koc gaśniczy na stanowisku",
  alarmLabel: "Sygnalizacja pożaru odizolowana",
  ventilationLabel: "Wentylacja potwierdzona",
  postWatchLabel: "Dyżur pożarowy podpisany",
  selectLabel: "Wybierz…",
  yesLabel: "Tak",
  noLabel: "Nie",
  naLabel: "N/D",
  nominateWatcher: "Wyznacz osobę na dyżur pożarowy przed wydaniem pozwolenia.",
  combustiblesWarning: "Potwierdź usunięcie materiałów palnych w promieniu 10 m od prac gorących.",
  openingsWarning: "Potwierdź uszczelnienie wpustów, kanałów i otworów przed iskrami.",
  extinguishersWarning: "Potwierdź 2 × gaśnice na stanowisku.",
  blanketWarning: "Potwierdź koc gaśniczy przy froncie robót.",
  alarmWarning: "Potwierdź autoryzowane odizolowanie sygnalizacji pożaru (lub N/D z uzasadnieniem).",
  closureSignOffWarning: "Brak podpisu dyżuru pożarowego po zakończeniu prac.",
  printControlsRecorded: "Zapisano zabezpieczenia prac gorących — utrzymaj dyżur pożarowy po zakończeniu prac.",
  qualityRecFireWatch: "Prace gorące: potwierdź szczegóły dyżuru pożarowego i inspekcji po pracy.",
  qualityRecFireControls: "Prace gorące: dopisz gaśnice / koc gaśniczy w uwagach.",
  qualityAutofixFireControls: "Zabezpieczenia ppoż.: 2× gaśnice i koc gaśniczy na stanowisku.",
  fireControlNeedles: ["extinguisher", "fire blanket", "gaśnic", "koc gaśniczy"],
  checklistFireWatchNeedles: ["dyżur pożarowy", "dyżurze pożarowym", "fire watch"],
  zoneSvgTitle: "Strefa 10 m prac gorących — usuń materiały palne i uszczelnij otwory",
  zoneSvgAria: "Strefa 10 m prac gorących",
  zoneHotWorkMark: "PRACE GORĄCE",
  zoneCombustibles: "Materiały palne",
  zoneOpenings: "Otwory uszczelnione",
  timelineHotWork: "Prace gorące",
  timelineSparks: "Iskry / ciepło",
  timelineWatch: "Dyżur pożarowy",
  timelineAfterWork: (mins) => `Min. ${mins} min po pracy`,
  timelineSignOff: "Podpis",
  timelineIssuer: "Wydający / dyżur",
  timelineStay: "Nie opuszczaj stanowiska przed końcem dyżuru",
  goReadyTitle: "GO — zabezpieczenia na miejscu",
  goBlockedTitle: "NO-GO — uzupełnij listę",
  goCombustibles: "Materiały palne 10 m",
  goOpenings: "Otwory uszczelnione",
  goExtinguishers: "2 × gaśnice",
  goBlanket: "Koc gaśniczy",
  goAlarm: "Sygnalizacja odizolowana / N/D",
  goVentilation: "Wentylacja OK",
  durationHoursWarning: (hours, cap) =>
    `Czas pozwolenia ${hours} h przekracza typowy limit ${cap} h na prace gorące — podziel zmianę lub ponów autoryzację.`,
  maxHoursWarning: (maxHours, cap) =>
    `Podany maksymalny czas pozwolenia (${maxHours} h) przekracza typowy limit klienta ${cap} h.`,
};

/** Field keys stay shared; labels and authority names follow the active country workspace. */
export function hotWorkGuidanceCopy(marketId = getOrgMarketId()) {
  if (marketId === "pl") {
    return {
      ...HOT_WORK_PL_FIELDS,
      panelSubtitle: `Strefa 10 m, dyżur pożarowy min. ${DEFAULT_FIRE_WATCH_MINS} min po pracy, typowy limit ${MAX_HOT_WORK_HOURS} h pozwolenia.`,
      refHref: "https://www.pip.gov.pl/",
      refLabel: "PIP — prace gorące",
      printIntro: `Prace gorące — wymagania BHP. Typowa reguła: minimum ${DEFAULT_FIRE_WATCH_MINS} min dyżuru pożarowego po pracy; max ${MAX_HOT_WORK_HOURS} h pozwolenia.`,
      printFooter: "BHP · prace gorące · plan ochrony przeciwpożarowej",
      durationBlocker: `Dyżur pożarowy po pracy musi trwać co najmniej ${DEFAULT_FIRE_WATCH_MINS} minut (typowa reguła BHP / klienta).`,
      goFooter: "IOR / plan ppoż. stanowiska jest wiążący — wytyczne BHP",
      zoneRule: "Minimalny odstęp 10 m (typowa reguła BHP)",
      readyCopy: "GO — zapisano zabezpieczenia prac gorących. Utrzymaj dyżur pożarowy po zakończeniu prac.",
    };
  }
  if (marketId === "au") {
    return {
      ...HOT_WORK_EN_FIELDS,
      panelSubtitle: `10 m zone clearance, fire watch min ${DEFAULT_FIRE_WATCH_MINS} min post-work, typical ${MAX_HOT_WORK_HOURS} h permit cap.`,
      refHref: "https://www.safeworkaustralia.gov.au/doc/model-code-practice-welding-processes",
      refLabel: "Safe Work Australia — welding processes",
      printIntro: `WHS hot work practice. Typical client rule: minimum ${DEFAULT_FIRE_WATCH_MINS} min post-work fire watch; max ${MAX_HOT_WORK_HOURS} h permit.`,
      printFooter: "WHS · welding / hot work · site fire plan",
      durationBlocker: `Post-work fire watch must be at least ${DEFAULT_FIRE_WATCH_MINS} minutes (WHS / typical client rule).`,
      goFooter: "Site SWMS & fire plan govern — WHS hot work guidance",
      zoneRule: "Minimum 10 m clearance (typical site rule)",
      readyCopy: "GO — hot work controls recorded. Maintain fire watch after work stops.",
    };
  }
  return {
    ...HOT_WORK_EN_FIELDS,
    panelSubtitle: `10 m zone clearance, fire watch min ${DEFAULT_FIRE_WATCH_MINS} min post-work, typical ${MAX_HOT_WORK_HOURS} h permit cap.`,
    refHref: "https://www.hse.gov.uk/fireandexplosion/hot-work.htm",
    refLabel: "HSE hot work",
    printIntro: `UK HSE hot work practice. Typical client rule: minimum ${DEFAULT_FIRE_WATCH_MINS} min post-work fire watch; max ${MAX_HOT_WORK_HOURS} h permit.`,
    printFooter: "HSE hot work · Fire Safety Order · site fire plan",
    durationBlocker: `Post-work fire watch must be at least ${DEFAULT_FIRE_WATCH_MINS} minutes (HSE / typical client rule).`,
    goFooter: "Site RAMS & fire plan govern — HSE hot work guidance",
    zoneRule: "Minimum 10 m clearance (typical UK site rule)",
    readyCopy: "GO — hot work controls recorded. Maintain fire watch after work stops.",
  };
}

export const HOT_WORK_EXTRA_FIELD_KEYS = [
  "equipment",
  "fireWatcher",
  "fireWatchDurationMins",
  "postInspectionTime",
  "postWorkWatchSignedOff",
  "combustiblesCleared10m",
  "openingsSealed",
  "extinguishersInPlace",
  "fireBlanketInPlace",
  "alarmIsolated",
  "ventilationConfirmed",
  "maxPermitHours",
];

export const DEFAULT_FIRE_WATCH_MINS = 60;
export const MAX_HOT_WORK_HOURS = 8;

export function isHotWorkPermitType(type) {
  return HOT_WORK_PERMIT_TYPES.has(String(type || "").trim());
}

export function hotWorkAssessment(extra = {}, permit = {}, marketId = getOrgMarketId()) {
  const warnings = [];
  const blockers = [];
  const copy = hotWorkGuidanceCopy(marketId);

  const fireWatcher = String(extra.fireWatcher || "").trim();
  const duration = Number(extra.fireWatchDurationMins || DEFAULT_FIRE_WATCH_MINS);
  const combustibles = String(extra.combustiblesCleared10m || "").toLowerCase();
  const openings = String(extra.openingsSealed || "").toLowerCase();
  const extinguishers = String(extra.extinguishersInPlace || "").toLowerCase();
  const blanket = String(extra.fireBlanketInPlace || "").toLowerCase();
  const alarm = String(extra.alarmIsolated || "").toLowerCase();
  const signedOff = String(extra.postWorkWatchSignedOff || "").toLowerCase();

  if (!fireWatcher) warnings.push(copy.nominateWatcher);
  if (!duration || duration < DEFAULT_FIRE_WATCH_MINS) {
    blockers.push(copy.durationBlocker);
  }
  if (combustibles !== "yes") warnings.push(copy.combustiblesWarning);
  if (openings !== "yes") warnings.push(copy.openingsWarning);
  if (extinguishers !== "yes") warnings.push(copy.extinguishersWarning);
  if (blanket !== "yes") warnings.push(copy.blanketWarning);
  if (alarm !== "yes" && alarm !== "na") warnings.push(copy.alarmWarning);

  const start = permit?.startDateTime ? new Date(permit.startDateTime) : null;
  const end = permit?.endDateTime ? new Date(permit.endDateTime) : null;
  if (start && end && !Number.isNaN(start) && !Number.isNaN(end)) {
    const hours = (end - start) / (1000 * 60 * 60);
    if (hours > MAX_HOT_WORK_HOURS) {
      warnings.push(copy.durationHoursWarning(hours.toFixed(1), MAX_HOT_WORK_HOURS));
    }
  }

  const maxHours = Number(extra.maxPermitHours || MAX_HOT_WORK_HOURS);
  if (maxHours > MAX_HOT_WORK_HOURS) {
    warnings.push(copy.maxHoursWarning(maxHours, MAX_HOT_WORK_HOURS));
  }

  if (permit?.status === "closed" && signedOff !== "yes") {
    warnings.push(copy.closureSignOffWarning);
  }

  const goItems = [
    combustibles === "yes",
    openings === "yes",
    extinguishers === "yes",
    blanket === "yes",
    alarm === "yes" || alarm === "na",
    Boolean(fireWatcher),
    duration >= DEFAULT_FIRE_WATCH_MINS,
  ];
  const goScore = goItems.filter(Boolean).length;

  return {
    warnings,
    blockers,
    fireWatchDurationMins: duration || DEFAULT_FIRE_WATCH_MINS,
    goScore,
    goTotal: goItems.length,
    ready: blockers.length === 0 && goScore === goItems.length,
  };
}

function svgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 10 m clearance zone — combustibles and openings. */
export function renderHotWorkZoneSvg({ width = 400, height = 130, marketId } = {}) {
  const copy = hotWorkGuidanceCopy(marketId);
  const cx = width * 0.5;
  const cy = height * 0.55;
  const r = Math.min(width, height) * 0.38;
  const markWidth = Math.max(56, String(copy.zoneHotWorkMark || "").length * 7);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="${svgText(copy.zoneSvgAria)}">
    <text x="8" y="14" font-size="10" font-weight="700" fill="#991b1b">${svgText(copy.zoneSvgTitle)}</text>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fef2f2" stroke="#dc2626" stroke-width="2" stroke-dasharray="6 4"/>
    <rect x="${cx - markWidth / 2}" y="${cy - 18}" width="${markWidth}" height="36" rx="4" fill="#fee2e2" stroke="#b91c1c" stroke-width="2"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9" font-weight="700" fill="#7f1d1d">${svgText(copy.zoneHotWorkMark)}</text>
    <text x="14" y="${cy - 8}" font-size="8" fill="#92400e">${svgText(copy.zoneCombustibles)}</text>
    <text x="${width - 14}" y="${cy - 8}" text-anchor="end" font-size="8" fill="#92400e">${svgText(copy.zoneOpenings)}</text>
    <text x="${cx}" y="${height - 8}" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">${svgText(copy.zoneRule)}</text>
  </svg>`;
}

/** Fire watch timeline: work → post-watch → sign-off. */
export function renderFireWatchTimelineSvg({ durationMins = DEFAULT_FIRE_WATCH_MINS, width = 480, height = 72, marketId } = {}) {
  const copy = hotWorkGuidanceCopy(marketId);
  const mins = Math.max(Number(durationMins) || DEFAULT_FIRE_WATCH_MINS, DEFAULT_FIRE_WATCH_MINS);
  const w1 = width * 0.32;
  const w2 = width * 0.36;
  const w3 = width * 0.28;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="${svgText(copy.timelineTitle)}">
    <text x="8" y="12" font-size="10" font-weight="700" fill="#991b1b">${svgText(copy.timelineTitle)}</text>
    <rect x="8" y="22" width="${w1}" height="36" rx="5" fill="#fecaca" stroke="#dc2626"/>
    <text x="${8 + w1 / 2}" y="38" text-anchor="middle" font-size="9" font-weight="700" fill="#7f1d1d">${svgText(copy.timelineHotWork)}</text>
    <text x="${8 + w1 / 2}" y="50" text-anchor="middle" font-size="7" fill="#991b1b">${svgText(copy.timelineSparks)}</text>
    <polygon points="${8 + w1},40 ${8 + w1 + 10},40 ${8 + w1 + 10},34 ${8 + w1 + 18},42 ${8 + w1 + 10},50 ${8 + w1 + 10},44 ${8 + w1},44" fill="#64748b"/>
    <rect x="${8 + w1 + 18}" y="22" width="${w2}" height="36" rx="5" fill="#fde68a" stroke="#d97706" stroke-width="2"/>
    <text x="${8 + w1 + 18 + w2 / 2}" y="36" text-anchor="middle" font-size="9" font-weight="700" fill="#92400e">${svgText(copy.timelineWatch)}</text>
    <text x="${8 + w1 + 18 + w2 / 2}" y="50" text-anchor="middle" font-size="8" fill="#78350f">${svgText(copy.timelineAfterWork(mins))}</text>
    <polygon points="${8 + w1 + 18 + w2},40 ${8 + w1 + 18 + w2 + 10},40 ${8 + w1 + 18 + w2 + 10},34 ${8 + w1 + 18 + w2 + 18},42 ${8 + w1 + 18 + w2 + 10},50 ${8 + w1 + 18 + w2 + 10},44 ${8 + w1 + 18 + w2},44" fill="#64748b"/>
    <rect x="${8 + w1 + 18 + w2 + 18}" y="22" width="${w3 - 26}" height="36" rx="5" fill="#bbf7d0" stroke="#16a34a"/>
    <text x="${8 + w1 + 18 + w2 + 18 + (w3 - 26) / 2}" y="38" text-anchor="middle" font-size="9" font-weight="700" fill="#14532d">${svgText(copy.timelineSignOff)}</text>
    <text x="${8 + w1 + 18 + w2 + 18 + (w3 - 26) / 2}" y="50" text-anchor="middle" font-size="7" fill="#166534">${svgText(copy.timelineIssuer)}</text>
    <text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-size="8" fill="#64748b">${svgText(copy.timelineStay)}</text>
  </svg>`;
}

/** GO / NO-GO readiness card from extra field states. */
export function renderHotWorkGoNoGoSvg(extra = {}, { width = 340, height = 118, marketId } = {}) {
  const copy = hotWorkGuidanceCopy(marketId);
  const checks = [
    { key: "combustiblesCleared10m", label: copy.goCombustibles, ok: String(extra.combustiblesCleared10m || "").toLowerCase() === "yes" },
    { key: "openingsSealed", label: copy.goOpenings, ok: String(extra.openingsSealed || "").toLowerCase() === "yes" },
    { key: "extinguishersInPlace", label: copy.goExtinguishers, ok: String(extra.extinguishersInPlace || "").toLowerCase() === "yes" },
    { key: "fireBlanketInPlace", label: copy.goBlanket, ok: String(extra.fireBlanketInPlace || "").toLowerCase() === "yes" },
    { key: "alarmIsolated", label: copy.goAlarm, ok: ["yes", "na"].includes(String(extra.alarmIsolated || "").toLowerCase()) },
    { key: "ventilationConfirmed", label: copy.goVentilation, ok: String(extra.ventilationConfirmed || "").toLowerCase() === "yes" },
  ];
  const pass = checks.filter((c) => c.ok).length;
  const go = pass === checks.length && String(extra.fireWatcher || "").trim();
  const bg = go ? "#f0fdf4" : "#fef2f2";
  const stroke = go ? "#16a34a" : "#dc2626";
  const title = go ? copy.goReadyTitle : copy.goBlockedTitle;
  const titleFill = go ? "#14532d" : "#991b1b";
  const rows = checks
    .map((c, i) => {
      const y = 36 + i * 12;
      const mark = c.ok ? "✓" : "○";
      const fill = c.ok ? "#166534" : "#94a3b8";
      return `<text x="16" y="${y}" font-size="8" fill="${fill}">${mark} ${svgText(c.label)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Hot work go no go">
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${bg}" stroke="${stroke}" stroke-width="2"/>
    <text x="${width / 2}" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="${titleFill}">${svgText(title)}</text>
    <text x="${width - 12}" y="18" text-anchor="end" font-size="9" fill="#64748b">${pass}/${checks.length}</text>
    ${rows}
    <text x="${width / 2}" y="${height - 6}" text-anchor="middle" font-size="7" fill="#64748b">${svgText(copy.goFooter)}</text>
  </svg>`;
}

export function renderHotWorkPrintHtml(permit, { primaryColor = "#E24B4A", marketId } = {}) {
  if (!isHotWorkPermitType(permit?.type)) return "";
  const extra = permit?.extraFields || {};
  const market = marketId || getOrgMarketId();
  const copy = hotWorkGuidanceCopy(market);
  const assessment = hotWorkAssessment(extra, permit, market);

  const fieldsHtml = [
    [copy.equipmentLabel, extra.equipment || "—"],
    [copy.fireWatcherLabel, extra.fireWatcher || "—"],
    [copy.fireWatchDurationLabel, extra.fireWatchDurationMins || assessment.fireWatchDurationMins],
    [copy.postInspectionLabel, extra.postInspectionTime || "—"],
    [copy.postWatchLabel, extra.postWorkWatchSignedOff || "—"],
    [copy.combustiblesLabel, extra.combustiblesCleared10m || "—"],
    [copy.openingsLabel, extra.openingsSealed || "—"],
    [copy.extinguishersLabel, extra.extinguishersInPlace || "—"],
    [copy.fireBlanketLabel, extra.fireBlanketInPlace || "—"],
    [copy.alarmLabel, extra.alarmIsolated || "—"],
    [copy.ventilationLabel, extra.ventilationConfirmed || "—"],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;color:#666;width:42%">${k}</td><td style="padding:4px 8px;border:1px solid #ddd;font-size:11px">${String(v).replace(/</g, "&lt;")}</td></tr>`
    )
    .join("");

  const warnHtml =
    assessment.blockers.length || assessment.warnings.length
      ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:10px;color:#991b1b">${[...assessment.blockers, ...assessment.warnings]
          .map((w) => `<li>${String(w).replace(/</g, "&lt;")}</li>`)
          .join("")}</ul>`
      : `<p style="margin:6px 0 0;font-size:10px;color:#166534">${copy.printControlsRecorded.replace(/</g, "&lt;")}</p>`;

  return `
  <h2 style="border-left-color:${primaryColor}">${copy.printHeading}</h2>
  <p style="font-size:10px;color:#64748b;margin:0 0 8px">${copy.printIntro}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>${renderHotWorkZoneSvg({ width: 320, marketId: market })}</div>
    <div>${renderHotWorkGoNoGoSvg(extra, { width: 320, marketId: market })}</div>
  </div>
  <div style="margin-bottom:10px">${renderFireWatchTimelineSvg({ durationMins: assessment.fireWatchDurationMins, width: 480, marketId: market })}</div>
  <table style="margin-bottom:8px"><tbody>${fieldsHtml}</tbody></table>
  ${warnHtml}
  <p style="font-size:9px;color:#64748b;margin-top:8px">${copy.printFooter}</p>`;
}
