/**
 * Internal linking report — find posts with weak inbound links.
 * Usage: npm run blog:links
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";
import { extractBlogLinks, stripPreamble } from "./lib/blog-workflow-utils.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slugs = LANDING_BLOG_POSTS.map((p) => p.slug);
const slugSet = new Set(slugs);

/** @type {Map<string, Set<string>>} slug -> set of slugs linking to it */
const inbound = new Map(slugs.map((s) => [s, new Set()]));

for (const post of LANDING_BLOG_POSTS) {
  const mdPath = join(root, "src", "blog", "posts", `${post.slug}.md`);
  if (!existsSync(mdPath)) continue;
  const body = stripPreamble(readFileSync(mdPath, "utf8"));
  const { found } = extractBlogLinks(body, slugSet);
  for (const target of found) {
    if (target === post.slug) continue;
    inbound.get(target)?.add(post.slug);
  }
}

console.log("Blog internal link report\n");
console.log("Slug | inbound links | from");
console.log("-----|---------------|-----");

const weak = [];
for (const post of LANDING_BLOG_POSTS) {
  const from = [...(inbound.get(post.slug) || [])];
  const n = from.length;
  if (n < 2) weak.push(post.slug);
  console.log(`${post.slug} | ${n} | ${from.slice(0, 5).join(", ") || "—"}`);
}

if (weak.length) {
  console.log(`\nWeak inbound (under 2): ${weak.join(", ")}`);
  console.log("Add links from related articles in **See also:** or body.");
}
