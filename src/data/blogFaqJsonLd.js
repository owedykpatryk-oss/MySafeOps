/**
 * FAQPage `mainEntity` entries keyed by blog slug (visible only on /blog/:slug).
 * Add entries here when an article has a curated FAQ block for rich results.
 */
export const FAQ_MAIN_ENTITY_BY_SLUG = {
  "hot-work-permit-uk": [
    {
      name: "Is a hot work permit legally required in the UK?",
      text: "There's no single regulation that mandates a hot work permit by name, but UK law (HSWA 1974, CDM 2015, Regulatory Reform Fire Safety Order 2005) requires employers to identify and control fire risks. For hot work, a permit is the established means of doing that, and most UK construction insurers require it explicitly.",
    },
    {
      name: "How long should the fire watch last after hot work?",
      text: "HSE and FPA guidance typically specifies a minimum of 60 minutes after work stops. Many insurers require longer, often 2 hours, sometimes more on higher-risk sites. Check the specific insurance requirements for the project.",
    },
    {
      name: "Can the same person issue and carry out hot work?",
      text: "No. The authoriser and the operative should be separate people. The authoriser is confirming that the area has been prepared and the precautions are in place.",
    },
    {
      name: "Are digital hot work permits accepted by UK insurers?",
      text: "Generally yes, provided they capture the same information, signatures and evidence as a paper permit. Some insurers may have specific requirements, worth checking the project insurance policy before rolling out a digital system.",
    },
    {
      name: "What's the biggest cause of hot work fires in UK construction?",
      text: "Fires that start in concealed areas (wall cavities, void spaces, insulation) after work has finished. The combination of an ember reaching somewhere the operative couldn't see, and the fire watch ending too early, is the most common pattern.",
    },
  ],
};

/** @param {string | undefined} slug */
export function getFaqPageJsonLd(slug) {
  const rows = slug ? FAQ_MAIN_ENTITY_BY_SLUG[slug] : null;
  if (!rows?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rows.map((row) => ({
      "@type": "Question",
      name: row.name,
      acceptedAnswer: {
        "@type": "Answer",
        text: row.text,
      },
    })),
  };
}
