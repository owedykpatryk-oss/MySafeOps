/**
 * Serialize JSON-LD safely for inline <script type="application/ld+json"> injection.
 * Escapes `<` so user/content strings cannot break out of the script tag.
 *
 * @param {unknown} value
 */
export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
