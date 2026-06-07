/**
 * Scaffold + auto-register a new MySafeOps blog post (Cursor workflow).
 *
 * Usage:
 *   npm run blog:new -- --slug=my-topic-uk --title="My Topic UK" --category=permits --excerpt="Short meta description for Google"
 *
 * Creates: DOCS draft, live stub, registry entries, FAQ stub, placeholder hero, image prompt.
 * Then: write content → npm run blog:sync -- <slug> → npm run blog:publish -- <slug>
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, copyFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dateLabelFromIso,
  defaultHeroSource,
  estimateReadingTimeLabel,
} from "./lib/blog-workflow-utils.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=").trim() : "";
}

const slug = arg("slug").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
const title = arg("title");
const category = arg("category") || "site-operations";
const excerpt = arg("excerpt") || `[Write 120–160 char excerpt for ${title}]`;
const featured = arg("featured") === "true";

if (!slug || !title) {
  console.error(
    'Usage: npm run blog:new -- --slug=my-topic-uk --title="My Topic" [--category=permits] [--excerpt="..."] [--featured=true]',
  );
  process.exit(1);
}

const validCategories = ["permits", "rams-compliance", "site-operations", "registers", "product"];
if (!validCategories.includes(category)) {
  console.error(`Invalid category. Use one of: ${validCategories.join(", ")}`);
  process.exit(1);
}

const postsPath = join(root, "src", "blog", "posts", `${slug}.md`);
if (existsSync(postsPath)) {
  console.error(`Already exists: ${postsPath}`);
  process.exit(1);
}

const landingPath = join(root, "src", "data", "landingBlogPosts.js");
if (readFileSync(landingPath, "utf8").includes(`slug: "${slug}"`)) {
  console.error(`Slug already in landingBlogPosts.js: ${slug}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const dateLabel = dateLabelFromIso(today);
const readTime = estimateReadingTimeLabel("# stub");

// DOCS draft
const blogDocs = join(root, "DOCS", "Blog");
const articleDirs = readdirSync(blogDocs, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^Article \d+$/.test(d.name))
  .map((d) => parseInt(d.name.replace("Article ", ""), 10))
  .filter(Number.isFinite);
const nextNum = (articleDirs.length ? Math.max(...articleDirs) : 0) + 1;
const articleDir = join(blogDocs, `Article ${nextNum}`);
mkdirSync(articleDir, { recursive: true });

const draftName = `${String(nextNum).padStart(2, "0")}-${slug}.md`;
const draftPath = join(articleDir, draftName);

const draft = `**Title:** ${title}

**Meta description:** ${excerpt}

**Target keyword:** ${slug.replace(/-/g, " ")}

---

# ${title}

*By the MySafeOps team · Last updated ${today} · ${readTime}*

> **Key takeaways**
> - [Point 1]
> - [Point 2]
> - [Point 3]

---

**Table of contents**
- [Section one](#section-one)
- [FAQ](#faq)

---

[Opening paragraph — UK construction context.]

## Section one

[Body. Link to [permit to work app UK](https://mysafeops.com/blog/permit-to-work-app-uk).]

> 💡 **MySafeOps**
> [Product tie-in — free worker accounts.]
> [Start free at mysafeops.com →](https://mysafeops.com/login)

## FAQ

### Question one?

Answer.

### Question two?

Answer.

### Question three?

Answer.

---

**See also:** [Permit to work app UK](https://mysafeops.com/blog/permit-to-work-app-uk)

**Disclaimer:** General information only — not legal advice.

---

## Schema.org structured data (for CMS / SEO plugin)

Copy FAQ to src/data/blogFaqJsonLd.js
`;

const live = `# ${title}

*By the MySafeOps team · Last updated ${today} · ${readTime}*

> **Key takeaways**
> - [Point 1]
> - [Point 2]

![${title}](/blog/images/${slug}-hero.png)

---

**Table of contents**
- [Section one](#section-one)
- [FAQ](#faq)

---

[Content — run: npm run blog:sync -- ${slug} after editing DOCS draft]

## FAQ

### Question one?

Answer.

---

**See also:** [Permit to work app UK](/blog/permit-to-work-app-uk)

**Disclaimer:** General information only — not legal advice.
`;

writeFileSync(draftPath, draft, "utf8");
writeFileSync(postsPath, live, "utf8");

// Hero placeholder
const heroDir = join(root, "public", "blog", "images");
const heroName = `${slug}-hero.png`;
const heroPath = join(heroDir, heroName);
if (!existsSync(heroPath)) {
  const srcHero = join(heroDir, defaultHeroSource(category));
  if (existsSync(srcHero)) {
    copyFileSync(srcHero, heroPath);
  }
}

// landingBlogPosts.js
const entry = `  {
    slug: "${slug}",
    title: "${title.replace(/"/g, '\\"')}",
    excerpt:
      "${excerpt.replace(/"/g, '\\"')}",
    dateLabel: "${dateLabel}",
    publishedIso: "${today}",
    readTime: "${readTime}",
    image: "/blog/images/${slug}-hero.png",
  },`;

let landing = readFileSync(landingPath, "utf8");
landing = landing.replace(
  "\n];\n\n/** @type {BlogPostMeta[]} */\nexport const LANDING_BLOG_POSTS",
  `,\n${entry}\n];\n\n/** @type {BlogPostMeta[]} */\nexport const LANDING_BLOG_POSTS`,
);
writeFileSync(landingPath, landing, "utf8");

// blogPostTaxonomy.js
const taxPath = join(root, "src", "data", "blogPostTaxonomy.js");
const taxEntry = `  "${slug}": {
    category: "${category}",
    tags: ["${slug.split("-").slice(0, 2).join("-")}", "uk"],
    featured: ${featured},
  },`;
let tax = readFileSync(taxPath, "utf8");
tax = tax.replace("\n};\n\n/** @param {string} slug */", `,\n${taxEntry}\n};\n\n/** @param {string} slug */`);
writeFileSync(taxPath, tax, "utf8");

// blogFaqJsonLd.js stub
const faqPath = join(root, "src", "data", "blogFaqJsonLd.js");
const faqEntry = `  "${slug}": [
    {
      name: "Question one about ${title.replace(/"/g, "")}?",
      text: "Replace with a concise UK construction answer aligned with the on-page FAQ.",
    },
    {
      name: "Question two?",
      text: "Replace with a concise answer.",
    },
    {
      name: "Question three?",
      text: "Replace with a concise answer.",
    },
  ],`;
let faq = readFileSync(faqPath, "utf8");
faq = faq.replace("\n};\n\n/** @param {string | undefined} slug */", `,\n${faqEntry}\n};\n\n/** @param {string | undefined} slug */`);
writeFileSync(faqPath, faq, "utf8");

spawnSync("node", ["scripts/generate-image-prompt.mjs", slug], { cwd: root, stdio: "inherit" });

console.log(`
✓ Scaffolded "${slug}"

  DOCS:  ${draftPath}
  Live:  ${postsPath}
  Hero:  public/blog/images/${slug}-hero.png (placeholder — replace after Midjourney)
  Registered in landingBlogPosts.js, blogPostTaxonomy.js, blogFaqJsonLd.js

Next:
  1. Edit DOCS draft (full article + real FAQ)
  2. npm run blog:sync -- ${slug}
  3. npm run blog:publish -- ${slug}
`);
