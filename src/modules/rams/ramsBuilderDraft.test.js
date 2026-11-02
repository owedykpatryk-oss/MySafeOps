/** @vitest-environment jsdom */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ramsDraftScope, readRamsDraft, latestRamsDraft, writeRamsDraft, clearRamsDraft, hasLegacyRamsDraft, LEGACY_RAMS_DRAFT_KEY } from "./ramsBuilderDraft";

const scope = ramsDraftScope({ userId: "a", storageScope: "rams_org" });
const state = { step: 3, form: { title: "Offline edit" }, editedRows: [], selectedHazards: [], editingDocument: { id: "r1", title: "Original" } };
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("RAMS recovery drafts", () => {
  it("retains the original document snapshot and identity for conflict detection on resume", () => {
    expect(writeRamsDraft(scope, "r1", state)).toBe(true);
    state.form.title = "Later input";
    const restored = readRamsDraft(scope, "r1");
    expect(restored.form.title).toBe("Offline edit");
    expect(restored.editingDocument).toEqual({ id: "r1", title: "Original" });
    expect(restored.documentId).toBe("r1");
    state.form.title = "Offline edit";
  });

  it.each([
    { userId: "b", storageScope: "rams_org" },
    { userId: "a", storageScope: "rams_other" },
    { userId: "a", storageScope: "rams_org__country_pl" },
    { localOnly: true, storageScope: "rams_org" },
  ])("separates accounts, organisations, countries and local mode: %j", (other) => {
    writeRamsDraft(scope, "r1", state);
    const otherScope = ramsDraftScope(other);
    expect(latestRamsDraft(otherScope)).toBeNull();
    writeRamsDraft(otherScope, "r1", { ...state, form: { title: "Other scope" } });
    clearRamsDraft(otherScope, "r1");
    expect(readRamsDraft(scope, "r1").form.title).toBe("Offline edit");
  });

  it("does not use local mode while a configured account is missing", () => {
    expect(ramsDraftScope({ storageScope: "rams_org" })).toBeNull();
    expect(writeRamsDraft(null, "r1", state)).toBe(false);
    expect(latestRamsDraft(null)).toBeNull();
  });

  it("keeps drafts of different documents and only removes the saved one", () => {
    writeRamsDraft(scope, "r1", state);
    writeRamsDraft(scope, "r2", { ...state, editingDocument: null });
    clearRamsDraft(scope, "r2");
    expect(readRamsDraft(scope, "r1")).not.toBeNull();
    expect(readRamsDraft(scope, "r2")).toBeNull();
  });

  it("returns the latest valid draft without deleting old ones", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100);
    writeRamsDraft(scope, "r1", state);
    now.mockReturnValue(200);
    writeRamsDraft(scope, "r2", { ...state, editingDocument: null });
    expect(latestRamsDraft(scope).documentId).toBe("r2");
    expect(readRamsDraft(scope, "r1").savedAt).toBe(100);
  });

  it("never opens or deletes an unowned legacy draft", () => {
    const raw = JSON.stringify({ ...state, savedAt: 1 });
    sessionStorage.setItem(LEGACY_RAMS_DRAFT_KEY, raw);
    expect(hasLegacyRamsDraft()).toBe(true);
    expect(latestRamsDraft(scope)).toBeNull();
    writeRamsDraft(scope, "r1", state);
    clearRamsDraft(scope, "r1");
    expect(sessionStorage.getItem(LEGACY_RAMS_DRAFT_KEY)).toBe(raw);
  });

  it("rejects an edit assigned to a different document", () => {
    expect(writeRamsDraft(scope, "r2", state)).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it.each([null, { ...state, step: 5 }, { ...state, form: [] }, { ...state, editedRows: null }])("does not confirm an unusable recovery payload: %j", (invalid) => {
    expect(writeRamsDraft(scope, "r1", invalid)).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it.each(["{broken", JSON.stringify({ version: 2 }), "null"])("preserves unreadable drafts: %s", (raw) => {
    writeRamsDraft(scope, "r1", state);
    const key = sessionStorage.key(0);
    sessionStorage.setItem(key, raw);
    expect(latestRamsDraft(scope)).toBeNull();
    expect(sessionStorage.getItem(key)).toBe(raw);
  });

  it("does not trust a stored scope or original identity that differs from its key", () => {
    writeRamsDraft(scope, "r1", state);
    const key = sessionStorage.key(0);
    const draft = JSON.parse(sessionStorage.getItem(key));
    sessionStorage.setItem(key, JSON.stringify({ ...draft, scope: "other" }));
    expect(readRamsDraft(scope, "r1")).toBeNull();
    sessionStorage.setItem(key, JSON.stringify({ ...draft, editingDocument: { id: "other" } }));
    expect(readRamsDraft(scope, "r1")).toBeNull();
  });

  it("reports failed autosave and retains the previous recovery copy", () => {
    writeRamsDraft(scope, "r1", state);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(writeRamsDraft(scope, "r1", { ...state, form: { title: "Unsaved" } })).toBe(false);
    expect(readRamsDraft(scope, "r1").form.title).toBe("Offline edit");
  });

  it("handles inaccessible storage without claiming a successful save or removal", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Denied"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Denied"); });
    expect(readRamsDraft(scope, "r1")).toBeNull();
    expect(clearRamsDraft(scope, "r1")).toBe(false);
  });
});
