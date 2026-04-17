/**
 * Marketing blog guides shown on the landing page and /blog index.
 * Hero images: public/blog/images/ (paths in `image` below; also inline-* for article body).
 * Full text (bundled): src/blog/posts/{slug}.md
 */
export const LANDING_BLOG_POSTS = [
  {
    slug: "permit-to-work-app-uk",
    title: "Permit to Work App UK: What Good Digital PTW Actually Looks Like",
    excerpt:
      "A practical guide to choosing a permit to work app for UK construction. Hot work, height, confined space and electrical permits — what matters and what is hype.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "6 min read",
    image: "/blog/images/permit-to-work-app-uk-hero.png",
  },
  {
    slug: "hot-work-permit-uk",
    title: "Hot Work Permit UK: A Practical Guide for Construction Sites",
    excerpt:
      "What a hot work permit must include, common mistakes, and how digital permits help close out the fire watch properly.",
    jsonLdDescription:
      "What a hot work permit needs to include on UK construction sites, common mistakes, and how digital permits remove fire risk from welding and cutting jobs.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "5 min read",
    image: "/blog/images/hot-work-permit-uk-hero.png",
  },
  {
    slug: "confined-space-permit-uk",
    title: "Confined Space Permit UK: The Controls That Actually Save Lives",
    excerpt:
      "Atmospheric testing, rescue plans, and why digital permits keep arrangements visible when it matters.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "6 min read",
    image: "/blog/images/confined-space-permit-uk-hero.png",
  },
  {
    slug: "digital-toolbox-talks",
    title: "Digital Toolbox Talks: How UK Construction Teams Are Ditching the Paper Register",
    excerpt:
      "Why teams move toolbox talks to mobile apps, what HSE expects from records, and briefings workers actually engage with.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "5 min read",
    image: "/blog/images/digital-toolbox-talks-hero.png",
  },
  {
    slug: "site-induction-software-uk",
    title: "Site Induction Software: Making the First 20 Minutes on Site Count",
    excerpt:
      "CDM 2015 induction duties, why paper fails audits, and what good induction software includes.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "5 min read",
    image: "/blog/images/site-induction-software-hero.png",
  },
  {
    slug: "coshh-register-software-uk",
    title: "COSHH Register Software UK: Managing Substances Without the Binder",
    excerpt:
      "Replacing paper COSHH registers with apps: SDS version control, search, and evidence at the point of work.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "5 min read",
    image: "/blog/images/coshh-register-software-uk-hero.png",
  },
  {
    slug: "free-safety-app-construction-workers",
    title: "Free Safety App for Construction Workers: Why Per-Seat Pricing Kills Adoption",
    excerpt:
      "How per-seat pricing breaks adoption on UK sites, and why free worker accounts keep permits and briefings honest.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "5 min read",
    image: "/blog/images/free-safety-app-hero.png",
  },
  {
    slug: "riddor-changes-2026",
    title: "RIDDOR Changes 2026: What UK Construction Firms Need to Know Before 30 June",
    excerpt:
      "HSE consultation on reporting injuries and ill health: dangerous occurrences, diseases, and the response window.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "7 min read",
    image: "/blog/images/riddor-changes-2026-hero.png",
  },
  {
    slug: "safetyculture-alternative-uk",
    title: "SafetyCulture Alternative for UK Construction: Honest Comparison for 2026",
    excerpt:
      "Pricing, UK compliance fit, offline use and per-user cost: what to look for when replacing iAuditor on real UK sites.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "7 min read",
    image: "/blog/images/safetyculture-alternative-uk-hero.png",
  },
  {
    slug: "best-permit-to-work-software-uk-2026",
    title: "Best Permit to Work Software UK 2026: Honest Comparison for Construction Firms",
    excerpt:
      "Seven platforms UK firms actually shortlist: pricing, permit lifecycles, offline use and when each option makes sense.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-16",
    readTime: "9 min read",
    image: "/blog/images/best-permit-to-work-software-uk-2026-hero.png",
  },
];

const SLUG_SET = new Set(LANDING_BLOG_POSTS.map((p) => p.slug));

/** @param {string | undefined} slug */
export function isValidBlogSlug(slug) {
  return Boolean(slug && SLUG_SET.has(slug));
}

/** @param {string | undefined} slug */
export function getPostMetaBySlug(slug) {
  return LANDING_BLOG_POSTS.find((p) => p.slug === slug);
}

/**
 * Other guides for the article footer (newest first, stable tie-break).
 * @param {string} currentSlug
 * @param {number} [limit]
 */
export function getRelatedBlogPosts(currentSlug, limit = 3) {
  return [...LANDING_BLOG_POSTS]
    .filter((p) => p.slug !== currentSlug)
    .sort((a, b) => {
      const d = String(b.publishedIso || "").localeCompare(String(a.publishedIso || ""));
      if (d !== 0) return d;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, limit);
}
