/**
 * Human voice lint for blog markdown.
 * Usage: npm run blog:voice [-- slug]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";
import { checkBlogVoice } from "./lib/blog-voice.mjs";
import { stripPreamble } from "./lib/blog-workflow-utils.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slugFilter = process.argv[2];

const posts = slugFilter
  ? LANDING_BLOG_POSTS.filter((p) => p.slug === slugFilter)
  : LANDING_BLOG_POSTS;

if (slugFilter && !posts.length) {
  console.error(`Unknown slug: ${slugFilter}`);
  process.exit(1);
}

let total = 0;
for (const post of posts) {
  const mdPath = join(root, "src", "blog", "posts", `${post.slug}.md`);
  if (!existsSync(mdPath)) continue;
  const hits = checkBlogVoice(stripPreamble(readFileSync(mdPath, "utf8")));
  if (!hits.length) {
    console.log(`✓ ${post.slug}`);
    continue;
  }
  console.log(`\n${post.slug}:`);
  for (const h of hits) {
    console.log(`  - ${h.label}${h.count > 1 ? ` ×${h.count}` : ""}`);
    total += 1;
  }
}

if (total) {
  console.log(`\n${total} voice issue(s). See .cursor/rules/blog-writing-voice.mdc`);
  process.exit(1);
}
console.log(`\nAll ${posts.length} article(s) pass voice lint.`);
