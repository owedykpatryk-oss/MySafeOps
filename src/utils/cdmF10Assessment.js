/**
 * HSE F10 / CDM notifiability assessment (CDM 2015 thresholds).
 * Not legal advice — figures must be confirmed against current HSE guidance.
 */

/** @typedef {{ notifiable: boolean, personDays: number, calendarDays: number, maxWorkers: number, reasons: string[], f10Required: boolean, f10Submitted: boolean, f10Date: string | null }} F10Assessment */

function num(value) {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * @param {{ estimatedPersonDays?: unknown, estimatedWorkers?: unknown, calendarPhaseDays?: unknown, f10Submitted?: boolean, f10Date?: string }} input
 * @returns {F10Assessment}
 */
export function assessCdmF10Notification(input = {}) {
  const personDays = num(input.estimatedPersonDays);
  const maxWorkers = num(input.estimatedWorkers);
  // Field captures calendar days on the form (not working days per CDM 2015 reg 6) —
  // treated as a cautious proxy for review, so label it accurately rather than as "working days".
  const calendarDays = num(input.calendarPhaseDays);
  const reasons = [];

  if (personDays > 500) {
    reasons.push(`${personDays} person-days exceeds 500`);
  }
  if (calendarDays > 30 && maxWorkers > 20) {
    reasons.push(`${calendarDays} calendar days with ${maxWorkers} workers on site (>30 days and >20 workers — verify actual working days for CDM 2015 reg 6)`);
  }

  const notifiable = reasons.length > 0;
  const f10Submitted = Boolean(input.f10Submitted);
  const f10Date = input.f10Date ? String(input.f10Date).slice(0, 10) : null;

  return {
    notifiable,
    personDays,
    calendarDays,
    maxWorkers,
    reasons,
    f10Required: notifiable,
    f10Submitted,
    f10Date,
  };
}

/** @param {F10Assessment} assessment */
export function f10StatusLabel(assessment) {
  if (!assessment?.notifiable) return "Below F10 thresholds";
  if (assessment.f10Submitted) return "F10 submitted";
  return "F10 required — not submitted";
}

/** @param {F10Assessment} assessment */
export function f10StatusTone(assessment) {
  if (!assessment?.notifiable) return "good";
  if (assessment.f10Submitted) return "good";
  return "bad";
}
