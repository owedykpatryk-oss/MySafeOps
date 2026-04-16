/**
 * Canonical URLs for published guides (TrySoro / CMS or same-origin when mirrored).
 * Override with VITE_BLOG_POSTS_BASE_URL (no trailing slash), e.g. https://mysafeops.com/blog
 */
export function getBlogPostsBase() {
  const fromEnv = String(import.meta.env.VITE_BLOG_POSTS_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://mysafeops.com/blog";
}

/** @param {string} slug e.g. permit-to-work-app-uk */
export function getBlogPostUrl(slug) {
  const s = String(slug || "").replace(/^\/+/, "").replace(/\/+$/, "");
  return s ? `${getBlogPostsBase()}/${s}` : getBlogPostsBase();
}
