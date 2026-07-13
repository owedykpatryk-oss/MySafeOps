import { getMarket } from "../config/markets";
import { getOrgMarketId } from "./orgMarket";
import { getOrgId } from "./orgStorage";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";

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
