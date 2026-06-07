/**
 * Image generation provider abstraction.
 * Implementations: openai, replicate, stability (future).
 */

/** @typedef {"openai" | "replicate" | "stability"} ImageProviderId */

/**
 * @param {string} slug
 * @param {{ title: string; excerpt?: string; style?: string }} article
 */
export function buildCoverPrompt(article) {
  const style = article.style || "premium editorial photography, natural light, UK construction site";
  return `${style}, no text, no logos, no watermarks. Topic: ${article.title}. ${article.excerpt || ""}`.trim();
}

/**
 * @param {ImageProviderId} provider
 * @returns {boolean}
 */
export function isImageProviderConfigured(provider) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (provider === "openai") return Boolean(import.meta.env.VITE_OPENAI_API_KEY);
    if (provider === "replicate") return Boolean(import.meta.env.VITE_REPLICATE_API_TOKEN);
    if (provider === "stability") return Boolean(import.meta.env.VITE_STABILITY_API_KEY);
  }
  return false;
}

/**
 * Generate cover image metadata (actual generation requires server-side keys).
 * @param {string} slug
 * @param {{ title: string; excerpt?: string }} article
 */
export async function createCoverImage(slug, article) {
  const prompt = buildCoverPrompt(article);
  return {
    slug,
    path: `/blog/${slug}/cover.webp`,
    width: 1600,
    height: 900,
    prompt,
    alt: generateAltText({ title: article.title, role: "cover" }),
    status: "pending",
  };
}

/**
 * @param {string} slug
 * @param {{ title: string; sections?: string[] }} article
 * @param {number} [count]
 */
export async function createArticleVisuals(slug, article, count = 2) {
  const visuals = [];
  for (let i = 0; i < count; i += 1) {
    visuals.push({
      slug,
      path: `/blog/${slug}/visual-${String(i + 1).padStart(2, "0")}.webp`,
      prompt: `${buildCoverPrompt(article)} — supporting visual ${i + 1}, diagram-like composition without text`,
      alt: generateAltText({ title: article.title, role: "visual", index: i + 1 }),
      status: "pending",
    });
  }
  return visuals;
}

/**
 * @param {{ bytes: ArrayBuffer | Uint8Array; maxWidth?: number; quality?: number }} input
 * @returns {Promise<{ format: string; note: string }>}
 */
export async function optimizeImage(input) {
  void input;
  return {
    format: "webp",
    note: "Use build-time Sharp script or CDN image optimization in production.",
  };
}

/**
 * @param {{ title: string; role?: "cover" | "visual"; index?: number }} input
 */
export function generateAltText(input) {
  const base = input.title.replace(/\s+/g, " ").trim();
  if (input.role === "cover") {
    return `${base} — UK construction safety guide cover image`;
  }
  if (input.role === "visual") {
    return `${base} — supporting illustration ${input.index || 1}`;
  }
  return base;
}
