/**
 * Blog markdown is bundled at build time (Vite `?raw`). No network fetch, so it works
 * behind Vercel’s SPA rewrite to index.html (which was returning HTML for `/blog/posts/*.md`).
 *
 * To edit an article: change the matching file in `./posts/` (or sync from DOCS/Blog).
 */
const modules = import.meta.glob("./posts/*.md", { query: "?raw", import: "default", eager: true });

/** @param {string} path */
function pathToSlug(path) {
  const m = String(path).match(/\/([^/]+)\.md$/);
  return m ? m[1] : "";
}

/** @type {Record<string, string>} */
export const BLOG_MARKDOWN_BY_SLUG = {};

for (const [path, raw] of Object.entries(modules)) {
  const slug = pathToSlug(path);
  if (slug && typeof raw === "string") {
    BLOG_MARKDOWN_BY_SLUG[slug] = raw;
  }
}

/** @param {string} slug */
export function getBundledPostMarkdown(slug) {
  return BLOG_MARKDOWN_BY_SLUG[slug] ?? null;
}
