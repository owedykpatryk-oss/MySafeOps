/**
 * Generic PAS 128 report boilerplate — foreword, disclaimer, default deliverables.
 * No org-, client- or site-specific names; org may override disclaimer text only.
 */

const mkDel = (format, description, status = "Issued with report", crs = "OSGB36") => ({
  id: `del_${format}_${description.slice(0, 8).replace(/\W/g, "")}`,
  format,
  description,
  crs,
  status,
});

export const DEFAULT_SURVEY_REPORT_DISCLAIMER =
  "This report is issued for the agreed survey scope only. Information from desktop records or geophysical survey is indicative unless verified by trial excavation or statutory undertaker confirmation. The commissioning party remains responsible for safe digging practices, permit-to-dig procedures and CDM / HSG47 duties on site.";

export function getSurveyReportDisclaimer(org = {}) {
  const custom = String(org.surveyReportDisclaimer || "").trim();
  return custom || DEFAULT_SURVEY_REPORT_DISCLAIMER;
}

/** Generic foreword — PAS 128:2022 section 11.1 style, no client or site names. */
export function buildPas128Foreword(report = {}) {
  const method = String(report.pas128Method || "").trim();
  const ql = String(report.pas128Ql || "").trim();
  const qlNote = ql ? ` Target quality level: ${ql}.` : "";

  if (method === "M1") {
    return `This report documents a desktop utility records search undertaken in accordance with PAS 128:2022 Survey Type D.${qlNote} Records are historical; positional accuracy is not guaranteed and onsite detection is required before breaking ground. The report supports CDM 2015 and HSG47 safe digging responsibilities.`;
  }

  const methodNote = method ? ` Survey method: ${method}.` : "";
  return `This report has been prepared in accordance with PAS 128:2022 — Specification for underground utility detection, verification and location (section 11.1). It relates to the agreed survey scope and extent described in this document.${methodNote}${qlNote} Residual uncertainty and safe dig rules apply until services are verified on site.`;
}

export function defaultDeliverablesForPas128Method(methodKey) {
  const reportPdf = mkDel("report_pdf", "Survey report (PDF)");
  const pdfDrawing = mkDel("pdf_drawing", "Utility mark-up drawing (PDF)");
  const cad = mkDel("dwg", "CAD drawing (DWG/DXF)", "On request");

  if (methodKey === "M1") {
    return [
      reportPdf,
      mkDel("other", "Undertaker response appendix (where supplied)", "Issued with report", "—"),
      mkDel("pdf_drawing", "Site location plan (PDF)", "Issued with report"),
    ];
  }

  return [reportPdf, pdfDrawing, cad];
}

/** Apply foreword + deliverables when a PAS 128 method is selected. */
export function applyPas128BoilerplateToReport(report, methodKey, { overwrite = false } = {}) {
  if (!methodKey) return report;
  const next = {
    ...report,
    sections: { ...(report.sections || {}) },
    deliverables: [...(report.deliverables || [])],
  };

  const foreword = buildPas128Foreword({ ...next, pas128Method: methodKey });
  if (foreword && (overwrite || !next.sections.foreword?.trim())) {
    next.sections.foreword = foreword;
  }

  const defaults = defaultDeliverablesForPas128Method(methodKey);
  if (defaults.length && (overwrite || !next.deliverables.length)) {
    next.deliverables = defaults;
  }

  return next;
}
