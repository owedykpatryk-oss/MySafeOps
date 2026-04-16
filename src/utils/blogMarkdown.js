/**
 * Strip marketing meta block before the first markdown H1 (SEO lines, word counts).
 * @param {string} md
 */
export function stripBlogPreamble(md) {
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
 * Use local /blog/images and in-app /blog/* routes instead of mysafeops.com placeholders.
 * @param {string} md
 */
export function rewriteBlogAssetUrls(md) {
  return String(md)
    .replaceAll("https://mysafeops.com/blog/images/", "/blog/images/")
    .replaceAll("http://mysafeops.com/blog/images/", "/blog/images/")
    .replaceAll("https://mysafeops.com/blog/", "/blog/")
    .replaceAll("http://mysafeops.com/blog/", "/blog/");
}

/**
 * @param {string} raw
 */
export function prepareBlogMarkdown(raw) {
  return rewriteBlogAssetUrls(stripBlogPreamble(raw));
}
