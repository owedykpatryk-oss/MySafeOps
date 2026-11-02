/** @vitest-environment jsdom */
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("../../utils/billingAccess", () => ({ isBillingWriteBlocked: () => false, notifyBillingWriteBlocked: vi.fn() }));
import { getSurveyPersistenceScope, persistSurveyReport } from "./surveyReportPersistence";
import { clearAuthorshipUserCache, setAuthorshipUserCache } from "../../utils/documentAuthorship";
import { loadOrgScoped, saveOrgScoped } from "../../utils/orgStorage";
const report = { id: "survey", title: "Draft" };
beforeEach(() => { localStorage.clear(); clearAuthorshipUserCache(); });
afterEach(() => vi.restoreAllMocks());
it("rejects async completion after organisation, user or country changed", async () => {
  const scope = getSurveyPersistenceScope();
  await Promise.resolve();
  localStorage.setItem("mysafeops_orgId", "other");
  expect(persistSurveyReport(scope, report)).toBeNull();
  expect(loadOrgScoped("survey_reports", [])).toEqual([]);
  localStorage.removeItem("mysafeops_orgId");
  setAuthorshipUserCache({ id: "another-user" });
  expect(persistSurveyReport(scope, report)).toBeNull();
  clearAuthorshipUserCache();
  localStorage.setItem("mysafeops_active_country_workspace_default", "pl");
  localStorage.setItem("mysafeops_active_country_workspace_snapshot_default", JSON.stringify({ id: "pl", is_primary: false }));
  expect(persistSurveyReport(scope, report)).toBeNull();
});
it("keeps the primary scope writable after its country cache is first hydrated", () => {
  const scope = getSurveyPersistenceScope();
  localStorage.setItem("mysafeops_active_country_workspace_default", "primary-id");
  localStorage.setItem("mysafeops_active_country_workspace_snapshot_default", JSON.stringify({ id: "primary-id", is_primary: true }));
  expect(getSurveyPersistenceScope()).toBe(scope);
  expect(persistSurveyReport(scope, report)).toEqual([report]);
});
it("returns failure without overwriting saved data, and supports retry", () => {
  saveOrgScoped("survey_reports", [report]);
  const scope = getSurveyPersistenceScope();
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key.startsWith("survey_reports_")) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, key, value);
  });
  const edited = { ...report, title: "Edited" };
  expect(persistSurveyReport(scope, edited)).toBeNull();
  expect(loadOrgScoped("survey_reports", [])).toEqual([report]);
  vi.restoreAllMocks();
  expect(persistSurveyReport(scope, edited)).toEqual([edited]);
});
