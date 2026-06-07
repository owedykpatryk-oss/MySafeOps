/**
 * Enhanced blog CI: assets, FAQ, taxonomy, internal links, content quality.
 * Run: npm run verify:blog
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";
import { FAQ_MAIN_ENTITY_BY_SLUG } from "../src/data/blogFaqJsonLd.js";
import { BLOG_POST_TAXONOMY } from "../src/data/blogPostTaxonomy.js";
import {
  countWords,
  estimateReadingTimeLabel,
  excerptQuality,
  extractBlogLinks,
  stripPreamble,
} from "./lib/blog-workflow-utils.mjs";
import { checkBlogVoice } from "./lib/blog-voice.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let errors = 0;
let warnings = 0;

const SCHEMA_APPENDIX = "## Schema.org structured data (for CMS / SEO plugin)";
const SLUG_SET = new Set(LANDING_BLOG_POSTS.map((p) => p.slug));

function warn(msg) {
  console.warn(`WARN: ${msg}`);
  warnings += 1;
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  errors += 1;
}

// Orphan taxonomy keys
for (const slug of Object.keys(BLOG_POST_TAXONOMY)) {
  if (!SLUG_SET.has(slug)) {
    warn(`orphan BLOG_POST_TAXONOMY entry (no landing post): ${slug}`);
  }
}

for (const post of LANDING_BLOG_POSTS) {
  const imgPath = join(root, "public", post.image.replace(/^\//, ""));
  const mdPath = join(root, "src", "blog", "posts", `${post.slug}.md`);

  if (!existsSync(imgPath)) {
    fail(`missing hero image: ${post.image} (${post.slug})`);
  }
  if (!existsSync(mdPath)) {
    fail(`missing markdown: src/blog/posts/${post.slug}.md`);
    continue;
  }

  const rawMd = readFileSync(mdPath, "utf8");
  if (rawMd.includes(SCHEMA_APPENDIX)) {
    fail(`strip schema appendix from live markdown: ${post.slug}.md`);
  }

  const body = stripPreamble(rawMd);
  const words = countWords(body);
  if (words < 400) {
    warn(`${post.slug}: thin content (${words} words, aim 800+)`);
  }

  const estimated = estimateReadingTimeLabel(body);
  const declared = post.readTime || "";
  const declaredMin = parseInt(declared, 10);
  const estimatedMin = parseInt(estimated, 10);
  if (declaredMin && estimatedMin && Math.abs(declaredMin - estimatedMin) > 4) {
    warn(`${post.slug}: readTime "${declared}" vs estimated "${estimated}" — update landingBlogPosts.js`);
  }

  const ex = excerptQuality(post.excerpt);
  if (!ex.ok) warn(`${post.slug}: ${ex.reason}`);

  const { broken, found } = extractBlogLinks(body, SLUG_SET);
  if (broken.length) {
    fail(`${post.slug}: broken internal links → ${broken.join(", ")}`);
  }
  if (found.filter((s) => s !== post.slug).length < 2) {
    warn(`${post.slug}: fewer than 2 internal blog links (SEO cluster)`);
  }

  const voiceHits = checkBlogVoice(body);
  for (const h of voiceHits) {
    warn(`${post.slug}: voice — ${h.label}`);
  }

  const hasFigureCaption = /!\[[^\]]*\]\([^)]+ "[^"]+"\)/.test(body);
  if (!hasFigureCaption && words > 900) {
    warn(`${post.slug}: add inline image with caption — ![alt](url "Caption")`);
  }

  const faq = FAQ_MAIN_ENTITY_BY_SLUG[post.slug];
  if (!faq?.length) {
    fail(`missing FAQ_MAIN_ENTITY_BY_SLUG[${post.slug}]`);
  } else if (faq.length < 3) {
    warn(`${post.slug}: FAQ has ${faq.length} items (aim 3–5)`);
  } else {
    for (const row of faq) {
      const qPlain = String(row.name).replace(/\?\s*$/, "").trim();
      const bodyLower = body.toLowerCase();
      const qLower = qPlain.toLowerCase();
      const matched =
        (qLower.length >= 10 && bodyLower.includes(qLower)) ||
        (qLower.length >= 10 && bodyLower.includes(`**${qLower}**`));
      if (!matched && qLower.length >= 10) {
        warn(`${post.slug}: FAQ "${row.name}" may not match on-page FAQ section`);
      }
    }
  }

  if (!BLOG_POST_TAXONOMY[post.slug]) {
    fail(`missing BLOG_POST_TAXONOMY[${post.slug}]`);
  }
  if (!post.category) {
    fail(`missing category on post: ${post.slug}`);
  }
}

if (errors > 0) {
  console.error(`\nverify:blog failed — ${errors} error(s), ${warnings} warning(s).`);
  process.exit(1);
}

console.log(
  `verify:blog OK — ${LANDING_BLOG_POSTS.length} articles (${warnings} warning(s)).`,
);
