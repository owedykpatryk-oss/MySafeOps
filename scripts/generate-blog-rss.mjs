/**
 * Writes public/blog/rss.xml for marketing posts.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = (process.env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/$/, "");
const BLOG_BASE = (process.env.VITE_BLOG_POSTS_BASE_URL || `${ORIGIN}/blog`).replace(/\/$/, "");

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FALLBACK_PUBLISHED_ISO = "2026-04-16";

/**
 * Channel lastBuildDate has to be identical on every build. `new Date()`
 * rewrites this tracked file and the production stamp becomes `<sha>-dirty`.
 * Posts only carry `publishedIso` (YYYY-MM-DD); `updatedIso` is honoured if a
 * post gains one later. Same noon-UTC instant as each item's pubDate.
 * @param {Array<{ publishedIso?: string, updatedIso?: string }>} posts
 */
function channelLastBuildDate(posts) {
  let newest = "";
  for (const post of posts) {
    for (const field of [post.updatedIso, post.publishedIso]) {
      const day = String(field || "")
        .trim()
        .slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day > newest) newest = day;
    }
  }
  return new Date(`${newest || FALLBACK_PUBLISHED_ISO}T12:00:00Z`).toUTCString();
}

const lastBuild = channelLastBuildDate(LANDING_BLOG_POSTS);

const items = LANDING_BLOG_POSTS.map((p) => {
  const link = `${BLOG_BASE}/${p.slug}`;
  const pub = p.publishedIso || FALLBACK_PUBLISHED_ISO;
  const pubDate = new Date(`${pub}T12:00:00Z`).toUTCString();
  return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
    </item>`;
}).join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MySafeOps — UK construction safety guides</title>
    <link>${escapeXml(BLOG_BASE)}</link>
    <description>Practical articles for site managers and H&amp;S leads: permits, inductions, toolbox talks, COSHH, and compliance.</description>
    <language>en-gb</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(`${ORIGIN}/blog/rss.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

const outDir = join(root, "public", "blog");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "rss.xml"), rss, "utf8");
console.log(`Wrote public/blog/rss.xml (${LANDING_BLOG_POSTS.length} items).`);
