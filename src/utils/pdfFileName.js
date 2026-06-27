/** Safe segment for PDF filenames (Windows-friendly). No heavy deps. */
export function sanitizePdfFileSegment(s, maxLen = 44) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}
