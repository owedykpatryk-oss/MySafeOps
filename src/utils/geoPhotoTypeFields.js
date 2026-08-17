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
import { formatGeoPhotoArea, geoPhotoAreaOf } from "./geoPhotoArea";

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
  // Service is asked on the utility types themselves — a benchmark or control mark is in this
  // preset group but is not a buried service.
  "Survey & utilities": [],
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
  // Works records answer one question first: was this allowed to be happening?
  "Construction & works": [
    { key: "permitInPlace", label: "Permit in place", kind: "toggle" },
    { key: "ramsBriefed", label: "RAMS briefed", kind: "toggle" },
    { key: "signOffNeeded", label: "Sign-off needed", kind: "toggle" },
    { key: "workStopped", label: "Work stopped", kind: "toggle" },
  ],
  "Demolition & asbestos": [
    { key: "asbestosSuspected", label: "Asbestos suspected", kind: "toggle" },
    { key: "areaSealed", label: "Area sealed", kind: "toggle" },
    { key: "airMonitoring", label: "Air monitoring in place", kind: "toggle" },
    { key: "licensedContractor", label: "Licensed contractor", kind: "toggle" },
  ],
  "Civils & earthworks": [
    {
      key: "materialType",
      label: "Material",
      kind: "select",
      options: [
        "Topsoil",
        "Subsoil",
        "Made ground",
        "Type 1 sub-base",
        "Type 2",
        "6F2",
        "Clay",
        "Sand",
        "Gravel",
        "Crushed concrete",
        "Site arisings",
      ],
    },
    { key: "levelM", label: "Level", kind: "number", unit: "m AOD", step: 0.01 },
    { key: "testPassed", label: "Test passed", kind: "toggle" },
    { key: "siltControlInPlace", label: "Silt control in place", kind: "toggle" },
  ],
  "Facilities & maintenance": [
    { key: "assetRef", label: "Asset ref", kind: "text", placeholder: "AHU-03" },
    {
      key: "faultPriority",
      label: "Priority",
      kind: "select",
      options: ["Emergency (4 h)", "Urgent (24 h)", "Routine (7 days)", "Planned works"],
    },
    { key: "isolationRequired", label: "Isolation required", kind: "toggle" },
    { key: "madeSafe", label: "Made safe", kind: "toggle" },
    { key: "returnVisitNeeded", label: "Return visit needed", kind: "toggle" },
  ],
  "Environment & neighbours": [
    {
      key: "receptor",
      label: "Receptor",
      kind: "select",
      options: [
        "Surface water drain",
        "Foul drain",
        "Watercourse",
        "Soil / ground",
        "Air",
        "Highway",
        "None identified",
      ],
    },
    { key: "regulatorReportable", label: "Reportable to regulator", kind: "toggle" },
    { key: "containmentInPlace", label: "Containment in place", kind: "toggle" },
    { key: "complaintReceived", label: "Complaint received", kind: "toggle" },
  ],
  "Quality & handover": [
    {
      key: "qualityStatus",
      label: "Status",
      kind: "select",
      options: ["Accepted", "Accepted with comment", "Rejected", "Awaiting inspection"],
    },
    { key: "reworkNeeded", label: "Rework needed", kind: "toggle" },
    { key: "clientWitnessed", label: "Client witnessed", kind: "toggle" },
    { key: "certificateIssued", label: "Certificate issued", kind: "toggle" },
  ],
  "Food & pharma hygiene": [
    { key: "areaRef", label: "Line / room ref", kind: "text", placeholder: "Line 3" },
    { key: "batchRef", label: "Batch ref", kind: "text", placeholder: "B-2291" },
    { key: "lineStopped", label: "Line stopped", kind: "toggle" },
    { key: "qaInformed", label: "QA informed", kind: "toggle" },
    { key: "cleanedVerified", label: "Cleaned and verified", kind: "toggle" },
  ],
};

/**
 * Asked on every type, after the group and type fields. The commercial two matter as much as
 * the safety one: a dated, GPS-tagged photo is the evidence a variation or a recharge is argued
 * from, and nobody remembers months later which photos those were.
 */
const UNIVERSAL_FIELDS = [
  { key: "actionRequired", label: "Action required", kind: "toggle" },
  { key: "claimEvidence", label: "Evidence for claim / variation", kind: "toggle" },
  { key: "thirdPartyResponsible", label: "Third party responsible", kind: "toggle" },
];

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
      { key: "service", label: "Service", kind: "select", options: SERVICES },
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
      { key: "service", label: "Service", kind: "select", options: SERVICES },
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
      { key: "service", label: "Service", kind: "select", options: SERVICES },
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
  rebar_prepour: {
    prompt: "Photograph the bay before the pour — bar arrangement, covers and starter bars in one frame.",
    fields: [
      { key: "elementRef", label: "Element", kind: "text", placeholder: "Slab B2" },
      { key: "coverMm", label: "Cover", kind: "number", unit: "mm", step: 1 },
      { key: "engineerApproved", label: "Engineer approved", kind: "toggle" },
    ],
  },
  concrete_pour: {
    prompt: "Show the pour in progress, with the delivery ticket in frame where you can.",
    fields: [
      {
        key: "concreteGrade",
        label: "Grade",
        kind: "select",
        options: ["C16/20", "C20/25", "C25/30", "C28/35", "C32/40", "C35/45", "C40/50", "Screed", "Blinding"],
      },
      { key: "pourVolumeM3", label: "Volume", kind: "number", unit: "m³", step: 0.5 },
      { key: "slumpMm", label: "Slump", kind: "number", unit: "mm", step: 10 },
      { key: "cubesTaken", label: "Cubes taken", kind: "toggle" },
    ],
  },
  excavation_support: {
    prompt: "Get the full depth in frame with the support system and the edge.",
    fields: [
      { key: "excavationDepthM", label: "Depth", kind: "number", unit: "m", step: 0.1 },
      {
        key: "supportType",
        label: "Support",
        kind: "select",
        options: ["Trench box", "Sheet piles", "Shoring frame", "Battered sides", "Benched", "None — under 1.2 m"],
      },
      { key: "edgeProtection", label: "Edge protection", kind: "toggle" },
      { key: "waterIngress", label: "Water ingress", kind: "toggle" },
    ],
  },
  scaffold: {
    prompt: "Show the tag and enough structure to see ties, boards and edge protection.",
    fields: [
      {
        key: "scaffoldTagStatus",
        label: "Tag",
        kind: "select",
        options: ["Green — safe to use", "Red — incomplete", "No tag"],
      },
      { key: "tagDate", label: "Tag date", kind: "text", placeholder: "12/06" },
      { key: "handedOver", label: "Handed over", kind: "toggle" },
      { key: "tiesChecked", label: "Ties checked", kind: "toggle" },
    ],
  },
  work_at_height: {
    prompt: "Show the working position and what would stop a fall.",
    fields: [
      {
        key: "fallProtection",
        label: "Fall protection",
        kind: "select",
        options: ["Guardrail / edge protection", "MEWP", "Harness and lanyard", "Netting", "Airbags", "None in place"],
      },
      { key: "rescuePlanInPlace", label: "Rescue plan in place", kind: "toggle" },
    ],
  },
  lifting_operation: {
    prompt: "Frame the load, the machine and the exclusion zone together.",
    fields: [
      { key: "liftCategory", label: "Lift", kind: "select", options: ["Routine", "Non-routine", "Complex"] },
      { key: "loadWeightT", label: "Load", kind: "number", unit: "t", step: 0.1 },
      { key: "appointedPerson", label: "Appointed person", kind: "text", placeholder: "Name" },
      { key: "liftPlanInPlace", label: "Lift plan in place", kind: "toggle" },
      { key: "exclusionZoneSet", label: "Exclusion zone set", kind: "toggle" },
    ],
  },
  temporary_works: {
    prompt: "Show the installed works against the design they were built to.",
    fields: [
      { key: "twRef", label: "TW ref", kind: "text", placeholder: "TW-014" },
      { key: "twCoordinatorChecked", label: "TWC checked", kind: "toggle" },
      { key: "designComplied", label: "Built to design", kind: "toggle" },
    ],
  },
  material_delivery: {
    prompt: "Show the load as it arrived, with the ticket or markings legible.",
    fields: [
      { key: "deliveryTicketRef", label: "Ticket ref", kind: "text", placeholder: "DN-4471" },
      {
        key: "materialCondition",
        label: "Condition",
        kind: "select",
        options: ["Good", "Damaged", "Wet", "Part load", "Rejected"],
      },
      { key: "storedCorrectly", label: "Stored correctly", kind: "toggle" },
    ],
  },
  welfare_facility: {
    prompt: "Show the facility as a visiting inspector would find it.",
    fields: [
      {
        key: "welfareType",
        label: "Facility",
        kind: "select",
        options: ["Toilets", "Canteen / mess", "Drying room", "First aid", "Site office", "Wash station"],
      },
      { key: "cleanAndStocked", label: "Clean and stocked", kind: "toggle" },
    ],
  },
  damaged_equipment: {
    prompt: "Photograph the damage and the ID plate or asset number.",
    fields: [
      { key: "equipmentRef", label: "Equipment", kind: "text", placeholder: "Breaker 04" },
      { key: "quarantined", label: "Quarantined", kind: "toggle" },
      { key: "outOfService", label: "Taken out of service", kind: "toggle" },
    ],
  },
  suspected_acm: {
    prompt: "Photograph from a safe distance. Do not disturb the material to get a better shot.",
    fields: [
      {
        key: "acmType",
        label: "Material",
        kind: "select",
        options: [
          "Sprayed coating",
          "Pipe insulation",
          "AIB (insulating board)",
          "Asbestos cement",
          "Floor tiles / bitumen",
          "Textured coating",
          "Rope / gasket",
          "Unknown",
        ],
      },
      {
        key: "acmCondition",
        label: "Condition",
        kind: "select",
        options: ["Good", "Slightly damaged", "Damaged", "Debris present"],
      },
      { key: "quantityM2", label: "Quantity", kind: "number", unit: "m²", step: 0.5 },
      { key: "surveyRef", label: "Survey ref", kind: "text", placeholder: "R&D 2024-08" },
      { key: "labelledAndSealed", label: "Labelled and sealed", kind: "toggle" },
    ],
  },
  asbestos_works: {
    prompt: "Show the enclosure, the airlock and the notices in one shot.",
    fields: [
      {
        key: "removalType",
        label: "Work type",
        kind: "select",
        options: ["Licensed", "Notifiable non-licensed (NNLW)", "Non-licensed"],
      },
      { key: "enclosureSmokeTested", label: "Enclosure smoke tested", kind: "toggle" },
      { key: "negativePressureUnit", label: "NPU running", kind: "toggle" },
      { key: "clearanceCertificate", label: "Clearance certificate held", kind: "toggle" },
    ],
  },
  exclusion_zone: {
    prompt: "Stand at the boundary and show what the zone is keeping people away from.",
    fields: [
      {
        key: "zonePurpose",
        label: "Protecting against",
        kind: "select",
        options: [
          "Demolition",
          "Asbestos",
          "Lifting",
          "Excavation",
          "Overhead works",
          "Contamination",
          "Structural instability",
        ],
      },
      { key: "signageInPlace", label: "Signage in place", kind: "toggle" },
      { key: "marshalPresent", label: "Marshal present", kind: "toggle" },
    ],
  },
  dust_suppression: {
    prompt: "Show the suppression working, not the equipment standing idle.",
    fields: [
      {
        key: "suppressionMethod",
        label: "Method",
        kind: "select",
        options: ["Water bowser", "Misting cannon", "Damping down", "Wheel wash", "Sheeting", "Extraction"],
      },
      { key: "visibleDustBeyondBoundary", label: "Dust crossing boundary", kind: "toggle" },
    ],
  },
  structural_weakening: {
    prompt: "Show the affected member and its surroundings — a close-up alone hides the risk.",
    fields: [
      {
        key: "elementAffected",
        label: "Element",
        kind: "select",
        options: ["Beam", "Column", "Slab", "Wall", "Roof", "Staircase", "Foundation"],
      },
      { key: "propsInstalled", label: "Props installed", kind: "toggle" },
      { key: "engineerCalled", label: "Engineer called", kind: "toggle" },
    ],
  },
  waste_segregation: {
    prompt: "Show the skip contents and its label together.",
    fields: [
      {
        key: "wasteStream",
        label: "Stream",
        kind: "select",
        options: [
          "Inert",
          "Mixed construction",
          "Timber",
          "Metal",
          "Plasterboard",
          "Hazardous",
          "Asbestos",
          "WEEE",
          "Green waste",
        ],
      },
      { key: "transferNoteHeld", label: "Transfer note held", kind: "toggle" },
      { key: "skipCovered", label: "Skip covered", kind: "toggle" },
    ],
  },
  soft_strip_progress: {
    prompt: "Same viewpoint every visit, so progress reads across the photographs.",
    fields: [
      { key: "floorLevel", label: "Level", kind: "text", placeholder: "Level 2" },
      { key: "progressPercent", label: "Progress", kind: "number", unit: "%", step: 5 },
      { key: "servicesIsolated", label: "Services isolated", kind: "toggle" },
    ],
  },
  haul_route: {
    prompt: "Shoot along the route so the surface, gradient and crossings read.",
    fields: [
      {
        key: "routeCondition",
        label: "Condition",
        kind: "select",
        options: ["Good", "Rutted", "Muddy", "Dusty", "Impassable"],
      },
      { key: "wheelWashInUse", label: "Wheel wash in use", kind: "toggle" },
      { key: "speedLimitSigned", label: "Speed limit signed", kind: "toggle" },
    ],
  },
  stockpile: {
    prompt: "Trace the footprint and add a height — together they are a volume the report can price.",
    fields: [
      { key: "heapHeightM", label: "Height", kind: "number", unit: "m", step: 0.1 },
      { key: "sheeted", label: "Sheeted", kind: "toggle" },
      { key: "contaminationSuspected", label: "Contamination suspected", kind: "toggle" },
    ],
  },
  formation_level: {
    prompt: "Show the staff or laser reading at the formation itself.",
    fields: [
      { key: "designLevelM", label: "Design level", kind: "number", unit: "m AOD", step: 0.01 },
      { key: "toleranceMm", label: "Tolerance", kind: "number", unit: "mm", step: 5 },
      { key: "proofRolled", label: "Proof rolled", kind: "toggle" },
    ],
  },
  drainage_run: {
    prompt: "Show the pipe, its bedding and the fall in one frame.",
    fields: [
      { key: "pipeDiameterMm", label: "Diameter", kind: "number", unit: "mm", step: 25 },
      { key: "pipeMaterial", label: "Material", kind: "select", options: SERVICE_MATERIALS },
      { key: "invertDepthM", label: "Invert depth", kind: "number", unit: "m", step: 0.05 },
      { key: "beddingCorrect", label: "Bedding correct", kind: "toggle" },
      { key: "airTestPassed", label: "Air test passed", kind: "toggle" },
    ],
  },
  compaction_test: {
    prompt: "Show the instrument in place with the tested layer visible.",
    fields: [
      {
        key: "testMethod",
        label: "Method",
        kind: "select",
        options: ["Plate bearing", "Nuclear density", "Sand replacement", "Lightweight deflectometer", "CBR"],
      },
      { key: "testResultValue", label: "Result", kind: "text", placeholder: "95 % MDD" },
      { key: "layerThicknessMm", label: "Layer", kind: "number", unit: "mm", step: 25 },
    ],
  },
  silt_control: {
    prompt: "Show the control measure and the water it is protecting.",
    fields: [
      {
        key: "controlMeasure",
        label: "Measure",
        kind: "select",
        options: ["Silt fence", "Settlement tank", "Straw bales", "Bunding", "Drain covers", "Filter sock"],
      },
      { key: "dischargeConsented", label: "Discharge consented", kind: "toggle" },
      { key: "maintenanceNeeded", label: "Maintenance needed", kind: "toggle" },
    ],
  },
  asset_nameplate: {
    prompt: "Fill the frame with the plate so serial and rating read at a glance.",
    fields: [
      { key: "manufacturer", label: "Manufacturer", kind: "text", placeholder: "Make" },
      { key: "serialNumber", label: "Serial", kind: "text", placeholder: "SN…" },
      { key: "installYear", label: "Installed", kind: "number", step: 1 },
    ],
  },
  maintenance_defect: {
    prompt: "Show the fault, then a wider shot that lets someone else find it again.",
    fields: [
      {
        key: "faultCategory",
        label: "Category",
        kind: "select",
        options: ["Mechanical", "Electrical", "Plumbing", "Fabric", "Fire safety", "Lift", "HVAC", "Grounds"],
      },
      { key: "partsRequired", label: "Parts required", kind: "toggle" },
      { key: "specialistNeeded", label: "Specialist needed", kind: "toggle" },
    ],
  },
  electrical_test_point: {
    prompt: "Show the appliance with its test label legible.",
    fields: [
      {
        key: "patResult",
        label: "Result",
        kind: "select",
        options: ["Pass", "Fail", "Removed from service"],
      },
      { key: "nextTestDue", label: "Next test due", kind: "text", placeholder: "06/2027" },
      { key: "labelAttached", label: "Label attached", kind: "toggle" },
    ],
  },
  fire_door: {
    prompt: "Show the leaf, the gaps around it and the intumescent seal.",
    fields: [
      { key: "doorRef", label: "Door ref", kind: "text", placeholder: "FD30-12" },
      { key: "gapAcceptable", label: "Gaps acceptable", kind: "toggle" },
      { key: "selfClosingWorks", label: "Self-closer works", kind: "toggle" },
      { key: "sealsIntact", label: "Seals intact", kind: "toggle" },
      { key: "heldOpenIncorrectly", label: "Wedged open", kind: "toggle" },
    ],
  },
  emergency_lighting: {
    prompt: "Show the fitting and where it sits on the escape route.",
    fields: [
      {
        key: "testType",
        label: "Test",
        kind: "select",
        options: ["Monthly function", "Annual 3-hour", "Visual only"],
      },
      { key: "luminaireWorks", label: "Luminaire works", kind: "toggle" },
    ],
  },
  water_outlet: {
    prompt: "Show the outlet and the thermometer reading if one was taken.",
    fields: [
      {
        key: "outletType",
        label: "Outlet",
        kind: "select",
        options: ["Tap", "Shower", "Sentinel outlet", "Calorifier", "Cold water tank", "Dead leg"],
      },
      { key: "temperatureC", label: "Temperature", kind: "number", unit: "°C", step: 0.5 },
      { key: "flushedWeekly", label: "Flushed weekly", kind: "toggle" },
      { key: "deadLegPresent", label: "Dead leg present", kind: "toggle" },
    ],
  },
  roof_access: {
    prompt: "Show the access point and the edge protection from a safe position.",
    fields: [
      {
        key: "accessMethod",
        label: "Access",
        kind: "select",
        options: ["Fixed ladder", "Roof hatch", "MEWP", "Scaffold", "Mansafe line", "No safe access"],
      },
      { key: "fragileSurface", label: "Fragile surface", kind: "toggle" },
      { key: "permitRequired", label: "Permit required", kind: "toggle" },
    ],
  },
  meter_reading: {
    prompt: "Frame the dials square-on so the digits cannot be misread.",
    fields: [
      {
        key: "meterType",
        label: "Meter",
        kind: "select",
        options: ["Electricity", "Gas", "Water", "Heat", "Sub-meter"],
      },
      { key: "meterSerial", label: "Serial", kind: "text", placeholder: "M-0093" },
      { key: "readingValue", label: "Reading", kind: "text", placeholder: "048221" },
    ],
  },
  pollution_incident: {
    prompt: "Show the source, the spread and where it is heading.",
    fields: [
      {
        key: "substance",
        label: "Substance",
        kind: "select",
        options: [
          "Fuel / diesel",
          "Oil / hydraulic",
          "Concrete washout",
          "Silt",
          "Chemical",
          "Sewage",
          "Paint",
          "Unknown",
        ],
      },
      { key: "volumeLitres", label: "Volume", kind: "number", unit: "L", step: 1 },
      { key: "spillKitUsed", label: "Spill kit used", kind: "toggle" },
      { key: "reachedWater", label: "Reached water", kind: "toggle" },
    ],
  },
  watercourse: {
    prompt: "Show the water and the works that could reach it.",
    fields: [
      {
        key: "waterFeature",
        label: "Feature",
        kind: "select",
        options: ["River", "Stream", "Ditch", "Pond", "Culvert", "Outfall", "Reservoir"],
      },
      { key: "distanceToWorksM", label: "Distance to works", kind: "number", unit: "m", step: 1 },
      { key: "bufferZoneMarked", label: "Buffer zone marked", kind: "toggle" },
    ],
  },
  monitoring_station: {
    prompt: "Show the monitor in position with what it is monitoring behind it.",
    fields: [
      {
        key: "monitorType",
        label: "Monitoring",
        kind: "select",
        options: ["Noise", "Dust / PM10", "Vibration", "Air quality", "Water quality"],
      },
      { key: "readingValue", label: "Reading", kind: "text", placeholder: "68 dB(A)" },
      { key: "limitExceeded", label: "Limit exceeded", kind: "toggle" },
    ],
  },
  ecology_feature: {
    prompt: "Photograph from a distance. Never approach an active nest, roost or sett.",
    fields: [
      {
        key: "featureType",
        label: "Feature",
        kind: "select",
        options: ["Nest", "Bat roost", "Badger sett", "Otter holt", "Pond / GCN", "Habitat", "Invasive species"],
      },
      { key: "species", label: "Species", kind: "text", placeholder: "If known" },
      { key: "worksHalted", label: "Works halted", kind: "toggle" },
      { key: "licenceRequired", label: "Licence required", kind: "toggle" },
    ],
  },
  protected_tree: {
    prompt: "Show the trunk, the canopy and the protective fencing together.",
    fields: [
      { key: "tpoRef", label: "TPO ref", kind: "text", placeholder: "TPO 214/3" },
      { key: "rpaFencingInPlace", label: "RPA fencing in place", kind: "toggle" },
      { key: "damageObserved", label: "Damage observed", kind: "toggle" },
    ],
  },
  waste_flytipping: {
    prompt: "Show what was dumped and where, before anyone moves it.",
    fields: [
      {
        key: "wasteStream",
        label: "Waste",
        kind: "select",
        options: [
          "Inert",
          "Mixed construction",
          "Timber",
          "Metal",
          "Plasterboard",
          "Hazardous",
          "Asbestos",
          "WEEE",
          "Household",
        ],
      },
      { key: "thirdPartyDumping", label: "Dumped by others", kind: "toggle" },
      { key: "removalArranged", label: "Removal arranged", kind: "toggle" },
    ],
  },
  neighbour_interface: {
    prompt: "Show the boundary from the neighbour's side wherever it is safe to stand.",
    fields: [
      {
        key: "interfaceType",
        label: "Interface",
        kind: "select",
        options: [
          "Boundary / party wall",
          "Shared access",
          "School or hospital nearby",
          "Residential frontage",
          "Business frontage",
          "Footpath diversion",
        ],
      },
      { key: "letterDropDone", label: "Letter drop done", kind: "toggle" },
      { key: "conditionSurveyDone", label: "Condition survey done", kind: "toggle" },
    ],
  },
  snag_defect: {
    prompt: "Close-up of the defect, then a wider shot that locates it in the building.",
    fields: [
      {
        key: "trade",
        label: "Trade",
        kind: "select",
        options: [
          "Groundworks",
          "Concrete",
          "Steelwork",
          "Brickwork",
          "Carpentry",
          "M&E",
          "Plastering",
          "Decoration",
          "Roofing",
          "Flooring",
          "Glazing",
          "External works",
        ],
      },
      { key: "severity", label: "Severity", kind: "select", options: ["Low", "Medium", "High"] },
    ],
  },
  as_built_check: {
    prompt: "Show the installed work against the drawing reference it was built to.",
    fields: [
      { key: "drawingRef", label: "Drawing", kind: "text", placeholder: "A-101 Rev C" },
      { key: "deviationMm", label: "Deviation", kind: "number", unit: "mm", step: 5 },
      { key: "matchesDrawing", label: "Matches drawing", kind: "toggle" },
    ],
  },
  sample_mockup: {
    prompt: "Show the sample against the specification or the finish it sits next to.",
    fields: [
      { key: "specRef", label: "Spec ref", kind: "text", placeholder: "Spec 10.3" },
      { key: "approvedBy", label: "Approved by", kind: "text", placeholder: "Name" },
    ],
  },
  commissioning: {
    prompt: "Show the instrument reading at the point being commissioned.",
    fields: [
      { key: "systemRef", label: "System", kind: "text", placeholder: "AHU-03" },
      { key: "testValue", label: "Result", kind: "text", placeholder: "1.2 m³/s" },
      { key: "witnessedBy", label: "Witnessed by", kind: "text", placeholder: "Name" },
    ],
  },
  handover_condition: {
    prompt: "Repeat the viewpoints from the pre-start survey, so before and after compare.",
    fields: [
      {
        key: "conditionRating",
        label: "Condition",
        kind: "select",
        options: ["As new", "Good", "Fair", "Damaged", "Incomplete"],
      },
      { key: "keysHandedOver", label: "Keys handed over", kind: "toggle" },
      { key: "preStartComparison", label: "Matches pre-start", kind: "toggle" },
    ],
  },
  hygiene_issue: {
    prompt: "Photograph the surface or equipment as found, before anyone cleans it.",
    fields: [
      {
        key: "hygieneArea",
        label: "Area",
        kind: "select",
        options: ["Food contact surface", "Equipment", "Floor / drain", "Wall / ceiling", "Storage", "Personnel"],
      },
      { key: "productAtRisk", label: "Product at risk", kind: "toggle" },
    ],
  },
  contamination_risk: {
    prompt: "Show the contaminant and the product or line it threatens.",
    fields: [
      {
        key: "contaminantType",
        label: "Contaminant",
        kind: "select",
        options: [
          "Foreign body",
          "Chemical",
          "Microbiological",
          "Allergen",
          "Glass / brittle plastic",
          "Metal",
          "Pest",
        ],
      },
      { key: "batchQuarantined", label: "Batch quarantined", kind: "toggle" },
      { key: "deviationRaised", label: "Deviation raised", kind: "toggle" },
    ],
  },
  allergen_changeover: {
    prompt: "Show the line after clean-down with the changeover record in frame.",
    fields: [
      {
        key: "allergen",
        label: "Allergen",
        kind: "select",
        options: [
          "Milk",
          "Egg",
          "Peanut",
          "Tree nuts",
          "Gluten",
          "Soya",
          "Fish",
          "Crustacean",
          "Sesame",
          "Sulphites",
          "Mustard",
          "Celery",
          "Lupin",
          "Molluscs",
        ],
      },
      { key: "cleanDownVerified", label: "Clean-down verified", kind: "toggle" },
      { key: "swabTaken", label: "Swab taken", kind: "toggle" },
    ],
  },
  high_care_access: {
    prompt: "Show the entry point and the PPE state of whoever is passing through it.",
    fields: [
      { key: "ppeComplete", label: "PPE complete", kind: "toggle" },
      { key: "handwashUsed", label: "Handwash used", kind: "toggle" },
      { key: "unauthorisedEntry", label: "Unauthorised entry", kind: "toggle" },
    ],
  },
  pest_activity: {
    prompt: "Show the evidence and the nearest bait point or entry route.",
    fields: [
      {
        key: "pestType",
        label: "Pest",
        kind: "select",
        options: ["Rodent", "Bird", "Crawling insect", "Flying insect", "Stored product insect"],
      },
      {
        key: "evidenceType",
        label: "Evidence",
        kind: "select",
        options: ["Sighting", "Droppings", "Gnawing", "Nesting", "Trap catch", "Entry point"],
      },
      { key: "contractorCalled", label: "Contractor called", kind: "toggle" },
    ],
  },
  cold_chain: {
    prompt: "Show the display reading with the unit or product identifiable.",
    fields: [
      { key: "unitRef", label: "Unit", kind: "text", placeholder: "Chiller 2" },
      { key: "temperatureC", label: "Temperature", kind: "number", unit: "°C", step: 0.1 },
      { key: "outOfSpecification", label: "Out of specification", kind: "toggle" },
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
 * An extent traced on the map leads, because the size of the thing is the hardest number
 * on the photo and every consumer of these rows wants it.
 * @param {object} photo
 * @param {{ exclude?: string[] }} [opts] keys to leave out, for callers that already say them
 * @returns {Array<[string, string]>}
 */
export function geoPhotoDetailRows(photo, opts = {}) {
  const skip = new Set(opts.exclude || []);
  const rows = [];
  const area = skip.has("area") ? null : geoPhotoAreaOf(photo);
  if (area) rows.push(["Extent", formatGeoPhotoArea(area)]);
  const details = photo?.details;
  if (!details || typeof details !== "object") return rows;
  for (const field of geoPhotoTypeFields(photo?.type)) {
    if (skip.has(field.key)) continue;
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
export function geoPhotoDetailSummary(photo, opts = {}) {
  return geoPhotoDetailRows(photo, opts)
    .map(([label, value]) => (value === "Yes" ? label : value))
    .join(" · ");
}
