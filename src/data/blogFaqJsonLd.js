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
  "safetyculture-alternative-uk": [
    {
      name: "How much does SafetyCulture actually cost for UK construction?",
      text: "The Premium plan is approximately $24 per user per month on annual billing. On 50 workers and 5 supervisors that's around £780 per month, or £9,400 per year. Enterprise pricing is custom and typically higher.",
    },
    {
      name: "Does SafetyCulture have UK permit to work templates?",
      text: "The platform supports custom templates that users can build to represent UK permits. It does not come with pre-built UK permit types (hot work, confined space, etc.) with full permit lifecycle in the way UK-specific platforms do.",
    },
    {
      name: "What's the cheapest UK construction safety software?",
      text: "For small firms, HBXL Health & Safety Xpert has a low entry price but is desktop-focused. For worker-heavy sites, MySafeOps is often cheapest because worker accounts are free, removing the per-seat cost that dominates most other pricing.",
    },
    {
      name: "Is SafetyCulture good for CDM 2015 compliance?",
      text: "It can be configured for CDM compliance, but doesn't come with CDM-specific workflows pre-built. A Construction Phase Plan or principal contractor duty checklist would all need to be built as custom templates.",
    },
    {
      name: "Can I switch from SafetyCulture to an alternative without losing data?",
      text: "Yes. Most platforms support data export (SafetyCulture exports as PDF, DOCX, XML, CSV). A structured migration over 4-8 weeks, running both platforms in parallel, is the usual approach. The data loss risk is low if planned properly.",
    },
    {
      name: "How long does it take to switch safety platforms?",
      text: "Small firms (under 30 workers) can typically switch inside 2-3 weeks. Mid-size contractors (50-200 workers) usually take 4-8 weeks including parallel running. Large firms with multiple sites can take 3-6 months for full rollout with minimal disruption.",
    },
  ],
  "best-permit-to-work-software-uk-2026": [
    {
      name: "What's the cheapest permit to work software for UK construction?",
      text: "For worker-heavy sites, MySafeOps is typically cheapest because worker accounts are free. For small firms with few workers, The Site Book (£30/month flat) or SafetyCulture free tier (up to 10 users) are entry points. Cheapest depends heavily on site size.",
    },
    {
      name: "Which permit to work software is easiest to use on site?",
      text: "SafetyCulture and MySafeOps both score high on mobile UX. The key test is offline capability on a real UK site with patchy signal. SafetyCulture is slightly more polished globally, MySafeOps is more tailored to UK permit-specific workflows.",
    },
    {
      name: "Do all these platforms support CDM 2015?",
      text: "Most UK-focused platforms (HandsHQ, The Site Book, HBXL, MySafeOps, SmartQHSE, EcoOnline) support CDM 2015 to varying depths. SafetyCulture supports it via custom templates but doesn't come with CDM workflows pre-built.",
    },
    {
      name: "How long does it take to implement permit to work software?",
      text: "Small firms (under 30 workers) can be live inside 1-2 weeks on most platforms. Mid-size contractors (50-200 workers) usually need 4-8 weeks including team training. Enterprise platforms (HandsHQ, EcoOnline) can take 2-3 months for full rollout with configuration and integrations.",
    },
    {
      name: "Can I switch between these platforms later without losing data?",
      text: "Yes for most. All seven support data export (CSV, PDF, or API). A parallel-run switch over 4-6 weeks is the typical approach. Plan for 2-3 weeks of double data entry during migration to ensure no gaps in compliance evidence.",
    },
    {
      name: "Which platform is best for managing subcontractors on UK sites?",
      text: "MySafeOps handles subcontractor workers through free accounts, so subbies join at zero marginal cost. HandsHQ has strong subcontractor approval workflows but charges per seat. EcoOnline offers contractor management through integration with Alcumus/CHAS. Best fit depends on whether you pay per-subbie or share the platform with them.",
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
  "how-to-write-a-rams-uk": [
    {
      name: "Is a RAMS legally required in the UK?",
      text: "Not by name. But the risk assessment duty under the Management of Health and Safety at Work Regulations 1999 and the planning duty under CDM 2015 effectively require equivalent documentation. UK construction clients and principal contractors routinely request RAMS before granting site access, which makes them practically necessary regardless of legal status.",
    },
    {
      name: "What's the difference between a RAMS and a Method Statement alone?",
      text: "A Method Statement describes how work will be done. A RAMS combines that with a formal risk assessment showing hazards, controls and scoring. A standalone Method Statement without risk assessment is usually not accepted by UK construction principal contractors.",
    },
    {
      name: "How long should a RAMS be?",
      text: "Task-dependent. A simple repeat task might be 4-6 pages. A complex multi-trade installation might be 12-20 pages. What matters is relevance, not length. A 4-page site-specific RAMS beats a 40-page generic one every time.",
    },
    {
      name: "Who writes the RAMS?",
      text: "Usually the supervisor, lead engineer or H&S manager responsible for the work. Input from the crew who'll carry out the task is critical. RAMS written in isolation by an office-based H&S coordinator who's never seen the site tend to be detached from site reality.",
    },
    {
      name: "How often should a RAMS be reviewed?",
      text: "Minimum annually, or whenever the task, method, site conditions or regulations change. After any near-miss or incident related to the task, the RAMS should be reviewed and updated.",
    },
    {
      name: "Can I reuse a RAMS from another project?",
      text: "Only as a starting template. The site-specific content (location, access, surrounding activities, specific hazards) must be updated for every new project. Full copy-paste reuse is a common audit finding and creates liability if something goes wrong.",
    },
    {
      name: "Do subcontractors need their own RAMS?",
      text: "Yes, for their specific tasks. The principal contractor may provide a template or require alignment with their own RAMS structure, but the subbie is responsible for the RAMS covering work they carry out. Overlapping RAMS from different trades on the same area need coordination to avoid conflicts.",
    },
    {
      name: "What happens if an HSE inspector reviews my RAMS?",
      text: "They'll typically check: is it specific to the task, are hazards realistically identified, are controls adequate, is the method achievable, are operatives signed on, is the review date current. Red flags are generic content, missing signatures, unrealistic risk scoring, and outdated revision numbers.",
    },
  ],
  "cdm-2015-small-contractor-uk": [
    {
      name: "Do I need a CPP for every small job?",
      text: "If you're the only contractor, yes. Even a 2-day job. CDM 2015 Regulation 15 requires a CPP before the construction phase starts when there's only one contractor. The CPP can be short, but it needs to exist.",
    },
    {
      name: "What counts as \"construction work\" under CDM?",
      text: "Broad definition: building, altering, converting, fitting out, commissioning, renovating, repairing, upkeep, redecoration, other maintenance, demolition, dismantling, site clearance, services and infrastructure work. If what you're doing touches a structure or its fabric, it's probably construction under CDM.",
    },
    {
      name: "Does CDM apply to emergency callouts?",
      text: "Yes. There's no emergency exemption. If you're doing construction work in response to an urgent call, CDM still applies. Practical approach: have a generic CPP for common emergency work types that can be rapidly site-specific.",
    },
    {
      name: "What's the minimum training a small contractor needs?",
      text: "CDM doesn't specify training, but requires competence. Common practical evidence: CSCS card at appropriate level, SSSTS for supervisors, SMSTS for site managers, IOSH Managing Safely or NEBOSH for H&S responsibilities. Trade-specific qualifications for the work being done. CPCS for plant, IPAF for MEWPs, PASMA for mobile towers.",
    },
    {
      name: "Can I use a generic CPP template?",
      text: "A template is a starting point, not a deliverable. A generic CPP with no site-specific content is worse than no CPP, because it shows you produced a document but didn't think about the actual job. Always customise.",
    },
    {
      name: "Who checks if my CDM paperwork is in order?",
      text: "HSE can inspect at any time, with or without notice. Local authority environmental health officers have parallel powers in non-HSE premises. Insurance companies may ask for evidence following an incident. Clients increasingly request CDM paperwork as part of contract award.",
    },
    {
      name: "Is there a CDM exemption for very small jobs?",
      text: "No. The 2015 revision removed almost all minor work exemptions. Even a single-day repair job has CDM duties if it counts as construction work.",
    },
    {
      name: "What's the difference between CDM and Building Safety Act 2022?",
      text: "CDM 2015 covers all construction work and focuses on managing health and safety during design and construction. The Building Safety Act 2022 covers higher-risk buildings (mostly residential over 18m or 7+ storeys) and introduces additional duties during design and construction. For most small contractors, CDM is the relevant framework. Building Safety Act applies only to specific building types.",
    },
  ],
  "scaffold-inspection-checklist-uk": [
    {
      name: "How often must UK scaffolding be inspected?",
      text: "After erection before first use, after any event affecting stability, after any modification, and at intervals not exceeding 7 days. The 7-day rule is the key ongoing requirement for scaffolds in continuous use.",
    },
    {
      name: "Can a site manager inspect a scaffold without being a CISRS scaffolder?",
      text: "For basic scaffolds to a standard configuration, a site manager with recognised scaffold inspection training can competently inspect. For complex scaffolds (cantilevers, bridges, temporary roofs, non-standard configurations), CISRS Advanced Scaffolder or Scaffold Inspection Advanced certification is typically required.",
    },
    {
      name: "What's the difference between Work at Height Regulations and scaffold-specific rules?",
      text: "Work at Height Regulations 2005 is the broad framework covering all work at height. Regulation 12 specifically requires scaffold inspection. Related guidance comes from HSE and trade bodies like NASC (National Access and Scaffolding Confederation) which publishes SG4 guidance on safe scaffolding practices.",
    },
    {
      name: "How long do scaffold inspection records need to be kept?",
      text: "Until the scaffold is dismantled and removed, plus a minimum of 3 months after. Many UK firms keep records for longer (1-7 years) for audit and civil liability purposes.",
    },
    {
      name: "What's a Scafftag or similar tag system?",
      text: "A physical tag attached to the scaffold showing current inspection status. Green insert = inspection current, safe to use. Red = failed or overdue. Carbon-copy checklist inserts document the inspection details. Common in UK construction for point-of-use status communication.",
    },
    {
      name: "Do mobile tower scaffolds need the same inspection as full scaffolds?",
      text: "Yes. Work at Height Regulations 2005 applies equally. Mobile towers must be inspected after assembly, before use, after any event affecting stability, and at intervals not exceeding 7 days if in continuous use.",
    },
    {
      name: "What happens if an HSE inspector finds a scaffold without inspection records?",
      text: "Typical outcome depends on severity. Minor gaps might result in a notice of contravention or improvement notice. Significant gaps (no register at all, or evidence of dangerous use) can result in prohibition notices, fees for intervention (currently £174 per hour of HSE time), and in serious cases, prosecution under Work at Height Regulations 2005 or HSWA 1974.",
    },
    {
      name: "Can a scaffold subcontractor refuse to work on an unsafe scaffold?",
      text: "Yes. Workers have legal rights under HSWA 1974 to refuse work they reasonably believe is unsafe. The scaffold hirer/user is responsible for ensuring scaffolds are inspected before use. Subcontractors should verify current inspection status before accessing.",
    },
  ],
  "paper-vs-digital-rams-uk": [
    {
      name: "Is digital RAMS legally required in the UK?",
      text: "No. Paper RAMS remains legally acceptable under CDM 2015 and HSWA 1974. The regulations require the risk assessment duty to be met, not specifying the medium. Digital offers better audit trails but isn't mandated.",
    },
    {
      name: "What's the cheapest way to go digital on RAMS?",
      text: "For very small UK firms, SafetyCulture's free tier (up to 10 users) handles basic digital RAMS at no cost. For worker-heavy sites, MySafeOps keeps worker accounts free, so the main subscription cost is just for admin/supervisor seats. Flat-rate platforms like The Site Book (£360/year) are also highly cost-effective for small contractors.",
    },
    {
      name: "Will workers actually use a digital RAMS?",
      text: "Adoption rates are high when the platform is mobile-first and workers can access their own records on their own phones. Platforms that charge per-worker often see poor adoption because shared accounts defeat the audit trail. Free worker accounts (like MySafeOps) materially improve adoption.",
    },
    {
      name: "How long does it take to switch from paper to digital?",
      text: "Typical UK contractor transitions in 4-8 weeks. First 2 weeks: setup and template migration. Weeks 3-5: parallel running with paper still in use for in-flight jobs. Weeks 6-8: hard cutover to digital for new work. Principal contractors and insurers increasingly expect version control and sign-off evidence, which is harder to demonstrate with ad-hoc paper bundles.",
    },
    {
      name: "What if my clients still want paper?",
      text: "Every major digital platform exports to PDF matching the digital format. Clients who want paper get printed copies with identical content, signatures and structure. Many UK clients are actively moving away from paper because digital records are easier for their own audits.",
    },
    {
      name: "Do I need to retrain my entire workforce?",
      text: "No. Most operatives pick up basic digital RAMS interaction (opening, reading, signing) within 5-10 minutes. Supervisors need 1-2 hours of training for writing and approving digital RAMS. Admin users need 2-4 hours for full system configuration. Most UK workforces are at full competence within 2 weeks of rollout.",
    },
    {
      name: "What happens during the transition if a client audit hits?",
      text: "Keep paper running for in-flight jobs during the transition. Paper records remain valid until archived. Digital records start accumulating from day 1. An audit during transition is usually fine, just slightly more awkward to pull records from both systems.",
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
