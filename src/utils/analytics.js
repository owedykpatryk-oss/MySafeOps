/**
 * Optional analytics bridge: forwards to `window.gtag` (GA4) and/or `window.plausible` when present.
 * Load tags in index.html or your consent banner — no keys required here.
 *
 * @param {string} name
 * @param {Record<string, string | number | boolean | undefined>} [params]
 */
export function trackEvent(name, params = {}) {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
    if (typeof window.plausible === "function") {
      window.plausible(name, { props: params });
    }
  } catch {
    /* ignore */
  }
}

export function trackBlogIndexView() {
  trackEvent("blog_index_view", { location: "blog" });
}

/**
 * @param {string} slug
 */
export function trackBlogArticleView(slug) {
  trackEvent("blog_article_view", { slug, location: "blog" });
}
