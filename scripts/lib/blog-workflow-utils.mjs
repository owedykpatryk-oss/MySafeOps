/**
 * Shared helpers for blog publish workflow (Node scripts only).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WORDS_PER_MINUTE = 220;

/** @param {string} md */
export function estimateReadingTimeLabel(md) {
  const words = String(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\[\]()!|`~-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

/** @param {string} iso YYYY-MM-DD */
export function dateLabelFromIso(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** @param {string} md */
export function countWords(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\[\]()!|`~-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {string} md
 * @param {Set<string>} validSlugs
 */
export function extractBlogLinks(md, validSlugs) {
  const found = new Set();
  const broken = [];
  const re = /(?:https?:\/\/(?:www\.)?mysafeops\.com)?\/blog\/(?!images\/)([a-z0-9-]+)/gi;
  let m;
  while ((m = re.exec(md)) !== null) {
    const slug = m[1].toLowerCase();
    if (slug === "blog" || slug === "rss") continue;
    found.add(slug);
    if (!validSlugs.has(slug)) broken.push(slug);
  }
  return { found: [...found], broken };
}

/** @param {string} excerpt */
export function excerptQuality(excerpt) {
  const len = String(excerpt || "").trim().length;
  if (len < 80) return { ok: false, reason: `excerpt too short (${len} chars, aim 120–160)` };
  if (len > 200) return { ok: false, reason: `excerpt too long (${len} chars, aim 120–160)` };
  return { ok: true };
}

/**
 * Find DOCS/Blog draft for slug (glob match on filename).
 * @param {string} root
 * @param {string} slug
 */
export function findDocsDraft(root, slug) {
  const blogRoot = join(root, "DOCS", "Blog");
  if (!existsSync(blogRoot)) return null;

  /** @type {string[]} */
  const matches = [];

  function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "distribution" || ent.name === "prompts") continue;
        walk(full);
      } else if (ent.name.endsWith(".md") && ent.name.includes(slug)) {
        matches.push(full);
      }
    }
  }
  walk(blogRoot);

  if (!matches.length) return null;
  matches.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return matches[0];
}

/** Strip marketing preamble before first H1 (mirrors src/utils/blogMarkdown.js). */
export function stripPreamble(md) {
  const lines = String(md).split("\n");
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s+/.test(lines[i])) {
      start = i;
      break;
    }
  }
  return lines.slice(start).join("\n").trim();
}

/**
 * @param {string} raw DOCS draft
 * @param {{ alt: string; heroPath: string }} hero
 * @param {string} seeAlsoLine
 */
export function transformDocsToLive(raw, hero, seeAlsoLine) {
  let t = raw.split(/\r?\n## Schema\.org structured data/)[0].trimEnd();
  t = t.replace(/\r\n/g, "\n");

  const h1 = t.indexOf("# ");
  if (h1 === -1) throw new Error("No H1 in draft");
  const anchor = "\n\n---\n\n**Table of contents**";
  const j = t.indexOf(anchor, h1);
  if (j === -1) throw new Error("No TOC block (--- then **Table of contents**)");

  const insert = `\n\n![${hero.alt}](${hero.heroPath})`;
  t = t.slice(0, j) + insert + t.slice(j);

  t = t.replace(
    /\*\*(?:Internal link suggestions:|See also \(when syncing to app\):|See also:)\*\*[\s\S]*?(?=\*\*Disclaimer:\*\*)/,
    `${seeAlsoLine}\n\n`,
  );

  t = t.replaceAll("https://mysafeops.com/blog/", "/blog/");
  t = t.replaceAll("http://mysafeops.com/blog/", "/blog/");
  t = t.replaceAll("https://mysafeops.com/blog/images/", "/blog/images/");

  return `${t.trimEnd()}\n`;
}

/** @param {string} category */
export function defaultHeroSource(category) {
  const map = {
    permits: "permit-to-work-app-uk-hero.png",
    "rams-compliance": "how-to-write-a-rams-uk-hero.png",
    "site-operations": "digital-toolbox-talks-hero.png",
    registers: "coshh-register-software-uk-hero.png",
    product: "free-safety-app-hero.png",
  };
  return map[category] || "permit-to-work-app-uk-hero.png";
}
