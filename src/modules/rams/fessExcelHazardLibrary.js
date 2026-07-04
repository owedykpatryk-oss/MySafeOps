/** Auto-derived from FESS_GROUP_RAMS_MASTER_ANALYSIS.xlsx — do not hand-edit. */

export const FESS_EXCEL_CATEGORIES = [
  "Food Factory M&E",
  "Construction & Groundworks",
  "Survey & Geodesy",
  "Lifting Operations",
  "Pet Food Production",
  "Food Production Line"
];

const FESS_EXCEL_LIBRARY = [
  {
    "id": "fess_001",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Working in allergen-controlled zones",
    "hazard": "Cross-contamination from tools/parts moved between allergen zones",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Allergen briefing before entry",
      "Dedicated tool sets per zone, clearly tagged",
      "No food/drink brought in from other zones",
      "Hands washed/sanitised on zone entry."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_002",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Working above or adjacent to open product lines",
    "hazard": "Foreign body contamination from drilling/cutting/loose parts falling into product",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Line stopped or physically isolated/covered before overhead work begins",
      "Magnetic sweep and visual inspection of area after work",
      "Metal detector challenge test carried out before line restart."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_003",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Access to High-Care / High-Risk zones",
    "hazard": "Cross-contamination between low-care and high-care areas via footwear, clothing, tools",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Zone-specific colour-coded PPE",
      "No crossover of tools/footwear between zones",
      "Boot-wash and hand-wash station used on every zone transition."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_004",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Bringing glass or hard plastic items into production areas",
    "hazard": "Breakage causing foreign body contamination risk",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "All glass/brittle plastic items logged on site Glass & Hard Plastic register before entry",
      "Any breakage reported immediately and area quarantined pending inspection."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 2,
      "RF": 4
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_005",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "General site work in food production areas",
    "hazard": "Loose jewellery, false nails, unprotected plasters as foreign body risk",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "No loose jewellery, watches, false nails",
      "Any plasters used must be blue/metal-detectable and covered with a glove."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 4,
      "RF": 4
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_006",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Opening ceiling voids, wall cavities, floor voids",
    "hazard": "Disturbance of pest control bait stations, exposure to pest activity",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "Check for pest control bait stations before disturbing voids",
      "Report any evidence of pest activity to site QA/pest control contractor before continuing."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 2,
      "RF": 2
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_007",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Use of lubricants, sealants, threadlocker near product zones",
    "hazard": "Non-food-grade chemicals contaminating product or surfaces",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Only NSF H1-rated food-grade lubricants and sealants used within product zones",
      "MSDS held on site for all substances."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_008",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Working on or near ammonia/CO2 refrigeration plant",
    "hazard": "Toxic gas exposure, asphyxiation, cold burns from refrigerant leak",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Refrigerant-specific RA and permit required before work starts",
      "Gas detector used before and during entry to plant room",
      "F-Gas certified engineer only",
      "Emergency evacuation procedure briefed on induction."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_009",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Entry into confined spaces (tanks, voids, pits)",
    "hazard": "Oxygen deficiency, toxic atmosphere, entrapment, difficulty of rescue",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Confined Space Entry Permit required",
      "Atmosphere tested before entry and continuously monitored",
      "Top-man in constant attendance",
      "Rescue plan and equipment in place before entry",
      "No lone entry under any circumstances."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_010",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Hot work or grinding in areas with combustible dust (flour, protein, sugar)",
    "hazard": "Dust explosion (ATEX) from ignition source in a dust-laden atmosphere",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Zone classification checked before Hot Work Permit issued",
      "Area vacuumed/cleaned of dust accumulation before hot work",
      "Fire watch maintained during and after work",
      "Ignition sources controlled per DSEAR."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_011",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Opening or working on water systems (RO, pipework, tanks)",
    "hazard": "Legionella exposure from aerosolised water during system disturbance",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "Legionella awareness briefing before opening any water system",
      "Site Legionella Responsible Person notified in advance",
      "System flushed and sampled per site water hygiene procedure before return to service."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 4,
      "RF": 4
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_012",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Working inside cold stores / freezers / low-temp environments",
    "hazard": "Cold stress, reduced dexterity, slips on ice",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "Maximum continuous exposure time set per site cold-work policy",
      "Warm-up breaks scheduled",
      "Appropriate cold-weather PPE issued",
      "Buddy system for extended cold work."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 2,
      "RF": 2
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_013",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Lifting and relocating machinery/plant",
    "hazard": "Uncontrolled load movement, crush injury, equipment failure during lift",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Lift Plan produced and reviewed before any lift",
      "Only LOLER-inspected lifting equipment used, in date",
      "Competent slinger/signaller assigned",
      "Exclusion zone maintained under load at all times."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_014",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Handover of installed/relocated machinery to site",
    "hazard": "Equipment not compliant with PUWER before being returned to production use",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "PUWER compliance check completed before handover",
      "Guarding verified in place and effective",
      "Isolation points clearly identified and labelled",
      "Sign-off recorded before machine released to site."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 2,
      "RF": 2
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_015",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Extended use of angle grinders, drills, impact tools",
    "hazard": "Hand-Arm Vibration Syndrome (HAVS) from prolonged vibration exposure",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Daily trigger-time logged per operative against tool vibration magnitude data",
      "Task rotation used to limit individual exposure",
      "Health surveillance referral for operatives exceeding exposure action value."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_016",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Decommissioning and removal of plant/machinery",
    "hazard": "Uncontrolled waste stream — oils, refrigerants, chemical residue",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "Waste segregation and disposal RA completed before work starts",
      "Oil/refrigerant containment equipment on site",
      "Spill kit available at point of work",
      "Waste consignment notes retained."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 2,
      "RF": 2
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_017",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Drilling, fixing, or disturbing building fabric (ceilings, walls, roof)",
    "hazard": "Asbestos exposure in older building fabric, ceiling tiles, gaskets, lagging",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Site Asbestos Management Survey checked before any work disturbing fabric",
      "If asbestos-containing material suspected, work stops immediately and site Duty Holder informed."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_018",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Attending site alone for callout/reactive work",
    "hazard": "Delayed emergency response if lone worker is injured or incapacitated",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "Lone worker check-in procedure followed at defined intervals",
      "Emergency contact held by office",
      "No lone working permitted for confined space entry or live electrical work under any circumstances."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 2,
      "RF": 2
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_019",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Extended or night-time callout attendance",
    "hazard": "Fatigue-related error, driving risk after night shift",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "Fatigue risk considered before accepting extended/night callouts",
      "Rest break scheduled",
      "Driving risk assessed before travel home after a night shift."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 2,
      "RF": 2
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_020",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "FLT and delivery vehicle movement in yard/production areas",
    "hazard": "Collision between vehicles, plant, and pedestrians",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Site traffic management plan briefed at induction",
      "Pedestrian and vehicle routes segregated where possible",
      "Banksman used for all delivery vehicle manoeuvres near work areas."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_021",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Isolation and venting of pressure vessels/boilers (tank/kettletank work)",
    "hazard": "Uncontrolled release of pressure, scalding, vessel failure",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Vessel fully isolated and vented by a competent person before work starts",
      "Isolation verified and permit issued before entry or removal work begins."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_022",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Live working on control panels / automation systems",
    "hazard": "Arc flash, electric shock from live panel components",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Arc flash risk assessment completed before any live panel work",
      "PPE rated to assessed incident energy level",
      "Panel isolated and proven dead wherever possible",
      "live working only under permit with second competent person present."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_023",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Commissioning SCADA, PLC, or automation changes on a live line",
    "hazard": "Uncontrolled machine movement from software/control change",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Change control procedure followed for all PLC/software changes",
      "Line locked out/guarded during commissioning",
      "Function test carried out in a controlled, guarded state before line released to production."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 4,
      "RF": 4
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_024",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Installing or maintaining conveyor systems",
    "hazard": "Entanglement or crushing at nip points, belt/roller entrapment",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Conveyor fully isolated and locked off before guard removal",
      "Nip-point guarding verified in place and effective before re-energising",
      "Belt tensioning carried out per manufacturer procedure with guards fitted."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_025",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Working under CDM 2015 on construction-related projects",
    "hazard": "Uncoordinated site activity, unclear duty-holder responsibilities, undefined construction phase risks",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "CDM roles (Client, Principal Designer, Principal Contractor) confirmed before work starts",
      "Construction Phase Plan in place",
      "F10 notification submitted where project meets notifiable thresholds."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_026",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Working on petrochemical sites in hazardous area classified zones",
    "hazard": "Flammable atmosphere ignition, toxic gas exposure, static discharge",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Hazardous area classification confirmed before any work",
      "Only ATEX-rated equipment used in classified zones",
      "Gas testing before hot work",
      "Static bonding/earthing used for flammable liquid transfer."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "fess_027",
    "sector": "food_pharma",
    "category": "Food Factory M&E",
    "activity": "Working within pharmaceutical cleanroom/GMP-controlled environments",
    "hazard": "Contamination of controlled environment, breach of validated process/change control",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Cleanroom entry/gowning procedure followed",
      "Change control approval obtained before any equipment modification",
      "Validated equipment status confirmed before and after work."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_001",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Excavation / trenching",
    "hazard": "Collapse of excavation sides burying operative; a leading cause of construction fatalities",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Excavation over 1.2m battered back or supported with proprietary shoring/trench box",
      "Support system designed by competent person",
      "Daily inspection before each shift and after any event that may affect stability",
      "No entry to unsupported excavation",
      "Spoil kept min 1m from edge."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_002",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Excavation near buried services",
    "hazard": "Strike on live electricity, gas, water or telecoms",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Utility drawings obtained and CAT & Genny scan before digging",
      "Safe digging practice to HSG47 — hand dig within 500mm of located services",
      "Permit to dig",
      "Services located, marked and, where possible, isolated before work."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_003",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Falls into open excavation",
    "hazard": "Person or vehicle falling into an open trench/pit",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Edge protection / barriers to all open excavations",
      "Covers over pits when unattended",
      "Warning signage and lighting at night",
      "Stop blocks for vehicles working near edges",
      "Safe access ladder into excavation extending 1m above."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_004",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Working in occupied / live premises",
    "hazard": "Injury to client staff or public from construction activity in an operational building",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Segregation of work area from occupied areas with hoarding/barriers",
      "Agreed access routes",
      "Dust and noise controlled to protect occupants",
      "Works planned around occupancy where possible",
      "Client informed of activity daily."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_005",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Scaffold erection and dismantling",
    "hazard": "Falls from height during erect/dismantle; falling components; collapse from incorrect build",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Erected, altered and dismantled only by CISRS-qualified scaffolders",
      "Designed scaffold where non-standard",
      "Handover certificate (Scaftag) before use",
      "Weekly inspection and after adverse weather",
      "Exclusion zone below during erect/dismantle."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_006",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Use of erected scaffold / working platform",
    "hazard": "Falls from height; falling objects onto persons below",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Scaftag checked as green/current before access",
      "Full guardrails, mid-rails and toe-boards",
      "No incomplete scaffold used (incomplete tagged and access blocked)",
      "Materials secured against falling",
      "Hard hat zone below."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_007",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Fragile roof / roof work",
    "hazard": "Fall through fragile roof material (rooflights, asbestos cement, old decking) — a top UK fatality cause",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Fragile surfaces identified before access and clearly marked",
      "Staging/crawling boards and edge protection used",
      "Never step on rooflights or fragile sheets",
      "Safety nets or air bags beneath where risk remains",
      "Working at height permit issued."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_008",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Demolition / soft strip",
    "hazard": "Uncontrolled collapse; falling debris; buried services; hazardous materials in fabric",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Demolition plan by competent person",
      "Pre-demolition asbestos/hazardous materials survey completed",
      "Services disconnected and confirmed before strip",
      "Exclusion zones",
      "Sequence controlled top-down",
      "No one beneath work at height."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_009",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Temporary works (props, shoring, formwork)",
    "hazard": "Collapse of temporary structure causing crush/burial",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Temporary works design and check by a Temporary Works Coordinator/Engineer",
      "Permit to load and permit to strike",
      "No loading before sign-off",
      "Regular inspection through the temporary works lifecycle."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_010",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Concrete pours and formwork",
    "hazard": "Formwork blowout, manual handling, skin burns from wet concrete, entanglement in pump/vibrator",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Formwork designed and checked",
      "Controlled pour rate to avoid blowout",
      "Waterproof PPE against cement burns",
      "Concrete pump operated by competent person with agreed signals",
      "Vibrator guarding and electrical checks."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_011",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Piling operations",
    "hazard": "Struck by rig or falling pile; underground services; noise and vibration",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Rig operated by trained/competent operator",
      "Exclusion zone around rig",
      "Services located before piling",
      "Ground conditions assessed for rig stability",
      "Noise and vibration monitored",
      "hearing protection worn."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xcon_012",
    "sector": "construction",
    "category": "Construction & Groundworks",
    "activity": "Dust from cutting/breaking (silica)",
    "hazard": "Respirable crystalline silica exposure from cutting concrete, stone, brick — long-term lung disease",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "On-tool water suppression or LEV for all cutting/breaking",
      "RPE (minimum FFP3, face-fit tested)",
      "Rotate tasks to limit exposure",
      "Never dry-cut silica-containing materials without controls",
      "Health surveillance for regular exposure."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_001",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Utility / GPR survey on public highway",
    "hazard": "Struck by moving traffic while working in live carriageway or footway",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Traffic management per Chapter 8 of the Traffic Signs Manual",
      "High-vis to EN ISO 20471 worn at all times",
      "Coned working area where practical",
      "Lookout posted for live traffic sections",
      "Never work with back to oncoming traffic."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_002",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Verifying GPR findings by trial hole / hand dig",
    "hazard": "Strike on live buried electrical, gas or water service",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "CAT & Genny scan of the area before any excavation",
      "Utility record drawings obtained in advance",
      "Safe digging practice to HSE HSG47 (hand dig within 500mm of any located service)",
      "Permit to dig obtained where site requires."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_003",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Pushing / carrying GPR cart over uneven ground",
    "hazard": "Manual handling injury; slips, trips, falls on rough terrain",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Wheeled cart used where ground allows",
      "Correct pushing technique, avoid twisting",
      "Team handling for equipment over 25kg",
      "Route checked for trip hazards before survey run",
      "Task rotation on long runs."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_004",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Topographic survey near live traffic or moving plant",
    "hazard": "Struck by vehicle or plant while stationary at the instrument",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "High-vis mandatory",
      "Situational awareness briefing before entering active site",
      "Position instrument away from live traffic/plant paths",
      "Never set up with back to vehicle movement",
      "Agree exclusion with site where plant is operating."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_005",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Survey access over embankments, riverbanks, spoil heaps",
    "hazard": "Slips, trips and falls on unstable or steep terrain; fall into water",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Site walk-over risk assessment before starting",
      "Footwear appropriate to terrain",
      "No lone working on high-risk terrain or near open water",
      "Buoyancy aid where working next to deep water",
      "Weather conditions assessed."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_006",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Drone (UAV) flight operations",
    "hazard": "Loss of control / fly-away; collision with structure, person or aircraft; propeller injury",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "CAA-compliant operation (A2 CofC or GVC as the operation requires)",
      "Pre-flight risk assessment and site survey",
      "Airspace check (NOTAM / restricted airspace / FRZ)",
      "Flight logged",
      "Exclusion zone below flight path",
      "Visual line of sight maintained",
      "observer used for complex sites."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_007",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Drone LiPo battery handling and charging",
    "hazard": "Fire or explosion from damaged or incorrectly charged lithium polymer cells",
    "initialRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "controlMeasures": [
      "Batteries inspected for damage/swelling before use",
      "Charged in a fireproof LiPo bag/case, never unattended",
      "Damaged cells quarantined and disposed via specialist route, not general waste",
      "Transported in fire-resistant case."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_008",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Drone flight near overhead lines or substations",
    "hazard": "Collision with overhead lines; EMI affecting GPS/control signal",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Minimum stand-off distance from overhead lines set in pre-flight RA",
      "Awareness that EMI near substations/pylons can degrade GPS and control link",
      "Abort-and-land procedure briefed if control anomalies occur."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_009",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Drone flight over or near uninvolved persons",
    "hazard": "Injury to members of the public from crash or fly-away",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Flight planned to avoid overflight of uninvolved persons where possible",
      "Ground exclusion zone and signage during flight",
      "Public liability insurance in place",
      "Mandatory Occurrence Report to CAA where required."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_010",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Static / mobile laser scanning (point cloud / LiDAR)",
    "hazard": "Trips over tripod/cabling; manual handling; laser eye safety for higher-class scanners",
    "initialRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "controlMeasures": [
      "Cable and tripod positioned to avoid trip hazards, secured on uneven ground",
      "Scanner laser class checked",
      "signage and eyewear provided where the class requires it",
      "Correct manual handling for scanner/tripod transport."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 4,
      "RF": 4
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_011",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Confined access survey of chambers, ducts, culverts",
    "hazard": "Oxygen deficiency / toxic atmosphere; entrapment; public fall into open chamber",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Full confined space entry protocol before any entry (permit, gas testing before and during, top-man in attendance, rescue plan, no lone entry)",
      "Open chamber guarded/covered and signed while accessed to prevent public falls."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_012",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Lone / remote site survey work",
    "hazard": "Delayed emergency response if isolated with poor phone signal",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Lone worker check-in device/app with GPS where signal allows",
      "Check-in times agreed before departure",
      "Office holds site location and expected return time",
      "Escalation procedure if a check-in is missed."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_013",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Surveying on a live construction or utility site",
    "hazard": "Exposure to third-party site hazards while focused on the survey task",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Site induction completed before survey begins",
      "PPE per site rules",
      "Survey task never overrides basic site awareness",
      "Position agreed with principal contractor to avoid plant/excavation/overhead work zones."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_014",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Driving between multiple survey sites",
    "hazard": "Road traffic incident; fatigue on multi-site days; load shift in vehicle",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Driver risk assessment and fatigue management for multi-site days",
      "GPR carts, tripods, drone cases secured in transit to prevent load shift",
      "Breaks scheduled",
      "Vehicle checks before long journeys."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xsur_015",
    "sector": "surveying",
    "category": "Survey & Geodesy",
    "activity": "Office processing of point cloud / GPR data",
    "hazard": "Display screen equipment (DSE) strain, eye strain from extended processing",
    "initialRisk": {
      "L": 2,
      "S": 2,
      "RF": 4
    },
    "controlMeasures": [
      "DSE workstation assessment",
      "Regular screen breaks (e.g",
      "5-10 min per hour)",
      "Appropriate monitor setup and lighting for detailed review work."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 2,
      "RF": 2
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_001",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Mobile crane lift",
    "hazard": "Crane overturn; load fall; collision with structures/overhead lines",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Lift plan by Appointed Person",
      "Crane on firm level ground with outriggers/mats",
      "ground bearing assessed",
      "Exclusion zone under load and slew radius",
      "Min distance from overhead lines observed",
      "Trained slinger/signaller with agreed signals."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_002",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Tower crane operation",
    "hazard": "Load fall; collision; structural failure; dropped objects over public areas",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Erected/inspected by competent contractor with thorough examination",
      "Anti-collision zoning where cranes oversail",
      "No oversailing of public/occupied areas with load where avoidable",
      "Wind speed limits observed",
      "out of service in high wind."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_003",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Tandem / multi-crane lift",
    "hazard": "Load imbalance/shift; overload of one crane if load shifts",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Detailed lift plan for tandem lift by Appointed Person",
      "Both cranes de-rated",
      "Continuous communication between operators via dedicated signaller",
      "Slow controlled movements",
      "Load monitored throughout for shift."
    ],
    "revisedRisk": {
      "L": 1,
      "S": 6,
      "RF": 6
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_004",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Lifting with excavator / telehandler (as a crane)",
    "hazard": "Overturn; load fall; use of unsuitable machine for lifting",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Machine rated and configured for lifting duties (object handling mode)",
      "Certified lifting points and accessories",
      "Load within de-rated capacity",
      "Competent operator",
      "Never lift with a machine not designed/certified for it."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_005",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Slinging and securing loads",
    "hazard": "Load slip from sling; sling failure; being struck by swinging load",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "LOLER-inspected, in-date lifting accessories rated for the load",
      "Correct sling angle and configuration",
      "Load centre of gravity assessed",
      "Tag lines to control swing",
      "No hands on load during lift",
      "guide with tag line only."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_006",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Lifting personnel in a work platform",
    "hazard": "Fall from platform; platform detachment; crane failure with persons aloft",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Only where no safer means of access is reasonably practicable",
      "Man-riding basket certified for personnel",
      "Fall arrest harness clipped to designated point",
      "Enhanced examination regime",
      "Rescue plan for persons stranded aloft."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_007",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Lift over or near live traffic / public",
    "hazard": "Load fall onto public; struck by load; traffic disruption",
    "initialRisk": {
      "L": 4,
      "S": 6,
      "RF": 24
    },
    "controlMeasures": [
      "Road/footway closure or management where lift oversails public routes",
      "Exclusion zone and marshals",
      "Lift timed to minimise public exposure",
      "Public liability and permissions in place."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 6,
      "RF": 12
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "xlift_008",
    "sector": "construction",
    "category": "Lifting Operations",
    "activity": "Repeated routine lifting (pick and carry)",
    "hazard": "Complacency-related incidents on routine repeated lifts",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Even routine lifts covered by a lift plan appropriate to complexity",
      "Daily equipment checks",
      "Competency maintained",
      "Exclusion discipline maintained on every lift, not just the first."
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974",
      "CDM 2015"
    ]
  },
  {
    "id": "petf_001",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Raw material intake (meat, offal, fish, grain)",
    "hazard": "Biological hazard from raw animal by-products; manual handling of heavy sacks/totes; slip hazard from fat/blood residue",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "PPE incl",
      "cut-resistant gloves, non-slip footwear",
      "hand hygiene stations at intake",
      "raw material segregated from finished product area"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "ABP Regulations (EC) 1069/2009 — Animal By-Products"
    ]
  },
  {
    "id": "petf_002",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Rendering / cooking process",
    "hazard": "Steam/heat burns, hot fat exposure, strong odour/fume exposure, pressure vessel risk",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "PPE for heat exposure, LEV for odour/fume control, pressure vessel written scheme of examination, permit for any vessel entry/maintenance"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "Pressure Systems Safety Regulations 2000"
    ]
  },
  {
    "id": "petf_003",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Mixing / blending raw ingredients",
    "hazard": "Entanglement in mixer/blender moving parts, manual handling of ingredient additions, dust exposure from dry ingredients",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Guarding interlocks verified before any maintenance access",
      "lock-out before entering mixer",
      "RPE for dry ingredient dust",
      "safe manual handling for ingredient bags"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "PUWER 1998"
    ]
  },
  {
    "id": "petf_004",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Extrusion / cooking (kibble production)",
    "hazard": "High-pressure/high-temperature process, burns from extruder barrel, noise from extruder operation, entanglement at feed point",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Extruder isolation and cool-down procedure before maintenance access",
      "noise assessment and hearing protection",
      "feed point guarding verified"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "PUWER 1998 / Control of Noise at Work Regulations 2005"
    ]
  },
  {
    "id": "petf_005",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Drying",
    "hazard": "Heat exposure, fire risk from dust accumulation in drying equipment, confined space risk during internal cleaning",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Fire risk assessment for dryer (dust accumulation), confined space protocol for internal access, heat-resistant PPE"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "DSEAR / Regulatory Reform (Fire Safety) Order 2005"
    ]
  },
  {
    "id": "petf_006",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Coating / palatant (fat/flavour) application",
    "hazard": "Chemical exposure to palatant sprays, hot fat/oil handling, slip hazard from oil residue",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "COSHH assessment for palatant chemicals, PPE incl",
      "eye protection near spray systems, degreasing/anti-slip flooring maintenance"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "COSHH Regulations 2002"
    ]
  },
  {
    "id": "petf_007",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Cooling / conveying to packaging",
    "hazard": "Nip points on cooling conveyors, dust exposure from cooled product handling",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Conveyor guarding per nip-point RA (see New RA Rows sheet), RPE where dust levels warrant"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "PUWER 1998"
    ]
  },
  {
    "id": "petf_008",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Wet food retort / canning (if applicable)",
    "hazard": "High-pressure steam retort risk, burns, can-seam integrity failure, manual handling of heavy trays/cages",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Retort permit-to-work for any maintenance access, pressure vessel written scheme, PPE for steam/heat, mechanical handling aids for trays"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "Pressure Systems Safety Regulations 2000"
    ]
  },
  {
    "id": "petf_009",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Bagging / packaging line",
    "hazard": "Entanglement at bag-forming/sealing machinery, manual handling of filled bags/totes, noise from packaging line",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Machine guarding and interlocks verified, lock-out before maintenance access, mechanical lifting aids for heavy bag handling"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "PUWER 1998 / Manual Handling Operations Regulations 1992"
    ]
  },
  {
    "id": "petf_010",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Metal detection / X-ray final inspection",
    "hazard": "Radiation exposure risk (X-ray systems), false-negative product safety risk if maintained incorrectly",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Radiation safety RA for X-ray systems, calibration/commissioning procedure, competent person sign-off before line restart"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "Ionising Radiations Regulations 2017 (if X-ray used)"
    ]
  },
  {
    "id": "petf_011",
    "sector": "food_pharma",
    "category": "Pet Food Production",
    "activity": "Warehouse / cold chain storage",
    "hazard": "FLT movement, racking collapse risk, cold store temperature exposure for pickers",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Racking inspection regime, FLT segregation from pedestrians, cold stress controls per cold work RA (see New RA Rows sheet)"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "Storage Equipment Manufacturers Association (SEMA) racking guidance"
    ]
  },
  {
    "id": "foodl_001",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Meat & Poultry Processing",
    "hazard": "Slaughter / evisceration line",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Chainmail gloves/aprons, blade safety training, knife sharpening station controls, job rotation to limit repetitive strain, blood-borne pathogen awareness"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_002",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Meat & Poultry Processing",
    "hazard": "Deboning / cutting",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Cut-resistant PPE, knife control/tracking system, cold-room exposure time limits, mechanical lifting aids for carcass handling"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_003",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Meat & Poultry Processing",
    "hazard": "Scalding / plucking (poultry)",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Temperature-controlled scald tank with guarding, machine interlocks verified, PPE for heat exposure"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_004",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Bakery",
    "hazard": "Dough mixing",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Mixer guarding interlocks tested regularly, lock-out before any internal access, RPE for flour dust, mechanical aids for sack handling"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_005",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Bakery",
    "hazard": "Oven / proving",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Heat-resistant PPE, fire suppression/detection maintained, heat stress management (hydration, rotation)"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_006",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Bakery",
    "hazard": "Combustible dust (flour) in production area",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Housekeeping regime to limit dust accumulation, ATEX zone classification, ignition source control, dust extraction systems maintained"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_007",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Dairy",
    "hazard": "Pasteurisation / heat treatment",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Pressure system written scheme, permit for maintenance access, PPE for heat/steam exposure, electrical isolation per EAWR"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_008",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Dairy",
    "hazard": "Clean-in-Place (CIP) chemical systems",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "COSHH assessment for CIP chemicals, PPE incl",
      "face shield/chemical-resistant gloves, interlocks preventing CIP fluid entering product lines, emergency eyewash/shower nearby"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_009",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Dairy",
    "hazard": "Cold store / chilled processing areas",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Cold work exposure limits, anti-slip flooring and drainage maintenance, appropriate cold-weather PPE"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_010",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Beverage",
    "hazard": "Carbonation / CO2 systems",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "CO2 gas detection in filling areas, ventilation, pressure system written scheme, confined space protocol for any tank entry"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_011",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Beverage",
    "hazard": "Glass bottling line",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Glass & hard plastic policy, breakage response procedure, machine guarding, hearing protection per noise assessment"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_012",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "Beverage",
    "hazard": "Cask/keg handling",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Mechanical handling aids (keg trolleys/lifts), pressure-relief training, safe stacking procedure"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_013",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "General FMCG / Packaging",
    "hazard": "High-speed packaging/labelling lines",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Guarding and interlocks, hearing protection, job rotation, machine safety training for changeover operatives"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  },
  {
    "id": "foodl_014",
    "sector": "food_pharma",
    "category": "Food Production Line",
    "activity": "General FMCG / Warehousing",
    "hazard": "FLT and pedestrian interaction in production/warehouse areas",
    "initialRisk": {
      "L": 4,
      "S": 4,
      "RF": 16
    },
    "controlMeasures": [
      "Segregated pedestrian routes, FLT proximity sensors/cameras where fitted, banksman for reversing near production areas"
    ],
    "revisedRisk": {
      "L": 2,
      "S": 4,
      "RF": 8
    },
    "ppeRequired": [
      "Hard hat",
      "Safety footwear",
      "Hi-vis",
      "Hair/beard net",
      "Gloves"
    ],
    "regs": [
      "HASAWA 1974"
    ]
  }
];

export default FESS_EXCEL_LIBRARY;