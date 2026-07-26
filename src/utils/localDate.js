/**
 * Calendar dates in the user's local timezone (not UTC).
 * Prefer these over `toISOString().slice(0, 10)` — UTC midnight skew breaks AU mornings and UK/PL late nights.
 */

/** @param {Date | number | string} [value] */
export function toLocalDate(value = new Date()) {
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Local calendar date as `YYYY-MM-DD` (en-CA). */
export function localDateISO(value = new Date()) {
  const d = toLocalDate(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local calendar month as `YYYY-MM`. */
export function localMonthISO(value = new Date()) {
  return localDateISO(value).slice(0, 7);
}

/** Today in local timezone — drop-in for `() => new Date().toISOString().slice(0, 10)`. */
export function todayLocalISO() {
  return localDateISO(new Date());
}

/** Parse `YYYY-MM-DD` as a local midnight Date (not UTC). */
export function parseLocalDateISO(iso) {
  const s = String(iso || "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
