/**
 * Utility Mapping document references: UM{YY}-{job}-{CLIENT}
 * Example: UM26-1234-WSP  (year 2026, job 1234, client WSP)
 * Org-exclusive.
 */
import { isUtilityMappingOrg } from "./utilityMappingOrg";
import { matchUtilityMappingClientCode } from "./utilityMappingClients";

const UM_REF_RE = /^UM(\d{2})-(\d{1,6})-([A-Z0-9]{2,5})(?:-(RA|MS|PTW|GPR|SR))?$/i;

/**
 * Two-digit year for job year (survey date or calendar).
 * @param {string|Date} [dateLike]
 */
export function utilityMappingJobYearYY(dateLike) {
  let y;
  if (dateLike) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    y = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  } else {
    y = new Date().getFullYear();
  }
  return String(y).slice(-2);
}

/**
 * @param {{ yearYY?: string, jobNumber?: string|number, clientCode?: string, surveyDate?: string }} opts
 * @returns {string} e.g. UM26-1234-CAT
 */
export function formatUtilityMappingRef(opts = {}) {
  const yy = String(opts.yearYY || utilityMappingJobYearYY(opts.surveyDate)).replace(/\D/g, "").slice(-2).padStart(2, "0");
  const jobRaw = String(opts.jobNumber ?? "").replace(/\D/g, "");
  const job = jobRaw ? String(parseInt(jobRaw, 10)) : "";
  const code = String(opts.clientCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
  if (!job || !code) return "";
  return `UM${yy}-${job}-${code}`;
}

/**
 * @param {string} ref
 * @returns {{ yearYY: string, jobNumber: string, clientCode: string, docType?: string } | null}
 */
export function parseUtilityMappingRef(ref) {
  const m = String(ref || "").trim().match(UM_REF_RE);
  if (!m) return null;
  return {
    yearYY: m[1],
    jobNumber: String(parseInt(m[2], 10)),
    clientCode: m[3].toUpperCase(),
    ...(m[4] ? { docType: m[4].toUpperCase() } : {}),
  };
}

/**
 * Next job number for this year from existing report refs.
 * @param {Array<{ ref?: string }>} existing
 * @param {string} [yearYY]
 */
export function nextUtilityMappingJobNumber(existing = [], yearYY = utilityMappingJobYearYY()) {
  const yy = String(yearYY).padStart(2, "0");
  const nums = (existing || [])
    .map((r) => parseUtilityMappingRef(r?.ref))
    .filter((p) => p && p.yearYY === yy)
    .map((p) => parseInt(p.jobNumber, 10))
    .filter((n) => !Number.isNaN(n));
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}

/**
 * Build next UM ref — uses client code from report or matches client name.
 * @param {Array<{ ref?: string }>} existing
 * @param {{ client?: string, clientCode?: string, umJobNumber?: string, umClientCode?: string, surveyDate?: string }} [report]
 */
export function nextUtilityMappingRef(existing = [], report = {}) {
  if (!isUtilityMappingOrg()) return "";
  const yy = utilityMappingJobYearYY(report.surveyDate);
  const code =
    String(report.umClientCode || report.clientCode || "").trim().toUpperCase() ||
    matchUtilityMappingClientCode(report.client);
  const job =
    String(report.umJobNumber || report.jobNumber || "").replace(/\D/g, "") ||
    nextUtilityMappingJobNumber(existing, yy);
  if (!code) {
    // Placeholder client until selected — still allocate job number
    return formatUtilityMappingRef({ yearYY: yy, jobNumber: job, clientCode: "XXX" });
  }
  return formatUtilityMappingRef({ yearYY: yy, jobNumber: job, clientCode: code });
}

/**
 * Rebuild ref when job / client code fields change.
 * @param {object} report
 * @param {Array<{ ref?: string }>} [existing]
 */
export function syncUtilityMappingReportRef(report, existing = []) {
  if (!isUtilityMappingOrg() || !report) return report;
  const yy = utilityMappingJobYearYY(report.surveyDate);
  const parsed = parseUtilityMappingRef(report.ref);
  const code =
    String(report.umClientCode || report.clientCode || "").trim().toUpperCase() ||
    matchUtilityMappingClientCode(report.client) ||
    parsed?.clientCode ||
    "";
  const job =
    String(report.umJobNumber || report.jobNumber || "").replace(/\D/g, "") ||
    parsed?.jobNumber ||
    nextUtilityMappingJobNumber(existing, yy);
  const next = {
    ...report,
    umJobNumber: job,
    umClientCode: code || report.umClientCode || "",
  };
  if (code) {
    next.ref = formatUtilityMappingRef({ yearYY: yy, jobNumber: job, clientCode: code, surveyDate: report.surveyDate });
  } else if (!report.ref) {
    next.ref = formatUtilityMappingRef({ yearYY: yy, jobNumber: job, clientCode: "XXX" });
  }
  return next;
}

/**
 * File / email base name from UM ref: UM26-1234-WSP_PAS128
 * @param {object} report
 * @param {string} [suffix]
 */
export function utilityMappingExportBaseName(report = {}, suffix = "PAS128") {
  if (!isUtilityMappingOrg()) return "";
  const ref =
    String(report.ref || "").trim() ||
    formatUtilityMappingRef({
      jobNumber: report.umJobNumber || report.jobNumber,
      clientCode: report.umClientCode || report.clientCode,
      surveyDate: report.surveyDate,
    });
  if (!ref || !/^UM\d{2}-/i.test(ref)) return "";
  const base = ref.replace(/-(RA|MS|PTW|GPR|SR)$/i, "");
  const cleanSuffix = String(suffix || "PAS128")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 24);
  return cleanSuffix ? `${base}_${cleanSuffix}` : base;
}

/**
 * Typed document number sharing the same job/client: UM26-1234-WSP-RA
 * @param {'RA'|'MS'|'PTW'|'GPR'|'SR'} docType
 * @param {{ ref?: string, umJobNumber?: string, umClientCode?: string, client?: string, surveyDate?: string, jobRef?: string }} seed
 * @param {Array<{ ref?: string, documentNo?: string, jobRef?: string }>} [existing]
 */
export function formatUtilityMappingTypedRef(docType, seed = {}, existing = []) {
  if (!isUtilityMappingOrg()) return "";
  const type =
    String(docType || "RA")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "RA";
  let base = String(seed.ref || seed.jobRef || "").trim().replace(/-(RA|MS|PTW|GPR|SR)$/i, "");
  const parsed = parseUtilityMappingRef(base);
  if (!parsed) {
    base = nextUtilityMappingRef(existing, seed);
  } else {
    base = formatUtilityMappingRef({
      yearYY: parsed.yearYY,
      jobNumber: parsed.jobNumber,
      clientCode: parsed.clientCode,
    });
  }
  if (!base) return "";
  if (new RegExp(`-${type}$`, "i").test(base)) return base;
  return `${base}-${type}`;
}

/**
 * Suggest next RAMS document number for Utility Mapping.
 * @param {Array<{ documentNo?: string, jobRef?: string, ref?: string }>} existingRams
 * @param {{ umJobNumber?: string, umClientCode?: string, client?: string, jobRef?: string, surveyDate?: string }} [seed]
 */
export function nextUtilityMappingRamsDocNo(existingRams = [], seed = {}) {
  if (!isUtilityMappingOrg()) return "";
  const fromJob = String(seed.jobRef || seed.ref || "").trim();
  const parsed = parseUtilityMappingRef(fromJob.replace(/-(RA|MS|PTW|GPR|SR)$/i, ""));
  if (parsed) {
    return formatUtilityMappingTypedRef("RA", {
      ...seed,
      umJobNumber: parsed.jobNumber,
      umClientCode: parsed.clientCode,
      ref: formatUtilityMappingRef(parsed),
    });
  }
  const existing = (existingRams || []).map((r) => ({
    ref: String(r.documentNo || r.jobRef || r.ref || "").replace(/-(RA|MS|PTW|GPR|SR)$/i, ""),
  }));
  return formatUtilityMappingTypedRef("RA", seed, existing);
}

/**
 * Suggest MS job ref for Utility Mapping.
 */
export function nextUtilityMappingMsJobRef(existingMs = [], seed = {}) {
  if (!isUtilityMappingOrg()) return "";
  const existing = (existingMs || []).map((r) => ({
    ref: String(r.jobRef || r.ref || "").replace(/-(RA|MS|PTW|GPR|SR)$/i, ""),
  }));
  return formatUtilityMappingTypedRef("MS", seed, existing);
}
