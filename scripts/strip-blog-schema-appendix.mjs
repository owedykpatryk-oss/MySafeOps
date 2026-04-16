/**
 * One-off / maintenance: remove visible "Schema.org structured data" appendix from
 * src/blog/posts/*.md and sync FAQ JSON-LD data into src/data/blogFaqJsonLd.js.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const postsDir = path.join(root, "src/blog/posts");
const faqFile = path.join(root, "src/data/blogFaqJsonLd.js");
const marker = "\n---\n\n## Schema.org structured data (for CMS / SEO plugin)";

const bySlug = {};

for (const f of fs.readdirSync(postsDir)) {
  if (!f.endsWith(".md")) continue;
  const slug = f.replace(/\.md$/, "");
  const filePath = path.join(postsDir, f);
  const full = fs.readFileSync(filePath, "utf8");
  const idx = full.indexOf(marker);
  if (idx === -1) {
    console.warn(`SKIP (no schema appendix): ${f}`);
    continue;
  }

  const appendix = full.slice(idx + marker.length);
  const jsonMatch = appendix.match(/```json\n([\s\S]*?)```/);
  if (!jsonMatch) {
    console.error(`No \`\`\`json FAQ block: ${f}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(jsonMatch[1]);
  } catch (e) {
    console.error(`JSON parse failed: ${f}`, e.message);
    process.exit(1);
  }

  if (data["@type"] !== "FAQPage" || !Array.isArray(data.mainEntity)) {
    console.error(`First JSON block is not FAQPage: ${f}`);
    process.exit(1);
  }

  bySlug[slug] = data.mainEntity.map((q) => ({
    name: q.name,
    text: q.acceptedAnswer.text,
  }));

  const stripped = full.slice(0, idx).replace(/\s+$/, "\n");
  fs.writeFileSync(filePath, stripped);
}

const sortedSlugs = Object.keys(bySlug).sort();
let out = `/**\n * FAQPage mainEntity entries keyed by blog slug (JSON-LD in document head only).\n */\nexport const FAQ_MAIN_ENTITY_BY_SLUG = {\n`;
for (const slug of sortedSlugs) {
  out += `  ${JSON.stringify(slug)}: [\n`;
  for (const row of bySlug[slug]) {
    out += `    {\n      name: ${JSON.stringify(row.name)},\n      text: ${JSON.stringify(row.text)},\n    },\n`;
  }
  out += `  ],\n`;
}
out += `};\n\n`;
out += `/** @param {string | undefined} slug */\n`;
out += `export function getFaqPageJsonLd(slug) {\n`;
out += `  const rows = slug ? FAQ_MAIN_ENTITY_BY_SLUG[slug] : null;\n`;
out += `  if (!rows?.length) return null;\n`;
out += `  return {\n`;
out += `    "@context": "https://schema.org",\n`;
out += `    "@type": "FAQPage",\n`;
out += `    mainEntity: rows.map((row) => ({\n`;
out += `      "@type": "Question",\n`;
out += `      name: row.name,\n`;
out += `      acceptedAnswer: {\n`;
out += `        "@type": "Answer",\n`;
out += `        text: row.text,\n`;
out += `      },\n`;
out += `    })),\n`;
out += `  };\n`;
out += `}\n`;

fs.writeFileSync(faqFile, out);
console.log(`Stripped schema appendix from ${sortedSlugs.length} posts; wrote ${path.relative(root, faqFile)}`);
