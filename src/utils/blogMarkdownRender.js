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
  return { html, toc: [...tocBuild] };
}

/**
 * Ensure inline images defer loading (safe after DOMPurify).
 * @param {string} html
 */
export function addLazyLoadingToBlogImages(html) {
  return html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async" ');
}
