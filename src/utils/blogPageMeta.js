import { useEffect } from "react";

const MARK = "data-mysafeops-blog-meta";

/**
 * @param {{
 *   title: string;
 *   description: string;
 *   canonicalUrl: string;
 *   ogImageUrl?: string;
 *   ogType?: "website" | "article";
 *   rssFeedUrl?: string;
 * }} opts
 * @param {boolean} [enabled]
 */
export function useBlogDocumentMeta(opts, enabled = true) {
  const { title, description, canonicalUrl, ogImageUrl, ogType = "website", rssFeedUrl } = opts;

  useEffect(() => {
    if (!enabled) return undefined;

    const doc = document;
    const prevTitle = doc.title;
    doc.title = title;

    /** @type {{ el: Element; created: boolean; prev: Record<string, string | null> }[]} */
    const stack = [];

    /**
     * @param {string} tag
     * @param {Record<string, string>} attrs
     */
    function ensure(tag, attrs) {
      let sel = "";
      if (tag === "meta" && attrs.property) sel = `meta[property="${attrs.property}"]`;
      else if (tag === "meta" && attrs.name) sel = `meta[name="${attrs.name}"]`;
      else if (tag === "link" && attrs.rel === "canonical") sel = `link[rel="canonical"]`;
      else if (tag === "link" && attrs.rel === "alternate" && attrs.type === "application/rss+xml") {
        sel = `link[rel="alternate"][type="application/rss+xml"]`;
      }

      let el = sel ? doc.head.querySelector(sel) : null;
      const created = !el;
      if (!el) {
        el = doc.createElement(tag);
        doc.head.appendChild(el);
      }

      const prev = {};
      for (const [k, v] of Object.entries(attrs)) {
        prev[k] = el.getAttribute(k);
        el.setAttribute(k, v);
      }
      el.setAttribute(MARK, "1");
      stack.push({ el, created, prev });
    }

    ensure("meta", { name: "description", content: description });
    ensure("link", { rel: "canonical", href: canonicalUrl });

    ensure("meta", { property: "og:title", content: title });
    ensure("meta", { property: "og:description", content: description });
    ensure("meta", { property: "og:url", content: canonicalUrl });
    ensure("meta", { property: "og:type", content: ogType });
    ensure("meta", { property: "og:site_name", content: "MySafeOps" });
    ensure("meta", { property: "og:locale", content: "en_GB" });
    if (ogImageUrl) {
      ensure("meta", { property: "og:image", content: ogImageUrl });
    }

    ensure("meta", { name: "twitter:card", content: "summary_large_image" });
    ensure("meta", { name: "twitter:title", content: title });
    ensure("meta", { name: "twitter:description", content: description });
    if (ogImageUrl) {
      ensure("meta", { name: "twitter:image", content: ogImageUrl });
    }

    if (rssFeedUrl) {
      ensure("link", {
        rel: "alternate",
        type: "application/rss+xml",
        title: "MySafeOps blog",
        href: rssFeedUrl,
      });
    }

    return () => {
      doc.title = prevTitle;
      for (const { el, created, prev } of stack.reverse()) {
        if (created) {
          el.remove();
          continue;
        }
        for (const [k, v] of Object.entries(prev)) {
          if (v === null) el.removeAttribute(k);
          else el.setAttribute(k, v);
        }
        el.removeAttribute(MARK);
      }
    };
  }, [enabled, title, description, canonicalUrl, ogImageUrl, ogType, rssFeedUrl]);
}
