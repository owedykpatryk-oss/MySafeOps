import { marked } from "marked";
import { prepareBlogMarkdown } from "./blogMarkdown";

const slugCounts = new Map();

export function resetBlogHeadingSlugs() {
  slugCounts.clear();
}

/**
 * @param {string} plain
 */
function slugifyBlogHeading(plain) {
  const base =
    String(plain)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
  const n = (slugCounts.get(base) || 0) + 1;
  slugCounts.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

/**
 * @param {string} raw
 */
function tocPlainText(raw) {
  return String(raw)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .trim();
}

/** @type {{ level: number; text: string; id: string }[]} */
let tocBuild = [];

marked.use({
  extensions: [
    {
      name: "heading",
      renderer(token) {
        if (token.depth < 2 || token.depth > 3) return false;
        const textHtml = this.parser.parseInline(token.tokens);
        const id = slugifyBlogHeading(token.text);
        tocBuild.push({
          level: token.depth,
          text: tocPlainText(token.text),
          id,
        });
        return `<h${token.depth} id="${id}">${textHtml}</h${token.depth}>\n`;
      },
    },
  ],
});

/**
 * @param {string} rawMarkdown
 * @returns {{ html: string; toc: { level: number; text: string; id: string }[] }}
 */
export function parseBlogPostHtml(rawMarkdown) {
  resetBlogHeadingSlugs();
  tocBuild = [];
  const prepared = prepareBlogMarkdown(rawMarkdown);
  const out = marked.parse(prepared, { async: false, gfm: true });
  const html = typeof out === "string" ? out : String(out);
  return { html: wrapBlogTables(html), toc: [...tocBuild] };
}

/**
 * Horizontal scroll on narrow viewports without breaking table layout.
 * @param {string} html
 */
function wrapBlogTables(html) {
  return html.replace(/<table[\s\S]*?<\/table>/gi, (table) => `<div class="blog-article-table-wrap">${table}</div>`);
}

/**
 * Ensure inline images defer loading (safe after DOMPurify).
 * @param {string} html
 */
export function addLazyLoadingToBlogImages(html) {
  return html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" ');
}

/**
 * Adds `target="_blank"` and `rel="noopener noreferrer"` to external links in rendered HTML.
 * Safe to run in the browser after DOMPurify (call only when `window` exists).
 * @param {string} html
 */
export function addExternalLinkAttributes(html) {
  if (typeof window === "undefined") return html;
  return html.replace(/<a\b([^>]*?)>/gi, (full, attrs) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) return full;
    const href = hrefMatch[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return full;
    let u;
    try {
      u = new URL(href, window.location.href);
    } catch {
      return full;
    }
    if (u.origin === window.location.origin) return full;
    if (/\brel\s*=/.test(attrs)) return full;
    if (/\btarget\s*=/.test(attrs)) {
      return `<a${attrs} rel="noopener noreferrer">`;
    }
    return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
  });
}
