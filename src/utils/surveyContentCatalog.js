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

/** @typedef {import("../modules/surveyReport/surveyReportConstants").SURVEY_TYPES} SurveyTypes */

export const SURVEY_CATALOG = {
  utility_mapping_survey: {
    label: "PAS128 utility mapping survey",
    scope:
      "Utility mapping survey of the agreed site extent to locate and chart buried services for design and construction planning. Deliverables as per client brief and PAS 128 classification where applicable.",
    methodology:
      "Desktop records review followed by site reconnaissance. Detection using EML/CAT and Genny in active and passive modes, supplemented by GPR where ground conditions allow. Survey control tied to OSGB36 / site grid as agreed. QA includes mark-up review and client handover briefing.",
    equipmentUsed: "RD8000 / cable locator, GPR (site-appropriate array), GNSS rover or total station, spray paint and site markers.",
    ramsScope:
      "PAS128 QLB utility mapping survey to locate and record underground utility apparatus, reduce strike risk, and issue marked outputs for safe delivery.",
    ramsMethod:
      "1. Pre-start briefing and permit checks before entering survey area.\n\n2. Confirm utility records, walkover hazards, and exclusion zones.\n\n3. Detect utilities using EML and GPR methods with competent operators.\n\n4. Mark detected services and maintain safe dig rules near marked lines.\n\n5. Record survey control and quality checks before issue.\n\n6. Communicate residual risk and handover notes to site management.",
    hazardTokens: ["utility", "buried", "open chamber", "manhole", "pedestrian", "traffic", "electrical", "slips", "trip", "manual"],
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
    scope: "Ground penetrating radar survey over the agreed extent to identify shallow anomalies, services and structural features.",
    methodology:
      "Grid or route-based GPR acquisition with calibrated depth scale. Data reviewed on-site for obvious anomalies; post-processing and interpretation aligned to client deliverable format.",
    equipmentUsed: "Multi-channel or single-frequency GPR, GNSS/total station for geo-referencing, processing software.",
    ramsScope:
      "GPR survey for utility and subsurface detection, with controlled site setup, verified calibration and clear communication of confidence/residual uncertainty.",
    ramsMethod:
      "1. Complete pre-start checks, environmental checks and calibration of GPR equipment.\n\n2. Define scan grid and segregate work area from traffic/pedestrian routes.\n\n3. Conduct scan passes at agreed spacing and speed.\n\n4. Validate anomalies with additional passes and cross-check with records.\n\n5. Mark findings and issue interpretation notes including confidence limits.",
    hazardTokens: ["traffic", "pedestrian", "moving plant", "electrical", "buried services", "slips", "trip", "adverse weather"],
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
    scope: "Electromagnetic location (EML/CAT) survey to identify indicative buried services within the agreed extent.",
    methodology:
      "Systematic sweeps in Power, Radio and Genny modes where access permits. Findings marked on site and transferred to deliverable drawing; limitations of EML noted in report.",
    equipmentUsed: "CAT & Genny / RD8000 class locator, site drawing or GNSS pegging.",
    ramsScope: "EML/CAT utility detection survey with marked outputs and safe dig briefing.",
    ramsMethod:
      "1. Brief team on EML limitations and Genny coupling requirements.\n\n2. Sweep agreed extent in Power, Radio and Genny modes.\n\n3. Mark indicative service lines on ground and drawing.\n\n4. Record areas of no access or weak signal.\n\n5. Hand over with residual uncertainty statement.",
    hazardTokens: ["utility", "buried", "traffic", "pedestrian", "electrical", "slips", "trip"],
    defaultPas128Ql: "B2",
    defaultLimitationKeys: ["eml_confidence", "services_live"],
    recordsBoilerplate: "Statutory undertaker records requested; outcomes recorded in Records Review.",
    executiveSummaryTemplate: "EML/CAT survey at {site} on {date}. Findings are indicative — verification required before mechanical dig.",
    recommendationsTemplate: "Maintain 0.5 m hand-dig buffer each side of marked lines unless Type A verification is available.",
    defaultDeliverables: [mkDel("report_pdf", "Survey report (PDF)"), mkDel("pdf_drawing", "EML mark-up drawing")],
  },
  topographical_survey: {
    label: "Topographical land survey",
    scope: "Topographical survey of site features, levels and boundaries for design development.",
    methodology:
      "Establish control network; feature and level capture by total station or GNSS with independent checks on closed traverses or redundant observations where specified.",
    equipmentUsed: "Robotic total station, GNSS rover, data logger.",
    ramsScope: "Topographical survey to capture levels, boundaries, structures and site features with agreed survey control and QA checks.",
    ramsMethod:
      "1. Set control points and verify datum/benchmark before data capture.\n\n2. Establish safe working routes around plant movement and public interfaces.\n\n3. Capture topo features with calibrated survey equipment.\n\n4. Perform repeat checks and closure checks to validate accuracy.\n\n5. Securely store field data and produce checked outputs for issue.",
    hazardTokens: ["uneven ground", "slips", "trip", "adverse weather", "moving plant", "lone working", "work at height", "manual handling"],
    defaultLimitationKeys: ["vegetation_obstruction", "site_access_restricted"],
    recordsBoilerplate: "Boundary and topographic context taken from client issue drawings and OS mapping where applicable.",
    executiveSummaryTemplate: "Topographical survey of {site} completed {date}. Control and accuracy statement included.",
    recommendationsTemplate: "Use issued drawing revision for setting out; re-establish control if site layout changes.",
    defaultDeliverables: [mkDel("report_pdf", "Survey report (PDF)"), mkDel("pdf_drawing", "Topographical survey drawing")],
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
    scope: "CCTV drainage survey of accessible drainage runs within the agreed extent to record condition, connectivity and defects.",
    methodology:
      "Access points identified on site; crawler deployed with full distance and direction logging. Footage reviewed on site for obvious defects; observations coded to client specification. Cleansing or jetting only where agreed in RAMS.",
    equipmentUsed: "CCTV crawler (mini/mainline as appropriate), winch, sonde/locator where applicable, recording unit.",
    ramsScope: "Drainage CCTV survey with controlled access at chambers, traffic interface controls, and contamination prevention.",
    ramsMethod:
      "1. Confirm permit interfaces and confined-space boundary before chamber opening.\n\n2. Inspect chamber condition and barriers before camera insertion.\n\n3. Run CCTV capture with tether and communication controls.\n\n4. Log defects, obstructions, and chainage in survey output.\n\n5. Reinstate chamber and complete close-out checks.",
    hazardTokens: ["cctv", "manhole", "chamber", "confined", "traffic", "slips", "contamination"],
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
    hazardTokens: ["traffic", "pedestrian", "uneven ground", "lone working"],
    defaultDeliverables: [mkDel("report_pdf", "Control report (PDF)"), mkDel("other", "Control point schedule")],
  },
  laser_scanning: {
    label: "Laser scanning / point cloud",
    scope: "Terrestrial laser scanning to capture point cloud data of the agreed extent for design, record or clash purposes.",
    methodology:
      "Scanner positions planned for coverage and overlap; targets or cloud-to-cloud registration as specified. Data registered, cleaned and issued in agreed format with survey report on accuracy and coverage gaps.",
    equipmentUsed: "Terrestrial laser scanner, targets, GNSS/total station for registration, point cloud software.",
    hazardTokens: ["laser", "scan", "traffic", "tripod", "work at height"],
    defaultDeliverables: [
      mkDel("report_pdf", "Survey report (PDF)"),
      mkDel("other", "Point cloud dataset", "On request"),
    ],
  },
  uav_aerial: {
    label: "UAV / aerial survey",
    scope: "UAV aerial survey / photogrammetry over the agreed site extent for orthoimagery, DSM or volumetric deliverables.",
    methodology:
      "Pre-flight checks, NOTAM/airspace review and RAMS brief. Ground control or RTK PPK as specified; flight lines and overlap per client spec. Processing QA on GCP residuals and coverage.",
    equipmentUsed: "UAV platform, RTK/PPK module, ground control targets, photogrammetry software.",
    hazardTokens: ["uav", "drone", "flight", "pedestrian", "high_wind"],
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
    hazardTokens: ["traffic", "moving plant", "pedestrian", "work at height"],
    defaultDeliverables: [mkDel("report_pdf", "Setting-out record (PDF)")],
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
  return {
    label: entry.label || key,
    scope: entry.ramsScope || entry.scope || "",
    method: entry.ramsMethod || entry.methodology || "",
  };
}

/** Merge RAMS pack rows with catalog prose where keys match. */
export function mergeRamsPackFromCatalog(pack) {
  if (!pack?.key) return pack;
  const entry = getSurveyCatalogEntry(pack.key);
  if (!entry) return pack;
  return {
    ...pack,
    label: entry.label || pack.label,
    scope: entry.ramsScope || entry.scope || pack.scope,
    method: entry.ramsMethod || pack.method || entry.methodology || pack.method,
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
