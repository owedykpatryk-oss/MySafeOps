const INTERNAL_PATH_BASE = "https://static-base.invalid";

/**
 * Allow only http(s) links for user-controlled hrefs — blocks javascript:, data:, etc.
 * Relative paths resolve against the current origin and are allowed if the result is http(s).
 */
export function safeHttpUrl(raw) {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t, typeof window !== "undefined" ? window.location.href : "https://localhost/");
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    return null;
  }
  return null;
}

/**
 * Brand logo / asset URL for invite previews and similar surfaces.
 * Allows same-origin paths (`/branding/...`) and absolute https URLs.
 * Rejects protocol-relative (`//evil.test`), http, and non-http schemes.
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function safeBrandAssetUrl(raw) {
  if (raw == null || typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";
  if (/^https:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (u.protocol === "https:") return u.href;
    } catch {
      return "";
    }
    return "";
  }
  return safeInternalPath(t, "");
}

/**
 * In-app path for client-side navigation (`next=` after login, etc.). Blocks open redirects
 * (e.g. <code>//phishing.test/path</code>, <code>https:...</code>) while allowing <code>/app?tab=1#x</code>.
 * @param {string | null | undefined} raw
 * @param {string} [fallback]
 * @returns {string}
 */
export function safeInternalPath(raw, fallback = "/app") {
  if (raw == null || typeof raw !== "string") return fallback;
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    return fallback;
  }
  s = s.trim();
  if (!s) return fallback;
  if (s.includes("\0") || s.includes("\\") || s.startsWith("//")) {
    return fallback;
  }
  if (!s.startsWith("/")) return fallback;
  try {
    const u = new URL(s, INTERNAL_PATH_BASE);
    if (u.origin !== INTERNAL_PATH_BASE) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
