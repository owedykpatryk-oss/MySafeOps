import { todayLocalISO } from "../../utils/localDate";
/** GPR equipment presets — manufacturer-agnostic; user can customise per mobilisation. */
export const GPR_EQUIPMENT_PRESETS = [
  {
    key: "gssi_sir4000_400",
    label: "GSSI SIR 4000 — 400 MHz",
    manufacturer: "GSSI",
    model: "SIR 4000",
    antennaFrequencyMhz: 400,
    channels: 1,
    configuration: "Single-channel horn antenna, wheel encoder",
    defaultVelocityCmNs: 10,
  },
  {
    key: "gssi_sir4000_900",
    label: "GSSI SIR 4000 — 900 MHz",
    manufacturer: "GSSI",
    model: "SIR 4000",
    antennaFrequencyMhz: 900,
    channels: 1,
    configuration: "High-resolution shallow antenna",
    defaultVelocityCmNs: 10,
  },
  {
    key: "ids_stream_c",
    label: "IDS Stream C — dual freq",
    manufacturer: "IDS GeoRadar",
    model: "Stream C",
    antennaFrequencyMhz: 200,
    channels: 14,
    configuration: "Multi-channel array 200/600 MHz",
    defaultVelocityCmNs: 10,
  },
  {
    key: "mala_proex",
    label: "MALÅ ProEx — 250/500 MHz",
    manufacturer: "MALÅ Geoscience",
    model: "ProEx",
    antennaFrequencyMhz: 250,
    channels: 1,
    configuration: "Shielded antenna, RTK GPS option",
    defaultVelocityCmNs: 10,
  },
  {
    key: "impulse_raptor",
    label: "ImpulseRadar Raptor",
    manufacturer: "ImpulseRadar",
    model: "Raptor",
    antennaFrequencyMhz: 400,
    channels: 8,
    configuration: "Multi-channel 400 MHz array",
    defaultVelocityCmNs: 10,
  },
  {
    key: "proceq_gs8000",
    label: "Proceq GS8000 — SFCW",
    manufacturer: "Proceq",
    model: "GS8000",
    antennaFrequencyMhz: 600,
    channels: 1,
    configuration: "Stepped-frequency continuous wave (SFCW), GNSS/RTK option",
    defaultVelocityCmNs: 10,
  },
  {
    key: "proceq_gp8000",
    label: "Proceq GP8000 — concrete",
    manufacturer: "Proceq",
    model: "GP8000",
    antennaFrequencyMhz: 2000,
    channels: 1,
    configuration: "Portable concrete / slab inspection, AR view",
    defaultVelocityCmNs: 12,
  },
  {
    key: "leica_ds4000",
    label: "Leica DS4000 — dual freq",
    manufacturer: "Leica Geosystems",
    model: "DS4000",
    antennaFrequencyMhz: 200,
    channels: 2,
    configuration: "Dual 200 / 900 MHz real-time sampling",
    defaultVelocityCmNs: 10,
  },
  {
    key: "ids_chaser_xr",
    label: "IDS Chaser XR",
    manufacturer: "IDS GeoRadar",
    model: "Chaser XR",
    antennaFrequencyMhz: 400,
    channels: 1,
    configuration: "Single-channel horn, encoder wheel",
    defaultVelocityCmNs: 10,
  },
  {
    key: "sensors_spidar",
    label: "Sensors & Software SPIDAR",
    manufacturer: "Sensors & Software",
    model: "SPIDAR",
    antennaFrequencyMhz: 500,
    channels: 4,
    configuration: "Multi-frequency multi-channel",
    defaultVelocityCmNs: 10,
  },
  {
    key: "custom",
    label: "Custom / other equipment",
    manufacturer: "",
    model: "",
    antennaFrequencyMhz: 400,
    channels: 1,
    configuration: "",
    defaultVelocityCmNs: 10,
  },
];

export const SCAN_MODES = [
  { key: "grid", label: "Grid scan" },
  { key: "longitudinal", label: "Longitudinal / parallel lines" },
  { key: "cross_section", label: "Cross-section / transect" },
  { key: "route", label: "Route / corridor follow" },
  { key: "3d_array", label: "3D multi-channel array" },
];

export const CALIBRATION_METHODS = [
  { key: "hyperbola", label: "Hyperbola fitting (known depth target)" },
  { key: "known_utility", label: "Known utility / chamber depth" },
  { key: "trial_hole", label: "Trial hole / hand exposure" },
  { key: "default_site", label: "Default site velocity (εr assumption)" },
  { key: "multi_target", label: "Multi-target regression" },
];

export const SURFACE_TYPE_OPTIONS = [
  { key: "grass", label: "Grass / soft ground" },
  { key: "soil", label: "Bare soil" },
  { key: "gravel", label: "Gravel / hardcore" },
  { key: "asphalt", label: "Asphalt / tarmac" },
  { key: "concrete", label: "Concrete / hardstanding" },
  { key: "paving", label: "Block paving" },
  { key: "mixed", label: "Mixed surfaces" },
];

export const MOISTURE_OPTIONS = [
  { key: "dry", label: "Dry" },
  { key: "damp", label: "Damp" },
  { key: "wet", label: "Wet" },
  { key: "waterlogged", label: "Waterlogged" },
];

export const REINFORCEMENT_OPTIONS = [
  { key: "none", label: "None observed" },
  { key: "present", label: "Present locally" },
  { key: "extensive", label: "Extensive / mesh reinforced" },
  { key: "unknown", label: "Unknown" },
];

export const ANOMALY_CONFIDENCE = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "indicative", label: "Indicative only" },
];

export const ANOMALY_TYPES = [
  { key: "utility", label: "Buried utility / service" },
  { key: "void", label: "Void / cavity" },
  { key: "reinforcement", label: "Reinforcement / rebar" },
  { key: "bedrock", label: "Bedrock / shallow geology" },
  { key: "archaeological", label: "Archaeological / unknown" },
  { key: "other", label: "Other / unclassified" },
];

export const GPR_LIMITATION_RULES = [
  {
    key: "attenuation_clay",
    label: "Clay / high conductivity",
    text: "Clay-rich or saturated ground increased GPR attenuation and limited achievable penetration depth.",
  },
  {
    key: "made_ground",
    label: "Made ground heterogeneity",
    text: "Made ground and backfill are geologically heterogeneous; hyperbola interpretation carries higher uncertainty.",
  },
  {
    key: "reinforcement_clutter",
    label: "Reinforcement / clutter",
    text: "Reinforced concrete, mesh or metallic clutter created scattering and masked deeper targets in affected areas.",
  },
  {
    key: "weather_moisture",
    label: "Weather / surface moisture",
    text: "Weather and near-surface moisture during acquisition affected antenna coupling and effective penetration.",
  },
  {
    key: "frequency_resolution",
    label: "Frequency vs resolution trade-off",
    text: "Antenna frequency limits both resolution and depth; deeper targets may not resolve at the frequency deployed.",
  },
  {
    key: "velocity_uncertainty",
    label: "Velocity model uncertainty",
    text: "Depth estimates depend on the velocity model; local material changes can introduce depth error of ±10–15%.",
  },
  {
    key: "access_coverage",
    label: "Incomplete coverage",
    text: "Physical obstructions or access restrictions prevented full grid coverage in noted areas.",
  },
  {
    key: "no_verification",
    label: "No intrusive verification",
    text: "Anomalies are geophysical interpretations only — no trial holes or vacuum excavation verification was undertaken.",
  },
];

export const GPR_QA_ITEMS = [
  { key: "calibrationRecorded", label: "Velocity calibration recorded on site" },
  { key: "timeZeroChecked", label: "Time-zero and surface coupling checked each line" },
  { key: "gridCoverageComplete", label: "Grid / line coverage meets brief" },
  { key: "gpsQualityChecked", label: "GPS / positioning quality acceptable" },
  { key: "dataBackedUp", label: "Raw data backed up before demobilisation" },
  { key: "onSiteReview", label: "On-site data review for obvious gaps" },
  { key: "processingLogged", label: "Processing steps documented" },
];

export const GPR_SOFTWARE_OPTIONS = [
  "GeoLitix",
  "IQMaps",
  "Reflexw",
  "GRED",
  "Sensors & Software Ekko",
  "MALÅ Ground Explorer",
  "IDS K2 FastWave",
  "Other",
];

/** Processing filter log rows (Geolitix / IQMaps-style — generic). */
export const PROCESSING_FILTER_CATALOG = [
  { key: "velocity", label: "Velocity analysis", defaultParameter: "Site velocity model", defaultNotes: "Depth conversion", defaultApplied: true },
  { key: "time_zero", label: "Time-zero correction", defaultParameter: "Threshold / first break", defaultNotes: "Trace alignment", defaultApplied: true },
  { key: "dewow", label: "Dewow / DC removal", defaultParameter: "Sample window 40", defaultNotes: "Low-frequency drift", defaultApplied: true },
  { key: "bandpass", label: "Band-pass filter", defaultParameter: "Antenna-dependent MHz band", defaultNotes: "1D FFT bandpass", defaultApplied: true },
  { key: "background", label: "Background subtraction", defaultParameter: "Trace window (e.g. 97–299)", defaultNotes: "Remove horizontal banding", defaultApplied: true },
  { key: "gain", label: "Time-varying gain (SEC/TVG)", defaultParameter: "dB curve vs time", defaultNotes: "Boost weak reflectors", defaultApplied: true },
  { key: "time_cut", label: "Time window trim", defaultParameter: "Remove below/above ns", defaultNotes: "Focus target depth", defaultApplied: false },
  { key: "migration", label: "Migration (FK / Kirchhoff)", defaultParameter: "Velocity from model", defaultNotes: "Hyperbola collapse", defaultApplied: false },
  { key: "hilbert", label: "Hilbert envelope", defaultParameter: "Analytic signal", defaultNotes: "Amplitude / time-slice", defaultApplied: false },
];

export const GPR_DELIVERABLES = [
  { key: "pdf_report", label: "PDF technical report" },
  { key: "radargram_figures", label: "Radargram / B-scan figures" },
  { key: "depth_slices", label: "Depth-slice images" },
  { key: "time_slices", label: "Time-slice images" },
  { key: "plan_layout_cad", label: "2D plan layout (CAD/PDF)" },
  { key: "chainage_profiles", label: "Chainage / thickness profiles" },
  { key: "scan_panel_summary", label: "Grid / panel summary sheets" },
  { key: "raw_data_archive", label: "Raw data archive" },
];

export const SCAN_SIGNAL_QUALITY = [
  { key: "good", label: "Good — clear hyperbolae / reflectors" },
  { key: "moderate", label: "Moderate — usable with caution" },
  { key: "disturbed", label: "Disturbed — attenuation or clutter" },
  { key: "uninterpretable", label: "Uninterpretable — no reliable features" },
];

export const CHAINAGE_CONDITION_BANDS = [
  { key: "excellent", label: "Excellent" },
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
  { key: "poor", label: "Poor" },
  { key: "spent", label: "Spent / unfit" },
];

export function blankGprScanPanel(overrides = {}) {
  return {
    id: `pn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    panelRef: "",
    gridSizeW: "",
    gridSizeH: "",
    scanSpacingH: "",
    scanSpacingV: "",
    targetDepthM: "",
    primaryInterpretation: "",
    detailNotes: "",
    signalQuality: "good",
    comments: "",
    radargramId: "",
    ...overrides,
  };
}

export function blankGprChainageSegment(overrides = {}) {
  return {
    id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    lineRef: "",
    swathRef: "",
    chainageStartM: "",
    chainageEndM: "",
    thicknessOrDepthM: "",
    conditionBand: "",
    profileNotes: "",
    ...overrides,
  };
}

export const PROCESSING_STEPS = [
  { key: "dewow", label: "Dewow / DC removal" },
  { key: "background", label: "Background subtraction" },
  { key: "gain", label: "Time-varying gain (SEC/TVG)" },
  { key: "migration", label: "Migration" },
  { key: "filter", label: "Band-pass / filtering" },
  { key: "velocity_analysis", label: "Velocity analysis" },
  { key: "3d_volume", label: "3D volume / depth slice" },
];

export const ANOMALY_QUICK_TEMPLATES = [
  { key: "linear_utility", label: "Linear reflector", anomalyType: "utility", interpretation: "Indicative linear buried feature — hyperbola response", confidence: "medium" },
  { key: "non_metallic", label: "Non-metallic service", anomalyType: "utility", interpretation: "Indicative non-metallic linear feature — weak response", confidence: "low" },
  { key: "void_chamber", label: "Void / cavity", anomalyType: "void", interpretation: "Potential void or cavity — amplitude collapse", confidence: "medium" },
  { key: "rebar_mesh", label: "Rebar / mesh", anomalyType: "reinforcement", interpretation: "Reinforcement mesh — regular high-amplitude reflections", confidence: "high" },
  { key: "rebar_clutter", label: "Rebar clutter zone", anomalyType: "reinforcement", interpretation: "Reinforcement clutter — masks deeper targets", confidence: "high" },
  { key: "disturbed_signal", label: "Disturbed signal zone", anomalyType: "other", interpretation: "Disturbed GPR signal — interpretation unreliable in this panel", confidence: "indicative" },
  { key: "bedrock_horizon", label: "Bedrock horizon", anomalyType: "bedrock", interpretation: "Planar bedrock or stiff layer reflection", confidence: "medium" },
];

export function blankGprEquipment(overrides = {}) {
  return {
    id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    presetKey: "",
    manufacturer: "",
    model: "",
    antennaFrequencyMhz: 400,
    channels: 1,
    configuration: "",
    serialNo: "",
    calibrationDue: "",
    processingSoftware: "",
    ...overrides,
  };
}

export function blankGprPlanFigure(overrides = {}) {
  return {
    id: `pf_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    label: "",
    figureType: "plan_layout",
    dataUrl: "",
    fileName: "",
    capturedAt: "",
    ...overrides,
  };
}

export function blankGprAnomaly(overrides = {}) {
  return {
    id: `an_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    ref: "",
    lineOrGrid: "",
    depthM: "",
    lengthM: "",
    amplitude: "",
    anomalyType: "utility",
    interpretation: "",
    confidence: "medium",
    notes: "",
    ...overrides,
  };
}

export function blankGprReport(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: `gpr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ref: "",
    status: "draft",
    title: "",
    projectId: "",
    projectName: "",
    siteAddress: "",
    siteContextKey: "",
    siteContextLabel: "",
    surveyDate: todayLocalISO(),
    surveyor: "",
    equipment: [blankGprEquipment()],
    acquisition: {
      scanMode: "grid",
      lineSpacingM: "",
      traceSpacingM: "",
      scanDirection: "",
      depthRangeM: "",
      timeWindowNs: "",
      stackingPasses: "",
      gridExtentM: "",
      coveragePercent: "",
      notes: "",
    },
    velocityModel: {
      calibrationMethod: "hyperbola",
      assumedVelocityCmNs: 10,
      measuredVelocityCmNs: "",
      calibrationTarget: "",
      calibrationNotes: "",
    },
    groundConditions: {
      fetchedAt: null,
      source: "",
      scale: "",
      resolution: "",
      disclaimer: "",
      accuracyWarning: "",
      coordSource: "",
      bedrock: null,
      superficial: null,
      artificial: null,
      massMovement: null,
      nearbyBoreholes: [],
      materialClass: "",
      attenuationClass: "",
      dielectricRange: [],
      expectedPenetrationM: null,
      recommendedAntenna: null,
      narrative: "",
      queryLat: null,
      queryLng: null,
      siteObservations: {
        surfaceType: "mixed",
        moisture: "dry",
        reinforcement: "unknown",
        madeGround: false,
        basements: false,
        notes: "",
      },
    },
    environmental: {
      description: "",
      groundSurface: "unknown",
      rainDuringSurvey: "unknown",
      phenomena: [],
      tempC: null,
      tempMinC: null,
      windMph: null,
      moistureImpactOnGpr: "",
      surfaceCouplingNotes: "",
      fetchedAt: null,
      source: "",
    },
    processing: {
      stepsApplied: [],
      software: "",
      filterSettings: "",
      migrationNotes: "",
      notes: "",
      filters: [],
    },
    deliverables: Object.fromEntries(GPR_DELIVERABLES.map((d) => [d.key, false])),
    scanPanels: [],
    chainageSegments: [],
    signOff: {
      authorName: "",
      authorRole: "Surveyor",
      processorName: "",
      processorRole: "Data processor",
      checkerName: "",
      checkerRole: "Technical reviewer",
      checkedDate: "",
    },
    limitationKeys: [],
    limitationsText: "",
    qaChecklist: Object.fromEntries(GPR_QA_ITEMS.map((i) => [i.key, false])),
    anomalies: [],
    sections: {
      foreword: "",
      executiveSummary: "",
      scope: "",
      methodology: "",
      dataProcessing: "",
      interpretationCriteria: "",
      findings: "",
      limitations: "",
      recommendations: "",
      deliverablesNotes: "",
    },
    photos: [],
    radargrams: [],
    planFigures: [],
    linkedSurveyReportId: "",
    smartFillAt: null,
    createdAt: now,
    updatedAt: now,
    finalisedAt: null,
    ...overrides,
  };
}
