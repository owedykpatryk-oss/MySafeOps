import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock("./supabase.js", () => ({ supabase: { auth } }));
import { uploadFileToR2Storage } from "./r2Storage";

beforeEach(() => {
  vi.stubEnv("VITE_STORAGE_API_URL", "https://storage.example");
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "current", expires_at: Date.now() / 1000 + 3600 } } });
  auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "refreshed" } } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
const upload = () => uploadFileToR2Storage(new File(["evidence"], "photo.jpg", { type: "image/jpeg" }), { orgId: "acme", workspace: null });

it("does not report a successful upload when a proxy returns HTML or an empty acknowledgement", async () => {
  for (const body of ["<html>Network login</html>", "{}", '{"key":""}']) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    await expect(upload()).rejects.toThrow(/confirm.*upload/i);
  }
});

it("aborts a stalled mobile upload and allows an explicit retry", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce(Response.json({ key: "files/org_acme/main/photo.jpg", size: 8 }));
  vi.stubGlobal("fetch", fetchMock);
  const pending = expect(upload()).rejects.toThrow(/timed out/i);
  await vi.advanceTimersByTimeAsync(120001);
  await pending;
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await expect(upload()).resolves.toMatchObject({ key: "files/org_acme/main/photo.jpg" });
  expect(vi.getTimerCount()).toBe(0);
});

it("refreshes an expired camera-return session once, preserving the upload key", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: "expired" }, { status: 401 }))
    .mockImplementationOnce(async (_url, opts) => Response.json({ key: opts.body.get("key"), size: 8 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(upload()).resolves.toMatchObject({ size: 8 });
  expect(auth.refreshSession).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer refreshed");
  expect(fetchMock.mock.calls[0][1].body.get("key")).toBe(fetchMock.mock.calls[1][1].body.get("key"));
});

it("also times out when response headers arrive but the acknowledgement body stalls", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) }));
  const pending = expect(upload()).rejects.toThrow(/timed out/i);
  await vi.advanceTimersByTimeAsync(120001);
  await pending;
  expect(vi.getTimerCount()).toBe(0);
});
