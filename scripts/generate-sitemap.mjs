/**
 * Writes public/sitemap.xml from marketing routes + LANDING_BLOG_POSTS.
 * Includes all live markets (UK / AU / PL) legal + home paths.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";
import { MARKET_IDS, MARKETS } from "../src/config/markets.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = (process.env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/$/, "");

/** @type {string[]} */
const staticPaths = [
  "/docs",
  "/status",
  "/security",
];

for (const id of MARKET_IDS) {
  const m = MARKETS[id];
  staticPaths.push(
    m.homePath,
    m.privacyPath,
    m.termsPath,
    m.cookiesPath,
    m.dpaPath,
    m.accessibilityPath,
    `${m.legalBasePath}/privacy-policy.html`,
    `${m.legalBasePath}/terms.html`,
    `${m.legalBasePath}/cookies.html`,
    `${m.legalBasePath}/dpa.html`,
    `${m.legalBasePath}/accessibility.html`,
  );
}

const urls = [
  ...new Set([...staticPaths, "/blog", ...LANDING_BLOG_POSTS.map((p) => `/blog/${p.slug}`)]),
].sort((a, b) => {
  if (a === "/") return -1;
  if (b === "/") return 1;
  return a.localeCompare(b);
});

function priorityFor(path) {
  if (path === "/") return "1.0";
  if (path === "/au" || path === "/pl") return "0.95";
  if (path === "/blog") return "0.85";
  if (path.startsWith("/blog/")) return "0.75";
  if (path.includes("privacy") || path.includes("terms") || path.includes("cookies") || path.includes("dpa") || path.includes("accessibility") || path.startsWith("/legal")) {
    return "0.35";
  }
  if (path === "/docs" || path === "/status" || path === "/security") return "0.4";
  return "0.7";
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((path) => {
    const loc = `${ORIGIN}${path === "/" ? "" : path}`;
    const changefreq = path === "/security" ? "monthly" : path.startsWith("/blog/") ? "monthly" : "weekly";
    return `  <url>
    <loc>${loc || ORIGIN + "/"}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priorityFor(path)}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

writeFileSync(join(root, "public", "sitemap.xml"), xml, "utf8");
console.log(`Wrote public/sitemap.xml (${urls.length} URLs, origin ${ORIGIN}).`);
