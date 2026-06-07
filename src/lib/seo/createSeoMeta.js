import { getProjectConfig } from "../projects/config";

/**
 * Build document meta descriptor for blog pages (consumed by useBlogDocumentMeta).
 * @param {{
 *   title?: string;
 *   description?: string;
 *   path?: string;
 *   canonicalUrl?: string;
 *   ogImageUrl?: string;
 *   ogType?: "website" | "article";
 *   rssFeedUrl?: string;
 *   articlePublishedTime?: string;
 *   articleModifiedTime?: string;
 *   siteName?: string;
 * }} input
 */
export function createSeoMeta(input = {}) {
  const project = getProjectConfig();
  const siteName = input.siteName || project.name;

  return {
    title: input.title || project.blogTitle,
    description: input.description || project.blogDescription,
    canonicalUrl: input.canonicalUrl || "",
    ogImageUrl: input.ogImageUrl,
    ogType: input.ogType || "website",
    rssFeedUrl: input.rssFeedUrl,
    articlePublishedTime: input.articlePublishedTime,
    articleModifiedTime: input.articleModifiedTime,
    siteName,
    locale: project.locale.replace("-", "_"),
  };
}
