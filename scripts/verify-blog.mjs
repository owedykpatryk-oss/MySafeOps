/**
 * CI/local check: every landing post has hero image, bundled markdown, and FAQ JSON-LD data.
 * Run: npm run verify:blog
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";
import { FAQ_MAIN_ENTITY_BY_SLUG } from "../src/data/blogFaqJsonLd.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;

const SCHEMA_APPENDIX = "## Schema.org structured data (for CMS / SEO plugin)";

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
  } else {
    const md = readFileSync(mdPath, "utf8");
    if (md.includes(SCHEMA_APPENDIX)) {
      console.error(`STRIP schema appendix from markdown (visible on site): src/blog/posts/${post.slug}.md`);
      errors += 1;
    }
  }

  const faq = FAQ_MAIN_ENTITY_BY_SLUG[post.slug];
  if (!faq?.length) {
    console.error(`MISSING FAQ_MAIN_ENTITY_BY_SLUG[${post.slug}] in src/data/blogFaqJsonLd.js`);
    errors += 1;
  }
}

if (errors > 0) {
  console.error(`\nverify:blog failed (${errors} problem(s)).`);
  process.exit(1);
}

console.log(
  `verify:blog OK — ${LANDING_BLOG_POSTS.length} articles (hero PNG + markdown + FAQ JSON-LD data).`,
);
