/** @vitest-environment jsdom */
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { d1PutKv, d1GetKv, d1DeleteKv, d1AppendServerAudit, __resetD1SyncClientForTests } from "./d1SyncClient.js";
import { clearBillingWritePause } from "./d1BillingPause.js";
const session = (token = "qa-session") => ({
  auth: { getSession: async () => ({ data: { session: { access_token: token } } }) },
});
const denied = () => new Response(JSON.stringify({ error: "billing_write_blocked" }), { status: 403 });
const allowed = () => new Response(JSON.stringify({ value: [], version: 1, seq: 1 }));
beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_D1_API_URL", "https://qa-d1.test");
  __resetD1SyncClientForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  __resetD1SyncClientForTests();
});
it("pauses rejected billing writes across namespaces and audit, preserving reads and other scopes", async () => {
  const fetchMock = vi.fn().mockImplementation(allowed);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementationOnce(denied);
  expect(await d1PutKv(session(), "org-a", "drone_manuals", "main", [])).toMatchObject({
    error: "billing_write_blocked",
  });
  for (const result of [
    await d1PutKv(session(), "org-a", "drone_missions", "main", []),
    await d1AppendServerAudit(session(), "org-a", {}),
    await d1DeleteKv(session(), "org-a", "drone_setups", "main"),
  ])
    expect(result).toMatchObject({ error: "billing_write_blocked", paused: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((await d1GetKv(session(), "org-a", "drone_manuals", "main")).ok).toBe(true);
  expect((await d1PutKv(session(), "org-b", "drone_manuals", "main", [])).ok).toBe(true);
  expect((await d1PutKv(session("other-user"), "org-a", "drone_manuals", "main", [])).ok).toBe(true);
  expect(
    (await d1PutKv(session(), "org-a", "drone_manuals", "country:11111111-1111-1111-1111-111111111111:main", [])).ok
  ).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(5);
});
it("allows rechecking after the pause expires or the active scope explicitly retries", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(100000);
  const fetchMock = vi.fn().mockImplementation(denied);
  vi.stubGlobal("fetch", fetchMock);
  await d1PutKv(session(), "org-a", "drone_manuals", "main", []);
  clearBillingWritePause("org-b", "main");
  expect((await d1PutKv(session(), "org-a", "drone_manuals", "main", [])).paused).toBe(true);
  now.mockReturnValue(160001);
  await d1PutKv(session(), "org-a", "drone_manuals", "main", []);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  clearBillingWritePause("org-a", "main");
  fetchMock.mockImplementationOnce(allowed);
  expect((await d1PutKv(session(), "org-a", "drone_manuals", "main", [])).ok).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
it("checks the pause inside the concurrency gate so queued writes do not stampede", async () => {
  const fetchMock = vi.fn().mockImplementation(denied);
  vi.stubGlobal("fetch", fetchMock);
  const results = await Promise.all(
    Array.from({ length: 18 }, (_, i) => d1PutKv(session(), "org-a", `namespace-${i}`, "main", []))
  );
  expect(results.every((r) => r.error === "billing_write_blocked")).toBe(true);
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  expect(results.some((r) => r.paused)).toBe(true);
});
it("records an audit billing denial before releasing its network slot", async () => {
  const fetchMock = vi.fn().mockImplementation(denied);
  vi.stubGlobal("fetch", fetchMock);
  const results = await Promise.all(Array.from({ length: 18 }, () => d1AppendServerAudit(session(), "org-a", {})));
  expect(results.every((r) => r.error === "billing_write_blocked")).toBe(true);
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
});
it("does not send mutations for the active workspace's known expired trial and resumes after billing refresh", async () => {
  localStorage.setItem("mysafeops_orgId", "org-a");
  localStorage.setItem("mysafeops_trial_ends_at_org-a", "2020-01-01T00:00:00Z");
  const fetchMock = vi.fn().mockImplementation(allowed);
  vi.stubGlobal("fetch", fetchMock);
  expect((await d1PutKv(session(), "org-a", "drone_manuals", "main", [])).error).toBe("billing_write_blocked");
  expect((await d1AppendServerAudit(session(), "org-a", {})).error).toBe("billing_write_blocked");
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await d1GetKv(session(), "org-a", "drone_manuals", "main")).ok).toBe(true);
  expect((await d1PutKv(session(), "org-b", "drone_manuals", "main", [])).ok).toBe(true);
  localStorage.setItem("mysafeops_trial_ends_at_org-a", "2099-01-01T00:00:00Z");
  expect((await d1PutKv(session(), "org-a", "drone_manuals", "main", [])).ok).toBe(true);
});
