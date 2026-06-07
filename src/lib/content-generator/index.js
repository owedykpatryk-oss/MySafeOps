/** @param {string} title */
export function generateSlug(title) {
  return String(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export { estimateReadingTime } from "../blog/estimateReadingTime.js";
export { createInternalLinks, formatInternalLinksMarkdown } from "../seo/createInternalLinks.js";

/**
 * Stub outline generator — replace with AI provider call in admin pipeline.
 * @param {{ keyword: string; audience?: string }} input
 */
export function generateOutline(input) {
  const kw = String(input.keyword || "topic").trim();
  return {
    title: `${kw}: practical guide`,
    sections: [
      "Introduction and key takeaways",
      `What ${kw} means on UK construction sites`,
      "Common mistakes and how to avoid them",
      "Checklist for site managers",
      "FAQ",
    ],
  };
}

/**
 * @param {{ title: string; keyword: string; category?: string }} input
 */
export function suggestKeywords(input) {
  const base = String(input.keyword || "").trim().toLowerCase();
  return [base, `${base} uk`, `${base} construction`, `${base} 2026`].filter(Boolean);
}

/**
 * @param {{ slug: string; question: string; context?: string }} input
 */
export function generateFAQ(input) {
  return [
    {
      name: `What is ${input.question}?`,
      text: `A concise UK construction answer about ${input.slug.replace(/-/g, " ")}.`,
    },
  ];
}

/**
 * Placeholder for full AI article draft — wired to Anthropic proxy in a later phase.
 * @param {{ outline: ReturnType<typeof generateOutline>; keyword: string }} input
 */
export async function createArticle(input) {
  const sections = input.outline.sections.map((h) => `## ${h}\n\nDraft content for ${input.keyword}.`).join("\n\n");
  return `# ${input.outline.title}\n\n${sections}\n`;
}

export { generateOutline as generateArticleOutline };
