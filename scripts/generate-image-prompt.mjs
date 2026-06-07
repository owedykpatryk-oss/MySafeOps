/**
 * Image briefs: hero + 2 inline visuals (documentary UK construction, no text in image).
 * Usage: npm run blog:prompt -- {slug}
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_BLOG_POSTS } from "../src/data/landingBlogPosts.js";
import { BLOG_CATEGORIES } from "../src/lib/blog/categories.js";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run blog:prompt -- <slug>");
  process.exit(1);
}

const post = LANDING_BLOG_POSTS.find((p) => p.slug === slug);
if (!post) {
  console.error(`Unknown slug: ${slug}`);
  process.exit(1);
}

const category = BLOG_CATEGORIES.find((c) => c.slug === post.category);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "DOCS", "Blog", "prompts");
mkdirSync(outDir, { recursive: true });

const styleBlock = `Premium editorial documentary photography, UK construction site.
Natural late-afternoon light, shallow depth of field, realistic worn materials (scuffed hi-vis, scratched metal, muddy boots).
NOT stock photo: no handshakes, no fake smiles, no pristine PPE, no clip-art icons.
NO text, logos, watermarks, or readable documents in frame.`;

const prompt = `# Image brief — ${post.title}

**Slug:** \`${slug}\`  
**Category:** ${category?.name || post.category}

## Files to create

| File | Size | Use |
|------|------|-----|
| \`public/blog/images/${slug}-hero.png\` | 1600×900 | Card + OpenGraph |
| \`public/blog/images/${slug}-inline.png\` | 1200×800 | Mid-article detail |
| \`public/blog/images/${slug}-visual-02.png\` | 1200×800 | Optional second visual |

---

## 1. Hero (${slug}-hero.png)

Wide or medium environmental shot for: **${post.title}**

${styleBlock}

Subject: ${post.excerpt}

Composition: leave clean space for web crop; human scale (operative, supervisor, or hands-with-tools) preferred over empty site.

Midjourney example:
\`\`\`
${styleBlock.replace(/\n/g, " ")} Subject: ${post.title}. Wide shot UK building site. --ar 16:9 --style raw
\`\`\`

**Alt text:** ${post.title} — UK construction safety guide

---

## 2. Inline detail (${slug}-inline.png)

Close-up flat lay or over-shoulder: tools, tags, permit clipboard, gas monitor, scaffold clip — **topic-specific**, not generic.

${styleBlock}

**Markdown:**
\`\`\`markdown
![${post.title} detail](/blog/images/${slug}-inline.png "Caption: one sentence — what this photo proves on site")
\`\`\`

---

## 3. Optional workflow visual (${slug}-visual-02.png)

Diagram-like **photo** (not illustration): sequence on desk — issued permit, signed RAMS, isolation lock — shallow DOF, still no readable text.

---

## After export

1. Save PNGs to \`public/blog/images/\`
2. Add inline image to markdown with caption (title attribute)
3. \`npm run verify:blog\`
`;

writeFileSync(join(outDir, `${slug}.md`), prompt, "utf8");
console.log(`Wrote ${join(outDir, `${slug}.md`)}`);
