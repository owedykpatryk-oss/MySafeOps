export const GPR_EVIDENCE_KINDS = [
  { key: "historic_map", label: "Historic map" },
  { key: "aerial_photo", label: "Historic aerial photograph" },
  { key: "satellite", label: "Satellite imagery" },
  { key: "heritage_record", label: "Heritage / archaeology record" },
  { key: "planning_record", label: "Planning / demolition record" },
  { key: "bgs_geology", label: "BGS mapped geology" },
  { key: "other", label: "Other verified source" },
];

export const GPR_AI_RELEVANCE = {
  high: "High relevance",
  moderate: "Moderate relevance",
  low: "Low relevance",
  not_relevant: "Not relevant to this GPR review",
};

export const GPR_AI_MECHANISMS = {
  former_foundations: "Possible response from former foundations / wall footings",
  buried_demolition_material: "Possible heterogeneous response from demolition material",
  disturbed_or_made_ground: "Possible disturbed or made-ground response",
  possible_void_or_cellar: "Possible void / cellar response requiring correlation",
  historic_services_or_drainage: "Possible historic service or drainage response",
  grave_or_burial_features: "Possible burial-feature response; specialist review required",
  geological_attenuation: "Possible signal attenuation from mapped geology",
  geological_clutter: "Possible geological clutter / natural reflectors",
  none: "No specific GPR response mechanism assigned",
};

export const GPR_AI_ACTIONS = {
  correlate_with_radargrams: "Correlate against radargrams and adjacent lines",
  target_orthogonal_lines: "Acquire orthogonal confirmation lines where practicable",
  increase_line_density: "Increase line density over the area of interest",
  compare_with_current_plan: "Compare historic evidence against the current survey plan",
  seek_additional_archive_source: "Seek a second independent archive source",
  confirm_by_intrusive_method: "Use an approved intrusive verification method before reliance",
  record_as_context_only: "Retain as desk-study context only",
  none: "No additional action generated",
};

export const GPR_AI_CAVEATS = {
  source_is_not_site_investigation: "The source is desk-study evidence, not a site investigation.",
  historic_feature_extent_uncertain: "The historic feature extent may not match current boundaries.",
  map_registration_may_be_approximate: "Historic map registration may be approximate.",
  image_date_or_coverage_limited: "Image date or coverage limits the conclusion.",
  correlation_not_causation: "Spatial correlation would not by itself prove the cause of a GPR anomaly.",
  none: "No additional source-specific caveat assigned.",
};

export function blankGprEvidence(overrides = {}) {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: "historic_map",
    title: "",
    sourceName: "",
    sourceUrl: "",
    sourceDate: "",
    observedFact: "",
    coverageNotes: "",
    imageDataUrl: "",
    imageFileName: "",
    verified: false,
    verifiedBy: "",
    verifiedAt: "",
    ...overrides,
  };
}

export function normalizeGprEvidence(raw) {
  const allowedKinds = new Set(GPR_EVIDENCE_KINDS.map((item) => item.key));
  const base = blankGprEvidence();
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    ...base,
    ...value,
    id: String(value.id || base.id),
    kind: allowedKinds.has(value.kind) ? value.kind : "other",
    verified: value.verified === true,
  };
}

function geologyLabel(unit) {
  return String(unit?.lexDescription || unit?.lithology || unit?.name || "").trim();
}

/** Build a trusted evidence item from the exact BGS response already accepted for the report point. */
export function buildBgsEvidence(report) {
  const gc = report?.groundConditions || {};
  if (!gc.fetchedAt || !gc.locationVerified || !Number.isFinite(Number(gc.queryLat)) || !Number.isFinite(Number(gc.queryLng))) {
    return null;
  }
  const units = [
    ["Bedrock", geologyLabel(gc.bedrock)],
    ["Superficial", geologyLabel(gc.superficial)],
    ["Artificial ground", geologyLabel(gc.artificial)],
    ["Mass movement", geologyLabel(gc.massMovement)],
  ].filter(([, value]) => value);
  if (!units.length) return null;
  return {
    id: "bgs_verified_point",
    kind: "bgs_geology",
    title: `BGS mapped geology at ${Number(gc.queryLat).toFixed(5)}, ${Number(gc.queryLng).toFixed(5)}`,
    sourceName: "British Geological Survey",
    sourceUrl: "https://geologyviewer.bgs.ac.uk/",
    sourceDate: String(gc.fetchedAt),
    observedFact: units.map(([label, value]) => `${label}: ${value}`).join("; "),
    verified: true,
    systemVerified: true,
  };
}

export function verifiedGprEvidence(report) {
  const manual = (report?.historicalEvidence || [])
    .map(normalizeGprEvidence)
    .filter((item) => item.verified && item.observedFact.trim() && /^https:\/\//i.test(item.sourceUrl));
  const bgs = buildBgsEvidence(report);
  return bgs ? [bgs, ...manual] : manual;
}

export function buildGprEvidenceReviewPayload(report) {
  return {
    reportRef: report?.ref || "",
    siteAddress: report?.siteAddress || report?.projectName || "",
    evidence: verifiedGprEvidence(report).map(({ imageDataUrl: _image, coverageNotes: _notes, ...item }) => item),
  };
}

export function historicalResearchLinks(report, project) {
  const lat = Number(project?.lat ?? project?.siteLat ?? report?.groundConditions?.queryLat);
  const lng = Number(project?.lng ?? project?.siteLng ?? report?.groundConditions?.queryLng);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const query = encodeURIComponent(report?.siteAddress || project?.address || project?.postcode || "");
  return [
    {
      key: "nls",
      label: "NLS historic maps",
      url: hasPoint
        ? `https://maps.nls.uk/geo/explore/#zoom=17.0&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`
        : "https://maps.nls.uk/geo/explore/",
      note: "Georeferenced historic Ordnance Survey mapping; record the sheet date and link.",
    },
    {
      key: "pastmap",
      label: "PastMap Scotland",
      url: "https://pastmap.org.uk/map",
      note: "Archaeology, historic environment records, historic mapping and aerial layers.",
    },
    {
      key: "trove",
      label: "Trove Scotland archive",
      url: query ? `https://www.trove.scot/search?search=${query}` : "https://www.trove.scot/",
      note: "Historic Environment Scotland archive records and images; check reuse rights per item.",
    },
    {
      key: "bgs",
      label: "BGS Geology Viewer",
      url: "https://geologyviewer.bgs.ac.uk/",
      note: "Cross-check the accepted BGS point and mapped units.",
    },
  ];
}

const RELEVANCE_KEYS = new Set(Object.keys(GPR_AI_RELEVANCE));
const MECHANISM_KEYS = new Set(Object.keys(GPR_AI_MECHANISMS));
const ACTION_KEYS = new Set(Object.keys(GPR_AI_ACTIONS));
const CAVEAT_KEYS = new Set(Object.keys(GPR_AI_CAVEATS));

/** Drop any classification that is not a closed enum tied to a currently verified evidence id. */
export function sanitizeEvidenceAssessments(assessments, evidenceIds) {
  const expected = new Set((evidenceIds || []).map((id) => String(id || "")));
  const seen = new Set();
  const clean = [];
  for (const item of Array.isArray(assessments) ? assessments : []) {
    const evidenceId = String(item?.evidenceId || "");
    if (!expected.has(evidenceId) || seen.has(evidenceId)) continue;
    if (!RELEVANCE_KEYS.has(item?.relevance) || !CAVEAT_KEYS.has(item?.caveat)) continue;
    if (!Array.isArray(item?.mechanisms) || item.mechanisms.some((key) => !MECHANISM_KEYS.has(key))) continue;
    if (!Array.isArray(item?.recommendedActions) || item.recommendedActions.some((key) => !ACTION_KEYS.has(key))) continue;
    seen.add(evidenceId);
    clean.push({
      evidenceId,
      relevance: item.relevance,
      mechanisms: [...new Set(item.mechanisms)].slice(0, 4),
      recommendedActions: [...new Set(item.recommendedActions)].slice(0, 4),
      caveat: item.caveat,
    });
  }
  return clean;
}

export function safeEvidenceImageSrc(value) {
  const src = String(value || "");
  return /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(src) ? src : "";
}

export function mergeGprEvidenceReview(report, apiResult) {
  const evidenceIds = verifiedGprEvidence(report).map((item) => item.id);
  return {
    ...report,
    evidenceReview: {
      assessments: sanitizeEvidenceAssessments(apiResult?.assessments, evidenceIds),
      model: String(apiResult?.model || "").slice(0, 80),
      reviewedAt: String(apiResult?.reviewedAt || new Date().toISOString()).slice(0, 40),
      requestId: String(apiResult?.requestId || "").slice(0, 80),
      usage: apiResult?.usage && typeof apiResult.usage === "object" ? {
        input_tokens: Number(apiResult.usage.input_tokens) || 0,
        output_tokens: Number(apiResult.usage.output_tokens) || 0,
      } : null,
      estimatedCostUsd: Number(apiResult?.estimatedCostUsd) || 0,
      policy: "verified-evidence-only",
    },
  };
}
