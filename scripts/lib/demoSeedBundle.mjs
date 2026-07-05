/**
 * Builds a full MySafeOps demo backup bundle (localStorage shape) for QA / demo accounts.
 */

const genId = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

const PERMIT_TYPE_KEYS = [
  "hot_work", "electrical", "work_at_height", "confined_space", "excavation", "lifting",
  "cold_work", "line_break", "roof_access", "night_works", "valve_isolation", "visitor_access",
  "radiography", "ground_disturbance", "line_clearance", "rail_corridor_access",
  "marine_hydrographic", "aerial_survey_coordination", "general",
];

const PERMIT_LABELS = {
  hot_work: "Hot work — welding bay",
  electrical: "Electrical isolation — DB-3",
  work_at_height: "MEWP — roof plant",
  confined_space: "Chamber entry — MH-12",
  excavation: "Permit to dig — grid B4",
  lifting: "Crane lift — AHU module",
  cold_work: "Cold work — conveyor strip",
  line_break: "Line break — chilled water",
  roof_access: "Roof access — flat roof zone C",
  night_works: "Night works — production hall",
  valve_isolation: "Valve isolation — CIP header",
  visitor_access: "Client audit visit",
  radiography: "NDT radiography — weld joint",
  ground_disturbance: "Piling trial — bay 2",
  line_clearance: "Line clearance — Line 3",
  rail_corridor_access: "Rail possession — chainage 412",
  marine_hydrographic: "Hydro survey — jetty",
  aerial_survey_coordination: "UAV corridor mapping",
  general: "General maintenance window",
};

const STATUSES = ["draft", "active", "issued", "closed"];

/** @param {string} orgSlug */
export function buildDemoSeedBundle(orgSlug) {
  const orgId = orgSlug;
  const sk = (base) => `${base}_${orgId}`;

  const projectA = {
    id: genId("proj"),
    name: "FESS Factory Refurb — Line 3",
    client: "FESS Group",
    location: "Unit 7, Industrial Estate, Maidstone ME14 5PP",
    site: "Production hall & roof plant",
    address: "Unit 7, Maidstone ME14 5PP",
    status: "active",
    nearestHospital: "Maidstone Hospital, Hermitage Lane, ME16 9QQ",
    permitDefaults: { requiredPermitTypes: ["hot_work", "work_at_height", "line_clearance"] },
    createdAt: now(),
    updatedAt: now(),
  };

  const projectB = {
    id: genId("proj"),
    name: "PAS128 Utility Survey — A229 corridor",
    client: "Kent Highways",
    location: "A229 corridor, Maidstone",
    status: "active",
    nearestHospital: "Maidstone Hospital, Hermitage Lane, ME16 9QQ",
    permitDefaults: { requiredPermitTypes: ["excavation", "aerial_survey_coordination"] },
    createdAt: now(),
    updatedAt: now(),
  };

  const workers = [
    { id: genId("w"), name: "Patryk Owedyk", role: "Supervisor", email: "owedykpatryk@gmail.com", trade: "Site manager", cscs: "CSCS Gold", status: "active", createdAt: now() },
    { id: genId("w"), name: "Alex Morgan", role: "Operative", trade: "Electrician", ecs: "ECS Gold", status: "active", createdAt: now() },
    { id: genId("w"), name: "Sam Taylor", role: "Operative", trade: "Mechanical", ipaf: "IPAF 3a/3b", status: "active", createdAt: now() },
    { id: genId("w"), name: "Jordan Lee", role: "Operative", trade: "Banksman", status: "active", createdAt: now() },
  ];

  const permits = PERMIT_TYPE_KEYS.map((type, i) => {
    const status = STATUSES[i % STATUSES.length];
    const project = i % 2 === 0 ? projectA : projectB;
    return {
      id: genId("ptw"),
      type,
      projectId: project.id,
      location: project.location,
      description: PERMIT_LABELS[type] || type,
      status,
      startDateTime: `${today()}T08:00:00.000Z`,
      endDateTime: `${today()}T17:00:00.000Z`,
      issuerName: "Patryk Owedyk",
      supervisorName: "Patryk Owedyk",
      checklist: {},
      createdAt: now(),
      updatedAt: now(),
    };
  });

  const ramsHazardRow = (n) => ({
    category: n % 2 ? "Electrical" : "Work at Height",
    activity: n % 2 ? "Isolation and verification" : "MEWP access to roof plant",
    hazard: n % 2 ? "Contact with live conductors" : "Fall from height",
    initialRisk: { L: 4, S: n % 2 ? 5 : 4, RF: n % 2 ? 20 : 16 },
    controlMeasures: ["Permit-to-work and LOTO", "Supervisor hold point", "Exclusion zone"],
    revisedRisk: { L: 2, S: n % 2 ? 5 : 4, RF: n % 2 ? 10 : 8 },
    ppeRequired: ["Hard hat", "Safety boots", "Hi-vis"],
    regs: ["HASAWA 1974", "CDM 2015"],
  });

  const ramsDocs = [
    {
      id: genId("rams"),
      title: "RAMS — Factory refurb mechanical & electrical",
      location: projectA.location,
      leadEngineer: "Patryk Owedyk",
      jobRef: "FESS-L3-2026",
      projectId: projectA.id,
      status: "issued",
      scope: "Strip-out, conveyor modifications and electrical isolation in occupied food factory.",
      methodSteps: [
        "Pre-start briefing and line clearance sign-off.",
        "Apply LOTO and verify dead before intrusive work.",
        "Execute works under permit controls with fire watch where required.",
        "Reinstate, clean down and production handback.",
      ],
      hazards: [0, 1, 2].map(ramsHazardRow),
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: genId("rams"),
      title: "RAMS — PAS128 utility mapping",
      location: projectB.location,
      leadEngineer: "Patryk Owedyk",
      jobRef: "PAS128-A229",
      projectId: projectB.id,
      status: "approved",
      scope: "QLB utility mapping with GPR/EML and trial holes.",
      methodSteps: ["Site scan and CAT/Genny sweep.", "Mark utilities and issue deliverables.", "Trial holes with permit-to-dig."],
      hazards: [1, 2, 3].map(ramsHazardRow),
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const methodStatements = [
    {
      id: genId("ms"),
      title: "Method — Hot work on roof plant",
      projectId: projectA.id,
      status: "active",
      revision: "1A",
      steps: ["Isolate and purge adjacent services.", "Fire watch and extinguishers in place.", "Welding with fume extraction."],
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const briefing = {
    id: genId("brief"),
    date: today(),
    time: "07:30",
    location: projectA.location,
    conductedBy: "Patryk Owedyk",
    weatherConditions: "Dry, light wind",
    temperature: "14°C",
    topics: ["PPE for today", "Permits active on site", "Emergency muster point"],
    scopeToday: "Mechanical strip-out bay 3; MEWP on north elevation.",
    attendees: workers.slice(0, 3).map((w) => ({ name: w.name, signedAt: now() })),
    notes: "Demo daily briefing record.",
    createdAt: now(),
  };

  const coshh = [
    { id: genId("coshh"), name: "Cutting fluid — soluble oil", manufacturer: "Example Ltd", riskLevel: "medium", hazardTypes: ["skin"], storageLocation: "COSHH cupboard", assessedDate: today(), createdAt: now() },
    { id: genId("coshh"), name: "Isopropyl alcohol 99%", manufacturer: "Example Ltd", riskLevel: "high", hazardTypes: ["flammable"], storageLocation: "Flammables cabinet", assessedDate: today(), createdAt: now() },
  ];

  const registerRow = (moduleId, extra = {}) => ({
    id: genId(moduleId.slice(0, 4)),
    projectId: projectA.id,
    notes: `Demo ${moduleId} record — replace with live data`,
    createdAt: now(),
    ...extra,
  });

  const keys = {
    mysafeops_orgId: orgId,
    mysafeops_org_settings: JSON.stringify({
      name: "Owedykpatryk Workspace",
      industryPackId: "showEverything",
      address: "Kent, UK",
      email: "owedykpatryk@gmail.com",
      primaryColor: "#0d9488",
      accentColor: "#f97316",
      pdfFooter: "Generated by MySafeOps — demo data",
    }),
    [sk("mysafeops_role")]: "admin",
    [sk("mysafeops_projects")]: JSON.stringify([projectA, projectB]),
    [sk("mysafeops_workers")]: JSON.stringify(workers),
    [sk("permits_v2")]: JSON.stringify(permits),
    [sk("rams_builder_docs")]: JSON.stringify(ramsDocs),
    [sk("method_statements")]: JSON.stringify(methodStatements),
    [sk("daily_briefings")]: JSON.stringify([briefing, { ...briefing, id: genId("brief"), date: today(), scopeToday: "Survey corridor setup and traffic management." }]),
    [sk("coshh_items")]: JSON.stringify(coshh),
    [sk("snags")]: JSON.stringify([
      registerRow("snag", { ref: "SN-101", title: "Paint touch-up — stairwell B", status: "open", priority: "low" }),
      registerRow("snag", { ref: "SN-102", title: "Missing kick plate — loading bay", status: "in_progress", priority: "medium" }),
    ]),
    [sk("mysafeops_incidents")]: JSON.stringify([
      registerRow("inc", { type: "near_miss", severity: "low", description: "Trip hazard from loose cable — corrected", status: "closed", occurredAt: now() }),
    ]),
    [sk("incident_actions_v1")]: JSON.stringify([
      registerRow("ia", { title: "Cable management additional tie wraps", owner: "Alex Morgan", dueDate: today(), status: "open" }),
    ]),
    [sk("riddor_reports")]: JSON.stringify([
      registerRow("riddor", { riddorType: "none_reportable", status: "draft", incidentDescription: "Template RIDDOR worksheet only" }),
    ]),
    [sk("inspection_records")]: JSON.stringify([
      registerRow("insp", { type: "loler", name: "Telehandler TH-01", result: "pass", inspectedAt: today() }),
      registerRow("insp", { type: "scaffold", name: "Scaffold north elevation", result: "pass", inspectedAt: today() }),
    ]),
    [sk("training_matrix")]: JSON.stringify([
      registerRow("trn", { workerName: "Alex Morgan", courseName: "ECS Gold", expiryDate: "2027-06-01", status: "valid" }),
    ]),
    [sk("visitor_log")]: JSON.stringify([
      registerRow("vis", { visitorName: "Client QA", company: "FESS Group", visitDate: today(), timeIn: "09:00", purpose: "Audit" }),
    ]),
    [sk("toolbox_talks")]: JSON.stringify([
      registerRow("tt", { topic: "Dust and silica on refurb", talkDate: today(), presenter: "Patryk Owedyk", attendeeCount: 4 }),
    ]),
    [sk("first_aid_register")]: JSON.stringify([
      registerRow("fa", { name: "Sam Taylor", role: "First aider", certExpiry: "2026-12-01" }),
    ]),
    [sk("ppe_register")]: JSON.stringify([
      registerRow("ppe", { item: "Safety boots", workerName: "Jordan Lee", issuedDate: today(), conditionOk: true }),
    ]),
    [sk("plant_register")]: JSON.stringify([
      registerRow("plt", { assetRef: "EX-360-01", description: "13t excavator", inspectedDate: today(), result: "pass" }),
    ]),
    [sk("fire_safety_log")]: JSON.stringify([
      registerRow("fire", { checkType: "Extinguisher weekly", location: "Welfare", checkDate: today(), satisfactory: true, checkedBy: "Patryk Owedyk" }),
    ]),
    [sk("hot_work_register")]: JSON.stringify([
      registerRow("hw", { permitRef: permits[0].id, location: "Roof plant", workDate: today(), status: "active" }),
    ]),
    [sk("lone_working_log")]: JSON.stringify([
      registerRow("lone", { workerName: "Alex Morgan", task: "PAT testing welfare block", workDate: today(), signedOff: true }),
    ]),
    [sk("environmental_log")]: JSON.stringify([
      registerRow("env", { eventDate: today(), category: "Waste", description: "Mixed waste skip exchange", closedOut: true }),
    ]),
    [sk("safety_observations")]: JSON.stringify([
      registerRow("obs", { type: "positive", description: "Good segregation at loading bay", status: "closed", reportedAt: today() }),
    ]),
    [sk("ladder_inspections")]: JSON.stringify([
      registerRow("lad", { ladderRef: "LAD-02", location: "Store", inspectionDate: today(), result: "pass" }),
    ]),
    [sk("mewp_log")]: JSON.stringify([
      registerRow("mewp", { equipmentRef: "MEWP-01", mewpType: "Scissor", operatorName: "Sam Taylor", checkDate: today(), preUseOk: true }),
    ]),
    [sk("gate_book")]: JSON.stringify([
      registerRow("gate", { visitDate: today(), vehicleReg: "KX19 ABC", driverName: "Delivery driver", timeIn: "10:15", purpose: "Plant delivery" }),
    ]),
    [sk("asbestos_register")]: JSON.stringify([
      registerRow("asb", { location: "Ceiling void grid 4", materialDescription: "Presumed AIB — survey ref AS-2024", asbestosType: "Presumed" }),
    ]),
    [sk("confined_space_log")]: JSON.stringify([
      registerRow("cs", { spaceDescription: "Underground chamber MH-12", entryDate: today(), gasTestOk: true, topMan: "Jordan Lee" }),
    ]),
    [sk("loto_register")]: JSON.stringify([
      registerRow("loto", { equipmentName: "Main LV panel DB-3", equipmentTag: "DB-3", phase: "live", zeroEnergyVerified: true }),
    ]),
    [sk("electrical_pat_log")]: JSON.stringify([
      registerRow("pat", { assetTag: "PAT-110V-01", description: "110V transformer", testDate: today(), result: "pass", testedBy: "Alex Morgan" }),
    ]),
    [sk("lifting_plan_register")]: JSON.stringify([
      registerRow("lift", { liftRef: "LIFT-001", loadDescription: "AHU module 2.1t", liftDate: today(), appointedPerson: "Patryk Owedyk" }),
    ]),
    [sk("dsear_register")]: JSON.stringify([
      registerRow("dsear", { substanceOrArea: "Flammable store", hazardClass: "Cat 3 flammable liquid", reviewDate: today() }),
    ]),
    [sk("noise_vibration_log")]: JSON.stringify([
      registerRow("noise", { recordType: "noise", activityOrTool: "Breaker on concrete", logDate: today(), location: "Bay 3" }),
    ]),
    [sk("scaffold_register")]: JSON.stringify([
      registerRow("scf", { tagRef: "SCF-NORTH", location: "North elevation", inspectionDate: today(), result: "pass" }),
    ]),
    [sk("excavation_log")]: JSON.stringify([
      registerRow("exc", { permitRef: permits[4]?.id, workDescription: "Trial pit — service verification", workDate: today(), maxDepth: "1.2m" }),
    ]),
    [sk("temporary_works_register")]: JSON.stringify([
      registerRow("tw", { twRef: "TW-001", description: "Needling propping", category: "Propping", status: "in_use" }),
    ]),
    [sk("welfare_check_log")]: JSON.stringify([
      registerRow("wel", { checkDate: today(), projectName: projectA.name, checkedBy: "Patryk Owedyk", issues: "None" }),
    ]),
    [sk("water_hygiene_log")]: JSON.stringify([
      registerRow("wh", { outletId: "WHB-01", outletType: "WHB", location: "Welfare", checkDate: today(), temperatureC: "52" }),
    ]),
    [sk("waste_register")]: JSON.stringify([
      registerRow("wst", { wtnRef: "WTN-2026-001", transferDate: today(), description: "Mixed construction waste", ewcCode: "17 09 04" }),
    ]),
    [sk("emergency_contacts")]: JSON.stringify([
      { id: genId("ec"), label: "Site supervisor", phone: "07xxx xxx xxx", notes: "Patryk Owedyk", createdAt: now() },
      { id: genId("ec"), label: "Maidstone Hospital A&E", phone: "01622 729000", notes: "Hermitage Lane ME16 9QQ", createdAt: now() },
    ]),
    [sk("cdm_packs")]: JSON.stringify([
      { id: genId("cdm"), projectId: projectA.id, title: "CPP — FESS refurb", status: "draft", createdAt: now(), updatedAt: now() },
    ]),
    [sk("high_care_access_register")]: JSON.stringify([
      registerRow("hc", { zoneName: "High-care packing", visitorName: "Alex Morgan", visitorCompany: "Contractor", zoneClass: "High-care" }),
    ]),
    [sk("cip_signoff_register")]: JSON.stringify([
      registerRow("cip", { equipmentId: "CIP-Skid-01", cipProgram: "Caustic/acid", signedOffBy: "Production", workOrderRef: "WO-4421" }),
    ]),
    [sk("allergen_changeover_windows")]: JSON.stringify([
      registerRow("acw", { label: "Peanut to nut-free", fromAllergen: "Peanut", toAllergen: "None", startAt: `${today()}T06:00`, endAt: `${today()}T14:00` }),
    ]),
    [sk("gmp_deviation_log")]: JSON.stringify([
      registerRow("gmp", { batchRef: "BATCH-9912", deviationType: "Process", siteLabel: "Line 3", closedAt: "" }),
    ]),
    [sk("ghp_register")]: JSON.stringify([
      registerRow("ghp", { itemDescription: "Torque wrench", zone: "High-care", broughtBy: "Alex Morgan", dateIn: today() }),
    ]),
    [sk("dynamic_risk_assessments")]: JSON.stringify([
      registerRow("dra", { location: "Loading bay", authorName: "Patryk Owedyk", assessedAt: today(), newHazards: "Increased HGV movements" }),
    ]),
    [sk("legislation_register")]: JSON.stringify([
      { id: "leg_hasawa", shortName: "HASAWA 1974", applicable: true, nextReview: "2026-12-01", createdAt: now() },
      { id: "leg_cdm2015", shortName: "CDM 2015", applicable: true, nextReview: "2026-12-01", createdAt: now() },
      { id: "leg_coshh", shortName: "COSHH 2002", applicable: true, nextReview: "2026-12-01", createdAt: now() },
    ]),
    [sk("survey_reports")]: JSON.stringify([
      { id: genId("sur"), ref: "PAS128-001", title: "QLB utility mapping — A229", status: "draft", surveyDate: today(), surveyor: "Patryk Owedyk", createdAt: now() },
    ]),
    [sk("mysafeops_timesheets")]: JSON.stringify([
      { id: genId("ts"), workerId: workers[0].id, workerName: workers[0].name, projectId: projectA.id, date: today(), hours: 8, notes: "Demo timesheet", createdAt: now() },
    ]),
    [sk("client_portals")]: JSON.stringify([
      { id: genId("cp"), projectId: projectA.id, label: "FESS client view", published: true, createdAt: now() },
    ]),
    [sk("document_templates")]: JSON.stringify([
      { id: genId("tpl"), name: "Standard site RAMS", type: "rams", createdAt: now() },
    ]),
    [sk("mysafeops_audit")]: JSON.stringify([
      { at: now(), action: "demo_seed", entity: "system", detail: "Demo data bundle provisioned" },
    ]),
  };

  return {
    version: 1,
    exportedAt: now(),
    orgId,
    keys,
    meta: {
      permitCount: permits.length,
      ramsCount: ramsDocs.length,
      projectCount: 2,
      workerCount: workers.length,
      keyCount: Object.keys(keys).length,
    },
  };
}
