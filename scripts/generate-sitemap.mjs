/**
 * Writes public/sitemap.xml from LANDING_BLOG_POSTS.
 * Uses VITE_PUBLIC_SITE_URL or https://mysafeops.com
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = (process.env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/$/, "");

const urls = ["/", "/blog", ...LANDING_BLOG_POSTS.map((p) => `/blog/${p.slug}`)];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((path) => {
    const loc = `${ORIGIN}${path}`;
    const priority = path === "/" ? "1.0" : path === "/blog" ? "0.85" : "0.75";
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

writeFileSync(join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(`Wrote public/sitemap.xml (${urls.length} URLs, origin ${ORIGIN}).`);
