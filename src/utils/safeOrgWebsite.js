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
 * @param {string} [revision]
 * @param {string} [fallback]
 */
export function buildOrgShareUrlWithRef(org, ref, fallback = DEFAULT_UM_SITE, revision = "") {
  const base = safeOrgWebsiteBase(org, fallback);
  const r = String(ref || "").trim();
  const rev = String(revision || "").trim();
  if (!r && !rev) return base;
  const params = new URLSearchParams();
  if (r) params.set("ref", r);
  if (rev) params.set("rev", rev);
  return `${base}?${params.toString()}`;
}
