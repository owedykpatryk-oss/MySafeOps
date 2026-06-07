import { getTaxonomyForSlug } from "./blogPostTaxonomy.js";

/**
 * @typedef {{
 *   slug: string;
 *   title: string;
 *   excerpt: string;
 *   jsonLdDescription?: string;
 *   dateLabel: string;
 *   publishedIso: string;
 *   readTime: string;
 *   image: string;
 *   category: string;
 *   tags: string[];
 *   project: string;
 *   featured: boolean;
 * }} BlogPostMeta
 */

/**
 * Marketing blog guides shown on the landing page and /blog index.
 * Hero images: public/blog/images/ (paths in `image` below; also inline-* for article body).
 * Full text (bundled): src/blog/posts/{slug}.md
 */
const RAW_LANDING_BLOG_POSTS = [
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
    readTime: "6 min read",
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
    readTime: "12 min read",
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
  {
    slug: "how-to-write-a-rams-uk",
    title: "How to Write a RAMS: UK Construction Guide + Free Template for 2026",
    excerpt:
      "Step-by-step RAMS for UK sites: risk matrix, method statement, common failures, and a template structure that passes principal-contractor scrutiny.",
    jsonLdDescription:
      "Step-by-step guide to writing a RAMS for UK construction. Real examples, template structure, CDM alignment and what inspectors typically look for.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-22",
    readTime: "16 min read",
    image: "/blog/images/how-to-write-a-rams-uk-hero.png",
  },
  {
    slug: "cdm-2015-small-contractor-uk",
    title: "CDM 2015 for Small Contractors: Plain English Guide + Free Template 2026",
    excerpt:
      "What CDM 2015 actually requires from sole traders and small firms: contractor duties, the domestic-client trap, and a Construction Phase Plan you can use.",
    jsonLdDescription:
      "Plain English CDM 2015 guide for small UK contractors: legal duties, Construction Phase Plan content, and common prosecution triggers.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-22",
    readTime: "14 min read",
    image: "/blog/images/cdm-2015-small-contractor-uk-hero.png",
  },
  {
    slug: "scaffold-inspection-checklist-uk",
    title: "Scaffold Inspection Checklist UK: Weekly Register + Free Template 2026",
    excerpt:
      "Work at Height rules, the 7-day inspection cycle, competence, tags, and a register format that survives HSE and client audits.",
    jsonLdDescription:
      "Scaffold inspection checklist for UK construction: WAHR 2005, weekly register, competent persons, tags, and template structure.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-22",
    readTime: "13 min read",
    image: "/blog/images/scaffold-inspection-checklist-uk-hero.png",
  },
  {
    slug: "paper-vs-digital-rams-uk",
    title: "Paper vs Digital RAMS: Real Cost Comparison for UK Contractors 2026",
    excerpt:
      "Paper RAMS admin time vs digital subscriptions: scenarios for small, mid-size and larger UK contractors, hidden costs, and break-even maths.",
    jsonLdDescription:
      "Honest cost comparison between paper and digital RAMS for UK construction: time, audit prep, platform pricing bands, and when digital pays back.",
    dateLabel: "Apr 2026",
    publishedIso: "2026-04-22",
    readTime: "13 min read",
    image: "/blog/images/paper-vs-digital-rams-uk-hero.png",
  },
  {
    slug: "height-work-permit-uk",
    title: "Height Work Permit UK: Work at Height Regulations 2005 in Practice",
    excerpt:
      "When to issue a height work permit, what WAHR expects on UK sites, and how MEWP, scaffolding and fragile roof work fit your PTW system.",
    jsonLdDescription:
      "Height work permit guide for UK construction: Work at Height Regulations 2005, MEWP, edge protection, rescue and digital PTW.",
    dateLabel: "Jun 2026",
    publishedIso: "2026-06-07",
    readTime: "7 min read",
    image: "/blog/images/height-work-permit-uk-hero.png",
  },
  {
    slug: "excavation-permit-uk",
    title: "Excavation Permit UK: What to Check Before Breaking Ground",
    excerpt:
      "Utility strikes, Cat & Genny, shoring and handback — what a UK excavation permit must cover before the first dig.",
    jsonLdDescription:
      "Excavation permit UK guide: HSG47, buried services, safe dig methods, shoring and digital permit records for construction.",
    dateLabel: "Jun 2026",
    publishedIso: "2026-06-07",
    readTime: "6 min read",
    image: "/blog/images/excavation-permit-uk-hero.png",
  },
  {
    slug: "lifting-operations-permit-uk",
    title: "Lifting Operations Permit UK: LOLER 1998 in Practice on Site",
    excerpt:
      "Lift plans, thorough examination, exclusion zones and appointed person sign-off — how lifting permits work on UK construction sites.",
    jsonLdDescription:
      "Lifting operations permit UK: LOLER 1998, crane lift planning, examination records and site authorisation for construction lifts.",
    dateLabel: "Jun 2026",
    publishedIso: "2026-06-07",
    readTime: "7 min read",
    image: "/blog/images/lifting-operations-permit-uk-hero.png",
  },
  {
    slug: "electrical-isolation-permit-uk",
    title: "Electrical Isolation Permit UK: LOTO and Live Work in Practice",
    excerpt:
      "Lock-out tag-out, proving dead, and authorised person sign-off — what a UK electrical isolation permit must cover before live work starts.",
    dateLabel: "Jun 2026",
    publishedIso: "2026-06-07",
    readTime: "7 min read",
    jsonLdDescription:
      "Electrical isolation permit UK: lock-out tag-out, proving dead, authorised person sign-off and live work controls under the Electricity at Work Regulations 1989.",
    image: "/blog/images/electrical-isolation-permit-uk-hero.png",
  },
];

/** @type {BlogPostMeta[]} */
export const LANDING_BLOG_POSTS = RAW_LANDING_BLOG_POSTS.map((post) => {
  const tax = getTaxonomyForSlug(post.slug);
  return {
    ...post,
    category: tax.category,
    tags: tax.tags,
    project: "mysafeops",
    featured: tax.featured,
  };
});

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
 * Related guides: same category/tags first, then newest.
 * @param {string} currentSlug
 * @param {number} [limit]
 */
export function getRelatedBlogPosts(currentSlug, limit = 3) {
  const current = getPostMetaBySlug(currentSlug);
  if (!current) return [];

  const tagSet = new Set((current.tags || []).map((t) => t.toLowerCase()));

  return [...LANDING_BLOG_POSTS]
    .filter((p) => p.slug !== currentSlug)
    .map((p) => {
      let score = 0;
      if (p.category === current.category) score += 3;
      for (const t of p.tags || []) {
        if (tagSet.has(t.toLowerCase())) score += 2;
      }
      return { post: p, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const d = String(b.post.publishedIso || "").localeCompare(String(a.post.publishedIso || ""));
      if (d !== 0) return d;
      return a.post.slug.localeCompare(b.post.slug);
    })
    .slice(0, limit)
    .map(({ post }) => post);
}
