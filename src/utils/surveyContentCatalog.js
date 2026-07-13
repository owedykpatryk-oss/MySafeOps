/**
 * Single source of truth for survey report / RAMS / playbook prose and defaults.
 * Org overrides: surveyOrgTemplates.js
 */

const mkDel = (format, description, status = "Issued with report", crs = "OSGB36") => ({
  id: `del_${format}_${description.slice(0, 8).replace(/\W/g, "")}`,
  format,
  description,
  crs,
  status,
});

/** Generic field-survey RAMS boilerplate — reusable across survey types (no site/client specifics). */
export const SURVEY_RAMS_COMMON = {
  preStart:
    "Carry out a daily onsite pre-start before each shift. Confirm adequate controls are in place. Stop work and escalate to the survey lead and site contact if an unassessed hazard is identified.",
  siteAccess:
    "Report to site reception and sign in where required. Attend project-specific induction where areas of work, survey approach and interface hazards are briefed.",
  externalConditions:
    "Wear weather-appropriate hi-vis PPE (waterproof kit in wet weather; long-sleeved hi-vis in hot conditions). Brief operatives on UV/skin protection and hydration for extended external work.",
  training:
    "Only competent, accredited staff undertake survey work. Utility mapping: PAS 128 / CAT-Genny competence and manual handling as minimum. UAV: GVC (or equivalent CAA qualification). Rail interfaces: PTS/TVP where required. Petrochemical sites: SPA where required.",
  equipment:
    "Pre-use checks on all tools; remove faulty equipment from service. EML, GPR, GNSS, total station and UAV equipment serviced and calibrated per manufacturer schedule.",
  ppe: "Hard hat, safety boots, hi-vis, gloves, eye protection. Ear defenders where noise exceeds limits. Additional PPE per site rules and task risk.",
  housekeeping:
    "Secure equipment; keep walkways clear. Leave work areas tidy. Remove survey waste from site.",
  management:
    "Monitoring: survey lead inspections and hold-point checks.\nFirst aid: vehicle first-aid kits available.\nWelfare: use agreed onsite or local welfare facilities.\nEmergency: follow site emergency procedure; call 999 for serious injury.",
};

/** PAS 128 quality-level positional tolerances (generic UK industry reference). */
export const PAS128_QL_TOLERANCES = [
  { key: "B1", horizontal: "±150 mm", depth: "±15% of given depth", note: "Highest — horizontal and vertical from EML + GPR" },
  { key: "B2", horizontal: "±250 mm", depth: "±40% of given depth", note: "Single-technique horizontal and vertical" },
  { key: "B3", horizontal: "±500 mm", depth: "No depth tolerance issued", note: "Horizontal position from one technique" },
  { key: "B4", horizontal: "Not issued", depth: "Not issued", note: "Indicative / records only" },
];

/** PAS 128 M-series GPR/EM grid intervals. */
export const PAS128_M_SERIES = [
  { key: "M1", interval: "5 m" },
  { key: "M2", interval: "2 m" },
  { key: "M2P", interval: "2 m (GPR post-processed)" },
  { key: "M3", interval: "1 m" },
  { key: "M3P", interval: "1 m (GPR post-processed)" },
  { key: "M4", interval: "0.5 m" },
  { key: "M4P", interval: "0.5 m incl. MH/IC (post-processed)" },
];

const UTILITY_SURVEY_TYPES = new Set([
  "utility_mapping_survey",
  "topo_plus_utility_survey",
  "eml_cat_survey",
  "gpr_survey",
  "service_clearance_survey",
]);

/** Prose block for survey report methodology / PDF. */
export function formatPas128QlToleranceProse() {
  const rows = PAS128_QL_TOLERANCES.map(
    (r) => `QL ${r.key} — ${r.horizontal} horizontal; ${r.depth}. ${r.note}.`
  );
  return `PAS 128 quality levels assigned in deliverables:\n${rows.join("\n")}`;
}

/** HTML table for survey report PDF (utility types). */
export function pas128QlToleranceHtmlTable() {
  const head = `<tr><th>QL</th><th>Horizontal</th><th>Depth</th><th>Notes</th></tr>`;
  const body = PAS128_QL_TOLERANCES.map(
    (r) =>
      `<tr><td><strong>${r.key}</strong></td><td>${r.horizontal}</td><td>${r.depth}</td><td>${r.note}</td></tr>`
  ).join("");
  return `<table class="sr-data-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/** UMG-style numbered RAMS method statement (sections 4.x / 5.x). */
export function buildStructuredSurveyRamsMethod(coreSteps) {
  const taskSteps = String(coreSteps || "").trim();
  return [
    "4.0 Work procedure and control measures",
    "",
    `4.1 Site access\n${SURVEY_RAMS_COMMON.siteAccess}`,
    "",
    `4.2 External working conditions\n${SURVEY_RAMS_COMMON.externalConditions}`,
    "",
    `4.3 Training and qualifications\n${SURVEY_RAMS_COMMON.training}`,
    "",
    `4.4 Equipment and tools\n${SURVEY_RAMS_COMMON.equipment}`,
    "",
    `4.5 Safe work procedure\n${SURVEY_RAMS_COMMON.preStart}${taskSteps ? `\n\n${taskSteps}` : ""}`,
    "",
    `4.6 Personal protective equipment (PPE)\n${SURVEY_RAMS_COMMON.ppe}`,
    "",
    `4.7 Housekeeping and waste disposal\n${SURVEY_RAMS_COMMON.housekeeping}`,
    "",
    "5.0 Management arrangements",
    "",
    `5.1 Monitoring\n${SURVEY_RAMS_COMMON.management.split("\n")[0]}`,
    "",
    `5.2 First aid, welfare and emergency\n${SURVEY_RAMS_COMMON.management.split("\n").slice(1).join("\n")}`,
  ].join("\n");
}

/** Full RAMS method — structured UMG sections. */
export function buildSurveyRamsMethod(coreSteps) {
  return buildStructuredSurveyRamsMethod(coreSteps);
}

/** RAMS pack readiness metadata (permits, certs, evidence, hold points). */
export const SURVEY_PACK_META = {
  utility_mapping_survey: {
    permitDependencies: ["Excavation / permit-to-dig", "Temporary traffic management approval"],
    requiredCerts: ["PAS 128 operator competence", "CAT/Genny competence", "Manual handling", "CSCS (where required)"],
    mandatoryEvidence: ["Records search log", "Scan proof photo", "Marked utility plan", "MH/IC photo cards (where lifted)"],
    holdPoints: ["HP1 QL-D records review signed off", "HP2 EML/GPR validation on first utility", "HP3 CAD QC before issue"],
    defaultPas128Method: "M2",
  },
  topo_plus_utility_survey: {
    permitDependencies: ["Excavation / permit-to-dig", "Temporary traffic management approval"],
    requiredCerts: ["PAS 128 operator competence", "CAT/Genny competence", "Total station/GNSS competency"],
    mandatoryEvidence: ["Topo control check sheet", "Utility mark-up on topo base", "Combined CAD QC sign-off"],
    holdPoints: ["HP1 control network verified", "HP2 utility detection complete", "HP3 combined drawing QC"],
    defaultPas128Method: "M2P",
  },
  gpr_survey: {
    permitDependencies: ["Temporary traffic management (carriageway)", "Excavation interface (if verification)"],
    requiredCerts: ["GPR operator competence", "Chapter 8 / banksman awareness (vehicle array)"],
    mandatoryEvidence: ["Calibration plate check", "Raw GPR data archive", "Post-process interpretation report"],
    holdPoints: ["HP1 calibration hold point", "HP2 first anomaly cross-check", "HP3 deliverable issue QA"],
  },
  drainage_connectivity_survey: {
    permitDependencies: ["Traffic management (if highway)", "Confined space permit (if entry)"],
    requiredCerts: ["CAT/Genny competence", "Drainage connectivity / sonde tracing awareness"],
    mandatoryEvidence: ["Chamber detail record", "Sonde trace log", "Connectivity drawing extract"],
    holdPoints: ["HP1 chamber access safe", "HP2 first trace complete", "HP3 drawing QA before issue"],
  },
  service_clearance_survey: {
    permitDependencies: ["Excavation / permit-to-dig interface", "Ground disturbance permit (GI contractor)"],
    requiredCerts: ["PAS 128 / CAT-Genny competence", "GPR operator (where used)"],
    mandatoryEvidence: ["Clearance mark-up photo", "Records search note", "GI handover briefing record"],
    holdPoints: ["HP1 records and walkover complete", "HP2 clearance marks on ground", "HP3 GI contractor briefed"],
  },
  cctv_drainage_survey: {
    permitDependencies: ["Confined space permit (if entry)", "Traffic management approval"],
    requiredCerts: ["Confined space awareness", "Drainage CCTV operator competence"],
    mandatoryEvidence: ["Chamber barrier photo", "CCTV run reference", "Defect log extract"],
    holdPoints: ["HP1 chamber safety check", "HP2 CCTV run quality check", "HP3 reinstatement/handover complete"],
  },
  uav_aerial: {
    permitDependencies: ["Aerial survey coordination", "Landowner / airspace notification"],
    requiredCerts: ["CAA GVC or A2 CofC", "Manual handling", "CSCS (where required)"],
    mandatoryEvidence: ["Flight plan", "Pre-flight checklist", "GCP residual report"],
    holdPoints: ["HP1 airspace / weather go", "HP2 GCP survey complete", "HP3 processing QA before issue"],
  },
  laser_scanning: {
    permitDependencies: ["Work at height permit (as required)", "Traffic management (public realm)"],
    requiredCerts: ["TLS operator training", "Laser safety briefing"],
    mandatoryEvidence: ["Control network check", "Scan exclusion zone photo", "Registration RMS summary"],
    holdPoints: ["HP1 control verified", "HP2 scan session complete", "HP3 point cloud issue sign-off"],
  },
  eml_cat_survey: {
    permitDependencies: ["Excavation / permit-to-dig interface"],
    requiredCerts: ["CAT/Genny competence", "Manual handling"],
    mandatoryEvidence: ["Records search note", "EML mark-up photo", "Residual uncertainty statement issued"],
    holdPoints: ["HP1 records reviewed", "HP2 active/passive sweep complete", "HP3 marked outputs issued"],
  },
  gnss_control: {
    permitDependencies: ["Traffic management (as required)"],
    requiredCerts: ["GNSS/control survey competence"],
    mandatoryEvidence: ["Redundant observation log", "Post-processing residuals", "Control schedule issued"],
    holdPoints: ["HP1 control point locations agreed", "HP2 redundant observations captured", "HP3 residuals within spec"],
  },
  setting_out: {
    permitDependencies: ["Permit-to-work interface with trades on site (as required)"],
    requiredCerts: ["Total station/GNSS setting-out competence"],
    mandatoryEvidence: ["Control verification record", "Independent check on critical points", "As-built completion sheet"],
    holdPoints: ["HP1 control and drawing revision verified", "HP2 independent check before cover-up/pour", "HP3 as-built record issued"],
  },
  general_site_survey: {
    permitDependencies: ["Check project permit interface before start"],
    requiredCerts: ["Supervisor briefing completion", "Manual handling"],
    mandatoryEvidence: ["Task photos and notes", "Close-out handover record"],
    holdPoints: ["HP1 pre-start authorisation", "HP2 execution verification", "HP3 close-out confirmation"],
  },
  site_investigation_campaign: {
    permitDependencies: ["Excavation / permit-to-dig", "Ground disturbance permit", "Confined space / gas (as required)"],
    requiredCerts: ["GI supervisor competence", "CAT/Genny competence", "Ground gas awareness"],
    mandatoryEvidence: ["Master sample register", "Service clearance record", "Abandonment/reinstatement photos"],
    holdPoints: ["HP1 unified permit and contamination plan", "HP2 each intrusive hold point", "HP3 campaign close-out"],
  },
  asbestos_survey: {
    permitDependencies: ["Client asbestos register / management plan sign-off", "Permit-to-work interface with other trades (as required)"],
    requiredCerts: ["P402 (management survey) or P403/P405 (refurbishment/demolition survey) competence", "Asbestos awareness training"],
    mandatoryEvidence: ["Site plan with sampled/inspected locations", "Sample submission and UKAS lab results", "Draft asbestos register issued to client"],
    holdPoints: ["HP1 access and management plan agreed", "HP2 sampling/inspection complete", "HP3 register issued and client briefed"],
  },
};

const SURVEY_PACK_META_DEFAULT = {
  permitDependencies: ["Check project permit interface before start"],
  requiredCerts: ["Supervisor briefing completion", "Manual handling"],
  mandatoryEvidence: ["Task photos and notes", "Close-out handover record"],
  holdPoints: ["HP1 pre-start authorisation", "HP2 execution verification", "HP3 close-out confirmation"],
};

export function getSurveyPackMeta(surveyType) {
  const key = String(surveyType || "").trim();
  return { ...SURVEY_PACK_META_DEFAULT, ...(SURVEY_PACK_META[key] || {}) };
}

export function isUtilitySurveyType(surveyType) {
  return UTILITY_SURVEY_TYPES.has(String(surveyType || "").trim());
}

/** Deliverables prose for RAMS surveyDeliverables field. */
export function getSurveyDeliverablesProse(surveyType) {
  const entry = getSurveyCatalogEntry(surveyType);
  if (!entry?.defaultDeliverables?.length) {
    return "Survey report (PDF), marked drawings/CAD as per brief, RAMS issue record, and client handover briefing.";
  }
  return entry.defaultDeliverables.map((d) => d.description).join("; ") + ".";
}

/** Default assumptions for RAMS surveyAssumptions field. */
export function getSurveyAssumptionsProse(surveyType) {
  const type = String(surveyType || "").trim();
  if (type === "utility_mapping_survey" || type === "topo_plus_utility_survey") {
    return "Utility records available or desktop search complete before mobilisation; access to full survey extent confirmed; site induction completed; services assumed live unless confirmed otherwise.";
  }
  if (type === "service_clearance_survey") {
    return "GI intrusive locations and sequence agreed; records search complete; permit-to-dig interface with principal contractor confirmed.";
  }
  if (type === "drainage_connectivity_survey") {
    return "Chamber access agreed; drainage runs accessible for sonde insertion; adverse weather may limit chamber open time.";
  }
  if (type === "uav_aerial") {
    return "Airspace clear; weather within operator limits; GCP locations agreed and accessible; no overflight of restricted areas without approval.";
  }
  if (type === "asbestos_survey") {
    return "Client has confirmed the areas to be surveyed and any occupied/live areas requiring notice; a management survey does not include destructive investigation of concealed areas unless upgraded to a refurbishment/demolition survey.";
  }
  return "Access to survey extents confirmed; site induction completed; weather window suitable for agreed methods.";
}

/** Enrich survey report methodology with PAS 128 tolerance table for utility types. */
export function enrichMethodologyWithPas128(surveyType, methodology = "") {
  const base = String(methodology || "").trim();
  if (!isUtilitySurveyType(surveyType)) return base;
  const tolerance = formatPas128QlToleranceProse();
  if (base.includes("quality levels assigned")) return base;
  return base ? `${base}\n\n${tolerance}` : tolerance;
}

/** @typedef {import("../modules/surveyReport/surveyReportConstants").SURVEY_TYPES} SurveyTypes */

export const SURVEY_CATALOG = {
  utility_mapping_survey: {
    label: "PAS128 utility mapping survey",
    scope:
      "PAS 128 utility mapping survey of the agreed extent to locate known and unknown buried services, assign quality levels, and issue marked CAD/PDF outputs for safe design and construction.",
    methodology:
      "QL-D desktop records and drawing consultation, then QL-C site reconnaissance for surface features associated with buried services. QL-B mapping using EML (active Genny coupling and passive Power/Radio sweeps) and GPR at agreed PAS 128 M-series grid intervals. Manholes and inspection chambers lifted where safe to confirm connections and assist detection. Utility positions, depth and quality level recorded by GNSS or total station and issued on a topographical base plan after internal QA.",
    equipmentUsed:
      "RD8000 / CAT & Genny, GPR (site-appropriate array), GNSS rover or total station, gas monitor (surface/at chamber), chamber lifting keys, barriers/cones, biodegradable spray paint and site markers.",
    ramsScope:
      "PAS 128 QL-B utility mapping survey — QL-D/C/B workflow, EML and GPR detection, chamber lifting where safe, quality-level assignment and marked deliverables for safe dig.",
    ramsMethod:
      "1. Pre-project meeting: agree survey extent, M-series grid interval (M1 5 m / M2 2 m / M3 1 m / M4 0.5 m), hold points and interface hazards.\n\n2. QL-D: desktop utility records and drawing consultation; log gaps.\n\n3. QL-C: site walkover — note surface identifiers (covers, stop valves, cable risers, lamp posts).\n\n4. Before chamber access: cordon local work area; monitor atmosphere at cover prior to and during opening; keep open chambers supervised; reinstate covers when complete.\n\n5. EML: couple Genny at surface identifiers; induce known routes; passive Power and Radio sweeps for unknowns.\n\n6. GPR: systematic grid at agreed interval; confirm EML routes; post-process data off site where specified.\n\n7. Assign PAS 128 quality levels (B1 ±150 mm H / ±15% depth through B4 indicative) and mark on ground.\n\n8. Record positions and depths with GNSS/total station; produce checked CAD/PDF; brief site on residual uncertainty and safe dig rules.",
    hazardTokens: ["utility", "buried", "open chamber", "manhole", "pedestrian", "traffic", "electrical", "slips", "trip", "manual", "gas", "chapter 8"],
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "services_live", "records_not_available"],
    recordsBoilerplate:
      "Desktop utility records search (DBYD / LSBUD / statutory undertakers) correlated with site reconnaissance. Gaps in records are noted in Limitations.",
    executiveSummaryTemplate:
      "A PAS 128 utility mapping survey was undertaken at {site} on {date}. Detection methods and quality level are stated in this report. Residual uncertainty and safe dig rules apply until services are verified on site.",
    recommendationsTemplate:
      "Mechanical excavation should only proceed in accordance with marked utilities, hand-dig tolerance zones and the linked permit-to-dig. Re-scan after first spoil where PAS 128 requires.",
    defaultDeliverables: [
      mkDel("report_pdf", "Survey report (PDF)"),
      mkDel("pdf_drawing", "Utility mark-up drawing"),
      mkDel("dwg", "CAD drawing (if in brief)", "On request"),
    ],
  },
  gpr_survey: {
    label: "GPR / multi-array survey",
    scope:
      "Multi-channel GPR survey over the agreed extent to detect utilities, voids and subsurface structures — pedestrian arrays on footways and vehicle-mounted arrays on carriageways where specified.",
    methodology:
      "GPR acquisition with calibrated depth scale, positioned by GNSS/IMU and/or total station. Real-time on-site review plus post-processing off site to identify anomalies not visible live. Processed data georeferenced and overlaid on utility or topographical base plans; amplitude changes mapped at material boundaries.",
    equipmentUsed:
      "Multi-array GPR (pedestrian and/or vehicle-mounted), GNSS/IMU positioning, total station for control, processing and interpretation software.",
    ramsScope:
      "Multi-array GPR data collection and post-processing — calibrated setup, traffic segregation, GNSS/IMU positioning and georeferenced deliverables with stated confidence limits.",
    ramsMethod:
      "1. Pre-start: environmental checks, calibration plate check and equipment service status.\n\n2. Define scan grid/routes; segregate footway work from pedestrians; vehicle scans only with approved TM/Chapter 8 controls on live carriageways.\n\n3. Collect data at agreed line spacing and speed; log raw data for post-processing.\n\n4. Cross-check anomalies with additional passes and available utility records.\n\n5. Post-process off site; georeference features; issue CAD/report with void/separation interpretation and residual uncertainty.",
    hazardTokens: ["traffic", "pedestrian", "moving plant", "electrical", "buried services", "slips", "trip", "adverse weather", "pavement", "3d gpr", "carriageway", "chapter 8", "banksman"],
    defaultPas128Ql: "B2",
    defaultLimitationKeys: ["gpr_depth_limit", "weather_impact"],
    recordsBoilerplate: "Utility records and prior survey data reviewed where supplied by the client.",
    executiveSummaryTemplate: "GPR survey completed over {site} on {date}. Depth calibration and coverage limits are documented; anomalies require verification before intrusive works.",
    recommendationsTemplate: "Treat GPR anomalies as indicative until verified by hand exposure or secondary technique.",
    defaultDeliverables: [
      mkDel("report_pdf", "Survey report (PDF)"),
      mkDel("pdf_drawing", "GPR interpretation drawing"),
      mkDel("dwg", "CAD / DXF export (if in brief)", "On request"),
    ],
  },
  eml_cat_survey: {
    label: "EML / CAT & Genny survey",
    scope:
      "Electromagnetic location (EML/CAT) survey to identify indicative buried services within the agreed extent using active and passive detection modes.",
    methodology:
      "Identify surface identifiers (covers, valves, risers) for Genny coupling. Active induction on known routes; passive Power and Radio sweeps across the extent. Findings marked on site and transferred to deliverable drawing with EML limitations clearly stated.",
    equipmentUsed: "CAT & Genny / RD8000 class locator, induction clamps and signal emitter, site drawing or GNSS pegging.",
    ramsScope: "EML/CAT utility detection — active Genny coupling, passive sweeps, marked indicative outputs and safe dig briefing.",
    ramsMethod:
      "1. Brief team on EML limitations, Genny coupling and assumed-live services.\n\n2. Identify surface identifiers and couple Genny; induce known utility routes.\n\n3. Passive Power and Radio sweeps for possible unknown services.\n\n4. Mark indicative lines on ground and drawing; record no-access and weak-signal areas.\n\n5. Hand over with residual uncertainty statement and hand-dig tolerance guidance.",
    hazardTokens: ["utility", "buried", "traffic", "pedestrian", "electrical", "slips", "trip", "manhole"],
    defaultPas128Ql: "B2",
    defaultLimitationKeys: ["eml_confidence", "services_live"],
    recordsBoilerplate: "Statutory undertaker records requested; outcomes recorded in Records Review.",
    executiveSummaryTemplate: "EML/CAT survey at {site} on {date}. Findings are indicative — verification required before mechanical dig.",
    recommendationsTemplate: "Maintain 0.5 m hand-dig buffer each side of marked lines unless Type A verification is available.",
    defaultDeliverables: [mkDel("report_pdf", "Survey report (PDF)"), mkDel("pdf_drawing", "EML mark-up drawing")],
  },
  topographical_survey: {
    label: "Topographical land survey",
    scope:
      "Topographical land survey of structures, boundaries, levels, services markers and site features for design development.",
    methodology:
      "Establish or verify control tied to OSGB36 / project grid. Feature and level capture by robotic total station or GNSS with independent closure checks. Structures, boundaries, ground surfaces, street furniture and utility surface features captured to agreed detail level.",
    equipmentUsed: "Robotic total station, GNSS rover, data logger, control targets.",
    ramsScope:
      "Topographical land survey — control establishment, feature/level capture, QA closure checks and checked CAD/PDF issue.",
    ramsMethod:
      "1. Pre-project meeting: agree extent, detail level and control datum.\n\n2. Set or verify control points and benchmark before data capture.\n\n3. Establish safe routes around plant, traffic and public interfaces.\n\n4. Capture topo features with calibrated equipment; repeat checks on critical points.\n\n5. Perform traverse/level closure QA; produce checked drawing for issue.",
    hazardTokens: ["uneven ground", "slips", "trip", "adverse weather", "moving plant", "lone working", "work at height", "manual handling", "traffic", "pedestrian"],
    defaultLimitationKeys: ["vegetation_obstruction", "site_access_restricted"],
    recordsBoilerplate: "Boundary and topographic context taken from client issue drawings and OS mapping where applicable.",
    executiveSummaryTemplate: "Topographical survey of {site} completed {date}. Control and accuracy statement included.",
    recommendationsTemplate: "Use issued drawing revision for setting out; re-establish control if site layout changes.",
    defaultDeliverables: [mkDel("report_pdf", "Survey report (PDF)"), mkDel("pdf_drawing", "Topographical survey drawing")],
  },
  topo_plus_utility_survey: {
    label: "Topographical + PAS128 utility survey",
    scope:
      "Combined topographical land survey and PAS 128 utility mapping over the agreed extent — single control framework, topo base plan with utility overlay, and unified CAD/PDF deliverables.",
    methodology:
      "Establish survey control tied to OSGB36 / project grid. Capture topographical features, levels and surface utility identifiers. Undertake PAS 128 QL-D/C/B utility mapping (EML + GPR at agreed M-series interval) with MH/IC lifting where safe. Record utility positions and QL on the topo base; issue combined 2D/3D CAD and PDF after internal QA.",
    equipmentUsed:
      "Robotic total station, GNSS rover, RD8000 / CAT & Genny, GPR, gas monitor (surface), chamber keys, barriers, biodegradable paint.",
    ramsScope:
      "Combined topo + PAS 128 QL-B utility survey — shared control, topo capture, utility detection, QL assignment and combined drawing issue.",
    ramsMethod:
      "1. Pre-project meeting: agree extent, topo detail level, M-series interval and hold points.\n\n2. Establish/verify control network and topo capture of site features.\n\n3. QL-D/C utility records and walkover; mark surface identifiers.\n\n4. EML + GPR utility detection; lift MH/IC where safe with surface gas monitoring.\n\n5. Assign PAS 128 QL (B1–B4); record utilities on topo base.\n\n6. Combined CAD/PDF QC and handover with safe dig rules.",
    hazardTokens: ["utility", "buried", "topo", "manhole", "open chamber", "traffic", "pedestrian", "electrical", "slips", "trip", "manual", "gas"],
    defaultPas128Ql: "B1",
    defaultLimitationKeys: ["eml_confidence", "services_live", "records_not_available", "vegetation_obstruction"],
    recordsBoilerplate:
      "Desktop utility records (LSBUD / statutory undertakers) and topo context from OS mapping reviewed; gaps recorded in Limitations.",
    executiveSummaryTemplate:
      "Combined topographical and PAS 128 utility mapping survey at {site} on {date}. Topo and utility deliverables issued on a common control framework with stated quality levels and residual uncertainty.",
    recommendationsTemplate:
      "Use the combined drawing revision for design; maintain hand-dig tolerance zones and permit-to-dig before any intrusive works.",
    defaultDeliverables: [
      mkDel("report_pdf", "Survey report (PDF)"),
      mkDel("pdf_drawing", "Combined topo + utility drawing (PDF)"),
      mkDel("dwg", "Combined CAD drawing (DWG/DXF)", "On request"),
    ],
  },
  general_site_survey: {
    label: "General site survey",
    scope: "General site survey and factual reporting of conditions and features within the agreed extent.",
    methodology: "Site visit, measurement and recording using methods appropriate to the brief and site constraints.",
    equipmentUsed: "As per method statement and site conditions.",
    defaultLimitationKeys: ["site_access_restricted"],
    executiveSummaryTemplate: "General site survey at {site} on {date} per client brief.",
    defaultDeliverables: [mkDel("report_pdf", "Survey report (PDF)")],
  },
  cctv_drainage_survey: {
    label: "CCTV drainage survey",
    scope:
      "CCTV drainage survey of accessible runs within the agreed extent — chamber access, crawler deployment, defect coding and reinstatement.",
    methodology:
      "Manholes lifted with local barriers/cones. Chamber condition inspected from surface; CCTV crawler deployed with distance/direction logging. Footage reviewed for defects coded to specification. Covers reinstated to original position; stuck or damaged covers recorded.",
    equipmentUsed:
      "CCTV crawler (mini/mainline as appropriate), winch, chamber lifting keys, barriers/cones, gas monitor (surface), recording unit.",
    ramsScope:
      "Drainage CCTV survey — controlled chamber access, surface-level inspection, crawler deployment, defect logging and reinstatement.",
    ramsMethod:
      "1. Confirm permit interfaces and confined-space boundary (surface work only unless entry permit issued).\n\n2. Cordon chamber; lift cover with keys/tools; monitor atmosphere at cover while open.\n\n3. Inspect chamber from surface; deploy crawler with tether and comms.\n\n4. Log defects, obstructions and chainage; note inaccessible or blocked runs.\n\n5. Reinstate cover; remove barriers; complete close-out contamination check.",
    hazardTokens: ["cctv", "manhole", "chamber", "confined", "traffic", "slips", "contamination", "gas", "public"],
    defaultLimitationKeys: ["site_access_restricted", "services_live"],
    defaultDeliverables: [
      mkDel("report_pdf", "Survey report (PDF)"),
      mkDel("cctv_footage", "CCTV footage and log", "Issued with report", "—"),
    ],
  },
  gnss_control: {
    label: "GNSS / control survey",
    scope: "GNSS control survey to establish or verify primary control for the project grid / OSGB36 as agreed.",
    methodology:
      "Static or RTK observations on agreed control points with redundancy checks. Post-processing against OS network or project datum; residuals recorded and issued with control schedule.",
    equipmentUsed: "Dual-frequency GNSS receiver, tribrach, control targets, processing software.",
    ramsScope: "GNSS / control survey — redundant observations, post-processing QA and issued control schedule.",
    ramsMethod:
      "1. Agree control point locations and observation window.\n\n2. Set tripods/targets safely away from traffic/plant interfaces.\n\n3. Capture redundant GNSS observations; log occupation times and metadata.\n\n4. Post-process and check residuals against specification.\n\n5. Issue control schedule with coordinates, heights and accuracy statement.",
    hazardTokens: ["traffic", "pedestrian", "uneven ground", "lone working", "tripod"],
    defaultDeliverables: [mkDel("report_pdf", "Control report (PDF)"), mkDel("other", "Control point schedule")],
  },
  laser_scanning: {
    label: "Laser scanning / point cloud",
    scope:
      "Terrestrial laser scanning to capture a georeferenced point cloud of the agreed extent for measured survey, digital twin or BIM workflows.",
    methodology:
      "Scan positions planned for coverage and overlap; control network verified before each epoch. Active scan exclusion zones cordoned with warning signage. Data registered, cleaned and issued with accuracy/coverage statement.",
    equipmentUsed: "Terrestrial laser scanner (TLS), targets/checkerboards, GNSS/total station for registration, point cloud registration and modelling software.",
    ramsScope:
      "Terrestrial laser scanning — laser safety exclusion, control verification, scan capture and registered point cloud issue.",
    ramsMethod:
      "1. Laser safety briefing; cordon scan exclusion zone with signage.\n\n2. Verify control network before scan session.\n\n3. Capture scans with planned overlap; manage tripod/cable trip hazards.\n\n4. Register point cloud; QA density and registration RMS.\n\n5. Issue point cloud / 2D extracts / mesh with coordinate metadata and registration report.",
    hazardTokens: ["laser", "scan", "tls", "point cloud", "traffic", "tripod", "work at height", "pedestrian", "digital twin", "bim", "registration", "mesh"],
    defaultDeliverables: [
      mkDel("report_pdf", "Survey report (PDF)"),
      mkDel("other", "Point cloud dataset", "On request"),
    ],
  },
  uav_aerial: {
    label: "UAV / aerial survey",
    scope:
      "UAV aerial survey for georeferenced orthoimagery, DSM, colourised point cloud and/or multispectral outputs tied to OSGB36 via ground control.",
    methodology:
      "Pre-flight checks, airspace/NOTAM review and RAMS brief. Capture using enterprise UAV (or helicopter/fixed-wing platform for large corridor LiDAR campaigns, where specified) with RGB and/or LiDAR payload; GCPs or RTK/PPK positioning. Processing QA on GCP residuals, coverage and weather limits.",
    equipmentUsed: "UAV platform (RGB/LiDAR/multispectral as specified) or manned aircraft for corridor LiDAR/photomapping, RTK/PPK module, ground control targets, photogrammetry/LiDAR processing software.",
    ramsScope:
      "UAV / aerial mapping — CAA-compliant flight planning, ground exclusion, GCP/RTK control and ortho/DSM/point-cloud deliverables. Covers UAV, helicopter and fixed-wing corridor capture.",
    ramsMethod:
      "1. Pre-flight: airspace assessment, NOTAM/CAA coordination, weather within limits, take-off/landing zone secured, landowner notification for corridor routes.\n\n2. Lay and survey GCPs; brief ground crew on exclusion under flight path and downwash hazards.\n\n3. Execute flight lines per plan; visual observer / pilot-survey lead comms maintained throughout.\n\n4. Process data; boresight/calibration QA; check GCP/PPK residuals and coverage gaps.\n\n5. Issue ortho, DSM and/or colourised point cloud/LiDAR with accuracy metadata.",
    hazardTokens: ["uav", "drone", "flight", "pedestrian", "high_wind", "aerial", "lidar", "photomapping", "helicopter", "fixed-wing", "downwash", "notam"],
    defaultLimitationKeys: ["weather_impact", "site_access_restricted"],
    defaultDeliverables: [
      mkDel("report_pdf", "Flight / survey report (PDF)"),
      mkDel("other", "Ortho / DSM deliverable", "On request"),
    ],
  },
  setting_out: {
    label: "Setting out / engineering survey",
    scope: "Engineering setting out of design elements from issued drawings within the agreed tolerance and hold points.",
    methodology:
      "Control verified from project grid; setting out from latest revision drawings with independent check on critical points. As-built dimensions recorded and issued on completion sheets.",
    equipmentUsed: "Robotic total station or GNSS rover, design drawings, setting-out record sheets.",
    ramsScope: "Engineering setting out — verified control, latest drawing revision, independent checks and as-built records.",
    ramsMethod:
      "1. Verify control and latest issued drawing revision.\n\n2. Brief team on traffic/plant interfaces and hold points.\n\n3. Set out elements within specified tolerances.\n\n4. Independent check on critical points before cover-up or pour.\n\n5. Record as-built dimensions on completion sheets.",
    hazardTokens: ["traffic", "moving plant", "pedestrian", "work at height"],
    defaultDeliverables: [mkDel("report_pdf", "Setting-out record (PDF)")],
  },
  drainage_connectivity_survey: {
    label: "Drainage connectivity survey",
    scope:
      "Drainage connectivity survey to establish pipe routes between chambers using sonde insertion, duct rods and surface EML location.",
    methodology:
      "Manholes lifted to record chamber extents, pipe diameter and invert levels. Sonde inserted via duct rod and tracked from surface along pipe until next chamber, blockage or logical end point. Routes repeated for remaining connections; positions recorded by GNSS/total station and issued on topo base plan.",
    equipmentUsed: "Sonde and duct rods, EML locator, chamber keys, barriers/cones, GNSS/total station, gas monitor (surface).",
    ramsScope:
      "Drainage connectivity survey — chamber lifting, sonde tracing, surface EML tracking and CAD connectivity drawing.",
    ramsMethod:
      "1. Pre-project meeting: agree chamber list, tracing sequence and traffic/public controls.\n\n2. Cordon chamber; lift cover; record chamber details and inverts from surface.\n\n3. Insert sonde via duct rod; track route from surface with EML until end point or obstruction.\n\n4. Withdraw sonde; repeat for remaining connections; note blockages/defects.\n\n5. Survey MH positions and pipe routes; produce checked connectivity drawing.",
    hazardTokens: ["drainage", "manhole", "chamber", "sonde", "traffic", "slips", "contamination", "public", "utility"],
    defaultLimitationKeys: ["site_access_restricted", "services_live"],
    recordsBoilerplate: "Existing drainage records reviewed where supplied; connectivity confirmed by sonde trace on site.",
    executiveSummaryTemplate:
      "Drainage connectivity survey at {site} on {date}. Routes traced by sonde where accessible; blockages and inaccessible connections noted in Limitations.",
    recommendationsTemplate: "Verify connectivity by CCTV or additional tracing before design reliance on inferred routes.",
    defaultDeliverables: [
      mkDel("report_pdf", "Connectivity survey report (PDF)"),
      mkDel("pdf_drawing", "Drainage connectivity drawing"),
      mkDel("dwg", "CAD connectivity drawing (if in brief)", "On request"),
    ],
  },
  service_clearance_survey: {
    label: "Service clearance (pre-GI / intrusive)",
    scope:
      "Targeted utility clearance survey around proposed boreholes, trial pits or probe positions — mark known and unknown services before intrusive ground investigation.",
    methodology:
      "PAS 128-style detection concentrated on clearance zones: QL-D records, QL-C walkover, EML (active/passive) and GPR grids at agreed intervals around each intrusive location. Services marked on ground with biodegradable paint; chamber lifting where required to assist detection.",
    equipmentUsed: "CAT & Genny, GPR, GNSS/total station, biodegradable spray paint, chamber keys, barriers, gas monitor (surface).",
    ramsScope:
      "Service clearance for boreholes and trial pits — focused utility detection, ground marking and handover before intrusive GI.",
    ramsMethod:
      "1. Agree clearance zones per borehole/trial pit from GI layout.\n\n2. QL-D records and QL-C walkover for each zone.\n\n3. EML and GPR at agreed grid interval within clearance corridors.\n\n4. Mark services on ground; photograph and record positions.\n\n5. Brief GI contractor on marked routes, tolerance zones and permit-to-dig interface.",
    hazardTokens: ["utility", "buried", "trial pit", "borehole", "open chamber", "manhole", "permit-to-dig", "ground investigation", "electrical"],
    defaultPas128Ql: "B2",
    defaultLimitationKeys: ["eml_confidence", "services_live", "records_not_available"],
    recordsBoilerplate: "Utility records reviewed for clearance zones; gaps flagged before intrusive works proceed.",
    executiveSummaryTemplate:
      "Service clearance survey at {site} on {date} for proposed intrusive locations. Marked outputs issued for permit-to-dig — verification before each hole remains mandatory.",
    recommendationsTemplate: "Do not commence intrusive works until clearance marks are verified on site and permit-to-dig is active for each location.",
    defaultDeliverables: [
      mkDel("report_pdf", "Clearance report (PDF)"),
      mkDel("pdf_drawing", "Clearance mark-up / location plan"),
    ],
  },
  site_investigation_campaign: {
    label: "Site investigation & geotechnics",
    scope:
      "Ground investigation campaign over the agreed extent — trial pits, window sampling, dynamic probing, boreholes, in-situ testing and monitoring wells — to inform geotechnical and environmental design.",
    methodology:
      "Desk study and contamination/gas assessment reviewed before mobilisation. Intrusive methods executed in agreed sequence with permit-to-dig and ground disturbance controls. Samples logged with chain of custody; boreholes abandoned or monitoring wells installed per specification. Factual logs and sample register issued for interpretation.",
    equipmentUsed:
      "Window sampler / mini excavator, DCP/dynamic probe kit, drilling rig (cable percussive/rotary as specified), hand auger, U100/piston samplers, gas monitor, sample tubes and chain-of-custody forms.",
    ramsScope:
      "Combined ground investigation programme — trial pits, window sampling, probing, boreholes, in-situ testing, monitoring wells — with unified permit interface and contamination/gas plan.",
    ramsMethod:
      "1. Review GI specification, desk study, and contamination/gas assessment; agree sequence of methods.\n\n2. Mobilise with unified permit-to-dig and ground disturbance controls; daily briefing on hold points.\n\n3. Execute intrusive methods in agreed order — minimise reopening and cross-contamination.\n\n4. Maintain master sample register and chain-of-custody across all methods.\n\n5. Complete all borehole abandonments and pit reinstatements; issue GI factual report inputs.",
    hazardTokens: ["site investigation", "ground investigation", "trial pit", "borehole", "dynamic probe", "contamination", "ground gas", "sample"],
    defaultLimitationKeys: ["site_access_restricted", "services_live", "weather_impact"],
    recordsBoilerplate: "Desk study, contamination assessment and utility records reviewed before intrusive works.",
    executiveSummaryTemplate: "Ground investigation at {site} on {date}. Factual logs and sample register issued for interpretation by others.",
    recommendationsTemplate: "Intrusive locations require permit-to-dig and utility clearance before each hole.",
    defaultDeliverables: [
      mkDel("report_pdf", "GI factual report (PDF)"),
      mkDel("pdf_drawing", "Borehole / trial pit location plan"),
      mkDel("report_pdf", "Borehole logs & sample register", "Issued with report", "—"),
      mkDel("other", "Chain-of-custody forms", "Issued with report", "—"),
    ],
  },
  asbestos_survey: {
    label: "Asbestos survey (management / refurbishment / demolition)",
    scope:
      "Asbestos survey of the agreed extent to identify, sample and record asbestos-containing materials (ACMs), assess material and priority risk, and issue an asbestos register and management recommendations in accordance with HSG264.",
    methodology:
      "Survey type agreed with client before mobilisation — management survey (non-destructive, minor intrusion) or refurbishment/demolition survey (fully intrusive, destructive access to concealed areas, area vacated). Systematic room-by-room / area-by-area inspection; suspect materials identified by product type and description. Representative samples taken by a competent sampler and submitted to a UKAS-accredited laboratory for analysis, or materials presumed/strongly presumed where sampling is not undertaken. Material and priority risk assessment applied per HSG264 algorithm. Findings issued as an asbestos register with photographs, sample results and management recommendations (remove / encapsulate / manage in place / monitor).",
    equipmentUsed:
      "Sampling kit (bagging, water spray, disposable tools), FFP3 respirator and disposable coveralls, torch/borescope for voids, camera, asbestos sample bags and chain-of-custody forms, moisture/damage assessment tools.",
    ramsScope:
      "Asbestos survey (management or refurbishment/demolition) — systematic inspection, representative sampling by competent sampler, and risk-assessed asbestos register issue in accordance with CAR 2012 / HSG264.",
    ramsMethod:
      "1. Confirm survey type with client (management vs refurbishment/demolition) and agree access, occupied-area notice periods and any areas excluded from scope.\n\n2. Review any existing asbestos register / previous survey data before mobilisation.\n\n3. Systematic room-by-room inspection; identify suspect ACMs by product type, extent and condition; photograph each item.\n\n4. Take representative samples only where required — minimise disturbance, wet materials before sampling, seal sample point, double-bag and label sample for UKAS-accredited laboratory analysis. Presume asbestos in concealed/inaccessible areas unless the survey is upgraded to intrusive access.\n\n5. Apply HSG264 material and priority risk assessment to each item; assign a risk rating and recommendation (remove / encapsulate / manage in place / monitor / further investigation).\n\n6. Decontaminate tools and dispose of any waste as asbestos waste; issue draft register for QA before client issue.",
    hazardTokens: ["asbestos survey", "acms", "non-licensed asbestos", "asb_001", "asb_002"],
    defaultLimitationKeys: ["asbestos_concealed_areas", "site_access_restricted"],
    recordsBoilerplate:
      "Any existing asbestos register, previous survey reports or refurbishment records reviewed where supplied by the client before mobilisation.",
    executiveSummaryTemplate:
      "An asbestos survey was undertaken at {site} on {date} in accordance with HSG264. Suspect materials were identified, sampled or presumed as stated in this report, and risk-assessed to produce the asbestos register and management recommendations below.",
    recommendationsTemplate:
      "Update the site asbestos register with this survey and communicate to all contractors before any intrusive works. Materials assessed as high risk or scheduled for removal should be actioned before works proceed in the affected area. Concealed areas not accessed remain presumed to contain asbestos until a refurbishment/demolition survey is undertaken.",
    defaultDeliverables: [
      mkDel("report_pdf", "Asbestos survey report (PDF)"),
      mkDel("other", "Asbestos register (with photographs and sample results)"),
      mkDel("pdf_drawing", "Marked-up floor plan of sampled/inspected locations", "On request"),
    ],
  },
  window_sampling_trial_pit: {
    label: "Window sampling / trial pit",
    scope:
      "Ground investigation by window sampling (tracked windowless sampler) and/or trial pits — service avoidance, pit stability, contamination pathways, sample chain of custody, and reinstatement.",
    ramsMethod:
      "1. Desk study, utility records, and CAT/Genny sweep; agree sample locations with client/engineer.\n\n2. Issue permit-to-dig / ground disturbance; mark exclusion zones and no-go lines.\n\n3. Window sampling: deploy tracked sampler with banksman; step/shore hole if depth exceeds safe angle.\n\n4. Trial pit option: machine strip to safe depth then hand-finish; log face, photograph strata, bag/label samples on site.\n\n5. Complete chain-of-custody forms; backfill in layers, compact, reinstate surface.",
    hazardTokens: ["window sampling", "trial pit", "ground", "excavation", "plant", "buried", "sample", "contamination"],
    playbookOnly: true,
  },
  dcp_dynamic_probe: {
    label: "Dynamic probing / DCP",
    scope: "In-situ dynamic probing and dynamic cone penetrometer (DCP) testing — manual handling of drive rods, utility clearance, blow-count recording, and hole capping.",
    ramsMethod:
      "1. Locate utilities and agree probe positions; obtain ground disturbance permit where required.\n\n2. Set exclusion zone on carriageway or soft ground; Chapter 8 TM if on live highway.\n\n3. Assemble drive rods and hammer; two-person lift for heavy sections; stop on refusal or unexpected contact.\n\n4. Record blow counts vs depth at defined intervals; photograph/log refusal layers.\n\n5. Withdraw rods, cap probe holes, and decontaminate equipment between contaminated locations.",
    hazardTokens: ["dynamic probe", "dcp", "penetrometer", "ground investigation"],
    playbookOnly: true,
  },
};

/** Legacy export — scope / methodology / equipment only. */
export const SURVEY_TYPE_TEMPLATES = Object.fromEntries(
  Object.entries(SURVEY_CATALOG)
    .filter(([, v]) => !v.playbookOnly)
    .map(([key, v]) => [
      key,
      {
        scope: v.scope,
        methodology: v.methodology,
        equipmentUsed: v.equipmentUsed,
      },
    ])
);

export function getSurveyCatalogEntry(surveyType) {
  const key = String(surveyType || "").trim();
  return key ? SURVEY_CATALOG[key] || null : null;
}

export function getPlaybookSurveyPack(key) {
  const entry = getSurveyCatalogEntry(key);
  if (!entry) return null;
  const coreMethod = entry.ramsMethod || entry.methodology || "";
  const meta = getSurveyPackMeta(key);
  return {
    label: entry.label || key,
    scope: entry.ramsScope || entry.scope || "",
    method: buildSurveyRamsMethod(coreMethod),
    hazardTokens: entry.hazardTokens || [],
    ramsCommon: SURVEY_RAMS_COMMON,
    packMeta: meta,
    defaultPas128Method: meta.defaultPas128Method || entry.defaultPas128Method || "",
  };
}

/** Merge RAMS pack rows with catalog prose where keys match. */
export function mergeRamsPackFromCatalog(pack) {
  if (!pack?.key) return pack;
  const entry = getSurveyCatalogEntry(pack.key);
  if (!entry) return pack;
  const coreMethod = entry.ramsMethod || pack.method || entry.methodology || "";
  return {
    ...pack,
    label: entry.label || pack.label,
    scope: entry.ramsScope || entry.scope || pack.scope,
    method: buildSurveyRamsMethod(coreMethod),
    hazardTokens: entry.hazardTokens || pack.hazardTokens,
  };
}

export function catalogDefaultDeliverables(surveyType) {
  const entry = getSurveyCatalogEntry(surveyType);
  if (!entry?.defaultDeliverables?.length) return null;
  const ts = Date.now();
  return entry.defaultDeliverables.map((row, i) => ({
    ...row,
    id: `del_${ts}_${i}_${Math.random().toString(36).slice(2, 5)}`,
  }));
}

export function isSurveySimpleMode(org) {
  const o = org && typeof org === "object" ? org : {};
  return o.surveySimpleMode !== false;
}
