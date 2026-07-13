import { useEffect } from "react";
import { serializeJsonLd } from "./safeJsonLd.js";

const MARK = "data-mysafeops-landing-meta";
const LD_MARK = "data-mysafeops-landing-ld";

/**
 * Head tags + JSON-LD for the marketing home page (`/`). Restores previous values on unmount.
 *
 * @param {{
 *   title: string;
 *   description: string;
 *   jsonLd: Record<string, unknown>;
 *   ogImageAbsoluteUrl?: string;
 *   canonicalPath?: string;
 *   locale?: string;
 *   ogLocale?: string;
 *   ogImageAlt?: string;
 *   alternateLocale?: { hreflang: string; href: string };
 *   alternateLocales?: { hreflang: string; href: string }[];
 * }} opts ogImageAbsoluteUrl — full URL for og:image and twitter:image
 */
export function useLandingHomeDocumentMeta(opts) {
  const {
    title,
    description,
    jsonLd,
    ogImageAbsoluteUrl,
    canonicalPath = "/",
    locale = "en-GB",
    ogLocale = "en_GB",
    ogImageAlt = "MySafeOps — construction RAMS, permits, and site safety workspace",
    alternateLocale,
    alternateLocales,
  } = opts;

  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;

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
      else if (tag === "link" && attrs.rel === "alternate" && attrs.hreflang) sel = `link[rel="alternate"][hreflang="${attrs.hreflang}"]`;

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
    ensure("meta", { property: "og:locale", content: ogLocale });

    if (alternateLocales?.length) {
      for (const alt of alternateLocales) {
        ensure("link", { rel: "alternate", hreflang: alt.hreflang, href: alt.href });
      }
    } else if (alternateLocale) {
      ensure("link", { rel: "alternate", hreflang: alternateLocale.hreflang, href: alternateLocale.href });
    }

    if (ogImageAbsoluteUrl) {
      ensure("meta", { property: "og:image", content: ogImageAbsoluteUrl });
      ensure("meta", { property: "og:image:alt", content: ogImageAlt });
      ensure("meta", { name: "twitter:image", content: ogImageAbsoluteUrl });
      ensure("meta", { name: "twitter:image:alt", content: ogImageAlt });
    }

    ensure("meta", { name: "twitter:card", content: "summary_large_image" });
    ensure("meta", { name: "twitter:title", content: title });
    ensure("meta", { name: "twitter:description", content: description });

    const prevHtmlLang = doc.documentElement.getAttribute("lang");
    doc.documentElement.setAttribute("lang", locale);

    const script = doc.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(LD_MARK, "1");
    script.textContent = serializeJsonLd(jsonLd);
    doc.head.appendChild(script);
    stack.push({
      el: script,
      created: true,
      prev: {},
    });

    return () => {
      doc.title = prevTitle;
      if (prevHtmlLang === null) doc.documentElement.removeAttribute("lang");
      else doc.documentElement.setAttribute("lang", prevHtmlLang);
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
  }, [title, description, jsonLd, ogImageAbsoluteUrl, canonicalPath, locale, ogLocale, ogImageAlt, alternateLocale, alternateLocales]);
}
