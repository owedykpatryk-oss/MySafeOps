/**
 * Survey report export bundle — HTML, GeoJSON, PDF, geo-photo map/CAD formats.
 */
import { exportGeoPhotosGeoJson, projectGeoPhotosForReport } from "../../utils/geoPhotoIntegrations";
import {
  downloadGeoPhotosCadBundle,
  downloadGeoPhotosGpx,
  downloadGeoPhotosKml,
  downloadGeoPhotosKmz,
  filterGeoPhotosWithCoords,
} from "../../utils/geoPhotoExport";
import { sanitizePdfFileSegment } from "../../utils/pdfFileName";
import { downloadSurveyReportHtml } from "./surveyReportPrintHtml";
import { downloadSurveyReportPdf } from "./surveyReportPdf";

function reportFileBase(report) {
  return sanitizePdfFileSegment(report?.ref || report?.id || "survey_report", 40);
}

function reportGeoPhotos(report, allGeoPhotos = []) {
  const projectId = report?.projectId;
  if (!projectId) throw new Error("Link a project to export geo-photos.");
  const photos = projectGeoPhotosForReport(allGeoPhotos, projectId);
  if (!photos.length) throw new Error("No geo-photos marked for report on this project.");
  const { withCoords, withoutCoords } = filterGeoPhotosWithCoords(photos);
  if (!withCoords.length) throw new Error("No report geo-photos have GPS coordinates.");
    return { photos, withCoords, withoutCoords, exportOpts: { name: report.ref || report.title || "survey-report", projectName: report.title || report.ref, projectId } };
}

/** Download GeoJSON for geo-photos linked to this report's project. */
export function downloadSurveyReportGeoJson(report, allGeoPhotos = []) {
  const { photos } = reportGeoPhotos(report, allGeoPhotos);
  const geo = exportGeoPhotosGeoJson(photos, report.ref || report.title || "survey-report");
  const blob = new Blob([JSON.stringify(geo, null, 2)], { type: "application/geo+json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${reportFileBase(report)}-geo-photos.geojson`;
  a.click();
  URL.revokeObjectURL(a.href);
  return { count: photos.length };
}

export function downloadSurveyReportKml(report, allGeoPhotos = []) {
  const { withCoords, exportOpts } = reportGeoPhotos(report, allGeoPhotos);
  downloadGeoPhotosKml(withCoords, `${reportFileBase(report)}-geo-photos.kml`, exportOpts);
  return { count: withCoords.length };
}

export async function downloadSurveyReportKmz(report, allGeoPhotos = []) {
  const { withCoords, exportOpts } = reportGeoPhotos(report, allGeoPhotos);
  await downloadGeoPhotosKmz(withCoords, `${reportFileBase(report)}-geo-photos.kmz`, exportOpts);
  return { count: withCoords.length };
}

export function downloadSurveyReportGpx(report, allGeoPhotos = []) {
  const { withCoords, exportOpts } = reportGeoPhotos(report, allGeoPhotos);
  downloadGeoPhotosGpx(withCoords, `${reportFileBase(report)}-geo-photos.gpx`, exportOpts);
  return { count: withCoords.length };
}

export async function downloadSurveyReportCadPack(report, allGeoPhotos = []) {
  const { withCoords, exportOpts } = reportGeoPhotos(report, allGeoPhotos);
  await downloadGeoPhotosCadBundle(withCoords, `${reportFileBase(report)}-geo-photos-cad.zip`, exportOpts);
  return { count: withCoords.length };
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

  if (opts.includeKmz !== false && report.projectId) {
    try {
      onProgress("KMZ…");
      await downloadSurveyReportKmz(report, geoPhotos);
    } catch {
      /* optional */
    }
  }

  onProgress("PDF…");
  return downloadSurveyReportPdf(report, extras, { onProgress: (p) => onProgress(`PDF: ${p}`) });
}
