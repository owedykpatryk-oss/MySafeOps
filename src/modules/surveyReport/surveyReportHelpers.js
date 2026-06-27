import {
  LIMITATION_RULES,
  WEATHER_PHENOMENA,
  METHODS_AFFECTED,
  GROUND_SURFACE_OPTIONS,
  RAIN_DURING_SURVEY,
  UTILITY_RECORDS_SOURCES,
  UTILITY_RECORDS_OUTCOMES,
  UTILITY_RECORDS_GAPS,
  ACCESS_LIMITATION_TYPES,
  SURVEY_TYPES,
} from "./surveyReportConstants";

const labelOf = (options, key) => options.find((o) => o.key === key)?.label || key;

export function buildLimitationsFromKeys(keys, extraText = "") {
  const sentences = (keys || [])
    .map((k) => LIMITATION_RULES.find((r) => r.key === k)?.text)
    .filter(Boolean);
  const base = sentences.join(" ");
  const extra = String(extraText || "").trim();
  if (base && extra) return `${base} ${extra}`;
  return base || extra;
}

export function buildWeatherNarrative(weather) {
  if (!weather) return "";
  const parts = [];
  const gs = labelOf(GROUND_SURFACE_OPTIONS, weather.groundSurface);
  const rain = labelOf(RAIN_DURING_SURVEY, weather.rainDuringSurvey);
  if (weather.groundSurface && weather.groundSurface !== "unknown") parts.push(`Ground surface: ${gs}.`);
  if (weather.rainDuringSurvey && weather.rainDuringSurvey !== "unknown") parts.push(`Rain: ${rain}.`);
  if (weather.phenomena?.length) {
    parts.push(`Conditions observed: ${weather.phenomena.map((k) => labelOf(WEATHER_PHENOMENA, k)).join(", ")}.`);
  }
  if (weather.methodsAffected?.length) {
    parts.push(`Methods potentially affected: ${weather.methodsAffected.map((k) => labelOf(METHODS_AFFECTED, k)).join(", ")}.`);
  }
  if (weather.conditionsNarrative?.trim()) parts.push(weather.conditionsNarrative.trim());
  if (weather.equipmentMethodImpact?.trim()) parts.push(weather.equipmentMethodImpact.trim());
  return parts.join(" ");
}

export function buildUtilityRecordsNarrative(records) {
  if (!records) return "";
  const parts = [];
  if (records.sourcesConsulted?.length) {
    parts.push(`Sources consulted: ${records.sourcesConsulted.map((k) => labelOf(UTILITY_RECORDS_SOURCES, k)).join("; ")}.`);
  }
  if (records.outcomes?.length) {
    parts.push(`Outcomes: ${records.outcomes.map((k) => labelOf(UTILITY_RECORDS_OUTCOMES, k)).join("; ")}.`);
  }
  if (records.informationGaps?.length) {
    parts.push(`Information gaps: ${records.informationGaps.map((k) => labelOf(UTILITY_RECORDS_GAPS, k)).join("; ")}.`);
  }
  if (records.whatWasFound?.trim()) parts.push(records.whatWasFound.trim());
  if (records.whatWasNotFound?.trim()) parts.push(records.whatWasNotFound.trim());
  if (records.gapExplanation?.trim()) parts.push(records.gapExplanation.trim());
  return parts.join(" ");
}

export function buildAccessLimitationsText(keys, notes) {
  const labels = (keys || []).map((k) => labelOf(ACCESS_LIMITATION_TYPES, k));
  const base = labels.length ? `Access limitations noted: ${labels.join("; ")}.` : "";
  const extra = String(notes || "").trim();
  if (base && extra) return `${base} ${extra}`;
  return base || extra;
}

export function surveyTypeLabel(key) {
  return labelOf(SURVEY_TYPES, key);
}

/** Completeness score 0–100 and list of missing items for quality nudges. */
export function surveyReportQuality(report) {
  const checks = [];
  const add = (ok, label) => checks.push({ ok, label });

  add(!!report.title?.trim(), "Report title");
  add(!!report.surveyDate, "Survey date");
  add(!!report.surveyor?.trim(), "Surveyor / author");
  add(!!report.siteAddress?.trim() || !!report.projectName, "Site / project");
  add(!!report.surveyType, "Survey type");
  add(!!report.sections?.scope?.trim(), "Scope of works");
  add(!!report.sections?.methodology?.trim(), "Methodology");
  add(!!report.sections?.findings?.trim(), "Findings / results");
  add(
    (report.limitationKeys?.length || 0) > 0 || !!report.limitationsText?.trim(),
    "Limitations"
  );
  add(
    buildWeatherNarrative(report.weather).length > 0 ||
      report.weather?.conditionsNarrative?.trim(),
    "Weather at site"
  );

  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return {
    score,
    checks,
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export function nextSurveyRef(existing) {
  const year = new Date().getFullYear();
  const prefix = `SR-${year}-`;
  const nums = (existing || [])
    .map((r) => r.ref)
    .filter((ref) => ref && ref.startsWith(prefix))
    .map((ref) => parseInt(ref.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function toggleArray(arr, key) {
  const set = new Set(arr || []);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return [...set];
}
