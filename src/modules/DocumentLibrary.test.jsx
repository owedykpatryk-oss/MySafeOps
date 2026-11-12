/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentLibrary from "./DocumentLibrary";
import { ToastProvider } from "../context/ToastContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mocks = vi.hoisted(() => ({ upload: vi.fn(), download: vi.fn(), save: vi.fn(), rows: new Map(), scope: "test-org" }));
vi.mock("../hooks/useD1OrgArraySync", () => ({ useD1OrgArraySync: () => ({}) }));
vi.mock("../lib/d1SyncClient", () => ({ isD1Configured: () => false }));
vi.mock("../lib/r2Storage", () => ({ isR2StorageConfigured: () => true, uploadFileToR2Storage: mocks.upload, pickR2ViewUrl: () => null, fetchR2ObjectBlob: mocks.download }));
vi.mock("../context/SupabaseAuthContext", () => ({ useSupabaseAuth: () => ({ supabase: null }) }));
vi.mock("../lib/supabase", () => ({ isSupabaseConfigured: () => false }));
vi.mock("../utils/orgStorage", () => ({ getOrgId: () => mocks.scope, countryOperationalStorageKey: (key) => `${key}_${mocks.scope}`, ORG_CHANGED_EVENT: "mysafeops-org-changed", loadOrgScoped: (key, fallback) => mocks.rows.has(`${key}_${mocks.scope}`) ? mocks.rows.get(`${key}_${mocks.scope}`) : fallback, saveOrgScoped: mocks.save }));
vi.mock("../utils/auditLog", () => ({ pushAudit: () => {} }));
vi.mock("../i18n/useWorkspaceT", () => ({ useWorkspaceT: () => ({ t: (key) => key }) }));
vi.mock("../components/PageHero", () => ({ default: ({ title, right }) => <div><h1>{title}</h1>{right}</div> }));

let root;
let host;
beforeEach(() => {
  mocks.scope = "test-org";
  mocks.rows.clear();
  sessionStorage.clear();
  mocks.save.mockImplementation((key, value) => { mocks.rows.set(`${key}_${mocks.scope}`, value); return true; });
  const NativeURL = globalThis.URL;
  vi.stubGlobal("URL", class extends NativeURL {
    static createObjectURL = vi.fn(() => "blob:document-test");
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => { if (root) act(() => root.unmount()); root = null; host?.remove(); delete window.showDirectoryPicker; vi.clearAllMocks(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function renderLibrary() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<ToastProvider><DocumentLibrary /></ToastProvider>));
}
const button = (name) => [...host.querySelectorAll("button")].find((entry) => entry.textContent === name);
async function changeWorkspace(scope, event = "mysafeops-org-changed") {
  await act(async () => { mocks.scope = scope; window.dispatchEvent(new Event(event)); });
}

async function upload(files) {
  if (!root) await renderLibrary();
  const input = host.querySelector('input[type="file"]');
  const liveFiles = [...files];
  Object.defineProperty(input, "files", { configurable: true, get: () => liveFiles });
  // Reproduce the browser's live FileList clearing when the file input is reset.
  Object.defineProperty(input, "value", { configurable: true, set: () => { liveFiles.length = 0; } });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

describe("Document library uploads", () => {
  it("uploads the chosen file even after clearing the picker and persists its metadata", async () => {
    mocks.upload.mockResolvedValue({ key: "documents/site.pdf", size: 3 });
    const file = new File(["pdf"], "site.pdf", { type: "application/pdf" });
    await upload([file]);
    expect(mocks.upload).toHaveBeenCalledWith(file, { orgId: "test-org", subPath: "documents" });
    expect(mocks.save).toHaveBeenCalledWith("mysafeops_r2_uploads", [expect.objectContaining({ name: "site.pdf", key: "documents/site.pdf" })]);
    expect(host.textContent).toContain("1 file(s) uploaded");
  });

  it("continues a batch after failure and reports successful uploads accurately", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ key: "documents/second.pdf" });
    await upload([new File(["a"], "first.pdf"), new File(["b"], "second.pdf"), new File(["x"], "bad.exe")]);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("1 file(s) uploaded");
    expect(host.textContent).toContain("first.pdf: Offline");
    expect(host.textContent).toContain("bad.exe: type not allowed");
  });
});


it("preserves every successful entry in a multi-file batch", async () => {
  mocks.upload.mockResolvedValueOnce({ key: "first.pdf" }).mockResolvedValueOnce({ key: "second.pdf" });
  await upload([new File(["a"], "first.pdf"), new File(["b"], "second.pdf")]);
  expect(mocks.rows.get("mysafeops_r2_uploads_test-org").map((row) => row.name)).toEqual(["second.pdf", "first.pdf"]);
});

it("recovers a failed library write after remount and retries metadata without uploading twice", async () => {
  mocks.upload.mockResolvedValue({ key: "documents/retry.pdf", size: 1 });
  mocks.save.mockReturnValueOnce(false);
  await upload([new File(["a"], "retry.pdf")]);
  expect(host.textContent).toContain("Retry saving entries");
  expect(host.textContent).toContain("Cloud documents (0)");
  act(() => root.unmount()); root = null; host.remove();
  await renderLibrary();
  await act(async () => button("Retry saving entries").click());
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Cloud documents (1)");
  expect(mocks.rows.get("mysafeops_r2_uploads_test-org")).toHaveLength(1);
  expect(sessionStorage.getItem("mysafeops_r2_uploads_test-org:pending")).toBeNull();
});

for (const event of ["mysafeops-org-changed", "mysafeops-country-workspace-changed"]) {
  it(`does not write an old upload or continue its batch after ${event}`, async () => {
    let finish;
    mocks.upload.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await upload([new File(["a"], "first.pdf"), new File(["b"], "second.pdf")]);
    await changeWorkspace("next-workspace", event);
    await act(async () => finish({ key: "documents/original.pdf" }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Cloud documents (0)");
    expect(host.textContent).not.toContain("original.pdf");
  });
}

it("ignores a second picker event while an upload is already running", async () => {
  let finish;
  mocks.upload.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await upload([new File(["a"], "first.pdf")]);
  await upload([new File(["b"], "second.pdf")]);
  expect(mocks.upload).toHaveBeenCalledTimes(1);
  await act(async () => finish({ key: "first.pdf" }));
  expect(host.textContent).toContain("Cloud documents (1)");
});

it("opens a key-only document with authenticated bytes, traps focus and releases its URL on close", async () => {
  mocks.rows.set("mysafeops_r2_uploads_test-org", [{ id: "doc", key: "private/site.pdf", name: "site.pdf" }]);
  mocks.download.mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
  await renderLibrary();
  await act(async () => button("Open file").click());
  expect(mocks.download).toHaveBeenCalledWith("private/site.pdf");
  const dialog = host.querySelector('[role="dialog"]');
  expect(dialog.querySelector("a").getAttribute("href")).toBe("blob:document-test");
  expect(dialog.querySelector("a").getAttribute("download")).toBe("site.pdf");
  expect(document.activeElement).toBe(dialog.querySelector("a"));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })));
  expect(document.activeElement).toBe(dialog.querySelector("button"));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:document-test");
});

it("ignores a document download that finishes after changing workspace", async () => {
  let finish;
  mocks.rows.set("mysafeops_r2_uploads_test-org", [{ id: "doc", key: "original.pdf", name: "Original" }]);
  mocks.download.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await renderLibrary();
  await act(async () => button("Open file").click());
  await changeWorkspace("next-workspace");
  await act(async () => finish(new Blob(["pdf"])));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Original");
});

it("reports download failure and leaves the document available for retry", async () => {
  mocks.rows.set("mysafeops_r2_uploads_test-org", [{ id: "doc", key: "site.pdf", name: "site.pdf" }]);
  mocks.download.mockRejectedValueOnce(new Error("Sign in again"));
  await renderLibrary();
  await act(async () => button("Open file").click());
  expect(host.querySelector('[role="alert"]').textContent).toContain("Sign in again");
  expect(button("Open file").disabled).toBe(false);
});

it("does not remove an entry from the UI when persisting removal fails", async () => {
  mocks.rows.set("mysafeops_r2_uploads_test-org", [{ id: "doc", key: "site.pdf", name: "site.pdf" }]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mocks.save.mockReturnValueOnce(false);
  await renderLibrary();
  await act(async () => button("Remove from list").click());
  expect(host.textContent).toContain("Cloud documents (1)");
  expect(host.textContent).toContain("could not be removed");
});

it("loads malformed metadata safely and omits broken library rows", async () => {
  mocks.rows.set("mysafeops_doc_library_test-org", null);
  mocks.rows.set("mysafeops_r2_uploads_test-org", [null, {}, { key: "legacy/site.pdf" }, { key: "legacy/name.pdf", name: { invalid: true } }, { id: "deleted", deletedAt: "2026-10-05", key: 42 }]);
  await renderLibrary();
  expect(host.textContent).toContain("Cloud documents (2)");
  expect(host.textContent).toContain("site.pdf");
  expect(host.textContent).toContain("name.pdf");
});


it("does not publish a folder read that finishes after changing workspace", async () => {
  let finish;
  const ready = new Promise((resolve) => { finish = resolve; });
  window.showDirectoryPicker = vi.fn(async () => ({ name: "Original folder", async *entries() {
    await ready;
    yield ["site.pdf", { kind: "file", getFile: async () => new File(["a"], "site.pdf") }];
  } }));
  await renderLibrary();
  await act(async () => button("Choose folder").click());
  await changeWorkspace("next-workspace");
  await act(async () => finish());
  expect(mocks.save).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Original folder");
  expect(host.textContent).not.toContain("site.pdf");
});

it("a late local preview cannot replace the newly selected document", async () => {
  let finish;
  const second = new File(["b"], "second.pdf", { type: "application/pdf" });
  window.showDirectoryPicker = vi.fn(async () => ({ name: "Site files", async *entries() {
    yield ["first.pdf", { kind: "file", getFile: () => new Promise((resolve) => { finish = resolve; }) }];
    yield ["second.pdf", { kind: "file", getFile: async () => second }];
  } }));
  await renderLibrary();
  await act(async () => button("Choose folder").click());
  await act(async () => button("first.pdf").click());
  await act(async () => button("second.pdf").click());
  await act(async () => finish(new File(["a"], "first.pdf", { type: "application/pdf" })));
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  expect(URL.createObjectURL).toHaveBeenCalledWith(second);
  expect(host.querySelector("iframe").src).toContain("blob:document-test");
});


it("keeps unsaved local notes visible and permits retrying the same edits", async () => {
  window.showDirectoryPicker = vi.fn(async () => ({ name: "Site files", async *entries() {
    yield ["site.pdf", { kind: "file", getFile: async () => new File(["pdf"], "site.pdf", { type: "application/pdf" }) }];
  } }));
  await renderLibrary();
  await act(async () => button("Choose folder").click());
  await act(async () => button("site.pdf").click());
  mocks.save.mockReturnValueOnce(false);
  const textarea = host.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, "Keep my inspection notes");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(textarea.value).toBe("Keep my inspection notes");
  expect(button("Retry saving details")).toBeDefined();
  await act(async () => button("Retry saving details").click());
  expect(mocks.rows.get("mysafeops_doc_library_test-org").notes["site.pdf"]).toBe("Keep my inspection notes");
  expect(button("Retry saving details")).toBeUndefined();
});


it("stores a deletion marker so cloud sync cannot restore a removed library entry", async () => {
  mocks.rows.set("mysafeops_r2_uploads_test-org", [{ id: "doc", key: "site.pdf", name: "site.pdf" }]);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await renderLibrary();
  await act(async () => button("Remove from list").click());
  expect(host.textContent).toContain("Cloud documents (0)");
  expect(mocks.rows.get("mysafeops_r2_uploads_test-org")).toEqual([expect.objectContaining({ id: "doc", deletedAt: expect.any(String) })]);
});
