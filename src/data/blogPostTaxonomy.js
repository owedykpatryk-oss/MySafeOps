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
  "f10-notification-uk": {
    category: "rams-compliance",
    tags: ["cdm", "f10", "hse", "notification"],
    featured: false,
  },
  "hse-inspection-construction-uk": {
    category: "site-operations",
    tags: ["hse", "inspection", "audit", "compliance"],
    featured: false,
  },
  "construction-safety-app-pricing-uk-2026": {
    category: "product",
    tags: ["pricing", "comparison", "software", "budget"],
    featured: false,
  },
  "cdm-2015-compliance-software-uk": {
    category: "rams-compliance",
    tags: ["cdm", "compliance", "software", "principal-contractor"],
    featured: true,
  },
  "construction-phase-plan-template-uk": {
    category: "rams-compliance",
    tags: ["cdm", "cpp", "template"],
    featured: false,
  },
  "summer-heat-safety-construction-uk": {
    category: "site-operations",
    tags: ["heat", "summer", "welfare", "briefings"],
    featured: false,
  },
  "principal-contractor-duties-uk": {
    category: "rams-compliance",
    tags: ["cdm", "principal-contractor", "duties", "regulation"],
    featured: false,
  },
  "digital-rams-software-comparison-uk": {
    category: "product",
    tags: ["rams", "comparison", "software", "digital"],
    featured: false,
  },
  "pre-construction-information-uk": {
    category: "rams-compliance",
    tags: ["cdm", "pci", "pre-construction", "client"],
    featured: false,
  },
  "construction-site-visitor-management-uk": {
    category: "site-operations",
    tags: ["visitor", "gdpr", "sign-in", "site-security"],
    featured: false,
  },
  "ptw-software-offline-uk": {
    category: "product",
    tags: ["ptw", "offline", "mobile", "permits"],
    featured: false,
  },
  "subcontractor-management-software-uk": {
    category: "site-operations",
    tags: ["subcontractor", "cdm", "rams", "coordination"],
    featured: false,
  },
  "construction-site-security-uk": {
    category: "site-operations",
    tags: ["security", "fencing", "theft", "access-control"],
    featured: false,
  },
  "digital-permit-board-construction-uk": {
    category: "permits",
    tags: ["ptw", "permit-board", "digital", "site-cabin"],
    featured: false,
  },
  "silica-dust-construction-uk": {
    category: "site-operations",
    tags: ["silica", "dust", "rpe", "hse"],
    featured: false,
  },
  "asbestos-management-construction-uk": {
    category: "rams-compliance",
    tags: ["asbestos", "car-2012", "survey", "refurbishment"],
    featured: false,
  },
  "noise-at-work-construction-uk": {
    category: "site-operations",
    tags: ["noise", "hearing", "ppe", "exposure"],
    featured: false,
  },
  "lone-worker-construction-uk": {
    category: "site-operations",
    tags: ["lone-working", "check-in", "welfare", "risk"],
    featured: false,
  },
  "ior-pozwolenie-na-prace-polska": {
    category: "permits",
    tags: ["pl", "ior", "ptw", "bhp", "pip"],
    featured: true,
  },
  "hand-arm-vibration-havs-construction-uk": {
    category: "site-operations",
    tags: ["havs", "vibration", "health-surveillance", "exposure"],
    featured: false,
  },
  "manual-handling-construction-uk": {
    category: "site-operations",
    tags: ["manual-handling", "tile", "msd", "rams"],
    featured: false,
  },
  "near-miss-reporting-construction-uk": {
    category: "site-operations",
    tags: ["near-miss", "incident", "riddor", "learning"],
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
