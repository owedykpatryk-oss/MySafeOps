const SECTION_KEYS = [
  "foreword",
  "executiveSummary",
  "scope",
  "methodology",
  "dataProcessing",
  "interpretationCriteria",
  "findings",
  "limitations",
  "recommendations",
  "deliverablesNotes",
];

const GENERIC_SIGNATURES = [
  "this report presents the findings of a ground penetrating radar",
  "ground penetrating radar survey undertaken in accordance with general uk",
  "raw gpr traces were processed using industry-standard",
  "interpretation follows amplitude, continuity and hyperbola geometry",
  "typical deliverables for this type of survey may include",
];

function clean(value) {
  return String(value || "").trim();
}

function sentence(value) {
  const text = clean(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function normaliseForComparison(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function label(value) {
  return clean(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "the recorded survey date";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function equipmentLabel(report) {
  const equipment = report?.equipment?.[0] || {};
  return [equipment.manufacturer, equipment.model].filter(Boolean).join(" ") || "the recorded GPR system";
}

function evidenceSummary(report) {
  const items = [
    report?.radargrams?.length ? `${report.radargrams.length} radargram image(s)` : "",
    report?.scanPanels?.length ? `${report.scanPanels.length} scan panel(s)` : "",
    report?.chainageSegments?.length ? `${report.chainageSegments.length} chainage segment(s)` : "",
    report?.planFigures?.length ? `${report.planFigures.length} plan/CAD figure(s)` : "",
  ].filter(Boolean);
  return items.length ? items.join(", ") : "no supporting radargram or plan figures attached at export time";
}

function anomalySummary(report) {
  const anomalies = Array.isArray(report?.anomalies) ? report.anomalies : [];
  if (!anomalies.length) return "No interpreted anomalies were logged at export time";
  const confidence = anomalies.reduce((totals, anomaly) => {
    const key = clean(anomaly.confidence || "medium").toLowerCase();
    totals[key] = (totals[key] || 0) + 1;
    return totals;
  }, {});
  const breakdown = Object.entries(confidence).map(([key, count]) => `${count} ${key} confidence`).join(", ");
  return `${anomalies.length} interpreted anomalies were logged (${breakdown})`;
}

export function describeAnomalyRow(anomaly = {}, index = 0) {
  const ref = clean(anomaly.ref) || `A${index + 1}`;
  const depth = clean(anomaly.depthM);
  const confidence = clean(anomaly.confidence) || "unspecified";
  const interpretation = clean(anomaly.interpretation);
  const parts = [
    ref,
    depth ? `recorded depth ${depth} m` : "depth not recorded",
    `${confidence} confidence`,
  ];
  if (interpretation) parts.push(`surveyor interpretation: ${interpretation}`);
  const correlation = clean(anomaly.archiveCorrelation);
  const frameDate = clean(anomaly.archiveFrameDate);
  if (correlation === "correlates") {
    parts.push(`surveyor marked a correlation with the kept archive frame${frameDate ? ` dated ${frameDate}` : ""}`);
  } else if (correlation === "does_not_correlate") {
    parts.push(`surveyor marked no correlation with the kept archive frame${frameDate ? ` dated ${frameDate}` : ""}`);
  }
  return parts.join("; ");
}

function lineNumber(label) {
  const match = String(label || "").match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

/** Same utility type on neighbouring numbered lines, similar depth. Does not merge the rows. */
export function suggestContinuousUtilities(anomalies = []) {
  const rows = (anomalies || [])
    .map((anomaly, index) => ({
      anomaly,
      index,
      line: lineNumber(anomaly?.lineOrGrid),
      depth: Number(anomaly?.depthM),
    }))
    .filter((row) => row.anomaly?.anomalyType === "utility" && row.line != null && Number.isFinite(row.depth) && row.depth > 0);
  const hints = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (Math.abs(rows[i].line - rows[j].line) !== 1) continue;
      if (Math.abs(rows[i].depth - rows[j].depth) > 0.15) continue;
      const left = rows[i].anomaly;
      const right = rows[j].anomaly;
      hints.push(
        `${clean(left.ref) || `A${rows[i].index + 1}`} on line ${rows[i].line} (${rows[i].depth} m) and ${clean(right.ref) || `A${rows[j].index + 1}`} on line ${rows[j].line} (${rows[j].depth} m) are both recorded as utilities at a similar depth. They may be one continuous feature. They have not been joined in this report.`
      );
    }
  }
  return hints;
}

export function readableSignalDepthM(report = {}) {
  const depths = (report.scanPanels || [])
    .map((panel) => Number(panel?.readableDepthM))
    .filter((depth) => Number.isFinite(depth) && depth > 0);
  return depths.length ? Math.max(...depths) : null;
}

export function shallowSignalLimitation(report = {}) {
  const expected = Number(report?.groundConditions?.expectedPenetrationM);
  const readable = readableSignalDepthM(report);
  if (!Number.isFinite(expected) || expected <= 0 || readable == null) return "";
  if (readable >= expected - 0.15) return "";
  return `The deepest readable signal recorded on a scan panel is ${readable} m, which is shallower than the indicative penetration of ${expected} m. Responses below that readable depth were not interpreted from the radargram.`;
}

export function buildAnomalyScheduleText(report = {}) {
  const anomalies = Array.isArray(report.anomalies) ? report.anomalies : [];
  if (!anomalies.length) {
    return "No anomaly schedule was completed. This must not be interpreted as clearance of the surveyed area.";
  }
  return [
    `${anomalySummary(report)}.`,
    ...anomalies.map((anomaly, index) => `${describeAnomalyRow(anomaly, index)}.`),
  ].join("\n");
}

function processingSummary(report) {
  const filters = (report?.processing?.filters || []).filter((item) => item?.applied);
  const steps = report?.processing?.stepsApplied || [];
  const entries = filters.length
    ? filters.map((item) => `${item.label || label(item.key)}${item.parameter ? ` (${item.parameter})` : ""}`)
    : steps.map(label);
  const software = report?.processing?.software || report?.equipment?.[0]?.processingSoftware;
  if (!entries.length) {
    return [
      software ? `Recorded processing software: ${software}.` : "Processing software was not recorded.",
      "No filter chain was marked as applied at export time; the processing log should be completed before final issue.",
    ].join(" ");
  }
  return [
    `Processing was completed using ${software || "the recorded processing environment"}.`,
    `The applied workflow comprised: ${entries.join("; ")}.`,
    report?.processing?.filterSettings ? sentence(`Recorded settings: ${report.processing.filterSettings}`) : "",
    report?.processing?.migrationNotes ? sentence(`Migration/depth conversion note: ${report.processing.migrationNotes}`) : "",
    "Processing choices were retained in the report so results can be reviewed and reproduced against the raw dataset.",
  ].filter(Boolean).join(" ");
}

export function buildGprNarrativePack(report = {}) {
  const acquisition = report.acquisition || {};
  const velocity = report.velocityModel || {};
  const ground = report.groundConditions || {};
  const observations = ground.siteObservations || {};
  const environmental = report.environmental || {};
  const equipment = report.equipment?.[0] || {};
  const site = report.siteAddress || report.projectName || "the recorded survey area";
  const surveyDate = formatDate(report.surveyDate);
  const frequency = Number(equipment.antennaFrequencyMhz) || 400;
  const scanMode = label(acquisition.scanMode || "grid scan");
  const expectedPenetration = Number(ground.expectedPenetrationM);
  const targetDepth = Number(acquisition.depthRangeM);
  const objectives = (report.preSurvey?.objectives || []).map(label).filter(Boolean);
  const scopeExtent = [
    acquisition.gridExtentM ? `${acquisition.gridExtentM} m recorded grid/route extent` : "",
    acquisition.lineSpacingM ? `${acquisition.lineSpacingM} m line spacing` : "",
    acquisition.traceSpacingM ? `${acquisition.traceSpacingM} m trace spacing` : "",
    acquisition.coveragePercent ? `${acquisition.coveragePercent}% estimated coverage` : "",
  ].filter(Boolean).join(", ");

  const groundLines = [
    ground.materialClass ? `Mapped material class: ${label(ground.materialClass)}.` : "",
    ground.attenuationClass ? `Expected attenuation: ${label(ground.attenuationClass)}.` : "",
    ground.dielectricRange?.length ? `Indicative relative permittivity range: ${ground.dielectricRange.join("-")}.` : "",
    Number.isFinite(expectedPenetration) ? `Indicative penetration at ${frequency} MHz: approximately ${expectedPenetration} m.` : "",
    observations.moisture ? `Observed moisture condition: ${label(observations.moisture)}.` : "",
    observations.reinforcement ? `Reinforcement condition: ${label(observations.reinforcement)}.` : "",
  ].filter(Boolean).join(" ");

  const coverage = Number(acquisition.coveragePercent);
  const hasImagery = (report.radargrams || []).length > 0 || (report.scanPanels || []).length > 0;
  const limitations = [
    "GPR results are geophysical indications derived from contrasts in electromagnetic properties; they do not prove the identity, ownership or service status of a target.",
    Number.isFinite(expectedPenetration) && Number.isFinite(targetDepth) && targetDepth > expectedPenetration
      ? `The requested target depth (${targetDepth} m) exceeds the BGS-informed indicative penetration (${expectedPenetration} m); confidence is expected to reduce with depth.`
      : "Achieved depth and resolution vary with conductivity, moisture, clay content, reinforcement, surface coupling and antenna frequency.",
    Number.isFinite(coverage) && coverage > 0 && coverage < 90
      ? `Estimated coverage is ${coverage}%. Ground outside the recorded coverage is not cleared by this report.`
      : "",
    hasImagery
      ? ""
      : "No radargram or scan panel was attached, so the interpreted responses cannot be reviewed from imagery in this issue alone.",
    shallowSignalLimitation(report),
    ground.scale
      ? `BGS mapping at ${ground.scale} is a desk-study context layer and must not be treated as a site-specific ground investigation.`
      : "No mapped geology scale was recorded; ground interpretation should be supported by site observations or investigation data.",
    "Positions and depths should be verified using appropriate complementary detection and safe intrusive methods before excavation or structural intervention.",
  ].filter(Boolean).join("\n\n");

  return {
    foreword: [
      `This controlled ${report.status === "final" ? "final" : "draft"} report records the ground penetrating radar survey completed at ${site} on ${surveyDate}.`,
      `It documents the survey configuration, field conditions, processing decisions, interpreted responses and supporting evidence for report reference ${report.ref || "not yet assigned"}.`,
      "The report should be read with the drawings, radargrams, limitations and sign-off record. Interpretations remain geophysical indications unless independently verified.",
    ].join("\n\n"),
    executiveSummary: [
      `${equipmentLabel(report)} with a ${frequency} MHz centre frequency was used in ${scanMode.toLowerCase()} mode at ${site}.`,
      scopeExtent ? `Recorded acquisition: ${scopeExtent}.` : "Detailed acquisition spacings and coverage were not fully recorded at export time.",
      `${anomalySummary(report)}. Refer to the Findings schedule for individual responses. Supporting evidence: ${evidenceSummary(report)}.`,
      groundLines || "BGS ground enrichment was not available at export time, so penetration should be judged from field signal quality and calibration targets.",
      report.status === "final"
        ? "The issue is marked FINAL; users must still apply the limitations and safe-dig controls stated in this report."
        : "This issue remains DRAFT and is not approved for operational reliance.",
    ].join("\n\n"),
    scope: [
      `The survey scope covered the recorded GPR extent at ${site}.`,
      objectives.length ? `Survey objectives: ${objectives.join("; ")}.` : "Primary objective: identify and record subsurface responses within accessible survey areas.",
      scopeExtent ? `Extent and density: ${scopeExtent}.` : "Extent is defined by the attached scan panels, chainage records, field notes and plan figures.",
      "Excluded or inaccessible areas, coverage gaps and signal-obscured zones must be read from the limitations and findings sections; unscanned ground is not cleared by this report.",
    ].join("\n\n"),
    methodology: [
      `A site walkover and equipment setup were followed by systematic ${scanMode.toLowerCase()} acquisition using ${equipmentLabel(report)} (${frequency} MHz${equipment.channels ? `, ${equipment.channels} channel(s)` : ""}).`,
      acquisition.scanDirection ? `Lines were acquired in the recorded ${acquisition.scanDirection} direction.` : "Survey direction and local control were followed as recorded in field notes and scan metadata.",
      `Distance triggering/positioning was checked against the recorded line and trace spacing. ${acquisition.stackingPasses ? `${acquisition.stackingPasses} stacking pass(es) were configured.` : "Stacking configuration was not separately recorded."}`,
      velocity.measuredVelocityCmNs
        ? `Depth conversion used a measured velocity of ${velocity.measuredVelocityCmNs} cm/ns${velocity.calibrationTarget ? ` calibrated against ${velocity.calibrationTarget}` : ""}.`
        : `Depth conversion used an assumed velocity of ${velocity.assumedVelocityCmNs || 10} cm/ns; reported depths are therefore indicative.`,
      "Field data were checked for coupling, clipping, positioning continuity and coverage before interpretation. Responses were correlated across adjacent lines where available and assigned confidence based on signal clarity, repeatability and context.",
    ].join("\n\n"),
    dataProcessing: processingSummary(report),
    interpretationCriteria: [
      "High confidence - a clear response repeated on adjacent lines or views, with coherent geometry and a plausible depth/context correlation.",
      "Medium confidence - a recognisable but single-line, partially obscured or moderately noisy response requiring corroboration.",
      "Low/indicative - weak, cluttered or non-unique response retained so it is not overlooked, but unsuitable for direct positional reliance.",
      `Depths are converted from two-way travel time using the documented velocity model${velocity.measuredVelocityCmNs ? "" : "; no measured site velocity was recorded"}. Local changes in moisture and material can change velocity and depth accuracy.`,
      "A lack of response does not demonstrate that no target is present; conductive ground, reinforcement, closely spaced services and poor coupling can mask features.",
    ].join("\n\n"),
    findings: [
      buildAnomalyScheduleText(report),
      suggestContinuousUtilities(report.anomalies).join("\n\n"),
      `Supporting evidence: ${evidenceSummary(report)}.`,
    ].filter(Boolean).join("\n\n"),
    limitations,
    recommendations: [
      "Correlate GPR indications with available records, electromagnetic location results, visible site features and survey control before setting out or excavation.",
      "Use safe digging practices and an approved permit-to-dig process. Positively verify critical targets using hand excavation, vacuum excavation or another appropriate method.",
      ground.attenuationClass === "high" || ground.attenuationClass === "very_high"
        ? "Where attenuation is high, consider lower-frequency GPR and complementary EML or intrusive verification; do not infer clearance below the effective signal depth."
        : "Where signal quality or coverage is incomplete, re-scan using adjusted acquisition settings or a complementary technique.",
      environmental.moistureImpactOnGpr ? sentence(environmental.moistureImpactOnGpr) : "Record weather, moisture and surface coupling for any repeat survey so differences in penetration can be explained.",
    ].join("\n\n"),
    deliverablesNotes: `Evidence packaged with this issue: ${evidenceSummary(report)}. Deliverable availability is also recorded in the checklist above.`,
  };
}

export function findDuplicateGprNarrativeSections(sections = {}) {
  const groups = new Map();
  SECTION_KEYS.forEach((key) => {
    const normalised = normaliseForComparison(sections[key]);
    if (normalised.length < 45) return;
    const keys = groups.get(normalised) || [];
    keys.push(key);
    groups.set(normalised, keys);
  });
  return new Set([...groups.values()].filter((keys) => keys.length > 1).flat());
}

/** Replace only the three sections that are assembled from recorded rows and flags. */
export function applyGprFindingsDraft(report = {}) {
  const generated = buildGprNarrativePack(report);
  return {
    ...report,
    sections: {
      ...(report.sections || {}),
      executiveSummary: generated.executiveSummary,
      findings: generated.findings,
      limitations: generated.limitations,
    },
  };
}

export function applyGprNarrativeAutomation(report = {}, { force = false } = {}) {
  const sections = { ...(report.sections || {}) };
  const generated = buildGprNarrativePack(report);
  const duplicates = findDuplicateGprNarrativeSections(sections);

  SECTION_KEYS.forEach((key) => {
    const current = clean(sections[key]);
    const generic = GENERIC_SIGNATURES.some((signature) => current.toLowerCase().includes(signature));
    if (force || !current || duplicates.has(key) || generic) sections[key] = generated[key];
  });

  return {
    ...report,
    sections,
    narrativeAutomation: {
      version: 2,
      generatedAt: new Date().toISOString(),
      replacedDuplicateSections: [...duplicates],
    },
  };
}
