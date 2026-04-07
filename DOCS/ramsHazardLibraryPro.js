// MySafeOps — RAMS Hazard Library PRO (3rd extension)
// 10 new trade categories — 38 hazards
// Adds scaffolding, traffic management, healthcare/cleanroom,
// telecoms/data, concrete/formwork, bricklaying, compressed air/steam,
// rope access, cold storage, security/BMS
//
// Usage:
//   import BASE from "./ramsHazardLibrary";
//   import EXT  from "./ramsHazardLibraryExtended";
//   import PRO  from "./ramsHazardLibraryPro";
//   export const ALL_HAZARDS = [...BASE, ...EXT, ...PRO];

export const PRO_CATEGORIES = [
  "Scaffolding",
  "Chapter 8 Traffic Management",
  "Healthcare & Cleanroom",
  "Telecoms & Data Cabling",
  "Concrete & Formwork",
  "Bricklaying & Masonry",
  "Compressed Air & Steam Systems",
  "Rope Access (IRATA)",
  "Cold Storage & Refrigerated Spaces",
  "Security & Building Technology Systems",
];

const PRO_LIBRARY = [

  // ── SCAFFOLDING ─────────────────────────────────────────────────────────────

  {
    id: "scaf_001",
    category: "Scaffolding",
    activity: "Erection of tube and fitting / system scaffold",
    hazard: "Falls from height during erection before guardrails installed; falling tubes and fittings; inadequate foundations causing collapse",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only CISRS card-holding scaffolders (Part 1 / Part 2 / Advanced) to erect, alter or dismantle scaffold",
      "Scaffold erection sequence follows TG20:21 guidance or project-specific design",
      "Scaffolders use personal fall arrest system until first lift of guardrail is complete",
      "Exclusion zone established and maintained below erection area throughout",
      "Ground conditions assessed; base plates and sole boards used on all standards",
      "Scaffold inspected and handover certificate issued before any other trade uses it",
      "Scaffold tagged with inspection date; re-inspected after adverse weather and every 7 days",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Full harness with fall arrest lanyard", "Gloves"],
    regs: ["Work at Height Regs 2005", "NASC TG20:21", "BS EN 12811", "CISRS Card Scheme", "CDM 2015"],
  },

  {
    id: "scaf_002",
    category: "Scaffolding",
    activity: "Adaptation and alteration of existing scaffold",
    hazard: "Unplanned partial collapse from removing key components; falls during alteration; reduced load capacity",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "No scaffold altered or adapted by non-scaffolders under any circumstances",
      "Altered scaffold re-inspected and re-tagged before use is permitted",
      "If load-bearing modifications are required, a new structural check is carried out",
      "Scaffold tag changed to 'DO NOT USE' while alteration is in progress",
      "All trades briefed: only scaffolders may move, add or remove any scaffold component",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Full harness"],
    regs: ["Work at Height Regs 2005", "NASC SG4 (preventing falls in scaffolding)", "NASC TG20:21"],
  },

  {
    id: "scaf_003",
    category: "Scaffolding",
    activity: "Mobile tower scaffold erection and use",
    hazard: "Tower overturn from insufficient base-to-height ratio; moving occupied tower; platform overloading",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only PASMA-trained operatives to erect, alter or dismantle mobile tower",
      "3:1 height-to-base ratio maintained on firm, level ground (or 2.5:1 for outriggers)",
      "Tower never moved with anyone on the platform or with materials on deck",
      "Castors locked when tower is in use; unlocked only for movement",
      "Maximum platform load clearly marked; not exceeded at any time",
      "Tower inspected at start of each shift; defects reported immediately",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis"],
    regs: ["Work at Height Regs 2005", "PASMA Code of Practice", "BS 1139-6 (mobile towers)"],
  },

  {
    id: "scaf_004",
    category: "Scaffolding",
    activity: "Scaffold loading — materials storage on platforms",
    hazard: "Overloading platform causing structural failure; materials falling from height; instability from point loading",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Load capacity of each platform clearly displayed and not exceeded",
      "Materials spread evenly across the platform — no point loading at single bay",
      "No pallets or bulk materials stored on scaffold without structural engineer's sign-off",
      "Materials on open platforms secured against wind displacement",
      "Loaded scaffold re-inspected; loading documented and compared to design specification",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Gloves"],
    regs: ["Work at Height Regs 2005", "NASC TG20:21 (loading guidance)", "BS EN 12811"],
  },

  // ── CHAPTER 8 TRAFFIC MANAGEMENT ───────────────────────────────────────────

  {
    id: "tm_001",
    category: "Chapter 8 Traffic Management",
    activity: "Road works — setting out temporary traffic management",
    hazard: "Operatives struck by live traffic during sign installation; inadequate TM causing vehicle intrusion; driver confusion",
    initialRisk: { L: 6, S: 6, RF: 36 },
    controlMeasures: [
      "Only Chapter 8 trained/qualified operatives to set out, adjust or remove TM",
      "Traffic Management plan reviewed and approved before any TM is placed",
      "TM installed in order from furthest from site first (advance signs before cones)",
      "High-visibility clothing Class 3 (EN ISO 20471) worn by all personnel near live traffic",
      "Speed reduction achieved before working zone; if not achieved, work stops",
      "Communication maintained with traffic management team throughout",
      "TM removed in reverse order (nearest to site first) at end of works",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Class 3 Hi-vis (EN ISO 20471)", "Safety footwear (midsole)", "Hard hat", "Gloves"],
    regs: ["Traffic Signs Regs & General Directions 2016", "Chapter 8 of Traffic Signs Manual", "NRSWA 1991", "Safety at Street Works & Road Works CoP"],
  },

  {
    id: "tm_002",
    category: "Chapter 8 Traffic Management",
    activity: "Lane closure on dual carriageway or A-road",
    hazard: "Rear-end collision with TM vehicle; workers struck during set-out; inadequate taper length at high speed",
    initialRisk: { L: 6, S: 6, RF: 36 },
    controlMeasures: [
      "Works package includes risk assessment and method statement for lane closure reviewed by TM designer",
      "Vehicle-mounted attenuator (crash cushion) used on lead vehicle for all lane closures on roads above 40mph",
      "Taper length calculated to Chapter 8 formula for road speed; minimum taper lengths not compromised",
      "TM operatives work from vehicles wherever possible; never walk in live lane",
      "Out-of-hours working planned for high-speed roads wherever programme allows",
      "All TM vehicles amber-lit; SLOW/CONVOY sign fitted",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Class 3 Hi-vis", "Safety footwear", "Hard hat"],
    regs: ["Chapter 8 Traffic Signs Manual", "HAUC(UK) Specification", "The Highway Act 1980", "CDM 2015"],
  },

  {
    id: "tm_003",
    category: "Chapter 8 Traffic Management",
    activity: "Excavation within the highway / road reinstatement",
    hazard: "Trench collapse under traffic loading; vehicle falling into open excavation; damage to adjacent services; pedestrian hazard",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Excavation design accounts for surcharge loading from live traffic; shoring specified",
      "Robust barriers (not just cones) used to protect open excavation from vehicle intrusion",
      "Permit to Dig issued; service detection (CAT/Genny) carried out before excavation",
      "Pedestrian diversion route maintained with appropriate lighting and barriers",
      "Temporary road reinstatement to comply with HAUC specification; permanent reinstatement within timescale",
      "Section 74 licence requirements met; start notices filed with highway authority",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Class 3 Hi-vis", "Safety footwear (steel midsole)", "Hard hat", "Safety glasses"],
    regs: ["NRSWA 1991", "HAUC(UK) Reinstatement Specification", "Chapter 8", "HSG185"],
  },

  {
    id: "tm_004",
    category: "Chapter 8 Traffic Management",
    activity: "Night working — road works in hours of darkness",
    hazard: "Reduced visibility of operatives and TM signs; driver fatigue; inadequate lighting in work zone",
    initialRisk: { L: 6, S: 6, RF: 36 },
    controlMeasures: [
      "Site lighting designed to illuminate work zone without dazzling drivers",
      "All TM signs and cone collars fitted with retroreflective material or illuminated",
      "All operatives in Class 3 hi-vis; gloves with reflective strips",
      "Traffic speed assessed during hours of darkness — reduction may be needed",
      "Fatigue management plan for operatives working consecutive night shifts",
      "Works supervisor present on site throughout night working period",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Class 3 Hi-vis with reflective strips", "Safety footwear", "Hard hat", "Gloves (reflective)"],
    regs: ["Chapter 8", "HSG191 (Emergency Lighting)", "Working Time Regs 1998 (night work provisions)"],
  },

  // ── HEALTHCARE & CLEANROOM ──────────────────────────────────────────────────

  {
    id: "hc_001",
    category: "Healthcare & Cleanroom",
    activity: "Construction works in occupied healthcare premises",
    hazard: "Infection control breach; dust contamination of clinical areas; disruption to medical gas and critical power; patient disturbance",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Infection Prevention & Control (IPC) risk assessment completed with trust IPC team",
      "Permit to Work system in place; works planned in conjunction with estates manager",
      "Full dust suppression, negative pressure enclosures and HEPA filtration — NHS Firecode/HTM compliance",
      "Medical gas and critical power systems: written scheme of isolation agreed with trust",
      "Contractors inducted into healthcare site procedures including hand hygiene, infection protocols",
      "Aspergillus and Legionella risk addressed for immunocompromised patient areas",
      "Works restricted to agreed hours; no weekend or night working without specific approval",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Site-specific hygiene PPE", "Coveralls", "Safety footwear", "Dust mask", "Gloves", "Hard hat"],
    regs: ["HTM 00 / HTM 01 / HTM 02 (NHS technical memoranda)", "HBN 00-01 (barrier precautions)", "CDM 2015", "COSHH 2002"],
  },

  {
    id: "hc_002",
    category: "Healthcare & Cleanroom",
    activity: "Cleanroom / pharmaceutical manufacturing area installation",
    hazard: "Contamination of product or clean area; introduction of microorganisms; particle generation; electrostatic discharge",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Works planned with QA and facility manager; change control procedure followed",
      "All materials entering cleanroom gowned, cleaned and decontaminated per site SOP",
      "Only tools approved for cleanroom use (non-shedding, easily cleaned, tracked)",
      "Operatives gowned to appropriate classification (GMP Grade C/D minimum)",
      "Metalwork deburred and cleaned before installation; no loose swarf",
      "Environmental monitoring (particle counts, settle plates) during and after works",
      "Cleanroom validation (re-qualification) completed before product return",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Cleanroom coverall (ISO class appropriate)", "Cleanroom gloves", "Face mask (surgical/FFP2)", "Safety footwear (cleanroom overshoes)"],
    regs: ["EU GMP Annex 1 (Manufacture of Sterile Products)", "ISO 14644 (cleanrooms)", "COSHH 2002", "HASAWA 1974"],
  },

  {
    id: "hc_003",
    category: "Healthcare & Cleanroom",
    activity: "Medical gas pipeline installation and testing",
    hazard: "Oxygen-enriched atmosphere causing fire; incorrect gas connection causing patient harm; contamination of pipeline with oil or particles",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only BCGA-competent/MGPS-qualified engineers to install, modify or test medical gas systems",
      "Oil-free tools used throughout; no lubricant used in oxygen systems",
      "Oxygen-specific cleaning of all pipework, fittings and components before installation",
      "Pipeline purged and pressure-tested; identity and purity verified before handover",
      "Colour-coded and labelled per HTM 02-01; cross-connection physically impossible",
      "Validation testing by authorised verifier (AV) before any patient use",
      "No ignition sources within 1m of oxygen terminal units",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Oil-free gloves", "Safety glasses", "Coveralls", "Safety footwear"],
    regs: ["HTM 02-01 (Medical Gas Pipeline Systems)", "BS EN ISO 7396", "BCGA Code of Practice", "Electricity at Work Regs 1989"],
  },

  {
    id: "hc_004",
    category: "Healthcare & Cleanroom",
    activity: "Decontamination unit / CSSD installation",
    hazard: "Steam and hot water burns; ethylene oxide exposure; chemical disinfectant COSHH; electrical isolation of live plant",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Steam supplies isolated and confirmed pressure-free before any work on autoclaves",
      "Ethylene oxide detection alarm functional before any work near EO sterilisation plant",
      "COSHH assessments for all decontamination chemicals; SDS reviewed and PPE selected",
      "Electrical isolation by hospital authorised person; LOTO applied",
      "Works carried out during planned downtime with written agreement from decontamination manager",
      "Validation and re-qualification tests completed before unit is returned to clinical use",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Heat-resistant gloves", "Face shield", "Chemical resistant apron", "Safety footwear"],
    regs: ["PSSR 2000", "COSHH 2002", "HTM 01-01 (Decontamination)", "EH40 (EtO WEL)"],
  },

  // ── TELECOMS & DATA CABLING ─────────────────────────────────────────────────

  {
    id: "tel_001",
    category: "Telecoms & Data Cabling",
    activity: "Structured data cabling installation (Cat 6A, fibre)",
    hazard: "Falls from height; glass fibre splinters from fibre optic works; cable drum manual handling; working in ceiling voids near live services",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Podium steps or mobile tower used for ceiling-level cabling; no working from chairs or desks",
      "Fibre optic cable: safety glasses and nitrile gloves worn at all times during termination and fusion splicing",
      "Waste fibre slivers collected on tacky mat; never disposed of loose — invisible and extremely dangerous",
      "Cable drums on proper drum stands; braked during pays-off",
      "All live electrical services in ceiling voids identified before penetrations drilled",
      "Dust mask worn when working in dust-laden ceiling voids",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety glasses (mandatory for fibre optic work)", "Nitrile gloves", "Dust mask", "Safety footwear", "Hard hat (ceiling void)"],
    regs: ["Work at Height Regs 2005", "COSHH 2002 (glass fibre)", "Electricity at Work Regs 1989", "Manual Handling Ops Regs 1992"],
  },

  {
    id: "tel_002",
    category: "Telecoms & Data Cabling",
    activity: "Aerial and mast installation",
    hazard: "Falls from roof or mast; struck by lightning on mast; RF radiation from active antennas; unstable mast base",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Mast and antenna base designed for wind loading; structural engineer's sign-off for roof penetrations",
      "Mast climbers hold PASMA/IRATA or relevant competency; harness worn for any work above 2m",
      "Active antennas: RF safety assessment; exclusion zones established if live during work",
      "Lightning protection bonding installed and tested before commissioning",
      "Never work on mast during electrical storms or wind above 15 m/s",
      "Roof works: edge protection in place before any operatives on roof",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Full harness", "RF monitoring badge (active antenna areas)"],
    regs: ["Work at Height Regs 2005", "ICNIRP RF guidelines", "BS EN 62305 (lightning protection)", "CDM 2015"],
  },

  {
    id: "tel_003",
    category: "Telecoms & Data Cabling",
    activity: "CCTV and access control system installation",
    hazard: "Falls from height; electrical work at distribution boards; drilling near unknown services; camera privacy/GDPR compliance",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Access platform or MEWP used for camera installation above 2m; not ladders for sustained work",
      "Mains electrical work at DB by qualified electrician only; isolation confirmed before wiring",
      "CAT scan before any drilling into walls to locate hidden services",
      "Cable routes planned to avoid draping over live electrical equipment",
      "Data Protection Impact Assessment (DPIA) completed for any CCTV system covering public or staff areas",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety footwear", "Safety glasses", "Hard hat (where overhead risk)", "Hi-vis (external)"],
    regs: ["Work at Height Regs 2005", "Electricity at Work Regs 1989", "UK GDPR / Data Protection Act 2018", "BS EN 62676 (CCTV)"],
  },

  {
    id: "tel_004",
    category: "Telecoms & Data Cabling",
    activity: "BMS (Building Management System) commissioning",
    hazard: "Inadvertent operation of plant during commissioning; incorrect signal causing HVAC/fire alarm fault; live panel work",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Commissioning sequence agreed with mechanical and electrical engineers in advance",
      "Interlocks tested before any plant is started via BMS",
      "Fire alarm interface commissioning carried out with fire alarm contractor present",
      "Any override or bypass of BMS point clearly documented and removed at end of commissioning",
      "Live panel work only when authorised person has confirmed safe isolation",
      "BMS points list and sequence schedule provided to client at handover",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety footwear", "Safety glasses", "Insulated tools (panel work)"],
    regs: ["Electricity at Work Regs 1989", "BS EN 15232 (building energy management)", "CIBSE Commissioning Codes"],
  },

  // ── CONCRETE & FORMWORK ────────────────────────────────────────────────────

  {
    id: "con_001",
    category: "Concrete & Formwork",
    activity: "Formwork erection and striking",
    hazard: "Premature formwork collapse under concrete load; falls during erection; crushing when striking formwork",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Formwork design by competent temporary works engineer; calculations reviewed and approved",
      "Erection sequence follows temporary works drawing; deviations not permitted without engineer's approval",
      "Minimum striking times per BS 8110 / BS EN 13670 for each element — records kept",
      "Striking sequence designed to avoid sudden load redistribution",
      "Exclusion zone below formwork during concrete pour and for 24 hours after",
      "Operatives wear hard hats at all times on formwork; edge protection fitted on all open edges",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear (steel midsole)", "Hi-vis", "Safety glasses", "Gloves"],
    regs: ["CDM 2015 (temporary works)", "BS EN 13670 (execution of concrete structures)", "CITB Good Practice Guide — Formwork"],
  },

  {
    id: "con_002",
    category: "Concrete & Formwork",
    activity: "Concrete pouring and placing",
    hazard: "Concrete chemical burns to skin and eyes; manual handling of heavy skips/chutes; pump hose whip; falls into formwork",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Waterproof gloves and eye protection worn when handling or in contact with wet concrete",
      "Skin washed immediately if contacted by wet concrete; cement burns can be severe",
      "Concrete pump hoses secured with safety chains at each joint; restraining device on discharge end",
      "Exclusion zone around concrete pump; no persons in zone during pumping",
      "No walking on reinforcement during pour; plank walkways over rebar provided",
      "Skip movements controlled by banksman; signal system agreed before pour starts",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Waterproof gloves", "Safety glasses/goggles", "Safety footwear (waterproof)", "Hi-vis", "Hard hat"],
    regs: ["COSHH 2002 (cement dermatitis)", "Manual Handling Ops Regs 1992", "PUWER 1998 (pump equipment)", "HSG150"],
  },

  {
    id: "con_003",
    category: "Concrete & Formwork",
    activity: "Reinforcement fixing (rebar)",
    hazard: "Cuts and puncture wounds from rebar ends; falls onto protruding rebar; manual handling of heavy bar bundles; HAVS from bar benders",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "All protruding vertical rebar capped with rebar caps (must be load-bearing mushroom type, not candy cap)",
      "Cut ends of rebar bent over or capped immediately after cutting",
      "Heavy rebar bundles handled mechanically; manual handling limited to manageable lengths",
      "HAVs exposure from bar benders and electric rebar cutters monitored; daily exposure limits enforced",
      "Walkways across rebar mat constructed from scaffold boards — not walking directly on rebar",
      "Tetanus vaccination recommended for all rebar workers (rusty metal penetration risk)",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Cut-resistant gloves (Level D)", "Safety footwear (steel midsole)", "Hard hat", "Safety glasses", "Hi-vis"],
    regs: ["Manual Handling Ops Regs 1992", "Control of Vibration at Work Regs 2005", "HASAWA 1974", "BS 8666 (rebar scheduling)"],
  },

  {
    id: "con_004",
    category: "Concrete & Formwork",
    activity: "Concrete cutting, coring and breaking",
    hazard: "Silica dust (RCS) during dry cutting; noise; HAVs from disc cutters and breakers; water and slurry management",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Wet cutting or on-tool extraction (vacuum) as primary silica control — no dry cutting without LEV",
      "RPE: minimum FFP3 for any dry cutting scenario; regular face-fit testing",
      "Silica health surveillance programme in place for regularly exposed workers",
      "Noise: operatives and bystanders in hearing protection when cutting above 80dB(A)",
      "HAVs: daily trigger times calculated per tool; rotation used to stay within action values",
      "Cutting slurry contained and disposed as controlled waste — not discharged to drain",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["FFP3 respirator (silica)", "Hearing protection", "Safety goggles", "Safety footwear", "Anti-vibration gloves"],
    regs: ["COSHH 2002", "EH40 (silica WEL: 0.1 mg/m³)", "Control of Noise Regs 2005", "Control of Vibration at Work Regs 2005"],
  },

  // ── BRICKLAYING & MASONRY ───────────────────────────────────────────────────

  {
    id: "brick_001",
    category: "Bricklaying & Masonry",
    activity: "Bricklaying and blockwork at height",
    hazard: "Falls from scaffold platform; falling bricks/blocks onto workers below; scaffold overloading from block pallets",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Scaffold inspected and signed off before bricklayers access",
      "Bricks and blocks loaded in manageable quantities; scaffold loading limits not exceeded",
      "Brick guard / toe boards fitted on all working platforms",
      "Exclusion zone maintained below all bricklaying operations",
      "Blocks above 20kg mechanically handled or team lifted; no individual to carry single course blocks over distance",
      "Operatives brief on fragile material handling — no throwing or dropping",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Gloves", "Safety glasses (cutting)"],
    regs: ["Work at Height Regs 2005", "Manual Handling Ops Regs 1992", "NASC TG20:21", "CDM 2015"],
  },

  {
    id: "brick_002",
    category: "Bricklaying & Masonry",
    activity: "Masonry cutting — disc cutter and bench saw",
    hazard: "Silica dust; noise; disc failure; vibration; water and slurry",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Wet cutting used as first preference — water suppression on all masonry cutting",
      "If dry cutting unavoidable, on-tool LEV with HEPA vacuum used; no dry unventilated cutting",
      "All operatives in hearing protection near masonry saw",
      "Blade guard in place and secure; disc checked for damage before each use",
      "Cutting area segregated; no bystanders within 3m of cutter",
      "Slurry contained; no discharge to surface water drain or watercourse",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["FFP3 mask (silica)", "Hearing protection", "Safety goggles", "Safety footwear", "Gloves"],
    regs: ["COSHH 2002", "EH40 (silica)", "PUWER 1998", "Control of Noise Regs 2005"],
  },

  {
    id: "brick_003",
    category: "Bricklaying & Masonry",
    activity: "Cement and mortar mixing",
    hazard: "Cement dermatitis and chemical burns; dust inhalation during bag emptying; HAVS from forced-action mixers",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Nitrile or natural rubber gloves worn throughout mixing and placing",
      "Skin washed promptly on contact; protective cream used before and after",
      "Dust mask worn when opening and emptying cement bags",
      "Mixer operated with guard in place; never reached into rotating drum",
      "Drum cleaned out at end of each day; cement build-up removed with proper tools",
      "Health surveillance for workers regularly exposed to wet cement (dermatitis watch)",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Nitrile gloves", "Safety glasses", "Dust mask (FFP2)", "Safety footwear"],
    regs: ["COSHH 2002 (hexavalent chromium in cement)", "PUWER 1998", "Control of Vibration at Work Regs 2005"],
  },

  // ── COMPRESSED AIR & STEAM SYSTEMS ─────────────────────────────────────────

  {
    id: "ca_001",
    category: "Compressed Air & Steam Systems",
    activity: "Compressed air pipework installation and testing",
    hazard: "Pressure vessel failure; high-velocity air blast causing injury; whipping hose; noise from air release",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Pipework designed and installed to BS EN ISO 11011 / BS 1710; pressure rated fittings used",
      "Pressure test to 1.5× working pressure; witnesses and records kept",
      "Quick-release hose couplings fitted with whip checks at all joints",
      "System fitted with pressure relief valve set at maximum allowable working pressure",
      "No work on pressurised system; system isolated, depressurised and locked off before any work",
      "Hearing protection worn during pressure testing or any controlled venting",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety glasses/face shield", "Hearing protection", "Safety footwear", "Gloves"],
    regs: ["PSSR 2000", "PUWER 1998", "BS EN ISO 11011", "Electricity at Work Regs 1989"],
  },

  {
    id: "ca_002",
    category: "Compressed Air & Steam Systems",
    activity: "Steam pipework and system commissioning",
    hazard: "Burns from steam release and hot surfaces; hydraulic shock (water hammer); pressure system failure; condensate flash steam",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Steam mains warmed up slowly — steam trap bypass used to purge condensate before full load",
      "All joints and flanges checked for leaks at low pressure before full pressure applied",
      "Pipe and fitting lagging installed before commissioning; bare hot surfaces guarded or tagged",
      "Condensate drain points provided at all low spots; all drains functional before commissioning",
      "Safety valves tested and set; discharge pipes directed safely away from personnel",
      "Written commissioning procedure signed by competent person; witnessed by engineer",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Face shield", "Heat-resistant gloves", "Safety footwear (steel toe)", "Hi-vis"],
    regs: ["PSSR 2000", "L56 ACOP", "BS EN 12953 (steam boilers)", "Electricity at Work Regs 1989"],
  },

  {
    id: "ca_003",
    category: "Compressed Air & Steam Systems",
    activity: "Pressure vessel inspection and maintenance",
    hazard: "Residual pressure release during maintenance; confined space entry into vessel; scale/debris dislodgement; electrical isolation",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Written scheme of examination in place; inspection carried out by competent person (PSSR)",
      "Vessel isolated, depressurised and locked off before any inspection or maintenance entry",
      "Confined space entry permit issued for internal vessel inspection",
      "Vessel vented, cooled and atmospheric test completed before entry",
      "All mechanical and electrical isolations applied; permits matched to specific vessel",
      "Post-maintenance hydrotest completed and recorded before returning to service",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["SCBA (confined space entry)", "Safety footwear", "Safety glasses", "Coveralls", "Hard hat"],
    regs: ["PSSR 2000", "Confined Spaces Regs 1997", "LOLER 1998 (lifting equipment in maintenance)", "Electricity at Work Regs 1989"],
  },

  // ── ROPE ACCESS (IRATA) ────────────────────────────────────────────────────

  {
    id: "ra_001",
    category: "Rope Access (IRATA)",
    activity: "Rope access work — external facade and structure",
    hazard: "Falls from height; rope system failure; anchor point failure; pendulum swing; rescue of incapacitated operative",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "All operatives hold current IRATA Level 1 minimum; Level 3 supervisor present for all work",
      "Two independent rope systems used at all times — working line and safety line (backup device)",
      "Anchor points designed and tested by structural engineer; minimum 15kN per person",
      "Rescue plan prepared and practiced before work begins; rescue equipment rigged and accessible",
      "No rope access work during wind above Beaufort 5, rain reducing visibility or electrical storms",
      "Work area below secured; exclusion zone established and maintained",
      "Tooling and equipment tethered; tool bags used",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Full harness (EN 361)", "Helmet with chin strap (EN 12492)", "Safety footwear", "Gloves"],
    regs: ["Work at Height Regs 2005", "IRATA International Code of Practice", "BS 7985 (rope access for inspection)", "LOLER 1998"],
  },

  {
    id: "ra_002",
    category: "Rope Access (IRATA)",
    activity: "Rope access — hot works and tool use at height",
    hazard: "Fire risk from sparks falling on ropes; molten metal splatter cutting ropes; falling tools causing injury",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Hot works permit issued; rope access supervisor reviews compatibility with hot works",
      "Ropes and equipment protected with fire-resistant rope covers/shrouds during hot work",
      "Welding/grinding only after ensuring all ropes are clear of spark trajectory",
      "Fire extinguisher raised to work area; fire watch maintained",
      "Welding set cables kept separate from rope system",
      "Any rope exposed to sparks or heat removed from service and destroyed",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Full harness", "Helmet", "Leather welding gloves", "Leather apron", "Face shield (grinding/welding)"],
    regs: ["Work at Height Regs 2005", "IRATA ICOP", "Hot Works Permit", "COSHH 2002 (welding fumes)"],
  },

  {
    id: "ra_003",
    category: "Rope Access (IRATA)",
    activity: "Rope access inspection and survey works",
    hazard: "Suspended access above public areas; over-water working; industrial environment hazards at height",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Public exclusion zone established and maintained for full duration; barriers and signage in place",
      "Over-water: life jackets worn; throw line and rescue boat on standby",
      "Rope access team briefed on specific site hazards (industrial plant, live electrical, chemical stores)",
      "Buddy system: minimum two operatives at all times; solo work prohibited",
      "Emergency services informed for long-duration works in remote or complex environments",
      "Equipment inspection completed and documented before every deployment",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Full harness", "Helmet", "Safety footwear", "Hi-vis", "Life jacket (over water)"],
    regs: ["Work at Height Regs 2005", "IRATA ICOP", "HASAWA 1974", "PPE Regs 2022"],
  },

  // ── COLD STORAGE & REFRIGERATED SPACES ─────────────────────────────────────

  {
    id: "cold_001",
    category: "Cold Storage & Refrigerated Spaces",
    activity: "Working in cold storage chambers and blast freezers",
    hazard: "Hypothermia and cold stress; being locked inside chamber; ammonia leak from refrigeration plant; oxygen depletion from CO2 refrigerant",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Works planned in warm-up periods where possible; cold chamber pre-entry checks completed",
      "Two-person rule: no individual to enter cold store alone — buddy system enforced",
      "Door release mechanism confirmed functional from inside before entry; never disabled",
      "Warm-up breaks scheduled: maximum continuous cold exposure per health surveillance guidance",
      "Atmospheric monitor for ammonia and CO2 used before and during entry into plant rooms",
      "Cold-weather PPE (thermal layers, insulated gloves and boots) issued and worn",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Thermal coveralls", "Insulated gloves", "Insulated safety footwear", "Hard hat (if overhead work)", "Gas detector (where refrigerant present)"],
    regs: ["COSHH 2002", "HASAWA 1974", "Confined Spaces Regs 1997 (deep freeze blast cells)", "EH40 (ammonia WEL)"],
  },

  {
    id: "cold_002",
    category: "Cold Storage & Refrigerated Spaces",
    activity: "Cold room panel installation",
    hazard: "Manual handling of large insulated panels; cutting polyurethane (PU) foam dust; falls on icy or wet floors; isocyanate exposure from foam",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Panels handled by minimum two operatives; vacuum lifter used for ceiling panels",
      "PU foam cutting with band saw or blade in preference to hot wire; LEV used",
      "Isocyanate COSHH assessment; RPE (P3) worn if spray foam used or foam cut hot",
      "Anti-slip footwear worn on all refrigerated floor surfaces",
      "Electrical installation in cold rooms to BS 7671 special locations requirements",
      "Panel joints tested for air infiltration before handover",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Insulated gloves", "Safety footwear (anti-slip)", "Dust mask (FFP2)", "Safety glasses", "P3 RPE (if spray PU foam)"],
    regs: ["COSHH 2002 (isocyanates — MDI)", "Manual Handling Ops Regs 1992", "BS 7671 (Section 706)", "EH40 WEL (MDI)"],
  },

  {
    id: "cold_003",
    category: "Cold Storage & Refrigerated Spaces",
    activity: "Refrigeration plant room maintenance — industrial ammonia systems",
    hazard: "Ammonia gas release (toxic and flammable); rapid de-pressurisation; burns from liquid ammonia contact; oxygen displacement",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Permit to Work issued for all refrigeration plant work; system owner/engineer present",
      "Ammonia gas detector calibrated and functional throughout works",
      "Fixed ammonia detection and ventilation interlock tested before works commence",
      "Self-contained breathing apparatus (SCBA) available at plant room entrance",
      "Eye wash station confirmed functional before works begin",
      "Emergency response plan and spill kit in place; environment agency notified for major releases",
      "Only ACRIB/F-Gas qualified and refrigeration-trained engineers to work on ammonia system",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["SCBA (on standby)", "Chemical resistant gloves", "Chemical resistant coveralls", "Full face shield", "Safety footwear"],
    regs: ["COSHH 2002", "PSSR 2000", "EH40 (NH3: 25ppm TWA)", "F-Gas Regs (for HFCs)", "HASAWA 1974"],
  },

  {
    id: "cold_004",
    category: "Cold Storage & Refrigerated Spaces",
    activity: "Condensing unit and evaporator installation",
    hazard: "Refrigerant release during system commissioning; electrical work on roof/external plant; manual handling of condensing units; pressurised pipe leak test",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "F-Gas certified engineer carries out all refrigerant handling and charging",
      "System pressure-tested with nitrogen before refrigerant is introduced",
      "Leak check with electronic detector on completion of commissioning",
      "Roof-mounted condensing units: edge protection/harness as appropriate to roof type",
      "Condensing units above 25kg lifted mechanically; lift plan for rooftop craning",
      "All refrigerant usage logged in F-Gas register; quantity purchased and charged recorded",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Cryogenic gloves (HFC contact)", "Safety glasses", "Safety footwear", "F-Gas certification"],
    regs: ["F-Gas Regulation (UK retained)", "PSSR 2000", "Work at Height Regs 2005", "LOLER 1998 (rooftop craning)"],
  },

  // ── SECURITY & BUILDING TECHNOLOGY SYSTEMS ─────────────────────────────────

  {
    id: "sec_001",
    category: "Security & Building Technology Systems",
    activity: "Intruder alarm and detection system installation",
    hazard: "Accidental alarm activation causing disruption; electrical work at panels; drilling near unknown services; falls from access equipment",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Works agreed and planned with building occupier/security manager before commencement",
      "Alarm system inhibited for work zone only; remaining system stays active",
      "CAT scan before drilling to locate hidden cables and services",
      "All panel work by qualified engineer; live panel isolated before wiring",
      "Access equipment (step ladder, podium) used for detector installation; not improvised",
      "Testing and commissioning schedule agreed with client to avoid false call-out",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety footwear", "Safety glasses", "Hard hat (where overhead work)"],
    regs: ["Electricity at Work Regs 1989", "BS EN 50131 (alarm systems)", "Work at Height Regs 2005", "Police URN guidelines"],
  },

  {
    id: "sec_002",
    category: "Security & Building Technology Systems",
    activity: "Door access control and electric locking hardware",
    hazard: "Persons trapped by fail-secure locks during power failure; struck by high-force automatic door; electric shock at door controller",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Fail-safe vs fail-secure modes reviewed with fire safety engineer; fire exit locks always fail-safe",
      "Automatic door forces tested to BS EN 16005; max closing force 150N for pedestrian doors",
      "Power supply isolated before any work on door controller; mains wiring by qualified electrician",
      "Door access control system tested for full open/close cycle before handover",
      "Emergency release procedures documented and communicated to building management",
      "Interoperability with fire alarm tested — doors release on fire alarm activation",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety footwear", "Safety glasses", "Insulated tools (panel work)"],
    regs: ["Electricity at Work Regs 1989", "BS EN 16005 (powered pedestrian doors)", "BS 8220 (security of buildings)", "Fire Safety Regs 2022"],
  },

  {
    id: "sec_003",
    category: "Security & Building Technology Systems",
    activity: "Electronic barriers, bollards and vehicle security installation",
    hazard: "Crushing by automatic barrier or rising bollard during commissioning; civil groundworks for bollard foundations; electrical installation",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "All persons clear of bollard/barrier movement zone during commissioning and testing",
      "Exclusion zone maintained around automatically-operated vehicle restraint during testing",
      "Foundation design by structural engineer for crash-rated bollards; BS PAS 68 compliance",
      "CAT scan before groundworks for foundation excavation",
      "Electrical interlock with barrier control system prevents operation until area is clear",
      "Safety edges and photo-electric beams tested and confirmed functional before live operation",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Safety footwear (steel midsole)", "Hard hat", "Safety glasses", "Hi-vis"],
    regs: ["BS PAS 68 (vehicle security barriers)", "Machinery Directive 2006/42/EC (UK retained)", "Electricity at Work Regs 1989", "CDM 2015"],
  },

];

export default PRO_LIBRARY;

// ─── Usage in app ─────────────────────────────────────────────────────────────
//
//   import BASE from "./ramsHazardLibrary";
//   import EXT  from "./ramsHazardLibraryExtended";
//   import PRO  from "./ramsHazardLibraryPro";
//
//   export const ALL_HAZARDS = [...BASE, ...EXT, ...PRO];
//   // Total: 30 + 35 + 38 = 103 hazards across 33 trade categories
