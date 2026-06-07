const WORDS_PER_MINUTE = 220;

/**
 * Estimate reading time label from plain text or markdown.
 * @param {string} text
 * @returns {string} e.g. "6 min read"
 */
export function estimateReadingTime(text) {
  const words = String(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\[\]()!|`~-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}
