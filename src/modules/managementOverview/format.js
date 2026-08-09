import { getMarket } from "../../config/markets";
import { getActiveDocumentLocale } from "../../utils/countryWorkspaces";
import { dateOnly, daysBetween } from "../../utils/managementOverview";
import { getOrgMarketId } from "../../utils/orgMarket";

/**
 * Formatting shared by the management overview container and its lazily loaded tabs.
 *
 * Dates and money follow the *document* locale — the country workspace the plan belongs to,
 * not the browser. A Polish workspace has to read "3 sie 2026" and "12 000 zł", not "3 Aug"
 * and "12,000 zł", which is what a hardcoded en-GB formatter produced.
 */

const FALLBACK_LOCALE = "en-GB";
const cache = new Map();

function activeLocale() {
  try {
    return getActiveDocumentLocale() || FALLBACK_LOCALE;
  } catch {
    return FALLBACK_LOCALE;
  }
}

function activeCurrency() {
  try {
    return getMarket(getOrgMarketId()).currency || "GBP";
  } catch {
    return "GBP";
  }
}

/** Intl objects are expensive to build, so keep one set per locale+currency pair. */
function formatters() {
  const locale = activeLocale();
  const currency = activeCurrency();
  const key = `${locale}|${currency}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      day: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }),
      month: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      shortMonth: new Intl.DateTimeFormat(locale, { month: "short" }),
      money: new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    };
    cache.set(key, entry);
  }
  return entry;
}

export function formatDay(date) {
  return formatters().day.format(date);
}

export function formatMonth(date) {
  return formatters().month.format(date);
}

export function formatShortMonth(date) {
  return formatters().shortMonth.format(date);
}

export function dateLabel(value) {
  const date = dateOnly(value);
  return date ? formatDay(date) : "Not set";
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

/** Currency of the country workspace, placed and grouped the way that locale writes it. */
export function formatMoney(value) {
  return formatters().money.format(Math.round(Number(value) || 0));
}

export function countdownLabel(days) {
  if (days <= 0) return "On site";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function freshnessLabel(value, nowMs) {
  if (!value) return "";
  const updated = new Date(value);
  if (Number.isNaN(updated.getTime())) return "";
  const minutes = Math.max(0, Math.floor((nowMs - updated.getTime()) / 60000));
  if (minutes < 1) return "updated just now";
  if (minutes === 1) return "updated 1 minute ago";
  if (minutes < 60) return `updated ${minutes} minutes ago`;
  return `updated ${formatDay(updated)}`;
}

/** Plain-English timing for a job relative to today. */
export function scheduleLabel(job, today) {
  if (job.phase === "unscheduled") return "No dates set";
  if (job.phase === "overdue") {
    const over = daysBetween(dateOnly(job.end || job.start), today) || 0;
    return `Overdue by ${over} ${plural(over, "day")}`;
  }
  if (job.phase === "active") return "Running now";
  const days = daysBetween(today, dateOnly(job.start));
  if (days === 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

/** "2 hours ago" for the job change log. */
export function agoLabel(isoTimestamp, nowMs = Date.now()) {
  const at = new Date(isoTimestamp);
  if (Number.isNaN(at.getTime())) return "";
  const minutes = Math.max(0, Math.floor((nowMs - at.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${plural(minutes, "minute")} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, "hour")} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${plural(days, "day")} ago`;
  return formatDay(at);
}

/** Ids for teams, opportunities, actions and archived meetings. */
export function id(prefix) {
  const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}_${unique}`;
}
