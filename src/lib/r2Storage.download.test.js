import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchR2ObjectBlob, uploadFileToR2Storage, fetchR2StorageUsage } from "./r2Storage";

const mocks = vi.hoisted(() => ({ session: vi.fn(), refresh: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { auth: { getSession: mocks.session, refreshSession: mocks.refresh } } }));
beforeEach(() => {
  vi.stubEnv("VITE_STORAGE_API_URL", "https://storage.example");
  mocks.session.mockResolvedValue({ data: { session: { access_token: "initial-test-token", expires_at: Date.now() / 1000 + 3600 } } });
  mocks.refresh.mockResolvedValue({ data: { session: { access_token: "renewed-test-token", expires_at: Date.now() / 1000 + 3600 } } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each(["download headers", "download body", "usage headers", "usage body"])("releases stalled %s and allows a fresh retry", async (stage) => {
  vi.useFakeTimers();
  const never = () => new Promise(() => {});
  const download = stage.startsWith("download");
  const file = new Blob(["pdf"]);
  const fetch = vi.fn().mockImplementationOnce(stage.endsWith("headers") ? never : async () => ({
    ok: true, status: 200, blob: never, json: never,
  })).mockResolvedValue({ ok: true, status: 200, blob: async () => file, json: async () => ({ bytes: 42 }) });
  vi.stubGlobal("fetch", fetch);
  const read = () => download ? fetchR2ObjectBlob("files/org_acme/main/site.pdf") : fetchR2StorageUsage("acme", null);
  let failure;
  const pending = read().catch((error) => { failure = error; });
  await vi.advanceTimersByTimeAsync(120_001);
  expect(failure?.message).toMatch(/timed out/i);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await pending;
  expect(await read()).toBe(download ? file : 42);
  expect(vi.getTimerCount()).toBe(0);
});

it("renews a rejected session before downloading the private file", async () => {
  const file = new Blob(["pdf"], { type: "application/pdf" });
  const fetch = vi.fn().mockResolvedValueOnce({ status: 401, ok: false })
    .mockResolvedValueOnce({ status: 200, ok: true, blob: async () => file });
  vi.stubGlobal("fetch", fetch);
  expect(await fetchR2ObjectBlob("documents/org_x/site.pdf")).toBe(file);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenLastCalledWith("https://storage.example/object?key=documents%2Forg_x%2Fsite.pdf", {
    method: "GET", headers: { Authorization: "Bearer renewed-test-token" }, signal: expect.any(AbortSignal),
  });
});

it("requires a signed-in session even when a development upload token is configured", async () => {
  vi.stubEnv("VITE_STORAGE_UPLOAD_TOKEN", "local-upload-test-token");
  mocks.session.mockResolvedValue({ data: { session: null } });
  mocks.refresh.mockResolvedValue({ data: { session: null } });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(fetchR2ObjectBlob("documents/org_x/site.pdf")).rejects.toThrow("Sign in to download");
  expect(fetch).not.toHaveBeenCalled();
});

it("uploads into the selected country's scope and displays quota errors without refreshing auth", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ error: "storage_limit_reached" }, { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  const file = new File(["sample"], "site.txt", { type: "text/plain" });
  await expect(uploadFileToR2Storage(file, { orgId: "acme", workspace: { id: "11111111-2222-4333-8444-555555555555", is_primary: false } })).rejects.toThrow("Cloud storage limit reached");
  expect(fetch.mock.calls[0][1].body.get("key")).toMatch(/^files\/org_acme\/country_11111111-2222-4333-8444-555555555555\/documents\//);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("reads authoritative usage for the requested country", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ bytes: 123 }));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchR2StorageUsage("acme", { id: "country-pl", is_primary: false })).toBe(123);
  expect(fetch.mock.calls[0][0]).toBe("https://storage.example/usage?org=acme&country=country-pl");
});
