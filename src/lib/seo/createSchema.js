import { getFaqPageJsonLd } from "../../data/blogFaqJsonLd";
import { getBlogPostUrl, getPublicSiteOrigin } from "./generateCanonical";

/**
 * @param {{
 *   title: string;
 *   excerpt: string;
 *   jsonLdDescription?: string;
 *   publishedIso?: string;
 *   image?: string;
 * }} meta
 * @param {string} slug
 * @param {string} [origin]
 */
export function createArticleSchema(meta, slug, origin = getPublicSiteOrigin()) {
  const pageUrl = getBlogPostUrl(slug);
  const description = meta.jsonLdDescription ?? meta.excerpt;
  const imagePath = meta.image;
  const imageUrl =
    imagePath && !String(imagePath).startsWith("http") ? `${origin}${imagePath}` : imagePath || undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description,
    ...(imageUrl ? { image: imageUrl } : {}),
    author: {
      "@type": "Organization",
      name: "MySafeOps",
      url: origin,
    },
    publisher: {
      "@type": "Organization",
      name: "MySafeOps",
      logo: {
        "@type": "ImageObject",
        url: `${origin}/vite.svg`,
      },
    },
    datePublished: meta.publishedIso,
    dateModified: meta.publishedIso,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
  };
}

/**
 * @param {string} slug
 * @param {string} title
 * @param {string} [origin]
 */
export function createBreadcrumbSchema(slug, title, origin = getPublicSiteOrigin()) {
  const homeUrl = `${origin}/`;
  const blogUrl = `${origin}/blog`;
  const postUrl = getBlogPostUrl(slug);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: homeUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: blogUrl },
      { "@type": "ListItem", position: 3, name: title, item: postUrl },
    ],
  };
}

/**
 * Build JSON-LD graph array for an article page.
 * @param {Parameters<typeof createArticleSchema>[0]} meta
 * @param {string} slug
 * @param {string} [origin]
 */
export function createSchemaGraph(meta, slug, origin = getPublicSiteOrigin()) {
  const breadcrumb = createBreadcrumbSchema(slug, meta.title, origin);
  const article = createArticleSchema(meta, slug, origin);
  const faq = getFaqPageJsonLd(slug);
  return faq ? [breadcrumb, article, faq] : [breadcrumb, article];
}

/** @deprecated use createArticleSchema */
export const buildBlogArticleJsonLd = createArticleSchema;

/** @deprecated use createBreadcrumbSchema */
export const buildBlogBreadcrumbJsonLd = createBreadcrumbSchema;
