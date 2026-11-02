/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getGprEditorScope, readGprEditorSession, writeGprEditorSession, clearGprEditorSession } from "./gprEditorSession";
import { persistGprReports, deleteGprReport } from "./gprReportPersistence";
import { setAuthorshipUserCache, clearAuthorshipUserCache } from "../../utils/documentAuthorship";
import { loadOrgScoped, saveOrgScoped } from "../../utils/orgStorage";
import { listRecycleBinEntries, restoreRecycleBinEntry } from "../../utils/recycleBin";

const report = { id: "gpr-a", title: "Original", ref: "GPR-001" };
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); clearAuthorshipUserCache();
  localStorage.setItem("mysafeops_orgId", "a");
});
afterEach(() => vi.restoreAllMocks());
function failWrites(prefix) {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (this === localStorage && key.startsWith(prefix)) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, key, value);
  });
}

describe("GPR draft ownership", () => {
  it("never adopts legacy global drafts", () => {
    sessionStorage.setItem("mysafeops_gpr_editor_draft", JSON.stringify({ data: report }));
    sessionStorage.setItem("mysafeops_gpr_editor_open", "1");
    expect(readGprEditorSession()).toBeNull();
  });
  it("isolates users, organisations and countries while retaining the original draft", () => {
    setAuthorshipUserCache({ id: "alice" });
    const scope = getGprEditorScope();
    writeGprEditorSession({ data: report });
    localStorage.setItem("mysafeops_orgId", "b");
    expect(readGprEditorSession()).toBeNull();
    clearGprEditorSession();
    localStorage.setItem("mysafeops_orgId", "a");
    setAuthorshipUserCache({ id: "bob" });
    expect(readGprEditorSession()).toBeNull();
    setAuthorshipUserCache({ id: "alice" });
    localStorage.setItem("mysafeops_active_country_workspace_snapshot_a", JSON.stringify({ id: "pl", is_primary: false }));
    expect(readGprEditorSession()).toBeNull();
    expect(readGprEditorSession(scope)?.data).toEqual(report);
    localStorage.removeItem("mysafeops_active_country_workspace_snapshot_a");
    localStorage.setItem("mysafeops_active_country_workspace_a", "new-primary-country");
    localStorage.setItem("mysafeops_active_country_workspace_snapshot_a", JSON.stringify({ id: "new-primary-country", is_primary: true }));
    expect(getGprEditorScope()).toBe(scope);
    expect(readGprEditorSession()?.data).toEqual(report);
  });
  it("rejects delayed saves and deletes after scope changes", () => {
    const scope = getGprEditorScope();
    saveOrgScoped("gpr_reports", [report]);
    localStorage.setItem("mysafeops_orgId", "b");
    expect(persistGprReports(scope, [report])).toBeNull();
    expect(deleteGprReport(scope, report)).toBeNull();
    expect(loadOrgScoped("gpr_reports", [])).toEqual([]);
    expect(listRecycleBinEntries()).toEqual([]);
  });
});
describe("GPR durable persistence", () => {
  it("returns failure and preserves recovery when the register cannot be written", () => {
    const scope = getGprEditorScope();
    saveOrgScoped("gpr_reports", [report]);
    const draft = { ...report, title: "Unsaved edit" };
    writeGprEditorSession({ data: draft });
    failWrites("gpr_reports_");
    expect(persistGprReports(scope, [draft])).toBeNull();
    expect(loadOrgScoped("gpr_reports", [])[0].title).toBe("Original");
    expect(readGprEditorSession().data.title).toBe("Unsaved edit");
    vi.restoreAllMocks();
    expect(persistGprReports(scope, [draft])).toEqual([draft]);
    expect(loadOrgScoped("gpr_reports", [])[0].title).toBe("Unsaved edit");
  });
  it("archives, deletes and restores the full report", () => {
    saveOrgScoped("gpr_reports", [report]);
    expect(deleteGprReport(getGprEditorScope(), report)[0].deletedAt).toBeTruthy();
    const [entry] = listRecycleBinEntries();
    expect(entry.sourceKey).toBe("gpr_reports");
    expect(entry.payload).toEqual(report);
    expect(restoreRecycleBinEntry(entry.id).ok).toBe(true);
    expect(loadOrgScoped("gpr_reports", [])[0]).toMatchObject(report);
    expect(loadOrgScoped("gpr_reports", [])[0].deletedAt).toBeUndefined();
  });
  it("does not delete when the recovery copy cannot be saved", () => {
    saveOrgScoped("gpr_reports", [report]);
    failWrites("mysafeops_recycle_bin_v1_");
    expect(deleteGprReport(getGprEditorScope(), report)).toBeNull();
    expect(loadOrgScoped("gpr_reports", [])).toEqual([report]);
  });
  it("retains recovery and the live record when deletion persistence fails", () => {
    saveOrgScoped("gpr_reports", [report]);
    failWrites("gpr_reports_");
    expect(deleteGprReport(getGprEditorScope(), report)).toBeNull();
    expect(loadOrgScoped("gpr_reports", [])).toEqual([report]);
    expect(listRecycleBinEntries()[0].payload).toEqual(report);
  });
});
