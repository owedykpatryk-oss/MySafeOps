/**
 * Canonical URLs for published guides.
 * Override with VITE_BLOG_POSTS_BASE_URL (no trailing slash).
 */

export function getBlogPostsBase() {
  const fromEnv = String(import.meta.env.VITE_BLOG_POSTS_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://mysafeops.com/blog";
}

export function getPublicSiteOrigin() {
  const explicit = String(import.meta.env.VITE_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const blogBase = getBlogPostsBase();
  if (blogBase.endsWith("/blog")) {
    return blogBase.slice(0, -"/blog".length) || "https://mysafeops.com";
  }
  try {
    return new URL(blogBase).origin;
  } catch {
    return "https://mysafeops.com";
  }
}

/** @param {string} slug */
export function getBlogPostUrl(slug) {
  const s = String(slug || "").replace(/^\/+/, "").replace(/\/+$/, "");
  return s ? `${getBlogPostsBase()}/${s}` : getBlogPostsBase();
}

/** @param {string} path e.g. `/blog` or `/blog/permit-to-work-app-uk` */
export function generateCanonical(path = "/") {
  const origin = getPublicSiteOrigin();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}
