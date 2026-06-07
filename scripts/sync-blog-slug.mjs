/**
 * Sync one article from DOCS/Blog draft → src/blog/posts/{slug}.md
 *
 * Usage:
 *   npm run blog:sync -- height-work-permit-uk
 *   npm run blog:sync -- --slug=height-work-permit-uk
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";
import { createInternalLinks, formatInternalLinksMarkdown } from "../src/lib/seo/createInternalLinks.js";
import {
  findDocsDraft,
  transformDocsToLive,
} from "./lib/blog-workflow-utils.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const slugArg = process.argv[2]?.startsWith("--slug=")
  ? process.argv[2].slice("--slug=".length)
  : process.argv[2];

if (!slugArg) {
  console.error("Usage: npm run blog:sync -- <slug>");
  process.exit(1);
}

const post = LANDING_BLOG_POSTS.find((p) => p.slug === slugArg);
if (!post) {
  console.error(`Unknown slug (not in landingBlogPosts): ${slugArg}`);
  process.exit(1);
}

const draftPath = findDocsDraft(root, slugArg);
if (!draftPath) {
  console.error(`No DOCS/Blog draft found matching slug: ${slugArg}`);
  process.exit(1);
}

const tax = post.category ? { category: post.category, tags: post.tags || [] } : {};
const links = createInternalLinks({
  slug: slugArg,
  category: tax.category,
  tags: tax.tags,
  limit: 4,
});
const seeAlso = formatInternalLinksMarkdown(links) || "**See also:** [Permit to work app UK](/blog/permit-to-work-app-uk)";

const hero = {
  alt: post.title,
  heroPath: post.image.startsWith("/") ? post.image : `/blog/images/${slugArg}-hero.png`,
};

const raw = readFileSync(draftPath, "utf8");
let out;
try {
  out = transformDocsToLive(raw, hero, seeAlso);
} catch (e) {
  console.error(`Transform failed: ${e.message}`);
  console.error("Ensure draft has H1 and --- + **Table of contents** block.");
  process.exit(1);
}

const livePath = join(root, "src", "blog", "posts", `${slugArg}.md`);
writeFileSync(livePath, out, "utf8");
console.log(`Synced ${draftPath}`);
console.log(`     → ${livePath}`);
