/**
 * CI/local check: every landing post has hero image + bundled markdown.
 * Run: npm run verify:blog
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;

for (const post of LANDING_BLOG_POSTS) {
  const imgPath = join(root, "public", post.image.replace(/^\//, ""));
  const mdPath = join(root, "src", "blog", "posts", `${post.slug}.md`);
  if (!existsSync(imgPath)) {
    console.error(`MISSING image: ${post.image} (${post.slug})`);
    errors += 1;
  }
  if (!existsSync(mdPath)) {
    console.error(`MISSING markdown: src/blog/posts/${post.slug}.md`);
    errors += 1;
  }
}

if (errors > 0) {
  console.error(`\nverify:blog failed (${errors} missing file(s)).`);
  process.exit(1);
}

console.log(`verify:blog OK — ${LANDING_BLOG_POSTS.length} articles (hero PNG + src/blog/posts/*.md).`);
