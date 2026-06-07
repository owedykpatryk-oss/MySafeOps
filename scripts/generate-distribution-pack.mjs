/**
 * Generate a social/distribution pack for promoting one blog article.
 *
 * Usage: npm run blog:distribution -- permit-to-work-app-uk
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run blog:distribution -- <slug>");
  process.exit(1);
}

const post = LANDING_BLOG_POSTS.find((p) => p.slug === slug);
if (!post) {
  console.error(`Unknown slug: ${slug}`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = (process.env.VITE_PUBLIC_SITE_URL || "https://mysafeops.com").replace(/\/$/, "");
const url = `${origin}/blog/${slug}`;

const pack = `# Distribution pack — ${post.title}

**URL:** ${url}
**Excerpt:** ${post.excerpt}

---

## LinkedIn (short)

${post.excerpt}

Read the full guide → ${url}

#UKConstruction #HealthAndSafety #Construction

---

## LinkedIn (long)

Most UK sites still [pain point from article topic].

We wrote a practical guide for site managers and H&S leads:

→ ${post.title}
${url}

Free worker accounts matter when you need adoption, not shelfware. MySafeOps — RAMS, permits, toolbox talks in one place.

---

## X / Twitter

${post.title.slice(0, 100)}${post.title.length > 100 ? "…" : ""}

${url}

---

## WhatsApp / SMS to prospect

Hi — thought this might help on [project/site]: ${url} (${post.readTime}). Shout if you want a 10-min walkthrough of MySafeOps.

---

## Email subject lines

- ${post.title}
- UK construction: ${post.tags?.[0] || "safety"} guide (${post.readTime})
- Quick read for your next site meeting

---

## UTM links (optional)

${url}?utm_source=linkedin&utm_medium=social&utm_campaign=blog_${slug}
`;

const outDir = join(root, "DOCS", "Blog", "distribution");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${slug}.md`);
writeFileSync(outPath, pack, "utf8");
console.log(`Wrote ${outPath}`);
