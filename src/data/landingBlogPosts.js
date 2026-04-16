/**
 * Marketing blog guides shown on the landing page and /blog index.
 * Images: public/blog/images/*-hero.png
 * Full text: public/blog/posts/{slug}.md
 */
export const LANDING_BLOG_POSTS = [
  {
    slug: "permit-to-work-app-uk",
    title: "Permit to Work App UK: What Good Digital PTW Actually Looks Like",
    excerpt:
      "A practical guide to choosing a permit to work app for UK construction. Hot work, height, confined space and electrical permits — what matters and what is hype.",
    dateLabel: "Apr 2026",
    readTime: "6 min read",
    image: "/blog/images/permit-to-work-app-uk-hero.png",
  },
  {
    slug: "hot-work-permit-uk",
    title: "Hot Work Permit UK: A Practical Guide for Construction Sites",
    excerpt:
      "What a hot work permit must include, common mistakes, and how digital permits help close out the fire watch properly.",
    dateLabel: "Apr 2026",
    readTime: "5 min read",
    image: "/blog/images/hot-work-permit-uk-hero.png",
  },
  {
    slug: "confined-space-permit-uk",
    title: "Confined Space Permit UK: The Controls That Actually Save Lives",
    excerpt:
      "Atmospheric testing, rescue plans, and why digital permits keep arrangements visible when it matters.",
    dateLabel: "Apr 2026",
    readTime: "6 min read",
    image: "/blog/images/confined-space-permit-uk-hero.png",
  },
  {
    slug: "digital-toolbox-talks",
    title: "Digital Toolbox Talks: How UK Construction Teams Are Ditching the Paper Register",
    excerpt:
      "Why teams move toolbox talks to mobile apps, what HSE expects from records, and briefings workers actually engage with.",
    dateLabel: "Apr 2026",
    readTime: "5 min read",
    image: "/blog/images/digital-toolbox-talks-hero.png",
  },
  {
    slug: "site-induction-software-uk",
    title: "Site Induction Software: Making the First 20 Minutes on Site Count",
    excerpt:
      "CDM 2015 induction duties, why paper fails audits, and what good induction software includes.",
    dateLabel: "Apr 2026",
    readTime: "5 min read",
    image: "/blog/images/site-induction-software-hero.png",
  },
  {
    slug: "coshh-register-software-uk",
    title: "COSHH Register Software UK: Managing Substances Without the Binder",
    excerpt:
      "Replacing paper COSHH registers with apps: SDS version control, search, and evidence at the point of work.",
    dateLabel: "Apr 2026",
    readTime: "5 min read",
    image: "/blog/images/coshh-register-software-uk-hero.png",
  },
  {
    slug: "free-safety-app-construction-workers",
    title: "Free Safety App for Construction Workers: Why Per-Seat Pricing Kills Adoption",
    excerpt:
      "How per-seat pricing breaks adoption on UK sites, and why free worker accounts keep permits and briefings honest.",
    dateLabel: "Apr 2026",
    readTime: "5 min read",
    image: "/blog/images/free-safety-app-hero.png",
  },
  {
    slug: "riddor-changes-2026",
    title: "RIDDOR Changes 2026: What UK Construction Firms Need to Know Before 30 June",
    excerpt:
      "HSE consultation on reporting injuries and ill health: dangerous occurrences, diseases, and the response window.",
    dateLabel: "Apr 2026",
    readTime: "7 min read",
    image: "/blog/images/riddor-changes-2026-hero.png",
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
