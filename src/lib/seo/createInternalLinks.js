import { LANDING_BLOG_POSTS } from "../../data/landingBlogPosts";

/**
 * Suggest internal blog links for a draft or published article.
 * @param {{
 *   slug?: string;
 *   category?: string;
 *   tags?: string[];
 *   limit?: number;
 * }} opts
 * @returns {{ slug: string; title: string; url: string; score: number }[]}
 */
export function createInternalLinks(opts = {}) {
  const { slug, category, tags = [], limit = 5 } = opts;
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

  const scored = LANDING_BLOG_POSTS.filter((p) => p.slug !== slug).map((p) => {
    let score = 0;
    if (category && p.category === category) score += 3;
    for (const t of p.tags || []) {
      if (tagSet.has(t.toLowerCase())) score += 2;
    }
    if (p.featured) score += 1;
    return { slug: p.slug, title: p.title, url: `/blog/${p.slug}`, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, limit);
}

/**
 * Markdown "See also" line from suggested links.
 * @param {ReturnType<typeof createInternalLinks>} links
 */
export function formatInternalLinksMarkdown(links) {
  if (!links.length) return "";
  const parts = links.map((l) => `[${l.title}](/blog/${l.slug})`);
  return `**See also:** ${parts.join(" · ")}`;
}
