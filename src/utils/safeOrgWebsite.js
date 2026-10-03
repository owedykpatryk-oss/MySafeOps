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
  const website = typeof org?.website === "string" ? org.website.trim() : "";
  // Organisation settings commonly store a bare domain (for example www.example.com).
  // Treat that as a public website instead of resolving it as a path on the app origin.
  const candidate = website && !/^[a-z][a-z\d+.-]*:/i.test(website) && !website.startsWith("/")
    ? `https://${website}`
    : website;
  const fromOrg = safeHttpUrl(candidate);
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
