// ─────────────────────────────────────────────────────────────────────────────
// MySafeOps — RAMS Hazard Library
// Source: 22 x FESS Group RAMS documents (2SFG Scunthorpe/Flixton,
//         Dovecoat Park, Butternut Box, Quorn Foods, Cranswick Lazenby)
// Format: { id, category, activity, hazard, initialRisk{L,S,RF},
//           controlMeasures[], revisedRisk{L,S,RF}, ppeRequired[], regs[] }
// ─────────────────────────────────────────────────────────────────────────────

export const TRADE_CATEGORIES = [
  "Electrical",
  "Mechanical / Pipework",
  "Welding / Hot Works",
  "Work at Height",
  "Manual Handling",
  "General Site",
  "Machine Installation",
  "Confined Space",
  "Lifting Operations",
  "Food Factory Specific",
  "Chemical / COSHH",
];

export const HAZARD_LIBRARY = [

  // ── ELECTRICAL ─────────────────────────────────────────────────────────────

  {
    id: "elec_001",
    category: "Electrical",
    activity: "Use of hand tools and power tools",
    hazard: "Electric shock from faulty or damaged leads",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Eye protection to BS EN166 worn when using impact, cutting or grinding tools",
      "Hearing protection worn when noise levels exceed 85dB",
      "All equipment, leads and plug tops visually inspected for damage/defects prior to use",
      "All power tools PAT tested every 3 months",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Safety glasses (BS EN166)", "Hearing protection (85dB+)", "Safety footwear", "Gloves"],
    regs: ["Electricity at Work Regs 1989", "PUWER 1998", "HSG107"],
  },

  {
    id: "elec_002",
    category: "Electrical",
    activity: "Isolation of electrical supplies",
    hazard: "Electric shock",
    initialRisk: { L: 2, S: 6, RF: 24 },
    controlMeasures: [
      "Only trained and competent operatives to carry out or supervise this task",
      "Operatives aware of safe isolation procedures (GS38)",
      "All test instruments in safe working order; test probes of sufficient voltage insulation for live tests",
      "System to be complete before a circuit is energised",
      "MCB locks used, or circuit disconnected from MCB to prevent accidental re-energisation",
      "Warning notices posted at isolation points",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Insulated gloves (Class 0 min)", "Safety glasses", "Safety footwear"],
    regs: ["Electricity at Work Regs 1989", "GS38", "HSG85"],
  },

  {
    id: "elec_003",
    category: "Electrical",
    activity: "Connection of wiring",
    hazard: "Electric shock",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only trained and competent operatives to supervise or carry out this task",
      "Systems to remain dead until all connections are made",
      "Operatives aware of safe isolation procedures",
      "Warning signs posted if a hazard is likely",
      "Permits to work issued if live connection is unavoidable",
      "Totally insulated tools used if live connection is unavoidable",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Insulated gloves", "Safety glasses", "Fully insulated tools"],
    regs: ["Electricity at Work Regs 1989", "GS38", "BS 7671 (18th Edition)"],
  },

  {
    id: "elec_004",
    category: "Electrical",
    activity: "Use of electric power tools",
    hazard: "Electric shock from faulty leads or equipment",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only 110V tools to be used on site",
      "Any 230/110V transformers centre-tapped to earth",
      "Double insulated tools used wherever possible",
      "Equipment inspected by user before each period of use",
      "Power tools PAT tested regularly",
      "Eye protection (BS EN 166) worn when using impact, cutting or grinding tools",
      "Hearing protection worn when noise levels exceed 85dB",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Safety glasses (BS EN166)", "Hearing protection", "Safety footwear"],
    regs: ["Electricity at Work Regs 1989", "PUWER 1998", "PAT Testing (IET CoP)"],
  },

  {
    id: "elec_005",
    category: "Electrical",
    activity: "General site activities — live electrical services nearby",
    hazard: "Electric shock from live services in work area",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Operatives to be aware of all electrical services within the immediate work area",
      "Where appropriate, live services made safe by the electrical contractor before work commences",
      "Exclusion zones established around live equipment",
      "No unauthorised interference with electrical services",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Safety footwear", "Hi-vis vest"],
    regs: ["Electricity at Work Regs 1989", "HSG85"],
  },

  {
    id: "elec_006",
    category: "Electrical",
    activity: "Test and commissioning of completed wiring installations",
    hazard: "Electric shock",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only trained and competent operatives to approve or carry out this task",
      "Operatives aware of safe isolation procedures",
      "All test instruments in safe working order; test probes of sufficient voltage insulation for live tests",
      "System to be complete before energisation takes place",
      "Results recorded and verified against design specifications",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Insulated gloves", "Safety glasses", "Safety footwear"],
    regs: ["Electricity at Work Regs 1989", "BS 7671", "GS38"],
  },

  {
    id: "elec_007",
    category: "Electrical",
    activity: "Working in confined spaces or ceiling voids containing electrical circuits",
    hazard: "Electric shock from live services",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only trained and competent operatives to supervise or carry out this task",
      "Operatives aware of safe isolation procedures",
      "All circuits within void to be made dead before work commences where practical",
      "Further assessment required where making dead is not practical",
      "Circuits re-energised only when all works are complete",
      "Permits to work obtained from site manager before works commence",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Insulated gloves", "Safety glasses", "Safety footwear", "Head torch"],
    regs: ["Electricity at Work Regs 1989", "Confined Spaces Regs 1997", "GS38"],
  },

  // ── DRILLING / CUTTING / CABLE CONTAINMENT ─────────────────────────────────

  {
    id: "drill_001",
    category: "Electrical",
    activity: "Installation of cable containment at low level",
    hazard: "Drilling and cutting of metal parts; dust from masonry; noise and vibration; slips/trips/falls; cuts from sharp metal",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Dust mask, gloves and eye protection to be worn",
      "Working area kept clear of rubbish, debris and redundant materials",
      "110V extension leads routed to eliminate trip hazards",
      "No individual to lift above 25kg; team lifting adopted for heavier items",
      "Items split into smaller parts where loads exceed 25kg",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Dust mask (FFP2)", "Safety glasses", "Gloves (cut-resistant)", "Safety footwear", "Hi-vis vest"],
    regs: ["PUWER 1998", "Manual Handling Ops Regs 1992", "Control of Noise Regs 2005", "COSHH 2002"],
  },

  {
    id: "drill_002",
    category: "Electrical",
    activity: "Installing cables and containment above 2000mm",
    hazard: "Drilling/cutting metal; dust; noise; vibration; slips/trips; cuts from metal; falls from height",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Scaffold platform or MEWP to be used for this activity",
      "Dust mask, gloves and eye protection to be worn",
      "Working area clear of rubbish, debris and redundant materials",
      "110V extension leads routed to eliminate hazards",
      "No individual to lift above 25kg; team lifting for heavier items",
      "Where scaffold or MEWP used, relevant qualifications required (IPAF/PASMA)",
    ],
    revisedRisk: { L: 2, S: 4, RF: 12 },
    ppeRequired: ["Dust mask (FFP2)", "Safety glasses", "Gloves", "Safety footwear", "Hi-vis", "Harness (Cherry Picker)"],
    regs: ["Work at Height Regs 2005", "PUWER 1998", "Manual Handling Ops Regs 1992", "IPAF/PASMA certification"],
  },

  {
    id: "drill_003",
    category: "Electrical",
    activity: "Installing cables above 2000mm",
    hazard: "Manual handling; falls from height; falling objects",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Scaffold platform or MEWP to be used for this activity",
      "Dust mask, gloves and eye protection to be worn",
      "Working area clear of rubbish, debris and redundant materials",
      "110V extension leads routed to eliminate hazards",
      "No individual to lift above 25kg; team lifting adopted for heavier items",
      "Relevant qualifications required where scaffold or MEWP used (IPAF/PASMA)",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety glasses", "Gloves", "Safety footwear", "Hi-vis", "Harness (boom/cherry picker)"],
    regs: ["Work at Height Regs 2005", "Manual Handling Ops Regs 1992", "PUWER 1998"],
  },

  {
    id: "drill_004",
    category: "Electrical",
    activity: "Use of electric tools — cutting and drilling",
    hazard: "Dust, shavings, metal swarf, heat",
    initialRisk: { L: 6, S: 4, RF: 24 },
    controlMeasures: [
      "Dust masks, goggles and gloves worn when cutting/drilling",
      "All power tools PAT tested",
      "Guards in place and checked before use",
      "Fire extinguisher available when cutting near combustibles",
    ],
    revisedRisk: { L: 2, S: 2, RF: 4 },
    ppeRequired: ["Dust mask (FFP2)", "Safety goggles", "Cut-resistant gloves", "Safety footwear"],
    regs: ["PUWER 1998", "COSHH 2002", "Control of Noise Regs 2005"],
  },

  // ── WORK AT HEIGHT ──────────────────────────────────────────────────────────

  {
    id: "wah_001",
    category: "Work at Height",
    activity: "Working at heights — general",
    hazard: "Falls from height; use of ladders",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "All access equipment to be in good order before use; defective equipment removed from site",
      "Where ladders used, must be secured and footed by a second person; short periods only",
      "Where impractical to use mobile scaffold, step ladders used for short periods only",
      "MEWPs operated only by trained and licensed operatives",
      "MEWPs checked daily for defects prior to use",
      "Harness on cherry picker is mandatory and must be in use at all times",
      "Area below cordoned off to avoid injury from falling objects",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Harness (MEWP)", "Gloves"],
    regs: ["Work at Height Regs 2005", "IPAF certification", "PASMA certification", "LOLER 1998"],
  },

  {
    id: "wah_002",
    category: "Work at Height",
    activity: "General site activities — use of step ladders",
    hazard: "Falls from step ladders",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Step ladders used only for low-level work for short periods",
      "Step ladders checked before and after use; defective equipment removed from service immediately",
      "Step ladders on firm, level base when in use",
      "Only industrial class step ladders to be used",
      "Step ladders used for low risk, low frequency tasks only",
      "Safety helmets, safety footwear and gloves to be worn",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Hard hat", "Safety footwear", "Gloves"],
    regs: ["Work at Height Regs 2005"],
  },

  {
    id: "wah_003",
    category: "Work at Height",
    activity: "Installation of fire alarm devices",
    hazard: "Falls from height; slips, trips and falls; electric shock",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Only trained and competent operatives to carry out or supervise this task",
      "Systems to remain dead until all connections are made",
      "PPE to be worn at all times",
      "Correct type and class of access equipment used depending on working height",
      "Area below cordoned off to avoid injury from falling objects",
      "Where MEWPs required, harness on cherry picker is mandatory at all times",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Safety glasses", "Harness (MEWP)"],
    regs: ["Work at Height Regs 2005", "Electricity at Work Regs 1989", "BS 5839"],
  },

  // ── MECHANICAL / PIPEWORK ───────────────────────────────────────────────────

  {
    id: "mech_001",
    category: "Mechanical / Pipework",
    activity: "Pressure testing of pipework / A-C system",
    hazard: "Noise; personal injury from system or pipe burst",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Pressure testing carried out by trained personnel only",
      "Other operatives to be a minimum 3 metres away from test equipment during pressurisation",
      "All works carried out in accordance with PSSR 2000",
      "Test pressures not to exceed design limits",
      "Pressure relief valve in place and set correctly",
      "Test equipment calibrated and within current certification",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety glasses/face shield", "Hearing protection", "Safety footwear", "Gloves"],
    regs: ["Pressure Systems Safety Regs 2000 (PSSR)", "PUWER 1998"],
  },

  {
    id: "mech_002",
    category: "Mechanical / Pipework",
    activity: "Installing mechanical plant above 2000mm",
    hazard: "Manual handling; falls from height; falling objects",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Scaffold platform or MEWP to be used for this activity",
      "Dust mask, gloves and eye protection to be worn",
      "Working area kept clear of rubbish and redundant materials",
      "110V extension leads routed to eliminate hazards",
      "No individual to lift above 25kg; team lifting adopted",
      "IPAF/PASMA qualifications required where scaffold or MEWP used",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Gloves", "Safety glasses", "Harness (MEWP)"],
    regs: ["Work at Height Regs 2005", "Manual Handling Ops Regs 1992", "LOLER 1998", "PUWER 1998"],
  },

  {
    id: "mech_003",
    category: "Mechanical / Pipework",
    activity: "Chemical pipe changeover in roof void",
    hazard: "Chemical exposure; hot works in confined space; falls from height; unauthorised access",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "All works carried out under a Permit to Work",
      "Isolation valves confirmed locked off before work commences",
      "Adequate lighting in place throughout works",
      "All hot works to comply with hot works permit procedure",
      "2 × 9kg fire extinguishers and fire blanket in place",
      "Chemical resistant PPE worn throughout",
      "Ensure no obstructions within access routes",
      "Operatives communicate with all relevant parties during works",
      "After completion, remove padlocks and restore valves to correct position",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Chemical resistant gloves", "Face shield", "Respirator (FFP3)", "Chemical resistant coveralls", "Safety footwear"],
    regs: ["COSHH 2002", "Confined Spaces Regs 1997", "Work at Height Regs 2005", "PSSR 2000"],
  },

  {
    id: "mech_004",
    category: "Mechanical / Pipework",
    activity: "Cutting / drilling into roof void",
    hazard: "Falling debris; disturbing unknown services; dust; noise",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Activity communicated to all persons in the area",
      "Adequate lighting in place before entry",
      "Area below cordoned off to prevent injury from falling material",
      "Correct type and class of access equipment used",
      "Dust mask, gloves and eye protection worn",
      "Any unknown services treated as live until confirmed isolated",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Dust mask (FFP2)", "Safety goggles", "Gloves", "Hard hat", "Safety footwear"],
    regs: ["PUWER 1998", "Work at Height Regs 2005", "COSHH 2002"],
  },

  // ── WELDING / HOT WORKS ─────────────────────────────────────────────────────

  {
    id: "weld_001",
    category: "Welding / Hot Works",
    activity: "Welding using a TIG welder",
    hazard: "Burns; arc flash; hot works near combustibles",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Correct PPE worn at all times — welding mask, gloves, leather apron, safety footwear",
      "Area clear of all combustibles before welding commences",
      "2 × fire extinguishers available and accessible at all times",
      "Hot works permit issued before welding commences",
      "Fire watch maintained during welding and for minimum 1 hour after completion",
      "Welding gases stored and used in accordance with manufacturer's guidance",
      "Fume extraction or adequate ventilation in place",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Welding helmet (auto-darkening)", "Leather welding gloves", "Leather apron", "Safety footwear (heat-resistant)", "Respiratory protection (welding fumes)"],
    regs: ["Hot Works Permit (site-specific)", "COSHH 2002 (welding fumes)", "EH40 WEL", "BS EN ISO 9606"],
  },

  {
    id: "weld_002",
    category: "Welding / Hot Works",
    activity: "Cutting stainless steel using a small angle grinder",
    hazard: "Dust, shavings, metal swarf, heat; fire risk",
    initialRisk: { L: 6, S: 4, RF: 24 },
    controlMeasures: [
      "Dust masks, goggles and gloves worn when cutting/drilling",
      "All power tools PAT tested before use",
      "Fire extinguisher present whilst activity is being carried out",
      "Area clear of combustibles; fire blanket available",
      "Correct cutting disc for stainless steel used and checked before fitting",
      "Guard in place and secure before use",
    ],
    revisedRisk: { L: 2, S: 2, RF: 4 },
    ppeRequired: ["Dust mask (FFP2)", "Safety goggles (face shield for grinding)", "Cut-resistant gloves", "Safety footwear", "Leather apron"],
    regs: ["PUWER 1998", "COSHH 2002", "Hot Works Permit"],
  },

  {
    id: "weld_003",
    category: "Welding / Hot Works",
    activity: "Hot works within roof voids",
    hazard: "Fire; flammable materials nearby; inadequate lighting; burns; arc flash; unauthorised access",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Hot works permit issued and signed before work commences",
      "2 × 9kg extinguishers and fire blanket in place",
      "Welding mask and correct PPE worn throughout",
      "Area ventilated; fumes monitored",
      "Fire watch during works and minimum 1 hour post-completion",
      "All combustibles removed or protected with fire blanket",
      "Adequate lighting in place before entry",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Welding helmet", "Leather welding gloves", "Leather apron", "Safety footwear", "Respirator"],
    regs: ["Hot Works Permit", "COSHH 2002", "Confined Spaces Regs 1997", "Work at Height Regs 2005"],
  },

  // ── MANUAL HANDLING ─────────────────────────────────────────────────────────

  {
    id: "mh_001",
    category: "Manual Handling",
    activity: "Loading of materials to working areas — manual handling",
    hazard: "Manual handling injuries; slips, trips and falls",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "No individual to lift more than 25kg",
      "Correct lift technique adopted when lifting any load",
      "Full PPE worn at all times",
      "Work area cordoned off to minimise risk to other operatives and members of the public",
      "Mechanical aids (skates, trolleys, carts) used on heavy loads to minimise manual handling",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety footwear", "Gloves", "Hi-vis vest", "Back support belt (where applicable)"],
    regs: ["Manual Handling Ops Regs 1992", "HASAWA 1974"],
  },

  // ── GENERAL SITE ────────────────────────────────────────────────────────────

  {
    id: "gen_001",
    category: "General Site",
    activity: "Various site activities — slips, trips and falls",
    hazard: "Slips, trips and falls on site",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Site floor areas, staircases and access routes kept clean, tidy and free from obstructions",
      "Rubbish, debris and redundant materials not allowed to accumulate",
      "Any redundant materials/rubbish removed to designated skip area on a regular basis",
      "Operatives to route 110V extension leads to eliminate or minimise slip/trip hazards",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Safety footwear", "Hi-vis vest"],
    regs: ["HASAWA 1974", "Management of H&S Regs 1999"],
  },

  {
    id: "gen_002",
    category: "General Site",
    activity: "Site work — general PPE requirement",
    hazard: "Injuries arising from various work activities requiring personal protective equipment",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "PPE to be worn at all times on site as necessary for the task in hand",
      "Minimum PPE: hard hat, steel toecap boots/shoes, hearing protection, eye protection, hi-vis clothing",
      "Harness required when using booms (cherry picker)",
      "Inclement weather clothing available",
      "Where MEWP used, harness is mandatory and must be in use at all times",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Hard hat", "Steel toe cap footwear", "Hi-vis vest", "Hearing protection", "Safety glasses", "Gloves", "Harness (MEWP)"],
    regs: ["PPE Regs 2022", "HASAWA 1974", "Management of H&S Regs 1999"],
  },

  {
    id: "gen_003",
    category: "General Site",
    activity: "Noise produced by work activity",
    hazard: "Damage to hearing; works causing a nuisance to other occupants",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Only trained and competent operatives to supervise or carry out this task",
      "Operatives to assess works before commencement and select equipment with lowest noise emissions",
      "Hearing protection worn when noise levels exceed 85dB",
      "Noisy works planned to minimise disturbance to other operations",
      "Noise levels monitored where prolonged exposure expected",
    ],
    revisedRisk: { L: 2, S: 2, RF: 4 },
    ppeRequired: ["Hearing protection (85dB+ threshold)", "Hi-vis vest"],
    regs: ["Control of Noise at Work Regs 2005", "HASAWA 1974"],
  },

  // ── MACHINE INSTALLATION ────────────────────────────────────────────────────

  {
    id: "mach_001",
    category: "Machine Installation",
    activity: "Use of fork lift truck (FLT)",
    hazard: "Pedestrian/traffic conflict; lifting above SWL; poor access/egress; overturning",
    initialRisk: { L: 6, S: 3, RF: 18 },
    controlMeasures: [
      "Trained and licensed FLT operator only",
      "Banksman in place at all times during lifting operations",
      "Safe working load (SWL) checked and not exceeded",
      "Pedestrian exclusion zone established and enforced",
      "FLT pre-use check completed before operation",
      "Ground conditions assessed for suitability",
      "Load secured before movement",
      "Speed limit observed on site",
    ],
    revisedRisk: { L: 3, S: 4, RF: 12 },
    ppeRequired: ["Hard hat", "Hi-vis vest", "Safety footwear"],
    regs: ["LOLER 1998", "PUWER 1998", "L117 Rider-Operated Lift Trucks", "ACOP L117"],
  },

  {
    id: "mach_002",
    category: "Machine Installation",
    activity: "Machine installation — heavy equipment using skates and jacks",
    hazard: "Crushing; falling load; manual handling; slips; overturning of machine",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "All operatives trained in machine moving techniques",
      "Rated skates and toe jacks used; SWL not exceeded",
      "All services to be inspected and isolated/protected before machine movement",
      "Exclusion zone established; bystanders kept clear",
      "Slow, controlled movements only; no sudden changes of direction",
      "Ground conditions checked — level, sound surface required",
      "Certificates and documentation for lifting equipment available on request",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear (steel toe and midsole)", "Hi-vis vest", "Gloves"],
    regs: ["LOLER 1998", "PUWER 1998", "Manual Handling Ops Regs 1992"],
  },

  {
    id: "mach_003",
    category: "Machine Installation",
    activity: "Installing electrical plant above 2000mm",
    hazard: "Manual handling; falls from height; falling objects onto workers below",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Scaffold platform or MEWP used for this activity",
      "Dust mask, gloves and eye protection worn",
      "Working area clear of rubbish and redundant materials",
      "110V extension leads routed to eliminate hazards",
      "No individual to lift above 25kg; team lifting adopted",
      "IPAF/PASMA qualifications required for scaffold or MEWP use",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Safety glasses", "Gloves", "Harness (MEWP)"],
    regs: ["Work at Height Regs 2005", "LOLER 1998", "Manual Handling Ops Regs 1992"],
  },

  // ── FOOD FACTORY SPECIFIC ───────────────────────────────────────────────────

  {
    id: "food_001",
    category: "Food Factory Specific",
    activity: "Working in a food production environment",
    hazard: "Contamination of food production; swarf/debris entering food zones; hygiene breach",
    initialRisk: { L: 4, S: 4, RF: 16 },
    controlMeasures: [
      "Arrive at site, wash hands, sanitise and sign in as per site induction",
      "Full site PPE and hygiene requirements observed at all times",
      "All tools, fixings and materials accounted for before and after work",
      "Work areas screened/cordoned to contain swarf, dust and debris",
      "Production areas cleaned down after works; sign-off obtained from site manager",
      "No food or drink brought into production areas",
      "Metal detectable fixings/materials used where production is active nearby",
    ],
    revisedRisk: { L: 2, S: 4, RF: 8 },
    ppeRequired: ["Site-specific hygiene PPE", "Hair net/beard net", "Hi-vis", "Safety footwear", "Gloves", "Hard hat"],
    regs: ["Food Safety Act 1990", "Food Hygiene Regs 2006", "HASAWA 1974"],
  },

  {
    id: "food_002",
    category: "Food Factory Specific",
    activity: "Working adjacent to live food production",
    hazard: "Interface with moving machinery; conveyors; live plant; pedestrian traffic from production workers",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Liaison with production manager/site contact before commencing works",
      "Physical segregation barriers erected between work zone and live production",
      "All operatives briefed on live production hazards specific to area",
      "No unauthorised entry into live machine guards or restricted zones",
      "Emergency stop locations identified before work commences",
      "Works scheduled for non-production periods where possible",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Safety glasses", "Hearing protection"],
    regs: ["PUWER 1998", "Machinery Directive 2006/42/EC (UK retained)", "HASAWA 1974"],
  },

  {
    id: "food_003",
    category: "Food Factory Specific",
    activity: "Working in proximity to ammonia refrigeration systems",
    hazard: "Accidental ammonia release; toxic gas inhalation; eye and skin burns",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "All operatives briefed on ammonia emergency procedure and muster point before works",
      "Location of emergency exits and alarm points identified",
      "No hot works or drilling near ammonia pipework without specific authorisation",
      "Ammonia gas detector available in work area",
      "Site emergency contact and site H&S advisor notified of works near refrigeration plant",
      "Works stopped immediately if ammonia smell detected; area evacuated",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Self-contained breathing apparatus (SCBA) on standby", "Chemical resistant gloves", "Safety goggles", "Hi-vis"],
    regs: ["COSHH 2002", "PSSR 2000", "EH40 WEL (NH3: 25ppm TWA, 35ppm STEL)", "HASAWA 1974"],
  },

  // ── CONFINED SPACE ──────────────────────────────────────────────────────────

  {
    id: "cs_001",
    category: "Confined Space",
    activity: "Entry into confined space or restricted ceiling void",
    hazard: "Oxygen deficiency; toxic or flammable atmosphere; engulfment; restricted rescue access",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Confined space entry permit obtained and in place before entry",
      "Atmospheric testing carried out (O2, CO, H2S, LEL) before and during entry",
      "Standby person stationed outside space at all times",
      "Rescue plan and equipment in place before entry commences",
      "All circuits and services in void made dead where practicable",
      "Continuous atmospheric monitoring during works",
      "Emergency evacuation procedure established and communicated to all",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Self-contained breathing apparatus (SCBA)", "Rescue harness", "Safety footwear", "Communication device"],
    regs: ["Confined Spaces Regs 1997", "L101 ACOP", "Electricity at Work Regs 1989"],
  },

  // ── LIFTING OPERATIONS ──────────────────────────────────────────────────────

  {
    id: "lift_001",
    category: "Lifting Operations",
    activity: "Crane lift or overhead lifting operation",
    hazard: "Falling load; structural failure; snagging; persons struck by swinging load",
    initialRisk: { L: 4, S: 6, RF: 24 },
    controlMeasures: [
      "Lifting plan prepared by competent person before operation commences",
      "All lifting equipment inspected and within current LOLER thorough examination",
      "Appointed person (AP) present to supervise lifting operation",
      "Exclusion zone established below and around the lift",
      "All lifting accessories (slings, shackles) rated, inspected and in date",
      "Load weight confirmed before lift commences",
      "Banksman/slinger in position and in constant contact with crane operator",
      "Weather conditions (wind speed) assessed before and during lift",
    ],
    revisedRisk: { L: 2, S: 6, RF: 12 },
    ppeRequired: ["Hard hat", "Safety footwear", "Hi-vis", "Gloves", "Safety glasses"],
    regs: ["LOLER 1998", "PUWER 1998", "BS 7121 (Safe Use of Cranes)", "ACOP L113"],
  },

];

// ─── lookup helpers ──────────────────────────────────────────────────────────

export const getByCategory = (category) =>
  HAZARD_LIBRARY.filter(h => h.category === category);

export const searchHazards = (query) => {
  const q = query.toLowerCase();
  return HAZARD_LIBRARY.filter(h =>
    h.activity.toLowerCase().includes(q) ||
    h.hazard.toLowerCase().includes(q) ||
    h.category.toLowerCase().includes(q)
  );
};

export const getRiskLevel = ({ RF }) => {
  if (RF >= 24) return "high";
  if (RF >= 12) return "medium";
  return "low";
};

export const RISK_COLORS = {
  high:   { bg: "#FCEBEB", color: "#791F1F", label: "High risk — eliminate, discuss with manager" },
  medium: { bg: "#FAEEDA", color: "#633806", label: "Medium risk — reduce/change work programme" },
  low:    { bg: "#EAF3DE", color: "#27500A", label: "Low risk — reduce as far as reasonably practicable" },
};

export default HAZARD_LIBRARY;
