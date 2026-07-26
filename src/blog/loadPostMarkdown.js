/**
 * Blog markdown is bundled at build time (Vite `?raw`). No network fetch, so it works
 * behind Vercel’s SPA rewrite to index.html (which was returning HTML for `/blog/posts/*.md`).
 *
 * Lazy (eager: false) so each article page only loads its own markdown chunk — critical for
 * SEO LCP on BlogArticlePage.
 *
 * To edit an article: change `./posts/{slug}.md`, or edit drafts under `DOCS/Blog/` and run
 * `node scripts/sync-blog-from-docs.mjs`, then `npm run verify:blog`.
 */
const modules = import.meta.glob("./posts/*.md", { query: "?raw", import: "default", eager: false });

/** @param {string} path */
function pathToSlug(path) {
  const m = String(path).match(/\/([^/]+)\.md$/);
  return m ? m[1] : "";
}

/** @type {Record<string, () => Promise<string>>} */
const loadersBySlug = {};
for (const [path, loader] of Object.entries(modules)) {
  const slug = pathToSlug(path);
  if (slug && typeof loader === "function") {
    loadersBySlug[slug] = loader;
  }
}

/** @param {string} slug */
export async function getBundledPostMarkdown(slug) {
  const load = loadersBySlug[slug];
  if (!load) return null;
  const raw = await load();
  return typeof raw === "string" ? raw : null;
}

/** Whether a slug has a bundled markdown module (sync — no content load). */
export function hasBundledPostMarkdown(slug) {
  return Boolean(loadersBySlug[slug]);
}
