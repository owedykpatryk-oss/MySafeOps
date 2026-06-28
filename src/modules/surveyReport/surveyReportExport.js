/**
 * Survey report export bundle — HTML, GeoJSON, PDF.
 */
import { exportGeoPhotosGeoJson, projectGeoPhotosForReport } from "../../utils/geoPhotoIntegrations";
import { sanitizePdfFileSegment } from "../../utils/pdfFileName";
import { downloadSurveyReportHtml } from "./surveyReportPrintHtml";
import { downloadSurveyReportPdf } from "./surveyReportPdf";

function reportFileBase(report) {
  return sanitizePdfFileSegment(report?.ref || report?.id || "survey_report", 40);
}

/** Download GeoJSON for geo-photos linked to this report's project. */
export function downloadSurveyReportGeoJson(report, allGeoPhotos = []) {
  const projectId = report?.projectId;
  if (!projectId) throw new Error("Link a project to export geo-photos.");
  const photos = projectGeoPhotosForReport(allGeoPhotos, projectId);
  if (!photos.length) throw new Error("No geo-photos marked for report on this project.");

  const geo = exportGeoPhotosGeoJson(photos, report.ref || report.title || "survey-report");
  const blob = new Blob([JSON.stringify(geo, null, 2)], { type: "application/geo+json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${reportFileBase(report)}-geo-photos.geojson`;
  a.click();
  URL.revokeObjectURL(a.href);
  return { count: photos.length };
}

/**
 * Download HTML + optional GeoJSON + PDF in sequence.
 */
export async function downloadSurveyReportPack(report, extras = {}, geoPhotos = [], opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  onProgress("HTML…");
  downloadSurveyReportHtml(report, extras);

  if (opts.includeGeoJson !== false && report.projectId) {
    try {
      onProgress("GeoJSON…");
      downloadSurveyReportGeoJson(report, geoPhotos);
    } catch {
      /* optional */
    }
  }

  onProgress("PDF…");
  return downloadSurveyReportPdf(report, extras, { onProgress: (p) => onProgress(`PDF: ${p}`) });
}
