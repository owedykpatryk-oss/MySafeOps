import { useEffect } from "react";

const MARK = "data-mysafeops-landing-meta";
const LD_MARK = "data-mysafeops-landing-ld";

/**
 * Head tags + JSON-LD for the marketing home page (`/`). Restores previous values on unmount.
 *
 * @param {{
 *   title: string;
 *   description: string;
 *   jsonLd: Record<string, unknown>;
 * }} opts
 */
export function useLandingHomeDocumentMeta(opts) {
  const { title, description, jsonLd } = opts;

  useEffect(() => {
    const canonicalUrl = `${window.location.origin}/`;

    const doc = document;
    const prevTitle = doc.title;
    doc.title = title;

    /** @type {{ el: Element; created: boolean; prev: Record<string, string | null> }[]} */
    const stack = [];

    function ensure(tag, attrs) {
      let sel = "";
      if (tag === "meta" && attrs.property) sel = `meta[property="${attrs.property}"]`;
      else if (tag === "meta" && attrs.name) sel = `meta[name="${attrs.name}"]`;
      else if (tag === "link" && attrs.rel === "canonical") sel = `link[rel="canonical"]`;

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
    ensure("meta", { property: "og:type", content: "website" });
    ensure("meta", { property: "og:site_name", content: "MySafeOps" });
    ensure("meta", { property: "og:locale", content: "en_GB" });

    ensure("meta", { name: "twitter:card", content: "summary_large_image" });
    ensure("meta", { name: "twitter:title", content: title });
    ensure("meta", { name: "twitter:description", content: description });

    const script = doc.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(LD_MARK, "1");
    script.textContent = JSON.stringify(jsonLd);
    doc.head.appendChild(script);
    stack.push({
      el: script,
      created: true,
      prev: {},
    });

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
  }, [title, description, jsonLd]);
}
