const WORDS_PER_MINUTE = 220;

/**
 * @param {number|string} minutesOrLabel
 * @param {import("../../config/markets").MarketId | string} [marketId]
 * @returns {string}
 */
export function formatReadingTimeLabel(minutesOrLabel, marketId = "uk") {
  const minutes =
    typeof minutesOrLabel === "number"
      ? Math.max(1, Math.round(minutesOrLabel))
      : Math.max(1, Number.parseInt(String(minutesOrLabel).match(/\d+/)?.[0] || "1", 10));
  if (marketId === "pl") return `${minutes} min czytania`;
  return `${minutes} min read`;
}

/**
 * Estimate reading time label from plain text or markdown.
 * @param {string} text
 * @param {import("../../config/markets").MarketId | string} [marketId]
 * @returns {string} e.g. "6 min read" / "6 min czytania"
 */
export function estimateReadingTime(text, marketId = "uk") {
  const words = String(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_[\]()`!|`~-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  return formatReadingTimeLabel(minutes, marketId);
}
