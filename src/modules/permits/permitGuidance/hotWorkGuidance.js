/**
 * UK hot work permit guidance — HSE hot work, typical client fire watch requirements.
 * Illustrative — site RAMS and fire plan govern on site.
 */

export const HOT_WORK_PERMIT_TYPES = new Set(["hot_work"]);

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

export function hotWorkAssessment(extra = {}, permit = {}) {
  const warnings = [];
  const blockers = [];

  const fireWatcher = String(extra.fireWatcher || "").trim();
  const duration = Number(extra.fireWatchDurationMins || DEFAULT_FIRE_WATCH_MINS);
  const combustibles = String(extra.combustiblesCleared10m || "").toLowerCase();
  const openings = String(extra.openingsSealed || "").toLowerCase();
  const extinguishers = String(extra.extinguishersInPlace || "").toLowerCase();
  const blanket = String(extra.fireBlanketInPlace || "").toLowerCase();
  const alarm = String(extra.alarmIsolated || "").toLowerCase();
  const signedOff = String(extra.postWorkWatchSignedOff || "").toLowerCase();

  if (!fireWatcher) warnings.push("Nominate a fire watch person before issue.");
  if (!duration || duration < DEFAULT_FIRE_WATCH_MINS) {
    blockers.push(`Post-work fire watch must be at least ${DEFAULT_FIRE_WATCH_MINS} minutes (HSE / typical client rule).`);
  }
  if (combustibles !== "yes") warnings.push("Confirm combustible materials cleared within 10 m of hot work.");
  if (openings !== "yes") warnings.push("Confirm drains, ducts and openings sealed against spark entry.");
  if (extinguishers !== "yes") warnings.push("Confirm 2 × fire extinguishers in position.");
  if (blanket !== "yes") warnings.push("Confirm fire blanket available at work face.");
  if (alarm !== "yes" && alarm !== "na") warnings.push("Confirm fire alarm isolation authorised (or N/A with justification).");

  const start = permit?.startDateTime ? new Date(permit.startDateTime) : null;
  const end = permit?.endDateTime ? new Date(permit.endDateTime) : null;
  if (start && end && !Number.isNaN(start) && !Number.isNaN(end)) {
    const hours = (end - start) / (1000 * 60 * 60);
    if (hours > MAX_HOT_WORK_HOURS) {
      warnings.push(`Permit duration ${hours.toFixed(1)} h exceeds typical ${MAX_HOT_WORK_HOURS} h hot work limit — split shift or re-authorise.`);
    }
  }

  const maxHours = Number(extra.maxPermitHours || MAX_HOT_WORK_HOURS);
  if (maxHours > MAX_HOT_WORK_HOURS) {
    warnings.push(`Stated max permit hours (${maxHours}) exceeds typical ${MAX_HOT_WORK_HOURS} h client cap.`);
  }

  if (permit?.status === "closed" && signedOff !== "yes") {
    warnings.push("Post-work fire watch sign-off not recorded on closure.");
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

/** 10 m clearance zone — combustibles and openings. */
export function renderHotWorkZoneSvg({ width = 400, height = 130 } = {}) {
  const cx = width * 0.5;
  const cy = height * 0.55;
  const r = Math.min(width, height) * 0.38;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Hot work 10 metre zone">
    <text x="8" y="14" font-size="10" font-weight="700" fill="#991b1b">10 m hot work zone — clear combustibles &amp; seal openings</text>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fef2f2" stroke="#dc2626" stroke-width="2" stroke-dasharray="6 4"/>
    <rect x="${cx - 28}" y="${cy - 18}" width="56" height="36" rx="4" fill="#fee2e2" stroke="#b91c1c" stroke-width="2"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9" font-weight="700" fill="#7f1d1d">HOT WORK</text>
    <text x="14" y="${cy - 8}" font-size="8" fill="#92400e">Combustibles out</text>
    <text x="${width - 14}" y="${cy - 8}" text-anchor="end" font-size="8" fill="#92400e">Openings sealed</text>
    <text x="${cx}" y="${height - 8}" text-anchor="middle" font-size="9" font-weight="600" fill="#0f172a">Minimum 10 m clearance (typical UK site rule)</text>
  </svg>`;
}

/** Fire watch timeline: work → post-watch → sign-off. */
export function renderFireWatchTimelineSvg({ durationMins = DEFAULT_FIRE_WATCH_MINS, width = 480, height = 72 } = {}) {
  const mins = Math.max(Number(durationMins) || DEFAULT_FIRE_WATCH_MINS, DEFAULT_FIRE_WATCH_MINS);
  const w1 = width * 0.32;
  const w2 = width * 0.36;
  const w3 = width * 0.28;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Fire watch timeline">
    <text x="8" y="12" font-size="10" font-weight="700" fill="#991b1b">Fire watch timeline</text>
    <rect x="8" y="22" width="${w1}" height="36" rx="5" fill="#fecaca" stroke="#dc2626"/>
    <text x="${8 + w1 / 2}" y="38" text-anchor="middle" font-size="9" font-weight="700" fill="#7f1d1d">Hot work</text>
    <text x="${8 + w1 / 2}" y="50" text-anchor="middle" font-size="7" fill="#991b1b">Sparks / heat</text>
    <polygon points="${8 + w1},40 ${8 + w1 + 10},40 ${8 + w1 + 10},34 ${8 + w1 + 18},42 ${8 + w1 + 10},50 ${8 + w1 + 10},44 ${8 + w1},44" fill="#64748b"/>
    <rect x="${8 + w1 + 18}" y="22" width="${w2}" height="36" rx="5" fill="#fde68a" stroke="#d97706" stroke-width="2"/>
    <text x="${8 + w1 + 18 + w2 / 2}" y="36" text-anchor="middle" font-size="9" font-weight="700" fill="#92400e">Fire watch</text>
    <text x="${8 + w1 + 18 + w2 / 2}" y="50" text-anchor="middle" font-size="8" fill="#78350f">Min ${mins} min after work</text>
    <polygon points="${8 + w1 + 18 + w2},40 ${8 + w1 + 18 + w2 + 10},40 ${8 + w1 + 18 + w2 + 10},34 ${8 + w1 + 18 + w2 + 18},42 ${8 + w1 + 18 + w2 + 10},50 ${8 + w1 + 18 + w2 + 10},44 ${8 + w1 + 18 + w2},44" fill="#64748b"/>
    <rect x="${8 + w1 + 18 + w2 + 18}" y="22" width="${w3 - 26}" height="36" rx="5" fill="#bbf7d0" stroke="#16a34a"/>
    <text x="${8 + w1 + 18 + w2 + 18 + (w3 - 26) / 2}" y="38" text-anchor="middle" font-size="9" font-weight="700" fill="#14532d">Sign-off</text>
    <text x="${8 + w1 + 18 + w2 + 18 + (w3 - 26) / 2}" y="50" text-anchor="middle" font-size="7" fill="#166534">Issuer / fire watch</text>
    <text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-size="8" fill="#64748b">Do not leave site until watch period complete</text>
  </svg>`;
}

/** GO / NO-GO readiness card from extra field states. */
export function renderHotWorkGoNoGoSvg(extra = {}, { width = 340, height = 118 } = {}) {
  const checks = [
    { key: "combustiblesCleared10m", label: "10 m combustibles clear", ok: String(extra.combustiblesCleared10m || "").toLowerCase() === "yes" },
    { key: "openingsSealed", label: "Openings sealed", ok: String(extra.openingsSealed || "").toLowerCase() === "yes" },
    { key: "extinguishersInPlace", label: "2 × extinguishers", ok: String(extra.extinguishersInPlace || "").toLowerCase() === "yes" },
    { key: "fireBlanketInPlace", label: "Fire blanket", ok: String(extra.fireBlanketInPlace || "").toLowerCase() === "yes" },
    { key: "alarmIsolated", label: "Alarm isolated / N/A", ok: ["yes", "na"].includes(String(extra.alarmIsolated || "").toLowerCase()) },
    { key: "ventilationConfirmed", label: "Ventilation OK", ok: String(extra.ventilationConfirmed || "").toLowerCase() === "yes" },
  ];
  const pass = checks.filter((c) => c.ok).length;
  const go = pass === checks.length && String(extra.fireWatcher || "").trim();
  const bg = go ? "#f0fdf4" : "#fef2f2";
  const stroke = go ? "#16a34a" : "#dc2626";
  const title = go ? "GO — controls in place" : "NO-GO — complete checklist";
  const titleFill = go ? "#14532d" : "#991b1b";
  const rows = checks
    .map((c, i) => {
      const y = 36 + i * 12;
      const mark = c.ok ? "✓" : "○";
      const fill = c.ok ? "#166534" : "#94a3b8";
      return `<text x="16" y="${y}" font-size="8" fill="${fill}">${mark} ${c.label}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" role="img" aria-label="Hot work go no go">
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${bg}" stroke="${stroke}" stroke-width="2"/>
    <text x="${width / 2}" y="18" text-anchor="middle" font-size="11" font-weight="800" fill="${titleFill}">${title}</text>
    <text x="${width - 12}" y="18" text-anchor="end" font-size="9" fill="#64748b">${pass}/${checks.length}</text>
    ${rows}
    <text x="${width / 2}" y="${height - 6}" text-anchor="middle" font-size="7" fill="#64748b">Site RAMS &amp; fire plan govern — HSE hot work guidance</text>
  </svg>`;
}

export function renderHotWorkPrintHtml(permit, { primaryColor = "#E24B4A" } = {}) {
  if (!isHotWorkPermitType(permit?.type)) return "";
  const extra = permit?.extraFields || {};
  const assessment = hotWorkAssessment(extra, permit);

  const fieldsHtml = [
    ["Equipment", extra.equipment || "—"],
    ["Fire watcher", extra.fireWatcher || "—"],
    ["Fire watch duration (min)", extra.fireWatchDurationMins || assessment.fireWatchDurationMins],
    ["Post-work inspection", extra.postInspectionTime || "—"],
    ["Post-watch signed off", extra.postWorkWatchSignedOff || "—"],
    ["10 m combustibles clear", extra.combustiblesCleared10m || "—"],
    ["Openings sealed", extra.openingsSealed || "—"],
    ["Extinguishers in place", extra.extinguishersInPlace || "—"],
    ["Fire blanket", extra.fireBlanketInPlace || "—"],
    ["Alarm isolated", extra.alarmIsolated || "—"],
    ["Ventilation", extra.ventilationConfirmed || "—"],
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
      : `<p style="margin:6px 0 0;font-size:10px;color:#166534">Hot work controls recorded — maintain fire watch after work stops.</p>`;

  return `
  <h2 style="border-left-color:${primaryColor}">Hot work guidance</h2>
  <p style="font-size:10px;color:#64748b;margin:0 0 8px">UK HSE hot work practice. Typical client rule: minimum ${DEFAULT_FIRE_WATCH_MINS} min post-work fire watch; max ${MAX_HOT_WORK_HOURS} h permit.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
    <div>${renderHotWorkZoneSvg({ width: 320 })}</div>
    <div>${renderHotWorkGoNoGoSvg(extra, { width: 320 })}</div>
  </div>
  <div style="margin-bottom:10px">${renderFireWatchTimelineSvg({ durationMins: assessment.fireWatchDurationMins, width: 480 })}</div>
  <table style="margin-bottom:8px"><tbody>${fieldsHtml}</tbody></table>
  ${warnHtml}
  <p style="font-size:9px;color:#64748b;margin-top:8px">HSE hot work · Fire Safety Order · site fire plan</p>`;
}
