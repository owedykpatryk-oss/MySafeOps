/**
 * Category, tags, and featured flags keyed by blog slug.
 * Keeps `LANDING_BLOG_POSTS` entries lean while enabling filters and internal linking.
 */
export const BLOG_POST_TAXONOMY = {
  "permit-to-work-app-uk": {
    category: "permits",
    tags: ["ptw", "digital", "uk", "construction"],
    featured: true,
  },
  "hot-work-permit-uk": {
    category: "permits",
    tags: ["hot-work", "fire-watch", "welding"],
    featured: true,
  },
  "confined-space-permit-uk": {
    category: "permits",
    tags: ["confined-space", "atmospheric-testing"],
    featured: false,
  },
  "digital-toolbox-talks": {
    category: "site-operations",
    tags: ["toolbox-talks", "briefings", "records"],
    featured: false,
  },
  "site-induction-software-uk": {
    category: "site-operations",
    tags: ["induction", "cdm", "onboarding"],
    featured: false,
  },
  "coshh-register-software-uk": {
    category: "registers",
    tags: ["coshh", "chemicals", "sds"],
    featured: false,
  },
  "free-safety-app-construction-workers": {
    category: "product",
    tags: ["pricing", "adoption", "workers"],
    featured: true,
  },
  "riddor-changes-2026": {
    category: "rams-compliance",
    tags: ["riddor", "hse", "regulation", "2026"],
    featured: false,
  },
  "safetyculture-alternative-uk": {
    category: "product",
    tags: ["comparison", "iauditor", "software"],
    featured: false,
  },
  "best-permit-to-work-software-uk-2026": {
    category: "product",
    tags: ["comparison", "ptw", "software"],
    featured: false,
  },
  "how-to-write-a-rams-uk": {
    category: "rams-compliance",
    tags: ["rams", "template", "method-statement"],
    featured: true,
  },
  "cdm-2015-small-contractor-uk": {
    category: "rams-compliance",
    tags: ["cdm", "small-contractor", "cpp"],
    featured: false,
  },
  "scaffold-inspection-checklist-uk": {
    category: "site-operations",
    tags: ["scaffolding", "inspection", "wahr"],
    featured: false,
  },
  "paper-vs-digital-rams-uk": {
    category: "rams-compliance",
    tags: ["rams", "digital", "cost"],
    featured: false,
  },
  "height-work-permit-uk": {
    category: "permits",
    tags: ["height", "wahr", "mewp", "ptw"],
    featured: false,
  },
  "excavation-permit-uk": {
    category: "permits",
    tags: ["excavation", "utilities", "hsg47", "ptw"],
    featured: false,
  },
  "lifting-operations-permit-uk": {
    category: "permits",
    tags: ["lifting", "loler", "crane", "ptw"],
    featured: false,
  },
  "electrical-isolation-permit-uk": {
    category: "permits",
    tags: ["electrical", "loto", "isolation", "ptw", "eawr"],
    featured: false,
  },
};

/** @param {string} slug */
export function getTaxonomyForSlug(slug) {
  return (
    BLOG_POST_TAXONOMY[slug] ?? {
      category: "site-operations",
      tags: [],
      featured: false,
    }
  );
}
