/** @typedef {{ slug: string; name: string; description: string }} BlogCategory */

/** @type {BlogCategory[]} */
export const BLOG_CATEGORIES = [
  {
    slug: "permits",
    name: "Permits to work",
    description: "Hot work, confined space, height, and digital PTW workflows for UK sites.",
  },
  {
    slug: "rams-compliance",
    name: "RAMS & compliance",
    description: "RAMS, CDM 2015, RIDDOR, and regulatory updates for UK construction.",
  },
  {
    slug: "site-operations",
    name: "Site operations",
    description: "Inductions, toolbox talks, scaffolding, and day-to-day site safety.",
  },
  {
    slug: "registers",
    name: "Registers",
    description: "COSHH, equipment, and digital register management.",
  },
  {
    slug: "product",
    name: "Software & comparisons",
    description: "Platform comparisons, pricing models, and adoption on UK sites.",
  },
];

const BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));

/** @param {string | undefined} slug */
export function getCategoryBySlug(slug) {
  return slug ? BY_SLUG.get(slug) : undefined;
}
