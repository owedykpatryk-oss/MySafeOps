/**
 * What each geo-photo type asks the person holding the phone.
 *
 * A preset used to carry only a label, icon and colour, so everything an inspector observed
 * ended up as free text and reached the report as generic filler. Each type now brings a
 * short prompt plus a handful of structured answers, stored under `photo.details` so the
 * report can use them as real values rather than parsing prose.
 *
 * Answers are stored as the option text itself: self-describing in KML, CSV and report tables,
 * with no lookup table to keep in step. Tickboxes store `true` and are omitted when unticked.
 */
import { geoPhotoPreset } from "./geoPhotoPresets";
import { isGiGeoPhotoType } from "./geoPhotoFields";

/** Split by voltage, because the report's utility schedule distinguishes HV from LV cable. */
const SERVICES = [
  "Electricity (HV)",
  "Electricity (LV)",
  "Gas",
  "Water",
  "Foul sewer",
  "Surface water",
  "Telecoms",
  "Street lighting",
  "Traffic signals",
  "Fuel",
  "District heating",
  "Unknown",
];

const SERVICE_MATERIALS = [
  "PE / MDPE",
  "uPVC",
  "Clay",
  "Concrete",
  "Cast iron",
  "Ductile iron",
  "Steel",
  "Copper",
  "Pitch fibre",
  "Ducted",
  "Unknown",
];

const DETECTION_METHODS = ["EML / CAT and Genny", "GPR", "Records only", "Trial hole", "Visual / surface features"];

const PAS128_QL = ["QL-D", "QL-C", "QL-B4", "QL-B3", "QL-B2", "QL-B1", "QL-A"];

const SURFACES = ["Tarmac", "Concrete", "Block paving", "Compacted stone", "Soft ground", "Grass", "Unmade"];

/** Applied to every type in a preset group, before the type's own fields. */
const GROUP_FIELDS = {
  "Access & logistics": [
    {
      key: "vehicleAccess",
      label: "Suitable for",
      kind: "select",
      options: ["Artic", "Rigid tipper", "Van", "4x4 only", "Pedestrian only", "No access"],
    },
    { key: "surface", label: "Surface", kind: "select", options: SURFACES },
    { key: "widthRestrictionM", label: "Width restriction", kind: "number", unit: "m", step: 0.1 },
    { key: "headroomRestrictionM", label: "Headroom restriction", kind: "number", unit: "m", step: 0.1 },
    { key: "keyOrCodeNeeded", label: "Key or code needed", kind: "toggle" },
    { key: "escortNeeded", label: "Escort needed", kind: "toggle" },
  ],
  "Site constraints & safety": [
    { key: "severity", label: "Severity", kind: "select", options: ["Low", "Medium", "High"] },
    { key: "controlInPlace", label: "Control in place", kind: "toggle" },
    { key: "workStopped", label: "Work stopped", kind: "toggle" },
    { key: "clientInformed", label: "Client informed", kind: "toggle" },
  ],
  "Survey & utilities": [{ key: "service", label: "Service", kind: "select", options: SERVICES }],
  "Ground investigation": [
    {
      key: "groundType",
      label: "Ground",
      kind: "select",
      options: ["Made ground", "Clay", "Silt", "Sand", "Gravel", "Chalk", "Rock", "Peat", "Mixed"],
    },
    { key: "waterStrikeDepthM", label: "Water strike", kind: "number", unit: "m bgl", step: 0.1 },
    {
      key: "reinstatement",
      label: "Reinstatement",
      kind: "select",
      options: ["Permanent", "Temporary", "Backfilled as dug", "Not reinstated"],
    },
    { key: "sampleTaken", label: "Sample taken", kind: "toggle" },
    { key: "arisingsRemoved", label: "Arisings removed", kind: "toggle" },
  ],
  "Site conditions": [
    {
      key: "groundState",
      label: "Conditions",
      kind: "select",
      options: ["Dry", "Damp", "Wet", "Waterlogged", "Frozen", "Soft spots"],
    },
  ],
};

/** Asked on every type, after the group and type fields. */
const UNIVERSAL_FIELDS = [{ key: "actionRequired", label: "Action required", kind: "toggle" }];

const TYPE_DEFS = {
  site_entrance: {
    prompt: "Stand back far enough to show the gate, its width and any signage.",
    fields: [
      { key: "gateWidthM", label: "Gate width", kind: "number", unit: "m", step: 0.1 },
      { key: "signInPoint", label: "Sign-in point here", kind: "toggle" },
    ],
  },
  access_route: {
    prompt: "Shoot along the route in the direction of travel, so gradients and pinch points read.",
    fields: [{ key: "pinchPoint", label: "Pinch point", kind: "toggle" }],
  },
  traffic_management: {
    prompt: "Show the layout from the approaching driver's view, including signs and cones.",
    fields: [
      {
        key: "tmType",
        label: "Layout",
        kind: "select",
        options: [
          "Stop / go boards",
          "Two-way lights",
          "Multi-way lights",
          "Lane closure",
          "Footway closure",
          "Give and take",
          "Road closure",
          "None in place",
        ],
      },
      { key: "pedestrianRouteMaintained", label: "Pedestrian route maintained", kind: "toggle" },
      { key: "signageCompliant", label: "Signage per Chapter 8", kind: "toggle" },
    ],
  },
  parked_vehicle: {
    prompt: "Capture the vehicle with a registration plate and enough context to place it.",
    fields: [
      { key: "blockingAccess", label: "Blocking access", kind: "toggle" },
      { key: "noticeIssued", label: "Notice issued", kind: "toggle" },
    ],
  },
  locked_gate: {
    prompt: "Show the lock and any contact notice fixed to the gate.",
    fields: [{ key: "keyHolder", label: "Key holder", kind: "text", placeholder: "Site security" }],
  },
  no_access: {
    prompt: "Photograph what stopped you, from where you had to stop.",
    fields: [
      {
        key: "reason",
        label: "Reason",
        kind: "select",
        options: [
          "Locked",
          "Occupied",
          "Live traffic",
          "Unsafe ground",
          "Permission refused",
          "Standing water",
          "Vegetation",
        ],
      },
      { key: "revisitNeeded", label: "Revisit needed", kind: "toggle" },
    ],
  },
  hazard: {
    prompt: "Frame the hazard and its surroundings — a close-up alone will not show the risk.",
    fields: [
      {
        key: "hazardCategory",
        label: "Category",
        kind: "select",
        options: [
          "Traffic",
          "Excavation",
          "Overhead services",
          "Buried services",
          "Working at height",
          "Confined space",
          "Slips and trips",
          "Manual handling",
          "Contamination",
          "Public interface",
          "Plant movement",
          "Other",
        ],
      },
    ],
  },
  obstruction: {
    prompt: "Include something for scale so the size of the obstruction is obvious.",
    fields: [
      {
        key: "obstructionType",
        label: "Obstruction",
        kind: "select",
        options: ["Structure", "Vegetation", "Stored material", "Vehicle", "Standing water", "Fencing", "Spoil"],
      },
      { key: "clearanceNeeded", label: "Clearance needed", kind: "toggle" },
    ],
  },
  overhead_obstruction: {
    prompt: "Photograph along the span and note the lowest point over the working area.",
    fields: [
      { key: "clearanceHeightM", label: "Clearance height", kind: "number", unit: "m", step: 0.1 },
      {
        key: "voltage",
        label: "Voltage",
        kind: "select",
        options: ["Not electrical", "LV", "11 kV", "33 kV", "132 kV or above", "Unknown"],
      },
      { key: "goalpostsNeeded", label: "Goalposts needed", kind: "toggle" },
    ],
  },
  buried_services_warning: {
    prompt: "Show the marker, cover or scan line that evidences the service.",
    fields: [
      { key: "service", label: "Service", kind: "select", options: SERVICES },
      { key: "detectionMethod", label: "Detected by", kind: "select", options: DETECTION_METHODS },
      { key: "pas128Ql", label: "PAS 128 quality level", kind: "select", options: PAS128_QL },
      { key: "indicativeDepthM", label: "Indicative depth", kind: "number", unit: "m", step: 0.1 },
    ],
  },
  gpr_setup: {
    prompt: "Show the antenna on the ground with the survey grid or start line visible.",
    fields: [
      {
        key: "antennaMhz",
        label: "Antenna",
        kind: "select",
        options: ["250 MHz", "450 MHz", "700 MHz", "900 MHz", "1600 MHz", "Multi-frequency array"],
      },
      { key: "gridSpacingM", label: "Grid spacing", kind: "number", unit: "m", step: 0.1 },
      { key: "surface", label: "Surface", kind: "select", options: SURFACES },
      { key: "calibrationChecked", label: "Calibration checked", kind: "toggle" },
    ],
  },
  utility_locator: {
    prompt: "Show the instrument reading in place over the line being traced.",
    fields: [
      { key: "detectionMethod", label: "Detected by", kind: "select", options: DETECTION_METHODS },
      { key: "pas128Ql", label: "PAS 128 quality level", kind: "select", options: PAS128_QL },
      { key: "indicativeDepthM", label: "Indicative depth", kind: "number", unit: "m", step: 0.1 },
      { key: "signalConfident", label: "Signal confident", kind: "toggle" },
    ],
  },
  trial_pit: {
    prompt: "Photograph the open pit square-on with a scale, then again after reinstatement.",
    fields: [
      {
        key: "excavationMethod",
        label: "Excavated by",
        kind: "select",
        options: ["Hand dig", "Vacuum excavation", "Machine", "Hand dig then machine"],
      },
      { key: "serviceFound", label: "Service found", kind: "select", options: SERVICES },
      { key: "serviceMaterial", label: "Material", kind: "select", options: SERVICE_MATERIALS },
      { key: "serviceDiameterMm", label: "Diameter", kind: "number", unit: "mm", step: 1 },
    ],
  },
  manhole_chamber: {
    prompt: "Get the whole cover in frame with a scale, then the chamber with the cover lifted.",
    fields: [
      {
        key: "coverType",
        label: "Cover type",
        kind: "select",
        options: ["Cast iron", "Ductile iron", "Composite", "Concrete", "Steel", "Tarmac over", "Unknown"],
      },
      { key: "coverSize", label: "Cover size", kind: "text", placeholder: "600 x 600" },
      {
        key: "coverCondition",
        label: "Cover condition",
        kind: "select",
        options: ["Good", "Fair", "Cracked", "Corroded", "Rocking", "Missing", "Buried"],
      },
      { key: "depthToInvertM", label: "Depth to invert", kind: "number", unit: "m", step: 0.1 },
      { key: "serviceMaterial", label: "Pipe material", kind: "select", options: SERVICE_MATERIALS },
      { key: "serviceDiameterMm", label: "Pipe diameter", kind: "number", unit: "mm", step: 1 },
      { key: "connectionsSeen", label: "Connections seen", kind: "number", step: 1 },
      { key: "coverLifted", label: "Cover lifted", kind: "toggle" },
      { key: "waterPresent", label: "Water present", kind: "toggle" },
      { key: "surchargedOrBlocked", label: "Surcharged or blocked", kind: "toggle" },
    ],
  },
  benchmark_control: {
    prompt: "Show the mark itself and a wider shot that lets someone else find it again.",
    fields: [
      {
        key: "controlType",
        label: "Control type",
        kind: "select",
        options: ["GNSS base", "TBM", "OS benchmark", "Control nail", "Survey station", "Ground marker"],
      },
      { key: "controlRef", label: "Reference", kind: "text", placeholder: "TBM01" },
      { key: "levelM", label: "Level", kind: "number", unit: "m AOD", step: 0.001 },
      { key: "checkedIntoNetwork", label: "Checked into network", kind: "toggle" },
    ],
  },
  borehole_location: {
    prompt: "Show the rig position and the point itself before drilling starts.",
    fields: [
      {
        key: "technique",
        label: "Technique",
        kind: "select",
        options: ["Cable percussion", "Rotary open hole", "Rotary cored", "Sonic", "Windowless sampling"],
      },
    ],
  },
  window_sampling: { prompt: "Show the rig, the point and the recovered liners together where you can." },
  dcp_probe: {
    prompt: "Show the probe in position with the point of test visible.",
    fields: [{ key: "blowsRecorded", label: "Blow count recorded", kind: "toggle" }],
  },
  hand_auger_point: { prompt: "Show the auger at the point with the arisings laid out in order." },
  sample_custody: {
    prompt: "Photograph labels so the reference reads clearly in the picture.",
    fields: [
      {
        key: "sampleType",
        label: "Sample type",
        kind: "select",
        options: [
          "Bulk disturbed",
          "Small disturbed",
          "Undisturbed U100",
          "Water",
          "Ground gas",
          "Asbestos screen",
          "Concrete core",
        ],
      },
      { key: "labSentTo", label: "Laboratory", kind: "text", placeholder: "Lab name" },
      { key: "chainOfCustodySigned", label: "Chain of custody signed", kind: "toggle" },
      { key: "chilled", label: "Chilled in transit", kind: "toggle" },
    ],
  },
  borehole_cap: {
    prompt: "Show the finished cover flush with the surface, with the surround visible.",
    fields: [
      {
        key: "capType",
        label: "Cap type",
        kind: "select",
        options: ["Flush cover", "Stand pipe", "Concrete surround", "Tarmac", "Steel plate"],
      },
      { key: "lockable", label: "Lockable", kind: "toggle" },
    ],
  },
  piezometer_install: {
    prompt: "Show the installation depth marks and the headworks as left.",
    fields: [
      { key: "responseZoneM", label: "Response zone", kind: "text", placeholder: "3.0 – 6.0 m" },
      { key: "dipReadingM", label: "Dip reading", kind: "number", unit: "m bgl", step: 0.01 },
      { key: "gasTapFitted", label: "Gas tap fitted", kind: "toggle" },
    ],
  },
  ground_conditions: {
    prompt: "Show the working surface, not just the sky line — include a boot or scale.",
    fields: [
      {
        key: "trafficability",
        label: "Trafficability",
        kind: "select",
        options: ["Good for plant", "Tracked plant only", "Matting needed", "Impassable"],
      },
    ],
  },
  vegetation: {
    prompt: "Show the extent of growth and anything it is hiding.",
    fields: [
      {
        key: "vegetationType",
        label: "Vegetation",
        kind: "select",
        options: ["Grass", "Scrub", "Trees", "Hedgerow", "Japanese knotweed", "Other invasive species"],
      },
      { key: "clearanceNeeded", label: "Clearance needed", kind: "toggle" },
      { key: "ecologyCheckNeeded", label: "Ecology check needed", kind: "toggle" },
    ],
  },
  drainage_water: {
    prompt: "Show where the water comes from and where it goes.",
    fields: [
      {
        key: "waterType",
        label: "Water",
        kind: "select",
        options: ["Standing water", "Running water", "Flooding", "Discharge", "Watercourse", "Spring"],
      },
      { key: "pumpingNeeded", label: "Pumping needed", kind: "toggle" },
      { key: "pollutionRisk", label: "Pollution risk", kind: "toggle" },
    ],
  },
  orientation_wide_shot: {
    prompt: "One wide shot that lets the reader place every other photo on the site.",
    fields: [{ key: "viewpointRef", label: "Viewpoint reference", kind: "text", placeholder: "VP1" }],
  },
  general_site_condition: { prompt: "Say in the notes what the reader should be looking at." },
};

/** Short instruction shown while capturing this type of photo. */
export function geoPhotoTypePrompt(type) {
  return TYPE_DEFS[String(type || "")]?.prompt || "";
}

/**
 * Questions to ask for a photo type: group fields, then type-specific, then universal.
 * Duplicate keys keep the more specific definition. Tickboxes come last, so a summary reads
 * as descriptions followed by flags ("High · Excavation · Control in place").
 * @returns {Array<{ key: string, label: string, kind: string, options?: string[], unit?: string }>}
 */
export function geoPhotoTypeFields(type) {
  const key = String(type || "");
  const group = geoPhotoPreset(key).group;
  const own = TYPE_DEFS[key]?.fields || [];
  const ownKeys = new Set(own.map((f) => f.key));
  // A trial pit sits in the survey group but is also an intrusive GI point, so it needs both
  // sets of questions.
  const groupNames = isGiGeoPhotoType(key) ? [group, "Ground investigation"] : [group];
  const groupFields = groupNames
    .flatMap((name) => GROUP_FIELDS[name] || [])
    .filter((f) => !ownKeys.has(f.key));
  const seen = new Set();
  const merged = [...groupFields, ...own, ...UNIVERSAL_FIELDS].filter((f) =>
    seen.has(f.key) ? false : seen.add(f.key)
  );
  return [...merged.filter((f) => f.kind !== "toggle"), ...merged.filter((f) => f.kind === "toggle")];
}

function coerce(field, value) {
  if (field.kind === "toggle") return value === true || value === "true" ? true : null;
  if (field.kind === "number") {
    if (value === "" || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (field.kind === "select" && Array.isArray(field.options) && !field.options.includes(text)) return null;
  return text.slice(0, 120);
}

/** Drop answers that no longer belong to the type and coerce the rest. Empty answers are omitted. */
export function normaliseGeoPhotoDetails(type, details) {
  const out = {};
  if (!details || typeof details !== "object") return out;
  for (const field of geoPhotoTypeFields(type)) {
    const value = coerce(field, details[field.key]);
    if (value !== null) out[field.key] = value;
  }
  return out;
}

/**
 * Answered fields as label/value pairs for report tables, exports and balloons.
 * @returns {Array<[string, string]>}
 */
export function geoPhotoDetailRows(photo) {
  const details = photo?.details;
  if (!details || typeof details !== "object") return [];
  const rows = [];
  for (const field of geoPhotoTypeFields(photo?.type)) {
    const value = details[field.key];
    if (value == null || value === "" || value === false) continue;
    if (field.kind === "toggle") {
      rows.push([field.label, "Yes"]);
      continue;
    }
    rows.push([field.label, field.unit ? `${value} ${field.unit}` : String(value)]);
  }
  return rows;
}

/** One-line summary for cards, captions and search, e.g. "Cast iron · Cracked · Action required". */
export function geoPhotoDetailSummary(photo) {
  return geoPhotoDetailRows(photo)
    .map(([label, value]) => (value === "Yes" ? label : value))
    .join(" · ");
}
