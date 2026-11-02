import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), scope: "rams_builder_docs_acme" }));
vi.mock("../../utils/orgStorage", () => ({
  countryOperationalStorageKey: () => mocks.scope,
  loadOrgScoped: mocks.load, saveOrgScoped: mocks.save,
}));
import { commitRamsDocument } from "./ramsDocumentSave";
const original = { id: "r1", title: "Original", updatedAt: "2026-10-01", rows: [{ hazard: "A", controls: ["B"] }] };
const args = { document: { ...original, title: "Edited" }, editingDocument: original, expectedScope: "rams_builder_docs_acme" };
beforeEach(() => {
  mocks.scope = args.expectedScope;
  mocks.load.mockReset().mockReturnValue([original]);
  mocks.save.mockReset().mockReturnValue(true);
});
describe("RAMS local commit", () => {
  it("preserves newly added documents from storage instead of saving a stale UI list", () => {
    const concurrent = { id: "r2", title: "Another document" };
    mocks.load.mockReturnValue([original, concurrent]);
    expect(commitRamsDocument(args)).toEqual({ ok: true, documents: [args.document, concurrent] });
    expect(mocks.save).toHaveBeenCalledWith("rams_builder_docs", [args.document, concurrent]);
  });
  it.each([false, undefined])("requires explicit persistence success, received %s", (result) => {
    mocks.save.mockReturnValue(result);
    expect(commitRamsDocument(args)).toEqual({ ok: false, reason: "storage_failed" });
  });
  it("keeps a thrown quota failure on the failure path", () => {
    mocks.save.mockImplementation(() => { throw new Error("QuotaExceededError"); });
    expect(commitRamsDocument(args)).toEqual({ ok: false, reason: "storage_failed" });
  });
  it.each([[], [{ ...original, deletedAt: "2026-10-02" }], [{ ...original, rows: [{ hazard: "New cloud hazard" }] }]].map((rows) => [rows]))("rejects a missing, deleted or changed source: %j", (rows) => {
    mocks.load.mockReturnValue(rows);
    expect(commitRamsDocument(args)).toEqual({ ok: false, reason: "document_changed" });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("ignores JSON property order when comparing the original record", () => {
    mocks.load.mockReturnValue([{ rows: [{ controls: ["B"], hazard: "A" }], updatedAt: original.updatedAt, title: original.title, id: "r1" }]);
    expect(commitRamsDocument(args).ok).toBe(true);
  });
  it.each(["rams_builder_docs_other", "rams_builder_docs_acme__country_pl"])("rejects a changed company or country: %s", (scope) => {
    mocks.scope = scope;
    expect(commitRamsDocument(args)).toEqual({ ok: false, reason: "workspace_changed" });
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects a new-document ID collision", () => {
    expect(commitRamsDocument({ ...args, editingDocument: null })).toEqual({ ok: false, reason: "document_changed" });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
