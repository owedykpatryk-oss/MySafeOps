/**
 * FAQPage mainEntity entries keyed by blog slug (JSON-LD in document head only).
 */
export const FAQ_MAIN_ENTITY_BY_SLUG = {
  "confined-space-permit-uk": [
    {
      name: "What are the Confined Spaces Regulations 1997?",
      text: "UK regulations that set out employer duties for work in confined spaces. The core duty is to avoid entry if possible, and if entry is necessary, to ensure safe systems of work and emergency arrangements are in place.",
    },
    {
      name: "Is a permit to work legally required for confined space entry in the UK?",
      text: "The regulations don't specify a permit by name, but they require a safe system of work that typically is documented through a permit. In practice, UK construction sites and HSE inspectors expect a permit for any confined space entry.",
    },
    {
      name: "What's the difference between a confined space and a restricted space?",
      text: "A confined space has foreseeable hazards (atmosphere, engulfment, fire, heat). A restricted space just has limited access. A tight crawl space in a loft isn't a confined space unless one of the specified hazards is present.",
    },
    {
      name: "How often should confined space training be refreshed?",
      text: "Every 2-3 years for entrants and standby persons, and whenever the type of confined space work changes. Rescue training should be practised more frequently, at least annually, ideally with live exercises.",
    },
  ],
  "coshh-register-software-uk": [
    {
      name: "Is a COSHH register legally required in the UK?",
      text: "The COSHH Regulations 2002 require risk assessments, but don't mandate a register by name. In practice, the register is the standard means of documenting the assessments and evidence HSE inspectors expect to see.",
    },
    {
      name: "Do I need a COSHH assessment for every substance on site?",
      text: "For every hazardous substance, yes. Non-hazardous substances don't require a COSHH assessment, though you should check the SDS to confirm classification.",
    },
    {
      name: "How often should COSHH assessments be reviewed?",
      text: "When circumstances change (new substance, new task, changed controls) and at minimum annually. Review is also prompted by incidents, near-misses and updated safety data sheets.",
    },
    {
      name: "Who can write a COSHH assessment?",
      text: "A competent person with sufficient knowledge of the substance, the task and the control measures. For complex substances, this might be a health and safety professional. For straightforward substances, a trained supervisor is often sufficient.",
    },
    {
      name: "Are digital COSHH registers accepted by HSE inspectors?",
      text: "Yes, provided they contain the same information as a paper register and the records can be produced when requested. HSE inspectors increasingly expect digital records on modern UK construction sites.",
    },
  ],
  "digital-toolbox-talks": [
    {
      name: "Are toolbox talks legally required in the UK?",
      text: "Toolbox talks aren't required by name, but the duty to provide information, instruction and training under HSWA 1974 and CDM 2015 means most UK construction sites deliver them regularly. They're the established means of meeting that duty on live sites.",
    },
    {
      name: "How often should toolbox talks be delivered?",
      text: "Weekly is standard on construction sites, plus additional briefings when the work changes, after near-misses, or when new hazards emerge. HSE doesn't set a fixed frequency.",
    },
    {
      name: "Do digital signatures on toolbox talks count for audits?",
      text: "Yes, provided the system captures the attendee's identity, the date and time, and the content delivered. HSE inspectors and client auditors broadly accept digital records where these are in place.",
    },
    {
      name: "What's the ideal toolbox talk length?",
      text: "Between 5 and 15 minutes. Shorter and the content doesn't land; longer and the crew stops listening. The HSE template talks are designed around this window.",
    },
    {
      name: "Can workers complete toolbox talks remotely?",
      text: "They can be delivered remotely, but the supervisor should confirm the worker engaged with the content. Digital platforms that require active acknowledgement work better than just emailing a PDF.",
    },
  ],
  "free-safety-app-construction-workers": [
    {
      name: "Are free construction safety apps actually useful?",
      text: "It depends on the app. Some free apps are stripped-down trials designed to upsell. MySafeOps offers free worker accounts as a permanent part of a paid platform, full worker functionality without a per-seat charge.",
    },
    {
      name: "Can workers access permits and RAMS on a free account?",
      text: "Yes. Worker accounts in MySafeOps include permit acknowledgement, RAMS sign-off, toolbox talk attendance and induction completion, everything a construction worker needs on a daily basis.",
    },
    {
      name: "What's the difference between free worker accounts and a free trial?",
      text: "A trial expires. Free worker accounts in MySafeOps don't. As long as the organisation maintains admin/supervisor subscriptions, unlimited workers can be added without additional cost.",
    },
    {
      name: "Do free worker accounts include offline use?",
      text: "Yes. Offline capability isn't a premium feature on MySafeOps. Workers can acknowledge permits, sign briefings and complete inductions without signal, with sync when the device reconnects.",
    },
    {
      name: "How does pricing work if my site grows from 20 to 200 workers?",
      text: "The worker count doesn't affect pricing. The admin/supervisor tier determines the monthly cost. Growing from 20 to 200 workers doesn't trigger a contract change or a per-seat bill.",
    },
  ],
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
  "permit-to-work-app-uk": [
    {
      name: "Are digital permits to work legally accepted in the UK?",
      text: "Yes. HSE guidance HSG250 recognises electronic permit to work systems where they provide equivalent control and evidence to paper permits. That means proper authorisation, traceability, signatures and close-out records.",
    },
    {
      name: "Do I need a separate app for each permit type?",
      text: "No. A proper permit to work app handles all UK permit categories (hot work, height, confined space, electrical, excavation, lifting, general) in one place. Splitting them across apps creates exactly the admin burden digital PTW is meant to remove.",
    },
    {
      name: "How long does it take to roll out a PTW app on site?",
      text: "With a decent platform, a small contractor can be issuing live digital permits inside a week. Larger firms with complex approval chains usually need 2-4 weeks to configure and train.",
    },
    {
      name: "What happens to permits if the app goes offline?",
      text: "Proper offline-capable PTW apps store permits locally on the device. The supervisor can issue, sign and close permits without signal. When the device reconnects, everything syncs with original timestamps preserved.",
    },
    {
      name: "Do workers need their own licence to sign permits?",
      text: "They shouldn't. Platforms that charge per-worker make digital adoption painful for large teams. MySafeOps keeps worker accounts free permanently, so everyone on site can sign briefings and acknowledge permits without a cost barrier.",
    },
  ],
  "riddor-changes-2026": [
    {
      name: "When does the RIDDOR consultation close?",
      text: "The consultation closes on 30 June 2026. Responses received after that date cannot be guaranteed to influence HSE's decision.",
    },
    {
      name: "Do I have to respond to the RIDDOR consultation?",
      text: "Responding is not mandatory, but HSE specifically encourages duty holders, self-employed workers and those in control of work premises to respond, because the changes affect their operations directly. Not responding means your views don't count towards the final proposals.",
    },
    {
      name: "Will the RIDDOR changes apply to construction specifically, or all industries?",
      text: "RIDDOR applies across all UK industries, but several of the proposed changes (plant overturning, tunnelling, trench collapse) are especially relevant to construction. Other sectors have their own focus areas in the consultation.",
    },
    {
      name: "How many new RIDDOR reports will our site need to submit if the changes pass?",
      text: "Impossible to predict precisely, but the expansion of dangerous occurrence categories and the tripled disease list will increase reporting volume for most UK construction firms. Firms already tracking near-misses and occupational health well will see the smallest operational change.",
    },
    {
      name: "Where do I find the full RIDDOR consultation document?",
      text: "Directly at https://consultations.hse.gov.uk/hse/proposals-riddor-2013/. The page includes the consultation document, supporting information and the online response survey.",
    },
    {
      name: "Can I respond to the RIDDOR consultation on behalf of a trade association?",
      text: "Yes. HSE welcomes responses from individual firms, trade associations, professional bodies, and representative organisations. Industry-wide responses often carry significant weight in consultations.",
    },
  ],
  "site-induction-software-uk": [
    {
      name: "Is site induction legally required under CDM 2015?",
      text: "Yes. Regulation 13 places a duty on the principal contractor to provide a suitable site induction to every worker. The regulation doesn't specify the form or length, but the evidence of delivery is expected.",
    },
    {
      name: "Can subcontractors deliver their own site induction?",
      text: "The principal contractor remains responsible for ensuring every worker on site has received a suitable induction covering site-specific information. Subcontractors can contribute to the content, but the principal contractor needs to verify delivery.",
    },
    {
      name: "How long should a site induction be?",
      text: "Typically 20 to 45 minutes. Longer inductions lose attention. Shorter ones often miss site-specific content. The length should match the complexity of the project and the risks involved.",
    },
    {
      name: "Do workers need to re-induct on long projects?",
      text: "Good practice is to re-induct when site conditions change significantly, major phase changes, new zones opening, updated site rules. On very long projects, many principal contractors do annual refreshers.",
    },
    {
      name: "Can site inductions be delivered remotely?",
      text: "Partial delivery remotely works (policy, rules, general hazards), but site-specific content and the physical tour benefit from in-person delivery. Hybrid inductions are increasingly common on large UK projects.",
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
