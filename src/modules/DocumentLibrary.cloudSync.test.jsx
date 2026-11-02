/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DocumentLibrary from "./DocumentLibrary";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), upload: vi.fn(), rows: new Map(), country: null }));
vi.mock("../lib/d1SyncClient", () => ({
  d1GetKv: mocks.get, d1PutKv: mocks.put, isD1Configured: () => true,
  isD1RateLimitedError: () => false, isD1TransientError: () => false,
}));
vi.mock("../lib/supabase", () => ({ supabase: {}, isSupabaseConfigured: () => false }));
vi.mock("../context/SupabaseAuthContext", () => ({ useSupabaseAuth: () => ({ supabase: null }) }));
vi.mock("../utils/countryWorkspaces", () => ({
  getCachedActiveCountryWorkspace: () => mocks.country, COUNTRY_WORKSPACE_CHANGED_EVENT: "country-changed",
}));
vi.mock("../utils/orgStorage", () => ({
  getOrgId: () => "org_x", ORG_CHANGED_EVENT: "mysafeops-org-changed",
  countryOperationalStorageKey: (key) => `${key}:${mocks.country?.id || "primary"}`,
  loadOrgScoped: (key, fallback) => mocks.rows.get(`${key}:${mocks.country?.id || "primary"}`) ?? fallback,
  saveOrgScoped: (key, value) => { mocks.rows.set(`${key}:${mocks.country?.id || "primary"}`, value); return true; },
}));
vi.mock("../lib/d1WriteForbidden", () => ({ clearD1WriteForbidden: () => {}, isForbiddenD1Write: () => false, notifyD1WriteForbidden: () => {} }));
vi.mock("../lib/d1SyncOutbox", () => ({
  d1OutboxDelete: async () => {}, d1OutboxEnqueue: async () => {},
  d1OutboxPeek: async () => null, d1OutboxArchiveConflict: async () => {},
  d1OutboxHasPending: async () => false, d1OutboxHasRecovery: async () => false,
  d1OutboxTryFlush: async () => {},
}));
vi.mock("../lib/r2Storage", () => ({
  isR2StorageConfigured: () => true, uploadFileToR2Storage: mocks.upload,
  pickR2ViewUrl: () => null, fetchR2ObjectBlob: vi.fn(),
}));
vi.mock("../utils/auditLog", () => ({ pushAudit: () => {} }));
vi.mock("../i18n/useWorkspaceT", () => ({ useWorkspaceT: () => ({ t: (key) => key }) }));
vi.mock("../components/PageHero", () => ({ default: ({ title }) => <h1>{title}</h1> }));
let root;
let host;
const serverDocument = { id: "remote", key: "documents/org_x/site.pdf", name: "Shared site.pdf", updatedAt: "2026-10-01T12:00:00Z" };
beforeEach(() => {
  vi.useFakeTimers();
  mocks.country = null;
  mocks.rows.clear();
  sessionStorage.clear();
  mocks.get.mockResolvedValue({ ok: true, version: 3, value: [serverDocument] });
  mocks.put.mockResolvedValue({ ok: true, version: 4 });
});
afterEach(() => { act(() => root?.unmount()); host?.remove(); vi.useRealTimers(); vi.clearAllMocks(); vi.restoreAllMocks(); });
async function renderLibrary() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<DocumentLibrary />));
}

it("loads a document written on another device and syncs a new library entry", async () => {
  await renderLibrary();
  expect(host.textContent).toContain("Shared site.pdf");
  expect(mocks.get).toHaveBeenCalledWith({}, "org_x", "mysafeops_r2_uploads", "main");
  mocks.upload.mockResolvedValue({ key: "documents/org_x/new.txt", size: 3 });
  const input = host.querySelector('input[type="file"]');
  Object.defineProperty(input, "files", { value: [new File(["new"], "new.txt")], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  await act(async () => vi.advanceTimersByTimeAsync(1600));
  expect(host.textContent).toContain("Cloud documents (2)");
  expect(mocks.put).toHaveBeenLastCalledWith({}, "org_x", "mysafeops_r2_uploads", "main",
    expect.arrayContaining([expect.objectContaining({ name: "new.txt", key: "documents/org_x/new.txt" }), serverDocument]), 3);
});

it("uses the secondary-country document key without overwriting the primary library", async () => {
  mocks.country = { id: "pl", is_primary: false };
  mocks.rows.set("mysafeops_r2_uploads:primary", [{ id: "uk", key: "uk.pdf", name: "Primary library" }]);
  await renderLibrary();
  expect(mocks.get).toHaveBeenCalledWith({}, "org_x", "mysafeops_r2_uploads", "country:pl:main");
  expect(host.textContent).not.toContain("Primary library");
  expect(mocks.rows.get("mysafeops_r2_uploads:primary")[0].name).toBe("Primary library");
});

it("syncs removal and prevents a stale cloud response from restoring the document", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await renderLibrary();
  const remove = [...host.querySelectorAll("button")].find((button) => button.textContent === "Remove from list");
  await act(async () => remove.click());
  await act(async () => vi.advanceTimersByTimeAsync(1600));
  expect(mocks.put).toHaveBeenLastCalledWith({}, "org_x", "mysafeops_r2_uploads", "main",
    [expect.objectContaining({ id: "remote", deletedAt: expect.any(String) })], 3);
  act(() => root.unmount()); root = null; host.remove();
  await renderLibrary();
  expect(host.textContent).toContain("Cloud documents (0)");
  expect(host.textContent).not.toContain("Shared site.pdf");
});
