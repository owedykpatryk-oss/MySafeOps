/**
 * Writes public/sitemap-images.xml from LANDING_BLOG_POSTS hero images.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = (process.env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/$/, "");

const entries = LANDING_BLOG_POSTS.filter((p) => p.image).map((p) => {
  const pageUrl = `${ORIGIN}/blog/${p.slug}`;
  const imageUrl = p.image.startsWith("http") ? p.image : `${ORIGIN}${p.image}`;
  return `  <url>
    <loc>${pageUrl}</loc>
    <image:image>
      <image:loc>${imageUrl}</image:loc>
      <image:title>${escapeXml(p.title)}</image:title>
      <image:caption>${escapeXml(p.excerpt)}</image:caption>
    </image:image>
  </url>`;
});

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join("\n")}
</urlset>
`;

writeFileSync(join(root, "public", "sitemap-images.xml"), xml, "utf8");
console.log(`Wrote public/sitemap-images.xml (${entries.length} images).`);
