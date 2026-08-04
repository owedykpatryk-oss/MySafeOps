import { getMarket } from "../config/markets";
import { getOrgMarketId } from "./orgMarket";
import { getOrgId } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { getActiveDocumentLocale } from "./countryWorkspaces";

const DATE_FMT = { day: "2-digit", month: "short", year: "numeric" };
const DATETIME_FMT = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** BCP-47 locale for dates — org setting, then market default (en-AU / en-GB). */
export function getOrgLocale(orgId = getOrgId()) {
  const settings = loadOrgSettingsRaw(orgId);
  const fromSettings = settings?.locale?.trim();
  if (fromSettings) return fromSettings;
  return getMarket(getOrgMarketId(orgId)).locale;
}

/** @param {string | null | undefined} iso @param {string} [orgId] */
export function formatOrgDate(iso, orgId = getOrgId()) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(getOrgLocale(orgId), DATE_FMT);
}

/** @param {string | null | undefined} iso @param {string} [orgId] */
export function formatOrgDateTime(iso, orgId = getOrgId()) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(getOrgLocale(orgId), DATETIME_FMT);
}

/** Document locale follows the selected country workspace, not the user's UI. */
export function formatDocumentDate(iso, orgId = getOrgId()) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(getActiveDocumentLocale(orgId, getOrgMarketId(orgId)), DATE_FMT);
}

export function formatDocumentDateTime(iso, orgId = getOrgId()) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(getActiveDocumentLocale(orgId, getOrgMarketId(orgId)), DATETIME_FMT);
}
