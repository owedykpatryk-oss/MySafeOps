// ═══ RAMS Pro — Data & Constants ═══

export const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
export const td=()=>new Date().toISOString().split("T")[0];
export const nw=()=>new Date().toISOString().slice(0,16);
export const fmt=d=>{if(!d)return"—";try{return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}catch{return d}};
export const dTo=d=>{if(!d)return 999;return Math.ceil((new Date(d)-new Date())/(86400000))};

// ═══ DOCUMENT TYPES ═══
export const DT={
  rams:{l:"RAMS",i:"⚠️",c:"#f97316",laws:["CDM 2015","HASAWA 1974","MHSWR 1999"]},
  instruction:{l:"Site Instruction",i:"📌",c:"#8b5cf6",laws:["CDM 2015"]},
  sitereport:{l:"Site Report",i:"📋",c:"#10b981",laws:["CDM 2015"]},
  dayreport:{l:"Day Report",i:"📅",c:"#06b6d4",laws:["CDM 2015"]},
  incident:{l:"Incident/Near Miss",i:"🚨",c:"#ef4444",laws:["RIDDOR 2013","HASAWA 1974"]},
  permit_hotwork:{l:"Hot Work PTW",i:"🔥",c:"#ef4444",laws:["RRFSO 2005"]},
  permit_height:{l:"Work at Height PTW",i:"🏗️",c:"#3b82f6",laws:["WAHR 2005"]},
  permit_confined:{l:"Confined Space PTW",i:"⛑️",c:"#a855f7",laws:["CSR 1997"]},
  permit_electrical:{l:"Electrical PTW",i:"⚡",c:"#eab308",laws:["EAWR 1989"]},
  permit_excavation:{l:"Excavation PTW",i:"⛏️",c:"#78716c",laws:["CDM 2015","HSG47"]},
  permit_lifting:{l:"Lifting PTW",i:"🏋️",c:"#14b8a6",laws:["LOLER 1998","PUWER 1998"]},
  permit_general:{l:"General PTW",i:"📝",c:"#64748b",laws:["HASAWA 1974"]},
};

// ═══ STATUS ═══
export const ST={
  draft:{l:"Draft",bg:"#374151",fg:"#9ca3af",ic:"📝"},
  pending:{l:"Pending Approval",bg:"#92400e",fg:"#fcd34d",ic:"⏳"},
  approved:{l:"Approved",bg:"#065f46",fg:"#6ee7b7",ic:"✅"},
  rejected:{l:"Rejected",bg:"#991b1b",fg:"#fca5a5",ic:"❌"},
  closed:{l:"Closed/Completed",bg:"#1e3a5f",fg:"#93c5fd",ic:"🔒"},
};

// ═══ TRADES ═══
export const TRADES=[
  "General Construction","Bricklaying / Masonry","Welding / Hot Works","Roadworks / Highways",
  "Electrical Installation","Plumbing / Pipefitting","Scaffolding","Demolition",
  "Excavation / Groundworks","Roofing","Painting / Decorating","Steelwork / Fabrication",
  "Joinery / Carpentry","Plastering / Rendering","Glazing","HVAC / Ventilation",
  "Fire Protection","Asbestos Removal (Licensed)","Piling","Concrete Works / Formwork",
  "Drainage / Sewer Works","Landscaping","Cladding / Curtain Walling","Mechanical Installation",
  "Food Engineering","Process Engineering","Wall Sampling / Core Drilling",
  "Trial Pit Investigation","Topographic Survey","Utility Survey / GPR",
  "Commissioning / Testing","Cleaning / Decontamination","Flooring","Tiling","Other",
];

// ═══ AUTO-PPE PER TRADE ═══
export const AUTO_PPE={
  "General Construction":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Safety Glasses (EN 166)"],
  "Bricklaying / Masonry":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Safety Glasses (EN 166)","Gloves (EN 388)","Knee Pads (EN 14404)","FFP3 Mask (EN 149)"],
  "Welding / Hot Works":["Safety Boots (EN 20345)","Welding Helmet (EN 175)","Welding Gauntlets (EN 12477)","Coveralls (EN ISO 11612)","Safety Glasses (EN 166)","Ear Plugs (EN 352)","FFP3 Mask (EN 149)"],
  "Roadworks / Highways":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis Class 3 (EN 20471)","Safety Glasses (EN 166)","Ear Defenders (EN 352)","Gloves (EN 388)"],
  "Electrical Installation":["Safety Boots (EN 20345)","Safety Glasses (EN 166)","Insulated Gloves","Hard Hat (EN 397)"],
  "Scaffolding":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Fall Arrest Harness (EN 361)","Gloves (EN 388)"],
  "Demolition":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","FFP3 Mask (EN 149)","Ear Defenders (EN 352)","Safety Glasses (EN 166)","Gloves (EN 388)","Coveralls"],
  "Excavation / Groundworks":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Safety Glasses (EN 166)","Gloves (EN 388)"],
  "Roofing":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Fall Arrest Harness (EN 361)","Gloves (EN 388)","Knee Pads (EN 14404)"],
  "Trial Pit Investigation":["Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Gloves (EN 388)","Safety Glasses (EN 166)","FFP2 Mask (EN 149)"],
  "Topographic Survey":["Safety Boots (EN 20345)","Hi-Vis (EN 20471)"],
  "Utility Survey / GPR":["Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Safety Glasses (EN 166)"],
  "Wall Sampling / Core Drilling":["Safety Boots (EN 20345)","Safety Glasses (EN 166)","Ear Defenders (EN 352)","FFP3 Mask (EN 149)","Gloves (EN 388)"],
  "Food Engineering":["Safety Boots (EN 20345)","Safety Glasses (EN 166)","Hi-Vis (EN 20471)","Hard Hat (EN 397)","Gloves (EN 388)"],
};

// ═══ ALL PPE OPTIONS ═══
export const PPE_ALL=[
  "Hard Hat (EN 397)","Safety Boots (EN 20345)","Hi-Vis (EN 20471)","Hi-Vis Class 3 (EN 20471)",
  "Safety Glasses (EN 166)","Safety Goggles (EN 166)","Gloves (EN 388)","Gloves Chemical (EN 374)",
  "Gloves Cut-Resistant (EN 388 F)","Welding Gauntlets (EN 12477)","Insulated Gloves",
  "Ear Defenders (EN 352)","Ear Plugs (EN 352)","FFP2 Mask (EN 149)","FFP3 Mask (EN 149)",
  "Half-Face Respirator (EN 140)","Full-Face Respirator (EN 136)","Welding Helmet (EN 175)",
  "Face Shield (EN 166)","Fall Arrest Harness (EN 361)","Coveralls","Coveralls (EN ISO 11612)",
  "Tyvek Suit (Type 5/6)","Knee Pads (EN 14404)","Life Jacket / PFD","Waders",
];

// ═══ EQUIPMENT DATABASE ═══
export const EQUIPMENT_TYPES=[
  {cat:"Power Tools",items:["Angle Grinder 115mm","Angle Grinder 230mm","Circular Saw","Reciprocating Saw","Jigsaw","SDS Drill","Combi Drill","Impact Driver","Core Drill","Chop Saw","Bench Grinder","Planer","Router","Sander (Orbital)","Sander (Belt)","Biscuit Jointer"]},
  {cat:"Breakers & Compaction",items:["Electric Breaker","Pneumatic Breaker","Compressor","Vibrating Plate","Roller (Pedestrian)","Tamper/Rammer","Needle Vibrator","Poker Vibrator"]},
  {cat:"Welding",items:["MIG Welder","TIG Welder","Arc Welder","Oxy-Acetylene Set","Plasma Cutter","Spot Welder"]},
  {cat:"Plant",items:["Mini Digger <1t","Mini Digger 1.5t","Mini Digger 3t","360° Excavator 8t","360° Excavator 13t","360° Excavator 20t+","Telehandler","Dumper (Hi-Tip)","Dumper (Forward)","Roller (Ride-On)","Loader/Backhoe","Skid Steer"]},
  {cat:"Access",items:["Scaffold Tower","Podium Steps","Step Ladder","Extension Ladder","MEWP Scissor Lift","MEWP Cherry Picker","MEWP Boom Lift","Rope Access Kit"]},
  {cat:"Lifting",items:["Mobile Crane","Tower Crane","Overhead Crane","Chain Block","Lever Hoist","Slings (Webbing)","Slings (Chain)","Shackles","Spreader Beam","Lifting Eyes"]},
  {cat:"Survey & Detection",items:["CAT Locator","Genny Signal Generator","GPR Unit","Total Station","GPS Rover","Automatic Level","Laser Level","Pipe Laser","Cover Meter","Moisture Meter"]},
  {cat:"Safety & Welfare",items:["Fire Extinguisher (Water)","Fire Extinguisher (CO2)","Fire Extinguisher (Foam)","Fire Extinguisher (Powder)","First Aid Kit","Eye Wash Station","Spill Kit","Defibrillator (AED)","Gas Monitor (4-Gas)","Noise Meter","Dust Monitor"]},
  {cat:"Temporary Works",items:["Heras Fencing","Chapter 8 Signs","Traffic Lights (Temp)","Road Plates","Trench Sheets","Trench Box","Props/Acrows","Formwork"]},
  {cat:"Other",items:["Generator","Lighting Tower","Water Pump","Cement Mixer","Concrete Pump","Water Bowser","Fuel Bowser","Site Cabin","Welfare Unit","Toilet Unit"]},
];

// ═══ VEHICLE TYPES ═══
export const VEHICLE_TYPES=["Van (SWB)","Van (LWB)","Van (Luton)","Pickup Truck","Tipper (3.5t)","Tipper (7.5t)","Tipper (18t)","Flatbed","Low Loader","Car","4x4 / SUV","Minibus","HGV (Rigid)","HGV (Artic)","Sweeper","Crane Truck","Skip Lorry","Concrete Mixer","Pump Truck","Other"];

// ═══ VEHICLE MONTHLY CHECKLIST ═══
export const VEHICLE_CHECKLIST=[
  {cat:"Exterior",items:["Bodywork condition — no damage","Lights — all working (head, tail, brake, indicators, fog, reverse)","Windscreen — no cracks >10mm in wiper sweep area","Wipers — blades in good condition","Mirrors — all present, clean, adjusted","Tyres — legal tread (>1.6mm), correct pressure, no damage","Wheels — nuts torqued, no damage","Number plates — clean, legible, secure","Fuel cap — secure","Exhaust — no excessive smoke or noise","Tow bar/hitch — if fitted, good condition"]},
  {cat:"Interior",items:["Dashboard warning lights — none showing","Horn — working","Seatbelts — all working, no damage","Seats — secure, adjustable","Steering — no excessive play","Handbrake — holds on slope","Brakes — responsive, no pulling","Clutch — smooth operation","Heater/Demister — working","Air conditioning — working (if fitted)","First aid kit — present, in date","Fire extinguisher — present, in date, serviced","Hi-vis vest — present","Warning triangle — present","Torch — present, working"]},
  {cat:"Under Bonnet",items:["Engine oil — correct level","Coolant — correct level","Brake fluid — correct level","Power steering fluid — correct level","Washer fluid — topped up","Battery — secure, terminals clean","Belts — no cracking or fraying","Hoses — no leaks or damage"]},
  {cat:"Documentation",items:["MOT certificate — valid (if applicable)","Insurance — valid, certificate available","Road tax — valid","Vehicle logbook (V5C) — available","Breakdown cover details — available","Operator's licence — displayed (if HGV)","Tachograph — calibrated (if HGV)","Driver's licence — valid for vehicle class"]},
  {cat:"Load Area (Van/Truck)",items:["Load secured properly","No loose items","Racking secure (if fitted)","Load not exceeding max weight","Rear doors — close and lock properly","Internal lighting — working","Tie-down points — good condition","Non-slip floor — good condition"]},
];

// ═══ EQUIPMENT INSPECTION CHECKLIST ═══
export const EQUIP_CHECKLIST=[
  {cat:"General",items:["Visual inspection — no damage or defects","All guards in place and functional","Emergency stop — works correctly","Electrical cable — no cuts, kinks or damage","Plug — no damage, correct fuse","PAT test label — in date","Manufacturer's instructions — available","Correct PPE for use identified"]},
  {cat:"Power Tools",items:["Disc/blade — correct type, not worn","Guard — properly adjusted","Handle/grip — secure, no damage","Trigger/switch — smooth operation","Ventilation slots — clear","Brushes — not worn (if applicable)"]},
  {cat:"Lifting Equipment",items:["SWL clearly marked","LOLER thorough examination — in date","Slings — no cuts, abrasion, damage","Shackles — correct pin, no deformation","Hook — safety catch working","Chains — no stretch, kinks or damage","Certificate available"]},
  {cat:"Access Equipment",items:["Scaffold inspection tag — current (7 days)","Guard rails — all in place, secure","Toe boards — fitted","Ladder — industrial grade, footed","Ladder — 1:4 ratio, secured at top","MEWP — daily check completed","MEWP — LOLER exam in date","Harness — inspection tag in date"]},
  {cat:"Calibration",items:["Calibration certificate — in date","Last calibrated date — recorded","Next calibration due — scheduled","Calibration sticker — on equipment","Serial number — matches certificate","Drift/accuracy — within tolerance"]},
];

// ═══ HAZARD LIBRARY ═══
export const HAZARD_LIBRARY={
  "General Construction":[
    {a:"General site work",h:"Falls from height",w:"Workers, visitors",ct:"Guard rails, toe boards, safety nets, fall arrest harness, WAHR 2005 Reg. 6"},
    {a:"Material handling",h:"Struck by falling objects",w:"Workers, visitors, public",ct:"Hard hats mandatory, exclusion zones, netting, secured loads, CDM 2015"},
    {a:"Site movement",h:"Slips, trips and falls",w:"All site personnel",ct:"Good housekeeping, adequate lighting, cable management, suitable footwear"},
    {a:"Plant operations",h:"Contact with moving machinery",w:"Workers, pedestrians",ct:"Machine guards, exclusion zones, banksman, PUWER 1998 Reg. 11"},
    {a:"Manual tasks",h:"Manual handling injury",w:"Workers",ct:"Risk assessment, mechanical aids, team lifting >25kg, MHOR 1992 Reg. 4"},
    {a:"Noisy activities",h:"Noise-induced hearing loss (>80dB)",w:"Workers, neighbours",ct:"Hearing protection zones, ear defenders, tool selection, CNWR 2005"},
    {a:"Cutting/grinding",h:"Dust inhalation (inc. silica RCS)",w:"Workers, nearby personnel",ct:"Water suppression, RPE FFP3 for silica, extraction, COSHH 2002, EH40 WEL"},
    {a:"Excavation/digging",h:"Underground services strike (gas, electric, water)",w:"Workers, public",ct:"CAT & Genny scan PAS 128, service drawings, hand dig within 500mm, HSG47"},
    {a:"Working near public",h:"Injury to members of public",w:"Public, children",ct:"Heras fencing, warning signage, banksman, site security, lighting"},
  ],
  "Welding / Hot Works":[
    {a:"Arc/MIG/TIG welding",h:"Burns from hot metal, sparks and spatter",w:"Welder, adjacent workers",ct:"Welding PPE EN 175/12477, fire blankets, welding screens, designated area"},
    {a:"All welding",h:"UV/IR radiation causing arc eye",w:"Welder, bystanders within 10m",ct:"Auto-darkening helmet EN 175, welding curtains/screens, exclusion zone signage"},
    {a:"Welding/cutting metals",h:"Toxic fumes (zinc, manganese, chromium, ozone)",w:"Welder, nearby workers",ct:"LEV extraction, RPE min FFP3 for stainless/galvanised, COSHH 2002 assessment"},
    {a:"Any hot work",h:"Fire and/or explosion",w:"All personnel in vicinity",ct:"Hot work permit mandatory, fire watch 60 min after, clear combustibles 10m radius, fire extinguisher within arm's reach, RRFSO 2005"},
    {a:"Welding equipment",h:"Electrical shock",w:"Welder",ct:"RCD protection, dry working conditions, insulated leads, PAT tested, EAWR 1989"},
    {a:"Gas welding/cutting",h:"Compressed gas cylinder failure/leak",w:"Workers",ct:"Store upright secured, flashback arrestors fitted, separate O₂ from fuel by 3m, leak checks, close valves when not in use"},
  ],
  "Roadworks / Highways":[
    {a:"Working adjacent to live traffic",h:"Vehicle collision with workers",w:"Workers, members of public",ct:"Chapter 8 traffic management, TM plan approved, IPV where specified, hi-vis EN 20471 Class 3, NRSWA 1991"},
    {a:"Plant movement on site",h:"Struck by moving plant/vehicle",w:"Workers, pedestrians",ct:"Banksman/traffic marshal, reversing cameras, amber beacons, exclusion zones, one-way systems"},
    {a:"Road excavation",h:"Underground services strike",w:"Workers, public, service users",ct:"CAT & Genny PAS 128, utility records check, hand dig trial holes within 500mm, HSG47"},
    {a:"Asphalt/bitumen surfacing",h:"Burns from hot materials (150°C+)",w:"Surfacing operatives",ct:"Long sleeves, heat-resistant gloves, face shield, temperature monitoring, COSHH assessment"},
    {a:"Breaker/compactor use",h:"Hand-arm vibration syndrome (HAVS)",w:"Equipment operators",ct:"Low-vibration tools specified, trigger time limits monitored, health surveillance programme, CNWR 2005"},
  ],
  "Excavation / Groundworks":[
    {a:"Machine excavation",h:"Trench/excavation collapse and burial",w:"Workers in/adjacent to excavation",ct:"Shoring/trench boxes for depths >1.2m, battering to safe angle, daily inspection by competent person, CDM 2015 Reg. 22"},
    {a:"Excavation near services",h:"Underground services strike (gas/electric/water/comms)",w:"Workers, public, utility customers",ct:"CAT & Genny scan PAS 128, service records from asset owners, hand dig within 500mm of known services, HSG47"},
    {a:"Open excavation on site",h:"Person or vehicle falling into excavation",w:"Workers, visitors, public, children",ct:"Heras fencing minimum, warning signage, physical barriers, lighting for night, stop blocks for vehicles, backfill ASAP"},
    {a:"Handling excavated material",h:"Contact with contaminated ground/soil",w:"Excavation workers",ct:"Preliminary desk study, RPE, nitrile gloves, Tyvek suit, decontamination procedure, COSHH 2002"},
    {a:"Dewatering/pumping",h:"Flooding/water ingress into excavation",w:"Workers in excavation",ct:"Pumping equipment, weather monitoring, escape routes maintained, monitoring, rescue equipment available"},
  ],
};

// ═══ SMART CONTROL SUGGESTIONS ═══
export const CTRL_SUGGEST={
  fall:["Guard rails and toe boards to all open edges","Full body harness EN 361 with twin lanyard","Safety netting below working area","Edge protection to scaffold — WAHR 2005 Reg. 6","Rescue plan documented and communicated — WAHR 2005 Reg. 9","Equipment inspected before use — WAHR 2005 Reg. 12"],
  electric:["Lockout/tagout procedure implemented","RCD 30mA protection on all circuits","110V reduced voltage supply via transformer","Tested dead confirmation before work starts","Insulated tools used — EAWR 1989 Reg. 14","Permit to work issued for live working"],
  fire:["Hot work permit issued and displayed","Fire watch minimum 60 minutes after work ceases","Fire extinguisher (appropriate type) within arm's reach","All combustible materials cleared/protected within 10m radius","Welding screens/fire blankets deployed — RRFSO 2005","Smoke/heat detectors isolated with FM permission (re-activate after)"],
  noise:["Hearing protection zone signage erected","Ear defenders EN 352 mandatory above 85dB","Exposure time limits calculated and enforced","Low-noise tools/methods selected where practicable — CNWR 2005","Noise assessment conducted and recorded","Hearing health surveillance programme in place"],
  dust:["Water suppression on all cutting operations","RPE minimum FFP3 for respirable crystalline silica (RCS)","On-tool extraction fitted and operational","COSHH assessment completed and communicated — COSHH 2002","Health surveillance programme (lung function) — EH40 WEL","Work area dampened down to suppress ambient dust"],
  manual:["Mechanical handling aids provided (trolley, crane, hoist)","Team lifting arranged for loads exceeding 25kg","Manual handling training provided to all operatives","Risk assessment reviewed for specific tasks — MHOR 1992 Reg. 4","Loads reduced/split where practicable","Correct lifting technique briefed — bend knees, straight back"],
  vehicle:["Banksman/traffic marshal stationed and briefed","Reversing cameras and audible alarms on all plant","Physical exclusion zones established (barriers/cones)","Chapter 8 traffic management plan implemented","Hi-vis EN ISO 20471 Class 3 minimum for all personnel","Speed limit enforced on site (typically 5-10 mph)"],
  collapse:["Shoring/trench boxes installed for excavations >1.2m depth","Sides battered/stepped to safe angle of repose","Competent person inspection daily and after any event — CDM 2015 Reg. 22","Edge protection and barriers installed around excavation","Permit to dig system implemented","Emergency rescue equipment available at excavation"],
  chemical:["COSHH assessment reviewed and communicated to all workers","RPE as specified in Safety Data Sheet (SDS)","Chemical-resistant gloves EN 374 worn","Eye wash station available within 10m — COSHH 2002","Spill kit available and workers trained in use","Storage: chemicals stored in bunded area, DSEAR if applicable"],
  confined:["Permit to enter issued by authorised person","Atmosphere tested with calibrated 4-gas monitor (O₂, CO, H₂S, LEL)","Continuous atmospheric monitoring during entry","Standby person stationed at entry point at all times — CSR 1997","Rescue equipment and trained rescue team available","Communication system established (radio/rope)"],
};

// ═══ TOOLBOX TALKS LIBRARY ═══
export const TBT_LIBRARY={
  "General Safety":[
    {t:"Manual Handling — Think Before You Lift",d:"Key points: Assess the load (weight, shape, grip). Plan the lift route. Use mechanical aids where possible. For loads >25kg arrange team lift. Bend knees, keep back straight, hold load close to body. Never twist while carrying. Report any pain immediately. Reference: MHOR 1992 Reg. 4."},
    {t:"Slips, Trips and Falls — UK's #1 Workplace Injury",d:"Causes: wet/contaminated floors, trailing cables, uneven surfaces, poor lighting, unsuitable footwear. Prevention: report spills immediately, use cable covers, maintain walkways, adequate lighting, wear suitable footwear. Report hazards via near-miss system."},
    {t:"PPE — Your Last Line of Defence",d:"PPE is the LAST resort after elimination, substitution, engineering and admin controls. Always wear correct PPE for the task. Inspect before every use. Report any damage immediately. Replace worn items. Know the EN standard for your PPE. Store correctly. Reference: PPER 2022."},
    {t:"Fire Safety — Everyone's Responsibility",d:"Know: your assembly point location, nearest fire extinguisher, fire exit routes, fire alarm sound, fire marshal identity. Never block fire exits or corridors. Report defective fire equipment. Evacuate immediately on alarm — do not collect belongings. Reference: RRFSO 2005."},
    {t:"Working Near the Public",d:"The public don't understand construction risks. Always: secure site perimeter, maintain barriers and signage, use banksman for vehicle movements, consider pedestrian diversions, never leave open excavations unattended. Report any public interaction/complaint."},
    {t:"Mental Health Awareness on Site",d:"Construction has highest suicide rate of any UK industry. Signs to watch: withdrawal, mood changes, risk-taking, absence. What you can do: ask twice ('are you really OK?'), listen without judgement, signpost to help. Samaritans: 116 123. CALM: 0800 58 58 58."},
    {t:"Reporting Near Misses — Why It Matters",d:"A near miss today is tomorrow's accident. EVERY near miss must be reported — no blame culture. Heinrich's Law: for every 1 major injury there are 29 minor injuries and 300 near misses. Report immediately to supervisor. We investigate to prevent, not to punish."},
  ],
  "Working at Height":[
    {t:"Work at Height — Hierarchy of Control",d:"1) Avoid work at height if possible. 2) Use collective protection (scaffolds, guard rails, airbags). 3) Use personal protection (harness, nets) as last resort. 4) Always have a rescue plan BEFORE starting. Reference: WAHR 2005 Reg. 6-9."},
    {t:"Ladder Safety — Not a Workplace",d:"Ladders are for SHORT duration, LIGHT work only. Rules: industrial grade only, 1:4 ratio, secured at top, 3 points of contact always, don't overreach, face the ladder, max 30 min at a time. Never use in adverse weather. Inspect before every use."},
    {t:"Scaffold Safety",d:"Only use scaffold erected by competent scaffolder. Check inspection tag — must be within 7 days. Report: missing guard rails, toe boards, ties, damaged components, overloading. Never modify scaffold yourself. Don't store excessive materials. Reference: NASC TG20."},
  ],
  "Excavation":[
    {t:"Excavation Safety — The Hidden Killer",d:"Soil weighs 1.5 tonnes per cubic metre. A 1m cube collapse = being trapped under a car. Rules: NEVER enter unsupported excavation >1.2m. Always scan with CAT & Genny before ANY dig. Barriers around ALL open excavations. Daily inspection by competent person. Reference: CDM 2015, HSG47."},
    {t:"Underground Services — Strike Prevention",d:"Before breaking ground: 1) Request service drawings from all utilities. 2) Scan with CAT & Genny (PAS 128 Level B minimum). 3) Hand dig trial holes within 500mm of indicated services. 4) Mark up service locations. 5) Brief all operatives. Report ANY strike immediately — evacuate area."},
  ],
  "Hot Works":[
    {t:"Hot Work Permit System",d:"A hot work permit is MANDATORY before any welding, cutting, brazing, soldering, or grinding that produces sparks. Steps: 1) Apply for permit. 2) Clear combustibles 10m radius. 3) Position fire extinguisher within reach. 4) Start work. 5) Fire watch MINIMUM 60 minutes after work ceases. 6) Close permit."},
    {t:"Welding Fume — The Invisible Danger",d:"Welding fume is now classified as a Group 1 carcinogen (causes cancer). ALL welding requires LEV extraction or adequate ventilation. RPE minimum FFP3 for stainless steel, galvanised, or painted metals. Regular health surveillance required. Reference: COSHH 2002, EH40 WEL."},
  ],
};

// ═══ SITE PLAN MARKERS ═══
export const PLAN_MARKERS=[
  {type:"fire_exit",icon:"🚪",label:"Fire Exit",color:"#ef4444"},
  {type:"fire_ext",icon:"🧯",label:"Fire Extinguisher",color:"#f97316"},
  {type:"first_aid",icon:"🏥",label:"First Aid Point",color:"#22c55e"},
  {type:"assembly",icon:"📍",label:"Assembly Point",color:"#3b82f6"},
  {type:"welfare",icon:"🚽",label:"Welfare / Toilets",color:"#06b6d4"},
  {type:"parking",icon:"🅿️",label:"Parking Area",color:"#64748b"},
  {type:"site_office",icon:"🏢",label:"Site Office",color:"#8b5cf6"},
  {type:"storage",icon:"📦",label:"Material Storage",color:"#a78bfa"},
  {type:"exclusion",icon:"⛔",label:"Exclusion Zone",color:"#dc2626"},
  {type:"isolation",icon:"⚡",label:"Isolation Point (Elec/Gas/Water)",color:"#eab308"},
  {type:"access_v",icon:"🚗",label:"Vehicle Access",color:"#10b981"},
  {type:"access_p",icon:"🚶",label:"Pedestrian Access",color:"#06b6d4"},
  {type:"crane",icon:"🏗️",label:"Crane / Lifting Zone",color:"#f59e0b"},
  {type:"scaffold",icon:"🪜",label:"Scaffold Location",color:"#78716c"},
  {type:"hazard",icon:"⚠️",label:"Hazard / Danger Zone",color:"#ef4444"},
  {type:"cctv",icon:"📹",label:"CCTV Camera",color:"#475569"},
  {type:"water",icon:"💧",label:"Water Supply / Stopcock",color:"#3b82f6"},
  {type:"gas",icon:"🔥",label:"Gas Isolation Valve",color:"#f97316"},
  {type:"electric",icon:"⚡",label:"Electrical Isolation",color:"#eab308"},
  {type:"skip",icon:"🗑️",label:"Skip / Waste Area",color:"#78716c"},
  {type:"delivery",icon:"🚛",label:"Delivery/Unloading Point",color:"#64748b"},
  {type:"custom",icon:"📌",label:"Custom Marker",color:"#94a3b8"},
];

// ═══ PHOTO CATEGORIES ═══
export const PHOTO_CATS=[
  {cat:"Access Issues",items:["No Access — Gate Locked","No Access — Vehicle Blocking","No Access — Construction Blocking","No Parking Available","Road Closure Preventing Access","Footpath Blocked"]},
  {cat:"Services & Utilities",items:["Leaked / Burst Water Pipe","Exposed Water Main","Exposed Gas Pipe","Exposed Electrical Cable","Damaged Drain / Sewer","Manhole Cover Missing","Manhole Cover Damaged","Stop Tap Location","Meter Location","Service Marker Post"]},
  {cat:"Health & Safety",items:["Blocked Fire Exit","Fire Extinguisher Location","First Aid Kit Location","Assembly Point Photo","Missing/Damaged Signage","PPE Non-Compliance","Unsafe Scaffold","Missing Guard Rail","Trip Hazard Identified","Poor Lighting","Exposed Wiring","Debris / Waste on Site","Asbestos Suspected Material","Slip Hazard — Wet Surface","Excavation Unprotected"]},
  {cat:"Site Conditions",items:["Damaged Road Surface","Damaged Wall / Structure","Damaged Fence / Boundary","Overgrown Vegetation","Fly Tipping / Illegal Waste","Standing Water / Flooding","Ground Contamination Suspected","Unstable Ground / Subsidence","Existing Damage — Pre-Works Record"]},
  {cat:"Work Progress",items:["Before — Pre-Works Condition","During — Work In Progress","After — Completed Works","Snagging Item Identified","Defect Found","Good Practice Observed","Reinstatement Complete","Temporary Works In Place"]},
  {cat:"Equipment & Plant",items:["Plant Arriving on Site","Equipment Daily Check","Defective Equipment Found","Tool/Equipment Inventory","Scaffold Inspection Tag","Lifting Equipment Check"]},
  {cat:"Survey / Investigation",items:["Trial Pit — Open","Trial Pit — Backfilled","Core Sample Location","GPR Survey in Progress","Topographic Feature","Utility Mark-Up on Ground","Service Exposure Photo","Soil Sample Taken"]},
];

// ═══ CERTIFICATE TYPES ═══
export const CERT_TYPES=[
  "CSCS Card","CPCS (Plant Operator)","IPAF (MEWP)","PASMA (Mobile Scaffold Towers)",
  "SSSTS (Site Supervisors Safety)","SMSTS (Site Managers Safety)",
  "CSCS Supervisor Card","First Aid at Work (3-Day)","Emergency First Aid (1-Day)",
  "Fire Safety / Fire Marshal","Working at Height","Manual Handling",
  "Asbestos Awareness (Cat A)","Asbestos Licensed (Cat B/C)","Confined Space Entry",
  "Abrasive Wheels","Hot Works Certificate","Scaffold Inspection (TG20)",
  "NEBOSH General Certificate","NEBOSH Construction Certificate",
  "IOSH Managing Safely","IOSH Working Safely",
  "Temporary Works Coordinator","Appointed Person (Lifting Operations)",
  "Slinger / Signaller","Crane Supervisor","Telehandler (CPCS A17)",
  "360° Excavator (CPCS A12)","Dumper Forward Tip (CPCS A09)",
  "Roller (CPCS A31)","Banksman / Traffic Marshal",
  "ECS Card (Electrical)","Gas Safe Registration","OFTEC (Oil)",
  "Water Hygiene (L8)","Harness Inspection (Competent Person)",
  "PAT Testing (Competent Person)","Legionella Awareness",
  "DBS Check","EUSR (Water)","NRSWA (Street Works)",
  "Chapter 8 (Traffic Management)","CITB Health & Safety Test",
];

// ═══ CSCS CARD TYPES ═══
export const CSCS_TYPES=[
  "Labourer (Green)","Skilled Worker (Blue)","Advanced Craft (Gold)",
  "Supervisor (Gold)","Manager (Black)","Academically Qualified (White)",
  "Trainee (Red)","Visitor (White)","Professionally Qualified (White)",
  "Construction Related Occupation (Blue)",
];

// ═══ INCIDENT TYPES ═══
export const INCIDENT_TYPES=[
  "Near Miss","Unsafe Act Observed","Unsafe Condition Found",
  "Minor Injury (First Aid)","Over-3-Day Injury","Over-7-Day Injury (RIDDOR)",
  "Major Injury (RIDDOR)","Fatality (RIDDOR)","Dangerous Occurrence (RIDDOR)",
  "Environmental Incident","Property / Equipment Damage",
  "Fire / Explosion","Security Breach","Third Party Injury","Vehicle Accident",
];

// ═══ THEMES ═══
export const DARK={bg:"#0b1121",fg:"#e2e8f0",crd:"#111827",cd2:"#0f172a",brd:"#1e293b",mut:"#64748b",sub:"#94a3b8",acc:"#f97316"};
export const LIGHT={bg:"#f8fafc",fg:"#0f172a",crd:"#ffffff",cd2:"#f1f5f9",brd:"#e2e8f0",mut:"#64748b",sub:"#475569",acc:"#f97316"};

// ═══ DEFAULT ORG ═══
export const DEF_ORG={
  nm:"FESS - Food Engineering Services",
  addr:"",ph:"",em:"",web:"",
  logo:null, // base64
  primaryColor:"#f97316",
  secondaryColor:"#1e293b",
  safetyPolicy:"This organisation is committed to ensuring the health, safety and welfare of all employees, contractors and others affected by our work activities, in accordance with the Health and Safety at Work etc. Act 1974 and all associated regulations. We will provide safe systems of work, adequate training, and suitable PPE. All personnel have a duty to cooperate with safety arrangements and report hazards immediately.",
  docFooter:"This document has been produced in accordance with current UK Health & Safety legislation. It must be reviewed if there is any significant change in working conditions, personnel, equipment, or following any incident.",
  customFields:[],
};
