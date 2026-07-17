/**
 * Safe public website base for QR / share links — blocks javascript: etc.
 */
import { safeHttpUrl } from "./safeUrl.js";

const DEFAULT_UM_SITE = "https://u-map.co.uk";

/**
 * @param {Record<string, unknown> | null | undefined} org
 * @param {string} [fallback]
 * @returns {string} origin without trailing slash
 */
export function safeOrgWebsiteBase(org, fallback = DEFAULT_UM_SITE) {
  const fromOrg = safeHttpUrl(typeof org?.website === "string" ? org.website : "");
  const fb = safeHttpUrl(fallback) || DEFAULT_UM_SITE;
  const raw = (fromOrg || fb).replace(/\/$/, "");
  return raw;
}

/**
 * @param {Record<string, unknown> | null | undefined} org
 * @param {string} [ref]
 * @param {string} [fallback]
 */
export function buildOrgShareUrlWithRef(org, ref, fallback = DEFAULT_UM_SITE) {
  const base = safeOrgWebsiteBase(org, fallback);
  const r = String(ref || "").trim();
  if (!r) return base;
  return `${base}?ref=${encodeURIComponent(r)}`;
}
