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
  UTILITY_TYPE_OPTIONS,
  UTILITY_CONFIDENCE_LEVELS,
  DELIVERABLE_FORMAT_OPTIONS,
  RECORD_REF_STATUS_OPTIONS,
  blankSurveyReport,
  SURVEY_PHOTO_CATEGORIES,
} from "./surveyReportConstants";
import { getQaChecklistItemsForSurveyType, getQaChecklistProgress, SURVEY_PUBLIC_STANDARDS } from "./surveyQaPack";
import { mergeSpecialistTables } from "./surveySpecialistFindings";
import { safeImageSrc } from "../../utils/htmlEscape.js";
import { safeHttpUrl } from "../../utils/safeUrl.js";

const labelOf = (options, key) => options.find((o) => o.key === key)?.label || key;

function sanitizeSurveyPhoto(photo) {
  if (!photo || typeof photo !== "object") return photo;
  const dataUrl = safeImageSrc(photo.dataUrl);
  const url = safeHttpUrl(photo.url);
  const rawCategory = photo.category || "field_work";
  const category = SURVEY_PHOTO_CATEGORIES.some((c) => c.key === rawCategory) ? rawCategory : "field_work";
  return {
    ...photo,
    dataUrl: dataUrl || "",
    url: url || "",
    category,
  };
}

/** Merge saved report with defaults for nested fields added in later versions. */
export function normalizeSurveyReport(report) {
  const blank = blankSurveyReport();
  if (!report) return blank;
  return {
    ...blank,
    ...report,
    photos: (report.photos || []).map(sanitizeSurveyPhoto),
    weather: { ...blank.weather, ...(report.weather || {}) },
    utilityRecords: { ...blank.utilityRecords, ...(report.utilityRecords || {}) },
    sections: { ...blank.sections, ...(report.sections || {}) },
    documentControl: { ...blank.documentControl, ...(report.documentControl || {}) },
    surveyProgramme: { ...blank.surveyProgramme, ...(report.surveyProgramme || {}) },
    controlAccuracy: { ...blank.controlAccuracy, ...(report.controlAccuracy || {}) },
    qaChecklist: { ...blank.qaChecklist, ...(report.qaChecklist || {}) },
    standardsCited: Array.isArray(report.standardsCited) ? report.standardsCited : [],
    hseRefs: { ...blank.hseRefs, ...(report.hseRefs || {}) },
    uavCompliance: { ...blank.uavCompliance, ...(report.uavCompliance || {}) },
    signatures: { ...blank.signatures, ...(report.signatures || {}) },
    equipmentCalibration: report.equipmentCalibration || [],
    deliverables: report.deliverables || [],
    recordsReferences: report.recordsReferences || [],
    dbydEnquiries: report.dbydEnquiries || [],
    undertakerResponses: report.undertakerResponses || [],
    trialHolesTable: report.trialHolesTable || [],
    utilitiesTable: report.utilitiesTable || [],
    giLocationsTable: report.giLocationsTable || [],
    revisionHistory: report.revisionHistory || [],
    changesSincePrevious: report.changesSincePrevious || [],
    parentReportId: report.parentReportId || "",
    parentRevision: report.parentRevision || "",
    cadImport: report.cadImport || null,
    ...mergeSpecialistTables(report),
  };
}

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
  if (weather.tempC != null || weather.tempMinC != null) {
    const temp =
      weather.tempMinC != null && weather.tempC != null && weather.tempMinC !== weather.tempC
        ? `${weather.tempMinC}–${weather.tempC}°C`
        : weather.tempC != null
          ? `${weather.tempC}°C`
          : `${weather.tempMinC}°C`;
    parts.push(`Temperature: ${temp}.`);
  }
  if (weather.windMph != null && !Number.isNaN(Number(weather.windMph))) {
    parts.push(`Wind: up to ~${Number(weather.windMph).toFixed(1)} mph.`);
  }
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

export function buildQaChecklistNarrative(qa, surveyType = "") {
  if (!qa) return "";
  const items = getQaChecklistItemsForSurveyType(surveyType);
  const lines = items.map(({ key, label }) => {
    const ok = Boolean(qa[key]);
    return `${ok ? "Yes" : "No"} — ${label}`;
  });
  return lines.join("\n");
}

export function buildStandardsCitedNarrative(keys = []) {
  const cited = (keys || [])
    .map((k) => SURVEY_PUBLIC_STANDARDS.find((s) => s.key === k)?.label)
    .filter(Boolean);
  if (!cited.length) return "";
  return `This report has been prepared with reference to: ${cited.join("; ")}. Applicability is stated in the scope and methodology sections.`;
}

/** Photo evidence coverage by category — for nudges and list badges. */
export function surveyPhotoCategoryCoverage(photos = []) {
  const used = new Set((photos || []).map((p) => p.category || "field_work"));
  const covered = SURVEY_PHOTO_CATEGORIES.filter((c) => used.has(c.key));
  const missing = SURVEY_PHOTO_CATEGORIES.filter((c) => !used.has(c.key));
  return {
    covered: covered.length,
    total: SURVEY_PHOTO_CATEGORIES.length,
    missingLabels: missing.map((c) => c.label),
    hasPhotos: (photos || []).length > 0,
  };
}

export function utilityTypeLabel(key) {
  return labelOf(UTILITY_TYPE_OPTIONS, key);
}

export function utilityConfidenceLabel(key) {
  return labelOf(UTILITY_CONFIDENCE_LEVELS, key);
}

export function deliverableFormatLabel(key) {
  return labelOf(DELIVERABLE_FORMAT_OPTIONS, key);
}

export function recordRefStatusLabel(key) {
  return labelOf(RECORD_REF_STATUS_OPTIONS, key);
}

export function buildSurveyProgrammeNarrative(programme) {
  if (!programme) return "";
  const parts = [];
  if (programme.startTime || programme.endTime) {
    parts.push(`Site attendance: ${programme.startTime || "—"} to ${programme.endTime || "—"}.`);
  }
  if (programme.hoursOnSite?.trim()) parts.push(`Hours on site: ${programme.hoursOnSite.trim()}.`);
  if (programme.personnel?.trim()) parts.push(`Personnel: ${programme.personnel.trim()}.`);
  if (programme.siteAccessNotes?.trim()) parts.push(programme.siteAccessNotes.trim());
  return parts.join(" ");
}

export function buildControlAccuracyNarrative(control) {
  if (!control) return "";
  const parts = [];
  if (control.coordinateSystem?.trim()) parts.push(`Coordinate system: ${control.coordinateSystem.trim()}.`);
  if (control.controlSource?.trim()) parts.push(`Control source: ${control.controlSource.trim()}.`);
  if (control.horizontalTolerance?.trim()) parts.push(`Horizontal tolerance: ${control.horizontalTolerance.trim()}.`);
  if (control.verticalTolerance?.trim()) parts.push(`Vertical tolerance: ${control.verticalTolerance.trim()}.`);
  if (control.traverseClosure?.trim()) parts.push(`Traverse closure: ${control.traverseClosure.trim()}.`);
  if (control.levelClosure?.trim()) parts.push(`Level closure: ${control.levelClosure.trim()}.`);
  if (control.controlPointsNotes?.trim()) parts.push(control.controlPointsNotes.trim());
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

/** CSS tone for survey type chips in list / hero. */
export function surveyTypeChipTone(surveyType) {
  const map = {
    utility_mapping_survey: "utility",
    eml_cat_survey: "utility",
    gpr_survey: "gpr",
    topographical_survey: "topo",
    setting_out: "topo",
    gnss_control: "topo",
    cctv_drainage_survey: "drainage",
    site_investigation_campaign: "gi",
    uav_aerial: "uav",
    laser_scanning: "scan",
  };
  return map[String(surveyType || "").trim()] || "general";
}

/** Small static map thumbnail for editor hero (OpenStreetMap.de). */
export function surveyStaticMapThumbUrl(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "";
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${la},${lo}&zoom=14&size=96x96&markers=${la},${lo},red-pushpin`;
}

/** Completeness score 0–100 and list of missing items for quality nudges. */
export function surveyReportQuality(report) {
  const r = normalizeSurveyReport(report);
  const checks = [];
  const add = (ok, label) => checks.push({ ok, label });

  add(!!r.title?.trim(), "Report title");
  add(!!r.surveyDate, "Survey date");
  add(!!r.surveyor?.trim(), "Surveyor / author");
  add(!!r.siteAddress?.trim() || !!r.projectName, "Site / project");
  add(!!r.surveyType, "Survey type");
  add(!!r.sections?.scope?.trim(), "Scope of works");
  add(!!r.sections?.methodology?.trim(), "Methodology");
  add(!!r.sections?.findings?.trim(), "Findings / results");
  add(!!r.sections?.executiveSummary?.trim(), "Executive summary");
  add(!!r.sections?.recommendations?.trim(), "Recommendations");
  add((r.utilityRecords?.sourcesConsulted?.length || 0) > 0 || (r.dbydEnquiries || []).length > 0, "Records review");
  add((r.limitationKeys?.length || 0) > 0 || !!r.limitationsText?.trim(), "Limitations");
  add(
    buildWeatherNarrative(r.weather).length > 0 || r.weather?.conditionsNarrative?.trim(),
    "Weather at site"
  );
  add(!!r.documentControl?.preparedBy?.trim() || !!r.surveyor?.trim(), "Document control");
  const hasFindingsData =
    (r.utilitiesTable?.length || 0) > 0 ||
    (r.giLocationsTable?.length || 0) > 0 ||
    (r.trialHolesTable || []).length > 0 ||
    (r.cctvRunsTable || []).length > 0 ||
    (r.uavFlightsTable || []).length > 0 ||
    (r.laserScansTable || []).length > 0 ||
    !!r.sections?.findings?.trim();
  add(hasFindingsData, r.surveyType === "site_investigation_campaign" ? "GI location schedule or findings" : "Utility schedule or findings");
  add(Boolean(r.cadImport?.summary?.length) || r.surveyType !== "utility_mapping_survey", "CAD length summary");
  add(Object.values(r.qaChecklist || {}).some(Boolean), "QA checklist");
  const qaProg = getQaChecklistProgress(r.qaChecklist, r.surveyType);
  add(!r.surveyType || qaProg.pct >= 50 || qaProg.total < 8, "QA checklist (50%+)");
  add((r.standardsCited || []).length > 0, "Standards referenced");
  add((r.equipmentCalibration || []).length > 0, "Equipment calibration");

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

/** Append revision history entry when report is marked final. */
export function finalizeReportRevision(report) {
  const r = normalizeSurveyReport(report);
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const dc = {
    ...r.documentControl,
    issueDate: r.documentControl.issueDate || r.surveyDate || isoDate,
  };
  const history = [...(r.revisionHistory || [])];
  const entry = {
    id: `rev_${Date.now()}`,
    date: isoDate,
    revision: dc.revision || "A",
    author: dc.preparedBy || r.surveyor || "",
    description: "Marked final",
  };
  if (!history.some((h) => h.revision === entry.revision && h.description === entry.description)) {
    history.push(entry);
  }
  return {
    ...r,
    documentControl: dc,
    revisionHistory: history,
    signatures: {
      ...r.signatures,
      surveyorName: r.signatures.surveyorName || r.surveyor || dc.preparedBy || "",
      surveyorSignedDate: r.signatures.surveyorSignedDate || isoDate,
    },
    status: "final",
    finalisedAt: now.toISOString(),
  };
}

/** Bump revision letter A→B, Z→AA. */
export function bumpRevisionLetter(rev = "A") {
  const s = String(rev || "A").trim().toUpperCase();
  if (!s) return "B";
  if (/^\d+$/.test(s)) return String(Number(s) + 1);
  if (s.length === 1 && s >= "A" && s < "Z") return String.fromCharCode(s.charCodeAt(0) + 1);
  if (s === "Z") return "AA";
  const last = s.slice(-1);
  const head = s.slice(0, -1);
  if (last < "Z") return head + String.fromCharCode(last.charCodeAt(0) + 1);
  return s + "A";
}

/** PAS128 utility schedule stats for cover / summary. */
export function buildPas128SummaryStats(report) {
  const rows = report?.utilitiesTable || [];
  if (!rows.length) return null;
  const byQl = {};
  const byConfidence = {};
  rows.forEach((r) => {
    const ql = r.pas128Ql || "—";
    const conf = r.confidence || "—";
    byQl[ql] = (byQl[ql] || 0) + 1;
    byConfidence[conf] = (byConfidence[conf] || 0) + 1;
  });
  return {
    total: rows.length,
    byQl,
    byConfidence,
    withDepth: rows.filter((r) => r.depth?.trim()).length,
    withGeoPhoto: rows.filter((r) => r.geoPhotoId).length,
  };
}

export function buildEquipmentCalibrationNarrative(rows) {
  if (!rows?.length) return "";
  return rows
    .map((r) => {
      const parts = [r.instrument || "Instrument"];
      if (r.serialNo?.trim()) parts.push(`S/N ${r.serialNo.trim()}`);
      if (r.calibrationDue) parts.push(`cal. due ${new Date(r.calibrationDue).toLocaleDateString("en-GB")}`);
      if (r.status === "in_date") parts.push("(in date)");
      if (r.status === "due_soon") parts.push("(due soon)");
      if (r.status === "overdue") parts.push("(overdue — verify before use)");
      return parts.join(" · ");
    })
    .join("\n");
}

const DIFF_FIELDS = [
  { key: "title", label: "Title" },
  { key: "surveyDate", label: "Survey date" },
  { key: "surveyor", label: "Surveyor" },
  { key: "pas128Ql", label: "PAS128 QL" },
  { key: "pas128Method", label: "PAS128 method" },
  { key: "sections.executiveSummary", label: "Executive summary" },
  { key: "sections.scope", label: "Scope" },
  { key: "sections.methodology", label: "Methodology" },
  { key: "sections.findings", label: "Findings" },
  { key: "sections.recommendations", label: "Recommendations" },
];

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

/** Human-readable diff between two report versions. */
export function compareSurveyReports(before, after) {
  const a = normalizeSurveyReport(before);
  const b = normalizeSurveyReport(after);
  const changes = [];

  DIFF_FIELDS.forEach(({ key, label }) => {
    const va = String(getPath(a, key) || "").trim();
    const vb = String(getPath(b, key) || "").trim();
    if (va !== vb) changes.push({ field: label, before: va.slice(0, 120), after: vb.slice(0, 120) });
  });

  const utilBefore = (a.utilitiesTable || []).length;
  const utilAfter = (b.utilitiesTable || []).length;
  if (utilBefore !== utilAfter) {
    changes.push({ field: "Utility schedule", before: `${utilBefore} row(s)`, after: `${utilAfter} row(s)` });
  }

  const photoBefore = (a.photos || []).length;
  const photoAfter = (b.photos || []).length;
  if (photoBefore !== photoAfter) {
    changes.push({ field: "Photos", before: `${photoBefore}`, after: `${photoAfter}` });
  }

  if (a.documentControl?.revision !== b.documentControl?.revision) {
    changes.push({
      field: "Revision",
      before: a.documentControl?.revision || "—",
      after: b.documentControl?.revision || "—",
    });
  }

  return changes;
}

/** Duplicate report payload — plain copy or next revision from a final report. */
export function buildDuplicateReportPayload(report, existingReports, { asRevision = false } = {}) {
  const copy = normalizeSurveyReport(JSON.parse(JSON.stringify(report)));
  const ref = nextSurveyRef(existingReports);
  const now = new Date().toISOString();
  const isoDate = now.slice(0, 10);

  copy.id = `sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  copy.status = "draft";
  copy.surveyDate = isoDate;
  copy.finalisedAt = null;
  copy.smartFillAt = null;
  copy.sitePlanSnapshots = [];
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.parentReportId = report.id;
  copy.parentRevision = report.documentControl?.revision || "";

  if (asRevision && report.status === "final") {
    const prevRev = report.documentControl?.revision || "A";
    const nextRev = bumpRevisionLetter(prevRev);
    copy.ref = report.ref || ref;
    copy.title = report.title || `Survey report ${copy.ref}`;
    copy.documentControl = {
      ...copy.documentControl,
      issueNumber: String(Number(copy.documentControl.issueNumber || 1) + 1),
      revision: nextRev,
      issueDate: "",
    };
    copy.revisionHistory = [
      ...(copy.revisionHistory || []),
      {
        id: `rev_${Date.now()}`,
        date: isoDate,
        revision: nextRev,
        author: copy.documentControl.preparedBy || copy.surveyor || "",
        description: `Revision ${nextRev} created from final Rev ${prevRev}`,
      },
    ];
    copy.changesSincePrevious = compareSurveyReports(report, copy);
  } else {
    copy.ref = ref;
    copy.title = `${report.title || report.ref || "Survey report"} (copy)`;
    copy.documentControl = {
      ...copy.documentControl,
      issueNumber: "1",
      revision: "A",
      issueDate: "",
    };
    copy.revisionHistory = [
      {
        id: `rev_${Date.now()}`,
        date: isoDate,
        revision: "A",
        author: copy.documentControl.preparedBy || copy.surveyor || "",
        description: `Duplicated from ${report.ref || report.id}`,
      },
    ];
    copy.changesSincePrevious = [];
  }

  return copy;
}
