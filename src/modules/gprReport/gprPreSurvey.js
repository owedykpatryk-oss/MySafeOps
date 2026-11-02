/**
 * On-site “Start here” capture for GPR reports — GPS, live weather,
 * survey days, surface, objectives and pre-survey checks.
 */
import { requestDeviceLocation } from "../../utils/geoPhotoUtils";
import { fetchWeatherSummary, resolveSiteCoordinates } from "../../utils/weatherSummary";
import { mapWeatherSnapshotToFields } from "../../utils/weatherFieldMap";
import { buildGprWeatherImpactNarrative } from "../../utils/gprGroundConditions";
import { SURFACE_TYPE_OPTIONS, MOISTURE_OPTIONS } from "./gprReportConstants";
import { todayLocalISO } from "../../utils/localDate";
import { escapeHtml } from "../../utils/htmlEscape.js";
import { formatDocumentDate as formatOrgDate, formatDocumentDateTime as formatOrgDateTime } from "../../utils/orgLocale.js";

const esc = escapeHtml;

export const GPR_SURVEY_OBJECTIVES = [
  { key: "services", label: "Buried services / utilities" },
  { key: "foundations", label: "Foundations / footings" },
  { key: "voids", label: "Voids / cavities" },
  { key: "reinforcement", label: "Reinforcement / rebar" },
  { key: "slab_thickness", label: "Slab / pavement thickness" },
  { key: "tanks_chambers", label: "Tanks / chambers / manholes" },
  { key: "archaeology", label: "Archaeology / unknown features" },
  { key: "bedrock", label: "Bedrock / geology horizon" },
  { key: "other", label: "Other (see notes)" },
];

export const GPR_PRE_SURVEY_CHECKS = [
  { key: "ramsBriefed", label: "RAMS / briefing completed on site" },
  { key: "recordsReviewed", label: "Utility records / known services reviewed" },
  { key: "accessClear", label: "Access / obstructions noted" },
  { key: "trafficInterface", label: "Traffic / public interface controlled" },
  { key: "metallicClutter", label: "Metallic clutter / parked vehicles nearby" },
  { key: "couplingOk", label: "Antenna coupling acceptable" },
  { key: "calibrationInDate", label: "Equipment calibration in date" },
  { key: "siteContactPresent", label: "Client / site contact on site" },
];

const SURVEY_SETTINGS = new Set(["unspecified", "indoor", "outdoor", "mixed"]);
const LEVEL_BELOW_OPTIONS = new Set(["unknown", "yes", "no"]);

export function isIndoorGprSurvey(report) {
  return report?.preSurvey?.surveySetting === "indoor";
}

export function blankGprSitePhoto(overrides = {}) {
  return {
    id: `psp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    dataUrl: "",
    fileName: "",
    capturedAt: "",
    caption: "General site photo",
    ...overrides,
  };
}

export function blankGprPreSurvey(overrides = {}) {
  return {
    startedAt: "",
    startedBy: "",
    lat: null,
    lng: null,
    gpsAccuracyM: null,
    gpsSource: "",
    gpsError: "",
    weather: {
      description: "",
      tempC: null,
      windMph: null,
      fetchedAt: "",
      source: "",
      text: "",
    },
    weatherError: "",
    surveySetting: "unspecified",
    levelBelow: "unknown",
    surveyDates: [],
    surfaceKeys: [],
    moisture: "dry",
    objectives: [],
    objectiveNotes: "",
    siteChecks: Object.fromEntries(GPR_PRE_SURVEY_CHECKS.map((c) => [c.key, false])),
    photos: [],
    notes: "",
    ...overrides,
  };
}

export function normalizeGprPreSurvey(raw) {
  const base = blankGprPreSurvey();
  if (!raw || typeof raw !== "object") return base;
  const weather = { ...base.weather, ...(raw.weather || {}) };
  const siteChecks = { ...base.siteChecks, ...(raw.siteChecks || {}) };
  const surveyDates = Array.isArray(raw.surveyDates)
    ? raw.surveyDates.map((d) => String(d || "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    : base.surveyDates;
  const surfaceKeys = Array.isArray(raw.surfaceKeys) ? raw.surfaceKeys.filter(Boolean) : base.surfaceKeys;
  const objectives = Array.isArray(raw.objectives) ? raw.objectives.filter(Boolean) : base.objectives;
  const photos = Array.isArray(raw.photos) ? raw.photos.filter((p) => p && typeof p === "object") : [];
  return {
    ...base,
    ...raw,
    weather,
    siteChecks,
    surveyDates,
    surfaceKeys,
    objectives,
    photos,
    surveySetting: SURVEY_SETTINGS.has(raw.surveySetting) ? raw.surveySetting : base.surveySetting,
    levelBelow: LEVEL_BELOW_OPTIONS.has(raw.levelBelow) ? raw.levelBelow : base.levelBelow,
    moisture: raw.moisture || base.moisture,
  };
}

export function isGprPreSurveyStarted(ps) {
  return Boolean(ps?.startedAt);
}

export function toggleListKey(list = [], key) {
  const set = new Set(list);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return [...set];
}

export function objectiveLabels(keys = []) {
  return keys
    .map((k) => GPR_SURVEY_OBJECTIVES.find((o) => o.key === k)?.label)
    .filter(Boolean);
}

export function surfaceLabels(keys = []) {
  return keys
    .map((k) => SURFACE_TYPE_OPTIONS.find((o) => o.key === k)?.label)
    .filter(Boolean);
}

export function moistureLabel(key) {
  return MOISTURE_OPTIONS.find((o) => o.key === key)?.label || key || "—";
}

export function buildPreSurveyScopeLine(ps) {
  const n = normalizeGprPreSurvey(ps);
  const labels = objectiveLabels(n.objectives);
  const note = String(n.objectiveNotes || "").trim();
  const parts = [];
  if (labels.length) parts.push(`Survey objectives: ${labels.join("; ")}.`);
  if (note) parts.push(note);
  if (n.surveySetting !== "unspecified") {
    parts.push(`Survey setting: ${{ indoor: "indoors", outdoor: "outdoors", mixed: "mixed indoor and outdoor" }[n.surveySetting]}.`);
  }
  if ((n.surveySetting === "indoor" || n.surveySetting === "mixed") && n.levelBelow !== "unknown") {
    parts.push(`Site context records another building level below the scanned slab: ${n.levelBelow}. This is not inferred from GPR data.`);
  }
  return parts.join(" ");
}

function parseProjectPin(project) {
  const lat = parseFloat(String(project?.lat ?? project?.siteLat ?? "").trim());
  const lng = parseFloat(String(project?.lng ?? project?.siteLng ?? "").trim());
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

/**
 * Stamp GPS and, for non-indoor work, optional live weather at the moment of the tap.
 * Does not wipe photos, objectives or site checks already entered.
 */
export async function captureGprStartHere({ project, report } = {}) {
  const startedAt = new Date().toISOString();
  let lat = null;
  let lng = null;
  let gpsAccuracyM = null;
  let gpsSource = "";
  let gpsError = "";

  try {
    const pos = await requestDeviceLocation();
    lat = pos.latitude;
    lng = pos.longitude;
    gpsAccuracyM = Number.isFinite(pos.accuracy) ? pos.accuracy : null;
    gpsSource = "device";
  } catch (e) {
    gpsError = e?.message || "GPS unavailable";
    const pin = parseProjectPin(project);
    if (pin) {
      lat = pin.lat;
      lng = pin.lng;
      gpsSource = "project_pin";
    } else {
      try {
        const resolved = await resolveSiteCoordinates("", "", project?.postcode || report?.siteAddress);
        if (resolved) {
          lat = resolved.lat;
          lng = resolved.lng;
          gpsSource = "postcode";
        }
      } catch {
        /* leave coords empty */
      }
    }
  }

  let weather = blankGprPreSurvey().weather;
  let weatherError = "";
  if (!isIndoorGprSurvey(report)) {
    try {
      const snap = await fetchWeatherSummary(lat, lng, {
        postcode: project?.postcode || report?.siteAddress,
      });
      weather = {
        description: snap.description || "",
        tempC: snap.tempC ?? null,
        windMph: snap.windMph ?? null,
        fetchedAt: snap.fetchedAt || startedAt,
        source: snap.source || "",
        text: snap.text || "",
      };
    } catch (e) {
      weatherError = e?.message || "Weather lookup failed";
    }
  }

  const prev = normalizeGprPreSurvey(report?.preSurvey);
  const seedDate = report?.surveyDate || todayLocalISO();
  const surveyDates = prev.surveyDates.length ? prev.surveyDates : [seedDate];

  return {
    startedAt,
    startedBy: report?.surveyor || prev.startedBy || "",
    lat,
    lng,
    gpsAccuracyM,
    gpsSource,
    gpsError,
    weather,
    weatherError,
    surveyDates,
  };
}

export function applyGprStartHereCapture(report, capture = {}) {
  const prev = normalizeGprPreSurvey(report?.preSurvey);
  const next = {
    ...prev,
    startedAt: capture.startedAt || prev.startedAt,
    startedBy: capture.startedBy || prev.startedBy,
    lat: capture.lat ?? prev.lat,
    lng: capture.lng ?? prev.lng,
    gpsAccuracyM: capture.gpsAccuracyM ?? prev.gpsAccuracyM,
    gpsSource: capture.gpsSource || prev.gpsSource,
    gpsError: capture.gpsError ?? prev.gpsError,
    weather: { ...prev.weather, ...(capture.weather || {}) },
    weatherError: capture.weatherError ?? prev.weatherError,
    surveyDates: Array.isArray(capture.surveyDates) && capture.surveyDates.length ? capture.surveyDates : prev.surveyDates,
  };

  const w = next.weather;
  let environmental = report?.environmental || {};
  if (!isIndoorGprSurvey(report) && (w.description || w.fetchedAt)) {
    const mapped = mapWeatherSnapshotToFields({
      description: w.description,
      tempC: w.tempC,
      windMph: w.windMph,
    });
    const env = {
      ...environmental,
      description: w.description || environmental.description,
      groundSurface: mapped.groundSurface,
      rainDuringSurvey: mapped.rainDuringSurvey,
      phenomena: mapped.phenomena,
      tempC: w.tempC ?? environmental.tempC,
      windMph: w.windMph ?? environmental.windMph,
      fetchedAt: w.fetchedAt || environmental.fetchedAt,
      source: w.source || environmental.source,
    };
    env.moistureImpactOnGpr = buildGprWeatherImpactNarrative(env);
    environmental = env;
  }

  const firstDate = next.surveyDates[0] || report?.surveyDate || todayLocalISO();
  const obs = report?.groundConditions?.siteObservations || {};
  const surfaceType = next.surfaceKeys.length === 1 ? next.surfaceKeys[0] : next.surfaceKeys.length > 1 ? "mixed" : obs.surfaceType;

  return {
    ...report,
    surveyDate: report?.surveyDate || firstDate,
    preSurvey: next,
    environmental,
    groundConditions: {
      ...(report?.groundConditions || {}),
      siteObservations: {
        ...obs,
        surfaceType: surfaceType || obs.surfaceType,
        moisture: next.moisture || obs.moisture,
      },
    },
  };
}

export function formatPreSurveyCoord(lat, lng, accuracyM) {
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return "";
  const acc =
    accuracyM != null && Number.isFinite(Number(accuracyM)) ? ` (±${Math.round(Number(accuracyM))} m)` : "";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}${acc}`;
}

export function preSurveyGpsSourceLabel(source) {
  return (
    {
      device: "Device GPS at Start here",
      project_pin: "Project map pin (GPS unavailable)",
      postcode: "Postcode / address centroid",
    }[source] || source || ""
  );
}

/**
 * Print HTML for the pre-survey start section. Empty when never started and no field notes.
 */
export function buildGprPreSurveyPrintHtml(ps) {
  const n = normalizeGprPreSurvey(ps);
  const started = isGprPreSurveyStarted(n);
  const hasNotes = Boolean(
    n.objectives.length ||
      n.surveySetting !== "unspecified" ||
      n.levelBelow !== "unknown" ||
      n.surfaceKeys.length ||
      n.photos.length ||
      String(n.notes || "").trim() ||
      String(n.objectiveNotes || "").trim() ||
      n.surveyDates.length
  );
  if (!started && !hasNotes) return "";

  const coord = formatPreSurveyCoord(n.lat, n.lng, n.gpsAccuracyM);
  const weatherBits = [
    n.weather.description,
    n.weather.tempC != null ? `${n.weather.tempC}°C` : "",
    n.weather.windMph != null ? `wind ~${n.weather.windMph} mph` : "",
  ].filter(Boolean);
  const dates = n.surveyDates.length
    ? n.surveyDates.map((d) => formatOrgDate(d)).join(" · ")
    : "—";
  const checksDone = GPR_PRE_SURVEY_CHECKS.filter((c) => n.siteChecks[c.key]).map((c) => c.label);
  const checksOpen = GPR_PRE_SURVEY_CHECKS.filter((c) => !n.siteChecks[c.key]).map((c) => c.label);

  const photos = (n.photos || []).filter((p) => p.dataUrl);
  const photoPages = [];
  for (let i = 0; i < photos.length; i += 10) {
    const slice = photos.slice(i, i + 10);
    photoPages.push(
      `<div class="gpr-site-photo-page">${slice
        .map(
          (p) =>
            `<figure><img src="${esc(p.dataUrl)}" alt="${esc(p.caption || "Site photo")}"/><figcaption>${esc(p.caption || "Site photo")}${p.capturedAt ? ` · ${esc(formatOrgDateTime(p.capturedAt))}` : ""}</figcaption></figure>`
        )
        .join("")}</div>`
    );
  }
  const photoHtml = photoPages.length
    ? `<p><strong>Site photographs</strong> <span style="color:#64748b;font-size:8pt">Up to 10 per page.</span></p>${photoPages.join("")}`
    : started
      ? `<p><em>No general site photographs attached.</em></p>`
      : "";

  const meta = [
    ["Started", n.startedAt ? formatOrgDateTime(n.startedAt) : "—"],
    ["Started by", n.startedBy || "—"],
    ["GPS", coord || n.gpsError || "—"],
    ["Position source", preSurveyGpsSourceLabel(n.gpsSource) || "—"],
    ...(n.surveySetting !== "unspecified" ? [["Survey setting", { indoor: "Indoors", outdoor: "Outdoors", mixed: "Mixed indoor and outdoor" }[n.surveySetting]]] : []),
    ...(n.surveySetting === "indoor" || n.surveySetting === "mixed"
      ? [["Another level below scanned slab", { yes: "Yes", no: "No", unknown: "Not confirmed" }[n.levelBelow]]]
      : []),
    ...(n.surveySetting !== "indoor" && weatherBits.length
      ? [["Weather at start (optional)", weatherBits.join(", ")]]
      : []),
    ["Survey day(s)", dates],
    ["Surface / substrate", surfaceLabels(n.surfaceKeys).join("; ") || "—"],
    ["Ground moisture", moistureLabel(n.moisture)],
    ["Looking for", objectiveLabels(n.objectives).join("; ") || "—"],
  ];

  return [
    `<p>Field start snapshot taken when the surveyor tapped <strong>Start here</strong>. GPS was recorded at that moment${n.surveySetting === "indoor" ? "." : "; optional weather was captured where available."}</p>`,
    `<div class="gpr-meta-grid">${meta
      .map(
        ([k, v]) =>
          `<div class="gpr-meta-item"><div class="gpr-meta-key">${esc(k)}</div><div class="gpr-meta-val">${esc(v)}</div></div>`
      )
      .join("")}</div>`,
    n.objectiveNotes ? `<p><strong>Objective notes:</strong> ${esc(n.objectiveNotes)}</p>` : "",
    n.surveySetting === "indoor" || n.surveySetting === "mixed"
      ? `<p><em>The presence or absence of another building level below is site context, not a conclusion from GPR data. Confirm against building plans or direct observation.</em></p>`
      : "",
    checksDone.length
      ? `<p><strong>Pre-survey checks completed:</strong> ${esc(checksDone.join("; "))}.</p>`
      : "",
    checksOpen.length && started
      ? `<p><em>Not ticked: ${esc(checksOpen.join("; "))}.</em></p>`
      : "",
    n.notes ? `<p><strong>Field notes:</strong> ${esc(n.notes)}</p>` : "",
    photoHtml,
  ].join("");
}

export { SURFACE_TYPE_OPTIONS, MOISTURE_OPTIONS };
