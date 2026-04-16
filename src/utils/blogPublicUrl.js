/**
 * Canonical URLs for published guides (TrySoro / CMS or same-origin when mirrored).
 * Override with VITE_BLOG_POSTS_BASE_URL (no trailing slash), e.g. https://mysafeops.com/blog
 */
export function getBlogPostsBase() {
  const fromEnv = String(import.meta.env.VITE_BLOG_POSTS_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://mysafeops.com/blog";
}

/**
 * Origin for absolute OG image URLs and sitemap (no path). Prefer VITE_PUBLIC_SITE_URL when set.
 */
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

/** @param {string} slug e.g. permit-to-work-app-uk */
export function getBlogPostUrl(slug) {
  const s = String(slug || "").replace(/^\/+/, "").replace(/\/+$/, "");
  return s ? `${getBlogPostsBase()}/${s}` : getBlogPostsBase();
}
