import { getBlogPostUrl, getBlogPostsBase } from "./blogPublicUrl";

/**
 * Schema.org Article for `/blog/:slug` (absolute URLs for indexing).
 *
 * @param {{
 *   title: string;
 *   excerpt: string;
 *   jsonLdDescription?: string;
 *   publishedIso?: string;
 *   image?: string;
 * }} meta From `LANDING_BLOG_POSTS` entry
 * @param {string} slug
 * @param {string} origin Site origin, e.g. `https://mysafeops.com`
 */
export function buildBlogArticleJsonLd(meta, slug, origin) {
  const pageUrl = getBlogPostUrl(slug);
  const description = meta.jsonLdDescription ?? meta.excerpt;
  const imagePath = meta.image;
  const imageUrl =
    imagePath && !String(imagePath).startsWith("http")
      ? `${origin}${imagePath}`
      : imagePath || undefined;

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
 * BreadcrumbList for rich results (absolute URLs).
 * @param {string} slug
 * @param {string} title
 * @param {string} origin Site origin, e.g. `https://mysafeops.com`
 */
export function buildBlogBreadcrumbJsonLd(slug, title, origin) {
  const homeUrl = `${origin}/`;
  const blogUrl = getBlogPostsBase();
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
