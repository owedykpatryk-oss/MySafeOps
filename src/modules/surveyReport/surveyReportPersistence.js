import { countryOperationalStorageKey, loadOrgScoped, saveOrgScoped } from "../../utils/orgStorage";
import { getCachedAuthorshipActor } from "../../utils/documentAuthorship";

export function getSurveyPersistenceScope(userId = getCachedAuthorshipActor()?.id || "local") {
  return JSON.stringify([userId, countryOperationalStorageKey("survey_reports")]);
}

export function persistSurveyReport(scope, report) {
  if (scope !== getSurveyPersistenceScope()) return null;
  const current = loadOrgScoped("survey_reports", []);
  // Preserve a concurrent deletion; the editor keeps its recovery draft on failure.
  if (current.some(row => row.id === report.id && row.deletedAt)) return null;
  const next = current.some(row => row.id === report.id)
    ? current.map(row => row.id === report.id ? report : row)
    : [report, ...current];
  return saveOrgScoped("survey_reports", next) === true ? next : null;
}
